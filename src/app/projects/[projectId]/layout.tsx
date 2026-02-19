import Link from "next/link";
import type { ReactNode } from "react";

import { ProjectContextProvider } from "@/components/projects/ProjectContext";
import { getProject } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

type ProjectLayoutProps = {
  params: Promise<{ projectId: string }>;
  children: ReactNode;
};

export default async function ProjectLayout({ params, children }: ProjectLayoutProps) {
  const { projectId } = await params;
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Projekt nie istnieje</h1>
        <p className="mt-2 text-sm text-[#64748B]">Nie znaleziono aktywnego workspace lub projektu.</p>
        <Link href="/projects" className="mt-4 inline-flex text-sm font-medium text-[#5B7CFA] hover:underline">
          Wróć do projektów
        </Link>
      </section>
    );
  }

  const project = getProject(activeWorkspace.workspace.id, projectId);
  if (!project) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Projekt nie istnieje</h1>
        <p className="mt-2 text-sm text-[#64748B]">Projekt został usunięty lub nie jest dostępny.</p>
        <Link href="/projects" className="mt-4 inline-flex text-sm font-medium text-[#5B7CFA] hover:underline">
          Wróć do projektów
        </Link>
      </section>
    );
  }

  return (
    <ProjectContextProvider
      workspaceSlug={activeWorkspace.workspace.slug}
      projectId={projectId}
      initialProject={project}
    >
      {children}
    </ProjectContextProvider>
  );
}
