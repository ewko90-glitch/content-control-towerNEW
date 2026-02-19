"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";
import {
  FocusSessionSheet,
  type FocusSessionOutcomeInput,
  type FocusSessionPayload,
} from "@/app/w/[workspaceSlug]/content/_components/focus-session-sheet";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

type DailyItem = {
  planItemId: string;
  title: string;
  publishDate: string;
  channel: string;
  status: string;
  hasContent: boolean;
  contentId: string | null;
};

type DailyCard = {
  id: string;
  kind: "draft" | "optimization" | "risk";
  title: string;
  whyNow: string;
  estimatedTime: "15m" | "30m" | "60m";
  ifSkip: string;
  sourceId?: string;
  ctaLabel: string;
  detailsHref?: string;
};

type DailyExecutionModeProps = {
  workspaceId: string;
  workspaceSlug: string;
  items: DailyItem[];
  members: Array<{ id: string; name: string }>;
  hasPlan: boolean;
  isWeekCovered: boolean;
  hasOverdue: boolean;
  hasNewsletterThisWeek: boolean;
  isProjectReady: boolean;
  openCalendarHref: string;
  generatePlanHref: string;
  coverageHref: string;
  weeklyPressureScore: number;
  onStartFocusSession?: (payload: FocusSessionPayload) => void;
  onRecordFocusOutcome: (payload: FocusSessionOutcomeInput) => Promise<{ ok: boolean }>;
  focusAccess?: AccessResult;
};

function estimatedMinutes(value: "15m" | "30m" | "60m"): number {
  if (value === "15m") {
    return 15;
  }
  if (value === "30m") {
    return 30;
  }
  return 60;
}

function statusPriority(status: string): number {
  if (status === "queued") {
    return 0;
  }
  if (status === "drafted") {
    return 1;
  }
  if (status === "planned") {
    return 2;
  }
  return 3;
}

function channelLabel(channel: string): string {
  if (channel === "blog") {
    return "Blog";
  }
  if (channel === "linkedin") {
    return "LinkedIn";
  }
  if (channel === "newsletter") {
    return "Newsletter";
  }
  if (channel === "landing") {
    return "Strona docelowa";
  }
  return channel;
}

