import type {
  ActionCard,
  ActionReason,
  ActionTarget,
  DerivedMetrics,
  IntentType,
  RiskDimensionKey,
  RiskEvaluationResult,
  WorkflowOpsDiagnostics,
} from "./types";
import type { FeedbackEffects } from "./feedback/effects";
import type { DecisionPolicy } from "./types";

const MAX_ACTIONS = 5;
const SELECTOR_LIMIT = 20;
const CRITICAL_FIX_COOLDOWN_SECONDS = 21600;
const SCHEDULING_COOLDOWN_SECONDS = 10800;
const OPTIMIZE_REVIEW_COOLDOWN_SECONDS = 43200;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function urgencyWeight(urgency: "low" | "medium" | "high"): number {
  if (urgency === "high") {
    return 3;
  }
  if (urgency === "medium") {
    return 2;
  }
  return 1;
}

function severityFromUrgency(urgency: "low" | "medium" | "high"): ActionCard["severity"] {
  if (urgency === "high") {
    return "danger";
  }
  if (urgency === "medium") {
    return "warning";
  }
  return "info";
}

function impactLabel(urgency: "low" | "medium" | "high"): ActionCard["impact"]["label"] {
  if (urgency === "high") {
    return "Krytyczny";
  }
  if (urgency === "medium") {
    return "Wysoki";
  }
  return "Średni";
}

function confidenceLabel(score: number): ActionCard["confidence"]["label"] {
  if (score >= 0.75) {
    return "Wysoka";
  }
  if (score >= 0.4) {
    return "Średnia";
  }
  return "Niska";
}

function stableActionId(params: { workspaceId: string; intent: IntentType; key?: string }): string {
  return `ctv3:${params.workspaceId}:${params.intent}:${params.key ?? "v1"}`;
}

function primaryDriverForIntent(intent: IntentType): string {
  if (intent === "fix_overdue_publications") {
    return "overdue";
  }
  if (intent === "resolve_approval_bottleneck") {
    return "approval_pending";
  }
  if (intent === "unblock_stuck_workflow") {
    return "stuck";
  }
  if (intent === "resolve_bottleneck_stage") {
    return "bottleneck";
  }
  if (intent === "resolve_workflow_sla_breaches") {
    return "sla";
  }
  if (intent === "rebalance_workflow_capacity") {
    return "bottleneck";
  }
  if (intent === "reduce_stage_wip") {
    return "wip";
  }
  if (intent === "improve_stage_throughput") {
    return "throughput";
  }
  if (intent === "fill_pipeline_gap") {
    return "empty_pipeline";
  }
  if (intent === "schedule_next_7_days") {
    return "no_upcoming_7d";
  }
  if (intent === "reduce_draft_backlog") {
    return "draft_backlog";
  }
  if (intent === "improve_throughput") {
    return "throughput";
  }
  if (intent === "reduce_cycle_time") {
    return "cycle_time";
  }
  if (intent === "stabilize_workflow") {
    return "volatility";
  }
  if (intent === "unblock_top_risks" || intent === "rebalance_capacity" || intent === "expedite_reviews" || intent === "reduce_predictive_risk") {
    return "predictive_risk";
  }
  if (intent === "optimize_throughput") {
    return "throughput";
  }
  return "risks";
}

function normalizeUrgencyByPolicy(
  intent: IntentType,
  fallbackUrgency: "low" | "medium" | "high",
  policy: DecisionPolicy | undefined,
): "low" | "medium" | "high" {
  const override = policy?.actionUrgencyOverrides?.[intent];
  if (override === "low" || override === "medium" || override === "high") {
    return override;
  }
  return fallbackUrgency;
}

function cooldownForIntent(params: { intent: IntentType; urgency: "low" | "medium" | "high"; healthScore: number }): number {
  let cooldown = OPTIMIZE_REVIEW_COOLDOWN_SECONDS;

  if (
    params.intent === "fix_overdue_publications" ||
    params.intent === "resolve_approval_bottleneck" ||
    params.intent === "unblock_stuck_workflow" ||
    params.intent === "resolve_workflow_sla_breaches" ||
    params.intent === "resolve_bottleneck_stage" ||
    params.intent === "rebalance_workflow_capacity" ||
    params.intent === "reduce_stage_wip" ||
    params.intent === "improve_throughput" ||
    params.intent === "reduce_cycle_time" ||
    params.intent === "stabilize_workflow"
  ) {
    cooldown = CRITICAL_FIX_COOLDOWN_SECONDS;
  } else if (params.intent === "schedule_next_7_days") {
    cooldown = SCHEDULING_COOLDOWN_SECONDS;
  }

  if (params.healthScore < 50 && params.urgency === "high") {
    cooldown = Math.max(1, Math.round(cooldown * 0.5));
  }

  return cooldown;
}

