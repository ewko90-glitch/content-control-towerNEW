import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { updateProjectContext } from "@/server/actions/projects";
import { getProject } from "@/server/queries/projects";
import { defaultProjectContext } from "@/modules/projects/defaults";
import { computeReadiness } from "@/modules/projects/validators";
import type { ChannelType } from "@/modules/projects/types";

type PageProps = {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const channels: ChannelType[] = ["linkedin", "blog", "newsletter", "landing"];

function payloadFromFormData(formData: FormData) {
  const channelsSelected = formData
    .getAll("channels")
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => channels.includes(item as ChannelType));

  const internalLinks = [0, 1, 2].map((index) => ({
    url: String(formData.get(`internalUrl${index}`) ?? "").trim(),
    title: String(formData.get(`internalTitle${index}`) ?? "").trim(),
    note: String(formData.get(`internalNote${index}`) ?? "").trim(),
    anchorHints: String(formData.get(`internalAnchors${index}`) ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  }));

  const externalLinks = [0, 1].map((index) => ({
    url: String(formData.get(`externalUrl${index}`) ?? "").trim(),
    title: String(formData.get(`externalTitle${index}`) ?? "").trim(),
    note: String(formData.get(`externalNote${index}`) ?? "").trim(),
  }));

  return {
    name: String(formData.get("name") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    audience: String(formData.get("audience") ?? "").trim(),
    toneOfVoice: String(formData.get("toneOfVoice") ?? "").trim(),
    goals: String(formData.get("goals") ?? "").trim(),
    channels: channelsSelected.join(","),
    keywordsPrimary: String(formData.get("keywordsPrimary") ?? "").trim(),
    keywordsSecondary: String(formData.get("keywordsSecondary") ?? "").trim(),
    internalLinks,
    externalLinks,
  };
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { workspaceSlug, projectId } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const project = await getProject(projectId, access.workspace.id);

    if (!project) {
      notFound();
    }

    const projectUnsafe = project as Record<string, unknown>;
    const projectContext = (projectUnsafe.context as Record<string, unknown> | undefined) ?? undefined;

    const context = {
      summary: String(projectContext?.summary ?? defaultProjectContext.summary),
      audience: String(projectContext?.audience ?? defaultProjectContext.audience),
      toneOfVoice: String(projectContext?.toneOfVoice ?? defaultProjectContext.toneOfVoice),
      goals: String(projectContext?.goals ?? defaultProjectContext.goals),
      channels: (projectContext?.channels as ChannelType[] | null) ?? defaultProjectContext.channels,
      keywordsPrimary: (projectContext?.keywordsPrimary as string[] | null) ?? defaultProjectContext.keywordsPrimary,
      keywordsSecondary: (projectContext?.keywordsSecondary as string[] | null) ?? defaultProjectContext.keywordsSecondary,
      internalLinks: (projectContext?.internalLinks as typeof defaultProjectContext.internalLinks | null) ?? defaultProjectContext.internalLinks,
      externalLinks: (projectContext?.externalLinks as typeof defaultProjectContext.externalLinks | null) ?? defaultProjectContext.externalLinks,
    };

    const readiness = computeReadiness({
      name: String(projectUnsafe.name ?? ""),
      ...context,
    });

    async function updateAction(formData: FormData) {
      "use server";

      const accessInner = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
      const payload = payloadFromFormData(formData);
      const result = await updateProjectContext(projectId, accessInner.workspace.id, payload);

      if (result.ok) {
        revalidatePath(`/w/${workspaceSlug}/projects`);
        revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
        redirect(`/w/${workspaceSlug}/projects/${projectId}?saved=1`);
      }

      redirect(`/w/${workspaceSlug}/projects/${projectId}?error=validation`);
    }

    return (
      <AppShell
        title={`Project: ${String(projectUnsafe.name ?? "Project")}`}
        subtitle="Project Context Engine"
        activeHref={`/w/${access.workspace.slug}/projects/${String(projectUnsafe.id ?? projectId)}`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title={String(projectUnsafe.name ?? "Project")}
          subtitle="Edit strategic context and content readiness"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="status">Readiness {readiness.score}/100</Badge>
              <Badge variant="status">{readiness.state === "ready" ? "Ready" : "Incomplete"}</Badge>
              <Link href={`/w/${access.workspace.slug}/projects`}>
                <Button variant="ghost">Back to Projects</Button>
              </Link>
            </div>
          }
        />

        {resolvedSearchParams.saved ? <Alert variant="info">Project context saved.</Alert> : null}
        {resolvedSearchParams.error ? <Alert variant="warning">Please complete missing required fields and save again.</Alert> : null}

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Content Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {readiness.state === "ready" ? (
              <p className="text-sm text-success">Ready for Content</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {readiness.missing.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <span className="font-medium text-text">{item.label}:</span> {item.fixHint}
                  </li>
                ))}
              </ul>
            )}

            <details className="rounded-xl border border-border bg-surface2 p-3">
              <summary className="cursor-pointer text-sm font-medium text-text">Show full missing checklist</summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {readiness.missing.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium text-text">{item.label}:</span> {item.fixHint}
                  </li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>

        <form action={updateAction} className="space-y-4">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Strategy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input name="name" label="Project name" defaultValue={String(projectUnsafe.name ?? "")} required />
              <label className="text-sm font-medium text-text" htmlFor="summary">Summary</label>
              <textarea id="summary" name="summary" defaultValue={context.summary} className="min-h-28 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
              <label className="text-sm font-medium text-text" htmlFor="audience">Audience</label>
              <textarea id="audience" name="audience" defaultValue={context.audience} className="min-h-24 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
              <Input name="toneOfVoice" label="Tone of voice" defaultValue={context.toneOfVoice} />
              <label className="text-sm font-medium text-text" htmlFor="goals">Goals</label>
              <textarea id="goals" name="goals" defaultValue={context.goals} className="min-h-24 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input name="keywordsPrimary" label="Primary keywords" defaultValue={context.keywordsPrimary.join(", ")} hint="Comma-separated, minimum 5" />
              <Input name="keywordsSecondary" label="Secondary keywords" defaultValue={context.keywordsSecondary.join(", ")} hint="Comma-separated, minimum 3 recommended" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Linking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-text">Internal links</p>
                {[0, 1, 2].map((index) => {
                  const row = context.internalLinks[index] ?? { url: "", title: "", note: "", anchorHints: [] };
                  return (
                    <div key={`internal-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface2 p-3 md:grid-cols-2">
                      <Input name={`internalUrl${index}`} label="URL" defaultValue={row.url} />
                      <Input name={`internalTitle${index}`} label="Title" defaultValue={row.title} />
                      <Input name={`internalNote${index}`} label="Note" defaultValue={row.note ?? ""} />
                      <Input name={`internalAnchors${index}`} label="Anchor hints" defaultValue={row.anchorHints.join(", ")} />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-text">External links</p>
                {[0, 1].map((index) => {
                  const row = context.externalLinks[index] ?? { url: "", title: "", note: "" };
                  return (
                    <div key={`external-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface2 p-3 md:grid-cols-2">
                      <Input name={`externalUrl${index}`} label="URL" defaultValue={row.url} />
                      <Input name={`externalTitle${index}`} label="Title" defaultValue={row.title} />
                      <Input name={`externalNote${index}`} label="Note" defaultValue={row.note ?? ""} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {channels.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-text">
                    <input type="checkbox" name="channels" value={channel} defaultChecked={context.channels.includes(channel)} />
                    <span className="capitalize">{channel}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button type="submit">Save changes</Button>
            <Link href={`/w/${access.workspace.slug}/projects`}>
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
