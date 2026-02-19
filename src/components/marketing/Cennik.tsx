"use client";

import { useState } from "react";

type BillingMode = "miesiecznie" | "rocznie";

type Plan = {
  name: "Starter" | "Growth" | "Control Tower" | "Enterprise";
  monthlyPrice: string;
  yearlyPrice: string;
  projects: string;
  tokens: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: "99 zł",
    yearlyPrice: "79 zł",
    projects: "1 projekt",
    tokens: "20 000 tokenów",
    features: ["Podstawowy plan AI", "Kalendarz publikacji", "Tryb ręczny"],
  },
  {
    name: "Growth",
    monthlyPrice: "249 zł",
    yearlyPrice: "199 zł",
    projects: "3 projekty",
    tokens: "80 000 tokenów",
    features: ["Zaawansowane rekomendacje", "ROI i analiza", "Wsparcie zespołu"],
  },
  {
    name: "Control Tower",
    monthlyPrice: "499 zł",
    yearlyPrice: "399 zł",
    projects: "10 projektów",
    tokens: "250 000 tokenów",
    features: ["Executive Digest", "Monitor napięcia", "Automatyzacje operacyjne"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: "Indywidualnie",
    yearlyPrice: "Indywidualnie",
    projects: "Nielimitowane",
    tokens: "Nielimitowane",
    features: ["Dedykowany onboarding", "SLA i bezpieczeństwo", "Wsparcie strategiczne"],
  },
];

export function Cennik() {
  const [billing, setBilling] = useState<BillingMode>("miesiecznie");

  return (
    <section id="cennik" className="bg-[#EEF2FF] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-[#0F172A]">Cennik</h2>
            <p className="mt-3 max-w-2xl text-[#475569]">
              Bez ukrytych opłat. Zmiana planu możliwa w dowolnym momencie.
            </p>
          </div>

          <div className="inline-flex rounded-2xl border border-[#E2E8F0] bg-white p-1">
            <button
              type="button"
              onClick={() => setBilling("miesiecznie")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${billing === "miesiecznie" ? "bg-[#5B7CFA] text-white" : "text-[#475569]"}`}
            >
              Miesięcznie
            </button>
            <button
              type="button"
              onClick={() => setBilling("rocznie")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${billing === "rocznie" ? "bg-[#5B7CFA] text-white" : "text-[#475569]"}`}
            >
              Rocznie
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] ${plan.highlighted ? "border-2 border-[#5B7CFA]" : "border border-[#E2E8F0]"}`}
            >
              {plan.highlighted ? (
                <span className="absolute -top-3 right-6 rounded-2xl bg-[#5B7CFA] px-3 py-1 text-xs font-medium text-white">
                  Polecany
                </span>
              ) : null}

              <h3 className="text-lg font-semibold text-[#0F172A]">{plan.name}</h3>
              <p className="mt-3 text-2xl font-semibold text-[#0F172A]">
                {billing === "miesiecznie" ? plan.monthlyPrice : plan.yearlyPrice}
                <span className="ml-1 text-sm font-normal text-[#94A3B8]">/ mies.</span>
              </p>

              <ul className="mt-5 space-y-2 text-sm text-[#475569]">
                <li>• {plan.projects}</li>
                <li>• {plan.tokens}</li>
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>

              <button
                type="button"
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
              >
                Rozpocznij
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}