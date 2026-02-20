import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ workspaceSlug: string }> };

const CHANNEL_NAMES: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  BLOG: "Blog",
  NEWSLETTER: "Newsletter",
  YOUTUBE: "YouTube",
  WEBSITE: "Website",
  OTHER: "Inne",
};

async function findOrCreateChannel(workspaceId: string, channelType: string) {
  let channel = await prisma.channel.findFirst({
    where: { workspaceId, type: channelType as "LINKEDIN", deletedAt: null },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        workspaceId,
        type: channelType as "LINKEDIN",
        name: CHANNEL_NAMES[channelType] ?? channelType,
      },
    });
  }
  return channel;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    const [items, projects, channels, members] = await Promise.all([
      prisma.contentItem.findMany({
        where: {
          workspaceId: access.workspace.id,
          deletedAt: null,
          dueAt: { gte: from, lte: to },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          channel: { select: { id: true, name: true, type: true } },
          project: { select: { id: true, name: true } },
          currentVersion: { select: { body: true } },
          assignedToUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueAt: "asc" },
      }),
      prisma.project.findMany({
        where: { workspaceId: access.workspace.id, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.channel.findMany({
        where: { workspaceId: access.workspace.id, deletedAt: null },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workspaceMembership.findMany({
        where: { workspaceId: access.workspace.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return NextResponse.json({ items, projects, channels, members: members.map((m) => m.user) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const body = (await req.json()) as {
      title?: string;
      channelType?: string;
      projectId?: string;
      dueAt?: string;
      status?: string;
      bodyText?: string;
      hashtags?: string[];
      seoKeywords?: string[];
      internalLinks?: string[];
      imageUrl?: string;
      assignedToUserId?: string;
    };

    const { title, channelType, projectId, dueAt, status, bodyText, hashtags, seoKeywords, internalLinks, imageUrl, assignedToUserId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });
    }

    let channelId: string | null = null;
    if (channelType) {
      const ch = await findOrCreateChannel(access.workspace.id, channelType);
      channelId = ch.id;
    }

    const STATUS_MAP: Record<string, string> = {
      draft: "DRAFT",
      review: "REVIEW",
      approved: "APPROVED",
      scheduled: "SCHEDULED",
      published: "PUBLISHED",
    };

    const tagsData = JSON.stringify({
      hashtags: hashtags ?? [],
      seoKeywords: seoKeywords ?? [],
      internalLinks: internalLinks ?? [],
      imageUrl: imageUrl ?? "",
    });

    const item = await prisma.contentItem.create({
      data: {
        workspaceId: access.workspace.id,
        projectId: projectId || null,
        channelId,
        title: title.trim(),
        status: (STATUS_MAP[status ?? "draft"] ?? "DRAFT") as "DRAFT",
        dueAt: dueAt ? new Date(dueAt) : null,
        tags: tagsData,
        assignedToUserId: assignedToUserId || null,
      },
    });

    let version = null;
    if (bodyText?.trim()) {
      version = await prisma.contentVersion.create({
        data: {
          workspaceId: access.workspace.id,
          contentItemId: item.id,
          body: bodyText.trim(),
          authorUserId: access.user.id,
          source: "manual",
        },
      });
      await prisma.contentItem.update({
        where: { id: item.id },
        data: { currentVersionId: version.id },
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
