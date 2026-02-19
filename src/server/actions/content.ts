"use server";

import { prisma } from "@/lib/prisma";
import { runGuards } from "@/modules/content/guards";
import { buildWeeklyPackSummary, generateDraft } from "@/modules/content/templates";
import type { ContentItemInput, ContentPackType, ContentStatus, GeneratedDraft, PackGenerationResult, QualityResult } from "@/modules/content/types";
import { resolveWeekWindow } from "@/modules/plans/utils";
import type { ProjectContextInput } from "@/modules/projects/types";
import { getProject } from "@/server/queries/projects";
import { runAIAssist } from "@/server/actions/ai";

type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_NOT_READY"
  | "CONTENT_NOT_FOUND"
  | "PLAN_ITEM_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

type ActionError = {
  code: ActionErrorCode;
  message: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export type BeforePublishChecklist = {
  canPublish: boolean;
  checks: {
    primaryKeyword: boolean;
    internalLink: boolean;
    externalLink: boolean;
    seoGuardCritical: boolean;
    placeholderDetected: boolean;
  };
};

type ContentPerformanceInput = {
  views: unknown;
  clicks: unknown;
  leads: unknown;
  rating: unknown;
};

function normalizeContext(context: Record<string, unknown>): ProjectContextInput {
  const channels = Array.isArray(context.channels) ? context.channels : [];
  const keywordsPrimary = Array.isArray(context.keywordsPrimary) ? context.keywordsPrimary : [];
  const keywordsSecondary = Array.isArray(context.keywordsSecondary) ? context.keywordsSecondary : [];
  const internalLinks = Array.isArray(context.internalLinks) ? context.internalLinks : [];
  const externalLinks = Array.isArray(context.externalLinks) ? context.externalLinks : [];

  return {
    name: String(context.name ?? "Project"),
    summary: String(context.summary ?? ""),
    audience: String(context.audience ?? ""),
    toneOfVoice: String(context.toneOfVoice ?? ""),
    goals: String(context.goals ?? ""),
    channels: channels
      .map((value) => String(value).toLowerCase())
      .filter((value) => value === "linkedin" || value === "blog" || value === "newsletter" || value === "landing") as ProjectContextInput["channels"],
    keywordsPrimary: keywordsPrimary.map((value) => String(value)),
    keywordsSecondary: keywordsSecondary.map((value) => String(value)),
    internalLinks: internalLinks
      .map((entry) => entry as Record<string, unknown>)
      .map((entry) => ({
        url: String(entry.url ?? ""),
        title: String(entry.title ?? ""),
        note: typeof entry.note === "string" ? entry.note : undefined,
        anchorHints: Array.isArray(entry.anchorHints) ? entry.anchorHints.map((hint) => String(hint)) : [],
      }))
      .filter((entry) => entry.url.length > 0),
    externalLinks: externalLinks
      .map((entry) => entry as Record<string, unknown>)
      .map((entry) => ({
        url: String(entry.url ?? ""),
        title: String(entry.title ?? ""),
        note: typeof entry.note === "string" ? entry.note : undefined,
      }))
      .filter((entry) => entry.url.length > 0),
  };
}

function parseContentStatus(status: string): ContentStatus | null {
  if (status === "draft" || status === "review" || status === "approved" || status === "scheduled" || status === "published" || status === "archived") {
    return status;
  }
  return null;
}

function canTransition(current: ContentStatus, target: ContentStatus): boolean {
  if (target === "archived") {
    return true;
  }

  const transitions: Record<Exclude<ContentStatus, "archived">, ContentStatus | null> = {
    draft: "review",
    review: "approved",
    approved: "scheduled",
    scheduled: "published",
    published: null,
  };

  return transitions[current as Exclude<ContentStatus, "archived">] === target;
}

function validateInput(payload: ContentItemInput): ActionError | null {
  if (!payload.projectId || !payload.title.trim() || !payload.goal.trim() || !payload.angle.trim()) {
    return {
      code: "VALIDATION_ERROR",
      message: "Uzupełnij project, title, goal i angle.",
    };
  }
  if (!(payload.channel === "linkedin" || payload.channel === "blog" || payload.channel === "newsletter" || payload.channel === "landing")) {
    return {
      code: "VALIDATION_ERROR",
      message: "Nieprawidłowy channel.",
    };
  }
  return null;
}

function evaluateDraft(draft: GeneratedDraft, projectContext: ProjectContextInput, channel: ContentItemInput["channel"]): QualityResult {
  return runGuards({
    draft,
    projectContext,
    channel,
  });
}

function containsUrlFromList(body: string, links: Array<{ url: string }>): boolean {
  const normalized = body.toLowerCase();
  return links.some((link) => {
    const url = String(link.url ?? "").trim().toLowerCase();
    return url.length > 0 && normalized.includes(url);
  });
}

function hasPlaceholderMarkers(body: string): boolean {
  const markers = [
    /https?:\/\/placeholder(?:[./:?&#-]|$)/i,
    /\[\s*placeholder\s*\]/i,
    /\{\{\s*placeholder[^}]*\}\}/i,
  ];
  return markers.some((pattern) => pattern.test(body));
}

function parseNullableInt(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return null;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.floor(parsed);
  return normalized < 0 ? 0 : normalized;
}

function parseRating(value: unknown): number | null {
  const parsed = parseNullableInt(value);
  if (parsed == null) {
    return null;
  }
  return Math.max(1, Math.min(5, parsed));
}

export async function validateBeforePublish(contentId: string, workspaceId: string): Promise<BeforePublishChecklist> {
  const itemModel = prisma as unknown as {
    contentBuilderItem: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    };
  };

  const item = await itemModel.contentBuilderItem.findFirst({
    where: {
      id: contentId,
      workspaceId,
    },
    include: {
      project: {
        select: {
          name: true,
          context: true,
        },
      },
      versions: {
        orderBy: {
          version: "desc",
        },
        take: 1,
      },
    },
  });

  if (!item) {
    return {
      canPublish: false,
      checks: {
        primaryKeyword: false,
        internalLink: false,
        externalLink: false,
        seoGuardCritical: true,
        placeholderDetected: true,
      },
    };
  }

  const project = (item.project as Record<string, unknown> | undefined) ?? {};
  const contextRaw = (project.context as Record<string, unknown> | null) ?? null;
  const latestVersion = Array.isArray(item.versions) ? (item.versions[0] as Record<string, unknown> | undefined) : undefined;
  const body = String(latestVersion?.body ?? "");
  const meta = (latestVersion?.meta as Record<string, unknown> | undefined) ?? {};

  const primaryKeyword =
    String(item.primaryKeyword ?? "").trim().length > 0 ||
    String(item.clusterId ?? "").trim().length > 0 ||
    String(item.clusterLabel ?? "").trim().length > 0;

  const projectContext = normalizeContext({
    ...(contextRaw ?? {}),
    name: String(project.name ?? "Project"),
  });

  const internalLink = containsUrlFromList(body, projectContext.internalLinks);
  const externalLink = containsUrlFromList(body, projectContext.externalLinks);
  const channel = String(item.channel) as ContentItemInput["channel"];
  const quality = evaluateDraft({ body, meta }, projectContext, channel);
  const seoGuardCritical = quality.issues.some((issue) => issue.severity === "high");
  const placeholderDetected = hasPlaceholderMarkers(body);

  const canPublish =
    primaryKeyword &&
    internalLink &&
    externalLink &&
    !seoGuardCritical &&
    !placeholderDetected;

  return {
    canPublish,
    checks: {
      primaryKeyword,
      internalLink,
      externalLink,
      seoGuardCritical,
      placeholderDetected,
    },
  };
}

export async function upsertContentPerformance(
  workspaceId: string,
  contentId: string,
  payload: ContentPerformanceInput,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const normalized = {
      views: parseNullableInt(payload.views),
      clicks: parseNullableInt(payload.clicks),
      leads: parseNullableInt(payload.leads),
      rating: parseRating(payload.rating),
    };

    const itemModel = (prisma as unknown as {
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
      contentPerformance: {
        upsert: (args: unknown) => Promise<Record<string, unknown>>;
      };
    });

    const item = await itemModel.contentBuilderItem.findFirst({
      where: {
        id: contentId,
        workspaceId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!item) {
      return {
        ok: false,
        error: {
          code: "CONTENT_NOT_FOUND",
          message: "Treść nie istnieje.",
        },
      };
    }

    if (String(item.status) !== "published") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Wyniki można zapisać tylko dla opublikowanej treści.",
        },
      };
    }

    const saved = await itemModel.contentPerformance.upsert({
      where: {
        contentId,
      },
      create: {
        contentId,
        views: normalized.views,
        clicks: normalized.clicks,
        leads: normalized.leads,
        rating: normalized.rating,
      },
      update: {
        views: normalized.views,
        clicks: normalized.clicks,
        leads: normalized.leads,
        rating: normalized.rating,
      },
      select: {
        updatedAt: true,
      },
    });

    return {
      ok: true,
      data: {
        updatedAt: new Date(saved.updatedAt as Date).toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się zapisać wyników publikacji.",
      },
    };
  }
}