function buildTarget(intent: IntentType): ActionTarget {
  if (intent === "fix_overdue_publications") {
    return {
      route: "/content",
      query: {
        filter: "overdue",
      },
    };
  }
  if (intent === "resolve_approval_bottleneck") {
    return {
      route: "/content",
      query: {
        filter: "approval_pending",
      },
    };
  }
  if (intent === "unblock_stuck_workflow") {
    return {
      route: "/content",
      query: {
        filter: "stuck",
      },
    };
  }
  if (intent === "resolve_bottleneck_stage") {
    return {
      route: "/content",
      query: {
        filter: "stuck",
      },
    };
  }
  if (intent === "resolve_workflow_sla_breaches") {
    return {
      route: "/content",
      query: {
        filter: "overdue",
      },
    };
  }
  if (intent === "rebalance_workflow_capacity") {
    return {
      route: "/content",
      query: {
        filter: "stuck",
      },
    };
  }
  if (intent === "reduce_stage_wip") {
    return {
      route: "/content",
      query: {
        filter: "stuck",
      },
    };
  }
  if (intent === "improve_stage_throughput") {
    return {
      route: "/content",
      query: {
        filter: "throughput",
      },
    };
  }
  if (intent === "unblock_top_risks") {
    return {
      route: "/content",
      query: {
        focus: "risk",
        driver: "stuck",
      },
    };
  }
  if (intent === "rebalance_capacity") {
    return {
      route: "/content",
      query: {
        focus: "risk",
        driver: "wip",
      },
    };
  }
  if (intent === "expedite_reviews") {
    return {
      route: "/content",
      query: {
        focus: "risk",
        driver: "sla",
      },
    };
  }
  if (intent === "reduce_predictive_risk") {
    return {
      route: "/content",
      query: {
        focus: "risk",
      },
    };
  }
  if (intent === "fill_pipeline_gap") {
    return {
      route: "/content",
      query: {
        filter: "draft",
      },
    };
  }
  if (intent === "schedule_next_7_days") {
    return {
      route: "/calendar",
      query: {
        view: "next7days",
      },
    };
  }
  if (intent === "reduce_draft_backlog") {
    return {
      route: "/content",
      query: {
        filter: "draft_backlog",
      },
    };
  }
  if (intent === "improve_throughput" || intent === "reduce_cycle_time" || intent === "stabilize_workflow") {
    return {
      route: "/content",
      query: {
        focus: "flow",
      },
    };
  }
  if (intent === "optimize_throughput") {
    return {
      route: "/content",
      query: {
        filter: "throughput",
      },
    };
  }

  return {
    route: "/overview",
    hash: "risks",
  };
}

function confidenceFromDimension(value: number): number {
  return clamp(value, 0.25, 0.95);
}

function computeExecutionPriority(params: {
  urgency: "low" | "medium" | "high";
  confidence: number;
  structuralRiskScore: number;
  healthScore: number;
}): number {
  return (
    urgencyWeight(params.urgency) * 100 +
    Math.round(params.confidence * 30) +
    Math.round(params.structuralRiskScore * 20) +
    (params.healthScore < 50 ? 10 : 0)
  );
}

function dimensionIntensity(risks: RiskEvaluationResult, dimension: RiskDimensionKey): number {
  return clamp(risks.dimensions[dimension] ?? 0, 0, 1);
}

