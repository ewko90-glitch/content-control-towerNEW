import type {
  PlanChannel,
  PlanGenerationResult,
  PlanItemDraft,
  PlanKeywordCluster,
  PlanRefreshResult,
  PlannerInput,
} from "@/modules/plans/types";
import { buildTopicTitle, chooseExternalLinks, chooseInternalLinks, clusterKeywords } from "@/modules/plans/seoRules";

const CHANNEL_PRIORITY: PlanChannel[] = ["blog", "linkedin", "newsletter", "landing"];
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

export type RefreshPlannerClusterInput = {
  clusterId: string;
  clusterLabel: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  performanceState: "high" | "medium" | "low" | "unknown";
  coverageState: "healthy" | "thin" | "missing" | "drifting";
  weight: number;
  rationale: string;
};

export type RefreshPlannerInput = {
  sourcePlanId: string;
  proposalName: string;
  horizonWeeks: number;
  startDateISO: string;
  cadence: { freq: "weekly" | "biweekly"; daysOfWeek: number[] };
  channels: string[];
  clusters: RefreshPlannerClusterInput[];
  internalLinks: Array<{ url: string; title: string; anchorHints: string[] }>;
  externalLinks: Array<{ url: string; title: string }>;
};

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function mondayOfWeek(value: Date): Date {
  const base = startOfDay(value);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diffToMonday);
  return base;
}

function nextMondayFromDate(value: Date): Date {
  const base = startOfDay(value);
  const day = base.getDay();
  const diffToMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  base.setDate(base.getDate() + diffToMonday);
  return base;
}

function weekdayDate(weekMonday: Date, weekday: number): Date {
  const date = startOfDay(weekMonday);
  date.setDate(weekMonday.getDate() + (weekday - 1));
  return date;
}

function isCollisionWithin14Days(keyword: string, date: Date, usedDates: Map<string, Date[]>): boolean {
  const entries = usedDates.get(keyword.toLowerCase()) ?? [];
  for (const existing of entries) {
    const diffDays = Math.abs(startOfDay(existing).getTime() - startOfDay(date).getTime()) / MILLISECONDS_IN_DAY;
    if (diffDays <= 14) {
      return true;
    }
  }
  return false;
}

function registerKeyword(keyword: string, date: Date, usedDates: Map<string, Date[]>): void {
  const normalized = keyword.toLowerCase();
  const entries = usedDates.get(normalized) ?? [];
  entries.push(date);
  usedDates.set(normalized, entries);
}

