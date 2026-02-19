import type { WorkflowTransitionEvent } from "../runtime/events";
import type { WorkflowPolicy, WorkflowStageId } from "../types";

export type WorkflowItem = {
  id: string;
  stageId: WorkflowStageId;
  stageEnteredAt?: string;
  updatedAt: string;
  requiresApproval?: boolean;
};

export type WorkflowEventStream = {
  byItemId: Record<string, WorkflowTransitionEvent[]>;
};

export type TimeInStage = {
  itemId: string;
  stageId: WorkflowStageId;
  enteredAt: string;
  ageHours: number;
  source: "stageEnteredAt" | "eventStream" | "updatedAtFallback";
};

export type Severity = "none" | "warning" | "breach" | "critical";

export type WipSeverity = "none" | "soft" | "hard" | "critical";

export type StageWip = {
  stageId: WorkflowStageId;
  count: number;
  wipLimit?: number;
  overload: number;
  ratio: number;
  severity: WipSeverity;
  severityScore: number;
};

export type SlaStatus = {
  itemId: string;
  stageId: WorkflowStageId;
  ageHours: number;
  slaHours?: number;
  severity: Severity;
  breachHours?: number;
  severityScore: number;
};

export type StuckReason =
  | "sla_breach"
  | "approval_wait"
  | "no_progress"
  | "policy_gap"
  | "no_outgoing_transition"
  | "stage_overload"
  | "unknown";

export type StuckStatus = {
  itemId: string;
  stageId: WorkflowStageId;
  ageHours: number;
  severity: Severity;
  severityScore: number;
  reason: StuckReason;
};

export type StageHealth = {
  stageId: WorkflowStageId;
  count: number;
  sla: {
    warning: number;
    breach: number;
    critical: number;
    avgSeverityScore: number;
  };
  stuck: {
    stuck: number;
    critical: number;
  };
  healthScore: number;
};

export type WorkflowSignals = {
  totalItems: number;
  byStageCount: Record<WorkflowStageId, number>;
  stageWip: Record<WorkflowStageId, StageWip>;
  wip: {
    softCount: number;
    hardCount: number;
    criticalCount: number;
    pressureScore: number;
    topStage?: WorkflowStageId;
  };
  propagatedPressure: Record<WorkflowStageId, number>;
  throughput: Record<WorkflowStageId, number>;
  sla: {
    warningCount: number;
    breachCount: number;
    criticalCount: number;
    topStage?: WorkflowStageId;
    pressureScore: number;
  };
  stuck: {
    stuckCount: number;
    criticalStuckCount: number;
    topStage?: WorkflowStageId;
    pressureScore: number;
  };
  stages: {
    worstStages: WorkflowStageId[];
    stageHealth: Record<WorkflowStageId, StageHealth>;
  };
  bottleneck: {
    likelihoodScore: number;
    topStage?: WorkflowStageId;
  };
  bottleneckIndex: {
    score: number;
    topStage?: WorkflowStageId;
    lowThroughputPenalty: number;
    reasons: Array<{
      code: "WIP_OVER" | "LOW_THROUGHPUT" | "HEALTH_GAP" | "SLA_PRESSURE" | "STUCK_PRESSURE";
      stageId?: WorkflowStageId;
      points: number;
    }>;
  };
  itemTime?: TimeInStage[];
  itemSla?: SlaStatus[];
  itemStuck?: StuckStatus[];
};

export type WorkflowIntelligenceInput = {
  policy: WorkflowPolicy;
  now: Date;
  items: WorkflowItem[];
  events?: WorkflowEventStream;
  includePerItem?: boolean;
};
