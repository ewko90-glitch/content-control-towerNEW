import type { DecisionEntry, MetricSnapshot } from "@/components/decision-timeline/decision-types";
import { clamp } from "./impact-utils";
import type { ImpactEvaluation, ImpactMetricDelta, ImpactWindow } from "./impact-types";

const THRESHOLDS = {
  throughput: 0.25,
  leadTime: 2,
  risk: 3,
} as const;

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return 0;
  }
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function metricCount(snapshot: MetricSnapshot | undefined): number {
  if (!snapshot) {
    return 0;
  }

  let count = 0;
  if (typeof snapshot.throughputPerWeek === "number") count += 1;
  if (typeof snapshot.leadAvgHours === "number") count += 1;
  if (typeof snapshot.predictivePressure === "number") count += 1;
  return count;
}

function buildDelta(improvement: number | undefined, baselineRaw: number | undefined, threshold: number): ImpactMetricDelta {
  if (typeof improvement !== "number" || Number.isNaN(improvement) || !Number.isFinite(improvement)) {
    return {
      value: undefined,
      pct: undefined,
      direction: "unknown",
    };
  }

  let direction: ImpactMetricDelta["direction"] = "neutral";
  if (improvement > threshold) {
    direction = "better";
  } else if (improvement < -threshold) {
    direction = "worse";
  }

  const pct =
    typeof baselineRaw === "number" && baselineRaw !== 0
      ? (improvement / Math.abs(baselineRaw)) * 100
      : undefined;

  return {
    value: improvement,
    pct,
    direction,
  };
}

function consistencyBoost(directions: Array<ImpactMetricDelta["direction"]>): number {
  const better = directions.filter((entry) => entry === "better").length;
  const worse = directions.filter((entry) => entry === "worse").length;
  if (better >= 2 || worse >= 2) {
    return 1;
  }
  return 0;
}

function determineStatus(directions: Array<ImpactMetricDelta["direction"]>): ImpactEvaluation["status"] {
  const better = directions.filter((entry) => entry === "better").length;
  const worse = directions.filter((entry) => entry === "worse").length;

  if (better >= 2 && worse === 0) {
    return "improving";
  }

  if (worse >= 1 && better < 2) {
    return "worsening";
  }

  return "neutral";
}

function strongestSignalLabel(deltas: ImpactEvaluation["deltas"]): string {
  const entries: Array<{ name: string; value: number }> = [];
  if (typeof deltas.throughput.value === "number") {
    entries.push({ name: "throughput", value: Math.abs(deltas.throughput.value) });
  }
  if (typeof deltas.leadTime.value === "number") {
    entries.push({ name: "lead time", value: Math.abs(deltas.leadTime.value) });
  }
  if (typeof deltas.risk.value === "number") {
    entries.push({ name: "risk", value: Math.abs(deltas.risk.value) });
  }

  if (entries.length === 0) {
    return "brak";
  }

  const sorted = entries.sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));
  return sorted[0].name;
}

export function evaluateImpact(params: {
  decision: DecisionEntry;
  current: MetricSnapshot;
  nowIso: string;
  window: ImpactWindow;
}): ImpactEvaluation {
  const insufficient = (): ImpactEvaluation => ({
    decisionId: params.decision.id,
    evaluatedAt: params.nowIso,
    window: params.window,
    status: "insufficient_data",
    confidence: 0.2,
    deltas: {
      throughput: { direction: "unknown" },
      leadTime: { direction: "unknown" },
      risk: { direction: "unknown" },
    },
    notes: [
      `Ocena po ${params.window} dniach od wdrożenia.`,
      "Wynik ma umiarkowaną pewność (brak pełnych danych).",
    ],
  });

  if (params.decision.status !== "adopted" || !params.decision.adoptedAt || !params.decision.baseline) {
    return insufficient();
  }

  const daysSinceAdopt = daysBetween(params.decision.adoptedAt, params.nowIso);
  if (daysSinceAdopt < params.window) {
    return insufficient();
  }

  const baselineMetricCount = metricCount(params.decision.baseline);
  const currentMetricCount = metricCount(params.current);
  if (baselineMetricCount < 2 || currentMetricCount < 2) {
    return insufficient();
  }

  const throughputImprovement =
    typeof params.current.throughputPerWeek === "number" && typeof params.decision.baseline.throughputPerWeek === "number"
      ? params.current.throughputPerWeek - params.decision.baseline.throughputPerWeek
      : undefined;

  const leadTimeImprovement =
    typeof params.current.leadAvgHours === "number" && typeof params.decision.baseline.leadAvgHours === "number"
      ? params.decision.baseline.leadAvgHours - params.current.leadAvgHours
      : undefined;

  const riskImprovement =
    typeof params.current.predictivePressure === "number" && typeof params.decision.baseline.predictivePressure === "number"
      ? params.decision.baseline.predictivePressure - params.current.predictivePressure
      : undefined;

  const deltas: ImpactEvaluation["deltas"] = {
    throughput: buildDelta(throughputImprovement, params.decision.baseline.throughputPerWeek, THRESHOLDS.throughput),
    leadTime: buildDelta(leadTimeImprovement, params.decision.baseline.leadAvgHours, THRESHOLDS.leadTime),
    risk: buildDelta(riskImprovement, params.decision.baseline.predictivePressure, THRESHOLDS.risk),
  };

  const directions = [deltas.throughput.direction, deltas.leadTime.direction, deltas.risk.direction];
  const validMetrics = directions.filter((entry) => entry !== "unknown").length;
  const metricCoverage = validMetrics / 3;
  const timeFactor = Math.min(1, daysSinceAdopt / 14);
  const consistency = consistencyBoost(directions);

  const confidence = clamp(0.25 + 0.35 * metricCoverage + 0.25 * timeFactor + 0.15 * consistency, 0.2, 0.95);
  const status = determineStatus(directions);

  const notes: string[] = [
    `Ocena po ${params.window} dniach od wdrożenia.`,
    confidence < 0.6 ? "Wynik ma umiarkowaną pewność (brak pełnych danych)." : "Wynik ma stabilną pewność.",
    `Najsilniejszy sygnał: ${strongestSignalLabel(deltas)}.`,
  ];

  return {
    decisionId: params.decision.id,
    evaluatedAt: params.nowIso,
    window: params.window,
    status,
    confidence,
    deltas,
    notes: notes.slice(0, 3),
  };
}
