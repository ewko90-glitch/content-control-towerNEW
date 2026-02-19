import { describe, expect, it } from "vitest";

import { computeFlowMetrics } from "../flowMetrics";
import { BASE_EVENTS_BY_ITEM_ID, DEFAULT_ZONES, FIXED_NOW, METRICS_POLICY } from "./fixtures";

describe("flow metrics determinism", () => {
  it("returns identical snapshot for identical input", () => {
    const input = {
      policy: METRICS_POLICY,
      zones: DEFAULT_ZONES,
      now: FIXED_NOW,
      eventsByItemId: BASE_EVENTS_BY_ITEM_ID,
    };

    const first = computeFlowMetrics(input);

    for (let index = 0; index < 5; index += 1) {
      const next = computeFlowMetrics(input);
      expect(next).toEqual(first);
    }
  });
});
