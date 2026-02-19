import type { ExecutiveDecisionRow } from "./executive-types";

type ExecutiveDecisionsProps = {
  decisions: ExecutiveDecisionRow[];
  emptyLabel: string;
};

function statusClass(status: ExecutiveDecisionRow["status"]): string {
  if (status === "adopted") {
    return "border-success/30 bg-success/15 text-success";
  }
  if (status === "rejected") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  return "border-border bg-surface2 text-textMuted";
}

export function ExecutiveDecisions(props: ExecutiveDecisionsProps) {
  if (props.decisions.length === 0) {
    return <p className="text-sm text-textMuted">{props.emptyLabel}</p>;
  }

  return (
    <section className="space-y-2">
      {props.decisions.map((decision) => (
        <article key={decision.id} className="rounded-xl border border-border bg-surface2/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text">{decision.name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(decision.status)}`}>{decision.status}</span>
          </div>
          <p className="mt-1 text-xs text-textMuted">{decision.delta ?? "Brak delty"}</p>
          <p className="text-[11px] text-textMuted">{decision.when}</p>
        </article>
      ))}
    </section>
  );
}
