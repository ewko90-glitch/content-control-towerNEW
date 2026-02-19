import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { createAuditLog } from "../../../../lib/auth/audit";
import { getRequestMeta } from "../../../../lib/auth/request";
import { getUserFromRequest } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Brak tokenu" }, { status: 400 });
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Zaproszenie jest nieprawidłowe lub wygasło" }, { status: 400 });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingMembership = await tx.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      await tx.workspaceMembership.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        },
      });

      await tx.workspaceUsage.updateMany({
        where: { workspaceId: invite.workspaceId },
        data: {
          seatsUsed: {
            increment: 1,
          },
        },
      });
    }

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: user.id,
      },
    });

    await tx.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        lastWorkspaceId: invite.workspaceId,
      },
      update: {
        lastWorkspaceId: invite.workspaceId,
      },
    });
  });

  await createAuditLog({
    action: "MEMBER_INVITE_ACCEPTED",
    userId: user.id,
    workspaceId: invite.workspaceId,
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    ip: getRequestMeta(request).ipAddress,
    userAgent: getRequestMeta(request).userAgent,
  });

  return NextResponse.redirect(new URL(`/w/${invite.workspace.slug}`, request.url));
}
