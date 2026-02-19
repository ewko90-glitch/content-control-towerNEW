import type { ExternalLink, InternalLink } from "@/modules/projects/types";
import type { LinkSuggestion, PlanChannel, PlanKeywordCluster } from "@/modules/plans/types";

function firstToken(keyword: string): string {
  const normalized = keyword.trim().toLowerCase();
  if (normalized.length === 0) {
    return "general";
  }
  return normalized.split(/\s+/)[0] ?? "general";
}

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

export function clusterKeywords(primary: string[], secondary: string[]): PlanKeywordCluster[] {
  const primaryClean = primary.map((value) => value.trim()).filter((value) => value.length > 0);
  const secondaryClean = secondary.map((value) => value.trim()).filter((value) => value.length > 0);

  const clusters: PlanKeywordCluster[] = [];
  const clusterIndexByToken = new Map<string, number>();

  for (const keyword of primaryClean) {
    const token = firstToken(keyword);
    if (clusterIndexByToken.has(token)) {
      continue;
    }

    const cluster: PlanKeywordCluster = {
      id: token,
      label: token,
      primaryKeyword: keyword,
      secondaryKeywords: [],
    };

    clusters.push(cluster);
    clusterIndexByToken.set(token, clusters.length - 1);
  }

  for (const keyword of secondaryClean) {
    const token = firstToken(keyword);
    const clusterIndex = clusterIndexByToken.get(token) ?? 0;
    const cluster = clusters[clusterIndex];

    if (!cluster) {
      continue;
    }

    if (cluster.secondaryKeywords.length >= 3) {
      continue;
    }

    if (cluster.secondaryKeywords.includes(keyword)) {
      continue;
    }

    cluster.secondaryKeywords.push(keyword);
  }

  return clusters;
}

export function buildTopicTitle(cluster: PlanKeywordCluster, primaryKeyword: string, channel: PlanChannel): string {
  if (channel === "blog") {
    if (primaryKeyword.length % 2 === 0) {
      return `Jak ${primaryKeyword} wspiera wynik biznesowy`;
    }
    return `${primaryKeyword}: plan wdrożenia krok po kroku`;
  }

  if (channel === "linkedin") {
    return `${primaryKeyword}: co działa w praktyce?`;
  }

  if (channel === "newsletter") {
    return `Weekly: ${primaryKeyword}`;
  }

  return `${cluster.label}: strona lądowania pod konwersję`;
}

export function chooseInternalLinks(links: InternalLink[], cluster: PlanKeywordCluster): LinkSuggestion[] {
  if (links.length === 0) {
    return [];
  }

  const startIndex = stableHash(cluster.id) % links.length;
  const picks: LinkSuggestion[] = [];

  for (let offset = 0; offset < links.length && picks.length < 2; offset += 1) {
    const candidate = links[(startIndex + offset) % links.length];
    if (!candidate) {
      continue;
    }

    if (picks.some((pick) => pick.url === candidate.url)) {
      continue;
    }

    picks.push({
      url: candidate.url,
      title: candidate.title,
      anchorHint: candidate.anchorHints[0] ?? cluster.label,
    });
  }

  return picks;
}

export function chooseExternalLinks(links: ExternalLink[], cluster: PlanKeywordCluster): LinkSuggestion[] {
  if (links.length === 0) {
    return [];
  }

  const index = stableHash(`external:${cluster.id}`) % links.length;
  const selected = links[index];

  if (!selected) {
    return [];
  }

  return [
    {
      url: selected.url,
      title: selected.title,
    },
  ];
}
