const steps = [
  {
    title: "Tworzysz markę",
    description: "Wpisujesz nazwę, ton, słowa kluczowe i linkowania. Raz. AI już zawsze będzie wiedzieć jak pisać.",
  },
  {
    title: "Planujesz kalendarz",
    description: "Wybierasz dni i kanały. Aplikacja proponuje tematy spójne z Twoją strategią.",
  },
  {
    title: "Piszesz z AI",
    description: "Klikasz post, AI generuje tekst z Twoimi słowami kluczowymi, hashtagami i linkowaniami.",
  },
];

export function JakToDziala() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold text-[#0F172A]">Jak to działa</h2>
        <p className="mt-3 max-w-3xl text-[#475569]">
          Trzy kroki od chaosu do systemu.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <h3 className="text-lg font-semibold text-[#0F172A]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#475569]">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}