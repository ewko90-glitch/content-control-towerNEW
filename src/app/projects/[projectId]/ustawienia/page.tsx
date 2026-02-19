import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuditTrailList } from "@/components/projects/AuditTrailList";
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm";
import { ProjectShell } from "@/components/projects/ProjectShell";
import { ProjectTeamManager } from "@/components/team/ProjectTeamManager";
import type { PlanId } from "@/lib/billing/planConfig";
import { getProject, getProjectMembers, getProjectPolicies, listAuditEvents, setProjectMembers, updateProjectPolicies, updateProjectProfile, type ProjectMember } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";
import { listMembers, type WorkspaceRole } from "@/lib/team/teamStore";

type ProjectSettingsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ saved?: string; teamSaved?: string }>;
};

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseLinks(value: string): Array<{ label: string; url: string }> {
  return value
    .split(/\n|,/) 
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [labelPart, urlPart] = line.split("|");
      return {
        label: (labelPart ?? "Link").trim(),
        url: (urlPart ?? "").trim(),
      };
    })
    .filter((row) => row.url.length > 0);
}

function parseChannels(value: string): Array<{ typ: "wordpress" | "shopify" | "linkedin" | "inne"; nazwa: string }> {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [typePart, namePart] = entry.split(":");
      const normalizedType = (typePart ?? "inne").trim().toLowerCase();
      const typ: "wordpress" | "shopify" | "linkedin" | "inne" =
        normalizedType === "wordpress" || normalizedType === "shopify" || normalizedType === "linkedin"
          ? normalizedType
          : "inne";

      return {
        typ,
        nazwa: (namePart ?? typePart ?? "Kanał").trim(),
      };
    });
}

