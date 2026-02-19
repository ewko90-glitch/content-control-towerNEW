export type HealthBand = "critical" | "risk" | "ok" | "strong";
export type MomentumBand = "down" | "flat" | "up";
export type RiskSeverity = "low" | "medium" | "high";

export type PortfolioRisk = {
  code: "strategic_drift" | "low_health" | "misalignment" | "no_weekly_plan" | "stalled_execution" | "low_signal";
  label: string;
  severity: RiskSeverity;
  evidence?: string;
};

export type PortfolioMoveMini = {
  title: string;
  kind: "focus" | "stability" | "optimization";
};

export type PortfolioRow = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;

  healthScore: number;
  healthBand: HealthBand;

  momentum7d: number;
  momentumBand: MomentumBand;

  strategicAlignmentScore: number;
  driftDetected: boolean;
  confidence: "low" | "medium" | "high";

  risks: PortfolioRisk[];
  topMoves: PortfolioMoveMini[];

  updatedAtIso: string;

  rankKey: string;
};

export type PortfolioInsight = {
  id: string;
  title: string;
  narrative: string;
  severity: RiskSeverity;
  affectedWorkspaces: Array<{ workspaceId: string; name: string; slug: string }>;
  recommendedPlay: { title: string; steps: string[] };
};

export type PortfolioSnapshot = {
  generatedAtIso: string;
  summary: {
    total: number;
    critical: number;
    drifting: number;
    strong: number;
    headline: string;
    notes: string[];
  };
  insights: PortfolioInsight[];
  rows: PortfolioRow[];
};
