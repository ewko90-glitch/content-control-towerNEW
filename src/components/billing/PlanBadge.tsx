import { getPlanDefinition, type PlanId } from "@/lib/billing/planConfig";

type PlanBadgeProps = {
  planId: PlanId;
};

export function PlanBadge({ planId }: PlanBadgeProps) {
  const plan = getPlanDefinition(planId);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text">
      Plan: {plan.nazwa}
      {plan.polecany ? (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          Polecany
        </span>
      ) : null}
    </span>
  );
}