function reasonsForIntent(intent: IntentType, metrics: DerivedMetrics): ActionReason[] {
  if (intent === "fix_overdue_publications") {
    return [
      {
        code: "OVERDUE_COUNT",
        message: `Overdue publications: ${metrics.overduePublicationsCount}`,
        severity: metrics.overduePublicationsCount > 3 ? "high" : "medium",
      },
    ];
  }
  if (intent === "resolve_approval_bottleneck") {
    return [
      {
        code: "APPROVAL_PENDING_COUNT",
        message: `Approvals pending: ${metrics.approvalsPendingCount}`,
        severity: metrics.approvalsPendingCount > 5 ? "high" : "medium",
      },
    ];
  }
  if (intent === "unblock_stuck_workflow") {
    return [
      {
        code: "STUCK_CONTENT_COUNT",
        message: `Stuck workflow items: ${metrics.stuckContentCount}`,
        severity: metrics.stuckContentCount > 4 ? "high" : "medium",
      },
    ];
  }
  if (intent === "resolve_bottleneck_stage") {
    return [
      {
        code: "WORKFLOW_BOTTLENECK",
        message: "A single stage is constraining flow throughput.",
        severity: "medium",
      },
    ];
  }
  if (intent === "resolve_workflow_sla_breaches") {
    return [
      {
        code: "WORKFLOW_SLA_PRESSURE",
        message: "Workflow SLA pressure is elevated.",
        severity: "medium",
      },
    ];
  }
  if (intent === "rebalance_workflow_capacity") {
    return [
      {
        code: "WORKFLOW_FLOW_IMBALANCE",
        message: "Flow control indicates capacity concentration in one stage.",
        severity: "high",
      },
    ];
  }
  if (intent === "reduce_stage_wip") {
    return [
      {
        code: "WORKFLOW_OVERLOAD_CRITICAL",
        message: "At least one stage exceeds WIP hard/critical threshold.",
        severity: "high",
      },
    ];
  }
  if (intent === "improve_stage_throughput") {
    return [
      {
        code: "WORKFLOW_LOW_THROUGHPUT",
        message: "Throughput penalty indicates slowed stage progression.",
        severity: "medium",
      },
    ];
  }
  if (intent === "unblock_top_risks") {
    return [
      {
        code: "PREDICTIVE_STUCK_DRIVER",
        message: "Predictive portfolio is driven by stuck-risk concentration.",
        severity: "high",
      },
    ];
  }
  if (intent === "rebalance_capacity") {
    return [
      {
        code: "PREDICTIVE_WIP_DRIVER",
        message: "Predictive portfolio indicates WIP overload concentration.",
        severity: "high",
      },
    ];
  }
  if (intent === "expedite_reviews") {
    return [
      {
        code: "PREDICTIVE_SLA_DRIVER",
        message: "Predictive portfolio indicates SLA pressure concentration.",
        severity: "medium",
      },
    ];
  }
  if (intent === "reduce_predictive_risk") {
    return [
      {
        code: "PREDICTIVE_RISK_PRESSURE",
        message: "Portfolio predictive pressure remains elevated.",
        severity: "medium",
      },
    ];
  }
  if (intent === "fill_pipeline_gap" || intent === "schedule_next_7_days") {
    return [
      {
        code: "NO_UPCOMING_7D",
        message: "No upcoming publications in the next 7 days.",
        severity: "high",
      },
      {
        code: "EMPTY_PIPELINE",
        message: `Pipeline coverage: ${metrics.draftCount + metrics.inProgressCount}`,
        severity: metrics.draftCount + metrics.inProgressCount === 0 ? "high" : "medium",
      },
    ];
  }
  if (intent === "reduce_draft_backlog") {
    return [
      {
        code: "DRAFT_BACKLOG",
        message: `Draft count: ${metrics.draftCount}`,
        severity: metrics.draftCount > 8 ? "medium" : "low",
      },
    ];
  }
  if (intent === "optimize_throughput") {
    return [
      {
        code: "THROUGHPUT_WINDOW",
        message: `Published last 7 days: ${metrics.publishedLast7DaysCount}`,
        severity: "low",
      },
    ];
  }
  if (intent === "improve_throughput") {
    return [
      {
        code: "THROUGHPUT_DROP",
        message: "Throughput anomaly indicates reduced output pace.",
        severity: "high",
      },
    ];
  }
  if (intent === "reduce_cycle_time") {
    return [
      {
        code: "CYCLE_TIME_SPIKE",
        message: "Cycle or lead-time spike requires acceleration actions.",
        severity: "high",
      },
    ];
  }
  if (intent === "stabilize_workflow") {
    return [
      {
        code: "VOLATILITY_RISE",
        message: "Volatility anomaly suggests unstable flow behavior.",
        severity: "medium",
      },
    ];
  }

  return [
    {
      code: "STRUCTURAL_RISK_REVIEW",
      message: "Review top structural risk dimensions.",
      severity: "medium",
    },
  ];
}

