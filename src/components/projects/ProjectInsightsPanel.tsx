"use client";

import Link from "next/link";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { useProjectContext } from "@/components/projects/ProjectContext";

export type ProjectInsight = {
  id: string;
  text: string;
  href: string;
  ctaLabel: string;
  ctaType: "content" | "calendar" | "assign" | "ai_refresh";
};

type ProjectInsightsPanelProps = {
  insights: ProjectInsight[];
};

export function ProjectInsightsPanel({ insights }: ProjectInsightsPanelProps) {
  const { aiStrategyAccess } = useProjectContext();

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[#0F172A]">Insighty</h3>
        <p className="mt-1 text-sm text-[#64748B]">Deterministyczne sygnały i rekomendowane działania operacyjne.</p>
      </div>

      {insights.length === 0 ? (
        <p className="rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-sm text-[#166534]">Brak krytycznych insightów. Projekt działa stabilnie.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li key={insight.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-sm text-[#0F172A]">{insight.text}</p>
              <div className="mt-2">
                {insight.ctaType === "ai_refresh" ? (
                  aiStrategyAccess.status === "ok" ? (
                    <Link href={insight.href} className="inline-flex text-xs font-medium text-[#5B7CFA] hover:underline">
                      {insight.ctaLabel}
                    </Link>
                  ) : (
                    <FeatureLockCard tytulFunkcji="Odśwież plan AI" access={aiStrategyAccess} />
                  )
                ) : (
                  <Link href={insight.href} className="inline-flex text-xs font-medium text-[#5B7CFA] hover:underline">
                    {insight.ctaLabel}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
