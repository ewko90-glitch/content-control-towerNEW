import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { getPortfolioExecutionHealth } from "@/server/queries/plans";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseHorizon(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 8;
  }
  return Math.max(4, Math.min(12, Math.floor(parsed)));
}

function toWorkspaceHref(workspaceSlug: string, href: string): string {
  if (href.startsWith("/w/")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `/w/${workspaceSlug}${href}`;
  }
  return `/w/${workspaceSlug}/${href}`;
}

function clusterAnchorId(clusterId: string): string {
  const normalized = clusterId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `cluster-${normalized}`;
}

function performanceLabel(value: "high" | "medium" | "low" | "unknown"): string {
  if (value === "high") {
    return "Mocny";
  }
  if (value === "medium") {
    return "Średni";
  }
  if (value === "low") {
    return "Słaby";
  }
  return "Brak danych";
}

function coverageLabel(value: "healthy" | "thin" | "missing" | "drifting"): string {
  if (value === "healthy") {
    return "OK";
  }
  if (value === "thin") {
    return "Za mało";
  }
  if (value === "missing") {
    return "Brak";
  }
  return "Dryf";
}

function strategyTypeLabel(value: "scale" | "fix" | "fill" | "stabilize" | "observe"): string {
  if (value === "scale") {
    return "Skaluj";
  }
  if (value === "fix") {
    return "Napraw";
  }
  if (value === "fill") {
    return "Uzupełnij";
  }
  if (value === "stabilize") {
    return "Ustabilizuj";
  }
  return "Obserwuj";
}

export default async function ExecutionHealthPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const search = await searchParams;
  const horizonWeeks = parseHorizon(toValue(search.horizonWeeks));

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const isEmployee = access.membership.role === "EDITOR" || access.membership.role === "VIEWER";

    if (isEmployee) {
      redirect(`/w/${workspaceSlug}/content?restricted=1`);
    }

    const snapshot = await getPortfolioExecutionHealth(access.workspace.id, { horizonWeeks });

    return (
      <AppShell title="Execution Health" subtitle="COO Delivery Health" activeHref={`/w/${workspaceSlug}/portfolio`} workspaceSlug={workspaceSlug}>
        <PageHeader
          title="Execution Health"
          subtitle="Delivery risk, focus this week, and recommended interventions."
          actions={
            <Link
              href={`/w/${workspaceSlug}/portfolio`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
            >
              Back to Portfolio
            </Link>
          }
        />

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs text-muted">On-time rate</p>
              <p className="text-lg font-semibold text-text">{snapshot.kpis.onTimeRate}%</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs text-muted">Overdue items</p>
              <p className="text-lg font-semibold text-danger">{snapshot.kpis.overdueItems}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs text-muted">Drifting clusters</p>
              <p className="text-lg font-semibold text-text">{snapshot.kpis.driftingClusters}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs text-muted">Missing coverage</p>
              <p className="text-lg font-semibold text-text">{snapshot.kpis.missingClusters}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Top Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.topRisks.length === 0 ? (
              <p className="text-sm text-muted">No critical risks detected for selected horizon.</p>
            ) : (
              snapshot.topRisks.map((risk) => (
                <div key={risk.planId} className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{risk.projectName} • {risk.planName}</p>
                    <Badge>Risk {risk.riskScore}</Badge>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {risk.reasons.map((reason) => (
                      <span key={reason} className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {risk.ctas.slice(0, 2).map((cta) => (
                      <Link
                        key={cta.label}
                        href={toWorkspaceHref(workspaceSlug, cta.href)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                      >
                        {cta.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Focus This Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.focusThisWeek.length === 0 ? (
              <p className="text-sm text-muted">No must-ship items for the current risk window.</p>
            ) : (
              snapshot.focusThisWeek.map((focus) => (
                <div key={focus.planId} className="rounded-xl border border-border bg-surface2 p-3">
                  <p className="mb-2 text-sm font-medium text-text">{focus.projectName}</p>
                  {focus.mustShip.length === 0 ? (
                    <p className="text-xs text-muted">No open must-ship items.</p>
                  ) : (
                    <div className="space-y-2">
                      {focus.mustShip.map((item) => (
                        <div key={item.planItemId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-2">
                          <div>
                            <p className="text-xs font-medium text-text">{item.title}</p>
                            <p className="text-[11px] text-muted">
                              {new Date(item.publishDate).toLocaleDateString("pl-PL")} • {item.channel} • {item.status}
                            </p>
                          </div>
                          {item.contentId ? (
                            <Link
                              href={`/w/${workspaceSlug}/content/${item.contentId}`}
                              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-surface px-2 text-[11px] text-text"
                            >
                              Open content
                            </Link>
                          ) : (
                            <Link
                              href={`/w/${workspaceSlug}/calendar/coverage?planId=${encodeURIComponent(focus.planId)}`}
                              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-surface px-2 text-[11px] text-text"
                            >
                              Open coverage
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Priorytety klastrów</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.clusterPriorities.slice(0, 3).length === 0 ? (
              <p className="text-sm text-muted">Brak priorytetów dla wybranego horyzontu.</p>
            ) : (
              snapshot.clusterPriorities.slice(0, 3).map((cluster) => (
                <div key={`${cluster.planId}-${cluster.clusterId}`} className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{cluster.clusterLabel}</p>
                    <Badge>{strategyTypeLabel(cluster.strategyHint.type)}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Wydajność: {performanceLabel(cluster.performanceState)} • Pokrycie: {coverageLabel(cluster.coverageState)}
                  </p>
                  <p className="mt-1 text-xs text-text">{cluster.strategyHint.message}</p>
                  <Link
                    href={`/w/${workspaceSlug}/calendar/coverage?planId=${encodeURIComponent(cluster.planId)}#${clusterAnchorId(cluster.clusterId)}`}
                    className="mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                  >
                    Otwórz pokrycie klastra
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {snapshot.recommendedActions.map((action) => (
              <div key={action.id} className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-sm font-medium text-text">{action.title}</p>
                <p className="mt-1 text-xs text-muted">{action.reason}</p>
                <p className="mt-2 text-xs text-muted">{action.impactHint}</p>
                <Link
                  href={toWorkspaceHref(workspaceSlug, action.href)}
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                >
                  Open
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
