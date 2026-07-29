# mem0 OSS — Cómo funciona end-to-end (v3.1.0)

> Explicación exhaustiva y **verificada contra el fuente** de cómo funciona
> `mem0ai@3.1.0` (entrada `mem0ai/oss`), la librería de memoria sobre la que Savia
> construye. Documenta el código REAL instalado, no el conocimiento general de
> mem0 (que difiere por versión). Material de referencia de una dependencia; no es
> código de Savia. Ver [`README.md`](./README.md) (procedencia + regeneración) y
> [`docs/product/savia-b2b-legacy/01-vision.md`](../../product/savia-b2b-legacy/01-vision.md) (en reescritura limpia en `docs/product/savia-b2b/`).

## Procedencia y método

- **Versión:** `mem0ai@3.1.0` (actualizado desde 3.0.9), TypeScript, entrada `mem0ai/oss`.
- **Fuente:** extraído del **sourcemap** del paquete instalado (`dist/oss/index.mjs.map`
  → `sourcesContent`, **77 archivos** `.ts`). Match exacto de versión con lo instalado.
- **Método:** grafo con **graphify** (**1156 nodos, 2887 edges, 53 comunidades**) para
  orientar, lectura del fuente citando `file:line`, y **verificación adversarial** por
  sección contra el código.
- **Grafo navegable:** [`graphify-out/graph.html`](./graphify-out/graph.html).
- Rutas `file:line` relativas a `src/oss/src/` del paquete.

## Novedades en 3.1.0 (respecto a 3.0.9)

- **Rerankers — subsistema NUEVO y opt-in** (§9): `cohere`, `zero_entropy`,
  cross-encoder local (`sentence_transformer`/`huggingface`), `llm_reranker`. Se
  invoca como **Step 10 de `search`** con `rerank: true` (no-op si no hay reranker).
  Llena el hueco "search no tenía reranker-modelo".
- **Expiración de memorias — NUEVO** (§8): `expiration_date` (YYYY-MM-DD); se oculta
  de `search`/`getAll` salvo `showExpired`. TTL real (a diferencia de `timestamp`/
  `referenceDate`, que **siguen lanzando error**).
- **Explosión de providers**: +17 vector stores, +7 LLMs, +4 embedders, +interfaces
  `base.ts` por subsistema (refactor).
- **El core NO cambió de fondo**: `add` sigue **aditivo** (extracción + hash dedup, sin
  UPDATE/DELETE), `search` sigue denso + BM25(null en Qdrant) + entity-boost +
  `scoreAndRank`; el reranker es un paso adicional.

## Índice

