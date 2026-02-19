import { describe, expect, it } from "vitest";

import { computeWorkflowSignals } from "../signals";
import { FIXED_NOW, POLICY_WITH_SLA, makeItem } from "./fixtures";

describe("workflow intelligence metamorphic properties", () => {
  it("adding overdue age cannot reduce SLA pressure", () => {
    const base = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [makeItem({ id: "m1", stageId: "review", stageEnteredAt: "2026-02-15T00:00:00.000Z", updatedAt: "2026-02-15T00:00:00.000Z" })],
    });

    const older = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [makeItem({ id: "m1", stageId: "review", stageEnteredAt: "2026-02-14T23:00:00.000Z", updatedAt: "2026-02-14T23:00:00.000Z" })],
    });

    expect(older.sla.pressureScore).toBeGreaterThanOrEqual(base.sla.pressureScore);
  });

  it("removing one item from worst stage cannot worsen bottleneck likelihood", () => {
    const heavy = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "b1", stageId: "review", stageEnteredAt: "2026-02-10T10:00:00.000Z", updatedAt: "2026-02-10T10:00:00.000Z" }),
        makeItem({ id: "b2", stageId: "review", stageEnteredAt: "2026-02-10T09:00:00.000Z", updatedAt: "2026-02-10T09:00:00.000Z" }),
        makeItem({ id: "b3", stageId: "draft", updatedAt: "2026-02-15T09:00:00.000Z" }),
      ],
    });

    const lighter = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "b1", stageId: "review", stageEnteredAt: "2026-02-10T10:00:00.000Z", updatedAt: "2026-02-10T10:00:00.000Z" }),
        makeItem({ id: "b3", stageId: "draft", updatedAt: "2026-02-15T09:00:00.000Z" }),
      ],
    });

    expect(lighter.bottleneck.likelihoodScore).toBeLessThanOrEqual(heavy.bottleneck.likelihoodScore);
  });

  it("permuting item order does not change signals", () => {
    const items = [
      makeItem({ id: "p1", stageId: "draft", updatedAt: "2026-02-15T10:00:00.000Z" }),
      makeItem({ id: "p2", stageId: "review", stageEnteredAt: "2026-02-14T10:00:00.000Z", updatedAt: "2026-02-14T10:00:00.000Z" }),
      makeItem({ id: "p3", stageId: "approved", updatedAt: "2026-02-15T08:00:00.000Z" }),
    ];

    const left = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items,
      includePerItem: true,
    });
    const right = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [items[2], items[0], items[1]],
      includePerItem: true,
    });

    expect(right).toEqual(left);
  });

  it("increasing WIP above limit cannot improve stage health for that stage", () => {
    const base = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [makeItem({ id: "w1", stageId: "review", stageEnteredAt: "2026-02-14T12:00:00.000Z", updatedAt: "2026-02-14T12:00:00.000Z" })],
    });

    const overloaded = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "w1", stageId: "review", stageEnteredAt: "2026-02-14T12:00:00.000Z", updatedAt: "2026-02-14T12:00:00.000Z" }),
        makeItem({ id: "w2", stageId: "review", stageEnteredAt: "2026-02-14T11:00:00.000Z", updatedAt: "2026-02-14T11:00:00.000Z" }),
        makeItem({ id: "w3", stageId: "review", stageEnteredAt: "2026-02-14T10:00:00.000Z", updatedAt: "2026-02-14T10:00:00.000Z" }),
        makeItem({ id: "w4", stageId: "review", stageEnteredAt: "2026-02-14T09:00:00.000Z", updatedAt: "2026-02-14T09:00:00.000Z" }),
      ],
    });

    expect(overloaded.stages.stageHealth.review.healthScore).toBeLessThanOrEqual(base.stages.stageHealth.review.healthScore);
  });
});
