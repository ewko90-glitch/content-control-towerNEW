import { clamp } from "../metrics/percentiles";
import type { WorkflowSignals } from "../intelligence/types";
import { topologicalLikeOrder, type PolicyGraph } from "./graph";
import type { SimState } from "./state";

export type ResistanceMap = Record<string, number>;
export type EffectiveCapacityMap = Record<string, number>;

export function computeStageWipPressure(params: {
  count: number;
  limit?: number;
}): number {
  if (typeof params.limit !== "number" || params.limit <= 0) {
    return 0;
  }
  return clamp((params.count - params.limit) / Math.max(1, params.limit), 0, 1);
}

export function computeResistance(params: {
  graph: PolicyGraph;
  state: SimState;
  signals: WorkflowSignals;
}): {
  resistance: ResistanceMap;
  effectiveCapacity: EffectiveCapacityMap;
} {
  const stages = topologicalLikeOrder(params.graph);

  const base: ResistanceMap = {};
  const propagated: ResistanceMap = {};

  const slaBase = clamp(params.signals.sla.pressureScore / 100, 0, 1);
  const stuckBase = clamp(params.signals.stuck.pressureScore / 100, 0, 1);

  for (const stageId of stages) {
    const wipPressure = computeStageWipPressure({
      count: params.state.byStageCount[stageId] ?? 0,
      limit: params.state.wipLimit[stageId],
    });

    const slaStage = clamp(slaBase + (params.signals.sla.topStage === stageId ? 0.15 : 0), 0, 1);
    const stuckStage = clamp(stuckBase + (params.signals.stuck.topStage === stageId ? 0.15 : 0), 0, 1);

    base[stageId] = clamp(0.55 * wipPressure + 0.25 * slaStage + 0.2 * stuckStage, 0, 1);
    propagated[stageId] = 0;
  }

  const reversed = [...stages].reverse();
  for (let pass = 0; pass < 2; pass += 1) {
    for (const stageId of reversed) {
      const pressure = clamp((base[stageId] ?? 0) + (propagated[stageId] ?? 0), 0, 1);
      if (pressure <= 0.6) {
        continue;
      }
      for (const predecessor of params.graph.incoming[stageId] ?? []) {
        propagated[predecessor] = clamp((propagated[predecessor] ?? 0) + pressure * 0.25, 0, 1);
      }
    }
  }

  const resistance: ResistanceMap = {};
  const effectiveCapacity: EffectiveCapacityMap = {};
  for (const stageId of stages) {
    const stageResistance = clamp((base[stageId] ?? 0) + (propagated[stageId] ?? 0), 0, 1);
    const cap = clamp(params.state.capacity[stageId] ?? 1, 0.1, 2);
    resistance[stageId] = stageResistance;
    effectiveCapacity[stageId] = clamp(cap / (1 + stageResistance), 0.1, 2);
  }

  return {
    resistance,
    effectiveCapacity,
  };
}
