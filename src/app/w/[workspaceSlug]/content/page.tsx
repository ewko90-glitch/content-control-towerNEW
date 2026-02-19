import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import {
  canPublishPublication,
  canUseAi,
  consumeAi,
  ensurePolicies,
  getProjectPolicies,
  getUsage,
  requestApproval,
  type UsageBlockReason,
} from "@/lib/projectStore";
import { uiCopy } from "@/lib/uiCopy";
import { createContentItem } from "@/server/actions/content";
import { listContentItems } from "@/server/queries/content";
import { getActiveProjectForEmployee, listProjects } from "@/server/queries/projects";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const t = uiCopy.pl;

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function reasonLabel(reason?: UsageBlockReason): string {
  if (!reason) {
    return t.limits.noBlock;
  }
  if (reason === "AI_DISABLED_BY_POLICY") {
    return t.limits.aiDisabledByPolicy;
  }
  if (reason === "AI_MONTHLY_LIMIT_REACHED") {
    return t.limits.reachedAiMonthly;
  }
  if (reason === "PDF_MONTHLY_LIMIT_REACHED") {
    return t.limits.reachedPdfMonthly;
  }
  return t.limits.pdfNotInPlan;
}

function channelLabel(channel: string): string {
  if (channel === "linkedin") {
    return "LinkedIn";
  }
  if (channel === "blog") {
    return "Blog";
  }
  if (channel === "newsletter") {
    return "Newsletter";
  }
  if (channel === "landing") {
    return "Landing page";
  }
  return channel;
}

