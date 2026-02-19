import { clamp } from "../metrics/percentiles";
import type { WorkflowPolicy, WorkflowStageId } from "../types";
import type { PolicyGraph } from "./graph";
import type { EffectiveCapacityMap, ResistanceMap } from "./resistance";
import type { SimState } from "./state";

export type Projection = {
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

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stageOrder(graph: PolicyGraph): Map<WorkflowStageId, number> {
  return new Map(graph.stages.map((stageId, index) => [stageId, index]));
}

function resolveBottleneckStage(params: {
  graph: PolicyGraph;
  policy: WorkflowPolicy;
  effectiveCapacity: EffectiveCapacityMap;
}): WorkflowStageId | undefined {
  const order = stageOrder(params.graph);
  const preferred = params.policy.stages.filter((stage) => !stage.terminal).map((stage) => stage.id);
  const candidates = preferred.length > 0 ? preferred : [...params.graph.stages];

  return candidates
    .slice()
    .sort((left, right) => {
      const leftCap = params.effectiveCapacity[left] ?? 1;
      const rightCap = params.effectiveCapacity[right] ?? 1;
      if (leftCap !== rightCap) {
        return leftCap - rightCap;
      }
      const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.localeCompare(right);
    })[0];
}

export function projectGlobal(params: {
  graph: PolicyGraph;
  state: SimState;
  resistance: ResistanceMap;
  effectiveCapacity: EffectiveCapacityMap;
  policy: WorkflowPolicy;
}): Projection {
  const bottleneckStage = resolveBottleneckStage({
    graph: params.graph,
    policy: params.policy,
    effectiveCapacity: params.effectiveCapacity,
  });

  const bottleneckCap = bottleneckStage ? params.effectiveCapacity[bottleneckStage] ?? 1 : 1;

  const throughputPerWeek =
    typeof params.state.throughputPerWeek === "number"
      ? params.state.throughputPerWeek * clamp(bottleneckCap, 0.25, 1.8)
      : undefined;

  const throughputGainPct =
    typeof throughputPerWeek === "number" && typeof params.state.throughputPerWeek === "number"
      ? (throughputPerWeek - params.state.throughputPerWeek) / Math.max(0.01, params.state.throughputPerWeek)
      : 0;

  const activeStages = params.graph.stages.filter((stageId) => (params.state.byStageCount[stageId] ?? 0) > 0);
  const consideredStages = activeStages.length > 0 ? activeStages : params.graph.stages;

  const avgEff = average(consideredStages.map((stageId) => params.effectiveCapacity[stageId] ?? 1));
  const avgResistance = average(consideredStages.map((stageId) => params.resistance[stageId] ?? 0));

  const timeMultiplier = (1 / clamp(avgEff, 0.4, 1.6)) * (1 + avgResistance * 0.35);

  const leadAvgHours = typeof params.state.leadAvgHours === "number" ? params.state.leadAvgHours * timeMultiplier : undefined;
  const cycleAvgHours = typeof params.state.cycleAvgHours === "number" ? params.state.cycleAvgHours * timeMultiplier : undefined;

  const bottleneckIndex =
    typeof params.state.bottleneckIndex === "number"
      ? clamp(params.state.bottleneckIndex + (1 - bottleneckCap) * 18 + avgResistance * 12 - throughputGainPct * 22, 0, 100)
      : undefined;

  const predictivePressure =
    typeof params.state.predictivePressure === "number"
      ? clamp(
          params.state.predictivePressure +
            avgResistance * 35 +
            ((bottleneckIndex ?? params.state.bottleneckIndex ?? 0) - (params.state.bottleneckIndex ?? 0)) * 0.35 -
            throughputGainPct * 18,
          0,
          100,
        )
      : undefined;

  const predictiveCriticalCount =
    typeof params.state.predictiveCriticalCount === "number" && typeof predictivePressure === "number" && typeof params.state.predictivePressure === "number"
      ? Math.max(0, params.state.predictiveCriticalCount + Math.round((predictivePressure - params.state.predictivePressure) / 22))
      : undefined;

  const etaThroughputMultiplier =
    typeof params.state.throughputPerWeek === "number" && typeof throughputPerWeek === "number"
      ? clamp(params.state.throughputPerWeek / Math.max(0.01, throughputPerWeek), 0.6, 3)
      : undefined;

  const etaP50Days =
    typeof params.state.etaP50Days === "number" && typeof etaThroughputMultiplier === "number"
      ? params.state.etaP50Days * etaThroughputMultiplier
      : undefined;
  const etaP90Days =
    typeof params.state.etaP90Days === "number" && typeof etaThroughputMultiplier === "number"
      ? params.state.etaP90Days * clamp(etaThroughputMultiplier + 0.15, 0.7, 3.3)
      : undefined;

  return {
    throughputPerWeek,
    leadAvgHours,
    cycleAvgHours,
    bottleneckIndex,
    predictivePressure,
    predictiveCriticalCount,
    etaP50Days,
    etaP90Days,
    bottleneckStage,
  };
}
