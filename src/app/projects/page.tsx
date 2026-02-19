import Link from "next/link";
import { redirect } from "next/navigation";

import { PortfolioActionCards } from "@/components/projects/PortfolioActionCards";
import { PortfolioOverview, type PortfolioOverviewData } from "@/components/projects/PortfolioOverview";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { TokenCenter, type TokenCenterData } from "@/components/projects/TokenCenter";
import { getRecentTelemetry } from "@/lib/domain/controlTowerV3/telemetry";
import type { PlanId } from "@/lib/billing/planConfig";
import { buildPortfolioActions } from "@/lib/portfolio/portfolioRecommendations";
import { getProjectMembers, listProjects, listPublications, type PublicationJob } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";
import { listMembers } from "@/lib/team/teamStore";

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
  if (kind === "outline") {
    return 10;
  }
  if (kind === "draft") {
    return 30;
  }
  if (kind === "seo") {
    return 15;
  }
  return 20;
}

function toTop3Counts(counter: Map<string, number>): UsageCount[] {
  return [...counter.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
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
    if (timestamp < last7Start || timestamp > now) {
      continue;
    }

    const metadata = event.metadata;
    const wouldConsume = Boolean(metadata && metadata.wouldConsumeTokens === true);
    if (!wouldConsume) {
      continue;
    }

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
    const avgPerDay = count / 7;
    estimatedDailyBurn += avgPerDay * costPerKind(kind);
  }

  const tokenUsagePercent = args.tokenState.planMiesiecznyLimit === "bez_limitu"
    ? null
    : Math.max(0, Math.min(100, Math.round(((args.tokenState.planMiesiecznyLimit - args.tokenState.saldo) / args.tokenState.planMiesiecznyLimit) * 100)));

  const renewalLabel = new Date(args.tokenState.odnowienieISO).toLocaleDateString("pl-PL");
  const limitLabel = args.tokenState.planMiesiecznyLimit === "bez_limitu"
    ? "Bez limitu"
    : `${args.tokenState.planMiesiecznyLimit}`;

  let forecastLabel = "";
  if (args.tokenState.planMiesiecznyLimit === "bez_limitu") {
    forecastLabel = "Bez limitu";
  } else if (estimatedDailyBurn === 0) {
    forecastLabel = "Brak zużycia — AI nie jest używane";
  } else if (args.tokenState.saldo === 0) {
    forecastLabel = "AI wstrzymane — brak tokenów";
  } else {
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

    if (!hasCadence) {
      projectsWithoutCadence += 1;
    }
    if (!hasChannels) {
      projectsWithoutChannels += 1;
    }
    if (publications.length === 0) {
      projectsWithoutPublications += 1;
    }

    let hasPublicationNext7Days = false;
    for (const publication of publications) {
      const publicationTime = new Date(publication.dataPublikacjiISO).getTime();
      if (publicationTime >= now && publicationTime <= next7Boundary) {
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

export default async function ProjectsPage() {
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  const projects = listProjects(activeWorkspace.workspace.id);
  const allMembers = listMembers(activeWorkspace.workspace.id);
  const publicationsByProject: Record<string, PublicationJob[]> = {};
  const membersByProject: Record<string, number> = {};

  for (const project of projects) {
    publicationsByProject[project.id] = listPublications(activeWorkspace.workspace.id, project.id);
    const projectMemberIds = new Set(getProjectMembers(activeWorkspace.workspace.id, project.id).map((item) => item.memberId));
    membersByProject[project.id] = allMembers.filter((member) => projectMemberIds.has(member.id)).length;
  }

  const portfolioData = buildPortfolioOverviewData({
    workspaceId: activeWorkspace.workspace.id,
    tokenState: {
      saldo: tokenState.saldo,
      planMiesiecznyLimit: tokenState.planMiesiecznyLimit,
    },
  });
  const tokenCenterData = buildTokenCenterData({
    workspaceId: activeWorkspace.workspace.id,
    projects,
    tokenState,
  });
  const tokenUsagePercent = tokenState.planMiesiecznyLimit === "bez_limitu"
    ? null
    : Math.max(0, Math.min(100, Math.round(((tokenState.planMiesiecznyLimit - tokenState.saldo) / tokenState.planMiesiecznyLimit) * 100)));

  const rawTelemetry = getRecentTelemetry(activeWorkspace.workspace.id);
  const portfolioActions = buildPortfolioActions({
    workspaceId: activeWorkspace.workspace.id,
    projects,
    publicationsByProject,
    membersByProject,
    telemetryEvents: tokenUsagePercent === null
      ? rawTelemetry
      : [
          ...rawTelemetry,
          {
            workspaceId: activeWorkspace.workspace.id,
            type: "pressure_computed",
            timestampISO: new Date().toISOString(),
            metadata: { tokenUsagePercent },
          },
        ],
  });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B7CFA]">Workspace: {activeWorkspace.workspace.name}</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#0F172A]">Centrum dowodzenia</h1>
          <p className="mt-2 text-sm text-[#475569]">Zarządzaj inicjatywami contentowymi i przechodź do execution z poziomu projektu.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/w/${activeWorkspace.workspace.slug}/content`}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#475569]"
          >
            Workspace content
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
          >
            + Nowy projekt
          </Link>
        </div>
      </header>

      <PortfolioOverview data={portfolioData} workspaceSlug={activeWorkspace.workspace.slug} />
      <div id="tokeny">
        <TokenCenter data={tokenCenterData} />
      </div>
      <PortfolioActionCards actions={portfolioActions} />
      <ProjectGrid projects={projects} planId={planId} tokenState={tokenState} />
    </section>
  );
}