function toChannels(channels: string[]): PlanChannel[] {
  const normalized = channels
    .map((value) => value.toLowerCase())
    .filter((value): value is PlanChannel => value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing");

  const sorted = CHANNEL_PRIORITY.filter((channel) => normalized.includes(channel));
  return sorted;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function proportionalTargets(
  clusters: RefreshPlannerClusterInput[],
  totalSlots: number,
): Map<string, number> {
  const targets = new Map<string, number>();
  if (totalSlots <= 0 || clusters.length === 0) {
    return targets;
  }

  const totalWeight = clusters.reduce((accumulator, cluster) => accumulator + cluster.weight, 0);
  const safeTotalWeight = totalWeight > 0 ? totalWeight : clusters.length;

  const remainders: Array<{ clusterId: string; fraction: number; clusterLabel: string }> = [];
  let allocated = 0;

  for (const cluster of clusters) {
    const raw = (cluster.weight / safeTotalWeight) * totalSlots;
    const base = Math.floor(raw);
    targets.set(cluster.clusterId, base);
    allocated += base;
    remainders.push({
      clusterId: cluster.clusterId,
      fraction: raw - base,
      clusterLabel: cluster.clusterLabel,
    });
  }

  let remaining = totalSlots - allocated;
  remainders.sort((left, right) => {
    if (right.fraction !== left.fraction) {
      return right.fraction - left.fraction;
    }
    return left.clusterLabel.localeCompare(right.clusterLabel);
  });

  for (const remainder of remainders) {
    if (remaining <= 0) {
      break;
    }
    targets.set(remainder.clusterId, (targets.get(remainder.clusterId) ?? 0) + 1);
    remaining -= 1;
  }

  const required = clusters.filter((cluster) => cluster.coverageState === "missing" || cluster.coverageState === "thin");
  for (const cluster of required) {
    const current = targets.get(cluster.clusterId) ?? 0;
    if (current >= 1) {
      continue;
    }

    const donor = [...clusters]
      .filter((candidate) => candidate.clusterId !== cluster.clusterId)
      .sort((left, right) => {
        const leftCount = targets.get(left.clusterId) ?? 0;
        const rightCount = targets.get(right.clusterId) ?? 0;
        if (rightCount !== leftCount) {
          return rightCount - leftCount;
        }
        if (right.weight !== left.weight) {
          return right.weight - left.weight;
        }
        return left.clusterLabel.localeCompare(right.clusterLabel);
      })
      .find((candidate) => (targets.get(candidate.clusterId) ?? 0) > 1);

    if (donor) {
      targets.set(donor.clusterId, (targets.get(donor.clusterId) ?? 0) - 1);
      targets.set(cluster.clusterId, 1);
    }
  }

  return targets;
}

function channelPriority(channel: string): number {
  return CHANNEL_PRIORITY.indexOf(channel as PlanChannel);
}

export function generateRefreshedPlanProposal(input: RefreshPlannerInput): PlanRefreshResult {
  const startDate = input.startDateISO ? startOfDay(new Date(input.startDateISO)) : nextMondayFromDate(new Date());
  const horizonWeeks = Math.max(1, Math.floor(input.horizonWeeks || 8));
  const normalizedDays = [...input.cadence.daysOfWeek]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((left, right) => left - right);
  const daysOfWeek = normalizedDays.length > 0 ? normalizedDays : [2, 4];

  const channels = toChannels(input.channels);
  const effectiveChannels: PlanChannel[] = channels.length > 0 ? channels : ["blog"];
  const nonNewsletterChannels = effectiveChannels.filter((channel) => channel !== "newsletter");
  const includeNewsletter = effectiveChannels.includes("newsletter");
  const effectiveClusters = [...input.clusters]
    .map((cluster) => ({
      ...cluster,
      weight: clamp(cluster.weight, 0.2, 3.0),
    }))
    .sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }
    return left.clusterLabel.localeCompare(right.clusterLabel);
  });

  const weekStep = input.cadence.freq === "biweekly" ? 2 : 1;
  const baseWeekMonday = mondayOfWeek(startDate);

  const slots: Array<{ date: Date; weekKey: string; channel: PlanChannel }> = [];
  for (let week = 0; week < horizonWeeks; week += weekStep) {
    const weekMonday = new Date(baseWeekMonday);
    weekMonday.setDate(baseWeekMonday.getDate() + week * 7);
    const scheduledDays = daysOfWeek
      .map((weekday) => weekdayDate(weekMonday, weekday))
      .filter((date) => date.getTime() >= startDate.getTime())
      .sort((left, right) => left.getTime() - right.getTime());

    for (const publishDate of scheduledDays) {
      for (const channel of nonNewsletterChannels) {
        slots.push({
          date: publishDate,
          weekKey: mondayOfWeek(publishDate).toISOString(),
          channel,
        });
      }
    }
  }

  const targets = proportionalTargets(effectiveClusters, slots.length);
  const remaining = new Map<string, number>(targets);
  const clusterById = new Map(effectiveClusters.map((cluster) => [cluster.clusterId, cluster] as const));

  const usedKeywordDates = new Map<string, Date[]>();
  const items: PlanItemDraft[] = [];
  const weeklyClusterUsage = new Map<string, Map<string, number>>();
  let collisionsAvoided = 0;
  let clusterPointer = 0;

  for (const slot of slots) {
    const ordered = effectiveClusters;

    let preferred: RefreshPlannerClusterInput | null = null;
    for (let offset = 0; offset < ordered.length; offset += 1) {
      const index = (clusterPointer + offset) % ordered.length;
      const candidate = ordered[index];
      const quota = remaining.get(candidate.clusterId) ?? 0;
      if (quota > 0) {
        preferred = candidate;
        break;
      }
    }

    if (!preferred) {
      continue;
    }

    let selected = preferred;
    if (isCollisionWithin14Days(preferred.primaryKeyword, slot.date, usedKeywordDates)) {
      let replacement: RefreshPlannerClusterInput | null = null;
      for (let offset = 1; offset < ordered.length; offset += 1) {
        const index = (clusterPointer + offset) % ordered.length;
        const candidate = ordered[index];
        const quota = remaining.get(candidate.clusterId) ?? 0;
        if (quota <= 0) {
          continue;
        }
        if (!isCollisionWithin14Days(candidate.primaryKeyword, slot.date, usedKeywordDates)) {
          replacement = candidate;
          break;
        }
      }

      if (replacement) {
        selected = replacement;
        collisionsAvoided += 1;
      }
    }

    remaining.set(selected.clusterId, (remaining.get(selected.clusterId) ?? 0) - 1);
    registerKeyword(selected.primaryKeyword, slot.date, usedKeywordDates);

    const usageByWeek = weeklyClusterUsage.get(slot.weekKey) ?? new Map<string, number>();
    usageByWeek.set(selected.clusterId, (usageByWeek.get(selected.clusterId) ?? 0) + 1);
    weeklyClusterUsage.set(slot.weekKey, usageByWeek);

    items.push({
      publishDate: slot.date.toISOString(),
      channel: slot.channel,
      title: buildTopicTitle(
        {
          id: selected.clusterId,
          label: selected.clusterLabel,
          primaryKeyword: selected.primaryKeyword,
          secondaryKeywords: selected.secondaryKeywords,
        },
        selected.primaryKeyword,
        slot.channel,
      ),
      primaryKeyword: selected.primaryKeyword,
      secondaryKeywords: selected.secondaryKeywords.slice(0, 3),
      clusterId: selected.clusterId,
      clusterLabel: selected.clusterLabel,
      note: selected.performanceState === "low" ? "(test)" : "",
      internalLinkSuggestions: chooseInternalLinks(input.internalLinks, {
        id: selected.clusterId,
        label: selected.clusterLabel,
        primaryKeyword: selected.primaryKeyword,
        secondaryKeywords: selected.secondaryKeywords,
      }),
      externalLinkSuggestions: chooseExternalLinks(input.externalLinks, {
        id: selected.clusterId,
        label: selected.clusterLabel,
        primaryKeyword: selected.primaryKeyword,
        secondaryKeywords: selected.secondaryKeywords,
      }),
    });

    const selectedIndex = ordered.findIndex((cluster) => cluster.clusterId === selected.clusterId);
    clusterPointer = selectedIndex >= 0 ? (selectedIndex + 1) % ordered.length : clusterPointer;
  }

  if (includeNewsletter) {
    const weeks = [...new Set(slots.map((slot) => slot.weekKey))].sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
    for (const weekKey of weeks) {
      const weekStart = new Date(weekKey);
      const usage = weeklyClusterUsage.get(weekKey) ?? new Map<string, number>();
      const topClusters = [...usage.keys()]
        .map((clusterId) => clusterById.get(clusterId))
        .filter((entry): entry is RefreshPlannerClusterInput => Boolean(entry))
        .sort((left, right) => {
          if (right.weight !== left.weight) {
            return right.weight - left.weight;
          }
          return left.clusterLabel.localeCompare(right.clusterLabel);
        })
        .slice(0, 2);

      const first = topClusters[0] ?? effectiveClusters[0];
      const second = topClusters[1] ?? effectiveClusters[1] ?? first;

      if (!first || !second) {
        continue;
      }

      const syntheticCluster: PlanKeywordCluster = {
        id: `${first.clusterId}+${second.clusterId}`,
        label: `${first.clusterLabel} & ${second.clusterLabel}`,
        primaryKeyword: first.primaryKeyword,
        secondaryKeywords: [...first.secondaryKeywords, ...second.secondaryKeywords].slice(0, 3),
      };

      items.push({
        publishDate: weekStart.toISOString(),
        channel: "newsletter",
        title: buildTopicTitle(syntheticCluster, syntheticCluster.primaryKeyword, "newsletter"),
        primaryKeyword: syntheticCluster.primaryKeyword,
        secondaryKeywords: syntheticCluster.secondaryKeywords,
        clusterId: syntheticCluster.id,
        clusterLabel: syntheticCluster.label,
        note: `Newsletter tygodniowy: ${first.clusterLabel}, ${second.clusterLabel}`,
        internalLinkSuggestions: chooseInternalLinks(input.internalLinks, syntheticCluster),
        externalLinkSuggestions: chooseExternalLinks(input.externalLinks, syntheticCluster),
      });
    }
  }

  items.sort((left, right) => {
    const dateDiff = new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return channelPriority(left.channel) - channelPriority(right.channel);
  });

  return {
    proposal: {
      name: input.proposalName,
      startDate: startDate.toISOString(),
      cadence: {
        freq: input.cadence.freq,
        daysOfWeek,
      },
      channels: effectiveChannels,
      items,
    },
    diagnostics: {
      sourcePlanId: input.sourcePlanId,
      horizonWeeks,
      startDate: startDate.toISOString(),
      clusterStats: effectiveClusters.map((cluster) => ({
        clusterId: cluster.clusterId,
        clusterLabel: cluster.clusterLabel,
        performanceState: cluster.performanceState,
        coverageState: cluster.coverageState,
        weight: cluster.weight,
        rationale: cluster.rationale,
      })),
      totalItems: items.length,
      collisionsAvoided,
    },
  };
}

