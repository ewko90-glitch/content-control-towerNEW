import type { RawInput } from "./queries";
import type { DecisionThresholds } from "./thresholds";
import type { Metrics } from "./types";

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeNumber(input: number | null | undefined): number {
  if (typeof input !== "number" || Number.isNaN(input) || !Number.isFinite(input)) {
    return 0;
  }

  return input;
}

function safePct(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function bucketByContentItem(events: RawInput["reviewTransitions"]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const event of events) {
    const list = map.get(event.contentItemId) ?? [];
    list.push(event.createdAtISO);
    map.set(event.contentItemId, list);
  }

  return map;
}

export function computeMetrics(raw: RawInput, now: Date, thresholds: DecisionThresholds): Metrics {
  const nowMs = now.getTime();

  const statusCounts = raw.statusCounts;
  const totalContent = safeNumber(raw.totalContent);

  const reviewEventsByItem = bucketByContentItem(raw.reviewTransitions ?? []);

  const reviewAgesHours: number[] = (raw.stageItems ?? [])
    .filter((item) => item.status === "REVIEW")
    .map((item) => {
    const eventCandidates = reviewEventsByItem.get(item.id) ?? [];
    const enteredReviewDate = toDate(eventCandidates[0]) ?? toDate(item.updatedAtISO);

    if (!enteredReviewDate) {
      return 0;
    }

    const diffMs = Math.max(0, nowMs - enteredReviewDate.getTime());
      return diffMs / 3600000;
    });

  const staleDraftCount = (raw.stageItems ?? [])
    .filter((item) => item.status === "DRAFT")
    .filter((item) => {
      const updatedAt = toDate(item.updatedAtISO);
      if (!updatedAt) {
        return false;
      }
      return nowMs - updatedAt.getTime() >= thresholds.staleDraftDays * 24 * 3600000;
    }).length;

  const reviewCount = reviewAgesHours.length;
  const reviewOver48hCount = reviewAgesHours.filter((hours) => hours > thresholds.reviewOverdueHours).length;
  const avgReviewHours = reviewCount > 0 ? reviewAgesHours.reduce((acc, value) => acc + value, 0) / reviewCount : 0;

  const overdueOldestDate = toDate(raw.oldestOverdueDueAtISO);
  const overdueMaxAgeDays = overdueOldestDate ? Math.max(0, (nowMs - overdueOldestDate.getTime()) / 86400000) : 0;

  const publicationItems = raw.publicationItems ?? [];

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startDayAfterTomorrow = new Date(startTomorrow);
  startDayAfterTomorrow.setDate(startDayAfterTomorrow.getDate() + 1);

  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);

  let upcomingToday = 0;
  let upcomingTomorrow = 0;
  let upcomingWeek = 0;

  for (const publication of publicationItems) {
    const date = toDate(publication.scheduledAtISO);
    if (!date) {
      continue;
    }

    if (date >= startToday && date < endWeek) {
      upcomingWeek += 1;
    }

    if (date >= startToday && date < startTomorrow) {
      upcomingToday += 1;
    } else if (date >= startTomorrow && date < startDayAfterTomorrow) {
      upcomingTomorrow += 1;
    }
  }

  const creditsRemaining = safeNumber(raw.creditsRemaining);
  const monthlyCredits = safeNumber(raw.monthlyCredits);
  const creditsUsedPct = monthlyCredits > 0 ? Math.max(0, Math.min(1, (monthlyCredits - creditsRemaining) / monthlyCredits)) : 0;
  const remainingPct = monthlyCredits > 0 ? creditsRemaining / monthlyCredits : creditsRemaining > 0 ? 1 : 0;

  const ideaCount = safeNumber(statusCounts.IDEA);
  const draftCount = safeNumber(statusCounts.DRAFT);
  const reviewStatusCount = safeNumber(statusCounts.REVIEW);

  const staleReviewCount = reviewAgesHours.filter((hours) => hours >= thresholds.staleReviewDays * 24).length;
  const workflowEventsTotal = safeNumber((raw.reviewTransitions ?? []).length);
  const velocity = totalContent > 0 ? Math.max(0, Math.min(1, (safeNumber(raw.versionsLast7d) + safeNumber(raw.aiJobsLast7d)) / totalContent)) : 0;
  const noneUpcomingWeek = upcomingWeek === 0;
  const lowCredits = creditsRemaining <= 0;
  const warningCredits = !lowCredits && remainingPct <= 0.2;
  const inactivity = safeNumber(raw.createdLast7d) === 0 && safeNumber(raw.versionsLast7d) === 0 && safeNumber(raw.aiJobsLast7d) === 0;
  const workflowDistribution = {
    ideaPct: safePct(ideaCount, totalContent),
    imbalance: totalContent > 0 && Math.max(ideaCount, draftCount, reviewStatusCount) / totalContent >= 0.7,
  };

  return {
    totalContent,
    overdueCount: safeNumber(raw.overdueCount),
    overdueMaxAgeDays,
    reviewCount,
    reviewOver48hCount,
    avgReviewHours,
    staleDraftCount,
    staleReviewCount,
    upcomingToday,
    upcomingTomorrow,
    upcomingWeek,
    createdLast7d: safeNumber(raw.createdLast7d),
    versionsLast7d: safeNumber(raw.versionsLast7d),
    aiJobsLast7d: safeNumber(raw.aiJobsLast7d),
    creditsRemaining,
    monthlyCredits,
    creditsUsedPct,
    lowCredits,
    warningCredits,
    noneUpcomingWeek,
    workflowEventsTotal,
    byStatus: {
      REVIEW: reviewStatusCount,
    },
    velocity,
    workflowDistribution,
    inactivity,
    ideaPct: safePct(ideaCount, totalContent),
    draftPct: safePct(draftCount, totalContent),
    reviewPct: safePct(reviewStatusCount, totalContent),
    inactive: inactivity,
  };
}
