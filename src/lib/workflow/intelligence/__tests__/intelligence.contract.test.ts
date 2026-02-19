import { describe, expect, it } from "vitest";

import { computeBottleneckLikelihood } from "../bottleneck";
import { computeStageHealth } from "../health";
import { evaluateSla } from "../sla";
import { computeWorkflowSignals } from "../signals";
import { detectStuck } from "../stuck";
import { computeTimeInStage } from "../time";
import { FIXED_NOW, POLICY_WITH_SLA, makeEventStream, makeItem } from "./fixtures";

describe("workflow intelligence contract", () => {
  it("uses stageEnteredAt over updatedAt for time-in-stage", () => {
    const result = computeTimeInStage({
      item: makeItem({
        id: "i1",
        stageId: "review",
        stageEnteredAt: "2026-02-15T08:00:00.000Z",
        updatedAt: "2026-02-15T10:00:00.000Z",
      }),
      now: FIXED_NOW,
    });

    expect(result.source).toBe("stageEnteredAt");
    expect(result.ageHours).toBeCloseTo(4, 6);
  });

  it("uses event stream when stageEnteredAt is missing", () => {
    const stream = makeEventStream([
      { itemId: "i2", occurredAt: "2026-02-15T05:00:00.000Z", fromStageId: "draft", toStageId: "review" },
      { itemId: "i2", occurredAt: "2026-02-15T09:00:00.000Z", fromStageId: "review", toStageId: "approved" },
    ]);

    const result = computeTimeInStage({
      item: makeItem({
        id: "i2",
        stageId: "approved",
        updatedAt: "2026-02-15T01:00:00.000Z",
      }),
      now: FIXED_NOW,
      eventsForItem: stream.byItemId.i2?.map((event) => ({ occurredAt: event.occurredAt, toStageId: event.toStageId })),
    });

    expect(result.source).toBe("eventStream");
    expect(result.ageHours).toBeCloseTo(3, 6);
  });

  it("evaluates SLA severities and clamps severity score", () => {
    const warning = evaluateSla({
      policy: POLICY_WITH_SLA,
      item: makeItem({ id: "w", stageId: "review" }),
      ageHours: 20,
    });
    const breach = evaluateSla({
      policy: POLICY_WITH_SLA,
      item: makeItem({ id: "b", stageId: "review" }),
      ageHours: 25,
    });
    const critical = evaluateSla({
      policy: POLICY_WITH_SLA,
      item: makeItem({ id: "c", stageId: "review" }),
      ageHours: 40,
    });

    expect(warning.severity).toBe("warning");
    expect(breach.severity).toBe("breach");
    expect(critical.severity).toBe("critical");
    expect(critical.severityScore).toBeLessThanOrEqual(100);
    expect(critical.severityScore).toBeGreaterThanOrEqual(0);
  });

  it("prioritizes sla_breach reason over overload in stuck detection", () => {
    const item = makeItem({ id: "s1", stageId: "review" });
    const sla = evaluateSla({
      policy: POLICY_WITH_SLA,
      item,
      ageHours: 30,
    });

    const stuck = detectStuck({
      policy: POLICY_WITH_SLA,
      item,
      ageHours: 30,
      sla,
      stageCount: 10,
      wipLimit: 2,
      hasOutgoingTransitions: true,
      isTerminal: false,
    });

    expect(stuck?.reason).toBe("sla_breach");
  });

  it("decreases stage health with critical stuck accumulation", () => {
    const baseItems = [makeItem({ id: "a", stageId: "review" })];
    const baseSla = [
      evaluateSla({
        policy: POLICY_WITH_SLA,
        item: baseItems[0],
        ageHours: 10,
      }),
    ];

    const lightHealth = computeStageHealth({
      policy: POLICY_WITH_SLA,
      items: baseItems,
      sla: baseSla,
      stuck: [],
    });

    const criticalStuck = [
      {
        itemId: "a",
        stageId: "review" as const,
        ageHours: 80,
        severity: "critical" as const,
        severityScore: 100,
        reason: "sla_breach" as const,
      },
    ];

    const heavyHealth = computeStageHealth({
      policy: POLICY_WITH_SLA,
      items: baseItems,
      sla: baseSla,
      stuck: criticalStuck,
    });

    expect(heavyHealth.review.healthScore).toBeLessThan(lightHealth.review.healthScore);
  });

  it("increases bottleneck likelihood when one stage is much worse", () => {
    const evenSignals = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "e1", stageId: "draft", updatedAt: "2026-02-15T10:00:00.000Z" }),
        makeItem({ id: "e2", stageId: "review", updatedAt: "2026-02-15T10:00:00.000Z" }),
      ],
    });

    const badSignals = computeWorkflowSignals({
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "b1", stageId: "draft", updatedAt: "2026-02-15T10:00:00.000Z" }),
        makeItem({ id: "b2", stageId: "review", stageEnteredAt: "2026-02-10T10:00:00.000Z", updatedAt: "2026-02-10T10:00:00.000Z" }),
        makeItem({ id: "b3", stageId: "review", stageEnteredAt: "2026-02-10T09:00:00.000Z", updatedAt: "2026-02-10T09:00:00.000Z" }),
      ],
    });

    expect(badSignals.bottleneck.likelihoodScore).toBeGreaterThanOrEqual(evenSignals.bottleneck.likelihoodScore);
  });

  it("returns deterministic output for identical input", () => {
    const input = {
      policy: POLICY_WITH_SLA,
      now: FIXED_NOW,
      items: [
        makeItem({ id: "d1", stageId: "review", stageEnteredAt: "2026-02-14T10:00:00.000Z", updatedAt: "2026-02-14T10:00:00.000Z" }),
        makeItem({ id: "d2", stageId: "approved", updatedAt: "2026-02-15T08:00:00.000Z" }),
      ],
      includePerItem: true as const,
    };

    const first = computeWorkflowSignals(input);
    const second = computeWorkflowSignals(input);
    expect(second).toEqual(first);
  });

  it("keeps bottleneck API deterministic with same stage health", () => {
    const stageHealth = computeStageHealth({
      policy: POLICY_WITH_SLA,
      items: [makeItem({ id: "z1", stageId: "review", updatedAt: "2026-02-14T00:00:00.000Z" })],
      sla: [evaluateSla({ policy: POLICY_WITH_SLA, item: makeItem({ id: "z1", stageId: "review" }), ageHours: 30 })],
      stuck: [],
    });

    const left = computeBottleneckLikelihood({ policy: POLICY_WITH_SLA, stageHealth });
    const right = computeBottleneckLikelihood({ policy: POLICY_WITH_SLA, stageHealth });
    expect(left).toEqual(right);
  });
});
