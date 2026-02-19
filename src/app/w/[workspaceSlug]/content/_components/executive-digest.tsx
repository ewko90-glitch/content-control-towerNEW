"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";
import { makeExplainId, type ExplainEnvelope } from "@/lib/domain/controlTowerV3/explainability";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

type DigestOutcome = {
  outcome: "completed" | "abandoned" | "partial" | "ignored";
  durationSeconds: number;
  estMins: number;
};

type ExecutiveDigestProps = {
  workspaceId: string;
  workspaceSlug: string;
  assigneeId: string;
  assigneeLabel: string;
  outcomesFiltered: DigestOutcome[];
  totalPressure: number;
  weeklyCoverageCount: number;
  onExplainRequest?: (envelope: ExplainEnvelope) => void;
  access?: AccessResult;
};

type DigestRecommendation = {
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
  hint?: string;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function ExecutiveDigest({
  workspaceId,
  workspaceSlug,
  assigneeId,
  assigneeLabel,
  outcomesFiltered,
  totalPressure,
  weeklyCoverageCount,
  onExplainRequest,
  access = { status: "ok" },
}: ExecutiveDigestProps) {
  if (access.status !== "ok") {
    return <FeatureLockCard tytulFunkcji="Executive Digest" access={access} />;
  }

  const didEmitDigest = useRef(false);
  const totalCount = outcomesFiltered.length;

  if (totalCount === 0) {
    return (
      <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>Executive Digest</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Brak danych. Zrób 1 Focus Session, aby uruchomić digest.
          </p>
        </CardContent>
      </Card>
    );
  }

  const completed = outcomesFiltered.filter((item) => item.outcome === "completed");
  const abandoned = outcomesFiltered.filter((item) => item.outcome === "abandoned");

  const completedCount = completed.length;
  const abandonedCount = abandoned.length;
  const deliveryRatePct = Math.round(100 * completedCount / Math.max(1, totalCount));

  const totalTimeSeconds = outcomesFiltered.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);
  const abandonedTimeSeconds = abandoned.reduce((acc, item) => acc + Math.max(0, item.durationSeconds), 0);
  const investedHours = round1(totalTimeSeconds / 3600);
  const wastedSharePct = Math.round(100 * abandonedTimeSeconds / Math.max(1, totalTimeSeconds));
  const abandonedRate = abandonedCount / Math.max(1, totalCount);

  const avgActual = completed.length > 0
    ? completed.reduce((acc, item) => acc + (Math.max(0, item.durationSeconds) / 60), 0) / completed.length
    : 0;
  const avgEst = completed.length > 0
    ? completed.reduce((acc, item) => acc + Math.max(1, item.estMins), 0) / completed.length
    : 30;
  const overrunRatio = avgActual / Math.max(1, avgEst);

  useEffect(() => {
    if (didEmitDigest.current) {
      return;
    }
    didEmitDigest.current = true;
    recordTelemetry({
      workspaceId,
      type: "digest_rendered",
      timestampISO: new Date().toISOString(),
      metadata: {
        deliveryRatePct,
        wastedSharePct,
      },
    });
  }, [workspaceId, deliveryRatePct, wastedSharePct]);

  let insightRule = "insight:baseline_signals";
  let insight = "Masz już sygnały wykonania — kolejne sesje poprawią trafność priorytetów.";
  if (deliveryRatePct >= 80 && totalPressure <= 34) {
    insightRule = "insight:high_tempo_low_pressure";
    insight = "Tempo jest wysokie, a napięcie niskie — możesz bezpiecznie zwiększyć intensywność.";
  } else if (wastedSharePct < 20 && overrunRatio <= 1.05) {
    insightRule = "insight:fit_estimation";
    insight = "Dobre dopasowanie estymacji do rzeczywistości — plan jest realistyczny.";
  } else if (completedCount >= 5) {
    insightRule = "insight:high_completion";
    insight = "Wysoka liczba domknięć — system ma solidną pętlę wykonania.";
  }

  let riskRule = "risk:stable";
  let risk = "Brak krytycznych ryzyk — pilnuj rytmu i domykania.";
  if (totalPressure >= 70) {
    riskRule = "risk:high_pressure";
    risk = "Wysokie napięcie tygodnia — rośnie ryzyko przeciążenia i porzuceń.";
  } else if (wastedSharePct >= 30 || abandonedRate > 0.4) {
    riskRule = "risk:waste_or_abandonment";
    risk = "Dużo porzuconych sesji — tracisz czas bez dostarczenia wyniku.";
  } else if (overrunRatio >= 1.3) {
    riskRule = "risk:overrun";
    risk = "Często przekraczasz estymacje — plan może być zbyt ambitny.";
  } else if (weeklyCoverageCount < 2) {
    riskRule = "risk:low_coverage";
    risk = "Niskie pokrycie tygodnia — ryzyko improwizacji i chaosu.";
  }

  let recRule = "rec:steady";
  let recKey = "steady";
  let recommendation: DigestRecommendation = {
    text: "Utrzymaj plan i skup się na domykaniu 1 sesji dziennie.",
    hint: "Uruchom Focus Session z Trybu Dnia",
  };
  if (totalPressure >= 70 || wastedSharePct >= 30 || overrunRatio >= 1.3) {
    recRule = "rec:scale_down";
    recKey = "scale_down";
    recommendation = {
      text: "Zastosuj Scale Down i odśwież plan na 2 tygodnie.",
      ctaLabel: "Odśwież plan",
      ctaHref: `/w/${workspaceSlug}/calendar/refresh${assigneeId !== "all" ? `?assignee=${encodeURIComponent(assigneeId)}` : ""}`,
    };
  } else if (totalPressure <= 34 && deliveryRatePct >= 80 && weeklyCoverageCount >= 2) {
    recRule = "rec:scale_up";
    recKey = "scale_up";
    recommendation = {
      text: "Zastosuj Scale Up i zwiększ cadence publikacji.",
      ctaLabel: "Odśwież plan",
      ctaHref: `/w/${workspaceSlug}/calendar/refresh${assigneeId !== "all" ? `?assignee=${encodeURIComponent(assigneeId)}` : ""}`,
    };
  } else if (weeklyCoverageCount < 2) {
    recRule = "rec:fill_coverage";
    recKey = "fill_coverage";
    recommendation = {
      text: "Uzupełnij plan na ten tydzień (minimum 2 tematy).",
      ctaLabel: "Uzupełnij plan",
      ctaHref: `/w/${workspaceSlug}/calendar/plan`,
    };
  }

  const timestampISO = new Date().toISOString();
  const dayKey = timestampISO.slice(0, 10);
  const explainEnvelope: ExplainEnvelope = {
    id: makeExplainId(["digest", dayKey, assigneeId, workspaceId]),
    module: "digest",
    ruleId: `digest:${insightRule}|${riskRule}|${recRule}`,
    workspaceId,
    assigneeId,
    timestampISO,
    inputs: {
      deliveryRatePct,
      wastedSharePct,
      overrunRatio,
      completedCount,
      investedHours,
      coverageCount: weeklyCoverageCount,
      pressure: totalPressure,
    },
    outputs: {
      insightKey: insightRule,
      riskKey: riskRule,
      recKey,
      hasCta: Boolean(recommendation.ctaHref && recommendation.ctaLabel),
    },
  };

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Executive Digest</CardTitle>
          <button
            type="button"
            onClick={() => onExplainRequest?.(explainEnvelope)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Dlaczego?
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Insight</p>
          <p className="mt-1 text-sm text-text">{insight}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ryzyko</p>
          <p className="mt-1 text-sm text-text">{risk}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rekomendacja</p>
          <p className="mt-1 text-sm text-text">{recommendation.text}</p>
          <p className="mt-1 text-xs text-muted">dla: {assigneeLabel}</p>

          {recommendation.ctaHref && recommendation.ctaLabel ? (
            <Link
              href={recommendation.ctaHref}
              className="mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              {recommendation.ctaLabel}
            </Link>
          ) : recommendation.hint ? (
            <p className="mt-2 text-xs text-muted">{recommendation.hint}</p>
          ) : null}
        </div>

        <p className="text-xs text-muted">
          Metryki: delivery {deliveryRatePct}% • wasted {wastedSharePct}% • overrun {overrunRatio.toFixed(2)}x • completed {completedCount} • invested {investedHours.toFixed(1)}h • coverage {weeklyCoverageCount}
        </p>
      </CardContent>
    </Card>
  );
}
