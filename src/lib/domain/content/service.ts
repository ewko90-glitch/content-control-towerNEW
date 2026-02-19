import type { AIActionType, ContentType, Prisma, Role, WorkflowStatus } from "@prisma/client";

import { createAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/prisma";

import { queueAiJob } from "./ai";
import { ContentDomainError } from "./errors";
import { notifyWorkflow } from "./notifications";
import { assertContentPermission } from "./permissions";
import { assertTransitionAllowed, getTransitionDirection } from "./transitions";

export type ContentContext = {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  role: Role;
};

export async function listContentBoard(context: ContentContext) {
  return prisma.contentItem.findMany({
    where: {
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      currentVersion: {
        select: {
          id: true,
          createdAt: true,
          source: true,
        },
      },
    },
    orderBy: [
      {
        priority: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });
}

export async function listCalendarItems(context: ContentContext, weekStart: Date, weekEnd: Date) {
  return prisma.publicationJob.findMany({
    where: {
      workspaceId: context.workspaceId,
      scheduledAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      contentItem: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });
}

export async function getContentItemDetail(context: ContentContext, itemId: string) {
  const item = await prisma.contentItem.findFirst({
    where: {
      id: itemId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    include: {
      assignedToUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      channel: true,
      project: true,
      currentVersion: true,
      versions: {
        orderBy: {
          createdAt: "desc",
        },
      },
      workflowEvents: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
      approvals: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      publicationJobs: {
        orderBy: {
          scheduledAt: "desc",
        },
        take: 10,
      },
      aiJobs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      exports: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!item) {
    throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
  }

  return item;
}

type CreateContentInput = {
  title: string;
  type?: ContentType;
  projectId?: string | null;
  channelId?: string | null;
  dueAt?: Date | null;
  tags?: string | null;
  priority?: number;
};

export async function createContentItem(context: ContentContext, input: CreateContentInput) {
  assertContentPermission(context.role, "create");

  const title = input.title.trim();
  if (title.length < 3) {
    throw new ContentDomainError("VALIDATION_ERROR", "Tytuł musi mieć co najmniej 3 znaki.", 400);
  }

  const item = await prisma.contentItem.create({
    data: {
      workspaceId: context.workspaceId,
      title,
      type: input.type ?? "POST",
      projectId: input.projectId ?? null,
      channelId: input.channelId ?? null,
      dueAt: input.dueAt ?? null,
      tags: input.tags ?? null,
      priority: input.priority ?? 0,
      workflowEvents: {
        create: {
          workspaceId: context.workspaceId,
          fromStatus: "IDEA",
          toStatus: "IDEA",
          direction: "JUMP",
          changedByUserId: context.userId,
          note: "Utworzono element treści",
        },
      },
    },
  });

  await createAuditLog({
    action: "CONTENT_CREATED",
    userId: context.userId,
    workspaceId: context.workspaceId,
    entityType: "ContentItem",
    entityId: item.id,
  });

  return item;
}

type UpdateContentInput = {
  title?: string;
  channelId?: string | null;
  projectId?: string | null;
  dueAt?: Date | null;
  assignedToUserId?: string | null;
  tags?: string | null;
  priority?: number;
};

export async function updateContentItem(context: ContentContext, itemId: string, input: UpdateContentInput) {
  assertContentPermission(context.role, "update");

  const existing = await prisma.contentItem.findFirst({
    where: {
      id: itemId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
  }

  const updated = await prisma.contentItem.update({
    where: {
      id: existing.id,
    },
    data: {
      title: typeof input.title === "string" ? input.title.trim() || existing.title : undefined,
      channelId: input.channelId,
      projectId: input.projectId,
      dueAt: input.dueAt,
      assignedToUserId: input.assignedToUserId,
      tags: input.tags,
      priority: input.priority,
    },
  });

  await createAuditLog({
    action: "CONTENT_UPDATED",
    userId: context.userId,
    workspaceId: context.workspaceId,
    entityType: "ContentItem",
    entityId: updated.id,
  });

  return updated;
}

export async function moveContentItem(context: ContentContext, itemId: string, toStatus: WorkflowStatus, note?: string) {
  assertContentPermission(context.role, "move", toStatus);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.contentItem.findFirst({
      where: {
        id: itemId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
    }

    assertTransitionAllowed(existing.status, toStatus);

    const updated = await tx.contentItem.update({
      where: {
        id: existing.id,
      },
      data: {
        status: toStatus,
      },
    });

    await tx.workflowEvent.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: existing.id,
        fromStatus: existing.status,
        toStatus,
        direction: getTransitionDirection(existing.status, toStatus),
        changedByUserId: context.userId,
        note: note ?? null,
      },
    });

    await createAuditLog({
      action: "CONTENT_MOVED",
      userId: context.userId,
      workspaceId: context.workspaceId,
      entityType: "ContentItem",
      entityId: existing.id,
      metadata: {
        fromStatus: existing.status,
        toStatus,
      },
    });

    return updated;
  });
}

export async function createContentVersion(
  context: ContentContext,
  itemId: string,
  body: string,
  source = "manual",
  promptSnapshot?: Prisma.InputJsonValue,
) {
  assertContentPermission(context.role, "version");

  if (body.trim().length < 5) {
    throw new ContentDomainError("VALIDATION_ERROR", "Treść wersji jest zbyt krótka.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({
      where: {
        id: itemId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
    }

    const version = await tx.contentVersion.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        body,
        authorUserId: context.userId,
        source,
        promptSnapshot,
      },
    });

    await tx.contentItem.update({
      where: {
        id: item.id,
      },
      data: {
        currentVersionId: version.id,
      },
    });

    await createAuditLog({
      action: "CONTENT_VERSION_CREATED",
      userId: context.userId,
      workspaceId: context.workspaceId,
      entityType: "ContentVersion",
      entityId: version.id,
      metadata: {
        contentItemId: item.id,
        source,
      },
    });

    return version;
  });
}

export async function approveContentItem(context: ContentContext, itemId: string, note?: string) {
  assertContentPermission(context.role, "approval");

  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({
      where: {
        id: itemId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
    }

    assertTransitionAllowed(item.status, "APPROVED");

    const approval = await tx.approval.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        requestedByUserId: context.userId,
        decidedByUserId: context.userId,
        status: "APPROVED",
        note: note ?? null,
        decidedAt: new Date(),
      },
    });

    await tx.contentItem.update({
      where: {
        id: item.id,
      },
      data: {
        status: "APPROVED",
      },
    });

    await tx.workflowEvent.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        fromStatus: item.status,
        toStatus: "APPROVED",
        direction: getTransitionDirection(item.status, "APPROVED"),
        changedByUserId: context.userId,
        note: note ?? "Zaakceptowano",
      },
    });

    await createAuditLog({
      action: "CONTENT_APPROVED",
      userId: context.userId,
      workspaceId: context.workspaceId,
      entityType: "ContentItem",
      entityId: item.id,
      metadata: {
        approvalId: approval.id,
      },
    });

    return approval;
  });
}

