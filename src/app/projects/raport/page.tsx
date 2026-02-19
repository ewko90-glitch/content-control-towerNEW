import Link from "next/link";
import { redirect } from "next/navigation";

import { PortfolioExecutivePackView } from "@/components/projects/PortfolioExecutivePackView";
import type { TokenCenterData } from "@/components/projects/TokenCenter";
import type { PortfolioOverviewData } from "@/components/projects/PortfolioOverview";
import { getRecentTelemetry } from "@/lib/domain/controlTowerV3/telemetry";
import { buildPortfolioActions } from "@/lib/portfolio/portfolioRecommendations";
import { getProjectMembers, listProjects, listPublications, type PublicationJob } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";
import { listMembers } from "@/lib/team/teamStore";

type ProjectsReportPageProps = {
  searchParams: Promise<{ preview?: string }>;
};

type TokenStateLike = {
  saldo: number;
  odnowienieISO: string;
  planMiesiecznyLimit: number | "bez_limitu";
};

type UsageCount = {
  label: string;
  count: number;
};

function costPerKind(kind: string): number {
  if (kind === "outline") return 10;
  if (kind === "draft") return 30;
  if (kind === "seo") return 15;
  return 20;
}

function toTop3Counts(counter: Map<string, number>): UsageCount[] {
  return [...counter.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));
}

function buildTokenCenterData(args: {
  workspaceId: string;
  projects: Array<{ id: string; nazwa: string }>;
  tokenState: TokenStateLike;
}): TokenCenterData {
  const now = Date.now();
  const last7Start = now - 7 * 24 * 60 * 60 * 1000;
  const recent = getRecentTelemetry(args.workspaceId);
  const projectNameById = new Map(args.projects.map((project) => [project.id, project.nazwa]));

  const kindCounter = new Map<string, number>();
  const projectCounter = new Map<string, number>();

  for (const event of recent) {
    const timestamp = new Date(event.timestampISO).getTime();
    if (timestamp < last7Start || timestamp > now) continue;

    const metadata = event.metadata;
    const wouldConsume = Boolean(metadata && metadata.wouldConsumeTokens === true);
    if (!wouldConsume) continue;

    const kindRaw = metadata && typeof metadata.kind === "string" ? metadata.kind : "unknown";
    const kind = kindRaw.trim().toLowerCase() || "unknown";
    kindCounter.set(kind, (kindCounter.get(kind) ?? 0) + 1);

    const projectId = metadata && typeof metadata.projectId === "string" ? metadata.projectId : "";
    if (projectId) {
      const projectLabel = projectNameById.get(projectId) ?? projectId;
      projectCounter.set(projectLabel, (projectCounter.get(projectLabel) ?? 0) + 1);
    }
  }

  let estimatedDailyBurn = 0;
  for (const [kind, count] of kindCounter.entries()) {
    estimatedDailyBurn += (count / 7) * costPerKind(kind);
  }

  const tokenUsagePercent = args.tokenState.planMiesiecznyLimit === "bez_limitu"
    ? null
    : Math.max(0, Math.min(100, Math.round(((args.tokenState.planMiesiecznyLimit - args.tokenState.saldo) / args.tokenState.planMiesiecznyLimit) * 100)));

  const renewalLabel = new Date(args.tokenState.odnowienieISO).toLocaleDateString("pl-PL");
  const limitLabel = args.tokenState.planMiesiecznyLimit === "bez_limitu" ? "Bez limitu" : String(args.tokenState.planMiesiecznyLimit);

  let forecastLabel = "";
  if (args.tokenState.planMiesiecznyLimit === "bez_limitu") forecastLabel = "Bez limitu";
  else if (estimatedDailyBurn === 0) forecastLabel = "Brak zużycia — AI nie jest używane";
  else if (args.tokenState.saldo === 0) forecastLabel = "AI wstrzymane — brak tokenów";
  else {
    const daysLeft = args.tokenState.saldo / estimatedDailyBurn;
    forecastLabel = daysLeft > 365 ? "> 365 dni" : `${Math.max(1, Math.floor(daysLeft))} dni`;
  }

  return {
    saldo: args.tokenState.saldo,
    limitLabel,
    renewalLabel,
    forecastLabel,
    estimatedDailyBurnLabel: args.tokenState.planMiesiecznyLimit === "bez_limitu"
      ? "Prognoza pomijana dla planu bez limitu."
      : `Szacowane zużycie dzienne: ${estimatedDailyBurn.toFixed(1)} tokenów/dzień`,
    isHighUsage: tokenUsagePercent !== null && tokenUsagePercent > 80,
    topKinds: toTop3Counts(kindCounter),
    topProjects: toTop3Counts(projectCounter),
  };
}

