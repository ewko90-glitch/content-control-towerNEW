"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type ExecutionPackViewProps = {
  workspaceSlug: string;
  generatedAtIso: string;
  assigneeLabel: string;
  pdfEnabled: boolean;
  pdfHref?: string;
  weeklyReview: {
    totalSessions: number;
    completedCount: number;
    completedRatePct: number;
    avgDurationMinutes: number;
    dominantKind: "Draft" | "Optimization" | "Risk";
    recommendation: string;
  } | null;
  pressure: {
    total: number;
    backlog: number;
    time: number;
    coverage: number;
    band: "niskie" | "średnie" | "wysokie";
  };
  roi: {
    totalCount: number;
    investedHours: number;
    completedCount: number;
    wastedHours: number;
    wastedSharePct: number;
    proj30: number;
    recommendation: string;
  };
};

function pressureDescription(band: "niskie" | "średnie" | "wysokie"): string {
  if (band === "niskie") {
    return "Masz zapas. Możesz podnieść ambit.";
  }
  if (band === "średnie") {
    return "Rytm stabilny. Pilnuj domknięć.";
  }
  return "Wysokie napięcie. Skup się na krótszych zadaniach i domykaniu.";
}

export function ExecutionPackView({
  workspaceSlug,
  generatedAtIso,
  assigneeLabel,
  pdfEnabled,
  pdfHref,
  weeklyReview,
  pressure,
  roi,
}: ExecutionPackViewProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-border shadow-soft">
        <CardHeader>
          <CardTitle>Weekly Execution Pack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted">
          <p>Workspace: <span className="text-text">{workspaceSlug}</span></p>
          <p>Wygenerowano: <span className="text-text">{new Date(generatedAtIso).toLocaleString("pl-PL")}</span></p>
          <p>Filtr assignee: <span className="text-text">{assigneeLabel}</span></p>
          <div className="pt-2 print:hidden">
            {pdfEnabled && pdfHref ? (
              <Link
                href={pdfHref}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
              >
                Pobierz PDF
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
              >
                Drukuj / Zapisz jako PDF
              </button>
            )}
            <Link
              href={`/w/${workspaceSlug}/content`}
              className="ml-2 inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm text-text"
            >
              Wróć do /content
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border bg-surface2/60 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>Weekly Review</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!weeklyReview ? (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Brak danych dla wybranego filtra.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Sesje</p>
                  <p className="text-xl font-semibold text-text">{weeklyReview.totalSessions}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Ukończone</p>
                  <p className="text-xl font-semibold text-text">{weeklyReview.completedCount} ({weeklyReview.completedRatePct}%)</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Średni czas</p>
                  <p className="text-xl font-semibold text-text">{weeklyReview.avgDurationMinutes} min</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Dominujący typ</p>
                  <p className="text-xl font-semibold text-text">{weeklyReview.dominantKind}</p>
                </div>
              </div>
              <p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-text">{weeklyReview.recommendation}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border bg-surface2/60 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>Pressure</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-2 flex items-end justify-between gap-3">
            <p className="text-3xl font-semibold text-text">{pressure.total}</p>
            <p className="text-xs text-muted">Skala 0–100</p>
          </div>
          <progress className="h-2 w-full overflow-hidden rounded-full" max={100} value={pressure.total} />
          <div className="mt-3 space-y-1 rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Backlog: {pressure.backlog}</p>
            <p className="text-xs text-muted">Czas: {pressure.time}</p>
            <p className="text-xs text-muted">Pokrycie: {pressure.coverage}</p>
          </div>
          <p className="mt-3 text-sm text-text">{pressureDescription(pressure.band)}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border bg-surface2/60 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>ROI Lite (7 dni)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {roi.totalCount === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Brak danych ROI — uruchom Focus Session.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Czas zainwestowany</p>
                  <p className="text-xl font-semibold text-text">{roi.investedHours.toFixed(1)}h</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Dowiezione</p>
                  <p className="text-xl font-semibold text-text">{roi.completedCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Koszt porzuceń</p>
                  <p className="text-xl font-semibold text-text">{roi.wastedHours.toFixed(1)}h ({roi.wastedSharePct}%)</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-muted">Prognoza 30 dni</p>
                  <p className="text-xl font-semibold text-text">{roi.proj30}</p>
                </div>
              </div>
              <p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-text">{roi.recommendation}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
