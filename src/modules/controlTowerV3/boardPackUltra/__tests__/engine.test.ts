import { describe, expect, it } from "vitest";

import { buildExecutiveReport } from "../engine";
import type { WorkspaceSnapshotLike } from "../types";
import type { PortfolioRow, PortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/types";

function makeWorkspaces(count: number): Array<{ id: string; slug: string; name: string }> {
  return Array.from({ length: count }).map((_, index) => ({
    id: `ws-${index + 1}`,
    slug: `workspace-${String(index + 1).padStart(2, "0")}`,
    name: `Workspace ${index + 1}`,
  }));
}

function mockWorkspaceSnapshot(seed: number): WorkspaceSnapshotLike {
  const alignment = 35 + (seed % 60);
  const health = 30 + (seed % 65);
  const drift = seed % 3 === 0;
  const confidence: "low" | "medium" | "high" = seed % 4 === 0 ? "low" : seed % 2 === 0 ? "high" : "medium";

  return {
    generatedAtIso: "2026-02-16T10:00:00.000Z",
    healthScore: health,
    trend7d: { score: (seed % 30) - 15 },
    strategy: {
      alignment: {
        alignmentScore: alignment,
        driftDetected: drift,
        confidence,
        diagnostics: {
          inputs: {
            artifacts: seed % 5,
            actions: 3 + (seed % 9),
            outcomes: seed % 4,
          },
        },
      },
      weeklyMoves: [
        {
          kind: "focus",
          title: `Focus ${seed}`,
          successMetric: "Metric 1",
          effort: "M",
          risk: "medium",
          expectedImpact: { healthScoreDelta: 3 },
        },
        {
          kind: "stability",
          title: `Stability ${seed}`,
          successMetric: "Metric 2",
          effort: "S",
          risk: "low",
          expectedImpact: { healthScoreDelta: 2 },
        },
        {
          kind: "optimization",
          title: `Optimization ${seed}`,
          successMetric: "Metric 3",
          effort: "M",
          risk: "medium",
          expectedImpact: { healthScoreDelta: 4 },
        },
      ],
    },
  };
}

function toPortfolioRow(args: {
  ws: { id: string; slug: string; name: string };
  snapshot: WorkspaceSnapshotLike;
  rankKey: string;
  includeNoPlanRisk?: boolean;
}): PortfolioRow {
  const healthScore = Number(args.snapshot.healthScore ?? 50);
  const trendScore = Number(args.snapshot.trend7d?.score ?? 0);
  const alignmentScore = Number(args.snapshot.strategy?.alignment?.alignmentScore ?? 50);
  const driftDetected = args.snapshot.strategy?.alignment?.driftDetected === true;
  const confidence = args.snapshot.strategy?.alignment?.confidence ?? "low";
  const weeklyMoves = args.snapshot.strategy?.weeklyMoves ?? [];

  return {
    workspaceId: args.ws.id,
    workspaceSlug: args.ws.slug,
    workspaceName: args.ws.name,
    healthScore,
    healthBand: healthScore < 40 ? "critical" : healthScore < 60 ? "risk" : healthScore < 80 ? "ok" : "strong",
    momentum7d: trendScore,
    momentumBand: trendScore < -5 ? "down" : trendScore > 5 ? "up" : "flat",
    strategicAlignmentScore: alignmentScore,
    driftDetected,
    confidence,
    risks: args.includeNoPlanRisk ? [{ code: "no_weekly_plan", label: "No plan", severity: "medium" }] : [],
    topMoves: weeklyMoves
      .filter((move) => move.kind === "focus" || move.kind === "stability" || move.kind === "optimization")
      .map((move) => ({
        title: String(move.title ?? "Strategic move"),
        kind: move.kind as "focus" | "stability" | "optimization",
      })),
    updatedAtIso: "2026-02-16T10:00:00.000Z",
    rankKey: args.rankKey,
  };
}

describe("buildExecutiveReport", () => {
  const nowIso = "2026-02-16T10:00:00.000Z";

  it("is deterministic for same inputs", async () => {
    const workspaces = makeWorkspaces(6);

    const loadPortfolioSnapshot = async ({ workspaces }: { nowIso: string; workspaces: Array<{ id: string; slug: string; name: string }> }): Promise<PortfolioSnapshot> => ({
      generatedAtIso: nowIso,
      summary: {
        total: workspaces.length,
        critical: 2,
        drifting: 2,
        strong: 1,
        headline: "headline",
        notes: ["note"],
      },
      insights: [],
      rows: workspaces.map((ws, index) => {
        const snapshot = mockWorkspaceSnapshot(index + 1);
        return toPortfolioRow({ ws, snapshot, rankKey: `${index}` });
      }),
    });

    const loadWorkspaceSnapshot = async (workspaceId: string, _nowIso: string): Promise<WorkspaceSnapshotLike> => {
      const seed = Number(workspaceId.replace("ws-", ""));
      return mockWorkspaceSnapshot(seed);
    };

    const a = await buildExecutiveReport({
      nowIso,
      filter: "all",
      workspaces,
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    const b = await buildExecutiveReport({
      nowIso,
      filter: "all",
      workspaces,
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    expect(a).toEqual(b);
  });

  it("keeps selection limits and action constraints", async () => {
    const workspaces = makeWorkspaces(30);

    const loadPortfolioSnapshot = async ({ workspaces }: { nowIso: string; workspaces: Array<{ id: string; slug: string; name: string }> }): Promise<PortfolioSnapshot> => ({
      generatedAtIso: nowIso,
      summary: {
        total: workspaces.length,
        critical: 5,
        drifting: 7,
        strong: 3,
        headline: "headline",
        notes: [],
      },
      insights: [],
      rows: workspaces.map((ws, index) => {
        const snapshot = mockWorkspaceSnapshot(index + 1);
        return toPortfolioRow({ ws, snapshot, rankKey: `${index}`, includeNoPlanRisk: index % 3 === 0 });
      }),
    });

    const loadWorkspaceSnapshot = async (workspaceId: string, _nowIso: string): Promise<WorkspaceSnapshotLike> => {
      const seed = Number(workspaceId.replace("ws-", ""));
      return mockWorkspaceSnapshot(seed);
    };

    const report = await buildExecutiveReport({
      nowIso,
      filter: "drifting",
      workspaces,
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    expect(report.source.portfolioSnapshot.rows.length).toBeLessThanOrEqual(25);
    expect(report.executiveSummary.priorityPlays.length).toBeLessThanOrEqual(3);
    expect(report.structuralAnalysis.systemicPatterns.length).toBeLessThanOrEqual(5);
    expect(report.workspaceBriefs.every((brief) => brief.operationalPrescription.length === 5)).toBe(true);
    expect(report.meta.scope).toBe("drifting");
  });

  it("respects filter behavior for critical", async () => {
    const workspaces = makeWorkspaces(4);

    const rows: PortfolioSnapshot["rows"] = [
      { workspaceId: "ws-1", workspaceSlug: "workspace-01", workspaceName: "Workspace 1", healthScore: 35, healthBand: "critical", momentum7d: -10, momentumBand: "down", strategicAlignmentScore: 45, driftDetected: true, confidence: "medium", risks: [], topMoves: [], updatedAtIso: nowIso, rankKey: "1" },
      { workspaceId: "ws-2", workspaceSlug: "workspace-02", workspaceName: "Workspace 2", healthScore: 74, healthBand: "ok", momentum7d: 4, momentumBand: "flat", strategicAlignmentScore: 70, driftDetected: false, confidence: "high", risks: [], topMoves: [], updatedAtIso: nowIso, rankKey: "2" },
      { workspaceId: "ws-3", workspaceSlug: "workspace-03", workspaceName: "Workspace 3", healthScore: 38, healthBand: "critical", momentum7d: -6, momentumBand: "down", strategicAlignmentScore: 48, driftDetected: true, confidence: "low", risks: [], topMoves: [], updatedAtIso: nowIso, rankKey: "3" },
      { workspaceId: "ws-4", workspaceSlug: "workspace-04", workspaceName: "Workspace 4", healthScore: 81, healthBand: "strong", momentum7d: 8, momentumBand: "up", strategicAlignmentScore: 84, driftDetected: false, confidence: "high", risks: [], topMoves: [], updatedAtIso: nowIso, rankKey: "4" },
    ];

    const loadPortfolioSnapshot = async (_input: { nowIso: string; workspaces: Array<{ id: string; slug: string; name: string }> }): Promise<PortfolioSnapshot> => ({
      generatedAtIso: nowIso,
      summary: {
        total: rows.length,
        critical: 2,
        drifting: 2,
        strong: 1,
        headline: "headline",
        notes: [],
      },
      insights: [],
      rows,
    });

    const loadWorkspaceSnapshot = async (_workspaceId: string, _nowIso: string): Promise<WorkspaceSnapshotLike> => mockWorkspaceSnapshot(1);

    const report = await buildExecutiveReport({
      nowIso,
      filter: "critical",
      workspaces,
      loadPortfolioSnapshot,
      loadWorkspaceSnapshot,
    });

    expect(report.executiveSummary.kpis.totalWorkspaces).toBe(2);
    expect(report.structuralAnalysis.rankingMatrix.every((row) => row.healthBand === "critical")).toBe(true);
  });
});
