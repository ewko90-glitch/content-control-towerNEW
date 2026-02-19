export type PlanId = "starter" | "growth" | "control_tower" | "enterprise";

export type FeatureKey =
  | "ai_planowanie"
  | "ai_generowanie_tresci"
  | "ai_rekomendacje_strategiczne"
  | "tryb_skupienia"
  | "weekly_review"
  | "pressure"
  | "roi"
  | "executive_digest"
  | "executive_pack"
  | "team_mode"
  | "portfolio_intelligence";

export type PlanDefinition = {
  id: PlanId;
  nazwa: string;
  opis: string;
  limity: {
    projekty: number | "bez_limitu";
    uzytkownicy: number | "bez_limitu";
    tokenyMiesiecznie: number | "bez_limitu";
  };
  funkcje: Record<FeatureKey, "wlaczone" | "zablokowane">;
  polecany?: boolean;
};

const wlaczoneWszedzie: Record<FeatureKey, "wlaczone" | "zablokowane"> = {
  ai_planowanie: "wlaczone",
  ai_generowanie_tresci: "wlaczone",
  ai_rekomendacje_strategiczne: "wlaczone",
  tryb_skupienia: "wlaczone",
  weekly_review: "wlaczone",
  pressure: "wlaczone",
  roi: "wlaczone",
  executive_digest: "wlaczone",
  executive_pack: "wlaczone",
  team_mode: "wlaczone",
  portfolio_intelligence: "wlaczone",
};

const planDefinitions: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    nazwa: "Starter",
    opis: "Podstawy zarządzania contentem i ograniczone AI.",
    limity: {
      projekty: 1,
      uzytkownicy: 1,
      tokenyMiesiecznie: 20000,
    },
    funkcje: {
      ...wlaczoneWszedzie,
      ai_rekomendacje_strategiczne: "zablokowane",
      roi: "zablokowane",
      executive_digest: "zablokowane",
      executive_pack: "zablokowane",
      team_mode: "zablokowane",
      portfolio_intelligence: "zablokowane",
    },
  },
  growth: {
    id: "growth",
    nazwa: "Growth",
    opis: "Więcej automatyzacji AI i operacyjna kontrola tygodnia.",
    limity: {
      projekty: 3,
      uzytkownicy: 5,
      tokenyMiesiecznie: 80000,
    },
    funkcje: {
      ...wlaczoneWszedzie,
      roi: "zablokowane",
      executive_digest: "zablokowane",
      executive_pack: "zablokowane",
      team_mode: "zablokowane",
      portfolio_intelligence: "zablokowane",
    },
  },
  control_tower: {
    id: "control_tower",
    nazwa: "Control Tower",
    opis: "Pełny system operacyjny contentu dla zespołów i managementu.",
    limity: {
      projekty: 10,
      uzytkownicy: 20,
      tokenyMiesiecznie: 250000,
    },
    funkcje: {
      ...wlaczoneWszedzie,
    },
    polecany: true,
  },
  enterprise: {
    id: "enterprise",
    nazwa: "Enterprise",
    opis: "Plan korporacyjny z pełną skalą i bez limitów.",
    limity: {
      projekty: "bez_limitu",
      uzytkownicy: "bez_limitu",
      tokenyMiesiecznie: "bez_limitu",
    },
    funkcje: {
      ...wlaczoneWszedzie,
    },
  },
};

export function getPlanDefinition(planId: PlanId): PlanDefinition {
  return planDefinitions[planId];
}
