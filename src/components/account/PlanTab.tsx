"use client";
// account tab: plan

import { useState } from "react";

type Props = {
  plan: { tier: string; seatsLimit: number; projectsLimit: number; aiCreditsMonthly: number } | null;
  usage: { seatsUsed: number; projectsUsed: number } | null;
  workspaceId: string;
};

const PLANS = [
  {
    key: "SOLO",
    name: "Solo",
    price: 25,
    priceYear: 20,
    description: "Idealne na start — dla freelancerów i twórców.",
    color: "border-gray-200",
    highlight: false,
    features: [
      "1 użytkownik",
      "2 projekty",
      "5 kanałów social media",
      "1 000 kredytów AI / msc",
      "Kalendarz treści",
      "Edytor postów",
    ],
    seats: 1,
    projects: 2,
    ai: "1 000 kredytów AI",
  },
  {
    key: "STARTER",
    name: "Starter",
    price: 79,
    priceYear: 63,
    description: "Dla małych firm i agencji zaczynających ze social media.",
    color: "border-[#5B7CFA]",
    highlight: true,
    badge: "Najpopularniejszy",
    features: [
      "3 użytkowników",
      "10 projektów",
      "20 kanałów social media",
      "5 000 kredytów AI / msc",
      "Kalendarz treści",
      "Edytor postów + AI",
      "Statystyki podstawowe",
      "Zarządzanie zespołem per-projekt",
    ],
    seats: 3,
    projects: 10,
    ai: "5 000 kredytów AI",
  },
  {
    key: "PRO",
    name: "Pro",
    price: 159,
    priceYear: 127,
    description: "Pełna automatyzacja dla rozwijających się agencji.",
    color: "border-gray-200",
    highlight: false,
    features: [
      "10 użytkowników",
      "30 projektów",
      "60 kanałów social media",
      "20 000 kredytów AI / msc",
      "Wszystko z Starter +",
      "Analityka zaawansowana",
      "Automatyczne raporty PDF",
      "AI do pisania postów (bez limitu)",
      "Priorytetowe wsparcie",
    ],
    seats: 10,
    projects: 30,
    ai: "20 000 kredytów AI",
  },
  {
    key: "CONTROL",
    name: "Agencja",
    price: 349,
    priceYear: 279,
    description: "Dla agencji obsługujących wielu klientów naraz.",
    color: "border-gray-200",
    highlight: false,
    features: [
      "25 użytkowników",
      "Nielimitowane projekty",
      "Nielimitowane kanały",
      "AI unlimited",
      "Wszystko z Pro +",
      "White-label raporty",
      "Dedykowany opiekun",
      "SLA 99.9%",
    ],
    seats: 25,
    projects: 999,
    ai: "Unlimited AI",
  },
];

const LEVELS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

function ProgressBar({ pct }: { pct: number }) {
  const filled = LEVELS.filter((l) => l <= pct).length;
  return (
    <div className="mt-1 flex h-1.5 w-24 gap-px overflow-hidden rounded-full">
      {LEVELS.map((l, i) => (
        <div
          key={l}
          className={`flex-1 ${i < filled ? "bg-[#5B7CFA]" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

export function PlanTab({ plan, usage, workspaceId }: Props) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const currentTier = plan?.tier ?? "STARTER";

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Plan & Płatność</h1>
        <p className="text-sm text-gray-500">Wybierz plan dopasowany do Twojego zespołu.</p>
      </div>

      {/* Current plan status */}
      {plan && (
        <div className="rounded-2xl border border-[#5B7CFA]/30 bg-[#5B7CFA]/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5B7CFA]">
                Aktywny plan
              </p>
              <p className="text-lg font-bold text-gray-900">{currentTier}</p>
            </div>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="text-gray-500">Użytkownicy</p>
                <p className="font-semibold text-gray-900">
                  {usage?.seatsUsed ?? 1} / {plan.seatsLimit}
                </p>
                <ProgressBar pct={Math.min(100, ((usage?.seatsUsed ?? 1) / plan.seatsLimit) * 100)} />
              </div>
              <div>
                <p className="text-gray-500">Projekty</p>
                <p className="font-semibold text-gray-900">
                  {usage?.projectsUsed ?? 1} / {plan.projectsLimit}
                </p>
                <ProgressBar pct={Math.min(100, ((usage?.projectsUsed ?? 1) / plan.projectsLimit) * 100)} />
              </div>
              <div>
                <p className="text-gray-500">AI kredyty / msc</p>
                <p className="font-semibold text-gray-900">
                  {plan.aiCreditsMonthly.toLocaleString("pl")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex items-center gap-4">
        <div className="flex rounded-xl border border-gray-200 bg-white p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${billing === "monthly" ? "bg-[#5B7CFA] text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            Miesięcznie
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${billing === "yearly" ? "bg-[#5B7CFA] text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            Rocznie
          </button>
        </div>
        {billing === "yearly" && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Oszczędzasz do 20% rocznie
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const price = billing === "yearly" ? p.priceYear : p.price;
          const isCurrent = currentTier === p.key;

          return (
            <div
              key={p.key}
              className={`relative rounded-2xl border-2 bg-white p-6 ${p.color} ${p.highlight ? "shadow-lg shadow-[#5B7CFA]/10" : ""}`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5B7CFA] px-3 py-0.5 text-xs font-bold text-white">
                  {p.badge}
                </span>
              )}
              <div className="mb-4">
                <p className="font-bold text-gray-900">{p.name}</p>
                <p className="mt-1 text-xs text-gray-500">{p.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-black text-gray-900">{price} zł</span>
                <span className="text-sm text-gray-500">/msc</span>
                {billing === "yearly" && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    Rozliczane rocznie ({price * 12} zł/rok)
                  </p>
                )}
              </div>
              <ul className="mb-6 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 text-[#5B7CFA]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="rounded-xl border-2 border-[#5B7CFA] py-2 text-center text-sm font-semibold text-[#5B7CFA]">
                  Aktualny plan
                </div>
              ) : (
                <button className={`w-full rounded-xl py-2 text-sm font-bold transition-opacity hover:opacity-90 ${p.highlight ? "bg-[#5B7CFA] text-white" : "bg-gray-900 text-white"}`}>
                  {currentTier === "SOLO" && p.key !== "SOLO" ? "Przejdź na " : "Wybierz "}{p.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        Wszystkie plany zawierają 14-dniowy trial. Płatność kartą przez Stripe. Faktura VAT w komplecie.
        Masz pytanie? <a href="mailto:hello@socialai.studio" className="text-[#5B7CFA] hover:underline">Napisz do nas</a>.
      </p>
    </div>
  );
}