export function DailyExecutionMode({
  workspaceId,
  workspaceSlug,
  items,
  members,
  hasPlan,
  isWeekCovered,
  hasOverdue,
  hasNewsletterThisWeek,
  isProjectReady,
  openCalendarHref,
  generatePlanHref,
  coverageHref,
  weeklyPressureScore,
  onStartFocusSession,
  onRecordFocusOutcome,
  focusAccess = { status: "ok" },
}: DailyExecutionModeProps) {
  const [showRationale, setShowRationale] = useState(false);
  const [activeSession, setActiveSession] = useState<FocusSessionPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recentOutcomeCount, setRecentOutcomeCount] = useState(0);
  const assigneeOptions = useMemo(() => {
    const base = [{ id: "self", name: "Ja" }];
    for (const member of members) {
      if (member.id !== "self") {
        base.push(member);
      }
    }
    return base;
  }, [members]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("self");
  const isHighPressure = weeklyPressureScore >= 70;
  const didEmitStackBuild = useRef(false);

  if (focusAccess.status !== "ok") {
    return <FeatureLockCard tytulFunkcji="Tryb skupienia" access={focusAccess} />;
  }

  function toEstMins(value: "15m" | "30m" | "60m"): 15 | 30 | 60 {
    if (value === "15m") {
      return 15;
    }
    if (value === "30m") {
      return 30;
    }
    return 60;
  }

  function handleStart(card: DailyCard) {
    const selectedAssignee = assigneeOptions.find((option) => option.id === selectedAssigneeId) ?? assigneeOptions[0];
    const payload: FocusSessionPayload = {
      kind: card.kind,
      title: card.title,
      estMins: toEstMins(card.estimatedTime),
      rationale: card.whyNow,
      consequence: card.ifSkip,
      sourceId: card.sourceId,
      assigneeId: selectedAssignee?.id ?? "self",
      assigneeName: selectedAssignee?.name ?? "Ja",
    };
    onStartFocusSession?.(payload);
    setNotice(null);
    setActiveSession(payload);
  }

  const cards = useMemo(() => {
    const sorted = [...items].sort((left, right) => {
      const dateDiff = new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }
      const statusDiff = statusPriority(left.status) - statusPriority(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return left.title.localeCompare(right.title);
    });

    const focus = sorted[0];

    const dailyCards: DailyCard[] = [];

    if (focus) {
      dailyCards.push({
        id: "focus-draft",
        kind: "draft",
        title: "Najważniejszy szkic do pracy",
        whyNow: `Najbliższy temat na ${new Date(focus.publishDate).toLocaleDateString("pl-PL")} w kanale ${channelLabel(focus.channel)}.`,
        estimatedTime: "60m",
        ifSkip: "Ryzykujesz poślizg publikacji i narastanie zaległości w tygodniu.",
        sourceId: focus.planItemId,
        ctaLabel: focus.hasContent && focus.contentId ? "Otwórz szkic" : "Otwórz kalendarz",
        detailsHref: coverageHref,
      });
    } else {
      dailyCards.push({
        id: "focus-fallback",
        kind: "draft",
        title: "Brak wybranego tematu na dziś",
        whyNow: "Nie ma aktywnego szkicu na ten tydzień, więc warto od razu wybrać priorytet.",
        estimatedTime: "15m",
        ifSkip: "Dzień zacznie się chaotycznie i trudno będzie domknąć tydzień planowo.",
        ctaLabel: hasPlan ? "Otwórz kalendarz" : "Generuj plan",
      });
    }

    if (!isWeekCovered) {
      dailyCards.push({
        id: "improvement-coverage",
        kind: "optimization",
        title: "Jedno usprawnienie: domknij tydzień",
        whyNow: "Plan tygodnia jest zbyt płytki i wymaga uzupełnienia tematów.",
        estimatedTime: "30m",
        ifSkip: "Braki tematów podniosą ryzyko luk w publikacjach w tym tygodniu.",
        ctaLabel: "Otwórz kalendarz",
        detailsHref: coverageHref,
      });
    } else if (hasOverdue) {
      dailyCards.push({
        id: "improvement-overdue",
        kind: "optimization",
        title: "Jedno usprawnienie: oczyść zaległości",
        whyNow: "W kolejce są zaległe pozycje, które blokują rytm publikacji.",
        estimatedTime: "30m",
        ifSkip: "Zaległości będą się kumulować i obniżą terminowość zespołu.",
        ctaLabel: "Otwórz kalendarz",
        detailsHref: coverageHref,
      });
    } else if (!hasNewsletterThisWeek && hasPlan) {
      dailyCards.push({
        id: "improvement-newsletter",
        kind: "optimization",
        title: "Jedno usprawnienie: dodaj newsletter",
        whyNow: "W tym tygodniu brakuje podsumowania newsletterowego.",
        estimatedTime: "15m",
        ifSkip: "Możesz stracić regularny kontakt z odbiorcami tygodniowymi.",
        ctaLabel: "Otwórz plan",
      });
    } else {
      dailyCards.push({
        id: "improvement-pace",
        kind: "optimization",
        title: "Jedno usprawnienie: utrzymaj tempo",
        whyNow: "Plan tygodnia wygląda stabilnie, warto utrzymać rytm realizacji.",
        estimatedTime: "15m",
        ifSkip: "Bez regularnej kontroli jakość i terminowość mogą spaść pod koniec tygodnia.",
        ctaLabel: "Otwórz plan",
      });
    }

    if (hasOverdue) {
      dailyCards.push({
        id: "risk-overdue",
        kind: "risk",
        title: "Jedno ryzyko: poślizg publikacji",
        whyNow: "Najsilniejszy sygnał ryzyka to zaległe pozycje w planie.",
        estimatedTime: "30m",
        ifSkip: "Następne publikacje przesuną się i zwiększą presję operacyjną.",
        ctaLabel: "Pokaż zaległe",
        detailsHref: coverageHref,
      });
    } else if (!isProjectReady) {
      dailyCards.push({
        id: "risk-project",
        kind: "risk",
        title: "Jedno ryzyko: niepełny kontekst projektu",
        whyNow: "Braki w kontekście osłabiają jakość szkiców i decyzji redakcyjnych.",
        estimatedTime: "15m",
        ifSkip: "Kolejne treści mogą wymagać poprawek i wydłużyć realizację.",
        ctaLabel: "Uzupełnij projekt",
      });
    }

    const preferredCards = isHighPressure && dailyCards.some((card) => estimatedMinutes(card.estimatedTime) <= 30)
      ? [
        ...dailyCards.filter((card) => estimatedMinutes(card.estimatedTime) <= 30),
        ...dailyCards.filter((card) => estimatedMinutes(card.estimatedTime) > 30),
      ]
      : dailyCards;

    return preferredCards.slice(0, 3);
  }, [items, hasPlan, isWeekCovered, hasOverdue, hasNewsletterThisWeek, isProjectReady, generatePlanHref, coverageHref, recentOutcomeCount, isHighPressure]);

  useEffect(() => {
    if (didEmitStackBuild.current) {
      return;
    }
    didEmitStackBuild.current = true;
    recordTelemetry({
      workspaceId,
      type: "daily_stack_built",
      timestampISO: new Date().toISOString(),
      metadata: {
        itemsCount: cards.length,
        pressureBand: isHighPressure ? "high" : "normal",
      },
    });
  }, [workspaceId, cards.length, isHighPressure]);

  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Dziś skup się na tym</CardTitle>
            <p className="text-sm text-muted">System wybiera najważniejsze 2–3 kroki.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text">
              Dla kogo
              <select
                value={selectedAssigneeId}
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                className="rounded-md border border-border bg-surface2 px-1 py-0.5 text-xs text-text"
              >
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text">
              <input
                type="checkbox"
                checked={showRationale}
                onChange={(event) => setShowRationale(event.target.checked)}
              />
              Pokaż uzasadnienie
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {notice ? (
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text">{notice}</p>
        ) : null}

        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-text">{card.title}</p>
              <Badge>{card.estimatedTime}</Badge>
            </div>
            <p className="text-xs text-muted">Dla: {assigneeOptions.find((option) => option.id === selectedAssigneeId)?.name ?? "Ja"}</p>

            {showRationale ? (
              <div className="space-y-1">
                <p className="text-xs text-muted">Dlaczego teraz: {card.whyNow}</p>
                <p className="text-xs text-muted">Jeśli pominiesz: {card.ifSkip}</p>
                {isHighPressure ? (
                  <p className="text-xs text-muted">Wysokie napięcie tygodnia — preferuję krótsze zadania.</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleStart(card)}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-primary px-3 text-xs font-medium text-primary-foreground"
              >
                {card.ctaLabel}
              </button>
              {card.detailsHref ? (
                <Link
                  href={card.detailsHref}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface2 px-3 text-xs text-text"
                >
                  Pokaż szczegóły
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>

      <FocusSessionSheet
        workspaceId={workspaceId}
        open={Boolean(activeSession)}
        payload={activeSession}
        manualModeInfo="Tryb skupienia działa manualnie niezależnie od tokenów AI."
        onClose={() => setActiveSession(null)}
        onRecordOutcome={onRecordFocusOutcome}
        onSaved={() => {
          setNotice("Zapisano wynik sesji. System uwzględni to w priorytetach.");
          setRecentOutcomeCount((value) => value + 1);
        }}
      />
    </Card>
  );
}
