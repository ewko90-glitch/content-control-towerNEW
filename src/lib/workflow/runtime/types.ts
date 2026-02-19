import type { WorkflowPolicy, WorkflowRole, WorkflowStageId, WorkflowVersion } from "../types";

export type WorkflowActor = {
  userId: string;
  role: WorkflowRole;
};

export type WorkflowEntityRef = {
  workspaceId: string;
  entityType: "content";
  entityId: string;
};

export type WorkflowEntityState = {
  stageId: WorkflowStageId;
  updatedAt: string;
  revision?: string;
};

export type WorkflowTransitionRequest = {
  ref: WorkflowEntityRef;
  actor: WorkflowActor;
  policy: WorkflowPolicy;
  targetStageId: WorkflowStageId;
  reason?: string;
  metadata?: Record<string, string | number | boolean>;
  expected?: {
    updatedAt?: string;
    revision?: string;
  };
  idempotencyKey?: string;
};

export type WorkflowTransitionErrorCode =
  | "POLICY_INVALID"
  | "INVALID_STAGE"
  | "INVALID_TRANSITION"
  | "ROLE_NOT_ALLOWED"
  | "CONFLICT"
  | "IDEMPOTENT_REPLAY"
  | "PERSISTENCE_FAILED"
  | "AUDIT_FAILED"
  | "VALIDATION_FAILED";

export type WorkflowTransitionResult =
  | {
      ok: true;
      policyVersion: WorkflowVersion;
      fromStageId: WorkflowStageId;
      toStageId: WorkflowStageId;
      eventId: string;
      occurredAt: string;
      idempotencyKey: string;
    }
  | {
      ok: false;
      code: WorkflowTransitionErrorCode;
      message: string;
      details?: Record<string, string | number | boolean>;
    };
