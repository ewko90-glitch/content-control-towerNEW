import { expect } from "vitest";

import type { ControlTowerDecisionSnapshot } from "../../snapshot";

function isSnapshot(input: unknown): input is ControlTowerDecisionSnapshot {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as Partial<ControlTowerDecisionSnapshot>;
  return (
    typeof candidate.healthScore === "number" &&
    (candidate.riskLevel === "low" || candidate.riskLevel === "medium" || candidate.riskLevel === "high") &&
    Array.isArray(candidate.actionCards)
  );
}

function urgencyRank(urgency: "low" | "medium" | "high" | undefined): number {
  if (urgency === "high") {
    return 3;
  }
  if (urgency === "medium") {
    return 2;
  }
  return 1;
}

function isSorted(actions: ControlTowerDecisionSnapshot["actionCards"]): boolean {
  for (let index = 1; index < actions.length; index += 1) {
    const left = actions[index - 1];
    const right = actions[index];

    const urgencyDelta = urgencyRank(left.urgency) - urgencyRank(right.urgency);
    if (urgencyDelta < 0) {
      return false;
    }
    if (urgencyDelta > 0) {
      continue;
    }

    const priorityDelta = (left.executionPriority ?? 0) - (right.executionPriority ?? 0);
    if (priorityDelta < 0) {
      return false;
    }
    if (priorityDelta > 0) {
      continue;
    }

    const confidenceDelta = (left.confidence?.score ?? 0) - (right.confidence?.score ?? 0);
    if (confidenceDelta < 0) {
      return false;
    }
    if (confidenceDelta > 0) {
      continue;
    }

    if ((left.id ?? "").localeCompare(right.id ?? "") > 0) {
      return false;
    }
  }

  return true;
}

export function assertNoSensitiveDebug(snapshot: ControlTowerDecisionSnapshot): void {
  if (!snapshot.debug) {
    return;
  }

  const keys = Object.keys(snapshot.debug).sort((left, right) => left.localeCompare(right));
  expect(keys).toEqual(keys.filter((key) => key === "metrics" || key === "dimensions" || key === "deductions"));

  if (snapshot.debug.metrics) {
    for (const value of Object.values(snapshot.debug.metrics)) {
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    }
  }

  if (snapshot.debug.dimensions) {
    for (const value of Object.values(snapshot.debug.dimensions)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  }

  if (snapshot.debug.deductions) {
    for (const deduction of snapshot.debug.deductions) {
      expect(typeof deduction.code).toBe("string");
      expect(typeof deduction.points).toBe("number");
      if (typeof deduction.details === "string") {
        expect(deduction.details.includes("\n")).toBe(false);
        expect(deduction.details.length).toBeLessThanOrEqual(200);
      }
    }
  }
}

export function expectValidSnapshot(snapshot: unknown): asserts snapshot is ControlTowerDecisionSnapshot {
  expect(isSnapshot(snapshot)).toBe(true);
  if (!isSnapshot(snapshot)) {
    throw new Error("Invalid snapshot shape");
  }

  expect(snapshot.healthScore).toBeGreaterThanOrEqual(0);
  expect(snapshot.healthScore).toBeLessThanOrEqual(100);
  expect(["low", "medium", "high"]).toContain(snapshot.riskLevel);
  expect(typeof snapshot.schemaVersion).toBe("string");

  expect(snapshot.actionCards.length).toBeLessThanOrEqual(5);
  expect(Array.isArray(snapshot.warnings)).toBe(true);
  expect(Array.isArray(snapshot.riskFlags)).toBe(true);

  const dedupeKeys: string[] = [];

  for (const action of snapshot.actionCards) {
    expect(typeof action.id).toBe("string");
    expect((action.id ?? "").length).toBeGreaterThan(0);
    expect(typeof action.title).toBe("string");
    expect(action.title.length).toBeGreaterThan(0);
    expect(typeof action.description).toBe("string");
    expect(action.description.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(action.urgency);
    expect(typeof action.executionPriority).toBe("number");
    expect(Number.isFinite(action.executionPriority)).toBe(true);

    if (action.idempotency) {
      expect(typeof action.idempotency.dedupeKey).toBe("string");
      expect(action.idempotency.dedupeKey.length).toBeGreaterThan(0);
      dedupeKeys.push(action.idempotency.dedupeKey);
    }
  }

  const uniqueDedupeKeys = new Set(dedupeKeys);
  expect(uniqueDedupeKeys.size).toBe(dedupeKeys.length);
  expect(isSorted(snapshot.actionCards)).toBe(true);

  assertNoSensitiveDebug(snapshot);
}

export function expectContainsIntent(actions: ControlTowerDecisionSnapshot["actionCards"], intent: string): void {
  expect(actions.some((action) => action.intent === intent)).toBe(true);
}

export function expectNotContainsIntent(actions: ControlTowerDecisionSnapshot["actionCards"], intent: string): void {
  expect(actions.some((action) => action.intent === intent)).toBe(false);
}

export function expectWarningsContain(snapshot: ControlTowerDecisionSnapshot, codes: string[]): void {
  const set = new Set(snapshot.warnings.map((warning) => warning.code));
  for (const code of codes) {
    expect(set.has(code)).toBe(true);
  }
}

export function expectState(snapshot: ControlTowerDecisionSnapshot, state: ControlTowerDecisionSnapshot["state"]): void {
  expect(snapshot.state).toBe(state);
}

export function expectHealthRange(snapshot: ControlTowerDecisionSnapshot, range: [number, number]): void {
  expect(snapshot.healthScore).toBeGreaterThanOrEqual(range[0]);
  expect(snapshot.healthScore).toBeLessThanOrEqual(range[1]);
}
