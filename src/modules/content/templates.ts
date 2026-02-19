import type { DraftGenerationInput, GeneratedDraft } from "@/modules/content/types";

type PlanDraftMetadata = {
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  internalLinkSuggestions?: Array<{ url: string; title: string; anchorHint?: string }>;
  externalLinkSuggestions?: Array<{ url: string; title: string }>;
};

type DraftInputWithPlan = DraftGenerationInput & {
  plan?: PlanDraftMetadata;
};

function pickPrimaryKeywords(keywords: string[]): string[] {
  return keywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
    .slice(0, 5);
}

function pickHashtags(keywords: string[]): string[] {
  return keywords
    .map((keyword) => keyword.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, ""))
    .filter((keyword) => keyword.length > 1)
    .slice(0, 8)
    .map((keyword) => `#${keyword}`);
}

function buildLinkPlaceholders(
  internalTitle: string,
  externalTitle: string,
  plan?: PlanDraftMetadata,
): string {
  const internalFromPlan = (plan?.internalLinkSuggestions ?? []).slice(0, 2).map((item, index) => {
    const anchor = item.anchorHint ?? `anchor-${index + 1}`;
    return `[Internal link: ${item.title} | ${item.url} | anchor: ${anchor}]`;
  });

  const externalFromPlan = (plan?.externalLinkSuggestions ?? []).slice(0, 1).map((item) => {
    return `[External link: ${item.title} | ${item.url}]`;
  });

  if (internalFromPlan.length >= 2 && externalFromPlan.length >= 1) {
    return [...internalFromPlan, ...externalFromPlan].join("\n");
  }

  return [
    `[Internal link: ${internalTitle} | https://internal.local/link-1 | anchor: insight]`,
    `[Internal link: ${internalTitle} - pogłębienie | https://internal.local/link-2 | anchor: execution]`,
    `[External link: ${externalTitle} | https://external.local/source]`,
  ].join("\n");
}

export function generateDraft(params: DraftInputWithPlan): GeneratedDraft {
  const primaryKeywords = pickPrimaryKeywords(params.projectContext.keywordsPrimary);
  const planPrimary = params.plan?.primaryKeyword?.trim();
  const keywordA = planPrimary && planPrimary.length > 0 ? planPrimary : primaryKeywords[0] ?? "strategia contentowa";
  const keywordB = primaryKeywords[1] ?? "proces publikacji";
  const keywordC = primaryKeywords[2] ?? "wyniki biznesowe";
  const secondaryFromPlan = (params.plan?.secondaryKeywords ?? []).slice(0, 3);
  const internalTitle = params.projectContext.internalLinks[0]?.title ?? "Przewodnik wewnętrzny";
  const externalTitle = params.projectContext.externalLinks[0]?.title ?? "Źródło branżowe";
  const linkPlaceholders = buildLinkPlaceholders(internalTitle, externalTitle, params.plan);
  const planKeywordSection = [
    "## Plan keyword focus",
    `Primary keyword: ${keywordA}`,
    `Secondary keywords: ${(secondaryFromPlan.length > 0 ? secondaryFromPlan : [keywordB, keywordC]).join(", ")}`,
    "",
  ].join("\n");

  if (params.channel === "blog") {
    return {
      body: [
        `# ${params.title}`,
        "",
        `Wstęp: ${params.goal}. W tym materiale pokazujemy podejście przez pryzmat ${keywordA}.`,
        "",
        "## Kontekst i szansa",
        `Skupiamy się na ${keywordA} i wpływie na ${params.angle}.`,
        "",
        "## Podejście operacyjne",
        `Budujemy proces oparty o ${keywordB} oraz mierzalne kroki wykonawcze.`,
        "",
        "### Egzekucja krok po kroku",
        `Każdy etap powinien wspierać ${keywordC} i spójność kanałów.`,
        "",
        "## Rekomendacje i ryzyka",
        "Zdefiniuj właścicieli, terminy i reguły jakości przed publikacją.",
        "",
        "## Podsumowanie + CTA",
        "Zobacz checklistę wdrożeniową i uruchom pilotaż w jednym projekcie.",
        "",
        planKeywordSection,
        linkPlaceholders,
      ].join("\n"),
      meta: {
        metaDescription: `${params.title}: praktyczny plan realizacji celu ${params.goal} z naciskiem na ${params.angle}.`,
      },
    };
  }

  if (params.channel === "linkedin") {
    return {
      body: [
        `${params.title}: jak dowieźć ${params.goal}?`,
        "",
        `Zespoły najczęściej gubią tempo, gdy ${keywordA} nie jest spięte z codzienną egzekucją.`,
        `Dlatego proponujemy prosty framework łączący ${keywordB} i decyzje operacyjne.`,
        "",
        `Efekt: lepsza przewidywalność i mocniejszy wpływ na ${keywordC}.`,
        "",
        "Sprawdź plan wdrożenia i napisz, który etap blokuje Twój zespół.",
        "",
        planKeywordSection,
        linkPlaceholders,
      ].join("\n"),
      meta: {
        hashtags: pickHashtags(primaryKeywords),
      },
    };
  }

  if (params.channel === "newsletter") {
    return {
      body: [
        `# ${params.title}`,
        "",
        "## Sekcja 1: Co się zmienia",
        `Priorytetem w tym tygodniu jest ${params.goal}, szczególnie w obszarze ${keywordA}.`,
        "",
        "## Sekcja 2: Co robimy teraz",
        `Uruchamiamy sekwencję działań dla ${keywordB} i monitorujemy jakość wykonania.`,
        "",
        "## Sekcja 3: Co dalej",
        `Plan na kolejny sprint wzmacnia ${keywordC} i skraca czas publikacji.`,
        "",
        "CTA: Zobacz roadmapę i zgłoś priorytety na kolejny tydzień.",
        "",
        planKeywordSection,
        linkPlaceholders,
      ].join("\n"),
      meta: {
        subject: `${params.title} — plan działań na ten tydzień`,
      },
    };
  }

  return {
    body: [
      `# ${params.title}`,
      "",
      "## Value prop",
      `Dostarczamy ${params.goal} szybciej dzięki operacjonalizacji ${keywordA}.`,
      "",
      "## Problem",
      `Bez procesu ${keywordB} organizacje tracą spójność i jakość komunikacji.`,
      "",
      "## Solution",
      `Proponowane rozwiązanie porządkuje ${params.angle} i daje mierzalny rytm publikacji.`,
      "",
      "## Proof",
      `Wskaźniki jakości rosną, gdy ${keywordC} jest częścią codziennych decyzji.`,
      "",
      "## CTA",
      "Zobacz demo procesu i uruchom projekt pilotażowy w 7 dni.",
      "",
      planKeywordSection,
      linkPlaceholders,
    ].join("\n"),
    meta: {},
  };
}

export function buildWeeklyPackSummary(clusters: Array<{ label: string; keyword: string }>): string {
  const top = clusters.slice(0, 2);
  if (top.length === 0) {
    return "Weekly pack summary: brak wyróżnionych klastrów w tym tygodniu.";
  }

  return [
    "## Weekly Pack Summary",
    ...top.map((cluster, index) => `${index + 1}. ${cluster.label} — keyword: ${cluster.keyword}`),
  ].join("\n");
}
