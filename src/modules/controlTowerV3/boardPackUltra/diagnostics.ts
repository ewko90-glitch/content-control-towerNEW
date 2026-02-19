import type { PortfolioRow, RiskSeverity } from "@/modules/controlTowerV3/portfolio/types";

import type { PortfolioPhase, RiskHeatmap, SignalStrength, SystemicPattern, WorkspaceSnapshotLike } from "./types";

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityForRatio(ratio: number): RiskSeverity {
  if (ratio >= 0.5) {
    return "high";
  }
  if (ratio >= 0.25) {
    return "medium";
  }
  return "low";
}

export function computeSignalStrength(snapshot: WorkspaceSnapshotLike): SignalStrength {
  const inputs = snapshot.strategy?.alignment?.diagnostics?.inputs;
  const artifacts = Math.max(0, Number(inputs?.artifacts ?? 0));
  const actions = Math.max(0, Number(inputs?.actions ?? 0));
  const outcomes = Math.max(0, Number(inputs?.outcomes ?? 0));

  const weightedScore = artifacts * 2 + actions + outcomes * 2;
  const confidence: "low" | "medium" | "high" =
    weightedScore >= 25 ? "high" : weightedScore >= 10 ? "medium" : "low";

  const note =
    confidence === "high"
      ? "Signal is sufficient for high-confidence diagnosis."
      : confidence === "medium"
        ? "Signal is moderate; validate assumptions in next review cycle."
        : "Signal is weak; increase artifact and outcome evidence before major decisions.";

  return {
    artifacts,
    actions,
    outcomes,
    confidence,
    note,
  };
}

export function computeRiskDistribution(rows: PortfolioRow[]): RiskHeatmap {
  const total = rows.length || 1;
  const atRisk = rows.filter((row) => row.healthBand === "critical" || row.healthBand === "risk").length;
  const drifting = rows.filter((row) => row.driftDetected).length;
  const highConfidence = rows.filter((row) => row.confidence === "high").length;
  const lowSignal = rows.filter((row) => row.risks.some((risk) => risk.code === "low_signal") || row.confidence === "low").length;

  return {
    atRiskPercent: roundPercent((atRisk / total) * 100),
    driftingPercent: roundPercent((drifting / total) * 100),
    highConfidencePercent: roundPercent((highConfidence / total) * 100),
    lowSignalPercent: roundPercent((lowSignal / total) * 100),
  };
}

export function detectSystemicPatterns(rows: PortfolioRow[]): SystemicPattern[] {
  const total = rows.length || 1;
  const patterns: SystemicPattern[] = [];

  const driftRows = rows.filter((row) => row.driftDetected);
  if (driftRows.length >= 2) {
    const ratio = driftRows.length / total;
    patterns.push({
      code: "drift_cluster",
      title: "Drift cluster",
      severity: severityForRatio(ratio),
      narrative: "Strategic drift is concentrated across multiple workspaces, indicating systemic execution instability.",
      affected: driftRows.slice(0, 10).map((row) => ({ workspaceId: row.workspaceId, slug: row.workspaceSlug, name: row.workspaceName })),
    });
  }

  const lowAlignmentRows = rows.filter((row) => row.strategicAlignmentScore < 55);
  if (lowAlignmentRows.length >= 2) {
    const ratio = lowAlignmentRows.length / total;
    patterns.push({
      code: "low_alignment_pattern",
      title: "Low alignment pattern",
      severity: severityForRatio(ratio),
      narrative: "Alignment scores indicate strategic intent is not consistently reflected in execution priorities.",
      affected: lowAlignmentRows.slice(0, 10).map((row) => ({ workspaceId: row.workspaceId, slug: row.workspaceSlug, name: row.workspaceName })),
    });
  }

  const bottleneckRows = rows.filter((row) => row.risks.some((risk) => risk.code === "stalled_execution"));
  if (bottleneckRows.length >= 2) {
    const ratio = bottleneckRows.length / total;
    patterns.push({
      code: "execution_bottleneck",
      title: "Execution bottleneck",
      severity: severityForRatio(ratio),
      narrative: "Operational bottlenecks are preventing actions from closing into outcomes.",
      affected: bottleneckRows.slice(0, 10).map((row) => ({ workspaceId: row.workspaceId, slug: row.workspaceSlug, name: row.workspaceName })),
    });
  }

  const noPlanRows = rows.filter((row) => row.risks.some((risk) => risk.code === "no_weekly_plan"));
  if (noPlanRows.length >= 2) {
    const ratio = noPlanRows.length / total;
    patterns.push({
      code: "missing_weekly_planning",
      title: "Missing weekly planning",
      severity: severityForRatio(ratio),
      narrative: "A material share of workspaces lacks a complete weekly strategic move set.",
      affected: noPlanRows.slice(0, 10).map((row) => ({ workspaceId: row.workspaceId, slug: row.workspaceSlug, name: row.workspaceName })),
    });
  }

  const leverageRows = rows.filter((row) => row.healthBand === "strong" && row.momentumBand === "up");
  if (leverageRows.length >= 2) {
    const ratio = leverageRows.length / total;
    patterns.push({
      code: "high_performance_leverage_zone",
      title: "High-performance leverage zone",
      severity: ratio >= 0.25 ? "low" : "medium",
      narrative: "High-performing workspaces create an opportunity to transfer proven playbooks across the portfolio.",
      affected: leverageRows.slice(0, 10).map((row) => ({ workspaceId: row.workspaceId, slug: row.workspaceSlug, name: row.workspaceName })),
    });
  }

  return patterns
    .sort((left, right) => {
      const severityRank = { high: 3, medium: 2, low: 1 } as const;
      const diff = severityRank[right.severity] - severityRank[left.severity];
      if (diff !== 0) {
        return diff;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 5);
}

export function classifyPortfolioPhase(args: {
  rows: PortfolioRow[];
  riskDistribution: RiskHeatmap;
  systemicPatterns: SystemicPattern[];
}): PortfolioPhase {
  const total = args.rows.length || 1;
  const criticalRatio = args.rows.filter((row) => row.healthBand === "critical").length / total;
  const driftRatio = args.rows.filter((row) => row.driftDetected).length / total;
  const strongRatio = args.rows.filter((row) => row.healthBand === "strong").length / total;

  if (criticalRatio >= 0.35 || args.riskDistribution.atRiskPercent >= 55) {
    return "Stabilization Phase";
  }
  if (driftRatio >= 0.35 || args.systemicPatterns.some((pattern) => pattern.code === "low_alignment_pattern" && pattern.severity !== "low")) {
    return "Realignment Phase";
  }
  if (strongRatio >= 0.4 && args.riskDistribution.driftingPercent <= 25) {
    return "Expansion Phase";
  }
  return "Optimization Phase";
}
