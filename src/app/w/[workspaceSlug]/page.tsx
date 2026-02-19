import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { getUsage } from "@/lib/projectStore";
import { uiCopy } from "@/lib/uiCopy";
import { listContentItems } from "@/server/queries/content";
import { getAutopilotQueue } from "@/server/queries/plans";

const t = uiCopy.pl;

type WorkspacePageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

function isoDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const routeParams = await params;

  try {
    const access = await requireWorkspaceAccess(routeParams.workspaceSlug, "VIEWER");
    const [autopilot, items] = await Promise.all([
      getAutopilotQueue(access.workspace.id),
      listContentItems(access.workspace.id),
    ]);

    const todayItems = autopilot.today.slice(0, 3);
    const overdueItems = autopilot.overdue.slice(0, 3);
    const upcomingItems = [...autopilot.thisWeek.items]
      .sort((left, right) => new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime())
      .slice(0, 3);

    const weeklyPlanned = Math.min(7, autopilot.thisWeek.items.length);
    const weeklyProgressPct = Math.round((weeklyPlanned / 7) * 100);

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const last30 = items.filter((item) => {
      const time = new Date(item.updatedAt).getTime();
      return Number.isFinite(time) && time >= now - (30 * dayMs);
    });

    const publishedLast30 = last30.filter((item) => item.status === "published").length;
    const overdueLast30 = last30.filter((item) => {
      const publishDate = new Date(item.updatedAt).getTime();
      return item.status !== "published" && Number.isFinite(publishDate) && publishDate < now;
    }).length;
    const onTimeLast30 = Math.max(0, publishedLast30 - Math.min(publishedLast30, overdueLast30));
    const aiUsage = getUsage(access.workspace.id).aiThisMonth;

    const todayPrimary = todayItems[0];

    return (
      <AppShell
        title={t.overview.title}
        subtitle={t.overview.subtitle}
        activeHref={`/w/${access.workspace.slug}/overview`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader title={t.overview.title} subtitle={t.overview.subtitle} />

        <Card className="mb-4 rounded-2xl border border-border bg-primarySoft/40 shadow-soft">
          <CardHeader>
            <CardTitle>{t.overview.postToday}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text">{todayPrimary?.title ?? t.overview.noTodayTask}</p>
              <p className="text-xs text-muted">{todayPrimary ? `${isoDate(todayPrimary.publishDate)} • ${todayPrimary.channel}` : ""}</p>
            </div>
            <Link
              href={todayPrimary?.contentId ? `/w/${access.workspace.slug}/content/${todayPrimary.contentId}` : `/w/${access.workspace.slug}/content?new=1`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t.overview.openAndFinish}
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.overview.todayTodo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(todayItems.length > 0 ? todayItems : autopilot.thisWeek.items.slice(0, 3)).map((item) => (
                <div key={item.planItemId} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface2 p-3">
                  <div>
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="text-xs text-muted">{isoDate(item.publishDate)} • {item.channel}</p>
                  </div>
                  <Link
                    href={item.contentId ? `/w/${access.workspace.slug}/content/${item.contentId}` : `/w/${access.workspace.slug}/content?new=1&planItemId=${encodeURIComponent(item.planItemId)}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                  >
                    {item.contentId ? t.overview.finish : t.overview.write}
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.overview.thisWeek}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span
                    key={String(index)}
                    className={`h-8 w-8 rounded-full border ${index < weeklyPlanned ? "border-primary bg-primarySoft" : "border-border bg-surface2"}`}
                  />
                ))}
              </div>
              <Progress value={weeklyProgressPct} max={100} />
              <p className="mt-2 text-sm text-muted">{weeklyPlanned} {t.overview.plannedOfSeven}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-danger/40 bg-danger/5 shadow-soft">
            <CardHeader>
              <CardTitle>{t.overview.overdue}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueItems.length === 0 ? (
                <p className="text-sm text-muted">{t.overview.noOverdue}</p>
              ) : (
                overdueItems.map((item) => (
                  <div key={item.planItemId} className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-surface p-3">
                    <div>
                      <p className="text-sm font-medium text-text">{item.title}</p>
                      <p className="text-xs text-muted">{isoDate(item.publishDate)} • {item.channel}</p>
                    </div>
                    <Link
                      href={item.contentId ? `/w/${access.workspace.slug}/content/${item.contentId}` : `/w/${access.workspace.slug}/content?new=1&planItemId=${encodeURIComponent(item.planItemId)}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface2 px-3 text-xs text-text"
                    >
                      {t.overview.writeOrFinish}
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.overview.last30Days}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-xs text-muted">{t.overview.published}</p>
                <p className="text-xl font-semibold text-text">{publishedLast30}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-xs text-muted">{t.overview.onTime}</p>
                <p className="text-xl font-semibold text-text">{onTimeLast30}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-xs text-muted">{t.overview.overdueCount}</p>
                <p className="text-xl font-semibold text-text">{overdueLast30}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-xs text-muted">{t.overview.aiUsage}</p>
                <p className="text-xl font-semibold text-text">{aiUsage}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>{t.overview.upcoming}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingItems.length === 0 ? (
              <p className="text-sm text-muted">{t.overview.noUpcoming}</p>
            ) : (
              upcomingItems.map((item) => (
                <div key={item.planItemId} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface2 p-3">
                  <div>
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="text-xs text-muted">{isoDate(item.publishDate)} • {item.channel}</p>
                  </div>
                  <Badge>{item.status}</Badge>
                </div>
              ))
            )}

            <Link
              href={`/w/${access.workspace.slug}/calendar`}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm font-medium text-text"
            >
              {t.overview.openFullCalendar}
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
