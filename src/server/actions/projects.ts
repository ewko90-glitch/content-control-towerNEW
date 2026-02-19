import { prisma } from "@/lib/prisma";
import { computeReadiness, validateProjectContext } from "@/modules/projects/validators";
import type { ChannelType, ExternalLink, InternalLink, ProjectContextInput, ProjectValidationError } from "@/modules/projects/types";

type ActionFailure = {
  ok: false;
  errors: ProjectValidationError[];
};

type CreateProjectSuccess = {
  ok: true;
  projectId: string;
  readiness: ReturnType<typeof computeReadiness>;
};

type UpdateProjectSuccess = {
  ok: true;
  readiness: ReturnType<typeof computeReadiness>;
};

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function splitCsv(input: unknown): string[] {
  return toString(input)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toChannels(input: unknown): ChannelType[] {
  const allowed = new Set<ChannelType>(["linkedin", "blog", "newsletter", "landing"]);
  return splitCsv(input)
    .map((item) => item.toLowerCase())
    .filter((item): item is ChannelType => allowed.has(item as ChannelType));
}

function toInternalLinks(input: unknown): InternalLink[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const value = entry as Record<string, unknown>;
      const note = toString(value.note).trim();
      return {
        url: toString(value.url).trim(),
        title: toString(value.title).trim(),
        ...(note.length > 0 ? { note } : {}),
        anchorHints: splitCsv(value.anchorHints),
      };
    })
    .filter((entry): entry is InternalLink => entry !== null);
}

function toExternalLinks(input: unknown): ExternalLink[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const value = entry as Record<string, unknown>;
      const note = toString(value.note).trim();
      return {
        url: toString(value.url).trim(),
        title: toString(value.title).trim(),
        ...(note.length > 0 ? { note } : {}),
      };
    })
    .filter((entry): entry is ExternalLink => entry !== null);
}

function coercePayload(payload: unknown): ProjectContextInput {
  const value = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

  return {
    name: toString(value.name).trim(),
    summary: toString(value.summary).trim(),
    audience: toString(value.audience).trim(),
    toneOfVoice: toString(value.toneOfVoice).trim(),
    goals: toString(value.goals).trim(),
    channels: toChannels(value.channels),
    keywordsPrimary: splitCsv(value.keywordsPrimary),
    keywordsSecondary: splitCsv(value.keywordsSecondary),
    internalLinks: toInternalLinks(value.internalLinks),
    externalLinks: toExternalLinks(value.externalLinks),
  };
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return base.length > 0 ? base : "project";
}

