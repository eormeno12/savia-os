# Step 14 — Unificación del modelo: `Space` como primitiva única

> 🔄 **Actualización (2026-06-29) — parcialmente superseded por el rebuild.** La primitiva única `Space` y el espacio **"General"** se mantienen, pero el **"un hogar por memoria" (`homeSpaceId`) fue reemplazado por MULTI-MEMBERSHIP** (decisión **D1**): una memoria pertenece a un **conjunto de áreas** (`savia_area_ids`, con ancestros); `primarySpaceId` es solo la posición de dibujo del mapa. El clasificador emite **membership**, no un hogar único; los conteos por área **solapan** (Venn; total = `count distinct`). Fuente canónica: [`08 §2/§4`](../../audit/backend/2026-06-27/08-plan-end-to-end.md); razón en [`0A §A`](../../audit/backend/2026-06-27/0A-analisis-correctitud.md). Lo de abajo queda como **contexto histórico**.

**Objetivo**: unificar el modelo de propiedad en una sola primitiva — el `Space` —
con **un hogar por memoria** (`homeSpaceId`). Tras este step, **todo sigue siendo
privado** y el comportamiento de cara al usuario es idéntico, pero sobre la base
que habilita la frontera limpia (15) y los colectivos (16).

**Depende de**: MVP implementado ([02](02-data-layer.md), [05](05-memory-layer.md),
[06](06-ingest-pipeline.md), [07](07-submemories.md)).

**No introduce colectivos todavía** — solo reescribe la base.

---

## Modelo mental nuevo

- Un **Space** es la unidad de propiedad. Hoy `userId` era el dueño; ahora el dueño
  es el **Space**, y el usuario es **miembro** de él.
- Cada memoria tiene **un** `homeSpaceId` (antes: array `spaceIds[]` 0..N).
- Cada usuario tiene un Space **"General"** privado, creado en signup. **Toda
  memoria nace ahí** salvo que se enrute a otro Space.
- "Crear un Space a partir de tu memoria" = **re-hogar** (mover memorias al nuevo
  Space), no copiar ni etiquetar.

## Refactors preparatorios (deuda que bloquea el refactor)

Antes de tocar el modelo, aislar el acoplamiento que hoy disemina el cambio:

1. **`EmbeddingsPort` / `LlmPort`** (un adaptador OpenAI inyectable). Hoy se hace
   `new OpenAI()` en 4 archivos ([memory.service](../../apps/api/src/modules/memory/memory.service.ts),
   [classifier.service](../../apps/api/src/modules/spaces/classifier.service.ts),
   `spaces.service`, `cluster.service`) con el modelo de embeddings repetido.
   → un solo `embed()` / `complete()`; centraliza modelo y dimensión.
2. **`VectorStorePort`** por composición (hoy `QdrantService extends QdrantClient`
   fuerza `as any`). Expone `search/upsert/setPayload/delete/retrieve` tipados y
   **un solo accessor del texto del payload** (hoy se lee `data` vs `mem0_data ?? text`
   de forma inconsistente).
3. **Renombrar `submemories` → `space_id`** end-to-end (payload Qdrant, opción de
   `search`, param/respuesta MCP). El término legacy desaparece; no dejar shim
   salvo en el borde de wire si hiciera falta.
4. **Eliminar maquinaria muerta**: `Space.version`, `MemoryIndex.spaceVersions`,
   `MemoryIndex.manualOverride`. Con un solo hogar no hay versión por-space ni
   override de multi-tag.

> Estos refactors son mecánicos y reducen el área del cambio de modelo. Hacerlos
> primero, con typecheck verde, antes de la migración de datos.

## Schema delta (Prisma)

