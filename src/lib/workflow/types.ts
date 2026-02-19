export type WorkflowStageId = string;
export type WorkflowVersion = string;

export type WorkflowRole = "owner" | "manager" | "editor" | "viewer";

export type WorkflowStage = {
  id: WorkflowStageId;
  label: string;
  order: number;
  wipLimit?: number;
  slaHours?: number;
  requiresApproval?: boolean;
  terminal?: boolean;
};

export type WorkflowTransition = {
  from: WorkflowStageId;
  to: WorkflowStageId;
  reversible?: boolean;
};

export type WorkflowTransitionGuard = {
  from: WorkflowStageId;
  to: WorkflowStageId;
  allowedRoles: WorkflowRole[];
};

export type WorkflowPolicy = {
  version: WorkflowVersion;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  guards: WorkflowTransitionGuard[];
};
