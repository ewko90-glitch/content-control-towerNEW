import type { Scenario } from "@/lib/workflow";
import type { WorkflowPolicy, WorkflowSignals, WorkflowStageId } from "@/lib/workflow";
import type { SimResult } from "@/lib/workflow";

export type DecisionLabPreset = {
  id: string;
  name: string;
  description: string;
  scenario: Scenario;
};

export type DecisionLabKnobOverrides = {
  capacityAdjustPct: -20 | 0 | 10 | 20;
  wipAdjust: -1 | 0 | 1;
  influxAdd: 0 | 5 | 10;
  outageDays: 0 | 2 | 3;
};

export type DecisionLabRun = {
  id: string;
  timestampMs: number;
  scenarioId?: string;
  scenarioName: string;
  result: SimResult;
  persistedRunId?: string;
  source?: "local" | "remote";
};

export type DecisionLabContextStages = {
  bottleneckStageId?: WorkflowStageId;
  topStageId?: WorkflowStageId;
  queueStageId?: WorkflowStageId;
};

export const DEFAULT_OVERRIDES: DecisionLabKnobOverrides = {
  capacityAdjustPct: 0,
  wipAdjust: 0,
  influxAdd: 0,
  outageDays: 0,
};

function firstKnobStageId(scenario: Scenario): WorkflowStageId | undefined {
  for (const knob of scenario.knobs) {
    if ("stageId" in knob && typeof knob.stageId === "string") {
      return knob.stageId;
    }
  }
  return undefined;
}

export function applyOverridesToScenario(
  presetScenario: Scenario,
  overrides: DecisionLabKnobOverrides,
): Scenario {
  const baseKnobs = [...presetScenario.knobs];
  const anchorStageId = firstKnobStageId(presetScenario);

  if (overrides.capacityAdjustPct !== 0) {
    const multiplier = 1 + overrides.capacityAdjustPct / 100;
    baseKnobs.push(
      anchorStageId
        ? { kind: "capacity", stageId: anchorStageId, multiplier }
        : { kind: "capacity", multiplier },
    );
  }

  if (overrides.wipAdjust !== 0 && anchorStageId) {
    const baseWipKnob = presetScenario.knobs.find(
      (knob): knob is Extract<Scenario["knobs"][number], { kind: "wipLimit" }> =>
        knob.kind === "wipLimit" && knob.stageId === anchorStageId,
    );
    const currentLimit = baseWipKnob?.limit ?? 3;
    const nextLimit = Math.max(1, currentLimit + overrides.wipAdjust);
    baseKnobs.push({ kind: "wipLimit", stageId: anchorStageId, limit: nextLimit });
  }

  if (overrides.influxAdd > 0 && anchorStageId) {
    baseKnobs.push({ kind: "influx", stageId: anchorStageId, addCount: overrides.influxAdd });
  }

  if (overrides.outageDays > 0 && anchorStageId) {
    baseKnobs.push({
      kind: "outage",
      stageId: anchorStageId,
      days: overrides.outageDays,
      multiplier: 0.4,
    });
  }

  const customized =
    overrides.capacityAdjustPct !== 0 ||
    overrides.wipAdjust !== 0 ||
    overrides.influxAdd !== 0 ||
    overrides.outageDays !== 0;

  return {
    ...presetScenario,
    id: customized ? `${presetScenario.id}_custom` : presetScenario.id,
    name: customized ? `${presetScenario.name} (customized)` : presetScenario.name,
    knobs: baseKnobs,
  };
}

export function deriveContextStages(params: {
  signals?: WorkflowSignals;
  byStageCount: Partial<Record<WorkflowStageId, number>>;
  policy?: WorkflowPolicy;
}): DecisionLabContextStages {
  const policyStages = params.policy?.stages ?? [];

  const bottleneckStageId = params.signals?.bottleneckIndex.topStage ?? params.signals?.bottleneck.topStage;

  const topStageId = [...policyStages]
    .sort((left, right) => {
      const leftCount = params.byStageCount[left.id] ?? 0;
      const rightCount = params.byStageCount[right.id] ?? 0;
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.id.localeCompare(right.id);
    })[0]?.id;

  const queueStageId = [...policyStages]
    .filter((stage) => !stage.terminal)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.id.localeCompare(right.id);
    })[0]?.id;

  return {
    bottleneckStageId,
    topStageId,
    queueStageId,
  };
}
