# Step 05 — Memory Layer (mem0ai/oss + Qdrant)

**Objetivo**: añadir y buscar memorias por usuario. Escritura vía `mem0ai/oss`
(extracción con OpenAI); lectura vía **Qdrant directo** con filtro de metadata
(para garantizar el enforcement de acceso de steps posteriores).

**Depende de**: 01, 02.

---

## Por qué add por mem0 y search por Qdrant

- `mem0ai/oss` hace el trabajo valioso del `add()`: extrae hechos atómicos,
  resuelve conflictos, embebe y escribe en Qdrant.
- El `search()` se hace **directo a Qdrant** con `@qdrant/js-client-rest` para tener
  **control total del filtro** (`user_id` + `submemories ∩ scope`). El enforcement
  de accesos depende de esto y no puede quedar sujeto a la madurez del filtrado del
  SDK. mem0 escribe; nosotros leemos con nuestro filtro.

## Config mem0 (`apps/api/src/modules/memory/mem0.config.ts`)

```ts
const config = {
  version: "v1.1",
  vectorStore: {
    provider: "qdrant",
    config: { host: "localhost", port: 6333, collectionName: process.env.QDRANT_COLLECTION },
  },
  llm: { provider: "openai", config: { model: "gpt-4o-mini" } },
  embedder: { provider: "openai", config: { model: "text-embedding-3-small" } },
};
```

> Verificar en semana 1 que `mem0ai/oss` (TS) escribe en Qdrant con la dimensión
> de `text-embedding-3-small` (1536). Si el SDK TS limita la config, fallback:
> generar embeddings con OpenAI y hacer `upsert` directo a Qdrant nosotros mismos
> (mem0 solo para extracción de hechos). Decidir aquí y documentar.

## Entregables (`apps/api/src/modules/memory/`)

```
memory.module.ts
memory.service.ts        # add(), search(), deleteByFile(), deleteByMemoryId()
qdrant.service.ts        # ya existe (step 01); añadir ensureCollection()
memory.controller.ts     # endpoints internos de prueba (protegidos por INTERNAL_TOKEN/Jwt)
```

### `MemoryService.add(userId, text, meta)`

1. `mem0.add(text, { userId, metadata: meta })`.
2. Por cada memoria creada (mem0 puede crear 0..N hechos), asegurar que el payload
   en Qdrant tenga: `user_id`, `file_id?`, `source`, `submemories: []` (vacío hasta
   step 07), `created_at`.
3. Escribir fila espejo en `MemoryIndex` (`memoryId`, `userId`, `fileId`,
   `submemoryIds: []`, `submemVersions: {}`).
4. Devolver los `memoryId` creados.

### `MemoryService.search(userId, query, { submemories?, limit })`

1. Embeber `query` (OpenAI `text-embedding-3-small`).
2. Qdrant `search` con filtro:
   ```
   must: [{ key: "user_id", match: { value: userId } }]
   + (submemories?.length ? [{ key: "submemories", match: { any: submemories } }] : [])
   ```
3. Devolver `{ id, text, score, metadata }[]`.

### `deleteByFile(fileId)` / `deleteByMemoryId(id)`

- Borra puntos en Qdrant (filtro por `file_id` o id) y filas en `MemoryIndex`.
  Conecta el borrado en cascada de `DELETE /files/:id` (step 04).

### `ensureCollection()`

- Al boot, crear la colección `savia_memories` si no existe (tamaño 1536, distancia
  cosine) e índices de payload sobre `user_id` y `submemories` (acelera el filtro).

## Endpoints internos de prueba

- `POST /memory/add { text, fileId? }` y `POST /memory/search { query, submemories? }`
  protegidos (solo para validación; en producción la escritura real ocurre vía
  ingesta y MCP). Marcar como dev/admin.

## Contracts (`packages/contracts/src/memory.ts`)

```ts
export const MemorySearchQuerySchema = z.object({
  query: z.string(), submemories: z.array(z.string()).optional(), limit: z.number().int().default(10)
})
export const MemoryResultSchema = z.object({
  id: z.string(), text: z.string(), score: z.number(), metadata: z.record(z.unknown())
})
export type MemorySearchQuery = z.infer<typeof MemorySearchQuerySchema>
export type MemoryResult      = z.infer<typeof MemoryResultSchema>
```

`createZodDto(MemorySearchQuerySchema)` en el controller interno; tipos en `apps/app`.

## Archivos clave

- `apps/api/src/modules/memory/*`
- `apps/api/src/common/clients/qdrant.service.ts` (update: `ensureCollection`)

## Verificación

1. `POST /memory/add { text: "Trabajo en fintech y vivo en Madrid" }` → devuelve ≥1
   `memoryId`; en Qdrant el punto tiene payload `user_id`; hay fila en `MemoryIndex`.
2. `POST /memory/search { query: "¿dónde vivo?" }` → recupera la memoria con score alto.
3. `search` con `submemories: ["x-inexistente"]` → vacío (prueba del filtro duro).
4. Borrar por memoryId → desaparece de Qdrant y de `MemoryIndex`.
