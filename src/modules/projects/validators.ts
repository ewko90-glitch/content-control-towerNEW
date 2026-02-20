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
    label: "Nazwa projektu",
    fixHint: "Podaj nazwe projektu — to fundament kontekstu AI.",
  },
  summary: {
    label: "Opis projektu",
    fixHint: "Dodaj co najmniej 120 znakow opisujacych projekt i jego obietnice.",
  },
  audience: {
    label: "Grupa docelowa",
    fixHint: "Opisz odbiorce — min. 80 znakow, rola i potrzeby.",
  },
  goals: {
    label: "Cele contentu",
    fixHint: "Zdefiniuj mierzalne cele — min. 80 znakow.",
  },
  toneOfVoice: {
    label: "Ton komunikacji",
    fixHint: "Podaj ton — np. ekspercki, przyjazny, bezposredni (min. 3 znaki).",
  },
  channels: {
    label: "Kanaly publikacji",
    fixHint: "Wybierz co najmniej jeden kanal publikacji.",
  },
  keywordsPrimary: {
    label: "Glowne slowa kluczowe",
    fixHint: "Dodaj co najmniej 5 glownych slow kluczowych.",
  },
  keywordsSecondary: {
    label: "Dodatkowe slowa kluczowe",
    fixHint: "Dodaj co najmniej 3 dodatkowe slowa kluczowe.",
  },
  internalLinks: {
    label: "Linki wewnetrzne",
    fixHint: "Dodaj co najmniej 3 linki wewnetrzne (URL i nazwa).",
  },
  externalLinks: {
    label: "Linki zewnetrzne",
    fixHint: "Dodaj co najmniej 1 link zewnetrzny (autorytet, zrodlo).",
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
    errors.push({ field: "name", message: "Nazwa projektu jest wymagana." });
  }
  if (cleanText(input.summary).length < 120) {
    errors.push({ field: "summary", message: "Opis musi miec co najmniej 120 znakow." });
  }
  if (cleanText(input.audience).length < 80) {
    errors.push({ field: "audience", message: "Grupa docelowa musi miec co najmniej 80 znakow." });
  }
  if (cleanText(input.goals).length < 80) {
    errors.push({ field: "goals", message: "Cele musza miec co najmniej 80 znakow." });
  }
  if (cleanText(input.toneOfVoice).length < 3) {
    errors.push({ field: "toneOfVoice", message: "Ton komunikacji musi miec co najmniej 3 znaki." });
  }
  if (input.channels.length < 1) {
    errors.push({ field: "channels", message: "Wybierz co najmniej jeden kanal." });
  }
  if (countNonEmpty(input.keywordsPrimary) < 5) {
    errors.push({ field: "keywordsPrimary", message: "Dodaj co najmniej 5 glownych slow kluczowych." });
  }
  if (countInternalLinks(input.internalLinks) < 3) {
    errors.push({ field: "internalLinks", message: "Dodaj co najmniej 3 linki wewnetrzne z URL i nazwa." });
  }
  if (countExternalLinks(input.externalLinks) < 1) {
    errors.push({ field: "externalLinks", message: "Dodaj co najmniej 1 link zewnetrzny z URL i nazwa." });
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
