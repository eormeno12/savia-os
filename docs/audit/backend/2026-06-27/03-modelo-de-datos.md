# 03 — Modelo de datos (`schema.prisma`)

> **Estado:** revisa el **schema actual** (sin cambios desde la auditoría). El **schema objetivo** del rebuild está en [`08` §2](08-plan-end-to-end.md) (core: áreas multi-membership, federación, mem0-sidecar) + [`05` §1](05-rediseno-estructural.md) (modelos de producto que `08` no cubre). Las cascadas/índices/limpiezas señalados acá son acceptance criteria.

Fuente: [`apps/api/prisma/schema.prisma`](../../../../apps/api/prisma/schema.prisma). Migraciones: `apps/api/prisma/migrations/` (`init`, `add_reclassifying_manualoverride`, `20260624165943`, `phase2_collective`).

---

## 1. Relaciones y cascadas — estado actual

| Relación | `onDelete` | Evidencia | Veredicto |
|---|---|---|---|
| `SpaceMember.space → Space` | **Cascade** | [schema.prisma:74](../../../../apps/api/prisma/schema.prisma#L74) | ✅ correcto |
| `SpaceMember.user → User` | *(default `Restrict`)* | [schema.prisma:76](../../../../apps/api/prisma/schema.prisma#L76) | ⚠️ borrar User falla si tiene memberships |
| `Grant.connection → Connection` | **Cascade** | [schema.prisma:137](../../../../apps/api/prisma/schema.prisma#L137) | ✅ |
| `Grant.space → Space` | **Cascade** | [schema.prisma:139](../../../../apps/api/prisma/schema.prisma#L139) | ✅ |
| `AccessLog.connection → Connection` | **Cascade** | [schema.prisma:184](../../../../apps/api/prisma/schema.prisma#L184) | ✅ |
| `CollectiveInvite.space → Space` | **Cascade** | [schema.prisma:198](../../../../apps/api/prisma/schema.prisma#L198) | ✅ |
| `MemoryIndex.file → File` | **SetNull** | [schema.prisma:156](../../../../apps/api/prisma/schema.prisma#L156) | ✅ (memoria sobrevive al archivo) |
| `MemoryIndex.user → User` | *(default `Restrict`)* | [schema.prisma:152](../../../../apps/api/prisma/schema.prisma#L152) | ⚠️ ver §2 |
| `MemoryIndex.homeSpace → Space` | *(default `Restrict`)* | [schema.prisma:154](../../../../apps/api/prisma/schema.prisma#L154) | 🔴 **bloquea borrar un Space** que tenga memorias homeadas (por eso `spaces.remove` re-homea a mano antes de borrar). |
| `Space.user → User` | *(default `Restrict`)* | [schema.prisma:51](../../../../apps/api/prisma/schema.prisma#L51) | ⚠️ |
| `File.user → User` | *(default `Restrict`)* | [schema.prisma:99](../../../../apps/api/prisma/schema.prisma#L99) | ⚠️ |
| `File.space → Space?` | *(default, nullable)* | [schema.prisma:101](../../../../apps/api/prisma/schema.prisma#L101) | ⚠️ borrar Space falla si tiene archivos |
| `GrowthEvent.user → User` | *(default `Restrict`)* | [schema.prisma:171](../../../../apps/api/prisma/schema.prisma#L171) | ⚠️ |
| `GrowthEvent.space → Space?` | *(default, nullable)* | [schema.prisma:173](../../../../apps/api/prisma/schema.prisma#L173) | ⚠️ borrar Space falla si tiene growth events con ese `spaceId` |

### Hallazgo D-1 (P1) — Borrar un Space depende de re-home manual; sin él, falla por FK
`spaces.remove` ([spaces.service.ts:104-126](../../../../apps/api/src/modules/spaces/spaces.service.ts#L104-L126)) re-homea las memorias y confía en que `Grant`/`SpaceMember`/`Invite` caen por cascada. Pero `File.spaceId` y `GrowthEvent.spaceId` apuntan al Space **sin** cascada ni `SetNull`: si un Space colectivo tiene archivos o growth events propios, `space.delete` lanza **P2002/FK violation**. Hoy no se dispara porque files no setean `spaceId` y los growth events se re-homean en el loop con `.catch(()=>null)` (que puede dejar `spaceId` colgando). Es frágil.

**Fix:** decidir política explícita por relación: `File.space` → `SetNull` o `Cascade`; `GrowthEvent.space` → `SetNull`. Y mover el re-home a transacción/cola (ver `02-INT-7`).

### Hallazgo D-2 (P0 para "borrar cuenta") — No hay forma de borrar un User
Todas las relaciones `*.user` son `Restrict` por defecto. **Borrar un User es imposible** sin borrar antes spaces, files, memorias, connections, growth events y memberships en orden. El frontend pide `POST /account/delete` (CT4) — hoy **inviable** a nivel schema, y además habría que borrar los vectores en Qdrant (no hay cascada hacia Qdrant). 

**Fix:** definir `onDelete: Cascade` desde `User` hacia `Space`/`File`/`Connection`/`GrowthEvent`/`SpaceMember`/`MemoryIndex` (con cuidado: en colectivos, borrar al owner no debe borrar el space compartido — ver §4), y un job que borre los vectores Qdrant del usuario por `user_id`.

---

## 2. Consistencia Postgres ↔ Qdrant ↔ Redis

- **`MemoryIndex` es el espejo Postgres de cada punto Qdrant** (`memoryId` = id del punto). No hay FK posible hacia Qdrant; la integridad es responsabilidad del código → ver `02-P0-2` (sin transacciones/outbox → vectores/filas huérfanos).
- **`descriptionEmbedding Float[]`** en `Space` ([schema.prisma:56](../../../../apps/api/prisma/schema.prisma#L56)) duplica en Postgres el embedding de la descripción (usado por el classifier). OK, pero crece la fila; considerar no seleccionarlo salvo en clasificación (hoy `findAll` no lo trae — bien).
- **`spaceVersions Json` y `spaceIds String[]`** ([schema.prisma:157-158](../../../../apps/api/prisma/schema.prisma#L157-L158)): legacy del dual-filter. `spaceVersions` ya se escribe siempre `{}` (muerto). `spaceIds` se mantiene en sync con `homeSpaceId` (array de 1). **Deuda a dropear tras cutover** (junto con la rama `submemories` y el payload `user_id` en Qdrant, ver `02-INT-5`).

---

## 3. Índices

| Modelo | Índices | Veredicto |
|---|---|---|
| `Space` | `@@index([userId])`, `@@index([userId,isDefault])` | ✅ |
| `SpaceMember` | `@@id([spaceId,userId])`, `@@index([userId])` | ✅ hot path "spaces donde soy miembro" cubierto |
| `MemoryIndex` | `@@index([userId])`, `@@index([homeSpaceId])`, `@@index([fileId])` | ✅ `countMemories`/`groupBy homeSpaceId` cubierto |
| `GrowthEvent` | `@@index([userId,createdAt])`, `@@index([userId,spaceId])` | ✅ el `$queryRaw` de growth filtra por `userId`+`createdAt` |
| `Connection` | `@@index([userId])`, `tokenHash @unique`, `tokenLookup @unique` | ✅ lookup O(1) por `tokenLookup` |
| `AccessLog` | `@@index([connectionId,createdAt])` | ✅ |
| `OtpCode` | `@@index([email])` | ✅ `verify` ordena por `createdAt desc` (no indexado, n pequeño) |
| `CollectiveInvite` | `@@index([email])`, `@@index([tokenHash])` | ⚠️ `acceptInvite` escanea por `email`+`acceptedAt=null` y verifica argon2 1×1; OK para n bajo. |

### Hallazgo D-3 (P2) — Paginación por cursor: implementada, sin índice dedicado de orden
`getMemories` usa cursor sobre `memoryId` con `orderBy createdAt desc` ([spaces.service.ts:136-141](../../../../apps/api/src/modules/spaces/spaces.service.ts#L136-L141)). El cursor es por `memoryId` (PK) pero el orden es por `createdAt` → el cursor de Prisma sobre una columna distinta al `orderBy` puede saltar/duplicar filas con `createdAt` empatados. **Fix:** ordenar por `[createdAt, memoryId]` y usar cursor compuesto, o cursor sobre `createdAt`. Añadir `@@index([homeSpaceId, createdAt])`.
- **Práctica oficial:** Prisma cursor pagination — el cursor debe ser una secuencia estable/única alineada con el `orderBy` (https://www.prisma.io/docs/orm/prisma-client/queries/pagination).

### Hallazgo D-4 (P2) — `OtpCode` sin TTL/limpieza
Cada `request-otp` inserta una fila y nunca se borra ([otp.service.ts:26](../../../../apps/api/src/modules/auth/otp.service.ts#L26)). Crece sin límite. **Fix:** job de limpieza de `expiresAt < now()` o `consumedAt not null` (cron), o `pg_cron`.

---

## 4. Campos que el frontend necesita y NO existen (con propuesta)

| Necesidad (front) | Hoy | Propuesta de schema |
|---|---|---|
| **`kind`/`role`/`isDefault` en SpaceDto** | ✅ **ya existen** (`Space.kind`, `Space.isDefault`, rol vía `SpaceMember.role`) y el server los devuelve | **Nada en schema** — sólo actualizar el `SpaceDto` del front (ver `01 §C`). |
| **Sensibilidad de memoria ("Marcar sensible", M6)** | ❌ no existe | `MemoryIndex.sensitivity SensitivityKind @default(normal)` (`enum SensitivityKind { normal sensitive }`) + payload `sensitivity` en Qdrant + exponer en `MemoryResult`/`SpaceMemoryDto`. |
| **`lastSeen` por área (MemoryMap M1)** | ❌ no | Derivable: `MAX(MemoryIndex.createdAt)` o `MAX(GrowthEvent.createdAt)` por `homeSpaceId`. No requiere columna; calcular en `getAreas`. Si se quiere "última lectura", añadir tracking. |
| **Muestreo/peek de recuerdos por área** | ❌ no (texto vive en Qdrant) | Endpoint `GET /spaces/:id/sample?n=3` que hidrate texto desde Qdrant (`retrievePoints`). Sin columna nueva. |
| **Búsquedas guardadas (M4)** | ❌ localStorage | `model SavedSearch { id, userId, query, label, count Int, createdAt }` + `@@index([userId])`. |
| **Suscripción / freemium (SB1)** | ❌ localStorage | `model Subscription { id, userId @unique, status, plan, externalRef (Mercado Pago), currentPeriodEnd, createdAt, updatedAt }` + webhook MP que la actualice. |
| **Notificaciones / Bandeja (invitaciones/procesos/hitos)** | ❌ parcial | Invitaciones: `CollectiveInvite` **ya existe**; falta endpoint listado para el invitado. Procesos: derivar de BullMQ (no schema). Hitos: `model Milestone { id, userId, type, spaceId?, value Int, createdAt, seenAt? }` o derivar de `GrowthEvent`. |
| **Eventos ricos de Pulso (read/contribute/reorganize/revert)** | ⚠️ `AccessLog.action` es string libre | Tipar `AccessLog.action` como enum `AccessAction { search remember reorganize revert }` y exponer `GET /growth/events`. `AccessLog` ya tiene `resultCount`/`spaceIds`. |
| **`homeSpaceId` en SpaceMemoryDto** | ✅ en contrato, ⚠️ no en tipo del front | Sólo sincronizar el tipo del front. |
| **`joinedAt` en CollectiveMember** | ❌ el server no lo manda (existe `SpaceMember.createdAt`) | Exponer `createdAt` como `joinedAt` en `listMembers` ([collective.service.ts:168-172](../../../../apps/api/src/modules/collective/collective.service.ts#L168-L172)). Sin schema. |

---

## 5. Drift migraciones ↔ schema

- 4 migraciones presentes; la última `20260625000000_phase2_collective` introduce el modelo colectivo. El `typecheck` pasa y el client está generado. **No se ejecutó `db:deploy` desde cero en esta corrida** (no se levantó infra); recomendado en CI: `prisma migrate reset` + `prisma migrate deploy` para confirmar que las migraciones reconstruyen exactamente el `schema.prisma` (sin drift). La migración `20260624165943` no tiene sufijo de nombre — verificar que su `migration.sql` está versionado.
- **Acción CI:** `prisma migrate diff --from-migrations --to-schema-datamodel` debe dar vacío. Añadir al pipeline.

---

## 6. Resumen de cambios de schema propuestos (orden sugerido)

1. **(P0 cuenta)** Definir `onDelete` explícito en todas las FK hacia `User` y resolver el borrado de cuenta (cascada + purga Qdrant). → habilita CT4.
2. **(P1)** `File.space` y `GrowthEvent.space` → `SetNull`/`Cascade` para que `spaces.remove` no dependa de re-home manual. → D-1.
3. **(P1)** `MemoryIndex.sensitivity` (enum) → habilita M6 "Marcar sensible".
4. **(P1)** `model SavedSearch`, `model Subscription` → habilitan M4 y SB1 (hoy localStorage).
5. **(P2)** `@@index([homeSpaceId, createdAt])` + cursor compuesto → paginación estable (D-3).
6. **(P2)** Limpieza de `OtpCode` (D-4); dropear `spaceVersions`/`spaceIds`/payload `user_id`+`submemories` tras cutover (deuda dual-filter).
