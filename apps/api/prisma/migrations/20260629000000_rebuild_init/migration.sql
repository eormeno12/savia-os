-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SpaceExtent" AS ENUM ('folder', 'lens', 'set');

-- CreateEnum
CREATE TYPE "SpaceGovernance" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('normal', 'sensitive');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('viewer', 'contributor', 'admin');

-- CreateEnum
CREATE TYPE "GrantScope" AS ENUM ('space', 'lens', 'group');

-- CreateEnum
CREATE TYPE "FragmentSource" AS ENUM ('space', 'lens');

-- CreateEnum
CREATE TYPE "OutboxKind" AS ENUM ('set_payload', 'delete_payload', 'purge');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'committed', 'failed');

-- CreateEnum
CREATE TYPE "EventAction" AS ENUM ('create', 'move', 'split', 'merge', 'decay', 'sensitivity', 'supersede');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('pending', 'processing', 'indexed', 'failed');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('new_area', 'split', 'merge', 'move', 'duplicate');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('invite', 'suggestion', 'job', 'milestone', 'member_joined');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ingest_file', 'import_chatgpt', 'rescue', 'backfill', 'account_export', 'account_delete');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('free', 'active', 'past_due', 'canceled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "extent" "SpaceExtent" NOT NULL DEFAULT 'folder',
    "governance" "SpaceGovernance" NOT NULL DEFAULT 'auto',
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "anchorEntities" TEXT[],
    "centroid" DOUBLE PRECISION[],
    "cfCount" INTEGER NOT NULL DEFAULT 0,
    "cfLinearSum" DOUBLE PRECISION[],
    "cfSqNormSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newSinceCheck" INTEGER NOT NULL DEFAULT 0,
    "lastReclusterAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionEmbedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryIndex" (
    "memoryId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "primarySpaceId" TEXT NOT NULL,
    "sensitivity" "Sensitivity" NOT NULL DEFAULT 'normal',
    "supersededBy" TEXT,
    "fileId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryIndex_pkey" PRIMARY KEY ("memoryId")
);

-- CreateTable
CREATE TABLE "Lens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT,
    "anchor" DOUBLE PRECISION[],
    "radius" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenLookup" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "scope" "GrantScope" NOT NULL,
    "spaceId" TEXT,
    "lensId" TEXT,
    "groupId" TEXT,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "includeSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topicLensId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectiveGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'contributor',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "FragmentShare" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "FragmentSource" NOT NULL,
    "spaceId" TEXT,
    "lensId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FragmentShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "EventAction" NOT NULL,
    "spaceId" TEXT,
    "memoryId" TEXT,
    "revertPayload" JSONB,
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "kind" "OutboxKind" NOT NULL,
    "memoryId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "spaceIds" TEXT[],
    "queryDigest" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexedAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenLookup" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "bullJobId" TEXT,
    "resultRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "refId" TEXT,
    "data" JSONB NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'free',
    "plan" TEXT,
    "externalRef" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_familyId_idx" ON "AuthSession"("familyId");

-- CreateIndex
CREATE INDEX "Space_ownerUserId_idx" ON "Space"("ownerUserId");

-- CreateIndex
CREATE INDEX "Space_ownerUserId_isDefault_idx" ON "Space"("ownerUserId", "isDefault");

-- CreateIndex
CREATE INDEX "Space_parentId_idx" ON "Space"("parentId");

-- CreateIndex
CREATE INDEX "Space_path_idx" ON "Space"("path");

-- CreateIndex
CREATE INDEX "MemoryIndex_primarySpaceId_createdAt_idx" ON "MemoryIndex"("primarySpaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryIndex_authorUserId_idx" ON "MemoryIndex"("authorUserId");

-- CreateIndex
CREATE INDEX "MemoryIndex_fileId_idx" ON "MemoryIndex"("fileId");

-- CreateIndex
CREATE INDEX "Lens_userId_idx" ON "Lens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_tokenHash_key" ON "Connection"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_tokenLookup_key" ON "Connection"("tokenLookup");

-- CreateIndex
CREATE INDEX "Connection_userId_idx" ON "Connection"("userId");

-- CreateIndex
CREATE INDEX "Grant_connectionId_idx" ON "Grant"("connectionId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "FragmentShare_groupId_idx" ON "FragmentShare"("groupId");

-- CreateIndex
CREATE INDEX "FragmentShare_userId_idx" ON "FragmentShare"("userId");

-- CreateIndex
CREATE INDEX "MemoryEvent_userId_createdAt_idx" ON "MemoryEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_connectionId_createdAt_idx" ON "AccessLog"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "File_spaceId_idx" ON "File"("spaceId");

-- CreateIndex
CREATE INDEX "File_uploaderUserId_idx" ON "File"("uploaderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvite_tokenLookup_key" ON "GroupInvite"("tokenLookup");

-- CreateIndex
CREATE INDEX "GroupInvite_email_acceptedAt_idx" ON "GroupInvite"("email", "acceptedAt");

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Suggestion_userId_status_idx" ON "Suggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "Job_userId_status_idx" ON "Job"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_seenAt_idx" ON "Notification"("userId", "seenAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryIndex" ADD CONSTRAINT "MemoryIndex_primarySpaceId_fkey" FOREIGN KEY ("primarySpaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryIndex" ADD CONSTRAINT "MemoryIndex_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lens" ADD CONSTRAINT "Lens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CollectiveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CollectiveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentShare" ADD CONSTRAINT "FragmentShare_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CollectiveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentShare" ADD CONSTRAINT "FragmentShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentShare" ADD CONSTRAINT "FragmentShare_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentShare" ADD CONSTRAINT "FragmentShare_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CollectiveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── CHECK constraints (Prisma no los expresa — 0A F22/F23) ───────────────────

-- Grant: scope y su único target son consistentes (exactly-one-non-null + coherencia).
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_scope_target_chk" CHECK (
  (scope = 'space' AND "spaceId" IS NOT NULL AND "lensId" IS NULL AND "groupId" IS NULL) OR
  (scope = 'lens'  AND "lensId"  IS NOT NULL AND "spaceId" IS NULL AND "groupId" IS NULL) OR
  (scope = 'group' AND "groupId" IS NOT NULL AND "spaceId" IS NULL AND "lensId"  IS NULL)
);

-- FragmentShare: source y su único target son consistentes.
ALTER TABLE "FragmentShare" ADD CONSTRAINT "FragmentShare_source_target_chk" CHECK (
  (source = 'space' AND "spaceId" IS NOT NULL AND "lensId" IS NULL) OR
  (source = 'lens'  AND "lensId"  IS NOT NULL AND "spaceId" IS NULL)
);

-- Space: profundidad acotada (cap 3).
ALTER TABLE "Space" ADD CONSTRAINT "Space_depth_chk" CHECK ("depth" >= 0 AND "depth" <= 3);
