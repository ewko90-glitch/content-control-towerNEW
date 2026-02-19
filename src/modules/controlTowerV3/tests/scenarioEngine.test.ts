import { describe, expect, it } from "vitest";

import { runScenarioSimulation } from "../scenarioEngine";

describe("runScenarioSimulation", () => {
  const baseScenario = {
    id: "s1",
    label: "Execution push",
    lever: "prioritize_execution" as const,
    horizon: 14 as const,
  };

  it("returns null when healthScore missing", () => {
    const result = runScenarioSimulation({
      snapshot: {},
      scenario: baseScenario,
    });

    expect(result).toBeNull();
  });

  it("returns deterministic rounded outputs for lever/horizon", () => {
    const params = {
      snapshot: {
        healthScore: 70,
        portfolioRiskMatrix: [{ exposureScore: 30 }],
        decisionAttribution: [{ deltaScore: 1, estimatedROI: 1000, confidence: 0.8 }],
      },
      scenario: {
        id: "s2",
        label: "ROI boost",
        lever: "optimize_roi" as const,
        horizon: 14 as const,
      },
    };

    const first = runScenarioSimulation(params);
    const second = runScenarioSimulation(params);

    expect(first).toEqual(second);
    expect(first?.predicted).toEqual({
      healthScoreDelta: 1.6,
      riskExposureDelta: -1.6,
      roiDelta: 1440,
    });
  });

  it("applies clamping bounds", () => {
    const result = runScenarioSimulation({
      snapshot: {
        healthScore: -10,
        portfolioRiskMatrix: [{ exposureScore: 90 }],
        decisionAttribution: [{ deltaScore: -1000, estimatedROI: -10000, confidence: 0.9 }],
      },
      scenario: {
        id: "s3",
        label: "Long horizon workflow",
        lever: "stabilize_workflow",
        horizon: 30,
      },
    });

    expect(result?.predicted.healthScoreDelta).toBeGreaterThanOrEqual(-10);
    expect(result?.predicted.healthScoreDelta).toBeLessThanOrEqual(10);
    expect(result?.predicted.riskExposureDelta).toBeGreaterThanOrEqual(-20);
    expect(result?.predicted.riskExposureDelta).toBeLessThanOrEqual(20);
    expect(result?.predicted.roiDelta).toBeGreaterThanOrEqual(-5000);
    expect(result?.predicted.roiDelta).toBeLessThanOrEqual(5000);
  });

  it("amplifies risk reduction in critical exposure", () => {
    const normal = runScenarioSimulation({
      snapshot: { healthScore: 70 },
      scenario: {
        id: "s4",
        label: "Reduce drift normal",
        lever: "reduce_drift",
        horizon: 7,
      },
    });

    const critical = runScenarioSimulation({
      snapshot: { healthScore: 70, portfolioRiskMatrix: [{ exposureScore: 80 }] },
      scenario: {
        id: "s5",
        label: "Reduce drift critical",
        lever: "reduce_drift",
        horizon: 7,
      },
    });

    expect(Math.abs(critical?.predicted.riskExposureDelta ?? 0)).toBeGreaterThan(Math.abs(normal?.predicted.riskExposureDelta ?? 0));
  });

  it("adjusts confidence using attribution average confidence", () => {
    const result = runScenarioSimulation({
      snapshot: {
        healthScore: 65,
        decisionAttribution: [
          { deltaScore: 2, estimatedROI: 1000, confidence: 0.8 },
          { deltaScore: 1, estimatedROI: 500, confidence: 0.9 },
        ],
      },
      scenario: {
        id: "s6",
        label: "Execution confidence",
        lever: "prioritize_execution",
        horizon: 14,
      },
    });

    expect(result?.confidence).toBe(0.8);
  });

  it("includes horizon and confidence percentage in explanation", () => {
    const result = runScenarioSimulation({
      snapshot: { healthScore: 60 },
      scenario: {
        id: "s7",
        label: "Workflow stability",
        lever: "stabilize_workflow",
        horizon: 30,
      },
    });

    expect(result?.explanation.includes("30 days")).toBe(true);
    expect(result?.explanation.includes("Confidence:")).toBe(true);
    expect(result?.explanation.includes("%")).toBe(true);
  });
});
