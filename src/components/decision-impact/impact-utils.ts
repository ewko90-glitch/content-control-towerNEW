import type { ImpactStatus } from "./impact-types";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function formatMetric(value: number | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function statusLabel(status: ImpactStatus): string {
  if (status === "improving") {
    return "Improving";
  }
  if (status === "worsening") {
    return "Worsening";
  }
  if (status === "neutral") {
    return "Neutral";
  }
  return "Insufficient data";
}

export function statusClasses(status: ImpactStatus): string {
  if (status === "improving") {
    return "border-success/30 bg-success/15 text-success";
  }
  if (status === "worsening") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  if (status === "neutral") {
    return "border-border bg-surface2 text-textMuted";
  }
  return "border-border bg-surface2/70 text-textMuted";
}
