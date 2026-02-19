"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExplainSheet } from "@/app/w/[workspaceSlug]/content/_components/explain-sheet";
import { makeCorrelationId, makeExplainId, type ExplainEnvelope } from "@/lib/domain/controlTowerV3/explainability";

type GuidanceMode = "scale_down" | "hold" | "scale_up";

type RefreshPreset = {
  horizonWeeks: number;
  cadenceFreq: "weekly" | "biweekly";
  daysOfWeek: number[];
  channels: Array<"blog" | "linkedin" | "newsletter" | "landing">;
};

type RefreshGuidanceProps = {
  workspaceId: string;
  assigneeId: string;
  mode: GuidanceMode;
  reason: string;
  pressure: number;
  abandonedRatePct: number;
  overrunRatio: number;
  coverageRatio: number;
  preset: RefreshPreset;
};

function chipClass(active: boolean): string {
  return active
    ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-text"
    : "rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted";
}

export function RefreshGuidance({
  workspaceId,
  assigneeId,
  mode,
  reason,
  pressure,
  abandonedRatePct,
  overrunRatio,
  coverageRatio,
  preset,
}: RefreshGuidanceProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedExplain, setSelectedExplain] = useState<ExplainEnvelope | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  const ruleId = mode === "scale_down"
    ? "refresh:scale_down"
    : mode === "scale_up"
      ? "refresh:scale_up"
      : "refresh:hold";
  const timestampISO = new Date().toISOString();
  const dayKey = timestampISO.slice(0, 10);
  const explainEnvelope: ExplainEnvelope = {
    id: makeExplainId(["refresh_guidance", dayKey, assigneeId, workspaceId]),
    module: "refresh_guidance",
    ruleId,
    correlationId: makeCorrelationId(makeExplainId(["refresh_guidance", dayKey, assigneeId, workspaceId])),
    workspaceId,
    assigneeId,
    timestampISO,
    inputs: {
      pressure,
      abandonedRate: abandonedRatePct,
      overrunRatio,
      coverageRatio,
    },
    outputs: {
      decision: mode,
      suggestedPreset: preset,
    },
  };

  function applyPreset() {
    const horizon = document.getElementById("refresh-horizonWeeks") as HTMLSelectElement | null;
    if (horizon) {
      horizon.value = String(preset.horizonWeeks);
    }

    const cadence = document.getElementById("refresh-cadenceFreq") as HTMLSelectElement | null;
    if (cadence) {
      cadence.value = preset.cadenceFreq;
    }

    const dayInputs = document.querySelectorAll<HTMLInputElement>('input[name="daysOfWeek"]');
    dayInputs.forEach((input) => {
      const day = Number(input.value);
      input.checked = preset.daysOfWeek.includes(day);
    });

    const channelInputs = document.querySelectorAll<HTMLInputElement>('input[name="channels"]');
    channelInputs.forEach((input) => {
      input.checked = preset.channels.includes(input.value as RefreshPreset["channels"][number]);
    });

    setNotice("Zastosowano rekomendację. Sprawdź preview i utwórz szkic.");
  }

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Rekomendacja odświeżenia</CardTitle>
          <button
            type="button"
            onClick={() => {
              setSelectedExplain(explainEnvelope);
              setIsExplainOpen(true);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Dlaczego?
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <span className={chipClass(mode === "scale_down")}>Scale Down</span>
          <span className={chipClass(mode === "hold")}>Hold</span>
          <span className={chipClass(mode === "scale_up")}>Scale Up</span>
        </div>

        <p className="text-sm text-text">{reason}</p>

        <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted sm:grid-cols-2">
          <p>Napięcie: <span className="text-text">{pressure}</span></p>
          <p>Porzucone: <span className="text-text">{abandonedRatePct}%</span></p>
          <p>Overrun: <span className="text-text">{overrunRatio.toFixed(2)}x</span></p>
          <p>Pokrycie: <span className="text-text">{coverageRatio.toFixed(2)}x</span></p>
        </div>

        <p className="text-xs text-muted">
          Ustawienia: horyzont {preset.horizonWeeks} tyg., kadencja {preset.cadenceFreq === "weekly" ? "tygodniowa" : "co 2 tyg."}, dni {preset.daysOfWeek.join(", ")}.
        </p>

        <Button type="button" size="sm" onClick={applyPreset}>Zastosuj rekomendację</Button>

        {notice ? <p className="text-xs text-text">{notice}</p> : null}
      </CardContent>

      <ExplainSheet
        open={isExplainOpen}
        onOpenChange={setIsExplainOpen}
        envelope={selectedExplain}
      />
    </Card>
  );
}
