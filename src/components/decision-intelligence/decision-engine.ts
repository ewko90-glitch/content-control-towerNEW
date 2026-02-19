import type { DecisionStore } from "./decision-types";

function exists(store: DecisionStore, id: string): boolean {
  return store.entries.some((entry) => entry.id === id);
}

export function adoptDecision(store: DecisionStore, id: string): DecisionStore {
  if (!exists(store, id)) {
    return store;
  }

  const entries = store.entries.map((entry) => {
    if (entry.id === id) {
      return { ...entry, status: "adopted" as const };
    }

    if (entry.status === "adopted") {
      return { ...entry, status: "explored" as const };
    }

    return entry;
  });

  return {
    ...store,
    entries,
    currentStrategyId: id,
  };
}

export function rejectDecision(store: DecisionStore, id: string): DecisionStore {
  if (!exists(store, id)) {
    return store;
  }

  const entries = store.entries.map((entry) => (entry.id === id ? { ...entry, status: "rejected" as const } : entry));

  return {
    ...store,
    entries,
    currentStrategyId: store.currentStrategyId === id ? undefined : store.currentStrategyId,
  };
}
