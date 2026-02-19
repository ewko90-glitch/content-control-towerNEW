import { PortfolioActionCard } from "@/components/projects/PortfolioActionCard";
import type { PortfolioAction } from "@/lib/portfolio/portfolioRecommendations";

type PortfolioActionCardsProps = {
  actions: PortfolioAction[];
};

export function PortfolioActionCards({ actions }: PortfolioActionCardsProps) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-[#0F172A]">Globalne rekomendacje</h2>
        <p className="mt-1 text-sm text-[#64748B]">Najważniejsze działania cross-project wynikające z deterministycznych reguł portfolio.</p>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] p-4 text-sm text-[#166534]">Brak krytycznych działań w tym momencie.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <PortfolioActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </section>
  );
}