async function ensureUniqueSlug(workspaceId: string, name: string): Promise<string> {
  const base = slugify(name);
  const existing = await prisma.project.findMany({
    where: {
      workspaceId,
      slug: {
        startsWith: base,
      },
    },
    select: {
      slug: true,
    },
  });

  const taken = new Set(existing.map((entry) => entry.slug));
  if (!taken.has(base)) {
    return base;
  }

  let counter = 2;
  while (counter <= 500) {
    const candidate = `${base}-${counter}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }

  return `${base}-501`;
}

export async function createProject(workspaceId: string, payload: unknown): Promise<CreateProjectSuccess | ActionFailure> {
  const input = coercePayload(payload);
  const validation = validateProjectContext(input);
  if (validation.errors.length > 0) {
    return { ok: false, errors: validation.errors };
  }

  const readiness = computeReadiness(input);

  try {
    const slug = await ensureUniqueSlug(workspaceId, input.name);

    const created = await prisma.$transaction(async (tx) => {
      const txUnsafe = tx as unknown as {
        project: {
          create: (args: unknown) => Promise<{ id: string }>;
        };
        projectContext: {
          create: (args: unknown) => Promise<unknown>;
        };
      };

      const project = await txUnsafe.project.create({
        data: {
          workspaceId,
          name: input.name,
          slug,
        },
      });

      await txUnsafe.projectContext.create({
        data: {
          projectId: project.id,
          summary: input.summary,
          audience: input.audience,
          toneOfVoice: input.toneOfVoice,
          goals: input.goals,
          channels: input.channels,
          keywordsPrimary: input.keywordsPrimary,
          keywordsSecondary: input.keywordsSecondary,
          internalLinks: input.internalLinks,
          externalLinks: input.externalLinks,
          readinessScore: readiness.score,
          readinessState: readiness.state,
          missingFields: readiness.missing.map((item) => item.id),
        },
      });

      return project;
    });

    return {
      ok: true,
      projectId: created.id,
      readiness,
    };
  } catch {
    return {
      ok: false,
      errors: [{ field: "form", message: "Could not create project. Please try again." }],
    };
  }
}

export async function updateProjectContext(projectId: string, workspaceId: string, payload: unknown): Promise<UpdateProjectSuccess | ActionFailure> {
  const input = coercePayload(payload);

  const projectModel = prisma.project as unknown as {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  };

  const existing = await projectModel.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    include: {
      context: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      errors: [{ field: "form", message: "Project not found in this workspace." }],
    };
  }

  const existingUnsafe = existing as Record<string, unknown>;
  const existingContext = (existingUnsafe.context as Record<string, unknown> | undefined) ?? undefined;

  const merged: ProjectContextInput = {
    name: input.name.length > 0 ? input.name : String(existingUnsafe.name ?? ""),
    summary: input.summary.length > 0 ? input.summary : String(existingContext?.summary ?? ""),
    audience: input.audience.length > 0 ? input.audience : String(existingContext?.audience ?? ""),
    toneOfVoice: input.toneOfVoice.length > 0 ? input.toneOfVoice : String(existingContext?.toneOfVoice ?? ""),
    goals: input.goals.length > 0 ? input.goals : String(existingContext?.goals ?? ""),
    channels: input.channels.length > 0 ? input.channels : (((existingContext?.channels as ChannelType[] | null) ?? []) as ChannelType[]),
    keywordsPrimary:
      input.keywordsPrimary.length > 0
        ? input.keywordsPrimary
        : (((existingContext?.keywordsPrimary as string[] | null) ?? []) as string[]),
    keywordsSecondary:
      input.keywordsSecondary.length > 0
        ? input.keywordsSecondary
        : (((existingContext?.keywordsSecondary as string[] | null) ?? []) as string[]),
    internalLinks:
      input.internalLinks.length > 0
        ? input.internalLinks
        : (((existingContext?.internalLinks as InternalLink[] | null) ?? []) as InternalLink[]),
    externalLinks:
      input.externalLinks.length > 0
        ? input.externalLinks
        : (((existingContext?.externalLinks as ExternalLink[] | null) ?? []) as ExternalLink[]),
  };

  const validation = validateProjectContext(merged);
  if (validation.errors.length > 0) {
    return { ok: false, errors: validation.errors };
  }

  const readiness = computeReadiness(merged);

  try {
    await prisma.$transaction(async (tx) => {
      const txUnsafe = tx as unknown as {
        project: {
          update: (args: unknown) => Promise<unknown>;
        };
        projectContext: {
          update: (args: unknown) => Promise<unknown>;
          create: (args: unknown) => Promise<unknown>;
        };
      };

      await txUnsafe.project.update({
        where: { id: String(existingUnsafe.id) },
        data: {
          name: merged.name,
        },
      });

      if (existingContext) {
        await txUnsafe.projectContext.update({
          where: { projectId: String(existingUnsafe.id) },
          data: {
            summary: merged.summary,
            audience: merged.audience,
            toneOfVoice: merged.toneOfVoice,
            goals: merged.goals,
            channels: merged.channels,
            keywordsPrimary: merged.keywordsPrimary,
            keywordsSecondary: merged.keywordsSecondary,
            internalLinks: merged.internalLinks,
            externalLinks: merged.externalLinks,
            readinessScore: readiness.score,
            readinessState: readiness.state,
            missingFields: readiness.missing.map((item) => item.id),
          },
        });
      } else {
        await txUnsafe.projectContext.create({
          data: {
            projectId: String(existingUnsafe.id),
            summary: merged.summary,
            audience: merged.audience,
            toneOfVoice: merged.toneOfVoice,
            goals: merged.goals,
            channels: merged.channels,
            keywordsPrimary: merged.keywordsPrimary,
            keywordsSecondary: merged.keywordsSecondary,
            internalLinks: merged.internalLinks,
            externalLinks: merged.externalLinks,
            readinessScore: readiness.score,
            readinessState: readiness.state,
            missingFields: readiness.missing.map((item) => item.id),
          },
        });
      }
    });

    return {
      ok: true,
      readiness,
    };
  } catch {
    return {
      ok: false,
      errors: [{ field: "form", message: "Could not save project context. Please try again." }],
    };
  }
}
