import type { ExecutiveStrategyBlock } from "./executive-types";

type ExecutiveStrategyProps = {
  strategy: ExecutiveStrategyBlock;
};

function impactTone(status: ExecutiveStrategyBlock["impactStatus"]): string {
  if (status === "improving") {
    return "border-success/30 bg-success/15 text-success";
  }
  if (status === "worsening") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  if (status === "neutral") {
    return "border-border bg-surface2 text-textMuted";
  }
  return "border-border bg-surface2/70 text-textMuted";
}

export function ExecutiveStrategy(props: ExecutiveStrategyProps) {
  return (
    <section className="rounded-xl border border-border bg-surface2/60 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-text">{props.strategy.name ?? "Brak przyjętej strategii"}</p>
        {props.strategy.impactStatus ? (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${impactTone(props.strategy.impactStatus)}`}>
            {props.strategy.impactStatus}
          </span>
        ) : null}
        {typeof props.strategy.confidencePct === "number" ? (
          <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] text-textMuted">
            {props.strategy.confidencePct}%
          </span>
        ) : null}
      </div>
      {props.strategy.adoptedAt ? <p className="mt-1 text-xs text-textMuted">Adopted: {props.strategy.adoptedAt}</p> : null}
      {props.strategy.interpretation ? <p className="mt-2 text-xs text-textMuted">{props.strategy.interpretation}</p> : null}
    </section>
  );
}
