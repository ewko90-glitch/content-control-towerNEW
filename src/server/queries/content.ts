import { prisma } from "@/lib/prisma";

export type ContentListItem = {
  id: string;
  planId: string | null;
  planItemId: string | null;
  packId: string | null;
  packType: string | null;
  packLabel: string | null;
  publishDate: string | null;
  title: string;
  projectName: string;
  channel: "linkedin" | "blog" | "newsletter" | "landing";
  status: "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
  primaryKeyword: string | null;
  qualityScore: number;
  qualityState: "incomplete" | "ready";
  updatedAt: string;
};

export type ContentVersionRecord = {
  id: string;
  version: number;
  body: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type ContentDetailRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  goal: string;
  angle: string;
  planId: string | null;
  planItemId: string | null;
  packId: string | null;
  packType: string | null;
  packLabel: string | null;
  publishDate: string | null;
  clusterId: string | null;
  clusterLabel: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  internalLinkSuggestions: Array<{ url: string; title: string; anchorHint?: string }>;
  externalLinkSuggestions: Array<{ url: string; title: string }>;
  aiGenerationUsed: boolean;
  aiTokensUsed: number;
  channel: "linkedin" | "blog" | "newsletter" | "landing";
  status: "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
  qualityScore: number;
  qualityState: "incomplete" | "ready";
  qualityIssues: Array<{ id: string; label: string; fixHint: string; severity: "low" | "medium" | "high" }>;
  updatedAt: string;
  performance: {
    views: number | null;
    clicks: number | null;
    leads: number | null;
    rating: number | null;
    updatedAt: string | null;
  };
  project: {
    id: string;
    name: string;
    context: Record<string, unknown> | null;
  };
  versions: ContentVersionRecord[];
};

export async function listContentItems(workspaceId: string): Promise<ContentListItem[]> {
  const itemModel = (prisma as unknown as { contentBuilderItem: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> } }).contentBuilderItem;
  const items = await itemModel.findMany({
    where: { workspaceId },
    include: { project: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return items.map((item) => {
    const project = item.project as Record<string, unknown> | undefined;
    return {
      id: String(item.id),
      planId: item.planId ? String(item.planId) : null,
      planItemId: item.planItemId ? String(item.planItemId) : null,
      packId: item.packId ? String(item.packId) : null,
      packType: item.packType ? String(item.packType) : null,
      packLabel: item.packLabel ? String(item.packLabel) : null,
      publishDate: item.publishDate ? new Date(item.publishDate as Date).toISOString() : null,
      title: String(item.title),
      projectName: String(project?.name ?? "Unknown project"),
      channel: (item.channel as ContentListItem["channel"]) ?? "blog",
      status: (item.status as ContentListItem["status"]) ?? "draft",
      primaryKeyword: item.primaryKeyword ? String(item.primaryKeyword) : null,
      qualityScore: Number(item.qualityScore ?? 0),
      qualityState: item.qualityState === "ready" ? "ready" : "incomplete",
      updatedAt: new Date(item.updatedAt as Date).toISOString(),
    };
  });
}

export async function getContentItem(contentId: string, workspaceId: string): Promise<ContentDetailRecord | null> {
  const model = prisma as unknown as {
    contentBuilderItem: { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> };
    contentPerformance: { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> };
  };

  const item = await model.contentBuilderItem.findFirst({
    where: { id: contentId, workspaceId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          context: true,
        },
      },
      versions: {
        orderBy: {
          version: "desc",
        },
      },
    },
  });

  if (!item) {
    return null;
  }

  const performance = await model.contentPerformance.findFirst({
    where: {
      contentId,
    },
    select: {
      views: true,
      clicks: true,
      leads: true,
      rating: true,
      updatedAt: true,
    },
  });

  const project = item.project as Record<string, unknown>;
  const versions = ((item.versions as Array<Record<string, unknown>> | undefined) ?? []).map((version) => ({
    id: String(version.id),
    version: Number(version.version),
    body: String(version.body),
    meta: (version.meta as Record<string, unknown>) ?? {},
    createdAt: new Date(version.createdAt as Date).toISOString(),
  }));

  const qualityIssues = Array.isArray(item.qualityIssues)
    ? (item.qualityIssues as ContentDetailRecord["qualityIssues"])
    : [];

  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    projectId: String(item.projectId),
    title: String(item.title),
    goal: String(item.goal),
    angle: String(item.angle),
    planId: item.planId ? String(item.planId) : null,
    planItemId: item.planItemId ? String(item.planItemId) : null,
    packId: item.packId ? String(item.packId) : null,
    packType: item.packType ? String(item.packType) : null,
    packLabel: item.packLabel ? String(item.packLabel) : null,
    publishDate: item.publishDate ? new Date(item.publishDate as Date).toISOString() : null,
    clusterId: item.clusterId ? String(item.clusterId) : null,
    clusterLabel: item.clusterLabel ? String(item.clusterLabel) : null,
    primaryKeyword: item.primaryKeyword ? String(item.primaryKeyword) : null,
    secondaryKeywords: Array.isArray(item.secondaryKeywords) ? item.secondaryKeywords.map((value) => String(value)) : [],
    internalLinkSuggestions: Array.isArray(item.internalLinkSuggestions)
      ? item.internalLinkSuggestions.map((link) => {
          const value = link as Record<string, unknown>;
          return {
            url: String(value.url ?? ""),
            title: String(value.title ?? ""),
            anchorHint: typeof value.anchorHint === "string" ? value.anchorHint : undefined,
          };
        })
      : [],
    externalLinkSuggestions: Array.isArray(item.externalLinkSuggestions)
      ? item.externalLinkSuggestions.map((link) => {
          const value = link as Record<string, unknown>;
          return {
            url: String(value.url ?? ""),
            title: String(value.title ?? ""),
          };
        })
      : [],
    aiGenerationUsed: Boolean(item.aiGenerationUsed),
    aiTokensUsed: Number(item.aiTokensUsed ?? 0),
    channel: (item.channel as ContentDetailRecord["channel"]) ?? "blog",
    status: (item.status as ContentDetailRecord["status"]) ?? "draft",
    qualityScore: Number(item.qualityScore ?? 0),
    qualityState: item.qualityState === "ready" ? "ready" : "incomplete",
    qualityIssues,
    updatedAt: new Date(item.updatedAt as Date).toISOString(),
    performance: {
      views: typeof performance?.views === "number" ? Number(performance.views) : null,
      clicks: typeof performance?.clicks === "number" ? Number(performance.clicks) : null,
      leads: typeof performance?.leads === "number" ? Number(performance.leads) : null,
      rating: typeof performance?.rating === "number" ? Number(performance.rating) : null,
      updatedAt: performance?.updatedAt ? new Date(performance.updatedAt as Date).toISOString() : null,
    },
    project: {
      id: String(project.id),
      name: String(project.name),
      context: (project.context as Record<string, unknown>) ?? null,
    },
    versions,
  };
}
