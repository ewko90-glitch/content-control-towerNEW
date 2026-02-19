import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await request.json() as { userId?: string; workspaceId?: string; projectIds?: string[] };
  const { userId, workspaceId, projectIds } = body;

  if (!userId || !workspaceId || !Array.isArray(projectIds)) {
    return NextResponse.json({ error: "Brak wymaganych pól" }, { status: 400 });
  }

  // Caller must be ADMIN of this workspace
  const callerMembership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  if (!callerMembership || !["ADMIN", "MANAGER"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  // Validate that all projectIds belong to this workspace
  const validProjects = await prisma.project.findMany({
    where: { workspaceId, id: { in: projectIds }, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(validProjects.map((p: { id: string }) => p.id));
  const safeProjectIds = projectIds.filter((id) => validIds.has(id));

  // Remove all existing ProjectMemberships for this user in this workspace
  await prisma.projectMembership.deleteMany({ where: { workspaceId, userId } });

  // Re-create for chosen projects
  if (safeProjectIds.length > 0) {
    await prisma.projectMembership.createMany({
      data: safeProjectIds.map((projectId) => ({
        workspaceId,
        projectId,
        userId,
        role: "EDITOR",
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, updated: safeProjectIds.length });
}
