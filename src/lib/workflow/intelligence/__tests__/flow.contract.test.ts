import { describe, expect, it } from "vitest";

import { computeWorkflowSignals } from "../signals";
import { FIXED_NOW, POLICY_WITH_SLA, makeEventStream, makeItem } from "./fixtures";

describe("flow control contract", () => {
  it("classifies stage WIP with soft, hard and critical thresholds", () => {
    const signals = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "s1", stageId: "review" }),
        makeItem({ id: "s2", stageId: "review" }),
        makeItem({ id: "s3", stageId: "review" }),
      ],
    });

    expect(signals.stageWip.review.severity).toBe("hard");

    const critical = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "c1", stageId: "review" }),
        makeItem({ id: "c2", stageId: "review" }),
        makeItem({ id: "c3", stageId: "review" }),
        makeItem({ id: "c4", stageId: "review" }),
      ],
    });

    expect(critical.stageWip.review.severity).toBe("critical");
  });

  it("propagates overload pressure upstream from overloaded stages", () => {
    const signals = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "o1", stageId: "review" }),
        makeItem({ id: "o2", stageId: "review" }),
        makeItem({ id: "o3", stageId: "review" }),
        makeItem({ id: "o4", stageId: "review" }),
      ],
    });

    expect(signals.stageWip.review.severity).toBe("critical");
    expect(signals.propagatedPressure.draft).toBeGreaterThan(0);
  });

  it("increases bottleneck index when flow pressure worsens", () => {
    const balanced = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "b1", stageId: "draft" }),
        makeItem({ id: "b2", stageId: "review" }),
        makeItem({ id: "b3", stageId: "approved" }),
      ],
    });

    const overloaded = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "p1", stageId: "review", stageEnteredAt: "2026-02-10T10:00:00.000Z", updatedAt: "2026-02-10T10:00:00.000Z" }),
        makeItem({ id: "p2", stageId: "review", stageEnteredAt: "2026-02-10T09:00:00.000Z", updatedAt: "2026-02-10T09:00:00.000Z" }),
        makeItem({ id: "p3", stageId: "review", stageEnteredAt: "2026-02-10T08:00:00.000Z", updatedAt: "2026-02-10T08:00:00.000Z" }),
        makeItem({ id: "p4", stageId: "review", stageEnteredAt: "2026-02-10T07:00:00.000Z", updatedAt: "2026-02-10T07:00:00.000Z" }),
      ],
    });

    expect(overloaded.bottleneckIndex.score).toBeGreaterThanOrEqual(balanced.bottleneckIndex.score);
  });

  it("reduces low-throughput penalty when stage inflow improves", () => {
    const lowInflow = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "t1", stageId: "review" }),
        makeItem({ id: "t2", stageId: "approved" }),
      ],
      events: makeEventStream([
        { itemId: "t1", occurredAt: "2026-02-14T12:00:00.000Z", fromStageId: "draft", toStageId: "review" },
        { itemId: "t2", occurredAt: "2026-02-14T12:30:00.000Z", fromStageId: "review", toStageId: "approved" },
      ]),
    });

    const improvedInflow = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "u1", stageId: "review" }),
        makeItem({ id: "u2", stageId: "approved" }),
      ],
      events: makeEventStream([
        { itemId: "u1", occurredAt: "2026-02-14T12:00:00.000Z", fromStageId: "draft", toStageId: "review" },
        { itemId: "u1", occurredAt: "2026-02-14T12:20:00.000Z", fromStageId: "review", toStageId: "approved" },
        { itemId: "u3", occurredAt: "2026-02-14T13:00:00.000Z", fromStageId: "draft", toStageId: "review" },
        { itemId: "u4", occurredAt: "2026-02-14T14:00:00.000Z", fromStageId: "draft", toStageId: "review" },
      ]),
    });

    expect(improvedInflow.bottleneckIndex.lowThroughputPenalty).toBeLessThanOrEqual(lowInflow.bottleneckIndex.lowThroughputPenalty);
  });

  it("is deterministic and invariant to item order", () => {
    const a = makeItem({ id: "x1", stageId: "review", stageEnteredAt: "2026-02-14T10:00:00.000Z" });
    const b = makeItem({ id: "x2", stageId: "approved", stageEnteredAt: "2026-02-14T09:00:00.000Z" });
    const c = makeItem({ id: "x3", stageId: "draft", stageEnteredAt: "2026-02-14T11:00:00.000Z" });

    const first = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [a, b, c],
      includePerItem: true,
    });

    const second = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [c, a, b],
      includePerItem: true,
    });

    expect(second).toEqual(first);
  });
});
