import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ workspaceSlug: string }> };

const CREDIT_COST_TEXT = 3;

async function getCreditsUsed(workspaceId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const jobs = await prisma.aIJob.findMany({
    where: { workspaceId, createdAt: { gte: monthStart } },
    select: { id: true },
  });
  return jobs.length * 2; // rough estimate
}

async function checkAndSpendCredits(workspaceId: string, cost: number): Promise<{ ok: boolean; message?: string }> {
  const plan = await prisma.workspacePlan.findFirst({
    where: { workspaceId },
    select: { aiCreditsMonthly: true },
  });
  const limit = plan?.aiCreditsMonthly ?? 100;
  const used = await getCreditsUsed(workspaceId);
  if (used + cost > limit) {
    return { ok: false, message: `Brak kredytów AI. Użyto: ${used}/${limit}.` };
  }
  return { ok: true };
}

function buildSystemPrompt(channel: string, toneOfVoice: string, summary: string, audience: string): string {
  const channelRules: Record<string, string> = {
    LINKEDIN: "LinkedIn: mocny hook w pierwszej linii, krótkie akapity, wyraźne CTA, maks. 2000 znaków. Pisz po polsku, profesjonalnie.",
    INSTAGRAM: "Instagram: wizualny opis, emocjonalny język, hashtagi na końcu. Maks. 2200 znaków. Pisz po polsku.",
    TIKTOK: "TikTok: krótki, dynamiczny, 150-300 znaków. Pisz po polsku.",
    BLOG: "Blog: struktura nagłówków H2/H3, wstęp, sekcje, podsumowanie, CTA. Pisz po polsku.",
    NEWSLETTER: "Newsletter: temat, krótkie sekcje, actionable CTA. Pisz po polsku.",
    YOUTUBE: "YouTube: opis wideo: hook, opis treści, CTA do subskrypcji/linka. Pisz po polsku.",
    WEBSITE: "Website: propozycja wartości, problem, rozwiązanie, CTA. Pisz po polsku.",
  };
  const rules = channelRules[channel.toUpperCase()] ?? "Pisz profesjonalny post po polsku.";
  return [
    "Jesteś ekspertem copywriting dla polskich marek.",
    rules,
    toneOfVoice ? `Ton głosu: ${toneOfVoice}` : "",
    summary ? `Kontekst projektu: ${summary}` : "",
    audience ? `Grupa docelowa: ${audience}` : "",
    "Generuj gotową treść — nie opisuj co piszesz, tylko napisz post.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(
  title: string,
  channel: string,
  hashtags: string[],
  seoKeywords: string[],
  internalLinks: string[],
  currentBody: string,
): string {
  const parts = [
    title ? `Tytuł / temat: ${title}` : "",
    seoKeywords.length ? `Słowa kluczowe SEO (wpleć naturalnie): ${seoKeywords.join(", ")}` : "",
    internalLinks.length ? `Linki wewnętrzne do wplecenia: ${internalLinks.slice(0, 3).join(", ")}` : "",
    hashtags.length ? `Hasztagi do dodania na końcu: ${hashtags.map((h) => `#${h}`).join(" ")}` : "",
    currentBody?.trim() ? `Istniejąca treść (ulepsz):\n${currentBody}` : "Napisz treść od zera.",
    `Kanał: ${channel}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Return a smart template when key is missing (dev mode)
    return generateTemplate(user);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.75,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "OpenAI error");
  }

  const data = (await res.json()) as { choices: [{ message: { content: string } }] };
  return data.choices[0]?.message.content?.trim() ?? "";
}

function generateTemplate(prompt: string): string {
  const lines = prompt.split("\n").filter(Boolean);
  const titleLine = lines.find((l) => l.startsWith("Tytuł"));
  const title = titleLine?.replace(/^Tytuł \/ temat:\s*/, "") ?? "Twój post";
  const kwLine = lines.find((l) => l.startsWith("Słowa kluczowe"));
  const kw = kwLine?.replace(/^Słowa kluczowe SEO.*?:\s*/, "") ?? "";
  const hashLine = lines.find((l) => l.startsWith("Hasztagi"));
  const hash = hashLine?.replace(/^Hasztagi.*?:\s*/, "") ?? "";

  return [
    `🔥 ${title}`,
    "",
    `Czy wiesz, że ${kw ? `kluczem do sukcesu jest ${kw.split(",")[0]?.trim()}` : "mała zmiana może przynieść ogromne wyniki"}?`,
    "",
    "Wielu przedsiębiorców pomija ten jeden krok, który zmienia wszystko — planowanie treści z wyprzedzeniem.",
    "",
    "Oto 3 rzeczy, które wdrożyliśmy i które zmieniły naszą komunikację:",
    "→ Regularny harmonogram publikacji",
    "→ Treści dopasowane do odbiorcy, nie do algorytmu",
    "→ Mierzenie wyników co tydzień, nie co kwartał",
    "",
    "Który krok jest dla Ciebie najtrudniejszy? Napisz w komentarzu ⬇️",
    "",
    hash ?? "#contentmarketing #marketingcyfrowy #strategiatreści",
  ].join("\n");
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const body = (await req.json()) as {
      title?: string;
      channel?: string;
      hashtags?: string[];
      seoKeywords?: string[];
      internalLinks?: string[];
      currentBody?: string;
      toneOfVoice?: string;
      audience?: string;
      summary?: string;
      projectId?: string;
    };

    const { title = "", channel = "LINKEDIN", hashtags = [], seoKeywords = [], internalLinks = [], currentBody = "", toneOfVoice = "", audience = "", summary = "" } = body;

    // Check and spend credits
    const creditCheck = await checkAndSpendCredits(access.workspace.id, CREDIT_COST_TEXT);
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.message }, { status: 402 });
    }

    // Log AI job
    await prisma.aIJob.create({
      data: {
        workspaceId: access.workspace.id,
        actionType: "GENERATE_DRAFT",
        status: "RUNNING",
        creditsCost: CREDIT_COST_TEXT,
        userId: access.user.id,
        input: { title, channel, seoKeywords, hashtags },
      },
    });

    const system = buildSystemPrompt(channel, toneOfVoice, summary, audience);
    const user = buildUserPrompt(title, channel, hashtags, seoKeywords, internalLinks, currentBody);
    const generatedBody = await callOpenAI(system, user);

    return NextResponse.json({ body: generatedBody, creditCost: CREDIT_COST_TEXT });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
