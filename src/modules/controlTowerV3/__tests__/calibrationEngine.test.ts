import { describe, expect, it } from "vitest";

import { computePredictionAccuracy } from "../calibrationEngine";
import type { ScenarioLedgerEntry } from "../types";

function makeEntry(overrides?: Partial<ScenarioLedgerEntry>): ScenarioLedgerEntry {
  return {
    id: "entry-1",
    scenarioId: "scenario-1",
    lever: "optimize_roi",
    horizon: 14,
    predicted: {
      healthScoreDelta: 2,
      riskExposureDelta: -3,
      roiDelta: 1200,
    },
    createdAt: "2026-02-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("computePredictionAccuracy", () => {
  it("returns 0 when actual is missing", () => {
    const accuracy = computePredictionAccuracy(makeEntry());
    expect(accuracy).toBe(0);
  });

  it("computes deterministic accuracy from mean absolute error", () => {
    const accuracy = computePredictionAccuracy(
      makeEntry({
        actual: {
          healthScoreDelta: 1,
          riskExposureDelta: -1,
          roiDelta: 1000,
        },
      }),
    );

    const expectedMae = (1 + 2 + 200) / 3;
    const expectedAccuracy = 1 / (1 + expectedMae);
    expect(accuracy).toBeCloseTo(expectedAccuracy, 10);
  });

  it("returns 1 for perfect prediction match", () => {
    const accuracy = computePredictionAccuracy(
      makeEntry({
        actual: {
          healthScoreDelta: 2,
          riskExposureDelta: -3,
          roiDelta: 1200,
        },
      }),
    );

    expect(accuracy).toBe(1);
  });
});
