import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { uiCopy } from "@/lib/uiCopy";
import { listProjects } from "@/server/queries/projects";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

const t = uiCopy.pl;

function formatIsoDate(iso: string): string {
  if (!Number.isFinite(Date.parse(iso))) {
    return "—";
  }
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function polishMissingHint(value: string): string {
  const lowered = value.toLowerCase();
  if (lowered.includes("summary")) {
    return "Brakuje podsumowania projektu";
  }
  if (lowered.includes("audience")) {
    return "Brakuje opisu grupy odbiorców";
  }
  if (lowered.includes("tone")) {
    return "Brakuje tonu komunikacji";
  }
  if (lowered.includes("goal")) {
    return "Brakuje celów projektu";
  }
  if (lowered.includes("keyword")) {
    return "Brakuje słów kluczowych";
  }
  if (lowered.includes("internal")) {
    return "Brakuje linkowania wewnętrznego";
  }
  if (lowered.includes("external")) {
    return "Brakuje linkowania zewnętrznego";
  }
  return `Uzupełnij: ${value}`;
}

export default async function ProjectsPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const projects = await listProjects(access.workspace.id);

    return (
      <AppShell
        title={t.projectsProduct.title}
        subtitle={t.projectsProduct.subtitle}
        activeHref={`/w/${access.workspace.slug}/projects`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title={t.projectsProduct.title}
          subtitle={t.projectsProduct.subtitle}
          actions={
            <Link href={`/w/${access.workspace.slug}/projects/new`}>
              <Button>{t.projectsProduct.createProject}</Button>
            </Link>
          }
        />

        {projects.length === 0 ? (
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.projectsProduct.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">
                {t.projectsProduct.noProjects}
              </p>
              <Link href={`/w/${access.workspace.slug}/projects/new`}>
                <Button>{t.projectsProduct.createProject}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>{t.projectsProduct.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projects.map((project) => (
                  <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface2 px-4 py-3">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-text">{project.name}</p>
                      <p className="text-xs text-muted">Aktualizacja: {formatIsoDate(project.updatedAt)}</p>
                      {project.readinessState !== "ready" ? (
                        <p className="text-xs text-muted">{polishMissingHint(project.missingFields[0] ?? "brak danych")}</p>
                      ) : (
                        <p className="text-xs text-muted">Projekt gotowy do pracy z treściami.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="status">{project.status === "active" ? t.projectsProduct.active : "Archiwalny"}</Badge>
                      <Badge variant="status">{project.readinessState === "ready" ? t.projectsProduct.contextReady : t.projectsProduct.contextToComplete}</Badge>
                      <Badge variant="status">Gotowość {project.readinessScore}/100</Badge>

                      <Link
                        href={`/w/${access.workspace.slug}/settings/project?projectId=${encodeURIComponent(project.id)}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                      >
                        {t.projectsProduct.openProjectSettings}
                      </Link>
                      <Link
                        href={`/w/${access.workspace.slug}/content?projectId=${encodeURIComponent(project.id)}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
                      >
                        {t.projectsProduct.setAsActive}
                      </Link>
                    </div>
                  </div>
                ))}
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