function resolveCluster(
  requestedIndex: number,
  scheduledDate: Date,
  clusters: PlanKeywordCluster[],
  usedDates: Map<string, Date[]>,
): { cluster: PlanKeywordCluster; index: number; collisionsAvoided: number } {
  let collisionsAvoided = 0;

  for (let offset = 0; offset < clusters.length; offset += 1) {
    const index = (requestedIndex + offset) % clusters.length;
    const candidate = clusters[index];
    if (!candidate) {
      continue;
    }

    if (!isCollisionWithin14Days(candidate.primaryKeyword, scheduledDate, usedDates)) {
      return { cluster: candidate, index, collisionsAvoided };
    }

    collisionsAvoided += 1;
  }

  const fallbackIndex = requestedIndex % clusters.length;
  return {
    cluster: clusters[fallbackIndex]!,
    index: fallbackIndex,
    collisionsAvoided,
  };
}

type ClusterSelection = {
  cluster: PlanKeywordCluster;
  index: number;
  collisionsAvoided: number;
};

function createDraft(params: {
  date: Date;
  channel: PlanChannel;
  cluster: PlanKeywordCluster;
  note: string;
  internalLinks: ReturnType<typeof chooseInternalLinks>;
  externalLinks: ReturnType<typeof chooseExternalLinks>;
}): PlanItemDraft {
  return {
    publishDate: params.date.toISOString(),
    channel: params.channel,
    title: buildTopicTitle(params.cluster, params.cluster.primaryKeyword, params.channel),
    primaryKeyword: params.cluster.primaryKeyword,
    secondaryKeywords: params.cluster.secondaryKeywords.slice(0, 3),
    clusterId: params.cluster.id,
    clusterLabel: params.cluster.label,
    note: params.note,
    internalLinkSuggestions: params.internalLinks,
    externalLinkSuggestions: params.externalLinks,
  };
}

