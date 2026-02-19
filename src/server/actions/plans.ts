"use server";

import { prisma } from "@/lib/prisma";
import { generatePublicationPlan } from "@/modules/plans/planner";
import type { PlanChannel, PlanInput, PlanRefreshInput } from "@/modules/plans/types";
import type { ProjectContextInput } from "@/modules/projects/types";
import { getProject } from "@/server/queries/projects";
import { getAdaptivePlanSuggestions, getPlan, getPlanRefreshProposal } from "@/server/queries/plans";

type PlanItemStatus = "planned" | "queued" | "drafted" | "published" | "skipped";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function normalizeContext(project: Record<string, unknown>): ProjectContextInput | null {
  const context = (project.context as Record<string, unknown> | null) ?? null;
  if (!context) {
    return null;
  }

  const channels = Array.isArray(context.channels) ? context.channels : [];
  const keywordsPrimary = Array.isArray(context.keywordsPrimary) ? context.keywordsPrimary : [];
  const keywordsSecondary = Array.isArray(context.keywordsSecondary) ? context.keywordsSecondary : [];
  const internalLinks = Array.isArray(context.internalLinks) ? context.internalLinks : [];
  const externalLinks = Array.isArray(context.externalLinks) ? context.externalLinks : [];

  return {
    name: String(project.name ?? "Project"),
    summary: String(context.summary ?? ""),
    audience: String(context.audience ?? ""),
    toneOfVoice: String(context.toneOfVoice ?? ""),
    goals: String(context.goals ?? ""),
    channels: channels
      .map((value) => String(value).toLowerCase())
      .filter((value): value is ProjectContextInput["channels"][number] =>
        value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing",
      ),
    keywordsPrimary: keywordsPrimary.map((value) => String(value)).filter((value) => value.length > 0),
    keywordsSecondary: keywordsSecondary.map((value) => String(value)).filter((value) => value.length > 0),
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

function normalizeDays(days: number[]): number[] {
  return [...new Set(days.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))].sort(
    (left, right) => left - right,
  );
}

function normalizeChannels(channels: string[]): PlanChannel[] {
  const values = channels.map((value) => value.toLowerCase());
  return ["blog", "linkedin", "newsletter", "landing"].filter((channel): channel is PlanChannel => values.includes(channel));
}

function validatePlanInput(input: PlanInput): { code: string; message: string } | null {
  if (!input.projectId || !input.name.trim()) {
    return { code: "VALIDATION_ERROR", message: "Uzupełnij project i name." };
  }

  const days = normalizeDays(input.cadence.daysOfWeek);
  if (days.length === 0) {
    return { code: "VALIDATION_ERROR", message: "Wybierz co najmniej jeden dzień tygodnia." };
  }

  const channels = normalizeChannels(input.channels);
  if (channels.length === 0) {
    return { code: "VALIDATION_ERROR", message: "Wybierz co najmniej jeden kanał." };
  }

  if (input.horizonWeeks <= 0) {
    return { code: "VALIDATION_ERROR", message: "Horizon musi być większy od 0." };
  }

  return null;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKey(value: Date): string {
  return startOfDay(value).toISOString().slice(0, 10);
}

function findNearestEmptySlot(items: Array<Record<string, unknown>>, from: Date, to: Date): Date | null {
  if (from > to) {
    return null;
  }

  const occupied = new Set(
    items
      .map((item) => new Date(item.publishDate as Date))
      .map((date) => dateKey(date)),
  );

  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    if (!occupied.has(dateKey(cursor))) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }

  return null;
}

export async function createPlan(workspaceId: string, input: PlanInput): Promise<ActionResult<{ planId: string }>> {
  const validationError = validatePlanInput(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const project = (await getProject(input.projectId, workspaceId)) as Record<string, unknown> | null;
  if (!project) {
    return { ok: false, error: { code: "PROJECT_NOT_FOUND", message: "Projekt nie istnieje." } };
  }

  const context = (project.context as Record<string, unknown> | null) ?? null;
  if (!context || context.readinessState !== "ready") {
    return { ok: false, error: { code: "PROJECT_NOT_READY", message: "Projekt musi mieć readinessState=ready." } };
  }

  const projectContext = normalizeContext(project);
  if (!projectContext) {
    return { ok: false, error: { code: "PROJECT_CONTEXT_MISSING", message: "Brak kontekstu projektu." } };
  }

  const channels = normalizeChannels(input.channels);
  const daysOfWeek = normalizeDays(input.cadence.daysOfWeek);

  const generated = generatePublicationPlan({
    projectContext,
    startDate: input.startDate,
    cadence: {
      freq: input.cadence.freq === "biweekly" ? "biweekly" : "weekly",
      daysOfWeek,
    },
    channels,
    horizonWeeks: input.horizonWeeks,
  });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const txModel = tx as unknown as {
        publicationPlan: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      return txModel.publicationPlan.create({
        data: {
          workspaceId,
          projectId: input.projectId,
          name: input.name,
          status: "draft",
          startDate: new Date(input.startDate),
          cadence: {
            freq: input.cadence.freq === "biweekly" ? "biweekly" : "weekly",
            daysOfWeek,
          },
          channels,
          items: {
            create: generated.items.map((item) => ({
              publishDate: new Date(item.publishDate),
              title: item.title,
              channel: item.channel,
              status: "planned",
              primaryKeyword: item.primaryKeyword,
              secondaryKeywords: item.secondaryKeywords,
              internalLinkSuggestions: item.internalLinkSuggestions,
              externalLinkSuggestions: item.externalLinkSuggestions,
              clusterId: item.clusterId,
              clusterLabel: item.clusterLabel,
              note: item.note,
            })),
          },
        },
      });
    });

    return { ok: true, data: { planId: String(created.id) } };
  } catch {
    return { ok: false, error: { code: "CREATE_FAILED", message: "Nie udało się utworzyć planu." } };
  }
}

