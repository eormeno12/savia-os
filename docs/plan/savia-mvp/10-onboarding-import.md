# Step 10 — Onboarding: importar chats / prompt de rescate

**Objetivo**: sembrar la memoria del usuario desde sus IAs previas (export de chats
o prompt de rescate) y sugerir spaces iniciales mediante **clustering de embeddings**
sobre las memorias recién creadas.

**Depende de**: 01–07 (reusa ingesta + clasificador embedding-first).

---

## Dos caminos de importación (MVP)

### A. Prompt de rescate (el más barato, va primero)

```
1. Savia genera un prompt que el usuario pega en su IA actual:
   "Resume en hechos concretos todo lo que sabes de mí: trabajo, salud,
    preferencias, proyectos, relaciones, objetivos, etc."
2. El usuario pega la RESPUESTA de su IA en Savia.
3. Entra por el pipeline de ingesta como source="chat_import" (texto plano).
```

### B. Import de export de ChatGPT (un proveedor en el MVP)

```
1. El usuario sube su conversations.json (export de ChatGPT).
2. Parser extrae los mensajes por conversación (rol + contenido).
3. Se encola como ingesta source="chat_import".
4. mem0 extrae los hechos relevantes (no guarda la conversación cruda).
```

> Otros proveedores (Claude, Gemini…) → fase 2. Aislar cada parser detrás de
> una interfaz común desde el día 1.

---

## Sugerencia de spaces mediante clustering

Una vez que la ingesta termina, el usuario tiene memorias pero aún no tiene spaces.
En lugar de pedirle que los cree desde cero, Savia **clusteriza los embeddings** de
sus memorias y sugiere spaces que emergen naturalmente de su contenido.

### Flujo

```
1. Obtener embeddings de todas las memorias del usuario desde Qdrant
2. Clustering sobre esos vectores:
   - Algoritmo: K-means (K sugerido: raíz cuadrada del nº de memorias, capped)
     o HDBSCAN si hay muchas memorias (agrupa mejor densidades variables)
3. Por cada cluster → 1 llamada LLM:
   "Aquí hay un grupo de hechos relacionados. ¿Cómo llamarías a este espacio?
    Dame un nombre (1-3 palabras) y una descripción breve."
   → devuelve { name, description }
4. Mostrar al usuario los spaces sugeridos con ejemplos de memorias de cada uno
5. El usuario acepta/rechaza/renombra cada sugerencia
6. Los spaces aceptados se crean vía POST /spaces → disparan backfill
   (que es barato: el clasificador ya tiene los embeddings)
```

### Por qué clustering y no solo LLM

- El LLM sobre 500 memorias para sugerir áreas sería caro e impreciso.
- Los embeddings ya están en Qdrant — el clustering es una operación vectorial barata.
- El resultado es más fiel al contenido real del usuario que una sugerencia genérica.
- El LLM solo nombra cada cluster (1 llamada por cluster, no por memoria).

### Implementación

```
ClusterService (apps/api/src/modules/onboarding/cluster.service.ts):
  - fetchEmbeddings(userId): paginado desde Qdrant
  - kMeans(vectors, k): implementación simple o librería (ml-kmeans en npm)
  - suggestName(cluster): llamada LLM con muestra de memorias del cluster
```

`K` óptimo: empezar con `Math.min(Math.round(Math.sqrt(n)), 8)` memorias como
máximo 8 spaces sugeridos para no abrumar al usuario en el onboarding.

---

## Entregables backend (`apps/api/src/modules/onboarding/`)

```
onboarding.module.ts
onboarding.controller.ts
onboarding.service.ts
rescue-prompt.ts               # genera el texto del prompt de rescate
parsers/chatgpt.ts             # conversations.json → texto normalizado
parsers/parser.interface.ts    # interfaz común (extensible a otros proveedores)
cluster.service.ts             # clustering + naming de spaces sugeridos
```

Endpoints:
- `GET /onboarding/rescue-prompt` → prompt para pegar en la IA.
- `POST /onboarding/rescue { text }` → ingesta como `chat_import`.
- `POST /onboarding/import/chatgpt` → recibe archivo, parsea, encola ingesta.
- `GET /onboarding/suggest-spaces` → clusteriza y devuelve sugerencias de spaces.
  (Se llama una vez que la ingesta terminó.)

## Entregables frontend (`apps/app/src/`)

```
app/(app)/onboarding/page.tsx
components/onboarding/RescueStep.tsx
components/onboarding/ImportStep.tsx
components/onboarding/SuggestedSpaces.tsx   # cards de spaces sugeridos + ejemplos
```

Wizard:
1. Bienvenida → explica las dos capas (archivos vs memoria).
2. Camino A (pegar respuesta de rescate) y/o Camino B (subir export).
3. Procesando… (estado del job de ingesta).
4. Spaces sugeridos (cards con nombre + 3 memorias de ejemplo) → el usuario
   acepta/rechaza/renombra → quedan creados.
5. Siguiente paso: conectar una IA (`/connect`).

## Contracts (`packages/contracts/src/onboarding.ts`)

```ts
export const RescueTextSchema = z.object({ text: z.string().min(10) })
export const ImportResultSchema = z.object({
  jobId: z.string(), status: z.enum(['queued', 'processing']), fileId: z.string()
})
export const SuggestedSpaceSchema = z.object({
  name: z.string(),
  description: z.string(),
  memoryCount: z.number(),
  examples: z.array(z.string())   // 3 memorias representativas del cluster
})
export type RescueText      = z.infer<typeof RescueTextSchema>
export type ImportResult    = z.infer<typeof ImportResultSchema>
export type SuggestedSpace  = z.infer<typeof SuggestedSpaceSchema>
```

## Archivos clave

- `apps/api/src/modules/onboarding/*`
- `apps/app/src/app/(app)/onboarding/*`

## Verificación

1. `GET /onboarding/rescue-prompt` devuelve un prompt usable.
2. Pegar respuesta de rescate → memorias creadas y embebidas en Qdrant.
3. Subir `conversations.json` de ChatGPT → se parsea e ingesta.
4. `GET /onboarding/suggest-spaces` → devuelve 3-6 spaces sugeridos con
   ejemplos de memorias coherentes por cluster.
5. Aceptar sugerencias → se crean spaces; el backfill (step 07) los puebla
   rápidamente porque los embeddings ya están.
6. Las memorias aparecen en el dashboard (step 11) organizadas por space.
