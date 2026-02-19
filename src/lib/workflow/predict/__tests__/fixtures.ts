import { DEFAULT_WORKFLOW_POLICY } from "../../policy";
import type { WorkflowTransitionEvent } from "../../runtime/events";
import { computeFlowMetrics } from "../../metrics/flowMetrics";
import type { PredictInput, PredictItemInput } from "../types";

export const FIXED_NOW = new Date("2026-02-15T12:00:00.000Z");

function makeEvent(itemId: string, index: number, at: string, from: string, to: string): WorkflowTransitionEvent {
  return {
    id: `evt-${itemId}-${index}`,
    occurredAt: at,
    ref: {
      workspaceId: "ws-1",
      entityType: "content",
      entityId: itemId,
    },
    actor: {
      userId: "u-1",
      role: "owner",
    },
    policyVersion: DEFAULT_WORKFLOW_POLICY.version,
    fromStageId: from,
    toStageId: to,
    idempotencyKey: `idem-${itemId}-${index}`,
  };
}

function buildEvents(itemId: string, seeds: Array<{ at: string; from: string; to: string }>): WorkflowTransitionEvent[] {
  return seeds.map((seed, index) => makeEvent(itemId, index + 1, seed.at, seed.from, seed.to));
}

export const EVENTS_BY_ITEM_ID: Record<string, WorkflowTransitionEvent[]> = {
  item_a: buildEvents("item_a", [
    { at: "2026-02-13T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-13T08:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-13T16:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-14T00:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-14T08:00:00.000Z", from: "scheduled", to: "published" },
  ]),
  item_b: buildEvents("item_b", [
    { at: "2026-02-09T00:00:00.000Z", from: "draft", to: "draft" },
    { at: "2026-02-10T12:00:00.000Z", from: "draft", to: "review" },
    { at: "2026-02-11T12:00:00.000Z", from: "review", to: "approved" },
    { at: "2026-02-12T12:00:00.000Z", from: "approved", to: "scheduled" },
    { at: "2026-02-13T12:00:00.000Z", from: "scheduled", to: "published" },
  ]),
};

const FLOW_ZONES = {
  zoneByStageId: {
    draft: "queue",
    review: "active",
    approved: "active",
    scheduled: "active",
    published: "done",
  },
} as const;

export const FLOW_METRICS = computeFlowMetrics({
  policy: DEFAULT_WORKFLOW_POLICY,
  zones: FLOW_ZONES,
  now: FIXED_NOW,
  eventsByItemId: EVENTS_BY_ITEM_ID,
});

export function buildPredictItems(): PredictItemInput[] {
  return [
    {
      itemId: "risk-critical",
      stageId: "review",
      ageHours: 96,
      slaSeverityScore: 90,
      stuckSeverityScore: 95,
      stageWipSeverityScore: 80,
      isBottleneckStage: true,
      dueAt: "2026-02-15T20:00:00.000Z",
    },
    {
      itemId: "risk-medium",
      stageId: "approved",
      ageHours: 36,
      slaSeverityScore: 45,
      stuckSeverityScore: 30,
      stageWipSeverityScore: 40,
      isBottleneckStage: false,
      dueAt: "2026-02-17T12:00:00.000Z",
    },
    {
      itemId: "risk-low",
      stageId: "draft",
      ageHours: 6,
      slaSeverityScore: 0,
      stuckSeverityScore: 0,
      stageWipSeverityScore: 10,
      isBottleneckStage: false,
      dueAt: "2026-02-25T12:00:00.000Z",
    },
  ];
}

export function buildPredictInput(overrides?: Partial<PredictInput>): PredictInput {
  const base: PredictInput = {
    policy: DEFAULT_WORKFLOW_POLICY,
    now: FIXED_NOW,
    flowMetrics: FLOW_METRICS,
    items: buildPredictItems(),
    includePerItem: true,
  };

  return {
    ...base,
    ...overrides,
  };
}
