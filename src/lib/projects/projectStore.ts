import { listMembers } from "@/lib/team/teamStore";

export type ProjectType = "domena" | "linkedin_osoba";

export type WorkspaceRole = "owner" | "manager" | "redaktor" | "podglad";

export type ProjectMember = {
  memberId: string;
  roleOverride?: WorkspaceRole;
};

export type AiKind = "outline" | "draft" | "seo";

export type ProjectPolicies = {
  aiEnabled: boolean;
  requireApprovalForPublish: boolean;
  approvalRolesAllowed: Array<"owner" | "manager">;
  dailyAiGenerationLimit: number;
  allowedAiKinds: AiKind[];
};

export type ProjectProfile = {
  id: string;
  workspaceId: string;
  nazwa: string;
  typ: ProjectType;
  domenaLubKanal: string;
  jezyk: "pl" | "en";
  tonKomunikacji: "profesjonalny" | "dynamiczny" | "techniczny" | "ludzki";
  grupaDocelowa: string;
  glowneKlastry: string[];
  slowaKluczowe: string[];
  konkurenci: string[];
  linkiWewnetrzne: { label: string; url: string }[];
  linkiZewnetrzne: { label: string; url: string }[];
  kanaly: Array<{ typ: "wordpress" | "shopify" | "linkedin" | "inne"; nazwa: string }>;
  cadence: { dniTygodnia: number[]; czestotliwoscTygodniowa: number };
  projectMembers: ProjectMember[];
  policies?: ProjectPolicies;
  createdAtISO: string;
};

export type ProjectProfileInput = Omit<ProjectProfile, "id" | "workspaceId" | "createdAtISO" | "projectMembers">;

export type PublicationStatus =
  | "pomysl"
  | "szkic"
  | "do_akceptacji"
  | "zaplanowane"
  | "opublikowane";

export type PublicationChannel = "wordpress" | "shopify" | "linkedin" | "inne";

export type PublicationType = "blog" | "post" | "newsletter" | "landing" | "inne";

export type AiDraftVersion = {
  id: string;
  createdAtISO: string;
  kind: "outline" | "draft" | "seo";
  title: string;
  content: string;
  inputs: Record<string, unknown>;
};

export type AuditEventType =
  | "publication_created"
  | "publication_deleted"
  | "status_changed"
  | "assignee_changed"
  | "draft_saved"
  | "ai_generated"
  | "ai_applied"
  | "policy_changed"
  | "policy_blocked";

export type AuditActor = {
  memberId: string;
  name: string;
  role: string;
};

export type AuditEvent = {
  id: string;
  workspaceId: string;
  projectId: string;
  publicationId?: string;
  publicationTitle?: string;
  type: AuditEventType;
  timestampISO: string;
  actor: AuditActor;
  source: "manual" | "ai";
  summary: string;
  details: Record<string, unknown>;
};

export type PublicationJob = {
  id: string;
  projectId: string;
  workspaceId: string;
  tytul: string;
  kanal: PublicationChannel;
  typ: PublicationType;
  dataPublikacjiISO: string;
  status: PublicationStatus;
  assigneeId?: string;
  assigneeName?: string;
  opis?: string;
  aiVersions?: AiDraftVersion[];
  contentDraft?: string;
  outlineDraft?: string;
  seoNotes?: string;
  createdAtISO: string;
};

export type ProjectPlanningContext = {
  channels: string[];
  cadenceDays: number[];
  cadenceFrequency: number;
  clusters: string[];
  keywords: string[];
  internalLinksCount: number;
};

const store = new Map<string, ProjectProfile[]>();
const publicationStore = new Map<string, PublicationJob[]>();
const auditStore = new Map<string, AuditEvent[]>();
const aiGenerationsByDayStore = new Map<string, Record<string, number>>();
const AUDIT_EVENTS_LIMIT_PER_PROJECT = 100;

const defaultProjectPolicies: ProjectPolicies = {
  aiEnabled: true,
  requireApprovalForPublish: false,
  approvalRolesAllowed: ["owner", "manager"],
  dailyAiGenerationLimit: 0,
  allowedAiKinds: ["outline", "draft", "seo"],
};

