import type { DerivedMetrics, ExplainabilityBlock, RiskDimensionKey, RiskEvaluationResult, ScoreDeduction } from "./types";

export type ExplainEnvelope = {
  id: string;
  module: "digest" | "pressure" | "roi" | "refresh_guidance";
  ruleId: string;
  correlationId?: string;
  workspaceId: string;
  assigneeId: string;
  timestampISO: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

function sanitizePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9:_\-|]/g, "");
}

export function makeExplainId(parts: string[]): string {
  return parts
    .map((part) => sanitizePart(part))
    .filter((part) => part.length > 0)
    .join(":");
}

export function makeCorrelationId(envelopeId: string): string {
  return `explain:${sanitizePart(envelopeId)}`;
}

export function prettyRuleLabel(ruleId: string): string {
  const normalized = ruleId.replace(/[|:_]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return "Unknown Rule";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDeduction(deduction: ScoreDeduction): string {
  return `${deduction.label}: -${deduction.points.toFixed(1)} points`;
}

function topDeductionDrivers(deduction: ScoreDeduction): string {
  return `${deduction.label} (${deduction.points.toFixed(1)})`;
}

function riskDimensionLabel(key: RiskDimensionKey): string {
  if (key === "scheduleRisk") {
    return "Schedule";
  }
  if (key === "workflowRisk") {
    return "Workflow";
  }
  if (key === "approvalRisk") {
    return "Approval";
  }
  return "Pipeline";
}

function structuralSummary(risks: RiskEvaluationResult): string {
  const entries = Object.entries(risks.dimensions) as Array<[RiskDimensionKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);

  const top = entries[0];
  if (!top) {
    return "No structural risk dimensions were detected.";
  }

  return `${riskDimensionLabel(top[0])} is the dominant structural risk (${(top[1] * 100).toFixed(0)}%).`;
}

export function buildExplainability(
  deductions: ScoreDeduction[],
  risks: RiskEvaluationResult,
  metrics: DerivedMetrics,
): ExplainabilityBlock {
  const sortedDeductions = [...deductions].sort((a, b) => b.points - a.points);
  const nonZeroDeductions = sortedDeductions.filter((entry) => entry.points > 0);

  const scoreBreakdown = (nonZeroDeductions.length > 0 ? nonZeroDeductions : sortedDeductions).map(formatDeduction);

  const mainRiskDrivers = nonZeroDeductions.slice(0, 3).map(topDeductionDrivers);
  if (mainRiskDrivers.length === 0) {
    mainRiskDrivers.push("No active deductions from current operating metrics.");
  }

  if (metrics.overduePublicationsCount > 0 && !mainRiskDrivers.some((item) => item.includes("Overdue"))) {
    mainRiskDrivers.push(`Overdue publications (${metrics.overduePublicationsCount})`);
  }

  return {
    scoreBreakdown,
    mainRiskDrivers: mainRiskDrivers.slice(0, 3),
    structuralSummary: structuralSummary(risks),
  };
}
