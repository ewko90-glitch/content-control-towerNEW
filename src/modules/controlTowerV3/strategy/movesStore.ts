import { getCached, setCached } from "@/lib/domain/controlTowerV3/cache";

import { generateStrategicMoves, getIsoWeekKey, norm, stableHash, type StrategicMove } from "./moves";
import type { StrategicAlignmentResult, StrategicArtifact } from "./types";

const MOVES_TTL_MS = 8 * 24 * 60 * 60 * 1000;

function key(workspaceId: string, weekKey: string): string {
  return `ctv3:strategy:moves:${workspaceId}:${weekKey}`;
}

function parseRaw(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isMoveActionKind(value: unknown): value is StrategicMove["recommendedActions"][number]["kind"] {
  return value === "workflow" || value === "content" || value === "calendar" || value === "quality" || value === "ops";
}

function isMoveKind(value: unknown): value is StrategicMove["kind"] {
  return value === "focus" || value === "stability" || value === "optimization";
}

function isEffort(value: unknown): value is StrategicMove["effort"] {
  return value === "S" || value === "M" || value === "L";
}

function isRisk(value: unknown): value is StrategicMove["risk"] {
  return value === "low" || value === "medium" || value === "high";
}

function isConfidence(value: unknown): value is StrategicMove["expectedImpact"]["confidence"] {
  return value === "low" || value === "medium" || value === "high";
}

function isStrategicMove(value: unknown): value is StrategicMove {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  const hasValidLinkedArtifacts =
    Array.isArray(record.linkedArtifacts) &&
    record.linkedArtifacts.every((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return false;
      }
      const link = entry as Record<string, unknown>;
      return typeof link.artifactId === "string" && typeof link.title === "string" && typeof link.type === "string";
    });

  const hasValidActions =
    Array.isArray(record.recommendedActions) &&
    record.recommendedActions.every((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return false;
      }
      const action = entry as Record<string, unknown>;
      return (
        typeof action.title === "string" &&
        typeof action.reason === "string" &&
        isMoveActionKind(action.kind)
      );
    });

  const impact = record.expectedImpact as Record<string, unknown> | undefined;
  const diagnostics = record.diagnostics as Record<string, unknown> | undefined;
  const diagnosticsInputs = diagnostics?.inputs as Record<string, unknown> | undefined;

  return (
    typeof record.id === "string" &&
    typeof record.workspaceId === "string" &&
    typeof record.weekKey === "string" &&
    isMoveKind(record.kind) &&
    typeof record.title === "string" &&
    typeof record.why === "string" &&
    hasValidLinkedArtifacts &&
    typeof record.successMetric === "string" &&
    isEffort(record.effort) &&
    isRisk(record.risk) &&
    typeof record.createdAt === "string" &&
    hasValidActions &&
    typeof impact === "object" &&
    impact !== null &&
    typeof impact.healthScoreDelta === "number" &&
    isConfidence(impact.confidence) &&
    typeof impact.rationale === "string" &&
    typeof diagnostics === "object" &&
    diagnostics !== null &&
    typeof diagnostics.alignmentScore === "number" &&
    typeof diagnostics.driftDetected === "boolean" &&
    typeof diagnosticsInputs === "object" &&
    diagnosticsInputs !== null &&
    typeof diagnosticsInputs.artifacts === "number" &&
    typeof diagnosticsInputs.actions === "number" &&
    typeof diagnosticsInputs.outcomes === "number" &&
    Array.isArray(diagnostics.notes) &&
    diagnostics.notes.every((note) => typeof note === "string")
  );
}

function moveKindOrder(kind: StrategicMove["kind"]): number {
  if (kind === "focus") {
    return 0;
  }
  if (kind === "stability") {
    return 1;
  }
  return 2;
}

function toStableMoves(input: StrategicMove[]): StrategicMove[] {
  return [...input].sort((left, right) => {
    const leftOrder = moveKindOrder(left.kind);
    const rightOrder = moveKindOrder(right.kind);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.title.localeCompare(right.title);
  });
}

function deriveId(params: {
  workspaceId: string;
  weekKey: string;
  index: number;
  title: string;
}): string {
  return `smv_${stableHash(`${params.workspaceId}|${params.weekKey}|${params.index}|${norm(params.title)}`)}`;
}

function neutralAlignment(): StrategicAlignmentResult {
  return {
    alignmentScore: 50,
    confidence: "low",
    driftDetected: false,
    driftReason: "Brak wystarczających danych do oceny dryfu.",
    topAligned: [],
    topMisaligned: [],
    recommendedCorrections: [],
    diagnostics: {
      inputs: { artifacts: 0, actions: 0, outcomes: 0 },
      notes: ["fallback:neutral"],
    },
  };
}

export async function getWeeklyMoves(workspaceId: string, weekKey: string): Promise<StrategicMove[] | null> {
  const raw = getCached<unknown>(key(workspaceId, weekKey));
  const decoded = parseRaw(raw);

  if (!Array.isArray(decoded)) {
    return null;
  }

  const moves = decoded.filter((entry): entry is StrategicMove => isStrategicMove(entry));
  if (moves.length !== decoded.length) {
    return null;
  }

  return toStableMoves(moves);
}

export async function saveWeeklyMoves(workspaceId: string, weekKey: string, moves: StrategicMove[]): Promise<void> {
  const stable = toStableMoves(moves).map((move) => ({
    ...move,
    workspaceId,
    weekKey,
  }));

  setCached(key(workspaceId, weekKey), stable, MOVES_TTL_MS);
}

export async function getOrGenerateWeeklyMoves(args: {
  workspaceId: string;
  nowIso: string;
  artifacts: StrategicArtifact[];
  alignment: StrategicAlignmentResult;
  recentActions: Array<{ createdAt?: string; title?: string; name?: string; type?: string; kind?: string }>;
  outcomes: Array<{ createdAt?: string; occurredAt?: string; outcome?: string }>;
}): Promise<StrategicMove[]> {
  const nowIso = typeof args.nowIso === "string" && Number.isFinite(Date.parse(args.nowIso))
    ? new Date(args.nowIso).toISOString()
    : "1970-01-01T00:00:00.000Z";
  const weekKey = getIsoWeekKey(nowIso);

  const cached = await getWeeklyMoves(args.workspaceId, weekKey);
  if (cached && cached.length === 3 && cached.every((move) => move.weekKey === weekKey)) {
    return toStableMoves(cached);
  }

  const generated = generateStrategicMoves({
    workspaceId: args.workspaceId,
    nowIso,
    artifacts: Array.isArray(args.artifacts) ? args.artifacts : [],
    alignment: args.alignment ?? neutralAlignment(),
    recentActions: Array.isArray(args.recentActions) ? args.recentActions : [],
    outcomes: Array.isArray(args.outcomes) ? args.outcomes : [],
  });

  const stableGenerated = [...generated].sort((left, right) => moveKindOrder(left.kind) - moveKindOrder(right.kind));

  const withIds: StrategicMove[] = stableGenerated.map((move, index) => ({
    ...move,
    workspaceId: args.workspaceId,
    weekKey,
    id: deriveId({
      workspaceId: args.workspaceId,
      weekKey,
      index,
      title: move.title,
    }),
  }));

  await saveWeeklyMoves(args.workspaceId, weekKey, withIds);
  return toStableMoves(withIds);
}
