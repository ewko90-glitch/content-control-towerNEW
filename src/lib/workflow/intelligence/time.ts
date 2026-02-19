import type { TimeInStage, WorkflowItem } from "./types";

function toValidDate(input?: string): Date | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function ageHours(now: Date, enteredAt: Date): number {
  return Math.max(0, (now.getTime() - enteredAt.getTime()) / 3600000);
}

export function computeTimeInStage(params: {
  item: WorkflowItem;
  now: Date;
  eventsForItem?: { occurredAt: string; toStageId: string }[];
}): TimeInStage {
  const stageEntered = toValidDate(params.item.stageEnteredAt);
  if (stageEntered) {
    return {
      itemId: params.item.id,
      stageId: params.item.stageId,
      enteredAt: stageEntered.toISOString(),
      ageHours: ageHours(params.now, stageEntered),
      source: "stageEnteredAt",
    };
  }

  const events = (params.eventsForItem ?? [])
    .map((event) => ({
      occurredAt: toValidDate(event.occurredAt),
      toStageId: event.toStageId,
    }))
    .filter((event): event is { occurredAt: Date; toStageId: string } => Boolean(event.occurredAt))
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  const lastStageEvent = [...events].reverse().find((event) => event.toStageId === params.item.stageId);
  if (lastStageEvent) {
    return {
      itemId: params.item.id,
      stageId: params.item.stageId,
      enteredAt: lastStageEvent.occurredAt.toISOString(),
      ageHours: ageHours(params.now, lastStageEvent.occurredAt),
      source: "eventStream",
    };
  }

  const fallback = toValidDate(params.item.updatedAt) ?? params.now;
  return {
    itemId: params.item.id,
    stageId: params.item.stageId,
    enteredAt: fallback.toISOString(),
    ageHours: ageHours(params.now, fallback),
    source: "updatedAtFallback",
  };
}