```prisma
enum SpaceKind { private collective }            // NEW — en 14 solo se usa `private`
enum SpaceRole { viewer contributor admin }      // NEW — relevante en 16

model Space {
  id            String       @id @default(uuid())
  ownerUserId   String                           // era `userId` (creador; conveniencia)
  kind          SpaceKind    @default(private)    // NEW
  name          String
  description   String
  descriptionEmbedding Float[]
  reclassifying Boolean      @default(false)
  // DROP version
  members       SpaceMember[]                     // NEW
  memories      MemoryIndex[]                      // NEW back-relation (homeSpaceId)
  files         File[]                             // NEW
  growthEvents  GrowthEvent[]                      // NEW
  grants        Grant[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // DROP @@unique([userId, name])  — el nombre deja de ser único por dueño
  @@index([ownerUserId])
}

model SpaceMember {                                // NEW
  spaceId   String
  space     Space     @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  role      SpaceRole @default(admin)              // el creador es admin
  createdAt DateTime  @default(now())
  @@id([spaceId, userId])
  @@index([userId])                                // hot path: "spaces de los que soy miembro"
}

model MemoryIndex {
  memoryId     String   @id
  authorUserId String                              // era `userId` — ahora solo provenance
  homeSpaceId  String                              // NEW (reemplaza spaceIds[]+spaceVersions)
  homeSpace    Space    @relation(fields: [homeSpaceId], references: [id])
  fileId       String?
  // DROP spaceIds, spaceVersions, manualOverride
  source       String   @default("upload")
  createdAt    DateTime @default(now())
  @@index([homeSpaceId])                            // índice de lectura primario
  @@index([fileId])
}

model File {
  // …campos actuales…
  spaceId String                                    // NEW
  space   Space  @relation(fields: [spaceId], references: [id])
  // userId se mantiene como "uploader" (provenance)
  @@index([spaceId])
}

model GrowthEvent {
  // …campos actuales…
  spaceId String                                    // NEW: ahora requerido (era String?)
  space   Space @relation(fields: [spaceId], references: [id])
  @@index([spaceId, createdAt])
}
```

`Grant` no cambia de estructura (`connectionId + spaceId`); solo se amplía su
significado (puede exponer un Space que más adelante sea colectivo). `AccessLog`
no cambia.

## Clasificador: multi-etiqueta → enrutado single-home

`apps/api/src/modules/spaces/classifier.service.ts`:

- `classifyOne(...)` deja de devolver `string[]` y devuelve **un** `homeSpaceId`
  (el de mayor similitud que supere el umbral; si ninguno, el **General**).
- `askLlmWhichSpaces` (multi-select) → **single-routing**: "¿cuál de estos spaces
  es el hogar, o ninguno → General?".
- `applyToMemory` deja de hacer unión de arrays / versiones / `manualOverride`:
  escribe `homeSpaceId` en `MemoryIndex` y `space_id` en el payload Qdrant.
  **Orden Qdrant-first** (la visibilidad de búsqueda es la fuente de verdad),
  luego Postgres; loguear divergencias. → cierra **B5**.
- `backfill(spaceId)` se redefine como **re-hogar**: "crear un Space desde tu
  memoria" busca en Qdrant los candidatos por similitud y **mueve** su
  `homeSpaceId` al nuevo Space (escribe payload `space_id` y `MemoryIndex`). El
  `reclassify.processor` pierde el plumbing de `version`/`newVersion`.

## "Crear space desde memoria" (re-hogar)

- `POST /spaces { description }` → crea el Space (privado) y **encola un re-hogar**:
  las memorias que mejor casan **cambian de hogar** al nuevo Space (salen de General
  o de su hogar previo). Es el mismo motor del backfill, con semántica de *mover*.
- `addMemoryToSpace` / `removeMemoryFromSpace` cambian de semántica:
  - "añadir" = **re-hogar** la memoria a ese Space.
  - "quitar" = mover la memoria de vuelta a **General** (una memoria siempre tiene
    hogar). Ambas escriben payload Qdrant `space_id` → cierra la divergencia #7 de
    B5 (hoy estas correcciones no tocan Qdrant).

## Default "General" en signup

- `auth.service.verifyOtp` (creación de usuario) crea, además del `User`, un Space
  `kind=private, name="General"` y su `SpaceMember(role=admin)`.
- Todo path de `memory.add` (ingest, MCP remember, onboarding) resuelve un
  **hogar destino**: el General del usuario por defecto, nunca `[]`.

## Migración / backfill (ordenado, reversible)

1. **Aditivo nullable**: enums + `SpaceMember`, `Space.kind` (default private),
   `MemoryIndex.homeSpaceId` (nullable), `File.spaceId` (nullable). Sin borrados.
