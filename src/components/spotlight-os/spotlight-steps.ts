import type { SpotlightStep } from "./spotlight-types";

export function addFirstContentStep(): SpotlightStep {
  return {
    id: "add-first-content",
    title: "Dodaj pierwszą treść",
    body: "Zacznij od jednego elementu. System od razu pokaże priorytety i dalsze kroki.",
    why: "To uruchamia pełny przepływ operacyjny i pierwsze sygnały jakości.",
    selector: '[data-cct="next-best-action"]',
    primaryLabel: "Dalej",
    secondaryLabel: "Pomiń",
    action: "next",
  };
}

export function planPublicationStep(): SpotlightStep {
  return {
    id: "plan-publication",
    title: "Zaplanuj publikację",
    body: "Następnie ustaw publikację. To porządkuje kolejkę i obniża ryzyko zatorów.",
    why: "Stabilny plan publikacji zwiększa przewidywalność realizacji.",
    selector: '[data-cct="priority-banner"]',
    primaryLabel: "Dalej",
    secondaryLabel: "Pomiń",
    action: "next",
  };
}

export function analyzeFlowStep(): SpotlightStep {
  return {
    id: "analyze-flow",
    title: "Zobacz jak system analizuje przepływ",
    body: "Silnik wskazuje bottlenecki, presję SLA i punkty przeciążenia.",
    why: "Dzięki temu decyzje o priorytetach są szybsze i bardziej trafne.",
    selector: '[data-cct="priority-banner"]',
    primaryLabel: "Dalej",
    secondaryLabel: "Pomiń",
    action: "next",
  };
}

export function decisionLabStep(): SpotlightStep {
  return {
    id: "run-first-simulation",
    title: "Uruchom pierwszą symulację",
    body: "Sprawdź wpływ zmian na przepustowość zanim wdrożysz je w workflow.",
    why: "Symulacja ogranicza koszt błędnych decyzji operacyjnych.",
    selector: '[data-cct="decision-lab-trigger"]',
    primaryLabel: "Wykonaj",
    secondaryLabel: "Pomiń",
    action: "openDecisionLab",
  };
}

export function commandOsStep(): SpotlightStep {
  return {
    id: "command-os",
    title: "Steruj szybciej klawiaturą",
    body: "Skrót otwiera skróconą nawigację do kluczowych działań operacyjnych.",
    why: "To skraca czas przejścia między decyzją a wykonaniem.",
    selector: '[data-cct="command-os-hint"]',
    primaryLabel: "Gotowe",
    secondaryLabel: "Pomiń",
    action: "openCommandOS",
  };
}
