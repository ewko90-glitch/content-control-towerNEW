import { describe, expect, it } from "vitest";

import { computeStageDwellStats } from "../dwell";
import { durationStats } from "../percentiles";
import { computeFlowMetrics } from "../flowMetrics";
import { buildTimeline, buildTimelines } from "../timeline";
import { BASE_EVENTS_BY_ITEM_ID, DEFAULT_ZONES, FIXED_NOW, METRICS_POLICY } from "./fixtures";

function stageOrder(zone: string): number {
  if (zone === "queue") {
    return 0;
  }
  if (zone === "active") {
    return 1;
  }
  return 2;
}

describe("flow metrics contract", () => {
  it("builds stable timeline from unsorted events", () => {
    const sorted = buildTimeline({
      itemId: "item_fast",
      events: BASE_EVENTS_BY_ITEM_ID.item_fast,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
    });

    const unsorted = buildTimeline({
      itemId: "item_fast",
      events: [...BASE_EVENTS_BY_ITEM_ID.item_fast].reverse(),
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
    });

    expect(unsorted).toEqual(sorted);
  });

  it("keeps queue+active dwell equal to lead time for done items", () => {
    const timeline = buildTimeline({
      itemId: "item_fast",
      events: BASE_EVENTS_BY_ITEM_ID.item_fast,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
    });

    const total = (timeline.queueHours ?? 0) + (timeline.activeHours ?? 0);
    expect(timeline.leadHours).toBeDefined();
    expect(total).toBeCloseTo(timeline.leadHours ?? 0, 6);
  });

  it("computes lead and cycle durations from timeline anchors", () => {
    const timeline = buildTimeline({
      itemId: "item_fast",
      events: BASE_EVENTS_BY_ITEM_ID.item_fast,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
    });

    expect(timeline.leadHours).toBeCloseTo(10, 6);
    expect(timeline.cycleHours).toBeCloseTo(6, 6);
  });

  it("computes throughput windows and delta correctly", () => {
    const metrics = computeFlowMetrics({
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    });

    expect(metrics.throughput.lastShort).toBe(3);
    expect(metrics.throughput.priorShort).toBe(1);
    expect(metrics.throughput.lastLookback).toBe(4);
    expect(metrics.throughput.deltaPct).toBe(200);
  });

  it("uses trimmed mean to reduce outlier pull", () => {
    const stats = durationStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 200]);

    expect(stats.trimmedAvgHours).toBeLessThan(stats.avgHours);
  });

  it("returns stage dwell sorted deterministically", () => {
    const timelines = buildTimelines({
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
    });

    const stageDwell = computeStageDwellStats({
      timelines,
      zones: DEFAULT_ZONES,
    });

    const expected = [...stageDwell].sort((left, right) => {
      const leftZone = stageOrder(left.zone);
      const rightZone = stageOrder(right.zone);
      if (leftZone !== rightZone) {
        return leftZone - rightZone;
      }
      if (right.avgLeadShare !== left.avgLeadShare) {
        return right.avgLeadShare - left.avgLeadShare;
      }
      return left.stageId.localeCompare(right.stageId);
    });

    expect(stageDwell).toEqual(expected);
  });
});
