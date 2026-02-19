import { prisma } from "@/lib/prisma";

type ProjectListItem = {
  id: string;
  name: string;
  status: "active" | "archived";
  updatedAt: string;
  readinessScore: number;
  readinessState: "incomplete" | "ready";
  missingFields: string[];
};

type ActiveProjectContext = {
  summary: string;
  toneOfVoice: string;
  readinessScore: number;
  readinessState: "incomplete" | "ready";
  missingFields: string[];
  keywordsPrimary: string[];
  internalLinks: Array<{ url: string; title: string }>;
  externalLinks: Array<{ url: string; title: string }>;
};

export type ActiveProjectForEmployee = {
  project: {
    id: string;
    name: string;
    updatedAt: string;
    status: "active" | "archived";
  };
  context: ActiveProjectContext;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).label === "string") {
        return String((entry as Record<string, unknown>).label);
      }
      return "";
    })
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseLinkArray(value: unknown): Array<{ url: string; title: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => entry as Record<string, unknown>)
    .map((entry) => ({
      url: String(entry.url ?? "").trim(),
      title: String(entry.title ?? entry.url ?? "").trim(),
    }))
    .filter((entry) => entry.url.length > 0);
}

export async function listProjects(workspaceId: string): Promise<ProjectListItem[]> {
  const projectModel = prisma.project as unknown as {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };

  const projects = await projectModel.findMany({
    where: {
      workspaceId,
    },
    include: {
      context: {
        select: {
          readinessScore: true,
          readinessState: true,
          missingFields: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return projects.map((project) => {
    const context = (project.context as Record<string, unknown> | undefined) ?? undefined;
    const updatedAt = (context?.updatedAt as Date | undefined) ?? (project.updatedAt as Date);
    const missingFields = parseStringArray(context?.missingFields);
    return {
      id: String(project.id),
      name: String(project.name),
      status: project.deletedAt ? "archived" : "active",
      updatedAt: updatedAt.toISOString(),
      readinessScore: Number(context?.readinessScore ?? 0),
      readinessState: context?.readinessState === "ready" ? "ready" : "incomplete",
      missingFields,
    };
  });
}

export async function getProject(projectId: string, workspaceId: string) {
  const projectModel = prisma.project as unknown as {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  };

  return projectModel.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    include: {
      context: true,
    },
  });
}

export async function getActiveProjectForEmployee(
  workspaceId: string,
  projectIdFromQuery?: string,
): Promise<ActiveProjectForEmployee | null> {
  const projectModel = prisma.project as unknown as {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };

  const projects = await projectModel.findMany({
    where: {
      workspaceId,
    },
    include: {
      context: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (projects.length === 0) {
    return null;
  }

  const byId = new Map(projects.map((project) => [String(project.id), project] as const));
  const chosen =
    (projectIdFromQuery ? byId.get(projectIdFromQuery) : null) ??
    projects.find((project) => {
      const context = (project.context as Record<string, unknown> | undefined) ?? undefined;
      return !project.deletedAt && context?.readinessState === "ready";
    }) ??
    projects.find((project) => !project.deletedAt) ??
    projects[0];

  const context = (chosen.context as Record<string, unknown> | undefined) ?? {};
  const updatedAt = ((context.updatedAt as Date | undefined) ?? (chosen.updatedAt as Date)).toISOString();

  return {
    project: {
      id: String(chosen.id),
      name: String(chosen.name),
      updatedAt,
      status: chosen.deletedAt ? "archived" : "active",
    },
    context: {
      summary: String(context.summary ?? ""),
      toneOfVoice: String(context.toneOfVoice ?? ""),
      readinessScore: Number(context.readinessScore ?? 0),
      readinessState: context.readinessState === "ready" ? "ready" : "incomplete",
      missingFields: parseStringArray(context.missingFields),
      keywordsPrimary: parseStringArray(context.keywordsPrimary),
      internalLinks: parseLinkArray(context.internalLinks),
      externalLinks: parseLinkArray(context.externalLinks),
    },
  };
}
