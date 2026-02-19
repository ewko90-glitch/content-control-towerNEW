import type { WorkflowStatus } from "@prisma/client";

import { hasRequiredRole, type WorkspaceRole } from "@/lib/auth/workspace";

import { ContentDomainError } from "./errors";

type ContentAction =
  | "create"
  | "update"
  | "version"
  | "move"
  | "approval"
  | "schedule"
  | "ai"
  | "export";

function requiredRoleForAction(action: ContentAction, targetStatus?: WorkflowStatus): WorkspaceRole {
  if (action === "approval" || action === "schedule") {
    return "MANAGER";
  }

  if (action === "move" && (targetStatus === "APPROVED" || targetStatus === "SCHEDULED" || targetStatus === "PUBLISHED")) {
    return "MANAGER";
  }

  if (action === "export") {
    return "VIEWER";
  }

  return "EDITOR";
}

export function assertContentPermission(role: WorkspaceRole, action: ContentAction, targetStatus?: WorkflowStatus) {
  const requiredRole = requiredRoleForAction(action, targetStatus);
  if (!hasRequiredRole(role, requiredRole)) {
    throw new ContentDomainError("FORBIDDEN", "Brak wymaganych uprawnień do wykonania tej akcji.", 403);
  }
}