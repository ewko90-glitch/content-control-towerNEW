"use client";

import { useMemo } from "react";
import { evaluateImpact } from "@/components/decision-impact/impact-engine";
import type { MetricSnapshot } from "@/components/decision-impact/impact-types";
import { decisionCopy } from "@/components/decision-intelligence/decision-copy";
import type { DecisionEntry } from "./decision-types";

type DecisionCardProps = {
  entry: DecisionEntry;
  isCurrentStrategy: boolean;
  currentSnapshot?: MetricSnapshot;
};

function relativeTimeLabel(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) {
    return "teraz";
  }

  const diffMs = Date.now() - ts;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "teraz";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min temu`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h temu`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d temu`;
}

function statusClasses(status: DecisionEntry["status"]): string {
  if (status === "adopted") {
    return "border-success/30 bg-success/15 text-success";
  }

  if (status === "rejected") {
    return "border-danger/25 bg-danger/10 text-textMuted";
  }

  return "border-border bg-surface2 text-textMuted";
}

function deltaClass(value: number | undefined, goodWhenNegative: boolean): string {
  if (typeof value !== "number") {
    return "text-textMuted";
  }

  const positive = value > 0;
  const good = goodWhenNegative ? !positive && value !== 0 : positive;
  const bad = value !== 0 && !good;

  if (good) {
    return "text-success";
  }

  if (bad) {
    return "text-danger";
  }

  return "text-textMuted";
}

function deltaLabel(value: number | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function impactBadgeClasses(status: "improving" | "neutral" | "worsening" | "insufficient_data"): string {
  if (status === "improving") {
    return "border-success/30 bg-success/15 text-success";
  }
  if (status === "worsening") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  if (status === "neutral") {
    return "border-border bg-surface2 text-textMuted";
  }
  return "border-border bg-surface2/70 text-textMuted";
}

export function DecisionCard(props: DecisionCardProps) {
  const timestamp = useMemo(() => relativeTimeLabel(props.entry.createdAt), [props.entry.createdAt]);
  const impact = useMemo(() => {
    if (props.entry.status !== "adopted" || !props.currentSnapshot) {
      return null;
    }

    const windows: Array<3 | 7 | 14> = [7, 3, 14];
    for (const windowDays of windows) {
      const evaluated = evaluateImpact({
        decision: props.entry,
        current: props.currentSnapshot,
        nowIso: new Date().toISOString(),
        window: windowDays,
      });
      if (evaluated.status !== "insufficient_data" || windowDays === 3) {
        return evaluated;
      }
    }

    return null;
  }, [props.currentSnapshot, props.entry]);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-card-foreground">{props.entry.scenarioName}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClasses(props.entry.status)}`}>{props.entry.status}</span>
      </div>

      <ul className="mt-3 space-y-1 text-xs">
        <li className={deltaClass(props.entry.delta.throughputDelta, false)}>
          {decisionCopy.throughput}: {deltaLabel(props.entry.delta.throughputDelta)}
        </li>
        <li className={deltaClass(props.entry.delta.leadTimeDelta, true)}>
          {decisionCopy.leadTime}: {deltaLabel(props.entry.delta.leadTimeDelta)}
        </li>
        <li className={deltaClass(props.entry.delta.riskDelta, true)}>
          {decisionCopy.risk}: {deltaLabel(props.entry.delta.riskDelta)}
        </li>
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-textMuted">{timestamp}</p>
        <div className="flex items-center gap-1.5">
          {impact ? (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${impactBadgeClasses(impact.status)}`}>
              {impact.status === "improving"
                ? "Improving"
                : impact.status === "worsening"
                  ? "Worsening"
                  : impact.status === "neutral"
                    ? "Neutral"
                    : "Insufficient"}
            </span>
          ) : null}
          {props.isCurrentStrategy ? (
            <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] text-success">{decisionCopy.currentStrategy}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
