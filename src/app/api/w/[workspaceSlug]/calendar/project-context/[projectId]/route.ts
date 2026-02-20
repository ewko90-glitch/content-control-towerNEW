import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ workspaceSlug: string; projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceSlug, projectId } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: access.workspace.id, deletedAt: null },
      include: {
        context: true,
        channels: { where: { deletedAt: null }, select: { type: true, name: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Nie znaleziono projektu" }, { status: 404 });
    }

    // Parse seoConfig for hashtags
    const seoConfig = (() => {
      try {
        return (project.seoConfig ?? {}) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const brandProfile = (() => {
      try {
        return (project.brandProfile ?? {}) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    // Parse linkRules for internal links
    const linkRules = (() => {
      try {
        return (project.linkRules ?? {}) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const ctx = project.context;

    // Build defaults from ProjectContext and JSON fields
    const hashtags: string[] = [
      ...(Array.isArray(seoConfig.hashtags) ? (seoConfig.hashtags as string[]) : []),
      ...(Array.isArray(brandProfile.hashtags) ? (brandProfile.hashtags as string[]) : []),
    ];

    const seoKeywords: string[] = [
      ...(Array.isArray(ctx?.keywordsPrimary) ? ctx.keywordsPrimary as string[] : []),
      ...(Array.isArray(ctx?.keywordsSecondary) ? (ctx.keywordsSecondary as string[]) : []),
      ...(Array.isArray(seoConfig.keywords) ? (seoConfig.keywords as string[]) : []),
    ];

    type LinkEntry = { url: string; title?: string; anchorHint?: string };

    const rawInternal = Array.isArray(ctx?.internalLinks) ? (ctx.internalLinks as LinkEntry[]) : [];
    const rawLinkRules = Array.isArray(linkRules.internal) ? (linkRules.internal as LinkEntry[]) : [];

    const internalLinks: string[] = [
      ...rawInternal.map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean),
      ...rawLinkRules.map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean),
    ];

    return NextResponse.json({
      hashtags: [...new Set(hashtags)],
      seoKeywords: [...new Set(seoKeywords)],
      internalLinks: [...new Set(internalLinks)],
      toneOfVoice: ctx?.toneOfVoice ?? "",
      audience: ctx?.audience ?? "",
      summary: ctx?.summary ?? project.description ?? "",
      channels: project.channels.map((c) => c.type),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
