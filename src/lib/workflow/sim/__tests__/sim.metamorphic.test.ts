import { describe, expect, it } from "vitest";

import { runSimulation } from "../compare";
import { buildSimInput } from "./fixtures";

describe("simulation metamorphic properties", () => {
  it("increasing capacity multiplier cannot reduce throughput", () => {
    const low = runSimulation(
      buildSimInput({
        scenario: {
          id: "cap-low",
          name: "Cap Low",
          knobs: [{ kind: "capacity", stageId: "review", multiplier: 1.05 }],
        },
      }),
    );
    const high = runSimulation(
      buildSimInput({
        scenario: {
          id: "cap-high",
          name: "Cap High",
          knobs: [{ kind: "capacity", stageId: "review", multiplier: 1.35 }],
        },
      }),
    );

    expect(high.projected.throughputPerWeek ?? 0).toBeGreaterThanOrEqual(low.projected.throughputPerWeek ?? 0);
  });

  it("increasing influx cannot reduce bottleneck index", () => {
    const low = runSimulation(
      buildSimInput({
        scenario: {
          id: "influx-low",
          name: "Influx Low",
          knobs: [{ kind: "influx", stageId: "review", addCount: 1 }],
        },
      }),
    );
    const high = runSimulation(
      buildSimInput({
        scenario: {
          id: "influx-high",
          name: "Influx High",
          knobs: [{ kind: "influx", stageId: "review", addCount: 8 }],
        },
      }),
    );

    expect(high.projected.bottleneckIndex ?? 0).toBeGreaterThanOrEqual(low.projected.bottleneckIndex ?? 0);
  });

  it("increasing outage days increases lead time or leaves unchanged", () => {
    const short = runSimulation(
      buildSimInput({
        scenario: {
          id: "outage-short",
          name: "Outage Short",
          knobs: [{ kind: "outage", stageId: "review", days: 2, multiplier: 0.5 }],
        },
      }),
    );
    const long = runSimulation(
      buildSimInput({
        scenario: {
          id: "outage-long",
          name: "Outage Long",
          knobs: [{ kind: "outage", stageId: "review", days: 6, multiplier: 0.5 }],
        },
      }),
    );

    expect(long.projected.leadAvgHours ?? 0).toBeGreaterThanOrEqual(short.projected.leadAvgHours ?? 0);
  });

  it("decreasing wip limit cannot reduce wip pressure with fixed count", () => {
    const relaxed = runSimulation(
      buildSimInput({
        scenario: {
          id: "wip-relaxed",
          name: "WIP Relaxed",
          knobs: [{ kind: "wipLimit", stageId: "review", limit: 6 }],
        },
      }),
    );
    const tight = runSimulation(
      buildSimInput({
        scenario: {
          id: "wip-tight",
          name: "WIP Tight",
          knobs: [{ kind: "wipLimit", stageId: "review", limit: 2 }],
        },
      }),
    );

    const relaxedReview = relaxed.stages.find((entry) => entry.stageId === "review");
    const tightReview = tight.stages.find((entry) => entry.stageId === "review");

    expect(tightReview?.projected.wipPressure ?? 0).toBeGreaterThanOrEqual(relaxedReview?.projected.wipPressure ?? 0);
  });
});
