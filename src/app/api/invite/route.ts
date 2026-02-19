import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth/session";
import { generateSecureToken } from "../../../lib/auth/tokens";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await request.json() as {
    email?: string;
    role?: string;
    workspaceId?: string;
    projectIds?: string[];
  };
  const { email, role = "EDITOR", workspaceId, projectIds = [] } = body;

  if (!email || !workspaceId) {
    return NextResponse.json({ error: "Brak wymaganych pól" }, { status: 400 });
  }

  // Caller must be ADMIN or MANAGER
  const callerMembership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  if (!callerMembership || !["ADMIN", "MANAGER"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  // Check if already a member
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (existingUser) {
    const existing = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ta osoba jest już w workspace" }, { status: 409 });
    }
  }

  // Cancel old pending invite for same email
  await prisma.workspaceInvite.updateMany({
    where: { workspaceId, email: email.toLowerCase(), status: "PENDING" },
    data: { status: "REVOKED" as const },
  });

  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email: email.toLowerCase().trim(),
      role: role as "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER",
      token,
      expiresAt,
      createdByUserId: user.id,
    },
  });

  // If existing user, create project memberships immediately
  if (existingUser && projectIds.length > 0) {
    await prisma.projectMembership.createMany({
      data: projectIds.map((projectId) => ({
        workspaceId,
        projectId,
        userId: existingUser.id,
        role: "EDITOR" as const,
      })),
      skipDuplicates: true,
    });
  }

  const inviteUrl = `https://content-control-tower-new.vercel.app/invite/${token}`;

  // In production you'd send this via email. For now return URL for manual sharing.
  return NextResponse.json({
    ok: true,
    inviteUrl,
    token: invite.token,
    message: `Zaproszenie utworzone. Link: ${inviteUrl}`,
  });
}
