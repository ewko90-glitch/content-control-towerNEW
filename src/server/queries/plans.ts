import { prisma } from "@/lib/prisma";
import { generateRefreshedPlanProposal } from "@/modules/plans/planner";
import type { PlanRefreshInput, PlanRefreshResult, PlanSuggestion } from "@/modules/plans/types";

type PlanStatus = "draft" | "active" | "archived";
type PlanItemStatus = "planned" | "queued" | "drafted" | "published" | "skipped";

export type PlanListItem = {
  id: string;
  projectId: string;
  name: string;
  status: PlanStatus;
  startDate: string;
  updatedAt: string;
  itemsCount: number;
};

export type PlanItemRecord = {
  id: string;
  planId: string;
  projectId: string;
  projectName: string;
  publishDate: string;
  title: string;
  channel: string;
  status: PlanItemStatus;
  hasContent: boolean;
  contentId: string | null;
  primaryKeyword: string;
  secondaryKeywords: string[];
  internalLinkSuggestions: Array<{ url: string; title: string; anchorHint?: string }>;
  externalLinkSuggestions: Array<{ url: string; title: string }>;
  clusterId: string;
  clusterLabel: string;
  note: string;
};

export type PlanDetailRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  status: PlanStatus;
  startDate: string;
  cadence: { freq: "weekly" | "biweekly"; daysOfWeek: number[] };
  channels: string[];
  items: PlanItemRecord[];
};

export type PlanItemWithProjectAndStatus = {
  planItemId: string;
  planId: string;
  publishDate: string;
  projectId: string;
  projectName: string;
  channel: string;
  title: string;
  primaryKeyword: string;
  status: PlanItemStatus;
  hasContent: boolean;
  contentId: string | null;
};

export type AutopilotQueue = {
  today: PlanItemWithProjectAndStatus[];
  overdue: PlanItemWithProjectAndStatus[];
  thisWeek: { weekStart: string; items: PlanItemWithProjectAndStatus[] };
  stats: { planned: number; queued: number; drafted: number; published: number; overdue: number };
};

export type CoverageState = "healthy" | "thin" | "missing" | "drifting";
export type PerformanceState = "high" | "medium" | "low" | "unknown";
export type StrategyHintType = "scale" | "fix" | "fill" | "stabilize" | "observe";

export type StrategyHint = {
  type: StrategyHintType;
  message: string;
};

export type PlanCoverageSnapshot = {
  plan: { id: string; name: string; projectId: string; startDate: string };
  stats: {
    planned: number;
    queued: number;
    drafted: number;
    published: number;
    skipped: number;
    overdue: number;
    unbound: number;
  };
  weeks: Array<{
    weekStart: string;
    weekEnd: string;
    planned: number;
    drafted: number;
    published: number;
    overdue: number;
    items: Array<{
      planItemId: string;
      publishDate: string;
      channel: string;
      title: string;
      primaryKeyword: string;
      clusterId: string;
      clusterLabel: string;
      status: string;
      hasContent: boolean;
      contentId?: string;
      contentStatus?: string;
      qualityScore?: number;
      packId?: string;
    }>;
  }>;
  clusters: Array<{
    clusterId: string;
    clusterLabel: string;
    plannedCount: number;
    executedCount: number;
    publishedCount: number;
    overdueCount: number;
    coverageState: CoverageState;
    topKeywords: string[];
    avgRating: number | null;
    avgViews: number | null;
    performanceState: PerformanceState;
    strategyHint: StrategyHint;
  }>;
  gaps: Array<{
    planItemId: string;
    publishDate: string;
    title: string;
    clusterLabel: string;
    reason: "no_content" | "low_quality" | "stuck_in_queue";
  }>;
};

export type PortfolioExecutionHealthSnapshot = {
  kpis: {
    onTimeRate: number;
    overdueItems: number;
    driftingClusters: number;
    missingClusters: number;
    thinClusters: number;
  };
  topRisks: Array<{
    planId: string;
    planName: string;
    projectId: string;
    projectName: string;
    riskScore: number;
    reasons: string[];
    ctas: Array<{ label: string; href: string }>;
  }>;
  focusThisWeek: Array<{
    planId: string;
    projectName: string;
    weekStart: string;
    mustShip: Array<{
      planItemId: string;
      publishDate: string;
      channel: string;
      title: string;
      status: string;
      hasContent: boolean;
      contentId?: string;
      qualityScore?: number;
    }>;
  }>;
  recommendedActions: Array<{
    id: string;
    title: string;
    reason: string;
    impactHint: string;
    href: string;
  }>;
  clusterPriorities: Array<{
    planId: string;
    projectName: string;
    clusterId: string;
    clusterLabel: string;
    performanceState: PerformanceState;
    coverageState: CoverageState;
    strategyHint: StrategyHint;
  }>;
};

function getLocalTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getLocalTomorrowStart(todayStart: Date): Date {
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(todayStart.getDate() + 1);
  return tomorrow;
}

function getLocalWeekBounds(todayStart: Date): { weekStart: Date; weekEnd: Date } {
  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function toPlanItemStatus(value: unknown): PlanItemStatus {
  const candidate = String(value);
  if (candidate === "queued" || candidate === "drafted" || candidate === "published" || candidate === "skipped") {
    return candidate;
  }
  return "planned";
}

function mondayStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diffToMonday);
  value.setHours(0, 0, 0, 0);
  return value;
}

