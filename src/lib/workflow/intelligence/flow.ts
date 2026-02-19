import type { WorkflowStageId } from "../types";
import type { WorkflowEventStream } from "./types";

export function estimateStageThroughput(params: {
  events?: WorkflowEventStream;
  lookbackHours?: number;
  now: Date;
}): Record<WorkflowStageId, number> {
  const lookbackHours = params.lookbackHours ?? 72;
  if (!params.events || lookbackHours <= 0) {
    return {} as Record<WorkflowStageId, number>;
  }

  const boundaryMs = params.now.getTime() - lookbackHours * 3600000;
  const counters = new Map<string, number>();

  for (const events of Object.values(params.events.byItemId)) {
    for (const event of events) {
      const occurredMs = new Date(event.occurredAt).getTime();
      if (Number.isNaN(occurredMs) || occurredMs < boundaryMs || occurredMs > params.now.getTime()) {
        continue;
      }

      counters.set(event.toStageId, (counters.get(event.toStageId) ?? 0) + 1);
    }
  }

  const output: Record<string, number> = {};
  for (const [stageId, count] of counters.entries()) {
    output[stageId] = count / lookbackHours;
  }

  return output as Record<WorkflowStageId, number>;
}
