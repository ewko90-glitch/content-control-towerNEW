import { confidenceLabel, impactLabel } from "./copy-pl";
import type { Confidence, Impact, Metrics, Severity } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function makeImpact(score: number): Impact {
  const safe = clamp(Math.round(score), 0, 100);
  return {
    score: safe,
    label: impactLabel(safe),
  };
}

export function makeConfidence(score: number): Confidence {
  const safe = clamp(Number(score.toFixed(2)), 0, 1);
  return {
    score: safe,
    label: confidenceLabel(safe),
  };
}

export function severityFromImpact(score: number): Severity {
  if (score >= 75) {
    return "danger";
  }

  if (score >= 40) {
    return "warning";
  }

  return "info";
}

export function estimateConfidence(metrics: Metrics): Confidence {
  let score = 0.7;

  if (metrics.totalContent < 5) {
    score -= 0.35;
  }

  if (metrics.workflowEventsTotal === 0) {
    score -= 0.25;
  } else if (metrics.workflowEventsTotal < 5) {
    score -= 0.1;
  }

  if (metrics.versionsLast7d > 0) {
    score += 0.1;
  }

  if (metrics.aiJobsLast7d > 0) {
    score += 0.05;
  }

  if (metrics.upcomingWeek > 0) {
    score += 0.1;
  }

  return makeConfidence(score);
}
