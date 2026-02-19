import type { OutcomeEvent } from "./types";

export type FeedbackEffects = {
  suppressedIntents: Set<string>;
  intentBoosts: Record<string, number>;
  recentWins: Array<{ intent: string; occurredAt: string; outcome: string }>;
};

function groupByIntent(outcomes: OutcomeEvent[]): Map<string, OutcomeEvent[]> {
  const grouped = new Map<string, OutcomeEvent[]>();

  for (const event of outcomes) {
    const existing = grouped.get(event.intent) ?? [];
    existing.push(event);
    grouped.set(event.intent, existing);
  }

  for (const events of grouped.values()) {
    events.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  }

  return grouped;
}

function withinHours(event: OutcomeEvent, nowMs: number, hours: number): boolean {
  const eventMs = new Date(event.occurredAt).getTime();
  if (!Number.isFinite(eventMs)) {
    return false;
  }
  return nowMs - eventMs <= hours * 60 * 60 * 1000;
}

function optimizationIntentForCompleted(intent: string): string | null {
  if (intent === "fix_overdue_publications" || intent === "resolve_approval_bottleneck" || intent === "unblock_stuck_workflow") {
    return "optimize_throughput";
  }

  if (intent === "fill_pipeline_gap" || intent === "schedule_next_7_days" || intent === "reduce_draft_backlog") {
    return "review_risks";
  }

  return null;
}

export function computeFeedbackEffects(params: { outcomes: OutcomeEvent[]; now: Date }): FeedbackEffects {
  const nowMs = params.now.getTime();
  const suppressedIntents = new Set<string>();
  const intentBoosts: Record<string, number> = {};
  const grouped = groupByIntent(params.outcomes);

  for (const [intent, events] of grouped.entries()) {
    const completed6h = events.filter((event) => event.outcome === "completed" && withinHours(event, nowMs, 6));
    if (completed6h.length > 0) {
      suppressedIntents.add(intent);
    }

    const abandoned24h = events.filter((event) => event.outcome === "abandoned" && withinHours(event, nowMs, 24)).length;
    if (abandoned24h >= 2) {
      intentBoosts[intent] = (intentBoosts[intent] ?? 0) - 15;
    }

    const ignored24h = events.filter((event) => event.outcome === "ignored" && withinHours(event, nowMs, 24)).length;
    if (ignored24h >= 2) {
      intentBoosts[intent] = (intentBoosts[intent] ?? 0) - 5;
    }

    const completed24h = events.filter((event) => event.outcome === "completed" && withinHours(event, nowMs, 24)).length;
    if (completed24h >= 2) {
      const optimizationIntent = optimizationIntentForCompleted(intent);
      if (optimizationIntent) {
        intentBoosts[optimizationIntent] = (intentBoosts[optimizationIntent] ?? 0) + 5;
      }
    }
  }

  const recentWins = params.outcomes
    .filter((event) => event.outcome === "completed" && withinHours(event, nowMs, 48))
    .sort((left, right) => {
      const timeCompare = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
      if (timeCompare !== 0) {
        return timeCompare;
      }
      return left.intent.localeCompare(right.intent);
    })
    .slice(0, 5)
    .map((event) => ({ intent: event.intent, occurredAt: event.occurredAt, outcome: event.outcome }));

  return {
    suppressedIntents,
    intentBoosts,
    recentWins,
  };
}
