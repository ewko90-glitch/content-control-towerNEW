export type ChannelType = "linkedin" | "blog" | "newsletter" | "landing";

export type InternalLink = {
  url: string;
  title: string;
  note?: string;
  anchorHints: string[];
};

export type ExternalLink = {
  url: string;
  title: string;
  note?: string;
};

export type ProjectContextInput = {
  name: string;
  summary: string;
  audience: string;
  toneOfVoice: string;
  goals: string;
  channels: ChannelType[];
  keywordsPrimary: string[];
  keywordsSecondary: string[];
  internalLinks: InternalLink[];
  externalLinks: ExternalLink[];
};

export type ProjectReadiness = {
  score: number;
  state: "incomplete" | "ready";
  missing: { id: string; label: string; fixHint: string }[];
};

export type ProjectValidationError = {
  field: string;
  message: string;
};
