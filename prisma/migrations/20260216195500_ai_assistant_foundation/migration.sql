CREATE TYPE "AIAssistAction" AS ENUM ('improve', 'seo_optimize', 'adapt_channel');

ALTER TABLE "ContentBuilderItem"
  ADD COLUMN "aiGenerationUsed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiTokensUsed" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkspaceCredits" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "monthlyLimit" INTEGER NOT NULL DEFAULT 0,
  "usedThisMonth" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceCredits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceCredits_workspaceId_key" ON "WorkspaceCredits"("workspaceId");
CREATE INDEX "WorkspaceCredits_workspaceId_idx" ON "WorkspaceCredits"("workspaceId");

CREATE TABLE "AIUsageEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contentId" TEXT,
  "action" "AIAssistAction" NOT NULL,
  "creditsUsed" INTEGER NOT NULL,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "model" TEXT NOT NULL DEFAULT 'unset',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB NOT NULL,
  CONSTRAINT "AIUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageEvent_workspaceId_idx" ON "AIUsageEvent"("workspaceId");
CREATE INDEX "AIUsageEvent_contentId_idx" ON "AIUsageEvent"("contentId");
