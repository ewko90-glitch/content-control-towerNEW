import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { uiCopy } from "@/lib/uiCopy";
import { generateFromPlanItem } from "@/server/actions/content";
import { getPlan, listPlans } from "@/server/queries/plans";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const t = uiCopy.pl;

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function startOfWeek(reference: Date): Date {
  const date = new Date(reference);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sameDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

function channelBadgeClass(channel: string): string {
  if (channel === "linkedin") {
    return "border-sky-300 bg-sky-100 text-sky-900";
  }
  if (channel === "blog") {
    return "border-emerald-300 bg-emerald-100 text-emerald-900";
  }
  return "border-pink-300 bg-pink-100 text-pink-900";
}

function channelLabel(channel: string): string {
  if (channel === "linkedin") {
    return t.calendarProduct.channelLinkedin;
  }
  if (channel === "blog") {
    return t.calendarProduct.channelBlog;
  }
  return t.calendarProduct.channelInstagram;
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const search = await searchParams;

  async function openDayAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const itemId = String(formData.get("itemId") ?? "");
    const date = String(formData.get("date") ?? "");
    const channel = String(formData.get("channel") ?? "linkedin");

    if (itemId) {
      const generated = await generateFromPlanItem(access.workspace.id, itemId);
      if (generated.ok) {
        redirect(`/w/${workspaceSlug}/content/${generated.data.contentId}`);
      }
    }

    redirect(`/w/${workspaceSlug}/content?new=1&date=${encodeURIComponent(date)}&channel=${encodeURIComponent(channel)}`);
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const selectedPlanId = toValue(search.planId);
    const viewMode = toValue(search.view) === "month" ? "month" : "week";

    const plans = await listPlans(access.workspace.id);
    const activePlan = selectedPlanId ? await getPlan(selectedPlanId, access.workspace.id) : plans[0] ? await getPlan(plans[0].id, access.workspace.id) : null;

    const weekStart = startOfWeek(new Date());
    const weekDays = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return day;
    });

    const items = activePlan?.items ?? [];
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthDays: Date[] = [];
    const firstMonday = startOfWeek(monthStart);
    for (let d = new Date(firstMonday); d <= monthEnd || monthDays.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
      monthDays.push(new Date(d));
      if (monthDays.length > 42) break;
    }
    const monthName = today.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

    return (
      <AppShell
        title={t.calendarProduct.title}
        subtitle={t.calendarProduct.subtitle}
        activeHref={`/w/${access.workspace.slug}/calendar`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title={t.calendarProduct.title}
          subtitle={t.calendarProduct.subtitle}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/w/${workspaceSlug}/calendar?view=week${selectedPlanId ? `&planId=${encodeURIComponent(selectedPlanId)}` : ""}`}
                className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium ${viewMode === "week" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface2 text-text"}`}
              >
                {t.calendarProduct.week}
              </Link>
              <Link
                href={`/w/${workspaceSlug}/calendar?view=month${selectedPlanId ? `&planId=${encodeURIComponent(selectedPlanId)}` : ""}`}
                className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium ${viewMode === "month" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface2 text-text"}`}
              >
                {t.calendarProduct.month}
              </Link>
            </div>
          }
        />

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <p className="text-sm font-medium text-text">{t.calendarProduct.channelsLegend}:</p>
            <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-xs text-sky-900">{t.calendarProduct.channelLinkedin}</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs text-emerald-900">{t.calendarProduct.channelBlog}</span>
            <span className="rounded-full border border-pink-300 bg-pink-100 px-2 py-1 text-xs text-pink-900">{t.calendarProduct.channelInstagram}</span>
            <span className="ml-auto text-xs text-muted">{t.calendarProduct.alwaysVisible}</span>
          </CardContent>
        </Card>

        {viewMode === "week" ? (
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.calendarProduct.week}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-7">
              {weekDays.map((day) => {
                const key = dayKey(day);
                const dayItems = items.filter((item) => sameDay(item.publishDate, key));
                const mainItem = dayItems[0];
                const dayTime = day.getTime();
                const isOverdue = dayTime < todayStart && dayItems.some((item) => item.status !== "published");
                const linkHref = mainItem?.contentId
                  ? `/w/${workspaceSlug}/content/${mainItem.contentId}`
                  : `/w/${workspaceSlug}/content?new=1&date=${encodeURIComponent(key)}&channel=${encodeURIComponent(mainItem?.channel ?? "linkedin")}`;

                return (
                  <div key={key} className={`rounded-xl border p-3 ${isOverdue ? "border-danger" : "border-border"}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text">{day.toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                      <form action={openDayAction}>
                        <input type="hidden" name="itemId" value={mainItem?.id ?? ""} />
                        <input type="hidden" name="date" value={key} />
                        <input type="hidden" name="channel" value={mainItem?.channel ?? "linkedin"} />
                        <Button type="submit" size="sm" variant="ghost" title={t.calendarProduct.openDay}>+</Button>
                      </form>
                    </div>

                    {mainItem ? (
                      <>
                        <p className="mb-2 text-xs text-text">{mainItem.title}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${channelBadgeClass(mainItem.channel)}`}>
                          {channelLabel(mainItem.channel)}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={linkHref} className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-surface px-2 text-[11px] text-text">
                            {mainItem.contentId ? t.calendarProduct.finishDraft : t.calendarProduct.openDay}
                          </Link>
                          {!mainItem.contentId ? (
                            <form action={openDayAction}>
                              <input type="hidden" name="itemId" value={mainItem.id} />
                              <input type="hidden" name="date" value={key} />
                              <input type="hidden" name="channel" value={mainItem.channel} />
                              <Button type="submit" size="sm" variant="secondary" className="h-7 text-[11px]">{t.calendarProduct.createDraft}</Button>
                            </form>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted">{t.calendarProduct.noPublication}</p>
                        <Link href={linkHref} className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-surface px-2 text-[11px] text-text">
                          {t.calendarProduct.openDay}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle className="capitalize">{monthName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-7 gap-1">
                {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map((d) => (
                  <p key={d} className="py-1 text-center text-xs font-medium text-muted">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const key = dayKey(day);
                  const dayItems = items.filter((item) => sameDay(item.publishDate, key));
                  const mainItem = dayItems[0];
                  const isCurrentMonth = day.getMonth() === today.getMonth();
                  const isToday = key === dayKey(today);
                  const isOverdue = day.getTime() < todayStart && dayItems.some((i) => i.status !== "published");
                  const linkHref = mainItem?.contentId
                    ? `/w/${workspaceSlug}/content/${mainItem.contentId}`
                    : `/w/${workspaceSlug}/content?new=1&date=${encodeURIComponent(key)}&channel=${encodeURIComponent(mainItem?.channel ?? "linkedin")}`;

                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] rounded-xl border p-2 ${
                        !isCurrentMonth ? "bg-surface2 opacity-40" :
                        isToday ? "border-primary bg-primarySoft/30" :
                        isOverdue ? "border-danger/50" :
                        "border-border"
                      }`}
                    >
                      <p className={`mb-1 text-xs font-medium ${isToday ? "text-primary" : "text-muted"}`}>
                        {day.getDate()}
                      </p>
                      {mainItem ? (
                        <Link href={linkHref}>
                          <div className={`rounded-lg px-1.5 py-1 text-[10px] leading-tight ${channelBadgeClass(mainItem.channel)}`}>
                            <p className="truncate font-medium">{mainItem.title}</p>
                            <p className="opacity-70">{channelLabel(mainItem.channel)}</p>
                          </div>
                        </Link>
                      ) : isCurrentMonth ? (
                        <Link
                          href={`/w/${workspaceSlug}/content?new=1&date=${encodeURIComponent(key)}`}
                          className="text-[10px] text-muted hover:text-primary"
                        >
                          + dodaj
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
