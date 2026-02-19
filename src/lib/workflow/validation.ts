import { getAllStageIds, getOutgoingTransitions } from "./graph";
import type { WorkflowPolicy, WorkflowStageId } from "./types";

function hasPathToTerminal(policy: WorkflowPolicy, startStageId: WorkflowStageId): boolean {
  const visited = new Set<WorkflowStageId>();
  const queue: WorkflowStageId[] = [startStageId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const stage = policy.stages.find((entry) => entry.id === current);
    if (stage?.terminal) {
      return true;
    }

    const outgoing = getOutgoingTransitions(policy, current).map((transition) => transition.to);
    for (const next of outgoing) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return false;
}

export function validateWorkflowPolicy(policy: WorkflowPolicy): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const stageIds = getAllStageIds(policy);
  const stageIdSet = new Set(stageIds);

  if (policy.stages.length === 0) {
    errors.push("Workflow policy must define at least one stage.");
  }

  if (stageIdSet.size !== stageIds.length) {
    errors.push("Workflow policy contains duplicate stage IDs.");
  }

  const terminalStages = policy.stages.filter((stage) => stage.terminal);
  if (terminalStages.length === 0) {
    errors.push("Workflow policy must define at least one terminal stage.");
  }

  for (const transition of policy.transitions) {
    if (!stageIdSet.has(transition.from) || !stageIdSet.has(transition.to)) {
      errors.push(`Transition ${transition.from} -> ${transition.to} references an invalid stage.`);
    }
  }

  for (const guard of policy.guards) {
    if (!stageIdSet.has(guard.from) || !stageIdSet.has(guard.to)) {
      errors.push(`Guard ${guard.from} -> ${guard.to} references an invalid stage.`);
    }
  }

  const startOrder = policy.stages.reduce((acc, stage) => Math.min(acc, stage.order), Number.POSITIVE_INFINITY);
  const startStageIds = policy.stages.filter((stage) => stage.order === startOrder).map((stage) => stage.id);

  if (startStageIds.length > 0) {
    const reachable = new Set<WorkflowStageId>();
    const queue = [...startStageIds];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || reachable.has(current)) {
        continue;
      }
      reachable.add(current);

      const outgoing = getOutgoingTransitions(policy, current).map((transition) => transition.to);
      for (const next of outgoing) {
        if (!reachable.has(next)) {
          queue.push(next);
        }
      }
    }

    for (const stageId of stageIds) {
      if (!reachable.has(stageId)) {
        errors.push(`Stage ${stageId} is unreachable from workflow start.`);
      }
    }
  }

  for (const stage of policy.stages) {
    const outgoing = getOutgoingTransitions(policy, stage.id);
    if (!stage.terminal && outgoing.length === 0) {
      errors.push(`Non-terminal stage ${stage.id} has no outgoing transitions.`);
    }
  }

  for (const stage of policy.stages) {
    if (!hasPathToTerminal(policy, stage.id)) {
      errors.push(`Stage ${stage.id} cannot reach a terminal stage.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