2. **Backfill miembros**: por cada `Space` existente → `SpaceMember(ownerUserId, admin)`.
3. **General por usuario**: crear Space privado + `SpaceMember` para cada `User`.
4. **Resolver N→1 hogar** (paso con pérdida): por cada memoria con `spaceIds[]`:
   `1` → ese; `>1` → mayor coseno (re-puntuar una vez), tie-break General; `0` →
   General. **Snapshot de `spaceIds[]`** a tabla/columna temporal antes, para
   auditar/revertir. Setear `homeSpaceId` + payload Qdrant `space_id`.
5. **Backfill `File.spaceId`** = General del dueño; **`GrowthEvent.spaceId`** desde
   el `homeSpaceId` resuelto del `memoryId` (o General si huérfano).
6. **Qdrant**: recorrer puntos, set `space_id` payload, crear índice keyword
   `space_id`; el índice `submemories` se retira tras el cutover.
7. **Cutover de lectura** (deploy): ver [15](15-frontier-hardening.md) — dual-filter.
8. **Drops finales** (tras paridad): `MemoryIndex.spaceIds/spaceVersions/manualOverride`,
   `Space.version`, `@@unique([userId,name])`; `homeSpaceId/File.spaceId/GrowthEvent.spaceId`
   → NOT NULL; índice/payload `submemories` fuera.

## Growth (corrige el conteo)

- `growth.service.getAreas`: el SQL `unnest("spaceIds")` → `GROUP BY "homeSpaceId"`.
  Los conteos ahora **suman al total** en vez de duplicar (un memoria contaba N
  veces). Desaparece el bucket "Sin clasificar" (toda memoria tiene hogar).
- Tras el cutover, **invalidar la caché Redis** `growth:areas:*`; aceptar una
  discontinuidad puntual en las curvas históricas (o re-derivar desde
  `MemoryIndex.createdAt + homeSpaceId`).

## Contracts (`packages/contracts/src/`)

- `spaces.ts`: `SpaceDtoSchema` gana `kind`; **drop** `version`;
  `SpaceMemoryDtoSchema` **drop** `otherSpaces` (una memoria, un Space).
- `memory.ts`: `MemorySearchQuerySchema.submemories` → `spaceIds`;
  `AddMemorySchema` gana `spaceId?` (hogar destino).
- `files.ts`: `PresignRequestSchema`/`CreateFileSchema` ganan `spaceId`.

## Frontend (`apps/app/src/`)

- `SpaceMemories.tsx`: quitar los chips `otherSpaces`.
- `SpaceCard`/`SpacesList`: mostrar que el Space es privado (preparado para el
  badge colectivo de [16](16-collective-spaces.md)).
- `lib/api.ts`: `spaces.create` devuelve `kind`; `addMemory`/`removeMemory` pasan a
  semántica "mover de hogar".

## Riesgos (secuenciar con cuidado)

1. **El paso N→1 es el único con pérdida.** Snapshot de `spaceIds[]` antes; los
   `[]` (caso común "Sin clasificar") **deben** ir a General o quedan inalcanzables
   tras retirar `user_id`.
2. **No retirar `user_id` aquí** — eso es el step 15 con dual-filter. Este step
   deja `space_id` **poblado y verificado**, conviviendo con `user_id`.

## Verificación

1. Refactors preparatorios: typecheck verde; un solo `new OpenAI`; sin `submemories`
   en el código (solo, si acaso, en el borde de wire).
2. Migración aplicada: cada `User` tiene Space "General"; cada `Space` tiene su
   `SpaceMember` admin; cada `MemoryIndex` tiene `homeSpaceId`; cada punto Qdrant
   tiene payload `space_id`.
3. Subir un archivo → memorias nacen con hogar (General o enrutado); el `FileCard`
   muestra el conteo correcto (sin doble growth).
4. Crear un Space con descripción → memorias relacionadas **cambian de hogar** a él
   (salen de General); `GET /spaces/:id/memories` las lista; ya no aparecen en otro.
5. Corrección manual "quitar de space" → la memoria vuelve a General y **el payload
   Qdrant `space_id` se actualiza** (sin divergencia).
6. Dashboard: la suma de memorias por área = total (sin doble conteo).
