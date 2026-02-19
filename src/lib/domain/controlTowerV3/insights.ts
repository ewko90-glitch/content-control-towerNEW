import type { Insight, Metrics } from "./types";

export function buildInsights(metrics: Metrics): Insight[] {
  const insights: Insight[] = [
    {
      key: "insight-created",
      text: `W tym tygodniu: ${metrics.createdLast7d} nowych treści`,
      severity: metrics.createdLast7d === 0 ? "warning" : "info",
    },
    {
      key: "insight-bottleneck",
      text: `Najbardziej obciążony etap: REVIEW (${metrics.byStatus.REVIEW})`,
      severity: metrics.byStatus.REVIEW > 0 ? "warning" : "info",
    },
    {
      key: "insight-ai",
      text: `AI: ${metrics.aiJobsLast7d} akcji w 7 dni`,
      severity: metrics.aiJobsLast7d > 0 ? "info" : "warning",
    },
    {
      key: "insight-credits",
      text: `Kredyty AI: pozostało ${Math.max(0, Math.round((1 - metrics.creditsUsedPct) * 100))}%`,
      severity: metrics.lowCredits ? "danger" : metrics.warningCredits ? "warning" : "info",
    },
  ];

  if (metrics.avgReviewHours > 0) {
    insights.push({
      key: "insight-review-time",
      text: `Średni czas akceptacji: ${metrics.avgReviewHours.toFixed(1)}h`,
      severity: metrics.avgReviewHours > 48 ? "danger" : metrics.avgReviewHours > 24 ? "warning" : "info",
    });
  }

  if (metrics.velocity > 0) {
    insights.push({
      key: "insight-velocity",
      text: `Wskaźnik domknięcia: ${(metrics.velocity * 100).toFixed(0)}%`,
      severity: metrics.velocity < 0.4 ? "warning" : "info",
    });
  }

  return insights.slice(0, 6);
}
