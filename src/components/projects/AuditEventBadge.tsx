import type { AuditEventType } from "@/lib/projects/projectStore";

type AuditEventBadgeProps = {
  type: AuditEventType;
};

const badgeMeta: Record<AuditEventType, { label: string; className: string }> = {
  publication_created: {
    label: "Utworzono",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  publication_deleted: {
    label: "Usunięto",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  status_changed: {
    label: "Status",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  assignee_changed: {
    label: "Przypisanie",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  draft_saved: {
    label: "Draft",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ai_generated: {
    label: "AI Generate",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  ai_applied: {
    label: "AI Apply",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  policy_changed: {
    label: "Polityki",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  policy_blocked: {
    label: "Blokada",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
};

export function AuditEventBadge({ type }: AuditEventBadgeProps) {
  const meta = badgeMeta[type];
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
