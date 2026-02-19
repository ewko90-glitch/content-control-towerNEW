"use client";

import { useEffect, useMemo, useState } from "react";
import { evaluateImpact } from "@/components/decision-impact/impact-engine";
import type { MetricSnapshot } from "@/components/decision-impact/impact-types";
import { getCurrentStrategy, loadDecisionStore } from "@/components/decision-timeline/decision-storage";
import type { DecisionEntry, DecisionStore } from "@/components/decision-timeline/decision-types";
import { Button } from "@/components/ui/Button";
import { deriveExecutiveSnapshot } from "./executive-engine";
import { ExecutiveActions } from "./executive-actions";
import { executiveCopy } from "./executive-copy";
import { ExecutiveDecisions } from "./executive-decisions";
import { ExecutiveKpis } from "./executive-kpis";
import { ExecutiveRisks } from "./executive-risks";
import { ExecutiveStrategy } from "./executive-strategy";
import { executivePrintCss } from "./print/executive-print-css";
import { exportExecutivePdf } from "./print/executive-export";
import { ExecutivePrintWrapper } from "./print/executive-print-wrapper";
import type { ExecutiveSnapshot } from "./executive-types";

type ExecutiveSummaryProps = {
  workspaceSlug: string;
  nowIso: string;
  healthScore?: number;
  flowMetrics?: unknown;
  predictiveRisk?: unknown;
  workflowSignals?: unknown;
  actionCards?: unknown[];
  currentSnapshot: MetricSnapshot;
};

function modeKey(workspaceSlug: string): string {
  return `cct:exec:mode:v1:${workspaceSlug}`;
}

export function ExecutiveSummary(props: ExecutiveSummaryProps) {
  const [execMode, setExecMode] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [decisionStore, setDecisionStore] = useState<DecisionStore | undefined>(undefined);
  const [currentStrategy, setCurrentStrategy] = useState<DecisionEntry | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(modeKey(props.workspaceSlug));
      setExecMode(raw === "1");
      setStorageAvailable(true);
    } catch {
      setExecMode(false);
      setStorageAvailable(false);
    }
  }, [props.workspaceSlug]);

  useEffect(() => {
    if (!storageAvailable) {
      return;
    }
    try {
      window.localStorage.setItem(modeKey(props.workspaceSlug), execMode ? "1" : "0");
      window.dispatchEvent(new CustomEvent("cct:exec:mode", { detail: { enabled: execMode, workspaceSlug: props.workspaceSlug } }));
    } catch {
      return;
    }
  }, [execMode, props.workspaceSlug, storageAvailable]);

  useEffect(() => {
    const refreshDecisions = () => {
      try {
        const store = loadDecisionStore(props.workspaceSlug);
        setDecisionStore(store);
        setCurrentStrategy(getCurrentStrategy(props.workspaceSlug));
      } catch {
        setDecisionStore(undefined);
        setCurrentStrategy(undefined);
      }
    };

    refreshDecisions();
    window.addEventListener("cct:decision:updated", refreshDecisions as EventListener);
    return () => {
      window.removeEventListener("cct:decision:updated", refreshDecisions as EventListener);
    };
  }, [props.workspaceSlug]);

  useEffect(() => {
    const onOpen = () => {
      setExecMode(true);
      window.setTimeout(() => {
        const anchor = document.getElementById("executive");
        if (anchor) {
          anchor.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 20);
    };

    const onExport = () => {
      setExecMode(true);
      window.setTimeout(() => {
        exportExecutivePdf();
      }, 30);
    };

    const onPrintStart = () => setPrintMode(true);
    const onPrintStop = () => setPrintMode(false);

    window.addEventListener("cct:exec:open", onOpen as EventListener);
    window.addEventListener("cct:exec:export", onExport as EventListener);
    window.addEventListener("cct:exec:print:start", onPrintStart as EventListener);
    window.addEventListener("cct:exec:print:stop", onPrintStop as EventListener);

    return () => {
      window.removeEventListener("cct:exec:open", onOpen as EventListener);
      window.removeEventListener("cct:exec:export", onExport as EventListener);
      window.removeEventListener("cct:exec:print:start", onPrintStart as EventListener);
      window.removeEventListener("cct:exec:print:stop", onPrintStop as EventListener);
    };
  }, []);

  const currentImpact = useMemo(() => {
    if (!currentStrategy) {
      return undefined;
    }
    return evaluateImpact({
      decision: currentStrategy,
      current: props.currentSnapshot,
      nowIso: new Date().toISOString(),
      window: 7,
    });
  }, [currentStrategy, props.currentSnapshot]);

  const snapshot = useMemo<ExecutiveSnapshot>(() => {
    return deriveExecutiveSnapshot({
      workspaceSlug: props.workspaceSlug,
      nowIso: props.nowIso,
      healthScore: props.healthScore,
      flowMetrics: props.flowMetrics,
      predictiveRisk: props.predictiveRisk,
      workflowSignals: props.workflowSignals,
      actionCards: props.actionCards,
      decisionStore,
      currentStrategy,
      currentImpact,
    });
  }, [
    props.workspaceSlug,
    props.nowIso,
    props.healthScore,
    props.flowMetrics,
    props.predictiveRisk,
    props.workflowSignals,
    props.actionCards,
    decisionStore,
    currentStrategy,
    currentImpact,
  ]);

  if (!storageAvailable) {
    return null;
  }

  if (!execMode) {
    return (
      <div className="mb-3">
        <Button variant="secondary" size="sm" onClick={() => setExecMode(true)}>
          {executiveCopy.modeOffCta}
        </Button>
      </div>
    );
  }

  return (
    <ExecutivePrintWrapper
      printMode={printMode}
      workspaceSlug={snapshot.workspaceSlug}
      generatedAt={snapshot.generatedAt}
      cssText={executivePrintCss()}
    >
      <section id="executive" className="exec-print-block mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="exec-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">{executiveCopy.title}</h2>
            <p className="text-xs text-textMuted">
              {executiveCopy.generated}: {snapshot.generatedAt}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => exportExecutivePdf()}>
              {executiveCopy.exportPdf}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExecMode(false)}>
              {executiveCopy.modeOn}
            </Button>
          </div>
        </div>

        <ExecutiveKpis kpis={snapshot.kpis} />

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="exec-print-block rounded-xl border border-border bg-surface2/60 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">{executiveCopy.risks}</h3>
            <ExecutiveRisks risks={snapshot.risks} />
          </div>
          <div className="exec-print-block rounded-xl border border-border bg-surface2/60 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">{executiveCopy.strategy}</h3>
            <ExecutiveStrategy strategy={snapshot.strategy} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="exec-print-block rounded-xl border border-border bg-surface2/60 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">{executiveCopy.actions}</h3>
            <ExecutiveActions actions={snapshot.actions} emptyLabel={executiveCopy.noActions} />
          </div>
          <div className="exec-print-block rounded-xl border border-border bg-surface2/60 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">{executiveCopy.decisions}</h3>
            <ExecutiveDecisions decisions={snapshot.decisions} emptyLabel={executiveCopy.noDecisions} />
          </div>
        </div>
      </section>
    </ExecutivePrintWrapper>
  );
}