export async function rejectContentItem(context: ContentContext, itemId: string, note: string) {
  assertContentPermission(context.role, "approval");

  const rejectionNote = note.trim();
  if (rejectionNote.length < 3) {
    throw new ContentDomainError("VALIDATION_ERROR", "Podaj powód odrzucenia (min. 3 znaki).", 400);
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({
      where: {
        id: itemId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
    }

    assertTransitionAllowed(item.status, "DRAFT");

    const approval = await tx.approval.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        requestedByUserId: context.userId,
        decidedByUserId: context.userId,
        status: "REJECTED",
        note: rejectionNote,
        decidedAt: new Date(),
      },
    });

    await tx.contentItem.update({
      where: {
        id: item.id,
      },
      data: {
        status: "DRAFT",
      },
    });

    await tx.workflowEvent.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        fromStatus: item.status,
        toStatus: "DRAFT",
        direction: getTransitionDirection(item.status, "DRAFT"),
        changedByUserId: context.userId,
        note: rejectionNote,
      },
    });

    await createAuditLog({
      action: "CONTENT_REJECTED",
      userId: context.userId,
      workspaceId: context.workspaceId,
      entityType: "ContentItem",
      entityId: item.id,
      metadata: {
        approvalId: approval.id,
      },
    });

    await notifyWorkflow({
      workspaceId: context.workspaceId,
      title: "Treść odrzucona",
      body: `Element \"${item.title}\" został odrzucony i cofnięty do DRAFT.`,
    });

    return approval;
  });
}