function buildRuntimeAction(params: {
  workspaceId: string;
  decisionVersion: string;
  intent: IntentType;
  type: "fix" | "review" | "schedule" | "optimize";
  urgency: "low" | "medium" | "high";
  title: string;
  description: string;
  why: string;
  confidence: number;
  structuralRiskScore: number;
  healthScore: number;
  metrics: DerivedMetrics;
  selector?: ActionCard["selector"];
  policy?: DecisionPolicy;
  targetOverride?: ActionTarget;
  primaryDriverSuffix?: string;
}): ActionCard {
  const resolvedUrgency = normalizeUrgencyByPolicy(params.intent, params.urgency, params.policy);
  const boundedConfidence = clamp(confidenceFromDimension(params.confidence), 0.2, 0.95);
  const priority = computeExecutionPriority({
    urgency: resolvedUrgency,
    confidence: boundedConfidence,
    structuralRiskScore: params.structuralRiskScore,
    healthScore: params.healthScore,
  });

  const id = stableActionId({
    workspaceId: params.workspaceId,
    intent: params.intent,
  });
  const dedupeKey = `${params.intent}:${primaryDriverForIntent(params.intent)}${
    params.primaryDriverSuffix ? `:${params.primaryDriverSuffix}` : ""
  }`;

  return {
    id,
    key: id,
    intent: params.intent,
    type: params.type,
    actionType: params.type,
    urgency: resolvedUrgency,
    confidenceValue: boundedConfidence,
    executionPriority: priority,
    target: params.targetOverride ?? buildTarget(params.intent),
    selector: params.selector,
    idempotency: {
      dedupeKey,
      cooldownSeconds: cooldownForIntent({
        intent: params.intent,
        urgency: resolvedUrgency,
        healthScore: params.healthScore,
      }),
    },
    reasons: reasonsForIntent(params.intent, params.metrics),
    primaryCtaLabel: "Open",
    createdBy: "decision_engine",
    decisionVersion: params.decisionVersion,
    severity: severityFromUrgency(resolvedUrgency),
    title: params.title,
    description: params.description,
    why: params.why,
    impact: {
      score: urgencyWeight(resolvedUrgency) * 30,
      label: impactLabel(resolvedUrgency),
    },
    confidence: {
      score: boundedConfidence,
      label: confidenceLabel(boundedConfidence),
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

function dedupeByIdempotency(actions: ActionCard[]): ActionCard[] {
  const deduped = new Map<string, ActionCard>();

  const fallbackDedupeKey = (action: ActionCard): string => {
    const explicit = action.idempotency?.dedupeKey;
    if (explicit && explicit.length > 0) {
      return explicit;
    }

    const intentLike = action.intent ?? action.type ?? action.actionType ?? "review_risks";
    const titleToken = action.title.trim().toLowerCase().replace(/\s+/g, "_");
    return `${intentLike}:${titleToken || "risks"}`;
  };

  for (const action of actions) {
    const dedupeKey = fallbackDedupeKey(action);
    const existing = deduped.get(dedupeKey);

    if (!existing) {
      deduped.set(dedupeKey, action);
      continue;
    }

    const nextPriority = action.executionPriority ?? 0;
    const prevPriority = existing.executionPriority ?? 0;

    if (nextPriority > prevPriority) {
      deduped.set(dedupeKey, action);
      continue;
    }

    if (nextPriority === prevPriority && (action.id ?? "").localeCompare(existing.id ?? "") < 0) {
      deduped.set(dedupeKey, action);
    }
  }

  return Array.from(deduped.values());
}

export function generateRuntimeActions(params: {
  workspaceId: string;
  now: Date;
  metrics: DerivedMetrics;
  risks: RiskEvaluationResult;
  healthScore: number;
  decisionVersion: string;
  feedback?: FeedbackEffects;
  policy?: DecisionPolicy;
  workflowOps?: WorkflowOpsDiagnostics;
}): ActionCard[] {
  const metrics = params.metrics;
  const candidates: ActionCard[] = [];

  if (metrics.overduePublicationsCount > 0) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "fix_overdue_publications",
        type: "fix",
        urgency: metrics.overduePublicationsCount > 3 ? "high" : "medium",
        title: "Resolve overdue publications",
        description: "Reduce overdue queue to recover scheduling discipline.",
        why: `${metrics.overduePublicationsCount} overdue publications require intervention.`,
        confidence: dimensionIntensity(params.risks, "scheduleRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        selector: {
          kind: "publication_job",
          ids: metrics.overduePublicationIds.slice(0, SELECTOR_LIMIT),
          filter: {
            overdue: true,
          },
        },
        policy: params.policy,
      }),
    );
  }

  if (metrics.approvalsPendingCount > 0) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "resolve_approval_bottleneck",
        type: "review",
        urgency: metrics.approvalsPendingCount > 5 ? "high" : "medium",
        title: "Resolve approval bottleneck",
        description: "Process pending approvals to unblock content progression.",
        why: `${metrics.approvalsPendingCount} approvals are waiting for decision.`,
        confidence: dimensionIntensity(params.risks, "approvalRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        selector: {
          kind: "approval",
          ids: metrics.approvalIds.slice(0, SELECTOR_LIMIT),
          filter: {
            status: ["PENDING"],
          },
        },
        policy: params.policy,
      }),
    );
  }

  if (metrics.stuckContentCount > 0) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "unblock_stuck_workflow",
        type: "optimize",
        urgency: metrics.stuckContentCount > 4 ? "high" : "medium",
        title: "Unblock stuck workflow",
        description: "Move stagnant work items through the pipeline.",
        why: `${metrics.stuckContentCount} items are stuck in workflow states.`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        selector: {
          kind: "content_item",
          ids: metrics.stuckContentIds.slice(0, SELECTOR_LIMIT),
          filter: {
            stage: ["DRAFT", "REVIEW"],
          },
        },
        policy: params.policy,
      }),
    );
  }

  const hasCriticalWorkflow = params.risks.flags.some((flag) => flag.id === "WORKFLOW_CRITICAL");
  const hasBottleneckPressure = params.risks.flags.some((flag) => flag.id === "WORKFLOW_BOTTLENECK_LIKELY");
  const hasSlaPressure = params.risks.flags.some((flag) => flag.id === "WORKFLOW_SLA_PRESSURE");
  const bottleneckIndexScore = params.workflowOps?.bottleneckIndex?.score ?? 0;
  const bottleneckIndexTopStage = params.workflowOps?.bottleneckIndex?.topStage;
  const lowThroughputPenalty = params.workflowOps?.bottleneckIndex?.lowThroughputPenalty ?? 0;
  const flowOps = params.workflowOps?.flowOps;
  const throughputAnomaly = flowOps?.anomalies?.find(
    (anomaly) => anomaly.code === "THROUGHPUT_DROP" && (anomaly.severity === "medium" || anomaly.severity === "high"),
  );
  const cycleLeadAnomaly = flowOps?.anomalies?.find(
    (anomaly) =>
      (anomaly.code === "LEAD_TIME_SPIKE" || anomaly.code === "CYCLE_TIME_SPIKE") &&
      (anomaly.severity === "medium" || anomaly.severity === "high"),
  );
  const volatilityAnomaly = flowOps?.anomalies?.find((anomaly) => anomaly.code === "VOLATILITY_RISE");
  const predictiveRisk = params.workflowOps?.predictiveRisk;
  const topPredictiveDriver = predictiveRisk?.topDrivers?.slice().sort((left, right) => {
    if (right.sharePct !== left.sharePct) {
      return right.sharePct - left.sharePct;
    }
    return left.code.localeCompare(right.code);
  })[0];

  const overloadedStage = Object.entries(params.workflowOps?.stageWip ?? {})
    .filter(([, stage]) => stage.severity === "hard" || stage.severity === "critical")
    .sort((left, right) => {
      if (right[1].severityScore !== left[1].severityScore) {
        return right[1].severityScore - left[1].severityScore;
      }
      return left[0].localeCompare(right[0]);
    })[0];

  if (bottleneckIndexScore >= 65) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "rebalance_workflow_capacity",
        type: "optimize",
        urgency: "high",
        title: "Rebalance workflow capacity",
        description: "Redistribute flow load across stages to reduce bottleneck pressure.",
        why: `Bottleneck index score: ${bottleneckIndexScore}.`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        targetOverride: {
          route: "/content",
          query: {
            stage: bottleneckIndexTopStage ?? "review",
          },
        },
        primaryDriverSuffix: bottleneckIndexTopStage,
        policy: params.policy,
      }),
    );
  }

  if (overloadedStage) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "reduce_stage_wip",
        type: "optimize",
        urgency: "high",
        title: "Reduce stage WIP overload",
        description: "Relieve overloaded stage queue to restore healthy flow limits.",
        why: `Stage ${overloadedStage[0]} exceeds WIP threshold (${overloadedStage[1].severity}).`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        targetOverride: {
          route: "/content",
          query: {
            stage: overloadedStage[0],
          },
        },
        primaryDriverSuffix: overloadedStage[0],
        policy: params.policy,
      }),
    );
  }

  if (lowThroughputPenalty >= 30) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "improve_stage_throughput",
        type: "optimize",
        urgency: "medium",
        title: "Improve stage throughput",
        description: "Increase flow velocity in slowest non-terminal stages.",
        why: `Low throughput penalty: ${lowThroughputPenalty}.`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        primaryDriverSuffix: params.workflowOps?.bottleneckIndex?.topStage,
        policy: params.policy,
      }),
    );
  }

  if (throughputAnomaly) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "improve_throughput",
        type: "optimize",
        urgency: throughputAnomaly.severity === "high" ? "high" : "medium",
        title: "Improve throughput",
        description: "Recover output pace after throughput drop anomaly.",
        why: `Anomaly score: ${throughputAnomaly.score}.`,
        confidence: Math.max(dimensionIntensity(params.risks, "workflowRisk"), throughputAnomaly.score / 100),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        primaryDriverSuffix: "throughput",
        policy: params.policy,
      }),
    );
  }

  if (cycleLeadAnomaly) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "reduce_cycle_time",
        type: "optimize",
        urgency: cycleLeadAnomaly.severity === "high" ? "high" : "medium",
        title: "Reduce cycle time",
        description: "Shorten handoff and processing delays in active flow.",
        why: `Anomaly score: ${cycleLeadAnomaly.score}.`,
        confidence: Math.max(dimensionIntensity(params.risks, "workflowRisk"), cycleLeadAnomaly.score / 100),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        primaryDriverSuffix: "cycle_time",
        policy: params.policy,
      }),
    );
  }

  if (volatilityAnomaly) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "stabilize_workflow",
        type: "optimize",
        urgency: volatilityAnomaly.severity === "high" ? "high" : "medium",
        title: "Stabilize workflow",
        description: "Reduce variability to keep flow predictable week to week.",
        why: `Anomaly score: ${volatilityAnomaly.score}.`,
        confidence: Math.max(dimensionIntensity(params.risks, "workflowRisk"), volatilityAnomaly.score / 100),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        primaryDriverSuffix: "volatility",
        policy: params.policy,
      }),
    );
  }

  if (predictiveRisk) {
    const topDriverCode = topPredictiveDriver?.code;
    const topDriverShare = topPredictiveDriver?.sharePct ?? 0;
    const topStage = predictiveRisk.topStage;
    const predictiveSuffix = `${topStage ?? "none"}:${(topDriverCode ?? "none").toLowerCase()}`;

    if ((topDriverCode === "STUCK" && topDriverShare >= 25) || predictiveRisk.criticalCount > 0) {
      candidates.push(
        buildRuntimeAction({
          workspaceId: params.workspaceId,
          decisionVersion: params.decisionVersion,
          intent: "unblock_top_risks",
          type: "optimize",
          urgency: "high",
          title: "Unblock top predictive risks",
          description: "Prioritize highest-risk stuck items before delays materialize.",
          why: `Critical predicted items: ${predictiveRisk.criticalCount}.`,
          confidence: clamp(Math.max(predictiveRisk.tailRiskScore / 100, 0.55), 0, 1),
          structuralRiskScore: params.risks.structuralRiskScore,
          healthScore: params.healthScore,
          metrics,
          targetOverride: {
            route: "/content",
            query: {
              focus: "risk",
              driver: "stuck",
            },
          },
          primaryDriverSuffix: predictiveSuffix,
          policy: params.policy,
        }),
      );
    } else if (topDriverCode === "WIP_OVERLOAD" && topDriverShare >= 25) {
      candidates.push(
        buildRuntimeAction({
          workspaceId: params.workspaceId,
          decisionVersion: params.decisionVersion,
          intent: "rebalance_capacity",
          type: "optimize",
          urgency: "high",
          title: "Rebalance predictive capacity pressure",
          description: "Reduce projected delay concentration from stage WIP overload.",
          why: `Top driver share: ${topDriverShare}%.`,
          confidence: clamp(Math.max(predictiveRisk.pressureScore / 100, 0.5), 0, 1),
          structuralRiskScore: params.risks.structuralRiskScore,
          healthScore: params.healthScore,
          metrics,
          targetOverride: {
            route: "/content",
            query: {
              focus: "risk",
              driver: "wip",
            },
          },
          primaryDriverSuffix: predictiveSuffix,
          policy: params.policy,
        }),
      );
    } else if (topDriverCode === "SLA_PRESSURE" && topDriverShare >= 25) {
      candidates.push(
        buildRuntimeAction({
          workspaceId: params.workspaceId,
          decisionVersion: params.decisionVersion,
          intent: "expedite_reviews",
          type: "review",
          urgency: topDriverShare >= 40 ? "high" : "medium",
          title: "Expedite predictive review pressure",
          description: "Accelerate review throughput to reduce projected SLA delays.",
          why: `Top driver share: ${topDriverShare}%.`,
          confidence: clamp(Math.max(predictiveRisk.pressureScore / 100, 0.45), 0, 1),
          structuralRiskScore: params.risks.structuralRiskScore,
          healthScore: params.healthScore,
          metrics,
          targetOverride: {
            route: "/content",
            query: {
              focus: "risk",
              driver: "sla",
            },
          },
          primaryDriverSuffix: predictiveSuffix,
          policy: params.policy,
        }),
      );
    } else {
      candidates.push(
        buildRuntimeAction({
          workspaceId: params.workspaceId,
          decisionVersion: params.decisionVersion,
          intent: "reduce_predictive_risk",
          type: "optimize",
          urgency: "medium",
          title: "Reduce predictive portfolio risk",
          description: "Apply preventive actions to lower upcoming delay probability.",
          why: `Predictive pressure: ${Math.round(predictiveRisk.pressureScore)}.`,
          confidence: clamp(Math.max(predictiveRisk.pressureScore / 100, 0.4), 0, 1),
          structuralRiskScore: params.risks.structuralRiskScore,
          healthScore: params.healthScore,
          metrics,
          targetOverride: {
            route: "/content",
            query: {
              focus: "risk",
            },
          },
          primaryDriverSuffix: predictiveSuffix,
          policy: params.policy,
        }),
      );
    }
  }

  if (hasCriticalWorkflow) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "unblock_stuck_workflow",
        type: "optimize",
        urgency: "high",
        title: "Unblock critical workflow pressure",
        description: "Address critical stuck and SLA hotspots before throughput degrades.",
        why: "Critical workflow pressure detected across stuck or SLA dimensions.",
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  } else if (hasBottleneckPressure) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "resolve_bottleneck_stage",
        type: "optimize",
        urgency: params.workflowOps?.bottleneck.likelihoodScore && params.workflowOps.bottleneck.likelihoodScore >= 60 ? "high" : "medium",
        title: "Resolve bottleneck stage",
        description: "Relieve stage pressure where flow is currently constrained.",
        why: `Bottleneck likelihood: ${params.workflowOps?.bottleneck.likelihoodScore ?? 0}.`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        selector:
          params.workflowOps?.bottleneck.topStage
            ? {
                kind: "content_item",
                filter: {
                  stage: [params.workflowOps.bottleneck.topStage.toUpperCase()],
                },
              }
            : undefined,
        targetOverride: {
          route: "/content",
          query: {
            stage: params.workflowOps?.bottleneck.topStage ?? "review",
          },
        },
        policy: params.policy,
      }),
    );
  } else if (hasSlaPressure) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "resolve_workflow_sla_breaches",
        type: "review",
        urgency: "medium",
        title: "Resolve workflow SLA breaches",
        description: "Prioritize items breaching workflow SLA targets.",
        why: `SLA pressure score: ${params.workflowOps?.sla.pressureScore ?? 0}.`,
        confidence: dimensionIntensity(params.risks, "workflowRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  if (metrics.upcomingPublicationsNext7Days === 0) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "schedule_next_7_days",
        type: "schedule",
        urgency: "high",
        title: "Schedule next 7 days",
        description: "Add publication slots for the upcoming week.",
        why: "No publications are planned for the next 7 days.",
        confidence: clamp((dimensionIntensity(params.risks, "pipelineRisk") + dimensionIntensity(params.risks, "scheduleRisk")) / 2, 0, 1),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  if (metrics.draftCount > 8) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "reduce_draft_backlog",
        type: "optimize",
        urgency: "medium",
        title: "Reduce draft backlog",
        description: "Convert draft backlog into actionable review items.",
        why: `${metrics.draftCount} drafts indicate backlog accumulation.`,
        confidence: dimensionIntensity(params.risks, "pipelineRisk"),
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  if (params.healthScore >= 75 && metrics.publishedLast7DaysCount > 0) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "optimize_throughput",
        type: "optimize",
        urgency: "low",
        title: "Optimize throughput",
        description: "Maintain stable flow and improve operational cadence.",
        why: `${metrics.publishedLast7DaysCount} published items show healthy throughput.`,
        confidence: 0.4,
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  if (candidates.length === 0 || (params.healthScore <= 75 && params.risks.structuralRiskScore >= 0.4)) {
    candidates.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: "review_risks",
        type: "review",
        urgency: params.risks.structuralRiskScore > 0.7 ? "high" : params.risks.structuralRiskScore > 0.4 ? "medium" : "low",
        title: "Review structural risks",
        description: "Inspect highest risk dimensions and apply mitigation actions.",
        why: `Structural risk score: ${params.risks.structuralRiskScore.toFixed(2)}.`,
        confidence: params.risks.structuralRiskScore,
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  const deduped = new Map<string, ActionCard>();
  for (const action of candidates) {
    if (action.id && !deduped.has(action.id)) {
      deduped.set(action.id, action);
    }
  }

  const suppressedIntents = params.feedback?.suppressedIntents ?? new Set<string>();
  const intentBoosts = params.feedback?.intentBoosts ?? {};

  const withFeedback = Array.from(deduped.values())
    .filter((action) => {
      if (!action.intent) {
        return true;
      }
      return !suppressedIntents.has(action.intent);
    })
    .map((action) => {
      if (!action.intent) {
        return action;
      }

      const delta = intentBoosts[action.intent] ?? 0;
      if (delta === 0) {
        return action;
      }

      return {
        ...action,
        executionPriority: (action.executionPriority ?? 0) + delta,
      };
    });

  const fallbackIntents: IntentType[] = ["review_risks", "optimize_throughput"];
  let fallbackIndex = 0;

  while (withFeedback.length < MAX_ACTIONS && fallbackIndex < fallbackIntents.length) {
    const fallbackIntent = fallbackIntents[fallbackIndex];
    fallbackIndex += 1;

    if (suppressedIntents.has(fallbackIntent)) {
      continue;
    }

    const exists = withFeedback.some((action) => action.intent === fallbackIntent);
    if (exists) {
      continue;
    }

    withFeedback.push(
      buildRuntimeAction({
        workspaceId: params.workspaceId,
        decisionVersion: params.decisionVersion,
        intent: fallbackIntent,
        type: fallbackIntent === "review_risks" ? "review" : "optimize",
        urgency: "low",
        title: fallbackIntent === "review_risks" ? "Review structural risks" : "Optimize throughput",
        description:
          fallbackIntent === "review_risks"
            ? "Inspect risk dimensions while operational work stabilizes."
            : "Maintain stable execution rhythm with lightweight optimizations.",
        why: "Fallback neutral action to preserve operator guidance when high-priority intents were suppressed.",
        confidence: 0.35,
        structuralRiskScore: params.risks.structuralRiskScore,
        healthScore: params.healthScore,
        metrics,
        policy: params.policy,
      }),
    );
  }

  const idempotent = dedupeByIdempotency(withFeedback);

  return idempotent
    .sort((a, b) => {
      const leftPriority = a.executionPriority ?? 0;
      const rightPriority = b.executionPriority ?? 0;
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }
      return (a.id ?? "").localeCompare(b.id ?? "");
    })
    .slice(0, MAX_ACTIONS);
}

export function generateActions(metrics: DerivedMetrics, risks: RiskEvaluationResult, score: number): ActionCard[] {
  return generateRuntimeActions({
    workspaceId: "workspace",
    now: new Date(0),
    metrics,
    risks,
    healthScore: score,
    decisionVersion: "ctv3.v1.5.hardening",
  });
}
