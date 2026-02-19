import type { DurationStats } from "./types";

function sanitize(values: number[]): number[] {
  return values
    .filter((value) => Number.isFinite(value) && !Number.isNaN(value))
    .map((value) => Math.max(0, value));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function avg(values: number[]): number {
  const clean = sanitize(values);
  if (clean.length === 0) {
    return 0;
  }
  return clean.reduce((acc, value) => acc + value, 0) / clean.length;
}

export function percentile(values: number[], p: number): number {
  const clean = sanitize(values).sort((left, right) => left - right);
  if (clean.length === 0) {
    return 0;
  }

  const ratio = clamp(p, 0, 100) / 100;
  if (clean.length === 1) {
    return clean[0];
  }

  const index = ratio * (clean.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return clean[lower] ?? 0;
  }

  const weight = index - lower;
  const left = clean[lower] ?? 0;
  const right = clean[upper] ?? left;
  return left + (right - left) * weight;
}

export function trimmedMean(values: number[], trimPct: number): number {
  const clean = sanitize(values).sort((left, right) => left - right);
  if (clean.length === 0) {
    return 0;
  }

  const ratio = clamp(trimPct, 0, 0.49);
  const trimCount = Math.floor(clean.length * ratio);
  const start = trimCount;
  const end = clean.length - trimCount;
  const sliced = clean.slice(start, Math.max(start, end));

  if (sliced.length === 0) {
    return avg(clean);
  }

  return avg(sliced);
}

export function durationStats(valuesHours: number[]): DurationStats {
  const values = sanitize(valuesHours);
  const p50 = percentile(values, 50);
  const p75 = percentile(values, 75);
  const p90 = percentile(values, 90);
  const p95 = percentile(values, 95);

  return {
    count: values.length,
    avgHours: avg(values),
    trimmedAvgHours: trimmedMean(values, 0.1),
    p50Hours: p50,
    p75Hours: p75,
    p90Hours: p90,
    p95Hours: p95,
    iqrHours: Math.max(0, p75 - p50),
  };
}
