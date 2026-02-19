export type IntentSession = {
  sessionId: string;
  workspaceId: string;
  intent: string;
  source: string;
  startedAt: string;
  targetRoute: string;
  targetQuery?: Record<string, string>;
  entityIds?: string[];
};

export type OutcomeEvent = {
  workspaceId: string;
  sessionId: string;
  intent: string;
  occurredAt: string;
  outcome: "completed" | "partial" | "abandoned" | "ignored";
  evidence: {
    kind: "navigation" | "state_change" | "explicit_action";
    details?: string;
    changedCounts?: Record<string, number>;
  };
};
