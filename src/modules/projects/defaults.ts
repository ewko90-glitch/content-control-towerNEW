import type { ProjectContextInput } from "./types";

export type ProjectTemplate = {
  id: "blog-first" | "linkedin-first";
  label: string;
  description: string;
  context: Omit<ProjectContextInput, "name">;
};

export const defaultProjectContext: Omit<ProjectContextInput, "name"> = {
  summary: "",
  audience: "",
  toneOfVoice: "",
  goals: "",
  channels: [],
  keywordsPrimary: [],
  keywordsSecondary: [],
  internalLinks: [
    { url: "", title: "", note: "", anchorHints: [] },
    { url: "", title: "", note: "", anchorHints: [] },
    { url: "", title: "", note: "", anchorHints: [] },
  ],
  externalLinks: [{ url: "", title: "", note: "" }],
};

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "blog-first",
    label: "Content Marketing — Blog First",
    description: "Long-form authority content with SEO depth and conversion-oriented internal linking.",
    context: {
      summary:
        "Build category authority through educational, search-focused blog content that consistently converts strategic readers into pipeline conversations.",
      audience:
        "Growth and marketing leaders in B2B companies who need predictable content systems, stronger organic reach, and better conversion from thought leadership.",
      toneOfVoice: "Strategic, clear, executive, practical",
      goals:
        "Increase qualified organic traffic, improve topical authority, and drive measurable conversion from educational content into commercial intent.",
      channels: ["blog", "newsletter"],
      keywordsPrimary: ["content strategy", "b2b content", "seo framework", "editorial workflow", "content operations"],
      keywordsSecondary: ["topic clusters", "conversion copy", "editorial planning"],
      internalLinks: [
        {
          url: "https://twoja-domena.pl/oferta",
          title: "Oferta",
          note: "Replace with your commercial offer page URL.",
          anchorHints: ["content strategy services", "b2b content support"],
        },
        {
          url: "https://twoja-domena.pl/case-studies",
          title: "Case studies",
          note: "Point to proof and outcomes pages.",
          anchorHints: ["content growth results", "client outcomes"],
        },
        {
          url: "https://twoja-domena.pl/blog",
          title: "Blog hub",
          note: "Use as topical cluster parent page.",
          anchorHints: ["related guides", "read next"],
        },
      ],
      externalLinks: [
        {
          url: "https://developers.google.com/search/docs",
          title: "Google Search Central",
          note: "Reference technical and quality guidance.",
        },
      ],
    },
  },
  {
    id: "linkedin-first",
    label: "Founder Brand — LinkedIn First",
    description: "Executive-led narrative system optimized for weekly reach, trust, and conversation quality.",
    context: {
      summary:
        "Build founder authority through high-signal LinkedIn content that turns expertise into trust, inbound conversations, and strategic opportunities.",
      audience:
        "Founders, commercial leaders, and decision makers evaluating strategic partners, looking for concise, practical thought leadership.",
      toneOfVoice: "Confident, concise, insight-led, human",
      goals:
        "Increase weekly qualified reach, improve engagement quality, and convert strategic attention into meaningful business conversations.",
      channels: ["linkedin", "newsletter"],
      keywordsPrimary: ["founder brand", "linkedin strategy", "thought leadership", "executive content", "brand positioning"],
      keywordsSecondary: ["audience trust", "content cadence", "inbound pipeline"],
      internalLinks: [
        {
          url: "https://twoja-domena.pl/about",
          title: "About",
          note: "Replace with founder profile and positioning page.",
          anchorHints: ["founder perspective", "why we exist"],
        },
        {
          url: "https://twoja-domena.pl/services",
          title: "Services",
          note: "Direct strategic traffic to your offer page.",
          anchorHints: ["work with us", "engagement model"],
        },
        {
          url: "https://twoja-domena.pl/resources",
          title: "Resources",
          note: "Support credibility with deeper materials.",
          anchorHints: ["deep dive", "learn more"],
        },
      ],
      externalLinks: [
        {
          url: "https://business.linkedin.com/marketing-solutions",
          title: "LinkedIn Marketing Solutions",
          note: "Reference platform best practices and formats.",
        },
      ],
    },
  },
];

export function getTemplateById(id: string | null | undefined): ProjectTemplate | null {
  if (!id) {
    return null;
  }
  return projectTemplates.find((template) => template.id === id) ?? null;
}
