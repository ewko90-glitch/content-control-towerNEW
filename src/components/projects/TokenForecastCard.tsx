import Link from "next/link";

type TokenForecastCardProps = {
  saldo: number;
  limitLabel: string;
  renewalLabel: string;
  forecastLabel: string;
  estimatedDailyBurnLabel: string;
  isHighUsage: boolean;
};

export function TokenForecastCard({
  saldo,
  limitLabel,
  renewalLabel,
  forecastLabel,
  estimatedDailyBurnLabel,
  isHighUsage,
}: TokenForecastCardProps) {
  return (
    <article className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <h3 className="text-lg font-semibold text-[#0F172A]">Saldo tokenów</h3>
      <p className="mt-1 text-sm text-[#475569]">Aktualny budżet AI i prognoza zużycia.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#F8FAFF] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#64748B]">Saldo</p>
          <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{saldo}</p>
        </div>
        <div className="rounded-2xl bg-[#F8FAFF] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#64748B]">Limit</p>
          <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{limitLabel}</p>
        </div>
        <div className="rounded-2xl bg-[#F8FAFF] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#64748B]">Odnowienie</p>
          <p className="mt-1 text-sm font-medium text-[#0F172A]">{renewalLabel}</p>
        </div>
        <div className="rounded-2xl bg-[#F8FAFF] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#64748B]">Szacowany czas do wyczerpania</p>
          <p className="mt-1 text-sm font-medium text-[#0F172A]">{forecastLabel}</p>
          <p className="mt-1 text-xs text-[#64748B]">{estimatedDailyBurnLabel}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#475569]">AI można wyłączyć/nie używać, system działa manualnie.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {saldo === 0 ? (
          <Link
            href="/pricing#plans"
            className="inline-flex h-9 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#4F6EF5]"
          >
            Dokup tokeny
          </Link>
        ) : null}
        {isHighUsage ? (
          <a
            href="#token-usage-list"
            className="inline-flex h-9 items-center justify-center rounded-2xl border border-[#CBD5E1] px-4 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            Zobacz projekty najbardziej używające AI
          </a>
        ) : null}
      </div>
    </article>
  );
}
