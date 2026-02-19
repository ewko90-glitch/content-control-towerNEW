import Link from "next/link";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { ProjectContextBar, useProjectContext } from "@/components/projects/ProjectContext";
import { getProjectPlanningContext } from "@/lib/projects/projectStore";

type ProjectStrategyViewProps = {
  workspaceSlug: string;
  projectId?: string;
};

function previewList(items: string[], maxItems: number): string {
  if (items.length <= maxItems) {
    return items.join(", ");
  }
  const visible = items.slice(0, maxItems).join(", ");
  return `${visible} +${items.length - maxItems}`;
}

export function ProjectStrategyView(_: ProjectStrategyViewProps) {
  const { workspaceSlug, projectId, project, aiStrategyAccess } = useProjectContext();
  const planningContext = getProjectPlanningContext(project);
  const channels = planningContext.channels.length > 0
    ? planningContext.channels.join(" • ")
    : "Brak kanałów";

  return (
    <div>
      <ProjectContextBar />
      <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Strategia AI</h2>
        <p className="mt-1 text-sm text-[#64748B]">AI analizuje projekt i rekomenduje kolejne działania.</p>
        {projectId ? <p className="mt-1 text-xs text-[#94A3B8]">Scope projektu: {projectId}</p> : null}

        <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#475569]">
          <p className="font-medium text-[#0F172A]">Kontekst strategii (z profilu projektu)</p>
          <p className="mt-2"><span className="font-medium text-[#334155]">Klastry:</span> {previewList(planningContext.clusters, 6) || "Brak"}</p>
          <p className="mt-1"><span className="font-medium text-[#334155]">Słowa kluczowe:</span> {previewList(planningContext.keywords, 10) || "Brak"}</p>
          <p className="mt-1"><span className="font-medium text-[#334155]">Linki wewnętrzne:</span> {planningContext.internalLinksCount}</p>
          <p className="mt-1"><span className="font-medium text-[#334155]">Kanały i cadence:</span> {channels} • {planningContext.cadenceFrequency}/tydzień</p>
        </div>

        {aiStrategyAccess.status === "ok" ? (
          <Link
            href={`/w/${workspaceSlug}/calendar/refresh`}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white"
          >
            Odśwież plan
          </Link>
        ) : (
          <div className="mt-4">
            <FeatureLockCard tytulFunkcji="Strategia AI" access={aiStrategyAccess} />
          </div>
        )}
      </section>
    </div>
  );
}
