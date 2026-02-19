import type { WorkflowPolicy, WorkflowStageId } from "./types";

export function calculateWip(params: {
  items: { stageId: WorkflowStageId }[];
  policy: WorkflowPolicy;
}): Record<WorkflowStageId, number> {
  const { items, policy } = params;
  const counters: Record<WorkflowStageId, number> = {};

  for (const stage of policy.stages) {
    counters[stage.id] = 0;
  }

  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(counters, item.stageId)) {
      counters[item.stageId] += 1;
    }
  }

  return counters;
}

export function detectWipLimitBreaches(params: {
  items: { stageId: WorkflowStageId }[];
  policy: WorkflowPolicy;
}): WorkflowStageId[] {
  const { items, policy } = params;
  const wip = calculateWip({ items, policy });

  return policy.stages
    .filter((stage) => typeof stage.wipLimit === "number" && wip[stage.id] > stage.wipLimit)
    .map((stage) => stage.id);
}
