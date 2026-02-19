import { prisma } from "@/lib/prisma";

import type { DashboardRaw, Role } from "./types";

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toRole(input: unknown): Role {
  return input === "ADMIN" || input === "MANAGER" || input === "EDITOR" || input === "VIEWER" ? input : "VIEWER";
}

function dayStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function fallbackRaw(workspaceId: string): DashboardRaw {
  return {
    workspace: {
      id: workspaceId,
      slug: "workspace",
      name: "Workspace",
      role: "VIEWER",
    },
    publicationRows: [],
    counts: {
      total: 0,
      idea: 0,
      draft: 0,
      review: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
      archived: 0,
      overdue: 0,
      overdueMaxAgeDays: 0,
    },
    review: {
      count: 0,
      over48h: 0,
      avgHours: 0,
    },
    activity: {
      content7d: 0,
      aiJobs7d: 0,
      workflow7d: 0,
    },
    credits: {
      remaining: 0,
      monthly: 0,
      usedPct: 0,
    },
  };
}

async function fetchWorkspace(workspaceId: string, userId: string): Promise<DashboardRaw["workspace"]> {
  try {
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId,
        workspace: { deletedAt: null },
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      return fallbackRaw(workspaceId).workspace;
    }

    return {
      id: membership.workspace.id,
      slug: membership.workspace.slug,
      name: membership.workspace.name,
      role: toRole(membership.role),
    };
  } catch {
    return fallbackRaw(workspaceId).workspace;
  }
}

async function fetchCounts(workspaceId: string, now: Date): Promise<DashboardRaw["counts"]> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'IDEA' THEN 1 ELSE 0 END)::int AS idea,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END)::int AS draft,
        SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END)::int AS review,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END)::int AS approved,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END)::int AS scheduled,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END)::int AS published,
        SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END)::int AS archived,
        SUM(CASE WHEN "dueAt" IS NOT NULL AND "dueAt" < $1 AND status NOT IN ('PUBLISHED', 'ARCHIVED') THEN 1 ELSE 0 END)::int AS overdue,
        COALESCE(MAX(CASE WHEN "dueAt" IS NOT NULL AND "dueAt" < $1 AND status NOT IN ('PUBLISHED', 'ARCHIVED') THEN EXTRACT(EPOCH FROM ($1 - "dueAt")) / 86400 ELSE NULL END), 0)::int AS "overdueMaxAgeDays"
      FROM "ContentItem"
      WHERE "workspaceId" = $2
        AND "deletedAt" IS NULL
    `,
      now,
      workspaceId,
    )) as Array<Record<string, unknown>>;

    const first = rows[0] ?? {};
    return {
      total: safeNumber(first.total),
      idea: safeNumber(first.idea),
      draft: safeNumber(first.draft),
      review: safeNumber(first.review),
      approved: safeNumber(first.approved),
      scheduled: safeNumber(first.scheduled),
      published: safeNumber(first.published),
      archived: safeNumber(first.archived),
      overdue: safeNumber(first.overdue),
      overdueMaxAgeDays: safeNumber(first.overdueMaxAgeDays),
    };
  } catch {
    return fallbackRaw(workspaceId).counts;
  }
}

async function fetchReview(workspaceId: string, now: Date): Promise<DashboardRaw["review"]> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `
      WITH review_entries AS (
        SELECT ci.id, MAX(we."createdAt") AS entered_review_at
        FROM "ContentItem" ci
        LEFT JOIN "WorkflowEvent" we
          ON we."contentItemId" = ci.id
          AND we."workspaceId" = $1
          AND we."toStatus" = 'REVIEW'
        WHERE ci."workspaceId" = $1
          AND ci."deletedAt" IS NULL
          AND ci.status = 'REVIEW'
        GROUP BY ci.id
      )
      SELECT
        COUNT(*)::int AS count,
        SUM(CASE WHEN entered_review_at IS NOT NULL AND ($2 - entered_review_at) > INTERVAL '48 hours' THEN 1 ELSE 0 END)::int AS "over48h",
        COALESCE(AVG(CASE WHEN entered_review_at IS NOT NULL THEN EXTRACT(EPOCH FROM ($2 - entered_review_at)) / 3600 ELSE NULL END), 0)::float AS "avgHours"
      FROM review_entries
    `,
      workspaceId,
      now,
    )) as Array<Record<string, unknown>>;

    const first = rows[0] ?? {};
    return {
      count: safeNumber(first.count),
      over48h: safeNumber(first.over48h),
      avgHours: Number(safeNumber(first.avgHours).toFixed(1)),
    };
  } catch {
    return fallbackRaw(workspaceId).review;
  }
}

async function fetchActivity(workspaceId: string, now: Date): Promise<DashboardRaw["activity"]> {
  try {
    const since7d = addDays(now, -7);
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT
        (SELECT COUNT(*)::int FROM "ContentItem" c WHERE c."workspaceId" = $1 AND c."deletedAt" IS NULL AND c."createdAt" >= $2) AS "content7d",
        (SELECT COUNT(*)::int FROM "AIJob" a WHERE a."workspaceId" = $1 AND a."createdAt" >= $2) AS "aiJobs7d",
        (SELECT COUNT(*)::int FROM "WorkflowEvent" w WHERE w."workspaceId" = $1 AND w."createdAt" >= $2) AS "workflow7d"
    `,
      workspaceId,
      since7d,
    )) as Array<Record<string, unknown>>;

    const first = rows[0] ?? {};
    return {
      content7d: safeNumber(first.content7d),
      aiJobs7d: safeNumber(first.aiJobs7d),
      workflow7d: safeNumber(first.workflow7d),
    };
  } catch {
    return fallbackRaw(workspaceId).activity;
  }
}

