import type { DecisionLabKnobOverrides } from "./decision-lab-state";

type EncodedState = {
  presetId: string;
  knobsOverrides: DecisionLabKnobOverrides;
};

const MAX_ENCODED_STATE_LENGTH = 1200;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type DecisionLabUrlState = {
  encodedState?: string;
  runId?: string;
};

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOnlyKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(input);
  if (actualKeys.length !== keys.length) {
    return false;
  }
  return keys.every((key) => actualKeys.includes(key));
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function normalizeOverrides(input: DecisionLabKnobOverrides): DecisionLabKnobOverrides {
  return {
    capacityAdjustPct: input.capacityAdjustPct,
    wipAdjust: input.wipAdjust,
    influxAdd: input.influxAdd,
    outageDays: input.outageDays,
  };
}

export function encodeDecisionLabState(params: {
  presetId: string;
  knobsOverrides: DecisionLabKnobOverrides;
}): string {
  const payload: EncodedState = {
    presetId: params.presetId,
    knobsOverrides: normalizeOverrides(params.knobsOverrides),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeDecisionLabState(input: string): { presetId: string; knobsOverrides: DecisionLabKnobOverrides } | null {
  try {
    if (input.length === 0 || input.length > MAX_ENCODED_STATE_LENGTH || !BASE64URL_PATTERN.test(input)) {
      return null;
    }

    const parsed = JSON.parse(fromBase64Url(input)) as unknown;
    if (!isRecord(parsed) || !hasOnlyKeys(parsed, ["presetId", "knobsOverrides"])) {
      return null;
    }

    if (typeof parsed.presetId !== "string" || parsed.presetId.length === 0 || !isRecord(parsed.knobsOverrides)) {
      return null;
    }

    if (!hasOnlyKeys(parsed.knobsOverrides, ["capacityAdjustPct", "wipAdjust", "influxAdd", "outageDays"])) {
      return null;
    }

    const raw: EncodedState = {
      presetId: parsed.presetId,
      knobsOverrides: parsed.knobsOverrides as DecisionLabKnobOverrides,
    };

    const knobs = raw.knobsOverrides as Partial<DecisionLabKnobOverrides>;

    const capacityAdjustPct = knobs.capacityAdjustPct;
    const wipAdjust = knobs.wipAdjust;
    const influxAdd = knobs.influxAdd;
    const outageDays = knobs.outageDays;

    if (![ -20, 0, 10, 20 ].includes(capacityAdjustPct as number)) {
      return null;
    }
    if (![ -1, 0, 1 ].includes(wipAdjust as number)) {
      return null;
    }
    if (![ 0, 5, 10 ].includes(influxAdd as number)) {
      return null;
    }
    if (![ 0, 2, 3 ].includes(outageDays as number)) {
      return null;
    }

    return {
      presetId: raw.presetId,
      knobsOverrides: {
        capacityAdjustPct: capacityAdjustPct as DecisionLabKnobOverrides["capacityAdjustPct"],
        wipAdjust: wipAdjust as DecisionLabKnobOverrides["wipAdjust"],
        influxAdd: influxAdd as DecisionLabKnobOverrides["influxAdd"],
        outageDays: outageDays as DecisionLabKnobOverrides["outageDays"],
      },
    };
  } catch {
    return null;
  }
}

export function decodeDecisionLabUrlState(params: URLSearchParams): DecisionLabUrlState {
  const encodedState = params.get("dl") ?? undefined;
  const runCandidate = params.get("dlRun") ?? undefined;
  const runId =
    typeof runCandidate === "string" &&
    runCandidate.trim().length > 0 &&
    runCandidate.length <= 120 &&
    RUN_ID_PATTERN.test(runCandidate)
      ? runCandidate
      : undefined;

  return {
    encodedState,
    runId,
  };
}

export function applyDecisionLabUrlState(url: URL, state: DecisionLabUrlState): string {
  if (state.encodedState) {
    url.searchParams.set("dl", state.encodedState);
  } else {
    url.searchParams.delete("dl");
  }

  if (state.runId) {
    url.searchParams.set("dlRun", state.runId);
  } else {
    url.searchParams.delete("dlRun");
  }

  return url.toString();
}
