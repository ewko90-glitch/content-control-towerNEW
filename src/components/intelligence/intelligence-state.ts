export type IntelligenceLevel = "critical" | "warning" | "positive" | "stable";

export type IntelligenceState = {
  priorityLevel: IntelligenceLevel;
  headline: string;
  explanation: string;
  ctaTarget: string;
  reasoningTags: string[];
};

type DeriveInput = {
  workflowSignals?: unknown;
  predictiveRisk?: unknown;
  flowMetrics?: unknown;
  healthScore?: number;
};

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function pickNumber(input: unknown, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  return fallback;
}

function nestedNumber(source: Record<string, unknown>, path: string[]): number {
  let current: unknown = source;
  for (const segment of path) {
    const record = asRecord(current);
    current = record[segment];
  }
  return pickNumber(current, 0);
}

function nestedString(source: Record<string, unknown>, path: string[]): string {
  let current: unknown = source;
  for (const segment of path) {
    const record = asRecord(current);
    current = record[segment];
  }
  return typeof current === "string" ? current : "";
}

function resolveThroughputImproving(flowMetrics: unknown): boolean {
  const record = asRecord(flowMetrics);
  const directDelta = pickNumber(record.throughputPerWeekDelta, Number.NaN);
  if (Number.isFinite(directDelta)) {
    return directDelta > 0;
  }

  const trendDelta = nestedNumber(record, ["trend", "throughputPerWeekDelta"]);
  if (trendDelta !== 0) {
    return trendDelta > 0;
  }

  const scoreDelta = nestedNumber(record, ["summary", "throughputScoreDelta"]);
  return scoreDelta > 0;
}

export function deriveIntelligenceState(input: DeriveInput): IntelligenceState {
  const predictive = asRecord(input.predictiveRisk);
  const pressure = pickNumber(predictive.pressureScore, 0);

  const signals = asRecord(input.workflowSignals);
  const bottleneckIndex = Math.max(
    nestedNumber(signals, ["bottleneckIndex", "likelihoodScore"]),
    nestedNumber(signals, ["bottleneck", "likelihoodScore"]),
  );
  const topStage =
    nestedString(signals, ["bottleneckIndex", "topStage"]) || nestedString(signals, ["bottleneck", "topStage"]) || "review";

  const throughputImproving = resolveThroughputImproving(input.flowMetrics);
  const healthScore = typeof input.healthScore === "number" && Number.isFinite(input.healthScore) ? input.healthScore : undefined;

  if (pressure >= 75) {
    return {
      priorityLevel: "critical",
      headline: "Wysokie ryzyko opóźnień",
      explanation: `Największy wpływ ma etap: ${topStage}`,
      ctaTarget: "#content-board",
      reasoningTags: ["predictive-risk", "high-pressure", `stage:${topStage}`],
    };
  }

  if (bottleneckIndex > 60) {
    return {
      priorityLevel: "warning",
      headline: "Wąskie gardło w workflow",
      explanation: "Rozważ zwiększenie capacity lub zmianę WIP",
      ctaTarget: "#decision-lab-anchor",
      reasoningTags: ["bottleneck", `index:${Math.round(bottleneckIndex)}`],
    };
  }

  if (throughputImproving || (typeof healthScore === "number" && healthScore >= 70)) {
    return {
      priorityLevel: "positive",
      headline: "Workflow przyspiesza",
      explanation: "Throughput rośnie, utrzymaj tempo",
      ctaTarget: "#content-board",
      reasoningTags: ["throughput-up", "momentum-positive"],
    };
  }

  return {
    priorityLevel: "stable",
    headline: "System stabilny",
    explanation: "Brak krytycznych sygnałów",
    ctaTarget: "#decision-lab-anchor",
    reasoningTags: ["stable", "no-critical-signals"],
  };
}