async function fetchCredits(workspaceId: string): Promise<DashboardRaw["credits"]> {
  try {
    const account = await prisma.aICreditAccount.findUnique({
      where: { workspaceId },
      select: {
        creditsMonthly: true,
        creditsUsed: true,
        purchasedCredits: true,
        purchasedCreditsUsed: true,
      },
    });

    const monthly = account?.creditsMonthly ?? 0;
    const monthlyUsed = account?.creditsUsed ?? 0;
    const purchased = account?.purchasedCredits ?? 0;
    const purchasedUsed = account?.purchasedCreditsUsed ?? 0;
    const total = monthly + purchased;
    const used = monthlyUsed + purchasedUsed;

    return {
      remaining: Math.max(monthly - monthlyUsed, 0) + Math.max(purchased - purchasedUsed, 0),
      monthly,
      usedPct: total === 0 ? 0 : Math.min(1, Math.max(0, used / total)),
    };
  } catch {
    return fallbackRaw(workspaceId).credits;
  }
}

async function fetchPublications(workspaceId: string, now: Date): Promise<DashboardRaw["publicationRows"]> {
  try {
    const start = dayStart(now);
    const end = addDays(start, 7);

    const rows = (await prisma.publicationJob.findMany({
      where: {
        workspaceId,
        scheduledAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        contentItemId: true,
        contentItem: {
          select: {
            title: true,
          },
        },
        channel: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take: 200,
    })) as Array<{
      id: string;
      scheduledAt: Date;
      status: DashboardRaw["publicationRows"][number]["status"];
      contentItemId: string;
      contentItem: { title: string };
      channel: { name: string | null; type: string };
    }>;

    return rows.map((row) => ({
      id: row.id,
      scheduledAt: row.scheduledAt,
      status: row.status,
      contentItemId: row.contentItemId,
      contentTitle: row.contentItem.title,
      channelLabel: row.channel.name ?? row.channel.type,
    }));
  } catch {
    return [];
  }
}

export async function fetchDashboardRaw(workspaceId: string, userId: string, now: Date): Promise<DashboardRaw> {
  const fallback = fallbackRaw(workspaceId);

  const [workspace, counts, review, activity, credits, publicationRows] = await Promise.all([
    fetchWorkspace(workspaceId, userId),
    fetchCounts(workspaceId, now),
    fetchReview(workspaceId, now),
    fetchActivity(workspaceId, now),
    fetchCredits(workspaceId),
    fetchPublications(workspaceId, now),
  ]);

  return {
    workspace: workspace ?? fallback.workspace,
    counts: counts ?? fallback.counts,
    review: review ?? fallback.review,
    activity: activity ?? fallback.activity,
    credits: credits ?? fallback.credits,
    publicationRows: publicationRows ?? [],
  };
}
