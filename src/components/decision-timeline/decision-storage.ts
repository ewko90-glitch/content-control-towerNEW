import { adoptDecision, rejectDecision } from "@/components/decision-intelligence/decision-engine";
import type { DecisionEntry, DecisionStatus, DecisionStore, MetricSnapshot } from "./decision-types";

const STORE_VERSION = "v1" as const;
const MAX_ENTRIES = 25;

function storageKey(workspaceSlug: string): string {
  return `cct:decision:intelligence:${STORE_VERSION}:${workspaceSlug}`;
}

function emptyStore(): DecisionStore {
  return {
    version: STORE_VERSION,
    currentStrategyId: undefined,
    entries: [],
  };
}

function sanitizeNumber(input: unknown): number | undefined {
  if (typeof input !== "number" || Number.isNaN(input) || !Number.isFinite(input)) {
    return undefined;
  }
  return input;
}

function sanitizeSnapshot(input: unknown): MetricSnapshot | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const capturedAt = typeof record.capturedAt === "string" ? record.capturedAt : undefined;
  if (!capturedAt) {
    return undefined;
  }

  const windowDaysRaw = sanitizeNumber(record.windowDays);

  return {
    capturedAt,
    windowDays: Math.max(1, Math.floor(windowDaysRaw ?? 7)),
    throughputPerWeek: sanitizeNumber(record.throughputPerWeek),
    leadAvgHours: sanitizeNumber(record.leadAvgHours),
    cycleAvgHours: sanitizeNumber(record.cycleAvgHours),
    bottleneckIndex: sanitizeNumber(record.bottleneckIndex),
    predictivePressure: sanitizeNumber(record.predictivePressure),
  };
}

function sanitizeEntry(input: unknown): DecisionEntry | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;

  if (typeof record.id !== "string" || typeof record.scenarioName !== "string" || typeof record.horizonDays !== "number") {
    return null;
  }

  const status = record.status;
  if (status !== "explored" && status !== "adopted" && status !== "rejected") {
    return null;
  }

  const deltaRecord =
    typeof record.delta === "object" && record.delta !== null && !Array.isArray(record.delta)
      ? (record.delta as Record<string, unknown>)
      : {};

  const baseline = sanitizeSnapshot(record.baseline);

  return {
    id: record.id,
    scenarioId: typeof record.scenarioId === "string" ? record.scenarioId : undefined,
    scenarioName: record.scenarioName,
    horizonDays: Math.max(1, Math.floor(record.horizonDays)),
    delta: {
      throughputDelta: sanitizeNumber(deltaRecord.throughputDelta),
      leadTimeDelta: sanitizeNumber(deltaRecord.leadTimeDelta),
      riskDelta: sanitizeNumber(deltaRecord.riskDelta),
    },
    status,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date(0).toISOString(),
    adoptedAt: typeof record.adoptedAt === "string" ? record.adoptedAt : undefined,
    baseline,
    lastImpact: undefined,
  };
}

function sanitizeStore(input: unknown): DecisionStore {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return emptyStore();
  }

  const record = input as Record<string, unknown>;
  if (record.version !== STORE_VERSION) {
    return emptyStore();
  }

  const parsedEntries = Array.isArray(record.entries)
    ? record.entries.map((entry) => sanitizeEntry(entry)).filter((entry): entry is DecisionEntry => entry !== null)
    : [];
  const entries = parsedEntries.slice(0, MAX_ENTRIES);

  const currentStrategyId = typeof record.currentStrategyId === "string" ? record.currentStrategyId : undefined;
  const hasCurrent = currentStrategyId ? entries.some((entry) => entry.id === currentStrategyId && entry.status === "adopted") : false;

  return {
    version: STORE_VERSION,
    currentStrategyId: hasCurrent ? currentStrategyId : undefined,
    entries,
  };
}

