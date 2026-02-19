type PortfolioRecommendationsProps = {
  items: string[];
};

export function PortfolioRecommendations({ items }: PortfolioRecommendationsProps) {
  return (
    <section className="rounded-3xl border border-[#D9F99D] bg-[#F7FEE7] p-6 shadow-[0_8px_30px_rgba(132,204,22,0.08)]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#365314]">Rekomendacje</h3>
        <p className="mt-1 text-sm text-[#4D7C0F]">Najbliższe kroki, które poprawią rytm publikacji.</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-[#D9F99D] bg-white px-4 py-3 text-sm text-[#365314]">Portfolio wygląda stabilnie. Utrzymuj obecne tempo.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-2xl border border-[#D9F99D] bg-white px-4 py-3 text-sm text-[#3F6212]">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
