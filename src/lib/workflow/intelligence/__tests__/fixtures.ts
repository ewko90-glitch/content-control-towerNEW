import { DEFAULT_WORKFLOW_POLICY } from "../../policy";
import type { WorkflowTransitionEvent } from "../../runtime/events";
import type { WorkflowPolicy } from "../../types";
import type { WorkflowEventStream, WorkflowItem } from "../types";

export const FIXED_NOW = new Date("2026-02-15T12:00:00.000Z");

export const POLICY_WITH_SLA: WorkflowPolicy = {
  ...DEFAULT_WORKFLOW_POLICY,
  stages: DEFAULT_WORKFLOW_POLICY.stages.map((stage) => {
    if (stage.id === "review") {
      return { ...stage, slaHours: 24, wipLimit: 3, requiresApproval: true };
    }
    if (stage.id === "approved") {
      return { ...stage, slaHours: 48, wipLimit: 4 };
    }
    return stage;
  }),
};

export function makeItem(input: Partial<WorkflowItem> & { id: string; stageId: WorkflowItem["stageId"] }): WorkflowItem {
  return {
    id: input.id,
    stageId: input.stageId,
    updatedAt: input.updatedAt ?? "2026-02-15T00:00:00.000Z",
    stageEnteredAt: input.stageEnteredAt,
    requiresApproval: input.requiresApproval,
  };
}

function makeEvent(params: {
  itemId: string;
  occurredAt: string;
  fromStageId: string;
  toStageId: string;
}): WorkflowTransitionEvent {
  return {
    id: `evt-${params.itemId}-${params.occurredAt}`,
    occurredAt: params.occurredAt,
    ref: {
      workspaceId: "ws-1",
      entityType: "content",
      entityId: params.itemId,
    },
    actor: {
      userId: "u-1",
      role: "owner",
    },
    policyVersion: POLICY_WITH_SLA.version,
    fromStageId: params.fromStageId,
    toStageId: params.toStageId,
    idempotencyKey: `idem-${params.itemId}-${params.occurredAt}`,
  };
}

export function makeEventStream(events: Array<{ itemId: string; occurredAt: string; fromStageId: string; toStageId: string }>): WorkflowEventStream {
  const byItemId: Record<string, WorkflowTransitionEvent[]> = {};

  for (const event of events) {
    const current = byItemId[event.itemId] ?? [];
    current.push(makeEvent(event));
    current.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    byItemId[event.itemId] = current;
  }

  return { byItemId };
}
