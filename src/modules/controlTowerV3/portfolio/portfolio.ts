import { portfolioCopy, portfolioPlaybooks, portfolioRiskLabels } from "./copy";
import type { HealthBand, MomentumBand, PortfolioInsight, PortfolioRisk, PortfolioRow, PortfolioSnapshot, RiskSeverity } from "./types";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function bandHealth(score: number): HealthBand {
  if (score < 40) {
    return "critical";
  }
  if (score < 60) {
    return "risk";
  }
  if (score < 80) {
    return "ok";
  }
  return "strong";
}

function bandMomentum(momentum7d: number): MomentumBand {
  if (momentum7d < -5) {
    return "down";
  }
  if (momentum7d > 5) {
    return "up";
  }
  return "flat";
}

function severityRank(severity: RiskSeverity): number {
  if (severity === "high") {
    return 3;
  }
  if (severity === "medium") {
    return 2;
  }
  return 1;
}

function healthBandOrder(band: HealthBand): number {
  if (band === "critical") {
    return 0;
  }
  if (band === "risk") {
    return 1;
  }
  if (band === "ok") {
    return 2;
  }
  return 3;
}

function stableRankKey(row: PortfolioRow): string {
  return `${healthBandOrder(row.healthBand)}:${row.driftDetected ? 0 : 1}:${String(row.healthScore).padStart(3, "0")}:${String(
    row.strategicAlignmentScore,
  ).padStart(3, "0")}:${row.workspaceName.toLowerCase()}`;
}

