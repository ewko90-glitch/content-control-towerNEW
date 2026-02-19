import { NextResponse } from "next/server";

import { createAuditLog } from "../../../../../lib/auth/audit";
import { getRequestMeta } from "../../../../../lib/auth/request";
import { getUserFromRequest } from "../../../../../lib/auth/session";
import { hasRequiredRole } from "../../../../../lib/auth/workspace";
import type { WorkspaceRole } from "../../../../../lib/auth/workspace";
import { generateSecureToken } from "../../../../../lib/auth/tokens";
import { prisma } from "../../../../../lib/prisma";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const routeParams = await params;
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { email?: string; role?: WorkspaceRole } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = (body?.role ?? "VIEWER") as WorkspaceRole;

  if (!email) {
    return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: routeParams.slug },
    include: {
      memberships: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
      plan: {
        select: { seatsLimit: true },
      },
      usage: {
        select: { seatsUsed: true },
      },
    },
  });

  if (!workspace || workspace.deletedAt) {
    return NextResponse.json({ error: "Workspace nie istnieje" }, { status: 404 });
  }

  const currentMembership = workspace.memberships[0];
  if (!currentMembership || !hasRequiredRole(currentMembership.role, "ADMIN")) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  if (workspace.plan && workspace.usage && workspace.usage.seatsUsed >= workspace.plan.seatsLimit) {
    return NextResponse.json({ error: "Limit miejsc został wykorzystany" }, { status: 400 });
  }

  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.workspaceInvite.create({
    data: {
      workspaceId: workspace.id,
      email,
      role,
      status: "PENDING",
      token,
      expiresAt,
      createdByUserId: user.id,
    },
  });

  await createAuditLog({
    action: "MEMBER_INVITED",
    userId: user.id,
    workspaceId: workspace.id,
    entityType: "WorkspaceInvite",
    metadata: { email, role },
    ip: getRequestMeta(request).ipAddress,
    userAgent: getRequestMeta(request).userAgent,
  });

  const inviteLink = `${new URL(request.url).origin}/invite/${token}`;
  console.log(`[CCT] Link zaproszenia: ${inviteLink}`);

  return NextResponse.json({ ok: true });
}
