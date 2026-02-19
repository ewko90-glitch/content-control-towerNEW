export type {
  ActionCard,
  ActionIdempotency,
  ControlTowerState,
  Confidence,
  ConfidenceLabel,
  DecisionCapabilities,
  DecisionPolicy,
  DecisionPolicyWeights,
  DecisionSchemaVersion,
  DecisionVersion,
  DecisionWarning,
  InputFingerprint,
  InputSummary,
  ActionCardRuntime,
  ActionReason,
  ActionSelector,
  ActionTarget,
  ControlTowerDecisionSnapshot,
  ControlTowerInput,
  ControlTowerThresholds,
  ControlTowerV3Snapshot,
  DerivedMetrics,
  ExplainabilityBlock,
  HealthBreakdownItem,
  HealthScoreResult,
  HealthScore,
  Impact,
  ImpactLabel,
  Insight,
  IntentType,
  Metrics,
  PermissionResult,
  PriorityToday,
  PrioritySignal,
  RawSnapshot,
  RiskDimensions,
  RiskEvaluationResult,
  RiskFlag,
  RiskSignal,
  ScoreDeduction,
  Severity,
  Signal,
  StrategyDiagnostics,
  TimelineGroup,
  TimelineItem,
} from "./types";

export type { DecisionThresholds } from "./thresholds";
export { DEFAULT_DECISION_POLICY, DEFAULT_DECISION_THRESHOLDS, getThresholds } from "./thresholds";

export type { ResolvedPermissions } from "./permissions";
export { WorkspaceRole, resolvePermissions } from "./permissions";

export { DECISION_CACHE_TTL_MS, getCached, makeBucketKey, makeDecisionCacheKey, setCached } from "./cache";
export { getCachedControlTowerDecisionSnapshot } from "./cache";
export type { IntentSession, OutcomeEvent } from "./feedback/types";
export { getRecentOutcomes, recordOutcome, startIntentSession } from "./feedback/store";
export type { FeedbackEffects } from "./feedback/effects";
export { computeFeedbackEffects } from "./feedback/effects";
export type {
  StrategicActionLike,
  StrategicAlignmentInput,
  StrategicAlignmentResult,
  StrategicArtifact,
  StrategicArtifactStatus,
  StrategicArtifactType,
  StrategicHorizon,
  StrategicStorePayload,
} from "@/modules/controlTowerV3/strategy/types";
export { strategyCopy } from "@/modules/controlTowerV3/strategy/copy";
export { computeStrategicAlignment } from "@/modules/controlTowerV3/strategy/alignment";
export {
  archiveStrategicArtifact,
  getStrategicArtifacts,
  restoreStrategicArtifact,
  saveStrategicArtifact,
  seedDefaultStrategyIfEmpty,
} from "@/modules/controlTowerV3/strategy/store";

export {
  CONFIDENCE_LABELS,
  DISABLED_MESSAGES,
  EMPTY_STATE_HEADLINE,
  EMPTY_STATE_STEPS,
  ERROR_FALLBACK_MESSAGE,
  IMPACT_LABELS,
} from "./copy-pl";

export { generateActions } from "./actionGenerator";
export { generateRuntimeActions } from "./actionGenerator";
export { buildDecisionSnapshot } from "./decision-engine";
export { buildExplainability } from "./explainability";
export { evaluateRisks } from "./riskModel";
export { computeHealthScore as computeDecisionHealthScore } from "./scoringModel";

import { buildDecisionSnapshot as runDecisionEngine } from "./decision-engine";
import { computeFeedbackEffects } from "./feedback/effects";
import { getRecentOutcomes } from "./feedback/store";
import { isFencedWriter } from "./hardening/fencing";
import { finalizeDecisionSnapshot } from "./hardening/finalize";
import { getLastKnownGoodSnapshot, setLastKnownGoodSnapshot } from "./hardening/lastKnownGood";
import { releaseWorkspaceLock, tryAcquireWorkspaceLock, type WorkspaceLock } from "./hardening/lock";
import { computeMetrics } from "./metrics";
import { resolvePermissions } from "./permissions";
import { getRawSnapshotCached } from "./snapshot";
import { CONTROL_TOWER_DECISION_VERSION, CONTROL_TOWER_SCHEMA_VERSION } from "./snapshot";
import { getThresholds } from "./thresholds";
import { DECISION_CACHE_TTL_MS, getCached, makeDecisionCacheKey, setCached } from "./cache";
import { getStrategicArtifacts } from "@/modules/controlTowerV3/strategy/store";
import type { ControlTowerDecisionSnapshot, ControlTowerInput, ControlTowerV3Snapshot, Metrics } from "./types";

type DecisionSnapshotParams = {
  workspaceId: string;
  now?: Date;
  viewer?: {
    userId?: string;
    role?: string;
  };
};

