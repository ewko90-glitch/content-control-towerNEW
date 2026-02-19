import type { WorkflowStageId, WorkflowVersion } from "../types";
import type { WorkflowActor, WorkflowEntityRef } from "./types";

export type WorkflowTransitionEvent = {
  id: string;
  occurredAt: string;
  ref: WorkflowEntityRef;
  actor: WorkflowActor;
  policyVersion: WorkflowVersion;
  fromStageId: WorkflowStageId;
  toStageId: WorkflowStageId;
  reason?: string;
  metadata?: Record<string, string | number | boolean>;
  idempotencyKey: string;
  prevEventId?: string;
};

function fnv1aBase36(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function buildEventId(params: {
  workspaceId: string;
  entityId: string;
  occurredAt: string;
  fromStageId: string;
  toStageId: string;
  idempotencyKey: string;
}): string {
  const source = [
    params.workspaceId,
    params.entityId,
    params.occurredAt,
    params.fromStageId,
    params.toStageId,
    params.idempotencyKey,
  ].join("|");

  return `wf_evt_${fnv1aBase36(source)}`;
}
