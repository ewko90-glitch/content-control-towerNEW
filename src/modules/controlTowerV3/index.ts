import type { OutcomeEvent } from "@/lib/domain/controlTowerV3/feedback/types";

import { computeDecisionAttribution } from "./attributionEngine";
import { getLedgerEntries } from "./ledgerStore";
import { computePortfolioRisk } from "./riskEngine";
import { computeStrategicAlignment } from "./strategy/alignment";
import { strategyCopy } from "./strategy/copy";
import { getIsoWeekKey, type StrategicMove } from "./strategy/moves";
import { getOrGenerateWeeklyMoves } from "./strategy/movesStore";
import { getStrategicArtifacts } from "./strategy/store";
import { enrichMovesWithAdoption } from "./adoption/adoptionEngine";
import { recordAdoptionEvent } from "./adoption/adoptionStore";
import { computeMoveImpact } from "./adoption/impactEngine";
import type {
  StrategicActionLike,
  StrategicAlignmentInput,
  StrategicAlignmentResult,
  StrategicArtifact,
} from "./strategy/types";
import type { DecisionImpactAttribution, ExecutiveIntelligenceSnapshot, PortfolioRiskNode, ScenarioLever } from "./types";

export * from "./strategy/types";
export * from "./strategy/store";
export * from "./strategy/alignment";
export * from "./strategy/copy";
export * from "./strategy/moves";
export * from "./strategy/movesStore";
export * from "./portfolio/types";
export * from "./portfolio/copy";
export * from "./portfolio/portfolio";
export * from "./adoption/types";
export * from "./adoption/adoptionStore";
export * from "./adoption/adoptionEngine";
export * from "./adoption/impactEngine";
export * from "./types";
export * from "./attributionEngine";
export * from "./riskEngine";
export * from "./ledgerStore";
export * from "./calibrationEngine";

const SUPPORTED_SCENARIO_LEVERS: ScenarioLever[] = [
  "prioritize_execution",
  "reduce_drift",
  "optimize_roi",
  "stabilize_workflow",
];

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
      inputs: {
        artifacts: 0,
        actions: 0,
        outcomes: 0,
      },
      notes: ["fallback:neutral"],
    },
  };
}

