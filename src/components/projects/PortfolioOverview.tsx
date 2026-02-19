import { PortfolioAlerts } from "@/components/projects/PortfolioAlerts";
import { PortfolioKpiCard } from "@/components/projects/PortfolioKpiCard";
import { PortfolioRecommendations } from "@/components/projects/PortfolioRecommendations";

type PortfolioOverviewProjectSignal = {
  projectId: string;
  publicationsCount: number;
  hasCadence: boolean;
  hasChannels: boolean;
  hasPublicationNext7Days: boolean;
};

export type PortfolioOverviewData = {
  totalProjects: number;
  totalPublications: number;
  publicationsNext7Days: number;
  projectsWithoutPublications: number;
  projectsWithoutCadence: number;
  projectsWithoutChannels: number;
  tokenUsagePercent: number | null;
  projectSignals: PortfolioOverviewProjectSignal[];
};

type PortfolioOverviewProps = {
  data: PortfolioOverviewData;
  workspaceSlug: string;
};

type AlertItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

function firstProjectHref(data: PortfolioOverviewData, workspaceSlug: string, predicate: (item: PortfolioOverviewProjectSignal) => boolean): string {
  const candidate = data.projectSignals.find(predicate);
  if (!candidate) {
    return `/w/${workspaceSlug}/content`;
  }
  return `/projects/${candidate.projectId}`;
}

function buildAlerts(data: PortfolioOverviewData, workspaceSlug: string): AlertItem[] {
  const items: AlertItem[] = [];

  if (data.projectsWithoutPublications > 0) {
    items.push({
      id: "without-publications",
      title: "Projekty bez publikacji",
      description: `${data.projectsWithoutPublications} projekt(y) nie mają jeszcze zaplanowanych treści.`,
      href: firstProjectHref(data, workspaceSlug, (item) => item.publicationsCount === 0),
      ctaLabel: "Przejdź do projektu",
    });
  }

  if (data.projectsWithoutCadence > 0) {
    items.push({
      id: "without-cadence",
      title: "Brak cadence",
      description: `${data.projectsWithoutCadence} projekt(y) nie mają ustawionego rytmu publikacji.`,
      href: firstProjectHref(data, workspaceSlug, (item) => !item.hasCadence),
      ctaLabel: "Przejdź do projektu",
    });
  }

  if (data.publicationsNext7Days === 0) {
    items.push({
      id: "next7-empty",
      title: "Pusty tydzień publikacji",
      description: "Brak zaplanowanych publikacji w najbliższych 7 dniach.",
      href: `/w/${workspaceSlug}/content`,
      ctaLabel: "Przejdź do content",
    });
  }

  if (data.tokenUsagePercent !== null && data.tokenUsagePercent > 80) {
    items.push({
      id: "tokens-high-usage",
      title: "Wysokie zużycie tokenów",
      description: `Wykorzystanie tokenów osiągnęło ${data.tokenUsagePercent}% limitu.`,
      href: `/w/${workspaceSlug}/content`,
      ctaLabel: "Sprawdź działania AI",
    });
  }

  return items;
}

function buildRecommendations(data: PortfolioOverviewData): string[] {
  const recommendations: string[] = [];

  if (data.projectsWithoutPublications > 1) {
    recommendations.push("Zaplanuj publikacje dla brakujących projektów.");
  }

  if (data.publicationsNext7Days === 0) {
    recommendations.push("Dodaj publikację na ten tydzień.");
  }

  if (data.projectsWithoutChannels > 0) {
    recommendations.push("Uzupełnij kanały w ustawieniach projektu.");
  }

  return recommendations;
}

function formatTokenUsage(value: number | null): string {
  if (value === null) {
    return "∞";
  }
  return `${value}%`;
}

export function PortfolioOverview({ data, workspaceSlug }: PortfolioOverviewProps) {
  const alerts = buildAlerts(data, workspaceSlug);
  const recommendations = buildRecommendations(data);

  return (
    <section className="mb-8 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PortfolioKpiCard label="Projekty" value={String(data.totalProjects)} />
        <PortfolioKpiCard label="Publikacje" value={String(data.totalPublications)} />
        <PortfolioKpiCard label="Publikacje w tym tygodniu" value={String(data.publicationsNext7Days)} />
        <PortfolioKpiCard label="Projekty bez planu" value={String(data.projectsWithoutCadence)} />
        <PortfolioKpiCard label="Wykorzystanie tokenów" value={formatTokenUsage(data.tokenUsagePercent)} hint={data.tokenUsagePercent === null ? "Plan bez limitu tokenów" : "Im niższy poziom, tym większy bufor AI."} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PortfolioAlerts alerts={alerts} />
        <PortfolioRecommendations items={recommendations} />
      </div>
    </section>
  );
}
