const features = [
  {
    icon: "🤖",
    title: "Asystent AI",
    description: "Generuj gotowe posty, caption do zdjęć i odpowiedzi na komentarze jednym kliknięciem.",
  },
  {
    icon: "📅",
    title: "Publikator",
    description: "Planuj i automatycznie publikuj posty na wszystkich platformach ze wspólnego kalendarza.",
  },
  {
    icon: "📥",
    title: "Social Inbox",
    description: "Wszystkie wiadomości, komentarze i recenzje z Instagrama, Facebooka i LinkedIn w jednym miejscu.",
  },
  {
    icon: "📊",
    title: "Analityka",
    description: "Mierz zasięgi, zaangażowanie i wzrost obserwujących. Porównuj tygodnie i miesiące.",
  },
  {
    icon: "📝",
    title: "Raporty",
    description: "Automatycznie generuj raporty PDF dla klientów lub szefa — ze swoim logo i danymi.",
  },
  {
    icon: "✍️",
    title: "Zarządzanie Blogiem",
    description: "Pisz artykuły, planuj publikacje i automatycznie trasuj treści blogowe na social media.",
  },
  {
    icon: "🔍",
    title: "SEO i słowa kluczowe",
    description: "Analiza słów kluczowych, integracja z Google Search Console i AI optymalizacja treści pod Google.",
  },
  {
    icon: "👥",
    title: "Zarządzanie zespółem",
    description: "Dziel się dostępem z copywriterem, grafikiem lub klientem. Róle i uprawnienia.",
  },
  {
    icon: "🔔",
    title: "Auto-moderacja",
    description: "Automatycznie odpowiadaj na częste pytania, ukrywaj spam i chroń markę na social mediach.",
  },
];

export function JakToDziala() {
  return (
    <section id="funkcje" className="bg-[#F8FAFC] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">FUNKCJE</span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Wszystko czego potrzebujesz</h2>
          <p className="mt-4 text-gray-500">Jedno narzędzie zamiast 5 oddzielnych aplikacji.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-[#5B7CFA]/30 hover:shadow-lg">
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}