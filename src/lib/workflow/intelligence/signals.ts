import { getOutgoingTransitions, isTerminalStage } from "../graph";
import { computeBottleneckIndex } from "./bottleneckIndex";
import { computeBottleneckLikelihood } from "./bottleneck";
import { estimateStageThroughput } from "./flow";
import { computeStageHealth, getWorstStages } from "./health";
import { propagateOverloadUpstream } from "./overloadPropagation";
import { evaluateSla, rollupSlaPressure } from "./sla";
import { detectStuck, rollupStuck } from "./stuck";
import { computeTimeInStage } from "./time";
import { computeStageWip, rollupWip } from "./wip";
import type { StuckStatus, WorkflowIntelligenceInput, WorkflowSignals } from "./types";

export function computeWorkflowSignals(input: WorkflowIntelligenceInput): WorkflowSignals {
  const orderedItems = [...input.items].sort((left, right) => left.id.localeCompare(right.id));
  const byStageCount = Object.fromEntries(input.policy.stages.map((stage) => [stage.id, 0])) as Record<string, number>;
  for (const item of orderedItems) {
    byStageCount[item.stageId] = (byStageCount[item.stageId] ?? 0) + 1;
  }

  const itemTime = orderedItems.map((item) => {
    const eventsForItem = input.events?.byItemId?.[item.id]?.map((event) => ({
      occurredAt: event.occurredAt,
      toStageId: event.toStageId,
    }));

    return computeTimeInStage({
      item,
      now: input.now,
      eventsForItem,
    });
  });

  const itemSla = orderedItems.map((item, index) =>
    evaluateSla({
      policy: input.policy,
      item,
      ageHours: itemTime[index]?.ageHours ?? 0,
    }),
  );

  const itemStuck: StuckStatus[] = [];
  for (let index = 0; index < orderedItems.length; index += 1) {
    const item = orderedItems[index];
    const stage = input.policy.stages.find((entry) => entry.id === item.stageId);
    const stuck = detectStuck({
      policy: input.policy,
      item,
      ageHours: itemTime[index]?.ageHours ?? 0,
      sla: itemSla[index],
      stageCount: byStageCount[item.stageId] ?? 0,
      wipLimit: stage?.wipLimit,
      hasOutgoingTransitions: getOutgoingTransitions(input.policy, item.stageId).length > 0,
      isTerminal: isTerminalStage(input.policy, item.stageId),
    });

    if (stuck) {
      itemStuck.push(stuck);
    }
  }

  const stageHealth = computeStageHealth({
    policy: input.policy,
    items: orderedItems,
    sla: itemSla,
    stuck: itemStuck,
  });

  const sla = rollupSlaPressure(itemSla);
  const stuck = rollupStuck(itemStuck);
  const stageWip = computeStageWip({
    policy: input.policy,
    byStageCount,
  });
  const wip = rollupWip(stageWip);
  const propagatedPressure = propagateOverloadUpstream({
    policy: input.policy,
    stageWip,
  });
  const throughput = estimateStageThroughput({
    events: input.events,
    now: input.now,
  });
  const bottleneckIndex = computeBottleneckIndex({
    policy: input.policy,
    stageHealth,
    stageWip,
    slaPressure: sla.pressureScore,
    stuckPressure: stuck.pressureScore,
    propagatedPressure,
    throughput,
  });
  const bottleneck = computeBottleneckLikelihood({
    policy: input.policy,
    stageHealth,
  });

  const signals: WorkflowSignals = {
    totalItems: orderedItems.length,
    byStageCount: byStageCount as WorkflowSignals["byStageCount"],
    stageWip,
    wip,
    propagatedPressure: propagatedPressure as WorkflowSignals["propagatedPressure"],
    throughput: throughput as WorkflowSignals["throughput"],
    sla: {
      warningCount: sla.warningCount,
      breachCount: sla.breachCount,
      criticalCount: sla.criticalCount,
      topStage: sla.topStage,
      pressureScore: sla.pressureScore,
    },
    stuck: {
      stuckCount: stuck.stuckCount,
      criticalStuckCount: stuck.criticalStuckCount,
      topStage: stuck.topStage,
      pressureScore: stuck.pressureScore,
    },
    stages: {
      worstStages: getWorstStages(stageHealth, 3) as string[],
      stageHealth,
    },
    bottleneck: {
      likelihoodScore: Math.max(bottleneck.likelihoodScore, bottleneckIndex.score),
      topStage: bottleneckIndex.topStage ?? bottleneck.topStage,
    },
    bottleneckIndex,
  };

  if (input.includePerItem) {
    signals.itemTime = itemTime;
    signals.itemSla = itemSla;
    signals.itemStuck = itemStuck;
  }

  return signals;
}
