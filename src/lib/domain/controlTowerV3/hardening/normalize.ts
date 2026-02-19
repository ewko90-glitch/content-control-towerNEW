import type { ControlTowerDecisionSnapshot } from "../snapshot";
import type { ActionCard, DecisionWarning } from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function urgencyRank(urgency: "low" | "medium" | "high" | undefined): number {
  if (urgency === "high") {
    return 3;
  }
  if (urgency === "medium") {
    return 2;
  }
  return 1;
}

function confidenceLabel(score: number): "Niska" | "Średnia" | "Wysoka" {
  if (score >= 0.75) {
    return "Wysoka";
  }
  if (score >= 0.4) {
    return "Średnia";
  }
  return "Niska";
}

function warningSeverityRank(severity: "low" | "medium" | "high"): number {
  if (severity === "high") {
    return 3;
  }
  if (severity === "medium") {
    return 2;
  }
  return 1;
}

function normalizeWarningList(warnings: DecisionWarning[]): DecisionWarning[] {
  const deduped = new Map<string, DecisionWarning>();

  for (const warning of warnings) {
    const existing = deduped.get(warning.code);
    if (!existing || warningSeverityRank(warning.severity) > warningSeverityRank(existing.severity)) {
      deduped.set(warning.code, warning);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => left.code.localeCompare(right.code));
}

function normalizeActionCard(action: ActionCard, index: number): ActionCard | null {
  const id = typeof action.id === "string" && action.id.length > 0 ? action.id : typeof action.key === "string" ? action.key : "";
  const title = typeof action.title === "string" ? action.title.trim() : "";
  const description = typeof action.description === "string" ? action.description.trim() : "";
  const urgency = action.urgency === "high" || action.urgency === "medium" || action.urgency === "low" ? action.urgency : undefined;

  if (!id || !title || !description || !urgency) {
    return null;
  }

  const normalizedConfidence = clamp(
    typeof action.confidence?.score === "number" && Number.isFinite(action.confidence.score)
      ? action.confidence.score
      : typeof action.confidenceValue === "number" && Number.isFinite(action.confidenceValue)
        ? action.confidenceValue
        : 0.5,
    0.2,
    0.95,
  );

  const executionPriority =
    typeof action.executionPriority === "number" && Number.isFinite(action.executionPriority) ? action.executionPriority : 0;

  const dedupeKey =
    action.idempotency?.dedupeKey && action.idempotency.dedupeKey.length > 0
      ? action.idempotency.dedupeKey
      : `${action.intent ?? action.type ?? action.actionType ?? "review_risks"}:${id}`;

  return {
    ...action,
    id,
    key: action.key || `action-${index + 1}`,
    urgency,
    executionPriority,
    confidenceValue: normalizedConfidence,
    confidence: {
      score: normalizedConfidence,
      label: confidenceLabel(normalizedConfidence),
    },
    idempotency: {
      dedupeKey,
      cooldownSeconds: action.idempotency?.cooldownSeconds,
    },
  };
}

function normalizeActionCards(actions: ActionCard[], state: ControlTowerDecisionSnapshot["state"]): ActionCard[] {
  const normalized = actions
    .map((action, index) => normalizeActionCard(action, index))
    .filter((action): action is ActionCard => Boolean(action));

  const sorted = [...normalized].sort((left, right) => {
    const urgencyDelta = urgencyRank(right.urgency) - urgencyRank(left.urgency);
    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }

    const priorityDelta = (right.executionPriority ?? 0) - (left.executionPriority ?? 0);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const confidenceDelta = (right.confidence?.score ?? 0) - (left.confidence?.score ?? 0);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return (left.id ?? "").localeCompare(right.id ?? "");
  });

  const byDedupe = new Set<string>();
  const byId = new Set<string>();
  const deduped: ActionCard[] = [];

  for (const action of sorted) {
    const dedupeKey = action.idempotency?.dedupeKey ?? "";
    const id = action.id ?? "";

    if (!dedupeKey || !id) {
      continue;
    }

    if (byDedupe.has(dedupeKey) || byId.has(id)) {
      continue;
    }

    byDedupe.add(dedupeKey);
    byId.add(id);
    deduped.push(action);
  }

  const capped = deduped.slice(0, 5);

  if (state === "empty") {
    return capped.slice(0, 2);
  }

  if (state === "degraded" && capped.length === 0) {
    const safeAction: ActionCard = {
      id: "ctv3:normalized:review_risks",
      key: "ctv3:normalized:review_risks",
      intent: "review_risks",
      type: "review",
      actionType: "review",
      urgency: "medium",
      executionPriority: 0,
      severity: "warning",
      title: "Review structural risks",
      description: "Data quality is degraded. Review risks safely.",
      why: "Snapshot normalization injected a safe fallback action.",
      impact: {
        score: 40,
        label: "Średni",
      },
      confidence: {
        score: 0.4,
        label: "Średnia",
      },
      confidenceValue: 0.4,
      cta: {
        label: "Open",
        href: "/overview#risks",
      },
      target: {
        route: "/overview",
        hash: "risks",
      },
      permissions: {
        canExecute: true,
      },
      idempotency: {
        dedupeKey: "review_risks:risks",
        cooldownSeconds: 43200,
      },
    };

    return [safeAction];
  }

  return capped;
}

export function normalizeDecisionSnapshot(snapshot: ControlTowerDecisionSnapshot): ControlTowerDecisionSnapshot {
  const warnings = normalizeWarningList(Array.isArray(snapshot.warnings) ? snapshot.warnings : []);
  const riskFlags = Array.isArray(snapshot.riskFlags) ? snapshot.riskFlags : [];
  const actionCards = normalizeActionCards(Array.isArray(snapshot.actionCards) ? snapshot.actionCards : [], snapshot.state);
  const scoreBreakdown = Array.isArray(snapshot.reasoning?.scoreBreakdown) ? snapshot.reasoning.scoreBreakdown : [];
  const mainRiskDrivers = Array.isArray(snapshot.reasoning?.mainRiskDrivers) ? snapshot.reasoning.mainRiskDrivers : [];

  const normalizedHealthScore = clamp(snapshot.healthScore, 0, 100);
  const stateHealthScore = snapshot.state === "empty" ? Math.max(80, normalizedHealthScore) : normalizedHealthScore;

  return {
    ...snapshot,
    healthScore: stateHealthScore,
    structuralRiskScore:
      typeof snapshot.structuralRiskScore === "number" && Number.isFinite(snapshot.structuralRiskScore)
        ? clamp(snapshot.structuralRiskScore, 0, 1)
        : snapshot.structuralRiskScore,
    warnings,
    riskFlags,
    actionCards,
    reasoning: {
      scoreBreakdown,
      mainRiskDrivers,
      structuralSummary: snapshot.reasoning?.structuralSummary ?? "",
    },
  };
}
