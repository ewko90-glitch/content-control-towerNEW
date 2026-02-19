import { requireAiAccess, requireRole } from "./permissions";
import type { DashboardMetrics, DashboardRaw, DashboardSnapshot, HealthScore, Signal, TimelineGroup } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safePct(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return clamp(Number(((numerator / denominator) * 100).toFixed(1)), 0, 100);
}

function impactLabel(score: number): "Niski" | "Średni" | "Wysoki" | "Krytyczny" {
  if (score < 25) {
    return "Niski";
  }

  if (score < 50) {
    return "Średni";
  }

  if (score < 75) {
    return "Wysoki";
  }

  return "Krytyczny";
}

function confidenceFromRaw(raw: DashboardRaw): { score: number; label: "Niska" | "Średnia" | "Wysoka" } {
  let score = 0.7;

  if (raw.counts.total < 5) {
    score -= 0.35;
  }

  if (raw.activity.workflow7d === 0) {
    score -= 0.2;
  }

  if (raw.activity.aiJobs7d > 0 && raw.publicationRows.length > 0) {
    score += 0.15;
  }

  const clamped = clamp(Number(score.toFixed(2)), 0, 1);
  return {
    score: clamped,
    label: clamped < 0.4 ? "Niska" : clamped < 0.75 ? "Średnia" : "Wysoka",
  };
}

export function computeMetrics(raw: DashboardRaw, now: Date): DashboardMetrics {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startDayAfterTomorrow = new Date(startTomorrow);
  startDayAfterTomorrow.setDate(startDayAfterTomorrow.getDate() + 1);

  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);

  const upcomingToday = raw.publicationRows.filter((row) => row.scheduledAt >= startToday && row.scheduledAt < startTomorrow).length;
  const upcomingTomorrow = raw.publicationRows
    .filter((row) => row.scheduledAt >= startTomorrow && row.scheduledAt < startDayAfterTomorrow)
    .length;
  const upcomingWeek = raw.publicationRows.filter((row) => row.scheduledAt >= startToday && row.scheduledAt < endWeek).length;

  return {
    totalContent: raw.counts.total,
    overdueCount: raw.counts.overdue,
    overdueMaxAgeDays: raw.counts.overdueMaxAgeDays,
    reviewCount: raw.review.count,
    reviewOver48hCount: raw.review.over48h,
    avgReviewHours: raw.review.avgHours,
    upcomingToday,
    upcomingTomorrow,
    upcomingWeek,
    noneUpcomingWeek: upcomingWeek === 0,
    creditsRemaining: raw.credits.remaining,
    monthlyCredits: raw.credits.monthly,
    creditsUsedPct: raw.credits.usedPct,
    aiJobs7d: raw.activity.aiJobs7d,
    contentCreated7d: raw.activity.content7d,
    workflowEvents7d: raw.activity.workflow7d,
    byStatus: {
      IDEA: raw.counts.idea,
      DRAFT: raw.counts.draft,
      REVIEW: raw.counts.review,
      APPROVED: raw.counts.approved,
      SCHEDULED: raw.counts.scheduled,
      PUBLISHED: raw.counts.published,
      ARCHIVED: raw.counts.archived,
    },
  };
}

function healthLabel(score: number): HealthScore["label"] {
  if (score >= 85) {
    return "Świetna forma";
  }

  if (score >= 60) {
    return "Stabilnie";
  }

  if (score >= 40) {
    return "Wymaga uwagi";
  }

  return "Krytyczne";
}

