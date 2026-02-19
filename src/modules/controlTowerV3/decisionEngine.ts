import type { StrategicAlignmentResult } from "./strategy/types";
import type { StrategicMove } from "./strategy/moves";

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

type AlignmentSignal = Pick<StrategicAlignmentResult, "driftDetected" | "alignmentScore"> | undefined;

export function applyStrategicSoftBias<T extends { kind?: string; score: number }>(params: {
  candidates: ReadonlyArray<T>;
  alignment?: AlignmentSignal;
}): T[] {
  const candidates = Array.isArray(params.candidates) ? [...params.candidates] : [];
  if (candidates.length === 0) {
    return [];
  }

  const alignmentScore = clamp(params.alignment?.alignmentScore ?? 50, 0, 100);
  const driftDetected = params.alignment?.driftDetected === true;

  const stabilizationBoost = driftDetected ? 0.08 : 0;
  const focusBoost = alignmentScore < 60 ? 0.06 : 0;
  const optimizationBoost = alignmentScore > 80 ? 0.05 : 0;

  return candidates
    .map((candidate) => {
      let multiplier = 1;

      if (candidate.kind === "stabilization") {
        multiplier += stabilizationBoost;
      }
      if (candidate.kind === "focus") {
        multiplier += focusBoost;
      }
      if (candidate.kind === "optimization") {
        multiplier += optimizationBoost;
      }

      return {
        ...candidate,
        score: Number((candidate.score * multiplier).toFixed(6)),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (left.kind ?? "").localeCompare(right.kind ?? "");
    });
}

type WeeklyMovesDiagnostics = {
  strategyMoves?: {
    weekKey: string;
    titles: string[];
  };
};

function hasKeyword(value: string | undefined, keywords: readonly string[]): boolean {
  const normalized = (value ?? "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function aggregateActionKinds(weeklyMoves: ReadonlyArray<StrategicMove>): Set<StrategicMove["recommendedActions"][number]["kind"]> {
  const kinds = new Set<StrategicMove["recommendedActions"][number]["kind"]>();
  for (const move of weeklyMoves) {
    for (const action of move.recommendedActions) {
      kinds.add(action.kind);
    }
  }
  return kinds;
}

export function applyStrategicMovesSoftBias<T extends { kind?: string; score: number; title?: string }>(params: {
  candidates: ReadonlyArray<T>;
  weeklyMoves?: ReadonlyArray<StrategicMove>;
  weekKey?: string;
}): { candidates: T[]; diagnostics: WeeklyMovesDiagnostics } {
  const candidates = Array.isArray(params.candidates) ? [...params.candidates] : [];
  const weeklyMoves = Array.isArray(params.weeklyMoves) ? [...params.weeklyMoves] : [];

  if (candidates.length === 0) {
    return { candidates: [], diagnostics: {} };
  }

  if (weeklyMoves.length === 0) {
    return {
      candidates: [...candidates].sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return (left.kind ?? "").localeCompare(right.kind ?? "");
      }),
      diagnostics: {},
    };
  }

  const actionKinds = aggregateActionKinds(weeklyMoves);

  const nudged = candidates
    .map((candidate) => {
      let boost = 0;

      if (actionKinds.has("workflow") || actionKinds.has("ops")) {
        if (hasKeyword(candidate.kind, ["workflow", "ops", "cleanup", "approve", "reject", "wip"]) || hasKeyword(candidate.title, ["cleanup", "approve", "reject", "wip"])) {
          boost += 0.03;
        }
      }
      if (actionKinds.has("content")) {
        if (hasKeyword(candidate.kind, ["content", "ship", "publish"]) || hasKeyword(candidate.title, ["ship", "publish", "content"])) {
          boost += 0.03;
        }
      }
      if (actionKinds.has("calendar")) {
        if (hasKeyword(candidate.kind, ["calendar", "schedule"]) || hasKeyword(candidate.title, ["schedule", "calendar"])) {
          boost += 0.03;
        }
      }
      if (actionKinds.has("quality")) {
        if (hasKeyword(candidate.kind, ["quality", "optimize", "improve"]) || hasKeyword(candidate.title, ["optimize", "improve", "quality"])) {
          boost += 0.03;
        }
      }

      return {
        ...candidate,
        score: Number((candidate.score * (1 + clamp(boost, 0, 0.12))).toFixed(6)),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (left.kind ?? "").localeCompare(right.kind ?? "");
    });

  return {
    candidates: nudged,
    diagnostics: {
      strategyMoves: {
        weekKey: params.weekKey ?? weeklyMoves[0]?.weekKey ?? "",
        titles: weeklyMoves.map((move) => move.title),
      },
    },
  };
}
