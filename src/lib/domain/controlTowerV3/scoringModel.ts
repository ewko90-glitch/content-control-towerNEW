import type { ControlTowerThresholds, DerivedMetrics, HealthScoreResult, RiskEvaluationResult, ScoreDeduction } from "./types";

const MAX_SCORE = 100;
const OVERDUE_DEDUCTION_CAP = 30;
const OVERDUE_DEDUCTION_PER_ITEM = 5;
const WORKFLOW_DEDUCTION_CAP = 20;
const WORKFLOW_DEDUCTION_PER_ITEM = 3;
const APPROVAL_BASE_DEDUCTION = 10;
const APPROVAL_EXTRA_DEDUCTION_CAP = 15;
const APPROVAL_EXTRA_DEDUCTION_PER_ITEM = 2;
const NO_SCHEDULE_DEDUCTION = 15;
const STRUCTURAL_RISK_DEDUCTION_MAX = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeDeduction(id: string, label: string, points: number): ScoreDeduction {
  return {
    id,
    label,
    points: clamp(points, 0, MAX_SCORE),
  };
}

export function computeHealthScore(
  metrics: DerivedMetrics,
  risks: RiskEvaluationResult,
  thresholds: ControlTowerThresholds,
): HealthScoreResult {
  const overdueDeduction = Math.min(metrics.overduePublicationsCount * OVERDUE_DEDUCTION_PER_ITEM, OVERDUE_DEDUCTION_CAP);
  const workflowDeduction = Math.min(metrics.stuckContentCount * WORKFLOW_DEDUCTION_PER_ITEM, WORKFLOW_DEDUCTION_CAP);

  const approvalOverload = Math.max(0, metrics.approvalsPendingCount - thresholds.approvalPendingThreshold);
  const approvalDeduction =
    approvalOverload > 0
      ? APPROVAL_BASE_DEDUCTION + Math.min(approvalOverload * APPROVAL_EXTRA_DEDUCTION_PER_ITEM, APPROVAL_EXTRA_DEDUCTION_CAP)
      : 0;

  const noScheduleDeduction = metrics.upcomingPublicationsNext7Days === 0 ? NO_SCHEDULE_DEDUCTION : 0;
  const structuralRiskDeduction = clamp(risks.structuralRiskScore * STRUCTURAL_RISK_DEDUCTION_MAX, 0, STRUCTURAL_RISK_DEDUCTION_MAX);

  const deductions: ScoreDeduction[] = [
    makeDeduction("overdue-impact", "Overdue impact", overdueDeduction),
    makeDeduction("workflow-friction", "Workflow friction", workflowDeduction),
    makeDeduction("approval-overload", "Approval overload", approvalDeduction),
    makeDeduction("future-schedule-gap", "No future schedule", noScheduleDeduction),
    makeDeduction("structural-risk", "Structural risk amplification", structuralRiskDeduction),
  ];

  const totalDeduction = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  const score = clamp(MAX_SCORE - totalDeduction, 0, MAX_SCORE);

  return {
    score,
    deductions,
  };
}
