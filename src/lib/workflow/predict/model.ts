import { clamp } from "../metrics/percentiles";
import type { FlowBaselines } from "./baselines";
import type { DataQuality } from "./coverage";
import type { ItemFeatures } from "./features";
import type { RiskContribution, RiskFactorCode } from "./types";

type Scored = {
  code: RiskFactorCode;
  points: number;
  detail: string;
};

const WEIGHTS: Record<RiskFactorCode, number> = {
  STUCK: 28,
  SLA_PRESSURE: 20,
  WIP_OVERLOAD: 15,
  BOTTLENECK: 10,
  AGE_OUTLIER: 18,
  DUE_SOON: 10,
  FLOW_SLOWDOWN: 8,
  VOLATILITY: 6,
  DATA_QUALITY: 8,
  NO_BASELINE: 10,
};

function detail(code: RiskFactorCode): string {
  if (code === "STUCK") {
    return "Item shows stuck-flow signals.";
  }
  if (code === "SLA_PRESSURE") {
    return "SLA pressure is elevated.";
  }
  if (code === "WIP_OVERLOAD") {
    return "Stage WIP exceeds healthy threshold.";
  }
  if (code === "BOTTLENECK") {
    return "Item is in current bottleneck stage.";
  }
  if (code === "AGE_OUTLIER") {
    return "Age exceeds stage p90 baseline.";
  }
  if (code === "DUE_SOON") {
    return "Due date is close relative to horizon.";
  }
  if (code === "FLOW_SLOWDOWN") {
    return "Portfolio throughput trend is slow.";
  }
  if (code === "VOLATILITY") {
    return "Flow volatility remains elevated.";
  }
  if (code === "DATA_QUALITY") {
    return "Input quality lowers predictive certainty.";
  }
  return "Baseline coverage is insufficient.";
}

export function riskLevelFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) {
    return "critical";
  }
  if (score >= 60) {
    return "high";
  }
  if (score >= 35) {
    return "medium";
  }
  return "low";
}

export function scoreRisk(params: {
  features: ItemFeatures;
  baselines: FlowBaselines;
  quality: DataQuality;
}): {
  riskScore: number;
  delayProbability: number;
  confidence: number;
  contributions: RiskContribution[];
  topDriver?: RiskFactorCode;
} {
  const { features, baselines, quality } = params;
  const noBaselineApplied = !baselines.hasBaselines || quality.baselineCoverage < 0.4;

  const qualityFeature = clamp((1 - quality.avgSignalCompleteness) * 0.6 + (1 - quality.baselineCoverage) * 0.4, 0, 1);

  const raw: Array<{ code: RiskFactorCode; value: number }> = [
    { code: "STUCK", value: features.stuck },
    { code: "SLA_PRESSURE", value: features.sla },
    { code: "WIP_OVERLOAD", value: features.wip },
    { code: "BOTTLENECK", value: features.bottleneck },
    { code: "AGE_OUTLIER", value: features.ageOutlier },
    { code: "DUE_SOON", value: features.dueSoon },
    { code: "FLOW_SLOWDOWN", value: features.flowSlowdown },
    { code: "VOLATILITY", value: features.volatility },
    { code: "DATA_QUALITY", value: qualityFeature },
    { code: "NO_BASELINE", value: noBaselineApplied ? 1 : 0 },
  ];

  const scored: Scored[] = raw
    .map((entry) => ({
      code: entry.code,
      points: Math.round(WEIGHTS[entry.code] * clamp(entry.value, 0, 1)),
      detail: detail(entry.code).slice(0, 80),
    }))
    .filter((entry) => entry.points > 0)
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      return left.code.localeCompare(right.code);
    })
    .slice(0, 6);

  const sum = scored.reduce((acc, entry) => acc + entry.points, 0);
  const riskScore = clamp(sum, 0, 100);

  const x = clamp((riskScore - 15) / 85, 0, 1);
  const delayProbability = clamp(x * x * (3 - 2 * x), 0, 1);

  let confidence =
    0.55 +
    0.2 * clamp(quality.baselineCoverage, 0, 1) +
    0.1 * clamp(quality.avgSignalCompleteness, 0, 1) -
    0.15 * clamp(features.volatility, 0, 1) -
    (noBaselineApplied ? 0.1 : 0);

  confidence = clamp(confidence, 0.2, 0.95);

  const contributions: RiskContribution[] = scored.map((entry) => ({
    code: entry.code,
    points: entry.points,
    detail: entry.detail,
  }));

  return {
    riskScore,
    delayProbability,
    confidence,
    contributions,
    topDriver: contributions[0]?.code,
  };
}