type PlanItemStatus = "planned" | "queued" | "drafted" | "published" | "skipped";

function toPlanItemStatus(value: unknown): PlanItemStatus {
  const candidate = String(value);
  if (candidate === "queued" || candidate === "drafted" || candidate === "published" || candidate === "skipped") {
    return candidate;
  }
  return "planned";
}

function normalizePlanLinkSuggestions(raw: unknown): {
  internal: Array<{ url: string; title: string; anchorHint?: string }>;
  external: Array<{ url: string; title: string }>;
} {
  const internal = Array.isArray(raw)
    ? raw
        .map((entry) => entry as Record<string, unknown>)
        .map((entry) => ({
          url: String(entry.url ?? ""),
          title: String(entry.title ?? ""),
          anchorHint: typeof entry.anchorHint === "string" ? entry.anchorHint : undefined,
        }))
        .filter((entry) => entry.url.length > 0)
    : [];

  return { internal, external: [] };
}

function buildWeeklyPackId(planId: string, weekStartISO: string): string {
  return `pack:weekly:${planId}:${new Date(weekStartISO).toISOString().slice(0, 10)}`;
}

function buildItemPackId(planItemId: string): string {
  return `pack:item:${planItemId}`;
}

export async function createContentItem(workspaceId: string, payload: ContentItemInput): Promise<ActionResult<{ contentId: string }>> {
  try {
    const inputError = validateInput(payload);
    if (inputError) {
      return { ok: false, error: inputError };
    }

    const project = (await getProject(payload.projectId, workspaceId)) as Record<string, unknown> | null;
    if (!project) {
      return {
        ok: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Projekt nie istnieje w tym workspace.",
        },
      };
    }

    const context = (project.context as Record<string, unknown> | null) ?? null;
    if (!context || context.readinessState !== "ready") {
      return {
        ok: false,
        error: {
          code: "PROJECT_NOT_READY",
          message: "Projekt nie jest gotowy. Uzupełnij kontekst projektu.",
        },
      };
    }

    const projectContext = normalizeContext({
      ...context,
      name: String(project.name ?? "Project"),
    });

    const draft = generateDraft({
      projectContext,
      channel: payload.channel,
      title: payload.title,
      goal: payload.goal,
      angle: payload.angle,
    });

    const quality = evaluateDraft(draft, projectContext, payload.channel);

    const result = await prisma.$transaction(async (tx) => {
      const itemModel = tx as unknown as {
        contentBuilderItem: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      const versionModel = tx as unknown as {
        contentBuilderVersion: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      const created = await itemModel.contentBuilderItem.create({
        data: {
          workspaceId,
          projectId: payload.projectId,
          channel: payload.channel,
          status: "draft",
          title: payload.title,
          goal: payload.goal,
          angle: payload.angle,
          qualityScore: quality.score,
          qualityState: quality.state,
          qualityIssues: quality.issues,
        },
      });

      await versionModel.contentBuilderVersion.create({
        data: {
          contentId: created.id,
          version: 1,
          body: draft.body,
          meta: draft.meta,
        },
      });

      return created;
    });

    return {
      ok: true,
      data: {
        contentId: String(result.id),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się utworzyć content item.",
      },
    };
  }
}

export async function saveNewVersion(
  workspaceId: string,
  contentId: string,
  body: string,
  meta: Record<string, unknown>,
): Promise<ActionResult<{ quality: QualityResult; version: number }>> {
  try {
    const itemModel = (prisma as unknown as {
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      contentBuilderVersion: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    });

    const item = await itemModel.contentBuilderItem.findFirst({
      where: { id: contentId, workspaceId },
      include: {
        project: {
          select: {
            name: true,
            context: true,
          },
        },
      },
    });

    if (!item) {
      return {
        ok: false,
        error: {
          code: "CONTENT_NOT_FOUND",
          message: "Content item nie istnieje.",
        },
      };
    }

    const project = (item.project as Record<string, unknown>) ?? {};
    const contextRaw = (project.context as Record<string, unknown> | null) ?? null;
    if (!contextRaw) {
      return {
        ok: false,
        error: {
          code: "PROJECT_NOT_READY",
          message: "Brak kontekstu projektu do uruchomienia guardów.",
        },
      };
    }

    const projectContext = normalizeContext({
      ...contextRaw,
      name: String(project.name ?? "Project"),
    });

    const channel = String(item.channel) as ContentItemInput["channel"];
    const draft = { body, meta };
    const quality = evaluateDraft(draft, projectContext, channel);

    const latestVersion = await itemModel.contentBuilderVersion.findFirst({
      where: { contentId },
      orderBy: { version: "desc" },
    });
    const nextVersion = Number(latestVersion?.version ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      const txModel = tx as unknown as {
        contentBuilderVersion: { create: (args: unknown) => Promise<Record<string, unknown>> };
        contentBuilderItem: { update: (args: unknown) => Promise<Record<string, unknown>> };
      };

      await txModel.contentBuilderVersion.create({
        data: {
          contentId,
          version: nextVersion,
          body,
          meta,
        },
      });

      await txModel.contentBuilderItem.update({
        where: { id: contentId },
        data: {
          qualityScore: quality.score,
          qualityState: quality.state,
          qualityIssues: quality.issues,
        },
      });
    });

    return {
      ok: true,
      data: {
        quality,
        version: nextVersion,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się zapisać nowej wersji.",
      },
    };
  }
}

