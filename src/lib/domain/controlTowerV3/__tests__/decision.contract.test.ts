import { describe, expect, it } from "vitest";

import { SCENARIOS } from "../__fixtures__/scenarios";
import { NOW } from "../__fixtures__/now";
import { buildDecisionSnapshot } from "../decision-engine";
import { computeFeedbackEffects } from "../feedback/effects";
import { finalizeDecisionSnapshot } from "../hardening/finalize";
import {
  expectContainsIntent,
  expectHealthRange,
  expectNotContainsIntent,
  expectState,
  expectValidSnapshot,
  expectWarningsContain,
} from "./helpers/assertions";

describe("decision contract", () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const effects = computeFeedbackEffects({
        outcomes: scenario.outcomes ?? [],
        now: NOW,
      });

      const snapshot = finalizeDecisionSnapshot(
        buildDecisionSnapshot(scenario.input, {
          feedbackEffects: effects,
        }),
      );

      expectValidSnapshot(snapshot);

      if (scenario.expect.state) {
        expectState(snapshot, scenario.expect.state);
      }

      if (scenario.expect.riskLevel) {
        expect(snapshot.riskLevel).toBe(scenario.expect.riskLevel);
      }

      if (scenario.expect.healthScoreRange) {
        expectHealthRange(snapshot, scenario.expect.healthScoreRange);
      }

      if (scenario.expect.mustHaveIntents) {
        for (const intent of scenario.expect.mustHaveIntents) {
          expectContainsIntent(snapshot.actionCards, intent);
        }
      }

      if (scenario.expect.mustNotHaveIntents) {
        for (const intent of scenario.expect.mustNotHaveIntents) {
          expectNotContainsIntent(snapshot.actionCards, intent);
        }
      }

      if (typeof scenario.expect.maxActions === "number") {
        expect(snapshot.actionCards.length).toBeLessThanOrEqual(scenario.expect.maxActions);
      }

      if (scenario.expect.warningsContainCodes) {
        expectWarningsContain(snapshot, scenario.expect.warningsContainCodes);
      }
    });
  }
});