function toIso(value: unknown, fallbackIso: string): string {
  if (typeof value !== "string") {
    return fallbackIso;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallbackIso;
  }
  return new Date(parsed).toISOString();
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function addRisk(list: PortfolioRisk[], risk: PortfolioRisk): void {
  if (!list.some((entry) => entry.code === risk.code)) {
    list.push(risk);
  }
}

function mapWorkspaceToRow(input: {
  ws: { id: string; slug: string; name: string };
  snapshot: any;
  nowIso: string;
}): PortfolioRow {
  const snapshot = input.snapshot ?? {};

  const strategicAlignmentScore = clamp(
    Number(
      snapshot.strategy?.strategicAlignment?.alignmentScore ??
        snapshot.strategy?.alignment?.alignmentScore ??
        snapshot.strategicAlignment?.alignmentScore ??
        50,
    ),
    0,
    100,
  );

  const driftDetected =
    snapshot.strategy?.strategicAlignment?.driftDetected === true ||
    snapshot.strategy?.alignment?.driftDetected === true ||
    snapshot.strategicAlignment?.driftDetected === true;

  const confidenceRaw =
    snapshot.strategy?.strategicAlignment?.confidence ?? snapshot.strategy?.alignment?.confidence ?? snapshot.strategicAlignment?.confidence ?? "low";
  const confidence: "low" | "medium" | "high" = confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low";

  const healthScore = clamp(
    Number(snapshot.healthScore ?? snapshot.metrics?.healthScore ?? snapshot.overview?.healthScore ?? strategicAlignmentScore),
    0,
    100,
  );

  const momentum7d = clamp(
    Number(snapshot.impact?.trend7d?.score ?? snapshot.trend7d?.score ?? snapshot.metrics?.momentum7d ?? 0),
    -100,
    100,
  );

  const weeklyMoves = Array.isArray(snapshot.strategy?.weeklyMoves) ? snapshot.strategy.weeklyMoves : [];
  const topMoves = weeklyMoves
    .filter((entry: any) => entry && typeof entry.title === "string" && (entry.kind === "focus" || entry.kind === "stability" || entry.kind === "optimization"))
    .slice(0, 3)
    .map((entry: any) => ({
      title: entry.title,
      kind: entry.kind,
    }));

  const risks: PortfolioRisk[] = [];
  if (driftDetected) {
    addRisk(risks, {
      code: "strategic_drift",
      label: portfolioRiskLabels.strategic_drift,
      severity: "high",
      evidence: `Alignment ${strategicAlignmentScore}, drift detected`,
    });
  }
  if (healthScore < 40) {
    addRisk(risks, {
      code: "low_health",
      label: portfolioRiskLabels.low_health,
      severity: "high",
      evidence: `Health ${healthScore}`,
    });
  }
  if (strategicAlignmentScore < 55) {
    addRisk(risks, {
      code: "misalignment",
      label: portfolioRiskLabels.misalignment,
      severity: strategicAlignmentScore < 45 ? "high" : "medium",
      evidence: `Alignment ${strategicAlignmentScore}`,
    });
  }
  if (topMoves.length < 3) {
    addRisk(risks, {
      code: "no_weekly_plan",
      label: portfolioRiskLabels.no_weekly_plan,
      severity: "medium",
      evidence: `Weekly moves ${topMoves.length}/3`,
    });
  }

  const topMisaligned = Array.isArray(snapshot.strategy?.alignment?.topMisaligned)
    ? snapshot.strategy.alignment.topMisaligned
    : Array.isArray(snapshot.strategy?.strategicAlignment?.topMisaligned)
      ? snapshot.strategy.strategicAlignment.topMisaligned
      : [];
  const stalledSignals = topMisaligned.filter((entry: any) => {
    const reason = String(entry?.reason ?? "").toLowerCase();
    return reason.includes("negatywne") || reason.includes("stalled") || reason.includes("open loops");
  });
  if (stalledSignals.length > 0) {
    addRisk(risks, {
      code: "stalled_execution",
      label: portfolioRiskLabels.stalled_execution,
      severity: "medium",
      evidence: `Detected ${stalledSignals.length} stalled signals`,
    });
  }

  const diagnosticsInputs = snapshot.strategy?.alignment?.diagnostics?.inputs ?? snapshot.strategy?.strategicAlignment?.diagnostics?.inputs;
  if (
    confidence === "low" &&
    typeof diagnosticsInputs?.artifacts === "number" &&
    typeof diagnosticsInputs?.actions === "number" &&
    diagnosticsInputs.artifacts < 1 &&
    diagnosticsInputs.actions < 5
  ) {
    addRisk(risks, {
      code: "low_signal",
      label: portfolioRiskLabels.low_signal,
      severity: "low",
      evidence: `Inputs artifacts=${diagnosticsInputs.artifacts}, actions=${diagnosticsInputs.actions}`,
    });
  }

  const sortedRisks = risks
    .sort((left, right) => {
      const severityDiff = severityRank(right.severity) - severityRank(left.severity);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return left.code.localeCompare(right.code);
    })
    .slice(0, 5);

  const row: PortfolioRow = {
    workspaceId: input.ws.id,
    workspaceSlug: input.ws.slug,
    workspaceName: input.ws.name,
    healthScore,
    healthBand: bandHealth(healthScore),
    momentum7d,
    momentumBand: bandMomentum(momentum7d),
    strategicAlignmentScore,
    driftDetected,
    confidence,
    risks: sortedRisks,
    topMoves,
    updatedAtIso: toIso(snapshot.generatedAtIso ?? snapshot.updatedAtIso, input.nowIso),
    rankKey: "",
  };

  return {
    ...row,
    rankKey: stableRankKey(row),
  };
}

function rowSorter(left: PortfolioRow, right: PortfolioRow): number {
  const healthOrderDiff = healthBandOrder(left.healthBand) - healthBandOrder(right.healthBand);
  if (healthOrderDiff !== 0) {
    return healthOrderDiff;
  }
  if (left.driftDetected !== right.driftDetected) {
    return left.driftDetected ? -1 : 1;
  }
  if (left.healthScore !== right.healthScore) {
    return left.healthScore - right.healthScore;
  }
  if (left.strategicAlignmentScore !== right.strategicAlignmentScore) {
    return left.strategicAlignmentScore - right.strategicAlignmentScore;
  }
  if (left.momentum7d !== right.momentum7d) {
    return left.momentum7d - right.momentum7d;
  }
  return left.workspaceName.localeCompare(right.workspaceName);
}

function takeWorkspaceRefs(rows: PortfolioRow[], max = 6): Array<{ workspaceId: string; name: string; slug: string }> {
  return rows.slice(0, max).map((row) => ({ workspaceId: row.workspaceId, name: row.workspaceName, slug: row.workspaceSlug }));
}

function makeInsight(params: {
  title: string;
  narrative: string;
  severity: RiskSeverity;
  rows: PortfolioRow[];
  play: { title: string; steps: ReadonlyArray<string> };
}): PortfolioInsight {
  const affected = takeWorkspaceRefs(params.rows, 6);
  const workspaceIdKey = affected.map((entry) => entry.workspaceId).sort((a, b) => a.localeCompare(b)).join(",");
  return {
    id: `pin_${stableHash(`${params.title}|${workspaceIdKey}`)}`,
    title: params.title,
    narrative: params.narrative,
    severity: params.severity,
    affectedWorkspaces: affected,
    recommendedPlay: {
      title: params.play.title,
      steps: [...params.play.steps].slice(0, 5),
    },
  };
}

function buildInsights(rows: PortfolioRow[], summary: PortfolioSnapshot["summary"]): PortfolioInsight[] {
  const insights: PortfolioInsight[] = [];

  const driftingRows = rows.filter((row) => row.driftDetected);
  if (driftingRows.length >= 2) {
    insights.push(
      makeInsight({
        title: "Systemic drift",
        narrative: "Strategic drift appears in multiple workspaces, indicating execution is diverging from priorities.",
        severity: "high",
        rows: driftingRows,
        play: portfolioPlaybooks.drift,
      }),
    );
  }

  const criticalRows = rows.filter((row) => row.healthBand === "critical");
  if (criticalRows.length >= 2) {
    insights.push(
      makeInsight({
        title: "Health crisis cluster",
        narrative: "Multiple workspaces are in critical health, requiring immediate stabilization before optimization.",
        severity: "high",
        rows: criticalRows,
        play: portfolioPlaybooks.critical,
      }),
    );
  }

  const misalignmentRows = rows.filter((row) => row.strategicAlignmentScore < 55);
  if (misalignmentRows.length >= 3) {
    insights.push(
      makeInsight({
        title: "Misalignment pattern",
        narrative: "Alignment scores are consistently low across the portfolio, suggesting strategy-to-execution mismatch.",
        severity: "medium",
        rows: misalignmentRows,
        play: portfolioPlaybooks.misalignment,
      }),
    );
  }

  const noPlanRows = rows.filter((row) => row.risks.some((risk) => risk.code === "no_weekly_plan"));
  if (noPlanRows.length >= 2) {
    insights.push(
      makeInsight({
        title: "No weekly plan",
        narrative: "Weekly strategic moves are missing in several workspaces, reducing operational focus.",
        severity: "medium",
        rows: noPlanRows,
        play: portfolioPlaybooks.noPlan,
      }),
    );
  }

  const opportunityRows = rows.filter((row) => row.healthBand === "strong" && row.momentumBand === "up");
  if (opportunityRows.length >= 2) {
    insights.push(
      makeInsight({
        title: "Opportunity cluster",
        narrative: "Strong and rising workspaces can be used to transfer winning execution patterns.",
        severity: "low",
        rows: opportunityRows,
        play: portfolioPlaybooks.opportunity,
      }),
    );
  }

  if (insights.length === 0 && summary.total > 0) {
    insights.push(
      makeInsight({
        title: "Portfolio baseline",
        narrative: "No systemic concentration detected. Continue weekly monitoring and maintain strategic hygiene.",
        severity: "low",
        rows,
        play: portfolioPlaybooks.noPlan,
      }),
    );
  }

  return insights.slice(0, 6);
}

export async function buildPortfolioSnapshot(args: {
  nowIso: string;
  workspaces: Array<{ id: string; slug: string; name: string }>;
  loadWorkspaceSnapshot: (workspaceId: string) => Promise<any>;
}): Promise<PortfolioSnapshot> {
  const nowIso = toIso(args.nowIso, "1970-01-01T00:00:00.000Z");

  const rowsRaw: PortfolioRow[] = [];
  for (const ws of args.workspaces) {
    const snapshot = await args.loadWorkspaceSnapshot(ws.id);
    rowsRaw.push(mapWorkspaceToRow({ ws, snapshot, nowIso }));
  }

  const rows = [...rowsRaw].sort(rowSorter).map((row) => ({ ...row, rankKey: stableRankKey(row) }));

  const summary = {
    total: rows.length,
    critical: rows.filter((row) => row.healthBand === "critical").length,
    drifting: rows.filter((row) => row.driftDetected).length,
    strong: rows.filter((row) => row.healthBand === "strong").length,
    headline:
      rows.filter((row) => row.healthBand === "critical").length > 0
        ? portfolioCopy.headline.critical(rows.filter((row) => row.healthBand === "critical").length)
        : rows.filter((row) => row.driftDetected).length > 0
          ? portfolioCopy.headline.drifting(rows.filter((row) => row.driftDetected).length)
          : rows.filter((row) => row.healthBand === "strong").length > 0
            ? portfolioCopy.headline.strong(rows.filter((row) => row.healthBand === "strong").length)
            : portfolioCopy.headline.stable,
    notes: [] as string[],
  };

  const notes: string[] = [];
  if (rows.length > 0) {
    const worst = rows[0];
    notes.push(`Most at risk: ${worst.workspaceName} (Health ${worst.healthScore}, Alignment ${worst.strategicAlignmentScore})`);
  }

  if (summary.drifting > 0) {
    const driftTop = rows.filter((row) => row.driftDetected).slice(0, 2).map((row) => row.workspaceName).join(", ");
    if (driftTop.length > 0) {
      notes.push(`Drift hotspots: ${driftTop}`);
    }
  }

  if (summary.strong > 0) {
    const strongTop = rows.filter((row) => row.healthBand === "strong").slice(0, 2).map((row) => row.workspaceName).join(", ");
    if (strongTop.length > 0) {
      notes.push(`Top performers: ${strongTop}`);
    }
  }

  const insights = buildInsights(rows, summary);

  return {
    generatedAtIso: nowIso,
    summary: {
      ...summary,
      notes: notes.slice(0, 3),
    },
    insights,
    rows,
  };
}
