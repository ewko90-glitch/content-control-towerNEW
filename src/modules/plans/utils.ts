export function resolveWeekWindow(weekStartISO: string): { start: Date; end: Date } {
  const start = new Date(weekStartISO);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
