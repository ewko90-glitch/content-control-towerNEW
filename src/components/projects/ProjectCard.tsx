import Link from "next/link";

import { PlanBadge } from "@/components/billing/PlanBadge";
import { TokenPill } from "@/components/billing/TokenPill";
import type { PlanId } from "@/lib/billing/planConfig";
import type { TokenState } from "@/lib/billing/tokens";
import type { ProjectProfile } from "@/lib/projects/projectStore";

type ProjectCardProps = {
  project: ProjectProfile;
  planId: PlanId;
  tokenState: TokenState;
};

export function ProjectCard({ project, planId, tokenState }: ProjectCardProps) {
  return (
    <article className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
      <h3 className="text-lg font-semibold text-[#0F172A]">{project.nazwa}</h3>
      <p className="mt-1 text-sm text-[#475569]">{project.domenaLubKanal}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
          {project.typ === "domena" ? "Domena" : "LinkedIn osoba"}
        </span>
        <PlanBadge planId={planId} />
        <TokenPill state={tokenState} />
      </div>

      <Link
        href={`/projects/${project.id}`}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
      >
        Otwórz projekt
      </Link>
    </article>
  );
}
