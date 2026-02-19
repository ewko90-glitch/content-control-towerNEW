import type { ControlTowerInput } from "../types";
import { NOW_ISO } from "./now";

export function makeInputBase(): ControlTowerInput {
  return {
    workspaceId: "ws-test",
    generatedAtISO: NOW_ISO,
    totalContent: 0,
    overduePublicationsCount: 0,
    upcomingPublicationsNext7Days: 0,
    stuckContentCount: 0,
    approvalsPendingCount: 0,
    draftCount: 0,
    inProgressCount: 0,
    publishedLast7DaysCount: 0,
    overduePublicationIds: [],
    stuckContentIds: [],
    approvalIds: [],
    statusCounts: {
      IDEA: 0,
      DRAFT: 0,
      REVIEW: 0,
      APPROVED: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    },
  };
}

export function withOverduePublications(input: ControlTowerInput, n: number): ControlTowerInput {
  return {
    ...input,
    overduePublicationsCount: n,
    overdueCount: n,
    overduePublicationIds: Array.from({ length: Math.max(0, n) }, (_, index) => `pub-${index + 1}`),
  };
}

export function withUpcomingPublicationsNext7Days(input: ControlTowerInput, n: number): ControlTowerInput {
  return {
    ...input,
    upcomingPublicationsNext7Days: n,
    upcomingWeek: n,
  };
}

export function withStuckContent(input: ControlTowerInput, n: number): ControlTowerInput {
  return {
    ...input,
    stuckContentCount: n,
    stuckContentIds: Array.from({ length: Math.max(0, n) }, (_, index) => `stuck-${index + 1}`),
  };
}

export function withApprovalsPending(input: ControlTowerInput, n: number): ControlTowerInput {
  return {
    ...input,
    approvalsPendingCount: n,
    reviewCount: n,
    approvalIds: Array.from({ length: Math.max(0, n) }, (_, index) => `approval-${index + 1}`),
    statusCounts: {
      ...(input.statusCounts ?? {}),
      REVIEW: n,
    },
  };
}

export function withPipeline(input: ControlTowerInput, params: { draft: number; inProgress: number }): ControlTowerInput {
  const total = params.draft + params.inProgress;
  return {
    ...input,
    draftCount: params.draft,
    inProgressCount: params.inProgress,
    totalContent: Math.max(total, input.totalContent ?? 0),
    statusCounts: {
      ...(input.statusCounts ?? {}),
      DRAFT: params.draft,
      REVIEW: params.inProgress,
    },
  };
}

export function permuteInputCollections(input: ControlTowerInput): ControlTowerInput {
  const reverse = <T,>(list: T[] | undefined): T[] | undefined => {
    if (!Array.isArray(list)) {
      return list;
    }
    return [...list].reverse();
  };

  return {
    ...input,
    overduePublicationIds: reverse(input.overduePublicationIds),
    stuckContentIds: reverse(input.stuckContentIds),
    approvalIds: reverse(input.approvalIds),
  };
}
