import type { FlowBaselines } from "./baselines";
import type { EtaEstimate, PredictItemInput } from "./types";

export function estimateEta(params: {
  item: PredictItemInput;
  baselines: FlowBaselines;
  now: Date;
}): EtaEstimate {
  const stageBaseline = params.baselines.stage[params.item.stageId];

  const baselineP50 =
    (typeof stageBaseline?.p50DwellHours === "number" && stageBaseline.p50DwellHours > 0
      ? stageBaseline.p50DwellHours
      : undefined) ??
    (typeof params.baselines.global.cycleP50Hours === "number" && params.baselines.global.cycleP50Hours > 0
      ? params.baselines.global.cycleP50Hours
      : undefined);

  const baselineP90 =
    (typeof stageBaseline?.p90DwellHours === "number" && stageBaseline.p90DwellHours > 0
      ? stageBaseline.p90DwellHours
      : undefined) ??
    (typeof params.baselines.global.cycleP90Hours === "number" && params.baselines.global.cycleP90Hours > 0
      ? params.baselines.global.cycleP90Hours
      : undefined);

  if (typeof baselineP50 !== "number" && typeof baselineP90 !== "number") {
    return {};
  }

  const remainingP50Hours = typeof baselineP50 === "number" ? Math.max(0, baselineP50 - Math.max(0, params.item.ageHours)) : undefined;
  const remainingP90Hours = typeof baselineP90 === "number" ? Math.max(0, baselineP90 - Math.max(0, params.item.ageHours)) : undefined;

  return {
    remainingP50Hours,
    remainingP90Hours,
    p50At: typeof remainingP50Hours === "number" ? new Date(params.now.getTime() + remainingP50Hours * 3600000).toISOString() : undefined,
    p90At: typeof remainingP90Hours === "number" ? new Date(params.now.getTime() + remainingP90Hours * 3600000).toISOString() : undefined,
  };
}
