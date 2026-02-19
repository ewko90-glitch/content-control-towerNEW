import { generateRuntimeActions } from "./actionGenerator";
import { buildExplainability } from "./explainability";
import { buildInputFingerprint } from "./hardening/inputFingerprint";
import { buildDecisionWarnings } from "./hardening/warnings";
import { evaluateRisks } from "./riskModel";
import { computeHealthScore } from "./scoringModel";
import { CONTROL_TOWER_DECISION_VERSION, CONTROL_TOWER_SCHEMA_VERSION } from "./snapshot";
import { DEFAULT_DECISION_POLICY } from "./thresholds";
import type { FeedbackEffects } from "./feedback/effects";
import type { OutcomeEvent } from "./feedback/types";
import { computeStrategicAlignment } from "@/modules/controlTowerV3/strategy/alignment";
import type { StrategicAlignmentResult, StrategicArtifact } from "@/modules/controlTowerV3/strategy/types";
import type {
  ActionCard,
  ControlTowerDecisionSnapshot,
  ControlTowerInput,
  ControlTowerState,
  ControlTowerThresholds,
  DecisionCapabilities,
  DerivedMetrics,
  PriorityToday,
  RiskDimensions,
  RiskEvaluationResult,
  RiskFlag,
  WorkflowOpsDiagnostics,
} from "./types";