function normalizeStore(store: DecisionStore): DecisionStore {
  const entries = store.entries.slice(0, MAX_ENTRIES);
  const adopted = entries.find((entry) => entry.status === "adopted");

  return {
    version: STORE_VERSION,
    entries,
    currentStrategyId: adopted?.id,
  };
}

export function loadDecisionStore(workspaceSlug: string): DecisionStore {
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceSlug));
    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as unknown;
    return sanitizeStore(parsed);
  } catch {
    return emptyStore();
  }
}

export function saveDecisionStore(workspaceSlug: string, store: DecisionStore): DecisionStore {
  const normalized = normalizeStore(store);

  try {
    window.localStorage.setItem(storageKey(workspaceSlug), JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
}

function dedupeByScenario(entries: DecisionEntry[], incoming: DecisionEntry): DecisionEntry[] {
  return entries.filter(
    (entry) =>
      !(
        entry.scenarioName.trim().toLowerCase() === incoming.scenarioName.trim().toLowerCase() &&
        entry.horizonDays === incoming.horizonDays
      ),
  );
}

export function addExploredDecision(workspaceSlug: string, entry: DecisionEntry): DecisionStore {
  const current = loadDecisionStore(workspaceSlug);
  const cleanIncoming: DecisionEntry = {
    ...entry,
    status: "explored",
    createdAt: entry.createdAt,
    adoptedAt: undefined,
  };

  const nextEntries = [cleanIncoming, ...dedupeByScenario(current.entries, cleanIncoming)].slice(0, MAX_ENTRIES);
  const next: DecisionStore = {
    version: STORE_VERSION,
    currentStrategyId: current.currentStrategyId,
    entries: nextEntries,
  };

  return saveDecisionStore(workspaceSlug, next);
}

export function transitionDecisionStatus(workspaceSlug: string, id: string, newStatus: DecisionStatus): DecisionStore {
  const current = loadDecisionStore(workspaceSlug);

  let next: DecisionStore;
  if (newStatus === "adopted") {
    next = adoptDecision(current, id);
  } else if (newStatus === "rejected") {
    next = rejectDecision(current, id);
  } else {
    const entries = current.entries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            status: "explored" as const,
          }
        : entry,
    );
    const clearCurrent = current.currentStrategyId === id ? undefined : current.currentStrategyId;
    next = {
      ...current,
      entries,
      currentStrategyId: clearCurrent,
    };
  }

  return saveDecisionStore(workspaceSlug, next);
}

export function adoptDecisionWithBaseline(workspaceSlug: string, id: string, baseline: MetricSnapshot): DecisionStore {
  const nowIso = new Date().toISOString();
  const current = loadDecisionStore(workspaceSlug);
  const adopted = adoptDecision(current, id);

  const entries = adopted.entries.map((entry) => {
    if (entry.id !== id) {
      return entry;
    }

    return {
      ...entry,
      adoptedAt: entry.adoptedAt ?? nowIso,
      baseline: entry.baseline ?? {
        capturedAt: baseline.capturedAt,
        windowDays: Math.max(1, Math.floor(baseline.windowDays || 7)),
        throughputPerWeek: sanitizeNumber(baseline.throughputPerWeek),
        leadAvgHours: sanitizeNumber(baseline.leadAvgHours),
        cycleAvgHours: sanitizeNumber(baseline.cycleAvgHours),
        bottleneckIndex: sanitizeNumber(baseline.bottleneckIndex),
        predictivePressure: sanitizeNumber(baseline.predictivePressure),
      },
    };
  });

  return saveDecisionStore(workspaceSlug, {
    ...adopted,
    entries,
  });
}

export function getCurrentStrategy(workspaceSlug: string): DecisionEntry | undefined {
  const store = loadDecisionStore(workspaceSlug);
  if (!store.currentStrategyId) {
    return undefined;
  }
  return store.entries.find((entry) => entry.id === store.currentStrategyId && entry.status === "adopted");
}
