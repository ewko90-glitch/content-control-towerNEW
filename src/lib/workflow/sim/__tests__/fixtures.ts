import type { WorkflowSignals } from "../../intelligence/types";
import type { FlowMetricsSnapshot } from "../../metrics/types";
import type { PredictOutput } from "../../predict/types";
import type { WorkflowPolicy } from "../../types";
import { DEFAULT_WORKFLOW_POLICY } from "../../policy";
import type { SimInput } from "../types";

export const FIXED_NOW = new Date("2026-02-15T12:00:00.000Z");

export const SIM_POLICY: WorkflowPolicy = {
  ...DEFAULT_WORKFLOW_POLICY,
  stages: DEFAULT_WORKFLOW_POLICY.stages.map((stage) => {
    if (stage.id === "draft") {
      return { ...stage, wipLimit: 6 };
    }
    if (stage.id === "review") {
      return { ...stage, wipLimit: 4 };
    }
    if (stage.id === "approved") {
      return { ...stage, wipLimit: 5 };
    }
    if (stage.id === "scheduled") {
      return { ...stage, wipLimit: 4 };
    }
    return stage;
  }),
};

export const BASE_SIGNALS: WorkflowSignals = {
  totalItems: 26,
  byStageCount: {
    draft: 8,
    review: 10,
    approved: 5,
    scheduled: 3,
    published: 0,
  },
  stageWip: {
    draft: { stageId: "draft", count: 8, wipLimit: 6, overload: 2, ratio: 1.33, severity: "hard", severityScore: 72 },
    review: { stageId: "review", count: 10, wipLimit: 4, overload: 6, ratio: 2.5, severity: "critical", severityScore: 94 },
    approved: { stageId: "approved", count: 5, wipLimit: 5, overload: 0, ratio: 1, severity: "none", severityScore: 0 },
    scheduled: { stageId: "scheduled", count: 3, wipLimit: 4, overload: 0, ratio: 0.75, severity: "none", severityScore: 0 },
    published: { stageId: "published", count: 0, overload: 0, ratio: 0, severity: "none", severityScore: 0 },
  },
  wip: {
    softCount: 1,
    hardCount: 1,
    criticalCount: 1,
    pressureScore: 78,
    topStage: "review",
  },
  propagatedPressure: {
    draft: 0.45,
    review: 0.88,
    approved: 0.3,
    scheduled: 0.1,
    published: 0,
  },
  throughput: {
    draft: 4,
    review: 3,
    approved: 3,
    scheduled: 2,
    published: 2,
  },
  sla: {
    warningCount: 4,
    breachCount: 3,
    criticalCount: 2,
    topStage: "review",
    pressureScore: 68,
  },
  stuck: {
    stuckCount: 5,
    criticalStuckCount: 2,
    topStage: "review",
    pressureScore: 62,
  },
  stages: {
    worstStages: ["review", "draft"],
    stageHealth: {
      draft: { stageId: "draft", count: 8, sla: { warning: 1, breach: 0, critical: 0, avgSeverityScore: 20 }, stuck: { stuck: 1, critical: 0 }, healthScore: 64 },
      review: { stageId: "review", count: 10, sla: { warning: 2, breach: 2, critical: 2, avgSeverityScore: 79 }, stuck: { stuck: 4, critical: 2 }, healthScore: 22 },
      approved: { stageId: "approved", count: 5, sla: { warning: 1, breach: 1, critical: 0, avgSeverityScore: 34 }, stuck: { stuck: 0, critical: 0 }, healthScore: 69 },
      scheduled: { stageId: "scheduled", count: 3, sla: { warning: 0, breach: 0, critical: 0, avgSeverityScore: 0 }, stuck: { stuck: 0, critical: 0 }, healthScore: 82 },
      published: { stageId: "published", count: 0, sla: { warning: 0, breach: 0, critical: 0, avgSeverityScore: 0 }, stuck: { stuck: 0, critical: 0 }, healthScore: 90 },
    },
  },
  bottleneck: {
    likelihoodScore: 76,
    topStage: "review",
  },
  bottleneckIndex: {
    score: 72,
    topStage: "review",
    lowThroughputPenalty: 14,
    reasons: [
      { code: "WIP_OVER", stageId: "review", points: 28 },
      { code: "SLA_PRESSURE", stageId: "review", points: 20 },
      { code: "STUCK_PRESSURE", stageId: "review", points: 18 },
      { code: "LOW_THROUGHPUT", stageId: "review", points: 6 },
    ],
  },
};

