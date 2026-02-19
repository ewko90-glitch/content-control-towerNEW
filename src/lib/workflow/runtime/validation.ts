const MAX_REASON_LENGTH = 140;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_KEY_LENGTH = 40;
const MAX_METADATA_STRING_LENGTH = 120;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

export function sanitizeReason(reason?: string): string | undefined {
  if (typeof reason !== "string") {
    return undefined;
  }

  const normalized = reason.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.slice(0, MAX_REASON_LENGTH);
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  if (!metadata) {
    return undefined;
  }

  const output: Record<string, string | number | boolean> = {};
  const keys = Object.keys(metadata).sort((left, right) => left.localeCompare(right));

  for (const key of keys) {
    if (Object.keys(output).length >= MAX_METADATA_KEYS) {
      break;
    }

    if (key.length === 0 || key.length > MAX_METADATA_KEY_LENGTH) {
      continue;
    }

    const value = metadata[key];
    if (typeof value === "string") {
      if (value.length > MAX_METADATA_STRING_LENGTH) {
        continue;
      }
      output[key] = value;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function validateTransitionRequest(input: unknown): { ok: true } | { ok: false; message: string } {
  if (!isRecord(input)) {
    return { ok: false, message: "Request must be an object." };
  }

  const ref = input.ref;
  if (!isRecord(ref)) {
    return { ok: false, message: "Request ref is required." };
  }

  if (typeof ref.workspaceId !== "string" || ref.workspaceId.trim().length === 0) {
    return { ok: false, message: "ref.workspaceId is required." };
  }

  if (typeof ref.entityId !== "string" || ref.entityId.trim().length === 0) {
    return { ok: false, message: "ref.entityId is required." };
  }

  if (ref.entityType !== "content") {
    return { ok: false, message: "ref.entityType must be content." };
  }

  const actor = input.actor;
  if (!isRecord(actor)) {
    return { ok: false, message: "Request actor is required." };
  }

  if (typeof actor.userId !== "string" || actor.userId.trim().length === 0) {
    return { ok: false, message: "actor.userId is required." };
  }

  const role = actor.role;
  if (role !== "owner" && role !== "manager" && role !== "editor" && role !== "viewer") {
    return { ok: false, message: "actor.role is invalid." };
  }

  const policy = input.policy;
  if (!isRecord(policy)) {
    return { ok: false, message: "policy is required." };
  }

  if (!Array.isArray(policy.stages) || !Array.isArray(policy.transitions) || !Array.isArray(policy.guards)) {
    return { ok: false, message: "policy must include stages, transitions and guards arrays." };
  }

  if (typeof input.targetStageId !== "string" || input.targetStageId.trim().length === 0) {
    return { ok: false, message: "targetStageId is required." };
  }

  return { ok: true };
}