const LOCK_TTL_SECONDS = 4;
const LKG_TTL_SECONDS = 24 * 60 * 60;

function withCacheHint(snapshot: ControlTowerDecisionSnapshot, hint: "fresh" | "cached"): ControlTowerDecisionSnapshot {
  return {
    ...snapshot,
    diagnostics: {
      ...(snapshot.diagnostics ?? {}),
      cacheHint: hint,
    },
  };
}

function getCurrentLockToken(lock: WorkspaceLock): string | undefined {
  const current = getCached<WorkspaceLock>(lock.key);
  return current?.token;
}

async function buildAndFinalizeDecisionSnapshot(params: {
  workspaceId: string;
  now: Date;
  viewer?: {
    userId?: string;
    role?: string;
  };
}): Promise<ControlTowerDecisionSnapshot> {
  const [input, outcomes, strategicArtifacts] = await Promise.all([
    buildControlTowerInput({
      workspaceId: params.workspaceId,
      now: params.now,
      viewer: params.viewer,
    }),
    getRecentOutcomes({
      workspaceId: params.workspaceId,
      windowHours: 72,
    }),
    getStrategicArtifacts(params.workspaceId),
  ]);

  const feedbackEffects = computeFeedbackEffects({
    outcomes,
    now: params.now,
  });

  const rawSnapshot = runDecisionEngine(input, {
    feedbackEffects,
    viewerRole: params.viewer?.role,
    strategicContext: {
      artifacts: strategicArtifacts,
      outcomes,
      nowIso: params.now.toISOString(),
    },
  });

  return finalizeDecisionSnapshot(rawSnapshot);
}

