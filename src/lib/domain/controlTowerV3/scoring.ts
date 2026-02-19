import { healthLabel } from "./copy-pl";
import type { HealthBreakdownEntry, HealthScore, Metrics, WorkspaceContext } from "./types";

function entry(
  key: string,
  title: string,
  points: number,
  maxPoints: number,
  explanation: string,
  relatedHref: string,
): HealthBreakdownEntry {
  const ratio = maxPoints > 0 ? points / maxPoints : 0;

  return {
    key,
    title,
    points,
    maxPoints,
    explanation,
    severity: ratio < 0.4 ? "danger" : ratio < 0.7 ? "warning" : "info",
    relatedHref,
  };
}

function scorePipeline(metrics: Metrics, slug: string): HealthBreakdownEntry {
  const max = 25;
  const penalty = Math.min(20, metrics.overdueCount * 3 + metrics.reviewOver48hCount * 2 + metrics.overdueMaxAgeDays);
  const points = Math.max(0, max - penalty);

  return entry(
    "pipeline",
    "Przepływ workflow",
    points,
    max,
    `Zaległe: ${metrics.overdueCount}, REVIEW >48h: ${metrics.reviewOver48hCount}.`,
    `/w/${slug}/content`,
  );
}

function scoreScheduling(metrics: Metrics, slug: string): HealthBreakdownEntry {
  const max = 25;
  const points = metrics.noneUpcomingWeek ? 4 : Math.min(max, 10 + metrics.upcomingWeek * 3);

  return entry(
    "scheduling",
    "Plan publikacji",
    points,
    max,
    metrics.noneUpcomingWeek
      ? "Brak zaplanowanych publikacji na 7 dni."
      : `Zaplanowane: dziś ${metrics.upcomingToday}, jutro ${metrics.upcomingTomorrow}, tydzień ${metrics.upcomingWeek}.`,
    `/w/${slug}/calendar`,
  );
}

function scoreCadence(metrics: Metrics, slug: string): HealthBreakdownEntry {
  const max = 25;
  const activity = metrics.createdLast7d + metrics.versionsLast7d + metrics.aiJobsLast7d;
  const points = Math.min(max, activity === 0 ? 5 : 8 + Math.min(17, activity));

  return entry(
    "cadence",
    "Aktywność zespołu",
    points,
    max,
    `Nowe treści: ${metrics.createdLast7d}, wersje: ${metrics.versionsLast7d}, AI: ${metrics.aiJobsLast7d}.`,
    `/w/${slug}/content`,
  );
}

function scoreResources(metrics: Metrics, slug: string): HealthBreakdownEntry {
  const max = 25;
  const remainingPct = Math.round((1 - metrics.creditsUsedPct) * 100);
  const points = metrics.lowCredits ? 8 : metrics.warningCredits ? 14 : 22;

  return entry(
    "resources",
    "Zasoby AI",
    points,
    max,
    `Pozostały budżet AI: ${Math.max(0, remainingPct)}%.`,
    `/w/${slug}/content`,
  );
}

export function computeHealthScore(metrics: Metrics, workspace: WorkspaceContext): HealthScore {
  const breakdown = [
    scorePipeline(metrics, workspace.workspaceSlug),
    scoreScheduling(metrics, workspace.workspaceSlug),
    scoreCadence(metrics, workspace.workspaceSlug),
    scoreResources(metrics, workspace.workspaceSlug),
  ];

  const score = Math.max(
    0,
    Math.min(
      100,
      breakdown.reduce((acc, part) => acc + part.points, 0),
    ),
  );

  const topDetractors = [...breakdown].sort((a, b) => a.points / a.maxPoints - b.points / b.maxPoints).slice(0, 2);
  const topBoosters = [...breakdown].sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints).slice(0, 2);

  return {
    score,
    label: healthLabel(score),
    breakdown,
    topDetractors,
    topBoosters,
  };
}
