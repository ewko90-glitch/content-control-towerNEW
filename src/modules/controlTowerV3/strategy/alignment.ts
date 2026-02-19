import type { OutcomeEvent } from "@/lib/domain/controlTowerV3/feedback/types";
import type {
  StrategicAlignmentInput,
  StrategicAlignmentResult,
  StrategicArtifact,
  StrategicMatch,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

function resolveNowIso(nowIso?: string): string {
  if (typeof nowIso !== "string") {
    return "1970-01-01T00:00:00.000Z";
  }

  const trimmed = nowIso.trim();
  if (trimmed.length === 0) {
    return "1970-01-01T00:00:00.000Z";
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "1970-01-01T00:00:00.000Z";
  }

  return parsed.toISOString();
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right));
}

function artifactTokens(artifact: StrategicArtifact): string[] {
  const tags = Array.isArray(artifact.tags) ? artifact.tags.join(" ") : "";
  return uniqueSorted(tokenize(`${artifact.title} ${artifact.intent} ${tags}`));
}

function actionText(action: { title?: string; name?: string; type?: string; kind?: string }): string {
  return `${action.title ?? ""} ${action.name ?? ""} ${action.type ?? ""} ${action.kind ?? ""}`.trim();
}

function computeStrength(artifact: StrategicArtifact, action: { title?: string; name?: string; type?: string; kind?: string }): number {
  const artifactBag = artifactTokens(artifact);
  const actionBag = uniqueSorted(tokenize(actionText(action)));
  if (artifactBag.length === 0 || actionBag.length === 0) {
    return 0;
  }

  const actionSet = new Set(actionBag);
  const hits = artifactBag.filter((token) => actionSet.has(token)).length;
  const normalizer = Math.max(2, Math.min(artifactBag.length, actionBag.length));
  return Math.min(1, hits / normalizer);
}

function createdAtMs(input: string | undefined): number {
  const value = input ? new Date(input).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function resolveTopMatch(
  artifacts: StrategicArtifact[],
  action: { id?: string; title?: string; name?: string; type?: string; kind?: string },
): StrategicMatch | null {
  const candidates = artifacts
    .map((artifact) => ({
      artifact,
      strength: computeStrength(artifact, action),
    }))
    .filter((entry) => entry.strength >= 0.25)
    .sort((left, right) => {
      if (right.strength !== left.strength) {
        return right.strength - left.strength;
      }

      const leftCreated = createdAtMs(left.artifact.createdAt);
      const rightCreated = createdAtMs(right.artifact.createdAt);
      if (rightCreated !== leftCreated) {
        return rightCreated - leftCreated;
      }

      return left.artifact.id.localeCompare(right.artifact.id);
    });

  const top = candidates[0];
  if (!top) {
    return null;
  }

  return {
    artifactId: top.artifact.id,
    actionId: action.id,
    signal: "keyword",
    strength: top.strength,
  };
}

function confidenceLabel(params: { artifacts: number; actions: number }): "low" | "medium" | "high" {
  if (params.artifacts >= 3 && params.actions >= 8) {
    return "high";
  }
  if (params.artifacts >= 1 && params.actions >= 5) {
    return "medium";
  }
  return "low";
}

function recentWindow(events: OutcomeEvent[], days: number, nowIso: string): OutcomeEvent[] {
  const now = new Date(nowIso).getTime();
  const min = now - days * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(now)) {
    return [];
  }

  return events.filter((event) => {
    const ts = new Date(event.occurredAt).getTime();
    return Number.isFinite(ts) && ts >= min;
  });
}