export default async function ProjectSettingsPage({ params, searchParams }: ProjectSettingsPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const workspaceSlug = activeWorkspace.workspace.slug;
  const workspaceId = activeWorkspace.workspace.id;

  const project = getProject(workspaceId, projectId);
  if (!project) {
    notFound();
  }
  const members = listMembers(workspaceId);
  const projectMembers = getProjectMembers(workspaceId, projectId);
  const policies = getProjectPolicies(workspaceId, projectId);
  const recentAuditEvents = listAuditEvents(workspaceId, projectId, { limit: 100 });

  async function saveAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const tonRaw = String(formData.get("tonKomunikacji") ?? "profesjonalny").trim();
    const tonKomunikacji =
      tonRaw === "dynamiczny" || tonRaw === "techniczny" || tonRaw === "ludzki" ? tonRaw : "profesjonalny";

    const jezyk = String(formData.get("jezyk") ?? "pl").trim() === "en" ? "en" : "pl";
    const typ = String(formData.get("typ") ?? "domena").trim() === "linkedin_osoba" ? "linkedin_osoba" : "domena";

    const policyActor = {
      memberId: String(formData.get("policyActorMemberId") ?? "member_owner"),
      name: String(formData.get("policyActorName") ?? "System"),
      role: String(formData.get("policyActorRole") ?? "owner"),
    };

    const dailyLimitRaw = Number(String(formData.get("policy_dailyAiGenerationLimit") ?? "0"));
    const dailyAiGenerationLimit = Number.isFinite(dailyLimitRaw) ? Math.max(0, Math.floor(dailyLimitRaw)) : 0;
    const allowedAiKindsRaw = formData
      .getAll("policy_allowedAiKinds")
      .map((value) => String(value))
      .filter((value): value is "outline" | "draft" | "seo" => value === "outline" || value === "draft" || value === "seo");

    updateProjectProfile(access.workspace.id, projectId, {
      nazwa: String(formData.get("nazwa") ?? "").trim(),
      typ,
      domenaLubKanal: String(formData.get("domenaLubKanal") ?? "").trim(),
      jezyk,
      tonKomunikacji,
      grupaDocelowa: String(formData.get("grupaDocelowa") ?? "").trim(),
      glowneKlastry: parseCommaList(String(formData.get("glowneKlastry") ?? "")),
      slowaKluczowe: parseCommaList(String(formData.get("slowaKluczowe") ?? "")),
      konkurenci: parseCommaList(String(formData.get("konkurenci") ?? "")),
      linkiWewnetrzne: parseLinks(String(formData.get("linkiWewnetrzne") ?? "")),
      linkiZewnetrzne: parseLinks(String(formData.get("linkiZewnetrzne") ?? "")),
      kanaly: parseChannels(String(formData.get("kanaly") ?? "")),
      cadence: {
        dniTygodnia: parseCommaList(String(formData.get("dniTygodnia") ?? ""))
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7),
        czestotliwoscTygodniowa: Math.max(1, Number(String(formData.get("czestotliwoscTygodniowa") ?? "1"))),
      },
    });

    updateProjectPolicies(
      access.workspace.id,
      projectId,
      {
        aiEnabled: formData.get("policy_aiEnabled") === "on",
        requireApprovalForPublish: formData.get("policy_requireApprovalForPublish") === "on",
        approvalRolesAllowed: ["owner", "manager"],
        dailyAiGenerationLimit,
        allowedAiKinds: allowedAiKindsRaw.length > 0 ? allowedAiKindsRaw : ["outline", "draft", "seo"],
      },
      policyActor,
    );

    redirect(`/projects/${projectId}/ustawienia?saved=1`);
  }

  async function saveTeamAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const workspaceMembers = listMembers(access.workspace.id);
    const assignments: ProjectMember[] = [];

    for (const member of workspaceMembers) {
      const hasAccess = formData.get(`member_access_${member.id}`) === "on";
      if (!hasAccess) {
        continue;
      }

      const roleRaw = String(formData.get(`member_override_${member.id}`) ?? "").trim();
      const roleOverride: WorkspaceRole | undefined =
        roleRaw === "owner" || roleRaw === "manager" || roleRaw === "redaktor" || roleRaw === "podglad"
          ? roleRaw
          : undefined;

      assignments.push({
        memberId: member.id,
        roleOverride,
      });
    }

    setProjectMembers(access.workspace.id, projectId, assignments);
    redirect(`/projects/${projectId}/ustawienia?teamSaved=1`);
  }

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  return (
    <ProjectShell project={project} planId={planId} tokenState={tokenState} workspaceSlug={workspaceSlug} activeTab="settings">
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Ustawienia projektu</h2>
            <p className="mt-1 text-sm text-[#64748B]">Edytuj profil projektu i kontekst planowania.</p>
          </div>
          <Link href={`/projects/${project.id}`} className="text-sm font-medium text-[#5B7CFA] hover:underline">Wróć do przeglądu</Link>
        </div>

        <ProjectSettingsForm
          onSave={saveAction}
          saved={query.saved === "1"}
          initialPolicies={policies}
          initialValues={{
            nazwa: project.nazwa,
            typ: project.typ,
            domenaLubKanal: project.domenaLubKanal,
            jezyk: project.jezyk,
            tonKomunikacji: project.tonKomunikacji,
            grupaDocelowa: project.grupaDocelowa,
            glowneKlastry: project.glowneKlastry.join(", "),
            slowaKluczowe: project.slowaKluczowe.join(", "),
            konkurenci: project.konkurenci.join(", "),
            linkiWewnetrzne: project.linkiWewnetrzne.map((row) => `${row.label}|${row.url}`).join("\n"),
            linkiZewnetrzne: project.linkiZewnetrzne.map((row) => `${row.label}|${row.url}`).join("\n"),
            kanaly: project.kanaly.map((row) => `${row.typ}:${row.nazwa}`).join(", "),
            dniTygodnia: project.cadence.dniTygodnia.join(","),
            czestotliwoscTygodniowa: String(project.cadence.czestotliwoscTygodniowa),
          }}
        />

        <div className="mt-4">
          <ProjectTeamManager
            members={members}
            projectMembers={projectMembers}
            onSave={saveTeamAction}
            saved={query.saved === "1" || query.teamSaved === "1"}
          />
        </div>

        <section id="ostatnie-zmiany" className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Ostatnie zmiany</h3>
              <p className="mt-1 text-xs text-[#64748B]">Audit Trail Lite dla publikacji i akcji AI.</p>
            </div>
            <a href="#ostatnie-zmiany" className="text-xs font-medium text-[#5B7CFA] hover:underline">Zobacz wszystko</a>
          </div>

          <AuditTrailList
            events={recentAuditEvents}
            emptyMessage="Brak zdarzeń audit w tym projekcie."
            initialLimit={10}
            showExpandLink
          />
        </section>
      </section>
    </ProjectShell>
  );
}