1. [Panorama, arquitectura y modelo de datos](#1-panorama-arquitectura-y-modelo-de-datos)
2. [Pipeline de add() — ingesta aditiva por fases](#2-pipeline-de-add-ingesta-aditiva-por-fases)
3. [Pipeline de search() — denso + BM25 + entity-boost + reranker](#3-pipeline-de-search-denso-bm25-entity-boost-reranker)
4. [Prompts y schemas de extracción](#4-prompts-y-schemas-de-extracción)
5. [Extracción de entidades y entity store](#5-extracción-de-entidades-y-entity-store)
6. [Vector stores y la interfaz de almacenamiento](#6-vector-stores-y-la-interfaz-de-almacenamiento)
7. [Configuración, factories, providers e historial](#7-configuración-factories-providers-e-historial)
8. [Multimodal (visión), CRUD, expiración y operaciones](#8-multimodal-visión-crud-expiración-y-operaciones)
9. [Rerankers (nuevo en 3.1.0)](#9-rerankers-nuevo-en-310)

---

## 1. Panorama, arquitectura y modelo de datos

### Qué es mem0 OSS 3.1.0 (entrada `mem0ai/oss`)

`mem0ai/oss` es la variante **self-hosted** de mem0: una sola clase, `Memory` (`memory/index.ts:175`), que orquesta una "capa de memoria" para agentes LLM. La instancia se construye con `new Memory(config)` y expone métodos públicos asíncronos —`add`, `search`, `get`, `getAll`, `update`, `delete`, `deleteAll`, `reset` (confirmados por graphify como aristas salientes de `Memory`, community 5). Además tiene métodos **privados** como `getEntityStore()`, `addToVectorStore()`, `createMemory()`, `updateMemory()`, `_autoInitialize()` y `_ensureInitialized()`. Todo el estado que "recuerda" vive en **subsistemas intercambiables** que `Memory` no implementa: los construye vía factories y los usa a través de contratos (interfaces). El propio archivo lo declara en sus campos privados:

```ts
export class Memory {
  private config: MemoryConfig;
  private customInstructions: string | undefined;
  private embedder: Embedder;
  private vectorStore!: VectorStore;
  private llm: LLM;
  private reranker: Reranker | null = null;
  private db: HistoryManager;
  private collectionName: string | undefined;
  private apiVersion: string;
  telemetryId: string;
  private _initPromise: Promise<void>;
  private _initError?: Error;
  private _entityStore?: VectorStore;
```
(`memory/index.ts:175`–`188`)

Esos campos son el mapa mental de todo el sistema: **cinco subsistemas** (`embedder`, `llm`, `vectorStore`, `db`=historyStore y —opcional/opt-in— `reranker`) más un **entity store separado** (`_entityStore`) y la maquinaria de **inicialización perezosa** (`_initPromise`/`_initError`).

> **Nota de fidelidad (importante para quien construya encima).** Este documento describe SOLO el código presente en el snapshot extraído (77 archivos, la raíz `src/oss/src`). Los archivos de interfaz base que `memory/index.ts` y `utils/factory.ts` importan —`../embeddings/base`, `../llms/base`, `../vector_stores/base`, `../rerankers/base`, `../storage/base`— **no están incluidos en este snapshot** (`find … -name base.ts` no encuentra ninguno; sí existen como destino de `import`, p.ej. `factory.ts:18`,`:23`,`:24`,`:25`,`:46`). Por eso las interfaces `Embedder`, `LLM`, `VectorStore`, `Reranker`, `RerankResult` y `HistoryManager` se documentan aquí por su **contrato observable**: cómo las llama `Memory`/las factories y cómo las implementan las clases concretas (`implements Embedder`, `implements Reranker`, …). No se transcribe su cuerpo porque no está en el fuente disponible.

### Mapa de módulos (graphify: god nodes + comunidades)

Grafo del paquete: **1156 nodos · 2887 edges · 53 comunidades** (31 mostradas, 22 "delgadas" omitidas; 99% EXTRACTED, coste de tokens 0) según `graphify-out/GRAPH_REPORT.md:8`–`10`. Los **god nodes** (más conectados = abstracciones núcleo) revelan que el centro de gravedad del código es el **vector store** y sus filtros, no la clase `Memory`:

| # | God node | Edges | Rol |
|---|----------|-------|-----|
| 1 | `VectorStoreResult` | 128 | forma de fila devuelta por TODO vector store (`types/index.ts:175`) |
| 2 | `SearchFilters` | 116 | filtros de scoping/consulta que cruzan todos los stores (`types/index.ts:164`) |
| 3 | `Message` | 62 | unidad de entrada a `add` (`types/index.ts:10`) |
| 4 | `VectorStoreConfig` | 52 | config común de stores (`types/index.ts:37`) |
| 5 | `NeptuneAnalyticsVectorStore` | 46 | store |
| 6 | `DatabricksVectorStore` | 44 | store |
| 7 | `S3Vectors` | 42 | store |
| 8 | `Memory` | 38 | orquestador (`memory/index.ts:175`) |
| 9 | `LLMConfig` | 38 | config de LLM (`types/index.ts:56`) |
| 10 | `OpenSearchDB` | 29 | store |

Comunidades relevantes para esta sección (de las 53; 22 "delgadas" omitidas por el report):

- **Community 5 "Memory"** (cohesión 0.16): `Memory`, `validateAndTrimEntityId()`, `validateSearchParams()`, `MemoryItem`, `SearchResult`. Es el núcleo del orquestador.
- **Community 30 ".constructor"** (0.18): `DEFAULT_MEMORY_CONFIG`, `ConfigManager`, `MemoryConfig`, `MemoryConfigSchema`, `EmbedderFactory`, `LLMFactory`, `RerankerFactory`. Es la capa de **configuración + factories** (nota: `VectorStoreFactory` y `HistoryManagerFactory` NO caen aquí).
- **Community 31 "index.ts"** (0.18): `RerankerConfig`, `CrossEncoderReranker`, `AWSBedrockConfig`, `BedrockSDK`, `PROVIDERS`, `sigmoid()`, `MultiModalMessages`. Reranker (cross-encoder) + tipos.
- **Community 3 "factory.ts"** (0.08): las implementaciones de **embedder** (`OpenAIEmbedder`, `GoogleEmbedder`, `FastEmbedEmbedder`, `AzureOpenAIEmbedder`, `HuggingFaceEmbedder`, `LangchainEmbedder`, `LMStudioEmbedder`, `TogetherEmbedder`) con sus métodos `.embed()`/`.embedBatch()`, más `EmbeddingConfig`, `VertexAIConfig`, `HistoryStoreConfig` y `HistoryManagerFactory`. (No aparece ningún nodo "Embedder"/"HistoryManager" de interfaz: los `base.ts` no están en el snapshot.)
- **Community 6 "LLMConfig"** (`DeepSeekLLM`, `LiteLLM`, `LMStudioLLM`, `OpenAILLM`, `TogetherLLM`, `VllmLLM`, `LLMConfig`, …) y **Community 12 "Message"** (`AzureOpenAILLM`, `GoogleLLM`, `GroqLLM`, `MiniMaxLLM`, `OpenAIStructuredLLM`, `SarvamLLM`, `Message`) agrupan buena parte de las implementaciones de LLM; otras aparecen como hubs sueltos (`AWSBedrockLLM`, `MistralLLM`, `XAILLM`, `AnthropicLLM`).
- **Muchas comunidades son prácticamente un driver de vector store cada una**: 0 (Databricks), 1 (Neptune), 7 (Baidu), 8 (`MemoryVectorStore`/SQLite), 9 (OpenSearch), 11 (Valkey), 15 (PGVector), 18 (Redis), 22 (Weaviate), 23 (MongoDB), 24 (AzureMySQL), 25 (Elasticsearch), 50 (Qdrant), 51 (Supabase). La **community 14 mezcla** `PineconeDB` con dos rerankers (`CohereReranker`, `ZeroEntropyReranker`), y la **community 16 "VectorStoreConfig"** agrupa las `*Config` compartidas de varios stores (no es un solo store).
- **Community 13 "entity_extraction.ts"** (0.15), **Community 49 "lemmatizeForBm25"** (0.60), **Community 2 "notices.ts"**, **Community 40 "telemetry.ts"**, **Community 38 "detectTemporalUsageFromMetadata"**: utilidades de soporte (extracción de entidades para boost, lematización BM25, avisos/telemetría, gating de features temporales).

Lectura del mapa: **buena parte del código son "drivers" de vector store** (una gran fracción de las comunidades es un store cada una); `Memory` es un orquestador comparativamente delgado que delega en factories. Sin ciclos de import detectados (`GRAPH_REPORT.md:92`).

### Los cinco subsistemas intercambiables + el entity store

Todos se instancian por **factory con `switch(provider.toLowerCase())`** en `utils/factory.ts`. El provider es un string; un provider desconocido **lanza** `Unsupported <tipo> provider: <x>`.

**1. Embedder** — `EmbedderFactory.create(provider, config)` (`factory.ts:74`, switch `:76`–`99`). Providers: `openai`, `ollama`, `lmstudio`, `together`, `google`/`gemini`, `azure_openai`, `fastembed`, `langchain`, `vertexai`, `huggingface`.

**2. LLM** — `LLMFactory.create` (`factory.ts:104`, switch `:107`–`143`). 18 providers: `openai`, `openai_structured`, `anthropic`, `groq`, `ollama`, `lmstudio`, `google`/`gemini`, `azure_openai`, `mistral`, `langchain`, `deepseek`, `xai`, `sarvam`, `aws_bedrock`, `litellm`, `minimax`, `together`, `vllm`.

**3. VectorStore** — `VectorStoreFactory.create` (`factory.ts:150`, switch `:153`–`204`). **27 strings de provider → 25 clases de store distintas** (`neptune`/`neptune-analytics` comparten `NeptuneAnalyticsVectorStore`; `s3-vectors`/`s3_vectors` comparten `S3Vectors`): `memory` (default, `MemoryVectorStore` SQLite local), `baidu`, `qdrant`, `chroma`, `redis`, `valkey`, `supabase`, `langchain`, `vectorize`, `azure-ai-search`, `vertex_ai_vector_search`, `pgvector`, `databricks`, `neptune`/`neptune-analytics`, `elasticsearch`, `opensearch`, `upstash_vector`, `azure_mysql`, `cassandra`, `pinecone`, `s3-vectors`/`s3_vectors`, `turbopuffer`, `milvus`, `mongodb`, `weaviate`.

**4. HistoryStore (`db`)** — `HistoryManagerFactory.create` (`factory.ts:274`, switch `:276`–`289`). Providers: `sqlite` → `new SQLiteManager(config.config.historyDbPath || ":memory:")`, `supabase` → `SupabaseHistoryManager`, `memory` → `MemoryHistoryManager`. Si `disableHistory` es true, `Memory` usa en cambio `DummyHistoryManager` (ver ciclo de vida).

**5. Reranker (opcional, 5º subsistema)** — `RerankerFactory.create` (`factory.ts:211`), detallado más abajo.

**Entity store (`_entityStore`)** — no es un provider aparte: es **otra instancia del MISMO provider de vector store**, con `collectionName` sufijado `_entities`, creada perezosamente por el método privado `getEntityStore()` (`memory/index.ts:288`). Sirve al subsistema de "graph-lite"/entidades (`extractEntities`, community 13) para boost por entidades en el ranking de `search`.

**[para construir encima]** El acoplamiento por string-provider significa que **cambiar de backend no toca `Memory`**: solo cambias `config.vectorStore.provider` (y su `config`). Pero `config as any` se pasa a cada store (`factory.ts:156`+), así que **los errores de forma de config no se detectan en el factory** —salen del constructor del store o de `initialize()`.

### Contratos de los subsistemas (interfaces base, observadas)

Derivadas de cómo `Memory`/factories las usan e implementan (los `base.ts` no están en el snapshot):

- **`Embedder`**: `embed(text: string, type?: string): Promise<number[]>` y `embedBatch(texts: string[], type?: string): Promise<number[][]>`. `Memory` llama `this.embedder.embed(parsedMessages, "search")` (`memory/index.ts:848`), `this.embedder.embed(data, "add")` (`:1897`) y `this.embedder.embedBatch(memTexts, "add")` (`:942`); el 2º argumento es una **pista de tipo de embedding** (`"add"`/`"search"`) que providers como Vertex AI consumen (`VertexAIConfig.memoryAddEmbeddingType`/`memorySearchEmbeddingType`, `types/index.ts:31`,`:33`; `VertexAIConfig extends EmbeddingConfig` en `:26`) pero que `OpenAIEmbedder` **ignora** —sus firmas solo toman `text`/`texts` (`embeddings/openai.ts:19`,`:31`). `class OpenAIEmbedder implements Embedder` confirma la interfaz (`openai.ts:5`).

- **`VectorStore`** (contrato observable en `memory/index.ts`): `initialize(): Promise<void>` (`:260`); `insert(vectors: number[][], ids: string[], payloads: Record<string,any>[]): Promise<void>` (`:1030`, `:1907`); `search(queryVector: number[], limit: number, filters?): Promise<VectorStoreResult[]>` (`:849`); `get(id): Promise<VectorStoreResult | null>` (`:1925`); `list(filters, limit)` (`:1843`); más `update`/`delete` y opcionalmente `keywordSearch` (`:1414`, probado con `typeof … === "function"`) usados por los métodos homónimos de `Memory`.

- **`Reranker`**: `rerank(query: string, documents: string[], topK?: number): Promise<RerankResult[]>`, donde `RerankResult` tiene al menos `{ index: number; rerankScore: number }` (`memory/index.ts:1582`–`1590`; `class CohereReranker implements Reranker`, `rerankers/cohere.ts:6`,`:55`, importa `{ Reranker, RerankResult } from "./base"`, `:2`).

- **`LLM`** y **`HistoryManager`**: `Memory` usa del LLM `generateResponse(messages, { type: "json_object" })` (`:883`) para la extracción; del historial usa `db.getLastMessages` (`:834`), `db.saveMessages` (`:924`), `db.addHistory` (`:1908`) y `db.batchAddHistory` (`:1059`). Sus tipos se importan de `../llms/base` y `../storage/base` (no presentes en el snapshot).

### Configuración: `MemoryConfig`, defaults y `ConfigManager.mergeConfig`

`MemoryConfig` (`types/index.ts:127`) es el contrato de entrada. `embedder`, `vectorStore`, `llm` son **obligatorios en el tipo**; `reranker`, `historyStore`, `disableHistory`, `historyDbPath`, `customInstructions`, `version` son opcionales:

```ts
export interface MemoryConfig {
  version?: string;
  embedder: { provider: string; config: EmbeddingConfig };
  vectorStore: { provider: string; config: VectorStoreConfig };
  llm: { provider: string; config: LLMConfig };
  reranker?: { provider: string; config: RerankerConfig };
  historyStore?: HistoryStoreConfig;
  disableHistory?: boolean;
  historyDbPath?: string;
  customInstructions?: string;
}
```

En la práctica el usuario puede pasar `{}` porque el constructor llama `ConfigManager.mergeConfig(config)` (`config/manager.ts:5`), que fusiona con `DEFAULT_MEMORY_CONFIG` y **valida con Zod** (`MemoryConfigSchema.parse`, `manager.ts:212`; schema en `types/index.ts:181`). Defaults concretos (`config/defaults.ts`):

- `disableHistory: false`, `version: "v1.1"`.
- **embedder**: `provider: "openai"`, `apiKey: process.env.OPENAI_API_KEY || ""`, `model: "text-embedding-3-small"`.
- **vectorStore**: `provider: "memory"`, `collectionName: "memories"`, `dimension: 1536`.
- **llm**: `provider: "openai"`, `baseURL: "https://api.openai.com/v1"`, `apiKey: process.env.OPENAI_API_KEY || ""`, `model: "gpt-5-mini"`, `modelProperties: undefined`.
- **historyStore**: `provider: "sqlite"`, `historyDbPath: "memory.db"`.

Detalles no obvios de `mergeConfig` **[para construir encima]**:

- **El `dimension: 1536` del default queda efectivamente muerto.** La rama que arma `vectorStore.config` calcula `explicitDimension = userConf?.dimension || userConfig.embedder?.config?.embeddingDims || undefined` (`manager.ts:81`–`84`) y devuelve `dimension: explicitDimension` (`:91`/`:99`); de `defaultConf` solo copia `collectionName` (`:97`–`98`). Por lo tanto, **si no fijas `dimension` ni `embeddingDims`, el `dimension` mergeado es `undefined`** y el arranque dispara un *probe* de embedding (ver ciclo de vida). El comentario del propio código lo dice: "leave it undefined so that `Memory._autoInitialize()` can auto-detect it" (`manager.ts:76`–`80`).
- El provider del vector store se **normaliza a minúsculas** aquí (`manager.ts:67`), porque comparaciones como `provider === "memory"` (entity store) no son case-insensitive (comentario `:63`–`66`).
- Para `fastembed`, el modelo del embedder se deja `undefined` a propósito para que use su propio default (`manager.ts:20`–`21`).
- Se normalizan claves **snake_case del SDK Python/OpenClaw**: `lmstudio_base_url`, `embedding_dims`, `vllm_base_url`, `top_p`, `max_tokens`, `aws_region`/`aws_access_key_id`/… (`manager.ts:30`–`176`). `vectorStore.config` y `llm.config` usan `.passthrough()` en Zod (`types/index.ts:212`,`:236`), así que **campos extra sobreviven**; `embedder.config` **no** tiene passthrough en el schema Zod (`types/index.ts:183`–`202`) —lo que no esté listado ahí se descarta en la validación.
- `historyStore`: precedencia `historyStore.config > historyDbPath top-level > default` (`manager.ts:186`–`205`).
- `reranker: userConfig.reranker` se pasa **tal cual** (sin merge de defaults) (`manager.ts:208`) y Zod lo valida como `{ provider, config: record }` opcional (`types/index.ts:246`–`251`).

### Ciclo de vida: construcción, init perezosa y probe de dimensión

**Constructor** (`memory/index.ts:190`–`232`), síncrono, orden exacto:

1. `this.config = ConfigManager.mergeConfig(config)` (valida; **puede lanzar** ZodError aquí, síncrono).
2. `embedder = EmbedderFactory.create(...)` — **eager**.
3. `llm = LLMFactory.create(...)` — **eager**. El vector store **NO** se crea aquí (diferido para poder auto-detectar dimensión; comentario `:199`–`201`).
4. Si `config.reranker` existe: `reranker = RerankerFactory.create(...)`; si no, queda `null` (opt-in).
5. `db`: `disableHistory` → `new DummyHistoryManager()`; si no → `HistoryManagerFactory.create(...)`.
6. `collectionName`, `apiVersion = config.version || "v1.0"` (dado que el default de `version` es `"v1.1"`, **el fallback `"v1.0"` es prácticamente inalcanzable**), `telemetryId = "anonymous"`.
7. Lanza init en background **sin await**:

```ts
this._initPromise = this._autoInitialize().catch((error) => {
  this._initError =
    error instanceof Error ? error : new Error(String(error));
  console.error(this._initError);
});
```
(`memory/index.ts:227`–`231`)

**[para construir encima]** El constructor **nunca rechaza por fallo de init**: los errores de `_autoInitialize` se capturan en `_initError` y se emiten con `console.error`. El fallo **aflora en la primera llamada pública** (todas hacen `await this._ensureInitialized()`; p.ej. `add` en `:727`, `search` en `:1344`, `getAll` en `:1810`).

**`_autoInitialize`** (`memory/index.ts:238`–`263`):

```ts
if (!this.config.vectorStore.config.dimension) {
  try {
    const probe = await this.embedder.embed("dimension probe");
    this.config.vectorStore.config.dimension = probe.length;
  } catch (error: any) {
    throw new Error(
      `Failed to auto-detect embedding dimension from provider '${this.config.embedder.provider}': ${error.message}. ` +
        `Please set 'dimension' in vectorStore.config or 'embeddingDims' in embedder.config explicitly.`,
    );
  }
}

this.vectorStore = VectorStoreFactory.create(
  this.config.vectorStore.provider,
  this.config.vectorStore.config,
);

await this.vectorStore.initialize();

await this._initializeTelemetry();
```

- **Probe de dimensión**: si `dimension` es falsy (el caso por defecto, ver arriba), hace **una llamada de embedding real** con el texto literal `"dimension probe"` y usa `probe.length`. **[para construir encima] costo:** con el embedder OpenAI por defecto, arrancar `Memory` implica **1 request de embedding + `OPENAI_API_KEY` válido**, incluso antes de tu primer `add`. Fija `dimension`/`embeddingDims` para evitarlo.
- Luego crea el store y **espera explícitamente `initialize()`** (comentario: el constructor del store puede disparar init async —p.ej. Qdrant—; se await aquí para garantizar que colecciones/tablas existen antes de leer/escribir, `:256`–`260`).

**`_ensureInitialized`** (`memory/index.ts:270`–`286`): hace `await this._initPromise`; si hubo `_initError`, **lo limpia y reintenta `_autoInitialize` una vez**; si vuelve a fallar, `throw this._initError`. Es decir, hay **un reintento automático** por si el embedder/store estuvo transitoriamente caído al arrancar.

### Scoping user / agent / run y el entity store separado

El scoping se expresa con `SearchFilters` (`types/index.ts:164`): `user_id?`, `agent_id?`, `run_id?`, más `[key: string]: any`. Reglas observables:

- **`add` exige al menos un scope.** Acepta `config.userId`/`agentId`/`runId` (camelCase), los valida con `validateAndTrimEntityId` (recorta espacios; **lanza** si queda vacío o contiene whitespace interno, `memory/index.ts:131`–`148`) y los copia a **filtros Y metadata** en snake_case (`:742`–`744`). Si ninguno está presente: `throw new Error("One of the filters: userId, agentId or runId is required!")` (`:751`–`755`).
- **`search`/`getAll` prohíben scope top-level.** `rejectTopLevelEntityParams` **lanza** si pasas `user_id`/`userId`/etc fuera de `filters` (`:108`–`121`, invocado en `search` `:1320` y `getAll` `:1805`); hay que usar `filters: { userId: "..." }`. Además los IDs en `filters` se validan y solo se incluyen si su valor validado es definido —para no mandar `agent_id: undefined` a Qdrant/pgvector/Redis (`:1330`–`1342`).
- **`buildSessionScope(filters)`** produce una clave de sesión ordenada `agent_id=…&run_id=…&user_id=…` (solo las presentes) que se usa para historial conversacional (`db.getLastMessages`, `db.saveMessages`) (`:541`–`548`, usada en `:826`,`:834`).

**Entity store separado** (método privado `getEntityStore`, `:288`–`313`): perezoso; reusa **el mismo provider** del vector store principal con `collectionName = "${collectionName}_entities"` y el resto de la config heredada. Casos especiales: provider `memory` → separa el fichero SQLite (`…_entities.db`, `:297`–`300`); provider `databricks` → sufija `tableName` (`:301`–`305`). Se `initialize()` una sola vez y se cachea en `_entityStore`. **[para construir encima]** el store de entidades **no** es multi-tenant por sí mismo: el aislamiento sigue viniendo de los filtros `user_id/agent_id/run_id` que `Memory` le pasa (`_sessionFiltersFromPayload`, `:319`–`327`).

### Modelo de datos: payload del vector store, `MemoryItem`, `VectorStoreResult`

**Payload almacenado por cada memoria.** Hay dos caminos de escritura y **difieren en las claves**:

- Camino **inferido** (batch, `add` con `infer:true`, default) — `memory/index.ts:986`–`999`:

```ts
const memPayload: Record<string, any> = {
  ...metadata,
  data: text,
  textLemmatized,
  hash: memHash,       // md5(text)
  createdAt: now,      // ISO
  updatedAt: now,      // ISO
};
if (mem.attributed_to) {
  memPayload.attributedTo = mem.attributed_to;
}
if (filters.user_id) memPayload.user_id = filters.user_id;
if (filters.agent_id) memPayload.agent_id = filters.agent_id;
if (filters.run_id) memPayload.run_id = filters.run_id;
```

- Camino **no inferido / `createMemory`** (`add` con `infer:false`, y creaciones simples) — `:1899`–`1905`:

```ts
const memoryMetadata = {
  ...metadata,
  data,
  hash: createHash("md5").update(data).digest("hex"),
  textLemmatized: lemmatizeForBm25(data),
  createdAt: new Date().toISOString(),
};
```

**[para construir encima] — claves reservadas del payload:**
- `data`: el **texto de la memoria** (fuente de verdad; `search` descarta candidatos sin `data`, `:1553`).
- `hash`: `md5(data)` — **deduplicación**; el batch inferido salta hashes ya vistos/existentes (`:977`–`980`).
- `textLemmatized`: texto lematizado para **BM25** (`lemmatizeForBm25`, community 49).
- `createdAt` / `updatedAt`: ISO. **Ojo:** `updatedAt` solo lo escribe el camino **inferido**; `createMemory` (no-inferido) **no** setea `updatedAt` al crear.
- `attributedTo`: quién dijo la frase (solo camino inferido, desde `attributed_to` del LLM).
- `user_id` / `agent_id` / `run_id`: scoping.
- `expiration_date`: si pasas `config.expirationDate`, se normaliza (`normalizeExpirationDate`) dentro de `metadata` y entra al payload vía `...metadata` (`:747`–`749`); `search`/`getAll` filtran expirados con `payloadIsExpired(payload)` salvo `showExpired` (`:1522`, `:1847`).
- Cualquier clave de tu `metadata` propio (spread `...metadata`).

**Cómo se re-hidrata en `search` → `MemoryItem`** (`:1539`–`1572`): se construye el item con `id`, `memory: payload.data`, `hash`, `createdAt`, `updatedAt`, `score`, y `metadata` = payload **menos** las claves reservadas (`excludedKeys = {user_id, agent_id, run_id, hash, data, createdAt, updatedAt, textLemmatized, attributedTo}`, `:1540`–`1550`); `user_id/agent_id/run_id/attributedTo` se re-adjuntan como campos top-level si existen; `score_details` solo con `explain`. `getAll` re-hidrata con el mismo `excludedKeys` (`:1849`–`1875`) pero **sin** `score`/`score_details` (no hace scoring).

**Tipos de retorno:**

```ts
export interface MemoryItem {
  id: string;
  memory: string;
  hash?: string;
  createdAt?: string;
  updatedAt?: string;
  score?: number;
  /** Relevance score added by the reranker, alongside (not replacing) `score`. */
  rerankScore?: number;
  metadata?: Record<string, any>;
  attributedTo?: string;
}

export interface SearchFilters {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  [key: string]: any;
}

export interface SearchResult {
  results: MemoryItem[];
}

export interface VectorStoreResult {
  id: string;
  payload: Record<string, any>;
  score?: number;
}
```
(`types/index.ts:151`–`179`)

`VectorStoreResult` es el contrato **crudo** de cada driver (id + payload + score opcional); `MemoryItem` es la forma **pública** que devuelve `Memory`. `rerankScore` es un campo **añadido, no reemplaza `score`** (comentario en `types/index.ts:158`).

### Reranker (5º subsistema, opcional)

Config `RerankerConfig` (`types/index.ts:80`–`125`), con `[key: string]: any`. `RerankerFactory.create` (`factory.ts:211`–`236`) despacha:

- `cohere` → `CohereReranker` (default model `"rerank-v3.5"`, `rerankers/cohere.ts:4`; exige `apiKey` o `COHERE_API_KEY`, si no **lanza**, `:16`–`21`; import perezoso de `cohere-ai` en `createClient`, `:46`).
- `zero_entropy` → `ZeroEntropyReranker`.
- `sentence_transformer` → `CrossEncoderReranker(config, "Xenova/ms-marco-MiniLM-L-6-v2")`.
- `huggingface` → `CrossEncoderReranker(config, "Xenova/bge-reranker-base", 512)`.
- `llm_reranker` → `LLMReranker(config, llm)`, donde `buildLLMRerankerLLM` arma un LLM anidado con defaults `model "gpt-4o-mini"`, `temperature 0.0`, `maxTokens 100`, provider `"openai"` (`factory.ts:238`–`271`).
- desconocido → **lanza** `Unsupported reranker provider`.

Campos de `RerankerConfig` documentados en el fuente incluyen `topK`, `returnDocuments`/`maxChunksPerDoc` (solo cohere), `device`/`maxLength`(512, huggingface)/`normalize`(true por defecto) (sentence_transformer/huggingface), y `batchSize`/`showProgressBar` marcados **no-op en este runtime** (`types/index.ts:84`–`124`).

**Uso en `search` (opt-in por llamada)** — `memory/index.ts:1574`–`1594`:

```ts
const invokeReranker = Boolean(
  config.rerank && this.reranker && results.length > 0,
);
let finalResults = results;
if (invokeReranker) {
  try {
    const ranked = await this.reranker!.rerank(
      query,
      results.map((r) => r.memory),
      topK,
    );
    finalResults = ranked.map((r) => ({
      ...results[r.index],
      rerankScore: r.rerankScore,
    }));
  } catch (e) {
    console.warn(`Reranking failed, using original results: ${e}`);
  }
}
```

**[para construir encima]** El reranker es **triple-condicional**: requiere `config.rerank === true` en la llamada **Y** un reranker configurado en el constructor **Y** ≥1 resultado. Reordena solo el conjunto ya recuperado (candidatos post-`scoreAndRank`), no re-consulta el store. **Fallo de rerank se traga**: `console.warn` y devuelve los resultados originales sin `rerankScore` (no re-lanza).

### Qué NO hace / dónde lanza / costos — resumen [para construir encima]

- **Costo de arranque:** por defecto (`dimension` sin fijar) `_autoInitialize` hace **1 embedding** (`"dimension probe"`) y exige el embedder alcanzable + API key. Evítalo fijando `dimension` o `embeddingDims`.
- **Costo de `add` inferido (default):** pipeline por fases "V3" con **UNA sola llamada al LLM** —Fase 0 recupera contexto conversacional (`db.getLastMessages(sessionScope, 10)`, envuelto en `try/catch`, `:832`–`838`); Fase 1 hace **1 embedding** de la conversación (`embed(parsedMessages, "search")`, `:848`) y `vectorStore.search(…, 10, …)` de memorias existentes (`:849`); Fase 2 hace **UNA** `llm.generateResponse` con `ADDITIVE_EXTRACTION_PROMPT` (+ `AGENT_CONTEXT_SUFFIX` si el scope es solo-agente) y valida con `AdditiveExtractionSchema` (comentario "single call", `:867`,`:883`); Fase 3 embebe en batch los textos extraídos (`embedBatch(memTexts, "add")`, `:942`, con fallback a `embed` individual); Fases 4–6 deduplican por hash e insertan en batch. **Nota:** `getFactRetrievalMessages`/`getUpdateMemoryMessages`/`FactRetrievalSchema` se **importan pero NO se usan** en este archivo (imports muertos: solo aparecen en `:20`–`22`); no hay una 2ª llamada de "decisión de update". `infer:false` **omite el LLM por completo** (1 `embed` por mensaje no-system vía `createMemory`).
- **Dónde lanza (síncrono/temprano):** ZodError en el constructor (config inválida); provider desconocido en cualquier factory; `add` sin scope; entity IDs vacíos/con espacios; scope top-level en `search`/`getAll`; `threshold` fuera de `[0,1]` o `topK` no-entero/negativo (`validateSearchParams`, `:154`–`173`). **Solo dos parámetros con gating temporal lanzan**: `timestamp` en `add` (`:687`–`695`, `getTemporalFeatureErrorMessage`) y `referenceDate` en `search` (`:1304`–`1312`). En cambio `expirationDate` **NO lanza** —es una feature soportada: se normaliza y se guarda en `metadata` (`:747`–`749`).
- **Dónde NO lanza (silencioso):** fallo de init en el constructor (diferido a la 1ª llamada, con **1 reintento** en `_ensureInitialized`); fallo de rerank (`console.warn`); fallos de historial (`db.getLastMessages`/`saveMessages` envueltos en `try/catch` vacíos, `:832`–`838`,`:1010`–`1020`); fallo de `insert` batch → **fallback a inserción una-por-una** (`:1029`–`1044`).
- **Qué NO hace:** no persiste historial si `disableHistory` (usa `DummyHistoryManager`); no valida la forma de `vectorStore.config`/`llm.config` extra (passthrough Zod, `config as any` al store); no aplica el `dimension:1536` del default (se auto-detecta); el `apiVersion "v1.0"` de fallback es inalcanzable (default real `"v1.1"`); el entity store no aporta aislamiento propio (depende de los filtros de scope).

## 2. Pipeline de add() — ingesta aditiva por fases

`add()` es el único punto de escritura de memorias del SDK OSS v3.1.0. Su contrato es estrictamente **aditivo**: cada llamada solo puede crear memorias nuevas (evento `ADD`). Nunca actualiza, borra ni marca NOOP sobre memorias existentes — eso vive en los métodos separados `update()` / `delete()`. El método delega el trabajo pesado en el privado `addToVectorStore()` (`memory/index.ts:797`), que se bifurca según `infer`.

Definido en `memory/index.ts:683`:

```ts
async add(
  messages: string | Message[],
  config: AddMemoryOptions,
): Promise<SearchResult> {
```

> Nota: el tipo `AddMemoryOptions` se importa de `./memory.types` (`memory/index.ts:37-44`, con `AddMemoryOptions` en la línea 38 y `from "./memory.types"` en la 44), archivo que **no está presente** en este snapshot de fuente (el directorio `memory/` solo contiene `index.ts`). Toda la forma de `config` documentada aquí proviene de los accesos concretos que hace el cuerpo del método, no de la definición del tipo.

### Fase de guardas y normalización (dentro de `add()`, antes del vector store)

El orden exacto de validaciones y transformaciones (`memory/index.ts:687-761`):

1. **`timestamp` LANZA (Platform-only).** Si `config?.timestamp !== undefined`, primero resuelve el telemetry id (`await this._getNoticeTelemetryId()`) y luego lanza (`memory/index.ts:687-695`). **[para construir encima]** en OSS no puedes fijar la marca temporal de una memoria; el temporal reasoning es solo de Platform.

   ```ts
   if (config?.timestamp !== undefined) {
     await this._getNoticeTelemetryId();
     throw new Error(
       await getTemporalFeatureErrorMessage(this, {
         triggerFunction: "add",
         triggerParameter: "timestamp",
       }),
     );
   }
   ```

2. **Validación de `messages`** (`memory/index.ts:697-721`) — lanza `Error` con mensajes concretos en estos casos: `undefined`/`null` (`"messages is required and cannot be undefined or null. …"`); array vacío (`"messages array cannot be empty. …"`); array cuyo `content` es todo string en blanco (`messages.every(m => typeof m.content === "string" && m.content.trim() === "")` → `"messages array cannot contain only blank content. …"`); string vacío tras `trim()` (`"messages string cannot be empty. …"`).

3. Detección de aviso temporal desde metadata (`detectTemporalUsageFromMetadata(config?.metadata)`, `memory/index.ts:723`), `_ensureInitialized()` (`727`) y evento de telemetría `_captureEvent("add", { message_count, has_metadata, has_filters, infer })` (`memory/index.ts:728-733`).

4. **Defaults por destructuring** (`memory/index.ts:734`): `const { metadata = {}, filters = {}, infer = true } = config;`. **`infer` por defecto es `true`.**

5. **Normalización de IDs de entidad y mapeo camelCase→snake_case** (`memory/index.ts:737-744`). `validateAndTrimEntityId` recorta/valida cada uno (líneas 737-739); luego el mismo valor se escribe **a la vez** en `filters` y en `metadata` (742-744):

   ```ts
   if (userId) filters.user_id = metadata.user_id = userId;
   if (agentId) filters.agent_id = metadata.agent_id = agentId;
   if (runId) filters.run_id = metadata.run_id = runId;
   ```

6. **Normalización de `expirationDate` al metadata** (`memory/index.ts:746-749`):

   ```ts
   if (config.expirationDate != null) {
     metadata.expiration_date = normalizeExpirationDate(config.expirationDate);
   }
   ```

   **[para construir encima]** La clave de payload es `expiration_date` (snake_case), y se guarda dentro de `metadata`, por lo que se propaga a todas las memorias creadas en esa llamada y round-trips vía `get()`. `normalizeExpirationDate` (`utils/expiration.ts:22`) es deliberadamente más estricta que `new Date()`. `EXPIRATION_DATE_PATTERN` está definida en `utils/expiration.ts:8` como `/^(\d{4})-(\d{2})-(\d{2})$/`:

   ```ts
   export function normalizeExpirationDate(value: string): string {
     const match = EXPIRATION_DATE_PATTERN.exec(value);
     if (match) {
       const [, year, month, day] = match;
       const parsed = new Date(`${value}T00:00:00Z`);
       if (
         !Number.isNaN(parsed.getTime()) &&
         parsed.getUTCFullYear() === Number(year) &&
         parsed.getUTCMonth() === Number(month) - 1 &&
         parsed.getUTCDate() === Number(day)
       ) {
         return value;
       }
     }
     throw new Error("expirationDate must be a valid date in YYYY-MM-DD format.");
   }
   ```

   Exige formato `YYYY-MM-DD` literal y valida round-trip en UTC (rechaza `2099-02-30`, `12/31/2099`, `2099`). **[para construir encima]** un `expirationDate` mal formado **LANZA** dentro de `add()`. La expiración es solo de lectura: `add()` guarda `expiration_date` pero **no** filtra nada al escribir; el filtrado ocurre después en `getAll()`/`search()` vía `payloadIsExpired` (`utils/expiration.ts:40`, que normaliza el valor almacenado y compara lexicográficamente `expiration_date < todayUtc()`, con `todayUtc()` = `new Date().toISOString().slice(0, 10)`), salvo que se pase `showExpired`.

7. **Al menos un scope es obligatorio** (`memory/index.ts:751-755`): si no hay `filters.user_id` ni `agent_id` ni `run_id`, lanza `"One of the filters: userId, agentId or runId is required!"`.

8. Normalización de `messages` a array (`memory/index.ts:757-759`): un string se envuelve como `[{ role: "user", content: messages }]`. Luego `parse_vision_messages(parsedMessages)` (`memory/index.ts:761`).

9. Se invoca `addToVectorStore(final_parsedMessages, metadata, filters, infer)` (`memory/index.ts:764-769`), se disparan los avisos (temporal / scale-threshold / first-run, `memory/index.ts:771-790`) y se retorna (`792-794`):

   ```ts
   return {
     results: vectorStoreResult,
   };
   ```

   **[para construir encima]** el shape de retorno es `SearchResult` = `{ results: MemoryItem[] }`, y cada `MemoryItem` trae `{ id, memory, metadata: { event: "ADD" } }`. Ese `metadata.event` del retorno **no** es el payload almacenado (ver más abajo); es un marcador del resultado.

### `infer: false` — inserción literal, sin LLM

Ruta corta en `addToVectorStore` (`memory/index.ts:803-821`). Cada mensaje se convierte en una memoria **verbatim**, saltando solo los de `role === "system"`:

```ts
if (!infer) {
  const returnedMemories: MemoryItem[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }
    const memoryId = await this.createMemory(
      message.content as string,
      {},
      metadata,
    );
    returnedMemories.push({
      id: memoryId,
      memory: message.content as string,
      metadata: { event: "ADD" },
    });
  }
  return returnedMemories;
}
```

**[para construir encima]** en `infer:false` **NO hay**: llamada a LLM, retrieval de existentes, dedup por hash, ni entity linking. Cada mensaje no-system se persiste tal cual. Costo: 1 embedding por mensaje (dentro de `createMemory`), 0 LLM.

`createMemory` (`memory/index.ts:1890`) es el insertor de una sola memoria usado por esta ruta. Su segundo parámetro es un diccionario `existingEmbeddings` que aquí se pasa vacío (`{}`), por lo que siempre calcula el embedding con `embedder.embed(data, "add")`:

```ts
const memoryMetadata = {
  ...metadata,
  data,
  hash: createHash("md5").update(data).digest("hex"),
  textLemmatized: lemmatizeForBm25(data),
  createdAt: new Date().toISOString(),
};

await this.vectorStore.insert([embedding], [memoryId], [memoryMetadata]);
await this.db.addHistory(
  memoryId,
  null,
  data,
  "ADD",
  memoryMetadata.createdAt,
);
```

Claves de payload que escribe: `data`, `hash` (md5 del texto), `textLemmatized`, `createdAt`, más lo heredado de `metadata` (incluye `user_id`/`agent_id`/`run_id`/`expiration_date`). **[para construir encima]** a diferencia de la ruta batch, `createMemory` **no** escribe `updatedAt` ni hace dedup por hash — inserta siempre. La historia se registra como `action: "ADD"` con `previousValue = null`.

### `infer: true` — pipeline V3 aditivo por fases (una sola llamada LLM)

Marcado en fuente como `// === V3 PHASED BATCH PIPELINE ===` (`memory/index.ts:823`).

#### Fase 0 — contexto de sesión (`memory/index.ts:825-845`)

`buildSessionScope(filters)` construye una clave estable ordenando `["agent_id","run_id","user_id"]` (con `.sort()`) y uniendo `clave=valor` con `&` (`memory/index.ts:541-548`). Si el history manager expone `getLastMessages`, trae hasta **10** mensajes previos (try/catch que ignora fallos). Los mensajes a extraer se serializan preservando el rol, una línea por mensaje:

```ts
const parsedMessages = messages
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n");
```

El rol se conserva a propósito para que el `attributed_to` de salida tenga hablante; sin él las frases del assistant se atribuirían al user.

#### Fase 1 — retrieval de existentes + mapeo UUID→entero (anti-alucinación) (`memory/index.ts:847-865`)

Un embedding de la query (`embedder.embed(parsedMessages, "search")`) y un `vectorStore.search(queryEmbedding, 10, filters)` traen hasta **10** memorias existentes relevantes. Se reetiquetan con índices enteros como string para que el LLM nunca vea (ni pueda inventar) UUIDs:

```ts
const existingMemories: Array<{ id: string; text: string }> = [];
const uuidMapping: Record<string, string> = {};
for (let idx = 0; idx < existingResults.length; idx++) {
  const mem = existingResults[idx];
  uuidMapping[String(idx)] = mem.id;
  existingMemories.push({
    id: String(idx),
    text: mem.payload?.data ?? "",
  });
}
```

`uuidMapping` reconstruiría el UUID real desde el índice. **[para construir encima]** en esta versión el `uuidMapping` se construye pero no se vuelve a usar más adelante en el método, y los `linked_memory_ids` que emite el LLM **no se persisten** (ver Fases 4-5); el linking real de memorias se hace por entidades, no por estos ids.

#### Fase 2 — UN solo LLM call aditivo (`memory/index.ts:867-893`)

El system prompt es `ADDITIVE_EXTRACTION_PROMPT` (`prompts/index.ts:282`), cuyo ROL declara literalmente *"Your sole operation is ADD"* y *"Use these ONLY for deduplication and linking — do NOT extract new memories from Existing Memories"*. Si el scope es solo de agente (`!!filters.agent_id && !filters.user_id`), se le concatena `AGENT_CONTEXT_SUFFIX` (`prompts/index.ts:759`), que reencuadra las memorias desde la perspectiva del agente (*"Frame memories from the agent's perspective"*).

```ts
const isAgentScoped = !!filters.agent_id && !filters.user_id;
let systemPrompt = ADDITIVE_EXTRACTION_PROMPT;
if (isAgentScoped) {
  systemPrompt += AGENT_CONTEXT_SUFFIX;
}

const userPrompt = generateAdditiveExtractionPrompt({
  existingMemories,
  newMessages: parsedMessages,
  lastKMessages: lastMessages,
  customInstructions: this.customInstructions,
});

let response: string;
try {
  response = (await this.llm.generateResponse(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { type: "json_object" },
  )) as string;
} catch (e) {
  console.error("LLM extraction failed:", e);
  throw new LLMError(`LLM extraction failed: ${e}`, { cause: e });
}
```

**[para construir encima]** hay exactamente **1** llamada LLM por `add()` en modo infer, en modo `json_object`. Si el proveedor LLM falla, se **LANZA** `LLMError` (`memory/index.ts:83-92`, con `cause`) y `add()` no inserta nada. El `userPrompt` lo arma `generateAdditiveExtractionPrompt` (`prompts/index.ts:822`), que ensambla en este orden las secciones: `## Summary` (vacía), `## Last k Messages`, `## Recently Extracted Memories\n[]` (vacía), `## Existing Memories` (JSON con ids enteros vía `JSON.stringify`), `## New Messages`, `## Observation Date`, `## Current Date` (por defecto `new Date().toISOString().split("T")[0]`; `observationDate` cae por defecto a `currentDate`), `## Custom Instructions` (solo si existe) y, al final, `# Output:`.

El parseo (`memory/index.ts:895-918`) pasa por `extractJson`, valida contra `AdditiveExtractionSchema` (`prompts/index.ts:775`) y, si falla, reintenta con un `extractJson` del texto ya limpiado (`JSON.parse(fallbackJson)?.memory ?? []`); cualquier error deja `extractedMemories = []`. El schema:

```ts
export const AdditiveExtractionSchema = z.object({
  memory: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      attributed_to: z.enum(["user", "assistant"]).optional(),
      linked_memory_ids: z.array(z.string()).optional(),
    }),
  ),
});
```

Si `extractedMemories.length === 0` (`memory/index.ts:920-934`): se persisten los mensajes crudos vía `db.saveMessages` (best-effort) y **se retorna `[]`** — cero memorias creadas, sin error.

#### Fase 3 — embed batch de los textos extraídos (`memory/index.ts:936-955`)

Se embeben en un solo `embedder.embedBatch(memTexts, "add")` los textos no vacíos, construyendo `embedMap[text] = vector`. Fallback: embed individual por texto, avisando `console.warn` si alguno falla.

#### Fases 4-5 — procesado CPU + dedup por hash md5 (`memory/index.ts:957-1022`)

Se juntan los `hash` de las memorias existentes recuperadas en Fase 1 (`existingHashes`). Por cada memoria extraída: se exige que su `text` tenga embedding en `embedMap`; se calcula `memHash = md5(text)`; si ese hash ya existe (en las memorias previas **o** entre las de este batch vía `seenHashes`) se **omite** (dedup):

```ts
const memHash = createHash("md5").update(text).digest("hex");
if (existingHashes.has(memHash) || seenHashes.has(memHash)) {
  continue;
}
seenHashes.add(memHash);

const textLemmatized = lemmatizeForBm25(text);
const memoryId = uuidv4();
const now = new Date().toISOString();

const memPayload: Record<string, any> = {
  ...metadata,
  data: text,
  textLemmatized,
  hash: memHash,
  createdAt: now,
  updatedAt: now,
};
if (mem.attributed_to) {
  memPayload.attributedTo = mem.attributed_to;
}
if (filters.user_id) memPayload.user_id = filters.user_id;
if (filters.agent_id) memPayload.agent_id = filters.agent_id;
if (filters.run_id) memPayload.run_id = filters.run_id;
```

**[para construir encima]** claves de payload almacenadas por memoria: `data` (el texto), `textLemmatized` (para BM25), `hash` (md5 del texto — clave de dedup), `createdAt`, `updatedAt` (ambos = `now`; a diferencia de `createMemory`, aquí sí hay `updatedAt` desde el inicio), `attributedTo` (solo si el LLM dio `attributed_to` ∈ `{"user","assistant"}`), `user_id`/`agent_id`/`run_id`, más todo lo heredado de `metadata` (incluye `expiration_date`). **Lo que NO se persiste:** el `linked_memory_ids` del LLM no entra en `memPayload`; tampoco el `id` entero del LLM. Si tras el dedup no queda ningún record (`memory/index.ts:1009-1022`), se hace `saveMessages` y se retorna `[]`.

#### Fase 6 — insert batch + historia batch (`memory/index.ts:1024-1090`)

Un solo `vectorStore.insert(allVectors, allIds, allPayloads)`; si falla, fallback insertando uno por uno (log de error, sin lanzar). La historia se escribe en batch (`db.batchAddHistory` o `addHistory` uno a uno) siempre con `action: "ADD"` y `previousValue: null`:

```ts
const historyRecords = records.map((r) => ({
  memoryId: r.memoryId,
  previousValue: null as string | null,
  newValue: r.text as string | null,
  action: "ADD",
  createdAt: r.payload.createdAt as string | undefined,
  updatedAt: undefined as string | undefined,
  isDeleted: 0,
}));
```

**[para construir encima]** el evento de historia es **siempre `ADD`**, nunca UPDATE/DELETE/NOOP. Un fallo del vector store aquí **no** lanza — degrada a insert individual y loguea.

#### Fase 7 — entity linking batch (`memory/index.ts:1092-1226`)

Todo envuelto en un `try/catch` que solo hace `console.warn` — el linking es best-effort y **nunca** rompe el `add()`. Flujo: `extractEntitiesBatch(allTexts)` extrae entidades `{ type, text }` por memoria; se deduplican globalmente por `key = entity.text.trim().toLowerCase()` acumulando los `memoryIds` (7a); un solo `embedBatch` de las entidades únicas (7b, con fallback individual); se obtienen `exactMatches` por texto (`_existingEntitiesByText`) y, solo si no hay match exacto, un `entityStore.search(entityVec, 1, filters)` por entidad (7c). Se considera match semántico si `score >= 0.95`:

```ts
const semanticMatch =
  matches.length > 0 && (matches[0].score ?? 0) >= 0.95
    ? matches[0]
    : undefined;
const match = exactMatch ?? semanticMatch;
```

Si hay match, se fusionan los `linkedMemoryIds` en un `Set` ordenado (`Array.from(linked).sort()`) y se hace `entityStore.update`; si no, se acumula una entidad nueva `{ data, entityType, linkedMemoryIds, user_id/agent_id/run_id }` para un `entityStore.insert` batch (7e). **[para construir encima]** el entity store es una colección de vectores **separada** de las memorias; sus payloads usan `linkedMemoryIds` (array ordenado de UUIDs de memoria). Costo adicional: 1 `embedBatch` de entidades + hasta N `entityStore.search` (uno por entidad única sin match exacto).

#### Fase 8 — persistir mensajes + retorno (`memory/index.ts:1228-1245`)

`db.saveMessages` (best-effort) y retorno de un `MemoryItem` por record insertado:

```ts
return records.map((r) => ({
  id: r.memoryId,
  memory: r.text,
  metadata: { event: "ADD" },
}));
```

### Resumen de comportamiento observable / lo que `add()` NO hace

- **Evento siempre `ADD`.** No existe camino a UPDATE, DELETE ni NOOP dentro de `add()`/`addToVectorStore`/`createMemory`; el prompt mismo restringe la operación a ADD. Reconciliación/edición vive en `update()` (`memory/index.ts:1633`) y `delete()`, fuera de este pipeline. (Nota: `memory/index.ts:1890` es `createMemory` y `memory/index.ts:1919` es el privado `updateMemory`, no el público `update()`.)
- **`add({ timestamp })` LANZA** (feature temporal Platform-only, `memory/index.ts:687-695`).
- **Puntos que lanzan:** `messages` inválido; ningún scope (`user_id`/`agent_id`/`run_id`); `expirationDate` con formato inválido; fallo del LLM (`LLMError`).
- **Puntos que NO lanzan (degradan/loguean):** fallo de `vectorStore.insert` (fallback uno a uno), fallo de entity linking (`warn`), fallo de `getLastMessages`/`saveMessages`/`batchAddHistory` (swallow).
- **Retornos vacíos `[]` sin error:** cuando el LLM no extrae nada, o cuando todo se deduplica por hash.
- **Dedup** solo en `infer:true`, por `md5(text)` contra existentes recuperados y dentro del batch. En `infer:false` no hay dedup.
- **`expiration_date`** se guarda pero no filtra en escritura; el `expiration_date` normalizado se hereda por **todas** las memorias del batch (vive en `metadata`).
- **Costo por `add()` con `infer:true`:** 1 embed de query + 1 LLM call + 1 embedBatch de textos + 1 embedBatch de entidades + hasta N búsquedas de entidad. Con `infer:false`: 1 embed por mensaje, 0 LLM.

Rutas citadas relativas a `src/oss/src`.

## 3. Pipeline de search() — denso + BM25 + entity-boost + reranker

Todo lo que sigue proviene de tres archivos reales del paquete instalado (`mem0ai/oss` v3.1.0), rutas relativas a `src/oss/src`:

- `memory/index.ts` — método `search()` en `memory/index.ts:1300`.
- `utils/scoring.ts` — `getBm25Params`, `normalizeBm25`, `scoreAndRank`, `ENTITY_BOOST_WEIGHT`.
- `utils/lemmatization.ts` — `lemmatizeForBm25`, `STOP_WORDS`, stemming.

Apoyos verificados en el mismo extract: `utils/expiration.ts` (`payloadIsExpired`), `vector_stores/qdrant.ts:284` (`keywordSearch` devuelve `null`), `utils/entity_extraction.ts` (`extractEntities`, heurística sin LLM), y los rerankers concretos en `rerankers/*.ts` (`cohere.ts`, `cross_encoder.ts`, `llm.ts`, `zeroentropy.ts`), cableados por `RerankerFactory` en `utils/factory.ts:211`.

Firma (`memory/index.ts:1300`):

```ts
async search(
  query: string,
  config: SearchMemoryOptions,
): Promise<SearchResult> {
```

### Guardas y validación previas a los pasos

**`referenceDate` SIEMPRE lanza** (`memory/index.ts:1304`). Cualquier valor `!== undefined` aborta antes de tocar el vector store — el razonamiento temporal no existe en esta versión:

```ts
if (config?.referenceDate !== undefined) {
  await this._getNoticeTelemetryId();
  throw new Error(
    await getTemporalFeatureErrorMessage(this, {
      triggerFunction: "search",
      triggerParameter: "referenceDate",
    }),
  );
}
```

Luego, en orden (`memory/index.ts:1319`-`1389`):

1. `rejectTopLevelEntityParams(config as Record<string, any>, "search")` — los IDs de entidad deben ir dentro de `filters`, no en el top level.
2. `validateSearchParams(config.threshold, config.topK)`.
3. **Normalización de filtros** (`:1330`-`1342`): valida/recorta `user_id`, `agent_id`, `run_id` con `validateAndTrimEntityId`; **descarta las claves cuyo valor quede `undefined`** (`.filter(([, v]) => v !== undefined)`). El comentario del código documenta por qué (**[para construir encima]** fallos concretos si se dejaran pasar): "*Qdrant rejects the malformed match, pgvector binds NULL, Redis emits a literal 'undefined' string in TAG filters*".
4. `_ensureInitialized()` y luego defaults aplicados por destructuring (`memory/index.ts:1345`):

```ts
const {
  topK = 20,
  threshold = 0.1,
  explain = false,
  showExpired = false,
} = config;
```

5. Operadores avanzados de metadata (`_hasAdvancedOperators` / `_processMetadataFilters`, `:1361`-`1377`) — reprocesa claves `AND`/`OR`/`NOT` si están presentes.
6. **Exige al menos un ID de entidad** (`memory/index.ts:1380`). Sin `user_id`, `agent_id` ni `run_id`, lanza `"filters must contain at least one of: user_id, agent_id, run_id."` (el mensaje real añade `"Example: filters: { user_id: 'u1' }"`).

**[para construir encima]** No hay ninguna llamada a LLM en la ruta principal de `search()`. El costo obligatorio es 1 embedding (la query). Todo lo demás es aritmética + consultas al vector store. El único LLM posible es el reranker `llm_reranker` opcional (Step 10).

### Step 1 — Lemmatización y extracción de entidades de la query

`memory/index.ts:1393`:

```ts
// Step 1: Preprocess query
const queryLemmatized = lemmatizeForBm25(query);
const queryEntities = extractEntities(query);
```

`lemmatizeForBm25` (`utils/lemmatization.ts:246`) es puramente local y determinista:

```ts
export function lemmatizeForBm25(text: string): string {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9]+/g);
  if (!words) {
    return text.toLowerCase();
  }

  const stemmer = getPorterStemmer();
  const stemFn = stemmer
    ? (w: string) => stemmer.stem(w).toLowerCase()
    : simpleStem;

  const tokens: string[] = [];

  for (const word of words) {
    if (STOP_WORDS.has(word)) {
      continue;
    }

    const stemmed = stemFn(word);
    if (stemmed && /^[a-z0-9]+$/.test(stemmed)) {
      tokens.push(stemmed);
    }

    // Also add original if it ends in -ing and differs from stem.
    if (word.endsWith("ing") && word !== stemmed && /^[a-z0-9]+$/.test(word)) {
      tokens.push(word);
    }
  }

  return tokens.join(" ");
}
```

Comportamiento observable:
- Minúsculas → tokeniza sólo `[a-z0-9]+` (descarta puntuación, acentos no-ASCII, etc.).
- Si no hay ningún match alfanumérico devuelve `text.toLowerCase()` tal cual.
- Elimina stop words de una lista fija de ~150 términos ingleses (`STOP_WORDS`, `utils/lemmatization.ts:14`-`166`, "*based on NLTK stop word list*").
- Stemming: intenta el `PorterStemmer` del paquete `natural` (`getPorterStemmer`, `:174`); si `require("natural")` falla, cae a `simpleStem` (`:193`), un stripper de sufijos casero (`ies`→`i`, `sses`→`ss`, `ness`, `ment`, `ation`→`e`, `ting`→`t`, `ing`, `ed`, `ly`, `er`, `est`, plural `s`…, todos con guardas de longitud mínima). El resultado (`_porterStemmer`) se cachea a nivel de módulo tras el primer intento.
- Para palabras terminadas en `-ing` cuyo stem difiere, **conserva ambas formas** (stem + original) — mitiga la ambigüedad sustantivo/verbo ("meeting"/"meet").

**[para construir encima]** La lemmatización es específica del inglés. Contenido en español pasa por stop-words y stemming inglés (ej.: "reunión" → sin acento no matchea, "corriendo" no se stemmea). Esto sólo afecta a BM25, no al canal denso.

`extractEntities` (`utils/entity_extraction.ts:725`) es **heurística, sin LLM ni embeddings** (compone `extractQuoted`, `extractProper`, `extractIdentifiers`, y `extractCompoundsWithNlp` **o** `extractCompoundsRegex` según haya o no `nlp` (compromise) cargado, más dedup/cleanup con `cleanEntityText`; verificado: no invoca `llm` ni `embed`). Devuelve `ExtractedEntity[]`, donde `ExtractedEntity = { type: "PROPER" | "QUOTED" | "TOPIC" | "IDENTIFIER"; text: string }` (`utils/entity_extraction.ts:327`).

### Step 2 — Embed de la query (canal denso)

`memory/index.ts:1397`:

```ts
// Step 2: Embed query
const queryEmbedding = await this.embedder.embed(query, "search");
```

**[para construir encima]** Único costo de embedding obligatorio del pipeline. Se embebe la **query cruda** (no la lemmatizada), con acción `"search"`.

### Step 3 — Búsqueda semántica con over-fetch

`memory/index.ts:1400`:

```ts
// Step 3: Semantic search (over-fetch for scoring pool)
const internalLimit = Math.max(topK * 4, 60);
const semanticResults = await this.vectorStore.search(
  queryEmbedding,
  internalLimit,
  effectiveFilters,
);
```

Se sobre-recupera para tener pool de fusión: `internalLimit = max(topK*4, 60)`. Con `topK=20` por defecto → **80 candidatos**. Este `internalLimit` también gobierna el keyword search (Step 4). El recorte a `topK` ocurre recién en `scoreAndRank` (Step 8).

### Step 4 — Keyword search CONDICIONAL (null en Qdrant)

`memory/index.ts:1408`:

```ts
// Step 4: Keyword search (if store supports it)
let keywordResults: Array<{
  id: string;
  score?: number;
  payload: Record<string, any>;
}> | null = null;
if (typeof this.vectorStore.keywordSearch === "function") {
  try {
    keywordResults =
      (await this.vectorStore.keywordSearch(
        queryLemmatized,
        internalLimit,
        effectiveFilters,
      )) ?? null;
  } catch {
    keywordResults = null;
  }
}
```

- El método **no** existe en todos los stores: la guarda `typeof this.vectorStore.keywordSearch === "function"` importa porque **`elasticsearch.ts` no declara `keywordSearch` en absoluto**; 24 de los 25 stores del extract sí lo declaran.
- De los que lo declaran, **muchos son no-ops**: devuelven `null` incondicionalmente igual que Qdrant (`vector_stores/qdrant.ts:284`):

```ts
async keywordSearch(): Promise<null> {
  return null;
}
```

Stores no-op verificados (declaran `keywordSearch(): Promise<null>` → `return null`): `qdrant`, `redis`, `chroma`, `valkey`, `supabase`, `cassandra`, `langchain`, `neptune_analytics`, `s3_vectors`, `turbopuffer`, `vectorize`.

Stores con implementación real de keyword (firma `keywordSearch(query, topK, filters)`): `pgvector`, `milvus`, `mongodb`, `opensearch`, `weaviate`, `pinecone`, `upstash_vector`, `azure_ai_search`, `azure_mysql`, `baidu`, `databricks`, `vertex_ai_vector_search`, y el store `memory` (in-memory).

- Cuando `keywordSearch` devuelve `null` (Qdrant y demás no-ops) o **lanza** (cualquier error → `catch` silencioso), `keywordResults` queda `null` y el BM25 se salta por completo.

**[para construir encima] Consecuencia central: con Qdrant, `search()` es denso + entity-boost, SIN BM25.** El fallback a keyword es silencioso: no hay warning ni telemetría cuando el store no aporta keyword. Sólo los stores con implementación real (lista arriba — **redis y chroma NO están entre ellos**) alimentan BM25; Qdrant no.

### Step 5 — Normalización de scores BM25

`memory/index.ts:1427`:

```ts
// Step 5: Compute BM25 scores from keyword results
const bm25Scores: Record<string, number> = {};
if (keywordResults) {
  const [midpoint, steepness] = getBm25Params(query, queryLemmatized);
  for (const mem of keywordResults) {
    const memId = String(mem.id);
    const rawScore = mem.score ?? 0;
    if (rawScore > 0) {
      bm25Scores[memId] = normalizeBm25(rawScore, midpoint, steepness);
    }
  }
}
```

Sólo se registran entradas con `rawScore > 0`. En Qdrant `bm25Scores` queda `{}` (vacío).

Parámetros adaptativos por longitud de query (`utils/scoring.ts:23`):

```ts
export function getBm25Params(
  query: string,
  lemmatized?: string,
): [number, number] {
  const text = lemmatized ?? query;
  const numTerms = text.trim().split(/\s+/).filter(Boolean).length || 1;

  if (numTerms <= 3) {
    return [5.0, 0.7];
  } else if (numTerms <= 6) {
    return [7.0, 0.6];
  } else if (numTerms <= 9) {
    return [9.0, 0.5];
  } else if (numTerms <= 15) {
    return [10.0, 0.5];
  } else {
    return [12.0, 0.5];
  }
}
```

Normalización sigmoide a `[0,1]` (`utils/scoring.ts:51`):

```ts
export function normalizeBm25(
  rawScore: number,
  midpoint: number,
  steepness: number,
): number {
  return 1.0 / (1.0 + Math.exp(-steepness * (rawScore - midpoint)));
}
```

`numTerms` se cuenta sobre la **query lemmatizada** (`getBm25Params(query, queryLemmatized)` → `text = lemmatized ?? query`), no la cruda.

### Step 6 — Entity boost (entity store, umbral, peso por numLinked)

`memory/index.ts:1440`-`1518`. Sólo se ejecuta si `queryEntities.length > 0`; todo el bloque va envuelto en `try/catch` que ante error hace `console.warn("Entity boost computation failed:", e)` y deja `entityBoosts` vacío.

Deduplicación **máximo 8 entidades** (`:1444`):

```ts
const seen = new Set<string>();
const deduped: Array<{ type: string; text: string }> = [];
for (const entity of queryEntities.slice(0, 8)) {
  const key = entity.text.trim().toLowerCase();
  if (key && !seen.has(key)) {
    seen.add(key);
    deduped.push(entity);
  }
}
```

Luego embebe los textos de entidad y consulta el **entity store** (`:1456`-`1477`):

```ts
const entityStore = await this.getEntityStore();
const entitySearchFilters: Record<string, any> = {};
for (const k of ["user_id", "agent_id", "run_id"] as const) {
  if (effectiveFilters[k]) entitySearchFilters[k] = effectiveFilters[k];
}
const entityTexts = deduped.map((e) => e.text);
const embeddings = await this.embedder.embedBatch(entityTexts, "search");

if (embeddings.length !== entityTexts.length) {
  console.warn(
    `embedBatch returned ${embeddings.length} vectors for ${entityTexts.length} texts — skipping entity boost`,
  );
} else {
  const searchResults = await Promise.allSettled(
    deduped.map((_, i) =>
      entityStore.search(embeddings[i], 500, entitySearchFilters),
    ),
  );
```

Acumulación del boost (`:1479`-`1512`):

```ts
for (const result of searchResults) {
  if (result.status === "rejected") {
    console.warn("Entity boost search failed for one entity:", result.reason);
    continue;
  }

  for (const match of result.value) {
    const similarity = match.score ?? 0;
    if (similarity < 0.5) continue;

    const payload = match.payload || {};
    const linkedMemoryIds = payload.linkedMemoryIds ?? [];
    if (!Array.isArray(linkedMemoryIds)) continue;

    const numLinked = Math.max(linkedMemoryIds.length, 1);
    const memoryCountWeight =
      1.0 / (1.0 + 0.001 * (numLinked - 1) ** 2);
    const boost =
      similarity * ENTITY_BOOST_WEIGHT * memoryCountWeight;

    for (const memoryId of linkedMemoryIds) {
      if (memoryId) {
        const memKey = String(memoryId);
        entityBoosts[memKey] = Math.max(
          entityBoosts[memKey] ?? 0,
          boost,
        );
      }
    }
  }
}
```

Detalles concretos:
- **Costo de embeddings extra**: 1 `embedBatch` (hasta 8 textos) cuando la query tiene entidades. Si `embedBatch` devuelve un conteo distinto al de textos, se salta el boost con warning.
- Por entidad, consulta el entity store con **límite 500** (`entityStore.search(embeddings[i], 500, ...)`), filtrado por los IDs de entidad presentes.
- **Umbral de similitud de entidad: `< 0.5` se descarta** (distinto del `threshold` semántico de memorias).
- `ENTITY_BOOST_WEIGHT = 0.5` (`utils/scoring.ts:10`).
- **Peso por nº de memorias vinculadas**: `memoryCountWeight = 1/(1 + 0.001·(numLinked-1)²)` — penaliza suavemente entidades muy conectadas. Con `numLinked=1` → `1.0`; con `numLinked=11` → `1/(1+0.1)=0.909`; con `numLinked=101` → `~0.09`.
- `boost = similarity · 0.5 · memoryCountWeight`.
- Se propaga a cada `memoryId` de `linkedMemoryIds` y se acumula con **`Math.max`** (un memory conserva su mayor boost entre todas las entidades que lo señalan).
- Fallos por entidad individual (Promise rejected) se loguean y no abortan el resto (`Promise.allSettled`).

**[para construir encima] Claves de payload que gobiernan el boost**: en el **entity store**, `match.payload.linkedMemoryIds` (array de IDs de memoria) y `match.score` (similitud). El entity store se mantiene aparte del vector store de memorias (poblado en `add`/`_linkEntitiesForMemory`). El boost sólo puede elevar memorias que YA estén en el pool semántico del Step 3 (los IDs que no aparezcan entre los `candidates` no se rescatan; ver Step 8).

### Step 7 — Filtro de EXPIRACIÓN antes de rankear

`memory/index.ts:1520`:

```ts
// Step 7: Build candidate set from semantic results
const candidates = semanticResults
  .filter((mem) => showExpired || !payloadIsExpired(mem.payload))
  .map((mem) => ({
    id: String(mem.id),
    score: mem.score ?? 0,
    payload: mem.payload || {},
  }));
```

El pool de candidatos se arma **sólo desde `semanticResults`** (canal denso). Se descartan expirados **antes** de rankear, salvo `showExpired: true`.

`payloadIsExpired` (`utils/expiration.ts:40`):

```ts
export function payloadIsExpired(
  payload: Record<string, any> | null | undefined,
) {
  const raw = payload?.expiration_date;
  if (!raw) return false;
  try {
    // YYYY-MM-DD sorts lexicographically the same way it sorts chronologically.
    return normalizeExpirationDate(String(raw)) < todayUtc();
  } catch {
    // Unparseable stored value: treat as non-expiring rather than hiding data.
    return false;
  }
}
```

- Clave de payload: **`expiration_date`** en formato `YYYY-MM-DD`. Ausente/vacío → nunca expira.
- Comparación **lexicográfica** contra `todayUtc()` (`new Date().toISOString().slice(0,10)`, UTC). `normalizeExpirationDate` (`utils/expiration.ts:22`) valida estrictamente `YYYY-MM-DD` (rechaza rollovers de fecha). Expira **estrictamente antes de hoy** (`< today`); una memoria que expira hoy sigue visible.
- Valor almacenado no parseable → se trata como **no expirado** (no oculta datos por un valor corrupto).

**[para construir encima]** El boost de entidad (Step 6) se calcula **antes** del filtro de expiración, pero como `scoreAndRank` sólo itera `candidates` (ya filtrados), un boost hacia una memoria expirada es inofensivo: nunca entra al ranking. El filtro es **puramente denso**: si BM25/entity conocieran una memoria fuera del pool semántico, igual no aparecería (no se re-inyecta).

### Step 8 — Fusión aritmética y ranking (`scoreAndRank`)

`memory/index.ts:1529`:

```ts
// Step 8: Score and rank
const scoredResults = scoreAndRank(
  candidates,
  bm25Scores,
  entityBoosts,
  threshold ?? 0.1,
  topK,
  explain,
);
```

`utils/scoring.ts:99`:

```ts
export function scoreAndRank(
  semanticResults: Array<{ id: string; score: number; payload: Record<string, any> }>,
  bm25Scores: Record<string, number>,
  entityBoosts: Record<string, number>,
  threshold: number,
  topK: number,
  explain: boolean = false,
): ScoredResult[] {
  const hasBm25 = Object.keys(bm25Scores).length > 0;
  const hasEntity = Object.keys(entityBoosts).length > 0;

  let maxPossible = 1.0;
  if (hasBm25) {
    maxPossible += 1.0;
  }
  if (hasEntity) {
    maxPossible += ENTITY_BOOST_WEIGHT;
  }

  const scored: ScoredResult[] = [];

  for (const result of semanticResults) {
    const memId = result.id;
    if (memId == null) {
      continue;
    }

    const semanticScore = result.score ?? 0.0;
    if (semanticScore < threshold) {
      continue;
    }

    const memIdStr = String(memId);
    const bm25Score = bm25Scores[memIdStr] ?? 0.0;
    const entityBoost = entityBoosts[memIdStr] ?? 0.0;

    const rawCombined = semanticScore + bm25Score + entityBoost;
    const combined = Math.min(rawCombined / maxPossible, 1.0);

    const entry: ScoredResult = {
      id: memIdStr,
      score: combined,
      payload: result.payload,
    };
    if (explain) {
      entry.scoreDetails = {
        semanticScore,
        bm25Score,
        entityBoost,
        rawScore: rawCombined,
        maxPossibleScore: maxPossible,
        finalScore: combined,
        threshold,
      };
    }
    scored.push(entry);
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
```

Reglas exactas de la fusión:
- **El `threshold` (default `0.1`) filtra SÓLO el score semántico**, antes de sumar. Un candidato con `semanticScore < threshold` se descarta **aunque** BM25/entity lo elevarían. Documentado en el docstring (`utils/scoring.ts:82`): "*Threshold gates the semantic score BEFORE combining*".
- Divisor `maxPossible` adaptativo según señales **presentes globalmente** (no por candidato):
  - Sólo semántico → `1.0`
  - Semántico + BM25 → `2.0`
  - Semántico + BM25 + entity → `2.5`
  - Semántico + entity (sin BM25) → `1.5`
- `combined = min((semantic + bm25 + entity) / maxPossible, 1.0)` — clamp superior a `1.0`.
- Orden descendente por `score`, y `slice(0, topK)`.

**[para construir encima] En Qdrant `hasBm25=false` siempre.** Con entidades presentes → `maxPossible=1.5`; sin entidades → `maxPossible=1.0` (el `score` final ≈ semántico crudo). El `score` devuelto es este `combined` fusionado, no la similitud cruda del vector store. `bm25Scores`/`entityBoosts` se indexan por `String(id)`: un memory con boost pero fuera del pool semántico **no** se agrega (el loop sólo recorre `semanticResults`).

Con `explain: true`, cada resultado adjunta `score_details` (mapeado en Step 9): `{ semanticScore, bm25Score, entityBoost, rawScore, maxPossibleScore, finalScore, threshold }`.

### Step 9 — Formateo de resultados

`memory/index.ts:1539`:

```ts
const excludedKeys = new Set([
  "user_id", "agent_id", "run_id", "hash", "data",
  "createdAt", "updatedAt", "textLemmatized", "attributedTo",
]);

const results = scoredResults
  .filter((scored) => scored.payload?.data)
  .map((scored) => {
    const payload = scored.payload || {};
    return {
      id: scored.id,
      memory: payload.data,
      hash: payload.hash,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      score: scored.score,
      metadata: Object.entries(payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(payload.user_id && { user_id: payload.user_id }),
      ...(payload.agent_id && { agent_id: payload.agent_id }),
      ...(payload.run_id && { run_id: payload.run_id }),
      ...(payload.attributedTo && { attributedTo: payload.attributedTo }),
      ...(scored.scoreDetails && { score_details: scored.scoreDetails }),
    };
  });
```

- **Se descartan candidatos sin `payload.data`** (`.filter(scored => scored.payload?.data)`). Un memory sin texto no aparece aunque haya rankeado.
- `memory` = `payload.data`.
- `metadata` = todo el payload **menos** `excludedKeys`. **[para construir encima]** las claves reservadas del payload de un memory son: `data` (texto), `hash`, `createdAt`, `updatedAt`, `user_id`, `agent_id`, `run_id`, `textLemmatized` (la versión lemmatizada persistida para BM25), `attributedTo`, y `expiration_date` (esta última **no** está en `excludedKeys`, así que **sí** aparece dentro de `metadata`).
- `user_id`/`agent_id`/`run_id`/`attributedTo` se re-promueven al top level sólo si son truthy.
- `score_details` sólo si `explain: true`.

### Step 10 — Reranker opt-in

`memory/index.ts:1574`:

```ts
// Step 10: Optionally re-rank with the configured reranker. Opt-in per
// search via `rerank: true`; a no-op when no reranker is configured.
const invokeReranker = Boolean(
  config.rerank && this.reranker && results.length > 0,
);
let finalResults = results;
if (invokeReranker) {
  try {
    const ranked = await this.reranker!.rerank(
      query,
      results.map((r) => r.memory),
      topK,
    );
    finalResults = ranked.map((r) => ({
      ...results[r.index],
      rerankScore: r.rerankScore,
    }));
  } catch (e) {
    console.warn(`Reranking failed, using original results: ${e}`);
  }
}

const result = {
  results: finalResults,
};
```

Condiciones y comportamiento:
- Se ejecuta **sólo si** las tres cosas son verdaderas: `config.rerank` (opt-in por llamada), `this.reranker` (configurado en el constructor vía `config.reranker` → `RerankerFactory.create`, `memory/index.ts:206`-`209`; la fábrica vive en `utils/factory.ts:211`), y `results.length > 0`. Si falta cualquiera, **no-op** y se devuelven los resultados del Step 9 sin tocar.
- El reranker recibe `(query, results.map(r => r.memory), topK)` — la **query cruda** y sólo el **texto** de cada resultado ya rankeado por la fusión; luego se reordena mapeando `results[r.index]`.
- Cada resultado reordenado **agrega `rerankScore` junto a (no en lugar de) `score`**. `score` (fusión aritmética del Step 8) se conserva intacto; `rerankScore` es un campo adicional. El campo se documenta en la interfaz `MemoryItem` (los elementos de `SearchResult.results`) como "*Relevance score added by the reranker, alongside (not replacing) `score`*" (`types/index.ts:158`; `SearchResult = { results: MemoryItem[] }` en `types/index.ts:171`).
- **Si el reranker lanza, se captura**: `console.warn` y se mantienen los `results` originales (fallback graceful, sin `rerankScore`).
- Providers reales que acepta `RerankerFactory.create` (por string, `utils/factory.ts:213`): `"cohere"`, `"zero_entropy"`, `"sentence_transformer"`, `"huggingface"`, `"llm_reranker"`. Cualquier otro lanza `"Unsupported reranker provider"`. Nota: `sentence_transformer` y `huggingface` comparten la implementación `CrossEncoderReranker` (`rerankers/cross_encoder.ts`, con modelos por defecto `Xenova/ms-marco-MiniLM-L-6-v2` y `Xenova/bge-reranker-base` respectivamente); `cohere` → `CohereReranker`, `zero_entropy` → `ZeroEntropyReranker`, `llm_reranker` → `LLMReranker`. Todos exponen `rerank(query: string, documents: string[], topK?: number): Promise<RerankResult[]>` devolviendo elementos `{ index, rerankScore }` (verificado en `rerankers/cross_encoder.ts:52`-`57` para la firma y `:75`-`81` para el shape del resultado). El tipo `Reranker`/`RerankResult` se importa de `../rerankers/base` (ese archivo **no** está en este extract parcial; el shape se confirma desde las implementaciones concretas).

**[para construir encima] Costos del reranker según provider**: `sentence_transformer`/`huggingface` (`CrossEncoderReranker`) corren un modelo local (transformers.js) con normalización sigmoide de logits controlada por `normalize` (default `true`); `llm_reranker` (`LLMReranker`) es la **única** vía que gasta tokens de LLM en `search`, con `provider` default `"openai"`, `model` default `"gpt-4o-mini"`, `temperature` default `0.0` y `maxTokens` default `100` (`types/index.ts:111`,`113` documentan los defaults de `temperature`/`maxTokens`; `utils/factory.ts` los aplica en `buildLLMRerankerLLM`); `cohere`/`zero_entropy` llaman a sus APIs externas. El reranker es un **paso adicional opcional sobre el pool ya fusionado y recortado a `topK`** — no re-consulta el vector store ni re-embebe la query; reordena strings.

### Qué NO hace `search()` — resumen para quien construye encima

- **No llama a un LLM en la ruta principal** (a diferencia de `add()`, no hay extracción de hechos). La única llamada LLM posible es `llm_reranker` en Step 10.
- **No soporta `referenceDate`**: cualquier valor lanza (`memory/index.ts:1304`). No hay razonamiento temporal.
- **BM25 es no-op en Qdrant** (`qdrant.ts:284` → `null`) y en todos los demás stores no-op (`redis`, `chroma`, `valkey`, `supabase`, `cassandra`, `langchain`, `neptune_analytics`, `s3_vectors`, `turbopuffer`, `vectorize`); `elasticsearch` ni siquiera declara el método. Con esos stores el pipeline es estrictamente **denso + entity-boost + (reranker opcional)**; `maxPossible` nunca incluye el término BM25.
- **El fallback de keyword es silencioso**: excepciones en `keywordSearch` se tragan (`catch { keywordResults = null }`), sin señal al caller.
- **El `threshold` no gatea el score fusionado**, sólo el semántico previo. Un match puramente léxico/de entidad con baja similitud densa nunca sobrevive.
- **Ni BM25 ni entity-boost rescatan memorias fuera del pool semántico** (`internalLimit = max(topK*4, 60)` candidatos densos): la fusión sólo recorre `candidates` densos ya filtrados por expiración.
- **Descarta resultados sin `payload.data`** en el formateo.
- La lemmatización BM25 asume **inglés** (stop words + Porter/`natural`).
- `explain: true` es puramente informativo (agrega `score_details`), no cambia el ranking.

## 4. Prompts y schemas de extracción

Esta sección documenta el archivo `prompts/index.ts` (rutas relativas a `src/oss/src`), que contiene los prompts y schemas Zod que gobiernan la extracción de memorias en mem0 OSS v3.1.0 (TS). El pipeline "V3" real que corre en `.addToVectorStore()` usa el **prompt aditivo** (`ADDITIVE_EXTRACTION_PROMPT` + `generateAdditiveExtractionPrompt`), no el par legacy fact-retrieval / update-memory. Documento ambos pero marco cuál está vivo.

### Mapa de símbolos y para qué se usa cada uno

| Símbolo | Ubicación | Rol |
|---|---|---|
| `FactRetrievalSchema` | `prompts/index.ts:12` | Schema Zod de salida del path **legacy** (`getFactRetrievalMessages`). Valida `{ facts: string[] }`. |
| `MemoryUpdateSchema` | `prompts/index.ts:20` | Schema Zod del path **legacy** de update (ADD/UPDATE/DELETE/NONE). No se usa en V3. |
| `ADDITIVE_EXTRACTION_PROMPT` | `prompts/index.ts:282` | System prompt del pipeline **V3 vivo**. Solo operación ADD. |
| `AGENT_CONTEXT_SUFFIX` | `prompts/index.ts:759` | Sufijo que se concatena al system prompt cuando el scope es agent-only. |
| `AdditiveExtractionSchema` | `prompts/index.ts:775` | Schema Zod de salida del pipeline V3. Valida `{ memory: [...] }`. |
| `serializeMemories` | `prompts/index.ts:816` | Serializa `existingMemories` a JSON para el user prompt. |
| `formatConversationHistory` | `prompts/index.ts:801` | Formatea `lastKMessages` como `role: content\n`, truncando el content a 300 chars. |
| `generateAdditiveExtractionPrompt` | `prompts/index.ts:822` | Builder del **user prompt** (ensambla secciones con los inputs). |
| `extractJson` | `prompts/index.ts:901` | Extrae el JSON de la respuesta cruda del LLM (usado por el consumidor). |

Consumidor real (verificado): `memory/index.ts:869-889` arma el system + user prompt y hace **una sola** llamada `this.llm.generateResponse(...)`.

---

### `FactRetrievalSchema` (schema legacy de fact-retrieval)

Transcripción textual (`prompts/index.ts:3-17`):

```ts
// Accepts a string directly, or an object with a "fact" or "text" key
// (common malformed shapes from smaller LLMs like llama3.1:8b).
const factItem = z.union([
  z.string(),
  z.object({ fact: z.string() }).transform((o) => o.fact),
  z.object({ text: z.string() }).transform((o) => o.text),
]);

// Define Zod schema for fact retrieval output
export const FactRetrievalSchema = z.object({
  facts: z
    .array(factItem)
    .transform((arr) => arr.filter((s) => s.length > 0))
    .describe("An array of distinct facts extracted from the conversation."),
});
```

Comportamiento observable:
- `factItem` es una **unión tolerante**: acepta `"hecho"`, `{ "fact": "hecho" }` o `{ "text": "hecho" }` y colapsa las dos últimas formas a la string interna vía `.transform`. Es un parche explícito para LLMs pequeños (comentario cita `llama3.1:8b`).
- La `.transform` sobre el array **filtra strings vacías** (`s.length > 0`), así que `{"facts":["", "x"]}` → `["x"]`.
- **[para construir encima]** Este schema pertenece al par legacy `getFactRetrievalMessages` (`prompts/index.ts:45`) + `getUpdateMemoryMessages` (`prompts/index.ts:105`), cuya salida valida `MemoryUpdateSchema` (`prompts/index.ts:20`). El pipeline V3 que corre `.addToVectorStore()` **no** los usa; usa `AdditiveExtractionSchema`. No infieras que este schema define la salida real del `add()` V3.

---

### `ADDITIVE_EXTRACTION_PROMPT` — el prompt aditivo (system prompt vivo)

Es un template string exportado (`prompts/index.ts:282`) portado de `mem0/configs/prompts.py` (comentario `prompts/index.ts:279`). No interpola nada — es texto estático. Su única operación es ADD.

**Rol y fuente de extracción** (`prompts/index.ts:285`, primer párrafo textual, más el inicio del párrafo de `prompts/index.ts:287`):

```text
You are a Memory Extractor — a precise, evidence-bound processor responsible for extracting rich, contextual memories from conversations. Your sole operation is ADD: identify every piece of memorable information and produce self-contained, contextually rich factual statements.

You extract from BOTH user and assistant messages. […]
```

**Attribution correcta** (`prompts/index.ts:301`) — cómo el prompt instruye a poblar `attributed_to`:

```text
Attribute correctly: use "User" for user-stated facts. For assistant-generated content, frame in terms of the user's context (e.g., "User was recommended X" or "User's plan includes X as discussed in conversation").
```

**Instrucción de linking → `linked_memory_ids`** (`prompts/index.ts:326`), textual:

```text
When a new memory is related to an Existing Memory — same topic, overlapping entities, updated/shifted preference, follow-up event, or continuation of a narrative — include the Existing Memory's ID in the new memory's "linked_memory_ids" array. Your ADD output IDs remain sequential ("0", "1", ...) but linked_memory_ids uses the UUIDs from this list.
```

Aquí está el mecanismo de anti-alucinación de IDs: el LLM ve las Existing Memories **remapeadas a índices enteros** (ver más abajo), pero el prompt le dice que en `linked_memory_ids` use "the UUIDs from this list". Hay una tensión: el prompt describe la lista como UUIDs (y la sección `## Existing Memories` en `prompts/index.ts:322` la formatea como `[{"id": "uuid-string", ...}]`), pero el builder real (`generateAdditiveExtractionPrompt` vía `serializeMemories`) recibe IDs enteros `"0","1",...` remapeados en `memory/index.ts:855-865`. Los ejemplos internos del prompt (p.ej. `prompts/index.ts:660`, `prompts/index.ts:667`) sí muestran UUIDs. **[para construir encima]** el modelo recibe IDs enteros pero se le pide "UUIDs"; el mapeo entero→UUID vive en el consumidor (`uuidMapping`, `memory/index.ts:857-865`) — que, como se detalla abajo, queda sin consumir.

**Integrity Rules** relevantes para atribución (`prompts/index.ts:490-502`, extracto abreviado de las viñetas):

```text
- **No Fabrication**: Every detail must trace to the inputs.
- **No Implicit Attribute Inference**: Don't infer gender, age, ethnicity, etc. from names or context.
- **Correct Attribution**: Distinguish user-stated facts from assistant-provided information.
- **No Echo Extraction**: When an assistant message restates ... do NOT extract it again ...
```

**Formato de salida declarado en el prompt** (`prompts/index.ts:731`), transcripción de la estructura y campos:

```text
# OUTPUT FORMAT

Return ONLY valid JSON parsable by json.loads(). No text, reasoning, explanations, or wrappers.

## Structure

{
  "memory": [
    {"id": "0", "text": "First extracted memory", "attributed_to": "user", "linked_memory_ids": ["uuid-of-related-existing-memory"]},
    {"id": "1", "text": "Second extracted memory", "attributed_to": "assistant"}
  ]
}

## Fields

- **id** (string, required): Sequential integers as strings starting at "0".
- **text** (string, required): A contextually rich, self-contained factual statement (15-80 words).
- **attributed_to** (string, required): Who this memory is about. Use "user" for facts stated by or about the user (preferences, plans, personal facts). Use "assistant" for information provided by the assistant (recommendations, confirmations, plans created, information researched).
- **linked_memory_ids** (array of strings, optional): IDs of Existing Memories that this new memory relates to. Use the exact IDs from the Existing Memories list. Omit or pass [] if no existing memories are related.
```

Notas de contrato (según el prompt):
- **`id`**: enteros como string secuenciales desde `"0"`. No son UUIDs; son índices dentro de la respuesta.
- **`text`**: 15-80 palabras (hasta 100 para contenido detail-rich, ver `prompts/index.ts:444`); self-contained, con todos los pronombres reemplazados por nombres o "User" (`prompts/index.ts:442`).
- **`attributed_to`**: `"user"` o `"assistant"`. El prompt lo marca **required** (`prompts/index.ts:748`), pero el schema Zod lo declara **opcional** (ver siguiente sub-sección) — divergencia real prompt vs. schema. Nótese además que el propio prompt es inconsistente: `prompts/index.ts:301` usa `"User"` (mayúscula) mientras `prompts/index.ts:748` pide `"user"`/`"assistant"` (minúscula).
- **`linked_memory_ids`**: opcional; se puede omitir o mandar `[]`.
- Reglas finales bajo `## Rules` (`prompts/index.ts:751-755`): `{"memory": []}` si no hay nada que extraer (`:754`) y "No duplicate IDs. Use double quotes. No trailing commas." (`:755`).

**[para construir encima] Divergencia crítica de comportamiento:** el prompt pide al LLM producir `linked_memory_ids`, y `AdditiveExtractionSchema` lo valida — pero el consumidor **no lo lee** en la ruta de persistencia. En `memory/index.ts:972-1007`, al construir el `memPayload` solo se toman `mem.text` y `mem.attributed_to` (como `attributedTo`); `mem.linked_memory_ids` nunca se referencia, no se escribe en el payload ni en la historia, y el `uuidMapping` que traduciría sus índices enteros a UUIDs (`memory/index.ts:857-865`) es **código muerto** (se construye pero no se consume en ningún lado). Es decir: el campo de linking producido por el LLM no tiene efecto persistente. **Ojo:** esto NO significa que no exista un grafo de memorias enlazadas — sí existe, pero se construye por una vía independiente (la "Phase 7: Batch entity linking", `memory/index.ts:1092`, vía `extractEntitiesBatch` sobre los textos extraídos, que persiste `linkedMemoryIds` en registros de entidad). Ese grafo se deriva de NER, no del `linked_memory_ids` del prompt.

---

### `AGENT_CONTEXT_SUFFIX` — reajuste agent-scoped

Transcripción completa (`prompts/index.ts:759`):

```ts
export const AGENT_CONTEXT_SUFFIX = `

## Entity Context

The primary entity is an AI agent. Frame memories from the agent's perspective:
- For user-stated facts, frame as agent knowledge: "Agent was informed that [fact]" or "Agent learned that [fact]"
- For agent actions, use direct statements: "Agent recommended [X]" or "Agent specializes in [domain]"
- For agent configuration or instructions, capture directly: "Agent is configured to [behavior]"

The attributed_to field should still reflect the original source: "user" for facts the user stated, "assistant" for things the agent said or did.
`;
```

Cuándo se aplica (verificado en `memory/index.ts:868-872`):

```ts
const isAgentScoped = !!filters.agent_id && !filters.user_id;
let systemPrompt = ADDITIVE_EXTRACTION_PROMPT;
if (isAgentScoped) {
  systemPrompt += AGENT_CONTEXT_SUFFIX;
}
```

Comportamiento observable:
- El sufijo se **concatena al final** del system prompt solo cuando `agent_id` está presente **y** `user_id` está ausente. Si hay `user_id` (aunque también haya `agent_id`), NO se aplica.
- Reencuadra el `text` desde la perspectiva del agente ("Agent was informed that…"), pero **preserva** la semántica de `attributed_to` (sigue siendo `"user"`/`"assistant"` según la fuente original).
- **[para construir encima]** el toggle es puramente por presencia de filtros; no hay flag de config. Un `add()` con solo `agentId` produce memorias fraseadas como conocimiento del agente; el mismo `add()` con `userId` + `agentId` produce fraseo user-céntrico.

---

### `AdditiveExtractionSchema` — schema Zod de salida real

Transcripción completa (`prompts/index.ts:775`):

```ts
export const AdditiveExtractionSchema = z.object({
  memory: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      attributed_to: z.enum(["user", "assistant"]).optional(),
      linked_memory_ids: z.array(z.string()).optional(),
    }),
  ),
});
```

Detalles de validación:
- `id` y `text` son **requeridos** (`z.string()` sin `.optional()`). Una entrada sin `text` hace fallar el `.parse()`.
- `attributed_to` es **opcional** y restringido a `enum(["user","assistant"])`. No tiene `.catch()`, así que si el LLM devuelve `"User"` (mayúscula) o cualquier otro valor, el `.parse()` estricto **lanza** → cae al fallback (ver abajo). Esto contradice el prompt, que declara `attributed_to` como required y usa `"User"` (mayúscula) en varios lugares.
- `linked_memory_ids` opcional, `array(string)`.
- **[para construir encima]** el schema no valida ni el rango de palabras (15-80), ni que `id` sea numérico, ni unicidad de IDs. Cualquier string pasa como `id`.

---

### Ensamblado del user prompt: `generateAdditiveExtractionPrompt`

El **user prompt** se construye por secciones concatenadas. Transcripción completa (`prompts/index.ts:822`):

```ts
export function generateAdditiveExtractionPrompt(options: {
  existingMemories?: Array<{ id: string; text: string }>;
  newMessages?: string;
  lastKMessages?: Array<{ role: string; content: string }>;
  customInstructions?: string;
  currentDate?: string;
  observationDate?: string;
}): string {
  const now = new Date().toISOString().split("T")[0];
  const currentDate = options.currentDate ?? now;
  const observationDate = options.observationDate ?? currentDate;

  const sections: string[] = [];

  // Summary — empty for now; callers can extend later
  sections.push("## Summary\n");

  sections.push(
    `## Last k Messages\n${formatConversationHistory(options.lastKMessages)}`,
  );

  // Recently Extracted Memories — empty for now
  sections.push("## Recently Extracted Memories\n[]");

  sections.push(
    `## Existing Memories\n${serializeMemories(options.existingMemories)}`,
  );

  sections.push(`## New Messages\n${options.newMessages ?? "[]"}`);

  sections.push(`## Observation Date\n${observationDate}`);

  sections.push(`## Current Date\n${currentDate}`);

  if (options.customInstructions) {
    sections.push(`## Custom Instructions\n${options.customInstructions}`);
  }

  sections.push("# Output:");

  return sections.join("\n\n");
}
```

El resultado es, en orden, unido por `\n\n`:

1. `## Summary\n` — **siempre vacío** (comentario: "empty for now; callers can extend later"). El system prompt describe cómo usar el Summary, pero el builder nunca lo llena.
2. `## Last k Messages\n<historial formateado>` — vía `formatConversationHistory`.
3. `## Recently Extracted Memories\n[]` — **siempre literal `[]`** (hardcodeado). Aunque el system prompt lo describe como "primary deduplication reference (up to 20)" (`prompts/index.ts:316`), aquí nunca se puebla.
4. `## Existing Memories\n<JSON>` — vía `serializeMemories`.
5. `## New Messages\n<newMessages o "[]">`.
6. `## Observation Date\n<observationDate>`.
7. `## Current Date\n<currentDate>`.
8. `## Custom Instructions\n<...>` — **solo si** `customInstructions` es truthy.
9. `# Output:` — cierre literal que ancla la generación.

**Defaults temporales:** `currentDate ??= hoy` (ISO `YYYY-MM-DD` vía `new Date().toISOString().split("T")[0]`); `observationDate ??= currentDate`. Es decir, si el caller no pasa fechas, **ambas son la fecha de hoy**.

**[para construir encima] Cómo lo llama el consumidor real** (`memory/index.ts:874-879`):

```ts
const userPrompt = generateAdditiveExtractionPrompt({
  existingMemories,
  newMessages: parsedMessages,
  lastKMessages: lastMessages,
  customInstructions: this.customInstructions,
});
```

Consecuencias observables de esta invocación concreta:
- **No pasa `currentDate` ni `observationDate`** → en producción `Observation Date == Current Date == hoy` siempre. La maquinaria del prompt sobre resolver referencias relativas contra Observation Date y NO contra Current Date (`prompts/index.ts:341-348`, y la advertencia de `## Current Date` en `prompts/index.ts:353`: "only Observation Date grounds user and assistant statements") queda **inerte**: no hay ancla histórica; "ayer/last week" se resuelven contra hoy. Los ejemplos del prompt con fechas de observación históricas no reflejan el uso real de esta build.
- `parsedMessages` se arma en `memory/index.ts:843-845` como `messages.map(m => \`${m.role}: ${m.content}\`).join("\n")` — preserva el rol para que `attributed_to` tenga con qué trabajar (comentario `memory/index.ts:839-842`: sin esto los mensajes del assistant se atribuirían al user).
- `existingMemories` viene de una búsqueda vectorial **top-10** sobre el embedding de `parsedMessages`, remapeando cada UUID a un índice string `"0".."9"` (`memory/index.ts:848-865`), con `text: mem.payload?.data ?? ""`.
- `customInstructions` viene de `this.config.customInstructions` (`memory/index.ts:194`, asignado a `this.customInstructions`); si no está seteado, la sección se omite entera.

---

### `formatConversationHistory` y `serializeMemories` (helpers de sección)

Transcripción (`prompts/index.ts:791-820`):

```ts
const PAST_MESSAGE_TRUNCATION_LIMIT = 300;

function truncateContent(
  text: string,
  limit = PAST_MESSAGE_TRUNCATION_LIMIT,
): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "...";
}

function formatConversationHistory(
  messages?: Array<{ role: string; content: string }>,
): string {
  if (!messages || messages.length === 0) return "";
  let result = "";
  for (const msg of messages) {
    const role = msg.role ?? "";
    const content = msg.content ?? "";
    if (role && content) {
      result += `${role}: ${truncateContent(content)}\n`;
    }
  }
  return result;
}

function serializeMemories(
  memories?: Array<{ id: string; text: string }>,
): string {
  return JSON.stringify(memories ?? []);
}
```

Comportamiento y edge cases:
- `formatConversationHistory`: devuelve `""` si `messages` es `undefined` o vacío. Cada mensaje se emite como `role: content\n`. **Salta** cualquier mensaje sin `role` o sin `content` (el `if (role && content)`). El content de cada mensaje del historial se **trunca a 300 caracteres** con sufijo `"..."` (`PAST_MESSAGE_TRUNCATION_LIMIT`). Esta truncación aplica **solo** al historial (`Last k Messages`), **no** a `New Messages` (que entra crudo vía `parsedMessages`).
- `serializeMemories`: `JSON.stringify` de la lista; con `undefined` produce el literal `"[]"`. No trunca ni limita el número de memorias (el límite top-10 lo impone el consumidor, no este helper).
- Ambos son funciones de módulo **no exportadas** (a diferencia de `generateAdditiveExtractionPrompt`, `extractJson`, y los schemas).

---

### Flujo end-to-end de la extracción (paso a paso, verificado en `memory/index.ts`, método `.addToVectorStore()` desde `:797`)

1. **Contexto** (`memory/index.ts:825-845`): se recuperan hasta **10** mensajes previos vía `db.getLastMessages(sessionScope, 10)` (envuelto en try/catch y guardado por `typeof … === "function"`: si el backend no lo soporta, sigue sin contexto). Se arma `parsedMessages` como `role: content` por línea.
2. **Recuperación de existentes** (`memory/index.ts:848-865`): se embebe `parsedMessages` con `embedder.embed(..., "search")` y se hace `vectorStore.search(embedding, 10, filters)`. Los ≤10 resultados se remapean a IDs enteros string y se guarda `uuidMapping` (que, se remarca, **no se consume después**). **[para construir encima] costo:** 1 embedding + 1 búsqueda vectorial por cada `add()`.
3. **System prompt** (`memory/index.ts:868-872`): `ADDITIVE_EXTRACTION_PROMPT`, más `AGENT_CONTEXT_SUFFIX` si `agent_id && !user_id`.
4. **User prompt** (`memory/index.ts:874-879`): `generateAdditiveExtractionPrompt(...)` como arriba.
5. **Llamada LLM** (`memory/index.ts:881-893`) — **una sola** por `add()`:

```ts
response = (await this.llm.generateResponse(
  [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  { type: "json_object" },
)) as string;
```

   - Se pide formato `json_object`. **[para construir encima] dónde lanza:** si la llamada al LLM falla, se captura, se hace `console.error` y se relanza como `LLMError("LLM extraction failed: ...", { cause: e })` (`memory/index.ts:892`) — esta es la única excepción que **propaga** hacia afuera del pipeline de extracción.
6. **Parseo** (`memory/index.ts:895-918`), con doble fallback:

```ts
const cleanResponse = extractJson(response);
if (cleanResponse && cleanResponse.trim()) {
  try {
    const parsed = AdditiveExtractionSchema.parse(JSON.parse(cleanResponse));
    extractedMemories = parsed.memory;
  } catch {
    const fallbackJson = extractJson(cleanResponse);
    extractedMemories = JSON.parse(fallbackJson)?.memory ?? [];
  }
}
```

   - Primero `extractJson` (`prompts/index.ts:901`) limpia noise tokens (`<|end_of_text|>`, `<|eot_id|>`, `<|im_end|>`, `<|im_start|>`, `<|endoftext|>`), quita code fences y bloques `<think>...</think>` (vía `removeCodeBlocks`, `prompts/index.ts:873`), y localiza el primer bloque `{...}` que sea JSON válido probando cada `{` como inicio; hay fallbacks a primer/último brace y a arrays `[...]`.
   - Luego intenta `AdditiveExtractionSchema.parse`. **Si el schema estricto lanza** (p.ej. `attributed_to: "User"` con mayúscula, o falta `text`), el `catch` NO aborta: reintenta `extractJson` + `JSON.parse` crudo y toma `?.memory ?? []`, **saltándose la validación Zod**. O sea: la salida puede terminar con objetos que el schema habría rechazado.
   - Si todo el bloque lanza, `extractedMemories = []` (se traga el error, `console.error`). **No** propaga: un parseo fallido produce cero memorias, no una excepción.
7. **Nada extraído** (`memory/index.ts:920-934`): si `extractedMemories.length === 0`, se guardan los mensajes best-effort (si `db.saveMessages` existe) y se retorna `[]`.
8. **Persistencia** (`memory/index.ts:936-1090`): batch-embed de los `text` con `embedder.embedBatch(memTexts, "add")` (fallback a embed individual), dedup por hash MD5 del `text` contra hashes existentes y dentro del batch, armado del payload, batch-insert al vector store (fallback uno-a-uno) e historia batch. Le sigue una **Phase 7** de entity linking (`memory/index.ts:1092+`).

**Payload persistido** (`memory/index.ts:986-999`) — qué de la salida del LLM sobrevive:

```ts
const memPayload: Record<string, any> = {
  ...metadata,
  data: text,
  textLemmatized,
  hash: memHash,
  createdAt: now,
  updatedAt: now,
};
if (mem.attributed_to) {
  memPayload.attributedTo = mem.attributed_to;
}
if (filters.user_id) memPayload.user_id = filters.user_id;
if (filters.agent_id) memPayload.agent_id = filters.agent_id;
if (filters.run_id) memPayload.run_id = filters.run_id;
```

**[para construir encima] claves de payload y qué NO hace:**
- Claves persistidas: `data` (el `text`), `textLemmatized` (`lemmatizeForBm25(text)`), `hash` (MD5 del text), `createdAt`/`updatedAt`, `attributedTo` (solo si el LLM devolvió `attributed_to`), y los scopes `user_id`/`agent_id`/`run_id` presentes. El `id` secuencial del LLM se **descarta** y se genera un `uuidv4()` fresco por memoria (`memory/index.ts:983`).
- **`linked_memory_ids` (el campo del LLM) se descarta por completo** — está en el schema y en el tipo de parseo (`memory/index.ts:900`) pero nunca se lee en la construcción del payload ni en la historia. El grafo memoria↔memoria que SÍ persiste esta build es el `linkedMemoryIds` (camelCase) que la **Phase 7 de entity linking** (`memory/index.ts:1092-1210`) escribe en registros de **entidad**: corre `extractEntitiesBatch` (NER) sobre los textos extraídos y, por cada entidad única, guarda/actualiza el conjunto de UUIDs de memoria que la mencionan (`memory/index.ts:1185-1198`). Ese grafo NO se alimenta del `linked_memory_ids` del prompt; se deriva de NER de forma independiente.
- La historia registra solo `action: "ADD"` con `previousValue: null` (`memory/index.ts:1047-1055`) — coherente con "sole operation is ADD": este pipeline V3 **no** hace UPDATE/DELETE/NONE (a diferencia del `MemoryUpdateSchema` legacy en `prompts/index.ts:20`, que aquí no se usa).
- **Costo LLM/embeddings por `add()`:** 1 embedding de búsqueda + 1 búsqueda vectorial top-10 + **1** llamada LLM de extracción + 1 batch-embed de los textos extraídos + (Phase 7) 1 batch-embed de las entidades únicas más búsquedas de entidad. Un solo turno de LLM, no el clásico patrón de dos fases (extract-facts + update-memory) del path legacy.

## 5. Extracción de entidades y entity store

### Qué hace este subsistema y qué no

`extractEntities` / `extractEntitiesBatch` (`utils/entity_extraction.ts:725` y `:826`) convierten texto libre en una lista de "entidades" mediante **NLP local + regex, sin ninguna llamada a LLM ni a embeddings**. Es puro CPU. El resultado alimenta un **entity store**: una colección vectorial *aparte* (`<collection>_entities`) donde cada entidad guarda un array `linkedMemoryIds` con los IDs de memoria en los que aparece. Ese índice entidad→memorias se usa después en `search` para aplicar un *boost* aditivo a las memorias cuyas entidades coinciden con las de la query.

**[para construir encima]** Distinción de costo clave: la *extracción* (`extractEntities`) es gratis (regex + `compromise`, sin red). Lo que cuesta embeddings es el *store*: en `add` se embebe una vez cada entidad única (`embedBatch(..., "add")`), en `search` se embebe cada entidad de la query (`embedBatch(..., "search")`), y en la limpieza de `update`/`delete` se re-embebe el texto de cada entidad tocada (`embed(..., "update")`). No hay LLM en ninguna parte del flujo de entidades; el único LLM del `add` es la extracción de memorias (Phase 2), que es un subsistema distinto.

**[para construir encima]** Lo que este subsistema **NO** hace: no construye un grafo de entidades ni relaciones entidad-entidad; la única estructura es la co-ocurrencia entidad→lista de memoria vía `linkedMemoryIds`. No hay tipos de relación, ni direccionalidad, ni pesos por arista. Tampoco deduplica contra todo el store global re-embebiendo: la deduplicación cruzada solo ocurre dentro del batch de un mismo `add()` más un match exacto/semántico por entidad contra el store.

### ¿Sigue siendo NLP en 3.1.0? Sí — `compromise`, con fallback regex

El archivo importa `compromise` de forma dinámica y tolerante a fallos (`utils/entity_extraction.ts:336`):

```ts
let nlp: any;
try {
  nlp = require("compromise");
} catch {
  // compromise not installed -- use regex-only fallback
}
```

El propio docstring del archivo (`:10-11`) lo resume: *"Uses the `compromise` npm package for NLP-based extraction when available. Falls back to regex-only extraction if `compromise` is not installed."* Es decir: si `require("compromise")` resuelve, `nlp` queda definido y corre la rama NLP (`extractCompoundsWithNlp`); si el `require` lanza (paquete ausente), `nlp` queda `undefined` y se usa `extractCompoundsRegex`. Este módulo **no** declara la dependencia ni fija una versión — que la rama NLP esté activa depende de si el paquete que lo consume tiene `compromise` instalado, algo que no se puede determinar desde este archivo. El selector está en `extractEntities` (`utils/entity_extraction.ts:738`):

```ts
// 4. TOPIC entities (NLP or regex fallback)
if (nlp) {
  raw.push(...extractCompoundsWithNlp(text));
} else {
  raw.push(...extractCompoundsRegex(text));
}
```

`compromise` solo influye en las entidades de tipo `TOPIC`. Las otras tres (QUOTED, PROPER, IDENTIFIER) son 100% regex/heurística y no dependen de que exista NLP.

### Tipo `ExtractedEntity`

El único tipo público es una etiqueta discriminada por `type` (`utils/entity_extraction.ts:327`):

```ts
export interface ExtractedEntity {
  type: "PROPER" | "QUOTED" | "TOPIC" | "IDENTIFIER";
  text: string;
}
```

No hay score, ni offset, ni span de posición: solo `type` y el texto normalizado. La prioridad semántica de los cuatro tipos (usada en la deduplicación) es **PROPER > IDENTIFIER > QUOTED > TOPIC** (`typePriority`, `utils/entity_extraction.ts:786`).

### Las cuatro estrategias de extracción

`extractEntities` corre las cuatro en orden fijo y concatena en un array `raw` (`utils/entity_extraction.ts:726-742`): (1) QUOTED, (2) PROPER, (3) IDENTIFIER, (4) TOPIC.

**QUOTED — `extractQuoted` (`utils/entity_extraction.ts:476`).** Dos regex: comillas dobles `/"([^"]+)"/g` y comillas simples con constraints de frontera para no capturar apóstrofos `/(?:^|[\s([{,;])'([^']+)'(?=[\s.,;:!?)\]]|$)/g`. En ambos casos exige `inner.length > 2` (mínimo 3 caracteres). Emite `type: "QUOTED"`.

**PROPER — `extractProper` (`utils/entity_extraction.ts:517`).** Tokeniza con `tokenize` (`:394`), cuyo regex `/[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*|\d[\d,]*(?:\.\d+)?|[,:;.!?&]/g` emite también signos de puntuación como tokens propios (esto es lo que permite detectar inicio de oración y contexto de lista). Luego camina los tokens:

- Caso especial "ampersand": si `token & afterNext` con ambos capitalizados y no genéricos, emite `Token & Token` como PROPER (`:527-542`).
- Un token arranca span si `isNameToken` (`:447`) es verdadero. `isNameToken` requiere: token capitalizado (`isCapitalized`, `:402`), no `isBadSingleNameToken` (`:414`, es decir no está en `GENERIC_SINGLE_ENTITY_TERMS` ni en `GENERIC_CAPS`), y **o bien** tiene mayúscula interna/dígito o es token de lista con métrica (`hasInternalCapOrDigit`, `:406` / `isListItemNameToken`, `:437`), **o bien** no está en inicio de oración (`!isSentenceStart`, `:429`). Esto último implica que una palabra capitalizada al inicio de frase no cuenta como nombre propio salvo que tenga mayúscula interna o dígito.
- El span se extiende sobre tokens-nombre consecutivos y también sobre "conectores internos" `of/the/in/for/at` seguidos de otro token-nombre (`innerConnectors`, `:520` y `:558-566`).
- Emite el span unido y limpiado si `phrase.length > 2` (`:571`).

**IDENTIFIER — `extractIdentifiers` (`utils/entity_extraction.ts:504`).** Regex `/\b[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)+\b/g`: identificadores con punto tipo `person.properties.email`. Emite el match crudo como `type: "IDENTIFIER"`.

**TOPIC (NLP) — `extractCompoundsWithNlp` (`utils/entity_extraction.ts:584`).** Núcleo de la rama NLP:

```ts
const doc = nlp(text);
const nouns = doc.nouns().out("array") as string[];

for (const nounPhrase of nouns) {
  const trimmed = nounPhrase.trim();
  if (!trimmed || trimmed.length <= 3) {
    continue;
  }
  const words = trimmed.split(/\s+/);
  if (words.length < 2) {
    continue;
  }
  // Filter out phrases where the head is generic
  const head = words[words.length - 1].toLowerCase();
  if (GENERIC_HEADS.has(head)) {
    // Check if there's a specific modifier
    const hasSpecificMod = words.some(
      (w) =>
        !NON_SPECIFIC_ADJ.has(w.toLowerCase()) &&
        w !== words[words.length - 1],
    );
    if (!hasSpecificMod) {
      continue;
    }
  }
  // Filter non-specific adjectives from the beginning
  const filtered = words.filter(
    (w) => !NON_SPECIFIC_ADJ.has(w.toLowerCase()),
  );
  const cleaned = stripGenericEnding(stripTopicPrefix(filtered));
  if (cleaned.length >= 2) {
    const phrase = cleanEntityText(cleaned.join(" "));
    if (phrase.length > 3) {
      entities.push({ type: "TOPIC", text: phrase });
    }
  }
}
```

Observable: solo toma *noun chunks* de compromise (`doc.nouns().out("array")`), exige frase multi-palabra (`words.length < 2` se descarta), descarta cabezas genéricas sin modificador específico (`GENERIC_HEADS`), quita adjetivos vagos (`NON_SPECIFIC_ADJ`), quita prefijos de tópico (`stripTopicPrefix`: artículos/posesivos/demostrativos, `:379`) y colas genéricas (`stripGenericEnding`, `:368`), y solo emite si quedan ≥2 palabras y el resultado tiene >3 caracteres.

**TOPIC (fallback regex) — `extractCompoundsRegex` (`utils/entity_extraction.ts:639`).** Solo se usa si `compromise` no cargó. Dos pasadas: una para secuencias capitalizadas multi-palabra `/\b([A-Z][a-z]+(?:\s+(?:of|the|for|in)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g` y otra para compuestos en minúscula `/\b([a-z]+(?:\s+[a-z]+){1,3})\b/g` (2–4 palabras, `phrase.length > 5`, con al menos una "content word" no genérica). Aplica los mismos filtros `GENERIC_HEADS`/`NON_SPECIFIC_ADJ`/`stripGenericEnding`/`stripTopicPrefix`.

### El pipeline de deduplicación y limpieza de `extractEntities`

Tras concatenar `raw`, hay cuatro etapas de saneamiento (`utils/entity_extraction.ts:744-817`):

1. **Dedup por texto en minúscula** (`:747`): clave `entity.text.toLowerCase().trim()`, se conserva solo si `key.length > 2` y no vista.
2. **Limpieza de artefactos** (`:758`): aplica `cleanEntityText` (quita asteriscos de bordes, dos-puntos finales, numeración `1.`, un número final, puntuación final, colapsa espacios — `:456`) y descarta si `hasArtifacts` (`:348`) es verdadero. `hasArtifacts` rechaza `**`, `__`, `:*`, asteriscos sueltos, dobles espacios/`\n`/`\t`, **texto de más de 100 caracteres**, y viñetas iniciales. Filtros extra por tipo: un `TOPIC` que empieza por dígito o es un "coordinated name topic" (`X and Y` capitalizados, `isCoordinatedNameTopic` `:467`) se descarta; un `PROPER` de una sola palabra que esté en `GENERIC_CAPS` se descarta.
3. **Mejor tipo por texto** (`:785-803`): si el mismo texto (case-insensitive) aparece con varios tipos, se conserva el de menor `typePriority` (PROPER=0, IDENTIFIER=1, QUOTED=2, TOPIC=3).
4. **Filtro de substrings** (`:806-817`): elimina una entidad cuando existe otra entidad `other` de **prioridad igual o superior** (`typePriority[entity] >= typePriority[other]`) tal que el texto de la entidad aparece como token con límites de palabra dentro de `other`. Es decir, entre `Machine` y `Machine Learning`, si `Machine` aparece como palabra entera dentro de la otra y la otra no es de menor prioridad, `Machine` se descarta. El texto de la entidad se escapa como regex antes de comparar.

`extractEntitiesBatch` (`:826`) es trivial: `texts.map(extractEntities)`, un array de resultados por texto, mismo orden.

### El entity store: colección vectorial aparte

`getEntityStore` (`memory/index.ts:288`) crea, perezosamente y cacheado en `this._entityStore`, una **segunda instancia de vector store** con el mismo provider (`this.config.vectorStore.provider`) y la misma config del store principal pero con `collectionName = \`${this.collectionName}_entities\``:

```ts
const entityCollectionName = `${this.collectionName}_entities`;
const entityConfig: VectorStoreConfig = {
  ...this.config.vectorStore.config,
  collectionName: entityCollectionName,
};
if (entityProvider === "memory") {
  const basePath = entityConfig.dbPath || getDefaultVectorStoreDbPath();
  entityConfig.dbPath = basePath.replace(/\.db$/, "_entities.db");
}
if (entityProvider === "databricks") {
  entityConfig.tableName = entityConfig.tableName
    ? `${entityConfig.tableName}_entities`
    : entityCollectionName;
}
```

**[para construir encima]** Claves de payload de cada registro de entidad (definidas en `_linkEntitiesForMemory` `:513` y Phase 7 `:1195`):
- `data`: el texto de la entidad (`ExtractedEntity.text`). Es la clave sobre la que se hace el match exacto (vía `_normalizeEntityText`) y la re-embedding en cleanup — si falta, la limpieza no puede re-embeber y omite el registro (`:420-426`).
- `entityType`: el `ExtractedEntity.type` (`PROPER`/`QUOTED`/`TOPIC`/`IDENTIFIER`).
- `linkedMemoryIds`: array (ordenado con `.sort()`) de IDs de memoria co-ocurrentes. **Este es el índice de co-ocurrencia.**
- `user_id` / `agent_id` / `run_id`: solo los que estén presentes en `filters`, para aislamiento de sesión.

**[para construir encima]** El scoping por sesión se hace vía `_sessionFiltersFromPayload` (`memory/index.ts:319`), que conserva únicamente `user_id`/`agent_id`/`run_id` definidos del payload. Toda operación sobre el entity store se filtra por esas claves; entidades de distintos usuarios/agentes/runs no se mezclan.

### Escritura en `add` — Phase 7 (batch)

Dentro de `addToVectorStore` (`memory/index.ts:797`), tras persistir las memorias (Phase 6), viene "Phase 7: Batch entity linking" (`memory/index.ts:1092-1226`). Todo está envuelto en `try/catch` con `console.warn` (`:1225`) — **una falla aquí nunca rompe el `add`**.

Pasos:
- **7a (dedup global del batch, `:1097`):** `extractEntitiesBatch(allTexts)` sobre los textos de las memorias recién insertadas; se agrupan en `globalEntities` por `key = entity.text.trim().toLowerCase()`, acumulando en un `Set` los `memoryId` donde cada entidad co-ocurre.
- **7b (embed único, `:1128`):** una sola `embedder.embedBatch(entityTexts, "add")` para todas las entidades únicas; fallback a embed individual `embed(t, "add")`, y las que fallan quedan `null` y se descartan (`:1141-1147`).
- **7c (match por entidad, `:1156`):** se lista el store una vez con `_existingEntitiesByText` (`:333`, que hace `entityStore.list(filters, 10000)` y mapea por texto normalizado). Para cada entidad: si hay **match exacto** por texto normalizado se usa; si no, se hace `entityStore.search(entityVec, 1, filters)` y se acepta como **match semántico solo si `score >= 0.95`**:

```ts
const semanticMatch =
  matches.length > 0 && (matches[0].score ?? 0) >= 0.95
    ? matches[0]
    : undefined;
const match = exactMatch ?? semanticMatch;
```

- Si hay match: se hace *union* de `linkedMemoryIds` existentes con los nuevos `memoryIds`, se ordena y se `entityStore.update(match.id, entityVec, payload)`.
- Si no hay match: se acumula para **7e**, un único `entityStore.insert(...)` batch de todas las entidades nuevas (`:1210-1221`), cada una con `uuidv4()` como ID.

**[para construir encima]** El umbral de fusión de entidades es `0.95` (muy estricto: casi solo fusiona duplicados casi idénticos). El `list(..., 10000)` cap significa que el match exacto solo cubre hasta 10000 entidades por sesión; más allá, cae al camino semántico.

### Escritura en `update` — `_linkEntitiesForMemory` (single-memory)

`_linkEntitiesForMemory` (`memory/index.ts:454`) es la variante de una sola memoria. Corre `extractEntities(text)` (no batch), y por cada entidad hace exactamente el mismo patrón "match exacto → si no, `search(entityVec, 1, filters)` con umbral `0.95` → update o insert". Diferencias con Phase 7: embebe entidad por entidad con `embed(entity.text, "add")` (`:473`, no batch), e inserta de a una (`entityStore.insert([entityVec], [uuidv4()], [entityPayload])`, `:523`). Errores por entidad se tragan con `console.debug`; el fallo global con `console.warn`.

### Limpieza en `update`/`delete` — `_removeMemoryFromEntityStore`

`_removeMemoryFromEntityStore` (`memory/index.ts:375`) lista el store (`list(filters, 10000)`) y, por cada entidad cuyo `linkedMemoryIds` incluye el `memoryId`, quita ese ID:
- Si `linkedMemoryIds` queda **vacío**, borra el registro de entidad (`entityStore.delete(row.id)`, `:411`).
- Si quedan otros, **re-embebe** el texto de la entidad (`embedder.embed(entityText, "update")`, `:429`) y hace `entityStore.update(row.id, vec, newPayload)` (`:435`). Si falta `payload.data` no puede re-embeber y omite ese registro (`:420-426`).

Cableado en el ciclo de vida:
- `updateMemory` (`:1966-1974`): **solo si el texto cambió** (`textChanged = newData !== prevValue`, `:1938`) hace `_removeMemoryFromEntityStore` seguido de `_linkEntitiesForMemory` con la nueva data. Si el update no toca el texto, el entity store no se toca.
- `deleteMemory` (`:2000-2006`): siempre hace `_removeMemoryFromEntityStore` tras borrar la memoria.

**[para construir encima]** Ambos wrappeados en `try/catch` no fatales (`console.warn`). El coste de un `delete`/`update-con-cambio` incluye un `list` de hasta 10000 entidades y una re-embedding por cada entidad que sobrevive con `linkedMemoryIds` no vacío — puede ser caro si una memoria comparte muchas entidades populares.

### El boost en `search`

En `search` (`memory/index.ts:1300`), "Step 1" extrae entidades de la query con `extractEntities(query)` (`:1395`) y "Step 6" (`:1440-1518`) computa el boost. Todo está en `try/catch` con `console.warn` — un fallo del boost degrada a búsqueda sin boost, no rompe.

Flujo observable:
- Dedup de las entidades de la query, **máximo 8** (`queryEntities.slice(0, 8)`, `:1447`).
- Filtros del store de entidades = solo `user_id`/`agent_id`/`run_id` presentes en `effectiveFilters` (`:1457-1461`).
- Un solo `embedder.embedBatch(entityTexts, "search")` (`:1463`); si el número de vectores no coincide con el de textos, se salta el boost con warning (`:1468`).
- Por cada entidad, `entityStore.search(embeddings[i], 500, entitySearchFilters)` en paralelo con `Promise.allSettled` (`:1473`) — hasta **500 candidatos por entidad**; los rechazos individuales se loguean y se ignoran.
- Por cada match del store, se descarta si `similarity < 0.5` (`:1490`). Si pasa, se calcula el peso:

```ts
const numLinked = Math.max(linkedMemoryIds.length, 1);
const memoryCountWeight =
  1.0 / (1.0 + 0.001 * (numLinked - 1) ** 2);
const boost =
  similarity * ENTITY_BOOST_WEIGHT * memoryCountWeight;

for (const memoryId of linkedMemoryIds) {
  if (memoryId) {
    const memKey = String(memoryId);
    entityBoosts[memKey] = Math.max(
      entityBoosts[memKey] ?? 0,
      boost,
    );
  }
}
```

`ENTITY_BOOST_WEIGHT = 0.5` (`utils/scoring.ts:10`). El `memoryCountWeight` **penaliza entidades muy conectadas**: una entidad ligada a 1 memoria pesa 1.0; a 10 memorias, `1/(1+0.001·81) ≈ 0.925`; a 100, `1/(1+0.001·9801) ≈ 0.093`. Cada memoria acumula el **máximo** boost entre todas sus entidades coincidentes (no la suma).

### Cómo entra el boost en el ranking — `scoreAndRank`

Los `entityBoosts` (junto con `bm25Scores`) van a `scoreAndRank` (`utils/scoring.ts:99`). El divisor `maxPossible` se adapta a las señales activas (`:114-120`):

```ts
let maxPossible = 1.0;
if (hasBm25) {
  maxPossible += 1.0;
}
if (hasEntity) {
  maxPossible += ENTITY_BOOST_WEIGHT;
}
```

Es decir: solo semántico → 1.0; +BM25 → 2.0; +entidad → +0.5 (2.5 con las tres, 1.5 semántico+entidad). El score final por candidato (`:139-140`):

```ts
const rawCombined = semanticScore + bm25Score + entityBoost;
const combined = Math.min(rawCombined / maxPossible, 1.0);
```

**[para construir encima]** El `threshold` (default `0.1`, `memory/index.ts:1347`) **gatea el score semántico ANTES de combinar** (`utils/scoring.ts:131`): un candidato con semántico por debajo del umbral se excluye aunque el entity boost lo levantaría. El boost **reordena** dentro del pool ya filtrado por semántica, no rescata memorias que la búsqueda vectorial no trajo (el pool es `internalLimit = max(topK*4, 60)` resultados semánticos, `memory/index.ts:1401`). Con `explain: true`, cada resultado se emite con la clave `score_details` (`memory/index.ts:1570`), poblada desde `ScoreDetails` con `semanticScore`, `bm25Score`, `entityBoost`, `rawScore`, `maxPossibleScore`, `finalScore`, `threshold` (`utils/scoring.ts:148-156`).

### Dónde falla / dónde lanza — resumen para integrar

**[para construir encima]**
- La extracción (`extractEntities`/`Batch`) no lanza y no hace I/O: entrada `string`, salida `ExtractedEntity[]`. Segura de llamar en caliente.
- Todo el linking/cleanup/boost del entity store es **no fatal**: envuelto en `try/catch`, degrada con `console.warn`/`console.debug`. El único punto de `add` que lanza (`LLMError`) es la extracción LLM de memorias (Phase 2, `memory/index.ts:892`), ajena a las entidades.
- El entity store es una colección/DB física distinta (`_entities` / `_entities.db` / `tableName_entities`). Si diseñas migraciones, backups o borrados por-usuario, hay que tratar **dos** colecciones.
- Requisitos del store para que el boost/link funcionen: soportar `list(filters, limit)`, `search(vec, k, filters)`, `insert`, `update(id, vec, payload)`, `delete(id)`. Si `list` falla, `_existingEntitiesByText` cae a solo-semántico (retorna un mapa vacío con `console.debug`, `:346-354`) y la dedup exacta se pierde.
- Umbrales concretos a recordar: fusión de entidades `>= 0.95`; inclusión en boost `>= 0.5`; peso de boost `0.5`; tope de entidades de query `8`; tope de candidatos por entidad en boost `500`; tope de `list` `10000`; largo máximo de entidad efectivo `100` chars (por `hasArtifacts`).

## 6. Vector stores y la interfaz de almacenamiento

Esta sección documenta la capa de persistencia vectorial de **mem0 OSS v3.1.0** (SDK TypeScript, entrada `mem0ai/oss`), tal como está en el árbol `src/oss/src`. Todas las rutas son relativas a `src/oss/src`.

> Nota de fidelidad: el archivo de la interfaz `vector_stores/base.ts` (importado por `utils/factory.ts:25` y `memory/index.ts:34` como `../vector_stores/base`) **no está presente en este snapshot del fuente** — `ls`/`find` lo reportan inexistente y no aparece como nodo en el grafo graphify. Por eso el contrato `VectorStore` que se documenta abajo está **reconstruido desde los implementadores** (`class X implements VectorStore`) y desde los sitios de consumo en `memory/index.ts`, no transcrito de `base.ts`. Cada afirmación sobre la interfaz cita al menos un implementador o un call-site verificable.

### La interfaz `VectorStore` (contrato observado)

Cada store se declara `implements VectorStore` (p. ej. `vector_stores/qdrant.ts:57`, `vector_stores/memory.ts:17`, `vector_stores/elasticsearch.ts:45`) e importa el tipo con `import { VectorStore } from "./base"` (`qdrant.ts:2`, `memory.ts:1`). El conjunto de métodos, con las firmas observadas en los implementadores, es:

```ts
// Reconstruido desde qdrant.ts / memory.ts (implements VectorStore)
insert(vectors: number[][], ids: string[], payloads: Record<string, any>[]): Promise<void>;
search(query: number[], topK?: number, filters?: SearchFilters): Promise<VectorStoreResult[]>;
keywordSearch?(query: string, topK?: number, filters?: SearchFilters): Promise<VectorStoreResult[] | null>;
get(vectorId: string): Promise<VectorStoreResult | null>;
update(vectorId: string, vector: number[], payload: Record<string, any>): Promise<void>;
delete(vectorId: string): Promise<void>;
deleteCol(): Promise<void>;
list(filters?: SearchFilters, topK?: number): Promise<[VectorStoreResult[], number]>;
getUserId(): Promise<string>;
setUserId(userId: string): Promise<void>;
initialize(): Promise<void>;
```

Puntos clave del contrato, verificables:

- **`keywordSearch` es opcional.** `ElasticsearchDB` (`elasticsearch.ts:45`) implementa `insert`/`search` pero **no define `keywordSearch`** (grep de `keywordSearch` en ese archivo no halla nada; solo hay mapeos de tipo `keyword` en `user_id`/`agent_id`/`run_id`, `elasticsearch.ts:157-159`). Que `ElasticsearchDB` compile como `implements VectorStore` sin el método confirma que en la interfaz es opcional (`keywordSearch?`). El consumidor lo trata como opcional con un guard de runtime en `memory/index.ts:1414`:
  ```ts
  if (typeof this.vectorStore.keywordSearch === "function") {
  ```
  **[para construir encima]** Un store puede omitir `keywordSearch` por completo; el pipeline degrada a solo-vectorial sin error.
- **`insert` recibe tres arrays paralelos** (`vectors[i]`, `ids[i]`, `payloads[i]`), no objetos combinados. El *payload* es libre (`Record<string, any>`).
- **`search` toma un vector ya embebido** (`number[]`), no texto: el embedding lo produce la capa `Memory`, no el store.
- **`list` devuelve una tupla `[resultados, número]`.** El "número" no es garantía de total global: en Qdrant es el largo de la página devuelta (`qdrant.ts:368`, `response.points.length`). En el store `memory` sí es el total tras filtrar (`memory.ts:460`, `results.length`, mientras que el primer elemento va cortado a `topK`).
- Métodos de infraestructura poco habituales: **`getUserId`/`setUserId`** (persisten un `user_id` de instalación en una colección/tabla `memory_migrations`) e **`initialize`** (memoizada e idempotente en Qdrant, invocada desde el constructor de varios stores).

Los tipos de datos que cruzan la interfaz están en `types/index.ts`:

```ts
// types/index.ts:37
export interface VectorStoreConfig {
  collectionName?: string;
  dimension?: number;
  dbPath?: string;
  client?: any;
  instance?: any;
  [key: string]: any;
}

// types/index.ts:164
export interface SearchFilters {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  [key: string]: any;
}

// types/index.ts:175
export interface VectorStoreResult {
  id: string;
  payload: Record<string, any>;
  score?: number;
}
```

**[para construir encima]** `VectorStoreResult.score` es **opcional**: `get` y `list` devuelven resultados **sin** `score` (solo `search`/`keywordSearch` lo pueblan). Nunca asumas `score` presente fuera de una búsqueda.

### Forma del payload almacenado

El payload no lo arma el store, lo arma `Memory` antes de llamar a `insert`/`update`. Hay dos rutas de escritura y ambas producen el mismo esqueleto de claves.

Ruta unitaria — `createMemory` (`memory/index.ts:1890`):

```ts
// memory/index.ts:1899
const memoryMetadata = {
  ...metadata,
  data,
  hash: createHash("md5").update(data).digest("hex"),
  textLemmatized: lemmatizeForBm25(data),
  createdAt: new Date().toISOString(),
};
await this.vectorStore.insert([embedding], [memoryId], [memoryMetadata]);
```

Ruta batch V3 (`memory/index.ts:986`):

```ts
const memPayload: Record<string, any> = {
  ...metadata,
  data: text,
  textLemmatized,
  hash: memHash,          // createHash("md5").update(text).digest("hex")
  createdAt: now,
  updatedAt: now,
};
if (mem.attributed_to) { memPayload.attributedTo = mem.attributed_to; }
if (filters.user_id) memPayload.user_id = filters.user_id;
if (filters.agent_id) memPayload.agent_id = filters.agent_id;
if (filters.run_id) memPayload.run_id = filters.run_id;
```

Claves de payload observables **[para construir encima]**:

| Clave | Contenido | Notas |
|---|---|---|
| `data` | Texto de la memoria (string) | Es lo que devuelven las lecturas como "memoria"; en el pipeline de add se usa `mem.payload?.data ?? ""` (`memory/index.ts:863`). |
| `hash` | `md5(data)` hex | Se usa para deduplicar (`existingHashes.has(memHash)` en `memory/index.ts:977`). |
| `textLemmatized` | `lemmatizeForBm25(data)` | Texto lematizado para BM25. **camelCase** en escritura. |
| `createdAt` / `updatedAt` | ISO 8601 (`new Date().toISOString()`) | `updatedAt` solo en batch add y en `updateMemory` (`memory/index.ts:1951`). En `updateMemory`, `createdAt` se preserva del payload previo. |
| `attributedTo` | Hablante atribuido por el LLM | Solo si el LLM lo emite (`mem.attributed_to`). |
| `user_id` / `agent_id` / `run_id` | Scope de sesión | **snake_case**. |
| `...metadata` | Metadatos de usuario arbitrarios | Se esparcen tal cual. |

**[para construir encima] Cuidado con la convención de nombres**, porque no es uniforme:
- La escritura usa **camelCase** para `textLemmatized`, `createdAt`, `updatedAt`, `attributedTo`; y **snake_case** para `user_id`/`agent_id`/`run_id`.
- El store `memory` **normaliza solo `userId`/`agentId`/`runId` → snake_case al leer** (`memory.ts:22-38`, `normalizePayload` con la tabla `CAMEL_TO_SNAKE`), pero **no toca `textLemmatized`**.
- Su BM25 lee `payload.textLemmatized || payload.data` (`memory.ts:281`), consistente con la escritura camelCase.
- En cambio `OpenSearchDB.keywordSearch` matchea sobre `payload.data` **y** `payload.text_lemmatized` (**snake_case**, `opensearch.ts:278-280` en el `should`), distinto de la clave `textLemmatized` que escribe `Memory`. `pgvector` full-text indexa contra `payload->>'textLemmatized'` (**camelCase**, `pgvector.ts:383/385`), y `MongoDB` sobre `["payload.data", "payload.text_lemmatized"]` (`mongodb.ts:291`). Verifica por-store qué clave indexa cada backend antes de confiar en el full-text.

Qdrant guarda el payload **verbatim** (`qdrant.ts:276`, `payload: payloads[idx] || {}`), sin normalizar claves, así que las memorias quedan con `createdAt`/`textLemmatized`/`attributedTo` en camelCase en Qdrant.

### Qdrant en detalle (`vector_stores/qdrant.ts`)

`class Qdrant implements VectorStore` (`qdrant.ts:57`). Cliente: `@qdrant/js-client-rest`.

**Construcción del cliente (`qdrant.ts:63-103`).** Resolución por prioridad:
1. `config.client` provisto → se usa tal cual (`qdrant.ts:64-65`).
2. `config.apiKey` → `params.apiKey`.
3. `config.url` → `params.url` + **workaround del bug qdrant/qdrant-js#59**: parsea el puerto de la URL, y si no hay, fuerza `6333`:
   ```ts
   // qdrant.ts:74
   try {
     const parsedUrl = new URL(config.url);
     params.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6333;
   } catch (_) {
     params.port = 6333;
   }
   ```
4. `config.host && config.port` → host+port.
5. Si `params` quedó vacío → modo local/embebido con `config.path`, y **[para construir encima] destructivo**: si `!onDisk && path` y el path existe como directorio, lo **borra recursivamente**:
   ```ts
   // qdrant.ts:87
   if (!config.onDisk && config.path) {
     if (fs.existsSync(config.path) && fs.statSync(config.path).isDirectory()) {
       fs.rmSync(config.path, { recursive: true });
     }
   }
   ```
   Pasar `path` sin `onDisk: true` **borra el directorio** en cada arranque.

`this.dimension = config.dimension || 1536` (**default OpenAI**, `qdrant.ts:101`) — nota que `QdrantConfig` también declara `embeddingModelDims` y `dimension` (`qdrant.ts:29-30`), pero el constructor usa **`config.dimension`**. El constructor dispara `initialize().catch(console.error)` (fire-and-forget, `qdrant.ts:102`).

**Inicialización de colección (`qdrant.ts:445-505`).** `initialize` memoiza `_initPromise`; `_doInitialize` (`qdrant.ts:497`) crea dos colecciones vía `ensureCollection`: la principal (`collectionName`, tamaño `dimension`) y `memory_migrations` (tamaño `1`). `ensureCollection` (`qdrant.ts:445`) crea con `distance: "Cosine"`; ante error trata `409/401/403` como "ya existe", y **solo para la colección principal** verifica el tamaño del vector:
```ts
// qdrant.ts:465
if (vectorConfig && vectorConfig.size !== size) {
  throw new Error(
    `Collection ${name} exists but has wrong vector size. ` +
      `Expected: ${size}, got: ${vectorConfig.size}`,
  );
}
```
Errores transitorios de verificación → `console.warn` y sigue; cualquier otro status → **rethrow** (`qdrant.ts:485`). **[para construir encima]** Un mismatch de dimensiones lanza en el arranque de la colección principal; un embedder con dims distintas a las de la colección existente rompe aquí.

**Filtros — `createFilter` + `buildFieldCondition` (`qdrant.ts:109-266`).** Traduce `SearchFilters` a un `QdrantFilter { must, should, must_not }`. Normaliza operadores lógicos con `KEY_MAP` (`$and→AND`, `$or→OR`, `$not→NOT`, `qdrant.ts:51`) y **deduplica** (la primera aparición de cada clave normalizada gana, `qdrant.ts:196`). Mapeo lógico → estructura Qdrant:
- `AND` → `must` (recursivo `createFilter` por sub-filtro).
- `OR` → `should`.
- `NOT` → `must_not`.
- Campo normal → `buildFieldCondition` → `must`.

`buildFieldCondition` (`qdrant.ts:109`, operadores de comparación por campo):
```ts
// qdrant.ts:109
if (value === "*") return null;                       // wildcard → se omite el filtro
return { key, match: { value } };                     // igualdad simple
// Array → { key, match: { any: value } }             // "in" abreviado
// rango gt/gte/lt/lte → { key, range }
// eq  → match: { value: value.eq }
// ne  → match: { except: [value.ne] }
// in  → match: { any: value.in }
// nin → match: { except: value.nin }
// contains|icontains → match: { text }
```
Casos que **lanzan** **[para construir encima]**:
- Mezclar operadores de rango con no-rango en el mismo campo (`qdrant.ts:133`): `"Cannot mix range operators ... with non-range operators ..."`.
- Operador desconocido (`qdrant.ts:179`): `"Unsupported filter operator(s) for field ..."` con la lista soportada (`eq, ne, gt, gte, lt, lte, in, nin, contains, icontains`).
- Valor de `AND`/`OR`/`NOT` que no sea array (`qdrant.ts:209`), o ítems de la lista que no sean dicts (`qdrant.ts:220`).

Observa que `contains` y `icontains` mapean ambos a `match: { text }` con `const text = value.contains || value.icontains` (`qdrant.ts:161-163`) — la case-insensitivity real de `icontains` **no se distingue** a nivel de payload de Qdrant.

**`insert` (`qdrant.ts:268`).** `upsert` de puntos `{ id: ids[idx], vector, payload: payloads[idx] || {} }`. **No valida dimensiones** (a diferencia del store `memory`).

**`search` (`qdrant.ts:288`).** `topK` default `5`. Llama `client.search(collection, { vector, filter, limit: topK })` y mapea a `{ id: String(hit.id), payload: hit.payload || {}, score: hit.score }`.

**`keywordSearch` (`qdrant.ts:284`).** **STUB — devuelve `null`**, sin parámetros:
```ts
async keywordSearch(): Promise<null> {
  return null;
}
```
**[para construir encima]** Qdrant en 3.1.0 **no hace full-text/BM25**. Con Qdrant, la búsqueda híbrida de mem0 degrada a **solo semántica + boosts de entidad**; el aporte BM25 es siempre cero.

**Resto:** `get` (`qdrant.ts:307`, retrieve por id con `with_payload: true`, sin `score`, `null` si no hay), `update` (`qdrant.ts:321`, upsert de un punto), `delete` (`qdrant.ts:337`, `client.delete { points: [vectorId] }`), `deleteCol` (`qdrant.ts:343`, `deleteCollection`), `list` (`qdrant.ts:347`, scroll con `topK` default `100`, `with_payload: true`, `with_vectors: false`, devuelve `[results, response.points.length]`). `getUserId`/`setUserId` (`qdrant.ts:382`/`419`) usan la colección `memory_migrations` con vector dummy `[0]` (tamaño 1) y `generateUUID()` para los ids.

### El store `memory` y el BM25 real (`vector_stores/memory.ts`)

`class MemoryVectorStore implements VectorStore` (`memory.ts:17`). Backend **SQLite embebido** vía `better-sqlite3`. Es el único store que trae **BM25 implementado en JS**.

`dimension = config.dimension || 1536` (`memory.ts:41`), `dbPath = config.dbPath || getDefaultVectorStoreDbPath()` (avisa si existe un viejo `vector_store.db` en `process.cwd()`, `memory.ts:44-52`). Esquema (`memory.ts:59`, método `init`):
```sql
CREATE TABLE IF NOT EXISTS vectors (id TEXT PRIMARY KEY, vector BLOB NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memory_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL UNIQUE);
```
El vector se serializa como `Buffer.from(new Float32Array(...).buffer)` y el payload como `JSON.stringify` (`memory.ts:239-240`). `insert` **valida dimensión** y lanza en mismatch (`memory.ts:234`); igual `search` (`memory.ts:357`) y `update` (`memory.ts:411`). Filtrado (`filterVector`/`matchFieldCondition`, `memory.ts:92-221`) soporta el mismo set de operadores que Qdrant pero evaluado en JS (`eq/ne/gt/gte/lt/lte/in/nin/contains/icontains` + `AND/OR/NOT`, con `"*"` como wildcard-true).

**`search` (`memory.ts:352`)** es **fuerza bruta O(N)**: lee **todas** las filas (`SELECT * FROM vectors`), calcula `cosineSimilarity` manual contra cada una, filtra, ordena desc y corta `topK` (default `10`). **[para construir encima]** No escala: cada búsqueda escanea la tabla entera.

**`keywordSearch` (`memory.ts:251`) — BM25 real, inline:**
```ts
const text = payload.textLemmatized || payload.data || "";
candidates.push({ id: row.id, payload, tokens: this.tokenize(text) });
...
const k1 = 1.5;
const b = 0.75;
const N = candidates.length;
const avgDocLength = candidates.reduce((sum, c) => sum + c.tokens.length, 0) / N;
...
idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));  // IDF con suavizado +1
...
score += (termIdf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * docLength) / avgDocLength));
```
Detalles observables: `tokenize` = `text.toLowerCase().split(/\s+/).filter(Boolean)` (`memory.ts:247`); `topK` default `10`; se descartan documentos con `score <= 0` (`memory.ts:336`, `.filter((s) => s.score > 0)`); resultados ordenados desc. **Ante cualquier excepción devuelve `null`** (catch en `memory.ts:346-349`), lo que en el pipeline equivale a "sin keyword". Si no hay candidatos (`memory.ts:287`) o la query tokenizada queda vacía (`memory.ts:292`), devuelve `[]` (no `null`).

### Quién implementa `keywordSearch` de verdad vs. quién devuelve `null`

`Memory.search` invoca `keywordSearch` con la **query ya lematizada** y solo si el método existe (`memory/index.ts:1414-1425`):
```ts
if (typeof this.vectorStore.keywordSearch === "function") {
  try {
    keywordResults =
      (await this.vectorStore.keywordSearch(
        queryLemmatized,
        internalLimit,
        effectiveFilters,
      )) ?? null;
  } catch {
    keywordResults = null;
  }
}
```
Cuando `keywordResults` es `null` (store stub, sin método, o excepción), el paso 5 (`memory/index.ts:1429-1440`) **no aporta puntajes BM25** y la búsqueda queda semántica + boosts de entidad. Un `null` **no es un error**; es degradación silenciosa. **[para construir encima]** Si tu ranking depende de keyword, verifica que tu store lo implemente de verdad: elegir Qdrant o Elasticsearch desactiva de facto el componente BM25.

Clasificación exacta en 3.1.0 (verificada leyendo cada cuerpo):

**BM25 / full-text real (delegado al backend o inline):**
- `memory` (`memory.ts:251`) — BM25 inline en JS, incondicional.
- `pgvector` (`pgvector.ts:366`) — full-text SQL (`to_tsvector`/`plainto_tsquery` sobre `payload->>'textLemmatized'`).
- `azure_ai_search` (`azure_ai_search.ts:332`) — `searchClient.search(query, ...)`.
- `weaviate` (`weaviate.ts:162`) — `this._col.query.bm25(query, { queryProperties: ["data"] })`.
- `mongodb` (`mongodb.ts:270`) — Atlas `$search` sobre `["payload.data", "payload.text_lemmatized"]`.
- `azure_mysql` (`azure_mysql.ts:216`).
- `opensearch` (`opensearch.ts:271`) — `bool.should` sobre `payload.data` y `payload.text_lemmatized`.
- `databricks` (`databricks.ts:615`) — con caveat en comentario: la consulta **no** scopea a `text_lemmatized` porque el parámetro `query_columns` que lo haría es Beta (`databricks.ts:627-630`).
- `upstash_vector` (`upstash_vector.ts:100`) — `this.client.query({ data: query, ... })`.

**Condicional (real solo si hay índice/esquema; si no, `null`):**
- `milvus` (`milvus.ts:336`): `if (!this.hasBm25Schema) return null;` luego BM25 sparse.
- `baidu` (`baidu.ts:462`): `if (!this.supportsKeywordSearch) return null;` (`baidu.ts:469`) luego `BM25SearchRequest`; además emite warning si la tabla no tiene índice invertido (`baidu.ts:390`).

**Stub — siempre `null` (sin BM25):**
- `qdrant` (`qdrant.ts:284`), `chroma` (`chroma.ts:161`), `redis` (`redis.ts:383`), `valkey` (`valkey.ts:442`), `supabase` (`supabase.ts:231`), `langchain` (`langchain.ts:102`), `vectorize` (`vectorize.ts:77`), `neptune_analytics` (`neptune_analytics.ts:124`), `turbopuffer` (`turbopuffer.ts:132`), `cassandra` (`cassandra.ts:138`), `s3_vectors` (`s3_vectors.ts:148`) — todos con firma vacía `keywordSearch(): Promise<null>`.
- `pinecone` (`pinecone.ts:264`) — **firma completa con parámetros prefijados con guion bajo `(_query, _topK, _filters)` pero cuerpo `return null`**.
- `vertex_ai_vector_search` (`vertex_ai_vector_search.ts:262`) — **firma completa `(query, topK?, filters?)` pero cuerpo `return null`**.

**Sin método `keywordSearch`:**
- `elasticsearch` (`elasticsearch.ts:45`) — no lo define; el guard `typeof … === "function"` es `false` en runtime.

### Lista completa de vector stores en 3.1.0 y sus provider strings

Registrados en `VectorStoreFactory.create` (`utils/factory.ts:150-208`), que hace `switch (provider.toLowerCase())` y lanza `"Unsupported vector store provider: ${provider}"` en el default. **25 clases** (dos con alias doble):

| Provider string | Clase | Archivo | `keywordSearch` |
|---|---|---|---|
| `memory` | `MemoryVectorStore` | `memory.ts` | **Real (BM25 inline)** |
| `qdrant` | `Qdrant` | `qdrant.ts` | Stub → `null` |
| `chroma` | `ChromaDB` | `chroma.ts` | Stub → `null` |
| `redis` | `RedisDB` | `redis.ts` | Stub → `null` |
| `valkey` | `ValkeyDB` | `valkey.ts` | Stub → `null` |
| `supabase` | `SupabaseDB` | `supabase.ts` | Stub → `null` |
| `langchain` | `LangchainVectorStore` | `langchain.ts` | Stub → `null` |
| `vectorize` | `VectorizeDB` | `vectorize.ts` | Stub → `null` |
| `azure-ai-search` | `AzureAISearch` | `azure_ai_search.ts` | **Real** |
| `vertex_ai_vector_search` | `VertexAIVectorSearch` | `vertex_ai_vector_search.ts` | Stub → `null` (firma completa) |
| `pgvector` | `PGVector` | `pgvector.ts` | **Real** |
| `databricks` | `DatabricksVectorStore` | `databricks.ts` | **Real** (con caveat) |
| `neptune` / `neptune-analytics` | `NeptuneAnalyticsVectorStore` | `neptune_analytics.ts` | Stub → `null` |
| `elasticsearch` | `ElasticsearchDB` | `elasticsearch.ts` | **Ausente** (no lo implementa) |
| `opensearch` | `OpenSearchDB` | `opensearch.ts` | **Real** |
| `upstash_vector` | `UpstashVector` | `upstash_vector.ts` | **Real** |
| `azure_mysql` | `AzureMySQLDB` | `azure_mysql.ts` | **Real** |
| `cassandra` | `CassandraDB` | `cassandra.ts` | Stub → `null` |
| `pinecone` | `PineconeDB` | `pinecone.ts` | Stub → `null` (firma completa) |
| `s3-vectors` / `s3_vectors` | `S3Vectors` | `s3_vectors.ts` | Stub → `null` |
| `turbopuffer` | `TurbopufferDB` | `turbopuffer.ts` | Stub → `null` |
| `milvus` | `Milvus` | `milvus.ts` | Condicional (`hasBm25Schema`) |
| `mongodb` | `MongoDB` | `mongodb.ts` | **Real** |
| `weaviate` | `WeaviateDB` | `weaviate.ts` | **Real** |
| `baidu` | `BaiduDB` | `baidu.ts` | Condicional (`supportsKeywordSearch`) |

**[para construir encima] Detalles de la factory que muerden:**
- El provider se compara **lowercased** (`provider.toLowerCase()`), así que `"Qdrant"` funciona pero el string debe coincidir tras minusculizar.
- `neptune` acepta `neptune` **o** `neptune-analytics` (`utils/factory.ts:179-181`); `s3_vectors` acepta `s3-vectors` **o** `s3_vectors` (`utils/factory.ts:194-196`).
- Cuidado con guiones vs. underscores: `azure-ai-search` (guiones) pero `azure_mysql`, `upstash_vector`, `vertex_ai_vector_search` (underscores). Un provider mal escrito lanza en el default de la factory.

### Cómo `Memory.search` consume el store (flujo end-to-end del store)

`memory/index.ts` orquesta la búsqueda híbrida sobre el store (`memory/index.ts` a partir de `search`, línea `1300`):

1. Exige scope: si `effectiveFilters` no trae `user_id`/`agent_id`/`run_id`, **lanza** `"filters must contain at least one of: user_id, agent_id, run_id"` (`throw` en `memory/index.ts:1385`).
2. Preprocesa: `queryLemmatized = lemmatizeForBm25(query)`, `queryEntities = extractEntities(query)`.
3. **Embed de la query** (`this.embedder.embed(query, "search")`) — **[para construir encima] costo: 1 llamada de embedding por búsqueda.**
4. Semántica: `this.vectorStore.search(queryEmbedding, internalLimit, effectiveFilters)` con **over-fetch** `internalLimit = Math.max(topK * 4, 60)` (`memory/index.ts:1401`).
5. Keyword (opcional, guard `typeof`): `keywordSearch(queryLemmatized, internalLimit, effectiveFilters)`, con `?? null` y `try/catch` a `null` (`memory/index.ts:1414-1425`).
6. BM25 solo si `keywordResults` truthy: normaliza con `getBm25Params`/`normalizeBm25` los `score` (descarta `rawScore <= 0`), `memory/index.ts:1429-1440`.
7. Boosts de entidad sobre el entity store.

En el lado de escritura, `addToVectorStore` (`memory/index.ts:797`) tiene dos modos **[para construir encima] con costos distintos**:
- `infer === false`: guarda los mensajes crudos vía `createMemory` (salta `message.role === "system"`, `memory/index.ts:806`), **sin LLM**, solo 1 embedding por memoria.
- `infer === true`: **1 embedding de contexto** (`embed(parsedMessages, "search")`, `memory/index.ts:848`) + `vectorStore.search(queryEmbedding, 10, filters)` para traer memorias existentes (`memory/index.ts:849`) + **1 llamada LLM** de extracción (`generateResponse`, `memory/index.ts:883`) con la opción `{ type: "json_object" }` (`memory/index.ts:888`); si el LLM falla, lanza `LLMError` (`memory/index.ts:892`). La deduplicación por `hash` md5 evita insertar textos ya presentes (`memory/index.ts:977`).

**[para construir encima] Qué NO hace la capa de stores:**
- No embebe texto: `search` recibe `number[]`; el embedding lo pone `Memory`.
- No normaliza el payload de forma uniforme entre stores (camelCase vs snake_case difiere; `memory` normaliza solo los tres `*_id`, Qdrant no normaliza nada).
- No garantiza BM25: con Qdrant/Elasticsearch/Pinecone/Vertex/Chroma/Redis/Valkey/Supabase/Langchain/Vectorize/Neptune/Turbopuffer/Cassandra/S3, `keywordSearch` es `null`/ausente y el componente léxico se apaga sin aviso.
- `get`/`list` no traen `score`. `list` no garantiza total global (Qdrant devuelve largo de página; `memory` sí devuelve el conteo tras filtrar).
- Qdrant en modo `path` sin `onDisk: true` **borra el directorio local** en cada construcción.

## 7. Configuración, factories, providers e historial

Esta sección documenta el pipeline de configuración de **mem0 OSS v3.1.0** (entrada `mem0ai/oss`): cómo se define el default, cómo `ConfigManager.mergeConfig` lo fusiona y valida con Zod, cómo las cinco factories materializan providers concretos, la lista completa de providers soportados en 3.1.0, y el subsistema de historial (`ADD`/`UPDATE`/`DELETE`, backends sqlite/supabase/memory, y el bypass `DummyHistoryManager`). Todas las citas son relativas a `src/oss/src`.

### Defaults reales (`config/defaults.ts`)

El objeto `DEFAULT_MEMORY_CONFIG` es la única fuente de valores por defecto. Transcripción fiel (`config/defaults.ts:3`):

```ts
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  disableHistory: false,
  version: "v1.1",
  embedder: {
    provider: "openai",
    config: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "text-embedding-3-small",
    },
  },
  vectorStore: {
    provider: "memory",
    config: {
      collectionName: "memories",
      dimension: 1536,
    },
  },
  llm: {
    provider: "openai",
    config: {
      baseURL: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-5-mini",
      modelProperties: undefined,
    },
  },
  historyStore: {
    provider: "sqlite",
    config: {
      historyDbPath: "memory.db",
    },
  },
};
```

Valores concretos por defecto:

| Campo | Default |
|---|---|
| `disableHistory` | `false` |
| `version` | `"v1.1"` |
| `embedder.provider` | `"openai"` · modelo `text-embedding-3-small` |
| `vectorStore.provider` | `"memory"` (in-process) · colección `"memories"` · `dimension` `1536` |
| `llm.provider` | `"openai"` · modelo `gpt-5-mini` · `baseURL` `https://api.openai.com/v1` |
| `historyStore.provider` | `"sqlite"` · `historyDbPath` `"memory.db"` |

**[para construir encima]**
- `apiKey` de embedder y LLM cae a `""` cuando `OPENAI_API_KEY` no está seteada (en el merge, la rama `apiKey` toma `defaultConf.apiKey`, que es `process.env.OPENAI_API_KEY || ""`). El SDK de OpenAI se construye igual con un string vacío — `new Memory()` **no lanza**. El probe de embedding disparado por `_autoInitialize()` (ver más abajo) se ejecuta de forma **asíncrona y fire-and-forget** desde el constructor; si falla (p.ej. 401 por apiKey vacía), su error se captura en `this._initError` y se **re-lanza recién en la primera llamada pública** vía `_ensureInitialized()`, no desde `new Memory()`.
- El default vectorial es `"memory"`: **un store en RAM, no persistente**. Nada de lo indexado sobrevive al proceso salvo que cambies de provider. El único store con persistencia por defecto es el historial (`sqlite` → `memory.db` en disco).
- `gpt-5-mini` es el LLM de extracción por defecto; cada `add()` gasta tokens de este modelo (ver sección OpenAI LLM).

### `ConfigManager.mergeConfig`: fusión campo por campo + validación Zod

Punto de entrada único, estático, llamado desde el constructor de `Memory` en `memory/index.ts:192`. Firma: `static mergeConfig(userConfig: Partial<MemoryConfig> = {})` (`config/manager.ts:5`). No es un merge profundo genérico: **cada rama tiene su propia lógica de precedencia**.

**version** (`config/manager.ts:10`): `userConfig.version || DEFAULT` → `"v1.1"`.

**embedder** (`config/manager.ts:11-61`):
- `provider` = `userConfig.embedder?.provider || "openai"`; se computa `embedderProviderKey = provider.toLowerCase()`.
- El modelo: si el provider es `fastembed`, `finalModel` arranca `undefined` (FastEmbed tiene su propio set fijo de modelos y default propio); en cualquier otro caso arranca con el default `text-embedding-3-small`. Un `userConf.model` string u object lo sobreescribe.
- Normaliza snake_case de configs del SDK Python/OpenClaw: `baseURL = userConf?.baseURL ?? lmstudio_base_url ?? userConf?.url`; `embeddingDims = userConf?.embeddingDims ?? embedding_dims`.
- Orden del merge (`config/manager.ts:42-59`): **spread de `userConf` primero** (para que sobrevivan claves específicas del provider, p.ej. `location`/`googleProjectId`/`vertexCredentialsJson` de Vertex AI), y luego los valores normalizados (`apiKey`, `model`, `baseURL`, `url`, `embeddingDims`, `modelProperties`) **ganan** por ir después.

**vectorStore** (`config/manager.ts:62-107`):
- `provider` se **normaliza a lowercase acá mismo** (`config/manager.ts:67-70`). Comentario del código: las factories ya matchean case-insensitive, pero las comparaciones `provider === "memory"` que eligen ajustes de entity-store NO, así que se normaliza una sola vez aquí.
- `dimension` resuelto (`config/manager.ts:81-84`): `userConf?.dimension || userConfig.embedder?.config?.embeddingDims || undefined`. Si queda `undefined`, se deja así **a propósito** para que `Memory._autoInitialize()` la autodetecte con un probe.
- Dos ramas: si el usuario pasó `client` (instancia de objeto), se preserva junto con `collectionName`/`dimension` y spread del resto; si no, se hace merge estándar con `collectionName` default `"memories"` y `client: undefined` (para no arrastrar un client de los defaults).

**llm** (`config/manager.ts:108-180`):
- `provider` default `"openai"`. Modelo object/string sobre default `gpt-5-mini`.
- `llmBaseURL` con cadena de fallback amplia (`config/manager.ts:126-136`): `baseURL ?? vllmBaseURL ?? vllm_base_url ?? lmstudio_base_url ?? url ?? (provider === "vllm" ? undefined : defaultConf.baseURL)`. Es decir, para `vllm` sin baseURL explícita queda `undefined`; para el resto cae al default `https://api.openai.com/v1`.
- `temperature`, `topP`, `maxTokens` toleran snake_case (`top_p`, `max_tokens`).
- Passthrough de credenciales AWS Bedrock (`awsRegion`/`awsAccessKeyId`/`awsSecretAccessKey`/`awsSessionToken`, con aliases snake_case) para que `aws_bedrock` funcione por el path estándar. Igual que embedder, hace **spread de `userConf` primero** y luego pisa con los normalizados — el comentario lo llama a hacer significativo el `.passthrough()` del schema.

**historyDbPath** (top-level, `config/manager.ts:181-184`): `userConfig.historyDbPath || userConfig.historyStore?.config?.historyDbPath || default("memory.db")`.

**historyStore** (`config/manager.ts:186-205`): precedencia `explicit historyStore.config > top-level historyDbPath > default`. Solo cuando `provider` es `sqlite` (`isSqlite`) se mergean el config default y el `historyDbPath` top-level; para providers no-sqlite el config default de sqlite **no** se arrastra.

**disableHistory** (`config/manager.ts:206-207`): `userConfig.disableHistory || false`.

**reranker** (`config/manager.ts:208`): `reranker: userConfig.reranker` — **pass-through crudo, sin defaults en el merge**. Los defaults del reranker viven en `RerankerFactory` (ver abajo).

**Validación Zod** (`config/manager.ts:212`): `return MemoryConfigSchema.parse(mergedConfig)`. El schema está en `types/index.ts:181`:
- `embedder.config` es un objeto **sin `.passthrough()`** con campos tipados (incluye claves Vertex AI explícitas: `vertexCredentialsJson`, `googleServiceAccountJson`, `googleProjectId`, `location`, `memoryAdd/Update/SearchEmbeddingType`). `vectorStore.config` y `llm.config` usan `.passthrough()` (`types/index.ts:212`, `types/index.ts:236`) → aceptan claves extra. `historyStore.config` y `reranker.config` son `z.record(z.string(), z.any())` (`types/index.ts:243`, `types/index.ts:249`).
- `reranker`, `historyStore`, `disableHistory` son `.optional()` (`types/index.ts:245`, `:251`, `:252`).

**[para construir encima]**
- `MemoryConfigSchema.parse` corre **síncronamente** dentro de `new Memory()` (via `mergeConfig`), así que lanza `ZodError` en la construcción si el merge produce algo fuera de schema.
- `embedder.config` es un `z.object()` **sin `.passthrough()` ni `.strict()`**: por el comportamiento por defecto de Zod, una clave **desconocida** dentro de `embedder.config` **se descarta silenciosamente** (strip), no se rechaza — incluso si `manager.ts` la spread-eó desde `userConf`, `parse()` la elimina si no está en el whitelist. En cambio, un **tipo equivocado en una clave conocida** (p.ej. `embeddingDims: "1536"` como string, que el schema exige `z.number()`) **sí lanza `ZodError`**.
- Las resoluciones usan `||` (falsy), no `??`, en `dimension`, `collectionName`, `historyDbPath` y `disableHistory`: un `dimension: 0` o `disableHistory: false` explícitos se comportan como "no provisto" → caen al default. Para `disableHistory` da igual (default `false`); para `dimension: 0` sería ignorado (irreal).
- El constructor luego hace `this.apiVersion = this.config.version || "v1.0"` (`memory/index.ts:222`): el default efectivo del merge es `"v1.1"`, pero si `version` llegara vacío el fallback interno es `"v1.0"`.

### Las cinco factories (`utils/factory.ts`)

Todas son clases con un `static create(provider, config)` que hace `switch (provider.toLowerCase())` y **lanza `Error(\`Unsupported ... provider: ${provider}\`)` en el `default`**. Punto crítico de **cuándo** lanza:

- `EmbedderFactory.create`, `LLMFactory.create`, `RerankerFactory.create` y `HistoryManagerFactory.create` se invocan **síncronamente en el constructor** de `Memory` (`memory/index.ts:195`, `:202`, `:207`, `:215`). Un provider no soportado en cualquiera de estos **lanza directamente desde `new Memory()`**.
- `VectorStoreFactory.create` se invoca en `_autoInitialize()` (`memory/index.ts:251`), que corre diferido y su throw se captura en `this._initError` (`memory/index.ts:227-231`); ese error se **re-lanza recién en la primera llamada pública** vía `_ensureInitialized()` (que además reintenta una vez el `_autoInitialize` antes de propagar). Es decir: un vector store provider inválido **no** rompe la construcción, rompe el primer `add`/`search`/etc.

#### EmbedderFactory (`utils/factory.ts:74`) — 10 providers (11 casos)

`openai`, `ollama`, `lmstudio`, `together`, `google` / `gemini` (mismo `GoogleEmbedder`), `azure_openai`, `fastembed`, `langchain`, `vertexai`, `huggingface`. Default → throw `Unsupported embedder provider`.

Nuevos en 3.1.0 respecto a la base pedida: **`fastembed`**, **`huggingface`**, **`together`**, **`vertexai`** están presentes.

#### LLMFactory (`utils/factory.ts:104`) — 18 providers (19 casos)

`openai`, `openai_structured`, `anthropic`, `groq`, `ollama`, `lmstudio`, `google` / `gemini` (mismo `GoogleLLM`, dos etiquetas), `azure_openai`, `mistral`, `langchain`, `deepseek`, `xai`, `sarvam`, `aws_bedrock`, `litellm`, `minimax`, `together`, `vllm`. Default → throw.

Presentes en 3.1.0: **`aws_bedrock`**, **`litellm`**, **`minimax`**, **`sarvam`**, **`together`**, **`vllm`**, **`xai`**. Verificado en el fuente: `deepseek`, `xai`, `lmstudio`, `litellm`, `minimax`, `sarvam`, `together`, `vllm` **extienden `OpenAILLM`** (`export class ... extends OpenAILLM`) — son clientes OpenAI-compatibles con distinto `baseURL`. En cambio `openai_structured` y `aws_bedrock` **implementan `LLM` directamente** (no heredan de `OpenAILLM`).

#### VectorStoreFactory (`utils/factory.ts:150`) — 27 casos (25 stores + aliases)

`memory`, `baidu`, `qdrant`, `chroma`, `redis`, `valkey`, `supabase`, `langchain`, `vectorize`, `azure-ai-search`, `vertex_ai_vector_search`, `pgvector`, `databricks`, `neptune` / `neptune-analytics` (mismo `NeptuneAnalyticsVectorStore`), `elasticsearch`, `opensearch`, `upstash_vector`, `azure_mysql`, `cassandra`, `pinecone`, `s3-vectors` / `s3_vectors` (mismo `S3Vectors`), `turbopuffer`, `milvus`, `mongodb`, `weaviate`. Default → throw.

**[para construir encima] — el naming es inconsistente y hay que matchear exacto** (post-lowercase): con guion `azure-ai-search`, `neptune-analytics`, `s3-vectors`; con guion bajo `vertex_ai_vector_search`, `upstash_vector`, `azure_mysql`, `s3_vectors`. Salvo `memory` (que entra como `new MemoryVectorStore(config)`, `utils/factory.ts:154`), el resto de los stores reciben el config como `config as any` (`utils/factory.ts:156` en adelante) — **no hay validación por-store en esta capa**, cada store valida lo suyo internamente.

#### RerankerFactory (`utils/factory.ts:211`) — 5 casos

```ts
switch (provider.toLowerCase()) {
  case "cohere":
    return new CohereReranker(config);
  case "zero_entropy":
    return new ZeroEntropyReranker(config);
  case "sentence_transformer":
    return new CrossEncoderReranker(config, "Xenova/ms-marco-MiniLM-L-6-v2");
  case "huggingface":
    return new CrossEncoderReranker(config, "Xenova/bge-reranker-base", 512);
  case "llm_reranker": {
    const llm = RerankerFactory.buildLLMRerankerLLM(config);
    return new LLMReranker(config, llm);
  }
  default:
    throw new Error(`Unsupported reranker provider: ${provider}`);
}
```

- `sentence_transformer` y `huggingface` ambos construyen `CrossEncoderReranker` pero con **modelo por defecto y `maxLength` distintos**: `Xenova/ms-marco-MiniLM-L-6-v2` (sin tercer arg) vs `Xenova/bge-reranker-base` con `512`.
- `llm_reranker` arma su LLM con `buildLLMRerankerLLM` (`utils/factory.ts:238`). Defaults efectivos cuando faltan: `provider` `"openai"`, `model` `"gpt-4o-mini"`, `temperature` `0.0`, `maxTokens` `100`. Si hay `config.llm` anidado, ese `provider`/`config` mandan y el top-level (`config.provider`/`model`/`temperature`/`maxTokens`) solo actúa de fallback para lo que falte; si no hay anidado, se usan los campos top-level del `RerankerConfig`. El `apiKey` top-level se propaga al LLM solo si el LLM no trae uno (`if (config.apiKey && llmConfig.apiKey === undefined)`).
- El reranker **es opcional** en el constructor: solo se crea si `this.config.reranker` existe (`memory/index.ts:206`). Sin `reranker` en la config, `Memory` no instancia ninguno (`this.reranker` queda `null`).

Semántica documentada de `RerankerConfig` (`types/index.ts:80`): `topK` (default unset → devuelve todos), `returnDocuments`/`maxChunksPerDoc` solo `cohere`, `device`/`maxLength`/`normalize` solo cross-encoder (`normalize` default `true`), `batchSize`/`showProgressBar` son **no-ops** en este runtime.

#### HistoryManagerFactory (`utils/factory.ts:274`) — 3 casos

```ts
switch (provider.toLowerCase()) {
  case "sqlite":
    return new SQLiteManager(config.config.historyDbPath || ":memory:");
  case "supabase":
    return new SupabaseHistoryManager({
      supabaseUrl: config.config.supabaseUrl || "",
      supabaseKey: config.config.supabaseKey || "",
      tableName: config.config.tableName || "memory_history",
    });
  case "memory":
    return new MemoryHistoryManager();
  default:
    throw new Error(`Unsupported history store provider: ${provider}`);
}
```

- `sqlite` sin `historyDbPath` → `":memory:"` (SQLite en RAM, no persistente). Con el default del merge, el path es `"memory.db"` (en disco).
- `supabase`: `supabaseUrl`/`supabaseKey` caen a `""` si faltan; `tableName` default `"memory_history"`.

### Subsistema de historial: interfaz, backends y `disableHistory`

La interfaz común `HistoryManager` se importa desde `../storage/base` (`utils/factory.ts:46`); el fichero base no está en este extracto, pero su forma es observable e idéntica en las cuatro implementaciones: métodos `addHistory(memoryId, previousValue, newValue, action, createdAt?, updatedAt?, isDeleted=0)`, `getHistory(memoryId)`, `reset()`, `close()`. Solo `SQLiteManager` añade `saveMessages`, `getLastMessages` y `batchAddHistory`; los call-sites las invocan **defensivamente** con `typeof this.db.X === "function"` (`memory/index.ts:832` para `getLastMessages`, `:922` para `saveMessages`, `:1057` para `batchAddHistory`), así los managers que no las tienen degradan sin romper.

**Dónde se escribe historial y con qué `action`** (strings literales):
- `"ADD"` en `createMemory` (`addHistory` en `memory/index.ts:1908`, action en `:1912`) y en la ruta batch (`memory/index.ts:1051`, con fallback a `addHistory` uno-a-uno en `:1064`/`:1079` si `batchAddHistory` no existe).
- `"UPDATE"` en `updateMemory` (`addHistory` en `:1955`, action en `:1959`), con `previousValue` = texto viejo (`prevValue`), `newValue` = texto nuevo (`newData`).
- `"DELETE"` en `deleteMemory` (`addHistory` en `:1990`, action en `:1994`), con `newValue = null` e `isDeleted = 1`.

**Método público `history()`** (`memory/index.ts:1744`):
```ts
async history(memoryId: string): Promise<any[]> {
  await this._ensureInitialized();
  const result = await this.db.getHistory(memoryId);
  await this._displayFirstRunNotice("history");
  return result;
}
```
Devuelve **crudo** lo que retorne el backend (filas snake_case en sqlite/supabase, objetos en memory) — no normaliza ni castea.

**Método público `reset()`** (`memory/index.ts:1751`): tras `_ensureInitialized()` y `_captureEvent("reset")`, llama `this.db.reset()` y luego `vectorStore.deleteCol()` (**salta** el borrado de colección si el provider es `langchain`, `memory/index.ts:1757`); si existe `_entityStore`, también intenta borrar su colección y lo resetea a `undefined`.

#### `SQLiteManager` (`storage/SQLiteManager.ts:6`)

- `better-sqlite3` síncrono. `constructor(dbPath)` llama `ensureSQLiteDirectory(dbPath)` (crea el directorio) y `init()`.
- `init()` (`storage/SQLiteManager.ts:17`) crea dos tablas `IF NOT EXISTS`: `memory_history(id INTEGER PK AUTOINCREMENT, memory_id NOT NULL, previous_value, new_value, action NOT NULL, created_at, updated_at, is_deleted INTEGER DEFAULT 0)` y `messages(id PK, session_scope, role, content, name, created_at)`. Prepara `stmtInsert` y `stmtSelect`.
- `getHistory` (`storage/SQLiteManager.ts:70`): ejecuta `stmtSelect` = `SELECT * ... WHERE memory_id = ? ORDER BY id DESC` — **sin `LIMIT`**, devuelve todas las filas.
- `saveMessages` (`storage/SQLiteManager.ts:74`): inserta en transacción y **evacúa** dejando solo los últimos 10 mensajes por `session_scope`. `getLastMessages` (`storage/SQLiteManager.ts:110`) default `limit=10`, devuelve en orden ascendente.
- `batchAddHistory` (`storage/SQLiteManager.ts:141`): inserta N registros en una transacción.
- `reset` (`storage/SQLiteManager.ts:168`): `DROP TABLE IF EXISTS` de ambas y `init()` de nuevo. `close()` cierra la DB.

#### `MemoryHistoryManager` (`storage/MemoryHistoryManager.ts:14`)

- Backing store: `Map<string, HistoryEntry>` en RAM, clave = `uuidv4()`.
- `getHistory` (`storage/MemoryHistoryManager.ts:40`): filtra por `memory_id`, ordena por `created_at` descendente y **`.slice(0, 100)` — techo duro de 100 entradas devueltas**.
- `reset()` limpia el Map. `close()` es no-op. **No** implementa `saveMessages`/`getLastMessages`/`batchAddHistory` → los guards `typeof` hacen que el pipeline caiga a inserción por-fila y a "sin contexto de mensajes previos".

#### `SupabaseHistoryManager` (`storage/SupabaseHistoryManager.ts:22`)

- `constructor` guarda `tableName` (default `"memory_history"`), crea el client y llama `initializeSupabase().catch(console.error)` — la verificación de tabla es **async y su rechazo se traga a `console.error`**, así que el constructor no rechaza.
- `initializeSupabase` (`storage/SupabaseHistoryManager.ts:32`): hace un `select("id").limit(1)`; si hay error, **imprime por consola el DDL SQL exacto** que el usuario debe correr en el SQL Editor de Supabase y `throw error` (dentro del `.catch` del constructor).
- `getHistory` (`storage/SupabaseHistoryManager.ts:89`): `.eq("memory_id", ...).order("created_at", desc).limit(100)`. `reset` borra todo (`delete().neq("id", "")`). `close()` no-op.

**[para construir encima] Supabase:** la tabla debe **preexistir** — mem0 no la crea, solo imprime el DDL. Techo de 100 en `getHistory`.

#### `DummyHistoryManager` (`storage/DummyHistoryManager.ts:1`) y `disableHistory`

Todos los métodos son no-ops: `addHistory` retorna, `getHistory` retorna `[]`, `reset`/`close` no hacen nada. Nótese que **no usa `implements HistoryManager`** — es duck-typed, encaja por forma.

Wiring en el constructor (`memory/index.ts:212`):
```ts
if (this.config.disableHistory) {
  this.db = new DummyHistoryManager();
} else {
  this.db = HistoryManagerFactory.create(
    this.config.historyStore!.provider,
    this.config.historyStore!,
  );
}
```

**[para construir encima] `disableHistory: true`:** `history()` **siempre devuelve `[]`**, no se persiste ninguna traza `ADD`/`UPDATE`/`DELETE`. Las operaciones sobre el vector store siguen funcionando; lo que se pierde es todo el audit trail y el `previous_value`. Es el switch más barato para eliminar I/O de historial en cada `add`.

### `OpenAILLM` (`llms/openai.ts`) — costo y comportamiento observable

- `constructor(config)` (`llms/openai.ts:9`): `new OpenAI({ apiKey, baseURL, ...(config.timeout != null && { timeout: config.timeout }) })`; `this.model = config.model || "gpt-5-mini"`. El default de modelo se repite aquí (además del del merge).
- `generateResponse(messages, responseFormat?, tools?)` (`llms/openai.ts:18`): `chat.completions.create` con los mensajes mapeados (content stringificado con `JSON.stringify` si no es string), `model`, `response_format` (casteado a `text`/`json_object`) y, solo si hay `tools`, `{ tools, tool_choice: "auto" }`. Si la respuesta trae `tool_calls`, devuelve un `LLMResponse` `{ content: content || "", role, toolCalls: [{ name, arguments }] }`; si no, devuelve el string de `content` (o `""`).
- `generateChat(messages)` (`llms/openai.ts:55`): completion simple sin `response_format` ni `tools`, devuelve `{ content: content || "", role }`.

**[para construir encima] costo LLM:** cada `add()` dispara llamadas a este LLM (extracción de hechos + decisión de update). El `baseURL` configurable es lo que permite que `deepseek`/`xai`/`lmstudio`/`litellm`/`minimax`/`sarvam`/`together`/`vllm` reutilicen esta clase (por herencia de `OpenAILLM`) apuntando a endpoints OpenAI-compatibles. El pipeline de memoria usa `response_format` `json_object` para forzar salida parseable.

### `OpenAIEmbedder` (`embeddings/openai.ts`) — probe de dimensión y batching

- `constructor(config)` (`embeddings/openai.ts:10`): client con `apiKey` y `baseURL || url`; `this.model = config.model || "text-embedding-3-small"`; `this.embeddingDims = config.embeddingDims` (puede ser `undefined`). Nótese que este constructor **no** propaga `timeout` (a diferencia de `OpenAILLM`).
- `embed(text)` (`embeddings/openai.ts:19`): `embeddings.create({ model, input: text, encoding_format: "float", ...(embeddingDims !== undefined && { dimensions: embeddingDims }) })`, devuelve `response.data[0].embedding`.
- `embedBatch(texts)` (`embeddings/openai.ts:31`): trocea en chunks de **`MAX_BATCH = 100`** (`embeddings/openai.ts:32`), reordena cada respuesta por `item.index`, y **lanza `Error`** si el total de embeddings devueltos no coincide con `texts.length` (`embeddings/openai.ts:50-53`).

**[para construir encima] embeddings:**
- El **probe de dimensión** corre en `_autoInitialize()` (`memory/index.ts:238`): **solo cuando `!vectorStore.config.dimension`** (falsy), llama `this.embedder.embed("dimension probe")` (`memory/index.ts:241`) y usa `probe.length` como `dimension`. Con el default `dimension: 1536` **no hay probe**; solo se dispara cuando la dimensión quedó `undefined` tras el merge → **una llamada de embedding extra al startup** (con costo) por cada `new Memory()` sin dimensión explícita. Si el probe falla, lanza un error que pide setear `dimension` (en `vectorStore.config`) o `embeddingDims` (en `embedder.config`) manualmente (`memory/index.ts:244`).
- `text-embedding-3-small` produce 1536 dims, coincidente con el default `dimension: 1536`. Setear `embeddingDims` envía el parámetro `dimensions` de OpenAI (reducción de dimensión del lado del modelo).
- **Qué NO hace este embedder:** su `embed(text)` acepta un solo argumento; los call-sites internos pasan un segundo argumento de "tipo" (p.ej. `embed(newData, "update")` en `memory/index.ts:1942`, o `"add"`/`"search"` en otros sitios) que **este `OpenAIEmbedder` ignora** — es relevante solo para embedders con tipos de embedding diferenciados (p.ej. Vertex AI).

## 8. Multimodal (visión), CRUD, expiración y operaciones

Esta sección documenta, sobre el código real de `mem0ai/oss` v3.1.0, cómo la ingesta acepta imágenes (`image_url`), el CRUD explícito de memorias, el nuevo mecanismo de expiración (`expiration_date`), y qué parámetros son Platform-only y **lanzan error** en OSS. Todas las ubicaciones son relativas a `src/oss/src`.

### Ingesta multimodal: `parse_vision_messages` → `get_image_description`

Dentro de `add()`, tras normalizar los mensajes a array, se llama a `parse_vision_messages` justo antes de escribir al vector store (`memory/index.ts:761`):

```ts
const parsedMessages = Array.isArray(messages)
  ? (messages as Message[])
  : [{ role: "user", content: messages }];

const final_parsedMessages = await parse_vision_messages(parsedMessages);

// Add to vector store
const vectorStoreResult = await this.addToVectorStore(
  final_parsedMessages,
  metadata,
  filters,
  infer,
);
```

El tipo de contenido multimodal es estrecho: `interface MultiModalMessages { type: "image_url"; image_url: { url: string } }` (`types/index.ts:3`), y `Message.content = string | MultiModalMessages` (`interface Message` en `types/index.ts:10`, campo `content` en `:12`). No hay soporte de tipos para `image_base64`, `image` u otros; el único caso reconocido es `type: "image_url"`.

`parse_vision_messages` (`utils/memory.ts:22`) recorre los mensajes uno a uno:

```ts
const parse_vision_messages = async (messages: Message[]) => {
  const parsed_messages = [];
  for (const message of messages) {
    let new_message = {
      role: message.role,
      content: "",
    };
    if (message.role !== "system") {
      if (
        typeof message.content === "object" &&
        message.content.type === "image_url"
      ) {
        const imageUrl = message.content.image_url?.url;
        if (!imageUrl) {
          throw new Error("image_url content part is missing image_url.url");
        }
        const description = await get_image_description(imageUrl);
        new_message.content =
          typeof description === "string"
            ? description
            : JSON.stringify(description);
        parsed_messages.push(new_message);
      } else parsed_messages.push(message);
    }
  }
  return parsed_messages;
};
```

Flujo paso a paso y comportamiento observable:

1. **Mensajes `system` se descartan silenciosamente.** El bloque completo está dentro de `if (message.role !== "system")`; un mensaje `system` nunca entra a `parsed_messages`. **[para construir encima]** cualquier prompt de sistema que pases a `add()` se pierde antes de la extracción — no llega ni al VLM ni al pipeline. (En el camino `infer:false` de `addToVectorStore`, los `system` también se saltan; `memory/index.ts:806`.)
2. **Solo se trata como imagen** cuando `typeof content === "object"` y `content.type === "image_url"`. Un string normal cae en el `else` y se hace push **tal cual** (objeto `message` original, no `new_message`).
3. **`image_url.url` faltante/vacío lanza** `Error("image_url content part is missing image_url.url")` (`utils/memory.ts:36`) — aborta todo el `add()`.
4. Con URL válida se llama `get_image_description(imageUrl)`; la descripción sustituye el contenido. Si `description` no es string, se serializa con `JSON.stringify`.

`get_image_description` (`utils/memory.ts:4`):

```ts
const get_image_description = async (image_url: string) => {
  const llm = new OpenAILLM({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const response = await llm.generateResponse([
    {
      role: "user",
      content:
        "Provide a description of the image and do not include any additional text.",
    },
    {
      role: "user",
      content: { type: "image_url", image_url: { url: image_url } },
    },
  ]);
  return response;
};
```

Detalles críticos **[para construir encima]**:

- **VLM fijo, no configurable.** Instancia un `OpenAILLM` nuevo con `apiKey: process.env.OPENAI_API_KEY` y **sin `model`**, por lo que usa el default `"gpt-5-mini"` (`this.model = config.model || "gpt-5-mini"`, `llms/openai.ts:15`). **Ignora por completo el `llm` configurado en tu `Memory`** (provider/model/apiKey/baseURL). Si usas otro provider (Anthropic, Ollama, etc.), la descripción de imagen sigue yendo a OpenAI con la clave de entorno; sin `OPENAI_API_KEY` en el entorno, la llamada falla.
- **La imagen se envía como texto JSON, no como parte de visión nativa.** `OpenAILLM.generateResponse` mapea el contenido así (`llms/openai.ts:28`):

  ```ts
  content:
    typeof msg.content === "string"
      ? msg.content
      : JSON.stringify(msg.content),
  ```

  El objeto `{ type: "image_url", image_url: { url } }` se convierte en el string `'{"type":"image_url","image_url":{"url":"..."}}'` y se manda como un mensaje `user` de texto plano en `chat.completions.create`. No se construye una content-part de imagen de la API de OpenAI. El modelo recibe la URL como texto, no como adjunto de imagen.
- **El prompt exacto** enviado es literal: `"Provide a description of the image and do not include any additional text."`
- **Costo:** una llamada LLM adicional **por cada mensaje `image_url`** (secuencial, `await` dentro del `for`), antes y aparte del pipeline de extracción aditiva de `addToVectorStore`. `generateResponse` devuelve `response.content || ""` (string, `llms/openai.ts:52`) salvo que haya `tool_calls` (no aplica aquí), así que `description` normalmente es string.

Tras `parse_vision_messages`, `final_parsedMessages` (imágenes ya convertidas a texto descriptivo, mensajes de texto intactos, `system` eliminados) alimenta el pipeline aditivo estándar (`addToVectorStore`, `memory/index.ts:797`), con `infer = true` por default (`const { metadata = {}, filters = {}, infer = true } = config;`, `memory/index.ts:734`). Con `infer:false` no hay extracción: cada mensaje no-`system` se guarda verbatim vía `createMemory` (`memory/index.ts:809`, dentro del bloque `if (!infer)` que abre en `:803`).

### Expiración (NUEVO en 3.1.0): `expiration_date`, normalización estricta y ocultamiento

El módulo `utils/expiration.ts` gobierna todo. La clave de payload almacenada es **`expiration_date`** (snake_case), en formato `YYYY-MM-DD`.

**Normalización estricta** — `normalizeExpirationDate` (`utils/expiration.ts:22`); el patrón es un const de módulo en `utils/expiration.ts:8`:

```ts
const EXPIRATION_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeExpirationDate(value: string): string {
  const match = EXPIRATION_DATE_PATTERN.exec(value);
  if (match) {
    const [, year, month, day] = match;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day)
    ) {
      return value;
    }
  }
  throw new Error("expirationDate must be a valid date in YYYY-MM-DD format.");
}
```

Comportamiento y edge cases **[para construir encima]**:

- Exige el patrón `YYYY-MM-DD` **y** que la fecha sea real en UTC (round-trip). Rechaza deliberadamente formatos que `new Date()` aceptaría: `"12/31/2099"`, `"2099"`, y **rollover** como `"2099-02-30"` (que `new Date` volcaría a marzo). En todos esos casos **lanza** `"expirationDate must be a valid date in YYYY-MM-DD format."`
- En éxito devuelve el **mismo string** de entrada (no lo reescribe).
- Es UTC-puro: no hay corrimiento por zona horaria local.

**Chequeo de vencimiento** — `payloadIsExpired` (`utils/expiration.ts:40`):

```ts
export function payloadIsExpired(
  payload: Record<string, any> | null | undefined,
) {
  const raw = payload?.expiration_date;
  if (!raw) return false;
  try {
    // YYYY-MM-DD sorts lexicographically the same way it sorts chronologically.
    return normalizeExpirationDate(String(raw)) < todayUtc();
  } catch {
    // Unparseable stored value: treat as non-expiring rather than hiding data.
    return false;
  }
}
```

- Sin `expiration_date` (o falsy) → `false` (nunca expira).
- Comparación **lexicográfica** de strings `YYYY-MM-DD` (equivalente a cronológica) contra `todayUtc()` = `new Date().toISOString().slice(0, 10)` (`utils/expiration.ts:10-12`). Estrictamente **antes de hoy** = expirado; **hoy o futuro** = vigente.
- **Fail-open:** si el valor almacenado es imparseable, el `catch` devuelve `false` (se trata como no-expirable en vez de ocultar datos).

**Dónde se escribe la expiración:**

- `add()` (`memory/index.ts:747`): `if (config.expirationDate != null) { metadata.expiration_date = normalizeExpirationDate(config.expirationDate); }`. `null`/`undefined` → no se setea. Formato inválido → **lanza** y aborta el `add()`.
- `update()` (`memory/index.ts:1662`):

  ```ts
  const updateMetadata: Record<string, any> = { ...metadata };
  if (expirationDate !== undefined) {
    updateMetadata.expiration_date =
      expirationDate === null
        ? null
        : normalizeExpirationDate(expirationDate);
  }
  ```

  El gate es `!== undefined`: `expirationDate: null` **limpia** la fecha (setea `expiration_date: null`); un string la normaliza; `undefined` la deja intacta. `update()` acepta actualizar solo la expiración: la guarda de `memory/index.ts:1656` permite pasar únicamente `expirationDate` sin `text` ni `metadata`.

**Dónde se oculta la expiración (y dónde NO):**

- `search()`: `showExpired` default `false` (`memory/index.ts:1349`). En el paso 7 de construcción de candidatos (`memory/index.ts:1521-1522`): `.filter((mem) => showExpired || !payloadIsExpired(mem.payload))` — los expirados se descartan del pool **antes** del scoring (`scoreAndRank` en `:1530`).
- `getAll()`: `showExpired` default `false` (`memory/index.ts:1812`); over-fetch `fetchLimit = showExpired ? topK : Math.max(topK * 4, 60)` (`memory/index.ts:1842`), filtra por `payloadIsExpired` (`memory/index.ts:1845-1847`) y luego `.slice(0, topK)` (`memory/index.ts:1860`). **[para construir encima]** si tienes muchas memorias expiradas fuera de la ventana `fetchLimit`, aún puedes devolver menos de `topK` vigentes.
- **`get(memoryId)` NO filtra por expiración.** No hay ninguna llamada a `payloadIsExpired` en `get()` (`memory/index.ts:1248`): devuelve la memoria aunque esté vencida. **[para construir encima]** para respetar expiración a mano, revisa `result.metadata.expiration_date` tú mismo.
- `deleteAll()` tampoco es consciente de expiración: borra vigentes y expiradas por igual.

### CRUD explícito

**`get(memoryId)` → `MemoryItem | null`** (`memory/index.ts:1248`)

- `_ensureInitialized()`, luego `vectorStore.get(memoryId)`. Si no existe → `null` (más notice de primer uso). No hay `_captureEvent` en `get()`.
- Construye `MemoryItem`: `id`, `memory = payload.data`, `hash`, `createdAt`, `updatedAt`, `metadata`. Todas las claves de payload **excepto** el set `{userId, agentId, runId, hash, data, createdAt, updatedAt, textLemmatized, attributedTo}` se copian a `metadata` (`memory/index.ts:1272-1287`). Nota: el set de exclusión usa camelCase `userId/agentId/runId`, pero el payload guarda snake_case `user_id/agent_id/run_id`; esos snake_case **no** se excluyen y aparecen dentro de `metadata`, además de emitirse a top-level vía el spread de `filters` (`memory/index.ts:1256`, `:1289-1295`). `expiration_date` se expone en `metadata.expiration_date`.
- **[para construir encima]** `get()` es por-id puro: **no aplica ningún filtro de entidad ni autorización** — devuelve cualquier memoria de cualquier `user_id` si conoces el UUID. El aislamiento multi-tenant es responsabilidad de la capa que llama.

**`getAll(config)` → `SearchResult`** (`memory/index.ts:1803`)

- `rejectTopLevelEntityParams` (los ids de entidad deben ir en `config.filters`, no top-level), `validateSearchParams(undefined, config.topK)`.
- Requiere al menos uno de `user_id/agent_id/run_id` en `filters` o **lanza** `"filters must contain at least one of: user_id, agent_id, run_id..."` (`memory/index.ts:1834`).
- Over-fetch + filtro de expiración + `slice(0, topK)`. Usa `vectorStore.list(filters, fetchLimit)`. `topK` default `20`.
- **Sin costo de embeddings ni LLM** (es un listado, no una búsqueda semántica). Aquí el set de exclusión sí usa snake_case `user_id/agent_id/run_id` (`memory/index.ts:1849-1859`), difiere de `get()`.

**`update(memoryId, config)` → `{ message: "Memory updated successfully!" }`** (`memory/index.ts:1633`)

- `config` puede ser string (azúcar → `{ text: config }`). Destructura `data`, `metadata`, `expirationDate` y `text`. `data` es deprecado: emite `logger.warn` y hace fallback a `text` si `text == null` (`memory/index.ts:1646-1654`).
- Requiere al menos uno de `text`/`metadata`/`expirationDate` o **lanza** `"At least one of text, metadata, or expirationDate must be provided."` (`memory/index.ts:1656`).
- `updateMemory` (`memory/index.ts:1919`): `vectorStore.get`; no encontrado → **lanza** `Memory with ID ${memoryId} not found`. `newData = data ?? prevValue` (update solo-metadata reutiliza el texto guardado). Recalcula `hash` (md5), `textLemmatized`, `updatedAt`; preserva `createdAt`. Escribe `vectorStore.update` + `addHistory(..., "UPDATE", ...)`. Si el texto cambió, re-vincula el entity store.
- **[para construir encima] costo:** `update()` **re-embebe siempre**, incluso en updates de solo-metadata o solo-expiración: `existingEmbeddings` solo se llena si `text != null` (`memory/index.ts:1671`), pero `updateMemory` hace `embed(newData)` con `newData = prevValue` cuando no hay texto (`memory/index.ts:1940-1942`). El `metadata` se **mergea shallow** sobre el payload existente (`{ ...existingMemory.payload, ...metadata, data, hash, textLemmatized, createdAt, updatedAt }`, `memory/index.ts:1944`): reemplaza las claves que pases, pero no borra las que omitas.

**`delete(memoryId)` → `{ message: "Memory deleted successfully!" }`** (`memory/index.ts:1681`)

- `deleteMemory` (`memory/index.ts:1979`): `vectorStore.get`; no encontrado → **lanza** `Memory with ID ${memoryId} not found`. `vectorStore.delete` + `addHistory(memoryId, prevValue, null, "DELETE", undefined, undefined, 1)` (el último `1` marca borrado). Limpieza de entity store no-fatal (log y continúa).

**`deleteAll(config)` → `{ message: "Memories deleted successfully!" }`** (`memory/index.ts:1700`)

- Requiere al menos un filtro (`userId`/`agentId`/`runId`) o **lanza** ``"At least one filter is required to delete all memories. If you want to delete all memories, use the `reset()` method."`` (`memory/index.ts:1719`).
- `vectorStore.list(filters)` y luego **borra en bucle** `deleteMemory(memory.id)` uno por uno. **[para construir encima]** es N+1 (un `get`+`delete`+`addHistory` por memoria); no es atómico.

**`reset()` → `void`** (`memory/index.ts:1751`)

- `db.reset()`; si `config.vectorStore.provider !== "langchain"` → `vectorStore.deleteCol()` (con langchain se **salta** y avisa que los datos subyacentes no se limpian); borra entity store; recrea `embedder` y `llm` desde `this.config` vía `EmbedderFactory`/`LLMFactory` y re-corre `_autoInitialize()`. **Sin filtros: destruye toda la colección.** Es la operación global (a diferencia de `deleteAll`, que exige scope).

**`history(memoryId)` → `any[]`** (`memory/index.ts:1744`)

- Devuelve `db.getHistory(memoryId)` crudo (los registros ADD/UPDATE/DELETE que escriben `createMemory`/`updateMemory`/`deleteMemory`). Sin `_captureEvent`, sin costo.

### CRÍTICO: parámetros Platform-only que LANZAN en OSS

Tres superficies rechazan explícitamente features del Platform gestionado; los errores se evalúan **antes** de cualquier trabajo:

- **`add({ timestamp })`** (`memory/index.ts:687`): `if (config?.timestamp !== undefined)` → `throw` con mensaje de `getTemporalFeatureErrorMessage(..., { triggerFunction: "add", triggerParameter: "timestamp" })`. El texto base garantizado es `"The timestamp parameter is not supported by the OSS Memory SDK."` (const `TEMPORAL_TIMESTAMP_PLAIN_ERROR`, `utils/notices.ts:30`).
- **`search({ referenceDate })`** (`memory/index.ts:1304`): `if (config?.referenceDate !== undefined)` → `throw`. Texto base: `"The referenceDate parameter is not supported by the OSS Memory SDK."` (const `TEMPORAL_REFERENCE_DATE_PLAIN_ERROR`, `utils/notices.ts:32`).
- **`updateProject(options)` → `Promise<never>`** (`memory/index.ts:674`):

  ```ts
  async updateProject(options: UpdateProjectOptions = {}): Promise<never> {
    if (options?.decay === true) {
      await this._getNoticeTelemetryId();
      throw new Error(await getDecayFeatureErrorMessage(this));
    }

    throw new Error("Project updates are not supported by the OSS Memory SDK.");
  }
  ```

  **`updateProject` SIEMPRE lanza.** Con `decay: true` el mensaje base es `"The decay parameter is not supported by the OSS Memory SDK."` (const `DECAY_FEATURE_PLAIN_ERROR`, `utils/notices.ts:34`); con cualquier otra opción, `"Project updates are not supported by the OSS Memory SDK."`. **[para construir encima]** es un stub: no hay ningún camino en OSS que actualice configuración de proyecto ni active memory decay.

**[para construir encima] sobre los mensajes:** cuando la telemetría está activa (`isTelemetryEnabled()`), `getTemporalFeatureErrorMessage` (`utils/notices.ts:650`) y `getDecayFeatureErrorMessage` (`utils/notices.ts:611`) pueden intentar traer una copia remota vía `evaluateNoticeFlag(instance.telemetryId)` (llamada en `:662` y `:617` respectivamente) y emitir un evento `notice_displayed`; ante telemetría desactivada o cualquier fallo (`try/catch`), caen a los strings planos citados arriba. Es decir, el texto exacto puede variar, pero **el hecho de que lanza es determinista** y el string plano es el garantizado.

### Telemetría y notices (breve)

- `Memory` invoca `_captureEvent(methodName, …)` (`memory/index.ts:584`, wrapper no-fatal) en `add`, `search`, `update`, `delete`, `deleteAll` (`delete_all`), `getAll` (`get_all`) y `reset`. **No** lo llaman `get` ni `history` (esos solo muestran el first-run notice).
- `captureClientEvent`/`UnifiedTelemetry` (`utils/telemetry.ts`): `MEM0_TELEMETRY` es `true` por default y solo se apaga con **`process.env.MEM0_TELEMETRY?.toLowerCase() === "false"`** (`utils/telemetry.ts:16-17`). Postea a PostHog (`https://us.i.posthog.com/i/v0/e/`, key hardcodeada `POSTHOG_API_KEY` en `utils/telemetry.ts:19`). **Muestreo:** `DEFAULT_SAMPLE_RATE = 0.1` (`utils/telemetry.ts:25`), ajustable con `MEM0_TELEMETRY_SAMPLE_RATE` ∈ [0,1] (`utils/telemetry.ts:26`); los eventos `init`, `reset` y `notice_displayed` bypassean el sampling (`ALWAYS_SEND_EVENTS`, `utils/telemetry.ts:40`). **[para construir encima]** para cortar todo tráfico saliente de telemetría, exportá `MEM0_TELEMETRY=false`.
- `utils/notices.ts` emite avisos de uso: primer uso, umbral de escala (`SCALE_MEMORY_COUNT_THRESHOLD = 2000` en `:36`, `SCALE_TOP_K_THRESHOLD = 50` en `:38`), queries lentas, y "uso de decay" tras `DECAY_USAGE_DELETE_THRESHOLD = 5` deletes exitosos (`utils/notices.ts:35`; contador vía `getDecayUsageDeleteCountAfterSuccess()` en `delete`, `memory/index.ts:1686`). Son informativos y no alteran resultados.

## 9. Rerankers (nuevo en 3.1.0)

Subsistema de reordenamiento post-búsqueda: una vez que la búsqueda híbrida produjo sus candidatos, un reranker opcional los vuelve a puntuar contra el query y reordena. Es **opt-in por búsqueda** (`rerank: true`) y **no-op** si no hay reranker configurado. Cinco proveedores despachados por un factory: `cohere`, `zero_entropy`, `sentence_transformer`, `huggingface`, `llm_reranker`.

> **Nota de fidelidad de fuente.** El archivo `rerankers/base.ts` — que declara la interfaz `Reranker` y el tipo `RerankResult` — **no está presente en este snapshot del código** (una búsqueda de `base.ts` en todo el árbol extraído no lo encuentra; tampoco están `llms/base.ts` ni `embeddings/base.ts`). Los cuatro implementadores (`cohere.ts`, `zeroentropy.ts`, `cross_encoder.ts`, `llm.ts`) lo importan con `import { Reranker, RerankResult } from "./base";` (líneas `cohere.ts:2`, `zeroentropy.ts:2`, `cross_encoder.ts:2`, `llm.ts:3`), y `memory/index.ts:33` / `utils/factory.ts:18` importan `Reranker` desde `../rerankers/base`, pero el módulo en sí no vino en la extracción. El contrato que documento abajo está **reconstruido a partir de sus cuatro implementadores y del sitio de invocación** (firmas idénticas en los cuatro archivos), no leído de `base.ts`. No afirmo nada sobre el cuerpo literal de `base.ts` porque no lo tengo.

### La interfaz `Reranker` (contrato reconstruido)

Cada proveedor declara `implements Reranker` y expone exactamente esta firma pública (idéntica en `cohere.ts:55`, `zeroentropy.ts:51`, `cross_encoder.ts:52`, `llm.ts:32`):

```ts
async rerank(
  query: string,
  documents: string[],
  topK?: number,
): Promise<RerankResult[]>
```

Y `RerankResult` se consume siempre con dos campos — visible en el `.map(...)` de cada proveedor, p.ej. `zeroentropy.ts:66`:

```ts
const scored: RerankResult[] = response.results.map((result: any) => ({
  index: result.index,
  rerankScore: result.relevance_score,
}));
```

- **`index`** — posición del documento en el array `documents` de entrada (NO un id de memoria; es un índice posicional).
- **`rerankScore`** — relevancia numérica del reranker.

**[para construir encima]** El reranker trabaja sobre `string[]` planos y devuelve **índices posicionales**, no ids. El sitio que invoca es responsable de re-mapear `index → objeto original` (lo hace `memory/index.ts:1588` con `results[r.index]`). Si vos reordenás/filtrás `documents` antes de pasarlo, los índices devueltos apuntan a tu array reordenado, no a las memorias originales.

### `RerankerFactory.create` — el dispatcher

`utils/factory.ts:211` (clase; `create` en `:212`). Switch sobre `provider.toLowerCase()` (case-insensitive: `"Cohere"`, `"COHERE"` funcionan):

```ts
export class RerankerFactory {
  static create(provider: string, config: RerankerConfig): Reranker {
    switch (provider.toLowerCase()) {
      case "cohere":
        return new CohereReranker(config);
      case "zero_entropy":
        return new ZeroEntropyReranker(config);
      case "sentence_transformer":
        return new CrossEncoderReranker(
          config,
          "Xenova/ms-marco-MiniLM-L-6-v2",
        );
      case "huggingface":
        return new CrossEncoderReranker(
          config,
          "Xenova/bge-reranker-base",
          512,
        );
      case "llm_reranker": {
        const llm = RerankerFactory.buildLLMRerankerLLM(config);
        return new LLMReranker(config, llm);
      }
      default:
        throw new Error(`Unsupported reranker provider: ${provider}`);
    }
  }
```

Observaciones concretas:
- `sentence_transformer` y `huggingface` construyen **la misma clase** `CrossEncoderReranker`, sólo cambian el modelo por defecto y el `maxLength` por defecto:
  - `sentence_transformer` → modelo `"Xenova/ms-marco-MiniLM-L-6-v2"`, **sin `defaultMaxLength`** (el 3er argumento se omite → `undefined`).
  - `huggingface` → modelo `"Xenova/bge-reranker-base"`, `defaultMaxLength` = `512`.
- **[para construir encima]** Un provider desconocido **lanza** `Error("Unsupported reranker provider: <provider>")` en el momento de construir el `Memory` (el factory corre en el constructor, ver más abajo), no en tiempo de búsqueda. Los cinco nombres válidos son los cinco `case`.

### `buildLLMRerankerLLM` — armado del LLM de puntuación

Sólo para `llm_reranker`. `utils/factory.ts:238`:

```ts
  private static buildLLMRerankerLLM(config: RerankerConfig): LLM {
    const nested = config.llm;
    let llmProvider: string;
    let llmConfig: LLMConfig;

    if (nested) {
      llmProvider = nested.provider || config.provider || "openai";
      llmConfig = { ...(nested.config || {}) };
      if (llmConfig.model === undefined) {
        llmConfig.model = config.model ?? "gpt-4o-mini";
      }
      if (llmConfig.temperature === undefined) {
        llmConfig.temperature = config.temperature ?? 0.0;
      }
      if (llmConfig.maxTokens === undefined) {
        llmConfig.maxTokens = config.maxTokens ?? 100;
      }
      if (config.apiKey && llmConfig.apiKey === undefined) {
        llmConfig.apiKey = config.apiKey;
      }
    } else {
      llmProvider = config.provider || "openai";
      llmConfig = {
        model: config.model ?? "gpt-4o-mini",
        temperature: config.temperature ?? 0.0,
        maxTokens: config.maxTokens ?? 100,
      };
      if (config.apiKey) {
        llmConfig.apiKey = config.apiKey;
      }
    }

    return LLMFactory.create(llmProvider, llmConfig);
  }
```

Reglas de precedencia observables:
- **Con `config.llm` anidado**: el `llm.config` anidado manda; los campos top-level (`provider`/`model`/`temperature`/`maxTokens`/`apiKey`) sólo rellenan lo que falte (`=== undefined`). El `apiKey` top-level sólo se copia si el anidado no lo trae.
- **Sin `config.llm`**: se arma un `LLMConfig` desde los campos top-level.
- **Defaults concretos**: provider `"openai"`, model `"gpt-4o-mini"`, temperature `0.0`, maxTokens `100`.
- **[para construir encima]** El LLM se resuelve vía `LLMFactory.create(llmProvider, llmConfig)` en el **constructor** del `Memory`. Si el proveedor de LLM exige API key y no la das, el error viene de `LLMFactory`, no de acá.

### `RerankerConfig` — la forma de configuración

`types/index.ts:80`. Un único tipo plano para los cinco proveedores; cada campo aplica a un subconjunto (comentado en el propio código):

```ts
export interface RerankerConfig {
  apiKey?: string;
  /** The reranker model to use. Default varies by provider. */
  model?: string;
  /** Maximum number of documents to return after reranking. Default: unset (return all). */
  topK?: number;
  /** `cohere` only. Return document texts in the response. Default: `false`. */
  returnDocuments?: boolean;
  /** `cohere` only. Maximum number of chunks per document. Default: unset. */
  maxChunksPerDoc?: number;
  /**
   * `sentence_transformer` / `huggingface` only. Transformers.js device, e.g.
   * `"cpu"`, `"wasm"`, `"webgpu"`. Default: unset (auto-detect).
   */
  device?: string;
  /** `huggingface` only. Max token length per query-document pair. Default: `512`. */
  maxLength?: number;
  /**
   * `sentence_transformer` / `huggingface` only. Sigmoid-normalize raw logits
   * to `[0, 1]`. Default: `true`; set `false` to surface raw logits.
   */
  normalize?: boolean;
  /** No-op: a search reranks a small candidate set in one forward pass. */
  batchSize?: number;
  /** No-op in this runtime. */
  showProgressBar?: boolean;
  /**
   * `llm_reranker` only. LLM provider used to build the scoring LLM when
   * `llm` is not set. Default: `"openai"`.
   */
  provider?: string;
  /** `llm_reranker` only. Temperature for LLM generation. Default: `0.0`. */
  temperature?: number;
  /** `llm_reranker` only. Maximum tokens for the LLM response. Default: `100`. */
  maxTokens?: number;
  /**
   * `llm_reranker` only. Nested LLM configuration. When set, it overrides the
   * top-level `provider`/`model`/`temperature`/`maxTokens`/`apiKey`, which
   * then only act as defaults for fields missing from `llm.config`.
   */
  llm?: {
    provider: string;
    config: LLMConfig;
  };
  [key: string]: any;
}
```

- `batchSize` y `showProgressBar` son **no-ops** aceptados sólo por paridad con el SDK de Python (ver comentario en `cross_encoder.ts:12`).
- `[key: string]: any` (línea 124) permite claves extra arbitrarias sin error de tipos.
- **[para construir encima]** El default de `maxLength` = `512` documentado en el comentario aplica sólo cuando el factory pasa `512` (caso `huggingface`); para `sentence_transformer` no hay default → `maxLength` queda `undefined` salvo que lo pongas vos.

### Proveedor: `cohere` (API, `rerank-v3.5`)

`rerankers/cohere.ts`. Default de modelo `"rerank-v3.5"` (`cohere.ts:4`).

- **API key**: `config.apiKey || process.env.COHERE_API_KEY`; si falta, **lanza** en el constructor: `"Cohere API key is required. Set COHERE_API_KEY environment variable or pass apiKey in config."` (`cohere.ts:16-21`).
- **Dependencia peer opcional**: importa `cohere-ai` de forma perezosa la primera vez que se usa (`await import("cohere-ai")`, `cohere.ts:46`). Si no está instalada, lanza `"The 'cohere-ai' package is required ... npm install cohere-ai"`. El cliente se cachea (`clientInstance`/`clientPromise`).
- **Llamada** (`cohere.ts:64`):

```ts
const response = await client.rerank({
  model: this.model,
  query,
  documents,
  topN: topK || this.topK || documents.length,
  returnDocuments: this.returnDocuments,
  maxChunksPerDoc: this.maxChunksPerDoc,
});

return response.results.map((result: any) => ({
  index: result.index,
  rerankScore: result.relevanceScore,
}));
```

- **`topN`** = `topK` (el que pase `search`) `|| this.topK` `|| documents.length`. Es la única implementación que **delega el corte al servidor** vía `topN`; **no** ordena en cliente (confía en el orden que devuelve la API).
- **`rerankScore`** ← `result.relevanceScore` (camelCase, tal como lo devuelve el SDK de Cohere).
- **Fallback ante error** (`cohere.ts:77`): `console.warn("Cohere reranking failed, falling back to original order: ...")` y devuelve todos los docs en **orden original** con `rerankScore: 0.0`, recortados a `topK || this.topK` (sólo si alguno está definido; si ninguno lo está, devuelve todos).
- **Costo/latencia**: **1 llamada de red** al endpoint de Cohere por búsqueda. Sin embeddings ni cómputo local. Latencia = round-trip a la API de Cohere. Costo = tarifa de rerank de Cohere por documento/query.

### Proveedor: `zero_entropy` (API, `zerank-1`)

`rerankers/zeroentropy.ts`. Default de modelo `"zerank-1"` (`zeroentropy.ts:4`).

- **API key**: `config.apiKey || process.env.ZERO_ENTROPY_API_KEY`; si falta, **lanza** `"Zero Entropy API key is required. Set ZERO_ENTROPY_API_KEY ..."` (`zeroentropy.ts:14-19`).
- **Dependencia peer opcional**: `await import("zeroentropy")` perezoso (`zeroentropy.ts:42`); si falta, lanza `"The 'zeroentropy' package is required ... npm install zeroentropy"`.
- **Llamada** (`zeroentropy.ts:60`): `client.models.rerank({ model, query, documents })`. Nota: **no** manda `topK` a la API.
- **`rerankScore`** ← `result.relevance_score` (snake_case aquí, a diferencia de Cohere).
- **Ordena en cliente** descendente por `rerankScore` y recorta a `topK || this.topK` (`zeroentropy.ts:70-73`).
- **Fallback ante error** (`zeroentropy.ts:74`): `console.warn("Zero Entropy reranking failed, falling back to original order: ...")`, todos con `rerankScore: 0.0` en orden original, recortado a `finalTopK`.
- **Costo/latencia**: **1 llamada de red** al endpoint de ZeroEntropy. Sin cómputo local.

### Proveedor: `sentence_transformer` / `huggingface` (cross-encoder LOCAL, transformers.js)

`rerankers/cross_encoder.ts`. Corre un cross-encoder **localmente** vía `@huggingface/transformers` (ONNX). Modelos por defecto según el `case` del factory (`Xenova/ms-marco-MiniLM-L-6-v2` o `Xenova/bge-reranker-base`).

- Constructor (`cross_encoder.ts:17`): `modelId = config.model || defaultModel`; `device = config.device`; `maxLength = config.maxLength ?? defaultMaxLength`; `normalize = config.normalize ?? true`; `topK = config.topK`.
- **Carga perezosa de ONNX** (`cross_encoder.ts:29`, método `load()`): importa `@huggingface/transformers` sólo al primer `rerank()`, no en `new Memory()`. El comentario del código explica por qué: un import estático arrastraría `onnxruntime` a cada `new Memory()` y **chocaría en Linux con la versión de onnxruntime de fastembed**. La primera ejecución hace `AutoModelForSequenceClassification.from_pretrained(modelId, options)` + `AutoTokenizer.from_pretrained(modelId)`.
- **Puntuación** (`cross_encoder.ts:52`, método `rerank()`; el bloque de tokenización/logits empieza en `:62`):

```ts
const inputs = tokenizer(
  documents.map(() => query),
  {
    text_pair: documents,
    padding: true,
    truncation: true,
    ...(this.maxLength ? { max_length: this.maxLength } : {}),
  },
);

const { logits } = await model(inputs);
const rows: unknown[] = logits.tolist();

const scored = rows.map((row, index) => {
  const logit = Array.isArray(row) ? (row[0] as number) : (row as number);
  return {
    index,
    rerankScore: this.normalize ? sigmoid(logit) : logit,
  };
});
```

- Tokeniza pares (query, doc) en batch; un **único forward pass** para todos los candidatos (`batchSize` no se usa).
- `sigmoid = (x) => 1 / (1 + Math.exp(-x))` (`cross_encoder.ts:4`). Con `normalize` (default `true`) el score es `sigmoid(logit)` ∈ `[0,1]`; con `normalize: false` devuelve el **logit crudo** (puede ser negativo o >1).
- Toma `row[0]` si la fila es array (modelos de un solo logit), o la fila directa si es escalar.
- **Ordena en cliente** descendente y recorta a `topK || this.topK` (`cross_encoder.ts:83-85`).
- **Fallback ante error** (`cross_encoder.ts:86`): `console.warn("Cross-encoder reranking failed, falling back to original order: ...")`, todos `0.0` en orden original, recortado a `finalTopK`.
- **Costo/latencia**: **cero llamadas de API**. Primera búsqueda paga la **descarga del modelo desde el hub de HF** (`Xenova/...`) + carga de onnxruntime; búsquedas siguientes reusan `this.loaded` (Promise cacheada). Cómputo local ONNX en CPU salvo que fijes `device` (`"cpu"`, `"wasm"`, `"webgpu"`).

### Proveedor: `llm_reranker` (un LLM puntúa 0.0–1.0)

`rerankers/llm.ts`. El LLM (armado por `buildLLMRerankerLLM`) puntúa cada documento por separado.

- Constructor (`llm.ts:22`): **lanza** si no recibe LLM — `"LLMReranker requires an LLM instance; RerankerFactory should always provide one for the llm_reranker provider."`. `topK = config.topK`.
- **`SYSTEM_PROMPT` (transcripción literal, `llm.ts:5`)**:

```
You are a relevance scoring assistant. Given a query and a document, score how relevant the document is to the query.

Score the relevance on a scale from 0.0 to 1.0, where:
- 1.0 = Perfectly relevant and directly answers the query
- 0.8-0.9 = Highly relevant with good information
- 0.6-0.7 = Moderately relevant with some useful information
- 0.4-0.5 = Slightly relevant with limited useful information
- 0.0-0.3 = Not relevant or no useful information

Respond with only a single numerical score between 0.0 and 1.0. Do not include any explanation or additional text.
```

- **Un LLM call por documento, en paralelo** (`llm.ts:39` `Promise.all(documents.map(...))`). El mensaje de usuario es `` `Query: ${safeQuery}\n\nDocument: ${safeDoc}` `` con `safeQuery`/`safeDoc` truncados a **`MAX_INPUT_LEN = 4000`** caracteres cada uno (`llm.ts:16`, `llm.ts:59-60`).
- **Parseo del score** (`extractScore`, `llm.ts:76`): busca `/-?\d+\.\d+/g` (decimal) y si no hay, `/-?\d+/g` (entero); toma `matches[0]`, `parseFloat`, y **clampa a `[0.0, 1.0]`** con `Math.min(Math.max(score, 0.0), 1.0)`. Si no matchea ningún número → **`0.5`**.
- La respuesta del LLM se lee como `response` (string) o `response.content` (`LLMResponse`) (`llm.ts:68-71`).
- **Fallback por documento** (`llm.ts:44-49`): si el call de un documento falla, ese documento recibe score **neutral `0.5`** (`console.warn("LLM reranking failed for a document, assigning neutral score: ...")`) — no tira abajo toda la búsqueda; los demás documentos siguen.
- **Ordena en cliente** descendente y recorta a `topK || this.topK` (`llm.ts:53-55`).
- **[para construir encima] Costo/latencia**: **N llamadas de LLM por búsqueda**, donde N = cantidad de documentos que entran al rerank (por defecto ≤ `topK` = 20, ver Step 10). Cada call usa `maxTokens` ≈ `100` y `temperature` ≈ `0.0` (defaults de `buildLLMRerankerLLM`). Es de lejos el reranker **más caro y más lento** (hasta 20 llamadas paralelas a `gpt-4o-mini` por cada `search` con `rerank:true`).

### Configuración: `MemoryConfig.reranker`

Se declara en la config del `Memory` (`types/index.ts:141`):

```ts
reranker?: {
  provider: string;
  config: RerankerConfig;
};
```

Validación Zod (`types/index.ts:246`) — laxa, sólo exige `provider: string` y `config: record`:

```ts
reranker: z
  .object({
    provider: z.string(),
    config: z.record(z.string(), z.any()),
  })
  .optional(),
```

El reranker se instancia **una vez, en el constructor** del `Memory` (`memory/index.ts:206`):

```ts
if (this.config.reranker) {
  this.reranker = RerankerFactory.create(
    this.config.reranker.provider,
    this.config.reranker.config,
  );
}
```

Campo privado por defecto `private reranker: Reranker | null = null;` (`memory/index.ts:181`). El `config/manager.ts:208` pasa `reranker: userConfig.reranker` tal cual.

- **[para construir encima]** Al construir el `Memory`, si `reranker.provider` es inválido o falta la API key del provider, **la excepción sale del constructor** (no de `search`). El cliente de red / modelo ONNX **no** se toca acá: sólo se construye la clase; la inicialización real (import perezoso del SDK / descarga del modelo) ocurre en el primer `rerank()`.

### Invocación en `search` — Step 10 (opt-in `rerank: true`)

`memory/index.ts:1574`:

```ts
// Step 10: Optionally re-rank with the configured reranker. Opt-in per
// search via `rerank: true`; a no-op when no reranker is configured.
const invokeReranker = Boolean(
  config.rerank && this.reranker && results.length > 0,
);
let finalResults = results;
if (invokeReranker) {
  try {
    const ranked = await this.reranker!.rerank(
      query,
      results.map((r) => r.memory),
      topK,
    );
    finalResults = ranked.map((r) => ({
      ...results[r.index],
      rerankScore: r.rerankScore,
    }));
  } catch (e) {
    console.warn(`Reranking failed, using original results: ${e}`);
  }
}
```

Flujo paso a paso y comportamiento observable:

1. **Gating triple** (`memory/index.ts:1576`): sólo rerankea si `config.rerank` (flag booleano de las search options; el tipo `SearchMemoryOptions` no está incluido en este snapshot — se ve consumido como `config.rerank` / `config.topK`) **y** hay `this.reranker` configurado **y** `results.length > 0`. Con `rerank:true` pero sin reranker en la config → **no-op silencioso** (devuelve `results` sin `rerankScore`).
2. **Qué se le pasa al reranker**: `query`, `results.map(r => r.memory)` (sólo el **texto** de cada memoria, no el objeto), y `topK`. `topK` viene de las search options con **default `20`** (`memory/index.ts:1346`); `threshold` default `0.1` (`memory/index.ts:1347`).
3. **El conjunto ya viene recortado a `topK`**: en Step 8 (`scoreAndRank(candidates, bm25Scores, entityBoosts, threshold ?? 0.1, topK, explain)`, `memory/index.ts:1530`) los resultados ya se filtran por `threshold` y se limitan a `topK`. La búsqueda semántica sobre-lee `internalLimit = Math.max(topK * 4, 60)` (`memory/index.ts:1401`) **sólo para el pool de scoring**, pero para cuando llega al Step 10 `results` ya tiene **a lo sumo `topK` elementos**. Consecuencia: **el rerank reordena (y potencialmente recorta) el top-`topK` ya elegido; NO puede recuperar un documento que `scoreAndRank` dejó fuera del top-`topK`.**
4. **Re-mapeo por índice**: `finalResults = ranked.map(r => ({ ...results[r.index], rerankScore: r.rerankScore }))`. El orden final = orden que devolvió el reranker. Se **agrega `rerankScore`** al `MemoryItem` **sin reemplazar `score`** (el score original de la búsqueda híbrida se conserva; ver `types/index.ts:159` `rerankScore?: number` junto a `score?: number` en `:157`).
5. **Doble red de seguridad ante fallo**: cada provider ya captura sus propios errores internamente (devuelve fallback en vez de tirar). Además, este `try/catch` de nivel search (catch en `memory/index.ts:1591`) hace `console.warn("Reranking failed, using original results: ...")` y deja `finalResults = results` (los originales sin `rerankScore`) si el `rerank()` llegara a lanzar.

**[para construir encima] — claves de payload:**
- Para leer el resultado del reranker en el cliente: campo `rerankScore` en cada `MemoryItem` de `results` (coexiste con `score`). Sólo está presente cuando el rerank efectivamente corrió.
- El flag de entrada es `rerank: true` en las opciones de `search`; el tamaño se controla con `topK` (default 20). No hay opción para rerankear más candidatos que el top-`topK` sin subir `topK`.

**[para construir encima] — qué NO hace este subsistema:**
- **No re-selecciona del pool grande**: el rerank ocurre después de que `scoreAndRank` ya cortó a `topK`; el `internalLimit` (topK×4, mín 60) no se le expone al reranker.
- **No persiste `rerankScore`**: se calcula en tiempo de búsqueda y se adjunta al resultado; no se guarda en el vector store ni en el historial.
- **No reordena `getAll`/`get`**: el Step 10 vive sólo en `search`. La rama de listado `getAll` (`memory/index.ts:1803`) no invoca reranker; tampoco `get` (`memory/index.ts:1248`).
- **No corre por defecto**: sin `rerank: true` el reranker configurado nunca se toca (ni siquiera se inicializa su cliente/modelo).
- **No valida la coherencia provider/config en Zod**: el schema sólo checa `provider: string` + `config: record`; un `provider` inexistente pasa Zod y recién falla en `RerankerFactory.create` dentro del constructor.
- **No hace batching real** en el cross-encoder (`batchSize`/`showProgressBar` son no-ops declarados); todo el candidate set va en un forward pass.

### Costo / latencia por proveedor (resumen)

| Provider | Cómputo | Llamadas por `search` | Dependencia | Default modelo | Ordena en cliente |
|---|---|---|---|---|---|
| `cohere` | API remota | 1 (con `topN`) | `cohere-ai` + `COHERE_API_KEY` | `rerank-v3.5` | No (confía en la API) |
| `zero_entropy` | API remota | 1 | `zeroentropy` + `ZERO_ENTROPY_API_KEY` | `zerank-1` | Sí (desc.) |
| `sentence_transformer` | Local ONNX | 0 (descarga modelo 1ª vez) | `@huggingface/transformers` | `Xenova/ms-marco-MiniLM-L-6-v2` | Sí (desc.) |
| `huggingface` | Local ONNX | 0 (descarga modelo 1ª vez) | `@huggingface/transformers` | `Xenova/bge-reranker-base` (maxLength 512) | Sí (desc.) |
| `llm_reranker` | N llamadas LLM | **N = nº documentos (≤ topK, def. 20)** | LLM provider (def. `openai`/`gpt-4o-mini`) | — | Sí (desc.) |

- Más barato/predecible en latencia y sin red: **cross-encoder local** (paga descarga de modelo en frío).
- Una sola llamada de red: **cohere**, **zero_entropy**.
- Más caro y lento con diferencia: **llm_reranker** (una llamada de LLM por documento, hasta `topK` en paralelo, `maxTokens≈100`, `temp≈0.0`).

---

## Apéndice — Mitos vs realidad (verificado en 3.1.0)

1. **`add` es ADITIVO, no "extraer + reconciliar".** No hay decisión
   ADD/UPDATE/DELETE/NOOP en `add`: un LLM call de extracción aditiva + dedup por hash
   md5 + insert. El evento siempre es `ADD`. UPDATE/DELETE reales solo por `update()`/
   `delete()` (ver §2, §8).
2. **Temporal bi-temporal NO existe; expiración por fecha SÍ.** `add({timestamp})`,
   `search({referenceDate})` y `updateProject({decay})` **lanzan error** (Platform-only).
   Pero `expirationDate` (YYYY-MM-DD) sí funciona como TTL (nuevo en 3.1.0, §8).
3. **Sobre Qdrant la búsqueda NO es híbrida con BM25.** `Qdrant.keywordSearch()`
   devuelve `null`; solo `MemoryVectorStore`/`PGVector`/`AzureAISearch` implementan BM25.
   En Qdrant: denso + entity-boost. **Nuevo en 3.1.0:** un **reranker opt-in** (§9) es la
   vía limpia para mejorar precisión sobre Qdrant.
4. **El entity graph es NLP local**, no un LLM-KG (ver §5): índice de co-ocurrencia
   entidad→memorias, usado como boost en `search`.
5. **La ingesta multimodal reduce a texto**: una imagen se describe con un VLM
   (`get_image_description`) y sigue el pipeline aditivo (§8).

## Cómo se generó / regeneró

Fuente third-party (Apache-2.0), no se versiona. Reconstruir con la receta de
[`README.md`](./README.md) (extraer del sourcemap del paquete instalado →
`graphify update`), luego releer los archivos citados. Al subir la versión de
`mem0ai`, repetir contra el paquete nuevo y re-verificar.
