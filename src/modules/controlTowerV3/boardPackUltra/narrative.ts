import type { PortfolioRow, PortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/types";

import type { PortfolioPhase, SignalStrength, SystemicPattern, WorkspaceSnapshotLike } from "./types";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function generateExecutiveHeadline(args: {
  phase: PortfolioPhase;
  rows: PortfolioRow[];
  patterns: SystemicPattern[];
}): string {
  const drifting = args.rows.filter((row) => row.driftDetected).length;
  const critical = args.rows.filter((row) => row.healthBand === "critical").length;
  const strong = args.rows.filter((row) => row.healthBand === "strong").length;

  if (args.phase === "Stabilization Phase") {
    return `Portfolio execution is structurally unstable: ${critical} critical workspaces and ${drifting} drifting segments require immediate stabilization.`;
  }
  if (args.phase === "Realignment Phase") {
    return `Portfolio direction is fragmented: drift and alignment gaps indicate strategic realignment is needed across operating units.`;
  }
  if (args.phase === "Expansion Phase") {
    return `Core portfolio is stable with ${strong} strong workspaces; leverage transfer can accelerate expansion without increasing systemic risk.`;
  }

  const dominantPattern = args.patterns[0]?.title ?? "mixed execution signals";
  return `Portfolio is operationally stable with ${dominantPattern.toLowerCase()} as the primary optimization opportunity.`;
}

export function generatePortfolioNarrative(args: {
  snapshot: PortfolioSnapshot;
  phase: PortfolioPhase;
  patterns: SystemicPattern[];
}): string {
  const alignmentAvg = mean(args.snapshot.rows.map((row) => row.strategicAlignmentScore));
  const healthAvg = mean(args.snapshot.rows.map((row) => row.healthScore));
  const topPattern = args.patterns[0];

  const patternClause = topPattern
    ? `Primary structural signal: ${topPattern.title.toLowerCase()} affecting ${topPattern.affected.length} workspaces.`
    : "No concentrated structural pattern detected beyond baseline variance.";

  return `Phase: ${args.phase}. Portfolio averages are alignment ${alignmentAvg} and health ${healthAvg}. ${patternClause}`;
}

export function generateDiagnosisForWorkspace(args: {
  row: PortfolioRow;
  snapshot: WorkspaceSnapshotLike;
}): string {
  const row = args.row;
  const isExecutionProblem = row.risks.some((risk) => risk.code === "stalled_execution" || risk.code === "no_weekly_plan");
  const isStrategyProblem = row.risks.some((risk) => risk.code === "misalignment" || risk.code === "strategic_drift");

  const problemType = isExecutionProblem && isStrategyProblem ? "strategy-execution coupling" : isStrategyProblem ? "strategic positioning" : "execution cadence";
  const scope = row.driftDetected || row.risks.length >= 3 ? "systemic" : "localized";

  const topMisalignedCount = args.snapshot.strategy?.alignment?.topMisaligned?.length ?? 0;
  const evidenceClause = topMisalignedCount > 0 ? `Evidence indicates ${topMisalignedCount} misaligned signals in current cycle.` : "Evidence indicates no concentrated misalignment incident.";

  return `${row.workspaceName} shows ${problemType} pressure with ${scope} impact. ${evidenceClause} Current status suggests intervention should prioritize ${
    row.driftDetected ? "drift closure" : row.healthBand === "critical" ? "health recovery" : "targeted optimization"
  }.`;
}

export function generateConfidenceNote(signal: SignalStrength): string {
  return `Confidence: ${signal.confidence.toUpperCase()} (artifacts ${signal.artifacts}, actions ${signal.actions}, outcomes ${signal.outcomes}). ${signal.note}`;
}
