import { getCached, setCached } from "../cache";
import type { IntentSession, OutcomeEvent } from "./types";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const OUTCOME_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_OUTCOMES = 200;
const MAX_DEDUPE_KEYS = 400;

type OutcomeCachePayload = {
  outcomes: OutcomeEvent[];
  recentDedupeKeys: string[];
};

function sessionKey(workspaceId: string, sessionId: string): string {
  return `ctv3:intent:sessions:${workspaceId}:${sessionId}`;
}

function latestSessionKey(workspaceId: string, intent: string): string {
  return `ctv3:intent:latest:${workspaceId}:${intent}`;
}

function outcomesKey(workspaceId: string): string {
  return `ctv3:intent:outcomes:${workspaceId}`;
}

function stableHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function createSessionId(workspaceId: string, intent: string, targetRoute: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  const now = Date.now();
  const signature = stableHash(`${workspaceId}:${intent}:${targetRoute}:${now}`);
  return `sess_${now.toString(36)}_${signature}`;
}

function sortOutcomeEvents(events: OutcomeEvent[]): OutcomeEvent[] {
  return [...events].sort((left, right) => {
    const leftMs = new Date(left.occurredAt).getTime();
    const rightMs = new Date(right.occurredAt).getTime();
    if (leftMs !== rightMs) {
      return leftMs - rightMs;
    }
    if (left.sessionId !== right.sessionId) {
      return left.sessionId.localeCompare(right.sessionId);
    }
    return left.intent.localeCompare(right.intent);
  });
}

function readOutcomePayload(workspaceId: string): OutcomeCachePayload {
  const raw = getCached<OutcomeCachePayload | OutcomeEvent[]>(outcomesKey(workspaceId));

  if (!raw) {
    return {
      outcomes: [],
      recentDedupeKeys: [],
    };
  }

  if (Array.isArray(raw)) {
    return {
      outcomes: raw,
      recentDedupeKeys: [],
    };
  }

  return {
    outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [],
    recentDedupeKeys: Array.isArray(raw.recentDedupeKeys) ? raw.recentDedupeKeys : [],
  };
}

function minuteBucket(occurredAt: string): number {
  const parsed = Date.parse(occurredAt);
  const safeParsed = Number.isFinite(parsed) ? parsed : Date.now();
  return Math.floor(safeParsed / 60000);
}

export function computeOutcomeDedupeKey(event: OutcomeEvent): string {
  return `${event.workspaceId}:${event.sessionId}:${event.intent}:${event.outcome}:${minuteBucket(event.occurredAt)}`;
}

export function shouldAppendOutcome(existingKeys: string[], dedupeKey: string): boolean {
  return !existingKeys.includes(dedupeKey);
}

export async function startIntentSession(params: Omit<IntentSession, "sessionId" | "startedAt">): Promise<IntentSession> {
  const session: IntentSession = {
    sessionId: createSessionId(params.workspaceId, params.intent, params.targetRoute),
    workspaceId: params.workspaceId,
    intent: params.intent,
    source: params.source,
    startedAt: new Date().toISOString(),
    targetRoute: params.targetRoute,
    targetQuery: params.targetQuery,
    entityIds: params.entityIds,
  };

  setCached(sessionKey(session.workspaceId, session.sessionId), session, SESSION_TTL_MS);
  setCached(latestSessionKey(session.workspaceId, session.intent), session.sessionId, SESSION_TTL_MS);

  return session;
}

export async function getLatestIntentSession(params: { workspaceId: string; intent: string }): Promise<IntentSession | null> {
  const sessionId = getCached<string>(latestSessionKey(params.workspaceId, params.intent));
  if (!sessionId) {
    return null;
  }

  return getCached<IntentSession>(sessionKey(params.workspaceId, sessionId));
}

export async function recordOutcome(event: OutcomeEvent): Promise<void> {
  const key = outcomesKey(event.workspaceId);
  const payload = readOutcomePayload(event.workspaceId);
  const dedupeKey = computeOutcomeDedupeKey(event);

  if (!shouldAppendOutcome(payload.recentDedupeKeys, dedupeKey)) {
    return;
  }

  const hasDuplicate = payload.outcomes.some(
    (item) => item.sessionId === event.sessionId && item.intent === event.intent && item.outcome === event.outcome,
  );

  if (hasDuplicate) {
    return;
  }

  const nextOutcomes = sortOutcomeEvents([...payload.outcomes, event]);
  const boundedOutcomes = nextOutcomes.length > MAX_OUTCOMES ? nextOutcomes.slice(nextOutcomes.length - MAX_OUTCOMES) : nextOutcomes;

  const nextDedupeKeys = [...payload.recentDedupeKeys, dedupeKey];
  while (nextDedupeKeys.length > MAX_DEDUPE_KEYS) {
    nextDedupeKeys.shift();
  }

  setCached<OutcomeCachePayload>(
    key,
    {
      outcomes: boundedOutcomes,
      recentDedupeKeys: nextDedupeKeys,
    },
    OUTCOME_TTL_MS,
  );
}

export async function hasOutcomeForSession(params: {
  workspaceId: string;
  sessionId: string;
  outcomes?: OutcomeEvent["outcome"][];
}): Promise<boolean> {
  const existing = readOutcomePayload(params.workspaceId).outcomes;
  const allowedOutcomes = params.outcomes;

  return existing.some((item) => {
    if (item.sessionId !== params.sessionId) {
      return false;
    }

    if (!allowedOutcomes || allowedOutcomes.length === 0) {
      return true;
    }

    return allowedOutcomes.includes(item.outcome);
  });
}

export async function getRecentOutcomes(params: { workspaceId: string; windowHours: number }): Promise<OutcomeEvent[]> {
  const list = readOutcomePayload(params.workspaceId).outcomes;
  const nowMs = Date.now();
  const windowMs = Math.max(1, params.windowHours) * 60 * 60 * 1000;
  const minTime = nowMs - windowMs;

  return list
    .filter((event) => {
      const occurredAtMs = new Date(event.occurredAt).getTime();
      return Number.isFinite(occurredAtMs) && occurredAtMs >= minTime;
    })
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}
