import type { AIActionType, Prisma } from "@prisma/client";

import { createAuditLog } from "@/lib/auth/audit";

import { ContentDomainError } from "./errors";

type QueueAiJobInput = {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  contentItemId?: string | null;
  actionType: AIActionType;
  input?: Prisma.InputJsonValue;
  creditsCost?: number;
};

export async function queueAiJob(input: QueueAiJobInput) {
  const creditsCost = input.creditsCost ?? 1;

  const creditAccount = await input.tx.aICreditAccount.findUnique({
    where: {
      workspaceId: input.workspaceId,
    },
  });

  if (!creditAccount) {
    throw new ContentDomainError("CONFLICT", "Brak skonfigurowanego konta kredytów AI dla workspace.", 409);
  }

  const availableCredits =
    creditAccount.creditsMonthly -
    creditAccount.creditsUsed +
    (creditAccount.purchasedCredits - creditAccount.purchasedCreditsUsed);

  if (availableCredits < creditsCost) {
    throw new ContentDomainError("INSUFFICIENT_AI_CREDITS", "Brak wystarczających kredytów AI.", 402);
  }

  const aiJob = await input.tx.aIJob.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      contentItemId: input.contentItemId ?? null,
      actionType: input.actionType,
      creditsCost,
      status: "QUEUED",
      input: input.input,
    },
  });

  await input.tx.aIUsageLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      actionType: input.actionType,
      creditsUsed: creditsCost,
      relatedEntityType: input.contentItemId ? "ContentItem" : "Workspace",
      relatedEntityId: input.contentItemId ?? null,
      metadata: {
        aiJobId: aiJob.id,
      },
    },
  });

  await input.tx.aICreditAccount.update({
    where: {
      workspaceId: input.workspaceId,
    },
    data: {
      creditsUsed: {
        increment: creditsCost,
      },
    },
  });

  await createAuditLog({
    action: "AI_JOB_QUEUED",
    userId: input.userId,
    workspaceId: input.workspaceId,
    entityType: "AIJob",
    entityId: aiJob.id,
    metadata: {
      actionType: input.actionType,
      creditsCost,
    },
  });

  return aiJob;
}