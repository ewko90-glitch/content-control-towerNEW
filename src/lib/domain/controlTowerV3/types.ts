export type ConfidenceLabel = "Niska" | "Średnia" | "Wysoka";
export type ImpactLabel = "Niski" | "Średni" | "Wysoki" | "Krytyczny";
export type Severity = "info" | "warning" | "danger";

export type ControlTowerState = "empty" | "active" | "degraded";
export type DecisionSchemaVersion = "ctv3.schema.1";
export type DecisionVersion = string;

export type DecisionCapabilities = {
  intents: boolean;
  feedback: boolean;
  targets: boolean;
  debug: boolean;
  policies: boolean;
  fingerprints: boolean;
};

export type DecisionWarning = {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type InputSummary = {
  contentCount: number;
  publicationJobsCount: number;
  approvalsCount: number;
};

export type InputFingerprint = {
  value: string;
  canonical: string;
  components: string[];
};

export type RiskDimensions = {
  scheduleRisk: number;
  workflowRisk: number;
  approvalRisk: number;
  pipelineRisk: number;
};

export type DecisionPolicyWeights = {
  schedule: number;
  workflow: number;
  approvals: number;
  pipeline: number;
};

export type DecisionPolicy = {
  weights: DecisionPolicyWeights;
  actionUrgencyOverrides?: Record<string, "low" | "medium" | "high">;
};

export type ActionIdempotency = {
  dedupeKey: string;
  cooldownSeconds?: number;
};

export type Confidence = {
  score: number;
  label: ConfidenceLabel;
};

export type Impact = {
  score: number;
  label: ImpactLabel;
};

export type PermissionResult = {
  canExecute: boolean;
  reasonIfDisabled?: string;
};

export type Signal = {
  id?: string;
  key: string;
  actionType?: "fix" | "review" | "schedule" | "optimize";
  urgency?: "low" | "medium" | "high";
  confidenceValue?: number;
  executionPriority?: number;
  severity: Severity;
  title: string;
  description: string;
  why: string;
  impact: Impact;
  confidence: Confidence;
  metricChip?: string;
  cta: {
    label: string;
    href: string;
  };
  permissions: PermissionResult;
};

export type RiskSignal = Signal;
export type PrioritySignal = Signal;

export type IntentType =
  | "fix_overdue_publications"
  | "resolve_approval_bottleneck"
  | "unblock_stuck_workflow"
  | "resolve_bottleneck_stage"
  | "resolve_workflow_sla_breaches"
  | "rebalance_workflow_capacity"
  | "reduce_stage_wip"
  | "improve_stage_throughput"
  | "fill_pipeline_gap"
  | "schedule_next_7_days"
  | "reduce_draft_backlog"
  | "improve_throughput"
  | "reduce_cycle_time"
  | "stabilize_workflow"
  | "unblock_top_risks"
  | "rebalance_capacity"
  | "expedite_reviews"
  | "reduce_predictive_risk"
  | "optimize_throughput"
  | "review_risks";

export type WorkflowOpsDiagnostics = {
  sla: {
    warningCount: number;
    breachCount: number;
    criticalCount: number;
    pressureScore: number;
    topStage?: string;
  };
  stuck: {
    stuckCount: number;
    criticalStuckCount: number;
    pressureScore: number;
    topStage?: string;
  };
  bottleneck: {
    likelihoodScore: number;
    topStage?: string;
  };
  wip?: {
    softCount: number;
    hardCount: number;
    criticalCount: number;
    pressureScore: number;
    topStage?: string;
  };
  stageWip?: Record<
    string,
    {
      severity: "none" | "soft" | "hard" | "critical";
      severityScore: number;
      count: number;
      wipLimit?: number;
    }
  >;
  bottleneckIndex?: {
    score: number;
    topStage?: string;
    lowThroughputPenalty?: number;
    reasons?: Array<{
      code: "WIP_OVER" | "LOW_THROUGHPUT" | "HEALTH_GAP" | "SLA_PRESSURE" | "STUCK_PRESSURE";
      stageId?: string;
      points: number;
    }>;
  };
  flowOps?: {
    throughputPerWeek: number;
    leadAvgHours: number;
    cycleAvgHours: number;
    efficiency: number;
    volatilityScore: number;
    anomalies?: Array<{ code: string; severity: "low" | "medium" | "high"; score: number }>;
  };
  predictiveRisk?: {
    horizonDays: number;
    pressureScore: number;
    tailRiskScore: number;
    criticalCount: number;
    highCount: number;
    topStage?: string;
    stageConcentrationPct: number;
    topDrivers?: Array<{ code: string; sharePct: number }>;
    topRisks?: Array<{
      itemId: string;
      stageId: string;
      riskScore: number;
      riskLevel: string;
      confidence: number;
      eta?: { p50At?: string; p90At?: string };
    }>;
  };
  worstStages?: string[];
};

export type ActionTarget = {
  route: string;
  query?: Record<string, string | number | boolean>;
  hash?: string;
};

export type ActionSelector = {
  kind: "publication_job" | "content_item" | "approval";
  ids?: string[];
  filter?: {
    status?: string[];
    stage?: string[];
    overdue?: boolean;
    sinceDays?: number;
  };
};

export type ActionReason = {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type ActionCardRuntime = {
  id: string;
  intent: IntentType;
  type: "fix" | "review" | "schedule" | "optimize";
  title: string;
  description: string;
  urgency: "low" | "medium" | "high";
  confidence: number;
  executionPriority: number;
  target: ActionTarget;
  selector?: ActionSelector;
  reasons: ActionReason[];
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  createdBy: "decision_engine";
  decisionVersion: string;
};

type ActionCardRuntimeCompat = Omit<ActionCardRuntime, "confidence"> & {
  confidenceValue: number;
};

export type ActionCard = Signal &
  Partial<ActionCardRuntimeCompat> & {
    intent?: string;
    idempotency?: ActionIdempotency;
  };

export type Insight = {
  key: string;
  text: string;
  severity: Severity;
};

export type TimelineItem = {
  id: string;
  title: string;
  time?: string;
  scheduledAtISO: string;
  channelLabel?: string;
  channelName?: string;
  status: string;
  href?: string;
};

export type TimelineGroup = {
  key?: "today" | "tomorrow" | "week";
  title?: "Dziś" | "Jutro" | "Ten tydzień";
  label: "Dziś" | "Jutro" | "Ten tydzień";
  items: TimelineItem[];
  emptyCta?: {
    label: string;
    href: string;
  };
};

export type Metrics = {
  totalContent: number;
  overdueCount: number;
  overdueMaxAgeDays: number;
  reviewCount: number;
  reviewOver48hCount: number;
  avgReviewHours: number;
  staleDraftCount: number;
  staleReviewCount: number;
  upcomingToday: number;
  upcomingTomorrow: number;
  upcomingWeek: number;
  createdLast7d: number;
  versionsLast7d: number;
  aiJobsLast7d: number;
  creditsRemaining: number;
  monthlyCredits: number;
  creditsUsedPct: number;
  lowCredits: boolean;
  warningCredits: boolean;
  noneUpcomingWeek: boolean;
  workflowEventsTotal: number;
  byStatus: {
    REVIEW: number;
  };
  velocity: number;
  workflowDistribution: {
    ideaPct: number;
    imbalance: boolean;
  };
  inactivity: boolean;
  ideaPct: number;
  draftPct: number;
  reviewPct: number;
  inactive: boolean;
};

export type RawSnapshot = {
  workspace: {
    workspaceSlug: string;
  };
  publicationRows: Array<{
    id: string;
    scheduledAt: Date;
    contentTitle: string;
    channelLabel: string;
    status: string;
    contentItemId: string;
  }>;
  metrics: Metrics;
  generatedAtISO: string;
};

export type HealthBreakdownItem = {
  key: string;
  title: string;
  points: number;
  maxPoints: number;
  explanation: string;
  severity: Severity;
  relatedHref?: string;
};

export type HealthScore = {
  score: number;
  label: "Świetna forma" | "Stabilnie" | "Wymaga uwagi" | "Krytyczne";
  breakdown: HealthBreakdownItem[];
  topDetractors?: HealthBreakdownItem[];
  topBoosters?: HealthBreakdownItem[];
};

export type HealthBreakdownEntry = HealthBreakdownItem;

export type WorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
  role: "VIEWER" | "EDITOR" | "MANAGER" | "ADMIN";
};

export type ControlTowerV3Snapshot = {
  version: "ct_v3";
  generatedAtISO: string;
  subtitle?: string;
  emptyState?: {
    title: string;
    steps: string[];
    cta: {
      label: string;
      href: string;
    };
  };
  health: HealthScore;
  priority: PrioritySignal;
  risks: RiskSignal[];
  cards: ActionCard[];
  actionCards: ActionCard[];
  insights: Insight[];
  timeline: TimelineGroup[];
  quickActions: Array<{
    key: string;
    label: string;
    href: string;
    disabled: boolean;
    reason?: string;
  }>;
  metrics: Metrics;
};

export type DerivedMetrics = {
  overduePublicationsCount: number;
  upcomingPublicationsNext7Days: number;
  stuckContentCount: number;
  approvalsPendingCount: number;
  draftCount: number;
  inProgressCount: number;
  publishedLast7DaysCount: number;
  overduePublicationIds: string[];
  stuckContentIds: string[];
  approvalIds: string[];
  contentCount: number;
  publicationJobsCount: number;
  approvalsCount: number;
};

export type ControlTowerInput = {
  workspaceId?: string;
  generatedAtISO?: string;
  overduePublicationsCount?: number;
  upcomingPublicationsNext7Days?: number;
  stuckContentCount?: number;
  approvalsPendingCount?: number;
  draftCount?: number;
  inProgressCount?: number;
  publishedLast7DaysCount?: number;
  overdueCount?: number;
  upcomingWeek?: number;
  staleDraftCount?: number;
  staleReviewCount?: number;
  reviewCount?: number;
  totalContent?: number;
  draftPct?: number;
  reviewPct?: number;
  overduePublicationIds?: string[];
  stuckContentIds?: string[];
  approvalIds?: string[];
  statusCounts?: Partial<Record<"IDEA" | "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED", number>>;
};

export type ControlTowerThresholds = {
  approvalPendingThreshold: number;
  scheduleOverdueMax: number;
  workflowStuckMax: number;
  approvalBacklogMax: number;
  pipelineBacklogMin: number;
  maxActions: number;
};

export type RiskDimensionKey = "scheduleRisk" | "workflowRisk" | "approvalRisk" | "pipelineRisk";

export type RiskFlag = {
  id: string;
  dimension: RiskDimensionKey;
  level: "low" | "medium" | "high";
  intensity: number;
  message: string;
};

export type RiskEvaluationResult = {
  flags: RiskFlag[];
  structuralRiskScore: number;
  dimensions: RiskDimensions;
};

export type ScoreDeduction = {
  id: string;
  label: string;
  points: number;
};

export type HealthScoreResult = {
  score: number;
  deductions: ScoreDeduction[];
};

export type PriorityToday = {
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type ExplainabilityBlock = {
  scoreBreakdown: string[];
  mainRiskDrivers: string[];
  structuralSummary: string;
};

export type StrategyDiagnostics = {
  alignmentScore: number;
  confidence: "low" | "medium" | "high";
  driftDetected: boolean;
  driftReason?: string;
  activeArtifacts: number;
  corrections: Array<{ title: string; effort: "S" | "M" | "L" }>;
};

export type ControlTowerDecisionSnapshot = {
  schemaVersion: DecisionSchemaVersion;
  decisionVersion: string;
  workflowPolicyVersion?: string;
  state: ControlTowerState;
  capabilities: DecisionCapabilities;
  warnings: DecisionWarning[];
  generatedAt: string;
  inputSummary: InputSummary;
  inputFingerprint: InputFingerprint;
  healthScore: number;
  riskLevel: "low" | "medium" | "high";
  riskFlags: RiskFlag[];
  priorityToday: PriorityToday;
  actionCards: ActionCard[];
  reasoning: ExplainabilityBlock;
  structuralRiskScore?: number;
  diagnostics?: {
    structuralRiskScore?: number;
    topRiskDimension?: keyof RiskDimensions;
    cacheHint?: "fresh" | "cached";
    recentWins?: Array<{ intent: string; occurredAt: string }>;
    suppressedIntents?: string[];
    workflowOps?: WorkflowOpsDiagnostics;
    strategy?: StrategyDiagnostics;
  };
  debug?: {
    metrics?: Record<string, number>;
    dimensions?: RiskDimensions;
    deductions?: Array<{ code: string; points: number; details?: string }>;
  };
};
