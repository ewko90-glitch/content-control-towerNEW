import { describe, expect, it } from "vitest";

import { canonicalizeIntent } from "../intent/intentCanonicalizer";
import { resolveCalendarIntentState, resolveContentIntentState } from "../intent/intentRouter";
import { extractRawIntentParams } from "../intent/intentSchema";

describe("intent routing", () => {
  it("maps fix_overdue_publications to content overdue context deterministically", () => {
    const raw = extractRawIntentParams(new URLSearchParams("intent=fix_overdue_publications&source=control_tower"));
    const canonical = canonicalizeIntent(raw);
    const content = resolveContentIntentState(canonical);

    expect(content).not.toBeNull();
    expect(content?.mode).toBe("list");
    expect(content?.filters.filterKey).toBe("overdue");
  });

  it("maps schedule_next_7_days to calendar next7days", () => {
    const raw = extractRawIntentParams(new URLSearchParams("intent=schedule_next_7_days&source=control_tower"));
    const canonical = canonicalizeIntent(raw);
    const calendar = resolveCalendarIntentState(canonical);

    expect(calendar).not.toBeNull();
    expect(calendar?.mode).toBe("next7days");
  });

  it("ignores invalid intent safely", () => {
    const raw = extractRawIntentParams(new URLSearchParams("intent=unknown_intent"));
    const canonical = canonicalizeIntent(raw);
    const content = resolveContentIntentState(canonical);
    const calendar = resolveCalendarIntentState(canonical);

    expect(canonical.intent).toBeUndefined();
    expect(content).toBeNull();
    expect(calendar).toBeNull();
  });
});
