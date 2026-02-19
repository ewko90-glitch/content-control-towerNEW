import { describe, expect, it } from "vitest";

import { runGuards } from "@/modules/content/guards";
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

describe("runGuards", () => {
  it("returns deterministic score and issue ordering", () => {
    const result = runGuards({
      channel: "blog",
      projectContext,
      draft: {
        body: "# T\n\n## Only one\nNo keywords here",
        meta: {},
      },
    });

    expect(result.issues[0]?.id).toBe("keywords-primary-coverage");
    expect(result.issues[1]?.id).toBe("internal-links-coverage");
    expect(result.issues[2]?.id).toBe("external-links-coverage");
    expect(result.score).toBeLessThan(100);
    expect(result.state).toBe("incomplete");
  });

  it("flags keyword/internal/external link coverage", () => {
    const result = runGuards({
      channel: "newsletter",
      projectContext,
      draft: {
        body: "## Sekcja\nBrak linków i keywordów",
        meta: {},
      },
    });

    const issueIds = result.issues.map((issue) => issue.id);
    expect(issueIds).toContain("keywords-primary-coverage");
    expect(issueIds).toContain("internal-links-coverage");
    expect(issueIds).toContain("external-links-coverage");
  });

  it("checks linkedin length and CTA constraints", () => {
    const longBody = `${"a".repeat(2050)}\ncontent operations editorial workflow enterprise seo`;
    const result = runGuards({
      channel: "linkedin",
      projectContext,
      draft: {
        body: longBody,
        meta: {},
      },
    });

    const issueIds = result.issues.map((issue) => issue.id);
    expect(issueIds).toContain("linkedin-length");
    expect(issueIds).toContain("linkedin-hook");
    expect(issueIds).toContain("linkedin-cta");
  });
});
