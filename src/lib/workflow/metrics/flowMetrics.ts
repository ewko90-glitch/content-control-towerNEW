import { computeAnomalies } from "./anomalyScore";
import { computeStageDwellStats } from "./dwell";
import { clamp, durationStats } from "./percentiles";
import { buildTimelines } from "./timeline";
import { computeTrendStats } from "./trends";
import type { FlowMetricsInput, FlowMetricsSnapshot, ItemTimeline } from "./types";

type DonePoint = {
  itemId: string;
  doneAt: Date;
  leadHours: number;
  cycleHours: number;
  activeHours: number;
};

function emptySnapshot(window: { lookbackDays: number; shortDays: number }): FlowMetricsSnapshot {
  return {
    window,
    leadTime: durationStats([]),
    cycleTime: durationStats([]),
    throughput: {
      lastShort: 0,
      priorShort: 0,
      lastLookback: 0,
      perWeek: 0,
      deltaPct: 0,
    },
    efficiency: {
      efficiency: 0,
      avgActiveHours: 0,
      avgLeadHours: 0,
      deltaPct: 0,
    },
    stageDwell: [],
    trends: {
      leadTimeDeltaPct: 0,
      cycleTimeDeltaPct: 0,
      throughputDeltaPct: 0,
      efficiencyDeltaPct: 0,
      volatilityScore: 0,
    },
    anomalies: [],
    recentDoneItemIds: [],
  };
}

function toDonePoints(timelines: ItemTimeline[]): DonePoint[] {
  const done: DonePoint[] = [];

  for (const timeline of timelines) {
    if (!timeline.firstDoneAt) {
      continue;
    }

    const doneAt = new Date(timeline.firstDoneAt);
    if (Number.isNaN(doneAt.getTime())) {
      continue;
    }

    done.push({
      itemId: timeline.itemId,
      doneAt,
      leadHours: Math.max(0, timeline.leadHours ?? 0),
      cycleHours: Math.max(0, timeline.cycleHours ?? 0),
      activeHours: Math.max(0, timeline.activeHours ?? 0),
    });
  }

  return done;
}

function inRangeInclusive(date: Date, start: Date, end: Date): boolean {
  const value = date.getTime();
  return value >= start.getTime() && value <= end.getTime();
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const value = date.getTime();
  return value >= start.getTime() && value < end.getTime();
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function deltaPct(current: number, previous: number): number {
  return clamp(((current - previous) / Math.max(1, previous)) * 100, -200, 200);
}

export function computeFlowMetrics(input: FlowMetricsInput): FlowMetricsSnapshot {
  const lookbackDays = Math.max(1, Math.round(input.window?.lookbackDays ?? 30));
  const shortDays = Math.max(1, Math.round(input.window?.shortDays ?? 7));
  const window = { lookbackDays, shortDays };

  if (!input.eventsByItemId || Object.keys(input.eventsByItemId).length === 0) {
    return emptySnapshot(window);
  }

  const timelines = buildTimelines({
    eventsByItemId: input.eventsByItemId,
    zones: input.zones,
    now: input.now,
  });

  const donePoints = toDonePoints(timelines);
  const lookbackStart = new Date(input.now.getTime() - lookbackDays * 24 * 3600000);
  const shortStart = new Date(input.now.getTime() - shortDays * 24 * 3600000);
  const priorShortStart = new Date(input.now.getTime() - shortDays * 2 * 24 * 3600000);

  const doneLookback = donePoints.filter((point) => inRangeInclusive(point.doneAt, lookbackStart, input.now));
  const doneShort = donePoints.filter((point) => inRange(point.doneAt, shortStart, input.now));
  const donePriorShort = donePoints.filter((point) => inRange(point.doneAt, priorShortStart, shortStart));

  const leadTime = durationStats(doneLookback.map((point) => point.leadHours));
  const cycleTime = durationStats(doneLookback.map((point) => point.cycleHours));

  const throughput = {
    lastShort: doneShort.length,
    priorShort: donePriorShort.length,
    lastLookback: doneLookback.length,
    perWeek: doneLookback.length / (lookbackDays / 7),
    deltaPct: deltaPct(doneShort.length, donePriorShort.length),
  };

  const avgActiveHours = avg(doneLookback.map((point) => point.activeHours));
  const avgLeadHours = avg(doneLookback.map((point) => point.leadHours));
  const efficiencyValue = avgLeadHours > 0 ? clamp(avgActiveHours / Math.max(1e-6, avgLeadHours), 0, 1) : 0;

  const shortAvgActive = avg(doneShort.map((point) => point.activeHours));
  const shortAvgLead = avg(doneShort.map((point) => point.leadHours));
  const shortEfficiency = shortAvgLead > 0 ? clamp(shortAvgActive / Math.max(1e-6, shortAvgLead), 0, 1) : 0;

  const priorAvgActive = avg(donePriorShort.map((point) => point.activeHours));
  const priorAvgLead = avg(donePriorShort.map((point) => point.leadHours));
  const priorEfficiency = priorAvgLead > 0 ? clamp(priorAvgActive / Math.max(1e-6, priorAvgLead), 0, 1) : 0;

  const efficiency = {
    efficiency: efficiencyValue,
    avgActiveHours,
    avgLeadHours,
    deltaPct: deltaPct(shortEfficiency, priorEfficiency),
  };

  const stageDwell = computeStageDwellStats({
    timelines,
    zones: input.zones,
  });

  const trends = computeTrendStats({
    timelines,
    now: input.now,
    shortDays,
  });

  const baseSnapshot: FlowMetricsSnapshot = {
    window,
    leadTime,
    cycleTime,
    throughput,
    efficiency,
    stageDwell,
    trends,
    anomalies: [],
    recentDoneItemIds: [...doneLookback]
      .sort((left, right) => {
        if (right.doneAt.getTime() !== left.doneAt.getTime()) {
          return right.doneAt.getTime() - left.doneAt.getTime();
        }
        return left.itemId.localeCompare(right.itemId);
      })
      .slice(0, 10)
      .map((point) => point.itemId),
  };

  return {
    ...baseSnapshot,
    anomalies: computeAnomalies(baseSnapshot),
  };
}
