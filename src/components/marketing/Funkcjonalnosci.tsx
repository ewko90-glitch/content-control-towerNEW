const steps = [
  {
    num: "01",
    title: "Podłącz swoje konta social media",
    description:
      "Kilka kliknięć i Social AI Studio ma dostęp do Twojego Instagrama, Facebooka, LinkedIn, TikToka i X. Bez skomplikowanej konfiguracji.",
    visual: [
      "Instagram podłączony ✓",
      "Facebook podłączony ✓",
      "LinkedIn podłączony ✓",
      "TikTok podłączony ✓",
    ],
  },
  {
    num: "02",
    title: "AI generuje treści dla Twojej marki",
    description:
      "Podaj temat, ton i platformę. Asystent AI napisze gotowy post z hashtagami, emoji i CTA — dopasowany do algorytmu każdej platformy.",
    visual: [
      'Wpisz temat: "Nowy produkt w ofercie"',
      "Wybierz ton: profesjonalny",
      "Kliknij: Generuj post",
      "Gotowe w 3 sekundy 🚀",
    ],
  },
  {
    num: "03",
    title: "Zaplanuj i publikuj automatycznie",
    description:
      "Wybierz datę i godzinę. Social AI Studio opublikuje post dokładnie wtedy, kiedy Twoja społeczność jest najbardziej aktywna.",
    visual: [
      "Pon 9:00 — Instagram post",
      "Wt 12:00 — LinkedIn artykuł",
      "Czw 18:00 — Facebook reel",
    ],
  },
];

export function Funkcjonalnosci() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">
            JAK TO DZIAŁA
          </span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Trzy kroki do pełnej automatyzacji
          </h2>
          <p className="mt-4 text-gray-500">
            Bez technicznej wiedzy. Bez godzin spędzonych na pisaniu postów.
          </p>
        </div>

        <div className="mt-16 space-y-16">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className={`flex flex-col gap-10 md:flex-row md:items-center ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="flex-1">
                <span className="text-5xl font-black text-[#EEF2FF]">
                  {step.num}
                </span>
                <h3 className="mt-2 text-2xl font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-3 leading-relaxed text-gray-500">
                  {step.description}
                </p>
              </div>
              <div className="flex-1">
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                  {step.visual.map((line) => (
                    <div
                      key={line}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                    >
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#5B7CFA]" />
                      <span className="text-sm text-gray-700">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}