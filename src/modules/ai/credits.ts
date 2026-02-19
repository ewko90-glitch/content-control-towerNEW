import { prisma } from "@/lib/prisma";
import type { AIAssistAction, ContentChannel } from "@/modules/content/types";

export type WorkspaceCreditsRecord = {
  monthlyLimit: number;
  usedThisMonth: number;
  resetAt: Date;
};

export function nextMonthBoundary(baseDate: Date): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1, 0, 0, 0, 0);
}

function monthlyLimitFromTier(tier: string | null | undefined, fallback: number): number {
  if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }

  if (tier === "CONTROL") {
    return 1500;
  }
  if (tier === "PRO") {
    return 600;
  }
  return 120;
}

export function estimateCredits(action: AIAssistAction, _channel: ContentChannel, bodyLength: number): number {
  const base = action === "improve" ? 1 : 2;
  const extra = bodyLength > 4000 ? 1 : 0;
  return Math.min(4, base + extra);
}

export function canSpend(credits: WorkspaceCreditsRecord, cost: number): boolean {
  return credits.usedThisMonth + cost <= credits.monthlyLimit;
}

export async function ensureWorkspaceCredits(workspaceId: string): Promise<WorkspaceCreditsRecord> {
  const workspaceCreditsModel = (prisma as unknown as {
    workspaceCredits: {
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
    };
    workspacePlan: {
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    };
  });

  const existing = await workspaceCreditsModel.workspaceCredits.findUnique({
    where: { workspaceId },
  });

  const now = new Date();
  if (!existing) {
    const plan = await workspaceCreditsModel.workspacePlan.findUnique({
      where: { workspaceId },
      select: { tier: true, aiCreditsMonthly: true },
    });

    const monthlyLimit = monthlyLimitFromTier(
      plan?.tier ? String(plan.tier) : null,
      plan?.aiCreditsMonthly ? Number(plan.aiCreditsMonthly) : 0,
    );

    const created = await workspaceCreditsModel.workspaceCredits.create({
      data: {
        workspaceId,
        monthlyLimit,
        usedThisMonth: 0,
        resetAt: nextMonthBoundary(now),
      },
    });

    return {
      monthlyLimit: Number(created.monthlyLimit),
      usedThisMonth: Number(created.usedThisMonth),
      resetAt: new Date(created.resetAt as Date),
    };
  }

  const resetAt = new Date(existing.resetAt as Date);
  if (now > resetAt) {
    const updated = await workspaceCreditsModel.workspaceCredits.update({
      where: { workspaceId },
      data: {
        usedThisMonth: 0,
        resetAt: nextMonthBoundary(now),
      },
    });

    return {
      monthlyLimit: Number(updated.monthlyLimit),
      usedThisMonth: Number(updated.usedThisMonth),
      resetAt: new Date(updated.resetAt as Date),
    };
  }

  return {
    monthlyLimit: Number(existing.monthlyLimit),
    usedThisMonth: Number(existing.usedThisMonth),
    resetAt,
  };
}

export async function spendCredits(workspaceId: string, cost: number): Promise<{ ok: boolean; remaining: number; record: WorkspaceCreditsRecord }> {
  const record = await ensureWorkspaceCredits(workspaceId);
  if (!canSpend(record, cost)) {
    return {
      ok: false,
      remaining: Math.max(0, record.monthlyLimit - record.usedThisMonth),
      record,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const model = tx as unknown as {
      workspaceCredits: {
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    };

    return model.workspaceCredits.update({
      where: { workspaceId },
      data: {
        usedThisMonth: {
          increment: cost,
        },
      },
    });
  });

  const normalized = {
    monthlyLimit: Number(updated.monthlyLimit),
    usedThisMonth: Number(updated.usedThisMonth),
    resetAt: new Date(updated.resetAt as Date),
  };

  return {
    ok: true,
    remaining: Math.max(0, normalized.monthlyLimit - normalized.usedThisMonth),
    record: normalized,
  };
}
