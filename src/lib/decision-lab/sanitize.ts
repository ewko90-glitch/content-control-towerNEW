import type { SimResult } from "@/lib/workflow";

export type SanitizedSimResult = SimResult;

function finite(input: number | undefined, fallback = 0): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return fallback;
  }
  return input;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function nonNegative(input: number | undefined): number {
  return Math.max(0, finite(input));
}

function pressure(input: number | undefined): number {
  return clamp(finite(input), 0, 100);
}

function sanitizeSummary(input: SimResult["baseline"]): SimResult["baseline"] {
  return {
    throughputPerWeek: nonNegative(input.throughputPerWeek),
    leadAvgHours: nonNegative(input.leadAvgHours),
    cycleAvgHours: nonNegative(input.cycleAvgHours),
    bottleneckIndex: pressure(input.bottleneckIndex),
    predictivePressure: pressure(input.predictivePressure),
    predictiveCriticalCount: nonNegative(input.predictiveCriticalCount),
    etaP50Days: nonNegative(input.etaP50Days),
    etaP90Days: nonNegative(input.etaP90Days),
  };
}

export function sanitizeSimResult(raw: SimResult): SanitizedSimResult {
  const stages = raw.stages.slice(0, 8).map((stage) => ({
    stageId: stage.stageId,
    baseline: {
      count: nonNegative(stage.baseline.count),
      wipLimit: typeof stage.baseline.wipLimit === "number" ? nonNegative(stage.baseline.wipLimit) : undefined,
      wipPressure: pressure(stage.baseline.wipPressure),
      capacity: nonNegative(stage.baseline.capacity),
      resistance: nonNegative(stage.baseline.resistance),
      effectiveCapacity: nonNegative(stage.baseline.effectiveCapacity),
    },
    projected: {
      count: nonNegative(stage.projected.count),
      wipLimit: typeof stage.projected.wipLimit === "number" ? nonNegative(stage.projected.wipLimit) : undefined,
      wipPressure: pressure(stage.projected.wipPressure),
      capacity: nonNegative(stage.projected.capacity),
      resistance: nonNegative(stage.projected.resistance),
      effectiveCapacity: nonNegative(stage.projected.effectiveCapacity),
    },
    delta: {
      countDelta: finite(stage.delta.countDelta),
      wipPressureDelta: finite(stage.delta.wipPressureDelta),
      effectiveCapacityDelta: finite(stage.delta.effectiveCapacityDelta),
    },
  }));

  const attribution = raw.attribution.slice(0, 3).map((entry) => ({
    driver: entry.driver,
    stageId: entry.stageId,
    impactScore: finite(entry.impactScore),
    metrics: {
      throughputPerWeekDelta: finite(entry.metrics.throughputPerWeekDelta),
      leadAvgHoursDelta: finite(entry.metrics.leadAvgHoursDelta),
      cycleAvgHoursDelta: finite(entry.metrics.cycleAvgHoursDelta),
      bottleneckIndexDelta: finite(entry.metrics.bottleneckIndexDelta),
      predictivePressureDelta: finite(entry.metrics.predictivePressureDelta),
      predictiveCriticalCountDelta: finite(entry.metrics.predictiveCriticalCountDelta),
      etaP50DaysDelta: finite(entry.metrics.etaP50DaysDelta),
      etaP90DaysDelta: finite(entry.metrics.etaP90DaysDelta),
    },
    note: entry.note.slice(0, 240),
  }));

  return {
    scenarioId: raw.scenarioId,
    scenarioName: raw.scenarioName,
    horizonDays: nonNegative(raw.horizonDays),
    baseline: sanitizeSummary(raw.baseline),
    projected: sanitizeSummary(raw.projected),
    delta: {
      throughputPerWeekDelta: finite(raw.delta.throughputPerWeekDelta),
      leadAvgHoursDelta: finite(raw.delta.leadAvgHoursDelta),
      cycleAvgHoursDelta: finite(raw.delta.cycleAvgHoursDelta),
      bottleneckIndexDelta: finite(raw.delta.bottleneckIndexDelta),
      predictivePressureDelta: finite(raw.delta.predictivePressureDelta),
      predictiveCriticalCountDelta: finite(raw.delta.predictiveCriticalCountDelta),
      etaP50DaysDelta: typeof raw.delta.etaP50DaysDelta === "number" ? nonNegative(raw.delta.etaP50DaysDelta) : undefined,
      etaP90DaysDelta: typeof raw.delta.etaP90DaysDelta === "number" ? nonNegative(raw.delta.etaP90DaysDelta) : undefined,
    },
    stages,
    attribution,
    notes: raw.notes.filter((entry) => typeof entry === "string").slice(0, 3),
  };
}