import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { uiCopy } from "@/lib/uiCopy";
import { listContentItems } from "@/server/queries/content";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

const t = uiCopy.pl;

export default async function StatsPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const items = await listContentItems(access.workspace.id);

    const published = items.filter((item) => item.status === "published").length;
    const drafts = items.filter((item) => item.status === "draft").length;

    const now = Date.now();
    const overdue = items.filter((item) => {
      const time = new Date(item.updatedAt).getTime();
      return Number.isFinite(time) && time < now && item.status !== "published";
    }).length;
    const onTime = Math.max(0, published - Math.min(published, overdue));

    const byChannel = {
      linkedin: items.filter((item) => item.channel === "linkedin").length,
      blog: items.filter((item) => item.channel === "blog").length,
      instagram: items.filter((item) => item.channel === "newsletter" || item.channel === "landing").length,
    };

    const weekConsistency = Math.min(100, Math.round((published / Math.max(1, published + overdue)) * 100));

    return (
      <AppShell title={t.statsProduct.title} subtitle={t.statsProduct.subtitle} activeHref={`/w/${workspaceSlug}/portfolio`} workspaceSlug={workspaceSlug}>
        <PageHeader title={t.statsProduct.title} subtitle={t.statsProduct.subtitle} />

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs text-muted">{t.statsProduct.published}</p>
              <p className="text-2xl font-semibold text-text">{published}</p>
              <p className="mt-1 text-xs text-muted">w tym miesiącu</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs text-muted">{t.statsProduct.drafts}</p>
              <p className="text-2xl font-semibold text-text">{drafts}</p>
              <p className="mt-1 text-xs text-muted">czeka na publikację</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs text-muted">{t.statsProduct.onTime}</p>
              <p className="text-2xl font-semibold text-text">{onTime}</p>
              <p className="mt-1 text-xs text-muted">na czas</p>
            </CardContent>
          </Card>
          <Card className={`rounded-2xl border shadow-soft ${overdue > 0 ? "border-red-200 bg-red-50" : "border-border"}`}>
            <CardContent className="p-5">
              <p className="text-xs text-muted">{t.statsProduct.overdue}</p>
              <p className="text-2xl font-semibold text-text">{overdue}</p>
              <p className="mt-1 text-xs text-muted">po terminie</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader><CardTitle>{t.statsProduct.byChannel}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              { key: "LinkedIn", value: byChannel.linkedin, progressClassName: "[&::-webkit-progress-value]:bg-[#0A66C2] [&::-moz-progress-bar]:bg-[#0A66C2]" },
              { key: "Blog", value: byChannel.blog, progressClassName: "[&::-webkit-progress-value]:bg-[#1A9E6E] [&::-moz-progress-bar]:bg-[#1A9E6E]" },
              { key: "Instagram", value: byChannel.instagram, progressClassName: "[&::-webkit-progress-value]:bg-[#C13584] [&::-moz-progress-bar]:bg-[#C13584]" },
            ]).map((entry) => (
              <div key={entry.key}>
                <div className="mb-1 flex items-center justify-between text-sm text-text"><span>{entry.key}</span><span>{entry.value}</span></div>
                <Progress value={Math.min(100, entry.value * 12)} max={100} progressClassName={entry.progressClassName} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader><CardTitle>{t.statsProduct.weeklyConsistency}</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted">{t.statsProduct.thisWeek}</p>
            <Progress value={weekConsistency} max={100} />
            <p className="mt-2 text-sm font-medium text-text">{weekConsistency}%</p>
            {(() => {
              const weekDots = Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                const day = d.getDay();
                const mondayIndex = day === 0 ? 6 : day - 1;
                const diff = i - mondayIndex;
                const date = new Date(d);
                date.setDate(d.getDate() + diff);
                const hasPost = items.some((item) =>
                  (item.publishDate ?? item.updatedAt).slice(0, 10) === date.toISOString().slice(0, 10)
                );
                return { hasPost, label: ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"][i] };
              });
              return (
                <div className="mt-4 flex gap-3">
                  {weekDots.map((dot, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`h-8 w-8 rounded-full ${dot.hasPost ? "bg-[#5B7CFA]" : "border-2 border-border bg-surface2"}`} />
                      <p className="text-[10px] text-muted">{dot.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
