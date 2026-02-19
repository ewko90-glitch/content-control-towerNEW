"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { evaluateImpact } from "@/components/decision-impact/impact-engine";
import type { MetricSnapshot } from "@/components/decision-impact/impact-types";
import { statusLabel } from "@/components/decision-impact/impact-utils";
import { getCurrentStrategy } from "@/components/decision-timeline/decision-storage";

import { Button } from "@/components/ui/Button";

import { intelligenceCopy } from "./intelligence-copy";
import type { GuidedState } from "./intelligence-engine";

type PriorityBannerProps = {
  state: GuidedState;
  primaryHref: string;
  whyHref: string;
  workspaceSlug?: string;
  currentSnapshot?: MetricSnapshot;
};

const toneClasses: Record<GuidedState["tone"], string> = {
  danger: "border-danger/35 bg-danger/10",
  warning: "border-warning/40 bg-warning/20",
  success: "border-success/35 bg-success/20",
  neutral: "border-border bg-surface2",
};

export function PriorityBanner(props: PriorityBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentStrategyName, setCurrentStrategyName] = useState<string | null>(null);
  const [adoptedRecently, setAdoptedRecently] = useState(false);
  const [impactHint, setImpactHint] = useState<string | null>(null);
  const [execModeEnabled, setExecModeEnabled] = useState(false);
  const ctaLabel = useMemo(() => intelligenceCopy.priority[props.state.priorityLevel].cta, [props.state.priorityLevel]);
  const effectiveTone: GuidedState["tone"] = adoptedRecently ? "success" : props.state.tone;

  useEffect(() => {
    const workspaceSlug = props.workspaceSlug;

    if (!workspaceSlug) {
      setCurrentStrategyName(null);
      setAdoptedRecently(false);
      return;
    }

    const refresh = () => {
      try {
        const current = getCurrentStrategy(workspaceSlug);
        if (!current) {
          setCurrentStrategyName(null);
          setAdoptedRecently(false);
          setImpactHint(null);
          return;
        }

        setCurrentStrategyName(current.scenarioName);
        const adoptedRef = current.adoptedAt ?? current.createdAt;
        const ageMs = Date.now() - new Date(adoptedRef).getTime();
        setAdoptedRecently(ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000);

        if (props.currentSnapshot) {
          const impact = evaluateImpact({
            decision: current,
            current: props.currentSnapshot,
            nowIso: new Date().toISOString(),
            window: 7,
          });
          setImpactHint(`Impact: ${statusLabel(impact.status)} (${Math.round(impact.confidence * 100)}%)`);
        } else {
          setImpactHint(null);
        }
      } catch {
        setCurrentStrategyName(null);
        setAdoptedRecently(false);
        setImpactHint(null);
      }
    };

    refresh();
    window.addEventListener("cct:decision:updated", refresh as EventListener);
    return () => {
      window.removeEventListener("cct:decision:updated", refresh as EventListener);
    };
  }, [props.currentSnapshot, props.workspaceSlug]);

  useEffect(() => {
    const workspaceSlug = props.workspaceSlug;
    if (!workspaceSlug) {
      setExecModeEnabled(false);
      return;
    }

    const key = `cct:exec:mode:v1:${workspaceSlug}`;
    const refresh = () => {
      try {
        setExecModeEnabled(window.localStorage.getItem(key) === "1");
      } catch {
        setExecModeEnabled(false);
      }
    };

    refresh();
    window.addEventListener("cct:exec:mode", refresh as EventListener);
    return () => {
      window.removeEventListener("cct:exec:mode", refresh as EventListener);
    };
  }, [props.workspaceSlug]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("cct:intel:priorityDismissed") === "1") {
        setIsDismissed(true);
      }
    } catch {
      setIsDismissed(false);
    }
  }, []);

  if (isDismissed) {
    return null;
  }

  return (
    <section className={`rounded-2xl border px-4 py-4 shadow-soft ${toneClasses[effectiveTone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text">{props.state.title}</h2>
          <p className="text-sm text-textMuted">{props.state.subtitle}</p>
          {currentStrategyName ? (
            <div className="space-y-0.5">
              <p className="text-xs text-textMuted">
                Obecna strategia: <span className="font-medium text-text">{currentStrategyName}</span>
              </p>
              {impactHint ? <p className="text-xs text-textMuted">{impactHint}</p> : null}
            </div>
          ) : null}
          {execModeEnabled ? <p className="text-xs text-textMuted">Tryb Executive: aktywny</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href={props.primaryHref}>
            <Button size="sm">{ctaLabel}</Button>
          </Link>
          <Link href={props.whyHref} className="text-sm text-textMuted underline">
            {intelligenceCopy.priority.why}
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              try {
                window.localStorage.setItem("cct:intel:priorityDismissed", "1");
              } catch {
              }
              setIsDismissed(true);
            }}
          >
            Ukryj
          </Button>
        </div>
      </div>
    </section>
  );
}
