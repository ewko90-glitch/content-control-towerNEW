import { clamp } from "../metrics/percentiles";
import type { WorkflowPolicy } from "../types";
import type { Scenario } from "./types";

export type KnobEffects = {
  horizonDays: number;
  capacity: Record<string, number>;
  wipLimit: Record<string, number | undefined>;
  influx: Record<string, number>;
};

export function compileKnobs(params: {
  policy: WorkflowPolicy;
  scenario: Scenario;
}): KnobEffects {
  const stages = params.policy.stages.map((stage) => stage.id);
  const stageSet = new Set(stages);

  const horizonDays = Math.max(7, Math.min(60, Math.round(params.scenario.horizon?.days ?? 14)));

  const capacity: Record<string, number> = Object.fromEntries(stages.map((stageId) => [stageId, 1]));
  const wipLimit: Record<string, number | undefined> = Object.fromEntries(
    params.policy.stages.map((stage) => [stage.id, typeof stage.wipLimit === "number" ? Math.max(0, Math.round(stage.wipLimit)) : undefined]),
  );
  const influx: Record<string, number> = Object.fromEntries(stages.map((stageId) => [stageId, 0]));

  let globalCapacityMultiplier = 1;

  for (const knob of params.scenario.knobs) {
    if (knob.kind === "capacity") {
      const sanitized = clamp(knob.multiplier, 0.1, 2);
      if (!knob.stageId) {
        globalCapacityMultiplier = clamp(globalCapacityMultiplier * sanitized, 0.1, 2);
      } else if (stageSet.has(knob.stageId)) {
        capacity[knob.stageId] = clamp((capacity[knob.stageId] ?? 1) * sanitized, 0.1, 2);
      }
      continue;
    }

    if (knob.kind === "outage") {
      if (!stageSet.has(knob.stageId)) {
        continue;
      }
      const days = Math.max(0, Math.min(horizonDays, Math.round(knob.days)));
      const multiplier = clamp(knob.multiplier, 0.1, 2);
      const effective = ((horizonDays - days) / horizonDays) * 1 + (days / horizonDays) * multiplier;
      capacity[knob.stageId] = clamp((capacity[knob.stageId] ?? 1) * effective, 0.1, 2);
      continue;
    }

    if (knob.kind === "wipLimit") {
      if (!stageSet.has(knob.stageId)) {
        continue;
      }
      wipLimit[knob.stageId] = Math.max(0, Math.round(knob.limit));
      continue;
    }

    if (knob.kind === "influx" && stageSet.has(knob.stageId)) {
      influx[knob.stageId] = (influx[knob.stageId] ?? 0) + Math.round(knob.addCount);
    }
  }

  for (const stageId of stages) {
    capacity[stageId] = clamp((capacity[stageId] ?? 1) * globalCapacityMultiplier, 0.1, 2);
  }

  return {
    horizonDays,
    capacity,
    wipLimit,
    influx,
  };
}
