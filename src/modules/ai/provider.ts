import { buildPrompt } from "@/modules/ai/prompts";
import type { AIAssistRequest, AIAssistResponse } from "@/modules/ai/types";

export interface AIProvider {
  generate(req: AIAssistRequest): Promise<AIAssistResponse>;
}

function ensureCta(body: string): string {
  const lower = body.toLowerCase();
  if (lower.includes("sprawdź") || lower.includes("zobacz") || lower.includes("napisz")) {
    return body;
  }
  return `${body}\n\nCTA: Sprawdź kolejne kroki i napisz, co wdrażasz jako pierwsze.`;
}

function ensureHook(body: string, title: string): string {
  const lines = body.split("\n");
  const first = lines[0]?.trim() ?? "";
  const hasHook = first.includes(":") || first.includes("?") || first.includes("!");
  if (hasHook) {
    return body;
  }
  lines[0] = `${title}: jak osiągnąć wynik szybciej?`;
  return lines.join("\n");
}

function ensureKeywords(body: string, keywords: string[]): string {
  const normalizedBody = body.toLowerCase();
  const missing = keywords.filter((keyword) => keyword.trim().length > 0 && !normalizedBody.includes(keyword.toLowerCase()));
  if (missing.length === 0) {
    return body;
  }
  return `${body}\n\nSłowa kluczowe: ${missing.join(", ")}.`;
}

function ensureLinks(
  body: string,
  internalLinks: Array<{ url: string; title: string; anchorHint?: string }>,
  externalLinks: Array<{ url: string; title: string }>,
): string {
  const missingInternal = internalLinks.filter((link) => !body.includes(link.url)).slice(0, 2);
  const missingExternal = externalLinks.filter((link) => !body.includes(link.url)).slice(0, 1);

  if (missingInternal.length === 0 && missingExternal.length === 0) {
    return body;
  }

  const additions = [
    ...missingInternal.map((link) => `[Internal link: ${link.title} | ${link.url} | anchor: ${link.anchorHint ?? "context"}]`),
    ...missingExternal.map((link) => `[External link: ${link.title} | ${link.url}]`),
  ];

  return `${body}\n\n${additions.join("\n")}`;
}

function adaptToChannel(body: string, channel: AIAssistRequest["channel"], title: string): string {
  if (channel === "linkedin") {
    const compressed = body
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 8)
      .join("\n\n");
    return ensureCta(ensureHook(compressed, title));
  }

  if (channel === "newsletter") {
    return [
      `# ${title}`,
      "",
      "## Najważniejszy insight",
      body.split("\n").slice(0, 4).join(" "),
      "",
      "## Co robimy dalej",
      "Ustal priorytety, przypisz właścicieli i zamknij plan publikacji.",
      "",
      "CTA: Zobacz checklistę i odpowiedz, który krok blokuje zespół.",
    ].join("\n");
  }

  return body;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class DeterministicMockProvider implements AIProvider {
  async generate(req: AIAssistRequest): Promise<AIAssistResponse> {
    const prompt = buildPrompt(req);

    let body = req.currentBody;
    const primary = req.planItem?.primaryKeyword ?? req.projectContext.keywordsPrimary[0] ?? "content operations";
    const secondary = (req.planItem?.secondaryKeywords ?? req.projectContext.keywordsSecondary).slice(0, 3);
    const internalLinks = (req.planItem?.internalLinkSuggestions ?? req.projectContext.internalLinks.map((link) => ({
      url: link.url,
      title: link.title,
      anchorHint: link.anchorHints[0],
    }))).slice(0, 2);
    const externalLinks = (req.planItem?.externalLinkSuggestions ?? req.projectContext.externalLinks.map((link) => ({
      url: link.url,
      title: link.title,
    }))).slice(0, 1);

    if (req.action === "improve") {
      body = ensureHook(body, req.title);
      body = ensureCta(body);
      body = `${body}\n\nUlepszenie: poprawiono klarowność i strukturę akapitów.`;
    }

    if (req.action === "seo_optimize") {
      body = ensureKeywords(body, [primary, ...secondary]);
      body = ensureLinks(body, internalLinks, externalLinks);
      body = `${body}\n\nSEO: frazy i linkowanie zostały włączone naturalnie.`;
    }

    if (req.action === "adapt_channel") {
      body = adaptToChannel(body, req.channel, req.title);
      body = ensureKeywords(body, [primary]);
      body = ensureLinks(body, internalLinks, externalLinks);
    }

    return {
      suggestedBody: body,
      suggestedMeta: {
        prompt,
      },
      tokensUsed: estimateTokens(body),
      model: "mock-deterministic",
    };
  }
}

export function getDefaultProvider(): AIProvider {
  return new DeterministicMockProvider();
}
