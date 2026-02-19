import type { ProjectContextInput } from "@/modules/projects/types";

export type PlanCadence = {
  freq: "weekly" | "biweekly";
  daysOfWeek: number[];
};

export type PlanChannel = "blog" | "linkedin" | "newsletter" | "landing";

export type PlanInput = {
  projectId: string;
  name: string;
  startDate: string;
  cadence: PlanCadence;
  channels: PlanChannel[];
  horizonWeeks: number;
};

export type PlanKeywordCluster = {
  id: string;
  label: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
};

export type LinkSuggestion = {
  url: string;
  title: string;
  anchorHint?: string;
};

export type PlanItemDraft = {
  publishDate: string;
  channel: PlanChannel;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  clusterId: string;
  clusterLabel: string;
  note: string;
  internalLinkSuggestions: LinkSuggestion[];
  externalLinkSuggestions: LinkSuggestion[];
};

export type PlanGenerationDiagnostics = {
  clustersCount: number;
  collisionsAvoided: number;
  totalItemsGenerated: number;
  firstDate: string | null;
  lastDate: string | null;
};

export type PlanGenerationResult = {
  items: PlanItemDraft[];
  diagnostics: PlanGenerationDiagnostics;
};

export type PlanSuggestion = {
  id: string;
  type: "increase_cluster" | "reduce_cluster" | "fill_missing" | "shift_overdue" | "test_new_angle";
  clusterId: string;
  clusterLabel: string;
  reason: string;
  impact: string;
  proposedChanges: {
    add?: number;
    remove?: number;
    shiftDays?: number;
    changeAngle?: boolean;
  };
  severity: number;
};

export type PlanRefreshInput = {
  planId: string;
  horizonWeeks: number;
  startDateISO?: string;
  cadenceOverride?: { freq: "weekly" | "biweekly"; daysOfWeek: number[] };
  channelsOverride?: string[];
};

export type PlanRefreshClusterStat = {
  clusterId: string;
  clusterLabel: string;
  performanceState: "high" | "medium" | "low" | "unknown";
  coverageState: "healthy" | "thin" | "missing" | "drifting";
  weight: number;
  rationale: string;
};

export type PlanRefreshDiagnostics = {
  sourcePlanId: string;
  horizonWeeks: number;
  startDate: string;
  clusterStats: PlanRefreshClusterStat[];
  totalItems: number;
  collisionsAvoided: number;
};

export type PlanRefreshResult = {
  proposal: {
    name: string;
    startDate: string;
    cadence: PlanCadence;
    channels: string[];
    items: Array<{
      publishDate: string;
      channel: string;
      title: string;
      primaryKeyword: string;
      secondaryKeywords: string[];
      internalLinkSuggestions: LinkSuggestion[];
      externalLinkSuggestions: LinkSuggestion[];
      clusterId: string;
      clusterLabel: string;
      note: string;
    }>;
  };
  diagnostics: PlanRefreshDiagnostics;
};

export type PlannerInput = {
  projectContext: ProjectContextInput;
  startDate: string;
  cadence: PlanCadence;
  channels: string[];
  horizonWeeks: number;
};