function weekEndFromStart(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function isOverdueStatus(status: string): boolean {
  return status !== "published" && status !== "skipped";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function nextMondayISO(from: Date): string {
  const value = new Date(from);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diffToMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  value.setDate(value.getDate() + diffToMonday);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

function clampWeight(value: number): number {
  return Math.max(0.2, Math.min(3.0, Math.round(value * 100) / 100));
}

function weightFromStates(params: {
  performanceState: PerformanceState;
  coverageState: CoverageState;
  overdueCount: number;
}): number {
  let weight = 1.0;

  if (params.performanceState === "high") {
    weight += 1.0;
  } else if (params.performanceState === "medium") {
    weight += 0.5;
  } else if (params.performanceState === "low") {
    weight -= 0.5;
  }

  if (params.coverageState === "missing") {
    weight += 1.5;
  } else if (params.coverageState === "thin") {
    weight += 1.0;
  } else if (params.coverageState === "drifting") {
    weight += 0.5;
  }

  if (params.overdueCount > 0) {
    weight += 0.8;
  }

  return clampWeight(weight);
}

function refreshRationale(params: {
  performanceState: PerformanceState;
  coverageState: CoverageState;
  overdueCount: number;
}): string {
  if (params.performanceState === "high" && (params.coverageState === "missing" || params.coverageState === "thin")) {
    return "Mocne wyniki + brak pokrycia → zwiększamy priorytet.";
  }
  if (params.performanceState === "low") {
    return "Słabe wyniki → ograniczamy, ale zostawiamy testy.";
  }
  if (params.performanceState === "unknown") {
    return "Brak danych → utrzymujemy bazową częstotliwość.";
  }
  if (params.overdueCount > 0) {
    return "Zaległości w klastrze → podnosimy priorytet porządkowania.";
  }
  if (params.coverageState === "missing") {
    return "Brak pokrycia planu → zwiększamy udział klastra.";
  }
  if (params.coverageState === "thin") {
    return "Niskie pokrycie → dokładamy dodatkowe publikacje.";
  }
  if (params.coverageState === "drifting") {
    return "Dryf realizacji → wzmacniamy stabilność klastra.";
  }
  return "Stabilny klaster → utrzymujemy równą częstotliwość.";
}

function strategyPriority(type: StrategyHintType): number {
  if (type === "fix") {
    return 0;
  }
  if (type === "fill") {
    return 1;
  }
  if (type === "stabilize") {
    return 2;
  }
  if (type === "scale") {
    return 3;
  }
  return 4;
}

function resolveStrategyHint(params: {
  performanceState: PerformanceState;
  coverageState: CoverageState;
}): StrategyHint {
  if (params.performanceState === "low") {
    return {
      type: "fix",
      message: "Klaster ma słabe wyniki — przetestuj nowy kąt tematu lub format.",
    };
  }
  if (params.coverageState === "missing") {
    return {
      type: "fill",
      message: "Brak pokrycia planu — wygeneruj treści dla tego klastra.",
    };
  }
  if (params.coverageState === "thin") {
    return {
      type: "stabilize",
      message: "Pokrycie jest niewystarczające — dodaj więcej treści przed skalowaniem.",
    };
  }
  if (params.performanceState === "high" && params.coverageState === "healthy") {
    return {
      type: "scale",
      message: "Klaster działa bardzo dobrze — rozważ zwiększenie częstotliwości publikacji.",
    };
  }
  if (params.performanceState === "unknown") {
    return {
      type: "observe",
      message: "Brak danych wydajności — obserwuj po pierwszych publikacjach.",
    };
  }
  return {
    type: "stabilize",
    message: "Pokrycie jest niewystarczające — dodaj więcej treści przed skalowaniem.",
  };
}

function buildSuggestionId(params: { planId: string; clusterId: string; type: PlanSuggestion["type"] }): string {
  return `${params.planId}:${params.clusterId}:${params.type}`;
}

export async function getAdaptivePlanSuggestions(workspaceId: string, planId: string): Promise<PlanSuggestion[]> {
  const snapshot = await getPlanCoverageSnapshot(workspaceId, planId, { horizonWeeks: 2 });
  if (!snapshot) {
    return [];
  }

  const suggestions: PlanSuggestion[] = [];

  for (const cluster of snapshot.clusters) {
    if (cluster.performanceState === "high" && cluster.coverageState === "healthy") {
      suggestions.push({
        id: buildSuggestionId({ planId, clusterId: cluster.clusterId, type: "increase_cluster" }),
        type: "increase_cluster",
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        reason: "Klaster ma mocne wyniki i stabilne pokrycie.",
        impact: "Dodatkowa publikacja może zwiększyć zasięg w najbliższych 2 tygodniach.",
        proposedChanges: { add: 1 },
        severity: 3,
      });
    }

    if (cluster.performanceState === "low") {
      suggestions.push({
        id: buildSuggestionId({ planId, clusterId: cluster.clusterId, type: "test_new_angle" }),
        type: "test_new_angle",
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        reason: "Klaster ma niską skuteczność.",
        impact: "Test nowego kąta tematu może poprawić konwersję i zaangażowanie.",
        proposedChanges: { changeAngle: true },
        severity: 4,
      });
    }

    if (cluster.coverageState === "missing") {
      suggestions.push({
        id: buildSuggestionId({ planId, clusterId: cluster.clusterId, type: "fill_missing" }),
        type: "fill_missing",
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        reason: "Plan ma lukę pokrycia dla tego klastra.",
        impact: "Dodanie tematów domknie pokrycie i zmniejszy ryzyko pustych tygodni.",
        proposedChanges: { add: 2 },
        severity: 5,
      });
    }

    if (cluster.coverageState === "thin") {
      suggestions.push({
        id: buildSuggestionId({ planId, clusterId: cluster.clusterId, type: "increase_cluster" }),
        type: "increase_cluster",
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        reason: "Pokrycie klastra jest zbyt płytkie.",
        impact: "Dodatkowa publikacja ustabilizuje obecność tematu w planie.",
        proposedChanges: { add: 1 },
        severity: 4,
      });
    }

    if (cluster.overdueCount > 0) {
      suggestions.push({
        id: buildSuggestionId({ planId, clusterId: cluster.clusterId, type: "shift_overdue" }),
        type: "shift_overdue",
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        reason: "W klastrze są pozycje zaległe.",
        impact: "Przesunięcie zaległości o 3 dni odciąży bieżący tydzień i uporządkuje kolejkę.",
        proposedChanges: { shiftDays: 3 },
        severity: 5,
      });
    }
  }

  return suggestions
    .sort((left, right) => {
      if (right.severity !== left.severity) {
        return right.severity - left.severity;
      }
      const clusterCompare = left.clusterLabel.localeCompare(right.clusterLabel);
      if (clusterCompare !== 0) {
        return clusterCompare;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 5);
}

export async function getPlanRefreshProposal(
  workspaceId: string,
  input: PlanRefreshInput,
): Promise<PlanRefreshResult | null> {
  const sourcePlan = await getPlan(input.planId, workspaceId);
  if (!sourcePlan) {
    return null;
  }

  const horizonWeeks = Number.isFinite(input.horizonWeeks) && input.horizonWeeks > 0
    ? Math.floor(input.horizonWeeks)
    : 8;

  const sourceCadence = sourcePlan.cadence;
  const cadence: { freq: "weekly" | "biweekly"; daysOfWeek: number[] } = input.cadenceOverride
    ? {
        freq: input.cadenceOverride.freq === "biweekly" ? "biweekly" : "weekly",
        daysOfWeek: [...new Set(input.cadenceOverride.daysOfWeek.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))]
          .sort((left, right) => left - right),
      }
    : sourceCadence;

  const channelPriority: Array<"blog" | "linkedin" | "newsletter" | "landing"> = ["blog", "linkedin", "newsletter", "landing"];
  const channelsRaw = (input.channelsOverride && input.channelsOverride.length > 0 ? input.channelsOverride : sourcePlan.channels)
    .map((value) => String(value).toLowerCase())
    .filter((value): value is "blog" | "linkedin" | "newsletter" | "landing" =>
      value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing",
    );
  const channels = channelPriority.filter((channel) => channelsRaw.includes(channel));

  const startDate = input.startDateISO ? new Date(input.startDateISO).toISOString() : nextMondayISO(new Date());

  const snapshot = await getPlanCoverageSnapshot(workspaceId, sourcePlan.id, { horizonWeeks });
  if (!snapshot) {
    return null;
  }

  const itemsByCluster = new Map<string, PlanDetailRecord["items"]>();
  for (const item of sourcePlan.items) {
    const current = itemsByCluster.get(item.clusterId) ?? [];
    current.push(item);
    itemsByCluster.set(item.clusterId, current);
  }

  const sourceInternalLinks = sourcePlan.items
    .flatMap((item) => item.internalLinkSuggestions)
    .map((link) => ({
      url: link.url,
      title: link.title,
      anchorHints: link.anchorHint ? [link.anchorHint] : [],
    }))
    .filter((link) => link.url.length > 0);

  const sourceExternalLinks = sourcePlan.items
    .flatMap((item) => item.externalLinkSuggestions)
    .map((link) => ({ url: link.url, title: link.title }))
    .filter((link) => link.url.length > 0);

  const clusterInputs = snapshot.clusters
    .map((cluster) => {
      const clusterItems = itemsByCluster.get(cluster.clusterId) ?? [];
      const firstItem = clusterItems[0];

      const keywordSet = new Set<string>();
      for (const item of clusterItems) {
        if (item.primaryKeyword.trim().length > 0) {
          keywordSet.add(item.primaryKeyword.trim());
        }
        for (const keyword of item.secondaryKeywords) {
          if (keyword.trim().length > 0) {
            keywordSet.add(keyword.trim());
          }
        }
      }

      const keywords = [...keywordSet];
      const primaryKeyword = keywords[0] ?? cluster.topKeywords[0] ?? cluster.clusterLabel;
      const secondaryKeywords = keywords.filter((keyword) => keyword !== primaryKeyword).slice(0, 3);

      const weight = weightFromStates({
        performanceState: cluster.performanceState,
        coverageState: cluster.coverageState,
        overdueCount: cluster.overdueCount,
      });

      const rationale = refreshRationale({
        performanceState: cluster.performanceState,
        coverageState: cluster.coverageState,
        overdueCount: cluster.overdueCount,
      });

      return {
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        primaryKeyword,
        secondaryKeywords,
        performanceState: cluster.performanceState,
        coverageState: cluster.coverageState,
        weight,
        rationale,
        hasSource: Boolean(firstItem),
      };
    })
    .filter((cluster) => cluster.hasSource);

  if (clusterInputs.length === 0) {
    return {
      proposal: {
        name: `Propozycja odświeżenia — ${sourcePlan.name}`,
        startDate,
        cadence,
        channels,
        items: [],
      },
      diagnostics: {
        sourcePlanId: sourcePlan.id,
        horizonWeeks,
        startDate,
        clusterStats: [],
        totalItems: 0,
        collisionsAvoided: 0,
      },
    };
  }

  return generateRefreshedPlanProposal({
    sourcePlanId: sourcePlan.id,
    proposalName: `Propozycja odświeżenia — ${sourcePlan.name}`,
    horizonWeeks,
    startDateISO: startDate,
    cadence,
    channels,
    clusters: clusterInputs.map((cluster) => ({
      clusterId: cluster.clusterId,
      clusterLabel: cluster.clusterLabel,
      primaryKeyword: cluster.primaryKeyword,
      secondaryKeywords: cluster.secondaryKeywords,
      performanceState: cluster.performanceState,
      coverageState: cluster.coverageState,
      weight: cluster.weight,
      rationale: cluster.rationale,
    })),
    internalLinks: sourceInternalLinks,
    externalLinks: sourceExternalLinks,
  });
}

export function classifyCoverageState(params: {
  plannedCount: number;
  executedCount: number;
  publishedCount: number;
  overdueCount: number;
  unboundClusterCount: number;
}): CoverageState {
  if (params.plannedCount >= 1 && params.executedCount === 0) {
    return "missing";
  }
  if (
    params.unboundClusterCount > 0 ||
    (params.plannedCount > 0 && params.executedCount < params.plannedCount / 2 && params.overdueCount > 0)
  ) {
    return "drifting";
  }
  if (params.plannedCount >= 3 && params.publishedCount <= 1) {
    return "thin";
  }
  return "healthy";
}

export async function listPlans(workspaceId: string, projectId?: string): Promise<PlanListItem[]> {
  const planModel = (prisma as unknown as {
    publicationPlan: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  }).publicationPlan;

  const plans = await planModel.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      items: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return plans.map((plan) => {
    const items = (plan.items as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(plan.id),
      projectId: String(plan.projectId),
      name: String(plan.name),
      status: (String(plan.status) as PlanStatus) ?? "draft",
      startDate: new Date(plan.startDate as Date).toISOString(),
      updatedAt: new Date(plan.updatedAt as Date).toISOString(),
      itemsCount: items.length,
    };
  });
}

export async function getPlan(planId: string, workspaceId: string): Promise<PlanDetailRecord | null> {
  const planModel = (prisma as unknown as {
    publicationPlan: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    };
  }).publicationPlan;

  const plan = await planModel.findFirst({
    where: {
      id: planId,
      workspaceId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: {
          publishDate: "asc",
        },
      },
    },
  });

  if (!plan) {
    return null;
  }

  const rawCadence = (plan.cadence as Record<string, unknown> | undefined) ?? {};
  const daysOfWeek = Array.isArray(rawCadence.daysOfWeek)
    ? rawCadence.daysOfWeek.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    : [];

  const channels = Array.isArray(plan.channels) ? plan.channels.map((value) => String(value)) : [];
  const rawItems = (plan.items as Array<Record<string, unknown>> | undefined) ?? [];
  const itemIds = rawItems.map((item) => String(item.id));

  const contentModel = (prisma as unknown as {
    contentBuilderItem: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  }).contentBuilderItem;

  const boundContent = itemIds.length > 0
    ? await contentModel.findMany({
        where: {
          workspaceId,
          planItemId: {
            in: itemIds,
          },
        },
        select: {
          id: true,
          planItemId: true,
        },
      })
    : [];

  const contentByPlanItemId = new Map<string, string>();
  for (const item of boundContent) {
    if (item.planItemId) {
      contentByPlanItemId.set(String(item.planItemId), String(item.id));
    }
  }

  const project = (plan.project as Record<string, unknown> | undefined) ?? {};
  const items = rawItems.map((item) => {
    const itemId = String(item.id);
    const contentId = contentByPlanItemId.get(itemId) ?? null;

    return {
      id: itemId,
      planId: String(plan.id),
      projectId: String(plan.projectId),
      projectName: String(project.name ?? "Unknown project"),
      publishDate: new Date(item.publishDate as Date).toISOString(),
      title: String(item.title),
      channel: String(item.channel),
      status: toPlanItemStatus(item.status),
      hasContent: Boolean(contentId),
      contentId,
      primaryKeyword: String(item.primaryKeyword),
    secondaryKeywords: Array.isArray(item.secondaryKeywords) ? item.secondaryKeywords.map((value) => String(value)) : [],
    internalLinkSuggestions: Array.isArray(item.internalLinkSuggestions)
      ? item.internalLinkSuggestions.map((link) => {
          const linkValue = link as Record<string, unknown>;
          return {
            url: String(linkValue.url ?? ""),
            title: String(linkValue.title ?? ""),
            anchorHint: typeof linkValue.anchorHint === "string" ? linkValue.anchorHint : undefined,
          };
        })
      : [],
    externalLinkSuggestions: Array.isArray(item.externalLinkSuggestions)
      ? item.externalLinkSuggestions.map((link) => {
          const linkValue = link as Record<string, unknown>;
          return {
            url: String(linkValue.url ?? ""),
            title: String(linkValue.title ?? ""),
          };
        })
      : [],
    clusterId: String(item.clusterId),
    clusterLabel: String(item.clusterLabel),
    note: String(item.note ?? ""),
    };
  });

  return {
    id: String(plan.id),
    workspaceId: String(plan.workspaceId),
    projectId: String(plan.projectId),
    name: String(plan.name),
    status: String(plan.status) as PlanStatus,
    startDate: new Date(plan.startDate as Date).toISOString(),
    cadence: {
      freq: rawCadence.freq === "biweekly" ? "biweekly" : "weekly",
      daysOfWeek,
    },
    channels,
    items,
  };
}

export async function getAutopilotQueue(workspaceId: string): Promise<AutopilotQueue> {
  const todayStart = getLocalTodayStart();
  const tomorrowStart = getLocalTomorrowStart(todayStart);
  const { weekStart, weekEnd } = getLocalWeekBounds(todayStart);

  const planItemModel = (prisma as unknown as {
    publicationPlanItem: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  }).publicationPlanItem;

  const planItems = await planItemModel.findMany({
    where: {
      plan: {
        workspaceId,
      },
    },
    include: {
      plan: {
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      publishDate: "asc",
    },
  });

  const itemIds = planItems.map((item) => String(item.id));
  const contentModel = (prisma as unknown as {
    contentBuilderItem: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  }).contentBuilderItem;

  const contentBindings = itemIds.length > 0
    ? await contentModel.findMany({
        where: {
          workspaceId,
          planItemId: {
            in: itemIds,
          },
        },
        select: {
          id: true,
          planItemId: true,
        },
      })
    : [];

  const contentByPlanItemId = new Map<string, string>();
  for (const binding of contentBindings) {
    if (binding.planItemId) {
      contentByPlanItemId.set(String(binding.planItemId), String(binding.id));
    }
  }

  const mappedItems: PlanItemWithProjectAndStatus[] = planItems.map((item) => {
    const plan = (item.plan as Record<string, unknown> | undefined) ?? {};
    const project = (plan.project as Record<string, unknown> | undefined) ?? {};
    const itemId = String(item.id);
    const contentId = contentByPlanItemId.get(itemId) ?? null;

    return {
      planItemId: itemId,
      planId: String(plan.id),
      publishDate: new Date(item.publishDate as Date).toISOString(),
      projectId: String(plan.projectId),
      projectName: String(project.name ?? "Unknown project"),
      channel: String(item.channel),
      title: String(item.title),
      primaryKeyword: String(item.primaryKeyword),
      status: toPlanItemStatus(item.status),
      hasContent: Boolean(contentId),
      contentId,
    };
  });

  const inProgressStatuses: PlanItemStatus[] = ["planned", "queued", "drafted"];
  const overdue = mappedItems.filter((item) => {
    const publishDate = new Date(item.publishDate);
    return publishDate < todayStart && inProgressStatuses.includes(item.status);
  });

  const today = mappedItems.filter((item) => {
    const publishDate = new Date(item.publishDate);
    return publishDate >= todayStart && publishDate < tomorrowStart;
  });

  const thisWeekItems = mappedItems.filter((item) => {
    const publishDate = new Date(item.publishDate);
    return publishDate >= weekStart && publishDate <= weekEnd;
  });

  const stats = {
    planned: mappedItems.filter((item) => item.status === "planned").length,
    queued: mappedItems.filter((item) => item.status === "queued").length,
    drafted: mappedItems.filter((item) => item.status === "drafted").length,
    published: mappedItems.filter((item) => item.status === "published").length,
    overdue: overdue.length,
  };

  return {
    today,
    overdue,
    thisWeek: {
      weekStart: weekStart.toISOString(),
      items: thisWeekItems,
    },
    stats,
  };
}

export async function getPlanCoverageSnapshot(
  workspaceId: string,
  planId: string,
  opts: { horizonWeeks: number },
): Promise<PlanCoverageSnapshot | null> {
  const horizonWeeks = Number.isFinite(opts.horizonWeeks) && opts.horizonWeeks > 0 ? Math.floor(opts.horizonWeeks) : 8;

  const planModel = (prisma as unknown as {
    publicationPlan: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    };
    publicationPlanItem: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    contentBuilderItem: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    contentPerformance: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  });

  const plan = await planModel.publicationPlan.findFirst({
    where: {
      id: planId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      startDate: true,
    },
  });

  if (!plan) {
    return null;
  }

  const startDate = new Date(plan.startDate as Date);
  const windowStart = mondayStart(startDate);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowStart.getDate() + horizonWeeks * 7 - 1);
  windowEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const rawItems = await planModel.publicationPlanItem.findMany({
    where: {
      planId,
      publishDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: {
      publishDate: "asc",
    },
  });

  const planItemIds = rawItems.map((item) => String(item.id));
  const boundContent = planItemIds.length > 0
    ? await planModel.contentBuilderItem.findMany({
        where: {
          workspaceId,
          planItemId: {
            in: planItemIds,
          },
        },
        select: {
          id: true,
          planItemId: true,
          status: true,
          qualityScore: true,
          packId: true,
          clusterId: true,
        },
      })
    : [];

  const contentByPlanItemId = new Map<string, Record<string, unknown>>();
  for (const content of boundContent) {
    if (content.planItemId) {
      contentByPlanItemId.set(String(content.planItemId), content);
    }
  }

  const boundContentIds = boundContent.map((content) => String(content.id));
  const performanceRows = boundContentIds.length > 0
    ? await planModel.contentPerformance.findMany({
        where: {
          contentId: {
            in: boundContentIds,
          },
        },
        select: {
          contentId: true,
          views: true,
          rating: true,
        },
      })
    : [];

  const performanceByContentId = new Map<string, { views: number | null; rating: number | null }>();
  for (const row of performanceRows) {
    performanceByContentId.set(String(row.contentId), {
      views: typeof row.views === "number" ? Number(row.views) : null,
      rating: typeof row.rating === "number" ? Number(row.rating) : null,
    });
  }

  const workspacePublishedContent = await planModel.contentBuilderItem.findMany({
    where: {
      workspaceId,
      status: "published",
    },
    select: {
      id: true,
    },
  });

  const workspacePublishedIds = workspacePublishedContent.map((item) => String(item.id));
  const workspaceViewsRows = workspacePublishedIds.length > 0
    ? await planModel.contentPerformance.findMany({
        where: {
          contentId: {
            in: workspacePublishedIds,
          },
          views: {
            not: null,
          },
        },
        select: {
          views: true,
        },
      })
    : [];

  const workspaceViewsMedian = median(
    workspaceViewsRows
      .map((row) => Number(row.views ?? 0))
      .filter((value) => Number.isFinite(value)),
  );

  const unboundContent = await planModel.contentBuilderItem.findMany({
    where: {
      workspaceId,
      planId,
      publishDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      planItemId: true,
      clusterId: true,
    },
  });

  const unboundInWindow = unboundContent.filter((content) => {
    const planItemIdValue = content.planItemId ? String(content.planItemId) : null;
    if (!planItemIdValue) {
      return true;
    }
    return !planItemIds.includes(planItemIdValue);
  });

  const unboundByCluster = new Map<string, number>();
  for (const unbound of unboundInWindow) {
    const key = unbound.clusterId ? String(unbound.clusterId) : "__unknown__";
    unboundByCluster.set(key, (unboundByCluster.get(key) ?? 0) + 1);
  }

  const weekBuckets = Array.from({ length: horizonWeeks }, (_, index) => {
    const weekStart = new Date(windowStart);
    weekStart.setDate(windowStart.getDate() + index * 7);
    const weekEnd = weekEndFromStart(weekStart);
    return {
      weekStart,
      weekEnd,
      items: [] as Array<{
        planItemId: string;
        publishDate: string;
        channel: string;
        title: string;
        primaryKeyword: string;
        clusterId: string;
        clusterLabel: string;
        status: string;
        hasContent: boolean;
        contentId?: string;
        contentStatus?: string;
        qualityScore?: number;
        packId?: string;
      }>,
    };
  });

  const clusterAggregate = new Map<string, {
    clusterId: string;
    clusterLabel: string;
    plannedCount: number;
    executedCount: number;
    publishedCount: number;
    overdueCount: number;
    keywords: string[];
    ratingValues: number[];
    viewsValues: number[];
    performanceSamples: number;
  }>();

  let planned = 0;
  let queued = 0;
  let drafted = 0;
  let published = 0;
  let skipped = 0;
  let overdue = 0;

  const gaps: PlanCoverageSnapshot["gaps"] = [];

  for (const item of rawItems) {
    const planItemId = String(item.id);
    const publishDate = new Date(item.publishDate as Date);
    const itemStatus = toPlanItemStatus(item.status);
    const bound = contentByPlanItemId.get(planItemId);
    const hasContent = Boolean(bound);

    planned += 1;
    if (itemStatus === "queued") {
      queued += 1;
    } else if (itemStatus === "drafted") {
      drafted += 1;
    } else if (itemStatus === "published") {
      published += 1;
    } else if (itemStatus === "skipped") {
      skipped += 1;
    }

    const isOverdue = publishDate < now && isOverdueStatus(itemStatus);
    if (isOverdue) {
      overdue += 1;
    }

    const row = {
      planItemId,
      publishDate: publishDate.toISOString(),
      channel: String(item.channel),
      title: String(item.title),
      primaryKeyword: String(item.primaryKeyword),
      clusterId: String(item.clusterId),
      clusterLabel: String(item.clusterLabel),
      status: itemStatus,
      hasContent,
      contentId: bound ? String(bound.id) : undefined,
      contentStatus: bound ? String(bound.status) : undefined,
      qualityScore: bound ? Number(bound.qualityScore ?? 0) : undefined,
      packId: bound?.packId ? String(bound.packId) : undefined,
    };

    const bucket = weekBuckets.find((entry) => publishDate >= entry.weekStart && publishDate <= entry.weekEnd);
    if (bucket) {
      bucket.items.push(row);
    }

    const clusterKey = row.clusterId;
    const existingCluster = clusterAggregate.get(clusterKey) ?? {
      clusterId: clusterKey,
      clusterLabel: row.clusterLabel,
      plannedCount: 0,
      executedCount: 0,
      publishedCount: 0,
      overdueCount: 0,
      keywords: [],
      ratingValues: [],
      viewsValues: [],
      performanceSamples: 0,
    };

    existingCluster.plannedCount += 1;
    if (hasContent) {
      existingCluster.executedCount += 1;
      if (row.contentStatus === "published" || row.status === "published") {
        existingCluster.publishedCount += 1;
      }
    }
    if (isOverdue) {
      existingCluster.overdueCount += 1;
    }

    if (hasContent) {
      const contentId = row.contentId ?? "";
      const isPublishedContent = row.contentStatus === "published" || row.status === "published";
      if (isPublishedContent && contentId.length > 0) {
        const performance = performanceByContentId.get(contentId);
        if (performance && (performance.rating != null || performance.views != null)) {
          existingCluster.performanceSamples += 1;
          if (performance.rating != null) {
            existingCluster.ratingValues.push(performance.rating);
          }
          if (performance.views != null) {
            existingCluster.viewsValues.push(performance.views);
          }
        }
      }
    }

    const secondary = Array.isArray(item.secondaryKeywords) ? item.secondaryKeywords.map((value) => String(value)) : [];
    const keywordCandidates = [row.primaryKeyword, ...secondary.slice(0, 2)];
    for (const keyword of keywordCandidates) {
      if (keyword.length === 0) {
        continue;
      }
      if (!existingCluster.keywords.includes(keyword)) {
        existingCluster.keywords.push(keyword);
      }
    }

    clusterAggregate.set(clusterKey, existingCluster);

    let gapReason: "no_content" | "low_quality" | "stuck_in_queue" | null = null;
    if (!hasContent) {
      gapReason = "no_content";
    } else if ((row.qualityScore ?? 100) < 80) {
      gapReason = "low_quality";
    } else if (row.status === "queued") {
      gapReason = "stuck_in_queue";
    }

    if (gapReason) {
      gaps.push({
        planItemId,
        publishDate: row.publishDate,
        title: row.title,
        clusterLabel: row.clusterLabel,
        reason: gapReason,
      });
    }
  }

  const weeks = weekBuckets.map((bucket) => {
    const weekOverdue = bucket.items.filter((item) => new Date(item.publishDate) < now && isOverdueStatus(item.status)).length;
    return {
      weekStart: bucket.weekStart.toISOString(),
      weekEnd: bucket.weekEnd.toISOString(),
      planned: bucket.items.length,
      drafted: bucket.items.filter((item) => item.status === "drafted").length,
      published: bucket.items.filter((item) => item.status === "published").length,
      overdue: weekOverdue,
      items: bucket.items,
    };
  });

  const clusters = [...clusterAggregate.values()]
    .map((cluster) => {
      const unboundClusterCount = unboundByCluster.get(cluster.clusterId) ?? 0;
      const avgRating = average(cluster.ratingValues);
      const avgViews = average(cluster.viewsValues);

      const performanceState: PerformanceState = cluster.performanceSamples === 0
        ? "unknown"
        : (avgRating != null && avgRating >= 4) || (workspaceViewsMedian != null && avgViews != null && avgViews > workspaceViewsMedian)
          ? "high"
          : avgRating != null && avgRating <= 2
            ? "low"
            : "medium";

      const coverageState = classifyCoverageState({
        plannedCount: cluster.plannedCount,
        executedCount: cluster.executedCount,
        publishedCount: cluster.publishedCount,
        overdueCount: cluster.overdueCount,
        unboundClusterCount,
      });

      const strategyHint = resolveStrategyHint({
        performanceState,
        coverageState,
      });

      return {
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        plannedCount: cluster.plannedCount,
        executedCount: cluster.executedCount,
        publishedCount: cluster.publishedCount,
        overdueCount: cluster.overdueCount,
        coverageState,
        topKeywords: cluster.keywords.slice(0, 3),
        avgRating,
        avgViews,
        performanceState,
        strategyHint,
      };
    })
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }
      if (right.plannedCount !== left.plannedCount) {
        return right.plannedCount - left.plannedCount;
      }
      return left.clusterLabel.localeCompare(right.clusterLabel);
    });

  const severityRank = (gap: PlanCoverageSnapshot["gaps"][number]): number => {
    const publishDate = new Date(gap.publishDate);
    const isGapOverdue = publishDate < now;
    return isGapOverdue ? 0 : 1;
  };

  const sortedGaps = gaps
    .sort((left, right) => {
      const severityDiff = severityRank(left) - severityRank(right);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime();
    })
    .slice(0, 10);

  return {
    plan: {
      id: String(plan.id),
      name: String(plan.name),
      projectId: String(plan.projectId),
      startDate: new Date(plan.startDate as Date).toISOString(),
    },
    stats: {
      planned,
      queued,
      drafted,
      published,
      skipped,
      overdue,
      unbound: unboundInWindow.length,
    },
    weeks,
    clusters,
    gaps: sortedGaps,
  };
}

