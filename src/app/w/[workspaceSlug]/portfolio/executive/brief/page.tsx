import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function WeeklyExecutiveBriefPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");

    return (
      <AppShell
        title={`Weekly Brief: ${access.workspace.name}`}
        subtitle="Executive one-pager"
        activeHref={`/w/${access.workspace.slug}/portfolio/executive/brief`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title="Weekly Executive Brief"
          subtitle="Board-ready summary for the last 7 days."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/portfolio/executive-report"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Open Executive Board Pack
              </Link>
              <Link
                href={`/w/${access.workspace.slug}/portfolio/executive`}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-muted transition-colors hover:bg-surface2"
              >
                Back to Executive Hub
              </Link>
            </div>
          }
        />

        <p className="mb-4 text-xs uppercase tracking-wide text-muted">Reporting window: Last 7 days (rolling executive view)</p>

        <div className="grid gap-4">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text">
                <li>Health: —</li>
                <li>Risk: —</li>
                <li>ROI: —</li>
              </ul>
              <p className="mt-3 text-sm text-muted">Signals will appear once Executive Intelligence snapshot is available.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Top Wins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">Top decision wins will appear once Decision Attribution signals are available.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Top Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">Top portfolio risks will appear once Risk Matrix signals are available.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Actions for Next Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text">
                <li>Reduce drift by closing approvals backlog.</li>
                <li>Prioritize top 2 initiatives with highest ROI confidence.</li>
                <li>Review critical risk signals and assign owners.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
