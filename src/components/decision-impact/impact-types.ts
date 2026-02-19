import type { MetricSnapshot } from "@/components/decision-timeline/decision-types";

export type { MetricSnapshot };

export type ImpactStatus = "insufficient_data" | "improving" | "neutral" | "worsening";

export type ImpactWindow = 3 | 7 | 14;

export type ImpactMetricDelta = {
  value?: number;
  pct?: number;
  direction: "better" | "worse" | "neutral" | "unknown";
};

export type ImpactEvaluation = {
  decisionId: string;
  evaluatedAt: string;
  window: ImpactWindow;
  status: ImpactStatus;
  confidence: number;
  deltas: {
    throughput: ImpactMetricDelta;
    leadTime: ImpactMetricDelta;
    risk: ImpactMetricDelta;
  };
  notes: string[];
};
