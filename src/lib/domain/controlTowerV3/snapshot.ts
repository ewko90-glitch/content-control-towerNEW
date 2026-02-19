import { getCached, makeBucketKey, setCached } from "./cache";
import { fetchControlTowerRaw } from "./queries";
import type { RawInput } from "./queries";
import type { ControlTowerDecisionSnapshot } from "./types";

export type { ControlTowerDecisionSnapshot } from "./types";

const RAW_CACHE_TTL_MS = 30000;
export const CONTROL_TOWER_SCHEMA_VERSION = "ctv3.schema.1";
export const CONTROL_TOWER_DECISION_VERSION = "ctv3.v1.5.hardening";

export type CachedRawSnapshot = {
  raw: RawInput;
  generatedAtISO: string;
};

export type CachedDecisionSnapshot = {
  decision: ControlTowerDecisionSnapshot;
  generatedAtISO: string;
};

export type DecisionRuntimeMetadata = {
  schemaVersion: typeof CONTROL_TOWER_SCHEMA_VERSION;
  decisionVersion: typeof CONTROL_TOWER_DECISION_VERSION;
  generatedAt: string;
};

export async function getRawSnapshotCached(workspaceId: string, userId: string, now: Date): Promise<CachedRawSnapshot> {
  const key = makeBucketKey(workspaceId, now);
  const cached = getCached<CachedRawSnapshot>(key);

  if (cached) {
    return cached;
  }

  try {
    const raw = await fetchControlTowerRaw(workspaceId, userId, now);
    const payload: CachedRawSnapshot = {
      raw,
      generatedAtISO: raw.generatedAtISO,
    };
    setCached(key, payload, RAW_CACHE_TTL_MS);
    return payload;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }

    throw new Error("Nie udało się wczytać danych Control Tower. Sprawdź DATABASE_URL w .env.local i uruchom npx prisma generate.");
  }
}