function buildPortfolioOverviewData(args: {
  workspaceId: string;
  tokenState: { saldo: number; planMiesiecznyLimit: number | "bez_limitu" };
}): PortfolioOverviewData {
  const projects = listProjects(args.workspaceId);
  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;

  let totalPublications = 0;
  let publicationsNext7Days = 0;
  let projectsWithoutPublications = 0;
  let projectsWithoutCadence = 0;
  let projectsWithoutChannels = 0;

  const projectSignals = projects.map((project) => {
    const publications = listPublications(args.workspaceId, project.id);
    totalPublications += publications.length;

    const hasCadence = project.cadence.czestotliwoscTygodniowa > 0 && project.cadence.dniTygodnia.length > 0;
    const hasChannels = project.kanaly.length > 0;

    if (!hasCadence) projectsWithoutCadence += 1;
    if (!hasChannels) projectsWithoutChannels += 1;
    if (publications.length === 0) projectsWithoutPublications += 1;

    let hasPublicationNext7Days = false;
    for (const publication of publications) {
      const ts = new Date(publication.dataPublikacjiISO).getTime();
      if (ts >= now && ts <= next7Boundary) {
        publicationsNext7Days += 1;
        hasPublicationNext7Days = true;
      }
    }

    return {
      projectId: project.id,
      publicationsCount: publications.length,
      hasCadence,
      hasChannels,
      hasPublicationNext7Days,
    };
  });

  const tokenUsagePercent = args.tokenState.planMiesiecznyLimit === "bez_limitu"
    ? null
    : Math.max(0, Math.min(100, Math.round(((args.tokenState.planMiesiecznyLimit - args.tokenState.saldo) / args.tokenState.planMiesiecznyLimit) * 100)));

  return {
    totalProjects: projects.length,
    totalPublications,
    publicationsNext7Days,
    projectsWithoutPublications,
    projectsWithoutCadence,
    projectsWithoutChannels,
    tokenUsagePercent,
    projectSignals,
  };
}

