"use client";

import { useState } from "react";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { PublicationDrawer } from "@/components/projects/PublicationDrawer";
import { PermissionLockCard } from "@/components/team/PermissionLockCard";
import { recordAuditEvent, type PublicationJob, type PublicationStatus } from "@/lib/projects/projectStore";

type PublicationsTableProps = {
  publications: PublicationJob[];
  onChangeStatus: (formData: FormData) => void;
  onAddAiVersion?: (formData: FormData) => Promise<void>;
  onSetPublicationDraft?: (formData: FormData) => Promise<void>;
  onDelete?: (formData: FormData) => void;
};

type FilterMode = "all" | "mine";

const statusLabels: Record<PublicationStatus, string> = {
  pomysl: "Pomysł",
  szkic: "Szkic",
  do_akceptacji: "Do akceptacji",
  zaplanowane: "Zaplanowane",
  opublikowane: "Opublikowane",
};

export function PublicationsTable({ publications, onChangeStatus, onAddAiVersion, onSetPublicationDraft, onDelete }: PublicationsTableProps) {
  const [selectedPublication, setSelectedPublication] = useState<PublicationJob | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, PublicationStatus>>({});
  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, { assigneeId?: string; assigneeName?: string }>>({});
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);
  const { permissions, requirePermission, currentMember, currentRole, policies, canPublishDirectly, buildActor } = useProjectContext();

  const publicationsWithAssignments = publications.map((publication) => {
    const override = assigneeOverrides[publication.id];
    if (!override) {
      return publication;
    }
    return {
      ...publication,
      assigneeId: override.assigneeId,
      assigneeName: override.assigneeName,
    };
  });

  const noView = requirePermission("projekt_widok");
  const noAdd = requirePermission("publikacje_dodaj");
  const noStatusChange = requirePermission("publikacje_status_zmien");

  if (noView.status === "brak_uprawnien") {
    return <PermissionLockCard title="Brak dostępu do publikacji" description={noView.powod} />;
  }

  const showAddLock = noAdd.status === "brak_uprawnien";
  const canFilterByMember = currentRole === "owner" || currentRole === "manager";

  function resolveEffectiveStatus(status: PublicationStatus): PublicationStatus {
    if (!policies.requireApprovalForPublish || canPublishDirectly) {
      return status;
    }
    if (status === "zaplanowane" || status === "opublikowane") {
      return "do_akceptacji";
    }
    return status;
  }

  const filteredPublications = publicationsWithAssignments.filter((publication) => {
    if (filterMode === "mine") {
      return publication.assigneeId === currentMember.id;
    }
    if (canFilterByMember && memberFilter) {
      return publication.assigneeId === memberFilter;
    }
    return true;
  });

  if (filteredPublications.length === 0) {
    return (
      <div className="space-y-2">
        {showAddLock ? <PermissionLockCard title="Brak uprawnienia: dodawanie publikacji" description={noAdd.powod} /> : null}
        <p className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B]">Brak publikacji dla wybranego filtra.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setFilterMode("all");
              setMemberFilter("");
            }}
            className={[
              "h-8 rounded-lg px-3 text-xs font-medium",
              filterMode === "all" ? "bg-[#EEF2FF] text-[#3B5BDB]" : "text-[#64748B]",
            ].join(" ")}
          >
            Wszyscy
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("mine");
              setMemberFilter("");
            }}
            className={[
              "h-8 rounded-lg px-3 text-xs font-medium",
              filterMode === "mine" ? "bg-[#EEF2FF] text-[#3B5BDB]" : "text-[#64748B]",
            ].join(" ")}
          >
            Moje
          </button>
        </div>

        {canFilterByMember ? (
          <select
            title="Filtr członka"
            value={memberFilter}
            onChange={(event) => {
              setFilterMode("all");
              setMemberFilter(event.target.value);
            }}
            className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569]"
          >
            <option value="">Członek: wszyscy</option>
            {Array.from(new Set(publicationsWithAssignments.map((item) => item.assigneeId).filter((id): id is string => Boolean(id)))).map((id) => {
              const label = publicationsWithAssignments.find((item) => item.assigneeId === id)?.assigneeName ?? id;
              return <option key={id} value={id}>{label}</option>;
            })}
          </select>
        ) : null}

        <button
          type="button"
          disabled={!permissions.publikacje_dodaj}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#475569] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Dodaj publikację
        </button>
        {showAddLock ? <PermissionLockCard title="Brak uprawnienia: dodawanie publikacji" description={noAdd.powod} /> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-[#475569]">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Tytuł</th>
              <th className="px-3 py-2 font-medium">Kanał</th>
              <th className="px-3 py-2 font-medium">Typ</th>
              <th className="px-3 py-2 font-medium">Odpowiedzialny</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredPublications.map((publication) => (
              <tr
                key={publication.id}
                className="cursor-pointer border-t border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
                onClick={() => setSelectedPublication(publication)}
              >
                <td className="px-3 py-2 text-[#334155]">{publication.dataPublikacjiISO.slice(0, 10)}</td>
                <td className="px-3 py-2 text-[#0F172A]">{publication.tytul}</td>
                <td className="px-3 py-2 text-[#334155]">{publication.kanal}</td>
                <td className="px-3 py-2 text-[#334155]">{publication.typ}</td>
                <td className="px-3 py-2 text-[#334155]">{publication.assigneeName ?? "Nieprzypisane"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#475569]">
                    {statusLabels[publication.status]}
                  </span>
                  {policies.requireApprovalForPublish && publication.status === "do_akceptacji" ? (
                    <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      Wymaga akceptacji
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <form
                      action={onChangeStatus}
                      onSubmit={() => {
                        const attemptedStatus = statusOverrides[publication.id] ?? publication.status;
                        const effectiveStatus = resolveEffectiveStatus(attemptedStatus);

                        if (attemptedStatus !== effectiveStatus) {
                          setPolicyNotice("Wymagana akceptacja managera — ustawiono status Do akceptacji.");
                          recordAuditEvent({
                            id: `aud_${Date.now()}`,
                            workspaceId: publication.workspaceId,
                            projectId: publication.projectId,
                            publicationId: publication.id,
                            publicationTitle: publication.tytul,
                            type: "policy_blocked",
                            timestampISO: new Date().toISOString(),
                            actor: buildActor(),
                            source: "manual",
                            summary: "Zablokowano bezpośrednią publikację przez politykę projektu.",
                            details: {
                              attemptedStatus,
                              forcedStatus: "do_akceptacji",
                            },
                          });
                        } else {
                          setPolicyNotice(null);
                        }
                      }}
                    >
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <input type="hidden" name="status" value={resolveEffectiveStatus(statusOverrides[publication.id] ?? publication.status)} />
                      <select
                        title="Status publikacji"
                        value={statusOverrides[publication.id] ?? publication.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as PublicationStatus;
                          setStatusOverrides((prev) => ({
                            ...prev,
                            [publication.id]: nextStatus,
                          }));
                        }}
                        disabled={!permissions.publikacje_status_zmien}
                        className="h-8 rounded-lg border border-[#E2E8F0] px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="pomysl">Pomysł</option>
                        <option value="szkic">Szkic</option>
                        <option value="do_akceptacji">Do akceptacji</option>
                        <option value="zaplanowane">Zaplanowane</option>
                        <option value="opublikowane">Opublikowane</option>
                      </select>
                      <button type="submit" disabled={!permissions.publikacje_status_zmien} className="ml-2 h-8 rounded-lg border border-[#E2E8F0] px-2 text-xs text-[#334155] disabled:cursor-not-allowed disabled:opacity-50">Zapisz</button>
                    </form>

                    {onDelete && permissions.publikacje_usun ? (
                      <form action={onDelete}>
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <button type="submit" className="h-8 rounded-lg border border-rose-200 px-2 text-xs text-rose-600">Usuń</button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noStatusChange.status === "brak_uprawnien" ? (
        <div className="mt-3">
          <PermissionLockCard title="Brak uprawnienia: zmiana statusu" description={noStatusChange.powod} />
        </div>
      ) : null}

      {policyNotice ? <p className="mt-3 text-sm text-amber-700">{policyNotice}</p> : null}

      {selectedPublication && onAddAiVersion && onSetPublicationDraft ? (
        <PublicationDrawer
          publication={selectedPublication}
          onClose={() => setSelectedPublication(null)}
          onAddAiVersion={onAddAiVersion}
          onSetPublicationDraft={onSetPublicationDraft}
          onAssignmentChanged={(publicationId, assigneeId, assigneeName) => {
            setAssigneeOverrides((prev) => ({
              ...prev,
              [publicationId]: {
                assigneeId: assigneeId ?? undefined,
                assigneeName,
              },
            }));
            setSelectedPublication((prev) => {
              if (!prev || prev.id !== publicationId) {
                return prev;
              }
              return {
                ...prev,
                assigneeId: assigneeId ?? undefined,
                assigneeName,
              };
            });
          }}
        />
      ) : null}
    </>
  );
}
