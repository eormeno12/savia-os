-- Motor v2: la geometría de clustering (CF triple + centroide) y las señales de
-- trigger del motor viejo (newSinceCheck/lastReclusterAt) ya no viven en columnas
-- del Space — el estado del clustering es ahora el grafo de personas (MemoryEdge/
-- MemoryPersona/EngineNode) y los conteos son un COUNT en vivo sobre MemoryArea.
-- descriptionEmbedding solo lo leía el routing viejo (eliminado).
ALTER TABLE "Space"
  DROP COLUMN "centroid",
  DROP COLUMN "cfCount",
  DROP COLUMN "cfLinearSum",
  DROP COLUMN "cfSqNormSum",
  DROP COLUMN "newSinceCheck",
  DROP COLUMN "lastReclusterAt",
  DROP COLUMN "descriptionEmbedding";
