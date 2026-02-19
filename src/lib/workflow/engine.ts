import { WorkflowErrorCode } from "./errors";
import { canRoleTransition } from "./guards";
import { getOutgoingTransitions, getStage } from "./graph";
import type { WorkflowPolicy, WorkflowRole, WorkflowStageId } from "./types";
import { validateWorkflowPolicy } from "./validation";

export function canTransition(params: {
  policy: WorkflowPolicy;
  currentStage: WorkflowStageId;
  targetStage: WorkflowStageId;
  role: WorkflowRole;
}): {
  allowed: boolean;
  reason?: string;
} {
  const { policy, currentStage, targetStage, role } = params;

  const policyValidation = validateWorkflowPolicy(policy);
  if (!policyValidation.valid) {
    return { allowed: false, reason: WorkflowErrorCode.POLICY_INVALID };
  }

  if (!getStage(policy, currentStage) || !getStage(policy, targetStage)) {
    return { allowed: false, reason: WorkflowErrorCode.INVALID_STAGE };
  }

  const hasTransition = policy.transitions.some((transition) => transition.from === currentStage && transition.to === targetStage);
  if (!hasTransition) {
    return { allowed: false, reason: WorkflowErrorCode.INVALID_TRANSITION };
  }

  const roleAllowed = canRoleTransition({
    policy,
    from: currentStage,
    to: targetStage,
    role,
  });

  if (!roleAllowed) {
    return { allowed: false, reason: WorkflowErrorCode.ROLE_NOT_ALLOWED };
  }

  return { allowed: true };
}

export function getAvailableTransitions(params: {
  policy: WorkflowPolicy;
  currentStage: WorkflowStageId;
  role: WorkflowRole;
}): WorkflowStageId[] {
  const { policy, currentStage, role } = params;

  if (!getStage(policy, currentStage)) {
    return [];
  }

  const outgoing = getOutgoingTransitions(policy, currentStage);
  return outgoing
    .filter((transition) => canRoleTransition({ policy, from: transition.from, to: transition.to, role }))
    .map((transition) => transition.to);
}
