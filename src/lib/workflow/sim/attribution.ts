import type { Attribution, SimInput, SimResult } from "./types";

type Driver = Attribution["driver"];

function noteForDriver(driver: Driver): string {
  if (driver === "CAPACITY") {
    return "Capacity knobs dominate throughput and delay movement.";
  }
  if (driver === "WIP") {
    return "WIP limit shifts dominate pressure and queue behavior.";
  }
  if (driver === "INFLUX") {
    return "Influx shocks dominate bottleneck and pressure deltas.";
  }
  return "Outage windows dominate resilience and tail risk changes.";
}

function extractStageId(input: SimInput, driver: Driver): string | undefined {
  if (driver === "CAPACITY") {
    return input.scenario.knobs.find((knob) => knob.kind === "capacity" && typeof knob.stageId === "string")?.stageId;
  }
  if (driver === "WIP") {
    return input.scenario.knobs.find((knob) => knob.kind === "wipLimit")?.stageId;
  }
  if (driver === "INFLUX") {
    return input.scenario.knobs.find((knob) => knob.kind === "influx")?.stageId;
  }
  return input.scenario.knobs.find((knob) => knob.kind === "outage")?.stageId;
}

function impactFromDelta(delta: SimResult["delta"]): number {
  const weighted =
    Math.abs(delta.throughputPerWeekDelta) * 1.2 +
    Math.abs(delta.bottleneckIndexDelta) * 0.9 +
    Math.abs(delta.predictivePressureDelta) * 0.8 +
    Math.abs(delta.leadAvgHoursDelta) * 0.5;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export function computeAttribution(params: {
  input: SimInput;
  run: (input: SimInput) => SimResult;
}): Attribution[] {
  const baselineInput: SimInput = {
    ...params.input,
    scenario: {
      ...params.input.scenario,
      id: `${params.input.scenario.id}_baseline`,
      name: `${params.input.scenario.name} baseline`,
      knobs: [],
    },
  };

  const baseline = params.run(baselineInput);

  const groups: Array<{ driver: Driver; knobs: SimInput["scenario"]["knobs"] }> = [
    { driver: "CAPACITY", knobs: params.input.scenario.knobs.filter((knob) => knob.kind === "capacity") },
    { driver: "WIP", knobs: params.input.scenario.knobs.filter((knob) => knob.kind === "wipLimit") },
    { driver: "INFLUX", knobs: params.input.scenario.knobs.filter((knob) => knob.kind === "influx") },
    { driver: "OUTAGE", knobs: params.input.scenario.knobs.filter((knob) => knob.kind === "outage") },
  ];

  const attributions = groups
    .filter((group) => group.knobs.length > 0)
    .map((group) => {
      const result = params.run({
        ...params.input,
        scenario: {
          ...params.input.scenario,
          id: `${params.input.scenario.id}_${group.driver.toLowerCase()}`,
          name: `${params.input.scenario.name} ${group.driver}`,
          knobs: group.knobs,
        },
      });

      const delta = {
        throughputPerWeekDelta: result.delta.throughputPerWeekDelta - baseline.delta.throughputPerWeekDelta,
        leadAvgHoursDelta: result.delta.leadAvgHoursDelta - baseline.delta.leadAvgHoursDelta,
        cycleAvgHoursDelta: result.delta.cycleAvgHoursDelta - baseline.delta.cycleAvgHoursDelta,
        bottleneckIndexDelta: result.delta.bottleneckIndexDelta - baseline.delta.bottleneckIndexDelta,
        predictivePressureDelta: result.delta.predictivePressureDelta - baseline.delta.predictivePressureDelta,
        predictiveCriticalCountDelta: result.delta.predictiveCriticalCountDelta - baseline.delta.predictiveCriticalCountDelta,
      };

      return {
        driver: group.driver,
        stageId: extractStageId(params.input, group.driver),
        impactScore: impactFromDelta(delta),
        metrics: delta,
        note: noteForDriver(group.driver),
      } satisfies Attribution;
    })
    .sort((left, right) => {
      if (right.impactScore !== left.impactScore) {
        return right.impactScore - left.impactScore;
      }
      return left.driver.localeCompare(right.driver);
    })
    .slice(0, 3);

  return attributions;
}
