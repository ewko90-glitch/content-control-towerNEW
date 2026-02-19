import type { Role } from "@prisma/client";

import { getUserFromRequest } from "@/lib/auth/session";
import { hasRequiredRole, type WorkspaceRole } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

import { ContentDomainError } from "./errors";
import type { ContentContext } from "./service";

export async function resolveContentContext(
  request: Request,
  workspaceSlug: string,
  requiredRole: WorkspaceRole = "VIEWER",
): Promise<ContentContext> {
  const user = await getUserFromRequest(request);

  if (!user) {
    throw new ContentDomainError("UNAUTHORIZED", "Brak autoryzacji.", 401);
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspace: {
        slug: workspaceSlug,
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
  });

  if (!membership) {
    throw new ContentDomainError("FORBIDDEN", "Brak dostępu do workspace.", 403);
  }

  if (!hasRequiredRole(membership.role, requiredRole)) {
    throw new ContentDomainError("FORBIDDEN", "Brak wymaganych uprawnień.", 403);
  }

  return {
    workspaceId: membership.workspace.id,
    workspaceSlug: membership.workspace.slug,
    userId: user.id,
    role: membership.role as Role,
  };
}