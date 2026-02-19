export const intelligenceCopy = {
  priority: {
    critical: {
      title: "Wysokie ryzyko opóźnień",
      subtitlePrefix: "Największy wpływ ma etap",
      cta: "Napraw teraz",
    },
    warning: {
      title: "Wąskie gardło spowalnia zespół",
      subtitle: "Przepływ blokuje się w kluczowym etapie",
      cta: "Otwórz Decision Lab",
    },
    positive: {
      title: "Workflow przyspiesza",
      subtitle: "Throughput rośnie, utrzymaj tempo",
      cta: "Zobacz szczegóły",
    },
    stable: {
      title: "System stabilny",
      subtitle: "Brak krytycznych sygnałów",
      cta: "Uruchom symulację",
    },
    why: "Dlaczego?",
  },
  nextAction: {
    title: "Następny najlepszy krok",
    why: "Dlaczego to ważne?",
    fallbackTitle: "Brak akcji krytycznej",
    fallbackDescription: "System nie wykrył działania wymagającego natychmiastowej interwencji.",
    primaryFallback: "Przejdź do tablicy",
    secondary: "Zobacz dane",
  },
  action: {
    title: "Następny najlepszy krok",
    why: "Dlaczego to ważne?",
    showData: "Pokaż dane",
    throughput: "Wpływ na throughput",
    risk: "Wpływ na ryzyko",
  },
  metrics: {
    throughput: [
      "Throughput to liczba ukończonych treści w tygodniu.",
      "Spadek zwykle oznacza przeciążenie procesu.",
      "Porównuj trend po każdej zmianie workflow.",
    ] as const,
    bottleneck: [
      "Bottleneck wskazuje etap, który blokuje przepływ.",
      "Wysoki indeks oznacza rosnące kolejki i opóźnienia.",
      "Najpierw popraw ten etap, potem resztę.",
    ] as const,
    predictiveRisk: [
      "Predictive risk szacuje ryzyko opóźnień.",
      "Wysokie pressure zwiększa ryzyko przekroczeń SLA.",
      "Reaguj zanim pojawią się zaległości.",
    ] as const,
    decisionLab: [
      "Decision Lab symuluje skutki zmian workflow.",
      "Uruchom scenariusz zanim zmienisz proces.",
      "Porównuj wpływ na throughput i ryzyko.",
    ] as const,
  },
  help: {
    throughput: [
      "Throughput to liczba ukończonych treści w tygodniu.",
      "Spadek zwykle oznacza przeciążenie procesu.",
      "Porównuj trend po każdej zmianie workflow.",
    ] as const,
    bottleneck: [
      "Bottleneck wskazuje etap, który blokuje przepływ.",
      "Wysoki indeks oznacza rosnące kolejki i opóźnienia.",
      "Najpierw popraw ten etap, potem resztę.",
    ] as const,
    predictiveRisk: [
      "Predictive risk szacuje ryzyko opóźnień.",
      "Wysokie pressure zwiększa ryzyko przekroczeń SLA.",
      "Reaguj zanim pojawią się zaległości.",
    ] as const,
    decisionLab: [
      "Decision Lab symuluje skutki zmian workflow.",
      "Uruchom scenariusz zanim zmienisz proces.",
      "Porównuj wpływ na throughput i ryzyko.",
    ] as const,
  },
  empty: {
    noContent: {
      title: "Zacznij od pierwszej treści",
      subtitle: "Dodaj element, aby uruchomić operacyjne wskazówki.",
      cta: "Dodaj treść",
    },
    noPublicationPlan: {
      title: "Brak planu publikacji",
      subtitle: "Zaplanuj publikacje, aby system mógł ocenić obciążenie.",
      cta: "Zaplanuj publikacje",
    },
    noSignals: {
      title: "System potrzebuje danych",
      subtitle: "Dodaj kilka publikacji aby zobaczyć analizy.",
      cta: "Dodaj treść",
    },
    workspace: {
      title: "Zacznij od pierwszej treści",
      subtitle: "Dodaj element, aby uruchomić operacyjne wskazówki.",
      ctaPrimary: "Dodaj treść",
      ctaSecondary: "Skonfiguruj workflow",
    },
    signals: {
      title: "System potrzebuje danych",
      subtitle: "Dodaj kilka publikacji aby zobaczyć analizy.",
      ctaPrimary: "Dodaj treść",
    },
    metrics: {
      title: "Brak planu publikacji",
      subtitle: "Zaplanuj publikacje, aby system mógł ocenić obciążenie.",
      ctaPrimary: "Zaplanuj publikacje",
    },
  },
} as const;
