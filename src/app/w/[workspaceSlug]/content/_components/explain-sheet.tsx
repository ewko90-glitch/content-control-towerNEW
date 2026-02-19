"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExecutiveDigest } from "@/app/w/[workspaceSlug]/content/_components/executive-digest";
import { PressureIndicator } from "@/app/w/[workspaceSlug]/content/_components/pressure-indicator";
import { WeeklyReviewWithRoiLite } from "@/app/w/[workspaceSlug]/content/_components/roi-lite";
import { makeCorrelationId, prettyRuleLabel, type ExplainEnvelope } from "@/lib/domain/controlTowerV3/explainability";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";
import type { WeeklyReviewOutcome } from "@/app/w/[workspaceSlug]/content/_components/weekly-review";

type ExplainSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelope: ExplainEnvelope | null;
};

export function ExplainSheet({ open, onOpenChange, envelope }: ExplainSheetProps) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open || !envelope) {
      wasOpenRef.current = open;
      return;
    }

    if (!wasOpenRef.current) {
      const correlationId = envelope.correlationId ?? makeCorrelationId(envelope.id);
      recordTelemetry({
        workspaceId: envelope.workspaceId,
        type: "explain_opened",
        timestampISO: new Date().toISOString(),
        metadata: {
          envelopeId: envelope.id,
          module: envelope.module,
          ruleId: envelope.ruleId,
          correlationId,
        },
      });
    }

    wasOpenRef.current = open;
  }, [open, envelope]);

  if (!open || !envelope) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-bg/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Dlaczego">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface2 p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{envelope.module}</p>
            <p className="text-sm font-semibold text-text">{prettyRuleLabel(envelope.ruleId)}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
          >
            Zamknij
          </button>
        </div>

        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule & Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-xs text-muted">
            <p>RuleId: <span className="text-text">{envelope.ruleId}</span></p>
            <p>Timestamp: <span className="text-text">{envelope.timestampISO}</span></p>
            <p>Workspace: <span className="text-text">{envelope.workspaceId}</span></p>
            <p>Assignee: <span className="text-text">{envelope.assigneeId}</span></p>
            <p>ID: <span className="text-text">{envelope.id}</span></p>
          </CardContent>
        </Card>

        <Card className="mt-3 rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-surface2 p-3 text-[11px] text-text">
              {JSON.stringify(envelope.inputs, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="mt-3 rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outputs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-surface2 p-3 text-[11px] text-text">
              {JSON.stringify(envelope.outputs, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ContentExplainSectionProps = {
  workspaceId: string;
  workspaceSlug: string;
  selectedAssigneeId: string;
  digestAssigneeLabel: string;
  totalPressure: number;
  backlogScore: number;
  timeScore: number;
  coverageScore: number;
  pressureBand: "niskie" | "średnie" | "wysokie";
  outcomes: WeeklyReviewOutcome[];
  members: Array<{ id: string; name: string }>;
  refreshHref: string;
  weeklyCoverageCount: number;
  digestOutcomes: Array<{
    outcome: "completed" | "abandoned" | "partial" | "ignored";
    durationSeconds: number;
    estMins: number;
  }>;
  digestTotalPressure: number;
};

export function ContentExplainSection({
  workspaceId,
  workspaceSlug,
  selectedAssigneeId,
  digestAssigneeLabel,
  totalPressure,
  backlogScore,
  timeScore,
  coverageScore,
  pressureBand,
  outcomes,
  members,
  refreshHref,
  weeklyCoverageCount,
  digestOutcomes,
  digestTotalPressure,
}: ContentExplainSectionProps) {
  const [selectedExplain, setSelectedExplain] = useState<ExplainEnvelope | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  const filteredDigestOutcomes = useMemo(() => digestOutcomes, [digestOutcomes]);

  function openExplain(envelope: ExplainEnvelope) {
    setSelectedExplain(envelope);
    setIsExplainOpen(true);
  }

  return (
    <>
      <PressureIndicator
        workspaceId={workspaceId}
        assigneeId={selectedAssigneeId}
        totalPressure={totalPressure}
        backlogScore={backlogScore}
        timeScore={timeScore}
        coverageScore={coverageScore}
        band={pressureBand}
        onExplainRequest={openExplain}
      />

      <div className="mb-3">
        <Link
          href={`/w/${workspaceSlug}/content/executive-pack?assignee=all&preview=1`}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
        >
          Eksportuj Weekly Pack
        </Link>
      </div>

      <WeeklyReviewWithRoiLite
        workspaceId={workspaceId}
        outcomes={outcomes}
        members={members}
        refreshHref={refreshHref}
        weeklyPressureScore={totalPressure}
        onExplainRequest={openExplain}
      />

      <ExecutiveDigest
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        assigneeId={selectedAssigneeId}
        assigneeLabel={digestAssigneeLabel}
        outcomesFiltered={filteredDigestOutcomes}
        totalPressure={digestTotalPressure}
        weeklyCoverageCount={weeklyCoverageCount}
        onExplainRequest={openExplain}
      />

      <ExplainSheet
        open={isExplainOpen}
        onOpenChange={setIsExplainOpen}
        envelope={selectedExplain}
      />
    </>
  );
}