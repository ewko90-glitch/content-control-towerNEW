import type { WorkflowTransitionEvent } from "./events";

type AuditEntry = {
  expiresAt: number;
  events: WorkflowTransitionEvent[];
};

const AUDIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_MAX_EVENTS = 200;
const AUDIT_CACHE = new Map<string, AuditEntry>();

function makeAuditKey(workspaceId: string, entityId: string): string {
  return `wf:audit:${workspaceId}:${entityId}`;
}

function getValidAuditEntry(key: string): AuditEntry | null {
  const current = AUDIT_CACHE.get(key);
  if (!current) {
    return null;
  }

  if (Date.now() > current.expiresAt) {
    AUDIT_CACHE.delete(key);
    return null;
  }

  return current;
}

export async function appendTransitionEvent(params: {
  workspaceId: string;
  entityId: string;
  event: WorkflowTransitionEvent;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const key = makeAuditKey(params.workspaceId, params.entityId);
    const current = getValidAuditEntry(key);
    const currentEvents = current?.events ?? [];
    const lastEvent = currentEvents[currentEvents.length - 1];

    const nextEvent: WorkflowTransitionEvent = {
      ...params.event,
      prevEventId: params.event.prevEventId ?? lastEvent?.id,
    };

    const nextEvents = [...currentEvents, nextEvent];
    const capped = nextEvents.length > AUDIT_MAX_EVENTS ? nextEvents.slice(nextEvents.length - AUDIT_MAX_EVENTS) : nextEvents;

    AUDIT_CACHE.set(key, {
      events: capped,
      expiresAt: Date.now() + AUDIT_TTL_MS,
    });

    return { ok: true };
  } catch {
    return { ok: false, message: "Failed to append transition event." };
  }
}

export async function getRecentTransitionEvents(params: {
  workspaceId: string;
  entityId: string;
  limit: number;
}): Promise<WorkflowTransitionEvent[]> {
  try {
    const key = makeAuditKey(params.workspaceId, params.entityId);
    const current = getValidAuditEntry(key);
    if (!current) {
      return [];
    }

    const safeLimit = Math.max(0, Math.min(AUDIT_MAX_EVENTS, params.limit));
    if (safeLimit === 0) {
      return [];
    }

    return current.events.slice(-safeLimit);
  } catch {
    return [];
  }
}
