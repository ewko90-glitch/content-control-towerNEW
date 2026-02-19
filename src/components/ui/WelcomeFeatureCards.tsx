const featureCards = [
  {
    bg: "bg-gradient-to-br from-yellow-100 to-yellow-50",
    accent: "text-yellow-600",
    icon: "📅",
    title: "Kalendarz treści",
    description:
      "Planuj i zarządzaj publikacjami na wszystkich kanałach w jednym miejscu. Nigdy więcej spóźnionych postów.",
    cta: "Otwórz kalendarz",
    href: "#calendar",
  },
  {
    bg: "bg-gradient-to-br from-blue-100 to-blue-50",
    accent: "text-blue-600",
    icon: "✍️",
    title: "AI do pisania treści",
    description:
      "Generuj posty na LinkedIn, Instagram, blog i więcej — AI dostosowuje ton do Twojej marki i grupy docelowej.",
    cta: "Napisz post",
    href: "#write",
  },
  {
    bg: "bg-gradient-to-br from-purple-100 to-purple-50",
    accent: "text-purple-600",
    icon: "📊",
    title: "Statystyki i raporty",
    description:
      "Śledź zasięgi, zaangażowanie i wyniki SEO. Automatyczne raporty gotowe do wysyłki klientowi.",
    cta: "Zobacz statystyki",
    href: "#stats",
  },
];

export function WelcomeFeatureCards({ workspaceSlug }: { workspaceSlug: string }) {
  const links: Record<string, string> = {
    "#calendar": `/w/${workspaceSlug}/calendar`,
    "#write": `/w/${workspaceSlug}/content?new=1`,
    "#stats": `/w/${workspaceSlug}/portfolio`,
  };

  return (
    <div className="mt-6 space-y-4">
      {featureCards.map((card) => (
        <div
          key={card.title}
          className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-[#E4E7F2] bg-white shadow-sm sm:flex-row"
        >
          {/* Illustration / colored panel */}
          <div
            className={`flex min-h-[100px] w-full items-center justify-center text-6xl sm:w-48 sm:min-h-full ${card.bg}`}
          >
            {card.icon}
          </div>

          {/* Text + CTA */}
          <div className="flex flex-1 flex-col justify-center px-6 py-5">
            <p className={`text-xs font-bold uppercase tracking-wider ${card.accent}`}>
              Social AI Studio
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#1C2240]">{card.title}</h3>
            <p className="mt-1 text-sm text-[#6E7693]">{card.description}</p>
            <div className="mt-4">
              <a
                href={links[card.href] ?? card.href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#5B7CFA] px-4 py-2 text-sm font-semibold text-[#5B7CFA] transition hover:bg-[#5B7CFA] hover:text-white"
              >
                {card.cta} →
              </a>
            </div>
          </div>
        </div>
      ))}

      {/* Support card */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E4E7F2] bg-white p-6 shadow-sm">
          <div className="mb-2 text-3xl">💬</div>
          <h4 className="font-bold text-[#1C2240]">Potrzebujesz pomocy?</h4>
          <p className="mt-1 text-sm text-[#6E7693]">
            Napisz do nas lub przejrzyj bazę wiedzy — jesteśmy tu, żeby pomóc.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="mailto:kontakt@socialAIstudio.pl"
              className="rounded-xl bg-[#5B7CFA] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Wyślij wiadomość
            </a>
            <a
              href="/blog"
              className="rounded-xl border border-[#E4E7F2] px-4 py-2 text-sm font-medium text-[#1C2240] transition hover:bg-[#F4F6FB]"
            >
              Baza wiedzy
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E7F2] bg-white p-6 shadow-sm">
          <div className="mb-2 text-3xl">🚀</div>
          <h4 className="font-bold text-[#1C2240]">Zaproś swój zespół</h4>
          <p className="mt-1 text-sm text-[#6E7693]">
            Pracuj razem — przypisuj zadania, komentuj drafty i publikuj synergicznie.
          </p>
          <div className="mt-4">
            <a
              href="/account"
              className="rounded-xl border border-[#E4E7F2] px-4 py-2 text-sm font-medium text-[#1C2240] transition hover:bg-[#F4F6FB]"
            >
              Zaproś członków →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
