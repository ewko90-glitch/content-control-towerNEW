-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'ARTICLE', 'NEWSLETTER', 'VIDEO_SCRIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('IDEA', 'DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PLANNED', 'READY', 'PUBLISHED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AIActionType" AS ENUM ('GENERATE_DRAFT', 'IMPROVE', 'SEO_OPTIMIZE', 'SCORE', 'REWRITE_TONE');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "TransitionDirection" AS ENUM ('FORWARD', 'BACKWARD', 'JUMP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_MOVED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_VERSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_JOB_QUEUED';

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "type" "ContentType" NOT NULL DEFAULT 'POST',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'IDEA',
    "currentVersionId" TEXT,
    "assignedToUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "tags" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "source" TEXT NOT NULL,
    "promptSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "fromStatus" "WorkflowStatus" NOT NULL,
    "toStatus" "WorkflowStatus" NOT NULL,
    "direction" "TransitionDirection",
    "changedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "decidedByUserId" TEXT,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PLANNED',
    "externalRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "userId" TEXT,
    "actionType" "AIActionType" NOT NULL,
    "creditsCost" INTEGER NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentExport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_status_idx" ON "ContentItem"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_channelId_status_idx" ON "ContentItem"("workspaceId", "channelId", "status");

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_projectId_status_idx" ON "ContentItem"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_dueAt_idx" ON "ContentItem"("workspaceId", "dueAt");

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_updatedAt_idx" ON "ContentItem"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentItem_deletedAt_idx" ON "ContentItem"("deletedAt");

-- CreateIndex
CREATE INDEX "ContentVersion_contentItemId_createdAt_idx" ON "ContentVersion"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentVersion_workspaceId_createdAt_idx" ON "ContentVersion"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_workspaceId_createdAt_idx" ON "WorkflowEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_contentItemId_createdAt_idx" ON "WorkflowEvent"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_createdAt_idx" ON "Approval"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_contentItemId_createdAt_idx" ON "Approval"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_contentItemId_status_idx" ON "Approval"("contentItemId", "status");

-- CreateIndex
CREATE INDEX "PublicationJob_workspaceId_scheduledAt_idx" ON "PublicationJob"("workspaceId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublicationJob_channelId_scheduledAt_idx" ON "PublicationJob"("channelId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublicationJob_workspaceId_status_idx" ON "PublicationJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PublicationJob_contentItemId_scheduledAt_idx" ON "PublicationJob"("contentItemId", "scheduledAt");

-- CreateIndex
CREATE INDEX "AIJob_workspaceId_createdAt_idx" ON "AIJob"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AIJob_workspaceId_actionType_createdAt_idx" ON "AIJob"("workspaceId", "actionType", "createdAt");

-- CreateIndex
CREATE INDEX "AIJob_contentItemId_createdAt_idx" ON "AIJob"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentExport_workspaceId_createdAt_idx" ON "ContentExport"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentExport_contentItemId_createdAt_idx" ON "ContentExport"("contentItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentExport" ADD CONSTRAINT "ContentExport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentExport" ADD CONSTRAINT "ContentExport_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
