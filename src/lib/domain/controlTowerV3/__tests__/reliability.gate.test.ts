import { describe, expect, it } from "vitest";

import { finalizeDecisionSnapshot } from "../hardening/finalize";
import { normalizeDecisionSnapshot } from "../hardening/normalize";
import { sanitizeSnapshot } from "../hardening/sanitize";
import type { ControlTowerDecisionSnapshot } from "../snapshot";
import type { ActionCard, IntentType } from "../types";

function makeFallbackSnapshot(): ControlTowerDecisionSnapshot {
  return {
    schemaVersion: "ctv3.schema.1",
    decisionVersion: "ctv3.v1.5.hardening",
    state: "degraded",
    capabilities: {
      intents: true,
      feedback: true,
      targets: true,
      debug: false,
      policies: true,
      fingerprints: true,
    },
    warnings: [
      {
        code: "DEGRADED_INPUT",
        message: "Decision input is degraded.",
        severity: "high",
      },
    ],
    generatedAt: "2026-02-15T10:00:00.000Z",
    inputSummary: {
      contentCount: 0,
      publicationJobsCount: 0,
      approvalsCount: 0,
    },
    inputFingerprint: {
      value: "0",
      canonical: "c=0|p=0|a=0|od=0|st=0|ap=0|up=0",
      components: ["c", "p", "a", "od", "st", "ap", "up"],
    },
    healthScore: 55,
    riskLevel: "medium",
    riskFlags: [],
    priorityToday: {
      type: "fallback-refresh",
      message: "Verify data source and refresh dashboard.",
      severity: "low",
    },
    actionCards: [],
    reasoning: {
      scoreBreakdown: [],
      mainRiskDrivers: [],
      structuralSummary: "Fallback",
    },
  };
}

function makeAction(index: number, dedupeKey: string): ActionCard {
  const intent: IntentType = "review_risks";

  return {
    id: `a-${index}`,
    key: `a-${index}`,
    intent,
    type: "review" as const,
    actionType: "review" as const,
    urgency: index % 2 === 0 ? "high" as const : "medium" as const,
    executionPriority: 100 - index,
    severity: "warning" as const,
    title: `Action ${index}`,
    description: "Desc",
    why: "Why",
    impact: {
      score: 20,
      label: "Niski" as const,
    },
    confidence: {
      score: 0.5,
      label: "Średnia" as const,
    },
    cta: {
      label: "Open",
      href: "/overview",
    },
    permissions: {
      canExecute: true,
    },
    idempotency: {
      dedupeKey,
      cooldownSeconds: 43200,
    },
  };
}

describe("reliability gate", () => {
  it("sanitizer strips risky debug fields and emits DEBUG_STRIPPED", () => {
    const base = makeFallbackSnapshot();
    const dirty = {
      ...base,
      debug: {
        metrics: { x: 1 },
        payload: "should be removed",
        deductions: [
          {
            code: "OK",
            points: 10,
            details: "line1\nline2",
          },
        ],
      },
      diagnostics: {
        ...(base.diagnostics ?? {}),
        textLeak: "very secret",
      },
    } as unknown as ControlTowerDecisionSnapshot;

    const sanitized = sanitizeSnapshot({ snapshot: dirty });
    expect(sanitized.warnings.some((warning) => warning.code === "DEBUG_STRIPPED")).toBe(true);
    expect((sanitized.snapshot.debug as unknown as Record<string, unknown>).payload).toBeUndefined();
    expect((sanitized.snapshot.diagnostics as unknown as Record<string, unknown>).textLeak).toBeUndefined();
  });

  it("normalize clamps numeric ranges and caps action list", () => {
    const base = makeFallbackSnapshot();
    const dirty: ControlTowerDecisionSnapshot = {
      ...base,
      state: "active",
      healthScore: 999,
      structuralRiskScore: 5,
      actionCards: [
        makeAction(1, "d1"),
        makeAction(2, "d1"),
        makeAction(3, "d2"),
        makeAction(4, "d3"),
        makeAction(5, "d4"),
        makeAction(6, "d5"),
      ],
    };

    const normalized = normalizeDecisionSnapshot(dirty);
    expect(normalized.healthScore).toBe(100);
    expect(normalized.structuralRiskScore).toBe(1);
    expect(normalized.actionCards.length).toBeLessThanOrEqual(5);
    expect(normalized.actionCards.filter((action) => action.idempotency?.dedupeKey === "d1").length).toBe(1);
  });

  it("enforces empty and degraded state invariants", () => {
    const base = makeFallbackSnapshot();

    const emptyNormalized = normalizeDecisionSnapshot({
      ...base,
      state: "empty",
      healthScore: 10,
      actionCards: [makeAction(1, "x1"), makeAction(2, "x2"), makeAction(3, "x3")],
    });

    expect(emptyNormalized.healthScore).toBeGreaterThanOrEqual(80);
    expect(emptyNormalized.actionCards.length).toBeLessThanOrEqual(2);

    const degradedNormalized = normalizeDecisionSnapshot({
      ...base,
      state: "degraded",
      actionCards: [],
    });

    expect(degradedNormalized.actionCards.length).toBeGreaterThanOrEqual(1);
    expect(degradedNormalized.actionCards[0].intent).toBe("review_risks");
  });

  it("finalize composes sanitize and normalize", () => {
    const base = makeFallbackSnapshot();
    const dirty = {
      ...base,
      healthScore: -50,
      debug: {
        metrics: { score: 1 },
        description: "private data",
      },
    } as unknown as ControlTowerDecisionSnapshot;

    const finalized = finalizeDecisionSnapshot(dirty);
    expect(finalized.healthScore).toBe(0);
    expect(finalized.warnings.some((warning) => warning.code === "DEBUG_STRIPPED")).toBe(true);
  });
});
