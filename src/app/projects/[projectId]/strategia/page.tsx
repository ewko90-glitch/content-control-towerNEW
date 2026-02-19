import { notFound, redirect } from "next/navigation";

import { ProjectShell } from "@/components/projects/ProjectShell";
import { ProjectStrategyView } from "@/components/projects/views/ProjectStrategyView";
import type { PlanId } from "@/lib/billing/planConfig";
import { getProject } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectStrategyPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectStrategyPage({ params }: ProjectStrategyPageProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  const workspaceSlug = activeWorkspace.workspace.slug;
  const project = getProject(activeWorkspace.workspace.id, projectId);
  if (!project) {
    notFound();
  }

  const planId: PlanId = "control_tower";
  const tokenState = {
    saldo: 1200,
    odnowienieISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    planMiesiecznyLimit: 250000 as number | "bez_limitu",
  };

  return (
    <ProjectShell project={project} planId={planId} tokenState={tokenState} workspaceSlug={workspaceSlug} activeTab="strategy">
      <ProjectStrategyView workspaceSlug={workspaceSlug} projectId={project.id} />
    </ProjectShell>
  );
}
