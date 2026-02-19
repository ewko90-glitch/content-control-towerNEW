import { describe, expect, it } from "vitest";

import { buildPortfolioSnapshot } from "../portfolio";

function makeWorkspace(id: string, slug: string, name: string) {
  return { id, slug, name };
}

describe("buildPortfolioSnapshot", () => {
  it("builds deterministic ranking and stable insight ids", async () => {
    const nowIso = "2026-02-16T10:00:00.000Z";

    const snapshots: Record<string, any> = {
      "ws-a": {
        generatedAtIso: nowIso,
        healthScore: 31,
        trend7d: { score: -18 },
        strategy: {
          alignment: {
            alignmentScore: 42,
            confidence: "medium",
            driftDetected: true,
            diagnostics: { inputs: { artifacts: 2, actions: 8 } },
          },
          weeklyMoves: [{ title: "Focus messaging", kind: "focus" }],
        },
      },
      "ws-b": {
        generatedAtIso: nowIso,
        healthScore: 35,
        trend7d: { score: -10 },
        strategy: {
          alignment: {
            alignmentScore: 44,
            confidence: "medium",
            driftDetected: true,
            diagnostics: { inputs: { artifacts: 2, actions: 8 } },
          },
          weeklyMoves: [{ title: "Stabilize workflow", kind: "stability" }],
        },
      },
      "ws-c": {
        generatedAtIso: nowIso,
        healthScore: 84,
        trend7d: { score: 12 },
        strategy: {
          alignment: {
            alignmentScore: 88,
            confidence: "high",
            driftDetected: false,
            diagnostics: { inputs: { artifacts: 5, actions: 18 } },
          },
          weeklyMoves: [
            { title: "Optimize channel mix", kind: "optimization" },
            { title: "Strengthen pipeline", kind: "focus" },
            { title: "Harden approvals", kind: "stability" },
          ],
        },
      },
    };

    const workspaces = [
      makeWorkspace("ws-c", "gamma", "Gamma"),
      makeWorkspace("ws-a", "alpha", "Alpha"),
      makeWorkspace("ws-b", "beta", "Beta"),
    ];

    const loadWorkspaceSnapshot = async (workspaceId: string) => snapshots[workspaceId];

    const first = await buildPortfolioSnapshot({ nowIso, workspaces, loadWorkspaceSnapshot });
    const second = await buildPortfolioSnapshot({ nowIso, workspaces, loadWorkspaceSnapshot });

    expect(first.rows.map((row) => row.workspaceId)).toEqual(["ws-a", "ws-b", "ws-c"]);
    expect(first.rows[0]?.healthBand).toBe("critical");
    expect(first.rows[2]?.healthBand).toBe("strong");

    expect(first.summary.total).toBe(3);
    expect(first.summary.critical).toBe(2);
    expect(first.summary.drifting).toBe(2);
    expect(first.summary.strong).toBe(1);

    expect(first.insights.length).toBeGreaterThan(0);
    expect(first.insights[0]?.id).toEqual(second.insights[0]?.id);
    expect(first.rows[0]?.rankKey).toEqual(second.rows[0]?.rankKey);
  });

  it("creates fallback baseline insight when no systemic clusters", async () => {
    const nowIso = "2026-02-16T10:00:00.000Z";
    const workspaces = [makeWorkspace("ws-1", "one", "One")];

    const snapshot = await buildPortfolioSnapshot({
      nowIso,
      workspaces,
      loadWorkspaceSnapshot: async () => ({
        generatedAtIso: nowIso,
        healthScore: 72,
        trend7d: { score: 2 },
        strategy: {
          alignment: {
            alignmentScore: 74,
            confidence: "high",
            driftDetected: false,
            diagnostics: { inputs: { artifacts: 3, actions: 10 } },
          },
          weeklyMoves: [
            { title: "Focus", kind: "focus" },
            { title: "Stability", kind: "stability" },
            { title: "Optimization", kind: "optimization" },
          ],
        },
      }),
    });

    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.insights.length).toBe(1);
    expect(snapshot.insights[0]?.title).toBe("Portfolio baseline");
  });

  it("flags low signal when confidence is low and inputs are sparse", async () => {
    const nowIso = "2026-02-16T10:00:00.000Z";

    const snapshot = await buildPortfolioSnapshot({
      nowIso,
      workspaces: [makeWorkspace("ws-1", "one", "One")],
      loadWorkspaceSnapshot: async () => ({
        generatedAtIso: nowIso,
        healthScore: 51,
        trend7d: { score: 0 },
        strategy: {
          alignment: {
            alignmentScore: 51,
            confidence: "low",
            driftDetected: false,
            diagnostics: { inputs: { artifacts: 0, actions: 3 } },
          },
          weeklyMoves: [],
        },
      }),
    });

    const lowSignal = snapshot.rows[0]?.risks.find((risk) => risk.code === "low_signal");
    expect(lowSignal).toBeDefined();
    expect(lowSignal?.severity).toBe("low");
  });
});
