import { getCached, setCached } from "@/lib/domain/controlTowerV3/cache";

import type { ScenarioLedgerEntry } from "./types";

const LEDGER_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const LEDGER_MAX_ENTRIES = 200;

type ScenarioLedgerActual = NonNullable<ScenarioLedgerEntry["actual"]>;

function ledgerKey(workspaceId: string): string {
  return `ctv3:ledger:${workspaceId}`;
}

function normalizeIso(input: string): string {
  return Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : "1970-01-01T00:00:00.000Z";
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeEntry(entry: ScenarioLedgerEntry): ScenarioLedgerEntry {
  return {
    id: String(entry.id),
    scenarioId: String(entry.scenarioId),
    lever: entry.lever,
    horizon: entry.horizon,
    predicted: {
      healthScoreDelta: normalizeNumber(entry.predicted.healthScoreDelta),
      riskExposureDelta: normalizeNumber(entry.predicted.riskExposureDelta),
      roiDelta: normalizeNumber(entry.predicted.roiDelta),
    },
    ...(entry.actual
      ? {
          actual: {
            healthScoreDelta: normalizeNumber(entry.actual.healthScoreDelta),
            riskExposureDelta: normalizeNumber(entry.actual.riskExposureDelta),
            roiDelta: normalizeNumber(entry.actual.roiDelta),
          },
        }
      : {}),
    createdAt: normalizeIso(entry.createdAt),
  };
}

function compareDesc(left: ScenarioLedgerEntry, right: ScenarioLedgerEntry): number {
  const byCreatedAt = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  const byScenario = left.scenarioId.localeCompare(right.scenarioId);
  if (byScenario !== 0) {
    return byScenario;
  }
  return left.id.localeCompare(right.id);
}

function save(workspaceId: string, entries: ScenarioLedgerEntry[]): void {
  const normalized = entries.map(normalizeEntry).sort(compareDesc).slice(0, LEDGER_MAX_ENTRIES);
  setCached(ledgerKey(workspaceId), normalized, LEDGER_TTL_MS);
}

export function addLedgerEntry(params: { workspaceId: string; entry: ScenarioLedgerEntry }): ScenarioLedgerEntry[] {
  const current = getCached<ScenarioLedgerEntry[]>(ledgerKey(params.workspaceId)) ?? [];
  save(params.workspaceId, [...current, normalizeEntry(params.entry)]);
  return getLedgerEntries(params.workspaceId);
}

export function updateLedgerActual(params: { workspaceId: string; id: string; actual: ScenarioLedgerActual }): ScenarioLedgerEntry[] {
  const current = getCached<ScenarioLedgerEntry[]>(ledgerKey(params.workspaceId)) ?? [];
  const next = current.map((entry) =>
    entry.id === params.id
      ? {
          ...normalizeEntry(entry),
          actual: {
            healthScoreDelta: normalizeNumber(params.actual.healthScoreDelta),
            riskExposureDelta: normalizeNumber(params.actual.riskExposureDelta),
            roiDelta: normalizeNumber(params.actual.roiDelta),
          },
        }
      : normalizeEntry(entry),
  );

  save(params.workspaceId, next);
  return getLedgerEntries(params.workspaceId);
}

export function getLedgerEntries(workspaceId: string, limit = 200): ScenarioLedgerEntry[] {
  const current = getCached<ScenarioLedgerEntry[]>(ledgerKey(workspaceId)) ?? [];
  const safeLimit = Math.max(0, Math.min(LEDGER_MAX_ENTRIES, Number.isFinite(limit) ? Math.floor(limit) : LEDGER_MAX_ENTRIES));
  return [...current].map(normalizeEntry).sort(compareDesc).slice(0, safeLimit);
}
