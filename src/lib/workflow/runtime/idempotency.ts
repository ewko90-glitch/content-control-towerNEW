type IdempotencyEntry = {
  value: string;
  expiresAt: number;
};

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const IDEMPOTENCY_CACHE = new Map<string, IdempotencyEntry>();

function fnv1aBase36(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function makeCacheKey(workspaceId: string, idempotencyKey: string): string {
  return `wf:idem:${workspaceId}:${idempotencyKey}`;
}

export function sanitizeProvidedIdempotencyKey(input?: string): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length === 0 || normalized.length > 80) {
    return undefined;
  }

  return normalized;
}

export function deriveIdempotencyKey(params: {
  workspaceId: string;
  entityId: string;
  actorUserId: string;
  fromStageId: string;
  toStageId: string;
  minuteBucket: number;
}): string {
  const source = [
    "wf",
    params.workspaceId,
    params.entityId,
    params.actorUserId,
    params.fromStageId,
    params.toStageId,
    String(params.minuteBucket),
  ].join("|");

  return `wf_idem_${fnv1aBase36(source)}`;
}

export async function getIdempotencyValue(params: {
  workspaceId: string;
  idempotencyKey: string;
}): Promise<string | null> {
  const key = makeCacheKey(params.workspaceId, params.idempotencyKey);
  const current = IDEMPOTENCY_CACHE.get(key);
  if (!current) {
    return null;
  }

  if (Date.now() > current.expiresAt) {
    IDEMPOTENCY_CACHE.delete(key);
    return null;
  }

  return current.value;
}

export async function setIdempotencyValue(params: {
  workspaceId: string;
  idempotencyKey: string;
  value: string;
}): Promise<void> {
  const key = makeCacheKey(params.workspaceId, params.idempotencyKey);
  IDEMPOTENCY_CACHE.set(key, {
    value: params.value,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}
