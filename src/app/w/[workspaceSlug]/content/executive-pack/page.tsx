import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExecutionPackView } from "@/app/w/[workspaceSlug]/content/_components/execution-pack-view";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { getRecentOutcomes } from "@/lib/domain/controlTowerV3";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type FocusKind = "draft" | "optimization" | "risk";

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseOutcomeDetails(details?: string): {
  kind?: FocusKind;
  estMins?: number;
  durationSeconds?: number;
  assigneeId?: string;
  assigneeName?: string;
} {
  if (!details) {
    return {};
  }

  try {
    const parsed = JSON.parse(details) as {
      metadata?: { kind?: string; estMins?: number; assigneeId?: string; assigneeName?: string };
      durationSeconds?: number;
    };

    const kind = parsed.metadata?.kind;
    return {
      kind: kind === "draft" || kind === "optimization" || kind === "risk" ? kind : undefined,
      estMins: typeof parsed.metadata?.estMins === "number" ? parsed.metadata.estMins : undefined,
      durationSeconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : undefined,
      assigneeId: typeof parsed.metadata?.assigneeId === "string" && parsed.metadata.assigneeId.length > 0 ? parsed.metadata.assigneeId : undefined,
      assigneeName: typeof parsed.metadata?.assigneeName === "string" && parsed.metadata.assigneeName.length > 0 ? parsed.metadata.assigneeName : undefined,
    };
  } catch {
    return {};
  }
}

function kindFromIntent(intent: string): FocusKind | undefined {
  if (intent.endsWith("_draft")) {
    return "draft";
  }
  if (intent.endsWith("_optimization")) {
    return "optimization";
  }
  if (intent.endsWith("_risk")) {
    return "risk";
  }
  return undefined;
}

