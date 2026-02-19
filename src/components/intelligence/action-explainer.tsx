"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

import { intelligenceCopy } from "./intelligence-copy";
import type { IntelligenceState } from "./intelligence-state";

type ActionExplainerProps = {
  state: IntelligenceState;
  primaryCtaLabel: string;
  dataTargetId: string;
};

function impactThroughput(level: IntelligenceState["priorityLevel"]): string {
  if (level === "critical") {
    return "Spodziewany spadek throughput bez szybkiej interwencji.";
  }
  if (level === "warning") {
    return "Throughput może zwolnić przez narastające kolejki.";
  }
  if (level === "positive") {
    return "Throughput rośnie — utrzymaj obecne tempo zespołu.";
  }
  return "Brak istotnego wpływu krótkoterminowego.";
}

function impactRisk(level: IntelligenceState["priorityLevel"]): string {
  if (level === "critical") {
    return "Ryzyko opóźnień jest wysokie i wymaga natychmiastowej reakcji.";
  }
  if (level === "warning") {
    return "Ryzyko rośnie lokalnie w jednym etapie procesu.";
  }
  if (level === "positive") {
    return "Ryzyko maleje przy obecnym układzie pracy.";
  }
  return "Ryzyko pozostaje stabilne w krótkim horyzoncie.";
}

export function ActionExplainer(props: ActionExplainerProps) {
  return (
    <Card className="rounded-2xl border border-border bg-surface shadow-soft">
      <CardHeader>
        <CardTitle>{intelligenceCopy.action.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-text">{props.state.headline}</p>
        <div className="rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-textMuted">
          <p className="font-medium text-text">{intelligenceCopy.action.why}</p>
          <p>{props.state.explanation}</p>
        </div>
        <ul className="space-y-1 text-sm text-textMuted">
          <li>• {intelligenceCopy.action.throughput}: {impactThroughput(props.state.priorityLevel)}</li>
          <li>• {intelligenceCopy.action.risk}: {impactRisk(props.state.priorityLevel)}</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href={props.state.ctaTarget}>
            <Button size="sm">{props.primaryCtaLabel}</Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const target = document.getElementById(props.dataTargetId);
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {intelligenceCopy.action.showData}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
