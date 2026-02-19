import { getCached, setCached } from "@/lib/domain/controlTowerV3/cache";
import type {
  StrategicArtifact,
  StrategicArtifactStatus,
  StrategicArtifactType,
  StrategicHorizon,
  StrategicStorePayload,
} from "./types";

const STORE_VERSION = 1 as const;
const STORE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE = 100;
const MAX_ARCHIVED = 300;

function storeKey(workspaceId: string): string {
  return `ctv3:strategy:${workspaceId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWorkspaceId(workspaceId: string): string {
  const normalized = clampLength(workspaceId, 120);
  return normalized.length > 0 ? normalized : "workspace";
}

function clampLength(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function normalizeTags(tags?: readonly string[]): string[] | undefined {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const normalized = tags
    .map((entry) => clampLength(entry.toLowerCase(), 20))
    .filter((entry) => entry.length > 0)
    .slice(0, 8);

  return normalized.length > 0 ? normalized : undefined;
}

function createId(workspaceId: string): string {
  const scope = normalizeWorkspaceId(workspaceId);
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  const seed = `${scope}:${nowIso()}`;
  return `strat_${seed}`;
}

function parseCachedRaw(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function payloadDigest(payload: StrategicStorePayload): string {
  const normalized = {
    version: payload.version,
    updatedAt: payload.updatedAt,
    artifacts: payload.artifacts.map((artifact) => ({
      id: artifact.id,
      workspaceId: artifact.workspaceId,
      type: artifact.type,
      title: artifact.title,
      description: artifact.description,
      status: artifact.status,
      intent: artifact.intent,
      successMetric: artifact.successMetric,
      owner: artifact.owner,
      horizon: artifact.horizon,
      tags: artifact.tags,
      createdAt: artifact.createdAt,
      createdBy: artifact.createdBy,
      updatedAt: artifact.updatedAt,
      archivedAt: artifact.archivedAt,
    })),
  };

  return JSON.stringify(normalized);
}

function toHorizon(value: unknown): StrategicHorizon {
  if (value === "now" || value === "this_month" || value === "this_quarter" || value === "this_year") {
    return value;
  }
  return "this_quarter";
}

function toType(value: unknown): StrategicArtifactType {
  if (value === "priority" || value === "hypothesis" || value === "experiment" || value === "assumption" || value === "decision") {
    return value;
  }
  return "priority";
}

function toStatus(value: unknown): StrategicArtifactStatus {
  if (value === "active" || value === "archived") {
    return value;
  }
  return "active";
}

function sanitizeArtifact(workspaceId: string, input: unknown): StrategicArtifact | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;

  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : createId(workspaceId);
  const title = clampLength(typeof record.title === "string" ? record.title : "Untitled", 80);
  const description = clampLength(typeof record.description === "string" ? record.description : "", 600);
  const intent = clampLength(typeof record.intent === "string" ? record.intent : "", 140);

  if (title.length === 0 || intent.length === 0) {
    return null;
  }

  return {
    id,
    workspaceId,
    type: toType(record.type),
    title,
    description,
    status: toStatus(record.status),
    intent,
    successMetric:
      typeof record.successMetric === "string" && record.successMetric.trim().length > 0
        ? clampLength(record.successMetric, 120)
        : undefined,
    owner: typeof record.owner === "string" && record.owner.trim().length > 0 ? clampLength(record.owner, 80) : undefined,
    horizon: toHorizon(record.horizon),
    tags: normalizeTags(Array.isArray(record.tags) ? (record.tags as string[]) : undefined),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(),
    createdBy: typeof record.createdBy === "string" && record.createdBy.trim().length > 0 ? clampLength(record.createdBy, 80) : "system",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    archivedAt: typeof record.archivedAt === "string" ? record.archivedAt : undefined,
  };
}

function sortByCreatedAsc(left: StrategicArtifact, right: StrategicArtifact): number {
  const leftMs = new Date(left.createdAt).getTime();
  const rightMs = new Date(right.createdAt).getTime();
  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }
  return left.id.localeCompare(right.id);
}

function sortByCreatedDesc(left: StrategicArtifact, right: StrategicArtifact): number {
  return sortByCreatedAsc(right, left);
}

function enforceLimits(artifacts: StrategicArtifact[]): StrategicArtifact[] {
  const active = artifacts.filter((artifact) => artifact.status === "active").sort(sortByCreatedAsc);
  const archived = artifacts.filter((artifact) => artifact.status === "archived").sort(sortByCreatedDesc);

  while (active.length > MAX_ACTIVE) {
    const decisionCandidates = active.filter((artifact) => artifact.type === "decision");
    const candidate = decisionCandidates[0] ?? active[0];

    const index = active.findIndex((artifact) => artifact.id === candidate.id);
    if (index >= 0) {
      const [removed] = active.splice(index, 1);
      archived.push({
        ...removed,
        status: "archived",
        archivedAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  const boundedArchived = archived.sort(sortByCreatedDesc).slice(0, MAX_ARCHIVED);
  const combined = [...active.sort(sortByCreatedDesc), ...boundedArchived.sort(sortByCreatedDesc)];
  return combined;
}

function parsePayload(workspaceId: string, raw: unknown): StrategicStorePayload {
  const decoded = parseCachedRaw(raw);

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return {
      version: STORE_VERSION,
      updatedAt: nowIso(),
      artifacts: [],
    };
  }

  const record = decoded as Record<string, unknown>;
  if (record.version !== STORE_VERSION) {
    return {
      version: STORE_VERSION,
      updatedAt: nowIso(),
      artifacts: [],
    };
  }

  const artifacts = Array.isArray(record.artifacts)
    ? record.artifacts
        .map((entry) => sanitizeArtifact(workspaceId, entry))
        .filter((entry): entry is StrategicArtifact => entry !== null)
    : [];

  return {
    version: STORE_VERSION,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : nowIso(),
    artifacts: enforceLimits(artifacts),
  };
}

function savePayload(workspaceId: string, payload: StrategicStorePayload): StrategicStorePayload {
  const normalized: StrategicStorePayload = {
    version: STORE_VERSION,
    updatedAt: nowIso(),
    artifacts: enforceLimits([...payload.artifacts]),
  };

  setCached(storeKey(workspaceId), normalized, STORE_TTL_MS);
  return normalized;
}

export async function getStrategicArtifacts(workspaceId: string): Promise<StrategicArtifact[]> {
  const raw = getCached<unknown>(storeKey(workspaceId));
  const payload = parsePayload(workspaceId, raw);

  const decodedRaw = parseCachedRaw(raw);
  const rawDigest =
    typeof decodedRaw === "object" && decodedRaw !== null && !Array.isArray(decodedRaw)
      ? payloadDigest(parsePayload(workspaceId, decodedRaw))
      : "";
  const normalizedDigest = payloadDigest(payload);

  if (payload.artifacts.length === 0) {
    const seeded = await seedDefaultStrategyIfEmpty(workspaceId);
    return seeded;
  }

  if (rawDigest !== normalizedDigest) {
    savePayload(workspaceId, payload);
  }

  return [...payload.artifacts].sort(sortByCreatedDesc);
}

export async function saveStrategicArtifact(
  workspaceId: string,
  artifactInput: Omit<Partial<StrategicArtifact>, "workspaceId" | "id" | "createdAt" | "updatedAt" | "archivedAt">,
): Promise<StrategicArtifact> {
  const existing = parsePayload(workspaceId, getCached<unknown>(storeKey(workspaceId)));
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const title = clampLength(artifactInput.title ?? "Untitled strategic artifact", 80) || "Untitled strategic artifact";
  const intent = clampLength(artifactInput.intent ?? "Zdefiniuj cel i oczekiwany efekt.", 140) || "Zdefiniuj cel i oczekiwany efekt.";

  const artifact: StrategicArtifact = {
    id: createId(workspaceId),
    workspaceId,
    type: toType(artifactInput.type),
    title,
    description: clampLength(artifactInput.description ?? "", 600),
    status: toStatus(artifactInput.status ?? "active"),
    intent,
    successMetric: artifactInput.successMetric ? clampLength(artifactInput.successMetric, 120) : undefined,
    owner: artifactInput.owner ? clampLength(artifactInput.owner, 80) : undefined,
    horizon: toHorizon(artifactInput.horizon),
    tags: normalizeTags(artifactInput.tags),
    createdAt,
    createdBy: artifactInput.createdBy ? clampLength(artifactInput.createdBy, 80) : "system",
    updatedAt,
    archivedAt: undefined,
  };

  const nextPayload = savePayload(workspaceId, {
    ...existing,
    artifacts: [artifact, ...existing.artifacts],
  });

  return nextPayload.artifacts.find((entry) => entry.id === artifact.id) ?? artifact;
}

export async function archiveStrategicArtifact(workspaceId: string, id: string, archivedBy?: string): Promise<boolean> {
  const payload = parsePayload(workspaceId, getCached<unknown>(storeKey(workspaceId)));
  const target = payload.artifacts.find((artifact) => artifact.id === id);
  if (!target || target.status === "archived") {
    return false;
  }

  const updatedAt = nowIso();
  const nextArtifacts = payload.artifacts.map((artifact) =>
    artifact.id === id
      ? {
          ...artifact,
          status: "archived" as const,
          archivedAt: updatedAt,
          updatedAt,
          owner: archivedBy ? clampLength(archivedBy, 80) : artifact.owner,
        }
      : artifact,
  );

  savePayload(workspaceId, {
    ...payload,
    artifacts: nextArtifacts,
  });

  return true;
}

export async function restoreStrategicArtifact(workspaceId: string, id: string): Promise<boolean> {
  const payload = parsePayload(workspaceId, getCached<unknown>(storeKey(workspaceId)));
  const activeCount = payload.artifacts.filter((artifact) => artifact.status === "active").length;
  const target = payload.artifacts.find((artifact) => artifact.id === id);

  if (!target || target.status !== "archived" || activeCount >= MAX_ACTIVE) {
    return false;
  }

  const updatedAt = nowIso();
  const nextArtifacts = payload.artifacts.map((artifact) =>
    artifact.id === id
      ? {
          ...artifact,
          status: "active" as const,
          archivedAt: undefined,
          updatedAt,
        }
      : artifact,
  );

  savePayload(workspaceId, {
    ...payload,
    artifacts: nextArtifacts,
  });

  return true;
}

export async function seedDefaultStrategyIfEmpty(workspaceId: string): Promise<StrategicArtifact[]> {
  const payload = parsePayload(workspaceId, getCached<unknown>(storeKey(workspaceId)));
  if (payload.artifacts.length > 0) {
    return [...payload.artifacts].sort(sortByCreatedDesc);
  }

  const timestamp = nowIso();

  const defaults: Array<Omit<StrategicArtifact, "id" | "createdAt" | "workspaceId">> = [
    {
      type: "priority",
      title: "Ship consistent weekly content cadence",
      description: "Utrzymuj przewidywalny rytm publikacji oparty o jakość i SLA review.",
      status: "active",
      intent: "Zwiększyć przewidywalność delivery i stabilność pipeline.",
      successMetric: "Min. 1 publikacja tygodniowo przez 8 tygodni",
      owner: "system",
      horizon: "this_quarter",
      tags: ["cadence", "delivery"],
      createdBy: "system",
      updatedAt: undefined,
      archivedAt: undefined,
    },
    {
      type: "hypothesis",
      title: "Publishing cadence improves inbound conversion",
      description: "Regularny rytm publikacji zwiększa konwersję inbound przez lepszą widoczność.",
      status: "active",
      intent: "Zweryfikować wpływ regularności publikacji na konwersję.",
      successMetric: "+15% inbound conversion w 6 tygodni",
      owner: "system",
      horizon: "this_quarter",
      tags: ["inbound", "conversion"],
      createdBy: "system",
      updatedAt: undefined,
      archivedAt: undefined,
    },
    {
      type: "assumption",
      title: "ICP values decision-grade insights over volume",
      description: "Docelowy odbiorca ceni jakość wniosków i decyzji ponad wolumen publikacji.",
      status: "active",
      intent: "Utrzymać fokus na jakości insightów i strategicznej użyteczności.",
      successMetric: "CTR dla insight-first content > CTR baseline",
      owner: "system",
      horizon: "this_year",
      tags: ["icp", "positioning"],
      createdBy: "system",
      updatedAt: undefined,
      archivedAt: undefined,
    },
  ];

  const seeded: StrategicArtifact[] = defaults.map((entry) => ({
    ...entry,
    id: createId(workspaceId),
    workspaceId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const nextPayload = savePayload(workspaceId, {
    version: STORE_VERSION,
    updatedAt: nowIso(),
    artifacts: seeded,
  });

  return [...nextPayload.artifacts].sort(sortByCreatedDesc);
}
