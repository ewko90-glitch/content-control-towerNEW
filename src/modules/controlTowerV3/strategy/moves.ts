import type { StrategicAlignmentResult, StrategicArtifact } from "./types";
import type { MoveAdoption } from "../adoption/types";

export type StrategicMoveKind = "focus" | "stability" | "optimization";

export type StrategicMoveActionKind = "workflow" | "content" | "calendar" | "quality" | "ops";

export type StrategicMove = {
  id: string;
  workspaceId: string;
  weekKey: string;
  kind: StrategicMoveKind;
  title: string;
  why: string;
  linkedArtifacts: Array<{ artifactId: string; title: string; type: string }>;
  successMetric: string;
  effort: "S" | "M" | "L";
  risk: "low" | "medium" | "high";
  expectedImpact: {
    healthScoreDelta: number;
    confidence: "low" | "medium" | "high";
    rationale: string;
  };
  recommendedActions: Array<{
    title: string;
    kind: StrategicMoveActionKind;
    reason: string;
  }>;
  createdAt: string;
  diagnostics: {
    alignmentScore: number;
    driftDetected: boolean;
    inputs: { artifacts: number; actions: number; outcomes: number };
    notes: string[];
  };
  adoption?: MoveAdoption;
};

type MoveWithoutId = Omit<StrategicMove, "id">;

type ActionLike = {
  readonly createdAt?: string;
  readonly title?: string;
  readonly name?: string;
  readonly type?: string;
  readonly kind?: string;
};

type OutcomeLike = {
  readonly createdAt?: string;
  readonly occurredAt?: string;
  readonly outcome?: string;
};

