import type { WorkflowStageId } from "../types";
import type { PolicyGraph } from "./graph";
import type { KnobEffects } from "./knobs";
import type { SimInput } from "./types";

export type SimState = {
  horizonDays: number;
  byStageCount: Record<string, number>;
  wipLimit: Record<string, number | undefined>;
  capacity: Record<string, number>;
  throughputPerWeek?: number;
  leadAvgHours?: number;
  cycleAvgHours?: number;
  bottleneckIndex?: number;
  predictivePressure?: number;
  predictiveCriticalCount?: number;
  etaP50Days?: number;
  etaP90Days?: number;
  bottleneckStage?: WorkflowStageId;
};

function safeNumber(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return undefined;
  }
  return input;
}

function clampCapacity(value: number): number {
  return Math.max(0.1, Math.min(2, value));
}

function maxEtaDays(params: {
  now: Date;
  etas: Array<string | undefined>;
}): number | undefined {
  const days = params.etas
    .map((entry) => {
      if (!entry) {
        return undefined;
      }
      const parsed = new Date(entry);
      if (Number.isNaN(parsed.getTime())) {
        return undefined;
      }
      return Math.max(0, (parsed.getTime() - params.now.getTime()) / (1000 * 60 * 60 * 24));
    })
    .filter((entry): entry is number => typeof entry === "number");

  if (days.length === 0) {
    return undefined;
  }

  return Math.max(...days);
}

export function buildBaselineState(input: SimInput, graph: PolicyGraph): SimState {
  const byStageCount: Record<string, number> = Object.fromEntries(
    graph.stages.map((stageId) => [stageId, Math.max(0, Math.round(input.byStageCount[stageId] ?? 0))]),
  );

  const wipLimit: Record<string, number | undefined> = Object.fromEntries(
    input.policy.stages.map((stage) => [stage.id, typeof stage.wipLimit === "number" ? Math.max(0, Math.round(stage.wipLimit)) : undefined]),
  );

  const capacity: Record<string, number> = Object.fromEntries(graph.stages.map((stageId) => [stageId, 1]));

  const leadAvgHours =
    safeNumber(input.flowMetrics?.leadTime.trimmedAvgHours) ??
    safeNumber(input.flowMetrics?.leadTime.avgHours);
  const cycleAvgHours =
    safeNumber(input.flowMetrics?.cycleTime.trimmedAvgHours) ??
    safeNumber(input.flowMetrics?.cycleTime.avgHours);

  const predictive = input.predictiveRisk?.summary;
  const topRisks = predictive?.topRisks.slice(0, 5) ?? [];
  const etaP50Days = maxEtaDays({
    now: input.now,
    etas: topRisks.map((entry) => entry.eta?.p50At),
  });
  const etaP90Days = maxEtaDays({
    now: input.now,
    etas: topRisks.map((entry) => entry.eta?.p90At),
  });

  const bottleneckStage =
    input.workflowSignals.bottleneckIndex.topStage ??
    input.workflowSignals.stuck.topStage ??
    input.workflowSignals.stages.worstStages[0];

  return {
    horizonDays: Math.max(7, Math.min(60, Math.round(input.scenario.horizon?.days ?? 14))),
    byStageCount,
    wipLimit,
    capacity,
    throughputPerWeek: safeNumber(input.flowMetrics?.throughput.perWeek),
    leadAvgHours,
    cycleAvgHours,
    bottleneckIndex: safeNumber(input.workflowSignals.bottleneckIndex.score) ?? safeNumber(input.workflowSignals.bottleneck.likelihoodScore),
    predictivePressure: safeNumber(predictive?.pressureScore),
    predictiveCriticalCount: safeNumber(predictive?.criticalCount),
    etaP50Days,
    etaP90Days,
    bottleneckStage,
  };
}

export function applyKnobs(base: SimState, knobs: KnobEffects): SimState {
  const stages = Object.keys(base.byStageCount).sort((left, right) => left.localeCompare(right));

  const byStageCount: Record<string, number> = Object.fromEntries(
    stages.map((stageId) => [stageId, Math.max(0, Math.round((base.byStageCount[stageId] ?? 0) + (knobs.influx[stageId] ?? 0)))]),
  );

  const wipLimit: Record<string, number | undefined> = Object.fromEntries(
    stages.map((stageId) => [stageId, knobs.wipLimit[stageId] ?? base.wipLimit[stageId]]),
  );

  const capacity: Record<string, number> = Object.fromEntries(
    stages.map((stageId) => [stageId, clampCapacity((base.capacity[stageId] ?? 1) * (knobs.capacity[stageId] ?? 1))]),
  );

  return {
    ...base,
    horizonDays: knobs.horizonDays,
    byStageCount,
    wipLimit,
    capacity,
  };
}
