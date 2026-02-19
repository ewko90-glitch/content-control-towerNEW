import type { WorkflowPolicy, WorkflowStageId } from "../types";
import type { SlaStatus, StageHealth, StuckStatus, WorkflowItem } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeStageHealth(params: {
  policy: WorkflowPolicy;
  items: WorkflowItem[];
  sla: SlaStatus[];
  stuck: StuckStatus[];
}): Record<WorkflowStageId, StageHealth> {
  const byStageCount: Record<WorkflowStageId, number> = Object.fromEntries(params.policy.stages.map((stage) => [stage.id, 0])) as Record<
    WorkflowStageId,
    number
  >;
  for (const item of params.items) {
    byStageCount[item.stageId] = (byStageCount[item.stageId] ?? 0) + 1;
  }

  const byStageSla = new Map<WorkflowStageId, { warning: number; breach: number; critical: number; sum: number; count: number }>();
  for (const status of params.sla) {
    const current = byStageSla.get(status.stageId) ?? { warning: 0, breach: 0, critical: 0, sum: 0, count: 0 };
    if (status.severity === "warning") {
      current.warning += 1;
    } else if (status.severity === "breach") {
      current.breach += 1;
    } else if (status.severity === "critical") {
      current.critical += 1;
    }
    current.sum += status.severityScore;
    current.count += 1;
    byStageSla.set(status.stageId, current);
  }

  const byStageStuck = new Map<WorkflowStageId, { stuck: number; critical: number }>();
  for (const status of params.stuck) {
    const current = byStageStuck.get(status.stageId) ?? { stuck: 0, critical: 0 };
    current.stuck += 1;
    if (status.severity === "critical") {
      current.critical += 1;
    }
    byStageStuck.set(status.stageId, current);
  }

  const output: Record<WorkflowStageId, StageHealth> = {} as Record<WorkflowStageId, StageHealth>;
  for (const stage of params.policy.stages) {
    const sla = byStageSla.get(stage.id) ?? { warning: 0, breach: 0, critical: 0, sum: 0, count: 0 };
    const stuck = byStageStuck.get(stage.id) ?? { stuck: 0, critical: 0 };
    const avgSeverityScore = sla.count > 0 ? sla.sum / sla.count : 0;

    const healthScore = clamp(
      Math.round(
        100 -
          (sla.critical * 12 +
            sla.breach * 6 +
            sla.warning * 2 +
            stuck.critical * 15 +
            stuck.stuck * 7 +
            avgSeverityScore / 10),
      ),
      0,
      100,
    );

    output[stage.id] = {
      stageId: stage.id,
      count: byStageCount[stage.id] ?? 0,
      sla: {
        warning: sla.warning,
        breach: sla.breach,
        critical: sla.critical,
        avgSeverityScore,
      },
      stuck,
      healthScore,
    };
  }

  return output;
}

export function getWorstStages(stageHealth: Record<string, StageHealth>, topN: number): string[] {
  return Object.values(stageHealth)
    .sort((left, right) => {
      if (left.healthScore !== right.healthScore) {
        return left.healthScore - right.healthScore;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.stageId.localeCompare(right.stageId);
    })
    .slice(0, Math.max(0, topN))
    .map((entry) => entry.stageId);
}