export async function getPortfolioExecutionHealth(
  workspaceId: string,
  opts: { horizonWeeks: number },
): Promise<PortfolioExecutionHealthSnapshot> {
  const horizonWeeks = Number.isFinite(opts.horizonWeeks) && opts.horizonWeeks > 0 ? Math.floor(opts.horizonWeeks) : 8;
  const trailingWeeks = Math.max(1, Math.min(2, horizonWeeks));

  const planModel = (prisma as unknown as {
    publicationPlan: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  }).publicationPlan;

  const activePlans = await planModel.findMany({
    where: {
      workspaceId,
      status: "active",
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const snapshots = await Promise.all(
    activePlans.map(async (plan) => {
      const snapshot = await getPlanCoverageSnapshot(workspaceId, String(plan.id), { horizonWeeks });
      return {
        planId: String(plan.id),
        planName: String(plan.name),
        projectId: String(plan.projectId),
        projectName: String((plan.project as Record<string, unknown> | undefined)?.name ?? "Unknown project"),
        snapshot,
      };
    }),
  );

  const readySnapshots = snapshots.filter(
    (entry): entry is typeof entry & { snapshot: PlanCoverageSnapshot } => Boolean(entry.snapshot),
  );

  let overdueItems = 0;
  let driftingClusters = 0;
  let missingClusters = 0;
  let thinClusters = 0;
  let trailingPlanned = 0;
  let trailingPublished = 0;

  const topRisks = readySnapshots.map((entry) => {
    const clusterStates = entry.snapshot.clusters.reduce(
      (accumulator, cluster) => {
        if (cluster.coverageState === "drifting") {
          accumulator.drifting += 1;
        } else if (cluster.coverageState === "missing") {
          accumulator.missing += 1;
        } else if (cluster.coverageState === "thin") {
          accumulator.thin += 1;
        }
        return accumulator;
      },
      { drifting: 0, missing: 0, thin: 0 },
    );

    const overdue = entry.snapshot.stats.overdue;
    overdueItems += overdue;
    driftingClusters += clusterStates.drifting;
    missingClusters += clusterStates.missing;
    thinClusters += clusterStates.thin;

    const trailing = entry.snapshot.weeks.slice(-trailingWeeks);
    trailingPlanned += trailing.reduce((sum, week) => sum + week.planned, 0);
    trailingPublished += trailing.reduce((sum, week) => sum + week.published, 0);

    const overdueComponent = Math.min(overdue * 8, 40);
    const missingComponent = Math.min(clusterStates.missing * 10, 30);
    const driftingComponent = Math.min(clusterStates.drifting * 8, 20);
    const thinComponent = Math.min(clusterStates.thin * 5, 15);
    const riskScore = clampNumber(overdueComponent + missingComponent + driftingComponent + thinComponent, 0, 100);

    const reasons: string[] = [];
    if (overdue > 0) {
      reasons.push("Overdue items increasing delivery risk");
    }
    if (clusterStates.missing > 0) {
      reasons.push("Missing cluster coverage");
    }
    if (clusterStates.drifting > 0) {
      reasons.push("Drift detected (unbound or under-executed)");
    }
    if (clusterStates.thin > 0) {
      reasons.push("Coverage is thin in key clusters");
    }

    return {
      planId: entry.planId,
      planName: entry.planName,
      projectId: entry.projectId,
      projectName: entry.projectName,
      riskScore,
      reasons: reasons.slice(0, 3),
      ctas: [
        { label: "Open coverage", href: `/calendar/coverage?planId=${encodeURIComponent(entry.planId)}` },
        { label: "Open calendar", href: `/calendar?planId=${encodeURIComponent(entry.planId)}` },
        { label: "Open autopilot", href: `/content?planId=${encodeURIComponent(entry.planId)}` },
      ],
      snapshot: entry.snapshot,
    };
  })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      const projectCompare = left.projectName.localeCompare(right.projectName);
      if (projectCompare !== 0) {
        return projectCompare;
      }
      return left.planName.localeCompare(right.planName);
    });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const focusThisWeek = topRisks.slice(0, 3).map((risk) => {
    const thisWeek = risk.snapshot.weeks.find((week) => {
      const start = new Date(week.weekStart);
      const end = new Date(week.weekEnd);
      return today >= start && today <= end;
    }) ?? risk.snapshot.weeks.find((week) => week.items.some((item) => item.status !== "published" && item.status !== "skipped"));

    const mustShip = (thisWeek?.items ?? [])
      .filter((item) => item.status === "planned" || item.status === "queued" || item.status === "drafted")
      .sort((left, right) => new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime())
      .slice(0, 5)
      .map((item) => ({
        planItemId: item.planItemId,
        publishDate: item.publishDate,
        channel: item.channel,
        title: item.title,
        status: item.status,
        hasContent: item.hasContent,
        contentId: item.contentId,
        qualityScore: item.qualityScore,
      }));

    return {
      planId: risk.planId,
      projectName: risk.projectName,
      weekStart: thisWeek?.weekStart ?? "",
      mustShip,
    };
  });

  const onTimeRate = trailingPlanned > 0
    ? Math.round((trailingPublished / trailingPlanned) * 100)
    : 100;

  const primaryPlanId = topRisks[0]?.planId;
  const baseCoverageHref = primaryPlanId
    ? `/calendar/coverage?planId=${encodeURIComponent(primaryPlanId)}`
    : "/calendar";

  const recommendedActions: PortfolioExecutionHealthSnapshot["recommendedActions"] = [];
  if (overdueItems > 0) {
    recommendedActions.push({
      id: "clear-overdue-weekly-pack",
      title: "Clear overdue with weekly pack generation",
      reason: "Overdue items are increasing execution risk this week.",
      impactHint: "Improves near-term on-time delivery and reduces backlog pressure.",
      href: baseCoverageHref,
    });
  }
  if (missingClusters > 0) {
    recommendedActions.push({
      id: "generate-missing-cluster-packs",
      title: "Generate item packs for missing clusters",
      reason: "Cluster map shows missing coverage in planned topics.",
      impactHint: "Restores topical completeness and lowers strategic blind spots.",
      href: baseCoverageHref,
    });
  }
  if (driftingClusters > 0) {
    recommendedActions.push({
      id: "rebind-drifting-content",
      title: "Review unbound content and rebind to plan",
      reason: "Drift indicates execution is diverging from planned clusters.",
      impactHint: "Tightens plan-to-content alignment and reduces slippage.",
      href: primaryPlanId ? `/calendar?planId=${encodeURIComponent(primaryPlanId)}` : "/calendar",
    });
  }

  if (recommendedActions.length < 3) {
    recommendedActions.push({
      id: "weekly-governance-check",
      title: "Run weekly execution governance check",
      reason: "A stable cadence keeps delivery risk from compounding.",
      impactHint: "Sustains on-time rate while preventing new overdue spikes.",
      href: primaryPlanId ? `/calendar?planId=${encodeURIComponent(primaryPlanId)}` : "/calendar",
    });
  }
  if (recommendedActions.length < 3) {
    recommendedActions.push({
      id: "review-quality-hotspots",
      title: "Review low-quality hotspots in upcoming items",
      reason: "Quality gaps often delay publication in the next cycle.",
      impactHint: "Raises publish readiness before deadlines are missed.",
      href: baseCoverageHref,
    });
  }

  const clusterPriorities = topRisks
    .flatMap((risk) => risk.snapshot.clusters.map((cluster) => ({
      planId: risk.planId,
      projectName: risk.projectName,
      clusterId: cluster.clusterId,
      clusterLabel: cluster.clusterLabel,
      performanceState: cluster.performanceState,
      coverageState: cluster.coverageState,
      strategyHint: cluster.strategyHint,
      overdueCount: cluster.overdueCount,
      plannedCount: cluster.plannedCount,
    })))
    .sort((left, right) => {
      const priorityDiff = strategyPriority(left.strategyHint.type) - strategyPriority(right.strategyHint.type);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }
      if (right.plannedCount !== left.plannedCount) {
        return right.plannedCount - left.plannedCount;
      }
      const projectDiff = left.projectName.localeCompare(right.projectName);
      if (projectDiff !== 0) {
        return projectDiff;
      }
      return left.clusterLabel.localeCompare(right.clusterLabel);
    })
    .map((entry) => ({
      planId: entry.planId,
      projectName: entry.projectName,
      clusterId: entry.clusterId,
      clusterLabel: entry.clusterLabel,
      performanceState: entry.performanceState,
      coverageState: entry.coverageState,
      strategyHint: entry.strategyHint,
    }));

  return {
    kpis: {
      onTimeRate: clampNumber(onTimeRate, 0, 100),
      overdueItems,
      driftingClusters,
      missingClusters,
      thinClusters,
    },
    topRisks: topRisks.map((risk) => ({
      planId: risk.planId,
      planName: risk.planName,
      projectId: risk.projectId,
      projectName: risk.projectName,
      riskScore: risk.riskScore,
      reasons: risk.reasons,
      ctas: risk.ctas,
    })),
    focusThisWeek,
    recommendedActions: recommendedActions.slice(0, 3),
    clusterPriorities,
  };
}