export function computeHealth(metrics: DashboardMetrics, slug: string): HealthScore {
  const flowMax = 35;
  const scheduleMax = 35;
  const resourceMax = 30;

  const flowPoints = clamp(flowMax - (metrics.overdueCount * 3 + metrics.reviewOver48hCount * 2), 0, flowMax);
  const schedulePoints = metrics.noneUpcomingWeek ? 6 : clamp(12 + metrics.upcomingWeek * 4, 0, scheduleMax);
  const resourcePoints = metrics.creditsRemaining === 0 ? 6 : metrics.creditsUsedPct > 0.9 ? 14 : 24;

  const score = clamp(flowPoints + schedulePoints + resourcePoints, 0, 100);

  return {
    score,
    label: healthLabel(score),
    breakdown: [
      {
        key: "flow",
        title: "Przepływ treści",
        points: Math.round(flowPoints),
        maxPoints: flowMax,
        explanation: `Zaległe: ${metrics.overdueCount}, REVIEW >48h: ${metrics.reviewOver48hCount}.`,
        severity: flowPoints < 14 ? "danger" : flowPoints < 24 ? "warning" : "info",
        relatedHref: `/w/${slug}/content`,
      },
      {
        key: "schedule",
        title: "Agenda publikacji",
        points: Math.round(schedulePoints),
        maxPoints: scheduleMax,
        explanation: metrics.noneUpcomingWeek
          ? "Brak zaplanowanych publikacji w 7 dni."
          : `Publikacje: dziś ${metrics.upcomingToday}, jutro ${metrics.upcomingTomorrow}, 7 dni ${metrics.upcomingWeek}.`,
        severity: schedulePoints < 14 ? "danger" : schedulePoints < 24 ? "warning" : "info",
        relatedHref: `/w/${slug}/calendar`,
      },
      {
        key: "resources",
        title: "Zasoby AI",
        points: Math.round(resourcePoints),
        maxPoints: resourceMax,
        explanation:
          metrics.creditsRemaining === 0
            ? "Brak dostępnych kredytów AI. Zwiększ plan lub poczekaj na odnowienie puli."
            : `Pozostałe kredyty AI: ${metrics.creditsRemaining}.`,
        severity: resourcePoints < 12 ? "danger" : resourcePoints < 20 ? "warning" : "info",
        relatedHref: `/w/${slug}/content`,
      },
    ],
  };
}

function signal(
  key: string,
  severity: Signal["severity"],
  title: string,
  description: string,
  why: string,
  impactScore: number,
  confidence: ReturnType<typeof confidenceFromRaw>,
  ctaLabel: string,
  href: string,
  permissions: Signal["permissions"],
): Signal {
  const score = clamp(Math.round(impactScore), 0, 100);
  return {
    key,
    severity,
    title,
    description,
    why,
    impact: {
      score,
      label: impactLabel(score),
    },
    confidence,
    cta: {
      label: ctaLabel,
      href,
    },
    permissions,
  };
}

export function computePriority(raw: DashboardRaw, metrics: DashboardMetrics): Signal {
  const confidence = confidenceFromRaw(raw);
  const contentHref = `/w/${raw.workspace.slug}/content`;
  const reviewHref = `/w/${raw.workspace.slug}/content?status=REVIEW`;

  if (metrics.overdueCount > 0) {
    return signal(
      "priority-overdue",
      "danger",
      "Masz zaległe treści",
      "Część zadań jest po terminie.",
      `Wykryto ${metrics.overdueCount} zaległych elementów. Najstarsze opóźnienie: ${metrics.overdueMaxAgeDays} dni.`,
      78,
      confidence,
      "Zobacz zaległe",
      contentHref,
      requireRole(raw.workspace.role, "EDITOR"),
    );
  }

  if (metrics.reviewOver48hCount > 0) {
    return signal(
      "priority-review",
      "warning",
      "Kolejka REVIEW wymaga decyzji",
      "Elementy czekają ponad 48 godzin.",
      `W REVIEW >48h: ${metrics.reviewOver48hCount}.`,
      64,
      confidence,
      "Przejdź do REVIEW",
      reviewHref,
      requireRole(raw.workspace.role, "MANAGER"),
    );
  }

  if (metrics.noneUpcomingWeek) {
    return signal(
      "priority-no-publications",
      "warning",
      "Brak zaplanowanych publikacji",
      "Nie masz żadnych publikacji w najbliższych 7 dniach.",
      "To zwiększa ryzyko przerwania ciągłości komunikacji.",
      62,
      confidence,
      "Przejdź do kalendarza",
      `/w/${raw.workspace.slug}/calendar`,
      requireRole(raw.workspace.role, "MANAGER"),
    );
  }

  return signal(
    "priority-default",
    "info",
    "Pipeline działa stabilnie",
    "Dziś nie wykryto krytycznych blokad.",
    "Utrzymaj rytm: dodawanie treści, review i plan publikacji.",
    22,
    confidence,
    "Otwórz treści",
    contentHref,
    requireRole(raw.workspace.role, "EDITOR"),
  );
}

