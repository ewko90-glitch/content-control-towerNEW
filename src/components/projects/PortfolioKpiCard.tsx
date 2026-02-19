type PortfolioKpiCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function PortfolioKpiCard({ label, value, hint }: PortfolioKpiCardProps) {
  return (
    <article className="rounded-3xl border border-[#E2E8F0] bg-[#F8FAFF] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[#475569]">{hint}</p> : null}
    </article>
  );
}