export default async function WriteNowPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const search = await searchParams;

  const selectedChannel = ["linkedin", "blog", "newsletter", "landing"].includes(toValue(search.channel))
    ? toValue(search.channel)
    : "linkedin";
  const selectedDate = toValue(search.date);
  const infoMessage = toValue(search.info);

  async function createDraftAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const intent = String(formData.get("intent") ?? "manual");
    const projectId = String(formData.get("projectId") ?? "");

    if (intent !== "manual") {
      const aiCheck = consumeAi(access.workspace.id, `write-now-${intent}`);
      if (!aiCheck.ok) {
        redirect(`/w/${workspaceSlug}/content?info=${encodeURIComponent(`${t.write.aiBlocked}: ${reasonLabel(aiCheck.reason)}`)}`);
      }
    }

    const result = await createContentItem(access.workspace.id, {
      projectId,
      channel: String(formData.get("channel") ?? "linkedin") as "linkedin" | "blog" | "newsletter" | "landing",
      title: String(formData.get("title") ?? ""),
      goal: String(formData.get("goal") ?? ""),
      angle: String(formData.get("angle") ?? ""),
    });

    if (!result.ok) {
      redirect(`/w/${workspaceSlug}/content?info=${encodeURIComponent(result.error.message)}`);
    }

    redirect(`/w/${workspaceSlug}/content/${result.data.contentId}`);
  }

  async function requestApprovalAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const publicationId = String(formData.get("publicationId") ?? "");
    if (publicationId) {
      requestApproval(access.workspace.id, publicationId, "write-now-ui");
    }
    redirect(`/w/${workspaceSlug}/content?info=${encodeURIComponent(t.content.sentForApproval)}`);
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const [projects, items, activeProject] = await Promise.all([
      listProjects(access.workspace.id),
      listContentItems(access.workspace.id),
      getActiveProjectForEmployee(access.workspace.id, toValue(search.projectId) || undefined),
    ]);

    const selectedProjectId = activeProject?.project.id ?? projects[0]?.id ?? "";
    const aiGuard = canUseAi(access.workspace.id);
    const usage = getUsage(access.workspace.id);
    const policies = activeProject
      ? getProjectPolicies(access.workspace.id, ensurePolicies(activeProject.project))
      : getProjectPolicies(access.workspace.id);

    const drafts = items.filter((item) => item.status === "draft" || item.status === "review" || item.status === "approved" || item.status === "scheduled").slice(0, 6);

    const hashtags = activeProject?.context.keywordsPrimary.slice(0, 6).map((keyword) => `#${keyword.replace(/\s+/g, "")}`) ?? [];

    return (
      <AppShell
        title={t.write.title}
        subtitle={t.write.subtitle}
        activeHref={`/w/${access.workspace.slug}/content`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader title={t.write.title} subtitle={t.write.subtitle} />

        {infoMessage ? <p className="mb-4 rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">{infoMessage}</p> : null}

        {!aiGuard.ok ? (
          <div className="mb-4 rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">
            <p>{reasonLabel(aiGuard.reason)} ({usage.aiThisMonth}/{aiGuard.limit})</p>
            <Link href={`/w/${workspaceSlug}/settings/project#plan-i-limity`} className="mt-2 inline-flex text-xs text-text underline">
              {t.limits.upgradePlan}
            </Link>
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: "linkedin", label: "LinkedIn" },
            { key: "blog", label: "Blog" },
            { key: "newsletter", label: "Newsletter" },
            { key: "landing", label: "Landing page" },
          ].map((channel) => (
            <Link
              key={channel.key}
              href={`/w/${workspaceSlug}/content?channel=${channel.key}${selectedDate ? `&date=${encodeURIComponent(selectedDate)}` : ""}`}
              className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium ${selectedChannel === channel.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface2 text-text"}`}
            >
              {channel.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader><CardTitle>{t.write.editor}</CardTitle></CardHeader>
              <CardContent>
                <form action={createDraftAction} className="space-y-3">
                  <input type="hidden" name="channel" value={selectedChannel} />
                  <input type="hidden" name="projectId" value={selectedProjectId} />

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted">Temat posta</p>
                    <Input name="title" required placeholder="np. 3 błędy które niszczą Twój sen" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted">Słowa kluczowe</p>
                    <Input name="goal" placeholder={t.write.keywordsHint} defaultValue={activeProject?.context.keywordsPrimary.slice(0, 4).join(", ") ?? ""} />
                    <p className="text-xs text-muted">Słowa kluczowe AI użyje w treści</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted">Treść / notatki</p>
                    <textarea name="angle" placeholder="Wpisz wstępne myśli, punkty do poruszenia lub zostaw puste — AI wygeneruje od zera" className="min-h-[220px] w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-text" />
                    <p className="text-xs text-muted">Liczba znaków: 0</p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Input placeholder="Link wewnętrzny (Twoja strona)" />
                    <Input placeholder="Link zewnętrzny (autorytet, źródło)" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="intent" value="full" disabled={!aiGuard.ok}>Generuj cały post</Button>
                    <Button type="submit" name="intent" value="intro" variant="secondary" disabled={!aiGuard.ok}>Napisz wstęp</Button>
                    <Button type="submit" name="intent" value="cta" variant="secondary" disabled={!aiGuard.ok}>Zaproponuj CTA</Button>
                    <Button type="submit" name="intent" value="short" variant="ghost" disabled={!aiGuard.ok}>Skróć</Button>
                    <Button type="submit" name="intent" value="tone" variant="ghost" disabled={!aiGuard.ok}>Popraw ton</Button>
                    <Button type="submit" name="intent" value="manual" variant="secondary">Zapisz szkic</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader><CardTitle>{t.write.latestDrafts}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {drafts.length === 0 ? (
                  <p className="text-sm text-muted">{t.write.noDrafts}</p>
                ) : (
                  drafts.map((item) => {
                    const canPublish = canPublishPublication(access.workspace.id, item.id);
                    const publishBlocked = policies.publishing.requireApproval && !canPublish;

                    return (
                      <div key={item.id} className="rounded-xl border border-border bg-surface2 p-3">
                        <p className="text-sm font-medium text-text">{item.title}</p>
                        <p className="text-xs text-muted">{channelLabel(item.channel)} • {item.projectName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link href={`/w/${workspaceSlug}/content/${item.id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text">
                            {t.common.open}
                          </Link>
                          <Button type="button" size="sm" disabled={publishBlocked}>{t.common.publish}</Button>
                          {publishBlocked ? (
                            <>
                              <p className="text-xs text-muted">{t.write.publishBlockedApproval}</p>
                              <form action={requestApprovalAction}>
                                <input type="hidden" name="publicationId" value={item.id} />
                                <Button type="submit" size="sm" variant="secondary">{t.write.sendForApproval}</Button>
                              </form>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader><CardTitle>{t.write.schedule}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="mb-1 text-xs text-muted">{t.write.publishDate}</p>
                  <Input defaultValue={selectedDate || new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">{t.write.publishTime}</p>
                  <Input defaultValue="10:00" />
                </div>
                <Button type="button" variant="secondary" className="w-full">{t.write.schedule}</Button>
                <Button type="button" variant="ghost" className="w-full">{t.write.saveDraft}</Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader><CardTitle>{t.write.brandContext}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-text">
                <p><span className="text-muted">Ton komunikacji:</span> {activeProject?.context.toneOfVoice ?? "—"}</p>
                <p><span className="text-muted">Grupa docelowa:</span> {activeProject?.context.summary ?? "—"}</p>
                <p><span className="text-muted">Hashtagi:</span> {hashtags.join(" ") || "—"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
