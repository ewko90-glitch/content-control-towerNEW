import type { FlowMetricsSnapshot } from "./types";

export type InsightTone = "neutral" | "info" | "warning" | "danger";

export type FlowInsight = {
  tone: InsightTone;
  title: string;
  detail: string;
  code: "FLOW" | "THROUGHPUT" | "LEAD" | "CYCLE" | "EFFICIENCY" | "VOLATILITY";
};

export function buildInsights(metrics: FlowMetricsSnapshot): FlowInsight[] {
  const insights: FlowInsight[] = [];
  const topAnomaly = metrics.anomalies[0];

  if (topAnomaly && topAnomaly.severity === "high") {
    insights.push({
      tone: "danger",
      code: topAnomaly.code === "THROUGHPUT_DROP" ? "THROUGHPUT" : topAnomaly.code === "VOLATILITY_RISE" ? "VOLATILITY" : "FLOW",
      title: "Flow anomaly detected",
      detail: topAnomaly.message,
    });
  } else if (topAnomaly && topAnomaly.severity === "medium") {
    insights.push({
      tone: "warning",
      code: topAnomaly.code === "LEAD_TIME_SPIKE" ? "LEAD" : topAnomaly.code === "CYCLE_TIME_SPIKE" ? "CYCLE" : "FLOW",
      title: "Flow pressure increased",
      detail: topAnomaly.message,
    });
  } else if (metrics.throughput.deltaPct > 0 && metrics.trends.leadTimeDeltaPct < 0) {
    insights.push({
      tone: "info",
      code: "FLOW",
      title: "Flow is improving",
      detail: "Throughput is increasing while lead time is decreasing.",
    });
  }

  if (insights.length < 2 && metrics.efficiency.efficiency > 0 && metrics.efficiency.efficiency < 0.4) {
    insights.push({
      tone: "warning",
      code: "EFFICIENCY",
      title: "Efficiency remains low",
      detail: "Active work is a small share of total lead time.",
    });
  }

  return insights.slice(0, 2);
}
