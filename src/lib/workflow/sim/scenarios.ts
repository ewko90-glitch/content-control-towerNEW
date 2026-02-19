import type { Scenario, ScenarioKnob } from "./types";
import type { WorkflowStageId } from "../types";

export function makeScenario(params: {
  id: string;
  name: string;
  knobs?: ScenarioKnob[];
  horizonDays?: number;
}): Scenario {
  return {
    id: params.id,
    name: params.name,
    horizon: typeof params.horizonDays === "number" ? { days: params.horizonDays } : undefined,
    knobs: params.knobs ?? [],
  };
}

export function baselineScenario(): Scenario {
  return makeScenario({
    id: "baseline",
    name: "Baseline",
    knobs: [],
  });
}

export function stageCapacityScenario(stageId: WorkflowStageId, multiplier: number): Scenario {
  return makeScenario({
    id: `capacity_${stageId}`,
    name: `Capacity + ${stageId}`,
    knobs: [{ kind: "capacity", stageId, multiplier }],
  });
}

export function stageOutageScenario(stageId: WorkflowStageId, days: number, multiplier: number): Scenario {
  return makeScenario({
    id: `outage_${stageId}`,
    name: `Outage ${stageId}`,
    knobs: [{ kind: "outage", stageId, days, multiplier }],
  });
}

export const SIM_SCENARIOS: Scenario[] = [
  baselineScenario(),
  makeScenario({
    id: "capacity_boost_review",
    name: "Capacity Boost Review",
    knobs: [{ kind: "capacity", stageId: "review", multiplier: 1.2 }],
  }),
  makeScenario({
    id: "influx_shock_review",
    name: "Influx Shock Review",
    knobs: [{ kind: "influx", stageId: "review", addCount: 4 }],
  }),
];
