import { permissionFor, permissionForAi } from "./permissions";
import type { Metrics, PrioritySignal, WorkspaceContext } from "./types";
import { makeConfidence, makeImpact, severityFromImpact } from "./explain";

function build(
  key: string,
  title: string,
  description: string,
  why: string,
  impactScore: number,
  href: string,
  permissions: PrioritySignal["permissions"],
  ctaLabel = "Wykonaj teraz",
): PrioritySignal {
  return {
    key,
    severity: severityFromImpact(impactScore),
    title,
    description,
    why,
    impact: makeImpact(impactScore),
    confidence: makeConfidence(0.68),
    cta: {
      label: ctaLabel,
      href,
    },
    permissions,
  };
}

export function buildPrioritySignal(metrics: Metrics, workspace: WorkspaceContext): PrioritySignal {
  const baseContentHref = `/w/${workspace.workspaceSlug}/content`;
  const calendarHref = `/w/${workspace.workspaceSlug}/calendar`;

  if (metrics.overdueCount > 0) {
    return build(
      "priority-overdue",
      "Masz zaległe treści",
      "Najpierw zredukuj opóźnienia.",
      `Masz ${metrics.overdueCount} treści po terminie. To najsilniejszy czynnik ryzyka operacyjnego na dziś.`,
      Math.min(100, 65 + metrics.overdueCount * 6 + metrics.overdueMaxAgeDays * 4),
      `${baseContentHref}?overdue=1`,
      permissionFor("EDITOR", workspace.role),
      "Zobacz zaległe",
    );
  }

  if (metrics.reviewOver48hCount > 0) {
    return build(
      "priority-review-backlog",
      `Zamknij kolejkę REVIEW (${metrics.reviewOver48hCount})`,
      "Decyzje akceptacyjne wymagają pilnego domknięcia.",
      "Elementy czekające ponad 48h blokują publikacje i obniżają tempo zespołu.",
      Math.min(100, 58 + metrics.reviewOver48hCount * 8),
      `${baseContentHref}?status=REVIEW`,
      permissionFor("MANAGER", workspace.role),
    );
  }

  if (metrics.upcomingToday > 0) {
    return build(
      "priority-today-publications",
      `Dopilnuj publikacji na dziś (${metrics.upcomingToday})`,
      "Priorytetem jest terminowa realizacja dzisiejszego planu.",
      "Dziś zaplanowano publikacje. Potwierdź gotowość materiałów i kanałów przed godziną emisji.",
      62,
      calendarHref,
      permissionFor("MANAGER", workspace.role),
    );
  }

  if (metrics.lowCredits || metrics.warningCredits) {
    return build(
      "priority-credits",
      "Zarządzaj budżetem AI",
      "Wykorzystanie kredytów wpływa na automatyzacje.",
      "Poziom kredytów AI zbliża się do limitu. Zaplanuj działania manualne lub ogranicz kosztowne akcje.",
      metrics.lowCredits ? 70 : 48,
      baseContentHref,
      permissionForAi(workspace.role, metrics.creditsRemaining),
    );
  }

  if (metrics.inactivity) {
    return build(
      "priority-inactivity",
      "Uruchom pipeline na nowo",
      "W ostatnich 7 dniach nie było aktywności.",
      "Brak nowych treści i wersji oznacza ryzyko zatrzymania publikacji w kolejnych dniach.",
      64,
      baseContentHref,
      permissionFor("EDITOR", workspace.role),
    );
  }

  if (metrics.noneUpcomingWeek) {
    return build(
      "priority-none-upcoming-week",
      "Zaplanuj tydzień publikacji",
      "Brakuje zadań w kalendarzu tygodniowym.",
      "Bez harmonogramu na najbliższe dni zespół traci przewidywalność i trudniej utrzymać rytm publikacji.",
      66,
      calendarHref,
      permissionFor("MANAGER", workspace.role),
    );
  }

  return build(
    "priority-pipeline-push",
    "Podnieś przepływ z IDEA do REVIEW",
    "Pipeline działa, ale można zwiększyć tempo.",
    "Największy efekt da dziś przesunięcie świeżych pomysłów do etapu redakcyjnego i przygotowanie planu publikacji.",
    35,
    baseContentHref,
    permissionFor("EDITOR", workspace.role),
  );
}
