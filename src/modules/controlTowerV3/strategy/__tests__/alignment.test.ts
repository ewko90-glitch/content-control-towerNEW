import { describe, expect, it } from "vitest";
import type { OutcomeEvent } from "@/lib/domain/controlTowerV3/feedback/types";
import type { StrategicArtifact, StrategicAlignmentInput, StrategicActionLike } from "../types";
import { computeStrategicAlignment } from "../alignment";

function artifact(overrides: Partial<StrategicArtifact>): StrategicArtifact {
  return {
    id: overrides.id ?? "a1",
    workspaceId: overrides.workspaceId ?? "w1",
    type: overrides.type ?? "priority",
    title: overrides.title ?? "Weekly content cadence",
    description: overrides.description ?? "desc",
    status: overrides.status ?? "active",
    intent: overrides.intent ?? "Ship cadence",
    successMetric: overrides.successMetric,
    owner: overrides.owner,
    horizon: overrides.horizon ?? "this_quarter",
    tags: overrides.tags,
    createdAt: overrides.createdAt ?? "2026-02-01T00:00:00.000Z",
    createdBy: overrides.createdBy ?? "system",
    updatedAt: overrides.updatedAt,
    archivedAt: overrides.archivedAt,
  };
}

function action(index: number, title: string): StrategicActionLike {
  return {
    id: `act-${index}`,
    title,
    type: "task",
    kind: "execution",
    status: "open",
    createdAt: "2026-02-10T00:00:00.000Z",
  };
}

function outcome(overrides: Partial<OutcomeEvent>): OutcomeEvent {
  return {
    workspaceId: "w1",
    sessionId: overrides.sessionId ?? "s1",
    intent: overrides.intent ?? "cadence",
    occurredAt: overrides.occurredAt ?? "2026-02-12T00:00:00.000Z",
    outcome: overrides.outcome ?? "completed",
    evidence: overrides.evidence ?? { kind: "explicit_action", details: "cadence improved" },
  };
}

function input(partial: Partial<StrategicAlignmentInput>): StrategicAlignmentInput {
  return {
    artifacts: partial.artifacts ?? [],
    recentActions: partial.recentActions ?? [],
    outcomes: partial.outcomes ?? [],
    nowIso: partial.nowIso ?? "2026-02-16T00:00:00.000Z",
  };
}

describe("strategy alignment", () => {
  it("returns low score for empty artifacts with low confidence and no drift", () => {
    const result = computeStrategicAlignment(input({ recentActions: [action(1, "generic task")], outcomes: [] }));

    expect(result.confidence).toBe("low");
    expect(result.alignmentScore).toBeLessThan(45);
    expect(result.driftDetected).toBe(false);
  });

  it("scores high for matched priorities and actions", () => {
    const artifacts = [
      artifact({ id: "p1", title: "Weekly content cadence", intent: "publish weekly", tags: ["content", "cadence"] }),
      artifact({ id: "p2", title: "Approval discipline", intent: "faster review", tags: ["approval", "review"] }),
      artifact({ id: "p3", title: "Experiment backlog", intent: "run experiments", tags: ["experiment"] }),
    ];

    const actions = [
      action(1, "content cadence plan"),
      action(2, "weekly content review"),
      action(3, "publish cadence execution"),
      action(4, "approval review queue"),
      action(5, "review approval pipeline"),
      action(6, "approval discipline"),
      action(7, "experiment backlog review"),
      action(8, "content cadence calendar"),
      action(9, "weekly cadence publish"),
      action(10, "review cadence"),
    ];

    const result = computeStrategicAlignment(input({ artifacts, recentActions: actions, outcomes: [outcome({ outcome: "completed" })] }));

    expect(result.alignmentScore).toBeGreaterThan(80);
    expect(result.driftDetected).toBe(false);
    expect(result.confidence).toBe("high");
  });

  it("detects drift for unmatched actions", () => {
    const artifacts = [
      artifact({ id: "p1", title: "Weekly content cadence", intent: "publish weekly", tags: ["content"] }),
      artifact({ id: "p2", title: "Approval discipline", intent: "faster review", tags: ["approval"] }),
      artifact({ id: "p3", title: "Experiment backlog", intent: "run experiments", tags: ["experiment"] }),
    ];

    const actions = Array.from({ length: 10 }, (_, index) => action(index, `unrelated firefight ${index}`));
    const result = computeStrategicAlignment(input({ artifacts, recentActions: actions, outcomes: [] }));

    expect(result.alignmentScore).toBeLessThan(50);
    expect(result.driftDetected).toBe(true);
  });

  it("drops score and detects drift for matched negative outcomes", () => {
    const artifacts = [artifact({ id: "p1", title: "Cadence", intent: "cadence", tags: ["cadence"] })];
    const actions = Array.from({ length: 8 }, (_, index) => action(index, "cadence action"));
    const outcomes = [
      outcome({ sessionId: "s1", outcome: "ignored", evidence: { kind: "explicit_action", details: "cadence ignored" } }),
      outcome({ sessionId: "s2", outcome: "abandoned", evidence: { kind: "explicit_action", details: "cadence abandoned" } }),
    ];

    const result = computeStrategicAlignment(input({ artifacts, recentActions: actions, outcomes }));

    expect(result.driftDetected).toBe(true);
    expect(result.alignmentScore).toBeLessThanOrEqual(70);
  });

  it("is deterministic for same input", () => {
    const artifacts = [artifact({ id: "p1", title: "Cadence", intent: "cadence", tags: ["cadence"] })];
    const actions = Array.from({ length: 8 }, (_, index) => action(index, "cadence action"));
    const outcomes = [outcome({ outcome: "completed" })];

    const payload = input({ artifacts, recentActions: actions, outcomes });

    const first = computeStrategicAlignment(payload);
    const second = computeStrategicAlignment(payload);

    expect(second).toStrictEqual(first);
  });
});
