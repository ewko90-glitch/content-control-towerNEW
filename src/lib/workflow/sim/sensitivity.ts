import type { WorkflowStageId } from "../types";
import { runSimulation } from "./compare";
import type { SimInput, SimResult } from "./types";

export function runSensitivityLite(params: {
  input: SimInput;
  stageId: WorkflowStageId;
}): Array<{ label: string; result: SimResult }> {
  const plus10 = runSimulation({
    ...params.input,
    scenario: {
      ...params.input.scenario,
      id: `${params.input.scenario.id}_sens_10`,
      name: `${params.input.scenario.name} +10% ${params.stageId}`,
      knobs: [...params.input.scenario.knobs, { kind: "capacity", stageId: params.stageId, multiplier: 1.1 }],
    },
  });

  const plus25 = runSimulation({
    ...params.input,
    scenario: {
      ...params.input.scenario,
      id: `${params.input.scenario.id}_sens_25`,
      name: `${params.input.scenario.name} +25% ${params.stageId}`,
      knobs: [...params.input.scenario.knobs, { kind: "capacity", stageId: params.stageId, multiplier: 1.25 }],
    },
  });

  return [
    { label: `${params.stageId}+10%`, result: plus10 },
    { label: `${params.stageId}+25%`, result: plus25 },
  ];
}
