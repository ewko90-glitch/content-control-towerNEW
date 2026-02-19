import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProjectExecutivePackView } from "@/components/projects/ProjectExecutivePackView";
import type { ProjectInsight } from "@/components/projects/ProjectInsightsPanel";
import { ProjectShell } from "@/components/projects/ProjectShell";
import type { TeamPerformanceRow } from "@/components/projects/TeamPerformanceTable";
import type { PlanId } from "@/lib/billing/planConfig";
import { getProject, getProjectMembers, listPublications } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";
import { listMembers } from "@/lib/team/teamStore";

type ProjectReportPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ preview?: string }>;
};

type PublicationListItem = {
  id: string;
  title: string;
  dateISO: string;
  status: string;
  assigneeName?: string;
};

function toSection(items: PublicationListItem[], title: string) {
  const limited = items.slice(0, 10);
  return {
    title,
    items: limited,
    remainingCount: Math.max(0, items.length - limited.length),
  };
}

export default async function ProjectReportPage({ params, searchParams }: ProjectReportPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
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

  if (query.preview !== "1") {
    return (
      <ProjectShell
        project={project}
        planId={"control_tower" as PlanId}
        tokenState={{
          saldo: 1200,
          odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          planMiesiecznyLimit: 250000,
        }}
        workspaceSlug={workspaceSlug}
        activeTab="results"
      >
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-xl font-semibold text-[#0F172A]">Raport projektu</h2>
          <p className="mt-2 text-sm text-[#64748B]">Raport jest dostępny w trybie podglądu.</p>
          <Link
            href={`/projects/${project.id}/raport?preview=1`}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#0F172A] px-4 text-sm font-medium text-white"
          >
            Otwórz podgląd
          </Link>
        </section>
      </ProjectShell>
    );
  }

  const publications = listPublications(workspaceId, project.id);
  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;
  const staleBoundary = now - 7 * 24 * 60 * 60 * 1000;

  const upcoming = publications.filter((publication) => {
    const publishTs = new Date(publication.dataPublikacjiISO).getTime();
    return publishTs >= now && publishTs <= next7Boundary;
  });

  const publishedCount = upcoming.filter((publication) => publication.status === "opublikowane").length;
  const unassignedUpcomingCount = upcoming.filter((publication) => !publication.assigneeId).length;
  const overdue = publications.filter((publication) => {
    const publishTs = new Date(publication.dataPublikacjiISO).getTime();
    return publishTs < now && publication.status !== "opublikowane";
  });
  const drafts = publications.filter((publication) => publication.status === "szkic");
  const staleDraftsCount = drafts.filter((publication) => new Date(publication.createdAtISO).getTime() < staleBoundary).length;

  const cadenceMismatch = project.cadence.czestotliwoscTygodniowa > upcoming.length;

  const projectMemberIds = new Set(getProjectMembers(workspaceId, project.id).map((item) => item.memberId));
  const teamMembers = listMembers(workspaceId).filter((member) => projectMemberIds.has(member.id));
  const totalUpcomingAssigned = upcoming.filter((item) => item.assigneeId).length;

  const teamRows: TeamPerformanceRow[] = teamMembers.map((member) => {
    const workload7d = upcoming.filter((item) => item.assigneeId === member.id).length;
    const delivery7d = upcoming.filter((item) => item.assigneeId === member.id && item.status === "opublikowane").length;
    const backlogCount = publications.filter((item) => (item.status === "pomysl" || item.status === "szkic") && item.assigneeId === member.id).length;
    const riskOverdue = overdue.filter((item) => item.assigneeId === member.id).length;

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
  if (overdue.length > 0) {
    insights.push({
      id: "overdue",
      text: overdue.length + " publikacji ma termin w przeszłości i nie jest opublikowana.",
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
  if (upcoming.length === 0) {
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
      text: "Cadence to " + project.cadence.czestotliwoscTygodniowa + "/tydzień, ale masz tylko " + upcoming.length + " publikacji w 7 dni.",
      href: "/projects/" + project.id + "/strategia",
      ctaLabel: "Odśwież plan",
      ctaType: "ai_refresh",
    });
  }

  const sections = [
    toSection(
      upcoming
        .filter((item) => item.status === "zaplanowane")
        .map((item) => ({
          id: item.id,
          title: item.tytul,
          dateISO: item.dataPublikacjiISO,
          status: item.status,
          assigneeName: item.assigneeName,
        })),
      "Zaplanowane 7 dni",
    ),
    toSection(
      overdue.map((item) => ({
        id: item.id,
        title: item.tytul,
        dateISO: item.dataPublikacjiISO,
        status: item.status,
        assigneeName: item.assigneeName,
      })),
      "Zaległe",
    ),
    toSection(
      publications
        .filter((item) => !item.assigneeId)
        .map((item) => ({
          id: item.id,
          title: item.tytul,
          dateISO: item.dataPublikacjiISO,
          status: item.status,
          assigneeName: item.assigneeName,
        })),
      "Bez przypisania",
    ),
  ];

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  return (
    <ProjectExecutivePackView
      project={project}
      periodLabel="Ostatnie 7 dni"
      generatedAtLabel={new Date().toLocaleString("pl-PL")}
      planId={planId}
      tokenState={tokenState}
      kpis={{
        upcomingCount: upcoming.length,
        publishedCount,
        unassignedUpcomingCount,
        overdueCount: overdue.length,
        draftsCount: drafts.length,
        staleDraftsCount,
      }}
      teamRows={teamRows}
      insights={insights.slice(0, 5)}
      sections={sections}
    />
  );
}
