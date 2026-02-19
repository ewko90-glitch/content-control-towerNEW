import type { WorkflowPolicy, WorkflowStageId } from "../types";
import type { StageHealth, StageWip } from "./types";

type BottleneckReasonCode = "WIP_OVER" | "LOW_THROUGHPUT" | "HEALTH_GAP" | "SLA_PRESSURE" | "STUCK_PRESSURE";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function healthGapScore(stageHealth: Record<string, StageHealth>): number {
  const values = Object.values(stageHealth);
  if (values.length <= 1) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left.healthScore - right.healthScore);
  const worst = sorted[0]?.healthScore ?? 0;
  const avgOthers = average(sorted.slice(1).map((entry) => entry.healthScore));
  return clamp(Math.round(avgOthers - worst), 0, 100);
}

function lowThroughputPenalty(params: {
  policy: WorkflowPolicy;
  throughput?: Record<string, number>;
}): { penalty: number; stageId?: string } {
  if (!params.throughput) {
    return { penalty: 0 };
  }

  const nonTerminal = params.policy.stages.filter((stage) => !stage.terminal).map((stage) => stage.id);
  if (nonTerminal.length === 0) {
    return { penalty: 0 };
  }

  const values = nonTerminal.map((stageId) => ({ stageId, value: params.throughput?.[stageId] ?? 0 }));
  const avg = average(values.map((entry) => entry.value));
  if (avg <= 0) {
    return { penalty: 0 };
  }

  const slowest = [...values].sort((left, right) => {
    if (left.value !== right.value) {
      return left.value - right.value;
    }
    return left.stageId.localeCompare(right.stageId);
  })[0];

  const penalty = clamp(Math.round(((avg - slowest.value) / avg) * 100), 0, 100);
  return {
    penalty,
    stageId: slowest.stageId,
  };
}

function selectTopStage(params: {
  stageWip: Record<string, StageWip>;
  stageHealth: Record<string, StageHealth>;
  throughput?: Record<string, number>;
}): string | undefined {
  const highestWip = Object.values(params.stageWip)
    .sort((left, right) => {
      if (right.severityScore !== left.severityScore) {
        return right.severityScore - left.severityScore;
      }
      return left.stageId.localeCompare(right.stageId);
    })[0];

  if (highestWip && highestWip.severityScore > 0) {
    return highestWip.stageId;
  }

  const worstHealth = Object.values(params.stageHealth)
    .sort((left, right) => {
      if (left.healthScore !== right.healthScore) {
        return left.healthScore - right.healthScore;
      }
      return left.stageId.localeCompare(right.stageId);
    })[0];

  if (worstHealth) {
    return worstHealth.stageId;
  }

  if (params.throughput) {
    const lowestThroughput = Object.entries(params.throughput)
      .sort((left, right) => {
        if (left[1] !== right[1]) {
          return left[1] - right[1];
        }
        return left[0].localeCompare(right[0]);
      })[0];
    return lowestThroughput?.[0];
  }

  return undefined;
}

export function computeBottleneckIndex(params: {
  policy: WorkflowPolicy;
  stageHealth: Record<string, StageHealth>;
  stageWip: Record<string, StageWip>;
  slaPressure: number;
  stuckPressure: number;
  propagatedPressure: Record<string, number>;
  throughput?: Record<WorkflowStageId, number>;
}): {
  score: number;
  topStage?: string;
  lowThroughputPenalty: number;
  reasons: Array<{ code: BottleneckReasonCode; stageId?: string; points: number }>;
} {
  const maxWipSeverity = Object.values(params.stageWip).reduce((acc, entry) => Math.max(acc, entry.severityScore), 0);
  const propagatedMax = Object.values(params.propagatedPressure).reduce((acc, value) => Math.max(acc, value), 0);
  const componentA = Math.max(maxWipSeverity, propagatedMax) * 0.35;
  const componentB = params.slaPressure * 0.2;
  const componentC = params.stuckPressure * 0.2;
  const componentD = healthGapScore(params.stageHealth) * 0.15;
  const throughputPenalty = lowThroughputPenalty({ policy: params.policy, throughput: params.throughput });
  const componentE = throughputPenalty.penalty * 0.1;

  const score = clamp(Math.round(componentA + componentB + componentC + componentD + componentE), 0, 100);
  const topStage = selectTopStage({
    stageWip: params.stageWip,
    stageHealth: params.stageHealth,
    throughput: params.throughput,
  });

  const reasons: Array<{ code: BottleneckReasonCode; stageId?: string; points: number }> = [];
  const pushReason = (reason: { code: BottleneckReasonCode; stageId?: string; points: number }) => {
    if (reason.points >= 5) {
      reasons.push(reason);
    }
  };

  pushReason({ code: "WIP_OVER", stageId: topStage, points: Math.round(componentA) });
  pushReason({ code: "SLA_PRESSURE", stageId: params.stageWip[topStage ?? ""]?.stageId, points: Math.round(componentB) });
  pushReason({ code: "STUCK_PRESSURE", stageId: params.stageWip[topStage ?? ""]?.stageId, points: Math.round(componentC) });
  pushReason({ code: "HEALTH_GAP", stageId: topStage, points: Math.round(componentD) });
  pushReason({ code: "LOW_THROUGHPUT", stageId: throughputPenalty.stageId, points: Math.round(componentE) });

  return {
    score,
    topStage,
    lowThroughputPenalty: throughputPenalty.penalty,
    reasons,
  };
}
