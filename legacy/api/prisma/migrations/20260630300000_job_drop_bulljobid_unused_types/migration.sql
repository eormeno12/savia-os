-- Job.bullJobId nunca se escribió (el import worker correlaciona al revés, vía
-- jobId=`import:${dbJobId}` determinístico) — columna muerta, se borra.
-- ingest_file y backfill en JobType nunca tuvieron productor (no hay ingesta de
-- archivos ni backfill que cree un Job hoy) — se sacan del enum hasta que exista
-- una implementación real que los necesite.
DELETE FROM "Job" WHERE type IN ('ingest_file', 'backfill'); -- defensivo, no debería haber filas

ALTER TABLE "Job" DROP COLUMN "bullJobId";

ALTER TYPE "JobType" RENAME TO "JobType_old";
CREATE TYPE "JobType" AS ENUM ('import_chatgpt', 'rescue', 'account_export', 'account_delete');
ALTER TABLE "Job" ALTER COLUMN "type" TYPE "JobType" USING ("type"::text::"JobType");
DROP TYPE "JobType_old";
