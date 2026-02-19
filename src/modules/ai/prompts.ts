import type { AIAssistRequest, PromptBundle } from "@/modules/ai/types";

function channelRules(channel: AIAssistRequest["channel"]): string {
  if (channel === "linkedin") {
    return "LinkedIn: strong hook in first line, short paragraphs, clear CTA, <=2000 chars.";
  }
  if (channel === "blog") {
    return "Blog: clear H2/H3 structure, intro, sections, conclusion, CTA, metaDescription.";
  }
  if (channel === "newsletter") {
    return "Newsletter: subject, concise sections, weekly actionable CTA.";
  }
  return "Landing: value proposition, problem, solution, proof, CTA section.";
}

export function buildPrompt(req: AIAssistRequest): PromptBundle {
  const planLinks = [
    ...(req.planItem?.internalLinkSuggestions ?? []).map((link) => `INTERNAL ${link.title}: ${link.url}`),
    ...(req.planItem?.externalLinkSuggestions ?? []).map((link) => `EXTERNAL ${link.title}: ${link.url}`),
  ];

  const keywords = [
    req.planItem?.primaryKeyword ?? "",
    ...((req.planItem?.secondaryKeywords ?? []).slice(0, 3)),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    system: [
      "You are an enterprise copy assistant for Content Control Tower.",
      "Keep output deterministic, concise, and channel-correct.",
      `Channel rules: ${channelRules(req.channel)}`,
      `Tone of voice: ${req.projectContext.toneOfVoice}`,
      `Project summary: ${req.projectContext.summary}`,
    ].join("\n"),
    user: [
      `Action: ${req.action}`,
      `Title: ${req.title}`,
      `Goal: ${req.goal}`,
      `Angle: ${req.angle}`,
      `Primary audience: ${req.projectContext.audience}`,
      `Keywords to include naturally: ${keywords.join(", ") || "none"}`,
      "Approved links:",
      ...(planLinks.length > 0 ? planLinks : ["No explicit plan links provided, use project link suggestions only."]),
      "Current body:",
      req.currentBody,
    ].join("\n"),
    safety: [
      "Do not hallucinate links.",
      "Use only provided internal/external links when adding URLs.",
      "Do not invent product claims not present in source content.",
    ].join(" "),
  };
}