export function computeActionCards(raw: DashboardRaw, metrics: DashboardMetrics): Signal[] {
  const confidence = confidenceFromRaw(raw);
  const cards: Signal[] = [];

  if (metrics.noneUpcomingWeek) {
    cards.push(
      signal(
        "card-no-publications",
        "warning",
        "Brak zaplanowanych publikacji",
        "Nie masz żadnych publikacji w najbliższych 7 dniach.",
        "Pusty kalendarz utrudnia utrzymanie regularności publikacji.",
        66,
        confidence,
        "Przejdź do kalendarza",
        `/w/${raw.workspace.slug}/calendar`,
        requireRole(raw.workspace.role, "MANAGER"),
      ),
    );
  }

  if (metrics.reviewOver48hCount > 0) {
    cards.push(
      signal(
        "card-review-backlog",
        "warning",
        "REVIEW backlog",
        "Treści czekają na decyzję dłużej niż 48h.",
        `W REVIEW >48h: ${metrics.reviewOver48hCount}.`,
        63,
        confidence,
        "Przejdź do REVIEW",
        `/w/${raw.workspace.slug}/content?status=REVIEW`,
        requireRole(raw.workspace.role, "MANAGER"),
      ),
    );
  }

  if (metrics.overdueCount > 0) {
    cards.push(
      signal(
        "card-overdue",
        "danger",
        "Zaległe treści",
        "Treści są po terminie.",
        `Wymagają interwencji: ${metrics.overdueCount}.`,
        74,
        confidence,
        "Zobacz zaległe",
        `/w/${raw.workspace.slug}/content`,
        requireRole(raw.workspace.role, "EDITOR"),
      ),
    );
  }

  if (metrics.creditsRemaining === 0) {
    cards.push(
      signal(
        "card-ai-empty",
        "warning",
        "Brak kredytów AI",
        "Zwiększ plan lub poczekaj na odnowienie puli.",
        "Automatyzacje AI są chwilowo niedostępne.",
        58,
        confidence,
        "Użyj AI",
        `/w/${raw.workspace.slug}/content`,
        requireAiAccess(raw.workspace.role, metrics.creditsRemaining),
      ),
    );
  }

  const fallback = signal(
    "card-balance",
    "info",
    "Równoważ pipeline",
    "Przesuwaj treści z IDEA do REVIEW.",
    `IDEA: ${metrics.byStatus.IDEA}, REVIEW: ${metrics.byStatus.REVIEW}.`,
    22,
    confidence,
    "Otwórz treści",
    `/w/${raw.workspace.slug}/content`,
    requireRole(raw.workspace.role, "EDITOR"),
  );

  const unique = Array.from(new Map([...cards, fallback].map((item) => [item.key, item])).values());
  return unique.slice(0, 5);
}

function formatTime(value: Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(value);
}

export function computeTimeline(raw: DashboardRaw, metrics: DashboardMetrics, now: Date): TimelineGroup[] {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startDayAfterTomorrow = new Date(startTomorrow);
  startDayAfterTomorrow.setDate(startDayAfterTomorrow.getDate() + 1);

  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);

  const toItem = (entry: DashboardRaw["publicationRows"][number]) => ({
    id: entry.id,
    time: formatTime(entry.scheduledAt),
    title: entry.contentTitle || "—",
    channelLabel: entry.channelLabel || "—",
    status: entry.status,
    href: `/w/${raw.workspace.slug}/content/${entry.contentItemId}`,
  });

  return [
    {
      key: "today",
      title: "Dziś",
      items: raw.publicationRows.filter((item) => item.scheduledAt >= startToday && item.scheduledAt < startTomorrow).map(toItem),
    },
    {
      key: "tomorrow",
      title: "Jutro",
      items: raw.publicationRows.filter((item) => item.scheduledAt >= startTomorrow && item.scheduledAt < startDayAfterTomorrow).map(toItem),
    },
    {
      key: "week",
      title: "Ten tydzień",
      items: raw.publicationRows.filter((item) => item.scheduledAt >= startToday && item.scheduledAt < endWeek).map(toItem),
      emptyCta: metrics.noneUpcomingWeek ? { label: "Zaplanuj 1 publikację na ten tydzień", href: `/w/${raw.workspace.slug}/calendar` } : undefined,
    },
  ];
}

