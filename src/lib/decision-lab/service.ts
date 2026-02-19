import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { DL_ENGINE_VERSION, DL_MAX_INPUT_BYTES, DL_MAX_RESULT_BYTES, DL_SCHEMA_VERSION } from "./constants";
import { sanitizeSimResult } from "./sanitize";
import {
  type DecisionLabVisibilityValue,
  type RunCreateDTO,
  type RunListItem,
  type ScenarioCreateDTO,
  type ScenarioListItem,
  type ScenarioUpdateDTO,
} from "./types";

export class DecisionLabServiceError extends Error {
  status: number;

  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Viewer = {
  userId: string;
};

type ViewerContext = {
  workspaceId: string;
  workspaceSlug: string;
  viewerId: string;
  role: Role | "OWNER";
  isAdminOrOwner: boolean;
  canManage: boolean;
};

function hasManagerLikeRole(role: Role | "OWNER"): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

function canReadPrivate(params: {
  createdByUserId: string;
  viewerId: string;
  isAdminOrOwner: boolean;
}): boolean {
  return params.isAdminOrOwner || params.createdByUserId === params.viewerId;
}

function mapScenarioListItem(input: {
  id: string;
  name: string;
  description: string | null;
  visibility: DecisionLabVisibilityValue;
  horizonDays: number;
  knobs: unknown;
  runCount: number;
  lastRunAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  createdByUserId: string;
}): ScenarioListItem {
  return {
    id: input.id,
    name: input.name,
    description: input.description ?? undefined,
    visibility: input.visibility,
    horizonDays: input.horizonDays,
    knobs: Array.isArray(input.knobs) ? input.knobs : [],
    runCount: input.runCount,
    lastRunAt: input.lastRunAt?.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    createdAt: input.createdAt.toISOString(),
    createdByUserId: input.createdByUserId,
  };
}

function mapRunListItem(input: {
  id: string;
  scenarioId: string | null;
  scenarioNameSnapshot: string;
  schemaVersion: string;
  engineVersion: string;
  horizonDays: number;
  inputSummary: unknown;
  result: unknown;
  createdByUserId: string;
  createdAt: Date;
}): RunListItem {
  return {
    id: input.id,
    scenarioId: input.scenarioId ?? undefined,
    scenarioNameSnapshot: input.scenarioNameSnapshot,
    schemaVersion: input.schemaVersion,
    engineVersion: input.engineVersion,
    horizonDays: input.horizonDays,
    inputSummary: input.inputSummary as RunListItem["inputSummary"],
    result: input.result as RunListItem["result"],
    createdByUserId: input.createdByUserId,
    createdAt: input.createdAt.toISOString(),
  };
}

function ensureJsonSizeBounds(input: unknown, maxBytes: number, fieldName: string): void {
  const serialized = JSON.stringify(input);
  const byteLength = Buffer.byteLength(serialized, "utf8");
  if (byteLength > maxBytes) {
    throw new DecisionLabServiceError(400, `${fieldName} exceeds maximum allowed size`);
  }
}

async function resolveViewerContext(workspaceSlug: string, viewer: Viewer): Promise<ViewerContext> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: workspaceSlug,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      ownerId: true,
      memberships: {
        where: { userId: viewer.userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!workspace) {
    throw new DecisionLabServiceError(404, "Workspace not found");
  }

  const isOwner = workspace.ownerId === viewer.userId;
  const membershipRole = workspace.memberships[0]?.role;

  if (!isOwner && !membershipRole) {
    throw new DecisionLabServiceError(403, "Access denied");
  }

  const role: Role | "OWNER" = isOwner ? "OWNER" : membershipRole!;
  const isAdminOrOwner = isOwner || role === "ADMIN";

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    viewerId: viewer.userId,
    role,
    isAdminOrOwner,
    canManage: hasManagerLikeRole(role),
  };
}

