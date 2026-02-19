CREATE TYPE "ContentChannel" AS ENUM ('linkedin', 'blog', 'newsletter', 'landing');

CREATE TYPE "ContentStatus" AS ENUM ('draft', 'review', 'approved', 'scheduled', 'published', 'archived');

CREATE TABLE "ContentBuilderItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "channel" "ContentChannel" NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "angle" TEXT NOT NULL,
  "qualityScore" INTEGER NOT NULL DEFAULT 0,
  "qualityState" TEXT NOT NULL DEFAULT 'incomplete',
  "qualityIssues" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentBuilderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentBuilderVersion" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "meta" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentBuilderVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentBuilderItem_workspaceId_idx" ON "ContentBuilderItem"("workspaceId");
CREATE INDEX "ContentBuilderItem_projectId_idx" ON "ContentBuilderItem"("projectId");
CREATE INDEX "ContentBuilderItem_status_idx" ON "ContentBuilderItem"("status");
CREATE INDEX "ContentBuilderItem_updatedAt_idx" ON "ContentBuilderItem"("updatedAt");

CREATE INDEX "ContentBuilderVersion_contentId_idx" ON "ContentBuilderVersion"("contentId");
CREATE INDEX "ContentBuilderVersion_contentId_version_idx" ON "ContentBuilderVersion"("contentId", "version");

ALTER TABLE "ContentBuilderItem"
  ADD CONSTRAINT "ContentBuilderItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentBuilderVersion"
  ADD CONSTRAINT "ContentBuilderVersion_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "ContentBuilderItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;