import Link from "next/link";

import { ProjectCard } from "@/components/projects/ProjectCard";
import type { PlanId } from "@/lib/billing/planConfig";
import type { TokenState } from "@/lib/billing/tokens";
import type { ProjectProfile } from "@/lib/projects/projectStore";

type ProjectGridProps = {
  projects: ProjectProfile[];
  planId: PlanId;
  tokenState: TokenState;
};

export function ProjectGrid({ projects, planId, tokenState }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
        <p className="text-base text-[#475569]">Nie masz jeszcze projektu. Dodaj pierwszy, aby zacząć.</p>
        <Link
          href="/projects/new"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#5B7CFA] px-6 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
        >
          + Nowy projekt
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Link
        href="/projects/new"
        className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-[#E2E8F0] bg-white p-6 text-center text-lg font-semibold text-[#5B7CFA] shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#F8FAFF]"
      >
        + Nowy projekt
      </Link>

      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} planId={planId} tokenState={tokenState} />
      ))}
    </div>
  );
}
