import { notFound, redirect } from "next/navigation";

import { ProjectShell } from "@/components/projects/ProjectShell";
import { ProjectCalendarView } from "@/components/projects/views/ProjectCalendarView";
import type { PlanId } from "@/lib/billing/planConfig";
import {
  addAiVersion,
  createPublication,
  deletePublication,
  getProject,
  listPublications,
  setPublicationDraft,
  updatePublicationStatus,
  type PublicationChannel,
  type PublicationStatus,
  type PublicationType,
} from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectCalendarPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectCalendarPage({ params }: ProjectCalendarPageProps) {
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

  async function createPublicationAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const tytul = String(formData.get("tytul") ?? "").trim();
    if (!tytul) {
      return;
    }

    const kanalRaw = String(formData.get("kanal") ?? "inne").trim();
    const kanal: PublicationChannel =
      kanalRaw === "wordpress" || kanalRaw === "shopify" || kanalRaw === "linkedin" ? kanalRaw : "inne";

    const typRaw = String(formData.get("typ") ?? "inne").trim();
    const typ: PublicationType =
      typRaw === "blog" || typRaw === "post" || typRaw === "newsletter" || typRaw === "landing" ? typRaw : "inne";

    const statusRaw = String(formData.get("status") ?? "zaplanowane").trim();
    const status: PublicationStatus =
      statusRaw === "pomysl" || statusRaw === "szkic" || statusRaw === "do_akceptacji" || statusRaw === "opublikowane"
        ? statusRaw
        : "zaplanowane";

    const dataPublikacji = String(formData.get("dataPublikacji") ?? "").trim();
    if (!dataPublikacji) {
      return;
    }

    createPublication(access.workspace.id, resolvedProject.id, {
      tytul,
      kanal,
      typ,
      dataPublikacjiISO: `${dataPublikacji}T09:00:00.000Z`,
      status,
      opis: String(formData.get("opis") ?? "").trim() || undefined,
    });
  }

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

  async function deletePublicationAction(formData: FormData) {
    "use server";

    const access = await resolveActiveWorkspace();
    if (!access) {
      return;
    }

    const publicationId = String(formData.get("publicationId") ?? "").trim();
    if (!publicationId) {
      return;
    }

    deletePublication(access.workspace.id, resolvedProject.id, publicationId);
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
    <ProjectShell project={resolvedProject} planId={planId} tokenState={tokenState} workspaceSlug={workspaceSlug} activeTab="calendar">
      <ProjectCalendarView
        workspaceSlug={workspaceSlug}
        projectId={resolvedProject.id}
        publications={publications}
        onCreatePublication={createPublicationAction}
        onChangeStatus={changeStatusAction}
        onAddAiVersion={addAiVersionAction}
        onSetPublicationDraft={setPublicationDraftAction}
        onDeletePublication={deletePublicationAction}
      />
    </ProjectShell>
  );
}
