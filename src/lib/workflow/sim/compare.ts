import { computeAttribution } from "./attribution";
import { buildPolicyGraph } from "./graph";
import { compileKnobs } from "./knobs";
import { projectGlobal } from "./project";
import { computeResistance, computeStageWipPressure } from "./resistance";
import { applyKnobs, buildBaselineState } from "./state";
import type { SimDelta, SimInput, SimResult, StageProjection } from "./types";

function safeDelta(projected?: number, baseline?: number): number {
  if (typeof projected !== "number" || typeof baseline !== "number" || !Number.isFinite(projected) || !Number.isFinite(baseline)) {
    return 0;
  }
  return projected - baseline;
}

function sanitizeProjection(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function makeFallback(input: SimInput): SimResult {
  return {
    scenarioId: input.scenario.id,
    scenarioName: input.scenario.name,
    horizonDays: Math.max(7, Math.min(60, Math.round(input.scenario.horizon?.days ?? 14))),
    baseline: {},
    projected: {},
    delta: {
      throughputPerWeekDelta: 0,
      leadAvgHoursDelta: 0,
      cycleAvgHoursDelta: 0,
      bottleneckIndexDelta: 0,
      predictivePressureDelta: 0,
      predictiveCriticalCountDelta: 0,
      etaP50DaysDelta: 0,
      etaP90DaysDelta: 0,
    },
    stages: [],
    attribution: [],
    notes: ["Simulation fallback applied due to invalid internal state."],
  };
}

function runSimulationCore(input: SimInput, includeAttribution: boolean): SimResult {
  const graph = buildPolicyGraph(input.policy);
  const compiled = compileKnobs({
    policy: input.policy,
    scenario: input.scenario,
  });

  const baselineState = buildBaselineState(input, graph);
  const scenarioState = applyKnobs(baselineState, compiled);

  const baselineResistance = computeResistance({
    graph,
    state: baselineState,
    signals: input.workflowSignals,
  });
  const scenarioResistance = computeResistance({
    graph,
    state: scenarioState,
    signals: input.workflowSignals,
  });

  const baselineProjection = projectGlobal({
    graph,
    state: baselineState,
    resistance: baselineResistance.resistance,
    effectiveCapacity: baselineResistance.effectiveCapacity,
    policy: input.policy,
  });
  const projectedProjection = projectGlobal({
    graph,
    state: scenarioState,
    resistance: scenarioResistance.resistance,
    effectiveCapacity: scenarioResistance.effectiveCapacity,
    policy: input.policy,
  });

  const stages: StageProjection[] = graph.stages.map((stageId) => {
    const baselineCount = baselineState.byStageCount[stageId] ?? 0;
    const projectedCount = scenarioState.byStageCount[stageId] ?? 0;

    const baselineWipPressure = computeStageWipPressure({
      count: baselineCount,
      limit: baselineState.wipLimit[stageId],
    });
    const projectedWipPressure = computeStageWipPressure({
      count: projectedCount,
      limit: scenarioState.wipLimit[stageId],
    });

    const baselineEffectiveCapacity = baselineResistance.effectiveCapacity[stageId] ?? 1;
    const projectedEffectiveCapacity = scenarioResistance.effectiveCapacity[stageId] ?? 1;

    return {
      stageId,
      baseline: {
        count: baselineCount,
        wipLimit: baselineState.wipLimit[stageId],
        wipPressure: baselineWipPressure,
        capacity: baselineState.capacity[stageId] ?? 1,
        resistance: baselineResistance.resistance[stageId] ?? 0,
        effectiveCapacity: baselineEffectiveCapacity,
      },
      projected: {
        count: projectedCount,
        wipLimit: scenarioState.wipLimit[stageId],
        wipPressure: projectedWipPressure,
        capacity: scenarioState.capacity[stageId] ?? 1,
        resistance: scenarioResistance.resistance[stageId] ?? 0,
        effectiveCapacity: projectedEffectiveCapacity,
      },
      delta: {
        countDelta: projectedCount - baselineCount,
        wipPressureDelta: projectedWipPressure - baselineWipPressure,
        effectiveCapacityDelta: projectedEffectiveCapacity - baselineEffectiveCapacity,
      },
    };
  });

  const delta: SimDelta = {
    throughputPerWeekDelta: safeDelta(projectedProjection.throughputPerWeek, baselineProjection.throughputPerWeek),
    leadAvgHoursDelta: safeDelta(projectedProjection.leadAvgHours, baselineProjection.leadAvgHours),
    cycleAvgHoursDelta: safeDelta(projectedProjection.cycleAvgHours, baselineProjection.cycleAvgHours),
    bottleneckIndexDelta: safeDelta(projectedProjection.bottleneckIndex, baselineProjection.bottleneckIndex),
    predictivePressureDelta: safeDelta(projectedProjection.predictivePressure, baselineProjection.predictivePressure),
    predictiveCriticalCountDelta: safeDelta(projectedProjection.predictiveCriticalCount, baselineProjection.predictiveCriticalCount),
    etaP50DaysDelta: safeDelta(projectedProjection.etaP50Days, baselineProjection.etaP50Days),
    etaP90DaysDelta: safeDelta(projectedProjection.etaP90Days, baselineProjection.etaP90Days),
  };

  const notes: string[] = [];
  if (baselineProjection.bottleneckStage && projectedProjection.bottleneckStage && baselineProjection.bottleneckStage !== projectedProjection.bottleneckStage) {
    notes.push(`Bottleneck shifted from ${baselineProjection.bottleneckStage} to ${projectedProjection.bottleneckStage}.`);
  }
  if (input.scenario.knobs.some((knob) => knob.kind === "outage")) {
    notes.push("Scenario includes outage effects that reduce effective capacity over horizon.");
  }
  if (input.scenario.knobs.some((knob) => knob.kind === "influx")) {
    notes.push("Scenario includes influx shocks that increase stage queue load.");
  }

  const result: SimResult = {
    scenarioId: input.scenario.id,
    scenarioName: input.scenario.name,
    horizonDays: scenarioState.horizonDays,
    baseline: {
      throughputPerWeek: sanitizeProjection(baselineProjection.throughputPerWeek),
      leadAvgHours: sanitizeProjection(baselineProjection.leadAvgHours),
      cycleAvgHours: sanitizeProjection(baselineProjection.cycleAvgHours),
      bottleneckIndex: sanitizeProjection(baselineProjection.bottleneckIndex),
      predictivePressure: sanitizeProjection(baselineProjection.predictivePressure),
      predictiveCriticalCount: sanitizeProjection(baselineProjection.predictiveCriticalCount),
      etaP50Days: sanitizeProjection(baselineProjection.etaP50Days),
      etaP90Days: sanitizeProjection(baselineProjection.etaP90Days),
    },
    projected: {
      throughputPerWeek: sanitizeProjection(projectedProjection.throughputPerWeek),
      leadAvgHours: sanitizeProjection(projectedProjection.leadAvgHours),
      cycleAvgHours: sanitizeProjection(projectedProjection.cycleAvgHours),
      bottleneckIndex: sanitizeProjection(projectedProjection.bottleneckIndex),
      predictivePressure: sanitizeProjection(projectedProjection.predictivePressure),
      predictiveCriticalCount: sanitizeProjection(projectedProjection.predictiveCriticalCount),
      etaP50Days: sanitizeProjection(projectedProjection.etaP50Days),
      etaP90Days: sanitizeProjection(projectedProjection.etaP90Days),
    },
    delta,
    stages,
    attribution: [],
    notes: notes.slice(0, 3),
  };

  if (!includeAttribution) {
    return result;
  }

  const attribution = computeAttribution({
    input,
    run: (childInput) => runSimulationCore(childInput, false),
  });

  return {
    ...result,
    attribution,
  };
}

export function runSimulation(input: SimInput): SimResult {
  try {
    return runSimulationCore(input, true);
  } catch {
    return makeFallback(input);
  }
}