function recommendations(params: {
  artifacts: StrategicArtifact[];
  negativesMatched: number;
  driftDetected: boolean;
  alignmentScore: number;
}): Array<{ title: string; why: string; effort: "S" | "M" | "L" }> {
  const output: Array<{ title: string; why: string; effort: "S" | "M" | "L" }> = [];

  const activePriorities = params.artifacts.filter((artifact) => artifact.status === "active" && artifact.type === "priority");
  const missingSuccessMetric = params.artifacts.some(
    (artifact) => artifact.status === "active" && artifact.type === "experiment" && !artifact.successMetric,
  );

  if (activePriorities.length === 0) {
    output.push({
      title: "Dodaj priorytet",
      why: "Brak aktywnego priorytetu obniża spójność działań.",
      effort: "S",
    });
  }

  if (params.driftDetected || params.alignmentScore < 70) {
    output.push({
      title: "Wybierz 1 priorytet na 7 dni",
      why: "Skupienie redukuje rozproszenie działań.",
      effort: "S",
    });
    output.push({
      title: "Zamknij 3 otwarte pętle (approve/reject)",
      why: "Porządkuje backlog decyzyjny i zmniejsza dryf.",
      effort: "M",
    });
  }

  if (missingSuccessMetric) {
    output.push({
      title: "Zdefiniuj success metric dla eksperymentu",
      why: "Bez metryki nie da się ocenić wartości testu.",
      effort: "S",
    });
  }

  if (params.negativesMatched > 0) {
    output.push({
      title: "Stop/Adjust eksperyment",
      why: "Negatywne outcomes sugerują potrzebę korekty hipotezy.",
      effort: "M",
    });
  }

  output.push({
    title: "Zarchiwizuj martwe hipotezy",
    why: "Usuwa szum i wzmacnia czytelność kierunku.",
    effort: "S",
  });

  return output.slice(0, 5);
}

