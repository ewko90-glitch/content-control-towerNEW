import type { WorkspaceRole } from "@/lib/team/teamStore";

type RoleBadgeProps = {
  role: WorkspaceRole;
};

const roleLabel: Record<WorkspaceRole, string> = {
  owner: "Owner",
  manager: "Manager",
  redaktor: "Redaktor",
  podglad: "Podgląd",
};

const roleStyle: Record<WorkspaceRole, string> = {
  owner: "border-amber-200 bg-amber-50 text-amber-700",
  manager: "border-indigo-200 bg-indigo-50 text-indigo-700",
  redaktor: "border-emerald-200 bg-emerald-50 text-emerald-700",
  podglad: "border-slate-200 bg-slate-50 text-slate-700",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleStyle[role]}`}>
      {roleLabel[role]}
    </span>
  );
}
