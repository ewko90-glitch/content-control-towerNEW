import type { ProjectContextInput, ProjectReadiness, ProjectValidationError } from "./types";

const hardRequirementIds = new Set([
  "summary",
  "audience",
  "goals",
  "toneOfVoice",
  "channels",
  "keywordsPrimary",
  "internalLinks",
]);

const requirementMeta: Record<string, { label: string; fixHint: string }> = {
  name: {
    label: "Project name",
    fixHint: "Set a clear project name to anchor your content operations.",
  },
  summary: {
    label: "Project summary",
    fixHint: "Add at least 120 characters explaining the project scope and promise.",
  },
  audience: {
    label: "Audience",
    fixHint: "Describe your audience in at least 80 characters with role and needs.",
  },
  goals: {
    label: "Goals",
    fixHint: "Define at least 80 characters of measurable goals for this project.",
  },
  toneOfVoice: {
    label: "Tone of voice",
    fixHint: "Provide a clear tone with at least 3 characters.",
  },
  channels: {
    label: "Channels",
    fixHint: "Select at least one channel where content will be published.",
  },
  keywordsPrimary: {
    label: "Primary keywords",
    fixHint: "Add at least 5 primary keywords that describe your offer.",
  },
  keywordsSecondary: {
    label: "Secondary keywords",
    fixHint: "Add at least 3 secondary keywords to expand topical coverage.",
  },
  internalLinks: {
    label: "Internal links",
    fixHint: "Add at least 3 internal links to improve topic authority and navigation.",
  },
  externalLinks: {
    label: "External links",
    fixHint: "Add at least 1 external authority link for supporting evidence.",
  },
};

function cleanText(value: string): string {
  return value.trim();
}

function countNonEmpty(items: string[]): number {
  return items.filter((item) => cleanText(item).length > 0).length;
}

function countInternalLinks(items: ProjectContextInput["internalLinks"]): number {
  return items.filter((entry) => cleanText(entry.url).length > 0 && cleanText(entry.title).length > 0).length;
}

function countExternalLinks(items: ProjectContextInput["externalLinks"]): number {
  return items.filter((entry) => cleanText(entry.url).length > 0 && cleanText(entry.title).length > 0).length;
}

function dedupeMissing(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

export function validateProjectContext(input: ProjectContextInput): { errors: ProjectValidationError[] } {
  const errors: ProjectValidationError[] = [];

  if (cleanText(input.name).length === 0) {
    errors.push({ field: "name", message: "Project name is required." });
  }
  if (cleanText(input.summary).length < 120) {
    errors.push({ field: "summary", message: "Summary must be at least 120 characters." });
  }
  if (cleanText(input.audience).length < 80) {
    errors.push({ field: "audience", message: "Audience must be at least 80 characters." });
  }
  if (cleanText(input.goals).length < 80) {
    errors.push({ field: "goals", message: "Goals must be at least 80 characters." });
  }
  if (cleanText(input.toneOfVoice).length < 3) {
    errors.push({ field: "toneOfVoice", message: "Tone of voice must be at least 3 characters." });
  }
  if (input.channels.length < 1) {
    errors.push({ field: "channels", message: "Select at least one channel." });
  }
  if (countNonEmpty(input.keywordsPrimary) < 5) {
    errors.push({ field: "keywordsPrimary", message: "Add at least 5 primary keywords." });
  }
  if (countInternalLinks(input.internalLinks) < 3) {
    errors.push({ field: "internalLinks", message: "Add at least 3 internal links with URL and title." });
  }
  if (countExternalLinks(input.externalLinks) < 1) {
    errors.push({ field: "externalLinks", message: "Add at least 1 external link with URL and title." });
  }

  return { errors };
}

export function computeReadiness(input: ProjectContextInput): ProjectReadiness {
  const missingIds: string[] = [];

  const summaryOk = cleanText(input.summary).length >= 120;
  const audienceOk = cleanText(input.audience).length >= 80;
  const goalsOk = cleanText(input.goals).length >= 80;
  const toneOk = cleanText(input.toneOfVoice).length >= 3;
  const channelsCount = input.channels.length;
  const primaryCount = countNonEmpty(input.keywordsPrimary);
  const secondaryCount = countNonEmpty(input.keywordsSecondary);
  const internalCount = countInternalLinks(input.internalLinks);
  const externalCount = countExternalLinks(input.externalLinks);

  if (cleanText(input.name).length === 0) {
    missingIds.push("name");
  }
  if (!summaryOk) {
    missingIds.push("summary");
  }
  if (!audienceOk) {
    missingIds.push("audience");
  }
  if (!goalsOk) {
    missingIds.push("goals");
  }
  if (!toneOk) {
    missingIds.push("toneOfVoice");
  }
  if (channelsCount < 1) {
    missingIds.push("channels");
  }
  if (primaryCount < 5) {
    missingIds.push("keywordsPrimary");
  }
  if (secondaryCount < 3) {
    missingIds.push("keywordsSecondary");
  }
  if (internalCount < 3) {
    missingIds.push("internalLinks");
  }
  if (externalCount < 1) {
    missingIds.push("externalLinks");
  }

  let score = 0;
  score += summaryOk ? 15 : 0;
  score += audienceOk ? 10 : 0;
  score += goalsOk ? 10 : 0;
  score += primaryCount >= 5 ? 20 : 0;
  score += secondaryCount >= 3 ? 5 : 0;
  score += internalCount >= 3 ? 15 : 0;
  score += externalCount >= 1 ? 10 : 0;
  if (channelsCount >= 2) {
    score += 15;
  } else if (channelsCount >= 1) {
    score += 10;
  }

  const dedupedMissing = dedupeMissing(missingIds);
  const missing = dedupedMissing.map((id) => ({
    id,
    label: requirementMeta[id]?.label ?? id,
    fixHint: requirementMeta[id]?.fixHint ?? "Complete this requirement.",
  }));

  const hasMissingHardRequirement = dedupedMissing.some((id) => hardRequirementIds.has(id));

  return {
    score: Math.max(0, Math.min(100, score)),
    state: score >= 80 && !hasMissingHardRequirement ? "ready" : "incomplete",
    missing,
  };
}
