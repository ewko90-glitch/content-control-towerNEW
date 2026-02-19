import { getCached, setCached } from "../cache";

export type WorkspaceLock = {
  key: string;
  token: string;
  acquiredAt: number;
  ttlSeconds: number;
};

let lockCounter = 0;

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function buildLockToken(workspaceId: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return uuid;
  }

  lockCounter = (lockCounter + 1) % 1_000_000_000;
  const now = Date.now().toString(36);
  const counter = lockCounter.toString(36);
  const workspaceHash = fnv1a32(workspaceId).toString(36);
  return `${now}-${counter}-${workspaceHash}`;
}

function lockKey(scope: "decision", workspaceId: string): string {
  return `ctv3:lock:${scope}:${workspaceId}`;
}

export async function tryAcquireWorkspaceLock(params: {
  workspaceId: string;
  scope: "decision";
  ttlSeconds: number;
}): Promise<WorkspaceLock | null> {
  try {
    const key = lockKey(params.scope, params.workspaceId);
    const existing = getCached<WorkspaceLock>(key);
    if (existing) {
      return null;
    }

    const lock: WorkspaceLock = {
      key,
      token: buildLockToken(params.workspaceId),
      acquiredAt: Date.now(),
      ttlSeconds: Math.max(1, Math.floor(params.ttlSeconds)),
    };

    setCached(key, lock, lock.ttlSeconds * 1000);

    const afterWrite = getCached<WorkspaceLock>(key);
    if (afterWrite && afterWrite.token === lock.token) {
      return lock;
    }

    return null;
  } catch {
    return null;
  }
}

export async function releaseWorkspaceLock(lock: WorkspaceLock): Promise<void> {
  try {
    const current = getCached<WorkspaceLock>(lock.key);
    if (!current) {
      return;
    }

    if (current.token !== lock.token) {
      return;
    }

    setCached(lock.key, current, 0);
  } catch {
    return;
  }
}
