"use client";

import { useMemo, useState } from "react";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { TokenPill } from "@/components/billing/TokenPill";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { PermissionLockCard } from "@/components/team/PermissionLockCard";
import { sprawdzDostepDoFunkcji } from "@/lib/billing/featureAccess";
import { makeExplainId } from "@/lib/domain/controlTowerV3/explainability";
import { recordTelemetry } from "@/lib/domain/controlTowerV3/telemetry";
import {
  canGenerateAiToday,
  getProjectPlanningContext,
  incrementDailyAiGenerationUsage,
  recordAuditEvent,
  type PublicationJob,
} from "@/lib/projects/projectStore";

type AiStudioPanelProps = {
  publication: PublicationJob;
  onAddAiVersion: (formData: FormData) => Promise<void>;
  onSetPublicationDraft: (formData: FormData) => Promise<void>;
  onAuditRecorded?: () => void;
};

type GeneratedBundle = {
  outline?: string;
  draft?: string;
  seo?: string;
  notice?: string;
};

function generateOutline(publication: PublicationJob, context: ReturnType<typeof getProjectPlanningContext>): string {
  const clusters = context.clusters.slice(0, 4).join(", ") || "główne tematy projektu";
  const keywords = context.keywords.slice(0, 6).join(", ") || "kluczowe frazy";
  return [
    `# Outline: ${publication.tytul}`,
    "",
    "## H2: Dlaczego ten temat teraz",
    `- Kontekst projektu: ${clusters}`,
    `- Cel publikacji dla kanału ${publication.kanal}`,
    "",
    "## H2: Najważniejsze punkty",
    "### H3: Problem i stawka biznesowa",
    "- Co boli odbiorcę",
    "- Co się zmieni po wdrożeniu",
    "### H3: Rozwiązanie krok po kroku",
    "- Krok 1",
    "- Krok 2",
    "- Krok 3",
    "",
    "## H2: CTA",
    "- CTA 1: Umów konsultację",
    "- CTA 2: Pobierz checklistę",
    "",
    `## Keywords do użycia\n- ${keywords}`,
  ].join("\n");
}

function buildParagraph(seed: string, index: number): string {
  return `${seed} Akapit ${index + 1} rozwija temat w sposób praktyczny, wskazuje konsekwencje biznesowe i podaje konkretne kroki wdrożenia.`;
}

function generateDraft(publication: PublicationJob, context: ReturnType<typeof getProjectPlanningContext>, tone: string): string {
  const targetParagraphs = publication.typ === "blog" ? 10 : 4;
  const base = `Publikacja \"${publication.tytul}\" dla kanału ${publication.kanal} (${publication.typ}) w tonie ${tone}.`;
  const paragraphs: string[] = [];
  for (let index = 0; index < targetParagraphs; index += 1) {
    paragraphs.push(buildParagraph(base, index));
  }

  const intro = `W tym materiale opieramy się na klastrach: ${context.clusters.slice(0, 3).join(", ") || "brak"}.`;
  const outro = "Podsumowanie: wybierz 1 działanie na dziś i wdroż je od razu, aby utrzymać tempo publikacji.";

  return [intro, "", ...paragraphs, "", outro].join("\n\n");
}

function generateSeo(publication: PublicationJob, context: ReturnType<typeof getProjectPlanningContext>): string {
  const topKeywords = context.keywords.slice(0, 10);
  const linksInternal = topKeywords.slice(0, 5).map((_, index) => `- Link wewnętrzny ${index + 1}: /artykul-${index + 1}`);
  const linksExternal = [
    "- Link zewnętrzny 1: raport branżowy",
    "- Link zewnętrzny 2: źródło statystyczne",
    "- Link zewnętrzny 3: case study",
  ];

  return [
    `Meta title: ${publication.tytul} | ${context.channels[0] ?? "Projekt"}`,
    `Meta description: ${publication.tytul} — praktyczne wskazówki i plan działania dla odbiorców projektu.`,
    "",
    "Sugerowane linkowanie wewnętrzne:",
    ...linksInternal,
    "",
    "Sugerowane linkowanie zewnętrzne:",
    ...linksExternal,
    "",
    `Keywords (10): ${topKeywords.join(", ")}`,
  ].join("\n");
}

