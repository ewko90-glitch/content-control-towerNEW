"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

export type WeeklyReviewOutcome = {
  outcome: "completed" | "abandoned" | "partial" | "ignored";
  kind: "draft" | "optimization" | "risk";
  durationSeconds: number;
  estMins: number;
  assigneeId: string;
  assigneeName: string;
};

type WeeklyReviewProps = {
  workspaceId: string;
  outcomes: WeeklyReviewOutcome[];
  members: Array<{ id: string; name: string }>;
  selectedAssigneeId: string;
  onSelectedAssigneeIdChange: (assigneeId: string) => void;
  filteredOutcomes: WeeklyReviewOutcome[];
  refreshHref: string;
  executivePackAccess?: AccessResult;
};

export function getAssigneeFilterOptions(members: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  const options: Array<{ id: string; name: string }> = [
    { id: "all", name: "Wszyscy" },
    { id: "self", name: "Ja" },
  ];

  for (const member of members) {
    if (member.id !== "self") {
      options.push(member);
    }
  }

  return options;
}

export function filterOutcomesByAssignee(outcomes: WeeklyReviewOutcome[], selectedAssigneeId: string): WeeklyReviewOutcome[] {
  if (selectedAssigneeId === "all") {
    return outcomes;
  }
  return outcomes.filter((item) => item.assigneeId === selectedAssigneeId);
}

function recommendation(params: {
  totalSessions: number;
  completedCount: number;
  abandonedCount: number;
  avgDurationSeconds: number;
  avgEstimationSeconds: number;
}): string {
  const abandonedRate = params.abandonedCount / Math.max(1, params.totalSessions);
  const completedRatePct = params.totalSessions > 0 ? Math.round((params.completedCount / params.totalSessions) * 100) : 0;

  if (abandonedRate > 0.4) {
    return "Zbyt wiele porzuconych sesji — rozważ skrócenie estymacji.";
  }
  if (params.avgDurationSeconds > params.avgEstimationSeconds && params.avgEstimationSeconds > 0) {
    return "Przekraczasz estymacje — plan może być zbyt ambitny.";
  }
  if (completedRatePct > 80) {
    return "Dobre tempo — możesz zwiększyć intensywność.";
  }
  return "Stabilna realizacja — utrzymaj rytm.";
}

export function WeeklyReview({
  workspaceId,
  outcomes,
  members,
  selectedAssigneeId,
  onSelectedAssigneeIdChange,
  filteredOutcomes,
  refreshHref,
  executivePackAccess = { status: "ok" },
}: WeeklyReviewProps) {
  const didEmitViewed = useRef(false);
  const filterOptions = useMemo(() => getAssigneeFilterOptions(members), [members]);
  const workspacePrefix = useMemo(() => {
    const marker = "/calendar/refresh";
    const index = refreshHref.indexOf(marker);
    if (index > -1) {
      return refreshHref.slice(0, index);
    }
    return "";
  }, [refreshHref]);
  const exportHref = workspacePrefix
    ? `${workspacePrefix}/content/executive-pack?assignee=${encodeURIComponent(selectedAssigneeId)}&preview=1`
    : `?assignee=${encodeURIComponent(selectedAssigneeId)}&preview=1`;

  const summary = useMemo(() => {
    if (filteredOutcomes.length === 0) {
      return null;
    }

    const totalSessions = filteredOutcomes.length;
    const completed = filteredOutcomes.filter((item) => item.outcome === "completed");
    const completedCount = completed.length;
    const abandonedCount = filteredOutcomes.filter((item) => item.outcome === "abandoned").length;
    const completedRatePct = Math.round((completedCount / totalSessions) * 100);

    const avgDurationSeconds = completed.length > 0
      ? Math.round(completed.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0) / completed.length)
      : 0;
    const avgDurationMinutes = Math.round(avgDurationSeconds / 60);

    const avgEstimationSeconds = completed.length > 0
      ? Math.round(completed.reduce((acc, item) => acc + Math.max(0, item.estMins * 60), 0) / completed.length)
      : 0;

    const distribution = {
      draft: filteredOutcomes.filter((item) => item.kind === "draft").length,
      optimization: filteredOutcomes.filter((item) => item.kind === "optimization").length,
      risk: filteredOutcomes.filter((item) => item.kind === "risk").length,
    };

    const dominantKind = distribution.optimization > distribution.draft && distribution.optimization >= distribution.risk
      ? "Optimization"
      : distribution.risk > distribution.draft && distribution.risk > distribution.optimization
        ? "Risk"
        : "Draft";

    return {
      totalSessions,
      completedCount,
      abandonedCount,
      completedRatePct,
      avgDurationMinutes,
      dominantKind,
      recommendation: recommendation({
        totalSessions,
        completedCount,
        abandonedCount,
        avgDurationSeconds,
        avgEstimationSeconds,
      }),
    };
  }, [filteredOutcomes]);

  useEffect(() => {
    if (didEmitViewed.current) {
      return;
    }
    didEmitViewed.current = true;
    recordTelemetry({
      workspaceId,
      type: "weekly_review_viewed",
      timestampISO: new Date().toISOString(),
      metadata: {
        outcomesCount: outcomes.length,
      },
    });
  }, [workspaceId, outcomes.length]);

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Podsumowanie tygodnia</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAssigneeId}
              onChange={(event) => onSelectedAssigneeIdChange(event.target.value)}
              aria-label="Filtr podsumowania tygodnia"
              title="Filtr podsumowania tygodnia"
              className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-text"
            >
              {filterOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>

            {executivePackAccess.status === "ok" ? (
              <Link
                href={exportHref}
                onClick={() => {
                  recordTelemetry({
                    workspaceId,
                    type: "executive_pack_opened",
                    timestampISO: new Date().toISOString(),
                    metadata: {
                      assigneeId: selectedAssigneeId,
                    },
                  });
                }}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
              >
                Eksportuj Weekly Pack
              </Link>
            ) : (
              <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface2 px-3 text-xs text-muted">
                Eksport niedostępny
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!summary ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Brak danych dla wybranego filtra.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">Sesje</p>
                <p className="text-xl font-semibold text-text">{summary.totalSessions}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">Ukończone</p>
                <p className="text-xl font-semibold text-text">
                  {summary.completedCount} ({summary.completedRatePct}%)
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">Średni czas</p>
                <p className="text-xl font-semibold text-text">{summary.avgDurationMinutes} min</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">Dominujący typ</p>
                <p className="text-xl font-semibold text-text">{summary.dominantKind}</p>
              </div>
            </div>

            <p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-text">
              {summary.recommendation}
            </p>
          </>
        )}

        <div className="mt-3">
          <Link href={refreshHref} className="text-xs text-primary hover:underline">
            Odśwież plan na podstawie tygodnia
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
