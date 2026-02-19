"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";
import {
  WeeklyReview,
  filterOutcomesByAssignee,
  type WeeklyReviewOutcome,
} from "@/app/w/[workspaceSlug]/content/_components/weekly-review";
import { makeExplainId, type ExplainEnvelope } from "@/lib/domain/controlTowerV3/explainability";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

type RoiLiteProps = {
  workspaceId: string;
  outcomes: WeeklyReviewOutcome[];
  weeklyPressureScore: number;
};

function buildRoiMetrics(outcomes: WeeklyReviewOutcome[]) {
  const totalCount = outcomes.length;
  const completed = outcomes.filter((item) => item.outcome === "completed");
  const completedCount = completed.length;
  const abandoned = outcomes.filter((item) => item.outcome === "abandoned");
  const abandonedCount = abandoned.length;

  const totalTimeSeconds = outcomes.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);
  const abandonedTimeSeconds = abandoned.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);

  const investedHours = Math.round((totalTimeSeconds / 3600) * 10) / 10;
  const wastedHours = Math.round((abandonedTimeSeconds / 3600) * 10) / 10;
  const wastedSharePct = Math.round(100 * abandonedTimeSeconds / Math.max(1, totalTimeSeconds));
  const deliveryRatePct = Math.round(100 * completedCount / Math.max(1, totalCount));

  const dailyCompleted = completedCount / 7;
  const proj30 = Math.round(dailyCompleted * 30);

  return {
    totalCount,
    completedCount,
    abandonedCount,
    totalTimeSeconds,
    abandonedTimeSeconds,
    investedHours,
    wastedHours,
    wastedSharePct,
    deliveryRatePct,
    proj30,
  };
}

function roiRecommendation(params: {
  wastedSharePct: number;
  wastedHours: number;
  deliveryRatePct: number;
  weeklyPressureScore: number;
}): { key: "waste_high" | "high_delivery_low_pressure" | "steady"; text: string } {
  if (params.wastedSharePct >= 30) {
    return {
      key: "waste_high",
      text: `Odzyskasz ~${(Math.round((params.wastedHours * 0.5) * 10) / 10).toFixed(1)}h/tydzień, jeśli ograniczysz porzucone sesje o połowę.`,
    };
  }

  if (params.deliveryRatePct >= 80 && params.weeklyPressureScore <= 34) {
    return {
      key: "high_delivery_low_pressure",
      text: "Masz zapas — rozważ zwiększenie intensywności (więcej sesji/tydzień).",
    };
  }

  return {
    key: "steady",
    text: "Utrzymaj rytm i domykaj sesje — to najszybciej poprawia ROI.",
  };
}

type RoiLiteCardProps = RoiLiteProps & {
  assigneeId: string;
  onExplainRequest?: (envelope: ExplainEnvelope) => void;
  access?: AccessResult;
};

