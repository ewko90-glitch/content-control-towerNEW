import { describe, expect, it } from "vitest";

import { computeFlowMetrics } from "../flowMetrics";
import {
  BASE_EVENTS_BY_ITEM_ID,
  DEFAULT_ZONES,
  FIXED_NOW,
  METRICS_POLICY,
  WITHOUT_OUTLIER,
  WITH_EXTRA_LAST7D,
  withIncreasedDwell,
  withPermutedOrder,
} from "./fixtures";

describe("flow metrics metamorphic properties", () => {
  it("adding one done item in last 7 days cannot reduce short throughput", () => {
    const base = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    });

    const expanded = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: WITH_EXTRA_LAST7D,
    });

    expect(expanded.throughput.lastShort).toBeGreaterThanOrEqual(base.throughput.lastShort);
  });

  it("permuting event order does not change output", () => {
    const left = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    });

    const right = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: withPermutedOrder(BASE_EVENTS_BY_ITEM_ID),
    });

    expect(right).toEqual(left);
  });

  it("increasing dwell durations increases lead and cycle means", () => {
    const base = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    });

    const stretched = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: withIncreasedDwell(BASE_EVENTS_BY_ITEM_ID),
    });

    expect(stretched.leadTime.avgHours).toBeGreaterThanOrEqual(base.leadTime.avgHours);
    expect(stretched.cycleTime.avgHours).toBeGreaterThanOrEqual(base.cycleTime.avgHours);
  });

  it("removing worst outlier does not increase trimmed average", () => {
    const withOutlier = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    });

    const withoutOutlier = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: WITHOUT_OUTLIER,
    });

    expect(withoutOutlier.leadTime.trimmedAvgHours).toBeLessThanOrEqual(withOutlier.leadTime.trimmedAvgHours);
  });
});
