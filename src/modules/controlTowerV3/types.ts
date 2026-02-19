export type AttributionWindow = 7 | 14 | 30;
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RiskTrend = "improving" | "stable" | "deteriorating";
export type ScenarioLever = "prioritize_execution" | "reduce_drift" | "optimize_roi" | "stabilize_workflow";
export type ScenarioHorizon = 7 | 14 | 30;

export interface DecisionImpactAttribution {
  decisionId: string;
  adoptedAt: string;
  window: AttributionWindow;
  baselineScore: number;
  currentScore: number;
  deltaScore: number;
  estimatedROI: number;
  confidence: number;
  explanation: string;
}

export interface PortfolioRiskNode {
  id: string;
  label: string;
  exposureScore: number;
  riskLevel: RiskLevel;
  trend: RiskTrend;
  signals?: string[];
}

export interface ScenarioInput {
  id: string;
  label: string;
  lever: ScenarioLever;
  horizon: ScenarioHorizon;
}

export interface ScenarioResult {
  scenarioId: string;
  lever: ScenarioLever;
  horizon: ScenarioHorizon;
  predicted: {
    healthScoreDelta: number;
    riskExposureDelta: number;
    roiDelta: number;
  };
  confidence: number;
  explanation: string;
}

export interface ScenarioLedgerEntry {
  id: string;
  scenarioId: string;
  lever: ScenarioLever;
  horizon: ScenarioHorizon;
  predicted: {
    healthScoreDelta: number;
    riskExposureDelta: number;
    roiDelta: number;
  };
  actual?: {
    healthScoreDelta: number;
    riskExposureDelta: number;
    roiDelta: number;
  };
  createdAt: string;
}

export interface ExecutiveIntelligenceSnapshot {
  decisionAttribution?: DecisionImpactAttribution[];
  portfolioRiskMatrix?: PortfolioRiskNode[];
  scenarioSimulator?: {
    supportedLevers: ScenarioLever[];
  };
  scenarioLedger?: ScenarioLedgerEntry[];
}
