import { describe, expect, it } from "vitest";

import { SCENARIOS } from "../__fixtures__/scenarios";
import { NOW } from "../__fixtures__/now";
import { buildDecisionSnapshot } from "../decision-engine";
import { computeFeedbackEffects } from "../feedback/effects";
import { finalizeDecisionSnapshot } from "../hardening/finalize";

const TARGETS = ["MIXED_RISKS_OVERDUE_STUCK_APPROVALS", "OVERDUE_5_HIGH", "APPROVAL_BOTTLENECK"];

describe("decision determinism", () => {
  for (const name of TARGETS) {
    it(`is deterministic for ${name}`, () => {
      const scenario = SCENARIOS.find((entry) => entry.name === name);
      expect(scenario).toBeDefined();
      if (!scenario) {
        return;
      }

      const outputs = Array.from({ length: 5 }, () => {
        const effects = computeFeedbackEffects({
          outcomes: scenario.outcomes ?? [],
          now: NOW,
        });

        return finalizeDecisionSnapshot(
          buildDecisionSnapshot(scenario.input, {
            feedbackEffects: effects,
          }),
        );
      });

      for (const output of outputs) {
        expect(output).toStrictEqual(outputs[0]);
      }

      const actionIds = outputs[0].actionCards.map((action) => action.id);
      const uniqueActionIds = new Set(actionIds);
      expect(uniqueActionIds.size).toBe(actionIds.length);
    });
  }
});
