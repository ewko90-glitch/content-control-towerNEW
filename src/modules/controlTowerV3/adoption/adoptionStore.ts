import { getCached, setCached } from "@/lib/domain/controlTowerV3/cache";

import type { AdoptionEvent, AdoptionRecord, AdoptionStatusInput } from "./types";

const ADOPTION_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const ADOPTION_EVENTS_MAX = 50;

export type AdoptionAuditEvent = {
  moveId: string;
  moveTitle: string;
  status: "not_started" | "in_progress" | "adopted" | "ignored";
  atIso: string;
  source: "intent" | "outcome" | "heuristic";
};

function adoptionKey(workspaceId: string, moveId: string): string {
  return `ctv3:adoption:${workspaceId}:${moveId}`;
}

function indexKey(workspaceId: string): string {
  return `ctv3:adoption:index:${workspaceId}`;
}

function metaKey(workspaceId: string): string {
  return `ctv3:adoption:meta:${workspaceId}`;
}

function eventsKey(workspaceId: string): string {
  return `ctv3:adoption:events:${workspaceId}`;
}

function normalizeIso(input: string): string {
  return Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : "1970-01-01T00:00:00.000Z";
}

function mergeIndex(workspaceId: string, moveId: string): void {
  const key = indexKey(workspaceId);
  const current = getCached<string[]>(key) ?? [];
  if (!current.includes(moveId)) {
    const next = [...current, moveId].sort((left, right) => left.localeCompare(right));
    setCached(key, next, ADOPTION_TTL_MS);
  }
}

function compareIsoDesc(leftIso: string, rightIso: string): number {
  const leftTs = Date.parse(leftIso);
  const rightTs = Date.parse(rightIso);
  const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
  const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
  return safeRight - safeLeft;
}

function setMetaLastUpdated(workspaceId: string, atIso: string): void {
  const nextIso = normalizeIso(atIso);
  const current = getCached<{ lastUpdatedAtIso: string | null }>(metaKey(workspaceId));
  const currentIso = current?.lastUpdatedAtIso ? normalizeIso(current.lastUpdatedAtIso) : null;
  const lastUpdatedAtIso =
    currentIso && compareIsoDesc(currentIso, nextIso) <= 0
      ? currentIso
      : nextIso;
  setCached(metaKey(workspaceId), { lastUpdatedAtIso }, ADOPTION_TTL_MS);
}

function pushRecentEvent(workspaceId: string, event: AdoptionAuditEvent): void {
  const current = getCached<AdoptionAuditEvent[]>(eventsKey(workspaceId)) ?? [];
  const next = [...current, event]
    .sort((left, right) => {
      const byIso = compareIsoDesc(left.atIso, right.atIso);
      if (byIso !== 0) {
        return byIso;
      }
      const byMove = left.moveId.localeCompare(right.moveId);
      if (byMove !== 0) {
        return byMove;
      }
      const byStatus = left.status.localeCompare(right.status);
      if (byStatus !== 0) {
        return byStatus;
      }
      return left.source.localeCompare(right.source);
    })
    .slice(0, ADOPTION_EVENTS_MAX);

  setCached(eventsKey(workspaceId), next, ADOPTION_TTL_MS);
}

export function getAdoption(workspaceId: string, moveId: string): AdoptionRecord | null {
  const cached = getCached<AdoptionRecord>(adoptionKey(workspaceId, moveId));
  return cached ?? null;
}

export function getAdoptionMeta(workspaceId: string): Promise<{ lastUpdatedAtIso: string | null }> {
  const meta = getCached<{ lastUpdatedAtIso: string | null }>(metaKey(workspaceId));
  return Promise.resolve({
    lastUpdatedAtIso: meta?.lastUpdatedAtIso ?? null,
  });
}

export function listRecentAdoptionEvents(workspaceId: string, limit = 3): Promise<AdoptionAuditEvent[]> {
  const safeLimit = Math.max(0, Math.min(ADOPTION_EVENTS_MAX, Number.isFinite(limit) ? Math.floor(limit) : 3));
  const events = getCached<AdoptionAuditEvent[]>(eventsKey(workspaceId)) ?? [];
  const sorted = [...events].sort((left, right) => {
    const byIso = compareIsoDesc(left.atIso, right.atIso);
    if (byIso !== 0) {
      return byIso;
    }
    const byMove = left.moveId.localeCompare(right.moveId);
    if (byMove !== 0) {
      return byMove;
    }
    const byStatus = left.status.localeCompare(right.status);
    if (byStatus !== 0) {
      return byStatus;
    }
    return left.source.localeCompare(right.source);
  });

  return Promise.resolve(sorted.slice(0, safeLimit));
}

export function setAdoptionStatus(
  input: AdoptionStatusInput & { moveTitle?: string; source?: "intent" | "outcome" | "heuristic" },
): AdoptionRecord {
  const nowIso = normalizeIso(input.nowIso);
  const current = getAdoption(input.workspaceId, input.moveId);

  const next: AdoptionRecord = {
    workspaceId: input.workspaceId,
    moveId: input.moveId,
    status: input.status,
    adoptedAtIso:
      input.status === "adopted"
        ? normalizeIso(input.adoptedAtIso ?? current?.adoptedAtIso ?? nowIso)
        : current?.adoptedAtIso,
    impact: input.impact ?? current?.impact,
    updatedAtIso: nowIso,
  };

  setCached(adoptionKey(input.workspaceId, input.moveId), next, ADOPTION_TTL_MS);
  mergeIndex(input.workspaceId, input.moveId);
  setMetaLastUpdated(input.workspaceId, nowIso);
  pushRecentEvent(input.workspaceId, {
    moveId: input.moveId,
    moveTitle: input.moveTitle && input.moveTitle.trim().length > 0 ? input.moveTitle.trim() : input.moveId,
    status: next.status,
    atIso: nowIso,
    source: input.source ?? "heuristic",
  });
  return next;
}

export function recordAdoptionEvent(event: AdoptionEvent): AdoptionRecord {
  const nowIso = normalizeIso(event.occurredAtIso);
  if (event.type === "outcome") {
    return setAdoptionStatus({
      workspaceId: event.workspaceId,
      moveId: event.moveId,
      status: "adopted",
      adoptedAtIso: nowIso,
      nowIso,
      moveTitle: event.moveId,
      source: "outcome",
    });
  }

  const existing = getAdoption(event.workspaceId, event.moveId);
  if (existing?.status === "adopted") {
    return existing;
  }

  return setAdoptionStatus({
    workspaceId: event.workspaceId,
    moveId: event.moveId,
    status: "in_progress",
    nowIso,
    moveTitle: event.moveId,
    source: "intent",
  });
}

export function listWorkspaceAdoptions(workspaceId: string, moveIds?: string[]): AdoptionRecord[] {
  const ids = moveIds && moveIds.length > 0 ? [...moveIds] : [...(getCached<string[]>(indexKey(workspaceId)) ?? [])];

  return ids
    .sort((left, right) => left.localeCompare(right))
    .map((moveId) => getAdoption(workspaceId, moveId))
    .filter((entry): entry is AdoptionRecord => entry !== null)
    .sort((left, right) => left.moveId.localeCompare(right.moveId));
}
