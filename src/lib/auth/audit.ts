import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "../prisma";

type AuditInput = {
  action: AuditAction;
  userId?: string | null;
  workspaceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata == null ? undefined : (input.metadata as Prisma.InputJsonValue),
    },
  });
}
