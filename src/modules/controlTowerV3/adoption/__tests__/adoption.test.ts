import { describe, expect, it } from "vitest";

import { buildExecutiveReport } from "@/modules/controlTowerV3/boardPackUltra/engine";
import type { PortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/types";
import type { StrategicMove } from "@/modules/controlTowerV3/strategy/moves";

import { enrichMovesWithAdoption } from "../adoptionEngine";
import { getAdoptionMeta, listRecentAdoptionEvents, recordAdoptionEvent, setAdoptionStatus } from "../adoptionStore";
import { computeMoveImpact } from "../impactEngine";

function makeMove(args: { workspaceId: string; moveId: string; createdAt: string }): StrategicMove {
  return {
    id: args.moveId,
    workspaceId: args.workspaceId,
    weekKey: "2026-W07",
    kind: "focus",
    title: `Move ${args.moveId}`,
    why: "Why",
    linkedArtifacts: [],
    successMetric: "Metric",
    effort: "M",
    risk: "medium",
    expectedImpact: {
      healthScoreDelta: 3,
      confidence: "medium",
      rationale: "Rationale",
    },
    recommendedActions: [
      {
        title: "Action",
        kind: "workflow",
        reason: "Reason",
      },
    ],
    createdAt: args.createdAt,
    diagnostics: {
      alignmentScore: 55,
      driftDetected: false,
      inputs: {
        artifacts: 4,
        actions: 6,
        outcomes: 2,
      },
      notes: [],
    },
  };
}

describe("adoption engine", () => {
  it("maps adoption deterministically", () => {
    const workspaceId = "ws-det";
    const nowIso = "2026-02-16T10:00:00.000Z";
    const move = makeMove({ workspaceId, moveId: "smv_det_1", createdAt: "2026-02-12T10:00:00.000Z" });

    const first = enrichMovesWithAdoption({ workspaceId, moves: [move], nowIso });
    const second = enrichMovesWithAdoption({ workspaceId, moves: [move], nowIso });

    expect(first).toEqual(second);
  });

  it("marks ignored after 14 days without events", () => {
    const workspaceId = "ws-ignored";
    const nowIso = "2026-02-16T10:00:00.000Z";
    const oldMove = makeMove({ workspaceId, moveId: "smv_ignored_1", createdAt: "2026-01-20T10:00:00.000Z" });

    const enriched = enrichMovesWithAdoption({ workspaceId, moves: [oldMove], nowIso });
    expect(enriched[0]?.adoption?.status).toBe("ignored");
  });

  it("marks adopted when outcome event exists", () => {
    const workspaceId = "ws-adopted";
    const nowIso = "2026-02-16T10:00:00.000Z";
    const move = makeMove({ workspaceId, moveId: "smv_adopted_1", createdAt: "2026-02-10T10:00:00.000Z" });

    recordAdoptionEvent({
      workspaceId,
      moveId: move.id,
      type: "outcome",
      occurredAtIso: "2026-02-15T10:00:00.000Z",
      sessionId: move.id,
    });

    const enriched = enrichMovesWithAdoption({ workspaceId, moves: [move], nowIso });
    expect(enriched[0]?.adoption?.status).toBe("adopted");
  });

  it("computes impact for adopted moves", () => {
    const workspaceId = "ws-impact";
    const nowIso = "2026-02-16T10:00:00.000Z";
    const move = {
      ...makeMove({ workspaceId, moveId: "smv_imp_1", createdAt: "2026-02-10T10:00:00.000Z" }),
      adoption: {
        status: "adopted" as const,
        adoptedAtIso: "2026-02-08T10:00:00.000Z",
      },
    };

    const withImpact = computeMoveImpact({
      workspaceId,
      move,
      baselineSnapshot: {
        healthScore: 50,
        strategy: { alignment: { alignmentScore: 52 } },
      },
      currentSnapshot: {
        healthScore: 56,
        strategy: { alignment: { alignmentScore: 59, diagnostics: { inputs: { artifacts: 12, outcomes: 2 } } } },
        trend7d: { score: 6 },
      },
      nowIso,
    });

    expect(withImpact.adoption?.impact?.d7?.healthDelta).toBe(6);
    expect(withImpact.adoption?.impact?.d7?.alignmentDelta).toBe(7);
  });

  it("does not compute impact before adopted", () => {
    const workspaceId = "ws-no-impact";
    const nowIso = "2026-02-16T10:00:00.000Z";
    const move = {
      ...makeMove({ workspaceId, moveId: "smv_no_imp_1", createdAt: "2026-02-10T10:00:00.000Z" }),
      adoption: {
        status: "in_progress" as const,
      },
    };

    const result = computeMoveImpact({
      workspaceId,
      move,
      baselineSnapshot: { healthScore: 40, strategy: { alignment: { alignmentScore: 40 } } },
      currentSnapshot: { healthScore: 45, strategy: { alignment: { alignmentScore: 46 } } },
      nowIso,
    });

    expect(result.adoption?.impact).toBeUndefined();
  });

  it("computes accountability counts", async () => {
    const nowIso = "2026-02-16T10:00:00.000Z";
    const workspaceId = "ws-acc";

    const adoptedMove = {
      ...makeMove({ workspaceId, moveId: "smv_acc_1", createdAt: "2026-02-01T10:00:00.000Z" }),
      adoption: {
        status: "adopted" as const,
        adoptedAtIso: "2026-02-14T10:00:00.000Z",
        impact: {
          d7: { healthDelta: 4, alignmentDelta: 3, confidence: "medium" as const },
        },
      },
    };

    const inProgressMove = {
      ...makeMove({ workspaceId, moveId: "smv_acc_2", createdAt: "2026-02-10T10:00:00.000Z" }),
      adoption: { status: "in_progress" as const },
    };

    const ignoredMove = {
      ...makeMove({ workspaceId, moveId: "smv_acc_3", createdAt: "2026-01-20T10:00:00.000Z" }),
      adoption: { status: "ignored" as const },
    };

    const report = await buildExecutiveReport({
      nowIso,
      filter: "all",
      workspaces: [{ id: workspaceId, slug: "acc", name: "Accountability WS" }],
      loadPortfolioSnapshot: async (): Promise<PortfolioSnapshot> => ({
        generatedAtIso: nowIso,
        summary: {
          total: 1,
          critical: 0,
          drifting: 0,
          strong: 1,
          headline: "h",
          notes: [],
        },
        insights: [],
        rows: [
          {
            workspaceId,
            workspaceSlug: "acc",
            workspaceName: "Accountability WS",
            healthScore: 80,
            healthBand: "strong",
            momentum7d: 10,
            momentumBand: "up",
            strategicAlignmentScore: 78,
            driftDetected: false,
            confidence: "high",
            risks: [],
            topMoves: [],
            updatedAtIso: nowIso,
            rankKey: "1",
          },
        ],
      }),
      loadWorkspaceSnapshot: async () => ({
        generatedAtIso: nowIso,
        healthScore: 80,
        trend7d: { score: 10 },
        strategy: {
          alignment: {
            alignmentScore: 78,
            driftDetected: false,
            confidence: "high",
            diagnostics: { inputs: { artifacts: 11, actions: 15, outcomes: 3 } },
          },
          weeklyMoves: [adoptedMove, inProgressMove, ignoredMove],
        },
      }),
    });

    expect(report.accountability.adoptedLast7Days).toBe(1);
    expect(report.accountability.inProgress).toBe(1);
    expect(report.accountability.ignored).toBe(1);
    expect(report.accountability.totalMoves).toBe(3);
    expect(report.accountability.avgImpactDelta7).toBe(7);
  });

  it("updates adoption meta lastUpdatedAt deterministically", async () => {
    const workspaceId = "ws-meta";

    setAdoptionStatus({
      workspaceId,
      moveId: "smv_meta_1",
      status: "in_progress",
      nowIso: "2026-02-16T08:00:00.000Z",
    });
    setAdoptionStatus({
      workspaceId,
      moveId: "smv_meta_1",
      status: "adopted",
      nowIso: "2026-02-16T10:00:00.000Z",
    });
    setAdoptionStatus({
      workspaceId,
      moveId: "smv_meta_1",
      status: "ignored",
      nowIso: "2026-02-16T09:00:00.000Z",
    });

    const meta = await getAdoptionMeta(workspaceId);
    expect(meta.lastUpdatedAtIso).toBe("2026-02-16T10:00:00.000Z");
  });

  it("trims recent events to max 50 deterministically", async () => {
    const workspaceId = "ws-events-trim";

    for (let idx = 0; idx < 55; idx += 1) {
      const minute = String(idx).padStart(2, "0");
      setAdoptionStatus({
        workspaceId,
        moveId: `smv_trim_${String(idx).padStart(2, "0")}`,
        status: "in_progress",
        nowIso: `2026-02-16T10:${minute}:00.000Z`,
      });
    }

    const events = await listRecentAdoptionEvents(workspaceId, 100);
    expect(events).toHaveLength(50);
    expect(events[0]?.atIso).toBe("2026-02-16T10:54:00.000Z");
    expect(events[49]?.atIso).toBe("2026-02-16T10:05:00.000Z");
  });

  it("returns recent events in desc atIso order", async () => {
    const workspaceId = "ws-events-order";

    setAdoptionStatus({
      workspaceId,
      moveId: "smv_ord_1",
      status: "not_started",
      nowIso: "2026-02-16T09:00:00.000Z",
    });
    setAdoptionStatus({
      workspaceId,
      moveId: "smv_ord_2",
      status: "adopted",
      nowIso: "2026-02-16T11:00:00.000Z",
    });
    setAdoptionStatus({
      workspaceId,
      moveId: "smv_ord_3",
      status: "in_progress",
      nowIso: "2026-02-16T10:00:00.000Z",
    });

    const events = await listRecentAdoptionEvents(workspaceId, 3);
    expect(events.map((item) => item.atIso)).toEqual([
      "2026-02-16T11:00:00.000Z",
      "2026-02-16T10:00:00.000Z",
      "2026-02-16T09:00:00.000Z",
    ]);
  });

  it("builds non-empty deterministic audit section when events exist", async () => {
    const nowIso = "2026-02-16T12:00:00.000Z";
    const workspaceId = "ws-audit-engine";

    setAdoptionStatus({
      workspaceId,
      moveId: "smv_audit_1",
      status: "adopted",
      nowIso: "2026-02-16T11:30:00.000Z",
    });
    recordAdoptionEvent({
      workspaceId,
      moveId: "smv_audit_2",
      type: "intent",
      occurredAtIso: "2026-02-16T11:40:00.000Z",
      sessionId: "sess_audit_2",
    });

    const loadPortfolioSnapshot = async (): Promise<PortfolioSnapshot> => ({
      generatedAtIso: nowIso,
      summary: {
        total: 1,
        critical: 0,
        drifting: 0,
        strong: 1,
        headline: "h",
        notes: [],
      },
      insights: [],
      rows: [
        {
          workspaceId,
          workspaceSlug: "audit",
          workspaceName: "Audit WS",
          healthScore: 76,
          healthBand: "strong",
          momentum7d: 8,
          momentumBand: "up",
          strategicAlignmentScore: 74,
          driftDetected: false,
          confidence: "high",
          risks: [],
          topMoves: [],
          updatedAtIso: nowIso,
          rankKey: "1",
        },
      ],
    });

    const loadWorkspaceSnapshot = async () => ({
      generatedAtIso: nowIso,
      healthScore: 76,
      trend7d: { score: 8 },
      strategy: {
        alignment: {
          alignmentScore: 74,
          driftDetected: false,
          confidence: "high" as const,
          diagnostics: { inputs: { artifacts: 10, actions: 6, outcomes: 2 } },
        },
        weeklyMoves: [
          {
            ...makeMove({ workspaceId, moveId: "smv_audit_1", createdAt: "2026-02-10T10:00:00.000Z" }),
            adoption: {
              status: "adopted" as const,
              adoptedAtIso: "2026-02-16T11:30:00.000Z",
              impact: {
                d7: {
                  healthDelta: 4,
                  alignmentDelta: 3,
                  confidence: "high" as const,
                },
              },
            },
          },
        ],
      },
    });

    const first = await buildExecutiveReport({
      nowIso,
      filter: "all",
      workspaces: [{ id: workspaceId, slug: "audit", name: "Audit WS" }],
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    const second = await buildExecutiveReport({
      nowIso,
      filter: "all",
      workspaces: [{ id: workspaceId, slug: "audit", name: "Audit WS" }],
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    expect(first.accountability.audit.lastAdoptionUpdateAtIso).toBe("2026-02-16T11:40:00.000Z");
    expect(first.accountability.audit.signalsUsed.length).toBeGreaterThan(0);
    expect(first.accountability.audit.confidenceNote.length).toBeGreaterThan(0);
    expect((first.accountability.audit.recentAdoptionEvents ?? []).length).toBeGreaterThan(0);
    expect(first.accountability.audit).toEqual(second.accountability.audit);
  });
});
