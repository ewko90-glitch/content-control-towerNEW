import type { StrategicMove } from "@/modules/controlTowerV3/strategy/moves";

import { getAdoption, setAdoptionStatus } from "./adoptionStore";
import type { AdoptionStatus, MoveAdoption } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeIso(input: string): string {
  return Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : "1970-01-01T00:00:00.000Z";
}

function deriveStatusFromAge(move: StrategicMove, nowIso: string): AdoptionStatus {
  const moveTs = Date.parse(move.createdAt);
  const nowTs = Date.parse(nowIso);
  if (!Number.isFinite(moveTs) || !Number.isFinite(nowTs)) {
    return "not_started";
  }

  if (nowTs - moveTs >= 14 * DAY_MS) {
    return "ignored";
  }

  return "not_started";
}

function toAdoption(move: StrategicMove, nowIso: string): MoveAdoption {
  const existing = getAdoption(move.workspaceId, move.id);
  if (existing) {
    return {
      status: existing.status,
      adoptedAtIso: existing.adoptedAtIso,
      impact: existing.impact,
    };
  }

  const fallbackStatus = deriveStatusFromAge(move, nowIso);
  if (fallbackStatus === "ignored") {
    const createdIso = Number.isFinite(Date.parse(move.createdAt)) ? new Date(move.createdAt).toISOString() : normalizeIso(nowIso);
    const persisted = setAdoptionStatus({
      workspaceId: move.workspaceId,
      moveId: move.id,
      status: "ignored",
      nowIso: normalizeIso(nowIso),
      adoptedAtIso: createdIso,
    });

    return {
      status: persisted.status,
      adoptedAtIso: persisted.adoptedAtIso,
      impact: persisted.impact,
    };
  }

  return {
    status: fallbackStatus,
  };
}

export function enrichMovesWithAdoption(args: {
  workspaceId: string;
  moves: StrategicMove[];
  nowIso: string;
}): StrategicMove[] {
  const nowIso = normalizeIso(args.nowIso);

  return [...args.moves]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((move) => ({
      ...move,
      adoption: toAdoption(
        {
          ...move,
          workspaceId: args.workspaceId,
        },
        nowIso,
      ),
    }));
}