async function resolveSafeFallback(params: {
  cacheKey: string;
  workspaceId: string;
  reason: string;
}): Promise<ControlTowerDecisionSnapshot> {
  const recached = getCached<ControlTowerDecisionSnapshot>(params.cacheKey);
  if (recached) {
    return withCacheHint(finalizeDecisionSnapshot(recached), "cached");
  }

  const lkg = await getLastKnownGoodSnapshot({
    workspaceId: params.workspaceId,
  });
  if (lkg) {
    return withCacheHint(finalizeDecisionSnapshot(lkg), "cached");
  }

  const fallback = buildFallbackDecisionSnapshot({
    workspaceId: params.workspaceId,
    reason: params.reason,
  });
  return withCacheHint(finalizeDecisionSnapshot(fallback), "fresh");
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

export function __devAssertMetrics(metrics: Metrics): void {
  const numericEntries: Array<[string, number]> = [
    ["totalContent", metrics.totalContent],
    ["overdueCount", metrics.overdueCount],
    ["overdueMaxAgeDays", metrics.overdueMaxAgeDays],
    ["reviewCount", metrics.reviewCount],
    ["reviewOver48hCount", metrics.reviewOver48hCount],
    ["avgReviewHours", metrics.avgReviewHours],
    ["staleDraftCount", metrics.staleDraftCount],
    ["staleReviewCount", metrics.staleReviewCount],
    ["upcomingToday", metrics.upcomingToday],
    ["upcomingTomorrow", metrics.upcomingTomorrow],
    ["upcomingWeek", metrics.upcomingWeek],
    ["createdLast7d", metrics.createdLast7d],
    ["versionsLast7d", metrics.versionsLast7d],
    ["aiJobsLast7d", metrics.aiJobsLast7d],
    ["creditsRemaining", metrics.creditsRemaining],
    ["creditsUsedPct", metrics.creditsUsedPct],
    ["ideaPct", metrics.ideaPct],
    ["draftPct", metrics.draftPct],
    ["reviewPct", metrics.reviewPct],
  ];

  const invalid = numericEntries.filter(([, value]) => !isFiniteNumber(value));
  if (invalid.length > 0) {
    throw new Error(`Nieprawidłowe metryki: ${invalid.map(([key]) => key).join(", ")}`);
  }

  if (metrics.creditsUsedPct < 0 || metrics.creditsUsedPct > 1) {
    throw new Error("Nieprawidłowe metryki: creditsUsedPct poza zakresem 0..1");
  }

  const pctFields: Array<[string, number]> = [
    ["ideaPct", metrics.ideaPct],
    ["draftPct", metrics.draftPct],
    ["reviewPct", metrics.reviewPct],
  ];

  const outOfRange = pctFields.filter(([, value]) => value < 0 || value > 100);
  if (outOfRange.length > 0) {
    throw new Error(`Nieprawidłowe metryki: procenty poza zakresem 0..100 (${outOfRange.map(([key]) => key).join(", ")})`);
  }
}

function buildHealthPlaceholder(metrics: Metrics): ControlTowerV3Snapshot["health"] {
  const score = metrics.totalContent === 0 ? 50 : 70;
  const label = score >= 85 ? "Świetna forma" : score >= 60 ? "Stabilnie" : score >= 40 ? "Wymaga uwagi" : "Krytyczne";

  return {
    score,
    label,
    breakdown: [
      {
        key: "placeholder",
        title: "Health Score (placeholder 5.2)",
        points: score,
        maxPoints: 100,
        explanation: "Docelowe komponenty scoringu zostaną dodane w kroku 5.3.",
        severity: score >= 60 ? "info" : score >= 40 ? "warning" : "danger",
      },
    ],
  };
}

async function buildControlTowerInput(params: {
  workspaceId: string;
  now: Date;
  viewer?: {
    userId?: string;
    role?: string;
  };
}): Promise<ControlTowerInput> {
  const userId = params.viewer?.userId ?? "";
  const { raw } = await getRawSnapshotCached(params.workspaceId, userId, params.now);
  const thresholds = getThresholds();
  const metrics = computeMetrics(raw, params.now, thresholds);

  return {
    workspaceId: params.workspaceId,
    generatedAtISO: raw.generatedAtISO,
    overduePublicationsCount: metrics.overdueCount,
    upcomingPublicationsNext7Days: metrics.upcomingWeek,
    stuckContentCount: metrics.staleDraftCount + metrics.staleReviewCount,
    approvalsPendingCount: metrics.reviewCount,
    draftCount: raw.statusCounts.DRAFT,
    inProgressCount: raw.statusCounts.REVIEW,
    publishedLast7DaysCount: raw.createdLast7d,
    overdueCount: metrics.overdueCount,
    upcomingWeek: metrics.upcomingWeek,
    staleDraftCount: metrics.staleDraftCount,
    staleReviewCount: metrics.staleReviewCount,
    reviewCount: metrics.reviewCount,
    totalContent: metrics.totalContent,
    draftPct: metrics.draftPct,
    reviewPct: metrics.reviewPct,
    overduePublicationIds: [],
    stuckContentIds: raw.stageItems.filter((item) => item.status === "DRAFT" || item.status === "REVIEW").map((item) => item.id).slice(0, 20),
    approvalIds: raw.stageItems.filter((item) => item.status === "REVIEW").map((item) => item.id).slice(0, 20),
    statusCounts: raw.statusCounts,
  };
}

export function buildFallbackDecisionSnapshot(params: { workspaceId: string; reason?: string }): ControlTowerDecisionSnapshot {
  const reason = params.reason ?? "Decision pipeline unavailable";
  const generatedAt = new Date(0).toISOString();

  return {
    schemaVersion: CONTROL_TOWER_SCHEMA_VERSION,
    decisionVersion: CONTROL_TOWER_DECISION_VERSION,
    state: "degraded",
    capabilities: {
      intents: true,
      feedback: true,
      targets: true,
      debug: false,
      policies: true,
      fingerprints: true,
    },
    warnings: [
      {
        code: "DEGRADED_INPUT",
        message: "Decision input is degraded.",
        severity: "high",
      },
    ],
    generatedAt,
    inputSummary: {
      contentCount: 0,
      publicationJobsCount: 0,
      approvalsCount: 0,
    },
    inputFingerprint: {
      value: "0",
      canonical: "c=0|p=0|a=0|od=0|st=0|ap=0|up=0",
      components: ["c", "p", "a", "od", "st", "ap", "up"],
    },
    healthScore: 55,
    riskLevel: "medium",
    riskFlags: [
      {
        id: "fallback-risk",
        dimension: "pipelineRisk",
        level: "medium",
        intensity: 0.5,
        message: reason,
      },
    ],
    priorityToday: {
      type: "fallback-refresh",
      message: "Verify data source and refresh dashboard.",
      severity: "low",
    },
    actionCards: [
      {
        id: "fallback-action-refresh",
        key: "fallback-action-refresh",
        intent: "review_risks",
        type: "review",
        actionType: "review",
        urgency: "low",
        confidenceValue: 0.35,
        executionPriority: 120,
        target: {
          route: "/overview",
        },
        idempotency: {
          dedupeKey: "review_risks:risks",
          cooldownSeconds: 43200,
        },
        reasons: [
          {
            code: "FALLBACK_MODE",
            message: reason,
            severity: "low",
          },
        ],
        createdBy: "decision_engine",
        decisionVersion: CONTROL_TOWER_DECISION_VERSION,
        severity: "info",
        title: "Refresh decision snapshot",
        description: "Retry snapshot retrieval to restore full diagnostics.",
        why: reason,
        impact: {
          score: 20,
          label: "Niski",
        },
        confidence: {
          score: 0.35,
          label: "Niska",
        },
        cta: {
          label: "Refresh",
          href: `/overview?workspace=${params.workspaceId}`,
        },
        permissions: {
          canExecute: true,
        },
      },
    ],
    reasoning: {
      scoreBreakdown: ["Fallback mode active: -45 points"],
      mainRiskDrivers: ["Decision snapshot unavailable"],
      structuralSummary: "Fallback mode active due to unavailable decision data.",
    },
    structuralRiskScore: 0.5,
    diagnostics: {
      structuralRiskScore: 0.5,
      topRiskDimension: "pipelineRisk",
    },
  };
}

export async function getControlTowerDecisionSnapshot(params: DecisionSnapshotParams): Promise<ControlTowerDecisionSnapshot> {
  const now = params.now ?? new Date();
  const cacheKey = makeDecisionCacheKey({
    workspaceId: params.workspaceId,
    viewer: params.viewer,
  });

  const cached = getCached<ControlTowerDecisionSnapshot>(cacheKey);
  if (cached) {
    return withCacheHint(finalizeDecisionSnapshot(cached), "cached");
  }

  const lock = await tryAcquireWorkspaceLock({
    workspaceId: params.workspaceId,
    scope: "decision",
    ttlSeconds: LOCK_TTL_SECONDS,
  });

  if (!lock) {
    return resolveSafeFallback({
      cacheKey,
      workspaceId: params.workspaceId,
      reason: "Snapshot already being computed",
    });
  }

  try {
    const finalizedSnapshot = await buildAndFinalizeDecisionSnapshot({
      workspaceId: params.workspaceId,
      now,
      viewer: params.viewer,
    });

    const currentToken = getCurrentLockToken(lock);
    if (isFencedWriter({ lockToken: lock.token, currentTokenFromCache: currentToken })) {
      setCached(cacheKey, finalizedSnapshot, DECISION_CACHE_TTL_MS);
      await setLastKnownGoodSnapshot({
        workspaceId: params.workspaceId,
        snapshot: finalizedSnapshot,
        ttlSeconds: LKG_TTL_SECONDS,
        lockToken: lock.token,
      });
    }

    return withCacheHint(finalizedSnapshot, "fresh");
  } catch {
    return resolveSafeFallback({
      cacheKey,
      workspaceId: params.workspaceId,
      reason: "Snapshot pipeline temporarily unavailable",
    });
  } finally {
    await releaseWorkspaceLock(lock);
  }
}

export async function getControlTowerV3(workspaceId: string, userId: string, now: Date): Promise<ControlTowerV3Snapshot> {
  const { raw, generatedAtISO } = await getRawSnapshotCached(workspaceId, userId, now);
  const thresholds = getThresholds();
  const metrics = computeMetrics(raw, now, thresholds);

  if (process.env.NODE_ENV !== "production") {
    __devAssertMetrics(metrics);
  }

  const permissions = resolvePermissions(raw.role, metrics.creditsRemaining);
  const baseHref = `/w/${workspaceId}/content`;
  const priority: ControlTowerV3Snapshot["priority"] = {
    key: "priority-placeholder",
    severity: "info",
    title: "Brak krytycznych priorytetów",
    description: "Dane priorytetów są w trakcie rozbudowy.",
    why: "W obecnej wersji wyświetlamy bezpieczny fallback.",
    impact: {
      score: 10,
      label: "Niski",
    },
    confidence: {
      score: 0.45,
      label: "Średnia",
    },
    cta: {
      label: "Przejdź do treści",
      href: baseHref,
    },
    permissions: permissions.canCreateContent,
  };
  const actionCards: ControlTowerV3Snapshot["actionCards"] = [];

  return {
    version: "ct_v3",
    generatedAtISO,
    subtitle: "Control Tower v3 (MVP)",
    health: buildHealthPlaceholder(metrics),
    priority,
    risks: [],
    cards: actionCards,
    actionCards,
    insights: [
      {
        key: "todo-53",
        text: "Moduły priorytetów, ryzyk i insightów zostaną dodane w kroku 5.3.",
        severity: "info",
      },
      {
        key: "permission-summary",
        text: permissions.canCreateContent.canExecute
          ? "Masz uprawnienia do tworzenia treści."
          : permissions.canCreateContent.reasonIfDisabled ?? "Brak uprawnień.",
        severity: permissions.canCreateContent.canExecute ? "info" : "warning",
      },
      {
        key: "todo-priority",
        text: "TODO 5.3: dodać moduły scoringu, ryzyk, kart i osi czasu.",
        severity: "info",
      },
    ],
    timeline: [],
    quickActions: [
      {
        key: "create",
        label: "Dodaj treść",
        href: baseHref,
        disabled: !permissions.canCreateContent.canExecute,
        reason: permissions.canCreateContent.reasonIfDisabled,
      },
    ],
    metrics,
  };
}

// TODO: STEP 5.3 — dodać pełne moduły priority/risks/cards/timeline/insights.