export async function listScenarios(workspaceSlug: string, viewer: Viewer): Promise<ScenarioListItem[]> {
  const context = await resolveViewerContext(workspaceSlug, viewer);

  const scenarios = await prisma.decisionLabScenario.findMany({
    where: {
      workspaceId: context.workspaceId,
      deletedAt: null,
      ...(context.isAdminOrOwner
        ? {}
        : {
            OR: [{ visibility: "WORKSPACE" }, { createdByUserId: context.viewerId }],
          }),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return scenarios.map(mapScenarioListItem);
}

export async function createScenario(workspaceSlug: string, viewer: Viewer, dto: ScenarioCreateDTO): Promise<ScenarioListItem> {
  const context = await resolveViewerContext(workspaceSlug, viewer);
  if (!context.canManage) {
    throw new DecisionLabServiceError(403, "Insufficient permissions");
  }

  const scenario = await prisma.decisionLabScenario.create({
    data: {
      workspaceId: context.workspaceId,
      name: dto.name,
      description: dto.description ?? null,
      visibility: dto.visibility,
      knobs: dto.knobs,
      horizonDays: dto.horizonDays,
      createdByUserId: context.viewerId,
    },
  });

  return mapScenarioListItem(scenario);
}

export async function getScenario(workspaceSlug: string, viewer: Viewer, scenarioId: string): Promise<ScenarioListItem> {
  const context = await resolveViewerContext(workspaceSlug, viewer);

  const scenario = await prisma.decisionLabScenario.findFirst({
    where: {
      id: scenarioId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
  });

  if (!scenario) {
    throw new DecisionLabServiceError(404, "Scenario not found");
  }

  const canRead =
    scenario.visibility === "WORKSPACE" ||
    canReadPrivate({
      createdByUserId: scenario.createdByUserId,
      viewerId: context.viewerId,
      isAdminOrOwner: context.isAdminOrOwner,
    });

  if (!canRead) {
    throw new DecisionLabServiceError(403, "Access denied");
  }

  return mapScenarioListItem(scenario);
}

export async function updateScenario(
  workspaceSlug: string,
  viewer: Viewer,
  scenarioId: string,
  dto: ScenarioUpdateDTO,
): Promise<ScenarioListItem> {
  const context = await resolveViewerContext(workspaceSlug, viewer);
  if (!context.canManage) {
    throw new DecisionLabServiceError(403, "Insufficient permissions");
  }

  const existing = await prisma.decisionLabScenario.findFirst({
    where: {
      id: scenarioId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new DecisionLabServiceError(404, "Scenario not found");
  }

  const updated = await prisma.decisionLabScenario.update({
    where: { id: existing.id },
    data: {
      name: dto.name,
      description: typeof dto.description === "string" ? dto.description : dto.description === undefined ? undefined : null,
      visibility: dto.visibility,
      horizonDays: dto.horizonDays,
      knobs: dto.knobs,
    },
  });

  return mapScenarioListItem(updated);
}

export async function deleteScenario(workspaceSlug: string, viewer: Viewer, scenarioId: string): Promise<{ ok: true }> {
  const context = await resolveViewerContext(workspaceSlug, viewer);
  if (!context.canManage) {
    throw new DecisionLabServiceError(403, "Insufficient permissions");
  }

  const existing = await prisma.decisionLabScenario.findFirst({
    where: {
      id: scenarioId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new DecisionLabServiceError(404, "Scenario not found");
  }

  await prisma.decisionLabScenario.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  return { ok: true };
}

export async function listRuns(
  workspaceSlug: string,
  viewer: Viewer,
  opts?: { scenarioId?: string },
): Promise<RunListItem[]> {
  const context = await resolveViewerContext(workspaceSlug, viewer);

  const runs = await prisma.decisionLabRun.findMany({
    where: {
      workspaceId: context.workspaceId,
      deletedAt: null,
      ...(opts?.scenarioId
        ? {
            scenarioId: opts.scenarioId,
          }
        : {}),
    },
    include: {
      scenario: {
        select: {
          visibility: true,
          createdByUserId: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const visible = runs.filter((run) => {
    if (context.isAdminOrOwner) {
      return true;
    }

    if (!run.scenarioId || !run.scenario) {
      return run.createdByUserId === context.viewerId;
    }

    if (run.scenario.deletedAt) {
      return run.createdByUserId === context.viewerId;
    }

    if (run.scenario.visibility === "WORKSPACE") {
      return true;
    }

    return run.createdByUserId === context.viewerId;
  });

  return visible.map((run) =>
    mapRunListItem({
      ...run,
      scenarioId: run.scenarioId,
    }),
  );
}

export async function createRun(workspaceSlug: string, viewer: Viewer, dto: RunCreateDTO): Promise<RunListItem> {
  const context = await resolveViewerContext(workspaceSlug, viewer);
  if (!context.canManage) {
    throw new DecisionLabServiceError(403, "Insufficient permissions");
  }

  let scenarioId: string | null = null;
  if (dto.scenarioId) {
    const scenario = await prisma.decisionLabScenario.findFirst({
      where: {
        id: dto.scenarioId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!scenario) {
      throw new DecisionLabServiceError(404, "Scenario not found");
    }

    scenarioId = scenario.id;
  }

  ensureJsonSizeBounds(dto.inputSummary, DL_MAX_INPUT_BYTES, "inputSummary");
  const sanitizedResult = sanitizeSimResult(dto.result);
  ensureJsonSizeBounds(sanitizedResult, DL_MAX_RESULT_BYTES, "result");

  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.decisionLabRun.create({
      data: {
        workspaceId: context.workspaceId,
        scenarioId,
        scenarioNameSnapshot: dto.scenarioNameSnapshot,
        schemaVersion: DL_SCHEMA_VERSION,
        engineVersion: DL_ENGINE_VERSION,
        horizonDays: dto.horizonDays,
        inputSummary: dto.inputSummary,
        result: sanitizedResult,
        createdByUserId: context.viewerId,
      },
    });

    if (scenarioId) {
      await tx.decisionLabScenario.update({
        where: { id: scenarioId },
        data: {
          runCount: { increment: 1 },
          lastRunAt: run.createdAt,
        },
      });
    }

    return run;
  });

  return mapRunListItem(created);
}

export async function getRun(workspaceSlug: string, viewer: Viewer, runId: string): Promise<RunListItem> {
  const context = await resolveViewerContext(workspaceSlug, viewer);

  const run = await prisma.decisionLabRun.findFirst({
    where: {
      id: runId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    include: {
      scenario: {
        select: {
          visibility: true,
          createdByUserId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!run) {
    throw new DecisionLabServiceError(404, "Run not found");
  }

  if (!context.isAdminOrOwner) {
    const scenarioVisibility = run.scenario?.visibility;
    const scenarioOwner = run.scenario?.createdByUserId;

    const canRead =
      run.createdByUserId === context.viewerId ||
      (scenarioVisibility === "WORKSPACE" && !run.scenario?.deletedAt) ||
      (scenarioVisibility === "PRIVATE" && run.createdByUserId === context.viewerId && scenarioOwner !== undefined);

    if (!canRead) {
      throw new DecisionLabServiceError(403, "Access denied");
    }
  }

  return mapRunListItem(run);
}

export async function deleteRun(workspaceSlug: string, viewer: Viewer, runId: string): Promise<{ ok: true }> {
  const context = await resolveViewerContext(workspaceSlug, viewer);
  if (!context.canManage) {
    throw new DecisionLabServiceError(403, "Insufficient permissions");
  }

  const existing = await prisma.decisionLabRun.findFirst({
    where: {
      id: runId,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      scenarioId: true,
    },
  });

  if (!existing) {
    throw new DecisionLabServiceError(404, "Run not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.decisionLabRun.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    if (existing.scenarioId) {
      const activeCount = await tx.decisionLabRun.count({
        where: {
          workspaceId: context.workspaceId,
          scenarioId: existing.scenarioId,
          deletedAt: null,
        },
      });

      await tx.decisionLabScenario.updateMany({
        where: {
          id: existing.scenarioId,
          workspaceId: context.workspaceId,
        },
        data: {
          runCount: Math.max(0, activeCount),
        },
      });
    }
  });

  return { ok: true };
}
