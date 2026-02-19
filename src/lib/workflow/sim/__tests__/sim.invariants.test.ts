import { describe, expect, it } from "vitest";

import { runSimulation } from "../compare";
import { buildSimInput } from "./fixtures";

function collectNumbers(input: unknown): number[] {
  if (typeof input === "number") {
    return [input];
  }
  if (Array.isArray(input)) {
    return input.flatMap((entry) => collectNumbers(entry));
  }
  if (typeof input === "object" && input !== null) {
    return Object.values(input).flatMap((entry) => collectNumbers(entry));
  }
  return [];
}

describe("simulation invariants", () => {
  it("keeps bounded ranges and avoids NaN", () => {
    const result = runSimulation(
      buildSimInput({
        scenario: {
          id: "inv",
          name: "Invariants",
          knobs: [
            { kind: "influx", stageId: "review", addCount: 6 },
            { kind: "outage", stageId: "review", days: 4, multiplier: 0.4 },
            { kind: "capacity", stageId: "approved", multiplier: 1.15 },
          ],
        },
      }),
    );

    expect(result.projected.bottleneckIndex ?? 0).toBeGreaterThanOrEqual(0);
    expect(result.projected.bottleneckIndex ?? 100).toBeLessThanOrEqual(100);
    expect(result.projected.predictivePressure ?? 0).toBeGreaterThanOrEqual(0);
    expect(result.projected.predictivePressure ?? 100).toBeLessThanOrEqual(100);

    for (const stage of result.stages) {
      expect(stage.baseline.resistance).toBeGreaterThanOrEqual(0);
      expect(stage.baseline.resistance).toBeLessThanOrEqual(1);
      expect(stage.projected.resistance).toBeGreaterThanOrEqual(0);
      expect(stage.projected.resistance).toBeLessThanOrEqual(1);
      expect(stage.baseline.effectiveCapacity).toBeGreaterThanOrEqual(0.1);
      expect(stage.baseline.effectiveCapacity).toBeLessThanOrEqual(2);
      expect(stage.projected.effectiveCapacity).toBeGreaterThanOrEqual(0.1);
      expect(stage.projected.effectiveCapacity).toBeLessThanOrEqual(2);
    }

    const numericValues = collectNumbers(result);
    for (const value of numericValues) {
      expect(Number.isNaN(value)).toBe(false);
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
