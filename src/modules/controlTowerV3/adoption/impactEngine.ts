import type { StrategicMove } from "@/modules/controlTowerV3/strategy/moves";

import { setAdoptionStatus } from "./adoptionStore";
import type { ImpactSnapshot, MoveImpactWindows } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeIso(input: string): string {
  return Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : "1970-01-01T00:00:00.000Z";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function pickHealth(snapshot: any): number {
  return clamp(Number(snapshot?.healthScore ?? snapshot?.metrics?.healthScore ?? snapshot?.overview?.healthScore ?? 0), -100, 100);
}

function pickAlignment(snapshot: any): number {
  return clamp(
    Number(snapshot?.strategy?.alignment?.alignmentScore ?? snapshot?.strategy?.strategicAlignment?.alignmentScore ?? snapshot?.strategicAlignment?.alignmentScore ?? 0),
    -100,
    100,
  );
}

function pickMomentum(snapshot: any): number {
  return clamp(Number(snapshot?.trend7d?.score ?? snapshot?.impact?.trend7d?.score ?? snapshot?.metrics?.momentum7d ?? 0), -100, 100);
}

function deriveConfidence(currentSnapshot: any): "low" | "medium" | "high" {
  const artifacts = Number(currentSnapshot?.strategy?.artifacts?.length ?? currentSnapshot?.strategy?.alignment?.diagnostics?.inputs?.artifacts ?? 0);
  const outcomes = Number(currentSnapshot?.strategy?.alignment?.diagnostics?.inputs?.outcomes ?? 0);
  const evidence = artifacts + outcomes;

  if (evidence >= 10 && outcomes >= 1) {
    return "high";
  }
  if (evidence >= 3) {
    return "medium";
  }
  return "low";
}

function buildImpactSnapshot(args: {
  baselineSnapshot: any;
  currentSnapshot: any;
}): ImpactSnapshot {
  return {
    healthDelta: clamp(Math.round(pickHealth(args.currentSnapshot) - pickHealth(args.baselineSnapshot)), -40, 40),
    alignmentDelta: clamp(Math.round(pickAlignment(args.currentSnapshot) - pickAlignment(args.baselineSnapshot)), -40, 40),
    momentumDelta: clamp(Math.round(pickMomentum(args.currentSnapshot) - pickMomentum(args.baselineSnapshot)), -40, 40),
    confidence: deriveConfidence(args.currentSnapshot),
  };
}

function deriveWindows(args: {
  adoptedAtIso: string;
  nowIso: string;
  impact: ImpactSnapshot;
}): MoveImpactWindows {
  const adoptedTs = Date.parse(args.adoptedAtIso);
  const nowTs = Date.parse(args.nowIso);
  if (!Number.isFinite(adoptedTs) || !Number.isFinite(nowTs)) {
    return {};
  }

  const days = Math.floor((nowTs - adoptedTs) / DAY_MS);
  const windows: MoveImpactWindows = {};

  if (days >= 3) {
    windows.d3 = args.impact;
  }
  if (days >= 7) {
    windows.d7 = args.impact;
  }
  if (days >= 14) {
    windows.d14 = args.impact;
  }
  if (days >= 30) {
    windows.d30 = args.impact;
  }

  return windows;
}

export function computeMoveImpact(args: {
  workspaceId: string;
  move: StrategicMove;
  baselineSnapshot: any;
  currentSnapshot: any;
  nowIso: string;
}): StrategicMove {
  const nowIso = normalizeIso(args.nowIso);
  const adoptedAtIso = args.move.adoption?.adoptedAtIso;

  if (!adoptedAtIso) {
    return args.move;
  }

  const impact = buildImpactSnapshot({
    baselineSnapshot: args.baselineSnapshot,
    currentSnapshot: args.currentSnapshot,
  });

  const windows = deriveWindows({
    adoptedAtIso,
    nowIso,
    impact,
  });

  const adoptionStatus = args.move.adoption?.status ?? "adopted";

  const nextMove: StrategicMove = {
    ...args.move,
    adoption: {
      status: adoptionStatus,
      adoptedAtIso,
      impact: windows,
    },
  };

  setAdoptionStatus({
    workspaceId: args.workspaceId,
    moveId: args.move.id,
    status: adoptionStatus,
    adoptedAtIso,
    impact: windows,
    nowIso,
  });

  return nextMove;
}
