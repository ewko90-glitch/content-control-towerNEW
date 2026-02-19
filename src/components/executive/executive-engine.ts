import type { ImpactEvaluation } from "@/components/decision-impact/impact-types";
import type { DecisionEntry, DecisionStore } from "@/components/decision-timeline/decision-types";
import { actionImpactTemplate, clamp, formatNumber, relativeTime, safeNumber, toneForScore } from "./executive-utils";
import type {
  ExecutiveAction,
  ExecutiveDecisionRow,
  ExecutiveKpi,
  ExecutiveRisk,
  ExecutiveSnapshot,
  ExecutiveStrategyBlock,
} from "./executive-types";

type ActionCardInput = {
  title?: string;
  executionPriority?: number;
  cta?: {
    href?: string;
  };
};

function toRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function parseActionCards(input: unknown): ActionCardInput[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      const record = toRecord(entry);
      const ctaRecord = toRecord(record.cta);
      return {
        title: typeof record.title === "string" ? record.title : undefined,
        executionPriority: safeNumber(record.executionPriority),
        cta: {
          href: typeof ctaRecord.href === "string" ? ctaRecord.href : undefined,
        },
      };
    })
    .filter((entry) => typeof entry.title === "string" && entry.title.trim().length > 0);
}

function deriveKpis(input: {
  healthScore?: number;
  predictivePressure?: number;
  throughputPerWeek?: number;
  leadAvgHours?: number;
  bottleneckIndex?: number;
  topStage?: string;
}): ExecutiveKpi[] {
  const health = safeNumber(input.healthScore);
  const pressure = safeNumber(input.predictivePressure);
  const throughput = safeNumber(input.throughputPerWeek);
  const leadHours = safeNumber(input.leadAvgHours);
  const bottleneckIndex = safeNumber(input.bottleneckIndex);

  const leadDays = typeof leadHours === "number" ? leadHours / 24 : undefined;

  return [
    {
      id: "health",
      label: "Health Score",
      value: typeof health === "number" ? `${Math.round(clamp(health, 0, 100))}` : "—",
      tone: toneForScore(health, 70, 50, true),
    },
    {
      id: "pressure",
      label: "Predictive Pressure",
      value: typeof pressure === "number" ? `${Math.round(clamp(pressure, 0, 100))}` : "—",
      tone: toneForScore(pressure, 60, 75, false),
    },
    {
      id: "throughput",
      label: "Throughput / tydz.",
      value: formatNumber(throughput, 1),
      tone: typeof throughput === "number" && throughput >= 1 ? "positive" : "neutral",
    },
    {
      id: "lead",
      label: "Avg Lead Time",
      value: typeof leadHours === "number" ? `${formatNumber(leadHours, 1)} h` : "—",
      secondary: typeof leadDays === "number" ? `${formatNumber(leadDays, 1)} d` : undefined,
      tone: typeof leadHours === "number" && leadHours >= 96 ? "warning" : "neutral",
    },
    {
      id: "bottleneck",
      label: "Bottleneck",
      value:
        typeof bottleneckIndex === "number"
          ? formatNumber(bottleneckIndex, 0)
          : input.topStage
            ? input.topStage
            : "—",
      secondary: typeof bottleneckIndex !== "number" && input.topStage ? "Top Stage" : undefined,
      tone: typeof bottleneckIndex === "number" && bottleneckIndex > 60 ? "warning" : "neutral",
    },
  ];
}

function deriveRisks(input: {
  impact?: ImpactEvaluation;
  predictivePressure?: number;
  bottleneckIndex?: number;
  hasPublications: boolean;
}): ExecutiveRisk[] {
  const risks: ExecutiveRisk[] = [];

  if (input.impact && input.impact.status === "worsening" && Math.round(input.impact.confidence * 100) >= 60) {
    risks.push({
      id: "impact-worsening",
      label: "Strategia nie przynosi efektu",
      severity: "high",
      explanation: "Wynik wpływu wskazuje trend pogorszenia przy wiarygodnym sygnale.",
    });
  }

  if (typeof input.predictivePressure === "number" && input.predictivePressure >= 75) {
    risks.push({
      id: "predictive-pressure",
      label: "Wysokie ryzyko opóźnień",
      severity: "high",
      explanation: "Presja predykcyjna przekracza próg alarmowy.",
    });
  }

  if (typeof input.bottleneckIndex === "number" && input.bottleneckIndex > 60) {
    risks.push({
      id: "bottleneck",
      label: "Wąskie gardło w procesie",
      severity: "medium",
      explanation: "Bottleneck index utrzymuje się powyżej poziomu bezpiecznego.",
    });
  }

  if (!input.hasPublications) {
    risks.push({
      id: "no-plan",
      label: "Brak planu publikacji",
      severity: "medium",
      explanation: "Brak zaplanowanych publikacji obniża przewidywalność realizacji.",
    });
  }

  if (risks.length === 0) {
    return [
      {
        id: "fallback",
        label: "Brak krytycznych ryzyk operacyjnych",
        severity: "low",
        explanation: "Aktualny obraz operacyjny nie wskazuje krytycznych odchyleń.",
      },
    ];
  }

  return risks.slice(0, 3);
}