export async function updatePlanItemStatus(
  workspaceId: string,
  planItemId: string,
  status: PlanItemStatus,
): Promise<ActionResult<{ status: PlanItemStatus }>> {
  if (!["planned", "queued", "drafted", "published", "skipped"].includes(status)) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Nieprawidłowy status itemu." } };
  }

  const itemModel = prisma as unknown as {
    publicationPlanItem: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
    };
  };

  const item = await itemModel.publicationPlanItem.findFirst({
    where: { id: planItemId },
    include: {
      plan: {
        select: {
          workspaceId: true,
        },
      },
    },
  });

  const plan = (item?.plan as Record<string, unknown> | undefined) ?? undefined;
  if (!item || !plan || String(plan.workspaceId) !== workspaceId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Plan item nie istnieje w tym workspace." } };
  }

  await itemModel.publicationPlanItem.update({
    where: { id: planItemId },
    data: { status },
  });

  return { ok: true, data: { status } };
}

export async function regeneratePlan(workspaceId: string, planId: string, input?: Partial<PlanInput>): Promise<ActionResult<{ planId: string }>> {
  const planModel = prisma as unknown as {
    publicationPlan: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
    };
    publicationPlanItem: {
      deleteMany: (args: unknown) => Promise<unknown>;
      createMany: (args: unknown) => Promise<unknown>;
    };
  };

  const existingPlan = await planModel.publicationPlan.findFirst({
    where: { id: planId, workspaceId },
  });

  if (!existingPlan) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Plan nie istnieje." } };
  }

  const effectiveInput: PlanInput = {
    projectId: String(input?.projectId ?? existingPlan.projectId),
    name: String(input?.name ?? existingPlan.name),
    startDate: String(input?.startDate ?? new Date(existingPlan.startDate as Date).toISOString()),
    cadence: {
      freq: input?.cadence?.freq === "biweekly" || ((existingPlan.cadence as Record<string, unknown>)?.freq === "biweekly") ? "biweekly" : "weekly",
      daysOfWeek: normalizeDays(
        input?.cadence?.daysOfWeek ??
          (Array.isArray((existingPlan.cadence as Record<string, unknown>)?.daysOfWeek)
            ? ((existingPlan.cadence as Record<string, unknown>).daysOfWeek as unknown[]).map((value) => Number(value))
            : []),
      ),
    },
    channels: normalizeChannels(
      input?.channels ??
        (Array.isArray(existingPlan.channels) ? existingPlan.channels.map((value) => String(value)) : []),
    ),
    horizonWeeks: Number(input?.horizonWeeks ?? 8),
  };

  const created = await createPlan(workspaceId, effectiveInput);
  if (!created.ok) {
    return created;
  }

  return { ok: true, data: { planId: created.data.planId } };
}