export async function schedulePublication(context: ContentContext, itemId: string, channelId: string, scheduledAt: Date) {
  assertContentPermission(context.role, "schedule");

  if (scheduledAt <= new Date()) {
    throw new ContentDomainError("VALIDATION_ERROR", "Data publikacji musi być w przyszłości.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({
      where: {
        id: itemId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
    }

    const channel = await tx.channel.findFirst({
      where: {
        id: channelId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (!channel) {
      throw new ContentDomainError("NOT_FOUND", "Nie znaleziono kanału publikacji.", 404);
    }

    assertTransitionAllowed(item.status, "SCHEDULED");

    const publicationJob = await tx.publicationJob.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        channelId: channel.id,
        scheduledAt,
        status: "PLANNED",
      },
    });

    await tx.contentItem.update({
      where: {
        id: item.id,
      },
      data: {
        status: "SCHEDULED",
        channelId: channel.id,
      },
    });

    await tx.workflowEvent.create({
      data: {
        workspaceId: context.workspaceId,
        contentItemId: item.id,
        fromStatus: item.status,
        toStatus: "SCHEDULED",
        direction: getTransitionDirection(item.status, "SCHEDULED"),
        changedByUserId: context.userId,
        note: `Zaplanowano publikację na ${scheduledAt.toISOString()}`,
      },
    });

    await createAuditLog({
      action: "CONTENT_SCHEDULED",
      userId: context.userId,
      workspaceId: context.workspaceId,
      entityType: "PublicationJob",
      entityId: publicationJob.id,
      metadata: {
        contentItemId: item.id,
        channelId: channel.id,
        scheduledAt: scheduledAt.toISOString(),
      },
    });

    return publicationJob;
  });
}

export async function queueContentAiAction(
  context: ContentContext,
  actionType: AIActionType,
  contentItemId?: string,
  input?: Prisma.InputJsonValue,
) {
  assertContentPermission(context.role, "ai");

  return prisma.$transaction(async (tx) => {
    if (contentItemId) {
      const item = await tx.contentItem.findFirst({
        where: {
          id: contentItemId,
          workspaceId: context.workspaceId,
          deletedAt: null,
        },
      });

      if (!item) {
        throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
      }
    }

    const job = await queueAiJob({
      tx,
      workspaceId: context.workspaceId,
      userId: context.userId,
      contentItemId,
      actionType,
      input,
    });

    return {
      ...job,
      output: {
        message: "To jest stub kolejki AI. Job został zapisany w bazie jako QUEUED.",
      },
    };
  });
}

export async function exportContentItem(context: ContentContext, itemId: string, format: "json" | "md" = "json") {
  assertContentPermission(context.role, "export");

  const item = await prisma.contentItem.findFirst({
    where: {
      id: itemId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    include: {
      currentVersion: true,
      channel: true,
      project: true,
    },
  });

  if (!item) {
    throw new ContentDomainError("NOT_FOUND", "Nie znaleziono elementu treści.", 404);
  }

  const payload = {
    id: item.id,
    title: item.title,
    status: item.status,
    type: item.type,
    dueAt: item.dueAt?.toISOString() ?? null,
    tags: item.tags,
    project: item.project?.name ?? null,
    channel: item.channel?.name ?? null,
    body: item.currentVersion?.body ?? "",
    exportedAt: new Date().toISOString(),
  };

  const exportRecord = await prisma.contentExport.create({
    data: {
      workspaceId: context.workspaceId,
      contentItemId: item.id,
      format,
      payload,
    },
  });

  await createAuditLog({
    action: "CONTENT_EXPORTED",
    userId: context.userId,
    workspaceId: context.workspaceId,
    entityType: "ContentExport",
    entityId: exportRecord.id,
    metadata: {
      contentItemId: item.id,
      format,
    },
  });

  if (format === "md") {
    const markdown = `# ${item.title}\n\n${item.currentVersion?.body ?? ""}\n`;
    return {
      exportRecord,
      output: markdown,
      mimeType: "text/markdown; charset=utf-8",
    };
  }

  return {
    exportRecord,
    output: JSON.stringify(payload, null, 2),
    mimeType: "application/json; charset=utf-8",
  };
}