function normalizePolicies(policies?: ProjectPolicies): ProjectPolicies {
  const allowedKinds = policies?.allowedAiKinds?.filter(
    (kind): kind is AiKind => kind === "outline" || kind === "draft" || kind === "seo",
  ) ?? defaultProjectPolicies.allowedAiKinds;

  const approvalRolesAllowed = policies?.approvalRolesAllowed?.filter(
    (role): role is "owner" | "manager" => role === "owner" || role === "manager",
  ) ?? defaultProjectPolicies.approvalRolesAllowed;

  return {
    aiEnabled: policies?.aiEnabled ?? defaultProjectPolicies.aiEnabled,
    requireApprovalForPublish: policies?.requireApprovalForPublish ?? defaultProjectPolicies.requireApprovalForPublish,
    approvalRolesAllowed: approvalRolesAllowed.length > 0 ? approvalRolesAllowed : [...defaultProjectPolicies.approvalRolesAllowed],
    dailyAiGenerationLimit: Math.max(0, Number(policies?.dailyAiGenerationLimit ?? defaultProjectPolicies.dailyAiGenerationLimit)),
    allowedAiKinds: allowedKinds.length > 0 ? allowedKinds : [...defaultProjectPolicies.allowedAiKinds],
  };
}

function normalizeProject(project: ProjectProfile): ProjectProfile {
  return {
    ...project,
    projectMembers: project.projectMembers?.length
      ? project.projectMembers
      : [{ memberId: "member_owner" }],
    policies: normalizePolicies(project.policies),
  };
}

export function listProjects(workspaceId: string): ProjectProfile[] {
  return [...(store.get(workspaceId) ?? [])].map((project) => normalizeProject(project));
}

export function getProject(workspaceId: string, projectId: string): ProjectProfile | null {
  const found = (store.get(workspaceId) ?? []).find((project) => project.id === projectId);
  return found ? normalizeProject(found) : null;
}

export function createProject(workspaceId: string, profileInput: ProjectProfileInput): ProjectProfile {
  const id = `prj_${Date.now()}`;
  const nextProject: ProjectProfile = {
    id,
    workspaceId,
    createdAtISO: new Date().toISOString(),
    projectMembers: [{ memberId: "member_owner" }],
    policies: normalizePolicies(),
    ...profileInput,
  };

  const current = store.get(workspaceId) ?? [];
  store.set(workspaceId, [nextProject, ...current]);
  return nextProject;
}

export function updateProjectProfile(
  workspaceId: string,
  projectId: string,
  updates: Partial<ProjectProfileInput>,
): ProjectProfile | null {
  const current = store.get(workspaceId) ?? [];
  const index = current.findIndex((project) => project.id === projectId);
  if (index < 0) {
    return null;
  }

  const existing = current[index];
  const next: ProjectProfile = {
    ...existing,
    ...updates,
    cadence: updates.cadence ?? existing.cadence,
    kanaly: updates.kanaly ?? existing.kanaly,
    glowneKlastry: updates.glowneKlastry ?? existing.glowneKlastry,
    slowaKluczowe: updates.slowaKluczowe ?? existing.slowaKluczowe,
    konkurenci: updates.konkurenci ?? existing.konkurenci,
    linkiWewnetrzne: updates.linkiWewnetrzne ?? existing.linkiWewnetrzne,
    linkiZewnetrzne: updates.linkiZewnetrzne ?? existing.linkiZewnetrzne,
    projectMembers: existing.projectMembers ?? [{ memberId: "member_owner" }],
    policies: normalizePolicies(existing.policies),
  };

  const nextItems = [...current];
  nextItems[index] = next;
  store.set(workspaceId, nextItems);
  return next;
}

export function getProjectMembers(workspaceId: string, projectId: string): ProjectMember[] {
  const project = getProject(workspaceId, projectId);
  return project?.projectMembers ? [...project.projectMembers] : [{ memberId: "member_owner" }];
}

export function setProjectMembers(
  workspaceId: string,
  projectId: string,
  members: ProjectMember[],
): ProjectProfile | null {
  const current = store.get(workspaceId) ?? [];
  const index = current.findIndex((project) => project.id === projectId);
  if (index < 0) {
    return null;
  }

  const existing = normalizeProject(current[index]);
  const nextMembers = members.length > 0 ? members : [{ memberId: "member_owner" }];
  const next: ProjectProfile = {
    ...existing,
    projectMembers: nextMembers,
  };

  const nextItems = [...current];
  nextItems[index] = next;
  store.set(workspaceId, nextItems);
  return next;
}

