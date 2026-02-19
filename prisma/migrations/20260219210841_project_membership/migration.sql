-- CreateEnum
CREATE TYPE "DecisionLabVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');

-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPerformance" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "views" INTEGER,
    "clicks" INTEGER,
    "leads" INTEGER,
    "rating" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLabScenario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "DecisionLabVisibility" NOT NULL DEFAULT 'WORKSPACE',
    "knobs" JSONB NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DecisionLabScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLabRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "scenarioNameSnapshot" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionLabRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMembership_workspaceId_idx" ON "ProjectMembership"("workspaceId");

-- CreateIndex
CREATE INDEX "ProjectMembership_projectId_idx" ON "ProjectMembership"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMembership_userId_idx" ON "ProjectMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_projectId_userId_key" ON "ProjectMembership"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPerformance_contentId_key" ON "ContentPerformance"("contentId");

-- CreateIndex
CREATE INDEX "ContentPerformance_contentId_idx" ON "ContentPerformance"("contentId");

-- CreateIndex
CREATE INDEX "DecisionLabScenario_workspaceId_idx" ON "DecisionLabScenario"("workspaceId");

-- CreateIndex
CREATE INDEX "DecisionLabScenario_workspaceId_updatedAt_idx" ON "DecisionLabScenario"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "DecisionLabScenario_workspaceId_visibility_idx" ON "DecisionLabScenario"("workspaceId", "visibility");

-- CreateIndex
CREATE INDEX "DecisionLabScenario_workspaceId_createdByUserId_idx" ON "DecisionLabScenario"("workspaceId", "createdByUserId");

-- CreateIndex
CREATE INDEX "DecisionLabScenario_deletedAt_idx" ON "DecisionLabScenario"("deletedAt");

-- CreateIndex
CREATE INDEX "DecisionLabRun_workspaceId_idx" ON "DecisionLabRun"("workspaceId");

-- CreateIndex
CREATE INDEX "DecisionLabRun_workspaceId_createdAt_idx" ON "DecisionLabRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLabRun_workspaceId_scenarioId_createdAt_idx" ON "DecisionLabRun"("workspaceId", "scenarioId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLabRun_workspaceId_createdByUserId_idx" ON "DecisionLabRun"("workspaceId", "createdByUserId");

-- CreateIndex
CREATE INDEX "DecisionLabRun_deletedAt_idx" ON "DecisionLabRun"("deletedAt");

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLabScenario" ADD CONSTRAINT "DecisionLabScenario_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLabRun" ADD CONSTRAINT "DecisionLabRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLabRun" ADD CONSTRAINT "DecisionLabRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DecisionLabScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
