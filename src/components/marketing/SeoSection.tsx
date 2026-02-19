const seoFeatures = [
  {
    icon: "🔍",
    title: "Analiza słów kluczowych",
    description:
      "Odkryj, na jakie frazy możesz pozycjonować swoje treści. AI sugeruje słowa kluczowe z potencjałem ruchu zanim zaczniesz pisać.",
  },
  {
    icon: "📈",
    title: "Google Search Console",
    description:
      "Połącz GSC jednym kliknięciem i oglądaj kliknięcia, pozycje i CTR każdego wpisu bloga bezpośrednio w Social AI Studio.",
  },
  {
    icon: "✍️",
    title: "AI pisze pod SEO",
    description:
      "Asystent AI automatycznie wplata słowa kluczowe w treść, dba o nagłówki H1–H3, meta opis i gęstość fraz.",
  },
  {
    icon: "🗺️",
    title: "Mapa tematyczna",
    description:
      "Wizualizuj klastry tematyczne swojego bloga. Widź luki contentowe, które warto wypełnić, żeby wyprzedzić konkurencję.",
  },
  {
    icon: "📰",
    title: "Blog + social w jednym miejscu",
    description:
      "Napisz artykuł, a AI automatycznie stworzy z niego 5 postów na różne platformy. Jeden content — wiele kanałów.",
  },
  {
    icon: "📊",
    title: "Raporty SEO dla klientów",
    description:
      "Generuj PDF-y z danymi z GSC, pozycjami i wzrostami. Gotowe do wysłania klientowi lub szefowi.",
  },
];

export function SeoSection() {
  return (
    <section id="seo" className="bg-[#F8FAFC] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">
            SEO I BLOG
          </span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Treści, które{" "}
            <span className="text-[#5B7CFA]">znajdują się w Google</span>
          </h2>
          <p className="mt-4 text-gray-500 md:text-lg">
            Social AI Studio to nie tylko social media. To także narzędzie do tworzenia bloga, analizy
            słów kluczowych i monitorowania wyników w wyszukiwarce.
          </p>
        </div>

        {/* GSC integration callout */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#5B7CFA]/20 bg-[#EEF2FF] p-6 md:flex-row md:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow">
              <span className="text-2xl">🔗</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Integracja z Google Search Console</p>
              <p className="text-sm text-gray-500">
                Podłącz GSC raz — i widzisz pozycje, kliknięcia i CTR każdej strony prosto w dashboardzie.
              </p>
            </div>
          </div>
          <a
            href="/auth/register"
            className="shrink-0 rounded-xl bg-[#5B7CFA] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Połącz GSC za darmo →
          </a>
        </div>

        {/* Features grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {seoFeatures.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:shadow-md"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-3 font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
