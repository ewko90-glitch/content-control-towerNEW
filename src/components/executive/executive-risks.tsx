import type { ExecutiveRisk } from "./executive-types";

type ExecutiveRisksProps = {
  risks: ExecutiveRisk[];
};

function severityClass(severity: ExecutiveRisk["severity"]): string {
  if (severity === "high") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  if (severity === "medium") {
    return "border-warning/25 bg-warning/10 text-text";
  }
  return "border-success/30 bg-success/10 text-text";
}

export function ExecutiveRisks(props: ExecutiveRisksProps) {
  return (
    <section className="space-y-2">
      {props.risks.map((risk) => (
        <article key={risk.id} className={`rounded-xl border px-3 py-2 ${severityClass(risk.severity)}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text">{risk.label}</p>
            <span className="text-[11px] uppercase tracking-wide text-textMuted">{risk.severity}</span>
          </div>
          <p className="mt-1 text-xs text-textMuted">{risk.explanation}</p>
        </article>
      ))}
    </section>
  );
}
