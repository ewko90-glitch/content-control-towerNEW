import { clamp } from "../metrics/percentiles";
import type { FlowBaselines } from "./baselines";
import type { PredictItemInput } from "./types";

export type ItemFeatures = {
  sla: number;
  stuck: number;
  wip: number;
  bottleneck: number;
  ageOutlier: number;
  dueSoon: number;
  flowSlowdown: number;
  volatility: number;
  dataQuality: number;
};

function normalizeScore(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return clamp(value / 100, 0, 1);
}

function dueSoonFactor(dueAt: string | undefined, now: Date): number {
  if (!dueAt) {
    return 0;
  }

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return 0;
  }

  const remainingHours = (due.getTime() - now.getTime()) / 3600000;
  if (remainingHours <= 24) {
    return 1;
  }
  if (remainingHours <= 72) {
    return 0.5;
  }
  return 0;
}

export function computeItemFeatures(params: {
  item: PredictItemInput;
  baselines: FlowBaselines;
  now: Date;
  dataQuality: number;
}): ItemFeatures {
  const { item, baselines, now } = params;

  const stageBaseline = baselines.stage[item.stageId];
  const baselineP90 =
    (typeof stageBaseline?.p90DwellHours === "number" && stageBaseline.p90DwellHours > 0
      ? stageBaseline.p90DwellHours
      : undefined) ??
    (typeof baselines.global.cycleP90Hours === "number" && baselines.global.cycleP90Hours > 0 ? baselines.global.cycleP90Hours : 0);

  const ageOutlier =
    baselineP90 > 0
      ? clamp((Math.max(0, item.ageHours) / baselineP90 - 1) / 1, 0, 1)
      : 0;

  const throughputPerWeek = baselines.throughputPerWeek;
  let flowSlowdown = 0;
  if (typeof throughputPerWeek === "number") {
    if (throughputPerWeek <= 0.5) {
      flowSlowdown = 1;
    } else if (throughputPerWeek <= 1.0) {
      flowSlowdown = 0.6;
    }
  }

  const volatility = clamp((baselines.volatilityScore ?? 0) / 100, 0, 1);

  return {
    sla: normalizeScore(item.slaSeverityScore),
    stuck: normalizeScore(item.stuckSeverityScore),
    wip: normalizeScore(item.stageWipSeverityScore),
    bottleneck: item.isBottleneckStage ? 1 : 0,
    ageOutlier,
    dueSoon: dueSoonFactor(item.dueAt, now),
    flowSlowdown,
    volatility,
    dataQuality: clamp(params.dataQuality, 0, 1),
  };
}
