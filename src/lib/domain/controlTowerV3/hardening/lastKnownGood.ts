import { getCached, setCached } from "../cache";
import type { ControlTowerDecisionSnapshot } from "../snapshot";
import { isFencedWriter } from "./fencing";
import type { WorkspaceLock } from "./lock";

const LKG_DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function lastKnownGoodKey(workspaceId: string): string {
  return `ctv3:decision:lkg:${workspaceId}`;
}

function decisionLockKey(workspaceId: string): string {
  return `ctv3:lock:decision:${workspaceId}`;
}

export async function getLastKnownGoodSnapshot(params: { workspaceId: string }): Promise<ControlTowerDecisionSnapshot | null> {
  try {
    return getCached<ControlTowerDecisionSnapshot>(lastKnownGoodKey(params.workspaceId));
  } catch {
    return null;
  }
}

export async function setLastKnownGoodSnapshot(params: {
  workspaceId: string;
  snapshot: ControlTowerDecisionSnapshot;
  ttlSeconds: number;
  lockToken?: string;
}): Promise<void> {
  try {
    if (params.lockToken) {
      const currentLock = getCached<WorkspaceLock>(decisionLockKey(params.workspaceId));
      const currentToken = currentLock?.token;

      if (!isFencedWriter({ lockToken: params.lockToken, currentTokenFromCache: currentToken })) {
        return;
      }
    }

    const ttlSeconds = Math.max(1, Math.floor(params.ttlSeconds || LKG_DEFAULT_TTL_SECONDS));
    setCached(lastKnownGoodKey(params.workspaceId), params.snapshot, ttlSeconds * 1000);
  } catch {
    return;
  }
}
