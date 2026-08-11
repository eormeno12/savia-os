-- `new_area` y `move` nunca tuvieron productor: RoutingService jamás crea un
-- área nueva (siempre rutea a una existente, General como fallback) y no hay
-- ningún "move" silencioso fuera de split/merge (que ya tienen su propio kind).
-- `duplicate` sí tiene una acción real (ConsolidationService) pero nunca creaba
-- la fila Suggestion — dismiss() esperaba un payload que nadie producía.

-- Filas dev existentes con esos kinds (no debería haber, pero por si acaso)
-- deben irse antes de tocar el tipo.
DELETE FROM "Suggestion" WHERE kind IN ('new_area', 'move');

-- Postgres no soporta DROP VALUE directo — rename old → create new → cast → drop old.
ALTER TYPE "SuggestionKind" RENAME TO "SuggestionKind_old";
CREATE TYPE "SuggestionKind" AS ENUM ('split', 'merge', 'duplicate');
ALTER TABLE "Suggestion" ALTER COLUMN "kind" TYPE "SuggestionKind" USING ("kind"::text::"SuggestionKind");
DROP TYPE "SuggestionKind_old";
