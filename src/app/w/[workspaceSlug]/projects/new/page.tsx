import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { createProject } from "@/server/actions/projects";
import { defaultProjectContext, getTemplateById, projectTemplates } from "@/modules/projects/defaults";
import { computeReadiness } from "@/modules/projects/validators";
import type { ChannelType } from "@/modules/projects/types";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ template?: string; error?: string }>;
};

const channels: ChannelType[] = ["linkedin", "blog", "newsletter", "landing"];

function formPayloadFromData(formData: FormData) {
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

export default async function NewProjectPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const template = getTemplateById(resolvedSearchParams.template);
    const context = template?.context ?? defaultProjectContext;

    const readiness = computeReadiness({
      name: "",
      summary: context.summary,
      audience: context.audience,
      toneOfVoice: context.toneOfVoice,
      goals: context.goals,
      channels: context.channels,
      keywordsPrimary: context.keywordsPrimary,
      keywordsSecondary: context.keywordsSecondary,
      internalLinks: context.internalLinks,
      externalLinks: context.externalLinks,
    });

    async function createProjectAction(formData: FormData) {
      "use server";

      const accessInner = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
      const payload = formPayloadFromData(formData);
      const result = await createProject(accessInner.workspace.id, payload);

      if (result.ok) {
        revalidatePath(`/w/${workspaceSlug}/projects`);
        redirect(`/w/${workspaceSlug}/projects/${result.projectId}`);
      }

      const templatePart = typeof resolvedSearchParams.template === "string" ? `&template=${encodeURIComponent(resolvedSearchParams.template)}` : "";
      redirect(`/w/${workspaceSlug}/projects/new?error=validation${templatePart}`);
    }

    return (
      <AppShell
        title="Nowy projekt"
        subtitle="Skonfiguruj markę raz — AI będzie pamiętać kontekst"
        activeHref={`/w/${access.workspace.slug}/projects/new`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title="Nowy projekt"
          subtitle="Wypełnij raz — AI zawsze będzie wiedzieć dla kogo i jak pisać"
          actions={
            <Link href={`/w/${access.workspace.slug}/projects`}>
              <Button variant="ghost">Wróć do projektów</Button>
            </Link>
          }
        />

        {resolvedSearchParams.error ? <Alert variant="warning">Uzupełnij brakujące pola i spróbuj ponownie.</Alert> : null}

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Gotowość projektu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-text">Wynik: {readiness.score}/100 • Stan: {readiness.state === "ready" ? "Gotowy" : "Niekompletny"}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {readiness.missing.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-text">{item.label}:</span> {item.fixHint}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Szablony</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {projectTemplates.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-surface2 p-3">
                <p className="font-medium text-text">{entry.label}</p>
                <p className="mt-1 text-sm text-muted">{entry.description}</p>
                <Link href={`/w/${access.workspace.slug}/projects/new?template=${entry.id}`} className="mt-3 inline-flex text-sm text-primary hover:underline">
                  Zastosuj szablon
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <form action={createProjectAction} className="space-y-4">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Strategia marki</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input name="name" label="Nazwa projektu / marki" required placeholder="np. Neurosnax" />
              <label className="text-sm font-medium text-text" htmlFor="summary">Opis marki <span className="font-normal text-muted">(co robi, czym się zajmuje)</span></label>
              <textarea id="summary" name="summary" defaultValue={context.summary} className="min-h-28 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
              <label className="text-sm font-medium text-text" htmlFor="audience">Grupa docelowa <span className="font-normal text-muted">(kto to czyta, wiek, rola, potrzeby)</span></label>
              <textarea id="audience" name="audience" defaultValue={context.audience} className="min-h-24 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
              <Input name="toneOfVoice" label="Ton komunikacji" defaultValue={context.toneOfVoice} placeholder="np. ekspercki, przyjazny, bezpośredni" />
              <label className="text-sm font-medium text-text" htmlFor="goals">Cele contentu <span className="font-normal text-muted">(co chcesz osiągnąć publikując)</span></label>
              <textarea id="goals" name="goals" defaultValue={context.goals} className="min-h-24 rounded-xl border border-border bg-surface2 p-3 text-sm text-text" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Słowa kluczowe</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                name="keywordsPrimary"
                label="Główne słowa kluczowe"
                defaultValue={context.keywordsPrimary.join(", ")}
                hint="Oddziel przecinkami, minimum 5"
              />
              <Input
                name="keywordsSecondary"
                label="Dodatkowe słowa kluczowe"
                defaultValue={context.keywordsSecondary.join(", ")}
                hint="Oddziel przecinkami, minimum 3"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Linkowania</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-text">Linki wewnętrzne (Twoje strony)</p>
                {[0, 1, 2].map((index) => {
                  const row = context.internalLinks[index] ?? { url: "", title: "", note: "", anchorHints: [] };
                  return (
                    <div key={`internal-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface2 p-3 md:grid-cols-2">
                      <Input name={`internalUrl${index}`} label="URL" defaultValue={row.url} />
                      <Input name={`internalTitle${index}`} label="Nazwa" defaultValue={row.title} />
                      <Input name={`internalNote${index}`} label="Notatka" defaultValue={row.note ?? ""} />
                      <Input
                        name={`internalAnchors${index}`}
                        label="Słowa kotwicy (po przecinku)"
                        defaultValue={row.anchorHints.join(", ")}
                        hint="np. suplementy, sen, melatonina"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-text">Linki zewnętrzne (autorytety)</p>
                {[0, 1].map((index) => {
                  const row = context.externalLinks[index] ?? { url: "", title: "", note: "" };
                  return (
                    <div key={`external-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface2 p-3 md:grid-cols-2">
                      <Input name={`externalUrl${index}`} label="URL" defaultValue={row.url} />
                      <Input name={`externalTitle${index}`} label="Nazwa" defaultValue={row.title} />
                      <Input name={`externalNote${index}`} label="Notatka" defaultValue={row.note ?? ""} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Kanały publikacji</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {channels.map((channel) => {
                  const channelLabel: Record<string, string> = {
                    linkedin: "LinkedIn",
                    blog: "Blog / WordPress",
                    newsletter: "Newsletter",
                    landing: "Landing page",
                  };
                  return (
                    <label key={channel} className="flex items-center gap-2 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-text">
                      <input type="checkbox" name="channels" value={channel} defaultChecked={context.channels.includes(channel)} />
                      <span>{channelLabel[channel] ?? channel}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button type="submit">Utwórz projekt</Button>
            <Link href={`/w/${access.workspace.slug}/projects`}>
              <Button type="button" variant="ghost">Anuluj</Button>
            </Link>
          </div>
        </form>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
