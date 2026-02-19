export type PolicyAuditEntry = {
  timestampISO: string;
  actor: string;
  changes: string[];
};

export type PublicationApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type PublicationApproval = {
  status: PublicationApprovalStatus;
  decidedAt?: string;
  decidedBy?: string;
  comment?: string;
  requestedAt?: string;
  requestedBy?: string;
};

export type SubscriptionPlan = "starter" | "growth" | "control_tower" | "enterprise";

export type ProjectSubscription = {
  plan: SubscriptionPlan;
  seatsLimit: number;
  pdfMonthlyLimit: number;
  aiMonthlyLimitOverride?: number;
};

export type WorkspaceEntitlements = {
  plan: SubscriptionPlan;
  seatsLimit: number;
  pdfMonthlyLimit: number;
  aiMonthlyLimit: number;
};

export type WorkspaceUsage = {
  aiThisMonth: number;
  pdfThisMonth: number;
  seatsUsed: number;
};

export type UsageBlockReason =
  | "AI_DISABLED_BY_POLICY"
  | "AI_MONTHLY_LIMIT_REACHED"
  | "PDF_MONTHLY_LIMIT_REACHED"
  | "PDF_NOT_AVAILABLE_IN_PLAN";

export type UsageCheckResult = {
  ok: boolean;
  reason?: UsageBlockReason;
  limit: number;
  used: number;
};

export type ProjectPolicies = {
  subscription: ProjectSubscription;
  ai: {
    enabled: boolean;
    monthlyLimit: number;
    usageThisMonth: number;
    lastResetAt: string;
  };
  pdf: {
    usageThisMonth: number;
    lastResetAt: string;
  };
  publishing: {
    requireApproval: boolean;
  };
  audit: {
    lastChangedAt?: string;
    lastChangedBy?: string;
  };
  policyAudit: PolicyAuditEntry[];
};

type PartialProjectPolicies = {
  subscription?: {
    plan?: SubscriptionPlan;
    seatsLimit?: number;
    pdfMonthlyLimit?: number;
    aiMonthlyLimitOverride?: number;
  };
  ai?: {
    enabled?: boolean;
    monthlyLimit?: number;
    usageThisMonth?: number;
    lastResetAt?: string;
  };
  pdf?: {
    usageThisMonth?: number;
    lastResetAt?: string;
  };
  publishing?: {
    requireApproval?: boolean;
  };
  audit?: {
    lastChangedAt?: string;
    lastChangedBy?: string;
  };
  policyAudit?: Array<{
    timestampISO?: string;
    actor?: string;
    changes?: string[];
  }>;
};

type ProjectWithPolicies = {
  policies?: PartialProjectPolicies;
};

const MAX_MONTHLY_LIMIT = 100000;
const MAX_AUDIT_ENTRIES = 50;
const DEFAULT_ACTOR = "system-policy";
const MAX_UNLIMITED = 9999;
const workspacePolicyState = new Map<string, ProjectPolicies>();
const workspacePublicationApprovalState = new Map<string, Map<string, PublicationApproval>>();
const workspaceSeatsUsageState = new Map<string, { seatsUsed: number }>();

const PLAN_DEFAULTS: Record<SubscriptionPlan, { seatsLimit: number; pdfMonthlyLimit: number; aiMonthlyLimit: number }> = {
  starter: { seatsLimit: 1, pdfMonthlyLimit: 0, aiMonthlyLimit: 50 },
  growth: { seatsLimit: 3, pdfMonthlyLimit: 5, aiMonthlyLimit: 200 },
  control_tower: { seatsLimit: 10, pdfMonthlyLimit: 25, aiMonthlyLimit: 1000 },
  enterprise: { seatsLimit: MAX_UNLIMITED, pdfMonthlyLimit: MAX_UNLIMITED, aiMonthlyLimit: MAX_UNLIMITED },
};

function nowISO(): string {
  return new Date().toISOString();
}

