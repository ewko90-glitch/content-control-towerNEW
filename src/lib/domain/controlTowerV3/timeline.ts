import type { Metrics, RawSnapshot, TimelineGroup, TimelineItem } from "./types";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toItem(row: RawSnapshot["publicationRows"][number], workspaceSlug: string): TimelineItem {
  return {
    id: row.id,
    time: formatTime(row.scheduledAt),
    scheduledAtISO: row.scheduledAt.toISOString(),
    title: row.contentTitle,
    channelLabel: row.channelLabel,
    status: row.status,
    href: `/w/${workspaceSlug}/content/${row.contentItemId}`,
  };
}

export function buildTimeline(raw: RawSnapshot, metrics: Metrics, now: Date): TimelineGroup[] {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startDayAfterTomorrow = new Date(startTomorrow);
  startDayAfterTomorrow.setDate(startDayAfterTomorrow.getDate() + 1);

  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);

  const today = raw.publicationRows.filter((row) => row.scheduledAt >= startToday && row.scheduledAt < startTomorrow).map((row) => toItem(row, raw.workspace.workspaceSlug));
  const tomorrow = raw.publicationRows
    .filter((row) => row.scheduledAt >= startTomorrow && row.scheduledAt < startDayAfterTomorrow)
    .map((row) => toItem(row, raw.workspace.workspaceSlug));
  const week = raw.publicationRows
    .filter((row) => row.scheduledAt >= startToday && row.scheduledAt < endWeek)
    .map((row) => toItem(row, raw.workspace.workspaceSlug));

  return [
    {
      key: "today",
      title: "Dziś",
      label: "Dziś",
      items: today,
    },
    {
      key: "tomorrow",
      title: "Jutro",
      label: "Jutro",
      items: tomorrow,
    },
    {
      key: "week",
      title: "Ten tydzień",
      label: "Ten tydzień",
      items: week,
      emptyCta: metrics.noneUpcomingWeek
        ? {
            label: "Zaplanuj 1 publikację na ten tydzień",
            href: `/w/${raw.workspace.workspaceSlug}/calendar`,
          }
        : undefined,
    },
  ];
}
