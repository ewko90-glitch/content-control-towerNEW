export const SPOTLIGHT_VERSION = "v2" as const;

export type SpotlightVersion = typeof SPOTLIGHT_VERSION;

export type SpotlightStatus = "active" | "completed" | "dismissed";

export type SpotlightAction = "next" | "openDecisionLab" | "openCommandOS" | "none";

export type SpotlightStep = {
  id: string;
  title: string;
  body: string;
  why: string;
  selector: string;
  primaryLabel: string;
  secondaryLabel: string;
  action: SpotlightAction;
};

export type SpotlightFlowInput = {
  workspaceSlug: string;
  hasContent: boolean;
  hasPublications: boolean;
  hasSignals: boolean;
  hasDecisionLab: boolean;
  decisionLabReady: boolean;
  hasCommandOS: boolean;
};

export type SpotlightFlow = {
  steps: SpotlightStep[];
  version: SpotlightVersion;
  totalSteps: number;
};

export type SpotlightStoredState = {
  status: SpotlightStatus;
  stepIndex: number;
  version: SpotlightVersion;
  updatedAt: string;
};