export function getProjectPlanningContext(project: ProjectProfile): ProjectPlanningContext {
  return {
    channels: project.kanaly.map((channel) => channel.nazwa || channel.typ),
    cadenceDays: [...project.cadence.dniTygodnia],
    cadenceFrequency: project.cadence.czestotliwoscTygodniowa,
    clusters: [...project.glowneKlastry],
    keywords: [...project.slowaKluczowe],
    internalLinksCount: project.linkiWewnetrzne.length,
  };
}

export function getProjectPolicies(workspaceId: string, projectId: string): ProjectPolicies {
  const project = getProject(workspaceId, projectId);
  return normalizePolicies(project?.policies);
}

export function updateProjectPolicies(
  workspaceId: string,
  projectId: string,
  patch: Partial<ProjectPolicies>,
  actor?: AuditActor,
): ProjectPolicies {
  const current = store.get(workspaceId) ?? [];
  const index = current.findIndex((project) => project.id === projectId);
  if (index < 0) {
    return normalizePolicies();
  }

  const existing = normalizeProject(current[index]);
  const previousPolicies = normalizePolicies(existing.policies);
  const nextPolicies = normalizePolicies({
    ...previousPolicies,
    ...patch,
  });

  const nextProject: ProjectProfile = {
    ...existing,
    policies: nextPolicies,
  };

  const nextItems = [...current];
  nextItems[index] = nextProject;
  store.set(workspaceId, nextItems);

  recordAuditEvent({
    id: `aud_${Date.now()}`,
    workspaceId,
    projectId,
    type: "policy_changed",
    timestampISO: new Date().toISOString(),
    actor: actor ?? getFallbackActor(workspaceId),
    source: "manual",
    summary: "Zmieniono polityki projektu.",
    details: {
      before: previousPolicies,
      after: nextPolicies,
    },
  });

  return nextPolicies;
}

function publicationStoreKey(workspaceId: string, projectId: string): string {
  return `${workspaceId}:${projectId}`;
}

function getFallbackActor(workspaceId: string): AuditActor {
  const member =
    listMembers(workspaceId).find((item) => item.id === "member_owner") ??
    listMembers(workspaceId)[0];

  if (!member) {
    return {
      memberId: "member_owner",
      name: "System",
      role: "owner",
    };
  }

  return {
    memberId: member.id,
    name: member.imie,
    role: member.role,
  };
}

function compareAuditEventsDesc(left: AuditEvent, right: AuditEvent): number {
  const byTimestamp = right.timestampISO.localeCompare(left.timestampISO);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }
  return right.id.localeCompare(left.id);
}

export function listAuditEvents(
  workspaceId: string,
  projectId: string,
  opts?: { publicationId?: string; limit?: number },
): AuditEvent[] {
  const key = publicationStoreKey(workspaceId, projectId);
  const publicationId = opts?.publicationId;
  const limit = opts?.limit ?? AUDIT_EVENTS_LIMIT_PER_PROJECT;

  const items = (auditStore.get(key) ?? [])
    .filter((event) => (publicationId ? event.publicationId === publicationId : true))
    .sort(compareAuditEventsDesc);

  return items.slice(0, Math.max(1, limit));
}

export function recordAuditEvent(event: AuditEvent): void {
  const key = publicationStoreKey(event.workspaceId, event.projectId);
  const current = auditStore.get(key) ?? [];
  const next = [...current, event]
    .sort(compareAuditEventsDesc)
    .slice(0, AUDIT_EVENTS_LIMIT_PER_PROJECT);
  auditStore.set(key, next);
}

function resolveAiCounterKey(workspaceId: string, projectId: string): string {
  return publicationStoreKey(workspaceId, projectId);
}

function resolveDayKey(referenceDate?: Date): string {
  const date = referenceDate ?? new Date();
  return date.toISOString().slice(0, 10);
}

