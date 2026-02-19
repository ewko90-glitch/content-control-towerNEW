type UsageItem = {
  label: string;
  count: number;
};

type TokenUsageListProps = {
  topKinds: UsageItem[];
  topProjects: UsageItem[];
};

export function TokenUsageList({ topKinds, topProjects }: TokenUsageListProps) {
  return (
    <article id="token-usage-list" className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <h3 className="text-lg font-semibold text-[#0F172A]">Najczęstsze konsumenty tokenów (7 dni)</h3>
      <p className="mt-1 text-sm text-[#475569]">Zliczenie akcji telemetry z metadanymi `wouldConsumeTokens=true`.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-[#F8FAFF] p-4">
          <h4 className="text-sm font-semibold text-[#334155]">Top 3 akcje AI</h4>
          {topKinds.length === 0 ? (
            <p className="mt-2 text-sm text-[#64748B]">Brak akcji AI w ostatnich 7 dniach.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topKinds.map((item) => (
                <li key={item.label} className="flex items-center justify-between text-sm text-[#475569]">
                  <span>{item.label}</span>
                  <span className="font-semibold text-[#0F172A]">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-[#F8FAFF] p-4">
          <h4 className="text-sm font-semibold text-[#334155]">Top 3 projekty</h4>
          {topProjects.length === 0 ? (
            <p className="mt-2 text-sm text-[#64748B]">Brak danych o projektach w metadanych telemetry.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topProjects.map((item) => (
                <li key={item.label} className="flex items-center justify-between text-sm text-[#475569]">
                  <span>{item.label}</span>
                  <span className="font-semibold text-[#0F172A]">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
