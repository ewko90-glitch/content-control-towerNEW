import type { CanonicalIntentParams } from "./intentCanonicalizer";

export type ContentIntentState = {
  mode: "kanban" | "list";
  lane?: string;
  filters: {
    filterKey?: string;
    stageKey?: string;
    overdue?: boolean;
    sinceDays?: number;
  };
  focusIds?: string[];
};

export type CalendarIntentState = {
  mode: "next7days" | "week" | "month";
  filters: {
    overdue?: boolean;
    sinceDays?: number;
  };
  focusIds?: string[];
};

function hasIntentPayload(canonical: CanonicalIntentParams): boolean {
  return Boolean(
    canonical.intent ||
      canonical.filter ||
      canonical.stage ||
      typeof canonical.overdue === "boolean" ||
      typeof canonical.sinceDays === "number" ||
      (canonical.ids?.length ?? 0) > 0,
  );
}

function contentDefaultsFromIntent(intent: CanonicalIntentParams["intent"]): { mode: "kanban" | "list"; lane?: string; filterKey?: string; stageKey?: string } {
  if (intent === "resolve_approval_bottleneck") {
    return { mode: "kanban", lane: "REVIEW", filterKey: "approval_pending", stageKey: "REVIEW" };
  }
  if (intent === "unblock_stuck_workflow") {
    return { mode: "kanban", lane: "REVIEW", filterKey: "stuck", stageKey: "REVIEW" };
  }
  if (intent === "fill_pipeline_gap") {
    return { mode: "kanban", lane: "DRAFT", filterKey: "draft", stageKey: "DRAFT" };
  }
  if (intent === "reduce_draft_backlog") {
    return { mode: "kanban", lane: "DRAFT", filterKey: "draft_backlog", stageKey: "DRAFT" };
  }
  if (intent === "fix_overdue_publications") {
    return { mode: "list", filterKey: "overdue" };
  }
  if (intent === "schedule_next_7_days") {
    return { mode: "list", filterKey: "schedule_next_7_days", stageKey: "SCHEDULED" };
  }
  if (intent === "optimize_throughput") {
    return { mode: "list", filterKey: "throughput" };
  }
  if (intent === "review_risks") {
    return { mode: "list", filterKey: "risks" };
  }

  return { mode: "kanban" };
}

function calendarDefaultsFromIntent(intent: CanonicalIntentParams["intent"]): CalendarIntentState["mode"] {
  if (intent === "schedule_next_7_days") {
    return "next7days";
  }
  if (intent === "fix_overdue_publications") {
    return "week";
  }
  if (intent === "review_risks") {
    return "week";
  }
  return "week";
}

export function resolveContentIntentState(canonical: CanonicalIntentParams): ContentIntentState | null {
  if (!hasIntentPayload(canonical)) {
    return null;
  }

  const defaults = contentDefaultsFromIntent(canonical.intent);

  return {
    mode: defaults.mode,
    lane: defaults.lane,
    filters: {
      filterKey: canonical.filter ?? defaults.filterKey,
      stageKey: canonical.stage ?? defaults.stageKey,
      overdue: canonical.overdue,
      sinceDays: canonical.sinceDays,
    },
    focusIds: canonical.ids,
  };
}

export function resolveCalendarIntentState(canonical: CanonicalIntentParams): CalendarIntentState | null {
  if (!hasIntentPayload(canonical)) {
    return null;
  }

  return {
    mode: calendarDefaultsFromIntent(canonical.intent),
    filters: {
      overdue: canonical.overdue,
      sinceDays: canonical.sinceDays,
    },
    focusIds: canonical.ids,
  };
}
