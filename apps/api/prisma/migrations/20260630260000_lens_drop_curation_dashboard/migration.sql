-- Lens es una búsqueda guardada 100% personal y en vivo — nunca cruza una
-- frontera de acceso (ver migración previa que le sacó Grant/FragmentShare) y
-- ahora tampoco necesita curaduría manual ni caché de exhibición:
--   - LensMember (include/exclude) quedó redundante: ajustar a mano un
--     resultado ahora tiene un lugar mejor (crear un área personalizada
--     sembrada — AreasService.create con memoryIds), que persiste de verdad
--     en vez de parchear una query que se recalcula cada vez.
--   - memberCount/countSyncedAt solo existían para mostrarse en listas o
--     dashboard; Lens no aparece ahí — sin consumidor, sin razón de existir.
DROP TABLE "LensMember";
DROP TYPE "LensMemberMode";

ALTER TABLE "Lens" DROP COLUMN "memberCount";
ALTER TABLE "Lens" DROP COLUMN "countSyncedAt";