export async function buildStrategySnapshot(params: {
  workspaceId: string;
  recentActions?: ReadonlyArray<StrategicActionLike>;
  outcomes?: ReadonlyArray<OutcomeEvent>;
  nowIso?: string;
  baselineSnapshot?: unknown;
  currentSnapshot?: unknown;
}): Promise<{
  artifacts: StrategicArtifact[];
  alignment: StrategicAlignmentResult;
  weekKey: string;
  weeklyMoves: StrategicMove[];
  copy: typeof strategyCopy;
} & ExecutiveIntelligenceSnapshot> {
  const nowIso =
    typeof params.nowIso === "string" && Number.isFinite(Date.parse(params.nowIso))
      ? new Date(params.nowIso).toISOString()
      : "1970-01-01T00:00:00.000Z";
  const weekKey = getIsoWeekKey(nowIso);

  const artifacts = await getStrategicArtifacts(params.workspaceId);

  const input: StrategicAlignmentInput = {
    artifacts,
    recentActions: params.recentActions ?? [],
    outcomes: params.outcomes ?? [],
    nowIso,
  };

  let alignment: StrategicAlignmentResult;
  try {
    alignment = computeStrategicAlignment(input);
  } catch {
    alignment = neutralAlignment();
  }

  let weeklyMoves: StrategicMove[];
  try {
    weeklyMoves = await getOrGenerateWeeklyMoves({
      workspaceId: params.workspaceId,
      nowIso,
      artifacts,
      alignment,
      recentActions: [...(params.recentActions ?? [])],
      outcomes: [...(params.outcomes ?? [])],
    });
  } catch {
    weeklyMoves = await getOrGenerateWeeklyMoves({
      workspaceId: params.workspaceId,
      nowIso,
      artifacts: [],
      alignment: neutralAlignment(),
      recentActions: [],
      outcomes: [],
    });
  }

  const moveIdSet = new Set(weeklyMoves.map((move) => move.id));
  const nowIsoSafe = nowIso;

  const linkActionToMove = (action: StrategicActionLike): string | null => {
    const candidateIds = [action.id, action.title, action.name, action.kind, action.type]
      .filter((entry): entry is string => typeof entry === "string");

    for (const candidate of candidateIds) {
      if (moveIdSet.has(candidate)) {
        return candidate;
      }

      const matched = weeklyMoves.find((move) => candidate.includes(move.id));
      if (matched) {
        return matched.id;
      }
    }

    return null;
  };

  const linkOutcomeToMove = (outcome: OutcomeEvent): string | null => {
    if (moveIdSet.has(outcome.sessionId)) {
      return outcome.sessionId;
    }

    const details = outcome.evidence?.details;
    if (typeof details === "string") {
      const matched = weeklyMoves.find((move) => details.includes(move.id));
      if (matched) {
        return matched.id;
      }
    }

    return null;
  };

  for (const action of params.recentActions ?? []) {
    const moveId = linkActionToMove(action);
    if (!moveId) {
      continue;
    }

    recordAdoptionEvent({
      workspaceId: params.workspaceId,
      moveId,
      type: "intent",
      occurredAtIso: action.createdAt ?? nowIsoSafe,
      sessionId: action.id,
    });
  }

  for (const outcome of params.outcomes ?? []) {
    const moveId = linkOutcomeToMove(outcome);
    if (!moveId) {
      continue;
    }

    recordAdoptionEvent({
      workspaceId: params.workspaceId,
      moveId,
      type: "outcome",
      occurredAtIso: outcome.occurredAt,
      sessionId: outcome.sessionId,
    });
  }

  const enrichedMoves = enrichMovesWithAdoption({
    workspaceId: params.workspaceId,
    moves: weeklyMoves,
    nowIso: nowIsoSafe,
  });

  const baselineSnapshot = params.baselineSnapshot ?? {
    healthScore: clampValue(alignment.alignmentScore - 2, 0, 100),
    strategy: {
      alignment: {
        alignmentScore: clampValue(alignment.alignmentScore - 1, 0, 100),
      },
    },
  };

  const currentSnapshot = params.currentSnapshot ?? {
    healthScore: clampValue(alignment.alignmentScore, 0, 100),
    strategy: {
      artifacts,
      alignment,
    },
  };

  weeklyMoves = enrichedMoves.map((move) =>
    move.adoption?.status === "adopted"
      ? computeMoveImpact({
          workspaceId: params.workspaceId,
          move,
          baselineSnapshot,
          currentSnapshot,
          nowIso: nowIsoSafe,
        })
      : move,
  );

  const baselineScore = extractControlScore(baselineSnapshot);
  const currentScore = extractControlScore(currentSnapshot);
  const decisionAttribution: DecisionImpactAttribution[] | undefined =
    baselineScore !== null && currentScore !== null
      ? weeklyMoves
          .filter((move) => move.adoption?.status === "adopted" && typeof move.adoption?.adoptedAtIso === "string")
          .flatMap((move) => {
            const adoptedAtIso = move.adoption?.adoptedAtIso;
            if (typeof adoptedAtIso !== "string") {
              return [];
            }
            return [
              computeDecisionAttribution({
                decisionId: move.id,
                adoptedAt: adoptedAtIso,
                baselineScore,
                currentScore,
                window: 7,
              }),
              computeDecisionAttribution({
                decisionId: move.id,
                adoptedAt: adoptedAtIso,
                baselineScore,
                currentScore,
                window: 14,
              }),
            ];
          })
      : undefined;
  const scenarioLedger = getLedgerEntries(params.workspaceId, 10);

  return {
    artifacts,
    alignment,
    weekKey,
    weeklyMoves,
    copy: strategyCopy,
    ...(decisionAttribution && decisionAttribution.length > 0 ? { decisionAttribution } : {}),
    ...(scenarioLedger.length > 0 ? { scenarioLedger } : {}),
    scenarioSimulator: {
      supportedLevers: [...SUPPORTED_SCENARIO_LEVERS],
    },
  };
}

function extractControlScore(snapshot: unknown): number | null {
  if (typeof snapshot !== "object" || snapshot === null) {
    return null;
  }

  const candidateHealth = (snapshot as { healthScore?: unknown }).healthScore;
  if (typeof candidateHealth === "number" && Number.isFinite(candidateHealth)) {
    return candidateHealth;
  }

  const strategy = (snapshot as { strategy?: unknown }).strategy;
  if (typeof strategy !== "object" || strategy === null) {
    return null;
  }

  const alignment = (strategy as { alignment?: unknown }).alignment;
  if (typeof alignment !== "object" || alignment === null) {
    return null;
  }

  const candidateAlignment = (alignment as { alignmentScore?: unknown }).alignmentScore;
  if (typeof candidateAlignment === "number" && Number.isFinite(candidateAlignment)) {
    return candidateAlignment;
  }

  return null;
}

