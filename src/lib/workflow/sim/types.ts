import type { WorkflowSignals } from "../intelligence/types";
import type { FlowMetricsSnapshot } from "../metrics/types";
import type { PredictOutput } from "../predict/types";
import type { WorkflowPolicy, WorkflowStageId } from "../types";

export type SimHorizon = { days: number };

export type ScenarioKnob =
  | { kind: "capacity"; stageId?: WorkflowStageId; multiplier: number }
  | { kind: "wipLimit"; stageId: WorkflowStageId; limit: number }
  | { kind: "influx"; stageId: WorkflowStageId; addCount: number }
  | { kind: "outage"; stageId: WorkflowStageId; days: number; multiplier: number };

export type Scenario = {
  id: string;
  name: string;
  horizon?: Partial<SimHorizon>;
  knobs: ScenarioKnob[];
};

export type SimInput = {
  policy: WorkflowPolicy;
  now: Date;
  workflowSignals: WorkflowSignals;
  flowMetrics?: FlowMetricsSnapshot;
  predictiveRisk?: PredictOutput;
  byStageCount: Partial<Record<WorkflowStageId, number>>;
  scenario: Scenario;
};

export type StageProjection = {
  stageId: WorkflowStageId;
  baseline: {
    count: number;
    wipLimit?: number;
    wipPressure: number;
    capacity: number;
    resistance: number;
    effectiveCapacity: number;
  };
  projected: {
    count: number;
    wipLimit?: number;
    wipPressure: number;
    capacity: number;
    resistance: number;
    effectiveCapacity: number;
  };
  delta: {
    countDelta: number;
    wipPressureDelta: number;
    effectiveCapacityDelta: number;
  };
};

export type SimDelta = {
  throughputPerWeekDelta: number;
  leadAvgHoursDelta: number;
  cycleAvgHoursDelta: number;
  bottleneckIndexDelta: number;
  predictivePressureDelta: number;
  predictiveCriticalCountDelta: number;
  etaP50DaysDelta?: number;
  etaP90DaysDelta?: number;
};

export type Attribution = {
  driver: "CAPACITY" | "WIP" | "INFLUX" | "OUTAGE";
  stageId?: WorkflowStageId;
  impactScore: number;
  metrics: Partial<Record<keyof SimDelta, number>>;
  note: string;
};

export type SimResult = {
  scenarioId: string;
  scenarioName: string;
  horizonDays: number;
  baseline: {
    throughputPerWeek?: number;
    leadAvgHours?: number;
    cycleAvgHours?: number;
    bottleneckIndex?: number;
    predictivePressure?: number;
    predictiveCriticalCount?: number;
    etaP50Days?: number;
    etaP90Days?: number;
  };
  projected: {
    throughputPerWeek?: number;
    leadAvgHours?: number;
    cycleAvgHours?: number;
    bottleneckIndex?: number;
    predictivePressure?: number;
    predictiveCriticalCount?: number;
    etaP50Days?: number;
    etaP90Days?: number;
  };
  delta: SimDelta;
  stages: StageProjection[];
  attribution: Attribution[];
  notes: string[];
};
