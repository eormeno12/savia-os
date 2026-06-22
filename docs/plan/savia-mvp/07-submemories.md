# Step 07 — Spaces NL + clasificación + reclasificación

**Objetivo**: el usuario define **spaces** en lenguaje natural. Cada memoria queda
etiquetada con los spaces a los que pertenece mediante un clasificador
**embedding-first** (coseno entre vectores, LLM solo en casos ambiguos). Crear o
editar un space dispara un backfill eficiente. El usuario puede inspeccionar y
corregir el contenido de cada space.

**Depende de**: 01, 02, 05, 06.

---

## Modelo mental

Un **Space** es una **ventana de contexto de lectura**, no una barrera de escritura.
- Cualquier IA puede siempre escribir memorias vía `savia_remember`.
- El clasificador decide en qué spaces cae cada memoria usando embeddings.
- Los grants (step 08) determinan qué spaces puede **ver** cada IA al buscar.
- El usuario puede corregir clasificaciones erróneas.

## Arquitectura del clasificador

### Por qué embedding-first

Las memorias ya tienen embeddings en Qdrant (los generó mem0 al hacer `add()`).
La descripción de un space también es texto embebible. La similitud coseno entre
el embedding de una memoria y el del space es una señal directa y barata de
pertenencia — sin LLM.

```
Space "Salud" → embed(description) → [vector de 1536 dims] ← guardado en Space.descriptionEmbedding
                                              ↕ coseno
Memoria "Soy alérgico a la penicilina" → [vector] ← ya en Qdrant desde mem0.add()
```

El LLM solo interviene cuando la similitud cae en la zona ambigua (ni claramente
sí, ni claramente no).

### Umbrales

```ts
const THRESHOLD_AUTO_ASSIGN = 0.75  // similitud alta → asignar sin LLM
const THRESHOLD_CANDIDATE   = 0.45  // similitud media → LLM decide
// < 0.45 → no pertenece, sin coste adicional
```

Los umbrales son configurables y se pueden ajustar con feedback de correcciones
manuales del usuario (si el usuario corrige muchos falsos positivos de un space,
se sube el umbral de ese space).

### Flujo de clasificación runtime (por cada memoria nueva)

```
1. Obtener embeddings de los spaces del usuario (Space.descriptionEmbedding)
2. Calcular coseno entre embedding de la nueva memoria y cada space
3. Si coseno > THRESHOLD_AUTO_ASSIGN → asignar automáticamente (sin LLM)
4. Si coseno > THRESHOLD_CANDIDATE  → acumular como candidato para LLM
5. Si hay candidatos: 1 sola llamada LLM batch:
     "¿Esta memoria pertenece a alguno de estos spaces? [lista de candidatos]"
6. Escribir resultado en Qdrant payload + MemoryIndex
```

En el caso habitual (memoria claramente dentro o fuera de cada space), el coste
es **solo coseno** — O(spaces_del_usuario), sin LLM.

### Flujo de backfill al crear/editar un space (sin LLM masivo)

El problema anterior: crear un space con 5.000 memorias existentes = 5.000 LLM calls.
Con embedding-first:

```
1. Embed description del nuevo/editado space → 1 llamada OpenAI embeddings
2. Guardar en Space.descriptionEmbedding
3. Qdrant search: top-K memorias del usuario con mayor similitud al space
   (filtro user_id, top-K configurable, p.ej. 200)
4. Dividir los K candidatos en dos grupos por umbral:
   - > THRESHOLD_AUTO_ASSIGN → asignar directamente
   - > THRESHOLD_CANDIDATE   → 1 sola llamada LLM batch con todos ellos
5. Actualizar Qdrant payload + MemoryIndex de los asignados
6. Devolver preview al usuario: "Encontré N memorias para este space"
```

Coste: **1 embedding + 1 Qdrant search + máximo 1 LLM batch** — independientemente
del tamaño total de la memoria. Tarda segundos.

---

## Entregables backend (`apps/api/src/modules/spaces/`)

```
spaces.module.ts
spaces.controller.ts        # CRUD + inspección de memorias por space
spaces.service.ts
classifier.service.ts       # embedding-first + LLM batch para ambiguos
  ├─ cosine(a, b)           # similitud entre dos vectores Float[]
  ├─ classifyOne(memory, spaces[])     # runtime: clasifica 1 memoria
  └─ backfill(spaceId)      # search + batch → actualiza memorias existentes
reclassify.processor.ts     # job BullMQ: backfill al crear/editar space
```

### CRUD

- `POST /spaces { description }` →
  1. LLM infiere `name` del texto (1 llamada).
  2. Embebe `description` → guarda `descriptionEmbedding`.
  3. Encola job de backfill.
  4. Devuelve space con `name` sugerido y `reclassifying: true`.
- `GET /spaces` → lista con `memoryCount` y `reclassifying`.
- `PATCH /spaces/:id { description?, name? }` → si cambia `description`:
  re-embebe, `version++`, encola backfill.
