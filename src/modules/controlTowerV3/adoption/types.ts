export type AdoptionStatus = "not_started" | "in_progress" | "adopted" | "ignored";

export type ImpactSnapshot = {
  healthDelta: number;
  alignmentDelta: number;
  momentumDelta?: number;
  confidence: "low" | "medium" | "high";
};

export type MoveImpactWindows = {
  d3?: ImpactSnapshot;
  d7?: ImpactSnapshot;
  d14?: ImpactSnapshot;
  d30?: ImpactSnapshot;
};

export type MoveAdoption = {
  status: AdoptionStatus;
  adoptedAtIso?: string;
  impact?: MoveImpactWindows;
};

export type AdoptionRecord = {
  workspaceId: string;
  moveId: string;
  status: AdoptionStatus;
  adoptedAtIso?: string;
  impact?: MoveImpactWindows;
  updatedAtIso: string;
};

export type AdoptionEvent = {
  workspaceId: string;
  moveId: string;
  type: "intent" | "outcome";
  occurredAtIso: string;
  sessionId?: string;
};

export type AdoptionStatusInput = {
  workspaceId: string;
  moveId: string;
  status: AdoptionStatus;
  nowIso: string;
  adoptedAtIso?: string;
  impact?: MoveImpactWindows;
};

export type WorkspaceAdoptionSummary = {
  adoptedLast7Days: number;
  ignored: number;
  inProgress: number;
  totalMoves: number;
  avgImpactDelta7: number;
};
