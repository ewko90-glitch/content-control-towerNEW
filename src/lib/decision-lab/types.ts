import type { SimResult, WorkflowStageId } from "@/lib/workflow";

import { DL_ENGINE_VERSION, DL_MAX_ENCODED, DL_MAX_INPUT_BYTES, DL_MAX_RESULT_BYTES, DL_SCHEMA_VERSION } from "./constants";
import type { SanitizedSimResult } from "./sanitize";

export const DecisionLabSchemaVersion = DL_SCHEMA_VERSION;
export const DecisionLabEngineVersion = DL_ENGINE_VERSION;
export const DecisionLabMaxEncoded = DL_MAX_ENCODED;
export const DecisionLabMaxInputBytes = DL_MAX_INPUT_BYTES;
export const DecisionLabMaxResultBytes = DL_MAX_RESULT_BYTES;

export type DecisionLabVisibilityValue = "PRIVATE" | "WORKSPACE";

export type ScenarioKnob =
  | { kind: "capacity"; stageId?: string; multiplier: number }
  | { kind: "wipLimit"; stageId: string; limit: number }
  | { kind: "influx"; stageId: string; addCount: number }
  | { kind: "outage"; stageId: string; days: number; multiplier: number };

export type DecisionLabInputSummary = {
  byStageCount: Partial<Record<WorkflowStageId, number>>;
  flags: {
    hasSignals: boolean;
    hasMetrics: boolean;
    hasPredict: boolean;
  };
};

export type ScenarioCreateDTO = {
  name: string;
  description?: string;
  visibility: DecisionLabVisibilityValue;
  horizonDays: number;
  knobs: ScenarioKnob[];
};

export type ScenarioUpdateDTO = {
  name?: string;
  description?: string;
  visibility?: DecisionLabVisibilityValue;
  horizonDays?: number;
  knobs?: ScenarioKnob[];
};

export type RunCreateDTO = {
  scenarioId?: string;
  scenarioNameSnapshot: string;
  horizonDays: number;
  inputSummary: DecisionLabInputSummary;
  result: SimResult;
};

export type ScenarioListItem = {
  id: string;
  name: string;
  description?: string;
  visibility: DecisionLabVisibilityValue;
  horizonDays: number;
  knobs: ScenarioKnob[];
  runCount: number;
  lastRunAt?: string;
  updatedAt: string;
  createdAt: string;
  createdByUserId: string;
};

export type RunListItem = {
  id: string;
  scenarioId?: string;
  scenarioNameSnapshot: string;
  schemaVersion: string;
  engineVersion: string;
  horizonDays: number;
  inputSummary: DecisionLabInputSummary;
  result: SanitizedSimResult;
  createdByUserId: string;
  createdAt: string;
};

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: string;
  details?: string[];
};

export type ApiResponse<T> = ApiOk<T> | ApiError;
