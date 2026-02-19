import type { WorkflowPolicy, WorkflowStageId } from "../types";

export type PolicyGraph = {
  stages: WorkflowStageId[];
  edges: Array<{ from: WorkflowStageId; to: WorkflowStageId }>;
  outgoing: Record<WorkflowStageId, WorkflowStageId[]>;
  incoming: Record<WorkflowStageId, WorkflowStageId[]>;
};

function stageIndex(stages: WorkflowStageId[]): Map<WorkflowStageId, number> {
  return new Map(stages.map((stageId, index) => [stageId, index]));
}

function sortByPolicyOrder(values: WorkflowStageId[], stages: WorkflowStageId[]): WorkflowStageId[] {
  const index = stageIndex(stages);
  return [...values].sort((left, right) => {
    const leftIndex = index.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = index.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });
}

export function buildPolicyGraph(policy: WorkflowPolicy): PolicyGraph {
  const stages = policy.stages.map((stage) => stage.id);
  const stageSet = new Set(stages);

  const edges = policy.transitions
    .filter((transition) => stageSet.has(transition.from) && stageSet.has(transition.to))
    .map((transition) => ({
      from: transition.from,
      to: transition.to,
    }));

  const outgoing = Object.fromEntries(stages.map((stageId) => [stageId, [] as WorkflowStageId[]])) as Record<WorkflowStageId, WorkflowStageId[]>;
  const incoming = Object.fromEntries(stages.map((stageId) => [stageId, [] as WorkflowStageId[]])) as Record<WorkflowStageId, WorkflowStageId[]>;

  for (const edge of edges) {
    (outgoing[edge.from] ??= []).push(edge.to);
    (incoming[edge.to] ??= []).push(edge.from);
  }

  for (const stageId of stages) {
    outgoing[stageId] = sortByPolicyOrder(outgoing[stageId] ?? [], stages);
    incoming[stageId] = sortByPolicyOrder(incoming[stageId] ?? [], stages);
  }

  return {
    stages,
    edges,
    outgoing,
    incoming,
  };
}

export function topologicalLikeOrder(graph: PolicyGraph): WorkflowStageId[] {
  return [...graph.stages];
}
