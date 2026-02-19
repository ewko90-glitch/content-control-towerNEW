CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'archived');

CREATE TYPE "PlanItemStatus" AS ENUM ('planned', 'queued', 'drafted', 'published', 'skipped');

CREATE TABLE "PublicationPlan" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "PlanStatus" NOT NULL DEFAULT 'draft',
  "startDate" TIMESTAMP(3) NOT NULL,
  "cadence" JSONB NOT NULL,
  "channels" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationPlanItem" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "publishDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" "PlanItemStatus" NOT NULL DEFAULT 'planned',
  "primaryKeyword" TEXT NOT NULL,
  "secondaryKeywords" JSONB NOT NULL,
  "internalLinkSuggestions" JSONB NOT NULL,
  "externalLinkSuggestions" JSONB NOT NULL,
  "clusterId" TEXT NOT NULL,
  "clusterLabel" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicationPlan_workspaceId_idx" ON "PublicationPlan"("workspaceId");
CREATE INDEX "PublicationPlan_projectId_idx" ON "PublicationPlan"("projectId");
CREATE INDEX "PublicationPlanItem_planId_idx" ON "PublicationPlanItem"("planId");
CREATE INDEX "PublicationPlanItem_publishDate_idx" ON "PublicationPlanItem"("publishDate");

ALTER TABLE "PublicationPlan"
  ADD CONSTRAINT "PublicationPlan_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationPlanItem"
  ADD CONSTRAINT "PublicationPlanItem_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "PublicationPlan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
