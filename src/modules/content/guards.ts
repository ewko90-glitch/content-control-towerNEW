import type { GuardIssue, GuardRunInput, QualityResult } from "@/modules/content/types";

const CTA_WORDS = ["napisz", "sprawdź", "zobacz", "dołącz", "umów", "pobierz"];

function includesInsensitive(text: string, value: string): boolean {
  return text.toLowerCase().includes(value.trim().toLowerCase());
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function countUrlPlaceholders(text: string, type: "internal" | "external"): number {
  const placeholderPattern =
    type === "internal"
      ? /\[internal link:[^\]]*\|\s*https?:\/\/[^\]\s]+[^\]]*\]/gi
      : /\[external link:[^\]]*\|\s*https?:\/\/[^\]\s]+[^\]]*\]/gi;
  return countMatches(text, placeholderPattern);
}

function scoreFromIssues(issues: GuardIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "high") {
      score -= 20;
      continue;
    }
    if (issue.severity === "medium") {
      score -= 10;
      continue;
    }
    score -= 5;
  }
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

export function runGuards(params: GuardRunInput): QualityResult {
  const issues: GuardIssue[] = [];
  const body = params.draft.body;
  const bodyLower = body.toLowerCase();

  const keywordsFound = params.projectContext.keywordsPrimary
    .filter((keyword) => keyword.trim().length > 0)
    .filter((keyword) => includesInsensitive(body, keyword)).length;

  if (keywordsFound < 3) {
    issues.push({
      id: "keywords-primary-coverage",
      label: "Treść nie pokrywa jeszcze kluczowych tematów",
      fixHint: "Dodaj minimum 3 słowa kluczowe primary do nagłówków lub pierwszych akapitów.",
      severity: "high",
    });
  }

  const internalPlaceholderCount = countUrlPlaceholders(body, "internal");
  const internalUrlCount = params.projectContext.internalLinks.filter((link) => includesInsensitive(body, link.url)).length;
  if (internalPlaceholderCount + internalUrlCount < 2) {
    issues.push({
      id: "internal-links-coverage",
      label: "Brakuje linków wewnętrznych do kolejnych kroków",
      fixHint: "Wstaw 2 linki wewnętrzne z pełnym URL albo placeholdery z URL: [Internal link: tytuł | https://...].",
      severity: "medium",
    });
  }

  const externalPlaceholderCount = countUrlPlaceholders(body, "external");
  const externalUrlCount = params.projectContext.externalLinks.filter((link) => includesInsensitive(body, link.url)).length;
  if (externalPlaceholderCount + externalUrlCount < 1) {
    issues.push({
      id: "external-links-coverage",
      label: "Brakuje linku zewnętrznego dla wiarygodności",
      fixHint: "Dodaj 1 link zewnętrzny z URL albo placeholder: [External link: źródło | https://...].",
      severity: "medium",
    });
  }

  if (params.channel === "linkedin") {
    if (body.length > 2000) {
      issues.push({
        id: "linkedin-length",
        label: "Post LinkedIn przekracza 2000 znaków",
        fixHint: "Skróć treść do 2000 znaków.",
        severity: "low",
      });
    }

    const hookWindow = body.slice(0, 140);
    if (!(hookWindow.includes(":") || hookWindow.includes("?") || hookWindow.includes("!"))) {
      issues.push({
        id: "linkedin-hook",
        label: "Brak mocnego hooka na początku posta",
        fixHint: "Dodaj hook w pierwszych 140 znakach (np. pytanie lub mocne stwierdzenie).",
        severity: "medium",
      });
    }

    const hasCta = CTA_WORDS.some((word) => bodyLower.includes(word));
    if (!hasCta) {
      issues.push({
        id: "linkedin-cta",
        label: "Brak CTA dla LinkedIn",
        fixHint: "Dodaj CTA, np. Napisz, Sprawdź lub Zobacz.",
        severity: "high",
      });
    }
  }

  if (params.channel === "blog") {
    const headingCount = countMatches(body, /^##\s|^###\s/gm);
    if (headingCount < 4) {
      issues.push({
        id: "blog-headings",
        label: "Blog ma za mało sekcji H2/H3",
        fixHint: "Dodaj minimum 4 nagłówki H2/H3.",
        severity: "high",
      });
    }

    const metaDescription = params.draft.meta.metaDescription;
    if (typeof metaDescription !== "string" || metaDescription.trim().length === 0) {
      issues.push({
        id: "blog-meta-description",
        label: "Brak metaDescription",
        fixHint: "Uzupełnij pole metaDescription w metadanych.",
        severity: "medium",
      });
    }
  }

  if (params.channel === "newsletter") {
    const subject = params.draft.meta.subject;
    if (typeof subject !== "string" || subject.trim().length === 0) {
      issues.push({
        id: "newsletter-subject",
        label: "Brak subject dla newslettera",
        fixHint: "Dodaj temat wiadomości w meta.subject.",
        severity: "high",
      });
    }

    const sectionCount = countMatches(body, /^##\s/gm);
    if (sectionCount < 2) {
      issues.push({
        id: "newsletter-sections",
        label: "Newsletter ma za mało sekcji",
        fixHint: "Dodaj minimum 2 sekcje oznaczone nagłówkami.",
        severity: "medium",
      });
    }
  }

  if (params.channel === "landing") {
    if (!includesInsensitive(body, "## CTA")) {
      issues.push({
        id: "landing-cta-section",
        label: "Brak sekcji CTA na landing page",
        fixHint: "Dodaj sekcję '## CTA'.",
        severity: "high",
      });
    }
  }

  const orderedIssues = issues.slice(0, 8);
  const score = scoreFromIssues(orderedIssues);
  const hasHigh = orderedIssues.some((issue) => issue.severity === "high");

  return {
    score,
    state: score >= 80 && !hasHigh ? "ready" : "incomplete",
    issues: orderedIssues,
  };
}
