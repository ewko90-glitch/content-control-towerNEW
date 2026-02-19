import type { TransitionDirection, WorkflowStatus } from "@prisma/client";

import { ContentDomainError } from "./errors";

const transitionOrder: WorkflowStatus[] = ["IDEA", "DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

const allowedTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  IDEA: ["DRAFT", "ARCHIVED"],
  DRAFT: ["IDEA", "REVIEW", "ARCHIVED"],
  REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["APPROVED", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["IDEA"],
};

export function assertTransitionAllowed(from: WorkflowStatus, to: WorkflowStatus) {
  if (from === to) {
    return;
  }

  if (!allowedTransitions[from].includes(to)) {
    throw new ContentDomainError(
      "CONFLICT",
      `Niedozwolone przejście workflow: ${from} → ${to}.`,
      409,
    );
  }
}

export function getTransitionDirection(from: WorkflowStatus, to: WorkflowStatus): TransitionDirection {
  const fromIdx = transitionOrder.indexOf(from);
  const toIdx = transitionOrder.indexOf(to);

  if (toIdx > fromIdx) {
    return "FORWARD";
  }

  if (toIdx < fromIdx) {
    return "BACKWARD";
  }

  return "JUMP";
}