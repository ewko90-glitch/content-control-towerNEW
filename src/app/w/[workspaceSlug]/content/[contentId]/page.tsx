import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { estimateCredits } from "@/modules/ai/credits";
import { runAIAssist } from "@/server/actions/ai";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { saveNewVersion, updateStatus, upsertContentPerformance, validateBeforePublish } from "@/server/actions/content";
import { getWorkspaceCredits } from "@/server/queries/ai";
import { getContentItem } from "@/server/queries/content";

type PageProps = {
  params: Promise<{ workspaceSlug: string; contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseLinkList(raw: unknown): Array<{ url: string; title: string }> {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => entry as Record<string, unknown>)
    .map((entry) => ({
      url: String(entry.url ?? ""),
      title: String(entry.title ?? ""),
    }))
    .filter((entry) => entry.url.length > 0);
}

const statusOptions = ["draft", "review", "approved", "scheduled", "published", "archived"] as const;
const aiActions = [
  { key: "improve", label: "Ulepsz tekst", description: "Czytelność, struktura, ton, mocniejszy wstęp" },
  { key: "seo_optimize", label: "Optymalizuj SEO", description: "Naturalne słowa kluczowe i linkowania" },
  { key: "adapt_channel", label: "Dopasuj do kanału", description: "Przepisz tekst pod specyfikę kanału" },
] as const;

export default async function ContentDetailPage({ params, searchParams }: PageProps) {
  const { workspaceSlug, contentId } = await params;
  const search = await searchParams;
  const selectedVersionId = toValue(search.version);
  const message = toValue(search.msg);
  const aiOpen = toValue(search.ai) === "1";
  const aiError = toValue(search.aiError);
  const aiSuggestionParam = toValue(search.aiSuggestion);
  const aiModel = toValue(search.aiModel);
  const aiTokens = toValue(search.aiTokens);
  const aiRemaining = toValue(search.aiRemaining);
  const publishChecklistOpen = toValue(search.publishChecklist) === "1";

  async function saveVersionAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const parsedMeta = (() => {
      const rawMeta = String(formData.get("meta") ?? "{}");
      try {
        const value = JSON.parse(rawMeta) as unknown;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return value as Record<string, unknown>;
        }
        return {};
      } catch {
        return {};
      }
    })();

    const result = await saveNewVersion(
      access.workspace.id,
      contentId,
      String(formData.get("body") ?? ""),
      parsedMeta,
    );

    const msg = result.ok ? "Version saved" : result.error.message;
    redirect(`/w/${workspaceSlug}/content/${contentId}?msg=${encodeURIComponent(msg)}`);
  }

  async function updateStatusAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const targetStatus = String(formData.get("status") ?? "");
    const confirmPublish = String(formData.get("confirmPublish") ?? "") === "1";

    if (targetStatus === "published" && !confirmPublish) {
      redirect(`/w/${workspaceSlug}/content/${contentId}?publishChecklist=1`);
    }

    if (targetStatus === "published") {
      const validation = await validateBeforePublish(contentId, access.workspace.id);
      if (!validation.canPublish) {
        redirect(`/w/${workspaceSlug}/content/${contentId}?publishChecklist=1&msg=${encodeURIComponent("Uzupełnij checklistę przed publikacją.")}`);
      }
    }

    const result = await updateStatus(access.workspace.id, contentId, targetStatus);

    const msg = result.ok ? `Status: ${result.data.status}` : result.error.message;
    redirect(`/w/${workspaceSlug}/content/${contentId}?msg=${encodeURIComponent(msg)}`);
  }

  async function runAIAssistAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const action = String(formData.get("action") ?? "improve") as "improve" | "seo_optimize" | "adapt_channel";
    const result = await runAIAssist(access.workspace.id, contentId, action);

    if (!result.ok) {
      redirect(
        `/w/${workspaceSlug}/content/${contentId}?ai=1&aiError=${encodeURIComponent(result.errorCode ?? "INTERNAL")}` +
          `&aiRemaining=${encodeURIComponent(String(result.remainingAfter ?? 0))}`,
      );
    }

    redirect(
      `/w/${workspaceSlug}/content/${contentId}?ai=1` +
        `&aiSuggestion=${encodeURIComponent(result.suggestion?.body ?? "")}` +
        `&aiModel=${encodeURIComponent(result.suggestion?.model ?? "")}` +
        `&aiTokens=${encodeURIComponent(String(result.suggestion?.tokensUsed ?? 0))}` +
        `&aiRemaining=${encodeURIComponent(String(result.remainingAfter ?? 0))}`,
    );
  }

  async function savePerformanceAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const result = await upsertContentPerformance(access.workspace.id, contentId, {
      views: formData.get("views"),
      clicks: formData.get("clicks"),
      leads: formData.get("leads"),
      rating: formData.get("rating"),
    });

    const msg = result.ok ? "Wyniki publikacji zapisane." : result.error.message;
    redirect(`/w/${workspaceSlug}/content/${contentId}?msg=${encodeURIComponent(msg)}`);
  }

  async function applySuggestionAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const mode = String(formData.get("mode") ?? "insert");
    const suggestion = String(formData.get("suggestion") ?? "");
    const baseBody = String(formData.get("baseBody") ?? "");

    if (mode === "replace" || mode === "append") {
      const body = mode === "append" ? `${baseBody}\n\n${suggestion}` : suggestion;
      redirect(`/w/${workspaceSlug}/content/${contentId}?editBody=${encodeURIComponent(body)}&ai=1`);
    }

    const result = await saveNewVersion(access.workspace.id, contentId, suggestion, {
      aiAssist: true,
      source: "ai-assist",
    });

    const msg = result.ok ? "AI suggestion inserted as new version" : result.error.message;
    redirect(`/w/${workspaceSlug}/content/${contentId}?msg=${encodeURIComponent(msg)}`);
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const [content, credits] = await Promise.all([
      getContentItem(contentId, access.workspace.id),
      getWorkspaceCredits(access.workspace.id),
    ]);

    if (!content) {
      notFound();
    }

    const activeVersion =
      content.versions.find((version) => version.id === selectedVersionId) ?? content.versions[0] ?? { id: "", version: 0, body: "", meta: {}, createdAt: new Date().toISOString() };
    const editBodyParam = toValue(search.editBody);
    const editorBody = editBodyParam ? editBodyParam : activeVersion.body;
    const aiSuggestion = aiSuggestionParam ? aiSuggestionParam : "";

    const internalLinks = parseLinkList(content.project.context?.internalLinks);
    const externalLinks = parseLinkList(content.project.context?.externalLinks);
    const publishChecklist = publishChecklistOpen
      ? await validateBeforePublish(contentId, access.workspace.id)
      : null;

    const checklistRows = publishChecklist ? [
      { id: "primaryKeyword", label: "Słowo kluczowe", ok: publishChecklist.checks.primaryKeyword },
      { id: "internalLink", label: "Link wewnętrzny", ok: publishChecklist.checks.internalLink },
      { id: "externalLink", label: "Link zewnętrzny", ok: publishChecklist.checks.externalLink },
      { id: "seo", label: "Struktura SEO", ok: !publishChecklist.checks.seoGuardCritical },
      { id: "placeholder", label: "Brak placeholderów", ok: !publishChecklist.checks.placeholderDetected },
    ] : [];

    return (
      <AppShell title={content.title}>
        <PageHeader
          title={content.title}
          subtitle={`${content.project.name} • ${content.channel}`}
          actions={
            <Link
              href={`/w/${workspaceSlug}/content`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
            >
              Wróć do listy
            </Link>
          }
        />

        {message ? <p className="mb-4 rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">{message}</p> : null}

        <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                <span>{content.title}</span>
                <Badge>{content.qualityState === "ready" ? "Gotowy" : "Wymaga poprawek"}</Badge>
                <Badge>Wynik {content.qualityScore}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateStatusAction} className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-muted" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={content.status}
                  className="h-10 rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "draft" ? "Szkic" : status === "review" ? "Do przeglądu" : status === "approved" ? "Zatwierdzone" : status === "scheduled" ? "Zaplanowane" : status === "published" ? "Opublikowane" : "Archiwum"}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="secondary">
                  Zmień status
                </Button>
              </form>

              {content.status === "published" ? (
                <Card className="rounded-xl border border-border shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Wyniki publikacji</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form action={savePerformanceAction} className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm text-muted">
                        <span>Wyświetlenia</span>
                        <input
                          type="number"
                          name="views"
                          min={0}
                          defaultValue={content.performance.views ?? ""}
                          className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-muted">
                        <span>Kliknięcia</span>
                        <input
                          type="number"
                          name="clicks"
                          min={0}
                          defaultValue={content.performance.clicks ?? ""}
                          className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-muted">
                        <span>Leady</span>
                        <input
                          type="number"
                          name="leads"
                          min={0}
                          defaultValue={content.performance.leads ?? ""}
                          className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-muted">
                        <span>Ocena (1–5)</span>
                        <input
                          type="number"
                          name="rating"
                          min={1}
                          max={5}
                          defaultValue={content.performance.rating ?? ""}
                          className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                        />
                      </label>

                      <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                        <Button type="submit">Zapisz wyniki</Button>
                        {content.performance.updatedAt ? (
                          <p className="text-xs text-muted">Ostatnia aktualizacja: {new Date(content.performance.updatedAt).toLocaleString("pl-PL")}</p>
                        ) : null}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="mb-2 text-sm font-medium text-text">Do poprawki</p>
                {content.qualityIssues.length === 0 ? (
                  <p className="text-sm text-muted">Brak problemów z jakością.</p>
                ) : (
                  <ul className="space-y-2">
                    {content.qualityIssues.map((issue) => (
                      <li key={issue.id} className="rounded-lg border border-border bg-bg p-2">
                        <p className="text-sm font-medium text-text">{issue.label}</p>
                        <p className="text-xs text-muted">{issue.fixHint}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form action={saveVersionAction} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted">Treść posta</p>
                  <Link
                    href={`/w/${workspaceSlug}/content/${contentId}?ai=1`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                  >
                    Pomoc AI
                  </Link>
                </div>
                <textarea
                  name="body"
                  aria-label="Content body editor"
                  title="Content body editor"
                  defaultValue={editorBody}
                  className="min-h-[420px] w-full rounded-2xl border border-border bg-bg p-3 text-sm text-text"
                />
                <input type="hidden" name="meta" value={JSON.stringify(activeVersion.meta)} />
                <div className="flex items-center gap-2">
                  <Button type="submit">Zapisz wersję</Button>
                  <Badge>Edytujesz v{activeVersion.version}</Badge>
                </div>
              </form>

              <details className="rounded-xl border border-border bg-surface2 p-3">
                <summary className="cursor-pointer text-sm font-medium text-text">Historia wersji</summary>
                <ul className="mt-3 space-y-2">
                  {content.versions.map((version) => (
                    <li key={version.id} className="flex items-center justify-between rounded-lg border border-border bg-bg p-2">
                      <span className="text-xs text-muted">
                        v{version.version} • {new Date(version.createdAt).toLocaleString()}
                      </span>
                      <Link
                        href={`/w/${workspaceSlug}/content/${contentId}?version=${version.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface2 px-3 text-xs font-medium text-text"
                      >
                        Wczytaj
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Linkowania z projektu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Wewnętrzne</p>
                {internalLinks.length === 0 ? (
                  <p className="text-sm text-muted">Brak linków wewnętrznych w projekcie.</p>
                ) : (
                  <ul className="space-y-2">
                    {internalLinks.map((link) => (
                      <li key={link.url} className="rounded-lg border border-border bg-surface2 p-2 text-xs text-text">
                        <p className="font-medium">{link.title}</p>
                        <p className="truncate text-muted">{link.url}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Zewnętrzne</p>
                {externalLinks.length === 0 ? (
                  <p className="text-sm text-muted">Brak linków zewnętrznych w projekcie.</p>
                ) : (
                  <ul className="space-y-2">
                    {externalLinks.map((link) => (
                      <li key={link.url} className="rounded-lg border border-border bg-surface2 p-2 text-xs text-text">
                        <p className="font-medium">{link.title}</p>
                        <p className="truncate text-muted">{link.url}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {aiOpen ? (
          <div className="fixed inset-0 z-40 flex justify-end bg-bg/60 backdrop-blur-sm">
            <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Asystent AI</h2>
                <Link
                  href={`/w/${workspaceSlug}/content/${contentId}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                >
                  Zamknij
                </Link>
              </div>

              <div className="mb-4 rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">
                Kredyty AI: {Math.max(0, credits.remaining)}/{credits.monthlyLimit} • reset: {new Date(credits.resetAt).toLocaleDateString("pl-PL")}
              </div>

              {aiError === "OUT_OF_CREDITS" ? (
                <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-text">
                  <p>Wykorzystałeś limit AI na ten miesiąc. Zmień plan lub poczekaj na reset.</p>
                  <Link href={`/w/${workspaceSlug}/overview`} className="mt-2 inline-flex text-xs text-primary hover:underline">
                    Zobacz plany
                  </Link>
                </div>
              ) : null}

              <div className="space-y-3">
                {aiActions.map((item) => {
                  const estimated = estimateCredits(item.key, content.channel, activeVersion.body.length);
                  return (
                    <div key={item.key} className="rounded-xl border border-border bg-surface2 p-3">
                      <p className="text-sm font-medium text-text">{item.label}</p>
                      <p className="text-xs text-muted">{item.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted">Koszt: {estimated} kredytów</span>
                        <form action={runAIAssistAction}>
                          <input type="hidden" name="action" value={item.key} />
                          <Button type="submit" size="sm">Uruchom</Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>

              {aiSuggestion ? (
                <div className="mt-5 space-y-3 rounded-xl border border-border bg-surface2 p-3">
                  <p className="text-sm font-medium text-text">Podgląd sugestii AI</p>
                  <textarea
                    readOnly
                    value={aiSuggestion}
                    aria-label="AI suggestion preview"
                    className="min-h-[220px] w-full rounded-xl border border-border bg-bg p-3 text-sm text-text"
                  />
                  <p className="text-xs text-muted">Model: {aiModel || "mock-deterministic"} • Tokeny: {aiTokens || "0"} • Pozostało: {aiRemaining || credits.remaining}</p>
                  <div className="grid gap-2">
                    <form action={applySuggestionAction}>
                      <input type="hidden" name="mode" value="replace" />
                      <input type="hidden" name="suggestion" value={aiSuggestion} />
                      <input type="hidden" name="baseBody" value={editorBody} />
                      <Button type="submit" size="sm" variant="ghost">Zastąp treść sugestią</Button>
                    </form>
                    <form action={applySuggestionAction}>
                      <input type="hidden" name="mode" value="append" />
                      <input type="hidden" name="suggestion" value={aiSuggestion} />
                      <input type="hidden" name="baseBody" value={editorBody} />
                      <Button type="submit" size="sm" variant="secondary">Dodaj na koniec</Button>
                    </form>
                    <form action={applySuggestionAction}>
                      <input type="hidden" name="mode" value="insert" />
                      <input type="hidden" name="suggestion" value={aiSuggestion} />
                      <input type="hidden" name="baseBody" value={editorBody} />
                      <Button type="submit" size="sm">Zapisz jako nowa wersja</Button>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {publishChecklistOpen && publishChecklist ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-xl rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Gotowe do publikacji?</CardTitle>
                <p className="text-sm text-muted">Sprawdź jakość przed oznaczeniem jako opublikowane.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {checklistRows.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${row.ok ? "border-border bg-surface2" : "border-warning/40 bg-warning/10"}`}
                    >
                      <p className="text-sm text-text">{row.label}</p>
                      <Badge>{row.ok ? "OK" : "Brak"}</Badge>
                    </div>
                  ))}
                </div>

                {publishChecklist.canPublish ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <form action={updateStatusAction}>
                      <input type="hidden" name="status" value="published" />
                      <input type="hidden" name="confirmPublish" value="1" />
                      <Button type="submit">Oznacz jako opublikowane</Button>
                    </form>
                    <Link
                      href={`/w/${workspaceSlug}/content/${contentId}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
                    >
                      Anuluj
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/w/${workspaceSlug}/content/${contentId}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                      Popraw teraz
                    </Link>
                    <Link
                      href={`/w/${workspaceSlug}/content/${contentId}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
                    >
                      Anuluj
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
