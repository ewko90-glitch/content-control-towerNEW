import type { ExecutiveAction } from "./executive-types";

type ExecutiveActionsProps = {
  actions: ExecutiveAction[];
  emptyLabel: string;
};

export function ExecutiveActions(props: ExecutiveActionsProps) {
  if (props.actions.length === 0) {
    return <p className="text-sm text-textMuted">{props.emptyLabel}</p>;
  }

  return (
    <section className="space-y-2">
      {props.actions.map((action) => (
        <article key={action.id} className="rounded-xl border border-border bg-surface2/70 px-3 py-2">
          <p className="text-sm font-medium text-text">{action.title}</p>
          <p className="text-xs text-textMuted">{action.impact}</p>
        </article>
      ))}
    </section>
  );
}
