import type { DecisionImpactAttribution, PortfolioRiskNode, RiskLevel, RiskTrend } from "./types";

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

function clampScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function toRiskLevel(exposureScore: number): RiskLevel {
  if (exposureScore <= 25) {
    return "low";
  }
  if (exposureScore <= 50) {
    return "medium";
  }
  if (exposureScore <= 75) {
    return "high";
  }
  return "critical";
}

function toTrend(scoreDelta?: number): RiskTrend {
  if (!isFiniteNumber(scoreDelta)) {
    return "stable";
  }
  if (scoreDelta > 0.5) {
    return "improving";
  }
  if (scoreDelta < -0.5) {
    return "deteriorating";
  }
  return "stable";
}

function negativeAttributionMagnitude(decisionAttribution?: DecisionImpactAttribution[]): number {
  if (!Array.isArray(decisionAttribution) || decisionAttribution.length === 0) {
    return 0;
  }

  const negativeDeltaSum = decisionAttribution
    .filter((item) => isFiniteNumber(item.deltaScore) && item.deltaScore < 0)
    .reduce((sum, item) => sum + item.deltaScore, 0);

  return Math.abs(negativeDeltaSum);
}

export function computePortfolioRisk(params: {
  healthScore?: number;
  scoreDelta?: number;
  decisionAttribution?: DecisionImpactAttribution[];
  recentWins?: number;
  suppressedIntents?: number;
}): PortfolioRiskNode[] | null {
  if (!isFiniteNumber(params.healthScore)) {
    return null;
  }

  const safeHealth = clamp(params.healthScore, 0, 100);
  const sumNeg = negativeAttributionMagnitude(params.decisionAttribution);

  const addAdj = clampScore(clamp(Math.round(sumNeg * 2), 0, 25));
  const winAdj = clampScore(clamp(Math.round(params.recentWins ?? 0), 0, 5));
  const supAdj = clampScore(clamp(Math.round((params.suppressedIntents ?? 0) / 2), 0, 10));

  const baseExposure = 100 - safeHealth;
  const exposureScore = clampScore(baseExposure + addAdj - winAdj + supAdj);
  const riskLevel = toRiskLevel(exposureScore);

  const signals: string[] = [];
  if (riskLevel === "high" || riskLevel === "critical") {
    signals.push("Elevated exposure vs. health baseline");
  }
  if (sumNeg > 0) {
    signals.push("Negative decision impact detected");
  }
  if ((params.suppressedIntents ?? 0) > 0) {
    signals.push("Suppressed intents reduce momentum");
  }
  if ((params.recentWins ?? 0) > 0) {
    signals.push("Recent wins mitigate risk");
  }

  return [
    {
      id: "portfolio",
      label: "Portfolio Overview",
      exposureScore,
      riskLevel,
      trend: toTrend(params.scoreDelta),
      ...(signals.length > 0 ? { signals: signals.slice(0, 3) } : {}),
    },
  ];
}