function deriveActions(actionCards: ActionCardInput[]): ExecutiveAction[] {
  return actionCards
    .sort((left, right) => {
      const lp = typeof left.executionPriority === "number" ? left.executionPriority : -999;
      const rp = typeof right.executionPriority === "number" ? right.executionPriority : -999;
      return rp - lp;
    })
    .slice(0, 3)
    .map((entry, index) => ({
      id: `action-${index + 1}`,
      title: entry.title ?? "Action",
      impact: actionImpactTemplate(entry.title ?? "Action"),
      target: entry.cta?.href,
    }));
}

function summarizeDelta(entry: DecisionEntry): string | undefined {
  const t = entry.delta.throughputDelta;
  const l = entry.delta.leadTimeDelta;
  const r = entry.delta.riskDelta;

  const parts: string[] = [];
  if (typeof t === "number") {
    parts.push(`T ${t > 0 ? "+" : ""}${t.toFixed(1)}`);
  }
  if (typeof l === "number") {
    parts.push(`L ${l > 0 ? "+" : ""}${l.toFixed(1)}`);
  }
  if (typeof r === "number") {
    parts.push(`R ${r > 0 ? "+" : ""}${r.toFixed(1)}`);
  }

  return parts.length > 0 ? parts.join(" • ") : undefined;
}

function deriveDecisions(entries: DecisionEntry[], nowIso: string): ExecutiveDecisionRow[] {
  return entries.slice(0, 3).map((entry) => ({
    id: entry.id,
    name: entry.scenarioName,
    status: entry.status,
    delta: summarizeDelta(entry),
    when: relativeTime(entry.createdAt, nowIso),
  }));
}

function deriveStrategy(input: {
  currentStrategy?: DecisionEntry;
  currentImpact?: ImpactEvaluation;
}): ExecutiveStrategyBlock {
  if (!input.currentStrategy) {
    return {
      name: undefined,
      adoptedAt: undefined,
      impactStatus: undefined,
      confidencePct: undefined,
      interpretation: "Brak przyjętej strategii. Wybierz scenariusz i oznacz jako adopted.",
    };
  }

  const impact = input.currentImpact;

  return {
    name: input.currentStrategy.scenarioName,
    adoptedAt: input.currentStrategy.adoptedAt ?? input.currentStrategy.createdAt,
    impactStatus: impact?.status,
    confidencePct: impact ? Math.round(clamp(impact.confidence * 100, 0, 100)) : undefined,
    interpretation:
      impact?.status === "improving"
        ? "Strategia stabilnie poprawia wskaźniki operacyjne."
        : impact?.status === "worsening"
          ? "Wynik wymaga korekty strategii i szybkiej interwencji."
          : impact?.status === "neutral"
            ? "Wpływ strategii jest stabilny, bez istotnych odchyleń."
            : "Brak wystarczających danych do oceny wpływu strategii.",
  };
}

export function deriveExecutiveSnapshot(params: {
  workspaceSlug: string;
  nowIso: string;
  healthScore?: number;
  flowMetrics?: unknown;
  predictiveRisk?: unknown;
  workflowSignals?: unknown;
  actionCards?: unknown[];
  decisionStore?: unknown;
  currentStrategy?: unknown;
  currentImpact?: unknown;
}): ExecutiveSnapshot {
  const flow = toRecord(params.flowMetrics);
  const risk = toRecord(params.predictiveRisk);
  const signals = toRecord(params.workflowSignals);
  const decisionStoreRecord = toRecord(params.decisionStore);

  const entries = Array.isArray(decisionStoreRecord.entries)
    ? (decisionStoreRecord.entries.filter((entry) => typeof entry === "object" && entry !== null) as DecisionEntry[])
    : [];

  const currentStrategy = (typeof params.currentStrategy === "object" && params.currentStrategy !== null
    ? (params.currentStrategy as DecisionEntry)
    : undefined);

  const currentImpact = (typeof params.currentImpact === "object" && params.currentImpact !== null
    ? (params.currentImpact as ImpactEvaluation)
    : undefined);

  const pressure = safeNumber(risk.pressureScore);
  const throughput = safeNumber(flow.throughputPerWeek) ?? safeNumber(flow.throughputWeekly) ?? safeNumber(flow.throughput);
  const leadAvgHours = safeNumber(flow.leadAvgHours) ?? safeNumber(flow.leadTimeAvgHours);
  const bottleneckIndex = safeNumber(signals.bottleneckIndex) ?? safeNumber(toRecord(signals.bottleneck).likelihoodScore);
  const topStage =
    typeof toRecord(signals.bottleneckIndex).topStage === "string"
      ? (toRecord(signals.bottleneckIndex).topStage as string)
      : typeof toRecord(signals.bottleneck).topStage === "string"
        ? (toRecord(signals.bottleneck).topStage as string)
        : undefined;

  const hasPublications =
    typeof flow.publicationJobsCount === "number" ? flow.publicationJobsCount > 0 : true;

  const actionCards = parseActionCards(params.actionCards ?? []);

  return {
    generatedAt: params.nowIso,
    workspaceSlug: params.workspaceSlug,
    kpis: deriveKpis({
      healthScore: params.healthScore,
      predictivePressure: pressure,
      throughputPerWeek: throughput,
      leadAvgHours,
      bottleneckIndex,
      topStage,
    }),
    risks: deriveRisks({
      impact: currentImpact,
      predictivePressure: pressure,
      bottleneckIndex,
      hasPublications,
    }),
    strategy: deriveStrategy({
      currentStrategy,
      currentImpact,
    }),
    actions: deriveActions(actionCards),
    decisions: deriveDecisions(entries, params.nowIso),
  };
}
