import { describe, expect, it } from "vitest";

import { NOW } from "../__fixtures__/now";
import { computeFeedbackEffects } from "../feedback/effects";
import type { OutcomeEvent } from "../feedback/types";

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe("feedback effects", () => {
  it("suppresses completed intents in last 6h", () => {
    const outcomes: OutcomeEvent[] = [
      {
        workspaceId: "ws-test",
        sessionId: "a",
        intent: "fix_overdue_publications",
        occurredAt: hoursAgo(2),
        outcome: "completed",
        evidence: { kind: "state_change" },
      },
    ];

    const result = computeFeedbackEffects({ outcomes, now: NOW });
    expect(result.suppressedIntents.has("fix_overdue_publications")).toBe(true);
  });

  it("deprioritizes abandoned twice in 24h", () => {
    const outcomes: OutcomeEvent[] = [
      {
        workspaceId: "ws-test",
        sessionId: "a1",
        intent: "resolve_approval_bottleneck",
        occurredAt: hoursAgo(4),
        outcome: "abandoned",
        evidence: { kind: "navigation" },
      },
      {
        workspaceId: "ws-test",
        sessionId: "a2",
        intent: "resolve_approval_bottleneck",
        occurredAt: hoursAgo(10),
        outcome: "abandoned",
        evidence: { kind: "navigation" },
      },
    ];

    const result = computeFeedbackEffects({ outcomes, now: NOW });
    expect(result.intentBoosts.resolve_approval_bottleneck).toBe(-15);
  });

  it("applies mild penalty for repeated ignored", () => {
    const outcomes: OutcomeEvent[] = [
      {
        workspaceId: "ws-test",
        sessionId: "i1",
        intent: "unblock_stuck_workflow",
        occurredAt: hoursAgo(3),
        outcome: "ignored",
        evidence: { kind: "navigation" },
      },
      {
        workspaceId: "ws-test",
        sessionId: "i2",
        intent: "unblock_stuck_workflow",
        occurredAt: hoursAgo(5),
        outcome: "ignored",
        evidence: { kind: "navigation" },
      },
    ];

    const result = computeFeedbackEffects({ outcomes, now: NOW });
    expect(result.intentBoosts.unblock_stuck_workflow).toBe(-5);
  });

  it("returns top 5 recent wins sorted desc by time", () => {
    const outcomes: OutcomeEvent[] = Array.from({ length: 8 }, (_, index) => ({
      workspaceId: "ws-test",
      sessionId: `w-${index}`,
      intent: index % 2 === 0 ? "fix_overdue_publications" : "optimize_throughput",
      occurredAt: hoursAgo(index + 1),
      outcome: "completed" as const,
      evidence: { kind: "state_change" as const },
    }));

    const result = computeFeedbackEffects({ outcomes, now: NOW });
    expect(result.recentWins.length).toBe(5);

    for (let index = 1; index < result.recentWins.length; index += 1) {
      expect(new Date(result.recentWins[index - 1].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result.recentWins[index].occurredAt).getTime(),
      );
    }
  });

  it("is deterministic", () => {
    const outcomes: OutcomeEvent[] = [
      {
        workspaceId: "ws-test",
        sessionId: "d1",
        intent: "fill_pipeline_gap",
        occurredAt: hoursAgo(2),
        outcome: "completed",
        evidence: { kind: "state_change" },
      },
      {
        workspaceId: "ws-test",
        sessionId: "d2",
        intent: "fill_pipeline_gap",
        occurredAt: hoursAgo(8),
        outcome: "completed",
        evidence: { kind: "state_change" },
      },
    ];

    const first = computeFeedbackEffects({ outcomes, now: NOW });
    const second = computeFeedbackEffects({ outcomes, now: NOW });

    expect({
      suppressedIntents: [...first.suppressedIntents].sort((left, right) => left.localeCompare(right)),
      intentBoosts: first.intentBoosts,
      recentWins: first.recentWins,
    }).toStrictEqual({
      suppressedIntents: [...second.suppressedIntents].sort((left, right) => left.localeCompare(right)),
      intentBoosts: second.intentBoosts,
      recentWins: second.recentWins,
    });
  });
});
