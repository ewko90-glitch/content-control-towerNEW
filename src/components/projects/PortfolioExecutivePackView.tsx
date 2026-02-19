import { PlanBadge } from "@/components/billing/PlanBadge";
import { TokenPill } from "@/components/billing/TokenPill";
import { PortfolioActionCards } from "@/components/projects/PortfolioActionCards";
import { PortfolioOverview, type PortfolioOverviewData } from "@/components/projects/PortfolioOverview";
import { TokenCenter, type TokenCenterData } from "@/components/projects/TokenCenter";
import type { PortfolioAction } from "@/lib/portfolio/portfolioRecommendations";

type AttentionProject = {
  projectId: string;
  projectName: string;
  score: number;
  reason: string;
};

type AggregatedPublication = {
  id: string;
  dateISO: string;
  title: string;
  projectName: string;
  assigneeName?: string;
};

type PublicationSection = {
  title: string;
  items: AggregatedPublication[];
  remainingCount: number;
};

type PortfolioExecutivePackViewProps = {
  generatedAtLabel: string;
  planId: "starter" | "growth" | "control_tower" | "enterprise";
  tokenState: {
    saldo: number;
    odnowienieISO: string;
    planMiesiecznyLimit: number | "bez_limitu";
  };
  workspaceSlug: string;
  portfolioData: PortfolioOverviewData;
  tokenCenterData: TokenCenterData;
  actions: PortfolioAction[];
  attentionProjects: AttentionProject[];
  publicationSections: PublicationSection[];
};

function PublicationListSection({ section }: { section: PublicationSection }) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <h4 className="text-sm font-semibold text-[#0F172A]">{section.title}</h4>
      {section.items.length === 0 ? (
        <p className="mt-2 text-sm text-[#64748B]">Brak pozycji.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {section.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm">
              <p className="font-medium text-[#0F172A]">{item.title}</p>
              <p className="mt-1 text-xs text-[#64748B]">
                {item.dateISO.slice(0, 10)} • {item.projectName} • {item.assigneeName ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {section.remainingCount > 0 ? <p className="mt-2 text-xs text-[#64748B]">+{section.remainingCount} więcej</p> : null}
    </article>
  );
}

export function PortfolioExecutivePackView({
  generatedAtLabel,
  planId,
  tokenState,
  workspaceSlug,
  portfolioData,
  tokenCenterData,
  actions,
  attentionProjects,
  publicationSections,
}: PortfolioExecutivePackViewProps) {
  return (
    <section className="portfolio-executive-pack mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .portfolio-executive-pack {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hide,
          .print-hide * {
            display: none !important;
          }
          .portfolio-executive-pack * {
            box-shadow: none !important;
          }
          .portfolio-executive-pack a,
          .portfolio-executive-pack button {
            display: none !important;
          }
        }
      `}</style>

      <div className="print-hide mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-3">
        <a href="javascript:window.print()" className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0F172A] px-4 text-sm font-medium text-white">
          Drukuj / Zapisz jako PDF
        </a>
        <button disabled className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-sm text-[#94A3B8]">
          Pobierz PDF
        </button>
        <span className="inline-flex rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-xs text-[#64748B]">Wkrótce</span>
      </div>

      <header className="mb-6 rounded-3xl border border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFF] to-white p-6">
        <p className="text-xs uppercase tracking-wide text-[#64748B]">Raport portfolio</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#0F172A]">Podsumowanie operacyjne</h1>
        <p className="mt-2 text-sm text-[#475569]">Podsumowanie operacyjne projektów i planu publikacji.</p>
        <p className="mt-1 text-xs text-[#64748B]">Wygenerowano: {generatedAtLabel}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PlanBadge planId={planId} />
          <TokenPill state={tokenState} />
        </div>
      </header>

      <PortfolioOverview data={portfolioData} workspaceSlug={workspaceSlug} />
      <div id="tokeny">
        <TokenCenter data={tokenCenterData} />
      </div>
      <PortfolioActionCards actions={actions} />

      <section className="mb-8 rounded-3xl border border-[#E2E8F0] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#0F172A]">Projekty wymagające uwagi</h2>
        <p className="mt-1 text-sm text-[#64748B]">Top 5 projektów według score ryzyka operacyjnego.</p>

        {attentionProjects.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-sm text-[#166534]">Brak projektów z podwyższonym ryzykiem.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attentionProjects.map((item) => (
              <li key={item.projectId} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">{item.projectName}</p>
                  <span className="inline-flex rounded-full border border-[#FECACA] bg-[#FFF1F2] px-2 py-0.5 text-xs font-medium text-[#BE123C]">Score: {item.score}</span>
                </div>
                <p className="mt-1 text-sm text-[#475569]">{item.reason}</p>
                <a href={`/projects/${item.projectId}/wyniki`} className="mt-2 inline-flex text-xs font-medium text-[#5B7CFA] hover:underline">
                  Przejdź do wyników projektu
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-3xl border border-[#E2E8F0] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#0F172A]">Agregacja publikacji</h2>
        <p className="mt-1 text-sm text-[#64748B]">Przegląd publikacji cross-project dla okna 7 dni i zaległości.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {publicationSections.map((section) => (
            <PublicationListSection key={section.title} section={section} />
          ))}
        </div>
      </section>

      <footer className="border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B]">
        <p>Wygenerowano w Content Control Tower</p>
        <p className="mt-1">Tryb: podgląd raportu</p>
      </footer>
    </section>
  );
}
