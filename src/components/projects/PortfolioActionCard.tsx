import Link from "next/link";

import type { PortfolioAction } from "@/lib/portfolio/portfolioRecommendations";

type PortfolioActionCardProps = {
  action: PortfolioAction;
};

const priorityClasses: Record<PortfolioAction["priorytet"], string> = {
  wysoki: "border-rose-200 bg-rose-50 text-rose-700",
  sredni: "border-amber-200 bg-amber-50 text-amber-700",
  niski: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function PortfolioActionCard({ action }: PortfolioActionCardProps) {
  return (
    <article className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0F172A]">{action.tytul}</h3>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClasses[action.priorytet]}`}>
          {action.priorytet}
        </span>
      </div>

      <p className="mt-3 text-xs text-[#334155]"><span className="font-medium">Dlaczego teraz:</span> {action.dlaczegoTeraz}</p>
      <p className="mt-2 text-xs text-[#64748B]"><span className="font-medium text-[#475569]">Jeśli pominiesz:</span> {action.jesliPominiesz}</p>

      <Link href={action.ctaHref} className="mt-4 inline-flex h-8 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#334155] hover:bg-white">
        {action.ctaLabel}
      </Link>
    </article>
  );
}
