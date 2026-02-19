import { DL_MAX_INPUT_BYTES, DL_MAX_RESULT_BYTES } from "./constants";
import type { DecisionLabVisibilityValue, RunCreateDTO, ScenarioCreateDTO, ScenarioKnob, ScenarioUpdateDTO } from "./types";

type ValidationOk<T> = { ok: true; value: T };
type ValidationFail = { ok: false; errors: string[] };

type ValidationResult<T> = ValidationOk<T> | ValidationFail;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(input).every((key) => allowed.includes(key));
}

function isVisibility(input: unknown): input is DecisionLabVisibilityValue {
  return input === "PRIVATE" || input === "WORKSPACE";
}

function parseKnob(knob: unknown): { ok: true; value: ScenarioKnob } | { ok: false; error: string } {
  if (!isRecord(knob) || typeof knob.kind !== "string") {
    return { ok: false, error: "Invalid knob object" };
  }

  if (knob.kind === "capacity") {
    if (!hasOnlyKeys(knob, ["kind", "stageId", "multiplier"])) {
      return { ok: false, error: "Unknown capacity knob fields" };
    }
    if (typeof knob.multiplier !== "number" || knob.multiplier < 0.1 || knob.multiplier > 2) {
      return { ok: false, error: "capacity.multiplier must be 0.1..2" };
    }
    if (typeof knob.stageId !== "undefined" && typeof knob.stageId !== "string") {
      return { ok: false, error: "capacity.stageId must be string when provided" };
    }
    return {
      ok: true,
      value:
        typeof knob.stageId === "string"
          ? { kind: "capacity", stageId: knob.stageId, multiplier: knob.multiplier }
          : { kind: "capacity", multiplier: knob.multiplier },
    };
  }

  if (knob.kind === "wipLimit") {
    if (!hasOnlyKeys(knob, ["kind", "stageId", "limit"])) {
      return { ok: false, error: "Unknown wipLimit knob fields" };
    }
    if (typeof knob.stageId !== "string") {
      return { ok: false, error: "wipLimit.stageId is required" };
    }
    if (typeof knob.limit !== "number" || knob.limit < 0 || knob.limit > 50) {
      return { ok: false, error: "wipLimit.limit must be 0..50" };
    }
    return { ok: true, value: { kind: "wipLimit", stageId: knob.stageId, limit: Math.round(knob.limit) } };
  }

  if (knob.kind === "influx") {
    if (!hasOnlyKeys(knob, ["kind", "stageId", "addCount"])) {
      return { ok: false, error: "Unknown influx knob fields" };
    }
    if (typeof knob.stageId !== "string") {
      return { ok: false, error: "influx.stageId is required" };
    }
    if (typeof knob.addCount !== "number" || knob.addCount < 0 || knob.addCount > 200) {
      return { ok: false, error: "influx.addCount must be 0..200" };
    }
    return { ok: true, value: { kind: "influx", stageId: knob.stageId, addCount: Math.round(knob.addCount) } };
  }

  if (knob.kind === "outage") {
    if (!hasOnlyKeys(knob, ["kind", "stageId", "days", "multiplier"])) {
      return { ok: false, error: "Unknown outage knob fields" };
    }
    if (typeof knob.stageId !== "string") {
      return { ok: false, error: "outage.stageId is required" };
    }
    if (typeof knob.days !== "number" || knob.days < 0 || knob.days > 30) {
      return { ok: false, error: "outage.days must be 0..30" };
    }
    if (typeof knob.multiplier !== "number" || knob.multiplier < 0 || knob.multiplier > 2) {
      return { ok: false, error: "outage.multiplier must be 0..2" };
    }
    return {
      ok: true,
      value: {
        kind: "outage",
        stageId: knob.stageId,
        days: Math.round(knob.days),
        multiplier: knob.multiplier,
      },
    };
  }

  return { ok: false, error: "Unsupported knob kind" };
}

function parseKnobs(input: unknown): ValidationResult<ScenarioKnob[]> {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ["knobs must be an array"] };
  }
  if (input.length > 12) {
    return { ok: false, errors: ["knobs length must be <= 12"] };
  }

  const parsed: ScenarioKnob[] = [];
  const errors: string[] = [];

  for (const knob of input) {
    const next = parseKnob(knob);
    if (!next.ok) {
      errors.push(next.error);
      continue;
    }
    parsed.push(next.value);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: parsed };
}

function validateName(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const value = input.trim();
  if (value.length === 0 || value.length > 80) {
    return null;
  }
  return value;
}

function validateDescription(input: unknown): string | undefined | null {
  if (typeof input === "undefined") {
    return undefined;
  }
  if (input === null) {
    return undefined;
  }
  if (typeof input !== "string") {
    return null;
  }
  const value = input.trim();
  if (value.length > 160) {
    return null;
  }
  return value.length > 0 ? value : undefined;
}

function validateHorizon(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return null;
  }
  const rounded = Math.round(input);
  if (rounded < 7 || rounded > 60) {
    return null;
  }
  return rounded;
}

