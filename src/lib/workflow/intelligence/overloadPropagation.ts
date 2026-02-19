import type { WorkflowPolicy } from "../types";
import type { StageWip } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function propagateOverloadUpstream(params: {
  policy: WorkflowPolicy;
  stageWip: Record<string, StageWip>;
}): Record<string, number> {
  const output: Record<string, number> = Object.fromEntries(params.policy.stages.map((stage) => [stage.id, 0]));

  for (const stage of params.policy.stages) {
    const wip = params.stageWip[stage.id];
    if (!wip || (wip.severity !== "hard" && wip.severity !== "critical")) {
      continue;
    }

    const predecessors = params.policy.transitions.filter((transition) => transition.to === stage.id).map((transition) => transition.from);
    const propagated = Math.round(wip.severityScore * 0.3);

    for (const predecessor of predecessors) {
      output[predecessor] = clamp((output[predecessor] ?? 0) + propagated, 0, 100);
    }
  }

  return output;
}
