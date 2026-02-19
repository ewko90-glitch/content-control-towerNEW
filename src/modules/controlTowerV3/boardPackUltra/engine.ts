import { buildPortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/portfolio";
import type { PortfolioRow } from "@/modules/controlTowerV3/portfolio/types";
import { getAdoptionMeta, listRecentAdoptionEvents } from "@/modules/controlTowerV3/adoption/adoptionStore";

import {
  classifyPortfolioPhase,
  computeRiskDistribution,
  computeSignalStrength,
  detectSystemicPatterns,
} from "./diagnostics";
import { buildExecutiveReportLayout } from "./layout";
import {
  generateConfidenceNote,
  generateDiagnosisForWorkspace,
  generateExecutiveHeadline,
  generatePortfolioNarrative,
} from "./narrative";
import { selectPriorityPlays } from "./playbooks";
import type {
  ExecutiveReportModel,
  WorkspacePrescriptionAction,
  WorkspaceSnapshotLike,
} from "./types";

type AccountabilityOverview = {
  adoptedLast7Days: number;
  ignored: number;
  inProgress: number;
  totalMoves: number;
  avgImpactDelta7: number;
  audit: {
    lastAdoptionUpdateAtIso: string | null;
    signalsUsed: string[];
    confidenceNote: string;
    recentAdoptionEvents?: Array<{ moveTitle: string; status: string; atIso: string; source: string }>;
  };
};

function compareIsoDesc(leftIso: string, rightIso: string): number {
  const leftTs = Date.parse(leftIso);
  const rightTs = Date.parse(rightIso);
  const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
  const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
  return safeRight - safeLeft;
}

function confidenceBucket(scores: number[]): "low" | "medium" | "high" {
  if (scores.length === 0) {
    return "low";
  }
  const average = scores.reduce((sum, item) => sum + item, 0) / scores.length;
  if (average >= 2.5) {
    return "high";
  }
  if (average >= 1.75) {
    return "medium";
  }
  return "low";
}

function confidenceNoteFromBucket(bucket: "low" | "medium" | "high"): string {
  if (bucket === "high") {
    return "Impact is measured with high confidence based on sufficient signals.";
  }
  if (bucket === "medium") {
    return "Impact is directional; confidence is medium due to limited signals.";
  }
  return "Impact is early and may be noisy; confidence is low due to sparse signals.";
}

function normalizeScope(filter: string | undefined): string {
  if (!filter || filter.trim().length === 0) {
    return "all";
  }
  return filter.trim().toLowerCase();
}

function clampWorkspaceLimit(workspaces: Array<{ id: string; slug: string; name: string }>): Array<{ id: string; slug: string; name: string }> {
  return [...workspaces]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .slice(0, 25);
}

function applyFilter(rows: PortfolioRow[], filter: string): PortfolioRow[] {
  if (filter === "critical") {
    return rows.filter((row) => row.healthBand === "critical");
  }
  if (filter === "drifting") {
    return rows.filter((row) => row.driftDetected);
  }
  if (filter === "strong") {
    return rows.filter((row) => row.healthBand === "strong");
  }
  if (filter === "misalignment") {
    return rows.filter((row) => row.risks.some((risk) => risk.code === "misalignment"));
  }
  if (filter === "no_plan") {
    return rows.filter((row) => row.risks.some((risk) => risk.code === "no_weekly_plan"));
  }
  return rows;
}

function effortFromScore(score: number): "S" | "M" | "L" {
  if (score >= 70) {
    return "S";
  }
  if (score >= 45) {
    return "M";
  }
  return "L";
}

function workspaceNextActions(row: PortfolioRow): WorkspacePrescriptionAction[] {
  const actions: WorkspacePrescriptionAction[] = [];

  if (row.driftDetected) {
    actions.push({
      title: "Close strategic drift loops",
      why: "Drift indicates execution divergence from portfolio direction.",
      effort: "M",
      expectedOutcome: "Drift signal declines in the next weekly cycle.",
    });
  }

  if (row.risks.some((risk) => risk.code === "misalignment")) {
    actions.push({
      title: "Redefine top weekly priority",
      why: "Misalignment reduces strategic return on execution effort.",
      effort: "S",
      expectedOutcome: "Alignment score increases through explicit priority mapping.",
    });
  }

  if (row.healthBand === "critical" || row.healthBand === "risk") {
    actions.push({
      title: "Reduce non-priority WIP",
      why: "Lower WIP is required to restore execution reliability.",
      effort: "M",
      expectedOutcome: "Health score recovers by reducing operational overload.",
    });
  }

  if (row.risks.some((risk) => risk.code === "no_weekly_plan")) {
    actions.push({
      title: "Define 3 weekly strategic moves",
      why: "Missing weekly plan weakens operational focus.",
      effort: "S",
      expectedOutcome: "Focus, stability and optimization tracks become explicit.",
    });
  }

  actions.push({
    title: "Tighten leverage loop",
    why: "Systematic optimization captures value from current momentum.",
    effort: effortFromScore(row.healthScore),
    expectedOutcome: "Incremental health and alignment gains with controlled risk.",
  });

  while (actions.length < 5) {
    actions.push({
      title: "Validate weekly success metric",
      why: "Metric discipline improves execution learning cycle.",
      effort: "S",
      expectedOutcome: "Higher confidence in strategy-to-outcome interpretation.",
    });
  }

  return actions.slice(0, 5);
}

export async function buildExecutiveReport(args: {
  nowIso: string;
  filter?: string;
  workspaces: Array<{ id: string; slug: string; name: string }>;
  loadPortfolioSnapshot: (input: {
    nowIso: string;
    workspaces: Array<{ id: string; slug: string; name: string }>;
  }) => ReturnType<typeof buildPortfolioSnapshot>;
  loadWorkspaceSnapshot: (workspaceId: string, nowIso: string) => Promise<WorkspaceSnapshotLike>;
}): Promise<ExecutiveReportModel & { accountability: AccountabilityOverview }> {
  const normalizedScope = normalizeScope(args.filter);
  const nowIso = Number.isFinite(Date.parse(args.nowIso)) ? new Date(args.nowIso).toISOString() : "1970-01-01T00:00:00.000Z";

  const workspaceList = clampWorkspaceLimit(args.workspaces);
  const portfolioSnapshot = await args.loadPortfolioSnapshot({
    nowIso,
    workspaces: workspaceList,
  });

  const filteredRows = applyFilter(portfolioSnapshot.rows, normalizedScope);
  const rankingMatrix = [...filteredRows].slice(0, 10);

  const systemicPatterns = detectSystemicPatterns(filteredRows);
  const riskHeatmap = computeRiskDistribution(filteredRows);
  const phase = classifyPortfolioPhase({ rows: filteredRows, riskDistribution: riskHeatmap, systemicPatterns });

  const hasLowSignalPattern = filteredRows.some((row) => row.risks.some((risk) => risk.code === "low_signal"));
  const priorityPlays = selectPriorityPlays({ phase, hasLowSignalPattern });

  const strategicHeadline = generateExecutiveHeadline({ phase, rows: filteredRows, patterns: systemicPatterns });
  const portfolioNarrative = generatePortfolioNarrative({
    snapshot: {
      ...portfolioSnapshot,
      rows: filteredRows,
    },
    phase,
    patterns: systemicPatterns,
  });

  const workspaceBriefs = [] as ExecutiveReportModel["workspaceBriefs"];
  const accountability: AccountabilityOverview = {
    adoptedLast7Days: 0,
    ignored: 0,
    inProgress: 0,
    totalMoves: 0,
    avgImpactDelta7: 0,
    audit: {
      lastAdoptionUpdateAtIso: null,
      signalsUsed: ["Baseline snapshot (at adoption)"],
      confidenceNote: "Impact is early and may be noisy; confidence is low due to sparse signals.",
    },
  };
  const impactSamples: number[] = [];
  const confidenceSamples: number[] = [];
  const recentAuditEvents: Array<{ moveTitle: string; status: string; atIso: string; source: string; workspaceId: string }> = [];
  const signalFlags = {
    hasOutcomeEvents: false,
    hasIntentSessions: false,
  };
  const rowByWorkspaceId = new Map(filteredRows.map((row) => [row.workspaceId, row]));

  for (const ws of workspaceList) {
    const row = rowByWorkspaceId.get(ws.id);
    if (!row) {
      continue;
    }

    const workspaceSnapshot = await args.loadWorkspaceSnapshot(ws.id, nowIso);
    const adoptionMeta = await getAdoptionMeta(ws.id);
    const workspaceEvents = await listRecentAdoptionEvents(ws.id, 3);
    if (adoptionMeta.lastUpdatedAtIso) {
      const currentLast = accountability.audit.lastAdoptionUpdateAtIso;
      if (!currentLast || compareIsoDesc(currentLast, adoptionMeta.lastUpdatedAtIso) > 0) {
        accountability.audit.lastAdoptionUpdateAtIso = adoptionMeta.lastUpdatedAtIso;
      }
    }
    for (const event of workspaceEvents) {
      recentAuditEvents.push({
        moveTitle: event.moveTitle,
        status: event.status,
        atIso: event.atIso,
        source: event.source,
        workspaceId: ws.id,
      });
    }

    const outcomesCount = Number(workspaceSnapshot.strategy?.alignment?.diagnostics?.inputs?.outcomes ?? 0);
    const actionsCount = Number(workspaceSnapshot.strategy?.alignment?.diagnostics?.inputs?.actions ?? 0);
    if (outcomesCount > 0) {
      signalFlags.hasOutcomeEvents = true;
    }
    if (actionsCount > 0) {
      signalFlags.hasIntentSessions = true;
    }

    const signal = computeSignalStrength(workspaceSnapshot);
    const diagnosis = generateDiagnosisForWorkspace({ row, snapshot: workspaceSnapshot });

    const weeklyMoves = (workspaceSnapshot.strategy?.weeklyMoves ?? [])
      .filter((move) => move.kind === "focus" || move.kind === "stability" || move.kind === "optimization")
      .slice(0, 3)
      .map((move) => {
        const adoptionStatus =
          (move as any).adoption?.status === "adopted" ||
          (move as any).adoption?.status === "in_progress" ||
          (move as any).adoption?.status === "ignored" ||
          (move as any).adoption?.status === "not_started"
            ? (move as any).adoption.status
            : "not_started";

        const adoptedAtIso = typeof (move as any).adoption?.adoptedAtIso === "string" ? (move as any).adoption.adoptedAtIso : undefined;
        const impact7d = (move as any).adoption?.impact?.d7;
        const impact7dText =
          impact7d && typeof impact7d.healthDelta === "number" && typeof impact7d.alignmentDelta === "number"
            ? `Impact (7d): ${impact7d.healthDelta >= 0 ? "+" : ""}${impact7d.healthDelta} Health, ${impact7d.alignmentDelta >= 0 ? "+" : ""}${
                impact7d.alignmentDelta
              } Alignment, Confidence ${String(impact7d.confidence ?? "low")}`
            : undefined;

        accountability.totalMoves += 1;
        if (adoptionStatus === "ignored") {
          accountability.ignored += 1;
        }
        if (adoptionStatus === "in_progress") {
          accountability.inProgress += 1;
        }
        if (adoptionStatus === "adopted" && adoptedAtIso) {
          const adoptedTs = Date.parse(adoptedAtIso);
          const nowTs = Date.parse(nowIso);
          if (Number.isFinite(adoptedTs) && Number.isFinite(nowTs) && nowTs - adoptedTs <= 7 * 24 * 60 * 60 * 1000) {
            accountability.adoptedLast7Days += 1;
          }
        }
        if (impact7d && typeof impact7d.healthDelta === "number" && typeof impact7d.alignmentDelta === "number") {
          impactSamples.push(impact7d.healthDelta + impact7d.alignmentDelta);
          const confidenceText = String(impact7d.confidence ?? "low");
          const confidenceScore = confidenceText === "high" ? 3 : confidenceText === "medium" ? 2 : 1;
          confidenceSamples.push(confidenceScore);
        }

        return {
          kind: move.kind as "focus" | "stability" | "optimization",
          title: String(move.title ?? "Strategic move"),
          metric: String((move as any).successMetric ?? "Define measurable weekly target"),
          effort: move.effort === "S" || move.effort === "M" || move.effort === "L" ? move.effort : "M",
          risk: move.risk === "low" || move.risk === "medium" || move.risk === "high" ? move.risk : "medium",
          expectedImpact: `Health delta ${Math.round(Number(move.expectedImpact?.healthScoreDelta ?? 0))}`,
          adoptionStatus,
          impact7dText,
        };
      });

    const riskRegister = row.risks.slice(0, 5).map((risk) => ({
      label: risk.label,
      severity: risk.severity,
      evidence: risk.evidence,
    }));

    workspaceBriefs.push({
      workspaceId: row.workspaceId,
      workspaceSlug: row.workspaceSlug,
      workspaceName: row.workspaceName,
      strategicStatus: {
        health: row.healthScore,
        alignment: row.strategicAlignmentScore,
        drift: row.driftDetected,
        confidence: row.confidence,
      },
      executiveDiagnosis: diagnosis,
      weeklyMoves,
      riskRegister,
      operationalPrescription: workspaceNextActions(row),
      signal: {
        ...signal,
        note: generateConfidenceNote(signal),
      },
    });
  }

  const avgAlignment = filteredRows.length > 0 ? Math.round(filteredRows.reduce((sum, row) => sum + row.strategicAlignmentScore, 0) / filteredRows.length) : 0;
  const avgHealth = filteredRows.length > 0 ? Math.round(filteredRows.reduce((sum, row) => sum + row.healthScore, 0) / filteredRows.length) : 0;

  const model: ExecutiveReportModel = {
    meta: {
      title: "Content Control Tower",
      subtitle: "Strategic Portfolio Intelligence",
      generatedAtIso: nowIso,
      scope: normalizedScope,
      phase,
    },
    executiveSummary: {
      strategicHeadline,
      portfolioNarrative,
      kpis: {
        totalWorkspaces: filteredRows.length,
        critical: filteredRows.filter((row) => row.healthBand === "critical").length,
        drifting: filteredRows.filter((row) => row.driftDetected).length,
        strong: filteredRows.filter((row) => row.healthBand === "strong").length,
        averageAlignment: avgAlignment,
        averageHealth: avgHealth,
      },
      priorityPlays,
    },
    structuralAnalysis: {
      rankingMatrix,
      systemicPatterns,
      riskHeatmap,
    },
    workspaceBriefs,
    source: {
      portfolioSnapshot,
      workspaceSnapshotCount: workspaceBriefs.length,
    },
    layout: {
      sections: [],
    },
  };

  const accountabilityWithImpact: AccountabilityOverview = {
    ...accountability,
    avgImpactDelta7: impactSamples.length > 0 ? Math.round(impactSamples.reduce((sum, value) => sum + value, 0) / impactSamples.length) : 0,
    audit: {
      lastAdoptionUpdateAtIso: accountability.audit.lastAdoptionUpdateAtIso,
      signalsUsed: [
        ...(signalFlags.hasOutcomeEvents ? ["Outcome events (72h)"] : []),
        ...(signalFlags.hasIntentSessions ? ["Intent sessions (2h)"] : []),
        "Baseline snapshot (at adoption)",
      ],
      confidenceNote: confidenceNoteFromBucket(confidenceBucket(confidenceSamples)),
      ...(recentAuditEvents.length > 0
        ? {
            recentAdoptionEvents: [...recentAuditEvents]
              .sort((left, right) => {
                const byIso = compareIsoDesc(left.atIso, right.atIso);
                if (byIso !== 0) {
                  return byIso;
                }
                const byTitle = left.moveTitle.localeCompare(right.moveTitle);
                if (byTitle !== 0) {
                  return byTitle;
                }
                const byStatus = left.status.localeCompare(right.status);
                if (byStatus !== 0) {
                  return byStatus;
                }
                const bySource = left.source.localeCompare(right.source);
                if (bySource !== 0) {
                  return bySource;
                }
                return left.workspaceId.localeCompare(right.workspaceId);
              })
              .slice(0, 3)
              .map((event) => ({
                moveTitle: event.moveTitle,
                status: event.status,
                atIso: event.atIso,
                source: event.source,
              })),
          }
        : {}),
    },
  };

  return {
    ...model,
    accountability: accountabilityWithImpact,
    layout: {
      sections: buildExecutiveReportLayout(model),
    },
  };
}