export async function updateStatus(
  workspaceId: string,
  contentId: string,
  status: string,
): Promise<ActionResult<{ status: ContentStatus }>> {
  try {
    const targetStatus = parseContentStatus(status);
    if (!targetStatus) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Nieprawidłowy status.",
        },
      };
    }

    const itemModel = (prisma as unknown as {
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }).contentBuilderItem;

    const item = await itemModel.findFirst({
      where: {
        id: contentId,
        workspaceId,
      },
    });

    if (!item) {
      return {
        ok: false,
        error: {
          code: "CONTENT_NOT_FOUND",
          message: "Content item nie istnieje.",
        },
      };
    }

    const currentStatus = String(item.status) as ContentStatus;
    if (!canTransition(currentStatus, targetStatus)) {
      return {
        ok: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Niedozwolona zmiana statusu: ${currentStatus} -> ${targetStatus}`,
        },
      };
    }

    await itemModel.update({
      where: {
        id: contentId,
      },
      data: {
        status: targetStatus,
      },
    });

    return {
      ok: true,
      data: {
        status: targetStatus,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się zaktualizować statusu.",
      },
    };
  }
}

export async function generateFromPlanItem(
  workspaceId: string,
  planItemId: string,
): Promise<ActionResult<{ contentId: string }>> {
  try {
    const model = prisma as unknown as {
      publicationPlanItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
    };

    const planItem = await model.publicationPlanItem.findFirst({
      where: {
        id: planItemId,
        plan: {
          workspaceId,
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            workspaceId: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                context: true,
              },
            },
          },
        },
      },
    });

    if (!planItem) {
      return {
        ok: false,
        error: {
          code: "PLAN_ITEM_NOT_FOUND",
          message: "Nie znaleziono pozycji planu w tym workspace.",
        },
      };
    }

    const existing = await model.contentBuilderItem.findFirst({
      where: {
        workspaceId,
        planItemId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return {
        ok: true,
        data: {
          contentId: String(existing.id),
        },
      };
    }

    const plan = (planItem.plan as Record<string, unknown> | undefined) ?? {};
    const project = (plan.project as Record<string, unknown> | undefined) ?? {};
    const contextRaw = (project.context as Record<string, unknown> | null) ?? null;

    if (!contextRaw || contextRaw.readinessState !== "ready") {
      return {
        ok: false,
        error: {
          code: "PROJECT_NOT_READY",
          message: "Projekt dla tej pozycji planu nie jest gotowy.",
        },
      };
    }

    const projectContext = normalizeContext({
      ...contextRaw,
      name: String(project.name ?? "Project"),
    });

    const channel = String(planItem.channel) as ContentItemInput["channel"];
    const primaryKeyword = String(planItem.primaryKeyword ?? "");
    const secondaryKeywords = Array.isArray(planItem.secondaryKeywords)
      ? planItem.secondaryKeywords.map((value) => String(value)).slice(0, 3)
      : [];

    const internalSuggestions = Array.isArray(planItem.internalLinkSuggestions)
      ? planItem.internalLinkSuggestions
          .map((entry) => entry as Record<string, unknown>)
          .map((entry) => ({
            url: String(entry.url ?? ""),
            title: String(entry.title ?? ""),
            anchorHint: typeof entry.anchorHint === "string" ? entry.anchorHint : undefined,
          }))
          .filter((entry) => entry.url.length > 0)
          .slice(0, 2)
      : [];

    const externalSuggestions = Array.isArray(planItem.externalLinkSuggestions)
      ? planItem.externalLinkSuggestions
          .map((entry) => entry as Record<string, unknown>)
          .map((entry) => ({
            url: String(entry.url ?? ""),
            title: String(entry.title ?? ""),
          }))
          .filter((entry) => entry.url.length > 0)
          .slice(0, 1)
      : [];

    const draft = generateDraft({
      projectContext,
      channel,
      title: String(planItem.title),
      goal: `Publish on ${channel} aligned with project goals.`,
      angle: `Cluster: ${String(planItem.clusterLabel ?? "general")} | Keyword: ${primaryKeyword}`,
      plan: {
        primaryKeyword,
        secondaryKeywords,
        internalLinkSuggestions: internalSuggestions,
        externalLinkSuggestions: externalSuggestions,
      },
    } as Parameters<typeof generateDraft>[0]);

    const quality = evaluateDraft(draft, projectContext, channel);
    const nextPlanStatus: PlanItemStatus = quality.state === "ready" ? "drafted" : "queued";

    const created = await prisma.$transaction(async (tx) => {
      const txModel = tx as unknown as {
        contentBuilderItem: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
        contentBuilderVersion: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
        publicationPlanItem: {
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      const contentItem = await txModel.contentBuilderItem.create({
        data: {
          workspaceId,
          projectId: String(plan.projectId),
          planId: String(plan.id),
          planItemId,
          publishDate: planItem.publishDate ? new Date(planItem.publishDate as Date) : null,
          clusterId: planItem.clusterId ? String(planItem.clusterId) : null,
          clusterLabel: planItem.clusterLabel ? String(planItem.clusterLabel) : null,
          primaryKeyword: primaryKeyword || null,
          secondaryKeywords,
          internalLinkSuggestions: internalSuggestions,
          externalLinkSuggestions: externalSuggestions,
          channel,
          status: "draft",
          title: String(planItem.title),
          goal: `Publish on ${channel} aligned with project goals.`,
          angle: `Cluster: ${String(planItem.clusterLabel ?? "general")} | Keyword: ${primaryKeyword}`,
          qualityScore: quality.score,
          qualityState: quality.state,
          qualityIssues: quality.issues,
        },
      });

      await txModel.contentBuilderVersion.create({
        data: {
          contentId: contentItem.id,
          version: 1,
          body: draft.body,
          meta: draft.meta,
        },
      });

      await txModel.publicationPlanItem.update({
        where: {
          id: planItemId,
        },
        data: {
          status: nextPlanStatus,
        },
      });

      return contentItem;
    });

    return {
      ok: true,
      data: {
        contentId: String(created.id),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się wygenerować draftu z planu.",
      },
    };
  }
}

export async function queuePlanItem(workspaceId: string, planItemId: string): Promise<ActionResult<{ status: PlanItemStatus }>> {
  try {
    const model = prisma as unknown as {
      publicationPlanItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    };

    const planItem = await model.publicationPlanItem.findFirst({
      where: {
        id: planItemId,
        plan: {
          workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!planItem) {
      return {
        ok: false,
        error: {
          code: "PLAN_ITEM_NOT_FOUND",
          message: "Nie znaleziono pozycji planu.",
        },
      };
    }

    await model.publicationPlanItem.update({
      where: { id: planItemId },
      data: { status: "queued" },
    });

    return { ok: true, data: { status: "queued" } };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się ustawić statusu queued.",
      },
    };
  }
}

export async function markPlanItemPublished(workspaceId: string, planItemId: string): Promise<ActionResult<{ status: PlanItemStatus }>> {
  try {
    const model = prisma as unknown as {
      publicationPlanItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    };

    const planItem = await model.publicationPlanItem.findFirst({
      where: {
        id: planItemId,
        plan: {
          workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!planItem) {
      return {
        ok: false,
        error: {
          code: "PLAN_ITEM_NOT_FOUND",
          message: "Nie znaleziono pozycji planu.",
        },
      };
    }

    await prisma.$transaction(async (tx) => {
      const txModel = tx as unknown as {
        publicationPlanItem: { update: (args: unknown) => Promise<Record<string, unknown>> };
        contentBuilderItem: {
          findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      await txModel.publicationPlanItem.update({
        where: { id: planItemId },
        data: { status: "published" },
      });

      const content = await txModel.contentBuilderItem.findFirst({
        where: {
          workspaceId,
          planItemId,
        },
      });

      if (content) {
        await txModel.contentBuilderItem.update({
          where: {
            id: String(content.id),
          },
          data: {
            status: "published",
          },
        });
      }
    });

    return { ok: true, data: { status: "published" } };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się oznaczyć pozycji jako published.",
      },
    };
  }
}

type PlanItemRecord = {
  id: string;
  planId: string;
  projectId: string;
  publishDate: Date;
  channel: ContentItemInput["channel"];
  title: string;
  clusterId: string;
  clusterLabel: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  internalLinkSuggestions: Array<{ url: string; title: string; anchorHint?: string }>;
  externalLinkSuggestions: Array<{ url: string; title: string }>;
  projectName: string;
  projectContext: ProjectContextInput;
};

function toPlanItemRecord(raw: Record<string, unknown>): PlanItemRecord | null {
  const plan = (raw.plan as Record<string, unknown> | undefined) ?? undefined;
  const project = (plan?.project as Record<string, unknown> | undefined) ?? undefined;
  const contextRaw = (project?.context as Record<string, unknown> | null) ?? null;

  if (!plan || !project || !contextRaw || contextRaw.readinessState !== "ready") {
    return null;
  }

  return {
    id: String(raw.id),
    planId: String(plan.id),
    projectId: String(plan.projectId),
    publishDate: new Date(raw.publishDate as Date),
    channel: String(raw.channel) as ContentItemInput["channel"],
    title: String(raw.title),
    clusterId: String(raw.clusterId ?? "general"),
    clusterLabel: String(raw.clusterLabel ?? "general"),
    primaryKeyword: String(raw.primaryKeyword ?? ""),
    secondaryKeywords: Array.isArray(raw.secondaryKeywords) ? raw.secondaryKeywords.map((value) => String(value)).slice(0, 3) : [],
    internalLinkSuggestions: Array.isArray(raw.internalLinkSuggestions)
      ? raw.internalLinkSuggestions
          .map((entry) => entry as Record<string, unknown>)
          .map((entry) => ({
            url: String(entry.url ?? ""),
            title: String(entry.title ?? ""),
            anchorHint: typeof entry.anchorHint === "string" ? entry.anchorHint : undefined,
          }))
          .filter((entry) => entry.url.length > 0)
      : [],
    externalLinkSuggestions: Array.isArray(raw.externalLinkSuggestions)
      ? raw.externalLinkSuggestions
          .map((entry) => entry as Record<string, unknown>)
          .map((entry) => ({
            url: String(entry.url ?? ""),
            title: String(entry.title ?? ""),
          }))
          .filter((entry) => entry.url.length > 0)
      : [],
    projectName: String(project.name ?? "Project"),
    projectContext: normalizeContext({
      ...contextRaw,
      name: String(project.name ?? "Project"),
    }),
  };
}

async function maybeApplyAIAssist(
  workspaceId: string,
  contentId: string,
  enabledRef: { current: boolean },
): Promise<void> {
  if (!enabledRef.current) {
    return;
  }

  const aiResult = await runAIAssist(workspaceId, contentId, "improve");
  if (!aiResult.ok) {
    if (aiResult.errorCode === "OUT_OF_CREDITS") {
      enabledRef.current = false;
    }
    return;
  }

  if (!aiResult.suggestion) {
    return;
  }

  await saveNewVersion(workspaceId, contentId, aiResult.suggestion.body, aiResult.suggestion.meta ?? {});
}

async function bindPackFields(params: {
  contentId: string;
  packId: string;
  packType: ContentPackType;
  packLabel: string;
}): Promise<void> {
  const model = prisma as unknown as {
    contentBuilderItem: {
      update: (args: unknown) => Promise<Record<string, unknown>>;
    };
  };

  await model.contentBuilderItem.update({
    where: { id: params.contentId },
    data: {
      packId: params.packId,
      packType: params.packType,
      packLabel: params.packLabel,
    },
  });
}

async function appendIfMissing(params: {
  workspaceId: string;
  contentId: string;
  marker: string;
  appendix: string;
}): Promise<void> {
  const model = prisma as unknown as {
    contentBuilderVersion: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    };
  };

  const latest = await model.contentBuilderVersion.findFirst({
    where: { contentId: params.contentId },
    orderBy: { version: "desc" },
  });

  if (!latest) {
    return;
  }

  const body = String(latest.body ?? "");
  if (body.includes(params.marker)) {
    return;
  }

  await saveNewVersion(params.workspaceId, params.contentId, `${body}\n\n${params.appendix}`, (latest.meta as Record<string, unknown>) ?? {});
}

export async function generatePackForWeek(
  workspaceId: string,
  planId: string,
  weekStartISO: string,
  useAIAssist = false,
): Promise<ActionResult<PackGenerationResult>> {
  try {
    const packId = buildWeeklyPackId(planId, weekStartISO);
    const { start, end } = resolveWeekWindow(weekStartISO);

    const model = prisma as unknown as {
      publicationPlan: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
      publicationPlanItem: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
    };

    const plan = await model.publicationPlan.findFirst({
      where: {
        id: planId,
        workspaceId,
      },
      select: { id: true },
    });

    if (!plan) {
      return {
        ok: false,
        error: {
          code: "PLAN_NOT_FOUND",
          message: "Plan nie istnieje w tym workspace.",
        },
      };
    }

    const rawItems = await model.publicationPlanItem.findMany({
      where: {
        planId,
        publishDate: {
          gte: start,
          lte: end,
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
                context: true,
              },
            },
          },
        },
      },
      orderBy: {
        publishDate: "asc",
      },
    });

    const items = rawItems.map(toPlanItemRecord).filter((item): item is PlanItemRecord => Boolean(item));
    const clusterMap = new Map<string, PlanItemRecord[]>();
    for (const item of items) {
      const current = clusterMap.get(item.clusterId) ?? [];
      current.push(item);
      clusterMap.set(item.clusterId, current);
    }

    const selected: PlanItemRecord[] = [];
    for (const [, clusterItems] of [...clusterMap.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      const blog = clusterItems.find((item) => item.channel === "blog");
      const linkedin = clusterItems.find((item) => item.channel === "linkedin");
      if (blog) {
        selected.push(blog);
      }
      if (linkedin) {
        selected.push(linkedin);
      }
    }

    const newsletter = items.find((item) => item.channel === "newsletter");
    if (newsletter) {
      selected.push(newsletter);
    }

    const createdItems: Array<{ planItemId: string; contentId: string }> = [];
    let created = 0;
    let skipped = 0;
    const aiEnabledRef = { current: useAIAssist };
    const blogByCluster = new Map<string, string>();

    for (const item of selected) {
      const existed = await model.contentBuilderItem.findFirst({
        where: {
          workspaceId,
          planItemId: item.id,
        },
        select: { id: true },
      });

      const result = await generateFromPlanItem(workspaceId, item.id);
      if (!result.ok) {
        skipped += 1;
        continue;
      }

      const contentId = result.data.contentId;
      createdItems.push({ planItemId: item.id, contentId });

      if (existed) {
        skipped += 1;
      } else {
        created += 1;
      }

      await bindPackFields({
        contentId,
        packId,
        packType: "weekly",
        packLabel: `Week of ${start.toISOString().slice(0, 10)}`,
      });

      if (item.channel === "blog") {
        blogByCluster.set(item.clusterId, contentId);
      }

      if (item.channel === "linkedin") {
        const blogId = blogByCluster.get(item.clusterId);
        if (blogId) {
          const blogLink = `https://internal.local/content/${blogId}`;
          await appendIfMissing({
            workspaceId,
            contentId,
            marker: blogLink,
            appendix: `[Internal link: Source blog | ${blogLink} | anchor: full analysis]`,
          });
        }
      }

      if (item.channel === "newsletter") {
        const summary = buildWeeklyPackSummary(
          [...blogByCluster.entries()].map(([clusterId, blogId]) => ({
            label: clusterId,
            keyword: `blog:${blogId}`,
          })),
        );
        await appendIfMissing({
          workspaceId,
          contentId,
          marker: "## Weekly Pack Summary",
          appendix: summary,
        });
      }

      if (!existed) {
        await maybeApplyAIAssist(workspaceId, contentId, aiEnabledRef);
      }
    }

    return {
      ok: true,
      data: {
        packId,
        created,
        skipped,
        items: createdItems,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się wygenerować weekly pack.",
      },
    };
  }
}