export const BASE_FLOW_METRICS: FlowMetricsSnapshot = {
  window: { lookbackDays: 28, shortDays: 7 },
  leadTime: {
    count: 32,
    avgHours: 74,
    trimmedAvgHours: 70,
    p50Hours: 64,
    p75Hours: 90,
    p90Hours: 130,
    p95Hours: 150,
    iqrHours: 26,
  },
  cycleTime: {
    count: 32,
    avgHours: 42,
    trimmedAvgHours: 39,
    p50Hours: 34,
    p75Hours: 52,
    p90Hours: 78,
    p95Hours: 92,
    iqrHours: 18,
  },
  throughput: {
    lastShort: 8,
    priorShort: 6,
    lastLookback: 26,
    perWeek: 8,
    deltaPct: 33,
  },
  efficiency: {
    efficiency: 0.56,
    avgActiveHours: 39,
    avgLeadHours: 70,
    deltaPct: -4,
  },
  stageDwell: [
    { stageId: "draft", zone: "queue", count: 26, avgDwellHours: 20, p50DwellHours: 14, p90DwellHours: 40, avgLeadShare: 0.28 },
    { stageId: "review", zone: "active", count: 24, avgDwellHours: 26, p50DwellHours: 20, p90DwellHours: 52, avgLeadShare: 0.37 },
    { stageId: "approved", zone: "active", count: 22, avgDwellHours: 14, p50DwellHours: 12, p90DwellHours: 30, avgLeadShare: 0.18 },
    { stageId: "scheduled", zone: "active", count: 20, avgDwellHours: 11, p50DwellHours: 9, p90DwellHours: 24, avgLeadShare: 0.15 },
  ],
  trends: {
    leadTimeDeltaPct: 5,
    cycleTimeDeltaPct: 3,
    throughputDeltaPct: 9,
    efficiencyDeltaPct: -2,
    volatilityScore: 39,
  },
  anomalies: [],
  recentDoneItemIds: ["a", "b", "c"],
};

export const BASE_PREDICTIVE: PredictOutput = {
  summary: {
    horizonDays: 7,
    pressureScore: 58,
    tailRiskScore: 74,
    criticalCount: 2,
    highCount: 4,
    topStage: "review",
    stageConcentrationPct: 44,
    topDrivers: [
      { code: "STUCK", sharePct: 32 },
      { code: "WIP_OVERLOAD", sharePct: 27 },
      { code: "SLA_PRESSURE", sharePct: 19 },
    ],
    topRisks: [
      {
        itemId: "r1",
        stageId: "review",
        riskScore: 88,
        riskLevel: "critical",
        confidence: 0.84,
        eta: {
          p50At: "2026-02-19T12:00:00.000Z",
          p90At: "2026-02-24T12:00:00.000Z",
        },
      },
      {
        itemId: "r2",
        stageId: "approved",
        riskScore: 72,
        riskLevel: "high",
        confidence: 0.78,
        eta: {
          p50At: "2026-02-18T12:00:00.000Z",
          p90At: "2026-02-22T12:00:00.000Z",
        },
      },
    ],
  },
};

export function buildSimInput(overrides?: Partial<SimInput>): SimInput {
  const base: SimInput = {
    policy: SIM_POLICY,
    now: FIXED_NOW,
    workflowSignals: BASE_SIGNALS,
    flowMetrics: BASE_FLOW_METRICS,
    predictiveRisk: BASE_PREDICTIVE,
    byStageCount: {
      draft: 8,
      review: 10,
      approved: 5,
      scheduled: 3,
      published: 0,
    },
    scenario: {
      id: "baseline",
      name: "Baseline",
      knobs: [],
    },
  };

  return {
    ...base,
    ...overrides,
  };
}
