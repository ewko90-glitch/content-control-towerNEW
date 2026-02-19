import { describe, expect, it } from "vitest";

import { canSpend, estimateCredits, nextMonthBoundary } from "@/modules/ai/credits";

describe("AI credits", () => {
  it("estimateCredits follows deterministic action rules", () => {
    expect(estimateCredits("improve", "blog", 1200)).toBe(1);
    expect(estimateCredits("seo_optimize", "blog", 1200)).toBe(2);
    expect(estimateCredits("adapt_channel", "linkedin", 1200)).toBe(2);
    expect(estimateCredits("seo_optimize", "blog", 5000)).toBe(3);
  });

  it("canSpend validates soft-lock guard", () => {
    expect(canSpend({ monthlyLimit: 10, usedThisMonth: 8, resetAt: new Date() }, 2)).toBe(true);
    expect(canSpend({ monthlyLimit: 10, usedThisMonth: 9, resetAt: new Date() }, 2)).toBe(false);
  });

  it("nextMonthBoundary returns first day of next month", () => {
    const base = new Date("2026-02-16T10:00:00.000Z");
    const boundary = nextMonthBoundary(base);

    expect(boundary.getUTCFullYear()).toBe(2026);
    expect(boundary.getUTCMonth()).toBe(2);
    expect(boundary.getUTCDate()).toBe(1);
  });
});
