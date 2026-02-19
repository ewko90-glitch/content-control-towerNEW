import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { createAuditLog } from "../../../../lib/auth/audit";
import { getRequestMeta } from "../../../../lib/auth/request";
import { getUserFromRequest } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

type PlanTier = "STARTER" | "PRO" | "CONTROL";
type ChannelType = "BLOG" | "LINKEDIN" | "TIKTOK" | "INSTAGRAM" | "NEWSLETTER" | "YOUTUBE" | "WEBSITE" | "OTHER";

const PLAN_LIMITS: Record<PlanTier, { seats: number; projects: number; channels: number; storageMb: number; aiCredits: number }> = {
  STARTER: { seats: 3, projects: 5, channels: 10, storageMb: 2048, aiCredits: 5000 },
  PRO: { seats: 10, projects: 25, channels: 50, storageMb: 10240, aiCredits: 25000 },
  CONTROL: { seats: 100, projects: 500, channels: 1000, storageMb: 102400, aiCredits: 200000 },
};

const ALLOWED_CHANNELS: ChannelType[] = ["BLOG", "LINKEDIN", "TIKTOK", "INSTAGRAM", "NEWSLETTER", "YOUTUBE", "WEBSITE", "OTHER"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function buildUniqueWorkspaceSlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "workspace";
  let slug = base;
  let attempt = 1;

  while (attempt < 20) {
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      return slug;
    }
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return `${base}-${Date.now()}`;
}

function buildProjectSlug(name: string): string {
  return slugify(name) || `projekt-${Date.now()}`;
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await request.formData();
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const planTier = String(formData.get("planTier") ?? "STARTER") as PlanTier;
  const projectName = String(formData.get("projectName") ?? "").trim();
  const channels = formData
    .getAll("channels")
    .map((item) => String(item))
    .filter((item): item is ChannelType => ALLOWED_CHANNELS.includes(item as ChannelType));

  if (!workspaceName || !projectName) {
    return NextResponse.json({ error: "Wypełnij wymagane pola" }, { status: 400 });
  }

  const limits = PLAN_LIMITS[planTier] ?? PLAN_LIMITS.STARTER;
  const workspaceSlug = await buildUniqueWorkspaceSlug(workspaceName);
  const projectSlug = buildProjectSlug(projectName);

  const cycleStartAt = new Date();
  const cycleEndAt = new Date(cycleStartAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const requestMeta = getRequestMeta(request);

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
        ownerId: user.id,
      },
    });

    await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "ADMIN",
      },
    });

    await tx.workspacePlan.create({
      data: {
        workspaceId: workspace.id,
        tier: planTier,
        seatsLimit: limits.seats,
        projectsLimit: limits.projects,
        channelsLimit: limits.channels,
        storageMbLimit: limits.storageMb,
        aiCreditsMonthly: limits.aiCredits,
      },
    });

    await tx.workspaceUsage.create({
      data: {
        workspaceId: workspace.id,
        seatsUsed: 1,
        projectsUsed: 1,
        channelsUsed: channels.length,
        storageMbUsed: 0,
      },
    });

    await tx.aICreditAccount.create({
      data: {
        workspaceId: workspace.id,
        cycleStartAt,
        cycleEndAt,
        creditsMonthly: limits.aiCredits,
        creditsUsed: 0,
      },
    });

    const project = await tx.project.create({
      data: {
        workspaceId: workspace.id,
        name: projectName,
        slug: projectSlug,
      },
    });

    if (channels.length > 0) {
      await tx.channel.createMany({
        data: channels.map((channelType) => ({
          workspaceId: workspace.id,
          projectId: project.id,
          type: channelType,
          name: channelType,
        })),
      });
    }

    await tx.onboardingState.create({
      data: {
        workspaceId: workspace.id,
        currentStep: "DONE",
        completedAt: new Date(),
        meta: {
          chosenPlan: planTier,
          chosenChannels: channels,
        },
      },
    });

    await tx.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        lastWorkspaceId: workspace.id,
      },
      update: {
        lastWorkspaceId: workspace.id,
      },
    });

    return { workspace, project };
  });

  await createAuditLog({
    action: "WORKSPACE_CREATED",
    userId: user.id,
    workspaceId: created.workspace.id,
    entityType: "Workspace",
    entityId: created.workspace.id,
    ip: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  await createAuditLog({
    action: "PROJECT_CREATED",
    userId: user.id,
    workspaceId: created.workspace.id,
    entityType: "Project",
    entityId: created.project.id,
    ip: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  for (const channelType of channels) {
    await createAuditLog({
      action: "CHANNEL_CREATED",
      userId: user.id,
      workspaceId: created.workspace.id,
      entityType: "Channel",
      metadata: { type: channelType },
      ip: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  }

  return NextResponse.redirect(new URL("/overview", request.url));
}
