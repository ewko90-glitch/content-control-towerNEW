import type { PermissionResult } from "./types";

export enum WorkspaceRole {
  VIEWER = "VIEWER",
  EDITOR = "EDITOR",
  MANAGER = "MANAGER",
  ADMIN = "ADMIN",
}

export type ResolvedPermissions = {
  canCreateContent: PermissionResult;
  canApprove: PermissionResult;
  canSchedule: PermissionResult;
  canInvite: PermissionResult;
  canUseAI: PermissionResult;
};

const ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.EDITOR]: 1,
  [WorkspaceRole.MANAGER]: 2,
  [WorkspaceRole.ADMIN]: 3,
};

function hasRole(role: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

function denied(required: WorkspaceRole): PermissionResult {
  return {
    canExecute: false,
    reasonIfDisabled: `Brak uprawnień: wymagana rola ${required}`,
  };
}

function allowOrDeny(role: WorkspaceRole, required: WorkspaceRole): PermissionResult {
  return hasRole(role, required) ? { canExecute: true } : denied(required);
}

function toWorkspaceRole(role: WorkspaceRole | string): WorkspaceRole {
  if (role === WorkspaceRole.ADMIN || role === WorkspaceRole.MANAGER || role === WorkspaceRole.EDITOR || role === WorkspaceRole.VIEWER) {
    return role;
  }
  return WorkspaceRole.VIEWER;
}

export function permissionFor(required: "EDITOR" | "MANAGER" | "ADMIN", role: WorkspaceRole | string): PermissionResult {
  const requiredRole = WorkspaceRole[required];
  return allowOrDeny(toWorkspaceRole(role), requiredRole);
}

export function permissionForAi(role: WorkspaceRole | string, creditsRemaining: number): PermissionResult {
  const permissions = resolvePermissions(toWorkspaceRole(role), creditsRemaining);
  return permissions.canUseAI;
}

export function resolvePermissions(role: WorkspaceRole, creditsRemaining: number): ResolvedPermissions {
  const aiBase = allowOrDeny(role, WorkspaceRole.EDITOR);
  const canUseAi =
    aiBase.canExecute && creditsRemaining > 0
      ? { canExecute: true }
      : {
          canExecute: false,
          reasonIfDisabled: aiBase.canExecute ? "Brak dostępnych kredytów AI" : aiBase.reasonIfDisabled,
        };

  return {
    canCreateContent: allowOrDeny(role, WorkspaceRole.EDITOR),
    canApprove: allowOrDeny(role, WorkspaceRole.MANAGER),
    canSchedule: allowOrDeny(role, WorkspaceRole.MANAGER),
    canInvite: allowOrDeny(role, WorkspaceRole.ADMIN),
    canUseAI: canUseAi,
  };
}