export function getDailyAiGenerationUsage(
  workspaceId: string,
  projectId: string,
  referenceDate?: Date,
): { dayKey: string; used: number; limit: number } {
  const policies = getProjectPolicies(workspaceId, projectId);
  const dayKey = resolveDayKey(referenceDate);
  const counterKey = resolveAiCounterKey(workspaceId, projectId);
  const counters = aiGenerationsByDayStore.get(counterKey) ?? {};
  const used = counters[dayKey] ?? 0;
  return {
    dayKey,
    used,
    limit: policies.dailyAiGenerationLimit,
  };
}

export function canGenerateAiToday(
  workspaceId: string,
  projectId: string,
  referenceDate?: Date,
): { allowed: boolean; dayKey: string; used: number; limit: number } {
  const usage = getDailyAiGenerationUsage(workspaceId, projectId, referenceDate);
  if (usage.limit === 0) {
    return { ...usage, allowed: true };
  }
  return {
    ...usage,
    allowed: usage.used < usage.limit,
  };
}

export function incrementDailyAiGenerationUsage(
  workspaceId: string,
  projectId: string,
  referenceDate?: Date,
): { dayKey: string; used: number; limit: number } {
  const dayKey = resolveDayKey(referenceDate);
  const counterKey = resolveAiCounterKey(workspaceId, projectId);
  const counters = aiGenerationsByDayStore.get(counterKey) ?? {};
  const nextUsed = (counters[dayKey] ?? 0) + 1;
  aiGenerationsByDayStore.set(counterKey, {
    ...counters,
    [dayKey]: nextUsed,
  });

  const policies = getProjectPolicies(workspaceId, projectId);
  return {
    dayKey,
    used: nextUsed,
    limit: policies.dailyAiGenerationLimit,
  };
}

export function listPublications(workspaceId: string, projectId: string): PublicationJob[] {
  const key = publicationStoreKey(workspaceId, projectId);
  const items = publicationStore.get(key) ?? [];
  return [...items].sort((left, right) => {
    const byDate = left.dataPublikacjiISO.localeCompare(right.dataPublikacjiISO);
    if (byDate !== 0) {
      return byDate;
    }
    return left.createdAtISO.localeCompare(right.createdAtISO);
  });
}

export function createPublication(
  workspaceId: string,
  projectId: string,
  input: Omit<PublicationJob, "id" | "projectId" | "workspaceId" | "createdAtISO">,
  actor?: AuditActor,
): PublicationJob {
  const key = publicationStoreKey(workspaceId, projectId);
  const nowISO = new Date().toISOString();
  const nextItem: PublicationJob = {
    id: `pub_${Date.now()}`,
    projectId,
    workspaceId,
    createdAtISO: nowISO,
    ...input,
  };

  const current = publicationStore.get(key) ?? [];
  publicationStore.set(key, [...current, nextItem]);

  recordAuditEvent({
    id: `aud_${Date.now()}`,
    workspaceId,
    projectId,
    publicationId: nextItem.id,
    publicationTitle: nextItem.tytul,
    type: "publication_created",
    timestampISO: new Date().toISOString(),
    actor: actor ?? getFallbackActor(workspaceId),
    source: "manual",
    summary: `Utworzono publikację: ${nextItem.tytul}.`,
    details: {
      channel: nextItem.kanal,
      publicationType: nextItem.typ,
      status: nextItem.status,
    },
  });

  return nextItem;
}

export function updatePublicationStatus(
  workspaceId: string,
  projectId: string,
  publicationId: string,
  status: PublicationStatus,
  actor?: AuditActor,
): PublicationJob | null {
  const key = publicationStoreKey(workspaceId, projectId);
  const current = publicationStore.get(key) ?? [];
  const index = current.findIndex((publication) => publication.id === publicationId);
  if (index < 0) {
    return null;
  }

  const existing = current[index];
  const next = { ...existing, status };
  const nextItems = [...current];
  nextItems[index] = next;
  publicationStore.set(key, nextItems);

  recordAuditEvent({
    id: `aud_${Date.now()}`,
    workspaceId,
    projectId,
    publicationId: next.id,
    publicationTitle: next.tytul,
    type: "status_changed",
    timestampISO: new Date().toISOString(),
    actor: actor ?? getFallbackActor(workspaceId),
    source: "manual",
    summary: `Zmieniono status publikacji: ${next.tytul}.`,
    details: {
      from: existing.status,
      to: status,
    },
  });

  return next;
}

