import { describe, expect, it } from "vitest";

import { addLedgerEntry, getLedgerEntries, updateLedgerActual } from "../ledgerStore";
import type { ScenarioLedgerEntry } from "../types";

function makeEntry(index: number, createdAt: string): ScenarioLedgerEntry {
  return {
    id: `entry-${String(index).padStart(3, "0")}`,
    scenarioId: `scenario-${String(index).padStart(3, "0")}`,
    lever: "prioritize_execution",
    horizon: 7,
    predicted: {
      healthScoreDelta: index,
      riskExposureDelta: -index,
      roiDelta: index * 100,
    },
    createdAt,
  };
}

describe("ledgerStore", () => {
  it("prunes deterministically and keeps max 200 entries", () => {
    const workspaceId = "ws-ledger-prune";
    const baseTs = Date.parse("2026-02-16T10:00:00.000Z");

    for (let index = 0; index < 205; index += 1) {
      const createdAt = new Date(baseTs + index * 60_000).toISOString();
      addLedgerEntry({
        workspaceId,
        entry: makeEntry(index, createdAt),
      });
    }

    const entries = getLedgerEntries(workspaceId);
    expect(entries).toHaveLength(200);
    expect(entries[0]?.id).toBe("entry-204");
    expect(entries[199]?.id).toBe("entry-005");
  });

  it("returns entries sorted by createdAt desc deterministically", () => {
    const workspaceId = "ws-ledger-sort";

    addLedgerEntry({ workspaceId, entry: makeEntry(1, "2026-02-16T09:00:00.000Z") });
    addLedgerEntry({ workspaceId, entry: makeEntry(2, "2026-02-16T11:00:00.000Z") });
    addLedgerEntry({ workspaceId, entry: makeEntry(3, "2026-02-16T10:00:00.000Z") });

    const entries = getLedgerEntries(workspaceId, 3);
    expect(entries.map((entry) => entry.id)).toEqual(["entry-002", "entry-003", "entry-001"]);
  });

  it("updates actual deltas without crashing", () => {
    const workspaceId = "ws-ledger-update";
    addLedgerEntry({ workspaceId, entry: makeEntry(9, "2026-02-16T09:00:00.000Z") });

    const updated = updateLedgerActual({
      workspaceId,
      id: "entry-009",
      actual: {
        healthScoreDelta: 3,
        riskExposureDelta: -2,
        roiDelta: 900,
      },
    });

    expect(updated[0]?.actual).toEqual({ healthScoreDelta: 3, riskExposureDelta: -2, roiDelta: 900 });
  });
});
