import type { WorkflowTransitionEvent } from "../runtime/events";
import type { WorkflowPolicy, WorkflowStageId } from "../types";

export type StageZone = "queue" | "active" | "done";

export type WorkflowZonePolicy = {
  zoneByStageId: Record<WorkflowStageId, StageZone>;
  queueStages?: WorkflowStageId[];
  activeStages?: WorkflowStageId[];
  doneStages?: WorkflowStageId[];
};

export type FlowWindow = {
  lookbackDays: number;
  shortDays: number;
};

export type ItemTimelineSegment = {
  stageId: WorkflowStageId;
  enteredAt: string;
  exitedAt?: string;
  dwellHours: number;
  zone: StageZone;
};

export type ItemTimeline = {
  itemId: string;
  segments: ItemTimelineSegment[];
  firstSeenAt?: string;
  firstActiveAt?: string;
  firstDoneAt?: string;
  leadHours?: number;
  cycleHours?: number;
  activeHours?: number;
  queueHours?: number;
};

export type DurationStats = {
  count: number;
  avgHours: number;
  trimmedAvgHours: number;
  p50Hours: number;
  p75Hours: number;
  p90Hours: number;
  p95Hours: number;
  iqrHours: number;
};

export type ThroughputStats = {
  lastShort: number;
  priorShort: number;
  lastLookback: number;
  perWeek: number;
  deltaPct: number;
};

export type FlowEfficiencyStats = {
  efficiency: number;
  avgActiveHours: number;
  avgLeadHours: number;
  deltaPct: number;
};

export type StageDwellStats = {
  stageId: WorkflowStageId;
  zone: StageZone;
  count: number;
  avgDwellHours: number;
  p50DwellHours: number;
  p90DwellHours: number;
  avgLeadShare: number;
};

export type TrendStats = {
  leadTimeDeltaPct: number;
  cycleTimeDeltaPct: number;
  throughputDeltaPct: number;
  efficiencyDeltaPct: number;
  volatilityScore: number;
};

export type AnomalyCode =
  | "THROUGHPUT_DROP"
  | "LEAD_TIME_SPIKE"
  | "CYCLE_TIME_SPIKE"
  | "EFFICIENCY_DROP"
  | "VOLATILITY_RISE";

export type Anomaly = {
  code: AnomalyCode;
  severity: "low" | "medium" | "high";
  score: number;
  message: string;
};

export type FlowMetricsSnapshot = {
  window: FlowWindow;
  leadTime: DurationStats;
  cycleTime: DurationStats;
  throughput: ThroughputStats;
  efficiency: FlowEfficiencyStats;
  stageDwell: StageDwellStats[];
  trends: TrendStats;
  anomalies: Anomaly[];
  recentDoneItemIds: string[];
};

export type FlowMetricsInput = {
  policy: WorkflowPolicy;
  zones: WorkflowZonePolicy;
  window?: Partial<FlowWindow>;
  now: Date;
  eventsByItemId?: Record<string, WorkflowTransitionEvent[]>;
};