export function validateScenarioCreate(input: unknown): ValidationResult<ScenarioCreateDTO> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Invalid input"] };
  }
  if (!hasOnlyKeys(input, ["name", "description", "visibility", "horizonDays", "knobs"])) {
    return { ok: false, errors: ["Unknown fields in scenario create payload"] };
  }

  const errors: string[] = [];
  const name = validateName(input.name);
  if (!name) {
    errors.push("name length must be 1..80");
  }

  const description = validateDescription(input.description);
  if (description === null) {
    errors.push("description length must be <= 160");
  }

  if (!isVisibility(input.visibility)) {
    errors.push("visibility must be PRIVATE or WORKSPACE");
  }

  const horizonDays = validateHorizon(input.horizonDays);
  if (horizonDays === null) {
    errors.push("horizonDays must be 7..60");
  }

  const parsedKnobs = parseKnobs(input.knobs);
  if (!parsedKnobs.ok) {
    errors.push(...parsedKnobs.errors);
  }

  if (errors.length > 0 || !name || !isVisibility(input.visibility) || horizonDays === null || !parsedKnobs.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      description: description ?? undefined,
      visibility: input.visibility,
      horizonDays,
      knobs: parsedKnobs.value,
    },
  };
}

export function validateScenarioUpdate(input: unknown): ValidationResult<ScenarioUpdateDTO> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Invalid input"] };
  }
  if (!hasOnlyKeys(input, ["name", "description", "visibility", "horizonDays", "knobs"])) {
    return { ok: false, errors: ["Unknown fields in scenario update payload"] };
  }

  const errors: string[] = [];
  const value: ScenarioUpdateDTO = {};

  if ("name" in input) {
    const name = validateName(input.name);
    if (!name) {
      errors.push("name length must be 1..80");
    } else {
      value.name = name;
    }
  }

  if ("description" in input) {
    const description = validateDescription(input.description);
    if (description === null) {
      errors.push("description length must be <= 160");
    } else {
      value.description = description;
    }
  }

  if ("visibility" in input) {
    if (!isVisibility(input.visibility)) {
      errors.push("visibility must be PRIVATE or WORKSPACE");
    } else {
      value.visibility = input.visibility;
    }
  }

  if ("horizonDays" in input) {
    const horizonDays = validateHorizon(input.horizonDays);
    if (horizonDays === null) {
      errors.push("horizonDays must be 7..60");
    } else {
      value.horizonDays = horizonDays;
    }
  }

  if ("knobs" in input) {
    const parsedKnobs = parseKnobs(input.knobs);
    if (!parsedKnobs.ok) {
      errors.push(...parsedKnobs.errors);
    } else {
      value.knobs = parsedKnobs.value;
    }
  }

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push("No fields to update");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function validateRunCreate(input: unknown): ValidationResult<RunCreateDTO> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Invalid input"] };
  }

  if (
    !hasOnlyKeys(input, ["scenarioId", "scenarioNameSnapshot", "horizonDays", "inputSummary", "result"])
  ) {
    return { ok: false, errors: ["Unknown fields in run payload"] };
  }

  const errors: string[] = [];

  const scenarioId =
    typeof input.scenarioId === "string" && input.scenarioId.trim().length > 0 ? input.scenarioId.trim() : undefined;

  const scenarioNameSnapshot =
    typeof input.scenarioNameSnapshot === "string" ? input.scenarioNameSnapshot.trim() : "";
  if (scenarioNameSnapshot.length === 0 || scenarioNameSnapshot.length > 80) {
    errors.push("scenarioNameSnapshot length must be 1..80");
  }

  const horizonDays = validateHorizon(input.horizonDays);
  if (horizonDays === null) {
    errors.push("horizonDays must be 7..60");
  }

  if (!isRecord(input.inputSummary)) {
    errors.push("inputSummary must be an object");
  }

  if (!isRecord(input.result)) {
    errors.push("result must be an object");
  }

  if (isRecord(input.inputSummary)) {
    const bytes = Buffer.byteLength(JSON.stringify(input.inputSummary), "utf8");
    if (bytes > DL_MAX_INPUT_BYTES) {
      errors.push(`inputSummary must be <= ${DL_MAX_INPUT_BYTES} bytes`);
    }
  }

  if (isRecord(input.result)) {
    const bytes = Buffer.byteLength(JSON.stringify(input.result), "utf8");
    if (bytes > DL_MAX_RESULT_BYTES) {
      errors.push(`result must be <= ${DL_MAX_RESULT_BYTES} bytes`);
    }
  }

  if (errors.length > 0 || !isRecord(input.inputSummary) || !isRecord(input.result) || horizonDays === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      scenarioId,
      scenarioNameSnapshot,
      horizonDays,
      inputSummary: input.inputSummary as RunCreateDTO["inputSummary"],
      result: input.result as RunCreateDTO["result"],
    },
  };
}
