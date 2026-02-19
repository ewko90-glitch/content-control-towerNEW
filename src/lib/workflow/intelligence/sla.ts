import type { WorkflowPolicy, WorkflowStageId } from "../types";
import type { Severity, SlaStatus, WorkflowItem } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getStageSlaHours(policy: WorkflowPolicy, stageId: WorkflowStageId): number | undefined {
  return policy.stages.find((stage) => stage.id === stageId)?.slaHours;
}

function toSeverity(ageHours: number, slaHours?: number): Severity {
  if (!slaHours || slaHours <= 0) {
    return "none";
  }

  if (ageHours >= slaHours * 1.5) {
    return "critical";
  }
  if (ageHours >= slaHours) {
    return "breach";
  }
  if (ageHours >= slaHours * 0.8) {
    return "warning";
  }
  return "none";
}

function toSeverityScore(ageHours: number, slaHours?: number): number {
  if (!slaHours || slaHours <= 0) {
    return 0;
  }

  const ratio = ageHours / slaHours;
  return clamp(Math.round(((ratio - 0.5) / 1.0) * 100), 0, 100);
}

export function evaluateSla(params: {
  policy: WorkflowPolicy;
  item: WorkflowItem;
  ageHours: number;
}): SlaStatus {
  const slaHours = getStageSlaHours(params.policy, params.item.stageId);
  const severity = toSeverity(params.ageHours, slaHours);

  return {
    itemId: params.item.id,
    stageId: params.item.stageId,
    ageHours: params.ageHours,
    slaHours,
    severity,
    breachHours: slaHours ? Math.max(0, params.ageHours - slaHours) : undefined,
    severityScore: toSeverityScore(params.ageHours, slaHours),
  };
}

export function rollupSlaPressure(statuses: SlaStatus[]): {
  warningCount: number;
  breachCount: number;
  criticalCount: number;
  pressureScore: number;
  topStage?: string;
} {
  let warningCount = 0;
  let breachCount = 0;
  let criticalCount = 0;

  const perStage = new Map<string, { warning: number; breach: number; critical: number; sum: number; count: number }>();
  for (const status of statuses) {
    if (status.severity === "warning") {
      warningCount += 1;
    } else if (status.severity === "breach") {
      breachCount += 1;
    } else if (status.severity === "critical") {
      criticalCount += 1;
    }

    const current = perStage.get(status.stageId) ?? { warning: 0, breach: 0, critical: 0, sum: 0, count: 0 };
    if (status.severity === "warning") {
      current.warning += 1;
    } else if (status.severity === "breach") {
      current.breach += 1;
    } else if (status.severity === "critical") {
      current.critical += 1;
    }
    current.sum += status.severityScore;
    current.count += 1;
    perStage.set(status.stageId, current);
  }

  const pressureScore =
    statuses.length > 0 ? clamp(Math.round(statuses.reduce((acc, status) => acc + status.severityScore, 0) / statuses.length), 0, 100) : 0;

  const rankedStages = Array.from(perStage.entries()).map(([stageId, value]) => {
    const avgSeverityScore = value.count > 0 ? value.sum / value.count : 0;
    const stageScore = value.breach * 2 + value.critical * 4 + value.warning + avgSeverityScore / 25;
    return { stageId, stageScore, count: value.count };
  });

  rankedStages.sort((left, right) => {
    if (right.stageScore !== left.stageScore) {
      return right.stageScore - left.stageScore;
    }
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.stageId.localeCompare(right.stageId);
  });

  return {
    warningCount,
    breachCount,
    criticalCount,
    pressureScore,
    topStage: rankedStages[0]?.stageId,
  };
}
