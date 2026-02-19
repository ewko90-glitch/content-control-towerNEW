import { describe, expect, it } from "vitest";

import { computeOutcomeDedupeKey, shouldAppendOutcome } from "../feedback/store";
import type { OutcomeEvent } from "../feedback/types";

describe("feedback anti-replay dedupe", () => {
  const baseEvent: OutcomeEvent = {
    workspaceId: "ws-test",
    sessionId: "sess-1",
    intent: "fix_overdue_publications",
    occurredAt: "2026-02-15T10:10:20.000Z",
    outcome: "completed",
    evidence: {
      kind: "state_change",
    },
  };

  it("dedupes identical event in the same minute bucket", () => {
    const first = computeOutcomeDedupeKey(baseEvent);
    const second = computeOutcomeDedupeKey({
      ...baseEvent,
      occurredAt: "2026-02-15T10:10:59.999Z",
    });

    expect(second).toBe(first);
    expect(shouldAppendOutcome([first], second)).toBe(false);
  });

  it("does not dedupe across next minute bucket", () => {
    const first = computeOutcomeDedupeKey(baseEvent);
    const second = computeOutcomeDedupeKey({
      ...baseEvent,
      occurredAt: "2026-02-15T10:11:00.000Z",
    });

    expect(second).not.toBe(first);
    expect(shouldAppendOutcome([first], second)).toBe(true);
  });

  it("drops oldest dedupe keys deterministically when bounded", () => {
    const keys = Array.from({ length: 405 }, (_, index) => `k-${index + 1}`);

    while (keys.length > 400) {
      keys.shift();
    }

    expect(keys.length).toBe(400);
    expect(keys[0]).toBe("k-6");
    expect(keys[keys.length - 1]).toBe("k-405");
  });
});
