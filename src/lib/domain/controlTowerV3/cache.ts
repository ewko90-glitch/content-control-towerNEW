type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const CACHE = new Map<string, CacheEntry<unknown>>();
const BUCKET_MS = 30000;
export const DECISION_CACHE_TTL_MS = BUCKET_MS;
const DECISION_CACHE_SCHEMA_VERSION = "ctv3.schema.1";
const DECISION_CACHE_DECISION_VERSION = "ctv3.v1.5.hardening";
const DECISION_CACHE_VERSION = `ctv3:decision:${DECISION_CACHE_SCHEMA_VERSION}:${DECISION_CACHE_DECISION_VERSION}`;

type DecisionSnapshotParams = {
  workspaceId: string;
  now?: Date;
  viewer?: {
    userId?: string;
    role?: string;
  };
};

type DecisionSnapshot = import("./types").ControlTowerDecisionSnapshot;

export function makeBucketKey(workspaceId: string, now: Date): string {
  const bucket = Math.floor(now.getTime() / BUCKET_MS);
  return `${workspaceId}:${bucket}`;
}

export function getCached<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });
}

export function makeDecisionCacheKey(params: { workspaceId: string; viewer?: { role?: string } }): string {
  const role = params.viewer?.role ?? "_";
  return `${DECISION_CACHE_VERSION}:${params.workspaceId}:${role}`;
}

function withCacheHint(snapshot: DecisionSnapshot, hint: "fresh" | "cached"): DecisionSnapshot {
  return {
    ...snapshot,
    diagnostics: {
      ...(snapshot.diagnostics ?? {}),
      cacheHint: hint,
    },
  };
}

export async function getCachedControlTowerDecisionSnapshot(params: DecisionSnapshotParams): Promise<DecisionSnapshot> {
  const key = makeDecisionCacheKey({
    workspaceId: params.workspaceId,
    viewer: params.viewer,
  });

  const cached = getCached<DecisionSnapshot>(key);
  if (cached) {
    return withCacheHint(cached, "cached");
  }

  const module = await import("./index");
  const decision = await module.getControlTowerDecisionSnapshot(params);
  return withCacheHint(decision, "fresh");
}
