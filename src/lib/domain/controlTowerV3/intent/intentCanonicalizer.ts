import type { IntentType } from "../types";
import type { RawIntentParams } from "./intentSchema";

export type CanonicalIntentParams = {
  intent?: IntentType;
  source: "control_tower" | "external" | "unknown";
  filter?: string;
  stage?: string;
  overdue?: boolean;
  sinceDays?: number;
  ids?: string[];
};

const KNOWN_INTENTS: ReadonlySet<IntentType> = new Set<IntentType>([
  "fix_overdue_publications",
  "resolve_approval_bottleneck",
  "unblock_stuck_workflow",
  "fill_pipeline_gap",
  "schedule_next_7_days",
  "reduce_draft_backlog",
  "optimize_throughput",
  "review_risks",
]);

function normalizeSource(input: string | undefined): CanonicalIntentParams["source"] {
  if (input === "control_tower") {
    return "control_tower";
  }
  if (input === "external") {
    return "external";
  }
  return "unknown";
}

function normalizeIntent(input: string | undefined): IntentType | undefined {
  if (!input) {
    return undefined;
  }
  return KNOWN_INTENTS.has(input as IntentType) ? (input as IntentType) : undefined;
}

function normalizeBoolean(input: string | undefined): boolean | undefined {
  if (!input) {
    return undefined;
  }

  const value = input.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no") {
    return false;
  }
  return undefined;
}

function normalizeSinceDays(input: string | undefined): number | undefined {
  if (!input) {
    return undefined;
  }

  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.max(1, Math.min(365, parsed));
}

function normalizeIds(input: string | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const unique = new Set(
    input
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

  const ids = Array.from(unique).sort((a, b) => a.localeCompare(b)).slice(0, 50);
  return ids.length > 0 ? ids : undefined;
}

export function canonicalizeIntent(raw: RawIntentParams): CanonicalIntentParams {
  const canonical: CanonicalIntentParams = {
    source: normalizeSource(raw.source),
  };

  const intent = normalizeIntent(raw.intent);
  if (intent) {
    canonical.intent = intent;
  }

  if (raw.filter && raw.filter.trim().length > 0) {
    canonical.filter = raw.filter.trim();
  }

  if (raw.stage && raw.stage.trim().length > 0) {
    canonical.stage = raw.stage.trim().toUpperCase();
  }

  const overdue = normalizeBoolean(raw.overdue);
  if (typeof overdue === "boolean") {
    canonical.overdue = overdue;
  }

  const sinceDays = normalizeSinceDays(raw.sinceDays);
  if (typeof sinceDays === "number") {
    canonical.sinceDays = sinceDays;
  }

  const ids = normalizeIds(raw.ids);
  if (ids) {
    canonical.ids = ids;
  }

  return canonical;
}
