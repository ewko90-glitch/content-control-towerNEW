import type { ProjectContextInput } from "@/modules/projects/types";

export type ContentChannel = "linkedin" | "blog" | "newsletter" | "landing";
export type ContentStatus = "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
export type ContentPackType = "weekly" | "item";

export type ContentItemInput = {
  projectId: string;
  channel: ContentChannel;
  title: string;
  goal: string;
  angle: string;
};

export type GeneratedDraft = {
  body: string;
  meta: Record<string, unknown>;
};

export type GuardIssue = {
  id: string;
  label: string;
  fixHint: string;
  severity: "low" | "medium" | "high";
};

export type QualityResult = {
  score: number;
  state: "incomplete" | "ready";
  issues: GuardIssue[];
};

export type DraftGenerationInput = {
  projectContext: ProjectContextInput;
  channel: ContentChannel;
  title: string;
  goal: string;
  angle: string;
};

export type GuardRunInput = {
  draft: GeneratedDraft;
  projectContext: ProjectContextInput;
  channel: ContentChannel;
};

export type AIAssistAction = "improve" | "seo_optimize" | "adapt_channel";

export type AIAssistRequest = {
  action: AIAssistAction;
  channel: ContentChannel;
  projectContext: ProjectContextInput;
  planItem?: {
    id?: string;
    clusterId?: string | null;
    clusterLabel?: string | null;
    primaryKeyword?: string | null;
    secondaryKeywords?: string[];
    internalLinkSuggestions?: Array<{ url: string; title: string; anchorHint?: string }>;
    externalLinkSuggestions?: Array<{ url: string; title: string }>;
  };
  currentBody: string;
  title: string;
  goal: string;
  angle: string;
};

export type AIAssistResponse = {
  suggestedBody: string;
  suggestedMeta?: Record<string, unknown>;
  tokensUsed: number;
  model: string;
};

export type PackGenerationResult = {
  packId: string;
  created: number;
  skipped: number;
  items: Array<{ planItemId: string; contentId: string }>;
};