function clampValue(value: number, min: number, max: number): number {
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

export function attachStrategyToSnapshot<T extends Record<string, unknown>>(params: {
  snapshot: T;
  artifacts: StrategicArtifact[];
  alignment?: StrategicAlignmentResult;
  weeklyMoves?: StrategicMove[];
  weekKey?: string;
}): T & {
  strategy: {
    artifacts: StrategicArtifact[];
    alignment: StrategicAlignmentResult;
    weeklyMoves: StrategicMove[];
    weekKey: string;
  };
} {
  const weekKey = params.weekKey ?? (params.weeklyMoves?.[0]?.weekKey ?? getIsoWeekKey("1970-01-01T00:00:00.000Z"));

  return {
    ...params.snapshot,
    strategy: {
      artifacts: params.artifacts,
      alignment: params.alignment ?? neutralAlignment(),
      weeklyMoves: params.weeklyMoves ?? [],
      weekKey,
    },
  };
}

export async function buildWorkspaceControlTowerSnapshot(params: {
  workspaceId: string;
  nowIso?: string;
  recentActions?: ReadonlyArray<StrategicActionLike>;
  outcomes?: ReadonlyArray<OutcomeEvent>;
}): Promise<{
  workspaceId: string;
  generatedAtIso: string;
  healthScore: number;
  trend7d: { score: number };
  decisionAttribution?: DecisionImpactAttribution[];
  portfolioRiskMatrix?: PortfolioRiskNode[];
  scenarioSimulator?: {
    supportedLevers: ScenarioLever[];
  };
  scenarioLedger?: import("./types").ScenarioLedgerEntry[];
  strategy: {
    artifacts: StrategicArtifact[];
    alignment: StrategicAlignmentResult;
    weeklyMoves: StrategicMove[];
    weekKey: string;
  };
}> {
  const generatedAtIso =
    typeof params.nowIso === "string" && Number.isFinite(Date.parse(params.nowIso))
      ? new Date(params.nowIso).toISOString()
      : new Date().toISOString();

  const strategy = await buildStrategySnapshot({
    workspaceId: params.workspaceId,
    nowIso: generatedAtIso,
    recentActions: params.recentActions,
    outcomes: params.outcomes,
  });

  const alignmentScore = strategy.alignment.alignmentScore;
  const driftPenalty = strategy.alignment.driftDetected ? 20 : 0;
  const confidenceBoost = strategy.alignment.confidence === "high" ? 8 : strategy.alignment.confidence === "medium" ? 4 : 0;
  const planBoost = strategy.weeklyMoves.length >= 3 ? 6 : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(alignmentScore - driftPenalty + confidenceBoost + planBoost)));

  const trend7dScore = Math.max(-100, Math.min(100, Math.round(alignmentScore - 50 - driftPenalty / 2)));

  const diagnostics = strategy.alignment.diagnostics as unknown;
  const diagnosticsInputs =
    typeof diagnostics === "object" && diagnostics !== null
      ? ((diagnostics as { inputs?: unknown }).inputs as { outcomes?: unknown } | undefined)
      : undefined;
  const recentWins = typeof diagnosticsInputs?.outcomes === "number" ? diagnosticsInputs.outcomes : undefined;
  const suppressedIntents =
    typeof diagnostics === "object" && diagnostics !== null && typeof (diagnostics as { suppressedIntents?: unknown }).suppressedIntents === "number"
      ? ((diagnostics as { suppressedIntents?: number }).suppressedIntents as number)
      : undefined;

  const portfolioRiskMatrix =
    Number.isFinite(healthScore) && Number.isFinite(trend7dScore)
      ? computePortfolioRisk({
          healthScore,
          scoreDelta: trend7dScore,
          decisionAttribution: strategy.decisionAttribution,
          recentWins,
          suppressedIntents,
        })
      : undefined;

  return {
    workspaceId: params.workspaceId,
    generatedAtIso,
    healthScore,
    trend7d: { score: trend7dScore },
    ...(strategy.decisionAttribution && strategy.decisionAttribution.length > 0
      ? { decisionAttribution: strategy.decisionAttribution }
      : {}),
    ...(portfolioRiskMatrix && portfolioRiskMatrix.length > 0 ? { portfolioRiskMatrix } : {}),
    ...(strategy.scenarioSimulator ? { scenarioSimulator: strategy.scenarioSimulator } : {}),
    ...(strategy.scenarioLedger && strategy.scenarioLedger.length > 0 ? { scenarioLedger: strategy.scenarioLedger } : {}),
    strategy: {
      artifacts: strategy.artifacts,
      alignment: strategy.alignment,
      weeklyMoves: strategy.weeklyMoves,
      weekKey: strategy.weekKey,
    },
  };
}
