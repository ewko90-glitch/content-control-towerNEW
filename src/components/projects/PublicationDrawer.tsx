"use client";

import { useMemo, useState } from "react";

import { AiDraftVersions } from "@/components/projects/AiDraftVersions";
import { AiStudioPanel } from "@/components/projects/AiStudioPanel";
import { AuditTrailList } from "@/components/projects/AuditTrailList";
import { useProjectContext } from "@/components/projects/ProjectContext";
import { RoleBadge } from "@/components/team/RoleBadge";
import { PermissionLockCard } from "@/components/team/PermissionLockCard";
import { assignPublication, getProjectMembers, listAuditEvents, recordAuditEvent, type PublicationJob } from "@/lib/projects/projectStore";
import { listMembers } from "@/lib/team/teamStore";

type PublicationDrawerProps = {
  publication: PublicationJob;
  onClose: () => void;
  onSetPublicationDraft: (formData: FormData) => Promise<void>;
  onAddAiVersion: (formData: FormData) => Promise<void>;
  onAssignmentChanged?: (publicationId: string, assigneeId: string | null, assigneeName?: string) => void;
};

type DrawerTab = "tresc" | "ai" | "historia" | "audit";

const tabLabels: Record<DrawerTab, string> = {
  tresc: "Treść",
  ai: "AI Studio",
  historia: "Historia",
  audit: "Audit",
};

