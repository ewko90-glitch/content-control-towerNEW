import { describe, expect, it } from "vitest";

import { generateStrategicMoves, getIsoWeekKey, stableHash } from "../moves";
import { getOrGenerateWeeklyMoves } from "../movesStore";
import type { StrategicAlignmentResult, StrategicArtifact } from "../types";

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

function alignment(overrides: Partial<StrategicAlignmentResult>): StrategicAlignmentResult {
  return {
    alignmentScore: overrides.alignmentScore ?? 70,
    confidence: overrides.confidence ?? "medium",
    driftDetected: overrides.driftDetected ?? false,
    driftReason: overrides.driftReason,
    topAligned: overrides.topAligned ?? [],
    topMisaligned: overrides.topMisaligned ?? [],
    recommendedCorrections: overrides.recommendedCorrections ?? [],
    diagnostics: overrides.diagnostics ?? {
      inputs: { artifacts: 3, actions: 8, outcomes: 2 },
      notes: [],
    },
  };
}

describe("strategic moves", () => {
  it("always returns 3 moves", () => {
    const moves = generateStrategicMoves({
      workspaceId: "w1",
      nowIso: "2026-02-16T00:00:00.000Z",
      artifacts: [artifact({ id: "p1", type: "priority" })],
      alignment: alignment({}),
      recentActions: [{ createdAt: "2026-02-15T00:00:00.000Z", title: "action" }],
      outcomes: [],
    });

    expect(moves).toHaveLength(3);
    expect(moves.map((move) => move.kind)).toStrictEqual(["focus", "stability", "optimization"]);
  });

  it("is deterministic for same input", () => {
    const payload = {
      workspaceId: "w1",
      nowIso: "2026-02-16T00:00:00.000Z",
      artifacts: [artifact({ id: "p1", type: "priority", title: "Priority" })],
      alignment: alignment({ alignmentScore: 72 }),
      recentActions: [{ createdAt: "2026-02-15T00:00:00.000Z", title: "action" }],
      outcomes: [],
    };

    const first = generateStrategicMoves(payload);
    const second = generateStrategicMoves(payload);

    expect(second).toStrictEqual(first);
  });

  it("drift mode sets stability close-open-loops title", () => {
    const moves = generateStrategicMoves({
      workspaceId: "w1",
      nowIso: "2026-02-16T00:00:00.000Z",
      artifacts: [artifact({ id: "p1", type: "priority" })],
      alignment: alignment({ driftDetected: true, alignmentScore: 48 }),
      recentActions: [{ createdAt: "2026-02-15T00:00:00.000Z", title: "action" }],
      outcomes: [],
    });

    const stability = moves.find((move) => move.kind === "stability");
    expect(stability?.title).toContain("close open loops");
  });

  it("no priorities creates define-priority focus move", () => {
    const moves = generateStrategicMoves({
      workspaceId: "w1",
      nowIso: "2026-02-16T00:00:00.000Z",
      artifacts: [artifact({ id: "h1", type: "hypothesis" })],
      alignment: alignment({}),
      recentActions: [{ createdAt: "2026-02-15T00:00:00.000Z", title: "action" }],
      outcomes: [],
    });

    const focus = moves.find((move) => move.kind === "focus");
    expect(focus?.title).toContain("Define one strategic priority");
  });

  it("high alignment uses optimize-leverage optimization move", () => {
    const moves = generateStrategicMoves({
      workspaceId: "w1",
      nowIso: "2026-02-16T00:00:00.000Z",
      artifacts: [artifact({ id: "p1", type: "priority" })],
      alignment: alignment({ alignmentScore: 85, driftDetected: false, confidence: "high" }),
      recentActions: [
        { createdAt: "2026-02-15T00:00:00.000Z", title: "action" },
        { createdAt: "2026-02-14T00:00:00.000Z", title: "action" },
        { createdAt: "2026-02-13T00:00:00.000Z", title: "action" },
        { createdAt: "2026-02-12T00:00:00.000Z", title: "action" },
        { createdAt: "2026-02-11T00:00:00.000Z", title: "action" },
      ],
      outcomes: [],
    });

    const optimization = moves.find((move) => move.kind === "optimization");
    expect(optimization?.title).toContain("Optimize leverage");
  });

  it("store ids stay stable for same input", async () => {
    const nowIso = "2026-02-16T00:00:00.000Z";
    const weekKey = getIsoWeekKey(nowIso);

    const payload = {
      workspaceId: `w-stable-${stableHash(weekKey)}`,
      nowIso,
      artifacts: [artifact({ id: "p1", type: "priority", title: "Priority" })],
      alignment: alignment({ alignmentScore: 70 }),
      recentActions: [{ createdAt: "2026-02-15T00:00:00.000Z", title: "action" }],
      outcomes: [],
    };

    const first = await getOrGenerateWeeklyMoves(payload);
    const second = await getOrGenerateWeeklyMoves(payload);

    expect(second.map((move) => move.id)).toStrictEqual(first.map((move) => move.id));
  });
});
