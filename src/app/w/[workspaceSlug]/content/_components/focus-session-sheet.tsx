"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

export type FocusSessionKind = "draft" | "optimization" | "risk";

export type FocusSessionPayload = {
  kind: FocusSessionKind;
  title: string;
  estMins: 15 | 30 | 60;
  rationale?: string;
  consequence?: string;
  sourceId?: string;
  assigneeId?: string;
  assigneeName?: string;
};

export type FocusSessionOutcomeInput = FocusSessionPayload & {
  outcome: "completed" | "abandoned";
  durationSeconds: number;
};

type FocusSessionSheetProps = {
  workspaceId: string;
  open: boolean;
  payload: FocusSessionPayload | null;
  manualModeInfo?: string;
  onClose: () => void;
  onRecordOutcome: (input: FocusSessionOutcomeInput) => Promise<{ ok: boolean }>;
  onSaved: () => void;
};

const checklistByKind: Record<FocusSessionKind, string[]> = {
  draft: ["Research", "Outline", "Write", "Add internal links", "Final pass"],
  optimization: ["Identify issue", "Apply fix", "Re-check", "Note outcome"],
  risk: ["Understand risk", "Decide mitigation", "Do 1 action now", "Log note"],
};

const kindLabel: Record<FocusSessionKind, string> = {
  draft: "Draft",
  optimization: "Optimization",
  risk: "Risk",
};

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function FocusSessionSheet({
  workspaceId,
  open,
  payload,
  manualModeInfo,
  onClose,
  onRecordOutcome,
  onSaved,
}: FocusSessionSheetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [startedTelemetrySent, setStartedTelemetrySent] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsRunning(false);
      setElapsedSeconds(0);
      setIsSaving(false);
      return;
    }
    setIsRunning(false);
    setElapsedSeconds(0);
    setIsSaving(false);
    setStartedTelemetrySent(false);
  }, [open, payload?.title, payload?.kind, payload?.estMins]);

  useEffect(() => {
    if (!open || !isRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, isRunning]);

  const checklist = useMemo(() => {
    if (!payload) {
      return [];
    }
    return checklistByKind[payload.kind];
  }, [payload]);

  async function save(outcome: "completed" | "abandoned") {
    if (!payload || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await onRecordOutcome({
        ...payload,
        outcome,
        durationSeconds: elapsedSeconds,
      });
      if (result.ok) {
        recordTelemetry({
          workspaceId,
          type: outcome === "completed" ? "focus_session_completed" : "focus_session_abandoned",
          timestampISO: new Date().toISOString(),
          metadata: {
            durationSeconds: elapsedSeconds,
            kind: payload.kind,
          },
        });
        onSaved();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!open || !payload) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-bg/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-5 shadow-soft">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-text">Tryb skupienia</h3>
            <p className="text-sm text-muted">Jedna sesja, jedno domknięcie.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Zamknij
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-surface2 p-3">
          <p className="text-sm font-medium text-text">{payload.title}</p>
          <p className="mt-1 text-xs text-muted">Dla: {payload.assigneeName ?? "Ja"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{payload.estMins}m</Badge>
            <Badge>{kindLabel[payload.kind]}</Badge>
          </div>
        </div>

        {manualModeInfo ? (
          <p className="mt-3 text-xs text-muted">{manualModeInfo}</p>
        ) : null}

        <div className="mt-4 rounded-xl border border-border bg-surface2 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Checklista</p>
          <ul className="space-y-2">
            {checklist.map((step) => (
              <li key={step} className="text-sm text-text">
                • {step}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface2 p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Timer</p>
          <p className="mt-2 text-2xl font-semibold text-text">{formatTimer(elapsedSeconds)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsRunning((value) => {
                  const next = !value;
                  if (next && !startedTelemetrySent && payload) {
                    recordTelemetry({
                      workspaceId,
                      type: "focus_session_started",
                      timestampISO: new Date().toISOString(),
                      metadata: {
                        kind: payload.kind,
                      },
                    });
                    setStartedTelemetrySent(true);
                  }
                  return next;
                });
              }}
            >
              {isRunning ? "Pauza" : "Start"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => {
              setIsRunning(false);
              setElapsedSeconds(0);
            }}>
              Reset
            </Button>
          </div>
          {elapsedSeconds > payload.estMins * 60 ? (
            <p className="mt-3 text-xs text-muted">Przekroczono estymację — dokończ i zamknij iterację.</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={isSaving} onClick={() => void save("completed")}>
            Zakończone
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={isSaving} onClick={() => void save("abandoned")}>
            Porzucone
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={onClose}>
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  );
}
