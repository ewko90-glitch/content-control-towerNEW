import { describe, expect, it } from "vitest";

import { generateDraft } from "@/modules/content/templates";
import type { ProjectContextInput } from "@/modules/projects/types";

const projectContext: ProjectContextInput = {
  name: "Project Atlas",
  summary: "Summary",
  audience: "CMO",
  toneOfVoice: "Direct",
  goals: "Increase qualified leads",
  channels: ["blog", "linkedin", "newsletter", "landing"],
  keywordsPrimary: ["content operations", "editorial workflow", "enterprise seo", "governance"],
  keywordsSecondary: ["velocity"],
  internalLinks: [
    { url: "https://example.com/internal/guide", title: "Guide", anchorHints: ["guide"] },
    { url: "https://example.com/internal/playbook", title: "Playbook", anchorHints: ["playbook"] },
  ],
  externalLinks: [{ url: "https://external.com/report", title: "Report" }],
};

describe("generateDraft", () => {
  it("blog generates headings and metaDescription", () => {
    const draft = generateDraft({
      projectContext,
      channel: "blog",
      title: "Blog title",
      goal: "Scale quality",
      angle: "operations",
    });

    expect(draft.body).toContain("## Kontekst i szansa");
    expect(draft.body).toContain("### Egzekucja krok po kroku");
    expect(typeof draft.meta.metaDescription).toBe("string");
    expect(String(draft.meta.metaDescription)).toContain("Blog title");
  });

  it("linkedin generates deterministic hashtags in meta", () => {
    const draft = generateDraft({
      projectContext,
      channel: "linkedin",
      title: "LinkedIn title",
      goal: "Drive pipeline",
      angle: "B2B",
    });

    const hashtags = draft.meta.hashtags as string[];
    expect(hashtags).toEqual(["#contentoperations", "#editorialworkflow", "#enterpriseseo", "#governance"]);
  });
});
