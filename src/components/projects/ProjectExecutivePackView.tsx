"use client";

import { PlanBadge } from "@/components/billing/PlanBadge";
import { TokenPill } from "@/components/billing/TokenPill";
import { ProjectInsightsPanel, type ProjectInsight } from "@/components/projects/ProjectInsightsPanel";
import { ProjectPerformanceDashboard } from "@/components/projects/ProjectPerformanceDashboard";
import { TeamPerformanceTable, type TeamPerformanceRow } from "@/components/projects/TeamPerformanceTable";
import type { PlanId } from "@/lib/billing/planConfig";
import type { TokenState } from "@/lib/billing/tokens";
import type { ProjectProfile } from "@/lib/projects/projectStore";

type PublicationListItem = {
  id: string;
  title: string;
  dateISO: string;
  status: string;
  assigneeName?: string;
};

type PublicationListSection = {
  title: string;
  items: PublicationListItem[];
  remainingCount: number;
};

type ProjectExecutivePackViewProps = {
  project: ProjectProfile;
  periodLabel: string;
  generatedAtLabel: string;
  planId: PlanId;
  tokenState: TokenState;
  kpis: {
    upcomingCount: number;
    publishedCount: number;
    unassignedUpcomingCount: number;
    overdueCount: number;
    draftsCount: number;
    staleDraftsCount: number;
  };
  teamRows: TeamPerformanceRow[];
  insights: ProjectInsight[];
  sections: PublicationListSection[];
};

function PublicationSection({ section }: { section: PublicationListSection }) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <h4 className="text-sm font-semibold text-[#0F172A]">{section.title}</h4>
      {section.items.length === 0 ? (
        <p className="mt-2 text-sm text-[#64748B]">Brak pozycji.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-[#334155]">
          {section.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="font-medium text-[#0F172A]">{item.title}</p>
              <p className="mt-1 text-xs text-[#64748B]">
                {item.dateISO.slice(0, 10)} • {item.status}
                {item.assigneeName ? ` • ${item.assigneeName}` : " • Nieprzypisane"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {section.remainingCount > 0 ? <p className="mt-2 text-xs text-[#64748B]">+{section.remainingCount} więcej</p> : null}
    </article>
  );
}

export function ProjectExecutivePackView({
  project,
  periodLabel,
  generatedAtLabel,
  planId,
  tokenState,
  kpis,
  teamRows,
  insights,
  sections,
}: ProjectExecutivePackViewProps) {
  return (
    <div className="executive-pack mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <style jsx>{`
        @media print {
          :global(body) {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .executive-pack {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
          .print-hide,
          .print-hide * {
            display: none !important;
          }
          :global(.executive-pack a),
          :global(.executive-pack button) {
            display: none !important;
          }
          .print-section {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-hide mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0F172A] px-3 text-sm font-medium text-white"
        >
          Drukuj / Zapisz jako PDF
        </button>
        <button
          type="button"
          disabled
          className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#94A3B8]"
        >
          Pobierz PDF
        </button>
        <span className="inline-flex rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-xs text-[#64748B]">Wkrótce</span>
      </div>

      <header className="print-section mb-4 rounded-2xl border border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFF] to-white p-5">
        <p className="text-xs uppercase tracking-wide text-[#64748B]">Raport projektu</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0F172A]">{project.nazwa}</h1>
        <p className="mt-1 text-sm text-[#475569]">{project.typ === "domena" ? "Domena" : "LinkedIn"} • {project.domenaLubKanal}</p>

        <div className="mt-3 grid gap-2 text-xs text-[#64748B] md:grid-cols-2">
          <p>Okres: {periodLabel}</p>
          <p>Wygenerowano: {generatedAtLabel}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PlanBadge planId={planId} />
          <TokenPill state={tokenState} />
        </div>
      </header>

      <section className="print-section mb-4">
        <ProjectPerformanceDashboard kpis={kpis} />
      </section>

      <section className="print-section mb-4">
        <TeamPerformanceTable rows={teamRows} />
      </section>

      <section className="print-section mb-4">
        <ProjectInsightsPanel insights={insights} />
      </section>

      <section className="print-section mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h3 className="text-base font-semibold text-[#0F172A]">Publikacje</h3>
        <p className="mt-1 text-sm text-[#64748B]">Skrót operacyjny publikacji projektu (limit 10 pozycji na sekcję).</p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {sections.map((section) => (
            <PublicationSection key={section.title} section={section} />
          ))}
        </div>
      </section>

      <footer className="print-section mt-6 border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B]">
        <p>Wygenerowano w Content Control Tower</p>
      </footer>
    </div>
  );
}