const TYPE_ORDER: Readonly<Record<StrategicArtifact["type"], number>> = {
  priority: 0,
  experiment: 1,
  hypothesis: 2,
  assumption: 3,
  decision: 4,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toMillis(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

export function norm(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, " ");
}

export function tokens(input: string): string[] {
  return norm(input)
    .split(/[^a-z0-9]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function getIsoWeekKey(nowIso: string): string {
  const parsed = Date.parse(nowIso);
  const safeDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(Date.UTC(1970, 0, 1));

  const utcDate = new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate()));
  const weekday = (utcDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate() - weekday));
  const thursday = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 3));
  const weekYear = thursday.getUTCFullYear();

  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Weekday = (jan4.getUTCDay() + 6) % 7;
  const week1Start = new Date(Date.UTC(weekYear, 0, 4 - jan4Weekday));

  const weekNumber = Math.floor((weekStart.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const safeWeekNumber = clamp(weekNumber, 1, 53);

  return `${weekYear}-W${String(safeWeekNumber).padStart(2, "0")}`;
}

function sortArtifacts(input: ReadonlyArray<StrategicArtifact>): StrategicArtifact[] {
  return [...input].sort((left, right) => {
    const leftStatus = left.status === "active" ? 0 : 1;
    const rightStatus = right.status === "active" ? 0 : 1;
    if (leftStatus !== rightStatus) {
      return leftStatus - rightStatus;
    }

    const leftType = TYPE_ORDER[left.type];
    const rightType = TYPE_ORDER[right.type];
    if (leftType !== rightType) {
      return leftType - rightType;
    }

    const leftCreated = toMillis(left.createdAt) ?? Number.NEGATIVE_INFINITY;
    const rightCreated = toMillis(right.createdAt) ?? Number.NEGATIVE_INFINITY;
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortByDateDescIfPresent<T>(input: ReadonlyArray<T>, pickDate: (item: T) => string | undefined): T[] {
  const allHaveDate = input.every((item) => typeof pickDate(item) === "string" && Number.isFinite(Date.parse(pickDate(item) as string)));
  if (!allHaveDate) {
    return [...input];
  }

  return [...input].sort((left, right) => {
    const leftTs = Date.parse(pickDate(left) as string);
    const rightTs = Date.parse(pickDate(right) as string);
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }
    return 0;
  });
}

function toArtifactLink(artifact: StrategicArtifact): { artifactId: string; title: string; type: string } {
  return {
    artifactId: artifact.id,
    title: artifact.title,
    type: artifact.type,
  };
}

function pickTopPriority(params: {
  artifacts: ReadonlyArray<StrategicArtifact>;
  alignment: StrategicAlignmentResult;
}): StrategicArtifact | null {
  const activeArtifacts = params.artifacts.filter((artifact) => artifact.status === "active");
  const alignedTop = params.alignment.topAligned[0];

  if (alignedTop) {
    const linked = activeArtifacts.find((artifact) => artifact.id === alignedTop.artifactId);
    if (linked) {
      return linked;
    }
  }

  return activeArtifacts.find((artifact) => artifact.type === "priority") ?? null;
}

function downgradeConfidence(confidence: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (confidence === "high") {
    return "medium";
  }
  if (confidence === "medium") {
    return "low";
  }
  return "low";
}

function deriveRisk(params: { driftDetected: boolean; alignmentScore: number; negativeOutcomes: number }): "low" | "medium" | "high" {
  if (params.driftDetected || params.negativeOutcomes >= 2) {
    return "high";
  }
  if (params.alignmentScore >= 80) {
    return "low";
  }
  return "medium";
}

function deriveEffort(params: {
  driftDetected: boolean;
  alignmentScore: number;
  actions: Array<{ title: string }>;
}): "S" | "M" | "L" {
  if (params.driftDetected && params.alignmentScore < 50) {
    return "L";
  }

  const hasDefineMetric = params.actions.some((action) => norm(action.title).includes("define") && norm(action.title).includes("metric"));
  if (params.actions.length >= 3 || hasDefineMetric) {
    return "M";
  }
  return "S";
}

function deriveImpact(params: {
  kind: StrategicMoveKind;
  alignment: StrategicAlignmentResult;
  actionsCount: number;
  negativeOutcomes: number;
}): StrategicMove["expectedImpact"] {
  let healthScoreDelta = 3;

  if (params.alignment.driftDetected) {
    healthScoreDelta += params.negativeOutcomes >= 2 ? 2 : 4;
  }
  if (params.alignment.alignmentScore > 80) {
    healthScoreDelta += 5;
  }
  if (params.alignment.alignmentScore < 50) {
    healthScoreDelta += 2;
  }

  healthScoreDelta = clamp(healthScoreDelta, -5, 12);

  let confidence = params.alignment.confidence;
  if (params.actionsCount < 5) {
    confidence = downgradeConfidence(confidence);
  }

  const rationaleByKind: Record<StrategicMoveKind, string> = {
    focus: "Based on current alignment and execution spread, focused delivery should improve measurable outcomes.",
    stability: "Based on current drift and unmatched actions, stability work is likely to restore throughput.",
    optimization: "Given current strategy signals, a controlled optimization loop should compound gains.",
  };

  return {
    healthScoreDelta,
    confidence,
    rationale: rationaleByKind[params.kind],
  };
}

function uniqueLinkedArtifacts(input: StrategicArtifact[]): Array<{ artifactId: string; title: string; type: string }> {
  const seen = new Set<string>();
  const output: Array<{ artifactId: string; title: string; type: string }> = [];

  for (const artifact of input) {
    if (seen.has(artifact.id)) {
      continue;
    }
    seen.add(artifact.id);
    output.push(toArtifactLink(artifact));
    if (output.length >= 3) {
      break;
    }
  }

  return output;
}

function negativeOutcomeCountInLast14Days(outcomes: ReadonlyArray<OutcomeLike>, nowIso: string): number {
  const nowTs = Date.parse(nowIso);
  if (!Number.isFinite(nowTs)) {
    return 0;
  }

  const minTs = nowTs - 14 * 24 * 60 * 60 * 1000;

  return outcomes.filter((outcome) => {
    const status = norm(outcome.outcome ?? "");
    const isNegative = status === "abandoned" || status === "ignored" || status === "failed" || status === "canceled" || status === "cancelled";
    if (!isNegative) {
      return false;
    }

    const ts = toMillis(outcome.occurredAt) ?? toMillis(outcome.createdAt);
    if (typeof ts !== "number") {
      return false;
    }

    return ts >= minTs;
  }).length;
}

export function generateStrategicMoves(args: {
  workspaceId: string;
  nowIso: string;
  artifacts: StrategicArtifact[];
  alignment: StrategicAlignmentResult;
  recentActions: ActionLike[];
  outcomes: OutcomeLike[];
}): Omit<StrategicMove, "id">[] {
  const nowIso = typeof args.nowIso === "string" && Number.isFinite(Date.parse(args.nowIso))
    ? new Date(args.nowIso).toISOString()
    : "1970-01-01T00:00:00.000Z";
  const weekKey = getIsoWeekKey(nowIso);

  const sortedArtifacts = sortArtifacts(Array.isArray(args.artifacts) ? args.artifacts : []);
  const sortedActions = sortByDateDescIfPresent(args.recentActions ?? [], (entry) => entry.createdAt);
  const sortedOutcomes = sortByDateDescIfPresent(args.outcomes ?? [], (entry) => entry.createdAt ?? entry.occurredAt);

  const activeArtifacts = sortedArtifacts.filter((artifact) => artifact.status === "active");
  const priority = pickTopPriority({ artifacts: sortedArtifacts, alignment: args.alignment });

  const negativeOutcomes = negativeOutcomeCountInLast14Days(sortedOutcomes, nowIso);
  const recoveryMode = args.alignment.driftDetected || args.alignment.alignmentScore < 60 || negativeOutcomes >= 2;

  const focusActions = priority
    ? [
        {
          title: "Pick 5 items that directly ship this priority",
          kind: "content" as const,
          reason: "Concentrates execution on the declared strategic objective.",
        },
        {
          title: "Assign owner + weekly checkpoint",
          kind: "workflow" as const,
          reason: "Clarifies accountability and cadence.",
        },
        {
          title: "Set a WIP limit for non-priority work",
          kind: "ops" as const,
          reason: "Prevents execution fragmentation.",
        },
      ]
    : [
        {
          title: "Write the priority in one sentence",
          kind: "ops" as const,
          reason: "Creates a single weekly direction.",
        },
        {
          title: "Define one success metric",
          kind: "quality" as const,
          reason: "Makes progress measurable.",
        },
        {
          title: "Assign an owner",
          kind: "workflow" as const,
          reason: "Establishes clear responsibility.",
        },
      ];

  const focusMoveBase: MoveWithoutId = {
    workspaceId: args.workspaceId,
    weekKey,
    kind: "focus",
    title: priority ? `Focus on: ${priority.title}` : "Define one strategic priority for the next 7 days",
    why: priority
      ? (priority.intent || "Concentrating execution on one priority increases throughput and measurable impact.")
      : "Without a clear focus, execution fragments and impact drops.",
    linkedArtifacts: priority ? [toArtifactLink(priority)] : [],
    successMetric: priority?.successMetric ?? "Define a success metric for this priority (one number, one deadline).",
    effort: "M",
    risk: "medium",
    expectedImpact: {
      healthScoreDelta: 3,
      confidence: "low",
      rationale: "",
    },
    recommendedActions: focusActions,
    createdAt: nowIso,
    diagnostics: {
      alignmentScore: clamp(args.alignment.alignmentScore, 0, 100),
      driftDetected: args.alignment.driftDetected,
      inputs: {
        artifacts: sortedArtifacts.length,
        actions: sortedActions.length,
        outcomes: sortedOutcomes.length,
      },
      notes: ["move:focus"],
    },
  };

  const driftLink = activeArtifacts.find((artifact) => artifact.type === "hypothesis" || artifact.type === "experiment") ?? null;
  const stabilityMoveBase: MoveWithoutId = {
    workspaceId: args.workspaceId,
    weekKey,
    kind: "stability",
    title: recoveryMode
      ? "Stabilize execution: close open loops and reduce WIP"
      : "Keep the system clean: maintain approval and publishing hygiene",
    why: recoveryMode
      ? "Drift is usually a workflow issue: open loops, unclear ownership, and scattered work."
      : "Clean workflow prevents hidden delays and protects cadence.",
    linkedArtifacts: driftLink ? [toArtifactLink(driftLink)] : [],
    successMetric: recoveryMode
      ? "Reduce open loops by 50% and enforce a 24–48h decision SLA."
      : "No item stays blocked longer than 48h.",
    effort: "M",
    risk: "medium",
    expectedImpact: {
      healthScoreDelta: 3,
      confidence: "low",
      rationale: "",
    },
    recommendedActions: [
      {
        title: "Review approvals: approve/reject within SLA",
        kind: "workflow",
        reason: "Reduces decision latency.",
      },
      {
        title: "Archive or re-scope stalled items",
        kind: "ops",
        reason: "Removes backlog drag.",
      },
      {
        title: "Set explicit WIP limit for each stage",
        kind: "workflow",
        reason: "Prevents queue overload.",
      },
    ],
    createdAt: nowIso,
    diagnostics: {
      alignmentScore: clamp(args.alignment.alignmentScore, 0, 100),
      driftDetected: args.alignment.driftDetected,
      inputs: {
        artifacts: sortedArtifacts.length,
        actions: sortedActions.length,
        outcomes: sortedOutcomes.length,
      },
      notes: recoveryMode ? ["move:stability", "mode:recovery"] : ["move:stability", "mode:hygiene"],
    },
  };

  const experimentOrHypothesis = activeArtifacts.find((artifact) => artifact.type === "experiment" || artifact.type === "hypothesis") ?? null;
  const optimizationActions = args.alignment.alignmentScore > 80
    ? [
        {
          title: "Run one optimization experiment on the highest-traffic asset",
          kind: "quality" as const,
          reason: "Compounds gains on proven traffic.",
        },
        {
          title: "Tighten copy/CTA on top-performing content",
          kind: "content" as const,
          reason: "Improves conversion efficiency.",
        },
      ]
    : [
        {
          title: "Define hypothesis + metric + stop condition",
          kind: "quality" as const,
          reason: "Creates controlled learning.",
        },
        {
          title: "Ship the experiment to a small audience first",
          kind: "calendar" as const,
          reason: "Limits downside and improves signal quality.",
        },
      ];

  const optimizationMoveBase: MoveWithoutId = {
    workspaceId: args.workspaceId,
    weekKey,
    kind: "optimization",
    title: args.alignment.alignmentScore > 80
      ? "Optimize leverage: improve conversion where it matters most"
      : "Run one controlled experiment with a clear hypothesis",
    why: args.alignment.alignmentScore > 80
      ? "When alignment is strong, small optimizations compound."
      : "Experiments turn uncertainty into learning and strategic clarity.",
    linkedArtifacts: uniqueLinkedArtifacts(
      experimentOrHypothesis
        ? [experimentOrHypothesis]
        : priority
          ? [priority]
          : [],
    ),
    successMetric: args.alignment.alignmentScore > 80
      ? "Improve one key metric by 5–10% (CTR, conversion, retention)."
      : "One hypothesis tested with a measurable outcome.",
    effort: "M",
    risk: "medium",
    expectedImpact: {
      healthScoreDelta: 3,
      confidence: "low",
      rationale: "",
    },
    recommendedActions: optimizationActions,
    createdAt: nowIso,
    diagnostics: {
      alignmentScore: clamp(args.alignment.alignmentScore, 0, 100),
      driftDetected: args.alignment.driftDetected,
      inputs: {
        artifacts: sortedArtifacts.length,
        actions: sortedActions.length,
        outcomes: sortedOutcomes.length,
      },
      notes: args.alignment.alignmentScore > 80 ? ["move:optimization", "mode:leverage"] : ["move:optimization", "mode:experiment"],
    },
  };

  const bases = [focusMoveBase, stabilityMoveBase, optimizationMoveBase] as const;

  return bases.map((move) => {
    const risk = deriveRisk({
      driftDetected: args.alignment.driftDetected,
      alignmentScore: args.alignment.alignmentScore,
      negativeOutcomes,
    });

    const effort = deriveEffort({
      driftDetected: args.alignment.driftDetected,
      alignmentScore: args.alignment.alignmentScore,
      actions: move.recommendedActions,
    });

    const expectedImpact = deriveImpact({
      kind: move.kind,
      alignment: args.alignment,
      actionsCount: sortedActions.length,
      negativeOutcomes,
    });

    return {
      ...move,
      risk,
      effort,
      expectedImpact,
    };
  });
}
