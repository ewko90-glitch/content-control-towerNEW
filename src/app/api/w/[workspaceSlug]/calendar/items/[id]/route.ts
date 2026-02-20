import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ workspaceSlug: string; id: string }> };

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

const STATUS_MAP: Record<string, string> = {
  draft: "DRAFT",
  review: "REVIEW",
  approved: "APPROVED",
  scheduled: "SCHEDULED",
  published: "PUBLISHED",
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug, id } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const existing = await prisma.contentItem.findFirst({
      where: { id, workspaceId: access.workspace.id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

    const body = (await req.json()) as {
      title?: string;
      channelType?: string | null;
      projectId?: string | null;
      dueAt?: string | null;
      status?: string;
      bodyText?: string;
      hashtags?: string[];
      seoKeywords?: string[];
      internalLinks?: string[];
      imageUrl?: string;
      assignedToUserId?: string | null;
    };

    const { title, channelType, projectId, dueAt, status, bodyText, hashtags, seoKeywords, internalLinks, imageUrl, assignedToUserId } = body;

    // Resolve channelId
    let channelId: string | null | undefined = undefined;
    if (channelType !== undefined) {
      if (!channelType) {
        channelId = null;
      } else {
        let ch = await prisma.channel.findFirst({
          where: { workspaceId: access.workspace.id, type: channelType as "LINKEDIN", deletedAt: null },
        });
        if (!ch) {
          ch = await prisma.channel.create({
            data: {
              workspaceId: access.workspace.id,
              type: channelType as "LINKEDIN",
              name: CHANNEL_NAMES[channelType] ?? channelType,
            },
          });
        }
        channelId = ch.id;
      }
    }

    const existingTags = (() => {
      try {
        return JSON.parse(existing.tags ?? "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const tagsData = JSON.stringify({
      hashtags: hashtags ?? existingTags.hashtags ?? [],
      seoKeywords: seoKeywords ?? existingTags.seoKeywords ?? [],
      internalLinks: internalLinks ?? existingTags.internalLinks ?? [],
      imageUrl: imageUrl ?? existingTags.imageUrl ?? "",
    });

    const updated = await prisma.contentItem.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(channelId !== undefined ? { channelId } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
        ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
        ...(status !== undefined ? { status: (STATUS_MAP[status] ?? "DRAFT") as "DRAFT" } : {}),
        tags: tagsData,
        ...(assignedToUserId !== undefined ? { assignedToUserId: assignedToUserId || null } : {}),
      },
      include: {
        channel: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
        currentVersion: { select: { body: true } },
      },
    });

    if (bodyText !== undefined && bodyText?.trim()) {
      const version = await prisma.contentVersion.create({
        data: {
          workspaceId: access.workspace.id,
          contentItemId: id,
          body: bodyText.trim(),
          authorUserId: access.user.id,
          source: "manual",
        },
      });
      await prisma.contentItem.update({
        where: { id },
        data: { currentVersionId: version.id },
      });
    }

    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug, id } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const existing = await prisma.contentItem.findFirst({
      where: { id, workspaceId: access.workspace.id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

    await prisma.contentItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
