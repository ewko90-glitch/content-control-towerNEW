import type { WipSeverity } from "./types";

export type SignalTone = "neutral" | "info" | "warning" | "danger";

export type PastelToken = {
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass?: string;
};

const TOKENS: Record<SignalTone, PastelToken> = {
  neutral: {
    bgClass: "bg-surface2",
    textClass: "text-muted",
    borderClass: "border-border",
    dotClass: "bg-muted",
  },
  info: {
    bgClass: "bg-primarySoft",
    textClass: "text-text",
    borderClass: "border-primary/30",
    dotClass: "bg-primary",
  },
  warning: {
    bgClass: "bg-warning/20",
    textClass: "text-text",
    borderClass: "border-warning/40",
    dotClass: "bg-warning",
  },
  danger: {
    bgClass: "bg-danger/20",
    textClass: "text-text",
    borderClass: "border-danger/40",
    dotClass: "bg-danger",
  },
};

export function toneToPastelToken(tone: SignalTone): PastelToken {
  return TOKENS[tone];
}

export function getSlaTone(signals: { warningCount: number; breachCount: number; criticalCount: number }): SignalTone {
  if (signals.criticalCount > 0) {
    return "danger";
  }
  if (signals.breachCount > 0) {
    return "warning";
  }
  if (signals.warningCount > 0) {
    return "info";
  }
  return "neutral";
}

export function getStuckTone(signals: { stuckCount: number; criticalStuckCount: number }): SignalTone {
  if (signals.criticalStuckCount > 0) {
    return "danger";
  }
  if (signals.stuckCount > 0) {
    return "warning";
  }
  return "neutral";
}

export function getBottleneckTone(likelihoodScore: number): SignalTone {
  if (likelihoodScore >= 60) {
    return "danger";
  }
  if (likelihoodScore >= 35) {
    return "warning";
  }
  if (likelihoodScore >= 20) {
    return "info";
  }
  return "neutral";
}

export function getWipTone(severity: WipSeverity): SignalTone {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "hard") {
    return "warning";
  }
  if (severity === "soft") {
    return "info";
  }
  return "neutral";
}
