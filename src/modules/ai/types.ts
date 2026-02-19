import type { ContentChannel, AIAssistAction } from "@/modules/content/types";
import type { ProjectContextInput } from "@/modules/projects/types";

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

export type PromptBundle = {
  system: string;
  user: string;
  safety: string;
};
