"use client";

import { useMemo } from "react";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { RoleBadge } from "@/components/team/RoleBadge";
import { PermissionLockCard } from "@/components/team/PermissionLockCard";
import { listPublications, type ProjectMember } from "@/lib/projects/projectStore";
import type { WorkspaceMember } from "@/lib/team/teamStore";

type ProjectTeamManagerProps = {
  members: WorkspaceMember[];
  projectMembers: ProjectMember[];
  onSave: (formData: FormData) => void;
  saved?: boolean;
};

export function ProjectTeamManager({ members, projectMembers, onSave, saved = false }: ProjectTeamManagerProps) {
  const { permissions, requirePermission, project, projectId } = useProjectContext();

  const accessMap = useMemo(() => {
    return new Map(projectMembers.map((item) => [item.memberId, item]));
  }, [projectMembers]);

  const lock = requirePermission("projekt_ustawienia_edycja");
  const publications = useMemo(() => listPublications(project.workspaceId, projectId), [project.workspaceId, projectId]);
  const workloadByMemberId = useMemo(() => {
    const counter = new Map<string, number>();
    for (const publication of publications) {
      if (!publication.assigneeId) {
        continue;
      }
      counter.set(publication.assigneeId, (counter.get(publication.assigneeId) ?? 0) + 1);
    }
    return counter;
  }, [publications]);

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">Zespół projektu</h3>
        <p className="mt-1 text-xs text-[#64748B]">Przypisz dostęp do projektu i opcjonalny override roli.</p>
      </div>

      {lock.status === "brak_uprawnien" ? (
        <div className="mb-3">
          <PermissionLockCard title="Brak uprawnień do edycji zespołu" description={lock.powod} />
        </div>
      ) : null}

      <form action={onSave} className="space-y-3">
        <fieldset disabled={!permissions.projekt_ustawienia_edycja} className="space-y-3 disabled:opacity-70">
          {members.map((member) => {
            const assignment = accessMap.get(member.id);
            return (
              <div key={member.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{member.imie}</p>
                    <p className="text-xs text-[#64748B]">{member.email}</p>
                    <p className="mt-1 text-xs text-[#475569]">Publikacje: {workloadByMemberId.get(member.id) ?? 0}</p>
                  </div>
                  <RoleBadge role={member.role} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="checkbox"
                      name={`member_access_${member.id}`}
                      defaultChecked={Boolean(assignment)}
                      className="h-4 w-4 rounded border-[#CBD5E1]"
                    />
                    ma dostęp do projektu
                  </label>

                  <select
                    title={`Rola override ${member.imie}`}
                    name={`member_override_${member.id}`}
                    defaultValue={assignment?.roleOverride ?? ""}
                    className="h-9 rounded-lg border border-[#E2E8F0] px-2 text-sm"
                  >
                    <option value="">Brak override</option>
                    <option value="owner">owner</option>
                    <option value="manager">manager</option>
                    <option value="redaktor">redaktor</option>
                    <option value="podglad">podglad</option>
                  </select>
                </div>
              </div>
            );
          })}
        </fieldset>

        {saved ? <p className="text-sm text-emerald-700">Zapisano ustawienia zespołu projektu.</p> : null}

        <button
          type="submit"
          disabled={!permissions.projekt_ustawienia_edycja}
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Zapisz zespół projektu
        </button>
      </form>
    </section>
  );
}