function monthStartISO(reference: Date): string {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidISO(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function clampInteger(value: unknown, min: number, max?: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  const floored = Math.floor(parsed);
  if (max === undefined) {
    return Math.max(min, floored);
  }

  return Math.min(max, Math.max(min, floored));
}

function normalizeActor(value: string): string {
  const candidate = value.trim();
  return candidate.length > 0 ? candidate : DEFAULT_ACTOR;
}

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeOptionalISO(value: unknown): string | undefined {
  return isValidISO(value) ? value : undefined;
}

function normalizePlan(value: unknown): SubscriptionPlan {
  if (value === "starter" || value === "growth" || value === "control_tower" || value === "enterprise") {
    return value;
  }

  return "starter";
}

function clampLimit(value: unknown): number {
  return clampInteger(value, 0, MAX_UNLIMITED);
}

function getDefaultSubscription(plan: SubscriptionPlan = "starter"): ProjectSubscription {
  const defaults = PLAN_DEFAULTS[plan];
  return {
    plan,
    seatsLimit: defaults.seatsLimit,
    pdfMonthlyLimit: defaults.pdfMonthlyLimit,
    aiMonthlyLimitOverride: defaults.aiMonthlyLimit,
  };
}

function sanitizeSubscription(input: PartialProjectPolicies["subscription"]): ProjectSubscription {
  const plan = normalizePlan(input?.plan);
  const defaults = PLAN_DEFAULTS[plan];

  const rawAiOverride = input?.aiMonthlyLimitOverride;
  const aiMonthlyLimitOverride = rawAiOverride === undefined ? defaults.aiMonthlyLimit : clampLimit(rawAiOverride);

  return {
    plan,
    seatsLimit: clampLimit(input?.seatsLimit ?? defaults.seatsLimit),
    pdfMonthlyLimit: clampLimit(input?.pdfMonthlyLimit ?? defaults.pdfMonthlyLimit),
    aiMonthlyLimitOverride,
  };
}

function getSeatsUsageState(workspaceId: string): { seatsUsed: number } {
  const existing = workspaceSeatsUsageState.get(workspaceId);
  if (existing) {
    return existing;
  }

  const next = {
    seatsUsed: 1,
  };
  workspaceSeatsUsageState.set(workspaceId, next);
  return next;
}

function isPublishedPublicationStatus(value: unknown): boolean {
  return value === "published";
}

function getWorkspacePublicationApprovals(workspaceId: string): Map<string, PublicationApproval> {
  const existing = workspacePublicationApprovalState.get(workspaceId);
  if (existing) {
    return existing;
  }

  const next = new Map<string, PublicationApproval>();
  workspacePublicationApprovalState.set(workspaceId, next);
  return next;
}

function getStoredPublicationApproval(workspaceId: string, publicationId: string): PublicationApproval | undefined {
  return workspacePublicationApprovalState.get(workspaceId)?.get(publicationId);
}

function setStoredPublicationApproval(workspaceId: string, publicationId: string, approval: PublicationApproval): PublicationApproval {
  const state = getWorkspacePublicationApprovals(workspaceId);
  state.set(publicationId, approval);
  return approval;
}

function sanitizeApprovalState(
  approval: Partial<PublicationApproval> | undefined,
  policies: ProjectPolicies,
  publicationStatus: unknown,
): PublicationApproval {
  if (!policies.publishing.requireApproval) {
    return {
      status: "not_required",
    };
  }

  if (isPublishedPublicationStatus(publicationStatus)) {
    return {
      status: "approved",
      decidedAt: sanitizeOptionalISO(approval?.decidedAt),
      decidedBy: sanitizeOptionalText(approval?.decidedBy),
      comment: sanitizeOptionalText(approval?.comment),
      requestedAt: sanitizeOptionalISO(approval?.requestedAt),
      requestedBy: sanitizeOptionalText(approval?.requestedBy),
    };
  }

  const inputStatus = approval?.status;
  const status: PublicationApprovalStatus =
    inputStatus === "approved" || inputStatus === "rejected" || inputStatus === "pending"
      ? inputStatus
      : "pending";

  return {
    status,
    decidedAt: sanitizeOptionalISO(approval?.decidedAt),
    decidedBy: sanitizeOptionalText(approval?.decidedBy),
    comment: sanitizeOptionalText(approval?.comment),
    requestedAt: sanitizeOptionalISO(approval?.requestedAt),
    requestedBy: sanitizeOptionalText(approval?.requestedBy),
  };
}

function syncStoredApprovalsToPolicy(workspaceId: string, before: ProjectPolicies, after: ProjectPolicies): void {
  if (before.publishing.requireApproval === after.publishing.requireApproval) {
    return;
  }

  const state = workspacePublicationApprovalState.get(workspaceId);
  if (!state || state.size === 0) {
    return;
  }

  const next = new Map<string, PublicationApproval>();

  for (const [publicationId, approval] of state.entries()) {
    if (!after.publishing.requireApproval) {
      next.set(publicationId, { status: "not_required" });
      continue;
    }

    if (approval.status === "not_required") {
      next.set(publicationId, {
        status: "pending",
        requestedAt: sanitizeOptionalISO(approval.requestedAt),
        requestedBy: sanitizeOptionalText(approval.requestedBy),
      });
      continue;
    }

    next.set(publicationId, sanitizeApprovalState(approval, after, undefined));
  }

  workspacePublicationApprovalState.set(workspaceId, next);
}

function createDefaultPolicies(referenceDate: Date = new Date()): ProjectPolicies {
  return {
    subscription: getDefaultSubscription("starter"),
    ai: {
      enabled: true,
      monthlyLimit: 100,
      usageThisMonth: 0,
      lastResetAt: monthStartISO(referenceDate),
    },
    pdf: {
      usageThisMonth: 0,
      lastResetAt: monthStartISO(referenceDate),
    },
    publishing: {
      requireApproval: false,
    },
    audit: {},
    policyAudit: [],
  };
}

function sanitizeAuditEntries(entries: PartialProjectPolicies["policyAudit"]): PolicyAuditEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const fallbackTimestamp = nowISO();
  const sanitized = entries
    .filter((entry) => isRecord(entry))
    .map((entry) => {
      const timestampISO = isValidISO(entry.timestampISO) ? entry.timestampISO : fallbackTimestamp;
      const actor = typeof entry.actor === "string" && entry.actor.trim().length > 0 ? entry.actor.trim() : DEFAULT_ACTOR;
      const changesSource = Array.isArray(entry.changes) ? entry.changes : [];
      const changes = changesSource
        .filter((change): change is string => typeof change === "string")
        .map((change) => change.trim())
        .filter((change) => change.length > 0)
        .slice(0, 3);

      return {
        timestampISO,
        actor,
        changes: changes.length > 0 ? changes : ["Policy update"],
      };
    });

  return sanitized.slice(-MAX_AUDIT_ENTRIES);
}

function sanitizePolicies(input: PartialProjectPolicies | undefined, referenceDate: Date = new Date()): ProjectPolicies {
  const defaults = createDefaultPolicies(referenceDate);
  const subscription = isRecord(input?.subscription) ? input.subscription : undefined;
  const ai = isRecord(input?.ai) ? input.ai : undefined;
  const pdf = isRecord(input?.pdf) ? input.pdf : undefined;
  const publishing = isRecord(input?.publishing) ? input.publishing : undefined;
  const audit = isRecord(input?.audit) ? input.audit : undefined;

  const monthlyLimit = clampInteger(ai?.monthlyLimit, 0, MAX_MONTHLY_LIMIT);
  const usageThisMonth = clampInteger(ai?.usageThisMonth, 0);

  return {
    subscription: sanitizeSubscription(subscription),
    ai: {
      enabled: typeof ai?.enabled === "boolean" ? ai.enabled : defaults.ai.enabled,
      monthlyLimit,
      usageThisMonth,
      lastResetAt: isValidISO(ai?.lastResetAt) ? ai.lastResetAt : defaults.ai.lastResetAt,
    },
    pdf: {
      usageThisMonth: clampInteger(pdf?.usageThisMonth, 0),
      lastResetAt: isValidISO(pdf?.lastResetAt) ? pdf.lastResetAt : defaults.pdf.lastResetAt,
    },
    publishing: {
      requireApproval: typeof publishing?.requireApproval === "boolean"
        ? publishing.requireApproval
        : defaults.publishing.requireApproval,
    },
    audit: {
      lastChangedAt: isValidISO(audit?.lastChangedAt)
        ? audit.lastChangedAt
        : undefined,
      lastChangedBy: typeof audit?.lastChangedBy === "string" && audit.lastChangedBy.length > 0
        ? audit.lastChangedBy
        : undefined,
    },
    policyAudit: sanitizeAuditEntries(input?.policyAudit),
  };
}

function mergePolicies(current: ProjectPolicies, update: PartialProjectPolicies): ProjectPolicies {
  const merged: PartialProjectPolicies = {
    subscription: {
      ...current.subscription,
      ...(update.subscription ?? {}),
    },
    ai: {
      ...current.ai,
      ...(update.ai ?? {}),
    },
    pdf: {
      ...current.pdf,
      ...(update.pdf ?? {}),
    },
    publishing: {
      ...current.publishing,
      ...(update.publishing ?? {}),
    },
    audit: {
      ...current.audit,
      ...(update.audit ?? {}),
    },
    policyAudit: update.policyAudit ?? current.policyAudit,
  };

  return sanitizePolicies(merged);
}

function getCurrentPolicies(workspaceId: string): ProjectPolicies {
  const current = workspacePolicyState.get(workspaceId);
  if (current) {
    return current;
  }

  const defaults = createDefaultPolicies();
  workspacePolicyState.set(workspaceId, defaults);
  return defaults;
}

function buildPolicyDiff(before: ProjectPolicies, after: ProjectPolicies): string[] {
  const changes: string[] = [];

  if (before.subscription.plan !== after.subscription.plan) {
    changes.push(`Subscription: plan ${before.subscription.plan} → ${after.subscription.plan}`);
  }

  if (before.subscription.seatsLimit !== after.subscription.seatsLimit) {
    changes.push(`Subscription: seatsLimit ${before.subscription.seatsLimit} → ${after.subscription.seatsLimit}`);
  }

  if (before.subscription.pdfMonthlyLimit !== after.subscription.pdfMonthlyLimit) {
    changes.push(`Subscription: pdfMonthlyLimit ${before.subscription.pdfMonthlyLimit} → ${after.subscription.pdfMonthlyLimit}`);
  }

  if ((before.subscription.aiMonthlyLimitOverride ?? -1) !== (after.subscription.aiMonthlyLimitOverride ?? -1)) {
    changes.push(
      `Subscription: aiMonthlyLimitOverride ${String(before.subscription.aiMonthlyLimitOverride)} → ${String(after.subscription.aiMonthlyLimitOverride)}`,
    );
  }

  if (before.ai.enabled !== after.ai.enabled) {
    changes.push(`AI: enabled ${String(before.ai.enabled)} → ${String(after.ai.enabled)}`);
  }

  if (before.ai.monthlyLimit !== after.ai.monthlyLimit) {
    changes.push(`AI: monthlyLimit ${before.ai.monthlyLimit} → ${after.ai.monthlyLimit}`);
  }

  if (before.ai.usageThisMonth !== after.ai.usageThisMonth) {
    changes.push(`AI: usageThisMonth ${before.ai.usageThisMonth} → ${after.ai.usageThisMonth}`);
  }

  if (before.pdf.usageThisMonth !== after.pdf.usageThisMonth) {
    changes.push(`PDF: usageThisMonth ${before.pdf.usageThisMonth} → ${after.pdf.usageThisMonth}`);
  }

  if (before.publishing.requireApproval !== after.publishing.requireApproval) {
    changes.push(
      `Publishing: requireApproval ${String(before.publishing.requireApproval)} → ${String(after.publishing.requireApproval)}`,
    );
  }

  return changes;
}

export function ensurePolicies<T extends object>(project: T): T & { policies: ProjectPolicies } {
  const candidate = project as Partial<ProjectWithPolicies>;
  const ensured = sanitizePolicies(candidate.policies);
  return {
    ...project,
    policies: ensured,
  };
}

export function getProjectPolicies(workspaceId: string, project?: ProjectWithPolicies): ProjectPolicies {
  const existing = workspacePolicyState.get(workspaceId);
  if (existing) {
    return existing;
  }

  if (project) {
    const ensured = ensurePolicies(project).policies;
    workspacePolicyState.set(workspaceId, ensured);
    return ensured;
  }

  const defaults = createDefaultPolicies();
  workspacePolicyState.set(workspaceId, defaults);
  return defaults;
}

export function updateProjectPolicies(
  workspaceId: string,
  partialPolicies: PartialProjectPolicies,
  actor: string,
): ProjectPolicies {
  const current = getCurrentPolicies(workspaceId);
  const merged = mergePolicies(current, partialPolicies);
  const timestamp = nowISO();
  const normalizedActor = normalizeActor(actor);

  const next: ProjectPolicies = {
    ...merged,
    audit: {
      ...merged.audit,
      lastChangedAt: timestamp,
      lastChangedBy: normalizedActor,
    },
  };

  workspacePolicyState.set(workspaceId, next);
  syncStoredApprovalsToPolicy(workspaceId, current, next);

  const changes = buildPolicyDiff(current, next);
  if (changes.length > 0) {
    recordPolicyChange(workspaceId, normalizedActor, changes);
  }

  return workspacePolicyState.get(workspaceId) ?? next;
}

export function recordPolicyChange(workspaceId: string, actor: string, changes: string[]): ProjectPolicies {
  const current = getCurrentPolicies(workspaceId);
  const normalizedActor = normalizeActor(actor);
  const cleanedChanges = changes
    .filter((change) => typeof change === "string")
    .map((change) => change.trim())
    .filter((change) => change.length > 0)
    .slice(0, 3);

  if (cleanedChanges.length === 0) {
    return current;
  }

  const entry: PolicyAuditEntry = {
    timestampISO: nowISO(),
    actor: normalizedActor,
    changes: cleanedChanges,
  };

  const nextAudit = [...current.policyAudit, entry];
  const trimmedAudit = nextAudit.slice(-MAX_AUDIT_ENTRIES);

  const next: ProjectPolicies = {
    ...current,
    policyAudit: trimmedAudit,
  };

  workspacePolicyState.set(workspaceId, next);
  return next;
}

export function resetMonthlyUsageIfNeeded(workspaceId: string): ProjectPolicies {
  const current = getCurrentPolicies(workspaceId);
  const currentAiResetDate = new Date(current.ai.lastResetAt);
  const currentPdfResetDate = new Date(current.pdf.lastResetAt);
  const now = new Date();

  const sameAiMonth = Number.isFinite(currentAiResetDate.getTime())
    && currentAiResetDate.getUTCFullYear() === now.getUTCFullYear()
    && currentAiResetDate.getUTCMonth() === now.getUTCMonth();

  const samePdfMonth = Number.isFinite(currentPdfResetDate.getTime())
    && currentPdfResetDate.getUTCFullYear() === now.getUTCFullYear()
    && currentPdfResetDate.getUTCMonth() === now.getUTCMonth();

  if (sameAiMonth && samePdfMonth) {
    return current;
  }

  const next: ProjectPolicies = {
    ...current,
    ai: {
      ...current.ai,
      usageThisMonth: sameAiMonth ? current.ai.usageThisMonth : 0,
      lastResetAt: sameAiMonth ? current.ai.lastResetAt : monthStartISO(now),
    },
    pdf: {
      ...current.pdf,
      usageThisMonth: samePdfMonth ? current.pdf.usageThisMonth : 0,
      lastResetAt: samePdfMonth ? current.pdf.lastResetAt : monthStartISO(now),
    },
    audit: {
      ...current.audit,
      lastChangedAt: nowISO(),
      lastChangedBy: DEFAULT_ACTOR,
    },
  };

  workspacePolicyState.set(workspaceId, next);
  recordPolicyChange(workspaceId, DEFAULT_ACTOR, ["AI/PDF: miesięczny reset usage"]);

  return workspacePolicyState.get(workspaceId) ?? next;
}

export function ensureApprovalState<T extends object>(
  publication: T,
  projectPolicies: ProjectPolicies,
): T & { approval: PublicationApproval } {
  const candidate = publication as T & {
    status?: unknown;
    approval?: Partial<PublicationApproval>;
  };

  const approval = sanitizeApprovalState(candidate.approval, projectPolicies, candidate.status);

  return {
    ...publication,
    approval,
  };
}

export function getPublicationApproval(workspaceId: string, publicationId: string): PublicationApproval {
  const policies = getCurrentPolicies(workspaceId);
  const stored = getStoredPublicationApproval(workspaceId, publicationId);
  const ensured = sanitizeApprovalState(stored, policies, undefined);
  setStoredPublicationApproval(workspaceId, publicationId, ensured);
  return ensured;
}

export function requestApproval(workspaceId: string, publicationId: string, actor: string): PublicationApproval {
  const policies = getCurrentPolicies(workspaceId);
  const normalizedActor = normalizeActor(actor);

  if (!policies.publishing.requireApproval) {
    const next: PublicationApproval = { status: "not_required" };
    setStoredPublicationApproval(workspaceId, publicationId, next);
    return next;
  }

  const current = getStoredPublicationApproval(workspaceId, publicationId);
  const ensuredCurrent = sanitizeApprovalState(current, policies, undefined);
  const next: PublicationApproval = {
    ...ensuredCurrent,
    status: "pending",
    requestedAt: nowISO(),
    requestedBy: normalizedActor,
    decidedAt: undefined,
    decidedBy: undefined,
    comment: undefined,
  };

  setStoredPublicationApproval(workspaceId, publicationId, next);
  recordPolicyChange(workspaceId, normalizedActor, [`Publishing: ${publicationId} sent for approval`]);
  return next;
}

export function decideApproval(
  workspaceId: string,
  publicationId: string,
  actor: string,
  decision: "approved" | "rejected",
  comment?: string,
): PublicationApproval {
  const policies = getCurrentPolicies(workspaceId);
  const normalizedActor = normalizeActor(actor);

  if (!policies.publishing.requireApproval) {
    const next: PublicationApproval = { status: "not_required" };
    setStoredPublicationApproval(workspaceId, publicationId, next);
    return next;
  }

  const current = getStoredPublicationApproval(workspaceId, publicationId);
  const ensuredCurrent = sanitizeApprovalState(current, policies, undefined);
  const normalizedComment = sanitizeOptionalText(comment);

  const next: PublicationApproval = {
    ...ensuredCurrent,
    status: decision,
    decidedAt: nowISO(),
    decidedBy: normalizedActor,
    comment: normalizedComment,
  };

  setStoredPublicationApproval(workspaceId, publicationId, next);
  recordPolicyChange(
    workspaceId,
    normalizedActor,
    [`Publishing: ${publicationId} ${decision}${normalizedComment ? ` (${normalizedComment})` : ""}`],
  );

  return next;
}

export function canPublishPublication(workspaceId: string, publicationId: string): boolean {
  const policies = getCurrentPolicies(workspaceId);
  if (!policies.publishing.requireApproval) {
    return true;
  }

  const approval = getPublicationApproval(workspaceId, publicationId);
  return approval.status === "approved";
}

export function getEntitlements(workspaceId: string): WorkspaceEntitlements {
  const policies = getCurrentPolicies(workspaceId);
  const defaults = PLAN_DEFAULTS[policies.subscription.plan];
  const planAiLimit = clampLimit(policies.subscription.aiMonthlyLimitOverride ?? defaults.aiMonthlyLimit);
  const policyCap = clampInteger(policies.ai.monthlyLimit, 0, MAX_MONTHLY_LIMIT);
  const aiMonthlyLimit = Math.min(planAiLimit, policyCap);

  return {
    plan: policies.subscription.plan,
    seatsLimit: clampLimit(policies.subscription.seatsLimit),
    pdfMonthlyLimit: clampLimit(policies.subscription.pdfMonthlyLimit),
    aiMonthlyLimit: clampLimit(aiMonthlyLimit),
  };
}

export function getUsage(workspaceId: string): WorkspaceUsage {
  const policies = resetMonthlyUsageIfNeeded(workspaceId);
  const seats = getSeatsUsageState(workspaceId);

  return {
    aiThisMonth: clampInteger(policies.ai.usageThisMonth, 0),
    pdfThisMonth: clampInteger(policies.pdf.usageThisMonth, 0),
    seatsUsed: clampInteger(seats.seatsUsed, 0),
  };
}

export function canUseAi(workspaceId: string): UsageCheckResult {
  const policies = resetMonthlyUsageIfNeeded(workspaceId);
  const entitlements = getEntitlements(workspaceId);
  const used = clampInteger(policies.ai.usageThisMonth, 0);
  const limit = entitlements.aiMonthlyLimit;

  if (!policies.ai.enabled) {
    return { ok: false, reason: "AI_DISABLED_BY_POLICY", limit, used };
  }

  if (used >= limit) {
    return { ok: false, reason: "AI_MONTHLY_LIMIT_REACHED", limit, used };
  }

  return { ok: true, limit, used };
}

export function consumeAi(
  workspaceId: string,
  actor: string,
): { ok: true; limit: number; used: number } | { ok: false; reason: "AI_DISABLED_BY_POLICY" | "AI_MONTHLY_LIMIT_REACHED"; limit: number; used: number } {
  const normalizedActor = normalizeActor(actor);
  const usageCheck = canUseAi(workspaceId);

  if (!usageCheck.ok) {
    recordPolicyChange(workspaceId, normalizedActor, [`LIMIT_BLOCKED: AI — ${String(usageCheck.reason)}`]);
    return {
      ok: false,
      reason: usageCheck.reason === "AI_DISABLED_BY_POLICY" ? "AI_DISABLED_BY_POLICY" : "AI_MONTHLY_LIMIT_REACHED",
      limit: usageCheck.limit,
      used: usageCheck.used,
    };
  }

  const policies = getCurrentPolicies(workspaceId);
  const next: ProjectPolicies = {
    ...policies,
    ai: {
      ...policies.ai,
      usageThisMonth: clampInteger(policies.ai.usageThisMonth + 1, 0),
    },
  };

  workspacePolicyState.set(workspaceId, next);

  const usage = getUsage(workspaceId);
  return {
    ok: true,
    limit: usageCheck.limit,
    used: usage.aiThisMonth,
  };
}

export function canExportPdf(workspaceId: string): UsageCheckResult {
  const policies = resetMonthlyUsageIfNeeded(workspaceId);
  const entitlements = getEntitlements(workspaceId);
  const used = clampInteger(policies.pdf.usageThisMonth, 0);
  const limit = entitlements.pdfMonthlyLimit;

  if (limit <= 0) {
    return {
      ok: false,
      reason: "PDF_NOT_AVAILABLE_IN_PLAN",
      limit,
      used,
    };
  }

  if (used >= limit) {
    return {
      ok: false,
      reason: "PDF_MONTHLY_LIMIT_REACHED",
      limit,
      used,
    };
  }

  return {
    ok: true,
    limit,
    used,
  };
}

export function consumePdfExport(
  workspaceId: string,
  actor: string,
): { ok: true; limit: number; used: number } | { ok: false; reason: "PDF_MONTHLY_LIMIT_REACHED" | "PDF_NOT_AVAILABLE_IN_PLAN"; limit: number; used: number } {
  const normalizedActor = normalizeActor(actor);
  const check = canExportPdf(workspaceId);

  if (!check.ok) {
    recordPolicyChange(workspaceId, normalizedActor, [`LIMIT_BLOCKED: PDF — ${String(check.reason)}`]);
    return {
      ok: false,
      reason: check.reason === "PDF_NOT_AVAILABLE_IN_PLAN" ? "PDF_NOT_AVAILABLE_IN_PLAN" : "PDF_MONTHLY_LIMIT_REACHED",
      limit: check.limit,
      used: check.used,
    };
  }

  const current = getCurrentPolicies(workspaceId);
  const next: ProjectPolicies = {
    ...current,
    pdf: {
      ...current.pdf,
      usageThisMonth: clampInteger(current.pdf.usageThisMonth + 1, 0),
    },
  };

  workspacePolicyState.set(workspaceId, next);

  return {
    ok: true,
    limit: check.limit,
    used: next.pdf.usageThisMonth,
  };
}