export function deletePublication(
  workspaceId: string,
  projectId: string,
  publicationId: string,
  actor?: AuditActor,
): void {
  const key = publicationStoreKey(workspaceId, projectId);
  const current = publicationStore.get(key) ?? [];
  const deleted = current.find((publication) => publication.id === publicationId) ?? null;
  publicationStore.set(
    key,
    current.filter((publication) => publication.id !== publicationId),
  );

  if (deleted) {
    recordAuditEvent({
      id: `aud_${Date.now()}`,
      workspaceId,
      projectId,
      publicationId: deleted.id,
      publicationTitle: deleted.tytul,
      type: "publication_deleted",
      timestampISO: new Date().toISOString(),
      actor: actor ?? getFallbackActor(workspaceId),
      source: "manual",
      summary: `Usunięto publikację: ${deleted.tytul}.`,
      details: {
        previousStatus: deleted.status,
      },
    });
  }
}

export function addAiVersion(
  workspaceId: string,
  projectId: string,
  publicationId: string,
  version: Omit<AiDraftVersion, "id" | "createdAtISO">,
): PublicationJob | null {
  const key = publicationStoreKey(workspaceId, projectId);
  const current = publicationStore.get(key) ?? [];
  const index = current.findIndex((publication) => publication.id === publicationId);
  if (index < 0) {
    return null;
  }

  const nextVersion: AiDraftVersion = {
    id: `aiv_${Date.now()}`,
    createdAtISO: new Date().toISOString(),
    ...version,
  };

  const existing = current[index];
  const nextPublication: PublicationJob = {
    ...existing,
    aiVersions: [nextVersion, ...(existing.aiVersions ?? [])],
  };

  const nextItems = [...current];
  nextItems[index] = nextPublication;
  publicationStore.set(key, nextItems);
  return nextPublication;
}

export function setPublicationDraft(
  workspaceId: string,
  projectId: string,
  publicationId: string,
  patch: {
    contentDraft?: string;
    outlineDraft?: string;
    seoNotes?: string;
  },
): PublicationJob | null {
  const key = publicationStoreKey(workspaceId, projectId);
  const current = publicationStore.get(key) ?? [];
  const index = current.findIndex((publication) => publication.id === publicationId);
  if (index < 0) {
    return null;
  }

  const existing = current[index];
  const nextPublication: PublicationJob = {
    ...existing,
    contentDraft: patch.contentDraft ?? existing.contentDraft,
    outlineDraft: patch.outlineDraft ?? existing.outlineDraft,
    seoNotes: patch.seoNotes ?? existing.seoNotes,
  };

  const nextItems = [...current];
  nextItems[index] = nextPublication;
  publicationStore.set(key, nextItems);
  return nextPublication;
}

export function assignPublication(
  workspaceId: string,
  projectId: string,
  publicationId: string,
  assigneeId: string | null,
  actor?: AuditActor,
): PublicationJob | null {
  const key = publicationStoreKey(workspaceId, projectId);
  const current = publicationStore.get(key) ?? [];
  const index = current.findIndex((publication) => publication.id === publicationId);
  if (index < 0) {
    return null;
  }

  const existing = current[index];
  let assigneeName: string | undefined;
  if (assigneeId) {
    const member = listMembers(workspaceId).find((item) => item.id === assigneeId);
    assigneeName = member?.imie;
  }

  const nextPublication: PublicationJob = {
    ...existing,
    assigneeId: assigneeId ?? undefined,
    assigneeName: assigneeId ? assigneeName : undefined,
  };

  const nextItems = [...current];
  nextItems[index] = nextPublication;
  publicationStore.set(key, nextItems);

  recordAuditEvent({
    id: `aud_${Date.now()}`,
    workspaceId,
    projectId,
    publicationId: nextPublication.id,
    publicationTitle: nextPublication.tytul,
    type: "assignee_changed",
    timestampISO: new Date().toISOString(),
    actor: actor ?? getFallbackActor(workspaceId),
    source: "manual",
    summary: `Zmieniono przypisanie publikacji: ${nextPublication.tytul}.`,
    details: {
      from: existing.assigneeName ?? existing.assigneeId ?? null,
      to: nextPublication.assigneeName ?? nextPublication.assigneeId ?? null,
    },
  });

  return nextPublication;
}