const DEFAULT_THRESHOLDS: ControlTowerThresholds = {
  approvalPendingThreshold: 5,
  scheduleOverdueMax: 8,
  workflowStuckMax: 10,
  approvalBacklogMax: 10,
  pipelineBacklogMin: 6,
  maxActions: 5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numberOrZero(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function resolveDraftCount(input: ControlTowerInput): number {
  if (typeof input.draftCount === "number") {
    return numberOrZero(input.draftCount);
  }

  if (typeof input.statusCounts?.DRAFT === "number") {
    return numberOrZero(input.statusCounts.DRAFT);
  }

  const total = numberOrZero(input.totalContent);
  const draftPct = numberOrZero(input.draftPct);
  return total > 0 ? Math.round((draftPct / 100) * total) : 0;
}

function resolveInProgressCount(input: ControlTowerInput): number {
  if (typeof input.inProgressCount === "number") {
    return numberOrZero(input.inProgressCount);
  }

  if (typeof input.statusCounts?.REVIEW === "number") {
    return numberOrZero(input.statusCounts.REVIEW);
  }

  if (typeof input.reviewCount === "number") {
    return numberOrZero(input.reviewCount);
  }

  const total = numberOrZero(input.totalContent);
  const reviewPct = numberOrZero(input.reviewPct);
  return total > 0 ? Math.round((reviewPct / 100) * total) : 0;
}

function deriveMetrics(input: ControlTowerInput): DerivedMetrics {
  const overduePublicationsCount = numberOrZero(input.overduePublicationsCount ?? input.overdueCount);
  const upcomingPublicationsNext7Days = numberOrZero(input.upcomingPublicationsNext7Days ?? input.upcomingWeek);
  const stuckContentCount = numberOrZero(input.stuckContentCount ?? input.staleDraftCount ?? 0) + numberOrZero(input.staleReviewCount ?? 0);
  const approvalsPendingCount = numberOrZero(input.approvalsPendingCount ?? input.reviewCount ?? input.statusCounts?.REVIEW ?? 0);
  const draftCount = resolveDraftCount(input);
  const inProgressCount = resolveInProgressCount(input);

  const publishedLast7DaysCount = numberOrZero(input.publishedLast7DaysCount ?? input.statusCounts?.PUBLISHED ?? 0);
  const overduePublicationIds = (input.overduePublicationIds ?? []).slice(0, 20);
  const stuckContentIds = (input.stuckContentIds ?? []).slice(0, 20);
  const approvalIds = (input.approvalIds ?? []).slice(0, 20);
  const contentCount = numberOrZero(input.totalContent);
  const publicationJobsCount = upcomingPublicationsNext7Days;
  const approvalsCount = approvalsPendingCount;

  return {
    overduePublicationsCount,
    upcomingPublicationsNext7Days,
    stuckContentCount,
    approvalsPendingCount,
    draftCount,
    inProgressCount,
    publishedLast7DaysCount,
    overduePublicationIds,
    stuckContentIds,
    approvalIds,
    contentCount,
    publicationJobsCount,
    approvalsCount,
  };
}

function baseRiskLevel(score: number, metrics: DerivedMetrics): "low" | "medium" | "high" {
  if (score < 50 || metrics.overduePublicationsCount > 3) {
    return "high";
  }
  if (score <= 75) {
    return "medium";
  }
  return "low";
}

function escalateRiskLevel(level: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (level === "low") {
    return "medium";
  }
  if (level === "medium") {
    return "high";
  }
  return "high";
}

function resolvePriority(metrics: DerivedMetrics): PriorityToday {
  if (metrics.overduePublicationsCount > 3) {
    return {
      type: "critical-schedule-collapse",
      message: "Reduce overdue publications to restore schedule stability.",
      severity: "high",
    };
  }

  if (metrics.approvalsPendingCount > 5) {
    return {
      type: "approval-bottleneck",
      message: "Clear approval backlog to unblock progression.",
      severity: "high",
    };
  }

  if (metrics.upcomingPublicationsNext7Days === 0 && metrics.draftCount + metrics.inProgressCount === 0) {
    return {
      type: "pipeline-empty",
      message: "Create and schedule new content to restore pipeline continuity.",
      severity: "high",
    };
  }

  if (metrics.stuckContentCount > 0) {
    return {
      type: "workflow-stagnation",
      message: "Move stagnant content forward to reduce workflow friction.",
      severity: "medium",
    };
  }

  return {
    type: "stable",
    message: "Current operations are stable. Optimize throughput incrementally.",
    severity: "low",
  };
}

function topRiskDimension(dimensions: RiskDimensions): keyof RiskDimensions {
  const entries = Object.entries(dimensions) as Array<[keyof RiskDimensions, number]>;
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? "pipelineRisk";
}

function hasHighSeverityWarning(warnings: ControlTowerDecisionSnapshot["warnings"]): boolean {
  return warnings.some((warning) => warning.severity === "high");
}

function hasApprovalData(input: ControlTowerInput): boolean {
  return (
    typeof input.approvalsPendingCount === "number" ||
    typeof input.reviewCount === "number" ||
    typeof input.statusCounts?.REVIEW === "number" ||
    Array.isArray(input.approvalIds)
  );
}

function hasPublicationData(input: ControlTowerInput): boolean {
  return (
    typeof input.upcomingPublicationsNext7Days === "number" ||
    typeof input.upcomingWeek === "number" ||
    typeof input.overdueCount === "number" ||
    Array.isArray(input.overduePublicationIds)
  );
}

function hasDerivedMetricsReliability(input: ControlTowerInput): boolean {
  const stableCountsPresent =
    typeof input.totalContent === "number" ||
    typeof input.draftCount === "number" ||
    typeof input.reviewCount === "number" ||
    typeof input.statusCounts?.DRAFT === "number";

  return stableCountsPresent && hasPublicationData(input);
}

function withWorkflowOpsRisk(params: {
  risks: RiskEvaluationResult;
  workflowOps?: WorkflowOpsDiagnostics;
}): RiskEvaluationResult {
  const { risks, workflowOps } = params;
  if (!workflowOps) {
    return risks;
  }

  const stageWipValues = Object.values(workflowOps.stageWip ?? {});
  const avgStageWipSeverityScore =
    stageWipValues.length > 0 ? stageWipValues.reduce((acc, stage) => acc + stage.severityScore, 0) / stageWipValues.length : 0;
  const bottleneckIndexScore = workflowOps.bottleneckIndex?.score ?? workflowOps.bottleneck.likelihoodScore;
  const flowOps = workflowOps.flowOps;
  const hasHighFlowAnomaly = Boolean(flowOps?.anomalies?.some((anomaly) => anomaly.severity === "high"));
  const hasVolatility = (flowOps?.volatilityScore ?? 0) >= 60;
  const hasLowThroughputAndHighLead = (flowOps?.throughputPerWeek ?? 0) < 1 && (flowOps?.leadAvgHours ?? 0) > 72;
  const predictiveRisk = workflowOps.predictiveRisk;
  const predictiveTailRisk = (predictiveRisk?.tailRiskScore ?? 0) >= 80;
  const predictiveCritical = (predictiveRisk?.criticalCount ?? 0) > 0;
  const predictiveConcentrated = (predictiveRisk?.stageConcentrationPct ?? 0) >= 55;

  const baseWorkflowRisk = clamp(
    (workflowOps.stuck.pressureScore / 100) * 0.6 +
      (workflowOps.sla.pressureScore / 100) * 0.3 +
      (workflowOps.bottleneck.likelihoodScore / 100) * 0.2 +
      (bottleneckIndexScore / 100) * 0.3 +
      (avgStageWipSeverityScore / 100) * 0.2,
    0,
    1,
  );

  const workflowRisk = clamp(
    baseWorkflowRisk +
      (hasVolatility ? 0.1 : 0) +
      (hasHighFlowAnomaly ? 0.15 : 0) +
      (hasLowThroughputAndHighLead ? 0.08 : 0) +
      ((predictiveRisk?.pressureScore ?? 0) / 100) * 0.22 +
      (predictiveTailRisk ? 0.12 : 0) +
      (predictiveCritical ? 0.1 : 0) +
      (predictiveConcentrated ? 0.06 : 0),
    0,
    1,
  );

  const dimensions: RiskDimensions = {
    ...risks.dimensions,
    workflowRisk,
  };

  const weights = DEFAULT_DECISION_POLICY.weights;
  const structuralRiskScore = clamp(
    dimensions.scheduleRisk * weights.schedule +
      dimensions.workflowRisk * weights.workflow +
      dimensions.approvalRisk * weights.approvals +
      dimensions.pipelineRisk * weights.pipeline,
    0,
    1,
  );

  const nextFlags: RiskFlag[] = [...risks.flags];

  if (workflowOps.sla.pressureScore >= 35) {
    nextFlags.push({
      id: "WORKFLOW_SLA_PRESSURE",
      dimension: "workflowRisk",
      level: workflowOps.sla.pressureScore >= 60 ? "high" : "medium",
      intensity: clamp(workflowOps.sla.pressureScore / 100, 0, 1),
      message: "Workflow SLA pressure is elevated.",
    });
  }

  if (workflowOps.stuck.pressureScore >= 35) {
    nextFlags.push({
      id: "WORKFLOW_STUCK_PRESSURE",
      dimension: "workflowRisk",
      level: workflowOps.stuck.pressureScore >= 60 ? "high" : "medium",
      intensity: clamp(workflowOps.stuck.pressureScore / 100, 0, 1),
      message: "Workflow stuck pressure is elevated.",
    });
  }

  if (workflowOps.bottleneck.likelihoodScore >= 35) {
    nextFlags.push({
      id: "WORKFLOW_BOTTLENECK_LIKELY",
      dimension: "workflowRisk",
      level: workflowOps.bottleneck.likelihoodScore >= 60 ? "high" : "medium",
      intensity: clamp(workflowOps.bottleneck.likelihoodScore / 100, 0, 1),
      message: "Workflow bottleneck is likely in a single stage.",
    });
  }

  if (workflowOps.sla.criticalCount > 0 || workflowOps.stuck.criticalStuckCount > 0) {
    nextFlags.push({
      id: "WORKFLOW_CRITICAL",
      dimension: "workflowRisk",
      level: "high",
      intensity: 1,
      message: "Critical workflow pressure detected.",
    });
  }

  if ((workflowOps.wip?.criticalCount ?? 0) > 0) {
    nextFlags.push({
      id: "WORKFLOW_OVERLOAD_CRITICAL",
      dimension: "workflowRisk",
      level: "high",
      intensity: 1,
      message: "Critical WIP overload detected.",
    });
  }

  if ((workflowOps.bottleneckIndex?.lowThroughputPenalty ?? 0) >= 30) {
    nextFlags.push({
      id: "WORKFLOW_LOW_THROUGHPUT",
      dimension: "workflowRisk",
      level: "medium",
      intensity: clamp((workflowOps.bottleneckIndex?.lowThroughputPenalty ?? 0) / 100, 0, 1),
      message: "Low stage throughput detected.",
    });
  }

  if ((workflowOps.bottleneckIndex?.score ?? 0) >= 65) {
    nextFlags.push({
      id: "WORKFLOW_FLOW_IMBALANCE",
      dimension: "workflowRisk",
      level: "high",
      intensity: clamp((workflowOps.bottleneckIndex?.score ?? 0) / 100, 0, 1),
      message: "Flow imbalance indicates dynamic bottleneck concentration.",
    });
  }

  if (hasVolatility) {
    nextFlags.push({
      id: "WORKFLOW_VOLATILE",
      dimension: "workflowRisk",
      level: (flowOps?.volatilityScore ?? 0) >= 80 ? "high" : "medium",
      intensity: clamp((flowOps?.volatilityScore ?? 0) / 100, 0, 1),
      message: "Workflow volatility is elevated.",
    });
  }

  if (hasHighFlowAnomaly) {
    nextFlags.push({
      id: "WORKFLOW_FLOW_ANOMALY_HIGH",
      dimension: "workflowRisk",
      level: "high",
      intensity: 1,
      message: "High-severity flow anomaly detected.",
    });
  }

  if (hasLowThroughputAndHighLead) {
    nextFlags.push({
      id: "WORKFLOW_THROUGHPUT_LOW",
      dimension: "workflowRisk",
      level: "medium",
      intensity: clamp(((flowOps?.leadAvgHours ?? 0) / 120) * 0.7 + 0.3, 0, 1),
      message: "Throughput is low while lead time remains elevated.",
    });
  }

  if (predictiveTailRisk) {
    nextFlags.push({
      id: "WORKFLOW_PREDICTIVE_TAIL_RISK",
      dimension: "workflowRisk",
      level: "high",
      intensity: clamp((predictiveRisk?.tailRiskScore ?? 0) / 100, 0, 1),
      message: "Predictive tail risk indicates severe upcoming delay potential.",
    });
  }

  if (predictiveConcentrated) {
    nextFlags.push({
      id: "WORKFLOW_PREDICTIVE_CONCENTRATED",
      dimension: "workflowRisk",
      level: (predictiveRisk?.stageConcentrationPct ?? 0) >= 70 ? "high" : "medium",
      intensity: clamp((predictiveRisk?.stageConcentrationPct ?? 0) / 100, 0, 1),
      message: "Predictive risk is concentrated in one workflow stage.",
    });
  }

  if (predictiveCritical) {
    nextFlags.push({
      id: "WORKFLOW_PREDICTIVE_CRITICAL",
      dimension: "workflowRisk",
      level: "high",
      intensity: 1,
      message: "Critical predictive risk items require immediate intervention.",
    });
  }

  return {
    ...risks,
    dimensions,
    structuralRiskScore,
    flags: nextFlags,
  };
}

function makeOnboardingAction(params: {
  workspaceId: string;
  decisionVersion: string;
  intent: "fill_pipeline_gap" | "schedule_next_7_days";
  title: string;
  description: string;
  why: string;
  target: ActionCard["target"];
  priority: number;
  urgency: "medium" | "low";
}): ActionCard {
  const id = `ctv3:${params.workspaceId}:${params.intent}:onboarding`;
  const cooldownSeconds = params.intent === "schedule_next_7_days" ? 10800 : 21600;

  return {
    id,
    key: id,
    intent: params.intent,
    type: params.intent === "schedule_next_7_days" ? "schedule" : "fix",
    actionType: params.intent === "schedule_next_7_days" ? "schedule" : "fix",
    urgency: params.urgency,
    confidenceValue: 0.8,
    executionPriority: params.priority,
    target: params.target,
    idempotency: {
      dedupeKey: `${params.intent}:${params.intent === "schedule_next_7_days" ? "no_upcoming_7d" : "empty_pipeline"}`,
      cooldownSeconds,
    },
    reasons: [
      {
        code: "ONBOARDING_BOOTSTRAP",
        message: "Workspace requires initial operational setup.",
        severity: "medium",
      },
    ],
    primaryCtaLabel: "Open",
    createdBy: "decision_engine",
    decisionVersion: params.decisionVersion,
    severity: params.urgency === "medium" ? "warning" : "info",
    title: params.title,
    description: params.description,
    why: params.why,
    impact: {
      score: params.urgency === "medium" ? 35 : 25,
      label: params.urgency === "medium" ? "Średni" : "Niski",
    },
    confidence: {
      score: 0.8,
      label: "Wysoka",
    },
    cta: {
      label: "Open",
      href: "/overview",
    },
    permissions: {
      canExecute: true,
    },
  };
}

function degradedReviewAction(workspaceId: string, decisionVersion: string): ActionCard {
  const id = `ctv3:${workspaceId}:review_risks:degraded`;

  return {
    id,
    key: id,
    intent: "review_risks",
    type: "review",
    actionType: "review",
    urgency: "medium",
    confidenceValue: 0.45,
    executionPriority: 160,
    target: {
      route: "/overview",
      hash: "risks",
    },
    idempotency: {
      dedupeKey: "review_risks:risks",
      cooldownSeconds: 43200,
    },
    reasons: [
      {
        code: "DEGRADED_DATA",
        message: "Review risk posture while data quality is degraded.",
        severity: "high",
      },
    ],
    primaryCtaLabel: "Open",
    createdBy: "decision_engine",
    decisionVersion,
    severity: "warning",
    title: "Review structural risks",
    description: "Data quality is degraded; verify critical dimensions before execution.",
    why: "Input reliability is degraded.",
    impact: {
      score: 50,
      label: "Wysoki",
    },
    confidence: {
      score: 0.45,
      label: "Średnia",
    },
    cta: {
      label: "Open",
      href: "/overview#risks",
    },
    permissions: {
      canExecute: true,
    },
  };
}

function debugEnabledForRole(role: string | undefined): boolean {
  if (!role) {
    return false;
  }

  const normalizedRole = role.toUpperCase();
  return normalizedRole === "OWNER" || normalizedRole === "ADMIN";
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

function strategicPriorityBonus(params: {
  action: ActionCard;
  strategicArtifacts: StrategicArtifact[];
  strategicAlignment: StrategicAlignmentResult;
}): number {
  const { action, strategicArtifacts, strategicAlignment } = params;
  const actionTokens = new Set(tokenize(`${action.title} ${action.description}`));

  const topAlignedArtifacts = strategicAlignment.topAligned
    .map((entry) => strategicArtifacts.find((artifact) => artifact.id === entry.artifactId))
    .filter((entry): entry is StrategicArtifact => Boolean(entry));

  const topArtifact = topAlignedArtifacts[0];
  let bonus = 0;

  if (topArtifact) {
    const topTokens = tokenize(`${topArtifact.title} ${topArtifact.intent} ${(topArtifact.tags ?? []).join(" ")}`);
    const overlap = topTokens.filter((token) => actionTokens.has(token)).length;
    bonus += Math.min(18, overlap * 6);
  }

  if (strategicAlignment.driftDetected && (action.intent === "review_risks" || action.type === "review")) {
    bonus += 8;
  }

  if (strategicAlignment.alignmentScore < 60 && action.intent === "rebalance_capacity") {
    bonus += 5;
  }

  return clamp(bonus, 0, 22);
}

function applyStrategicBias(params: {
  actionCards: ActionCard[];
  strategicArtifacts: StrategicArtifact[];
  strategicAlignment: StrategicAlignmentResult;
}): ActionCard[] {
  const ranked = params.actionCards.map((actionCard) => {
    const basePriority = typeof actionCard.executionPriority === "number" ? actionCard.executionPriority : 0;
    const bonus = strategicPriorityBonus({
      action: actionCard,
      strategicArtifacts: params.strategicArtifacts,
      strategicAlignment: params.strategicAlignment,
    });

    return {
      ...actionCard,
      executionPriority: basePriority + bonus,
    };
  });

  ranked.sort((left, right) => {
    const leftPriority = typeof left.executionPriority === "number" ? left.executionPriority : 0;
    const rightPriority = typeof right.executionPriority === "number" ? right.executionPriority : 0;
    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority;
    }
    return (left.key ?? left.id ?? "").localeCompare(right.key ?? right.id ?? "");
  });

  return ranked;
}

export function buildDecisionSnapshot(
  input: ControlTowerInput,
  options?: {
    feedbackEffects?: FeedbackEffects;
    viewerRole?: string;
    workflowOps?: WorkflowOpsDiagnostics;
    strategicContext?: {
      artifacts: StrategicArtifact[];
      outcomes: OutcomeEvent[];
      nowIso?: string;
    };
  },
): ControlTowerDecisionSnapshot {
  const nowDate = input.generatedAtISO ? new Date(input.generatedAtISO) : new Date();
  const thresholds = DEFAULT_THRESHOLDS;
  const metrics = deriveMetrics(input);
  const inputSummary = {
    contentCount: metrics.contentCount,
    publicationJobsCount: metrics.publicationJobsCount,
    approvalsCount: metrics.approvalsCount,
  };

  const derivedMetricsReliable = hasDerivedMetricsReliability(input);
  const warningList = buildDecisionWarnings({
    inputSummary,
    hasApprovalData: hasApprovalData(input),
    hasPublicationData: hasPublicationData(input),
    derivedMetricsReliable,
  });

  const isEmpty = inputSummary.contentCount === 0 && inputSummary.publicationJobsCount === 0;
  const isDegraded = !isEmpty && (hasHighSeverityWarning(warningList) || !derivedMetricsReliable);
  const state: ControlTowerState = isEmpty ? "empty" : isDegraded ? "degraded" : "active";

  const risks = withWorkflowOpsRisk({
    risks: evaluateRisks(metrics, thresholds, DEFAULT_DECISION_POLICY.weights),
    workflowOps: options?.workflowOps,
  });
  const health = computeHealthScore(metrics, risks, thresholds);

  const initialRiskLevel = baseRiskLevel(health.score, metrics);
  const computedRiskLevel = risks.structuralRiskScore > 0.7 ? escalateRiskLevel(initialRiskLevel) : initialRiskLevel;

  const policyAwareActions = generateRuntimeActions({
    workspaceId: input.workspaceId ?? "workspace",
    now: nowDate,
    metrics,
    risks,
    healthScore: health.score,
    decisionVersion: CONTROL_TOWER_DECISION_VERSION,
    feedback: options?.feedbackEffects,
    policy: DEFAULT_DECISION_POLICY,
    workflowOps: options?.workflowOps,
  }).slice(0, thresholds.maxActions);

  const strategicArtifacts = options?.strategicContext?.artifacts ?? [];
  const strategicAlignment =
    strategicArtifacts.length > 0
      ? computeStrategicAlignment({
          artifacts: strategicArtifacts,
          recentActions: policyAwareActions.map((action) => ({
            id: action.id,
            title: action.title,
            type: action.type,
            kind: action.intent,
          })),
          outcomes: options?.strategicContext?.outcomes ?? [],
          nowIso: options?.strategicContext?.nowIso,
        })
      : null;

  const strategicallyRankedActions =
    strategicAlignment && strategicArtifacts.length > 0
      ? applyStrategicBias({
          actionCards: policyAwareActions,
          strategicArtifacts,
          strategicAlignment,
        })
      : policyAwareActions;

  const actionCards =
    state === "empty"
      ? [
          makeOnboardingAction({
            workspaceId: input.workspaceId ?? "workspace",
            decisionVersion: CONTROL_TOWER_DECISION_VERSION,
            intent: "fill_pipeline_gap",
            title: "Create first content",
            description: "Start the pipeline by creating your first content item.",
            why: "No content exists yet in this workspace.",
            target: { route: "/content", query: { filter: "draft" } },
            priority: 240,
            urgency: "medium",
          }),
          makeOnboardingAction({
            workspaceId: input.workspaceId ?? "workspace",
            decisionVersion: CONTROL_TOWER_DECISION_VERSION,
            intent: "schedule_next_7_days",
            title: "Plan first publication",
            description: "Set publication slots for the next 7 days.",
            why: "No publication jobs are scheduled yet.",
            target: { route: "/calendar", query: { view: "next7days" } },
            priority: 210,
            urgency: "low",
          }),
        ].slice(0, 2)
      : (() => {
          if (state !== "degraded") {
            return strategicallyRankedActions;
          }

          const hasReviewRisks = strategicallyRankedActions.some((action) => action.intent === "review_risks");
          if (hasReviewRisks) {
            return strategicallyRankedActions;
          }

          return [degradedReviewAction(input.workspaceId ?? "workspace", CONTROL_TOWER_DECISION_VERSION), ...strategicallyRankedActions].slice(
            0,
            thresholds.maxActions,
          );
        })();

  const priorityToday: PriorityToday =
    state === "empty"
      ? {
          type: "onboarding-first-content",
          message: "Create first content to initialize operational signals.",
          severity: "low",
        }
      : resolvePriority(metrics);

  const reasoning = buildExplainability(health.deductions, risks, metrics);
  const reasoningWithState =
    state === "degraded"
      ? {
          ...reasoning,
          structuralSummary: `${reasoning.structuralSummary} Data quality is degraded; prioritize safe validation actions.`,
        }
      : reasoning;

  const inputFingerprint = buildInputFingerprint({
    inputSummary,
    overduePublicationsCount: metrics.overduePublicationsCount,
    stuckContentCount: metrics.stuckContentCount,
    approvalsPendingCount: metrics.approvalsPendingCount,
    upcomingNext7DaysCount: metrics.upcomingPublicationsNext7Days,
  });

  const debugEnabled = debugEnabledForRole(options?.viewerRole);

  const capabilities: DecisionCapabilities = {
    intents: true,
    feedback: true,
    targets: true,
    debug: debugEnabled,
    policies: true,
    fingerprints: true,
  };

  return {
    schemaVersion: CONTROL_TOWER_SCHEMA_VERSION,
    decisionVersion: CONTROL_TOWER_DECISION_VERSION,
    state,
    capabilities,
    warnings: warningList,
    generatedAt: nowDate.toISOString(),
    inputSummary,
    inputFingerprint,
    healthScore: clamp(state === "empty" ? 85 : health.score, 0, 100),
    riskLevel: state === "empty" ? "low" : computedRiskLevel,
    riskFlags: risks.flags,
    priorityToday,
    actionCards,
    reasoning: reasoningWithState,
    structuralRiskScore: clamp(risks.structuralRiskScore, 0, 1),
    diagnostics: {
      structuralRiskScore: clamp(risks.structuralRiskScore, 0, 1),
      topRiskDimension: topRiskDimension(risks.dimensions),
      recentWins: options?.feedbackEffects?.recentWins.map((item) => ({
        intent: item.intent,
        occurredAt: item.occurredAt,
      })),
      suppressedIntents: Array.from(options?.feedbackEffects?.suppressedIntents ?? []).sort((left, right) => left.localeCompare(right)),
      workflowOps: options?.workflowOps,
      strategy: strategicAlignment
        ? {
            alignmentScore: strategicAlignment.alignmentScore,
            confidence: strategicAlignment.confidence,
            driftDetected: strategicAlignment.driftDetected,
            driftReason: strategicAlignment.driftReason,
            activeArtifacts: strategicArtifacts.filter((artifact) => artifact.status === "active").length,
            corrections: strategicAlignment.recommendedCorrections.map((item) => ({
              title: item.title,
              effort: item.effort,
            })),
          }
        : undefined,
    },
    debug: debugEnabled
      ? {
          metrics: {
            overduePublicationsCount: metrics.overduePublicationsCount,
            upcomingPublicationsNext7Days: metrics.upcomingPublicationsNext7Days,
            stuckContentCount: metrics.stuckContentCount,
            approvalsPendingCount: metrics.approvalsPendingCount,
            draftCount: metrics.draftCount,
            inProgressCount: metrics.inProgressCount,
            publishedLast7DaysCount: metrics.publishedLast7DaysCount,
            contentCount: metrics.contentCount,
          },
          dimensions: {
            scheduleRisk: clamp(risks.dimensions.scheduleRisk, 0, 1),
            workflowRisk: clamp(risks.dimensions.workflowRisk, 0, 1),
            approvalRisk: clamp(risks.dimensions.approvalRisk, 0, 1),
            pipelineRisk: clamp(risks.dimensions.pipelineRisk, 0, 1),
          },
          deductions: health.deductions.map((deduction) => ({
            code: deduction.id,
            points: clamp(deduction.points, 0, 100),
            details: deduction.label,
          })),
        }
      : undefined,
  };
}
