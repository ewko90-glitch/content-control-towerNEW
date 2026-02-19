import { RoleBadge } from "@/components/team/RoleBadge";
import type { WorkspaceRole } from "@/lib/team/teamStore";

export type TeamPerformanceRow = {
  memberId: string;
  memberName: string;
  role: WorkspaceRole;
  workload7d: number;
  delivery7d: number;
  backlogCount: number;
  riskOverdue: number;
  isOverloaded: boolean;
};

type TeamPerformanceTableProps = {
  rows: TeamPerformanceRow[];
};

export function TeamPerformanceTable({ rows }: TeamPerformanceTableProps) {
  return (
    <section className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[#0F172A]">Wydajność zespołu</h3>
        <p className="mt-1 text-sm text-[#64748B]">Workload, delivery i ryzyko na członka zespołu projektu.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-[#475569]">
            <tr>
              <th className="px-3 py-2 font-medium">Osoba</th>
              <th className="px-3 py-2 font-medium">Workload 7 dni</th>
              <th className="px-3 py-2 font-medium">Delivery 7 dni</th>
              <th className="px-3 py-2 font-medium">Backlog</th>
              <th className="px-3 py-2 font-medium">Ryzyko</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.memberId} className="border-t border-[#E2E8F0]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#0F172A]">{row.memberName}</span>
                    <RoleBadge role={row.role} />
                    {row.isOverloaded ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Przeciążenie
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-[#334155]">{row.workload7d}</td>
                <td className="px-3 py-2 text-[#334155]">{row.delivery7d}</td>
                <td className="px-3 py-2 text-[#334155]">{row.backlogCount}</td>
                <td className="px-3 py-2 text-[#334155]">{row.riskOverdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
