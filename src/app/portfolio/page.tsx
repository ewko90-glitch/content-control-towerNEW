import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { buildExecutiveReport } from "@/modules/controlTowerV3/boardPackUltra/engine";
import { renderExecutiveReportHtml } from "@/modules/controlTowerV3/boardPackUltra/render";
import { buildPortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/portfolio";
import { portfolioCopy } from "@/modules/controlTowerV3/portfolio/copy";
import type { PortfolioRow } from "@/modules/controlTowerV3/portfolio/types";
import { buildWorkspaceControlTowerSnapshot } from "@/modules/controlTowerV3";
import { cn } from "@/styles/cn";

type PortfolioFilter = "all" | "critical" | "drifting" | "strong" | "misalignment" | "no_plan";

type PortfolioPageProps = {
  searchParams?: Promise<{ filter?: string | string[] | undefined; preview?: string | string[] | undefined }>;
};

function normalizeFilter(value: string | string[] | undefined): PortfolioFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "critical" || raw === "drifting" || raw === "strong" || raw === "misalignment" || raw === "no_plan") {
    return raw;
  }
  return "all";
}

function scoreTone(score: number): string {
  if (score >= 80) {
    return "text-success";
  }
  if (score >= 60) {
    return "text-warning";
  }
  return "text-danger";
}

function filterRows(rows: PortfolioRow[], filter: PortfolioFilter): PortfolioRow[] {
  if (filter === "critical") {
    return rows.filter((row) => row.healthBand === "critical");
  }
  if (filter === "drifting") {
    return rows.filter((row) => row.driftDetected);
  }
  if (filter === "strong") {
    return rows.filter((row) => row.healthBand === "strong");
  }
  if (filter === "misalignment") {
    return rows.filter((row) => row.risks.some((risk) => risk.code === "misalignment"));
  }
  if (filter === "no_plan") {
    return rows.filter((row) => row.risks.some((risk) => risk.code === "no_weekly_plan"));
  }
  return rows;
}

function riskTone(severity: "low" | "medium" | "high"): string {
  if (severity === "high") {
    return "bg-danger/20 text-danger border-border";
  }
  if (severity === "medium") {
    return "bg-warning/20 text-warning border-border";
  }
  return "bg-surface2 text-muted border-border";
}

function normalizePreview(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1";
}

function portfolioHref(filter: PortfolioFilter, preview: boolean): string {
  const params = new URLSearchParams();
  if (filter !== "all") {
    params.set("filter", filter);
  }
  if (preview) {
    params.set("preview", "1");
  }
  const query = params.toString();
  return query.length > 0 ? `/portfolio?${query}` : "/portfolio";
}

