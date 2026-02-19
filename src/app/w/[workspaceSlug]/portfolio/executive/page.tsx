import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ExecutiveHubPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");

    return (
      <AppShell
        title={`Executive Hub: ${access.workspace.name}`}
        subtitle="Board-ready strategic intelligence"
        activeHref={`/w/${access.workspace.slug}/portfolio/executive`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title="Executive Hub"
          subtitle="Board-ready intelligence in one place."
          actions={
            <Link
              href="/portfolio/executive-report"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Open Executive Board Pack
            </Link>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/w/${access.workspace.slug}/portfolio/executive`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-primary/30 bg-primarySoft px-3 text-xs font-medium text-text"
          >
            Executive Hub
          </Link>
          <Link
            href="/portfolio/executive-report"
            className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-surface2"
          >
            Board Pack
          </Link>
          <Link
            href={`/w/${access.workspace.slug}/portfolio/executive/brief`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-surface2"
          >
            Weekly Brief
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Executive Board Pack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">Open the board pack, export PDF, and run diagnostics from one place.</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/portfolio/executive-report"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                >
                  Open HTML Preview
                </Link>
                <Link
                  href="/portfolio/executive-report"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-muted transition-colors hover:bg-surface2"
                >
                  Download PDF
                </Link>
                <Link
                  href="/portfolio/executive-report/probe"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-muted transition-colors hover:bg-surface2"
                >
                  Run Probe (diagnostic)
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Key Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">Signals will appear here once Executive Intelligence snapshot is available.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Accountability & Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">Available from Accountability Overview and Audit Trail sections.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Weekly Executive Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">A one-page board memo for the last 7 days.</p>
              <Link
                href={`/w/${access.workspace.slug}/portfolio/executive/brief`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Open Brief
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
