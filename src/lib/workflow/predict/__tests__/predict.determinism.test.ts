import { describe, expect, it } from "vitest";

import { predictWorkflowRisk } from "../index";
import { buildPredictInput } from "./fixtures";

describe("predictive risk determinism", () => {
  it("returns identical output for identical input", () => {
    const input = buildPredictInput();
    const baseline = predictWorkflowRisk(input);

    for (let index = 0; index < 5; index += 1) {
      const next = predictWorkflowRisk(input);
      expect(next).toEqual(baseline);
    }
  });
});
