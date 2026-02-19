import { describe, expect, it } from "vitest";

import { predictWorkflowRisk } from "../index";
import { buildPredictInput } from "./fixtures";

describe("predictive risk contract", () => {
  it("returns stable summary shape with ranked top risks", () => {
    const output = predictWorkflowRisk(buildPredictInput());

    expect(output.summary.horizonDays).toBe(7);
    expect(output.summary.pressureScore).toBeGreaterThanOrEqual(0);
    expect(output.summary.pressureScore).toBeLessThanOrEqual(100);
    expect(output.summary.tailRiskScore).toBeGreaterThanOrEqual(output.summary.pressureScore);
    expect(output.summary.topRisks.length).toBeGreaterThan(0);

    const predictions = output.summary.predictions ?? [];
    expect(predictions.length).toBe(3);

    for (const prediction of predictions) {
      expect(prediction.delayProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.delayProbability).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.2);
      expect(prediction.confidence).toBeLessThanOrEqual(0.95);
      expect(prediction.rationale.length).toBeLessThanOrEqual(140);

      if (prediction.eta.remainingP50Hours !== undefined && prediction.eta.remainingP90Hours !== undefined) {
        expect(prediction.eta.remainingP90Hours).toBeGreaterThanOrEqual(prediction.eta.remainingP50Hours);
      }
    }
  });

  it("keeps top risks sorted by descending riskScore", () => {
    const output = predictWorkflowRisk(buildPredictInput());
    const top = output.summary.topRisks;

    for (let index = 1; index < top.length; index += 1) {
      expect(top[index - 1]!.riskScore).toBeGreaterThanOrEqual(top[index]!.riskScore);
    }
  });
});
