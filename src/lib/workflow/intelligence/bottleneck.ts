import type { WorkflowPolicy } from "../types";
import type { StageHealth } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeBottleneckLikelihood(params: {
  policy: WorkflowPolicy;
  stageHealth: Record<string, StageHealth>;
}): { likelihoodScore: number; topStage?: string } {
  const ordered = params.policy.stages
    .map((stage) => params.stageHealth[stage.id])
    .filter((entry): entry is StageHealth => Boolean(entry))
    .sort((left, right) => left.healthScore - right.healthScore);

  if (ordered.length === 0) {
    return { likelihoodScore: 0 };
  }

  const worst = ordered[0];
  const others = ordered.slice(1);
  if (others.length === 0) {
    return { likelihoodScore: 0 };
  }

  const avgOthers = others.reduce((acc, stage) => acc + stage.healthScore, 0) / others.length;
  const gap = avgOthers - worst.healthScore;
  const likelihoodScore = clamp(Math.round(gap), 0, 100);

  return {
    likelihoodScore,
    topStage: likelihoodScore >= 20 ? worst.stageId : undefined,
  };
}
