import type { IntentType } from "../types";

export type IntentProgressCounts = {
  overdueCount: number;
  approvalsPendingCount: number;
  stuckCount: number;
  draftCount: number;
  upcomingScheduleCount: number;
};

export type CompletionEvaluation = {
  completed: boolean;
  details: string;
  changedCounts: Record<string, number>;
};

function safeNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export function encodeBaselineCounts(counts: IntentProgressCounts): Record<string, string> {
  return {
    baseline_overdue: String(safeNumber(counts.overdueCount)),
    baseline_approvals: String(safeNumber(counts.approvalsPendingCount)),
    baseline_stuck: String(safeNumber(counts.stuckCount)),
    baseline_draft: String(safeNumber(counts.draftCount)),
    baseline_schedule: String(safeNumber(counts.upcomingScheduleCount)),
  };
}

export function decodeBaselineCounts(input: Record<string, string> | undefined): IntentProgressCounts {
  const read = (key: string): number => {
    const raw = input?.[key];
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : 0;
  };

  return {
    overdueCount: read("baseline_overdue"),
    approvalsPendingCount: read("baseline_approvals"),
    stuckCount: read("baseline_stuck"),
    draftCount: read("baseline_draft"),
    upcomingScheduleCount: read("baseline_schedule"),
  };
}

export function evaluateIntentCompletion(params: {
  intent: IntentType;
  previous: IntentProgressCounts;
  current: IntentProgressCounts;
}): CompletionEvaluation {
  const changedCounts: Record<string, number> = {
    overdueDelta: params.current.overdueCount - params.previous.overdueCount,
    approvalsDelta: params.current.approvalsPendingCount - params.previous.approvalsPendingCount,
    stuckDelta: params.current.stuckCount - params.previous.stuckCount,
    draftDelta: params.current.draftCount - params.previous.draftCount,
    scheduleDelta: params.current.upcomingScheduleCount - params.previous.upcomingScheduleCount,
  };

  if (params.intent === "fix_overdue_publications") {
    return {
      completed: changedCounts.overdueDelta <= -1,
      details: "Overdue publications delta evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "resolve_approval_bottleneck") {
    return {
      completed: changedCounts.approvalsDelta <= -1,
      details: "Approvals pending delta evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "unblock_stuck_workflow") {
    return {
      completed: changedCounts.stuckDelta <= -1,
      details: "Stuck workflow delta evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "fill_pipeline_gap") {
    return {
      completed: changedCounts.draftDelta >= 1,
      details: "Draft pipeline growth evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "schedule_next_7_days") {
    return {
      completed: changedCounts.scheduleDelta >= 1,
      details: "Upcoming schedule coverage evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "reduce_draft_backlog") {
    return {
      completed: changedCounts.draftDelta <= -1,
      details: "Draft backlog reduction evaluated.",
      changedCounts,
    };
  }

  if (params.intent === "optimize_throughput" || params.intent === "review_risks") {
    return {
      completed: changedCounts.overdueDelta <= -1 || changedCounts.approvalsDelta <= -1 || changedCounts.stuckDelta <= -1,
      details: "General operational improvement evaluated.",
      changedCounts,
    };
  }

  return {
    completed: false,
    details: "No deterministic completion rule matched.",
    changedCounts,
  };
}