- `DELETE /spaces/:id` → quita etiquetas (job) y borra grants.

### Inspección y corrección manual

- `GET /spaces/:id/memories?cursor&limit` → memorias clasificadas en este space.
  Incluye `otherSpaces` (si la memoria también está en otros).
- `DELETE /spaces/:id/memories/:memoryId` → corrección: quita solo esta etiqueta.
  Actualiza Qdrant payload + MemoryIndex. No borra la memoria.
- `POST /spaces/:id/memories/:memoryId` → corrección inversa: añade manualmente.
  Marca como `manualOverride: true` en MemoryIndex para no revertir en backfills.

### Backfill job (BullMQ)

```
Cola: "space-backfill"
Job: { userId, spaceId, newVersion }
```

Processor: ejecuta `classifier.backfill(spaceId)` → busca en Qdrant top-K
candidatos por similitud → clasifica con umbrales → actualiza memorias con
`space_versions[spaceId] = newVersion`. Consistencia eventual, sin downtime.
Al terminar: `Space.reclassifying = false` (via Redis flag o campo en Postgres).

---

## Entregables frontend

```
app/(app)/spaces/page.tsx
components/spaces/SpaceForm.tsx       # textarea descripción → nombre inferido
components/spaces/SpaceCard.tsx       # nombre, conteo, reclassifying spinner
components/spaces/SpaceMemories.tsx   # lista de memorias + corrección manual
```

**Crear space** (un solo campo):
```
Describe este espacio:
┌──────────────────────────────────────────────────────────┐
│ "Todo sobre mi trabajo: proyectos, reuniones, tareas,    │
│  carrera profesional y mis colegas de equipo."           │
└──────────────────────────────────────────────────────────┘
Nombre: Trabajo  [cambiar]
↻ Buscando memorias relacionadas…  (spinner durante backfill)
→ Encontré 43 memorias para este space  (preview)
```

**Inspección**:
```
Space: Salud — 24 memorias
┌────────────────────────────────────────────────────────┐
│ "Soy alérgico a la penicilina"          [Quitar]       │
│ "Mi médico se llama Dr. García"         [Quitar]       │
│ "Cita médica el 3 de julio"             [Quitar]       │
│ "Reunión médica con el equipo" ⚠ Trabajo [Quitar]      │
└────────────────────────────────────────────────────────┘
```

---

## Contracts (`packages/contracts/src/spaces.ts`)

```ts
export const CreateSpaceSchema = z.object({
  description: z.string().min(10)
})
export const UpdateSpaceSchema = z.object({
  description: z.string().min(10).optional(),
  name: z.string().min(1).max(50).optional()
})
export const SpaceDtoSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(),
  version: z.number(), memoryCount: z.number(),
  reclassifying: z.boolean(),
  createdAt: z.string(), updatedAt: z.string()
})
export const SpaceMemoryDtoSchema = z.object({
  memoryId: z.string(), text: z.string(),
  manualOverride: z.boolean(),
  otherSpaces: z.array(z.object({ id: z.string(), name: z.string() }))
})
export type CreateSpaceDto  = z.infer<typeof CreateSpaceSchema>
export type UpdateSpaceDto  = z.infer<typeof UpdateSpaceSchema>
export type SpaceDto        = z.infer<typeof SpaceDtoSchema>
export type SpaceMemoryDto  = z.infer<typeof SpaceMemoryDtoSchema>
```

## Archivos clave

- `apps/api/src/modules/spaces/*`
- `apps/api/src/modules/ingest/ingest.processor.ts` (update: `classifyOne` tras add)
- `apps/api/src/modules/memory/memory.service.ts` (update: `classifyOne` en add)
- `apps/app/src/app/(app)/spaces/*`

## Notas de implementación

- `Space.descriptionEmbedding` es `Float[]` en Postgres (no en Qdrant — es metadata
  de la definición del space, no una memoria). Para comparar coseno en runtime, se
  carga desde Postgres al resolver los spaces del usuario (cacheable en Redis por TTL).
- `manualOverride: true` en MemoryIndex protege las correcciones manuales: el
  backfill no revierte lo que el usuario cambió explícitamente.
- Los umbrales `THRESHOLD_AUTO_ASSIGN` y `THRESHOLD_CANDIDATE` son configurables por
  env var para ajustarlos sin redespliegue.

## Verificación

1. `POST /spaces { description }` → devuelve `name` inferido; `reclassifying: true`;
   job de backfill encola.
2. Backfill termina → `reclassifying: false`; `GET /spaces/:id/memories` lista las
   memorias encontradas.
3. Ingestar un nuevo archivo → las memorias se clasifican en tiempo real; coste:
   solo coseno para casos claros, sin LLM extra.
4. Corrección manual: `DELETE /spaces/:id/memories/:memoryId` → quita etiqueta;
   backfill posterior no la restaura (`manualOverride`).
5. Editar `description` → nuevo embedding, version++, backfill; memorias actualizadas.
