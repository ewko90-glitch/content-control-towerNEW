type ProjectPerformanceKpis = {
  upcomingCount: number;
  publishedCount: number;
  unassignedUpcomingCount: number;
  overdueCount: number;
  draftsCount: number;
  staleDraftsCount: number;
};

type ProjectPerformanceDashboardProps = {
  kpis: ProjectPerformanceKpis;
};

function KpiCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFF] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{value}</p>
      <p className="mt-1 text-xs text-[#64748B]">{hint}</p>
    </article>
  );
}

export function ProjectPerformanceDashboard({ kpis }: ProjectPerformanceDashboardProps) {
  return (
    <section className="mb-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Nadchodzące 7 dni" value={kpis.upcomingCount} hint="Publikacje z datą w ciągu 7 dni." />
        <KpiCard label="Opublikowane 7 dni" value={kpis.publishedCount} hint="Status opublikowane w oknie 7 dni." />
        <KpiCard label="Bez przypisania" value={kpis.unassignedUpcomingCount} hint="Nadchodzące publikacje bez właściciela." />
        <KpiCard label="Zaległe" value={kpis.overdueCount} hint="Termin minął i publikacja nie jest opublikowana." />
        <KpiCard label="Szkice" value={kpis.draftsCount} hint="Cały backlog szkiców projektu." />
        <KpiCard label="Nieaktywne szkice" value={kpis.staleDraftsCount} hint="Szkice starsze niż 7 dni." />
      </div>
    </section>
  );
}
