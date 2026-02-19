export type WorkspaceRole = "owner" | "manager" | "redaktor" | "podglad";

export type WorkspaceMember = {
  id: string;
  imie: string;
  email: string;
  role: WorkspaceRole;
  createdAtISO: string;
};

type WorkspaceMemberInput = {
  imie: string;
  email: string;
  role: WorkspaceRole;
};

const memberStore = new Map<string, WorkspaceMember[]>();

function ensureSeed(workspaceId: string): WorkspaceMember[] {
  const existing = memberStore.get(workspaceId);
  if (existing) {
    return existing;
  }

  const nowISO = new Date().toISOString();
  const seeded: WorkspaceMember[] = [
    {
      id: "member_owner",
      imie: "Ty",
      email: "ty@workspace.local",
      role: "owner",
      createdAtISO: nowISO,
    },
    {
      id: "member_manager_1",
      imie: "Marta",
      email: "marta@workspace.local",
      role: "manager",
      createdAtISO: nowISO,
    },
    {
      id: "member_redaktor_1",
      imie: "Kamil",
      email: "kamil@workspace.local",
      role: "redaktor",
      createdAtISO: nowISO,
    },
    {
      id: "member_podglad_1",
      imie: "Ola",
      email: "ola@workspace.local",
      role: "podglad",
      createdAtISO: nowISO,
    },
  ];

  memberStore.set(workspaceId, seeded);
  return seeded;
}

export function listMembers(workspaceId: string): WorkspaceMember[] {
  return [...ensureSeed(workspaceId)];
}

export function addMember(workspaceId: string, input: WorkspaceMemberInput): WorkspaceMember {
  const current = ensureSeed(workspaceId);
  const nextMember: WorkspaceMember = {
    id: `member_${Date.now()}`,
    imie: input.imie,
    email: input.email,
    role: input.role,
    createdAtISO: new Date().toISOString(),
  };

  memberStore.set(workspaceId, [nextMember, ...current]);
  return nextMember;
}

export function removeMember(workspaceId: string, memberId: string): void {
  const current = ensureSeed(workspaceId);
  memberStore.set(
    workspaceId,
    current.filter((member) => member.id !== memberId),
  );
}
