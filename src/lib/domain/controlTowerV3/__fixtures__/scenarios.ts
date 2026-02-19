import type { OutcomeEvent } from "../feedback/types";
import type { ControlTowerInput, ControlTowerState } from "../types";
import {
  makeInputBase,
  withApprovalsPending,
  withOverduePublications,
  withPipeline,
  withStuckContent,
  withUpcomingPublicationsNext7Days,
} from "./builders";
import { NOW } from "./now";

type ScenarioExpectation = {
  state?: ControlTowerState;
  riskLevel?: "low" | "medium" | "high";
  healthScoreRange?: [number, number];
  mustHaveIntents?: string[];
  mustNotHaveIntents?: string[];
  maxActions?: number;
  warningsContainCodes?: string[];
};

export type Scenario = {
  name: string;
  input: ControlTowerInput;
  outcomes?: OutcomeEvent[];
  expect: ScenarioExpectation;
};

function isoHoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

const basePipeline = withPipeline(makeInputBase(), { draft: 6, inProgress: 4 });

export const SCENARIOS: Scenario[] = [
  {
    name: "EMPTY_WORKSPACE",
    input: makeInputBase(),
    expect: {
      state: "empty",
      riskLevel: "low",
      healthScoreRange: [80, 100],
      maxActions: 2,
      mustHaveIntents: ["fill_pipeline_gap", "schedule_next_7_days"],
      warningsContainCodes: ["NO_CONTENT_YET"],
    },
  },
  {
    name: "PIPELINE_EMPTY",
    input: {
      ...makeInputBase(),
      totalContent: 5,
      draftCount: 0,
      inProgressCount: 0,
    },
    expect: {
      state: "active",
      riskLevel: "low",
      mustHaveIntents: ["schedule_next_7_days"],
      maxActions: 5,
    },
  },
  {
    name: "OVERDUE_2",
    input: withOverduePublications(withUpcomingPublicationsNext7Days(basePipeline, 3), 2),
    expect: {
      state: "active",
      riskLevel: "low",
      mustHaveIntents: ["fix_overdue_publications"],
      maxActions: 5,
    },
  },
  {
    name: "OVERDUE_5_HIGH",
    input: withOverduePublications(withUpcomingPublicationsNext7Days(basePipeline, 2), 5),
    expect: {
      state: "active",
      riskLevel: "high",
      healthScoreRange: [0, 80],
      mustHaveIntents: ["fix_overdue_publications"],
      maxActions: 5,
    },
  },
  {
    name: "APPROVAL_BOTTLENECK",
    input: withApprovalsPending(withUpcomingPublicationsNext7Days(basePipeline, 4), 8),
    expect: {
      state: "active",
      mustHaveIntents: ["resolve_approval_bottleneck"],
      maxActions: 5,
    },
  },
  {
    name: "STUCK_6",
    input: withStuckContent(withUpcomingPublicationsNext7Days(basePipeline, 4), 6),
    expect: {
      state: "active",
      mustHaveIntents: ["unblock_stuck_workflow"],
      maxActions: 5,
    },
  },
  {
    name: "NO_UPCOMING_7D",
    input: withPipeline(makeInputBase(), { draft: 3, inProgress: 2 }),
    expect: {
      state: "active",
      mustHaveIntents: ["schedule_next_7_days"],
      maxActions: 5,
    },
  },
  {
    name: "DEGRADED_MISSING_APPROVALS",
    input: {
      ...withOverduePublications(withPipeline(makeInputBase(), { draft: 4, inProgress: 1 }), 1),
      approvalsPendingCount: undefined,
      reviewCount: undefined,
      approvalIds: undefined,
      statusCounts: {
        DRAFT: 4,
      },
    },
    expect: {
      state: "degraded",
      warningsContainCodes: ["MISSING_APPROVAL_DATA"],
      maxActions: 5,
    },
  },
  {
    name: "FEEDBACK_SUPPRESS_COMPLETED_2H",
    input: withOverduePublications(withUpcomingPublicationsNext7Days(basePipeline, 3), 3),
    outcomes: [
      {
        workspaceId: "ws-test",
        sessionId: "sess-1",
        intent: "fix_overdue_publications",
        occurredAt: isoHoursAgo(2),
        outcome: "completed",
        evidence: {
          kind: "state_change",
        },
      },
    ],
    expect: {
      mustNotHaveIntents: ["fix_overdue_publications"],
      maxActions: 5,
    },
  },
  {
    name: "FEEDBACK_DEPRIO_ABANDONED_TWICE_24H",
    input: withApprovalsPending(withUpcomingPublicationsNext7Days(basePipeline, 3), 7),
    outcomes: [
      {
        workspaceId: "ws-test",
        sessionId: "sess-2a",
        intent: "resolve_approval_bottleneck",
        occurredAt: isoHoursAgo(5),
        outcome: "abandoned",
        evidence: { kind: "navigation" },
      },
      {
        workspaceId: "ws-test",
        sessionId: "sess-2b",
        intent: "resolve_approval_bottleneck",
        occurredAt: isoHoursAgo(10),
        outcome: "abandoned",
        evidence: { kind: "navigation" },
      },
    ],
    expect: {
      mustHaveIntents: ["resolve_approval_bottleneck"],
      maxActions: 5,
    },
  },
  {
    name: "FEEDBACK_IGNORE_REPEATED",
    input: withStuckContent(withUpcomingPublicationsNext7Days(basePipeline, 3), 4),
    outcomes: [
      {
        workspaceId: "ws-test",
        sessionId: "sess-3a",
        intent: "unblock_stuck_workflow",
        occurredAt: isoHoursAgo(3),
        outcome: "ignored",
        evidence: { kind: "navigation" },
      },
      {
        workspaceId: "ws-test",
        sessionId: "sess-3b",
        intent: "unblock_stuck_workflow",
        occurredAt: isoHoursAgo(6),
        outcome: "ignored",
        evidence: { kind: "navigation" },
      },
    ],
    expect: {
      mustHaveIntents: ["unblock_stuck_workflow"],
      maxActions: 5,
    },
  },
  {
    name: "MIXED_RISKS_OVERDUE_STUCK_APPROVALS",
    input: withApprovalsPending(
      withStuckContent(withOverduePublications(withUpcomingPublicationsNext7Days(withPipeline(makeInputBase(), { draft: 8, inProgress: 6 }), 1), 4), 5),
      7,
    ),
    expect: {
      state: "active",
      riskLevel: "high",
      healthScoreRange: [0, 75],
      mustHaveIntents: ["fix_overdue_publications", "resolve_approval_bottleneck", "unblock_stuck_workflow"],
      maxActions: 5,
    },
  },
];
