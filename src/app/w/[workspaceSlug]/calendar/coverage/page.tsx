import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { generateFromPlanItem, generatePackForPlanItem } from "@/server/actions/content";
import { getPlanCoverageSnapshot, listPlans } from "@/server/queries/plans";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

function parseHorizon(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 8;
  }
  return Math.min(12, Math.max(4, Math.floor(parsed)));
}

function stateLabel(value: "healthy" | "thin" | "missing" | "drifting"): string {
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

function clusterAnchorId(clusterId: string): string {
  const normalized = clusterId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `cluster-${normalized}`;
}

export default async function CoveragePage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const resolvedSearch = await searchParams;
  const selectedPlanId = singleValue(resolvedSearch.planId);
  const horizonWeeks = parseHorizon(singleValue(resolvedSearch.horizonWeeks));

  async function generateDraftAction(formData: FormData) {
    "use server";
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const itemId = String(formData.get("itemId") ?? "");
    const targetPlanId = String(formData.get("planId") ?? "");
    const horizon = String(formData.get("horizonWeeks") ?? "8");

    const result = await generateFromPlanItem(access.workspace.id, itemId);
    if (result.ok) {
      redirect(`/w/${workspaceSlug}/content/${result.data.contentId}`);
    }

    redirect(`/w/${workspaceSlug}/calendar/coverage?planId=${encodeURIComponent(targetPlanId)}&horizonWeeks=${encodeURIComponent(horizon)}`);
  }

  async function generateItemPackAction(formData: FormData) {
    "use server";
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const itemId = String(formData.get("itemId") ?? "");
    const targetPlanId = String(formData.get("planId") ?? "");
    const horizon = String(formData.get("horizonWeeks") ?? "8");

    await generatePackForPlanItem(access.workspace.id, itemId);
    redirect(`/w/${workspaceSlug}/calendar/coverage?planId=${encodeURIComponent(targetPlanId)}&horizonWeeks=${encodeURIComponent(horizon)}`);
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const plans = await listPlans(access.workspace.id);

    const activePlanId = selectedPlanId ?? plans[0]?.id;
    const snapshot = activePlanId
      ? await getPlanCoverageSnapshot(access.workspace.id, activePlanId, { horizonWeeks })
      : null;

    const allItems = snapshot ? snapshot.weeks.flatMap((week) => week.items) : [];

    return (
      <AppShell
        title={`Pokrycie: ${access.workspace.name}`}
        subtitle="Mapa pokrycia planu"
        activeHref={`/w/${access.workspace.slug}/calendar/coverage`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title="Pokrycie planu"
          subtitle="Plan vs realizacja, luki tematów i to, co się opóźnia."
          actions={
            <div className="flex items-center gap-2">
              <Link
                href={`/w/${workspaceSlug}/calendar${activePlanId ? `?planId=${encodeURIComponent(activePlanId)}` : ""}`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
              >
                Wróć do kalendarza
              </Link>
            </div>
          }
        />

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Wybór planu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {plans.length === 0 ? (
              <p className="text-sm text-muted">Brak dostępnych planów.</p>
            ) : (
              plans.map((plan) => {
                const active = plan.id === activePlanId;
                return (
                  <Link
                    key={plan.id}
                    href={`/w/${workspaceSlug}/calendar/coverage?planId=${encodeURIComponent(plan.id)}&horizonWeeks=${horizonWeeks}`}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface2 text-text"
                    }`}
                  >
                    {plan.name} ({plan.itemsCount})
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {!snapshot ? (
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardContent className="p-6 text-sm text-muted">Wybierz plan, aby zobaczyć podgląd pokrycia.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-sm">Zaplanowane</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-2xl font-semibold">{snapshot.stats.planned}</CardContent>
              </Card>
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-sm">Opublikowane</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-2xl font-semibold">{snapshot.stats.published}</CardContent>
              </Card>
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-sm">Zaległe</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-2xl font-semibold">{snapshot.stats.overdue}</CardContent>
              </Card>
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-sm">Bez przypisania</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-2xl font-semibold">{snapshot.stats.unbound}</CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Pokrycie tygodniowe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot.weeks.map((week) => (
                  <div key={week.weekStart} className="rounded-xl border border-border bg-surface2 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text">
                        {new Date(week.weekStart).toLocaleDateString("pl-PL")} - {new Date(week.weekEnd).toLocaleDateString("pl-PL")}
                      </p>
                      <p className="text-xs text-muted">
                        Zaplanowane {week.planned} • Szkice {week.drafted} • Opublikowane {week.published} • Zaległe {week.overdue}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {week.items.map((item) => (
                        <span key={item.planItemId} className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted">
                          {item.channel} • {item.clusterLabel} • {item.status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Mapa pokrycia klastrów</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.clusters.map((cluster) => (
                  <div id={clusterAnchorId(cluster.clusterId)} key={cluster.clusterId} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-surface2 p-3">
                    <div>
                      <p className="text-sm font-medium text-text">{cluster.clusterLabel}</p>
                      <p className="text-xs text-muted">
                        Zaplanowane {cluster.plannedCount} • Wykonane {cluster.executedCount} • Opublikowane {cluster.publishedCount} • Zaległe {cluster.overdueCount}
                      </p>
                      <p className="text-xs text-muted">
                        Ocena: {cluster.avgRating != null ? `${cluster.avgRating.toFixed(1)}/5` : "—"} • Śr. wyświetlenia: {cluster.avgViews != null ? Math.round(cluster.avgViews).toLocaleString("pl-PL") : "—"}
                      </p>
                      <p className="text-xs text-muted">Słowa kluczowe: {cluster.topKeywords.join(", ") || "-"}</p>
                      <p className="text-xs text-muted">Pokrycie: {stateLabel(cluster.coverageState)}</p>

                      <div className="mt-2 rounded-lg border border-border bg-background px-2 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Rekomendacja</p>
                        <p className="mt-1 text-xs text-text">{cluster.strategyHint.message}</p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {cluster.strategyHint.type === "scale" ? (
                          <Link
                            href={`/w/${workspaceSlug}/calendar/plan?planId=${encodeURIComponent(snapshot.plan.id)}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                          >
                            Dodaj do planu
                          </Link>
                        ) : null}

                        {cluster.strategyHint.type === "fix" ? (() => {
                          const latestContent = allItems
                            .filter((item) => item.clusterId === cluster.clusterId && item.contentId)
                            .sort((left, right) => new Date(right.publishDate).getTime() - new Date(left.publishDate).getTime())[0];

                          if (!latestContent?.contentId) {
                            return null;
                          }

                          return (
                            <Link
                              href={`/w/${workspaceSlug}/content/${latestContent.contentId}`}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                            >
                              Otwórz ostatnią treść
                            </Link>
                          );
                        })() : null}

                        {cluster.strategyHint.type === "fill" ? (() => {
                          const target = allItems
                            .filter((item) => item.clusterId === cluster.clusterId)
                            .sort((left, right) => new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime())[0];

                          if (!target) {
                            return null;
                          }

                          return (
                            <form action={generateItemPackAction}>
                              <input type="hidden" name="itemId" value={target.planItemId} />
                              <input type="hidden" name="planId" value={snapshot.plan.id} />
                              <input type="hidden" name="horizonWeeks" value={horizonWeeks} />
                              <Button type="submit" size="sm" variant="ghost">Wygeneruj paczkę</Button>
                            </form>
                          );
                        })() : null}

                        {cluster.strategyHint.type === "stabilize" ? (() => {
                          const target = allItems
                            .filter((item) => item.clusterId === cluster.clusterId)
                            .sort((left, right) => new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime())[0];

                          if (!target) {
                            return null;
                          }

                          return (
                            <form action={generateDraftAction}>
                              <input type="hidden" name="itemId" value={target.planItemId} />
                              <input type="hidden" name="planId" value={snapshot.plan.id} />
                              <input type="hidden" name="horizonWeeks" value={horizonWeeks} />
                              <Button type="submit" size="sm" variant="secondary">Wygeneruj szkic</Button>
                            </form>
                          );
                        })() : null}
                      </div>
                    </div>
                    <Badge>{performanceLabel(cluster.performanceState)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Największe luki</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.gaps.length === 0 ? (
                  <p className="text-sm text-muted">Brak krytycznych luk dla wybranego zakresu.</p>
                ) : (
                  snapshot.gaps.map((gap) => (
                    <div key={gap.planItemId} className="rounded-xl border border-border bg-surface2 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-text">{gap.title}</p>
                        <Badge>{gap.reason}</Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {new Date(gap.publishDate).toLocaleDateString("pl-PL")} • {gap.clusterLabel}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={generateDraftAction}>
                          <input type="hidden" name="itemId" value={gap.planItemId} />
                          <input type="hidden" name="planId" value={snapshot.plan.id} />
                          <input type="hidden" name="horizonWeeks" value={horizonWeeks} />
                          <Button type="submit" size="sm" variant="secondary">Generuj szkic</Button>
                        </form>
                        <form action={generateItemPackAction}>
                          <input type="hidden" name="itemId" value={gap.planItemId} />
                          <input type="hidden" name="planId" value={snapshot.plan.id} />
                          <input type="hidden" name="horizonWeeks" value={horizonWeeks} />
                          <Button type="submit" size="sm" variant="ghost">Generuj pakiet</Button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </AppShell>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
