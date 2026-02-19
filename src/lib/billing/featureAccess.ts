import { getPlanDefinition, type FeatureKey, type PlanId } from "@/lib/billing/planConfig";

export type AccessResult =
  | { status: "ok" }
  | { status: "zablokowane_planem"; powod: string; wymaganyPlan: PlanId }
  | { status: "brak_tokenow"; powod: string };

const kolejnoscPlanow: PlanId[] = ["starter", "growth", "control_tower", "enterprise"];

function pierwszyPlanZFunckja(feature: FeatureKey): PlanId {
  for (const planId of kolejnoscPlanow) {
    const plan = getPlanDefinition(planId);
    if (plan.funkcje[feature] === "wlaczone") {
      return planId;
    }
  }
  return "enterprise";
}

export function sprawdzDostepDoFunkcji(args: {
  feature: FeatureKey;
  planId: PlanId;
  tokeny: number;
  czyAkcjaAI?: boolean;
}): AccessResult {
  const plan = getPlanDefinition(args.planId);

  if (plan.funkcje[args.feature] === "zablokowane") {
    const wymaganyPlan = pierwszyPlanZFunckja(args.feature);
    return {
      status: "zablokowane_planem",
      powod: "Funkcja niedostępna w Twoim planie.",
      wymaganyPlan,
    };
  }

  if (args.czyAkcjaAI && args.tokeny <= 0) {
    return {
      status: "brak_tokenow",
      powod: "Brak tokenów AI. Możesz kontynuować pracę ręcznie.",
    };
  }

  return { status: "ok" };
}