function RoiLiteCard({ workspaceId, outcomes, weeklyPressureScore, assigneeId, onExplainRequest, access = { status: "ok" } }: RoiLiteCardProps) {
  if (access.status !== "ok") {
    return <FeatureLockCard tytulFunkcji="ROI Lite (7 dni)" access={access} />;
  }

  const metrics = useMemo(() => buildRoiMetrics(outcomes), [outcomes]);
  const didEmitViewed = useRef(false);

  useEffect(() => {
    if (didEmitViewed.current) {
      return;
    }
    didEmitViewed.current = true;
    recordTelemetry({
      workspaceId,
      type: "roi_viewed",
      timestampISO: new Date().toISOString(),
      metadata: {
        investedHours: metrics.investedHours,
        deliveryRatePct: metrics.deliveryRatePct,
      },
    });
  }, [workspaceId, metrics.investedHours, metrics.deliveryRatePct]);

  if (metrics.totalCount === 0) {
    return (
      <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>ROI Lite (7 dni)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Brak danych ROI — uruchom Focus Session.
          </p>
        </CardContent>
      </Card>
    );
  }

  const recommendation = roiRecommendation({
    wastedSharePct: metrics.wastedSharePct,
    wastedHours: metrics.wastedHours,
    deliveryRatePct: metrics.deliveryRatePct,
    weeklyPressureScore,
  });

  const recommendationRuleId = recommendation.key === "waste_high"
    ? "roi:waste_high"
    : recommendation.key === "high_delivery_low_pressure"
      ? "roi:high_delivery_low_pressure"
      : "roi:steady";

  const timestampISO = new Date().toISOString();
  const dayKey = timestampISO.slice(0, 10);
  const explainEnvelope: ExplainEnvelope = {
    id: makeExplainId(["roi", dayKey, assigneeId, workspaceId]),
    module: "roi",
    ruleId: recommendationRuleId,
    workspaceId,
    assigneeId,
    timestampISO,
    inputs: {
      investedHours: metrics.investedHours,
      wastedSharePct: metrics.wastedSharePct,
      deliveryRatePct: metrics.deliveryRatePct,
      pressure: weeklyPressureScore,
    },
    outputs: {
      recommendationKey: recommendation.key,
      projection30: metrics.proj30,
      kpis: {
        totalCount: metrics.totalCount,
        completedCount: metrics.completedCount,
        abandonedCount: metrics.abandonedCount,
        wastedHours: metrics.wastedHours,
      },
    },
  };

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>ROI Lite (7 dni)</CardTitle>
          <button
            type="button"
            onClick={() => onExplainRequest?.(explainEnvelope)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Dlaczego?
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Czas zainwestowany</p>
            <p className="text-xl font-semibold text-text">{metrics.investedHours.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Dowiezione</p>
            <p className="text-xl font-semibold text-text">{metrics.completedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Koszt porzuceń</p>
            <p className="text-xl font-semibold text-text">{metrics.wastedHours.toFixed(1)}h ({metrics.wastedSharePct}%)</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Prognoza 30 dni</p>
            <p className="text-xl font-semibold text-text">{metrics.proj30}</p>
          </div>
        </div>

        <p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-text">{recommendation.text}</p>
      </CardContent>
    </Card>
  );
}

type WeeklyReviewWithRoiLiteProps = {
  workspaceId: string;
  outcomes: WeeklyReviewOutcome[];
  members: Array<{ id: string; name: string }>;
  refreshHref: string;
  weeklyPressureScore: number;
  onExplainRequest?: (envelope: ExplainEnvelope) => void;
  weeklyReviewAccess?: AccessResult;
  roiAccess?: AccessResult;
  executivePackAccess?: AccessResult;
};

export function WeeklyReviewWithRoiLite({
  workspaceId,
  outcomes,
  members,
  refreshHref,
  weeklyPressureScore,
  onExplainRequest,
  weeklyReviewAccess = { status: "ok" },
  roiAccess = { status: "ok" },
  executivePackAccess = { status: "ok" },
}: WeeklyReviewWithRoiLiteProps) {
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const filteredOutcomes = useMemo(
    () => filterOutcomesByAssignee(outcomes, selectedAssigneeId),
    [outcomes, selectedAssigneeId],
  );

  return (
    <>
      {weeklyReviewAccess.status !== "ok" ? (
        <FeatureLockCard tytulFunkcji="Podsumowanie tygodnia" access={weeklyReviewAccess} />
      ) : (
        <WeeklyReview
          workspaceId={workspaceId}
          outcomes={outcomes}
          members={members}
          selectedAssigneeId={selectedAssigneeId}
          onSelectedAssigneeIdChange={setSelectedAssigneeId}
          filteredOutcomes={filteredOutcomes}
          refreshHref={refreshHref}
          executivePackAccess={executivePackAccess}
        />
      )}
      <RoiLiteCard
        workspaceId={workspaceId}
        outcomes={filteredOutcomes}
        weeklyPressureScore={weeklyPressureScore}
        assigneeId={selectedAssigneeId}
        onExplainRequest={onExplainRequest}
        access={roiAccess}
      />
    </>
  );
}
