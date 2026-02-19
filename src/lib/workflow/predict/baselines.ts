import type { FlowMetricsSnapshot } from "../metrics/types";
import type { WorkflowStageId } from "../types";

export type StageBaseline = {
  stageId: WorkflowStageId;
  p50DwellHours?: number;
  p90DwellHours?: number;
};

export type FlowBaselines = {
  hasBaselines: boolean;
  throughputPerWeek?: number;
  volatilityScore?: number;
  stage: Record<WorkflowStageId, StageBaseline>;
  global: {
    leadP50Hours?: number;
    leadP90Hours?: number;
    cycleP50Hours?: number;
    cycleP90Hours?: number;
  };
};

export function buildFlowBaselines(metrics?: FlowMetricsSnapshot): FlowBaselines {
  const stage: Record<string, StageBaseline> = {};

  for (const entry of metrics?.stageDwell ?? []) {
    stage[entry.stageId] = {
      stageId: entry.stageId,
      p50DwellHours: entry.p50DwellHours,
      p90DwellHours: entry.p90DwellHours,
    };
  }

  const global = {
    leadP50Hours: metrics?.leadTime.p50Hours,
    leadP90Hours: metrics?.leadTime.p90Hours,
    cycleP50Hours: metrics?.cycleTime.p50Hours,
    cycleP90Hours: metrics?.cycleTime.p90Hours,
  };

  const hasStage = Object.keys(stage).length > 0;
  const hasGlobal =
    typeof global.leadP50Hours === "number" ||
    typeof global.leadP90Hours === "number" ||
    typeof global.cycleP50Hours === "number" ||
    typeof global.cycleP90Hours === "number";

  return {
    hasBaselines: hasStage || hasGlobal,
    throughputPerWeek: metrics?.throughput.perWeek,
    volatilityScore: metrics?.trends.volatilityScore,
    stage: stage as Record<WorkflowStageId, StageBaseline>,
    global,
  };
}
