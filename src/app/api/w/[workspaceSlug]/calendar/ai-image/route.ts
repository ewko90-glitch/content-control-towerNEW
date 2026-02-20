import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ workspaceSlug: string }> };

const CREDIT_COST_IMAGE = 10;

async function callDallE(prompt: string, size: "1024x1024" | "1792x1024" | "1024x1792"): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Return a deterministic placeholder from Picsum based on prompt hash
    const hash = prompt.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 10000, 0);
    return `https://picsum.photos/seed/${hash}/1200/630`;
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `Professional marketing image for social media: ${prompt}. Clean, modern, brand-safe, high-quality.`,
      n: 1,
      size,
      quality: "standard",
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "DALL-E error");
  }

  const data = (await res.json()) as { data: [{ url: string }] };
  return data.data[0]?.url ?? "";
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const body = (await req.json()) as {
      prompt?: string;
      format?: "square" | "landscape" | "portrait";
    };

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt jest wymagany" }, { status: 400 });
    }

    // Check credits (simple check against plan)
    const plan = await prisma.workspacePlan.findFirst({
      where: { workspaceId: access.workspace.id },
      select: { aiCreditsMonthly: true },
    });
    const limit = plan?.aiCreditsMonthly ?? 100;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const usedCount = await prisma.aIJob.count({
      where: { workspaceId: access.workspace.id, createdAt: { gte: monthStart } },
    });
    const approximateUsed = usedCount * 3;

    if (approximateUsed + CREDIT_COST_IMAGE > limit) {
      return NextResponse.json({ error: `Brak kredytów AI. Użyto ok. ${approximateUsed}/${limit}.` }, { status: 402 });
    }

    const sizeMap: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
      square: "1024x1024",
      landscape: "1792x1024",
      portrait: "1024x1792",
    };
    const size = sizeMap[body.format ?? "landscape"] ?? "1792x1024";

    // Log AI job
    await prisma.aIJob.create({
      data: {
        workspaceId: access.workspace.id,
        actionType: "GENERATE_DRAFT",
        status: "RUNNING",
        creditsCost: CREDIT_COST_IMAGE,
        userId: access.user.id,
        input: { prompt, format: body.format },
      },
    });

    const imageUrl = await callDallE(prompt, size);

    return NextResponse.json({ imageUrl, creditCost: CREDIT_COST_IMAGE });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
