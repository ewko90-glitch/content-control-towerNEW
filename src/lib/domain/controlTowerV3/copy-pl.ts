import type { ConfidenceLabel, ImpactLabel } from "./types";

export const IMPACT_LABELS: Readonly<Record<ImpactLabel, string>> = {
  Niski: "Niski",
  Średni: "Średni",
  Wysoki: "Wysoki",
  Krytyczny: "Krytyczny",
};

export const CONFIDENCE_LABELS: Readonly<Record<ConfidenceLabel, string>> = {
  Niska: "Niska",
  Średnia: "Średnia",
  Wysoka: "Wysoka",
};

export const EMPTY_STATE_HEADLINE = "Pierwsze kroki";
export const EMPTY_STATE_STEPS: Readonly<[string, string, string]> = [
  "Dodaj treść",
  "Przenieś do REVIEW",
  "Zaplanuj publikację",
];

export const DISABLED_MESSAGES = {
  managerRequired: "Brak uprawnień: wymagana rola Manager",
  editorRequired: "Brak uprawnień: wymagana rola EDITOR",
  adminRequired: "Brak uprawnień: wymagana rola ADMIN",
  noCredits: "Brak dostępnych kredytów AI",
} as const;

export const ERROR_FALLBACK_MESSAGE = "Nie udało się wczytać panelu dowodzenia. Spróbuj odświeżyć stronę.";

export function impactLabel(score: number): ImpactLabel {
  if (score >= 75) {
    return "Krytyczny";
  }
  if (score >= 50) {
    return "Wysoki";
  }
  if (score >= 25) {
    return "Średni";
  }
  return "Niski";
}

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.75) {
    return "Wysoka";
  }
  if (score >= 0.4) {
    return "Średnia";
  }
  return "Niska";
}

export function healthLabel(score: number): "Świetna forma" | "Stabilnie" | "Wymaga uwagi" | "Krytyczne" {
  if (score >= 85) {
    return "Świetna forma";
  }
  if (score >= 60) {
    return "Stabilnie";
  }
  if (score >= 40) {
    return "Wymaga uwagi";
  }
  return "Krytyczne";
}
