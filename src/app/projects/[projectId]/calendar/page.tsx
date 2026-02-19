import { notFound, redirect } from "next/navigation";

import { getProject } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectCalendarBridgePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectCalendarBridgePage({ params }: ProjectCalendarBridgePageProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const project = getProject(activeWorkspace.workspace.id, projectId);
  if (!project) {
    notFound();
  }

  redirect(`/w/${activeWorkspace.workspace.slug}/calendar/refresh?projectId=${encodeURIComponent(project.id)}`);
}