export default async function ProjectsReportPage({ searchParams }: ProjectsReportPageProps) {
  const query = await searchParams;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  if (query.preview !== "1") {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6">
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Raport portfolio</h1>
          <p className="mt-2 text-sm text-[#64748B]">Raport jest dostępny w trybie podglądu.</p>
          <Link href="/projects/raport?preview=1" className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-[#0F172A] px-4 text-sm font-medium text-white">
            Otwórz podgląd
          </Link>
        </div>
      </section>
    );
  }

  const workspaceId = activeWorkspace.workspace.id;
  const workspaceSlug = activeWorkspace.workspace.slug;

  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  const projects = listProjects(workspaceId);
  const allMembers = listMembers(workspaceId);
  const publicationsByProject: Record<string, PublicationJob[]> = {};
  const membersByProject: Record<string, number> = {};

  for (const project of projects) {
    publicationsByProject[project.id] = listPublications(workspaceId, project.id);
    const projectMemberIds = new Set(getProjectMembers(workspaceId, project.id).map((item) => item.memberId));
    membersByProject[project.id] = allMembers.filter((member) => projectMemberIds.has(member.id)).length;
  }

  const tokenUsagePercent = tokenState.planMiesiecznyLimit === "bez_limitu"
    ? null
    : Math.max(0, Math.min(100, Math.round(((tokenState.planMiesiecznyLimit - tokenState.saldo) / tokenState.planMiesiecznyLimit) * 100)));

  const rawTelemetry = getRecentTelemetry(workspaceId);
  const actions = buildPortfolioActions({
    workspaceId,
    projects,
    publicationsByProject,
    membersByProject,
    telemetryEvents: tokenUsagePercent === null
      ? rawTelemetry
      : [
          ...rawTelemetry,
          {
            workspaceId,
            type: "pressure_computed",
            timestampISO: new Date().toISOString(),
            metadata: { tokenUsagePercent },
          },
        ],
  });

  const portfolioData = buildPortfolioOverviewData({
    workspaceId,
    tokenState: {
      saldo: tokenState.saldo,
      planMiesiecznyLimit: tokenState.planMiesiecznyLimit,
    },
  });

  const tokenCenterData = buildTokenCenterData({
    workspaceId,
    projects,
    tokenState,
  });

  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;

  const attentionProjects = projects
    .map((project) => {
      const publications = publicationsByProject[project.id] ?? [];
      const upcoming7d = publications.filter((publication) => {
        const ts = new Date(publication.dataPublikacjiISO).getTime();
        return ts >= now && ts <= next7Boundary;
      });
      const overdue = publications.filter((publication) => {
        const ts = new Date(publication.dataPublikacjiISO).getTime();
        return ts < now && publication.status !== "opublikowane";
      });
      const unassignedUpcoming = upcoming7d.filter((publication) => !publication.assigneeId);
      const hasCadence = project.cadence.czestotliwoscTygodniowa > 0 && project.cadence.dniTygodnia.length > 0;
      const hasChannels = project.kanaly.length > 0;

      let score = 0;
      const reasons: string[] = [];
      if (upcoming7d.length === 0) {
        score += 30;
        reasons.push("brak publikacji 7 dni");
      }
      if (overdue.length > 0) {
        score += overdue.length * 10;
        reasons.push(`zaległe: ${overdue.length}`);
      }
      if (unassignedUpcoming.length > 0) {
        score += unassignedUpcoming.length * 8;
        reasons.push(`bez przypisania: ${unassignedUpcoming.length}`);
      }
      if (!hasCadence) {
        score += 15;
        reasons.push("brak cadence");
      }
      if (!hasChannels) {
        score += 15;
        reasons.push("brak kanałów");
      }

      return {
        projectId: project.id,
        projectName: project.nazwa,
        score,
        reason: reasons.join(" • ") || "brak sygnałów ryzyka",
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.projectId.localeCompare(right.projectId);
    })
    .slice(0, 5);

  const aggregated = projects.flatMap((project) =>
    (publicationsByProject[project.id] ?? []).map((publication) => ({
      id: publication.id,
      projectId: project.id,
      projectName: project.nazwa,
      dateISO: publication.dataPublikacjiISO,
      title: publication.tytul,
      assigneeName: publication.assigneeName,
      status: publication.status,
    })),
  );

  const upcoming = aggregated.filter((item) => {
    const ts = new Date(item.dateISO).getTime();
    return ts >= now && ts <= next7Boundary;
  });
  const overdue = aggregated.filter((item) => {
    const ts = new Date(item.dateISO).getTime();
    return ts < now && item.status !== "opublikowane";
  });
  const unassignedUpcoming = upcoming.filter((item) => !item.assigneeName);

  const publicationSections = [
    {
      title: "Nadchodzące 7 dni",
      items: upcoming.slice(0, 10),
      remainingCount: Math.max(0, upcoming.length - 10),
    },
    {
      title: "Zaległe",
      items: overdue.slice(0, 10),
      remainingCount: Math.max(0, overdue.length - 10),
    },
    {
      title: "Bez przypisania (7 dni)",
      items: unassignedUpcoming.slice(0, 10),
      remainingCount: Math.max(0, unassignedUpcoming.length - 10),
    },
  ];

  return (
    <PortfolioExecutivePackView
      generatedAtLabel={new Date().toLocaleString("pl-PL")}
      planId="control_tower"
      tokenState={tokenState}
      workspaceSlug={workspaceSlug}
      portfolioData={portfolioData}
      tokenCenterData={tokenCenterData}
      actions={actions}
      attentionProjects={attentionProjects}
      publicationSections={publicationSections}
    />
  );
}
