import { AccountTabs } from "@/components/account/AccountTabs";
import { requireUser } from "../../lib/auth/session";
import { prisma } from "../../lib/prisma";

export default async function AccountPage() {
  const user = await requireUser();

  const [memberships, projects, projectMemberships, planData] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { userId: user.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 1,
    }),
    prisma.project.findMany({
      where: {
        workspace: {
          memberships: { some: { userId: user.id } },
        },
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectMembership.findMany({
      where: {
        workspace: {
          memberships: { some: { userId: user.id } },
        },
      },
      select: { id: true, projectId: true, userId: true, role: true },
    }),
    prisma.workspacePlan
      .findFirst({
        where: {
          workspace: {
            memberships: { some: { userId: user.id } },
          },
        },
        select: { tier: true, seatsLimit: true, projectsLimit: true, aiCreditsMonthly: true },
      })
      .catch(() => null),
  ]);

  const firstWorkspace = memberships[0]?.workspace ?? null;

  const workspaceMembers = firstWorkspace
    ? await prisma.workspaceMembership.findMany({
        where: { workspaceId: firstWorkspace.id },
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true } },
        },
      })
    : [];

  const workspaceUsage = firstWorkspace
    ? await prisma.workspaceUsage.findUnique({
        where: { workspaceId: firstWorkspace.id },
        select: { seatsUsed: true, projectsUsed: true },
      })
    : null;

  return (
    <AccountTabs
      user={{ id: user.id, email: user.email, name: user.name ?? null }}
      workspace={firstWorkspace}
      members={workspaceMembers.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: {
          email: m.user.email,
          name: m.user.name ?? null,
          avatarUrl: m.user.avatarUrl ?? null,
        },
      }))}
      projects={projects}
      projectMemberships={projectMemberships.map((pm) => ({
        id: pm.id,
        projectId: pm.projectId,
        userId: pm.userId,
        role: pm.role,
      }))}
      plan={planData ? { ...planData, tier: String(planData.tier) } : null}
      usage={workspaceUsage}
    />
  );
}