export async function applyPlanSuggestion(
  workspaceId: string,
  planId: string,
  suggestionId: string,
): Promise<ActionResult<{ applied: true; summary: string }>> {
  try {
    const model = prisma as unknown as {
      publicationPlan: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      publicationPlanItem: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
        create: (args: unknown) => Promise<Record<string, unknown>>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    };

    const plan = await model.publicationPlan.findFirst({
      where: {
        id: planId,
        workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (!plan) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Plan nie istnieje." } };
    }

    const suggestions = await getAdaptivePlanSuggestions(workspaceId, planId);
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      return { ok: false, error: { code: "SUGGESTION_NOT_FOUND", message: "Nie znaleziono sugestii do zastosowania." } };
    }

    const items = await model.publicationPlanItem.findMany({
      where: {
        planId,
      },
      orderBy: {
        publishDate: "asc",
      },
    });

    if (items.length === 0) {
      return { ok: false, error: { code: "PLAN_EMPTY", message: "Plan nie zawiera pozycji do optymalizacji." } };
    }

    const today = startOfDay(new Date());
    const horizonEnd = startOfDay(new Date(items[items.length - 1].publishDate as Date));
    const twoWeeksEnd = startOfDay(addDays(today, 13));
    const windowEnd = twoWeeksEnd < horizonEnd ? twoWeeksEnd : horizonEnd;

    const clusterItems = items.filter((item) => String(item.clusterId) === suggestion.clusterId);

    if (suggestion.type === "increase_cluster") {
      const template = [...clusterItems].sort((left, right) => new Date(right.publishDate as Date).getTime() - new Date(left.publishDate as Date).getTime())[0];
      if (!template) {
        return { ok: false, error: { code: "NO_CLUSTER_TEMPLATE", message: "Brak wzorca pozycji dla klastra." } };
      }

      const slot = findNearestEmptySlot(items, today, windowEnd);
      if (!slot) {
        return { ok: false, error: { code: "NO_SLOT", message: "Brak wolnego slotu w horyzoncie 2 tygodni." } };
      }

      await model.publicationPlanItem.create({
        data: {
          planId,
          publishDate: slot,
          title: String(template.title),
          channel: String(template.channel),
          status: "planned",
          primaryKeyword: String(template.primaryKeyword),
          secondaryKeywords: Array.isArray(template.secondaryKeywords) ? template.secondaryKeywords : [],
          internalLinkSuggestions: Array.isArray(template.internalLinkSuggestions) ? template.internalLinkSuggestions : [],
          externalLinkSuggestions: Array.isArray(template.externalLinkSuggestions) ? template.externalLinkSuggestions : [],
          clusterId: suggestion.clusterId,
          clusterLabel: suggestion.clusterLabel,
          note: String(template.note ?? ""),
        },
      });

      await model.publicationPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      return { ok: true, data: { applied: true, summary: "Dodano nową publikację w klastrze." } };
    }

    if (suggestion.type === "fill_missing") {
      const template = [...clusterItems].sort((left, right) => new Date(right.publishDate as Date).getTime() - new Date(left.publishDate as Date).getTime())[0] ?? items[items.length - 1];
      const slot = findNearestEmptySlot(items, today, windowEnd);
      if (!slot) {
        return { ok: false, error: { code: "NO_SLOT", message: "Brak wolnego slotu na uzupełnienie klastra." } };
      }

      const templateTitle = String(template.title ?? "");
      const title = template && String(template.clusterId) === suggestion.clusterId
        ? templateTitle
        : `${suggestion.clusterLabel} — temat uzupełniający`;

      await model.publicationPlanItem.create({
        data: {
          planId,
          publishDate: slot,
          title,
          channel: String(template.channel ?? "blog"),
          status: "planned",
          primaryKeyword: String(template.primaryKeyword ?? suggestion.clusterLabel),
          secondaryKeywords: Array.isArray(template.secondaryKeywords) ? template.secondaryKeywords : [],
          internalLinkSuggestions: Array.isArray(template.internalLinkSuggestions) ? template.internalLinkSuggestions : [],
          externalLinkSuggestions: Array.isArray(template.externalLinkSuggestions) ? template.externalLinkSuggestions : [],
          clusterId: suggestion.clusterId,
          clusterLabel: suggestion.clusterLabel,
          note: String(template.note ?? ""),
        },
      });

      await model.publicationPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      return { ok: true, data: { applied: true, summary: "Uzupełniono lukę planu dla klastra." } };
    }

    if (suggestion.type === "shift_overdue") {
      const shiftDays = 3;
      const overdue = clusterItems
        .filter((item) => {
          const status = String(item.status);
          const isOpen = status !== "published" && status !== "skipped";
          return isOpen && startOfDay(new Date(item.publishDate as Date)) < today;
        })
        .sort((left, right) => new Date(left.publishDate as Date).getTime() - new Date(right.publishDate as Date).getTime());

      if (overdue.length === 0) {
        return { ok: false, error: { code: "NO_OVERDUE", message: "Brak zaległych pozycji do przesunięcia." } };
      }

      for (const item of overdue) {
        const currentDate = startOfDay(new Date(item.publishDate as Date));
        const shifted = startOfDay(addDays(currentDate, shiftDays));
        const nextDate = shifted > horizonEnd ? horizonEnd : shifted;

        await model.publicationPlanItem.update({
          where: { id: String(item.id) },
          data: { publishDate: nextDate },
        });
      }

      await model.publicationPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      return { ok: true, data: { applied: true, summary: "Przesunięto zaległe pozycje klastra o 3 dni." } };
    }

    if (suggestion.type === "test_new_angle") {
      const nextItem = clusterItems
        .filter((item) => {
          const status = String(item.status);
          return status === "planned" || status === "queued" || status === "drafted";
        })
        .sort((left, right) => new Date(left.publishDate as Date).getTime() - new Date(right.publishDate as Date).getTime())
        .find((item) => startOfDay(new Date(item.publishDate as Date)) >= today)
        ?? clusterItems
          .filter((item) => {
            const status = String(item.status);
            return status === "planned" || status === "queued" || status === "drafted";
          })
          .sort((left, right) => new Date(left.publishDate as Date).getTime() - new Date(right.publishDate as Date).getTime())[0];

      if (!nextItem) {
        return { ok: false, error: { code: "NO_PLANNED_ITEM", message: "Brak pozycji planu do testu nowego kąta." } };
      }

      const currentTitle = String(nextItem.title ?? "");
      const suffix = "(Nowy kąt testowy)";
      const nextTitle = currentTitle.includes(suffix) ? currentTitle : `${currentTitle} ${suffix}`.trim();

      await model.publicationPlanItem.update({
        where: { id: String(nextItem.id) },
        data: { title: nextTitle },
      });

      await model.publicationPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      return { ok: true, data: { applied: true, summary: "Dodano test nowego kąta do najbliższej pozycji." } };
    }

    return { ok: false, error: { code: "UNSUPPORTED_SUGGESTION", message: "Ten typ sugestii nie jest obsługiwany." } };
  } catch {
    return { ok: false, error: { code: "APPLY_FAILED", message: "Nie udało się zastosować sugestii." } };
  }
}

export async function createRefreshedPlan(
  workspaceId: string,
  input: PlanRefreshInput,
): Promise<ActionResult<{ planId: string }>> {
  try {
    const [sourcePlan, proposal] = await Promise.all([
      getPlan(input.planId, workspaceId),
      getPlanRefreshProposal(workspaceId, input),
    ]);

    if (!sourcePlan) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Plan źródłowy nie istnieje." } };
    }
    if (!proposal) {
      return { ok: false, error: { code: "REFRESH_FAILED", message: "Nie udało się wygenerować propozycji odświeżenia." } };
    }

    const created = await prisma.$transaction(async (tx) => {
      const model = tx as unknown as {
        publicationPlan: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      return model.publicationPlan.create({
        data: {
          workspaceId,
          projectId: sourcePlan.projectId,
          name: `Odświeżony plan — ${sourcePlan.name}`,
          status: "draft",
          startDate: new Date(proposal.proposal.startDate),
          cadence: proposal.proposal.cadence,
          channels: proposal.proposal.channels,
          items: {
            create: proposal.proposal.items.map((item) => ({
              publishDate: new Date(item.publishDate),
              title: item.title,
              channel: item.channel,
              status: "planned",
              primaryKeyword: item.primaryKeyword,
              secondaryKeywords: item.secondaryKeywords,
              internalLinkSuggestions: item.internalLinkSuggestions,
              externalLinkSuggestions: item.externalLinkSuggestions,
              clusterId: item.clusterId,
              clusterLabel: item.clusterLabel,
              note: item.note,
            })),
          },
        },
      });
    });

    return {
      ok: true,
      data: {
        planId: String(created.id),
      },
    };
  } catch {
    return { ok: false, error: { code: "REFRESH_CREATE_FAILED", message: "Nie udało się utworzyć odświeżonego planu." } };
  }
}
