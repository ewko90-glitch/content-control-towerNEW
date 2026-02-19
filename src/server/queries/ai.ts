import { ensureWorkspaceCredits } from "@/modules/ai/credits";

export type WorkspaceCreditsView = {
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  resetAt: string;
};

export async function getWorkspaceCredits(workspaceId: string): Promise<WorkspaceCreditsView> {
  const record = await ensureWorkspaceCredits(workspaceId);
  const remaining = Math.max(0, record.monthlyLimit - record.usedThisMonth);

  return {
    monthlyLimit: record.monthlyLimit,
    usedThisMonth: record.usedThisMonth,
    remaining,
    resetAt: record.resetAt.toISOString(),
  };
}
