import { describe, expect, it } from "vitest";

import { computePortfolioRisk } from "../riskEngine";

describe("computePortfolioRisk", () => {
  it("returns null if healthScore missing / not finite", () => {
    expect(computePortfolioRisk({})).toBeNull();
    expect(computePortfolioRisk({ healthScore: Number.NaN })).toBeNull();
  });

  it("clamps exposureScore to 0..100", () => {
    const lowExposure = computePortfolioRisk({ healthScore: 150 });
    const highExposure = computePortfolioRisk({ healthScore: -50 });

    expect(lowExposure?.[0]?.exposureScore).toBe(0);
    expect(highExposure?.[0]?.exposureScore).toBe(100);
  });

  it("maps risk level boundaries correctly", () => {
    expect(computePortfolioRisk({ healthScore: 75 })?.[0]?.riskLevel).toBe("low");
    expect(computePortfolioRisk({ healthScore: 74 })?.[0]?.riskLevel).toBe("medium");
    expect(computePortfolioRisk({ healthScore: 50 })?.[0]?.riskLevel).toBe("medium");
    expect(computePortfolioRisk({ healthScore: 49 })?.[0]?.riskLevel).toBe("high");
    expect(computePortfolioRisk({ healthScore: 25 })?.[0]?.riskLevel).toBe("high");
    expect(computePortfolioRisk({ healthScore: 24 })?.[0]?.riskLevel).toBe("critical");
  });

  it("increases exposure with negative decision attribution", () => {
    const base = computePortfolioRisk({ healthScore: 80 });
    const withNegative = computePortfolioRisk({
      healthScore: 80,
      decisionAttribution: [
        {
          decisionId: "d1",
          adoptedAt: "2026-02-16T00:00:00.000Z",
          window: 7,
          baselineScore: 70,
          currentScore: 65,
          deltaScore: -5,
          estimatedROI: -5000,
          confidence: 0.6,
          explanation: "x",
        },
      ],
    });

    expect((withNegative?.[0]?.exposureScore ?? 0) > (base?.[0]?.exposureScore ?? 0)).toBe(true);
  });

  it("reduces exposure with recentWins (bounded)", () => {
    const noWins = computePortfolioRisk({ healthScore: 60, recentWins: 0 });
    const manyWins = computePortfolioRisk({ healthScore: 60, recentWins: 99 });

    expect((manyWins?.[0]?.exposureScore ?? 0) < (noWins?.[0]?.exposureScore ?? 0)).toBe(true);
    expect((noWins?.[0]?.exposureScore ?? 0) - (manyWins?.[0]?.exposureScore ?? 0)).toBe(5);
  });

  it("increases exposure with suppressedIntents (bounded)", () => {
    const none = computePortfolioRisk({ healthScore: 60, suppressedIntents: 0 });
    const high = computePortfolioRisk({ healthScore: 60, suppressedIntents: 99 });

    expect((high?.[0]?.exposureScore ?? 0) > (none?.[0]?.exposureScore ?? 0)).toBe(true);
    expect((high?.[0]?.exposureScore ?? 0) - (none?.[0]?.exposureScore ?? 0)).toBe(10);
  });

  it("applies trend thresholds for scoreDelta", () => {
    expect(computePortfolioRisk({ healthScore: 60, scoreDelta: 0.5 })?.[0]?.trend).toBe("stable");
    expect(computePortfolioRisk({ healthScore: 60, scoreDelta: 0.51 })?.[0]?.trend).toBe("improving");
    expect(computePortfolioRisk({ healthScore: 60, scoreDelta: 0.49 })?.[0]?.trend).toBe("stable");
    expect(computePortfolioRisk({ healthScore: 60, scoreDelta: -0.5 })?.[0]?.trend).toBe("stable");
    expect(computePortfolioRisk({ healthScore: 60, scoreDelta: -0.51 })?.[0]?.trend).toBe("deteriorating");
  });

  it("limits signals to max 3 with deterministic order", () => {
    const result = computePortfolioRisk({
      healthScore: 20,
      decisionAttribution: [
        {
          decisionId: "d1",
          adoptedAt: "2026-02-16T00:00:00.000Z",
          window: 7,
          baselineScore: 70,
          currentScore: 65,
          deltaScore: -5,
          estimatedROI: -5000,
          confidence: 0.6,
          explanation: "x",
        },
      ],
      suppressedIntents: 4,
      recentWins: 2,
    });

    expect(result?.[0]?.signals).toEqual([
      "Elevated exposure vs. health baseline",
      "Negative decision impact detected",
      "Suppressed intents reduce momentum",
    ]);
  });
});
