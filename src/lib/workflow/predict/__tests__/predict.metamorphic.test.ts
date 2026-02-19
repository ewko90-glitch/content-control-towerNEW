import { describe, expect, it } from "vitest";

import { predictWorkflowRisk } from "../index";
import { buildPredictInput, buildPredictItems } from "./fixtures";

describe("predictive risk metamorphic properties", () => {
  it("increasing item age does not reduce that item's risk", () => {
    const baseItems = buildPredictItems();
    const stretchedItems = baseItems.map((item) =>
      item.itemId === "risk-medium"
        ? {
            ...item,
            ageHours: item.ageHours + 48,
          }
        : item,
    );

    const base = predictWorkflowRisk(buildPredictInput({ items: baseItems }));
    const stretched = predictWorkflowRisk(buildPredictInput({ items: stretchedItems }));

    const baseRisk = (base.summary.predictions ?? []).find((item) => item.itemId === "risk-medium")?.riskScore ?? 0;
    const stretchedRisk = (stretched.summary.predictions ?? []).find((item) => item.itemId === "risk-medium")?.riskScore ?? 0;

    expect(stretchedRisk).toBeGreaterThanOrEqual(baseRisk);
  });

  it("raising stuck severity cannot reduce delay probability", () => {
    const baseItems = buildPredictItems();
    const elevatedItems = baseItems.map((item) =>
      item.itemId === "risk-medium"
        ? {
            ...item,
            stuckSeverityScore: Math.max(item.stuckSeverityScore ?? 0, 85),
          }
        : item,
    );

    const base = predictWorkflowRisk(buildPredictInput({ items: baseItems }));
    const elevated = predictWorkflowRisk(buildPredictInput({ items: elevatedItems }));

    const baseProb = (base.summary.predictions ?? []).find((item) => item.itemId === "risk-medium")?.delayProbability ?? 0;
    const elevatedProb = (elevated.summary.predictions ?? []).find((item) => item.itemId === "risk-medium")?.delayProbability ?? 0;

    expect(elevatedProb).toBeGreaterThanOrEqual(baseProb);
  });
});
