import Link from "next/link";

type PortfolioAlertItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

type PortfolioAlertsProps = {
  alerts: PortfolioAlertItem[];
};

export function PortfolioAlerts({ alerts }: PortfolioAlertsProps) {
  return (
    <section className="rounded-3xl border border-[#FECACA] bg-[#FFF7F7] p-6 shadow-[0_8px_30px_rgba(239,68,68,0.08)]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#7F1D1D]">Wymaga uwagi</h3>
        <p className="mt-1 text-sm text-[#991B1B]">Wykryte sygnały ryzyka w portfolio projektów.</p>
      </div>

      {alerts.length === 0 ? (
        <p className="rounded-2xl border border-[#FECACA] bg-white px-4 py-3 text-sm text-[#7F1D1D]">Brak aktywnych alertów.</p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-2xl border border-[#FECACA] bg-white p-4">
              <p className="text-sm font-semibold text-[#7F1D1D]">{alert.title}</p>
              <p className="mt-1 text-sm text-[#991B1B]">{alert.description}</p>
              <Link href={alert.href} className="mt-3 inline-flex text-sm font-medium text-[#B91C1C] hover:underline">
                {alert.ctaLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
