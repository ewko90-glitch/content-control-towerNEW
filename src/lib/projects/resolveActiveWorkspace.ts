import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

type MembershipListItem = {
  id: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
};

export async function resolveActiveWorkspace(preferredWorkspaceSlug?: string) {
  const user = await requireUser();

  const memberships = (await prisma.workspaceMembership.findMany({
    where: {
      userId: user.id,
      workspace: { deletedAt: null },
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as MembershipListItem[];

  if (memberships.length === 0) {
    return null;
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { lastWorkspaceId: true },
  });

  const activeMembership =
    memberships.find((membership) => membership.workspace.slug === preferredWorkspaceSlug) ??
    memberships.find((membership) => membership.workspace.id === preference?.lastWorkspaceId) ??
    memberships[0];

  return {
    user,
    membership: activeMembership,
    workspace: activeMembership.workspace,
  };
}
