import type { DecisionPolicy } from "./types";

export type DecisionThresholds = {
  staleDraftDays: number;
  staleReviewDays: number;
  reviewOverdueHours: number;
  overdueSeverityDays: number;
  lowCreditsPct: number;
  warningCreditsPct: number;
  inactivityDays: number;
  maxCards: number;
};

export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = {
  staleDraftDays: 7,
  staleReviewDays: 3,
  reviewOverdueHours: 48,
  overdueSeverityDays: 2,
  lowCreditsPct: 0.1,
  warningCreditsPct: 0.2,
  inactivityDays: 7,
  maxCards: 5,
};

export const DEFAULT_DECISION_POLICY: DecisionPolicy = {
  weights: { schedule: 0.35, workflow: 0.25, approvals: 0.2, pipeline: 0.2 },
  actionUrgencyOverrides: {},
};

export function getThresholds(workspaceOverrides?: Partial<DecisionThresholds>): DecisionThresholds {
  return {
    ...DEFAULT_DECISION_THRESHOLDS,
    ...(workspaceOverrides ?? {}),
  };
}
