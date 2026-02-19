import { buildFlowBaselines } from "./baselines";
import { computeDataQuality } from "./coverage";
import { buildRationale } from "./explain";
import { estimateEta } from "./eta";
import { computeItemFeatures } from "./features";
import { scoreRisk, riskLevelFromScore } from "./model";
import { computePortfolio } from "./portfolio";
import type { PredictInput, PredictOutput } from "./types";

export function predictWorkflowRisk(input: PredictInput): PredictOutput {
  const horizonDays = Math.max(1, Math.round(input.window?.horizonDays ?? 7));
  const baselines = buildFlowBaselines(input.flowMetrics);
  const quality = computeDataQuality({
    items: input.items,
    baselines,
  });

  const dataQualityScalar = (quality.baselineCoverage + quality.avgSignalCompleteness) / 2;

  const predictions = input.items
    .map((item) => {
      const features = computeItemFeatures({
        item,
        baselines,
        now: input.now,
        dataQuality: dataQualityScalar,
      });

      const scored = scoreRisk({
        features,
        baselines,
        quality,
      });

      const eta = estimateEta({
        item,
        baselines,
        now: input.now,
      });

      const prediction = {
        itemId: item.itemId,
        stageId: item.stageId,
        riskScore: scored.riskScore,
        riskLevel: riskLevelFromScore(scored.riskScore),
        delayProbability: scored.delayProbability,
        eta,
        confidence: scored.confidence,
        topDriver: scored.topDriver,
        contributions: scored.contributions,
        rationale: "",
      };

      return {
        ...prediction,
        rationale: buildRationale(prediction),
      };
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      if (left.confidence !== right.confidence) {
        return left.confidence - right.confidence;
      }
      return left.itemId.localeCompare(right.itemId);
    });

  const portfolio = computePortfolio({ predictions });

  return {
    summary: {
      horizonDays,
      pressureScore: portfolio.pressureScore,
      tailRiskScore: portfolio.tailRiskScore,
      criticalCount: portfolio.criticalCount,
      highCount: portfolio.highCount,
      topStage: portfolio.topStage,
      stageConcentrationPct: portfolio.stageConcentrationPct,
      topDrivers: portfolio.topDrivers,
      topRisks: predictions.slice(0, 5).map((entry) => ({
        itemId: entry.itemId,
        stageId: entry.stageId,
        riskScore: entry.riskScore,
        riskLevel: entry.riskLevel,
        confidence: entry.confidence,
        eta: entry.eta,
      })),
      predictions: input.includePerItem ? predictions : undefined,
    },
  };
}

export * from "./types";
export * from "./baselines";
export * from "./coverage";
export * from "./features";
export * from "./model";
export * from "./eta";
export * from "./portfolio";
export * from "./explain";
