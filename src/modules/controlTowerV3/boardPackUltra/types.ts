import type { PortfolioRow, PortfolioSnapshot, RiskSeverity } from "@/modules/controlTowerV3/portfolio/types";

export type PortfolioPhase = "Stabilization Phase" | "Realignment Phase" | "Optimization Phase" | "Expansion Phase";

export type StrategicPlayId = "stabilize" | "realign" | "optimize" | "signal_strengthening";

export type ExecutivePriorityPlay = {
  id: StrategicPlayId;
  title: string;
  whyThisMatters: string;
  whatWillChange: string;
  actions: string[];
  expectedOutcome: string;
  priority: number;
};

export type SystemicPatternCode =
  | "drift_cluster"
  | "low_alignment_pattern"
  | "execution_bottleneck"
  | "missing_weekly_planning"
  | "high_performance_leverage_zone";

export type SystemicPattern = {
  code: SystemicPatternCode;
  title: string;
  severity: RiskSeverity;
  narrative: string;
  affected: Array<{ workspaceId: string; slug: string; name: string }>;
};

export type RiskHeatmap = {
  atRiskPercent: number;
  driftingPercent: number;
  highConfidencePercent: number;
  lowSignalPercent: number;
};

export type SignalStrength = {
  artifacts: number;
  actions: number;
  outcomes: number;
  confidence: "low" | "medium" | "high";
  note: string;
};

export type WorkspacePrescriptionAction = {
  title: string;
  why: string;
  effort: "S" | "M" | "L";
  expectedOutcome: string;
};

export type WorkspaceStrategicBrief = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  strategicStatus: {
    health: number;
    alignment: number;
    drift: boolean;
    confidence: "low" | "medium" | "high";
  };
  executiveDiagnosis: string;
  weeklyMoves: Array<{
    kind: "focus" | "stability" | "optimization";
    title: string;
    metric: string;
    effort: "S" | "M" | "L";
    risk: "low" | "medium" | "high";
    expectedImpact: string;
  }>;
  riskRegister: Array<{ label: string; severity: RiskSeverity; evidence?: string }>;
  operationalPrescription: WorkspacePrescriptionAction[];
  signal: SignalStrength;
};

export type ExecutiveReportLayoutSection = {
  id: string;
  title: string;
  pageBreakBefore: boolean;
  pageHint: number;
};

export type ExecutiveReportModel = {
  meta: {
    title: string;
    subtitle: string;
    generatedAtIso: string;
    scope: string;
    phase: PortfolioPhase;
  };
  executiveSummary: {
    strategicHeadline: string;
    portfolioNarrative: string;
    kpis: {
      totalWorkspaces: number;
      critical: number;
      drifting: number;
      strong: number;
      averageAlignment: number;
      averageHealth: number;
    };
    priorityPlays: ExecutivePriorityPlay[];
  };
  structuralAnalysis: {
    rankingMatrix: PortfolioRow[];
    systemicPatterns: SystemicPattern[];
    riskHeatmap: RiskHeatmap;
  };
  workspaceBriefs: WorkspaceStrategicBrief[];
  source: {
    portfolioSnapshot: PortfolioSnapshot;
    workspaceSnapshotCount: number;
  };
  layout: {
    sections: ExecutiveReportLayoutSection[];
  };
};

export type WorkspaceSnapshotLike = {
  generatedAtIso?: string;
  healthScore?: number;
  trend7d?: { score?: number };
  strategy?: {
    alignment?: {
      alignmentScore?: number;
      driftDetected?: boolean;
      confidence?: "low" | "medium" | "high";
      diagnostics?: {
        inputs?: {
          artifacts?: number;
          actions?: number;
          outcomes?: number;
        };
      };
      topMisaligned?: ReadonlyArray<{ title?: string; reason?: string }>;
    };
    weeklyMoves?: ReadonlyArray<{
      kind?: "focus" | "stability" | "optimization";
      title?: string;
      successMetric?: string;
      effort?: "S" | "M" | "L";
      risk?: "low" | "medium" | "high";
      expectedImpact?: { healthScoreDelta?: number };
    }>;
  };
};
