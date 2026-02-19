"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { sprawdzDostepDoFunkcji, type AccessResult } from "@/lib/billing/featureAccess";
import type { PlanId } from "@/lib/billing/planConfig";
import { czySaTokeny, type TokenState } from "@/lib/billing/tokens";
import { getProjectMembers, type ProjectPolicies, type ProjectProfile } from "@/lib/projects/projectStore";
import { listMembers, type WorkspaceMember, type WorkspaceRole } from "@/lib/team/teamStore";

export type ProjectPermissionAction =
  | "projekt_widok"
  | "projekt_ustawienia_edycja"
  | "publikacje_dodaj"
  | "publikacje_przypisz"
  | "publikacje_status_zmien"
  | "publikacje_usun"
  | "ai_uzyj";

export type ProjectPermissionResult =
  | { status: "ok" }
  | { status: "brak_uprawnien"; powod: string };

type ProjectPermissions = Record<ProjectPermissionAction, boolean>;

type ProjectContextValue = {
  workspaceSlug: string;
  projectId: string;
  project: ProjectProfile;
  planId: PlanId;
  tokeny: number;
  tokenState: TokenState;
  hasTokens: boolean;
  aiPlanningAccess: AccessResult;
  aiContentAccess: AccessResult;
  aiStrategyAccess: AccessResult;
  currentMember: WorkspaceMember;
  currentRole: WorkspaceRole | null;
  buildActor: () => { memberId: string; name: string; role: string };
  policies: ProjectPolicies;
  canPublishDirectly: boolean;
  permissions: ProjectPermissions;
  requirePermission: (action: ProjectPermissionAction) => ProjectPermissionResult;
};

