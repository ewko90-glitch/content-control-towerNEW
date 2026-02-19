import { describe, expect, it } from "vitest";

import { runSimulation } from "../compare";
import { buildSimInput } from "./fixtures";

describe("simulation contract", () => {
  it("capacity increase on bottleneck improves throughput and does not increase bottleneck index", () => {
    const baseline = runSimulation(buildSimInput());
    const bottleneckStage = baseline.stages
      .slice()
      .sort((left, right) => {
        if (left.baseline.effectiveCapacity !== right.baseline.effectiveCapacity) {
          return left.baseline.effectiveCapacity - right.baseline.effectiveCapacity;
        }
        return left.stageId.localeCompare(right.stageId);
      })[0]?.stageId;

    const result = runSimulation(
      buildSimInput({
        scenario: {
          id: "cap-up",
          name: "Capacity Up",
          knobs: bottleneckStage ? [{ kind: "capacity", stageId: bottleneckStage, multiplier: 1.4 }] : [{ kind: "capacity", multiplier: 1.4 }],
        },
      }),
    );

    expect(result.delta.throughputPerWeekDelta).toBeGreaterThan(0);
    expect(result.delta.bottleneckIndexDelta).toBeLessThanOrEqual(0);
  });

  it("outage on bottleneck reduces throughput and increases eta p90", () => {
    const result = runSimulation(
      buildSimInput({
        scenario: {
          id: "outage",
          name: "Outage",
          knobs: [{ kind: "outage", stageId: "review", days: 5, multiplier: 0.4 }],
        },
      }),
    );

    expect(result.delta.throughputPerWeekDelta).toBeLessThan(0);
    expect(result.delta.etaP90DaysDelta ?? 0).toBeGreaterThan(0);
  });

  it("influx increases predictive pressure", () => {
    const result = runSimulation(
      buildSimInput({
        scenario: {
          id: "influx",
          name: "Influx",
          knobs: [{ kind: "influx", stageId: "review", addCount: 6 }],
        },
      }),
    );

    expect(result.delta.predictivePressureDelta).toBeGreaterThanOrEqual(0);
  });

  it("tightening wip limit increases stage wip pressure when counts exceed limit", () => {
    const result = runSimulation(
      buildSimInput({
        scenario: {
          id: "wip-tight",
          name: "WIP Tighten",
          knobs: [{ kind: "wipLimit", stageId: "approved", limit: 2 }],
        },
      }),
    );

    const approved = result.stages.find((entry) => entry.stageId === "approved");
    expect(approved).toBeDefined();
    expect((approved?.projected.wipPressure ?? 0) - (approved?.baseline.wipPressure ?? 0)).toBeGreaterThan(0);
  });
});
