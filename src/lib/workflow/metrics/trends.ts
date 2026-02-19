import { clamp, percentile } from "./percentiles";
import type { ItemTimeline, TrendStats } from "./types";

type DonePoint = {
  itemId: string;
  doneAt: Date;
  leadHours: number;
  cycleHours: number;
  activeHours: number;
};

function donePoints(timelines: ItemTimeline[]): DonePoint[] {
  const points: DonePoint[] = [];

  for (const timeline of timelines) {
    if (!timeline.firstDoneAt) {
      continue;
    }

    const doneAt = new Date(timeline.firstDoneAt);
    if (Number.isNaN(doneAt.getTime())) {
      continue;
    }

    points.push({
      itemId: timeline.itemId,
      doneAt,
      leadHours: Math.max(0, timeline.leadHours ?? 0),
      cycleHours: Math.max(0, timeline.cycleHours ?? 0),
      activeHours: Math.max(0, timeline.activeHours ?? 0),
    });
  }

  return points.sort((left, right) => {
    if (left.doneAt.getTime() !== right.doneAt.getTime()) {
      return left.doneAt.getTime() - right.doneAt.getTime();
    }
    return left.itemId.localeCompare(right.itemId);
  });
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

function inRange(date: Date, start: Date, end: Date): boolean {
  const ms = date.getTime();
  return ms >= start.getTime() && ms < end.getTime();
}

export function computeTrendStats(params: {
  timelines: ItemTimeline[];
  now: Date;
  shortDays: number;
}): TrendStats {
  const shortDays = Math.max(1, Math.round(params.shortDays));
  const lookbackDays = Math.max(shortDays * 4, 1);

  const points = donePoints(params.timelines);
  const now = params.now;

  const shortStart = new Date(now.getTime() - shortDays * 24 * 3600000);
  const priorStart = new Date(now.getTime() - shortDays * 2 * 24 * 3600000);
  const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 3600000);

  const short = points.filter((point) => inRange(point.doneAt, shortStart, now));
  const prior = points.filter((point) => inRange(point.doneAt, priorStart, shortStart));
  const lookback = points.filter((point) => inRange(point.doneAt, lookbackStart, now));

  const shortLead = avg(short.map((point) => point.leadHours));
  const priorLead = avg(prior.map((point) => point.leadHours));
  const shortCycle = avg(short.map((point) => point.cycleHours));
  const priorCycle = avg(prior.map((point) => point.cycleHours));

  const shortThroughput = short.length;
  const priorThroughput = prior.length;

  const shortEfficiency = shortLead > 0 ? avg(short.map((point) => point.activeHours)) / shortLead : 0;
  const priorEfficiency = priorLead > 0 ? avg(prior.map((point) => point.activeHours)) / priorLead : 0;

  const leadP90 = percentile(lookback.map((point) => point.leadHours), 90);
  const leadP50 = percentile(lookback.map((point) => point.leadHours), 50);
  const volatilityScore = clamp(((leadP90 - leadP50) / Math.max(1, leadP50)) * 100, 0, 100);

  return {
    leadTimeDeltaPct: deltaPct(shortLead, priorLead),
    cycleTimeDeltaPct: deltaPct(shortCycle, priorCycle),
    throughputDeltaPct: deltaPct(shortThroughput, priorThroughput),
    efficiencyDeltaPct: deltaPct(shortEfficiency, priorEfficiency),
    volatilityScore,
  };
}
