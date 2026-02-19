"use client";

import { useEffect, useRef } from "react";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";
import { makeExplainId, type ExplainEnvelope } from "@/lib/domain/controlTowerV3/explainability";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

type PressureBand = "niskie" | "średnie" | "wysokie";

type PressureIndicatorProps = {
  workspaceId: string;
  assigneeId: string;
  totalPressure: number;
  backlogScore: number;
  timeScore: number;
  coverageScore: number;
  band: PressureBand;
  onExplainRequest?: (envelope: ExplainEnvelope) => void;
  access?: AccessResult;
};

function descriptionForBand(band: PressureBand): string {
  if (band === "niskie") {
    return "Masz zapas. Możesz podnieść ambit.";
  }
  if (band === "średnie") {
    return "Rytm stabilny. Pilnuj domknięć.";
  }
  return "Wysokie napięcie. Skup się na krótszych zadaniach i domykaniu.";
}

export function PressureIndicator({
  workspaceId,
  assigneeId,
  totalPressure,
  backlogScore,
  timeScore,
  coverageScore,
  band,
  onExplainRequest,
  access = { status: "ok" },
}: PressureIndicatorProps) {
  if (access.status !== "ok") {
    return <FeatureLockCard tytulFunkcji="Monitor napięcia" access={access} />;
  }

  const didEmitPressure = useRef(false);
  const weights = {
    backlog: 0.45,
    time: 0.35,
    coverage: 0.2,
  };
  const timestampISO = new Date().toISOString();
  const dayKey = timestampISO.slice(0, 10);
  const explainEnvelope: ExplainEnvelope = {
    id: makeExplainId(["pressure", dayKey, assigneeId, workspaceId]),
    module: "pressure",
    ruleId: `pressure:band:${band}`,
    workspaceId,
    assigneeId,
    timestampISO,
    inputs: {
      backlogScore,
      timeScore,
      coverageScore,
      weights,
    },
    outputs: {
      totalPressure,
      band,
    },
  };

  useEffect(() => {
    if (didEmitPressure.current) {
      return;
    }
    didEmitPressure.current = true;
    recordTelemetry({
      workspaceId,
      type: "pressure_computed",
      timestampISO: new Date().toISOString(),
      metadata: {
        totalPressure,
      },
    });
  }, [workspaceId, totalPressure]);

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Napięcie tygodnia</CardTitle>
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
        <div className="mb-3 flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold text-text">{totalPressure}</p>
          <p className="text-xs text-muted">Skala 0–100</p>
        </div>

        <progress
          className="h-2 w-full overflow-hidden rounded-full"
          max={100}
          value={totalPressure}
          aria-label="Poziom napięcia tygodnia"
          title="Poziom napięcia tygodnia"
        />

        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">Backlog: {backlogScore}</p>
          <p className="text-xs text-muted">Czas: {timeScore}</p>
          <p className="text-xs text-muted">Pokrycie: {coverageScore}</p>
        </div>

        <p className="mt-3 text-sm text-text">{descriptionForBand(band)}</p>
      </CardContent>
    </Card>
  );
}
