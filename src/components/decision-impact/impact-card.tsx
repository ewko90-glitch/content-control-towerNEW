"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DecisionEntry } from "@/components/decision-timeline/decision-types";
import { getCurrentStrategy } from "@/components/decision-timeline/decision-storage";
import { Button } from "@/components/ui/Button";
import { evaluateImpact } from "./impact-engine";
import { impactCopy } from "./impact-copy";
import { ImpactTrend } from "./impact-trend";
import type { ImpactEvaluation, ImpactWindow, MetricSnapshot } from "./impact-types";
import { formatMetric, statusClasses, statusLabel } from "./impact-utils";

type ImpactCardProps = {
  workspaceSlug: string;
  currentSnapshot: MetricSnapshot;
};

function deltaText(value?: number, pct?: number): string {
  if (typeof value !== "number") {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  const base = `${sign}${value.toFixed(1)}`;
  if (typeof pct === "number") {
    const pctSign = pct > 0 ? "+" : "";
    return `${base} (${pctSign}${pct.toFixed(1)}%)`;
  }

  return base;
}

function pickDefaultWindow(evaluations: Record<ImpactWindow, ImpactEvaluation>): ImpactWindow {
  if (evaluations[14].status !== "insufficient_data") {
    return 14;
  }
  if (evaluations[7].status !== "insufficient_data") {
    return 7;
  }
  return 3;
}

export function ImpactCard(props: ImpactCardProps) {
  const [decision, setDecision] = useState<DecisionEntry | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [selectedWindow, setSelectedWindow] = useState<ImpactWindow>(3);

  useEffect(() => {
    const refresh = () => {
      try {
        const current = getCurrentStrategy(props.workspaceSlug);
        setDecision(current ?? null);
        setEnabled(true);
      } catch {
        setEnabled(false);
      }
    };

    refresh();
    globalThis.window.addEventListener("cct:decision:updated", refresh as EventListener);
    return () => {
      globalThis.window.removeEventListener("cct:decision:updated", refresh as EventListener);
    };
  }, [props.workspaceSlug]);

  const evaluations = useMemo<Record<ImpactWindow, ImpactEvaluation> | null>(() => {
    if (!decision) {
      return null;
    }

    const nowIso = new Date().toISOString();
    return {
      3: evaluateImpact({ decision, current: props.currentSnapshot, nowIso, window: 3 }),
      7: evaluateImpact({ decision, current: props.currentSnapshot, nowIso, window: 7 }),
      14: evaluateImpact({ decision, current: props.currentSnapshot, nowIso, window: 14 }),
    };
  }, [decision, props.currentSnapshot]);

  useEffect(() => {
    if (!evaluations) {
      return;
    }
    setSelectedWindow(pickDefaultWindow(evaluations));
  }, [evaluations]);

  if (!enabled || !decision || !evaluations) {
    return null;
  }

  const active = evaluations[selectedWindow];

  return (
    <section className={`rounded-2xl border p-4 shadow-soft ${statusClasses(active.status)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">{impactCopy.title}</h3>
          <p className="text-sm text-textMuted">{impactCopy.subtitle}</p>
        </div>
        <span className="rounded-full border border-border bg-surface2 px-2.5 py-1 text-xs text-textMuted">
          {impactCopy.confidence}: {Math.round(active.confidence * 100)}%
        </span>
      </div>

      <div className="mt-3">
        <ImpactTrend activeWindow={selectedWindow} evaluations={evaluations} onSelectWindow={setSelectedWindow} />
      </div>

      {!decision.baseline ? (
        <p className="mt-3 text-sm text-textMuted">{impactCopy.insufficientBaseline}</p>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <span className="text-textMuted">{impactCopy.throughput}</span>
            <span className="text-textMuted">{formatMetric(decision.baseline.throughputPerWeek)}</span>
            <span className="text-textMuted">{formatMetric(props.currentSnapshot.throughputPerWeek)}</span>
            <span className="rounded-full border border-border bg-surface2 px-2 py-0.5 text-xs text-text">{deltaText(active.deltas.throughput.value, active.deltas.throughput.pct)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <span className="text-textMuted">{impactCopy.leadTime}</span>
            <span className="text-textMuted">{formatMetric(decision.baseline.leadAvgHours)}</span>
            <span className="text-textMuted">{formatMetric(props.currentSnapshot.leadAvgHours)}</span>
            <span className="rounded-full border border-border bg-surface2 px-2 py-0.5 text-xs text-text">{deltaText(active.deltas.leadTime.value, active.deltas.leadTime.pct)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <span className="text-textMuted">{impactCopy.risk}</span>
            <span className="text-textMuted">{formatMetric(decision.baseline.predictivePressure)}</span>
            <span className="text-textMuted">{formatMetric(props.currentSnapshot.predictivePressure)}</span>
            <span className="rounded-full border border-border bg-surface2 px-2 py-0.5 text-xs text-text">{deltaText(active.deltas.risk.value, active.deltas.risk.pct)}</span>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-textMuted">
        {impactCopy.interpretation}: {statusLabel(active.status)}
      </p>

      <div className="mt-3">
        <Link href="#decision-timeline">
          <Button variant="ghost" size="sm">
            {impactCopy.viewDecisions}
          </Button>
        </Link>
      </div>
    </section>
  );
}
