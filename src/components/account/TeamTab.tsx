"use client";

import { useState } from "react";
import type { WorkspaceMember, Project, ProjectMember } from "./AccountTabs";

type Props = {
  workspaceId: string;
  members: WorkspaceMember[];
  projects: Project[];
  projectMemberships: ProjectMember[];
};

const BASE = "https://content-control-tower-new.vercel.app";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EDITOR: "Edytor",
  VIEWER: "Przeglądający",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  EDITOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = (name ?? email)
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5B7CFA] text-sm font-bold text-white">
      {initials}
    </div>
  );
}

export function TeamTab({ workspaceId, members, projects, projectMemberships }: Props) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [inviteProjects, setInviteProjects] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Local state for per-member project access edits
  const [memberProjectEdits, setMemberProjectEdits] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const m of members) {
      map[m.userId] = projectMemberships
        .filter((pm) => pm.userId === m.userId)
        .map((pm) => pm.projectId);
    }
    return map;
  });

  const toggleProjectForInvite = (id: string) => {
    setInviteProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleProjectForMember = (userId: string, projectId: string) => {
    setMemberProjectEdits((prev) => {
      const current = prev[userId] ?? [];
      return {
        ...prev,
        [userId]: current.includes(projectId)
          ? current.filter((p) => p !== projectId)
          : [...current, projectId],
      };
    });
  };

  const handleSaveAccess = async (userId: string) => {
    const selectedProjects = memberProjectEdits[userId] ?? [];
    await fetch(`${BASE}/api/team/project-access`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, workspaceId, projectIds: selectedProjects }),
    });
    setExpandedUser(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    const res = await fetch(`${BASE}/api/invite`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        projectIds: inviteProjects,
        workspaceId,
      }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json() as { inviteUrl?: string; message?: string };
      setSentMsg(`Zaproszenie utworzone ✓`);
      setInviteLink(data.inviteUrl ?? "");
      setInviteEmail("");
      setInviteProjects([]);
      setTimeout(() => setSentMsg(""), 10000);
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setSentMsg((data.error as string) ?? "Błąd wysyłania zaproszenia");
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Zespół</h1>
        <p className="text-sm text-gray-500">
          Zarządzaj dostępami — dodawaj osoby do wybranych projektów, nie do całości konta.
        </p>
      </div>

      {/* Current members */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Użytkownicy{" "}
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              {members.length}
            </span>
          </h2>
        </div>

        <ul className="divide-y divide-gray-100">
          {members.map((m) => {
            const isExpanded = expandedUser === m.userId;
            const assignedProjects = memberProjectEdits[m.userId] ?? [];
            return (
              <li key={m.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.user.name} email={m.user.email} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.user.name ?? m.user.email}
                      </p>
                      <p className="text-xs text-gray-500">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                    {m.role !== "ADMIN" && (
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : m.userId)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#5B7CFA] hover:text-[#5B7CFA]"
                      >
                        {isExpanded ? "Zamknij" : "Dostęp do projektów"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded project access */}
                {isExpanded && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Wybierz projekty do których ma dostęp:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {projects.map((p) => {
                        const selected = assignedProjects.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleProjectForMember(m.userId, p.id)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                              selected
                                ? "border-[#5B7CFA] bg-[#5B7CFA]/10 text-[#5B7CFA]"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            {selected ? "✓ " : ""}{p.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleSaveAccess(m.userId)}
                        className="rounded-lg bg-[#5B7CFA] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        Zapisz dostęp
                      </button>
                      <button
                        onClick={() => setExpandedUser(null)}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Invite new member */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 font-semibold text-gray-900">Zaproś nową osobę</h2>

        {sentMsg && (
          <div className="mb-4 space-y-2">
            <p
              className={`rounded-xl px-4 py-2 text-sm ${
                sentMsg.includes("✓")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {sentMsg}
            </p>
            {inviteLink && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                <p className="mb-1 text-xs font-semibold text-yellow-700">
                  Skopiuj i wyślij ten link ręcznie (brak połączonego email):
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-900">
                    {inviteLink}
                  </code>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(inviteLink); }}
                    className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-yellow-300"
                  >
                    Kopiuj
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@firma.pl"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5B7CFA]"
            >
              <option value="EDITOR">Edytor</option>
              <option value="VIEWER">Przeglądający</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Dostęp do projektów (opcjonalnie — puste = brak dostępu do żadnego):
            </p>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => {
                const selected = inviteProjects.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProjectForInvite(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                      selected
                        ? "border-[#5B7CFA] bg-[#5B7CFA]/10 text-[#5B7CFA]"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {selected ? "✓ " : ""}{p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleInvite}
            disabled={sending || !inviteEmail.trim()}
            className="rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Wysyłam..." : "Wyślij zaproszenie →"}
          </button>
        </div>
      </div>
    </div>
  );
}
