ALTER TABLE "ContentBuilderItem"
  ADD COLUMN "packId" TEXT,
  ADD COLUMN "packType" TEXT,
  ADD COLUMN "packLabel" TEXT;

CREATE INDEX "ContentBuilderItem_packId_idx" ON "ContentBuilderItem"("packId");