export default async function ContentExecutivePackPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const search = await searchParams;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const assigneeFilter = toValue(search.assignee) || "all";
    const outcomes = await getRecentOutcomes({ workspaceId: access.workspace.id, windowHours: 7 * 24 });

    const normalizedOutcomes = outcomes.map((item) => {
      const details = parseOutcomeDetails(item.evidence.details);
      const durationFromCounts = item.evidence.changedCounts?.durationSeconds;
      return {
        outcome: item.outcome,
        kind: details.kind ?? kindFromIntent(item.intent) ?? "draft",
        durationSeconds: typeof durationFromCounts === "number"
          ? Math.max(0, Math.floor(durationFromCounts))
          : Math.max(0, Math.floor(details.durationSeconds ?? 0)),
        estMins: typeof details.estMins === "number" ? Math.max(1, Math.floor(details.estMins)) : 30,
        assigneeId: details.assigneeId ?? "self",
        assigneeName: details.assigneeName ?? "Ja",
      };
    }).filter((item) => item.outcome === "completed" || item.outcome === "abandoned" || item.outcome === "partial" || item.outcome === "ignored");

    const filteredOutcomes = assigneeFilter === "all"
      ? normalizedOutcomes
      : normalizedOutcomes.filter((item) => item.assigneeId === assigneeFilter);

    const totalSessions = filteredOutcomes.length;
    const completed = filteredOutcomes.filter((item) => item.outcome === "completed");
    const completedCount = completed.length;
    const abandoned = filteredOutcomes.filter((item) => item.outcome === "abandoned");
    const abandonedCount = abandoned.length;
    const completedRatePct = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

    const avgDurationSeconds = completed.length > 0
      ? Math.round(completed.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0) / completed.length)
      : 0;
    const avgDurationMinutes = Math.round(avgDurationSeconds / 60);

    const avgEstimationSeconds = completed.length > 0
      ? Math.round(completed.reduce((acc, item) => acc + Math.max(0, item.estMins * 60), 0) / completed.length)
      : 0;

    const kindDistribution = {
      draft: filteredOutcomes.filter((item) => item.kind === "draft").length,
      optimization: filteredOutcomes.filter((item) => item.kind === "optimization").length,
      risk: filteredOutcomes.filter((item) => item.kind === "risk").length,
    };

    const dominantKind = kindDistribution.optimization > kindDistribution.draft && kindDistribution.optimization >= kindDistribution.risk
      ? "Optimization"
      : kindDistribution.risk > kindDistribution.draft && kindDistribution.risk > kindDistribution.optimization
        ? "Risk"
        : "Draft";

    const weeklyRecommendation = totalSessions === 0
      ? "Brak danych dla wybranego filtra."
      : abandonedCount / Math.max(1, totalSessions) > 0.4
        ? "Zbyt wiele porzuconych sesji — rozważ skrócenie estymacji."
        : avgDurationSeconds > avgEstimationSeconds && avgEstimationSeconds > 0
          ? "Przekraczasz estymacje — plan może być zbyt ambitny."
          : completedRatePct > 80
            ? "Dobre tempo — możesz zwiększyć intensywność."
            : "Stabilna realizacja — utrzymaj rytm.";

    const weeklyCoverageCount = Number(toValue(search.coverageCount));
    const expectedWeeklyCoverage = 2;

    const abandonedRate = abandonedCount / Math.max(1, totalSessions);
    const backlogScore = clampScore(abandonedRate * 120);
    const coverageRatio = Number.isFinite(weeklyCoverageCount)
      ? weeklyCoverageCount / expectedWeeklyCoverage
      : 0;
    const coverageScore = clampScore((1 - Math.min(1, Math.max(0, coverageRatio))) * 100);
    const avgActualMins = avgDurationSeconds / 60;
    const avgEstMins = completed.length > 0
      ? completed.reduce((acc, item) => acc + Math.max(1, item.estMins), 0) / completed.length
      : 30;
    const overrunRatio = avgActualMins / Math.max(1, avgEstMins);
    const timeScore = clampScore((overrunRatio - 1) * 80);
    const totalPressure = clampScore((0.45 * backlogScore) + (0.35 * timeScore) + (0.20 * coverageScore));
    const pressureBand = totalPressure <= 34 ? "niskie" : totalPressure <= 69 ? "średnie" : "wysokie";

    const totalTimeSeconds = filteredOutcomes.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);
    const abandonedTimeSeconds = abandoned.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);
    const investedHours = Math.round((totalTimeSeconds / 3600) * 10) / 10;
    const wastedHours = Math.round((abandonedTimeSeconds / 3600) * 10) / 10;
    const wastedSharePct = Math.round((abandonedTimeSeconds * 100) / Math.max(1, totalTimeSeconds));
    const dailyCompleted = completedCount / 7;
    const proj30 = Math.round(dailyCompleted * 30);

    const roiRecommendation = wastedSharePct >= 30
      ? `Odzyskasz ~${(Math.round((wastedHours * 0.5) * 10) / 10).toFixed(1)}h/tydzień, jeśli ograniczysz porzucone sesje o połowę.`
      : completedRatePct >= 80 && totalPressure <= 34
        ? "Masz zapas — rozważ zwiększenie intensywności (więcej sesji/tydzień)."
        : "Utrzymaj rytm i domykaj sesje — to najszybciej poprawia ROI.";

    const assigneeLabel = assigneeFilter === "all"
      ? "Wszyscy"
      : assigneeFilter === "self"
        ? "Ja"
        : normalizedOutcomes.find((item) => item.assigneeId === assigneeFilter)?.assigneeName ?? assigneeFilter;

    return (
      <AppShell title="Weekly Execution Pack" activeHref={`/w/${workspaceSlug}/content`} workspaceSlug={workspaceSlug}>
        <PageHeader
          title="Weekly Execution Pack"
          subtitle="Podgląd sekcji Weekly Review, Pressure i ROI dla ostatnich 7 dni."
        />

        <ExecutionPackView
          workspaceSlug={workspaceSlug}
          generatedAtIso={new Date().toISOString()}
          assigneeLabel={assigneeLabel}
          pdfEnabled={false}
          weeklyReview={totalSessions > 0 ? {
            totalSessions,
            completedCount,
            completedRatePct,
            avgDurationMinutes,
            dominantKind,
            recommendation: weeklyRecommendation,
          } : null}
          pressure={{
            total: totalPressure,
            backlog: backlogScore,
            time: timeScore,
            coverage: coverageScore,
            band: pressureBand,
          }}
          roi={{
            totalCount: totalSessions,
            investedHours,
            completedCount,
            wastedHours,
            wastedSharePct,
            proj30,
            recommendation: roiRecommendation,
          }}
        />
      </AppShell>
    );
  } catch {
    notFound();
  }
}
