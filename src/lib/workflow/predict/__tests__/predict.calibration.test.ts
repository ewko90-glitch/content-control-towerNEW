import { describe, expect, it } from "vitest";

import { predictWorkflowRisk } from "../index";
import { buildPredictInput, buildPredictItems } from "./fixtures";

describe("predictive risk calibration", () => {
  it("keeps delay probability monotonic with risk score ordering", () => {
    const output = predictWorkflowRisk(buildPredictInput());
    const predictions = [...(output.summary.predictions ?? [])].sort((left, right) => left.riskScore - right.riskScore);

    for (let index = 1; index < predictions.length; index += 1) {
      expect(predictions[index]!.delayProbability).toBeGreaterThanOrEqual(predictions[index - 1]!.delayProbability);
    }
  });

  it("reduces confidence when signal quality is removed", () => {
    const full = predictWorkflowRisk(buildPredictInput());

    const degradedItems = buildPredictItems().map((item) => ({
      ...item,
      slaSeverityScore: undefined,
      stuckSeverityScore: undefined,
      stageWipSeverityScore: undefined,
      dueAt: undefined,
    }));

    const degraded = predictWorkflowRisk(
      buildPredictInput({
        items: degradedItems,
        flowMetrics: undefined,
      }),
    );

    const fullAvgConfidence = (full.summary.predictions ?? []).reduce((acc, item) => acc + item.confidence, 0) /
      Math.max((full.summary.predictions ?? []).length, 1);
    const degradedAvgConfidence = (degraded.summary.predictions ?? []).reduce((acc, item) => acc + item.confidence, 0) /
      Math.max((degraded.summary.predictions ?? []).length, 1);

    expect(degradedAvgConfidence).toBeLessThanOrEqual(fullAvgConfidence);
    expect((degraded.summary.predictions ?? [])[0]?.contributions.some((entry) => entry.code === "NO_BASELINE")).toBe(true);
  });
});