type ProjectContextProviderProps = {
  workspaceSlug: string;
  projectId: string;
  initialProject: ProjectProfile;
  children: ReactNode;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function can(action: ProjectPermissionAction, role: WorkspaceRole | null): boolean {
  if (!role) {
    return false;
  }

  if (role === "owner" || role === "manager") {
    return true;
  }

  if (role === "redaktor") {
    return action !== "projekt_ustawienia_edycja";
  }

  return action === "projekt_widok";
}

const dayLabels: Record<number, string> = {
  1: "Pon",
  2: "Wt",
  3: "Śr",
  4: "Czw",
  5: "Pt",
  6: "Sob",
  7: "Ndz",
};

function channelLabel(channelType: ProjectProfile["kanaly"][number]["typ"]): string {
  if (channelType === "wordpress") {
    return "WordPress";
  }
  if (channelType === "shopify") {
    return "Shopify";
  }
  if (channelType === "linkedin") {
    return "LinkedIn";
  }
  return "Inne";
}

function cadenceLabel(cadence: ProjectProfile["cadence"]): string {
  const days = cadence.dniTygodnia
    .slice()
    .sort((left, right) => left - right)
    .map((day) => dayLabels[day] ?? `D${day}`)
    .join("/");

  return `${cadence.czestotliwoscTygodniowa}/tydzień • ${days || "dni nieustalone"}`;
}

export function ProjectContextProvider({ workspaceSlug, projectId, initialProject, children }: ProjectContextProviderProps) {
  const planId: PlanId = "control_tower";
  const tokenState: TokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000,
  };
  const tokeny = tokenState.saldo;

  const value = useMemo<ProjectContextValue>(() => {
    const workspaceMembers = listMembers(initialProject.workspaceId);
    const currentMember = workspaceMembers.find((member) => member.id === "member_owner") ?? workspaceMembers[0];
    const projectMembers = getProjectMembers(initialProject.workspaceId, projectId);
    const directMembership = projectMembers.find((member) => member.memberId === currentMember.id);
    const hasProjectAssignment = Boolean(directMembership) || currentMember.role === "owner";
    const currentRole: WorkspaceRole | null = hasProjectAssignment
      ? (directMembership?.roleOverride ?? currentMember.role)
      : null;

    const permissions: ProjectPermissions = {
      projekt_widok: hasProjectAssignment && can("projekt_widok", currentRole),
      projekt_ustawienia_edycja: hasProjectAssignment && can("projekt_ustawienia_edycja", currentRole),
      publikacje_dodaj: hasProjectAssignment && can("publikacje_dodaj", currentRole),
      publikacje_przypisz: hasProjectAssignment && can("publikacje_przypisz", currentRole),
      publikacje_status_zmien: hasProjectAssignment && can("publikacje_status_zmien", currentRole),
      publikacje_usun: hasProjectAssignment && can("publikacje_usun", currentRole),
      ai_uzyj: hasProjectAssignment && can("ai_uzyj", currentRole),
    };

    const buildActor = () => ({
      memberId: currentMember.id,
      name: currentMember.imie,
      role: currentRole ?? currentMember.role,
    });

    const policies: ProjectPolicies = {
      aiEnabled: initialProject.policies?.aiEnabled ?? true,
      requireApprovalForPublish: initialProject.policies?.requireApprovalForPublish ?? false,
      approvalRolesAllowed: initialProject.policies?.approvalRolesAllowed ?? ["owner", "manager"],
      dailyAiGenerationLimit: initialProject.policies?.dailyAiGenerationLimit ?? 0,
      allowedAiKinds: initialProject.policies?.allowedAiKinds ?? ["outline", "draft", "seo"],
    };
    const canPublishDirectly = currentRole ? policies.approvalRolesAllowed.includes(currentRole as "owner" | "manager") : false;

    const requirePermission = (action: ProjectPermissionAction): ProjectPermissionResult => {
      if (permissions[action]) {
        return { status: "ok" };
      }
      return {
        status: "brak_uprawnien",
        powod: "Brak uprawnienia do tej akcji w bieżącej roli projektu.",
      };
    };

    const aiPlanningAccess = sprawdzDostepDoFunkcji({
      feature: "ai_planowanie",
      planId,
      tokeny,
      czyAkcjaAI: true,
    });
    const aiContentAccess = sprawdzDostepDoFunkcji({
      feature: "ai_generowanie_tresci",
      planId,
      tokeny,
      czyAkcjaAI: true,
    });
    const aiStrategyAccess = sprawdzDostepDoFunkcji({
      feature: "ai_rekomendacje_strategiczne",
      planId,
      tokeny,
      czyAkcjaAI: true,
    });

    return {
      workspaceSlug,
      projectId,
      project: initialProject,
      planId,
      tokeny,
      tokenState,
      hasTokens: czySaTokeny(tokenState),
      aiPlanningAccess,
      aiContentAccess,
      aiStrategyAccess,
      currentMember,
      currentRole,
      buildActor,
      policies,
      canPublishDirectly,
      permissions,
      requirePermission,
    };
  }, [workspaceSlug, projectId, initialProject, planId, tokeny, tokenState]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext musi być użyty wewnątrz ProjectContextProvider");
  }
  return context;
}

export function ProjectContextBar() {
  const { project, projectId } = useProjectContext();
  const channelSummary = project.kanaly.length > 0
    ? project.kanaly.map((channel) => channelLabel(channel.typ)).join(" • ")
    : "Kanały nieustalone";

  return (
    <section className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white/90 p-4 shadow-[0_6px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{project.nazwa}</p>
          <p className="mt-1 text-xs text-[#64748B]">{project.typ === "domena" ? "Domena" : "LinkedIn"} • {project.domenaLubKanal}</p>
        </div>
        <Link href={`/projects/${projectId}/ustawienia`} className="text-xs font-medium text-[#5B7CFA] hover:underline">
          Edytuj profil projektu
        </Link>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[#475569] md:grid-cols-2">
        <p><span className="font-medium text-[#334155]">Kanały:</span> {channelSummary}</p>
        <p><span className="font-medium text-[#334155]">Cadence:</span> {cadenceLabel(project.cadence)}</p>
      </div>
    </section>
  );
}
