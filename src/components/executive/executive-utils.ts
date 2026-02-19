import type { ExecTone, ExecutiveAction } from "./executive-types";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function safeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function formatNumber(value: number | undefined, digits = 1): string {
  if (typeof value !== "number") {
    return "—";
  }
  return value.toFixed(digits);
}

export function relativeTime(fromIso: string, nowIso: string): string {
  const from = new Date(fromIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(now) || now < from) {
    return "teraz";
  }

  const minutes = Math.max(0, Math.floor((now - from) / 60000));
  if (minutes < 1) {
    return "teraz";
  }
  if (minutes < 60) {
    return `${minutes} min temu`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h temu`;
  }

  const days = Math.floor(hours / 24);
  return `${days} d temu`;
}

export function toneForScore(value: number | undefined, warning: number, danger: number, inverse = false): ExecTone {
  if (typeof value !== "number") {
    return "neutral";
  }

  if (!inverse) {
    if (value >= danger) {
      return "danger";
    }
    if (value >= warning) {
      return "warning";
    }
    if (value >= 85) {
      return "positive";
    }
    return "neutral";
  }

  if (value >= danger) {
    return "danger";
  }
  if (value >= warning) {
    return "warning";
  }
  return "positive";
}

export function actionImpactTemplate(action: ExecutiveAction["title"]): string {
  const normalized = action.toLowerCase();

  if (normalized.includes("overdue")) {
    return "Redukuje opóźnienia krytyczne.";
  }
  if (normalized.includes("approval") || normalized.includes("review")) {
    return "Przyspiesza decyzje akceptacyjne.";
  }
  if (normalized.includes("stuck") || normalized.includes("bottleneck")) {
    return "Odblokowuje przepływ w gardle procesu.";
  }
  if (normalized.includes("schedule") || normalized.includes("calendar")) {
    return "Stabilizuje plan publikacji na 7 dni.";
  }

  return "Wspiera stabilność operacyjną zespołu.";
}

export function toneClass(tone: ExecTone): string {
  if (tone === "positive") {
    return "border-success/30 bg-success/15 text-success";
  }
  if (tone === "warning") {
    return "border-warning/40 bg-warning/20 text-warning";
  }
  if (tone === "danger") {
    return "border-danger/35 bg-danger/10 text-danger";
  }
  return "border-border bg-surface2 text-textMuted";
}
