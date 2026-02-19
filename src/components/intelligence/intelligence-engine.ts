export type GuidedActionCard = {
  title: string;
  cta?: {
    label?: string;
    href?: string;
  };
  executionPriority?: number;
};

export type GuidedState = {
  priorityLevel: "critical" | "warning" | "positive" | "stable";
  title: string;
  subtitle: string;
  primaryAction?: GuidedActionCard;
  explanationBullets: string[];
  tone: "danger" | "warning" | "success" | "neutral";
};

type DeriveInput = {
  workflowSignals?: unknown;
  predictiveRisk?: unknown;
  flowMetrics?: unknown;
  healthScore?: number;
  actionCards?: GuidedActionCard[];
};

function toRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function pickNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getNestedNumber(source: Record<string, unknown>, path: string[]): number {
  let current: unknown = source;
  for (const key of path) {
    current = toRecord(current)[key];
  }
  return pickNumber(current, 0);
}

function getNestedString(source: Record<string, unknown>, path: string[]): string {
  let current: unknown = source;
  for (const key of path) {
    current = toRecord(current)[key];
  }
  return pickString(current, "");
}

function isThroughputImproving(flowMetrics: unknown, healthScore?: number): boolean {
  const source = toRecord(flowMetrics);
  const directDelta = pickNumber(source.throughputPerWeekDelta, Number.NaN);
  if (Number.isFinite(directDelta)) {
    return directDelta > 0;
  }

  const trendDelta = getNestedNumber(source, ["trend", "throughputPerWeekDelta"]);
  if (trendDelta !== 0) {
    return trendDelta > 0;
  }

  if (typeof healthScore === "number" && Number.isFinite(healthScore)) {
    return healthScore >= 70;
  }

  return false;
}

function pickPrimaryAction(actionCards: GuidedActionCard[] | undefined): GuidedActionCard | undefined {
  if (!actionCards || actionCards.length === 0) {
    return undefined;
  }

  return [...actionCards].sort((left, right) => {
    const leftPriority = typeof left.executionPriority === "number" ? left.executionPriority : Number.MAX_SAFE_INTEGER;
    const rightPriority = typeof right.executionPriority === "number" ? right.executionPriority : Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.title.localeCompare(right.title);
  })[0];
}

export function deriveGuidedState(input: DeriveInput): GuidedState {
  const predictive = toRecord(input.predictiveRisk);
  const pressure = pickNumber(predictive.pressureScore, 0);

  const signals = toRecord(input.workflowSignals);
  const bottleneckIndex = Math.max(
    getNestedNumber(signals, ["bottleneckIndex", "likelihoodScore"]),
    getNestedNumber(signals, ["bottleneck", "likelihoodScore"]),
  );
  const topStage =
    getNestedString(signals, ["bottleneckIndex", "topStage"]) ||
    getNestedString(signals, ["bottleneck", "topStage"]) ||
    "review";

  const primaryAction = pickPrimaryAction(input.actionCards);

  if (pressure >= 75) {
    return {
      priorityLevel: "critical",
      title: "Wysokie ryzyko opóźnień",
      subtitle: `Największy wpływ ma etap ${topStage}`,
      primaryAction,
      explanationBullets: ["Ryzyko przekroczenia SLA rośnie", `Największy wpływ ma etap ${topStage}`],
      tone: "danger",
    };
  }

  if (bottleneckIndex > 60) {
    return {
      priorityLevel: "warning",
      title: "Wąskie gardło spowalnia zespół",
      subtitle: `Przepływ blokuje się w ${topStage}`,
      primaryAction,
      explanationBullets: [`Przepływ blokuje się w ${topStage}`, "Rozważ zwiększenie capacity"],
      tone: "warning",
    };
  }

  if (isThroughputImproving(input.flowMetrics, input.healthScore)) {
    return {
      priorityLevel: "positive",
      title: "Workflow przyspiesza",
      subtitle: "Throughput rośnie, utrzymaj tempo",
      primaryAction,
      explanationBullets: ["Throughput rośnie", "Ryzyko utrzymane w normie"],
      tone: "success",
    };
  }

  return {
    priorityLevel: "stable",
    title: "System stabilny",
    subtitle: "Brak krytycznych sygnałów",
    primaryAction,
    explanationBullets: ["Brak krytycznych sygnałów", "Możesz optymalizować proces"],
    tone: "neutral",
  };
}
