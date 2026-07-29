-- CreateEnum
CREATE TYPE "LensMemberMode" AS ENUM ('include', 'exclude');

-- AlterTable
ALTER TABLE "CollectiveGroup" DROP COLUMN "topicLensId";

-- AlterTable
ALTER TABLE "Lens" ADD COLUMN     "countSyncedAt" TIMESTAMP(3),
ADD COLUMN     "memberCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceAreaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "radius" SET DEFAULT 0.4;

-- CreateTable
CREATE TABLE "LensMember" (
    "lensId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "mode" "LensMemberMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LensMember_pkey" PRIMARY KEY ("lensId","memoryId")
);

-- CreateIndex
CREATE INDEX "LensMember_lensId_idx" ON "LensMember"("lensId");

-- AddForeignKey
ALTER TABLE "LensMember" ADD CONSTRAINT "LensMember_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensMember" ADD CONSTRAINT "LensMember_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "MemoryIndex"("memoryId") ON DELETE CASCADE ON UPDATE CASCADE;

