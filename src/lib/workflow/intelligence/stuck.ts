import type { WorkflowPolicy } from "../types";
import type { Severity, SlaStatus, StuckStatus, WorkflowItem } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stageProfile(policy: WorkflowPolicy, stageId: string): { requiresApproval: boolean; isReviewLike: boolean } {
  const stage = policy.stages.find((entry) => entry.id === stageId);
  const normalized = stageId.toLowerCase();
  return {
    requiresApproval: Boolean(stage?.requiresApproval),
    isReviewLike: normalized.includes("review") || normalized.includes("approve"),
  };
}

function severityForStuck(params: {
  ageHours: number;
  slaSeverity: Severity;
  minNoProgressHours: number;
  criticalAgeHours: number;
}): Severity {
  if (params.ageHours >= params.criticalAgeHours || params.slaSeverity === "critical") {
    return "critical";
  }
  if (params.ageHours >= params.minNoProgressHours || params.slaSeverity === "breach") {
    return "breach";
  }
  if (params.slaSeverity === "warning") {
    return "warning";
  }
  return "none";
}

export function detectStuck(params: {
  policy: WorkflowPolicy;
  item: WorkflowItem;
  ageHours: number;
  sla: SlaStatus;
  stageCount: number;
  wipLimit?: number;
  hasOutgoingTransitions: boolean;
  isTerminal: boolean;
  minNoProgressHours?: number;
  criticalAgeHours?: number;
}): StuckStatus | null {
  const minNoProgressHours = params.minNoProgressHours ?? 24;
  const criticalAgeHours = params.criticalAgeHours ?? 72;
  const profile = stageProfile(params.policy, params.item.stageId);

  let reason: StuckStatus["reason"] | null = null;
  if (params.sla.severity === "breach" || params.sla.severity === "critical") {
    reason = "sla_breach";
  } else if (profile.requiresApproval && params.ageHours >= 24) {
    reason = "approval_wait";
  } else if (!params.isTerminal && !params.hasOutgoingTransitions) {
    reason = "no_outgoing_transition";
  } else if (typeof params.wipLimit === "number" && params.stageCount > params.wipLimit && params.ageHours >= 24) {
    reason = "stage_overload";
  } else if (params.ageHours >= minNoProgressHours && (profile.isReviewLike || profile.requiresApproval)) {
    reason = "no_progress";
  }

  if (!reason) {
    return null;
  }

  const severity = severityForStuck({
    ageHours: params.ageHours,
    slaSeverity: params.sla.severity,
    minNoProgressHours,
    criticalAgeHours,
  });

  const bonusByReason: Record<StuckStatus["reason"], number> = {
    sla_breach: 0,
    approval_wait: 0,
    no_progress: 0,
    policy_gap: 15,
    no_outgoing_transition: 15,
    stage_overload: 20,
    unknown: 0,
  };

  const bonus = bonusByReason[reason];
  const severityScore = clamp(params.sla.severityScore + bonus, 0, 100);

  return {
    itemId: params.item.id,
    stageId: params.item.stageId,
    ageHours: params.ageHours,
    severity,
    severityScore,
    reason,
  };
}

export function rollupStuck(statuses: StuckStatus[]): {
  stuckCount: number;
  criticalStuckCount: number;
  pressureScore: number;
  topStage?: string;
} {
  const stuckCount = statuses.length;
  const criticalStuckCount = statuses.filter((status) => status.severity === "critical").length;

  const pressureScore =
    statuses.length > 0 ? clamp(Math.round(statuses.reduce((acc, status) => acc + status.severityScore, 0) / statuses.length), 0, 100) : 0;

  const perStage = new Map<string, { sum: number; count: number }>();
  for (const status of statuses) {
    const current = perStage.get(status.stageId) ?? { sum: 0, count: 0 };
    current.sum += status.severityScore;
    current.count += 1;
    perStage.set(status.stageId, current);
  }

  const ranked = Array.from(perStage.entries())
    .map(([stageId, value]) => ({
      stageId,
      avg: value.count > 0 ? value.sum / value.count : 0,
      count: value.count,
    }))
    .sort((left, right) => {
      if (right.avg !== left.avg) {
        return right.avg - left.avg;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.stageId.localeCompare(right.stageId);
    });

  return {
    stuckCount,
    criticalStuckCount,
    pressureScore,
    topStage: ranked[0]?.stageId,
  };
}
