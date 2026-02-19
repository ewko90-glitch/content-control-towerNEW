import type { ImpactEvaluation } from "@/components/decision-impact/impact-types";

export type DecisionStatus = "explored" | "adopted" | "rejected";

export type StrategyState = "none" | "active" | "archived";

export type DecisionDeltaSummary = {
  throughputDelta?: number;
  leadTimeDelta?: number;
  riskDelta?: number;
};

export type MetricSnapshot = {
  capturedAt: string;
  windowDays: number;
  throughputPerWeek?: number;
  leadAvgHours?: number;
  cycleAvgHours?: number;
  bottleneckIndex?: number;
  predictivePressure?: number;
};

export type DecisionEntry = {
  id: string;
  scenarioId?: string;
  scenarioName: string;
  horizonDays: number;
  delta: DecisionDeltaSummary;
  status: DecisionStatus;
  createdAt: string;
  adoptedAt?: string;
  baseline?: MetricSnapshot;
  lastImpact?: ImpactEvaluation;
};

export type DecisionStore = {
  version: "v1";
  currentStrategyId?: string;
  entries: DecisionEntry[];
};
