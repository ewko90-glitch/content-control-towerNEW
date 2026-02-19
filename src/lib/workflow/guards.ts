import type { WorkflowPolicy, WorkflowRole, WorkflowStageId } from "./types";

export function canRoleTransition(params: {
  policy: WorkflowPolicy;
  from: WorkflowStageId;
  to: WorkflowStageId;
  role: WorkflowRole;
}): boolean {
  const { policy, from, to, role } = params;

  const transitionExists = policy.transitions.some((transition) => transition.from === from && transition.to === to);
  if (!transitionExists) {
    return false;
  }

  const guard = policy.guards.find((entry) => entry.from === from && entry.to === to);
  if (!guard) {
    return false;
  }

  return guard.allowedRoles.includes(role);
}
