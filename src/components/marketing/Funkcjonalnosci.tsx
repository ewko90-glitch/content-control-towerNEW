const features = [
  {
    title: "Strategia AI",
    description: "AI uczy się Twojej marki — ton, słowa kluczowe, grupa docelowa. Każdy post jest spójny z Twoją strategią.",
  },
  {
    title: "Inteligentny kalendarz",
    description: "Planuj posty na LinkedIn, bloga i Instagram w jednym miejscu. Drag & drop, filtry, podgląd tygodnia.",
  },
  {
    title: "Tryb skupienia",
    description: "Pisz jeden post na raz. Bez rozpraszaczy. AI w tle pilnuje SEO, długości i tonu.",
  },
  {
    title: "ROI i analiza",
    description: "Widzisz co publikujesz, ile i jak regularnie. Koniec z chaosem contentowym.",
  },
  {
    title: "Monitor napięcia",
    description: "Zaległości, terminy, posty do napisania — wszystko w jednym widoku dashboard.",
  },
  {
    title: "Tryb zespołowy",
    description: "Zapraszasz współpracowników, delegujesz posty, zatwierdzasz przed publikacją.",
  },
];

export function Funkcjonalnosci() {
  return (
    <section className="bg-[#F6F8FB] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold text-[#0F172A]">Funkcjonalności</h2>
        <p className="mt-3 max-w-3xl text-[#475569]">
          Wszystko, czego potrzebujesz do prowadzenia procesu contentowego end-to-end, bez przełączania narzędzi.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <h3 className="text-lg font-semibold text-[#0F172A]">{feature.title}</h3>
              <p className="mt-2 text-sm text-[#475569]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}