export function computeStrategicAlignment(input: StrategicAlignmentInput): StrategicAlignmentResult {
  const nowIso = resolveNowIso(input.nowIso);
  const artifacts = Array.isArray(input.artifacts) ? [...input.artifacts] : [];
  const actionsInput = Array.isArray(input.recentActions) ? [...input.recentActions] : [];
  const outcomesInput = Array.isArray(input.outcomes) ? [...input.outcomes] : [];

  const activeArtifacts = artifacts.filter((artifact) => artifact.status === "active");

  const actions = actionsInput.map((action, index) => ({
    id: action.id ?? `action-${index + 1}`,
    title: action.title,
    name: action.name,
    type: action.type,
    kind: action.kind,
  }));

  const matches = actions
    .map((action) => resolveTopMatch(activeArtifacts, action))
    .filter((entry): entry is StrategicMatch => entry !== null);

  const matchedActionIds = new Set(
    matches
      .map((match) => match.actionId)
      .filter((actionId): actionId is string => typeof actionId === "string" && actionId.length > 0),
  );
  const totalActions = actions.length;
  const matchedActions = matchedActionIds.size;
  const coverage = totalActions > 0 ? matchedActions / totalActions : 0;
  const scoreCoverage = clamp(Math.round(coverage * 40), 0, 40);

  const priorityIds = new Set(activeArtifacts.filter((artifact) => artifact.type === "priority").map((artifact) => artifact.id));
  const byPriority = new Map<string, number>();
  for (const match of matches) {
    if (priorityIds.has(match.artifactId)) {
      byPriority.set(match.artifactId, (byPriority.get(match.artifactId) ?? 0) + 1);
    }
  }

  const totalPriorityMatches = Array.from(byPriority.values()).reduce((sum, value) => sum + value, 0);
  const top1Share = totalPriorityMatches > 0 ? Math.max(...Array.from(byPriority.values())) / totalPriorityMatches : 0;

  let scoreFocus = top1Share >= 0.45 ? 30 : top1Share >= 0.3 ? 22 : 12;
  if (byPriority.size > 3) {
    scoreFocus = Math.max(0, scoreFocus - 6);
  }

  const matchedArtifactIds = new Set(matches.map((match) => match.artifactId));
  const recentOutcomes = recentWindow(outcomesInput, 14, nowIso);
  const negativeOutcomes = recentOutcomes.filter((event) => event.outcome === "abandoned" || event.outcome === "ignored");
  const wins = recentOutcomes.filter((event) => event.outcome === "completed");

  const negativesMatched = negativeOutcomes.filter((event) => {
    const text = `${event.intent} ${event.evidence.details ?? ""}`;
    return activeArtifacts.some((artifact) => {
      if (!matchedArtifactIds.has(artifact.id)) {
        return false;
      }
      const tokens = artifactTokens(artifact);
      const normalized = tokenize(text);
      const set = new Set(normalized);
      const hits = tokens.filter((token) => set.has(token)).length;
      return hits >= 1;
    });
  }).length;

  const winsMatched = wins.filter((event) => {
    const text = `${event.intent} ${event.evidence.details ?? ""}`;
    return activeArtifacts
      .filter((artifact) => artifact.type === "priority")
      .some((artifact) => artifactTokens(artifact).some((token) => tokenize(text).includes(token)));
  }).length;

  let scoreOutcome = 10;
  if (winsMatched > 0) {
    scoreOutcome += 10;
  }
  if (negativesMatched > 0) {
    scoreOutcome -= 10;
  }
  scoreOutcome = clamp(scoreOutcome, 0, 20);

  const adhocRatio = totalActions > 0 ? (totalActions - matchedActions) / totalActions : 0;
  const driftSignalStrong = adhocRatio >= 0.65 || negativesMatched >= 2;
  const scoreDrift = driftSignalStrong ? 0 : 10;

  const alignmentScore = clamp(scoreCoverage + scoreFocus + scoreOutcome + scoreDrift, 0, 100);

  const driftDetected =
    (coverage < 0.35 && totalActions >= 8) ||
    negativesMatched >= 2 ||
    (top1Share < 0.25 && totalActions >= 10);

  const driftReason = driftDetected
    ? coverage < 0.35 && totalActions >= 8
      ? "Zbyt wiele działań nie wspiera aktywnych priorytetów."
      : negativesMatched >= 2
        ? "Powtarzają się negatywne outcomes w obszarach strategicznych."
        : "Fokus działań jest rozproszony między zbyt wiele priorytetów."
    : undefined;

  const topAligned = matches
    .map((match) => {
      const artifact = activeArtifacts.find((item) => item.id === match.artifactId);
      return artifact
        ? {
            artifactId: artifact.id,
            title: artifact.title,
            strength: match.strength,
          }
        : null;
    })
    .filter((entry): entry is { artifactId: string; title: string; strength: number } => entry !== null)
    .sort((left, right) => right.strength - left.strength || left.artifactId.localeCompare(right.artifactId))
    .slice(0, 5);

  const topMisaligned = [
    coverage < 0.35
      ? {
          reason: "Niski coverage działań",
          evidence: `${matchedActions}/${totalActions || 0} działań dopasowanych do strategii.`,
          severity: "high" as const,
        }
      : null,
    byPriority.size > 3
      ? {
          reason: "Rozproszenie priorytetów",
          evidence: `Aktywne działania dotykają ${byPriority.size} priorytetów.`,
          severity: "medium" as const,
        }
      : null,
    negativesMatched > 0
      ? {
          reason: "Negatywne outcomes",
          evidence: `${negativesMatched} negatywnych sygnałów strategicznych.`,
          severity: negativesMatched >= 2 ? ("high" as const) : ("medium" as const),
        }
      : null,
  ]
    .filter((entry): entry is { reason: string; evidence: string; severity: "medium" | "high" } => entry !== null)
    .slice(0, 5);

  return {
    alignmentScore,
    confidence: confidenceLabel({ artifacts: activeArtifacts.length, actions: totalActions }),
    driftDetected,
    driftReason,
    topAligned,
    topMisaligned,
    recommendedCorrections: recommendations({
      artifacts: activeArtifacts,
      negativesMatched,
      driftDetected,
      alignmentScore,
    }),
    diagnostics: {
      inputs: {
        artifacts: activeArtifacts.length,
        actions: totalActions,
        outcomes: outcomesInput.length,
      },
      notes: [
        `coverage=${coverage.toFixed(2)}`,
        `focusTop1=${top1Share.toFixed(2)}`,
        `negatives=${negativesMatched}`,
      ],
    },
  };
}