export function composeSnapshot(raw: DashboardRaw, now: Date): DashboardSnapshot {
  const metrics = computeMetrics(raw, now);
  const health = computeHealth(metrics, raw.workspace.slug);
  const priority = computePriority(raw, metrics);
  const actionCards = computeActionCards(raw, metrics);
  const timeline = computeTimeline(raw, metrics, now);

  return {
    generatedAt: now.toISOString(),
    workspace: raw.workspace,
    subtitle:
      metrics.overdueCount > 0
        ? "Dziś priorytet: odblokowanie zaległych treści."
        : metrics.noneUpcomingWeek
          ? "Dziś priorytet: uzupełnienie kalendarza publikacji."
          : "Panel działa stabilnie.",
    metrics,
    health,
    priority,
    actionCards,
    timeline,
    insights: [
      {
        key: "i-1",
        text: `W tym tygodniu: ${metrics.contentCreated7d} nowych treści`,
        severity: metrics.contentCreated7d === 0 ? "warning" : "info",
      },
      {
        key: "i-2",
        text: `Najbardziej obciążony etap: REVIEW (${metrics.byStatus.REVIEW})`,
        severity: metrics.byStatus.REVIEW > 0 ? "warning" : "info",
      },
      {
        key: "i-3",
        text: `AI: ${metrics.aiJobs7d} akcji w 7 dni`,
        severity: metrics.aiJobs7d === 0 ? "warning" : "info",
      },
    ],
    quickActions: [
      {
        key: "new",
        label: "Nowa treść",
        href: `/w/${raw.workspace.slug}/content`,
        disabled: !requireRole(raw.workspace.role, "EDITOR").canExecute,
        reason: requireRole(raw.workspace.role, "EDITOR").reasonIfDisabled,
      },
      {
        key: "content",
        label: "Treści (Kanban)",
        href: `/w/${raw.workspace.slug}/content`,
      },
      {
        key: "calendar",
        label: "Kalendarz",
        href: `/w/${raw.workspace.slug}/calendar`,
      },
      {
        key: "invite",
        label: "Zaproś członka",
        href: `/w/${raw.workspace.slug}`,
        disabled: !requireRole(raw.workspace.role, "ADMIN").canExecute,
        reason: requireRole(raw.workspace.role, "ADMIN").reasonIfDisabled,
      },
      {
        key: "ai",
        label: "Użyj AI",
        href: `/w/${raw.workspace.slug}/content`,
        disabled: !requireAiAccess(raw.workspace.role, metrics.creditsRemaining).canExecute,
        reason:
          metrics.creditsRemaining === 0
            ? "Brak dostępnych kredytów AI"
            : requireAiAccess(raw.workspace.role, metrics.creditsRemaining).reasonIfDisabled,
      },
    ],
    emptyState:
      metrics.totalContent === 0 && metrics.upcomingWeek === 0 && metrics.reviewCount === 0 && metrics.aiJobs7d === 0
        ? {
            title: "Zacznij budować swój system treści",
            steps: ["Dodaj pierwszą treść", "Zaplanuj publikację", "Użyj AI do przyspieszenia pracy"],
            cta: {
              label: "Dodaj treść",
              href: `/w/${raw.workspace.slug}/content`,
            },
          }
        : undefined,
  };
}

export function safeCreditsRemainingPct(metrics: DashboardMetrics): number {
  return safePct(metrics.creditsRemaining, metrics.monthlyCredits);
}