// TODO: import from src/lib/workspaces.ts is missing (expected helper to load current user workspaces).
const fallbackWorkspaces = [
  { id: "demo", slug: "demo", name: "Demo Workspace" },
];

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const activeFilter = normalizeFilter(resolvedSearchParams?.filter);
  const isPreviewMode = normalizePreview(resolvedSearchParams?.preview);
  const nowIso = new Date().toISOString();

  const snapshot = await buildPortfolioSnapshot({
    nowIso,
    workspaces: fallbackWorkspaces,
    loadWorkspaceSnapshot: async (workspaceId) =>
      buildWorkspaceControlTowerSnapshot({
        workspaceId,
        nowIso,
      }),
  });

  const rows = filterRows(snapshot.rows, activeFilter);

  const executiveReportModel = isPreviewMode
    ? await buildExecutiveReport({
        nowIso,
        filter: activeFilter,
        workspaces: fallbackWorkspaces,
        loadPortfolioSnapshot: async ({ nowIso: effectiveNowIso, workspaces }) =>
          buildPortfolioSnapshot({
            nowIso: effectiveNowIso,
            workspaces,
            loadWorkspaceSnapshot: async (workspaceId) =>
              buildWorkspaceControlTowerSnapshot({
                workspaceId,
                nowIso: effectiveNowIso,
              }),
          }),
        loadWorkspaceSnapshot: async (workspaceId, effectiveNowIso) =>
          buildWorkspaceControlTowerSnapshot({
            workspaceId,
            nowIso: effectiveNowIso,
          }),
      })
    : null;

  const previewModel =
    isPreviewMode && executiveReportModel
      ? fallbackWorkspaces.length > 10
        ? (() => {
            const topWorkspaceIds = executiveReportModel.structuralAnalysis.rankingMatrix.slice(0, 5).map((row) => row.workspaceId);
            const briefsById = new Map(executiveReportModel.workspaceBriefs.map((brief) => [brief.workspaceId, brief]));
            return {
              ...executiveReportModel,
              workspaceBriefs: topWorkspaceIds.map((workspaceId) => briefsById.get(workspaceId)).filter((item) => item != null),
            };
          })()
        : executiveReportModel
      : null;

  const previewHtml = previewModel ? renderExecutiveReportHtml(previewModel) : null;
  const pdfExportHref = `/portfolio/executive-report?filter=${activeFilter}`;

  return (
    <AppShell title="Portfolio" subtitle="Cross-workspace executive intelligence" activeHref="/overview">
      <div id="top" />
      <PageHeader
        title={portfolioCopy.title}
        subtitle={portfolioCopy.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={portfolioHref(activeFilter, true)}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-bg px-3 text-sm font-medium text-text transition-all duration-normal ease-base hover:-translate-y-0.5 hover:bg-surface2 hover:shadow-sm"
            >
              Preview report
            </Link>
            <Link
              href={pdfExportHref}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-secondary/40 bg-secondarySoft px-3 text-sm font-medium text-text transition-all duration-normal ease-base hover:-translate-y-0.5 hover:bg-secondarySoft/80 hover:shadow-sm"
            >
              {portfolioCopy.labels.export}
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{snapshot.summary.headline}</CardTitle>
          <p className="text-sm text-muted">Generated at {snapshot.generatedAtIso}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-xs text-muted">{portfolioCopy.labels.total}</p>
              <p className="text-xl font-semibold text-text">{snapshot.summary.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-xs text-muted">{portfolioCopy.labels.critical}</p>
              <p className="text-xl font-semibold text-danger">{snapshot.summary.critical}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-xs text-muted">{portfolioCopy.labels.drifting}</p>
              <p className="text-xl font-semibold text-warning">{snapshot.summary.drifting}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-xs text-muted">{portfolioCopy.labels.strong}</p>
              <p className="text-xl font-semibold text-success">{snapshot.summary.strong}</p>
            </div>
          </div>

          {snapshot.summary.notes.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {snapshot.summary.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{portfolioCopy.labels.ranking}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Link href={portfolioHref("all", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "all" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.all}</Link>
            <Link href={portfolioHref("critical", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "critical" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.critical}</Link>
            <Link href={portfolioHref("drifting", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "drifting" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.drifting}</Link>
            <Link href={portfolioHref("strong", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "strong" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.strong}</Link>
            <Link href={portfolioHref("misalignment", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "misalignment" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.misalignment}</Link>
            <Link href={portfolioHref("no_plan", isPreviewMode)} className={cn("rounded-full border border-border px-3 py-1 text-xs", activeFilter === "no_plan" ? "bg-primarySoft text-primary" : "text-muted")}>{portfolioCopy.filters.noPlan}</Link>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{portfolioCopy.empty.rows}</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.workspaceId} className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{row.workspaceName}</p>
                      <p className="text-xs text-muted">/{row.workspaceSlug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="status" className="bg-bg border-border text-text">{row.healthBand}</Badge>
                      <Badge variant="status" className="bg-bg border-border text-text">momentum: {row.momentumBand}</Badge>
                      {row.driftDetected ? <Badge variant="status" className="bg-danger/20 text-danger border-border">drift</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                    <p className={cn("rounded-lg border border-border bg-bg px-2 py-1", scoreTone(row.healthScore))}>Health: {row.healthScore}</p>
                    <p className={cn("rounded-lg border border-border bg-bg px-2 py-1", scoreTone(row.strategicAlignmentScore))}>Alignment: {row.strategicAlignmentScore}</p>
                    <p className="rounded-lg border border-border bg-bg px-2 py-1 text-muted">Momentum 7d: {row.momentum7d}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.risks.map((risk) => (
                      <Badge key={`${row.workspaceId}-${risk.code}`} variant="status" className={riskTone(risk.severity)}>
                        {risk.label}
                      </Badge>
                    ))}
                  </div>

                  {row.topMoves.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {row.topMoves.map((move) => (
                        <li key={`${row.workspaceId}-${move.kind}-${move.title}`}>• {move.kind}: {move.title}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3">
                    <Link className="text-sm text-primary hover:underline" href={`/w/${row.workspaceSlug}/overview`}>
                      Open workspace overview
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{portfolioCopy.labels.insights}</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.insights.length === 0 ? (
              <p className="text-sm text-muted">{portfolioCopy.empty.insights}</p>
            ) : (
              <ul className="space-y-3">
                {snapshot.insights.map((insight) => (
                  <li key={insight.id} className="rounded-xl border border-border bg-surface2 p-3">
                    <p className="text-sm font-semibold text-text">{insight.title}</p>
                    <p className="mt-1 text-xs text-muted">{insight.narrative}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">Severity: {insight.severity}</p>
                    <p className="mt-1 text-xs text-muted">Affected: {insight.affectedWorkspaces.map((item) => item.name).join(", ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{portfolioCopy.labels.playbook}</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.insights.length > 0 ? (
              <div className="space-y-3">
                {snapshot.insights.slice(0, 2).map((insight) => (
                  <div key={`${insight.id}-play`} className="rounded-xl border border-border bg-surface2 p-3">
                    <p className="text-sm font-semibold text-text">{insight.recommendedPlay.title}</p>
                    <ol className="mt-2 space-y-1 text-xs text-muted">
                      {insight.recommendedPlay.steps.map((step) => (
                        <li key={`${insight.id}-${step}`}>• {step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{portfolioCopy.empty.insights}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isPreviewMode && previewHtml ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Executive Report Preview</CardTitle>
            <p className="text-sm text-muted">Preview shows the same narrative as PDF. PDF includes up to 25 workspaces.</p>
            <div className="sticky top-2 z-10 -mx-1 rounded-xl border border-border bg-surface/95 px-2 py-1.5 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <a href="#summary" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Summary</a>
                <a href="#portfolio" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Portfolio</a>
                <a href="#patterns" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Patterns</a>
                <a href="#plays" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Plays</a>
                <a href="#workspaces" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Workspaces</a>
                <a href="#top" className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted hover:text-text">Jump to top</a>
              </div>
            </div>
            <p className="text-xs text-muted">Tip: Use browser print preview for a paginated view.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={portfolioHref(activeFilter, false)} className="text-sm text-primary hover:underline">
                Close preview
              </Link>
              <span className="text-xs text-muted">•</span>
              <Link href={pdfExportHref} className="text-sm text-primary hover:underline">
                Open PDF export
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {fallbackWorkspaces.length > 10 ? (
              <p className="mb-3 text-xs text-muted">Preview shows top 5; PDF includes up to 25.</p>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-border bg-surface2/40 p-2 md:p-4">
              <div className="max-w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-6 text-xs text-muted">Workspace list uses dev fallback only until the shared workspace helper is available in allowed scope.</p>
    </AppShell>
  );
}
