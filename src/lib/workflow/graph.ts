import type { WorkflowPolicy, WorkflowStage, WorkflowStageId, WorkflowTransition } from "./types";

export function getStage(policy: WorkflowPolicy, id: WorkflowStageId): WorkflowStage | undefined {
  return policy.stages.find((stage) => stage.id === id);
}

export function getAllStageIds(policy: WorkflowPolicy): WorkflowStageId[] {
  return policy.stages.map((stage) => stage.id);
}

export function getOutgoingTransitions(policy: WorkflowPolicy, from: WorkflowStageId): WorkflowTransition[] {
  return policy.transitions.filter((transition) => transition.from === from);
}

export function getIncomingTransitions(policy: WorkflowPolicy, to: WorkflowStageId): WorkflowTransition[] {
  return policy.transitions.filter((transition) => transition.to === to);
}

export function isTerminalStage(policy: WorkflowPolicy, id: WorkflowStageId): boolean {
  return Boolean(getStage(policy, id)?.terminal);
}