export function PublicationDrawer({ publication, onClose, onSetPublicationDraft, onAddAiVersion, onAssignmentChanged }: PublicationDrawerProps) {
  const { requirePermission, project, projectId, currentMember, currentRole, buildActor } = useProjectContext();
  const [activeTab, setActiveTab] = useState<DrawerTab>("tresc");
  const [draftText, setDraftText] = useState(publication.contentDraft ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(publication.assigneeId ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [auditVersion, setAuditVersion] = useState(0);
  const aiPermission = requirePermission("ai_uzyj");
  const assignmentPermission = requirePermission("publikacje_przypisz");

  const projectMemberMap = useMemo(() => {
    return new Map(getProjectMembers(project.workspaceId, projectId).map((item) => [item.memberId, item]));
  }, [project.workspaceId, projectId]);
  const assignableMembers = useMemo(() => {
    const all = listMembers(project.workspaceId).filter((member) => projectMemberMap.has(member.id));
    if (currentRole === "redaktor") {
      return all.filter((member) => member.id === currentMember.id);
    }
    return all;
  }, [project.workspaceId, projectMemberMap, currentRole, currentMember.id]);

  const selectedMember = assignableMembers.find((member) => member.id === assigneeId) ?? null;
  const auditEvents = useMemo(() => {
    return listAuditEvents(project.workspaceId, projectId, { publicationId: publication.id, limit: 20 });
  }, [project.workspaceId, projectId, publication.id, auditVersion]);

  const statusLabel = useMemo(() => {
    if (publication.status === "pomysl") return "Pomysł";
    if (publication.status === "szkic") return "Szkic";
    if (publication.status === "do_akceptacji") return "Do akceptacji";
    if (publication.status === "zaplanowane") return "Zaplanowane";
    return "Opublikowane";
  }, [publication.status]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Zamknij" onClick={onClose} className="flex-1 bg-black/35" />
      <aside className="h-full w-full max-w-2xl overflow-auto border-l border-[#E2E8F0] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{publication.tytul}</h3>
            <p className="mt-1 text-xs text-[#64748B]">{publication.kanal} • {publication.dataPublikacjiISO.slice(0, 10)} • {statusLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#334155]">Zamknij</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(tabLabels) as DrawerTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "h-9 rounded-lg border px-3 text-sm",
                activeTab === tab
                  ? "border-[#5B7CFA] bg-[#EEF2FF] text-[#3B5BDB]"
                  : "border-[#E2E8F0] bg-white text-[#475569]",
              ].join(" ")}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <section className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-sm font-semibold text-[#0F172A]">Odpowiedzialny</p>
          <p className="mt-1 text-xs text-[#64748B]">Przypisz publikację do członka zespołu projektu.</p>

          {assignmentPermission.status === "brak_uprawnien" ? (
            <div className="mt-2">
              <PermissionLockCard title="Brak uprawnienia do przypisywania" description={assignmentPermission.powod} />
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              title="Odpowiedzialny"
              value={assigneeId}
              disabled={assignmentPermission.status === "brak_uprawnien"}
              onChange={async (event) => {
                const nextAssigneeId = event.target.value;
                setAssigneeId(nextAssigneeId);

                const updated = assignPublication(
                  project.workspaceId,
                  projectId,
                  publication.id,
                  nextAssigneeId || null,
                  buildActor(),
                );

                if (updated) {
                  onAssignmentChanged?.(updated.id, updated.assigneeId ?? null, updated.assigneeName);
                }
                setNotice("Zapisano przypisanie.");
                setAuditVersion((value) => value + 1);
              }}
              className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Nieprzypisane</option>
              {assignableMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.imie}</option>
              ))}
            </select>

            {selectedMember ? <RoleBadge role={selectedMember.role} /> : null}
          </div>
        </section>

        {activeTab === "tresc" ? (
          <section className="space-y-3">
            <p className="text-sm text-[#64748B]">Manualny draft publikacji (manual-first, bez AI).</p>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Wpisz roboczą treść publikacji..."
              className="min-h-[260px] w-full rounded-xl border border-[#E2E8F0] p-3 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                const formData = new FormData();
                formData.set("publicationId", publication.id);
                formData.set("contentDraft", draftText);
                await onSetPublicationDraft(formData);
                recordAuditEvent({
                  id: `aud_${Date.now()}`,
                  workspaceId: project.workspaceId,
                  projectId,
                  publicationId: publication.id,
                  publicationTitle: publication.tytul,
                  type: "draft_saved",
                  timestampISO: new Date().toISOString(),
                  actor: buildActor(),
                  source: "manual",
                  summary: `Zapisano draft publikacji: ${publication.tytul}.`,
                  details: {
                    field: "contentDraft",
                    length: draftText.length,
                  },
                });
                setNotice("Zapisano draft publikacji.");
                setAuditVersion((value) => value + 1);
              }}
              className="h-10 rounded-xl bg-[#5B7CFA] px-4 text-sm font-medium text-white"
            >
              Zapisz
            </button>
          </section>
        ) : null}

        {activeTab === "ai" ? (
          aiPermission.status === "ok" ? (
            <AiStudioPanel
              publication={publication}
              onAddAiVersion={onAddAiVersion}
              onSetPublicationDraft={onSetPublicationDraft}
              onAuditRecorded={() => setAuditVersion((value) => value + 1)}
            />
          ) : (
            <PermissionLockCard title="AI Studio zablokowane rolą" description={aiPermission.powod} />
          )
        ) : null}

        {activeTab === "historia" ? (
          <AiDraftVersions
            versions={publication.aiVersions ?? []}
            onApply={async (kind, content) => {
              const formData = new FormData();
              formData.set("publicationId", publication.id);
              if (kind === "outline") {
                formData.set("outlineDraft", content);
              } else if (kind === "draft") {
                formData.set("contentDraft", content);
                setDraftText(content);
              } else {
                formData.set("seoNotes", content);
              }
              await onSetPublicationDraft(formData);
              const appliedTo = kind === "outline" ? "outlineDraft" : kind === "draft" ? "contentDraft" : "seoNotes";
              recordAuditEvent({
                id: `aud_${Date.now()}`,
                workspaceId: project.workspaceId,
                projectId,
                publicationId: publication.id,
                publicationTitle: publication.tytul,
                type: "ai_applied",
                timestampISO: new Date().toISOString(),
                actor: buildActor(),
                source: "ai",
                summary: `Zastosowano wersję AI (${kind}) do publikacji: ${publication.tytul}.`,
                details: {
                  kind,
                  appliedTo,
                },
              });
              setNotice("Zastosowano wersję do publikacji.");
              setAuditVersion((value) => value + 1);
            }}
          />
        ) : null}

        {activeTab === "audit" ? (
          <section className="space-y-2">
            <p className="text-sm text-[#64748B]">Ostatnie zdarzenia dla tej publikacji.</p>
            <AuditTrailList events={auditEvents} emptyMessage="Brak zdarzeń audit dla tej publikacji." />
          </section>
        ) : null}

        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      </aside>
    </div>
  );
}
