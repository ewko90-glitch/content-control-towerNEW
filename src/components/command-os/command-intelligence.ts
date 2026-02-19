import type { CommandContext, CommandDefinition } from "./command-types";

export function deriveCommandContext(input: {
  pathname: string;
  workspaceSlug?: string;
  workflowSignals?: unknown;
  predictiveRisk?: unknown;
  flowMetrics?: unknown;
}): CommandContext {
  const predictive =
    typeof input.predictiveRisk === "object" && input.predictiveRisk !== null && !Array.isArray(input.predictiveRisk)
      ? (input.predictiveRisk as Record<string, unknown>)
      : {};

  const workflow =
    typeof input.workflowSignals === "object" && input.workflowSignals !== null && !Array.isArray(input.workflowSignals)
      ? (input.workflowSignals as Record<string, unknown>)
      : {};

  const pressure = typeof predictive.pressureScore === "number" ? predictive.pressureScore : 0;

  const bottleneckIndexRecord =
    typeof workflow.bottleneckIndex === "object" && workflow.bottleneckIndex !== null && !Array.isArray(workflow.bottleneckIndex)
      ? (workflow.bottleneckIndex as Record<string, unknown>)
      : {};

  const bottleneckRecord =
    typeof workflow.bottleneck === "object" && workflow.bottleneck !== null && !Array.isArray(workflow.bottleneck)
      ? (workflow.bottleneck as Record<string, unknown>)
      : {};

  const bottleneckStage =
    (typeof bottleneckIndexRecord.topStage === "string" ? bottleneckIndexRecord.topStage : undefined) ??
    (typeof bottleneckRecord.topStage === "string" ? bottleneckRecord.topStage : undefined);

  const hasSignals =
    (Array.isArray(workflow.itemSla) && workflow.itemSla.length > 0) ||
    (Array.isArray(workflow.itemStuck) && workflow.itemStuck.length > 0) ||
    typeof bottleneckStage === "string";

  return {
    pathname: input.pathname,
    workspaceSlug: input.workspaceSlug,
    isContentPage: input.pathname.includes("/content"),
    highRisk: pressure >= 75,
    bottleneckStage,
    hasSignals,
    hasDecisionLab: Boolean(input.workspaceSlug),
    hasDecisionEntries: false,
    hasCurrentStrategy: false,
    latestDecisionId: undefined,
  };
}

export function contextBoostForCommand(command: CommandDefinition, context: CommandContext): number {
  let boost = 0;

  if (context.highRisk) {
    if (
      command.id === "open-decision-lab" ||
      command.id === "jump-risks" ||
      command.id === "simulate-capacity-bottleneck"
    ) {
      boost += 32;
    }
  }

  if (context.isContentPage) {
    if (command.id === "new-content" || command.id === "open-decision-lab" || command.id === "jump-workflow") {
      boost += 20;
    }
  }

  if (!context.hasSignals) {
    if (command.id === "new-publication-job" || command.id === "plan-calendar") {
      boost += 16;
    }
  }

  if (command.contextBoost) {
    boost += command.contextBoost(context);
  }

  return boost;
}
