import type { AttributionWindow, DecisionImpactAttribution } from "./types";

function confidenceForWindow(window: AttributionWindow): number {
  if (window === 7) {
    return 0.6;
  }
  if (window === 14) {
    return 0.75;
  }
  return 0.9;
}

export function computeDecisionAttribution(params: {
  decisionId: string;
  adoptedAt: string;
  baselineScore: number;
  currentScore: number;
  window: AttributionWindow;
}): DecisionImpactAttribution {
  const deltaScore = params.currentScore - params.baselineScore;
  const estimatedROI = deltaScore * 1000;
  const confidence = confidenceForWindow(params.window);
  const explanation = `Over a ${params.window}-day window, this decision improved the Control Score by ${deltaScore} points, resulting in an estimated ROI of ${estimatedROI}. Confidence level: ${confidence}.`;

  return {
    decisionId: params.decisionId,
    adoptedAt: params.adoptedAt,
    window: params.window,
    baselineScore: params.baselineScore,
    currentScore: params.currentScore,
    deltaScore,
    estimatedROI,
    confidence,
    explanation,
  };
}
