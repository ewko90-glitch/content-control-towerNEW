import { DEFAULT_WORKFLOW_POLICY } from "../../policy";
import type { WorkflowTransitionEvent } from "../../runtime/events";
import type { WorkflowZonePolicy } from "../types";

export const FIXED_NOW = new Date("2026-02-15T12:00:00.000Z");

export const DEFAULT_ZONES: WorkflowZonePolicy = {
  zoneByStageId: {
    draft: "queue",
    review: "active",
    approved: "active",
    scheduled: "active",
    published: "done",
  },
};

export const METRICS_POLICY = DEFAULT_WORKFLOW_POLICY;

type EventSeed = {
  at: string;
  from: string;
  to: string;
};

function makeEvent(itemId: string, index: number, seed: EventSeed): WorkflowTransitionEvent {
  return {
    id: `evt-${itemId}-${index}`,
    occurredAt: seed.at,
    ref: {
      workspaceId: "ws-1",
      entityType: "content",
      entityId: itemId,
    },
    actor: {
      userId: "u-1",
      role: "owner",
    },
    policyVersion: METRICS_POLICY.version,
    fromStageId: seed.from,
    toStageId: seed.to,
    idempotencyKey: `idem-${itemId}-${index}`,
  };
}

function buildEvents(itemId: string, seeds: EventSeed[]): WorkflowTransitionEvent[] {
  return seeds.map((seed, index) => makeEvent(itemId, index + 1, seed));
}

export const BASE_EVENTS_BY_ITEM_ID: Record<string, WorkflowTransitionEvent[]> = {
  item_fast: buildEvents("item_fast", [
    { at: "2026-02-14T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-14T04:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-14T06:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-14T08:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-14T10:00:00.000Z", from: "scheduled", to: "published" },
  ]),
  item_slow: buildEvents("item_slow", [
    { at: "2026-02-11T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-12T00:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-13T12:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-14T12:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-15T06:00:00.000Z", from: "scheduled", to: "published" },
  ]),
  item_outlier: buildEvents("item_outlier", [
    { at: "2026-02-03T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-08T00:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-10T12:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-11T12:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-12T12:00:00.000Z", from: "scheduled", to: "published" },
  ]),
  item_prior: buildEvents("item_prior", [
    { at: "2026-02-04T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-04T12:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-05T12:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-05T18:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-06T00:00:00.000Z", from: "scheduled", to: "published" },
  ]),
};

export const WITH_EXTRA_LAST7D: Record<string, WorkflowTransitionEvent[]> = {
  ...BASE_EVENTS_BY_ITEM_ID,
  item_burst: buildEvents("item_burst", [
    { at: "2026-02-15T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-15T01:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-15T02:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-15T03:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-15T04:00:00.000Z", from: "scheduled", to: "published" },
  ]),
};

export const WITHOUT_OUTLIER: Record<string, WorkflowTransitionEvent[]> = {
  item_fast: BASE_EVENTS_BY_ITEM_ID.item_fast,
  item_slow: BASE_EVENTS_BY_ITEM_ID.item_slow,
  item_prior: BASE_EVENTS_BY_ITEM_ID.item_prior,
};

export function withPermutedOrder(eventsByItemId: Record<string, WorkflowTransitionEvent[]>): Record<string, WorkflowTransitionEvent[]> {
  const output: Record<string, WorkflowTransitionEvent[]> = {};

  for (const itemId of Object.keys(eventsByItemId).sort((left, right) => left.localeCompare(right))) {
    output[itemId] = [...(eventsByItemId[itemId] ?? [])].reverse();
  }

  return output;
}

export function withIncreasedDwell(eventsByItemId: Record<string, WorkflowTransitionEvent[]>): Record<string, WorkflowTransitionEvent[]> {
  const output: Record<string, WorkflowTransitionEvent[]> = {};

  for (const itemId of Object.keys(eventsByItemId).sort((left, right) => left.localeCompare(right))) {
    const events = [...(eventsByItemId[itemId] ?? [])].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    output[itemId] = events.map((event, index) => {
      const shifted = new Date(event.occurredAt);
      if (index > 0) {
        shifted.setHours(shifted.getHours() + index * 4);
      }

      return {
        ...event,
        occurredAt: shifted.toISOString(),
      };
    });
  }

  return output;
}
