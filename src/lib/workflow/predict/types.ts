import type { WorkflowSignals } from "../intelligence/types";
import type { FlowMetricsSnapshot } from "../metrics/types";
import type { WorkflowPolicy, WorkflowStageId } from "../types";

export type PredictionWindow = {
  horizonDays: number;
};

export type PredictItemInput = {
  itemId: string;
  stageId: WorkflowStageId;
  ageHours: number;
  slaSeverityScore?: number;
  stuckSeverityScore?: number;
  stageWipSeverityScore?: number;
  isBottleneckStage?: boolean;
  dueAt?: string;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskFactorCode =
  | "SLA_PRESSURE"
  | "STUCK"
  | "WIP_OVERLOAD"
  | "BOTTLENECK"
  | "AGE_OUTLIER"
  | "DUE_SOON"
  | "FLOW_SLOWDOWN"
  | "VOLATILITY"
  | "DATA_QUALITY"
  | "NO_BASELINE";

export type RiskContribution = {
  code: RiskFactorCode;
  points: number;
  detail: string;
};

export type EtaEstimate = {
  p50At?: string;
  p90At?: string;
  remainingP50Hours?: number;
  remainingP90Hours?: number;
};

export type ItemPrediction = {
  itemId: string;
  stageId: WorkflowStageId;
  riskScore: number;
  riskLevel: RiskLevel;
  delayProbability: number;
  eta: EtaEstimate;
  confidence: number;
  topDriver?: RiskFactorCode;
  contributions: RiskContribution[];
  rationale: string;
};

export type PortfolioDrivers = {
  code: RiskFactorCode;
  sharePct: number;
};

export type PredictSummary = {
  horizonDays: number;
  pressureScore: number;
  tailRiskScore: number;
  criticalCount: number;
  highCount: number;
  topStage?: WorkflowStageId;
  stageConcentrationPct: number;
  topDrivers: PortfolioDrivers[];
  topRisks: Array<
    Pick<ItemPrediction, "itemId" | "stageId" | "riskScore" | "riskLevel" | "confidence"> & {
      eta?: EtaEstimate;
    }
  >;
  predictions?: ItemPrediction[];
};

export type PredictInput = {
  policy: WorkflowPolicy;
  now: Date;
  window?: Partial<PredictionWindow>;
  items: PredictItemInput[];
  workflowSignals?: WorkflowSignals;
  flowMetrics?: FlowMetricsSnapshot;
  includePerItem?: boolean;
};

export type PredictOutput = {
  summary: PredictSummary;
};
