import { notFound, redirect } from "next/navigation";

import { getProject } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectContentBridgePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectContentBridgePage({ params }: ProjectContentBridgePageProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const project = getProject(activeWorkspace.workspace.id, projectId);
  if (!project) {
    notFound();
  }

  redirect(`/w/${activeWorkspace.workspace.slug}/content?projectId=${encodeURIComponent(project.id)}`);
}
