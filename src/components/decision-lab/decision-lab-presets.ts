import type { WorkflowPolicy, WorkflowStageId } from "@/lib/workflow";
import type { DecisionLabContextStages, DecisionLabPreset } from "./decision-lab-state";

function findStage(policy: WorkflowPolicy | undefined, candidate?: WorkflowStageId, fallback?: WorkflowStageId): WorkflowStageId {
  const ids = (policy?.stages ?? []).map((stage) => stage.id);
  if (candidate && ids.includes(candidate)) {
    return candidate;
  }
  if (fallback && ids.includes(fallback)) {
    return fallback;
  }
  if (ids.includes("review")) {
    return "review";
  }
  return ids[0] ?? "draft";
}

export function buildDecisionLabPresets(params: {
  policy?: WorkflowPolicy;
  context: DecisionLabContextStages;
  byStageCount: Partial<Record<WorkflowStageId, number>>;
}): DecisionLabPreset[] {
  const bottleneck = findStage(params.policy, params.context.bottleneckStageId, params.context.topStageId);
  const topStage = findStage(params.policy, params.context.topStageId, bottleneck);
  const queueStage = findStage(params.policy, params.context.queueStageId, "draft");

  const currentLimit =
    params.policy?.stages.find((stage) => stage.id === bottleneck)?.wipLimit ?? 3;

  const tightenLimit = Math.max(1, currentLimit - 1);
  const relaxLimit = Math.max(1, currentLimit + 1);

  return [
    {
      id: "preset_cap_bottleneck_20",
      name: `+20% capacity on ${bottleneck}`,
      description: "Boost throughput at the main constraint.",
      scenario: {
        id: "preset_cap_bottleneck_20",
        name: `+20% capacity on ${bottleneck}`,
        knobs: [{ kind: "capacity", stageId: bottleneck, multiplier: 1.2 }],
      },
    },
    {
      id: "preset_cap_bottleneck_10",
      name: `+10% capacity on ${bottleneck}`,
      description: "Smaller safe capacity increase.",
      scenario: {
        id: "preset_cap_bottleneck_10",
        name: `+10% capacity on ${bottleneck}`,
        knobs: [{ kind: "capacity", stageId: bottleneck, multiplier: 1.1 }],
      },
    },
    {
      id: "preset_tighten_wip",
      name: `Tighten WIP on ${bottleneck}`,
      description: "Reduce in-flight load at bottleneck.",
      scenario: {
        id: "preset_tighten_wip",
        name: `Tighten WIP on ${bottleneck}`,
        knobs: [{ kind: "wipLimit", stageId: bottleneck, limit: tightenLimit }],
      },
    },
    {
      id: "preset_relax_wip",
      name: `Relax WIP on ${bottleneck}`,
      description: "Increase allowed work-in-progress slightly.",
      scenario: {
        id: "preset_relax_wip",
        name: `Relax WIP on ${bottleneck}`,
        knobs: [{ kind: "wipLimit", stageId: bottleneck, limit: relaxLimit }],
      },
    },
    {
      id: "preset_outage_3d",
      name: `Outage 3 days on ${bottleneck}`,
      description: "Stress-test resilience under reduced capacity.",
      scenario: {
        id: "preset_outage_3d",
        name: `Outage 3 days on ${bottleneck}`,
        knobs: [{ kind: "outage", stageId: bottleneck, days: 3, multiplier: 0.4 }],
      },
    },
    {
      id: "preset_add_5_queue",
      name: `Add 5 items to ${queueStage}`,
      description: "Queue shock at intake stage.",
      scenario: {
        id: "preset_add_5_queue",
        name: `Add 5 items to ${queueStage}`,
        knobs: [{ kind: "influx", stageId: queueStage, addCount: 5 }],
      },
    },
    {
      id: "preset_add_10_top",
      name: `Add 10 items to ${topStage}`,
      description: "Load the currently busiest stage.",
      scenario: {
        id: "preset_add_10_top",
        name: `Add 10 items to ${topStage}`,
        knobs: [{ kind: "influx", stageId: topStage, addCount: 10 }],
      },
    },
    {
      id: "preset_cap_down_20",
      name: `Capacity down -20% on ${bottleneck}`,
      description: "Stress scenario for downside planning.",
      scenario: {
        id: "preset_cap_down_20",
        name: `Capacity down -20% on ${bottleneck}`,
        knobs: [{ kind: "capacity", stageId: bottleneck, multiplier: 0.8 }],
      },
    },
  ];
}
