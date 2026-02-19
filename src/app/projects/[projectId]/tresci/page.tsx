import { notFound, redirect } from "next/navigation";

import { ProjectShell } from "@/components/projects/ProjectShell";
import { ProjectContentView } from "@/components/projects/views/ProjectContentView";
import type { PlanId } from "@/lib/billing/planConfig";
import {
  addAiVersion,
  getProject,
  listPublications,
  setPublicationDraft,
  updatePublicationStatus,
  type PublicationStatus,
} from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectContentPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectContentPage({ params }: ProjectContentPageProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const workspaceSlug = activeWorkspace.workspace.slug;
  const workspaceId = activeWorkspace.workspace.id;
  const project = getProject(activeWorkspace.workspace.id, projectId);
  if (!project) {
    notFound();
  }
  const resolvedProject = project;

  const publications = listPublications(workspaceId, resolvedProject.id);

  async function changeStatusAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const publicationId = String(formData.get("publicationId") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "").trim();
    const status: PublicationStatus =
      statusRaw === "pomysl" || statusRaw === "szkic" || statusRaw === "do_akceptacji" || statusRaw === "zaplanowane" || statusRaw === "opublikowane"
        ? statusRaw
        : "pomysl";

    if (!publicationId) {
      return;
    }

    updatePublicationStatus(access.workspace.id, resolvedProject.id, publicationId, status);
  }

  async function addAiVersionAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const publicationId = String(formData.get("publicationId") ?? "").trim();
    const kindRaw = String(formData.get("kind") ?? "").trim();
    const kind = kindRaw === "outline" || kindRaw === "draft" || kindRaw === "seo" ? kindRaw : "outline";
    const title = String(formData.get("title") ?? "Wersja AI").trim();
    const content = String(formData.get("content") ?? "");
    const inputsRaw = String(formData.get("inputs") ?? "{}");

    if (!publicationId || !content.trim()) {
      return;
    }

    let inputs: Record<string, unknown> = {};
    try {
      inputs = JSON.parse(inputsRaw) as Record<string, unknown>;
    } catch {
      inputs = {};
    }

    addAiVersion(access.workspace.id, resolvedProject.id, publicationId, {
      kind,
      title,
      content,
      inputs,
    });
  }

  async function setPublicationDraftAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const publicationId = String(formData.get("publicationId") ?? "").trim();
    if (!publicationId) {
      return;
    }

    setPublicationDraft(access.workspace.id, resolvedProject.id, publicationId, {
      contentDraft: formData.has("contentDraft") ? String(formData.get("contentDraft") ?? "") : undefined,
      outlineDraft: formData.has("outlineDraft") ? String(formData.get("outlineDraft") ?? "") : undefined,
      seoNotes: formData.has("seoNotes") ? String(formData.get("seoNotes") ?? "") : undefined,
    });
  }

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  return (
    <ProjectShell project={resolvedProject} planId={planId} tokenState={tokenState} workspaceSlug={workspaceSlug} activeTab="content">
      <ProjectContentView
        workspaceSlug={workspaceSlug}
        projectId={resolvedProject.id}
        publications={publications}
        onChangeStatus={changeStatusAction}
        onAddAiVersion={addAiVersionAction}
        onSetPublicationDraft={setPublicationDraftAction}
      />
    </ProjectShell>
  );
}
