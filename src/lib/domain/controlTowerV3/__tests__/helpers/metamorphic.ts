import { expect } from "vitest";

import { buildDecisionSnapshot } from "../../decision-engine";
import { finalizeDecisionSnapshot } from "../../hardening/finalize";
import type { ControlTowerInput } from "../../types";
import { permuteInputCollections } from "../../__fixtures__/builders";

function snapshot(input: ControlTowerInput) {
  return finalizeDecisionSnapshot(buildDecisionSnapshot(input));
}

export function expectScoreNonIncreasingWhenAddingOverdue(baseInput: ControlTowerInput): void {
  const base = snapshot(baseInput);
  const next = snapshot({
    ...baseInput,
    overduePublicationsCount: (baseInput.overduePublicationsCount ?? 0) + 1,
    overdueCount: (baseInput.overdueCount ?? baseInput.overduePublicationsCount ?? 0) + 1,
  });

  expect(next.healthScore).toBeLessThanOrEqual(base.healthScore);
}

export function expectScoreNonDecreasingWhenRemovingOverdue(baseInput: ControlTowerInput): void {
  const base = snapshot(baseInput);
  const next = snapshot({
    ...baseInput,
    overduePublicationsCount: Math.max(0, (baseInput.overduePublicationsCount ?? 0) - 1),
    overdueCount: Math.max(0, (baseInput.overdueCount ?? baseInput.overduePublicationsCount ?? 0) - 1),
  });

  expect(next.healthScore).toBeGreaterThanOrEqual(base.healthScore);
}

export function expectPermutationInvariance(input: ControlTowerInput): void {
  const base = snapshot(input);
  const permuted = snapshot(permuteInputCollections(input));

  const project = (entry: ReturnType<typeof snapshot>) => ({
    state: entry.state,
    riskLevel: entry.riskLevel,
    healthScore: entry.healthScore,
    intents: entry.actionCards.map((card) => card.intent),
    warnings: entry.warnings.map((warning) => warning.code).sort((left, right) => left.localeCompare(right)),
  });

  expect(project(permuted)).toStrictEqual(project(base));
}

export function expectDeterminism(input: ControlTowerInput): void {
  const first = snapshot(input);
  const second = snapshot(input);
  expect(second).toStrictEqual(first);
}
