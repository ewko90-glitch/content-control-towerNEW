import { prisma } from "../prisma";
import { requireUser } from "./session";

export type WorkspaceRole = "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER";

const roleRank: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRequiredRole(currentRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  return roleRank[currentRole] >= roleRank[requiredRole];
}

export async function requireWorkspaceAccess(slug: string, requiredRole: WorkspaceRole = "VIEWER") {
  const user = await requireUser();

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspace: {
        slug,
        deletedAt: null,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw new Error("Brak dostępu do tego workspace.");
  }

  if (!hasRequiredRole(membership.role, requiredRole)) {
    throw new Error("Brak wymaganych uprawnień.");
  }

  return {
    user,
    membership,
    workspace: membership.workspace,
  };
}

export async function resolvePostLoginRedirect(userId: string): Promise<string> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: {
      userId,
      workspace: {
        deletedAt: null,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (memberships.length === 0) {
    return "/onboarding";
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { lastWorkspaceId: true },
  });

  const preferredMembership =
    memberships.find((membership: (typeof memberships)[number]) => membership.workspace.id === preference?.lastWorkspaceId) ??
    memberships[0];

  return `/overview?workspace=${preferredMembership.workspace.slug}`;
}
