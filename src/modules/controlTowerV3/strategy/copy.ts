export const strategyCopy = {
  heroTitle: "Strategic Brain",
  heroSubtitle: "Decyzje operacyjne osadzone w planie strategicznym.",
  badges: {
    aligned: "Aligned",
    atRisk: "At risk",
    drifting: "Drifting",
  },
  emptyStates: {
    noArtifacts: "Brak artefaktów strategicznych. Dodaj pierwszy priorytet, aby uruchomić alignment.",
    noActions: "Masz strategię, ale brak działań operacyjnych do oceny zgodności.",
    drift: "Wykryto dryf strategiczny. Skoryguj priorytety i zamknij pętle decyzyjne.",
  },
  recommendationsTitle: "Recommended Corrections",
  sections: {
    priorities: "Active Priorities",
    experiments: "Experiments",
    hypotheses: "Hypotheses",
    assumptions: "Assumptions",
    decisions: "Decisions",
    archive: "Archive",
  },
  cta: {
    addPriority: "Add priority",
    archiveOutdated: "Archive outdated",
    soon: "Wkrótce — połączymy to z Decision Lab",
  },
} as const;
