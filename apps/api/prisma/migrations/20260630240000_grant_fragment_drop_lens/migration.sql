-- Lens nunca debería cruzar una frontera de acceso — ni con otra persona
-- (colectivo) ni con una IA (Grant). Es 100% personal (ver LensService). Saca
-- 'lens' de Grant y FragmentShare; FragmentShare colapsa a un solo target
-- posible (spaceId), así que pierde su discriminador `source` y el CHECK.

-- Filas dev existentes con scope/source='lens' (de pruebas) — deben irse antes
-- de tocar constraints/columnas que las referencian.
DELETE FROM "Grant" WHERE scope = 'lens';
DELETE FROM "FragmentShare" WHERE source = 'lens';

-- Drop los CHECKs viejos (referencian columnas que se van).
ALTER TABLE "Grant" DROP CONSTRAINT "Grant_scope_target_chk";
ALTER TABLE "FragmentShare" DROP CONSTRAINT "FragmentShare_source_target_chk";

-- Drop el índice único parcial sobre Grant.lensId.
DROP INDEX "Grant_connectionId_lensId_key";

-- Drop FKs + columnas.
ALTER TABLE "Grant" DROP CONSTRAINT "Grant_lensId_fkey";
ALTER TABLE "Grant" DROP COLUMN "lensId";

ALTER TABLE "FragmentShare" DROP CONSTRAINT "FragmentShare_lensId_fkey";
ALTER TABLE "FragmentShare" DROP COLUMN "lensId";
ALTER TABLE "FragmentShare" DROP COLUMN "source";

-- spaceId pasa a ser el único target posible — ya no opcional.
ALTER TABLE "FragmentShare" ALTER COLUMN "spaceId" SET NOT NULL;

-- Recrear GrantScope sin 'lens' (Postgres no soporta DROP VALUE directo).
ALTER TYPE "GrantScope" RENAME TO "GrantScope_old";
CREATE TYPE "GrantScope" AS ENUM ('space', 'group');
ALTER TABLE "Grant" ALTER COLUMN "scope" TYPE "GrantScope" USING ("scope"::text::"GrantScope");
DROP TYPE "GrantScope_old";

-- Ya nada referencia FragmentSource.
DROP TYPE "FragmentSource";

-- Re-agregar el CHECK de Grant simplificado (FragmentShare ya no necesita uno:
-- spaceId NOT NULL es la única forma de target ahora).
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_scope_target_chk" CHECK (
  (scope = 'space' AND "spaceId" IS NOT NULL AND "groupId" IS NULL) OR
  (scope = 'group' AND "groupId" IS NOT NULL AND "spaceId" IS NULL)
);
