import { durationStats } from "./percentiles";
import type { ItemTimeline, StageDwellStats, WorkflowZonePolicy } from "./types";

type StageAggregate = {
  stageId: string;
  zone: "queue" | "active" | "done";
  dwellValues: number[];
  leadShareValues: number[];
};

function zoneOrder(zone: "queue" | "active" | "done"): number {
  if (zone === "queue") {
    return 0;
  }
  if (zone === "active") {
    return 1;
  }
  return 2;
}

export function computeStageDwellStats(params: {
  timelines: ItemTimeline[];
  zones: WorkflowZonePolicy;
}): StageDwellStats[] {
  const byStage = new Map<string, StageAggregate>();

  for (const timeline of params.timelines) {
    if (!timeline.firstDoneAt || !timeline.leadHours || timeline.leadHours <= 0) {
      continue;
    }

    const doneAt = new Date(timeline.firstDoneAt);
    for (const segment of timeline.segments) {
      const entered = new Date(segment.enteredAt);
      if (entered.getTime() >= doneAt.getTime()) {
        continue;
      }

      const exited = segment.exitedAt ? new Date(segment.exitedAt) : doneAt;
      const boundedExit = exited.getTime() > doneAt.getTime() ? doneAt : exited;
      const boundedHours = Math.max(0, (boundedExit.getTime() - entered.getTime()) / 3600000);
      const stageId = segment.stageId;
      const zone = params.zones.zoneByStageId[stageId] ?? segment.zone;

      const current = byStage.get(stageId) ?? {
        stageId,
        zone,
        dwellValues: [],
        leadShareValues: [],
      };

      current.zone = zone;
      current.dwellValues.push(boundedHours);
      current.leadShareValues.push(Math.max(0, boundedHours / timeline.leadHours));
      byStage.set(stageId, current);
    }
  }

  const output: StageDwellStats[] = Array.from(byStage.values()).map((entry) => {
    const stats = durationStats(entry.dwellValues);
    const avgLeadShare =
      entry.leadShareValues.length > 0
        ? entry.leadShareValues.reduce((acc, value) => acc + value, 0) / entry.leadShareValues.length
        : 0;

    return {
      stageId: entry.stageId,
      zone: entry.zone,
      count: stats.count,
      avgDwellHours: stats.avgHours,
      p50DwellHours: stats.p50Hours,
      p90DwellHours: stats.p90Hours,
      avgLeadShare,
    };
  });

  output.sort((left, right) => {
    const leftZone = zoneOrder(left.zone);
    const rightZone = zoneOrder(right.zone);
    if (leftZone !== rightZone) {
      return leftZone - rightZone;
    }
    if (right.avgLeadShare !== left.avgLeadShare) {
      return right.avgLeadShare - left.avgLeadShare;
    }
    return left.stageId.localeCompare(right.stageId);
  });

  return output;
}
