import { prisma } from "@/lib/prisma";

import { WorkspaceRole } from "./permissions";

type ContentStatus = "IDEA" | "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

type StatusCounts = Record<ContentStatus, number>;

export type StageItemRaw = {
  id: string;
  status: "DRAFT" | "REVIEW";
  updatedAtISO: string;
};

export type ReviewTransitionRaw = {
  contentItemId: string;
  createdAtISO: string;
};

export type PublicationRaw = {
  id: string;
  scheduledAtISO: string;
  status: string;
  channelId: string;
  contentItemId: string;
};

export type RawInput = {
  workspaceId: string;
  userId: string;
  generatedAtISO: string;
  role: WorkspaceRole;
  statusCounts: StatusCounts;
  totalContent: number;
  overdueCount: number;
  oldestOverdueDueAtISO: string | null;
  stageItems: StageItemRaw[];
  reviewTransitions: ReviewTransitionRaw[];
  publicationItems: PublicationRaw[];
  createdLast7d: number;
  versionsLast7d: number;
  aiJobsLast7d: number;
  creditsRemaining: number;
  monthlyCredits: number;
};

function mapRole(role: string | null | undefined): WorkspaceRole {
  if (role === WorkspaceRole.ADMIN) {
    return WorkspaceRole.ADMIN;
  }
  if (role === WorkspaceRole.MANAGER) {
    return WorkspaceRole.MANAGER;
  }
  if (role === WorkspaceRole.EDITOR) {
    return WorkspaceRole.EDITOR;
  }
  return WorkspaceRole.VIEWER;
}

function initStatusCounts(): StatusCounts {
  return {
    IDEA: 0,
    DRAFT: 0,
    REVIEW: 0,
    APPROVED: 0,
    SCHEDULED: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };
}

function toFriendlyError(): Error {
  return new Error(
    "Nie udało się wczytać danych Control Tower. Sprawdź DATABASE_URL w .env.local i uruchom npx prisma generate.",
  );
}

function assertDatabaseUrlInRuntime(): void {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) {
    throw toFriendlyError();
  }
}

export async function fetchControlTowerRaw(workspaceId: string, userId: string, now: Date): Promise<RawInput> {
  assertDatabaseUrlInRuntime();

  const nowDate = new Date(now);
  const plus7d = new Date(nowDate);
  plus7d.setDate(plus7d.getDate() + 7);

  const minus7d = new Date(nowDate);
  minus7d.setDate(minus7d.getDate() - 7);

  try {
    const membershipWithCredits = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId,
        workspace: { deletedAt: null },
      },
      select: {
        role: true,
        workspace: {
          select: {
            aiCreditAccount: {
              select: {
                creditsMonthly: true,
                creditsUsed: true,
                purchasedCredits: true,
                purchasedCreditsUsed: true,
              },
            },
          },
        },
      },
    });

    const groupedStatuses = await prisma.contentItem.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        deletedAt: null,
      },
      _count: {
        _all: true,
      },
    });

    const overdueAggregate = await prisma.contentItem.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
        dueAt: {
          lt: nowDate,
        },
        status: {
          notIn: ["PUBLISHED", "ARCHIVED"],
        },
      },
      _count: {
        _all: true,
      },
      _min: {
        dueAt: true,
      },
    });

    const stageRows = await prisma.contentItem.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: {
          in: ["DRAFT", "REVIEW"],
        },
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      // MVP guard: limit heavy in-memory calculations for stage aging.
      take: 200,
    });

    const reviewIds = stageRows.filter((row) => row.status === "REVIEW").map((row) => row.id);
    const reviewTransitions =
      reviewIds.length > 0
        ? await prisma.workflowEvent.findMany({
            where: {
              workspaceId,
              toStatus: "REVIEW",
              contentItemId: {
                in: reviewIds,
              },
            },
            select: {
              contentItemId: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 500,
          })
        : [];

    const publicationRows = await prisma.publicationJob.findMany({
      where: {
        workspaceId,
        scheduledAt: {
          gte: nowDate,
          lte: plus7d,
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        channelId: true,
        contentItemId: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
      // MVP guard: timeline should remain bounded for predictable response times.
      take: 200,
    });

    const [createdLast7d, versionsLast7d, aiJobsLast7d] = await Promise.all([
      prisma.contentItem.count({
        where: {
          workspaceId,
          deletedAt: null,
          createdAt: {
            gte: minus7d,
          },
        },
      }),
      prisma.contentVersion.count({
        where: {
          workspaceId,
          createdAt: {
            gte: minus7d,
          },
        },
      }),
      prisma.aIJob.count({
        where: {
          workspaceId,
          createdAt: {
            gte: minus7d,
          },
        },
      }),
    ]);

    const statusCounts = initStatusCounts();
    for (const row of groupedStatuses) {
      const status = row.status as ContentStatus;
      if (status in statusCounts) {
        statusCounts[status] = row._count._all;
      }
    }

    const monthlyCredits = membershipWithCredits?.workspace.aiCreditAccount?.creditsMonthly ?? 0;
    const monthlyUsed = membershipWithCredits?.workspace.aiCreditAccount?.creditsUsed ?? 0;
    const purchased = membershipWithCredits?.workspace.aiCreditAccount?.purchasedCredits ?? 0;
    const purchasedUsed = membershipWithCredits?.workspace.aiCreditAccount?.purchasedCreditsUsed ?? 0;
    const creditsRemaining = Math.max(monthlyCredits - monthlyUsed, 0) + Math.max(purchased - purchasedUsed, 0);

    return {
      workspaceId,
      userId,
      generatedAtISO: nowDate.toISOString(),
      role: mapRole(membershipWithCredits?.role),
      statusCounts,
      totalContent: Object.values(statusCounts).reduce((sum, current) => sum + current, 0),
      overdueCount: overdueAggregate._count._all,
      oldestOverdueDueAtISO: overdueAggregate._min.dueAt ? overdueAggregate._min.dueAt.toISOString() : null,
      stageItems: stageRows.map((row) => ({
        id: row.id,
        status: row.status === "DRAFT" ? "DRAFT" : "REVIEW",
        updatedAtISO: row.updatedAt.toISOString(),
      })),
      reviewTransitions: reviewTransitions.map((row) => ({
        contentItemId: row.contentItemId,
        createdAtISO: row.createdAt.toISOString(),
      })),
      publicationItems: publicationRows.map((row) => ({
        id: row.id,
        scheduledAtISO: row.scheduledAt.toISOString(),
        status: row.status,
        channelId: row.channelId,
        contentItemId: row.contentItemId,
      })),
      createdLast7d,
      versionsLast7d,
      aiJobsLast7d,
      creditsRemaining,
      monthlyCredits,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    throw toFriendlyError();
  }
}

// TODO: STEP 5.3 — zbić liczbę zapytań do <=6 (np. połączyć część countów w jedno aggregate SQL).
