-- Membership multi-área pasa a ser VERDAD en Postgres (MemoryArea), proyectada a
-- Qdrant `savia_area_ids[]`. Se elimina la noción de área primaria (el mapa pinta
-- todos los puntos). `source` pasa de TEXT a enum + se agregan sourceRef/sourceLabel.

-- ─── Enum de procedencia ────────────────────────────────────────────────────
CREATE TYPE "MemorySource" AS ENUM ('manual', 'mcp', 'file', 'import_chatgpt', 'rescue');

-- ─── MemoryArea (membership = verdad) ───────────────────────────────────────
CREATE TABLE "MemoryArea" (
    "memoryId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    CONSTRAINT "MemoryArea_pkey" PRIMARY KEY ("memoryId", "spaceId")
);

CREATE INDEX "MemoryArea_spaceId_idx" ON "MemoryArea"("spaceId");

ALTER TABLE "MemoryArea" ADD CONSTRAINT "MemoryArea_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "MemoryIndex"("memoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryArea" ADD CONSTRAINT "MemoryArea_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: la área primaria existente se vuelve una fila de membership (mínimo seguro;
-- la closure completa vivía en el payload Qdrant y la reconstruye un backfill aparte).
INSERT INTO "MemoryArea" ("memoryId", "spaceId")
SELECT "memoryId", "primarySpaceId" FROM "MemoryIndex"
ON CONFLICT DO NOTHING;

-- ─── source TEXT → enum + columnas de procedencia ───────────────────────────
ALTER TABLE "MemoryIndex" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "MemoryIndex" ALTER COLUMN "source" TYPE "MemorySource" USING (
  CASE "source"
    WHEN 'mcp'         THEN 'mcp'::"MemorySource"
    WHEN 'manual'      THEN 'manual'::"MemorySource"
    WHEN 'chatgpt'     THEN 'import_chatgpt'::"MemorySource"
    WHEN 'chat_import' THEN 'import_chatgpt'::"MemorySource"
    WHEN 'rescue'      THEN 'rescue'::"MemorySource"
    WHEN 'upload'      THEN 'file'::"MemorySource"
    ELSE 'manual'::"MemorySource"
  END
);
ALTER TABLE "MemoryIndex" ALTER COLUMN "source" SET DEFAULT 'manual';

ALTER TABLE "MemoryIndex" ADD COLUMN "sourceRef" TEXT;
ALTER TABLE "MemoryIndex" ADD COLUMN "sourceLabel" TEXT;

-- ─── Drop área primaria ─────────────────────────────────────────────────────
ALTER TABLE "MemoryIndex" DROP CONSTRAINT "MemoryIndex_primarySpaceId_fkey";
DROP INDEX "MemoryIndex_primarySpaceId_createdAt_idx";
DROP INDEX "MemoryIndex_authorUserId_idx";
ALTER TABLE "MemoryIndex" DROP COLUMN "primarySpaceId";

-- ─── Índices nuevos ─────────────────────────────────────────────────────────
CREATE INDEX "MemoryIndex_authorUserId_createdAt_idx" ON "MemoryIndex"("authorUserId", "createdAt");
CREATE INDEX "MemoryIndex_source_idx" ON "MemoryIndex"("source");
