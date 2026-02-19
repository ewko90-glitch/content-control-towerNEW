export type ExecTone = "neutral" | "positive" | "warning" | "danger";

export type ExecutiveKpi = {
  id: string;
  label: string;
  value: string;
  secondary?: string;
  tone: ExecTone;
};

export type ExecutiveRisk = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  explanation: string;
};

export type ExecutiveAction = {
  id: string;
  title: string;
  impact: string;
  target?: string;
};

export type ExecutiveDecisionRow = {
  id: string;
  name: string;
  status: "explored" | "adopted" | "rejected";
  delta?: string;
  when: string;
};

export type ExecutiveStrategyBlock = {
  name?: string;
  adoptedAt?: string;
  impactStatus?: "improving" | "neutral" | "worsening" | "insufficient_data";
  confidencePct?: number;
  interpretation?: string;
};

export type ExecutiveSnapshot = {
  generatedAt: string;
  workspaceSlug: string;
  kpis: ExecutiveKpi[];
  risks: ExecutiveRisk[];
  strategy: ExecutiveStrategyBlock;
  actions: ExecutiveAction[];
  decisions: ExecutiveDecisionRow[];
};
