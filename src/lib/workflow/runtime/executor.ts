import { WorkflowErrorCode } from "../errors";
import { canTransition } from "../engine";
import type { WorkflowStageId } from "../types";
import { validateWorkflowPolicy } from "../validation";
import { appendTransitionEvent } from "./auditStore";
import { checkExpectedState } from "./concurrency";
import { buildEventId } from "./events";
import { deriveIdempotencyKey, getIdempotencyValue, sanitizeProvidedIdempotencyKey, setIdempotencyValue } from "./idempotency";
import type { WorkflowEntityRef, WorkflowEntityState, WorkflowTransitionRequest, WorkflowTransitionResult } from "./types";
import { sanitizeMetadata, sanitizeReason, validateTransitionRequest } from "./validation";

export type WorkflowPersistenceAdapter = {
  getState(ref: WorkflowEntityRef): Promise<WorkflowEntityState | null>;
  setStage(params: {
    ref: WorkflowEntityRef;
    nextStageId: string;
    occurredAt: string;
    expected?: { updatedAt?: string; revision?: string };
  }): Promise<{ updatedAt: string; revision?: string }>;
};

function resolveFailureCode(reason?: string): "INVALID_TRANSITION" | "ROLE_NOT_ALLOWED" {
  if (reason === WorkflowErrorCode.INVALID_TRANSITION) {
    return "INVALID_TRANSITION";
  }
  return "ROLE_NOT_ALLOWED";
}

function makeReplayResult(message: string, details?: Record<string, string | number | boolean>): WorkflowTransitionResult {
  return {
    ok: false,
    code: "IDEMPOTENT_REPLAY",
    message,
    details,
  };
}

export async function executeTransition(params: {
  req: WorkflowTransitionRequest;
  adapter: WorkflowPersistenceAdapter;
  now: Date;
}): Promise<WorkflowTransitionResult> {
  const validation = validateTransitionRequest(params.req as unknown);
  if (!validation.ok) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: validation.message,
    };
  }

  const policyValidation = validateWorkflowPolicy(params.req.policy);
  if (!policyValidation.valid) {
    return {
      ok: false,
      code: "POLICY_INVALID",
      message: "Workflow policy is invalid.",
      details: {
        errorCount: policyValidation.errors.length,
      },
    };
  }

  let current: WorkflowEntityState | null = null;
  try {
    current = await params.adapter.getState(params.req.ref);
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_FAILED",
      message: "Failed to load current workflow state.",
    };
  }

  if (!current) {
    return {
      ok: false,
      code: "INVALID_STAGE",
      message: "Current entity stage is not available.",
    };
  }

  const concurrency = checkExpectedState({
    current,
    expected: params.req.expected,
  });

  if (!concurrency.ok) {
    return {
      ok: false,
      code: "CONFLICT",
      message: concurrency.message,
      details: {
        expectedUpdatedAt: params.req.expected?.updatedAt ?? "",
        currentUpdatedAt: current.updatedAt,
      },
    };
  }

  if (params.req.targetStageId === current.stageId) {
    return makeReplayResult("Already in target stage.", {
      stageId: current.stageId,
    });
  }

  const transitionCheck = canTransition({
    policy: params.req.policy,
    currentStage: current.stageId,
    targetStage: params.req.targetStageId,
    role: params.req.actor.role,
  });

  if (!transitionCheck.allowed) {
    return {
      ok: false,
      code: resolveFailureCode(transitionCheck.reason),
      message: transitionCheck.reason ?? "Transition denied.",
    };
  }

  const occurredAt = params.now.toISOString();
  const minuteBucket = Math.floor(params.now.getTime() / 60000);
  const idempotencyKey =
    sanitizeProvidedIdempotencyKey(params.req.idempotencyKey) ??
    deriveIdempotencyKey({
      workspaceId: params.req.ref.workspaceId,
      entityId: params.req.ref.entityId,
      actorUserId: params.req.actor.userId,
      fromStageId: current.stageId,
      toStageId: params.req.targetStageId,
      minuteBucket,
    });

  const existingIdempotency = await getIdempotencyValue({
    workspaceId: params.req.ref.workspaceId,
    idempotencyKey,
  });
  if (existingIdempotency) {
    return makeReplayResult("Transition already processed.", {
      eventId: existingIdempotency,
    });
  }

  const fromStageId: WorkflowStageId = current.stageId;
  try {
    await params.adapter.setStage({
      ref: params.req.ref,
      nextStageId: params.req.targetStageId,
      occurredAt,
      expected: params.req.expected,
    });
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_FAILED",
      message: "Failed to persist transition.",
    };
  }

  const eventId = buildEventId({
    workspaceId: params.req.ref.workspaceId,
    entityId: params.req.ref.entityId,
    occurredAt,
    fromStageId,
    toStageId: params.req.targetStageId,
    idempotencyKey,
  });

  const appendResult = await appendTransitionEvent({
    workspaceId: params.req.ref.workspaceId,
    entityId: params.req.ref.entityId,
    event: {
      id: eventId,
      occurredAt,
      ref: params.req.ref,
      actor: params.req.actor,
      policyVersion: params.req.policy.version,
      fromStageId,
      toStageId: params.req.targetStageId,
      reason: sanitizeReason(params.req.reason),
      metadata: sanitizeMetadata(params.req.metadata),
      idempotencyKey,
    },
  });

  const idempotencyValue = appendResult.ok ? eventId : "done";
  await setIdempotencyValue({
    workspaceId: params.req.ref.workspaceId,
    idempotencyKey,
    value: idempotencyValue,
  });

  return {
    ok: true,
    policyVersion: params.req.policy.version,
    fromStageId,
    toStageId: params.req.targetStageId,
    eventId,
    occurredAt,
    idempotencyKey,
  };
}
