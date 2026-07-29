-- CreateEnum
CREATE TYPE "EngineNodeKind" AS ENUM ('community', 'internal');

-- CreateEnum
CREATE TYPE "EngineTaskKind" AS ENUM ('memory_upserted', 'memory_removed', 'rebuild_component', 'bootstrap_user');

-- CreateEnum
CREATE TYPE "EngineTaskStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "MemoryEdge" (
    "srcId" TEXT NOT NULL,
    "dstId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "simScore" DOUBLE PRECISION NOT NULL,
    "entBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL,
    "mutual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEdge_pkey" PRIMARY KEY ("srcId","dstId")
);

-- CreateTable
CREATE TABLE "MemoryPersona" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT,

    CONSTRAINT "MemoryPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaNeighbor" (
    "personaId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "neighborId" TEXT NOT NULL,

    CONSTRAINT "PersonaNeighbor_pkey" PRIMARY KEY ("memoryId","neighborId")
);

-- CreateTable
CREATE TABLE "EngineComponent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeCounter" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "kind" "EngineNodeKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "EngineTaskKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "status" "EngineTaskStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryEdge_dstId_idx" ON "MemoryEdge"("dstId");

-- CreateIndex
CREATE INDEX "MemoryEdge_userId_idx" ON "MemoryEdge"("userId");

-- CreateIndex
CREATE INDEX "MemoryPersona_memoryId_idx" ON "MemoryPersona"("memoryId");

-- CreateIndex
CREATE INDEX "MemoryPersona_communityId_idx" ON "MemoryPersona"("communityId");

-- CreateIndex
CREATE INDEX "MemoryPersona_userId_idx" ON "MemoryPersona"("userId");

-- CreateIndex
CREATE INDEX "PersonaNeighbor_personaId_idx" ON "PersonaNeighbor"("personaId");

-- CreateIndex
CREATE INDEX "PersonaNeighbor_neighborId_idx" ON "PersonaNeighbor"("neighborId");

-- CreateIndex
CREATE INDEX "EngineComponent_userId_idx" ON "EngineComponent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EngineNode_spaceId_key" ON "EngineNode"("spaceId");

-- CreateIndex
CREATE INDEX "EngineNode_componentId_idx" ON "EngineNode"("componentId");

-- CreateIndex
CREATE INDEX "EngineNode_userId_kind_idx" ON "EngineNode"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "EngineTask_dedupeKey_key" ON "EngineTask"("dedupeKey");

-- CreateIndex
CREATE INDEX "EngineTask_status_nextAttemptAt_createdAt_idx" ON "EngineTask"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "EngineTask_userId_status_idx" ON "EngineTask"("userId", "status");

-- AddForeignKey
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_srcId_fkey" FOREIGN KEY ("srcId") REFERENCES "MemoryIndex"("memoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_dstId_fkey" FOREIGN KEY ("dstId") REFERENCES "MemoryIndex"("memoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPersona" ADD CONSTRAINT "MemoryPersona_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "MemoryIndex"("memoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPersona" ADD CONSTRAINT "MemoryPersona_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "EngineNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaNeighbor" ADD CONSTRAINT "PersonaNeighbor_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "MemoryPersona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineComponent" ADD CONSTRAINT "EngineComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineNode" ADD CONSTRAINT "EngineNode_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "EngineComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineNode" ADD CONSTRAINT "EngineNode_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineTask" ADD CONSTRAINT "EngineTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
