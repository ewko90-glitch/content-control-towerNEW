import { describe, expect, it } from "vitest";

import { NOW, NOW_ISO } from "../__fixtures__/now";
import { makeInputBase, withOverduePublications, withPipeline, withStuckContent, withUpcomingPublicationsNext7Days } from "../__fixtures__/builders";
import { buildDecisionSnapshot } from "../decision-engine";
import { computeFeedbackEffects } from "../feedback/effects";
import { finalizeDecisionSnapshot } from "../hardening/finalize";
import { expectDeterminism, expectPermutationInvariance, expectScoreNonDecreasingWhenRemovingOverdue, expectScoreNonIncreasingWhenAddingOverdue } from "./helpers/metamorphic";

describe("decision metamorphic properties", () => {
  it("adding overdue cannot increase score", () => {
    const input = withOverduePublications(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 5, inProgress: 4 }), 4), 2);
    expectScoreNonIncreasingWhenAddingOverdue(input);
  });

  it("removing overdue cannot decrease score", () => {
    const input = withOverduePublications(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 5, inProgress: 4 }), 4), 3);
    expectScoreNonDecreasingWhenRemovingOverdue(input);
  });

  it("adding stuck content cannot increase score", () => {
    const base = withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 3, inProgress: 3 }), 3);
    const scoreBase = finalizeDecisionSnapshot(buildDecisionSnapshot(base)).healthScore;
    const scoreWithStuck = finalizeDecisionSnapshot(buildDecisionSnapshot(withStuckContent(base, 2))).healthScore;
    expect(scoreWithStuck).toBeLessThanOrEqual(scoreBase);
  });

  it("completed outcome within 6h suppresses intent", () => {
    const input = withOverduePublications(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 4, inProgress: 4 }), 4), 2);
    const effects = computeFeedbackEffects({
      now: NOW,
      outcomes: [
        {
          workspaceId: "ws-test",
          sessionId: "sess-4",
          intent: "fix_overdue_publications",
          occurredAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          outcome: "completed",
          evidence: {
            kind: "state_change",
          },
        },
      ],
    });

    const snapshot = finalizeDecisionSnapshot(
      buildDecisionSnapshot(
        {
          ...input,
          generatedAtISO: NOW_ISO,
        },
        { feedbackEffects: effects },
      ),
    );

    expect(snapshot.actionCards.some((action) => action.intent === "fix_overdue_publications")).toBe(false);
  });

  it("permutation invariance holds on key outputs", () => {
    const input = {
      ...withOverduePublications(withStuckContent(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 8, inProgress: 6 }), 3), 5), 4),
      approvalIds: ["b", "a", "c"],
      overduePublicationIds: ["2", "1", "3"],
      stuckContentIds: ["z", "x", "y"],
    };

    expectPermutationInvariance(input);
  });

  it("same input always produces identical snapshot", () => {
    const input = withStuckContent(withOverduePublications(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 7, inProgress: 4 }), 2), 3), 2);
    expectDeterminism(input);
  });
});
