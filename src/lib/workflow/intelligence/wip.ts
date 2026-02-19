import type { WorkflowPolicy, WorkflowStageId } from "../types";
import type { StageWip, WipSeverity } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function severityFromRatio(ratio: number, hasLimit: boolean): WipSeverity {
  if (!hasLimit) {
    return "none";
  }
  if (ratio >= 1.25) {
    return "critical";
  }
  if (ratio >= 1.0) {
    return "hard";
  }
  if (ratio >= 0.85) {
    return "soft";
  }
  return "none";
}

export function computeStageWip(params: {
  policy: WorkflowPolicy;
  byStageCount: Record<string, number>;
}): Record<WorkflowStageId, StageWip> {
  const output: Record<WorkflowStageId, StageWip> = {} as Record<WorkflowStageId, StageWip>;

  for (const stage of params.policy.stages) {
    const count = params.byStageCount[stage.id] ?? 0;
    const wipLimit = stage.wipLimit;
    const ratio = typeof wipLimit === "number" && wipLimit > 0 ? count / wipLimit : 0;
    const overload = typeof wipLimit === "number" && wipLimit > 0 ? Math.max(0, count - wipLimit) : 0;
    const severity = severityFromRatio(ratio, typeof wipLimit === "number" && wipLimit > 0);
    const severityScore = typeof wipLimit === "number" && wipLimit > 0 ? clamp(Math.round((ratio - 0.75) * 120), 0, 100) : 0;

    output[stage.id] = {
      stageId: stage.id,
      count,
      wipLimit,
      overload,
      ratio,
      severity,
      severityScore,
    };
  }

  return output;
}

export function rollupWip(stageWip: Record<string, StageWip>): {
  softCount: number;
  hardCount: number;
  criticalCount: number;
  pressureScore: number;
  topStage?: string;
} {
  const values = Object.values(stageWip);
  const softCount = values.filter((entry) => entry.severity === "soft").length;
  const hardCount = values.filter((entry) => entry.severity === "hard").length;
  const criticalCount = values.filter((entry) => entry.severity === "critical").length;
  const pressureScore = values.length > 0 ? clamp(Math.round(values.reduce((acc, entry) => acc + entry.severityScore, 0) / values.length), 0, 100) : 0;

  const ranked = [...values].sort((left, right) => {
    if (right.severityScore !== left.severityScore) {
      return right.severityScore - left.severityScore;
    }
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.stageId.localeCompare(right.stageId);
  });

  return {
    softCount,
    hardCount,
    criticalCount,
    pressureScore,
    topStage: ranked[0]?.severityScore ? ranked[0].stageId : undefined,
  };
}
