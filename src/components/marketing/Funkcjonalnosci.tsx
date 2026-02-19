const steps = [
  {
    num: "01",
    title: "Pod\u0142\u0105cz swoje konta social media",
    description:
      "Kilka klikni\u0119\u0107 i Social AI Studio ma dost\u0119p do Twojego Instagrama, Facebooka, LinkedIn, TikToka i X. Bez skomplikowanej konfiguracji.",
    visual: [
      "Instagram pod\u0142\u0105czony \u2713",
      "Facebook pod\u0142\u0105czony \u2713",
      "LinkedIn pod\u0142\u0105czony \u2713",
      "TikTok pod\u0142\u0105czony \u2713",
    ],
  },
  {
    num: "02",
    title: "AI generuje tre\u015bci dla Twojej marki",
    description:
      "Podaj temat, ton i platform\u0119. Asystent AI napisze gotowy post z hashtagami, emoji i CTA \u2014 dopasowany do algorytmu ka\u017cdej platformy.",
    visual: [
      'Wpisz temat: "Nowy produkt w ofercie"',
      "Wybierz ton: profesjonalny",
      "Kliknij: Generuj post",
      "Gotowe w 3 sekundy \ud83d\ude80",
    ],
  },
  {
    num: "03",
    title: "Zaplanuj i publikuj automatycznie",
    description:
      "Wybierz dat\u0119 i godzin\u0119. Social AI Studio opublikuje post dok\u0142adnie wtedy, kiedy Twoja spo\u0142eczno\u015b\u0107 jest najbardziej aktywna.",
    visual: [
      "Pon 9:00 \u2014 Instagram post",
      "Wt 12:00 \u2014 LinkedIn artyku\u0142",
      "Czw 18:00 \u2014 Facebook reel",
    ],
  },
];

export function Funkcjonalnosci() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">
            JAK TO DZIA\u0141A
          </span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Trzy kroki do pe\u0142nej automatyzacji
          </h2>
          <p className="mt-4 text-gray-500">
            Bez technicznej wiedzy. Bez godzin sp\u0119dzonych na pisaniu post\u00f3w.
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