export async function generatePackForPlanItem(
  workspaceId: string,
  planItemId: string,
  useAIAssist = false,
): Promise<ActionResult<PackGenerationResult>> {
  try {
    const packId = buildItemPackId(planItemId);

    const model = prisma as unknown as {
      publicationPlanItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      contentBuilderItem: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
    };

    const seedRaw = await model.publicationPlanItem.findFirst({
      where: {
        id: planItemId,
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
                context: true,
              },
            },
          },
        },
      },
    });

    if (!seedRaw) {
      return {
        ok: false,
        error: {
          code: "PLAN_ITEM_NOT_FOUND",
          message: "Nie znaleziono pozycji planu.",
        },
      };
    }

    const seed = toPlanItemRecord(seedRaw);
    if (!seed) {
      return {
        ok: false,
        error: {
          code: "PROJECT_NOT_READY",
          message: "Projekt dla pozycji planu nie jest gotowy.",
        },
      };
    }

    const siblingsRaw = await model.publicationPlanItem.findMany({
      where: {
        planId: seed.planId,
        clusterId: seed.clusterId,
      },
      include: {
        plan: {
          select: {
            id: true,
            projectId: true,
            project: {
              select: {
                name: true,
                context: true,
              },
            },
          },
        },
      },
      orderBy: {
        publishDate: "asc",
      },
    });

    const siblings = siblingsRaw.map(toPlanItemRecord).filter((item): item is PlanItemRecord => Boolean(item));
    const selected: PlanItemRecord[] = [];
    const blog = siblings.find((item) => item.channel === "blog") ?? (seed.channel === "blog" ? seed : undefined);
    const linkedin = siblings.find((item) => item.channel === "linkedin") ?? (seed.channel === "linkedin" ? seed : undefined);
    if (blog) {
      selected.push(blog);
    }
    if (linkedin && (!blog || linkedin.id !== blog.id)) {
      selected.push(linkedin);
    }

    if (selected.length === 0) {
      selected.push(seed);
    }

    const createdItems: Array<{ planItemId: string; contentId: string }> = [];
    let created = 0;
    let skipped = 0;
    const aiEnabledRef = { current: useAIAssist };
    let blogContentId: string | null = null;

    for (const item of selected) {
      const existed = await model.contentBuilderItem.findFirst({
        where: {
          workspaceId,
          planItemId: item.id,
        },
        select: { id: true },
      });

      const result = await generateFromPlanItem(workspaceId, item.id);
      if (!result.ok) {
        skipped += 1;
        continue;
      }

      const contentId = result.data.contentId;
      createdItems.push({ planItemId: item.id, contentId });

      if (existed) {
        skipped += 1;
      } else {
        created += 1;
      }

      await bindPackFields({
        contentId,
        packId,
        packType: "item",
        packLabel: `Cluster: ${seed.clusterLabel}`,
      });

      if (item.channel === "blog") {
        blogContentId = contentId;
      }

      if (item.channel === "linkedin" && blogContentId) {
        const blogLink = `https://internal.local/content/${blogContentId}`;
        await appendIfMissing({
          workspaceId,
          contentId,
          marker: blogLink,
          appendix: `[Internal link: Source blog | ${blogLink} | anchor: full article]`,
        });
      }

      if (!existed) {
        await maybeApplyAIAssist(workspaceId, contentId, aiEnabledRef);
      }
    }

    return {
      ok: true,
      data: {
        packId,
        created,
        skipped,
        items: createdItems,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Nie udało się wygenerować item pack.",
      },
    };
  }
}
