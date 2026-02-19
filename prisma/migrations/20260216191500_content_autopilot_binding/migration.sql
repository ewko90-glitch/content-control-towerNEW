ALTER TABLE "ContentBuilderItem"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "planItemId" TEXT,
  ADD COLUMN "publishDate" TIMESTAMP(3),
  ADD COLUMN "clusterId" TEXT,
  ADD COLUMN "clusterLabel" TEXT,
  ADD COLUMN "primaryKeyword" TEXT,
  ADD COLUMN "secondaryKeywords" JSONB,
  ADD COLUMN "internalLinkSuggestions" JSONB,
  ADD COLUMN "externalLinkSuggestions" JSONB;

CREATE INDEX "ContentBuilderItem_planId_idx" ON "ContentBuilderItem"("planId");
CREATE INDEX "ContentBuilderItem_publishDate_idx" ON "ContentBuilderItem"("publishDate");
CREATE UNIQUE INDEX "ContentBuilderItem_planItemId_key" ON "ContentBuilderItem"("planItemId");
