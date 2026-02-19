import type { ScenarioInput, ScenarioResult } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!isFiniteNumber(value)) {
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function horizonMultiplier(horizon: 7 | 14 | 30): number {
  if (horizon === 7) {
    return 1.0;
  }
  if (horizon === 14) {
    return 1.6;
  }
  return 2.4;
}

function baseConfidence(horizon: 7 | 14 | 30): number {
  if (horizon === 7) {
    return 0.65;
  }
  if (horizon === 14) {
    return 0.75;
  }
  return 0.85;
}

function rawDeltas(lever: ScenarioInput["lever"], multiplier: number): { health: number; risk: number; roi: number } {
  if (lever === "prioritize_execution") {
    return { health: 2 * multiplier, risk: -3 * multiplier, roi: 500 * multiplier };
  }
  if (lever === "reduce_drift") {
    return { health: 1.5 * multiplier, risk: -5 * multiplier, roi: 200 * multiplier };
  }
  if (lever === "optimize_roi") {
    return { health: 1 * multiplier, risk: -1 * multiplier, roi: 900 * multiplier };
  }
  return { health: 2.5 * multiplier, risk: -4 * multiplier, roi: 300 * multiplier };
}

export function runScenarioSimulation(params: {
  snapshot: {
    healthScore?: number;
    portfolioRiskMatrix?: { exposureScore: number }[];
    decisionAttribution?: { deltaScore: number; estimatedROI: number; confidence: number }[];
  };
  scenario: ScenarioInput;
}): ScenarioResult | null {
  if (!isFiniteNumber(params.snapshot.healthScore)) {
    return null;
  }

  const baseHealth = clamp(params.snapshot.healthScore, 0, 100);
  const matrixExposure = params.snapshot.portfolioRiskMatrix?.[0]?.exposureScore;
  const baseExposure = isFiniteNumber(matrixExposure) ? clamp(matrixExposure, 0, 100) : clamp(100 - baseHealth, 0, 100);
  const baseRoi = (params.snapshot.decisionAttribution ?? []).reduce(
    (sum, item) => sum + (isFiniteNumber(item.estimatedROI) ? item.estimatedROI : 0),
    0,
  );

  const multiplier = horizonMultiplier(params.scenario.horizon);
  const raw = rawDeltas(params.scenario.lever, multiplier);

  let healthScoreDelta = raw.health;
  let riskExposureDelta = raw.risk;
  let roiDelta = raw.roi;

  if (baseExposure >= 76 && riskExposureDelta < 0) {
    riskExposureDelta *= 1.2;
  }
  if (baseRoi < 0) {
    roiDelta *= 1.1;
  }

  healthScoreDelta = round1(clamp(healthScoreDelta, -10, 10));
  riskExposureDelta = round1(clamp(riskExposureDelta, -20, 20));
  roiDelta = Math.round(clamp(roiDelta, -5000, 5000));

  let confidence = baseConfidence(params.scenario.horizon);
  const attribution = params.snapshot.decisionAttribution ?? [];
  if (attribution.length > 0) {
    const avgAttributionConfidence =
      attribution.reduce((sum, item) => sum + (isFiniteNumber(item.confidence) ? item.confidence : 0), 0) / attribution.length;
    if (avgAttributionConfidence >= 0.75) {
      confidence = Math.min(0.9, confidence + 0.05);
    }
  }
  if (baseExposure >= 76) {
    confidence = Math.max(0.55, confidence - 0.05);
  }

  const confidencePct = Math.round(confidence * 100);
  const riskMagnitude = Math.abs(riskExposureDelta);
  const riskDirection = riskExposureDelta <= 0 ? "reduce" : "increase";

  const explanation = `Scenario '${params.scenario.label}' over ${params.scenario.horizon} days is expected to improve Health by ${healthScoreDelta} points, ${riskDirection} Risk Exposure by ${riskMagnitude}, and change estimated ROI by ${roiDelta}. Confidence: ${confidencePct}%.`;

  return {
    scenarioId: params.scenario.id,
    lever: params.scenario.lever,
    horizon: params.scenario.horizon,
    predicted: {
      healthScoreDelta,
      riskExposureDelta,
      roiDelta,
    },
    confidence,
    explanation,
  };
}
