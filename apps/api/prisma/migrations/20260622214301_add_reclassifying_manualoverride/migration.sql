-- AlterTable
ALTER TABLE "MemoryIndex" ADD COLUMN     "manualOverride" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "reclassifying" BOOLEAN NOT NULL DEFAULT false;
