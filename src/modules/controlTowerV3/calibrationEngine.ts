import type { ScenarioLedgerEntry } from "./types";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function computePredictionAccuracy(entry: ScenarioLedgerEntry): number {
  if (!entry.actual) {
    return 0;
  }

  const errors = [
    Math.abs(entry.predicted.healthScoreDelta - entry.actual.healthScoreDelta),
    Math.abs(entry.predicted.riskExposureDelta - entry.actual.riskExposureDelta),
    Math.abs(entry.predicted.roiDelta - entry.actual.roiDelta),
  ];

  const meanAbsoluteError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const accuracy = 1 / (1 + meanAbsoluteError);
  return clamp(accuracy, 0, 1);
}
