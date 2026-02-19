import type { WorkflowStageId } from "../types";
import type { ItemPrediction, PortfolioDrivers } from "./types";

export function computePortfolio(params: {
  predictions: ItemPrediction[];
}): {
  pressureScore: number;
  tailRiskScore: number;
  criticalCount: number;
  highCount: number;
  topStage?: WorkflowStageId;
  stageConcentrationPct: number;
  topDrivers: PortfolioDrivers[];
} {
  const sorted = [...params.predictions].sort((left, right) => {
    if (right.riskScore !== left.riskScore) {
      return right.riskScore - left.riskScore;
    }
    return left.itemId.localeCompare(right.itemId);
  });

  const top10 = sorted.slice(0, 10);
  const top3 = sorted.slice(0, 3);
  const top20 = sorted.slice(0, 20);

  const avg = (values: number[]): number => {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  };

  const pressureScore = avg(top10.map((entry) => entry.riskScore));
  const tailRiskScore = avg(top3.map((entry) => entry.riskScore));
  const criticalCount = params.predictions.filter((entry) => entry.riskLevel === "critical").length;
  const highCount = params.predictions.filter((entry) => entry.riskLevel === "high").length;

  const stageRisk = new Map<string, number>();
  for (const entry of top20) {
    stageRisk.set(entry.stageId, (stageRisk.get(entry.stageId) ?? 0) + entry.riskScore);
  }

  const topStageEntry = Array.from(stageRisk.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0];

  const topStage = topStageEntry?.[0] as WorkflowStageId | undefined;
  const totalTopRisk = top20.reduce((acc, entry) => acc + entry.riskScore, 0);
  const stageConcentrationPct =
    totalTopRisk > 0 && topStageEntry ? Math.round((topStageEntry[1] / totalTopRisk) * 100) : 0;

  const driverPoints = new Map<string, number>();
  let allPoints = 0;
  for (const prediction of top20) {
    for (const contribution of prediction.contributions) {
      driverPoints.set(contribution.code, (driverPoints.get(contribution.code) ?? 0) + contribution.points);
      allPoints += contribution.points;
    }
  }

  const topDrivers: PortfolioDrivers[] = Array.from(driverPoints.entries())
    .map(([code, points]) => ({
      code: code as PortfolioDrivers["code"],
      sharePct: allPoints > 0 ? Math.round((points / allPoints) * 100) : 0,
    }))
    .sort((left, right) => {
      if (right.sharePct !== left.sharePct) {
        return right.sharePct - left.sharePct;
      }
      return left.code.localeCompare(right.code);
    })
    .slice(0, 3);

  return {
    pressureScore,
    tailRiskScore,
    criticalCount,
    highCount,
    topStage,
    stageConcentrationPct,
    topDrivers,
  };
}
