import type { ReactNode } from "react";

import { PlanBadge } from "@/components/billing/PlanBadge";
import { TokenPill } from "@/components/billing/TokenPill";
import { ProjectNav } from "@/components/projects/ProjectNav";
import type { PlanId } from "@/lib/billing/planConfig";
import type { TokenState } from "@/lib/billing/tokens";
import type { ProjectProfile } from "@/lib/projects/projectStore";

type ProjectShellProps = {
  project: ProjectProfile;
  planId: PlanId;
  tokenState: TokenState;
  activeTab: "overview" | "calendar" | "content" | "strategy" | "results" | "settings";
  workspaceSlug?: string;
  children: ReactNode;
};

export function ProjectShell({ project, planId, tokenState, activeTab, workspaceSlug, children }: ProjectShellProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-sm text-[#5B7CFA]">Projekt</p>
            <h1 className="mt-1 text-lg font-semibold text-[#0F172A]">{project.nazwa}</h1>
            <p className="mt-1 text-xs text-[#64748B]">{project.domenaLubKanal}</p>

            <div className="mt-5">
              <ProjectNav
                projectId={project.id}
                workspaceSlug={workspaceSlug}
                active={activeTab}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-4">
              <PlanBadge planId={planId} />
              <TokenPill state={tokenState} />
            </div>
          </aside>

          <div>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
