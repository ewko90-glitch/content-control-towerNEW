import type { FlowBaselines } from "./baselines";
import type { PredictItemInput } from "./types";

export type DataQuality = {
  baselineCoverage: number;
  hasDueDates: boolean;
  avgSignalCompleteness: number;
};

function validDueAt(input?: string): boolean {
  if (!input) {
    return false;
  }
  const parsed = new Date(input);
  return !Number.isNaN(parsed.getTime());
}

export function computeDataQuality(params: {
  items: PredictItemInput[];
  baselines: FlowBaselines;
}): DataQuality {
  const { items, baselines } = params;

  if (items.length === 0) {
    return {
      baselineCoverage: baselines.hasBaselines ? 1 : 0,
      hasDueDates: false,
      avgSignalCompleteness: 0,
    };
  }

  const hasGlobalCycle = typeof baselines.global.cycleP50Hours === "number" && baselines.global.cycleP50Hours > 0;

  let covered = 0;
  let dueDates = 0;
  let completenessTotal = 0;

  for (const item of items) {
    const stageBaseline = baselines.stage[item.stageId];
    const stageCovered = typeof stageBaseline?.p50DwellHours === "number" && stageBaseline.p50DwellHours > 0;
    if (stageCovered || hasGlobalCycle) {
      covered += 1;
    }

    if (validDueAt(item.dueAt)) {
      dueDates += 1;
    }

    const parts = [item.slaSeverityScore, item.stuckSeverityScore, item.stageWipSeverityScore];
    const present = parts.filter((value) => typeof value === "number" && Number.isFinite(value)).length;
    completenessTotal += present / 3;
  }

  return {
    baselineCoverage: covered / items.length,
    hasDueDates: dueDates > 0,
    avgSignalCompleteness: completenessTotal / items.length,
  };
}
