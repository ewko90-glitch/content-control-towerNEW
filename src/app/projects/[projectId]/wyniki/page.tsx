import { notFound, redirect } from "next/navigation";

import { ProjectInsightsPanel, type ProjectInsight } from "@/components/projects/ProjectInsightsPanel";
import { ProjectPerformanceDashboard } from "@/components/projects/ProjectPerformanceDashboard";
import { ProjectShell } from "@/components/projects/ProjectShell";
import { TeamPerformanceTable, type TeamPerformanceRow } from "@/components/projects/TeamPerformanceTable";
import type { PlanId } from "@/lib/billing/planConfig";
import { getProject, getProjectMembers, listPublications } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";
import { listMembers } from "@/lib/team/teamStore";

type ProjectResultsPageProps = {
  params: Promise<{ projectId: string }>;
};

type PublicationSignal = {
  isUpcoming7d: boolean;
  isPast: boolean;
  isPublished: boolean;
  isDraft: boolean;
  isBacklog: boolean;
  isOverdue: boolean;
  isStaleDraft: boolean;
  assigneeId?: string;
};

function analyzePublications(workspaceId: string, projectId: string): PublicationSignal[] {
  const publications = listPublications(workspaceId, projectId);
  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;
  const staleBoundary = now - 7 * 24 * 60 * 60 * 1000;

  return publications.map((publication) => {
    const publishTs = new Date(publication.dataPublikacjiISO).getTime();
    const createdTs = new Date(publication.createdAtISO).getTime();
    const isUpcoming7d = publishTs >= now && publishTs <= next7Boundary;
    const isPast = publishTs < now;
    const isPublished = publication.status === "opublikowane";
    const isDraft = publication.status === "szkic";

    return {
      isUpcoming7d,
      isPast,
      isPublished,
      isDraft,
      isBacklog: publication.status === "pomysl" || publication.status === "szkic",
      isOverdue: isPast && publication.status !== "opublikowane",
      isStaleDraft: isDraft && createdTs < staleBoundary,
      assigneeId: publication.assigneeId,
    };
  });
}

export default async function ProjectResultsPage({ params }: ProjectResultsPageProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const workspaceId = activeWorkspace.workspace.id;
  const workspaceSlug = activeWorkspace.workspace.slug;

  const project = getProject(workspaceId, projectId);
  if (!project) {
    notFound();
  }

  const signals = analyzePublications(workspaceId, project.id);

  const upcomingCount = signals.filter((item) => item.isUpcoming7d).length;
  const publishedCount = signals.filter((item) => item.isUpcoming7d && item.isPublished).length;
  const unassignedUpcomingCount = signals.filter((item) => item.isUpcoming7d && !item.assigneeId).length;
  const overdueCount = signals.filter((item) => item.isOverdue).length;
  const draftsCount = signals.filter((item) => item.isDraft).length;
  const staleDraftsCount = signals.filter((item) => item.isStaleDraft).length;
  const cadenceMismatch = project.cadence.czestotliwoscTygodniowa > upcomingCount;

  const projectMemberIds = new Set(getProjectMembers(workspaceId, project.id).map((item) => item.memberId));
  const memberRowsBase = listMembers(workspaceId).filter((member) => projectMemberIds.has(member.id));

  const totalUpcomingAssigned = signals.filter((item) => item.isUpcoming7d && item.assigneeId).length;
  const teamRows: TeamPerformanceRow[] = memberRowsBase.map((member) => {
    const workload7d = signals.filter((item) => item.isUpcoming7d && item.assigneeId === member.id).length;
    const delivery7d = signals.filter((item) => item.isUpcoming7d && item.isPublished && item.assigneeId === member.id).length;
    const backlogCount = signals.filter((item) => item.isBacklog && item.assigneeId === member.id).length;
    const riskOverdue = signals.filter((item) => item.isOverdue && item.assigneeId === member.id).length;

    return {
      memberId: member.id,
      memberName: member.imie,
      role: member.role,
      workload7d,
      delivery7d,
      backlogCount,
      riskOverdue,
      isOverloaded: totalUpcomingAssigned > 0 ? workload7d / totalUpcomingAssigned > 0.6 : false,
    };
  });

  const insights: ProjectInsight[] = [];

  if (unassignedUpcomingCount > 0) {
    insights.push({
      id: "unassigned-upcoming",
      text: "Masz " + unassignedUpcomingCount + " publikacji na ten tydzień bez przypisania.",
      href: "/projects/" + project.id + "/tresci?filter=unassigned",
      ctaLabel: "Przypisz publikacje",
      ctaType: "assign",
    });
  }

  if (overdueCount > 0) {
    insights.push({
      id: "overdue",
      text: overdueCount + " publikacji ma termin w przeszłości i nie jest opublikowana.",
      href: "/projects/" + project.id + "/kalendarz",
      ctaLabel: "Przejdź do Kalendarza",
      ctaType: "calendar",
    });
  }

  if (staleDraftsCount > 0) {
    insights.push({
      id: "stale-drafts",
      text: staleDraftsCount + " szkiców jest nieaktywnych > 7 dni — rozważ decyzję: dokończ / usuń / przepnij.",
      href: "/projects/" + project.id + "/tresci",
      ctaLabel: "Przejdź do Treści",
      ctaType: "content",
    });
  }

  if (upcomingCount === 0) {
    insights.push({
      id: "no-upcoming",
      text: "Brak publikacji na najbliższe 7 dni — projekt stoi.",
      href: "/projects/" + project.id + "/kalendarz",
      ctaLabel: "Przejdź do Kalendarza",
      ctaType: "calendar",
    });
  }

  if (cadenceMismatch) {
    insights.push({
      id: "cadence-mismatch",
      text: "Cadence to " + project.cadence.czestotliwoscTygodniowa + "/tydzień, ale masz tylko " + upcomingCount + " publikacji w 7 dni.",
      href: "/projects/" + project.id + "/strategia",
      ctaLabel: "Odśwież plan",
      ctaType: "ai_refresh",
    });
  }

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  return (
    <ProjectShell project={project} planId={planId} tokenState={tokenState} workspaceSlug={workspaceSlug} activeTab="results">
      <header className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-xl font-semibold text-[#0F172A]">Wyniki i zespół</h2>
        <p className="mt-1 text-sm text-[#64748B]">Kontrola pracy zespołu i stanu publikacji w tym projekcie.</p>
      </header>

      <ProjectPerformanceDashboard
        kpis={{
          upcomingCount,
          publishedCount,
          unassignedUpcomingCount,
          overdueCount,
          draftsCount,
          staleDraftsCount,
        }}
      />

      <TeamPerformanceTable rows={teamRows} />
      <ProjectInsightsPanel insights={insights.slice(0, 5)} />
    </ProjectShell>
  );
}
