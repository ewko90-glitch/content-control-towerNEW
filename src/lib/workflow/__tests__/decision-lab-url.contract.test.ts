import { describe, expect, it } from "vitest";

import type { DecisionLabKnobOverrides } from "../../../components/decision-lab/decision-lab-state";
import {
  decodeDecisionLabState,
  decodeDecisionLabUrlState,
  encodeDecisionLabState,
} from "../../../components/decision-lab/decision-lab-url";

type EncodedPayload = {
  presetId: string;
  knobsOverrides: DecisionLabKnobOverrides;
};

const minimalState: EncodedPayload = {
  presetId: "cap_up_bottleneck_20",
  knobsOverrides: {
    capacityAdjustPct: 0,
    wipAdjust: 0,
    influxAdd: 0,
    outageDays: 0,
  },
};

const overridesState: EncodedPayload = {
  presetId: "cap_up_bottleneck_20",
  knobsOverrides: {
    capacityAdjustPct: 20,
    wipAdjust: 1,
    influxAdd: 10,
    outageDays: 3,
  },
};

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

describe("decision-lab-url contract", () => {
  it("loads decision-lab-url exports", () => {
    expect(typeof encodeDecisionLabState).toBe("function");
  });

  it("round-trips minimal state", () => {
    const encoded = encodeDecisionLabState(minimalState);
    const decoded = decodeDecisionLabState(encoded);

    expect(decoded).toEqual(minimalState);
  });

  it("round-trips state with overrides", () => {
    const encoded = encodeDecisionLabState(overridesState);
    const decoded = decodeDecisionLabState(encoded);

    expect(decoded).toEqual(overridesState);
  });

  it("is deterministic for repeated encoding", () => {
    const first = encodeDecisionLabState(overridesState);
    const second = encodeDecisionLabState(overridesState);
    const third = encodeDecisionLabState(overridesState);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("canonicalizes equivalent inputs with different insertion order", () => {
    const first: EncodedPayload = {
      presetId: "cap_up_bottleneck_20",
      knobsOverrides: {
        capacityAdjustPct: 20,
        wipAdjust: 1,
        influxAdd: 10,
        outageDays: 3,
      },
    };

    const second: EncodedPayload = {
      knobsOverrides: {
        outageDays: 3,
        influxAdd: 10,
        wipAdjust: 1,
        capacityAdjustPct: 20,
      },
      presetId: "cap_up_bottleneck_20",
    };

    expect(encodeDecisionLabState(first)).toBe(encodeDecisionLabState(second));
  });

  it("returns null for invalid payload inputs", () => {
    const nonJson = toBase64Url("not-json");
    const wrongTypes = toBase64Url(
      JSON.stringify({
        presetId: 123,
        knobsOverrides: {
          capacityAdjustPct: 0,
          wipAdjust: 0,
          influxAdd: 0,
          outageDays: 0,
        },
      }),
    );
    const missingRequired = toBase64Url(JSON.stringify({ presetId: "cap_up_bottleneck_20" }));

    expect(decodeDecisionLabState("")).toBeNull();
    expect(decodeDecisionLabState("not_base64url!*")).toBeNull();
    expect(decodeDecisionLabState(nonJson)).toBeNull();
    expect(decodeDecisionLabState(wrongTypes)).toBeNull();
    expect(decodeDecisionLabState(missingRequired)).toBeNull();
  });

  it("returns null for unknown top-level keys", () => {
    const withUnknownKey = toBase64Url(
      JSON.stringify({
        presetId: "cap_up_bottleneck_20",
        knobsOverrides: {
          capacityAdjustPct: 0,
          wipAdjust: 0,
          influxAdd: 0,
          outageDays: 0,
        },
        extra: true,
      }),
    );

    expect(decodeDecisionLabState(withUnknownKey)).toBeNull();
  });

  it("returns null for oversized encoded payload", () => {
    const oversized = "a".repeat(1201);

    expect(decodeDecisionLabState(oversized)).toBeNull();
  });

  it("parses dlRun safely", () => {
    const valid = decodeDecisionLabUrlState(new URLSearchParams("dlRun=run_abc-123"));
    const empty = decodeDecisionLabUrlState(new URLSearchParams("dlRun="));
    const invalidChars = decodeDecisionLabUrlState(new URLSearchParams("dlRun=run!bad"));
    const tooLong = decodeDecisionLabUrlState(new URLSearchParams(`dlRun=${"r".repeat(121)}`));

    expect(valid.runId).toBe("run_abc-123");
    expect(empty.runId).toBeUndefined();
    expect(invalidChars.runId).toBeUndefined();
    expect(tooLong.runId).toBeUndefined();
  });
});
