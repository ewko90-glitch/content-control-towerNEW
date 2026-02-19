import type { ControlTowerDecisionSnapshot } from "../snapshot";
import type { DecisionWarning, RiskDimensions } from "../types";

const FORBIDDEN_KEY_TOKENS = ["title", "body", "content", "text", "html", "description"];

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function looksSuspiciousString(input: string): boolean {
  return input.includes("\n") || input.length > 200;
}

function isForbiddenKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return FORBIDDEN_KEY_TOKENS.some((token) => normalized.includes(token));
}

function safeString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  if (looksSuspiciousString(input)) {
    return null;
  }
  return input;
}

function sanitizeDebug(snapshot: ControlTowerDecisionSnapshot): { debug: ControlTowerDecisionSnapshot["debug"]; stripped: boolean } {
  const rawDebug = snapshot.debug;
  if (!rawDebug || !isPlainObject(rawDebug)) {
    return { debug: undefined, stripped: false };
  }

  let stripped = false;
  const sanitizedDebug: NonNullable<ControlTowerDecisionSnapshot["debug"]> = {};

  const rawKeys = Object.keys(rawDebug);
  const allowedKeys = new Set(["metrics", "dimensions", "deductions"]);
  if (rawKeys.some((key) => !allowedKeys.has(key))) {
    stripped = true;
  }

  const rawMetrics = rawDebug.metrics;
  if (isPlainObject(rawMetrics)) {
    const metrics: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawMetrics)) {
      if (isForbiddenKey(key)) {
        stripped = true;
        continue;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        stripped = true;
        continue;
      }
      metrics[key] = value;
    }
    sanitizedDebug.metrics = metrics;
  } else if (typeof rawMetrics !== "undefined") {
    stripped = true;
  }

  const rawDimensions = rawDebug.dimensions;
  if (isPlainObject(rawDimensions)) {
    const dimensions: Partial<RiskDimensions> = {};
    const allowedDimensionKeys: Array<keyof RiskDimensions> = ["scheduleRisk", "workflowRisk", "approvalRisk", "pipelineRisk"];

    for (const key of allowedDimensionKeys) {
      const value = rawDimensions[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        dimensions[key] = clamp(value, 0, 1);
      } else if (typeof value !== "undefined") {
        stripped = true;
      }
    }

    const unknownDimensionKeys = Object.keys(rawDimensions).filter((key) => !allowedDimensionKeys.includes(key as keyof RiskDimensions));
    if (unknownDimensionKeys.length > 0) {
      stripped = true;
    }

    if (
      typeof dimensions.scheduleRisk === "number" &&
      typeof dimensions.workflowRisk === "number" &&
      typeof dimensions.approvalRisk === "number" &&
      typeof dimensions.pipelineRisk === "number"
    ) {
      sanitizedDebug.dimensions = dimensions as RiskDimensions;
    }
  } else if (typeof rawDimensions !== "undefined") {
    stripped = true;
  }

  const rawDeductions = rawDebug.deductions;
  if (Array.isArray(rawDeductions)) {
    const deductions: Array<{ code: string; points: number; details?: string }> = [];

    for (const entry of rawDeductions) {
      if (!isPlainObject(entry)) {
        stripped = true;
        continue;
      }

      const code = safeString(entry.code);
      const points = entry.points;
      const details = typeof entry.details === "undefined" ? undefined : safeString(entry.details);

      if (!code || typeof points !== "number" || !Number.isFinite(points)) {
        stripped = true;
        continue;
      }

      const extraKeys = Object.keys(entry).filter((key) => key !== "code" && key !== "points" && key !== "details");
      if (extraKeys.length > 0) {
        stripped = true;
      }

      if (typeof entry.details !== "undefined" && !details) {
        stripped = true;
      }

      deductions.push({
        code,
        points,
        ...(details ? { details } : {}),
      });
    }

    sanitizedDebug.deductions = deductions;
  } else if (typeof rawDeductions !== "undefined") {
    stripped = true;
  }

  const hasAny =
    typeof sanitizedDebug.metrics !== "undefined" ||
    typeof sanitizedDebug.dimensions !== "undefined" ||
    typeof sanitizedDebug.deductions !== "undefined";

  return {
    debug: hasAny ? sanitizedDebug : undefined,
    stripped,
  };
}

