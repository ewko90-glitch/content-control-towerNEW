import { toneClass } from "./executive-utils";
import type { ExecutiveKpi } from "./executive-types";

type ExecutiveKpisProps = {
  kpis: ExecutiveKpi[];
};

export function ExecutiveKpis(props: ExecutiveKpisProps) {
  return (
    <section className="grid gap-2 md:grid-cols-5">
      {props.kpis.map((kpi) => (
        <article key={kpi.id} className={`rounded-xl border px-3 py-2 ${toneClass(kpi.tone)}`}>
          <p className="text-[11px] uppercase tracking-wide text-textMuted">{kpi.label}</p>
          <p className="mt-1 text-base font-semibold text-text">{kpi.value}</p>
          {kpi.secondary ? <p className="text-xs text-textMuted">{kpi.secondary}</p> : null}
        </article>
      ))}
    </section>
  );
}
