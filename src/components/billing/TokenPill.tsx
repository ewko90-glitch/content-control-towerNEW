import type { TokenState } from "@/lib/billing/tokens";

type TokenPillProps = {
  state: TokenState;
};

export function TokenPill({ state }: TokenPillProps) {
  const isExhausted = state.saldo <= 0;
  const isLow = state.saldo > 0 && state.saldo <= 50;

  const className = isExhausted
    ? "inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
    : isLow
      ? "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
      : "inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text";

  return (
    <span className={className}>
      {isExhausted ? "Tokeny wyczerpane" : `Tokeny AI: ${state.saldo}`}
    </span>
  );
}
