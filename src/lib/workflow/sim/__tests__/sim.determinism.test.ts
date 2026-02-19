import { describe, expect, it } from "vitest";

import { runSimulation } from "../compare";
import { buildSimInput } from "./fixtures";

describe("simulation determinism", () => {
  it("returns stable deepEqual output for identical input", () => {
    const input = buildSimInput({
      scenario: {
        id: "det",
        name: "Determinism",
        knobs: [{ kind: "capacity", stageId: "review", multiplier: 1.22 }],
      },
    });

    const baseline = runSimulation(input);

    for (let index = 0; index < 5; index += 1) {
      expect(runSimulation(input)).toEqual(baseline);
    }
  });
});
