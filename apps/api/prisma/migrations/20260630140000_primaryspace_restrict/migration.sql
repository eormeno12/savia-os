-- DropForeignKey
ALTER TABLE "MemoryIndex" DROP CONSTRAINT "MemoryIndex_primarySpaceId_fkey";

-- AddForeignKey
ALTER TABLE "MemoryIndex" ADD CONSTRAINT "MemoryIndex_primarySpaceId_fkey" FOREIGN KEY ("primarySpaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

