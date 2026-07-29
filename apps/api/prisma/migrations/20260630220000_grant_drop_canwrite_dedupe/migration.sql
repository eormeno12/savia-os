-- canWrite nunca se aplicaba en ningún lado (savia_remember no lo consultaba) y el
-- frontend que lo seteaba ya estaba muerto (apuntaba a una ruta inexistente). Decisión
-- de producto: la escritura NUNCA se restringe por conexión, solo la lectura está
-- scoped por grant. Un colectivo de solo-lectura es FragmentShare, no esto.
ALTER TABLE "Grant" DROP COLUMN "canWrite";

-- Dedupe antes del UNIQUE: conservar el grant más antiguo por (connectionId, scope,
-- target); el CHECK exactly-one ya garantiza que el target coincide con el scope.
DELETE FROM "Grant" g
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "connectionId", "scope", COALESCE("spaceId", "lensId", "groupId")
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "Grant"
) ranked
WHERE g.id = ranked.id AND ranked.rn > 1;

-- Sin duplicados: una conexión no puede tener dos grants sobre el mismo target.
-- Parcial (no Prisma-expresable) porque spaceId/lensId/groupId son mutuamente excluyentes.
CREATE UNIQUE INDEX "Grant_connectionId_spaceId_key" ON "Grant"("connectionId", "spaceId") WHERE "spaceId" IS NOT NULL;
CREATE UNIQUE INDEX "Grant_connectionId_lensId_key" ON "Grant"("connectionId", "lensId") WHERE "lensId" IS NOT NULL;
CREATE UNIQUE INDEX "Grant_connectionId_groupId_key" ON "Grant"("connectionId", "groupId") WHERE "groupId" IS NOT NULL;
