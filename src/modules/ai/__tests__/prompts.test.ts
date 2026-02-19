import { describe, expect, it } from "vitest";

import { buildPrompt } from "@/modules/ai/prompts";

describe("buildPrompt", () => {
  it("includes project summary, channel rules, links, and no-hallucination clause", () => {
    const prompt = buildPrompt({
      action: "seo_optimize",
      channel: "blog",
      title: "Plan title",
      goal: "Increase qualified pipeline",
      angle: "Operational SEO",
      currentBody: "Current body",
      projectContext: {
        name: "Project Atlas",
        summary: "Enterprise content operating system",
        audience: "Marketing leadership",
        toneOfVoice: "Clear and executive",
        goals: "Pipeline growth",
        channels: ["blog", "linkedin"],
        keywordsPrimary: ["content operations"],
        keywordsSecondary: ["editorial workflow"],
        internalLinks: [{ url: "https://example.com/internal", title: "Internal", anchorHints: ["guide"] }],
        externalLinks: [{ url: "https://example.com/external", title: "External" }],
      },
      planItem: {
        primaryKeyword: "content operations",
        secondaryKeywords: ["editorial workflow"],
        internalLinkSuggestions: [{ url: "https://example.com/internal", title: "Internal", anchorHint: "guide" }],
        externalLinkSuggestions: [{ url: "https://example.com/external", title: "External" }],
      },
    });

    expect(prompt.system).toContain("Project summary: Enterprise content operating system");
    expect(prompt.system).toContain("Blog: clear H2/H3 structure");
    expect(prompt.user).toContain("INTERNAL Internal: https://example.com/internal");
    expect(prompt.user).toContain("EXTERNAL External: https://example.com/external");
    expect(prompt.safety).toContain("Do not hallucinate links");
  });
});