export function AiStudioPanel({ publication, onAddAiVersion, onSetPublicationDraft, onAuditRecorded }: AiStudioPanelProps) {
  const { project, planId, tokeny, tokenState, workspaceSlug, projectId, requirePermission, buildActor, policies } = useProjectContext();
  const [bundle, setBundle] = useState<GeneratedBundle>({});

  const aiPermission = requirePermission("ai_uzyj");

  const planningContext = useMemo(() => getProjectPlanningContext(project), [project]);

  const accessOutline = sprawdzDostepDoFunkcji({ feature: "ai_planowanie", planId, tokeny, czyAkcjaAI: true });
  const accessDraft = sprawdzDostepDoFunkcji({ feature: "ai_generowanie_tresci", planId, tokeny, czyAkcjaAI: true });
  const accessSeo = sprawdzDostepDoFunkcji({ feature: "ai_rekomendacje_strategiczne", planId, tokeny, czyAkcjaAI: true });

  const dailyUsage = useMemo(() => canGenerateAiToday(project.workspaceId, projectId), [project.workspaceId, projectId, bundle.notice]);

  function emitPolicyBlocked(details: Record<string, unknown>, summary: string) {
    recordAuditEvent({
      id: `aud_${Date.now()}`,
      workspaceId: project.workspaceId,
      projectId,
      publicationId: publication.id,
      publicationTitle: publication.tytul,
      type: "policy_blocked",
      timestampISO: new Date().toISOString(),
      actor: buildActor(),
      source: "manual",
      summary,
      details,
    });
    onAuditRecorded?.();
  }

  function canGenerateKind(kind: "outline" | "draft" | "seo"): boolean {
    if (!policies.aiEnabled) {
      return false;
    }
    if (!policies.allowedAiKinds.includes(kind)) {
      return false;
    }
    const usage = canGenerateAiToday(project.workspaceId, projectId);
    return usage.allowed;
  }

  async function persistGenerated(kind: "outline" | "draft" | "seo", title: string, content: string) {
    const clientVersionId = `aiv_${Date.now()}`;
    const envelope = {
      id: makeExplainId(["ai_stub", kind, projectId, publication.id]),
      module: "ai_studio",
      ruleId: `ai_stub:${kind}`,
      inputs: {
        clientVersionId,
        projectId,
        publicationId: publication.id,
        channel: publication.kanal,
        type: publication.typ,
        keywords: planningContext.keywords.slice(0, 10),
      },
      outputs: {
        length: content.length,
        sectionsCount: content.split("\n## ").length,
        keywordsUsedCount: planningContext.keywords.length,
      },
    };

    const versionForm = new FormData();
    versionForm.set("publicationId", publication.id);
    versionForm.set("kind", kind);
    versionForm.set("title", title);
    versionForm.set("content", content);
    versionForm.set("inputs", JSON.stringify(envelope.inputs));
    await onAddAiVersion(versionForm);

    const patchForm = new FormData();
    patchForm.set("publicationId", publication.id);
    if (kind === "outline") {
      patchForm.set("outlineDraft", content);
    } else if (kind === "draft") {
      patchForm.set("contentDraft", content);
    } else {
      patchForm.set("seoNotes", content);
    }
    await onSetPublicationDraft(patchForm);

    recordAuditEvent({
      id: `aud_${Date.now()}`,
      workspaceId: project.workspaceId,
      projectId,
      publicationId: publication.id,
      publicationTitle: publication.tytul,
      type: "ai_generated",
      timestampISO: new Date().toISOString(),
      actor: buildActor(),
      source: "ai",
      summary: `Wygenerowano wariant AI (${kind}) dla publikacji: ${publication.tytul}.`,
      details: {
        kind,
        versionId: clientVersionId,
      },
    });
    onAuditRecorded?.();

    recordTelemetry({
      workspaceId: project.workspaceId,
      type: "focus_session_started",
      timestampISO: new Date().toISOString(),
      metadata: {
        projectId,
        publicationId: publication.id,
        kind,
        channel: publication.kanal,
        type: publication.typ,
        wouldConsumeTokens: true,
        explainEnvelope: envelope,
      },
    });
  }

  async function applyToPublication(kind: "outline" | "draft" | "seo", content: string) {
    const patchForm = new FormData();
    patchForm.set("publicationId", publication.id);
    if (kind === "outline") {
      patchForm.set("outlineDraft", content);
    } else if (kind === "draft") {
      patchForm.set("contentDraft", content);
    } else {
      patchForm.set("seoNotes", content);
    }
    await onSetPublicationDraft(patchForm);

    const appliedTo = kind === "outline" ? "outlineDraft" : kind === "draft" ? "contentDraft" : "seoNotes";
    recordAuditEvent({
      id: `aud_${Date.now()}`,
      workspaceId: project.workspaceId,
      projectId,
      publicationId: publication.id,
      publicationTitle: publication.tytul,
      type: "ai_applied",
      timestampISO: new Date().toISOString(),
      actor: buildActor(),
      source: "ai",
      summary: `Zastosowano wynik AI (${kind}) do publikacji: ${publication.tytul}.`,
      details: {
        kind,
        appliedTo,
      },
    });
    onAuditRecorded?.();

    recordTelemetry({
      workspaceId: project.workspaceId,
      type: "focus_session_completed",
      timestampISO: new Date().toISOString(),
      metadata: {
        projectId,
        publicationId: publication.id,
        kind,
        channel: publication.kanal,
        type: publication.typ,
        wouldConsumeTokens: true,
      },
    });

    setBundle((prev) => ({ ...prev, notice: "Zastosowano do publikacji." }));
  }

  if (aiPermission.status === "brak_uprawnien") {
    return (
      <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#0F172A]">AI Studio</h4>
        </div>
        <PermissionLockCard title="Brak uprawnienia do AI Studio" description={aiPermission.powod} />
      </section>
    );
  }

  if (!policies.aiEnabled) {
    return (
      <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#0F172A]">AI Studio</h4>
        </div>
        <PermissionLockCard title="AI jest wyłączone dla tego projektu" description="Możesz pracować ręcznie. Włącz AI w politykach projektu." />
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#0F172A]">AI Studio</h4>
        <div className="flex items-center gap-2">
          <TokenPill state={tokenState} />
          <span className="text-xs text-[#64748B]">Ta akcja zużyje tokeny AI</span>
        </div>
      </div>

      <p className="text-xs text-[#64748B]">
        Dzienny limit generacji AI: {dailyUsage.limit === 0 ? "bez limitu" : `${dailyUsage.used}/${dailyUsage.limit}`}
      </p>

      <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
        <p className="text-sm font-medium text-[#0F172A]">Outline</p>
        <p className="text-xs text-[#64748B]">Struktura H2/H3 + CTA na bazie kontekstu projektu.</p>
        <p className="mt-2 line-clamp-3 text-xs text-[#475569]">{bundle.outline ?? publication.outlineDraft ?? "Brak wygenerowanego outline."}</p>
        {accessOutline.status === "ok" && policies.allowedAiKinds.includes("outline") ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!canGenerateKind("outline")) {
                  const usage = canGenerateAiToday(project.workspaceId, projectId);
                  const blockedByLimit = !usage.allowed;
                  emitPolicyBlocked(
                    {
                      reason: blockedByLimit ? "daily_limit" : "kind_not_allowed",
                      kind: "outline",
                      dayKey: usage.dayKey,
                      used: usage.used,
                      limit: usage.limit,
                    },
                    "Zablokowano generację AI przez politykę projektu.",
                  );
                  setBundle((prev) => ({ ...prev, notice: blockedByLimit ? "Przekroczono dzienny limit generacji AI." : "Ten typ generacji AI jest zablokowany polityką." }));
                  return;
                }
                const content = generateOutline(publication, planningContext);
                setBundle((prev) => ({ ...prev, outline: content, notice: "Wygenerowano. Możesz zastosować do publikacji." }));
                await persistGenerated("outline", `Outline — ${publication.tytul}`, content);
                incrementDailyAiGenerationUsage(project.workspaceId, projectId);
              }}
              className="h-8 rounded-lg bg-[#5B7CFA] px-3 text-xs font-medium text-white"
            >
              Wygeneruj outline
            </button>
            <button
              type="button"
              onClick={async () => applyToPublication("outline", bundle.outline ?? publication.outlineDraft ?? "")}
              className="h-8 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#334155]"
            >
              Zastosuj do publikacji
            </button>
          </div>
        ) : (
          <div className="mt-2">
            {policies.allowedAiKinds.includes("outline") && accessOutline.status !== "ok" ? (
              <FeatureLockCard tytulFunkcji="AI Outline" access={accessOutline} />
            ) : (
              <PermissionLockCard title="Outline zablokowany polityką" description="Włącz ten typ generacji w politykach projektu." />
            )}
          </div>
        )}
      </article>

      <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
        <p className="text-sm font-medium text-[#0F172A]">Szkic treści</p>
        <p className="text-xs text-[#64748B]">Deterministyczny szkic zależny od typu publikacji i tonu.</p>
        <p className="mt-2 line-clamp-3 text-xs text-[#475569]">{bundle.draft ?? publication.contentDraft ?? "Brak wygenerowanego szkicu."}</p>
        {accessDraft.status === "ok" && policies.allowedAiKinds.includes("draft") ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!canGenerateKind("draft")) {
                  const usage = canGenerateAiToday(project.workspaceId, projectId);
                  const blockedByLimit = !usage.allowed;
                  emitPolicyBlocked(
                    {
                      reason: blockedByLimit ? "daily_limit" : "kind_not_allowed",
                      kind: "draft",
                      dayKey: usage.dayKey,
                      used: usage.used,
                      limit: usage.limit,
                    },
                    "Zablokowano generację AI przez politykę projektu.",
                  );
                  setBundle((prev) => ({ ...prev, notice: blockedByLimit ? "Przekroczono dzienny limit generacji AI." : "Ten typ generacji AI jest zablokowany polityką." }));
                  return;
                }
                const content = generateDraft(publication, planningContext, project.tonKomunikacji);
                setBundle((prev) => ({ ...prev, draft: content, notice: "Wygenerowano. Możesz zastosować do publikacji." }));
                await persistGenerated("draft", `Szkic — ${publication.tytul}`, content);
                incrementDailyAiGenerationUsage(project.workspaceId, projectId);
              }}
              className="h-8 rounded-lg bg-[#5B7CFA] px-3 text-xs font-medium text-white"
            >
              Wygeneruj szkic
            </button>
            <button
              type="button"
              onClick={async () => applyToPublication("draft", bundle.draft ?? publication.contentDraft ?? "")}
              className="h-8 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#334155]"
            >
              Zastosuj do publikacji
            </button>
          </div>
        ) : (
          <div className="mt-2">
            {policies.allowedAiKinds.includes("draft") && accessDraft.status !== "ok" ? (
              <FeatureLockCard tytulFunkcji="AI Szkic" access={accessDraft} />
            ) : (
              <PermissionLockCard title="Draft zablokowany polityką" description="Włącz ten typ generacji w politykach projektu." />
            )}
          </div>
        )}
      </article>

      <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
        <p className="text-sm font-medium text-[#0F172A]">SEO</p>
        <p className="text-xs text-[#64748B]">Keywords, meta i sugestie linkowania.</p>
        <p className="mt-2 line-clamp-3 text-xs text-[#475569]">{bundle.seo ?? publication.seoNotes ?? "Brak sugestii SEO."}</p>
        {accessSeo.status === "ok" && policies.allowedAiKinds.includes("seo") ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!canGenerateKind("seo")) {
                  const usage = canGenerateAiToday(project.workspaceId, projectId);
                  const blockedByLimit = !usage.allowed;
                  emitPolicyBlocked(
                    {
                      reason: blockedByLimit ? "daily_limit" : "kind_not_allowed",
                      kind: "seo",
                      dayKey: usage.dayKey,
                      used: usage.used,
                      limit: usage.limit,
                    },
                    "Zablokowano generację AI przez politykę projektu.",
                  );
                  setBundle((prev) => ({ ...prev, notice: blockedByLimit ? "Przekroczono dzienny limit generacji AI." : "Ten typ generacji AI jest zablokowany polityką." }));
                  return;
                }
                const content = generateSeo(publication, planningContext);
                setBundle((prev) => ({ ...prev, seo: content, notice: "Wygenerowano. Możesz zastosować do publikacji." }));
                await persistGenerated("seo", `SEO — ${publication.tytul}`, content);
                incrementDailyAiGenerationUsage(project.workspaceId, projectId);
              }}
              className="h-8 rounded-lg bg-[#5B7CFA] px-3 text-xs font-medium text-white"
            >
              Sugestie SEO
            </button>
            <button
              type="button"
              onClick={async () => applyToPublication("seo", bundle.seo ?? publication.seoNotes ?? "")}
              className="h-8 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#334155]"
            >
              Zastosuj do publikacji
            </button>
          </div>
        ) : (
          <div className="mt-2">
            {policies.allowedAiKinds.includes("seo") && accessSeo.status !== "ok" ? (
              <FeatureLockCard tytulFunkcji="AI SEO" access={accessSeo} />
            ) : (
              <PermissionLockCard title="SEO zablokowane polityką" description="Włącz ten typ generacji w politykach projektu." />
            )}
          </div>
        )}
      </article>

      {bundle.notice ? <p className="text-xs text-emerald-700">{bundle.notice}</p> : null}
      <p className="text-xs text-[#94A3B8]">Workspace: {workspaceSlug}</p>
    </section>
  );
}
