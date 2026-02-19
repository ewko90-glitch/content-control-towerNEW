import type {
  FlowMetricsSnapshot,
  PredictOutput,
  Scenario,
  SimInput,
  WorkflowPolicy,
  WorkflowSignals,
  WorkflowStageId,
} from "@/lib/workflow";

export type DecisionLabMapperStatus = "ready" | "insufficient";

export type DecisionLabContentItem = {
  stageId: WorkflowStageId;
};

export type DecisionLabMapperInput = {
  policy?: WorkflowPolicy;
  signals?: WorkflowSignals;
  items: DecisionLabContentItem[];
  now?: Date;
  flowMetrics?: FlowMetricsSnapshot;
  predictiveRisk?: PredictOutput;
  scenario?: Scenario;
};

export type DecisionLabMapperOutput = {
  status: DecisionLabMapperStatus;
  simInput?: SimInput;
  reasons: string[];
  byStageCount: Partial<Record<WorkflowStageId, number>>;
};

export function countItemsByStage(items: DecisionLabContentItem[]): Partial<Record<WorkflowStageId, number>> {
  const output: Partial<Record<WorkflowStageId, number>> = {};
  for (const item of items) {
    output[item.stageId] = (output[item.stageId] ?? 0) + 1;
  }
  return output;
}

export function buildSimInputFromContentState(input: DecisionLabMapperInput): DecisionLabMapperOutput {
  const reasons: string[] = [];

  if (!input.policy || input.policy.stages.length === 0) {
    reasons.push("Missing workflow policy stages");
  }
  if (!input.policy || input.policy.transitions.length === 0) {
    reasons.push("Missing workflow transitions");
  }
  if (!input.signals) {
    reasons.push("Missing workflow signals");
  }
  if (input.items.length === 0) {
    reasons.push("No workflow items in memory");
  }

  const byStageCount = countItemsByStage(input.items);

  if (!input.policy || !input.signals || reasons.length > 0) {
    return {
      status: "insufficient",
      reasons: reasons.slice(0, 3),
      byStageCount,
    };
  }

  const scenario: Scenario =
    input.scenario ?? {
      id: "decision_lab_baseline",
      name: "Baseline",
      knobs: [],
    };

  return {
    status: "ready",
    byStageCount,
    reasons: [],
    simInput: {
      policy: input.policy,
      now: input.now ?? new Date(),
      workflowSignals: input.signals,
      byStageCount,
      flowMetrics: input.flowMetrics,
      predictiveRisk: input.predictiveRisk,
      scenario,
    },
  };
}
