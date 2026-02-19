import type { WorkflowTransitionEvent } from "../runtime/events";
import type { WorkflowStageId } from "../types";
import type { ItemTimeline, ItemTimelineSegment, StageZone, WorkflowZonePolicy } from "./types";

function toValidDate(input: string): Date | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toZone(stageId: WorkflowStageId, zones: WorkflowZonePolicy): StageZone {
  return zones.zoneByStageId[stageId] ?? "queue";
}

function hourDiff(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
}

function stableSortEvents(events: WorkflowTransitionEvent[]): WorkflowTransitionEvent[] {
  return [...events].sort((left, right) => {
    const leftMs = new Date(left.occurredAt).getTime();
    const rightMs = new Date(right.occurredAt).getTime();
    if (leftMs !== rightMs) {
      return leftMs - rightMs;
    }

    const byOccurredAt = left.occurredAt.localeCompare(right.occurredAt);
    if (byOccurredAt !== 0) {
      return byOccurredAt;
    }

    const byId = left.id.localeCompare(right.id);
    if (byId !== 0) {
      return byId;
    }

    return left.toStageId.localeCompare(right.toStageId);
  });
}

function buildSegments(params: {
  events: WorkflowTransitionEvent[];
  zones: WorkflowZonePolicy;
  now: Date;
}): ItemTimelineSegment[] {
  const events = stableSortEvents(params.events).filter((event) => Boolean(toValidDate(event.occurredAt)));
  const segments: ItemTimelineSegment[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    const currentDate = toValidDate(current.occurredAt);
    if (!currentDate) {
      continue;
    }

    const next = events[index + 1];
    const nextDate = next ? toValidDate(next.occurredAt) : null;
    const exitedAt = nextDate ?? params.now;

    segments.push({
      stageId: current.toStageId,
      enteredAt: currentDate.toISOString(),
      exitedAt: nextDate ? nextDate.toISOString() : undefined,
      dwellHours: hourDiff(currentDate, exitedAt),
      zone: toZone(current.toStageId, params.zones),
    });
  }

  return segments;
}

export function buildTimeline(params: {
  itemId: string;
  events: WorkflowTransitionEvent[];
  zones: WorkflowZonePolicy;
  now: Date;
}): ItemTimeline {
  const segments = buildSegments({
    events: params.events,
    zones: params.zones,
    now: params.now,
  });

  const firstSeenAt = segments[0]?.enteredAt;
  const firstActiveAt = segments.find((segment) => segment.zone === "active")?.enteredAt;
  const firstDoneAt = segments.find((segment) => segment.zone === "done")?.enteredAt;

  const firstSeenDate = firstSeenAt ? new Date(firstSeenAt) : null;
  const firstActiveDate = firstActiveAt ? new Date(firstActiveAt) : null;
  const firstDoneDate = firstDoneAt ? new Date(firstDoneAt) : null;

  const leadHours = firstSeenDate && firstDoneDate ? hourDiff(firstSeenDate, firstDoneDate) : undefined;
  const cycleHours = firstActiveDate && firstDoneDate ? hourDiff(firstActiveDate, firstDoneDate) : undefined;

  let activeHours: number | undefined;
  let queueHours: number | undefined;

  if (firstDoneDate) {
    activeHours = 0;
    queueHours = 0;

    for (const segment of segments) {
      const entered = new Date(segment.enteredAt);
      const exited = segment.exitedAt ? new Date(segment.exitedAt) : params.now;
      if (entered.getTime() >= firstDoneDate.getTime()) {
        continue;
      }

      const boundedExit = exited.getTime() > firstDoneDate.getTime() ? firstDoneDate : exited;
      const boundedHours = hourDiff(entered, boundedExit);

      if (segment.zone === "active") {
        activeHours += boundedHours;
      }
      if (segment.zone === "queue") {
        queueHours += boundedHours;
      }
    }
  }

  return {
    itemId: params.itemId,
    segments,
    firstSeenAt,
    firstActiveAt,
    firstDoneAt,
    leadHours,
    cycleHours,
    activeHours,
    queueHours,
  };
}

export function buildTimelines(params: {
  eventsByItemId: Record<string, WorkflowTransitionEvent[]>;
  zones: WorkflowZonePolicy;
  now: Date;
}): ItemTimeline[] {
  return Object.keys(params.eventsByItemId)
    .sort((left, right) => left.localeCompare(right))
    .map((itemId) =>
      buildTimeline({
        itemId,
        events: params.eventsByItemId[itemId] ?? [],
        zones: params.zones,
        now: params.now,
      }),
    );
}
