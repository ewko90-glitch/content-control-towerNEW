import type { OutcomeEvent } from "@/lib/domain/controlTowerV3/feedback/types";

export type StrategicArtifactType = "priority" | "hypothesis" | "experiment" | "assumption" | "decision";

export type StrategicArtifactStatus = "active" | "archived";

export type StrategicHorizon = "now" | "this_month" | "this_quarter" | "this_year";

export type StrategicArtifact = {
  readonly id: string;
  readonly workspaceId: string;
  readonly type: StrategicArtifactType;
  readonly title: string;
  readonly description: string;
  readonly status: StrategicArtifactStatus;
  readonly intent: string;
  readonly successMetric?: string;
  readonly owner?: string;
  readonly horizon: StrategicHorizon;
  readonly tags?: readonly string[];
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt?: string;
  readonly archivedAt?: string;
};

export type StrategicMatch = {
  readonly artifactId: string;
  readonly actionId?: string;
  readonly signal: "keyword" | "type" | "outcome" | "manual";
  readonly strength: number;
};

export type StrategicAlignmentResult = {
  readonly alignmentScore: number;
  readonly confidence: "low" | "medium" | "high";
  readonly driftDetected: boolean;
  readonly driftReason?: string;
  readonly topAligned: ReadonlyArray<{ readonly artifactId: string; readonly title: string; readonly strength: number }>;
  readonly topMisaligned: ReadonlyArray<{ readonly reason: string; readonly evidence: string; readonly severity: "low" | "medium" | "high" }>;
  readonly recommendedCorrections: ReadonlyArray<{ readonly title: string; readonly why: string; readonly effort: "S" | "M" | "L" }>;
  readonly diagnostics: {
    readonly inputs: { readonly artifacts: number; readonly actions: number; readonly outcomes: number };
    readonly notes: ReadonlyArray<string>;
  };
};

export type StrategicStorePayload = {
  readonly version: 1;
  readonly updatedAt: string;
  readonly artifacts: ReadonlyArray<StrategicArtifact>;
};

export type StrategicActionLike = {
  readonly id?: string;
  readonly title?: string;
  readonly name?: string;
  readonly type?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly createdAt?: string;
};

export type StrategicAlignmentInput = {
  readonly artifacts: ReadonlyArray<StrategicArtifact>;
  readonly recentActions: ReadonlyArray<StrategicActionLike>;
  readonly outcomes: ReadonlyArray<OutcomeEvent>;
  readonly nowIso?: string;
};
