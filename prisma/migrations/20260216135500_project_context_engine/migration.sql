-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "ProjectContext" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "toneOfVoice" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "channels" JSONB NOT NULL,
    "keywordsPrimary" JSONB NOT NULL,
    "keywordsSecondary" JSONB NOT NULL,
    "internalLinks" JSONB NOT NULL,
    "externalLinks" JSONB NOT NULL,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "readinessState" TEXT NOT NULL DEFAULT 'incomplete',
    "missingFields" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContext_projectId_key" ON "ProjectContext"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContext_projectId_idx" ON "ProjectContext"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectContext" ADD CONSTRAINT "ProjectContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
