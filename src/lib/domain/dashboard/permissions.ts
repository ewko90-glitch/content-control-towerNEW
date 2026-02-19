import { hasRequiredRole } from "@/lib/auth/workspace";

import type { Role, SignalPermissions } from "./types";

function roleLabel(role: "MANAGER" | "EDITOR" | "ADMIN"): string {
  if (role === "MANAGER") {
    return "Manager";
  }

  if (role === "EDITOR") {
    return "Editor";
  }

  return "Admin";
}

export function requireRole(currentRole: Role, requiredRole: "MANAGER" | "EDITOR" | "ADMIN"): SignalPermissions {
  if (hasRequiredRole(currentRole, requiredRole)) {
    return { canExecute: true };
  }

  return {
    canExecute: false,
    reasonIfDisabled: `Brak uprawnień (wymagana rola: ${roleLabel(requiredRole)})`,
  };
}

export function requireAiAccess(currentRole: Role, creditsRemaining: number): SignalPermissions {
  if (!hasRequiredRole(currentRole, "EDITOR")) {
    return {
      canExecute: false,
      reasonIfDisabled: "Brak uprawnień (wymagana rola: Manager)",
    };
  }

  if (creditsRemaining <= 0) {
    return {
      canExecute: false,
      reasonIfDisabled: "Brak dostępnych kredytów AI",
    };
  }

  return { canExecute: true };
}
