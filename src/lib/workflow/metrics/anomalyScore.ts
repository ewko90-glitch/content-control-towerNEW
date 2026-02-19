import { clamp } from "./percentiles";
import type { Anomaly, FlowMetricsSnapshot } from "./types";

function severityFor(score: number): "low" | "medium" | "high" {
  if (score >= 85) {
    return "high";
  }
  if (score >= 60) {
    return "medium";
  }
  return "low";
}

export function computeAnomalies(metrics: FlowMetricsSnapshot): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const throughputDelta = metrics.throughput.deltaPct;
  if (throughputDelta <= -30) {
    let score = 60;
    if (throughputDelta <= -50) {
      score = 85;
    }
    if (throughputDelta <= -70) {
      score = 100;
    }

    anomalies.push({
      code: "THROUGHPUT_DROP",
      score,
      severity: severityFor(score),
      message: "Weekly throughput dropped versus prior window.",
    });
  }

  const leadDelta = metrics.trends.leadTimeDeltaPct;
  if (leadDelta >= 25) {
    let score = 60;
    if (leadDelta >= 40) {
      score = 85;
    }
    if (leadDelta >= 60) {
      score = 100;
    }

    anomalies.push({
      code: "LEAD_TIME_SPIKE",
      score,
      severity: severityFor(score),
      message: "Lead time increased beyond expected range.",
    });
  }

  const cycleDelta = metrics.trends.cycleTimeDeltaPct;
  if (cycleDelta >= 25) {
    let score = 60;
    if (cycleDelta >= 40) {
      score = 85;
    }
    if (cycleDelta >= 60) {
      score = 100;
    }

    anomalies.push({
      code: "CYCLE_TIME_SPIKE",
      score,
      severity: severityFor(score),
      message: "Cycle time increased versus prior window.",
    });
  }

  if (metrics.efficiency.efficiency <= 0.35 && metrics.trends.efficiencyDeltaPct <= -15) {
    const score = metrics.efficiency.efficiency <= 0.25 ? 95 : 70;
    anomalies.push({
      code: "EFFICIENCY_DROP",
      score,
      severity: severityFor(score),
      message: "Flow efficiency dropped while active time share declined.",
    });
  }

  const volatility = clamp(metrics.trends.volatilityScore, 0, 100);
  if (volatility >= 60) {
    let score = 60;
    if (volatility >= 80) {
      score = 90;
    }

    anomalies.push({
      code: "VOLATILITY_RISE",
      score,
      severity: severityFor(score),
      message: "Lead-time volatility increased and flow stability is reduced.",
    });
  }

  return anomalies.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.code.localeCompare(right.code);
  });
}
