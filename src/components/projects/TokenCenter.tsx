import { TokenForecastCard } from "@/components/projects/TokenForecastCard";
import { TokenUsageList } from "@/components/projects/TokenUsageList";

type TokenUsageItem = {
  label: string;
  count: number;
};

export type TokenCenterData = {
  saldo: number;
  limitLabel: string;
  renewalLabel: string;
  forecastLabel: string;
  estimatedDailyBurnLabel: string;
  isHighUsage: boolean;
  topKinds: TokenUsageItem[];
  topProjects: TokenUsageItem[];
};

type TokenCenterProps = {
  data: TokenCenterData;
};

export function TokenCenter({ data }: TokenCenterProps) {
  return (
    <section className="mb-8 space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Token Center</h2>
        <p className="mt-1 text-sm text-[#475569]">Kontrola budżetu AI i najczęstszych konsumentów tokenów.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <TokenForecastCard
          saldo={data.saldo}
          limitLabel={data.limitLabel}
          renewalLabel={data.renewalLabel}
          forecastLabel={data.forecastLabel}
          estimatedDailyBurnLabel={data.estimatedDailyBurnLabel}
          isHighUsage={data.isHighUsage}
        />
        <TokenUsageList topKinds={data.topKinds} topProjects={data.topProjects} />
      </div>
    </section>
  );
}
