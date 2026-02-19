import { getThresholds } from "./thresholds";
import { permissionFor, permissionForAi } from "./permissions";
import type { ActionCard, Metrics, WorkspaceContext } from "./types";
import { makeConfidence, makeImpact, severityFromImpact } from "./explain";

function card(
  key: string,
  title: string,
  description: string,
  why: string,
  impactScore: number,
  metricChip: string,
  href: string,
  permissions: ActionCard["permissions"],
): ActionCard {
  return {
    key,
    severity: severityFromImpact(impactScore),
    title,
    description,
    why,
    impact: makeImpact(impactScore),
    confidence: makeConfidence(0.66),
    cta: {
      label: "Otwórz",
      href,
    },
    permissions,
    metricChip,
  };
}

export function buildActionCards(metrics: Metrics, workspace: WorkspaceContext): ActionCard[] {
  const cards: ActionCard[] = [];
  const contentHref = `/w/${workspace.workspaceSlug}/content`;
  const calendarHref = `/w/${workspace.workspaceSlug}/calendar`;

  if (metrics.overdueCount > 0) {
    cards.push(
      card(
        "card-overdue",
        "Zredukuj opóźnienia",
        "Treści po terminie wymagają interwencji.",
        `Najstarsze opóźnienie to ${metrics.overdueMaxAgeDays} dni, co podnosi ryzyko opóźnień publikacji.`,
        70,
        `${metrics.overdueCount} po terminie`,
        contentHref,
        permissionFor("EDITOR", workspace.role),
      ),
    );
  }

  if (metrics.reviewOver48hCount > 0) {
    cards.push(
      card(
        "card-review",
        "Odblokuj REVIEW",
        "Kolejka akceptacji wymaga decyzji.",
        `W REVIEW ponad 48h: ${metrics.reviewOver48hCount}. Średnio: ${metrics.avgReviewHours.toFixed(1)}h.`,
        72,
        `${metrics.reviewOver48hCount} >48h`,
        `${contentHref}?status=REVIEW`,
        permissionFor("MANAGER", workspace.role),
      ),
    );
  }

  if (metrics.noneUpcomingWeek) {
    cards.push(
      card(
        "card-schedule",
        "Brak zaplanowanych publikacji",
        "Nie masz żadnych publikacji w najbliższych 7 dniach.",
        "Brak harmonogramu na kolejny tydzień zwiększa ryzyko przestoju i utraty rytmu publikacji.",
        62,
        "0 zaplanowanych",
        calendarHref,
        permissionFor("MANAGER", workspace.role),
      ),
    );
  }

  if (metrics.lowCredits || metrics.warningCredits) {
    cards.push(
      card(
        "card-ai-credits",
        "Kontroluj budżet AI",
        "Zadbaj o dostępność automatyzacji.",
        metrics.creditsRemaining <= 0
          ? "Brak dostępnych kredytów AI. Zwiększ plan lub poczekaj na odnowienie puli."
          : `Pozostałe kredyty: ${metrics.creditsRemaining}.`,
        metrics.lowCredits ? 64 : 45,
        `${Math.round((1 - metrics.creditsUsedPct) * 100)}% pozostało`,
        contentHref,
        permissionForAi(workspace.role, metrics.creditsRemaining),
      ),
    );
  }

  if (metrics.inactivity) {
    cards.push(
      card(
        "card-activity",
        "Uruchom aktywność zespołu",
        "Brak nowych działań przez 7 dni.",
        "Brak aktywności ogranicza możliwość dowiezienia planu publikacji na kolejne dni.",
        60,
        "0 działań / 7 dni",
        contentHref,
        permissionFor("EDITOR", workspace.role),
      ),
    );
  }

  cards.push(
    card(
      "card-balance",
      "Wyrównaj pipeline",
      "Zbalansuj etapy IDEA / DRAFT / REVIEW.",
      `Udział IDEA: ${metrics.workflowDistribution.ideaPct}%. Lepsza równowaga zmniejsza ryzyko zatorów.`,
      metrics.workflowDistribution.imbalance ? 57 : 28,
      `${metrics.workflowDistribution.ideaPct}% IDEA`,
      contentHref,
      permissionFor("EDITOR", workspace.role),
    ),
  );

  const unique = Array.from(new Map(cards.map((entry) => [entry.key, entry])).values());

  const maxCards = getThresholds().maxCards;
  return unique
    .sort((a, b) => {
      const severityRank = { danger: 3, warning: 2, info: 1 };
      const severityDelta = severityRank[b.severity] - severityRank[a.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }

      const impactDelta = b.impact.score - a.impact.score;
      if (impactDelta !== 0) {
        return impactDelta;
      }

      return b.confidence.score - a.confidence.score;
    })
    .slice(0, maxCards);
}
