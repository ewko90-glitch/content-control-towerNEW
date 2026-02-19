import type { ControlTowerThresholds, DecisionPolicyWeights, DerivedMetrics, RiskDimensionKey, RiskEvaluationResult, RiskFlag } from "./types";

const SCHEDULE_WEIGHT = 0.35;
const WORKFLOW_WEIGHT = 0.25;
const APPROVAL_WEIGHT = 0.2;
const PIPELINE_WEIGHT = 0.2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRatio(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return clamp(value / max, 0, 1);
}

function toRiskLevel(intensity: number): RiskFlag["level"] {
  if (intensity >= 0.75) {
    return "high";
  }
  if (intensity >= 0.4) {
    return "medium";
  }
  return "low";
}

function toFlag(id: string, dimension: RiskDimensionKey, intensity: number, message: string): RiskFlag | null {
  if (intensity <= 0) {
    return null;
  }

  return {
    id,
    dimension,
    level: toRiskLevel(intensity),
    intensity: clamp(intensity, 0, 1),
    message,
  };
}

export function evaluateRisks(
  metrics: DerivedMetrics,
  thresholds: ControlTowerThresholds,
  policyWeights?: DecisionPolicyWeights,
): RiskEvaluationResult {
  const scheduleRisk = normalizeRatio(metrics.overduePublicationsCount, thresholds.scheduleOverdueMax);
  const workflowRisk = normalizeRatio(metrics.stuckContentCount, thresholds.workflowStuckMax);
  const approvalRisk = normalizeRatio(metrics.approvalsPendingCount, thresholds.approvalBacklogMax);

  const noScheduleRisk = metrics.upcomingPublicationsNext7Days === 0 ? 1 : 0;
  const pipelineCoverage = metrics.draftCount + metrics.inProgressCount;
  const shallowPipelineRisk = clamp(1 - normalizeRatio(pipelineCoverage, thresholds.pipelineBacklogMin), 0, 1);
  const pipelineRisk = clamp(noScheduleRisk * 0.7 + shallowPipelineRisk * 0.3, 0, 1);

  const structuralRiskScore = clamp(
    (policyWeights?.schedule ?? SCHEDULE_WEIGHT) * scheduleRisk +
      (policyWeights?.workflow ?? WORKFLOW_WEIGHT) * workflowRisk +
      (policyWeights?.approvals ?? APPROVAL_WEIGHT) * approvalRisk +
      (policyWeights?.pipeline ?? PIPELINE_WEIGHT) * pipelineRisk,
    0,
    1,
  );

  const flags: RiskFlag[] = [];
  const scheduleFlag = toFlag(
    "risk-schedule",
    "scheduleRisk",
    scheduleRisk,
    `${metrics.overduePublicationsCount} overdue publications increase schedule pressure.`,
  );
  if (scheduleFlag) {
    flags.push(scheduleFlag);
  }

  const workflowFlag = toFlag(
    "risk-workflow",
    "workflowRisk",
    workflowRisk,
    `${metrics.stuckContentCount} content items are stuck in workflow.`,
  );
  if (workflowFlag) {
    flags.push(workflowFlag);
  }

  const approvalFlag = toFlag(
    "risk-approval",
    "approvalRisk",
    approvalRisk,
    `${metrics.approvalsPendingCount} approvals are pending and create decision backlog.`,
  );
  if (approvalFlag) {
    flags.push(approvalFlag);
  }

  const pipelineFlag = toFlag(
    "risk-pipeline",
    "pipelineRisk",
    pipelineRisk,
    "Pipeline coverage for the next 7 days is insufficient.",
  );
  if (pipelineFlag) {
    flags.push(pipelineFlag);
  }

  return {
    flags,
    structuralRiskScore,
    dimensions: {
      scheduleRisk,
      workflowRisk,
      approvalRisk,
      pipelineRisk,
    },
  };
}