function sanitizeDiagnostics(snapshot: ControlTowerDecisionSnapshot): {
  diagnostics: ControlTowerDecisionSnapshot["diagnostics"];
  stripped: boolean;
} {
  const rawDiagnostics = snapshot.diagnostics;
  if (!rawDiagnostics || !isPlainObject(rawDiagnostics)) {
    return { diagnostics: undefined, stripped: false };
  }

  let stripped = false;
  const diagnostics: NonNullable<ControlTowerDecisionSnapshot["diagnostics"]> = {};

  const rawKeys = Object.keys(rawDiagnostics);
  const allowedKeys = new Set(["structuralRiskScore", "topRiskDimension", "recentWins", "suppressedIntents", "cacheHint"]);
  if (rawKeys.some((key) => !allowedKeys.has(key))) {
    stripped = true;
  }

  if (typeof rawDiagnostics.structuralRiskScore === "number" && Number.isFinite(rawDiagnostics.structuralRiskScore)) {
    diagnostics.structuralRiskScore = clamp(rawDiagnostics.structuralRiskScore, 0, 1);
  } else if (typeof rawDiagnostics.structuralRiskScore !== "undefined") {
    stripped = true;
  }

  const topRiskDimension = rawDiagnostics.topRiskDimension;
  if (
    topRiskDimension === "scheduleRisk" ||
    topRiskDimension === "workflowRisk" ||
    topRiskDimension === "approvalRisk" ||
    topRiskDimension === "pipelineRisk"
  ) {
    diagnostics.topRiskDimension = topRiskDimension;
  } else if (typeof topRiskDimension !== "undefined") {
    stripped = true;
  }

  if (rawDiagnostics.cacheHint === "fresh" || rawDiagnostics.cacheHint === "cached") {
    diagnostics.cacheHint = rawDiagnostics.cacheHint;
  } else if (typeof rawDiagnostics.cacheHint !== "undefined") {
    stripped = true;
  }

  if (Array.isArray(rawDiagnostics.recentWins)) {
    const recentWins: Array<{ intent: string; occurredAt: string }> = [];
    for (const entry of rawDiagnostics.recentWins) {
      if (!isPlainObject(entry)) {
        stripped = true;
        continue;
      }

      const intent = safeString(entry.intent);
      const occurredAt = safeString(entry.occurredAt);
      if (!intent || !occurredAt) {
        stripped = true;
        continue;
      }

      const extraKeys = Object.keys(entry).filter((key) => key !== "intent" && key !== "occurredAt");
      if (extraKeys.length > 0) {
        stripped = true;
      }

      recentWins.push({ intent, occurredAt });
    }
    diagnostics.recentWins = recentWins;
  } else if (typeof rawDiagnostics.recentWins !== "undefined") {
    stripped = true;
  }

  if (Array.isArray(rawDiagnostics.suppressedIntents)) {
    const suppressedIntents = rawDiagnostics.suppressedIntents
      .map((item) => safeString(item))
      .filter((item): item is string => Boolean(item));

    if (suppressedIntents.length !== rawDiagnostics.suppressedIntents.length) {
      stripped = true;
    }

    diagnostics.suppressedIntents = suppressedIntents;
  } else if (typeof rawDiagnostics.suppressedIntents !== "undefined") {
    stripped = true;
  }

  return { diagnostics, stripped };
}

export function sanitizeSnapshot(params: {
  snapshot: ControlTowerDecisionSnapshot;
}): { snapshot: ControlTowerDecisionSnapshot; warnings: DecisionWarning[] } {
  const debugResult = sanitizeDebug(params.snapshot);
  const diagnosticsResult = sanitizeDiagnostics(params.snapshot);

  const warnings: DecisionWarning[] = [];
  if (debugResult.stripped || diagnosticsResult.stripped) {
    warnings.push({
      code: "DEBUG_STRIPPED",
      message: "Unsafe debug fields were stripped from snapshot output.",
      severity: "medium",
    });
  }

  return {
    snapshot: {
      ...params.snapshot,
      debug: debugResult.debug,
      diagnostics: diagnosticsResult.diagnostics,
    },
    warnings,
  };
}