export function generatePublicationPlan(params: PlannerInput): PlanGenerationResult {
  const parsedStartDate = startOfDay(new Date(params.startDate));
  const daysOfWeek = [...params.cadence.daysOfWeek]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((left, right) => left - right);

  const channels = toChannels(params.channels);
  const clusters = clusterKeywords(params.projectContext.keywordsPrimary, params.projectContext.keywordsSecondary);

  const fallbackCluster: PlanKeywordCluster = {
    id: "general",
    label: "general",
    primaryKeyword: "content operations",
    secondaryKeywords: ["editorial workflow"],
  };

  const effectiveClusters = clusters.length > 0 ? clusters : [fallbackCluster];
  const generatedItems: PlanItemDraft[] = [];
  const usedKeywordDates = new Map<string, Date[]>();

  let collisionsAvoided = 0;
  let clusterCursor = 0;

  const weekStep = params.cadence.freq === "biweekly" ? 2 : 1;
  const baseWeekMonday = mondayOfWeek(parsedStartDate);

  for (let week = 0; week < params.horizonWeeks; week += weekStep) {
    const weekMonday = new Date(baseWeekMonday);
    weekMonday.setDate(baseWeekMonday.getDate() + week * 7);

    const scheduledDays = daysOfWeek
      .map((weekday) => weekdayDate(weekMonday, weekday))
      .filter((date) => date.getTime() >= parsedStartDate.getTime())
      .sort((left, right) => left.getTime() - right.getTime());

    let newsletterCreated = false;
    let weekBlogCluster: PlanKeywordCluster | null = null;
    const weekTopClusters: PlanKeywordCluster[] = [];

    for (const publishDate of scheduledDays) {
      for (const channel of channels) {
        if (channel === "newsletter" && newsletterCreated) {
          continue;
        }

        let selectedClusterResult: ClusterSelection;

        if (channel === "linkedin" && weekBlogCluster) {
          selectedClusterResult = {
            cluster: weekBlogCluster,
            index: effectiveClusters.findIndex((cluster) => cluster.id === weekBlogCluster?.id),
            collisionsAvoided: 0,
          };
        } else if (channel === "newsletter") {
          const firstCluster = weekTopClusters[0] ?? effectiveClusters[clusterCursor % effectiveClusters.length]!;
          const secondCluster = weekTopClusters[1] ?? effectiveClusters[(clusterCursor + 1) % effectiveClusters.length]!;
          selectedClusterResult = {
            cluster: {
              id: `${firstCluster.id}+${secondCluster.id}`,
              label: `${firstCluster.label} & ${secondCluster.label}`,
              primaryKeyword: firstCluster.primaryKeyword,
              secondaryKeywords: [...firstCluster.secondaryKeywords, ...secondCluster.secondaryKeywords].slice(0, 3),
            },
            index: clusterCursor,
            collisionsAvoided: 0,
          };
        } else {
          selectedClusterResult = resolveCluster(clusterCursor, publishDate, effectiveClusters, usedKeywordDates);
          collisionsAvoided += selectedClusterResult.collisionsAvoided;
        }

        const selectedCluster = selectedClusterResult.cluster;

        if (channel !== "newsletter") {
          registerKeyword(selectedCluster.primaryKeyword, publishDate, usedKeywordDates);
          clusterCursor = (selectedClusterResult.index + 1) % effectiveClusters.length;
        }

        if (channel === "blog" && !weekBlogCluster) {
          weekBlogCluster = selectedCluster;
        }

        if (channel !== "newsletter" && weekTopClusters.length < 2) {
          if (!weekTopClusters.some((cluster) => cluster.id === selectedCluster.id)) {
            weekTopClusters.push(selectedCluster);
          }
        }

        generatedItems.push(
          createDraft({
            date: publishDate,
            channel,
            cluster: selectedCluster,
            note: channel === "newsletter" ? "Weekly aggregation for top clusters" : "",
            internalLinks: chooseInternalLinks(params.projectContext.internalLinks, selectedCluster),
            externalLinks: chooseExternalLinks(params.projectContext.externalLinks, selectedCluster),
          }),
        );

        if (channel === "newsletter") {
          newsletterCreated = true;
        }
      }
    }
  }

  generatedItems.sort((left, right) => {
    const dateDiff = new Date(left.publishDate).getTime() - new Date(right.publishDate).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return CHANNEL_PRIORITY.indexOf(left.channel) - CHANNEL_PRIORITY.indexOf(right.channel);
  });

  return {
    items: generatedItems,
    diagnostics: {
      clustersCount: effectiveClusters.length,
      collisionsAvoided,
      totalItemsGenerated: generatedItems.length,
      firstDate: generatedItems[0]?.publishDate ?? null,
      lastDate: generatedItems[generatedItems.length - 1]?.publishDate ?? null,
    },
  };
}
