# Motor v2 — arquitectura y funcionamiento

> Documentación **as-built** del motor dinámico de organización de Savia (`apps/api/src/modules/organization/`): describe únicamente lo que el código hace hoy, verificado línea por línea contra el fuente. No es un plan ni un listado de tickets — cada afirmación técnica lleva su cita `archivo:línea`.
>
> El nombre "motor v2" es el propio del código: `organization.module.ts:16-19` lo llama *"the dynamic memory engine v2 (persona graph + encoding tree), driven by the EngineWorker in the worker process"*.

---

## 1. La idea en una frase

El motor **no usa la API de mem0** para nada — lee y escribe embeddings **directo contra el mismo Qdrant que mem0 puebla**, vía `VectorStorePort`, porque necesita operaciones de corpus completo (`scroll`, `knn`) que la API top-k-por-query de mem0 no puede servir. Sobre esos vectores construye un grafo mutual-kNN, lo parte en "personas" que permiten que una memoria pertenezca a varias comunidades a la vez (Ego-Splitting, KDD 2017), decide merges/splits de esas comunidades con un esquema de histéresis propio (no Louvain), y cada tanto reconstruye un árbol jerárquico completo minimizando entropía estructural (Li & Pan 2016 / HISEvent AAAI 2024). Ver [§6](#6-cómo-se-monta-sobre-mem0) para el detalle de esa frontera.

## 2. El pipeline completo, de un vistazo

```
 escritura (síncrona, dentro de memory.service.add)
 ══════════════════════════════════════════════════
   mem0.add() ──► vectors.retrieve(vec1536) ──► EnginePlacementService.placeAtAdd()
                                                  │ near-dup (cos≥0.97) + voto de pluralidad
                                                  ▼
                                       kernel.assign() ──► encola EngineTask (misma tx)

 loop asíncrono (EngineWorker, cada 1s, por usuario)
 ══════════════════════════════════════════════════
   EngineTasksService.claimForUser()  (outbox, FIFO, coalescido por dedupeKey)
        │
        ▼
   MemoryGraphService.insert/remove()  ── grafo mutual-kNN (Prisma: MemoryEdge)
        │
        ▼
   PersonaService.recompute()  ── ego-splitting → personas (Prisma: MemoryPersona)
        │
        ▼
   CommunityService.reconcile()  ── histéresis merge/split (persona graph)
        │              │
        │              ▼
        │      StructureExecutorService  ── único aplicador de merge/create/split/syncMembership
        ▼
   (si changeCounter ≥ 8) TreeBuilderService.rebuild()
        │
        ▼
   minimización de entropía estructural ──► árbol de Spaces ──► NamingService (bajo demanda)

 cold start
 ══════════
   EngineBootstrapService: wipe + scroll(100k, withVectors) + rebuild completo + re-home
```

## 3. Mapa de archivos: dos capas desacopladas

**Álgebra pura — sin DI, sin IO** ([graph.ts:3-4](../../apps/api/src/modules/organization/graph.ts#L3-L4): *"No DI, no IO — same discipline as the old `cluster-math.ts`, so every property is a unit assertion"*):

| Archivo | Qué implementa |
|---|---|
| [`graph.ts`](../../apps/api/src/modules/organization/graph.ts) | `WeightedGraph`, `degree`, `volume`, `connectedComponents` (DFS iterativo con pila, **no** BFS) |
| [`ego-split.ts`](../../apps/api/src/modules/organization/ego-split.ts) | Ego-Splitting (Epasto, Lattanzi, Paes Leme — KDD 2017) + `matchPersonas` (Jaccard) |
| [`community-ops.ts`](../../apps/api/src/modules/organization/community-ops.ts) | Histéresis merge/split propia (`decideCommunityOps`, `sparsestBipartition`) |
| [`structural-entropy.ts`](../../apps/api/src/modules/organization/structural-entropy.ts) | Structural Entropy (Li & Pan 2016) + minimización estilo HISEvent (Cao et al., AAAI 2024) |

**Capa de servicio — Prisma + VectorStorePort** (nunca mem0):

| Archivo | Rol |
|---|---|
| [`memory-graph.service.ts`](../../apps/api/src/modules/organization/memory-graph.service.ts) | Mantiene el grafo mutual-kNN en Postgres |
| [`persona.service.ts`](../../apps/api/src/modules/organization/persona.service.ts) | Ego-net → personas, con estabilidad de identidad |
| [`community.service.ts`](../../apps/api/src/modules/organization/community.service.ts) | Orquesta la capa online (histéresis) |
| [`engine-placement.service.ts`](../../apps/api/src/modules/organization/engine-placement.service.ts) | Mitad síncrona: colocación al momento de escribir |
| [`structure-executor.service.ts`](../../apps/api/src/modules/organization/structure-executor.service.ts) | Único aplicador de mutaciones estructurales |
| [`tree-builder.service.ts`](../../apps/api/src/modules/organization/tree-builder.service.ts) | Rebuild offline del árbol de áreas |
| [`naming.service.ts`](../../apps/api/src/modules/organization/naming.service.ts) | Nombra un área (heurística + fallback LLM) |
| [`engine.worker.ts`](../../apps/api/src/modules/organization/engine.worker.ts) | Drena la cola cada 1s |
| [`engine-tasks.service.ts`](../../apps/api/src/modules/organization/engine-tasks.service.ts) | Outbox pattern (encolar/reclamar/completar/reintentar) |
| [`engine-config.ts`](../../apps/api/src/modules/organization/engine-config.ts) | Los 7 tunables, compartidos por todo lo anterior |
| [`bootstrap/engine-bootstrap.service.ts`](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts) | Cold start / reconstrucción completa |
| [`suggestions.service.ts`](../../apps/api/src/modules/organization/suggestions.service.ts) | Bandeja de propuestas + undo |

## 4. Modelo de datos (Prisma)

El motor tiene su propio estado privado, separado del payload Qdrant (`schema.prisma:283`, comentario *"Motor v2: grafo de personas (estado privado del motor)"*):

| Modelo | Qué guarda | Nota |
|---|---|---|
| `MemoryEdge` | Lista kNN **dirigida** por memoria (`srcId,dstId,simScore,entBoost,weight,mutual`) | `weight = simScore + entBoost`, materializado (`schema.prisma:289-304`). `mutual=true` solo cuando existe también la fila inversa — evita un self-join en el hot path del ego-net. |
| `MemoryPersona` | Una fila por "persona" = un componente conexo del ego-net de una memoria | `communityId` nullable — puede estar sin asignar (`schema.prisma:309-322`) |
| `PersonaNeighbor` | Mapeo arista→persona: qué persona de `memoryId` contiene a `neighborId` | La arista del *persona graph* se deriva por join, no se persiste (`schema.prisma:324-337`) |
| `EngineComponent` | Un componente conexo del persona-graph + `changeCounter` | Al superar `TREE_REBUILD_DELTA` dispara un rebuild coalescido (`schema.prisma:339-352`) |
| `EngineNode` | Mapeo motor→árbol: cada nodo del encoding tree = un `Space` | `kind: community` (hoja, destino real de membership) \| `internal` (contenedor) (`schema.prisma:354-370`) |
| `EngineTask` | Cola outbox — nunca se escanea completa, se llena por eventos | `dedupeKey` único da el coalescing (`schema.prisma:372-390`); `kind`: `memory_upserted` \| `memory_removed` \| `rebuild_component` \| `bootstrap_user` |
| `Suggestion` | Propuestas del motor para la Bandeja | `kind`: `split` \| `merge` \| `duplicate`; `status`: `pending` \| `accepted` \| `dismissed` (`schema.prisma:607-619`) |
| `MemoryEvent` | Historial reversible (Pulso) — sin FK a propósito, sobrevive al borrado de lo que describe | `revertPayload` trae el valor **previo**, no solo el tipo de operación (`schema.prisma:504-519`) |
| `Space` | El árbol de áreas real | `governance: auto` (el motor puede reorganizarla) \| `manual` (el usuario la fijó, el motor no la toca) (`schema.prisma:200-235`) |
| `MemoryArea` | Membership multi-área — la VERDAD; `savia_area_ids[]` en Qdrant es su proyección vía outbox | `onDelete: Restrict` en `spaceId` — la base obliga a re-homear antes de borrar un área (`schema.prisma:269-281`) |

## 5. El pipeline, paso a paso

### 5.1 Escritura — la mitad síncrona (`EnginePlacementService`)

[engine-placement.service.ts:16-23](../../apps/api/src/modules/organization/engine-placement.service.ts#L16-L23) se autodescribe como *"the synchronous, at-add-time half of the engine (called from memory.service.add)"*.

`MemoryService.add()` ([memory.service.ts:49-75](../../apps/api/src/modules/memory/memory.service.ts#L49-L75)):
1. `Mem0Service.add()` — mem0 extrae/dedupe/escribe el punto en Qdrant.
2. `VectorStorePort.retrieve([fact.id], P.author(userId), {withVectors:true})` ([:58](../../apps/api/src/modules/memory/memory.service.ts#L58)) — saltándose a mem0, saca el vector 1536d completo.
3. `EnginePlacementService.placeAtAdd(userId, fact.id, vec1536, opts.areaId)` ([:62](../../apps/api/src/modules/memory/memory.service.ts#L62)):
   - Detección de casi-duplicado por kNN + umbral coseno `ENGINE.NEAR_DUP_COS = 0.97` ([engine-placement.service.ts:39,43](../../apps/api/src/modules/organization/engine-placement.service.ts#L39)).
   - Colocación provisional por **voto de pluralidad**: cuenta a qué `Space` apuntan las comunidades de los vecinos (vía `MemoryPersona.communityId`) y elige la mayoría ([:58-78](../../apps/api/src/modules/organization/engine-placement.service.ts#L58-L78)).
   - Flujo exacto: `vec1536 → vectors.knn(vec1536, P.own(userId), K+1) → neighbors → MemoryPersona.communityId → community.spaceId (conteo) → AreasService.closure → Placement.membership`.
4. `MemoryMutationService.kernel.assign(...)` ([:65-75](../../apps/api/src/modules/memory/memory.service.ts#L65-L75)) commitea — el comentario de clase dice literalmente *"committed through the write-kernel, which enqueues the engine refinement"* ([:41-48](../../apps/api/src/modules/memory/memory.service.ts#L41-L48)). El encolado real pasa por `EngineTasksService.enqueueMemoryTask(tx, ...)` **dentro de la misma transacción Prisma** ([engine-tasks.service.ts:79-86](../../apps/api/src/modules/organization/engine-tasks.service.ts#L79-L86)).

Esta colocación es **provisional** — el refinamiento real (grafo, personas, comunidades) lo hace el loop asíncrono a continuación.

### 5.2 El loop asíncrono — patrón outbox (`EngineWorker` + `EngineTasksService`)

`EngineWorker` corre en el proceso `worker` (no en el API), con `@Interval('engine-drain', 1000)` — cada 1s, con guard de reentrancia `running` ([engine.worker.ts:22,33-44](../../apps/api/src/modules/organization/engine.worker.ts#L33-L44)).

Por tick:
1. `pendingUserIds()` — usuarios con tareas pendientes ([engine-tasks.service.ts:19-28](../../apps/api/src/modules/organization/engine-tasks.service.ts#L19-L28)).
2. Por usuario, `claimForUser()` trae hasta 500 tareas *due*, en orden FIFO — **nunca escanea la tabla completa** ([:31-37](../../apps/api/src/modules/organization/engine-tasks.service.ts#L31-L37)); [engine.worker.ts:48](../../apps/api/src/modules/organization/engine.worker.ts#L48).
3. Agrupa en sets `upserted` / `removed` / `rebuilds` ([:51-59](../../apps/api/src/modules/organization/engine.worker.ts#L51-L59)).
4. Para `removed`: `graph.remove(memoryId)`. Para `upserted` no removidas en el mismo batch: `VectorStorePort.retrieve` + `P.author(userId)` → `graph.insert(...)` ([:63-72](../../apps/api/src/modules/organization/engine.worker.ts#L63-L72)).
5. `personas.recompute(userId, affected)` → `communities.reconcile(userId, touchedPersonas)` → `treeBuilder.rebuild(userId, componentId)` por cada componente en `rebuilds` ([:74-76](../../apps/api/src/modules/organization/engine.worker.ts#L74-L76)).
6. Éxito → `tasks.complete(t.id)` borra la fila (libera el `dedupeKey`). Fallo → `tasks.fail(task, err)` aplica backoff con `nextAttemptAt`, y al agotar `MAX_ATTEMPTS` pasa a `status: 'failed'` ([:78-81](../../apps/api/src/modules/organization/engine.worker.ts#L78-L81); [engine-tasks.service.ts:45-57](../../apps/api/src/modules/organization/engine-tasks.service.ts#L45-L57)).

**Coalescing**: rebuilds de árbol se insertan con `dedupeKey` único (p.ej. `u:{userId}:tree:{componentId}`) vía `upsert` — N eventos que tocan el mismo componente producen **un solo** rebuild ([engine-tasks.service.ts:64-71](../../apps/api/src/modules/organization/engine-tasks.service.ts#L64-L71)).

### 5.3 Grafo mutual-kNN (`MemoryGraphService`)

`insert(memoryId, userId, vec1536)`:
- `VectorStorePort.knn(vec1536, P.own(userId), ENGINE.K + 1)` con `K=15` ([memory-graph.service.ts:40](../../apps/api/src/modules/organization/memory-graph.service.ts#L40)).
- Peso = coseno + entity-boost: `weight = simScore + entBoost` ([:48-50](../../apps/api/src/modules/organization/memory-graph.service.ts#L48-L50)), persistido en `MemoryEdge` ([:142-147](../../apps/api/src/modules/organization/memory-graph.service.ts#L142-L147)).
- `syncMutual()` reconcilia la mutualidad en ambas direcciones ([:179-197](../../apps/api/src/modules/organization/memory-graph.service.ts#L179-L197)).
- El chequeo de casi-duplicado reutiliza el mismo tipo de query con `limit=2` ([:119-130](../../apps/api/src/modules/organization/memory-graph.service.ts#L119-L130)).

El entity-boost viene de `EntityGraphPort` — este es el **único** punto donde el motor depende (indirectamente) de mem0; ver [§6](#6-cómo-se-monta-sobre-mem0).

### 5.4 Ego-splitting → personas (`PersonaService` + `ego-split.ts`)

> *"A memory with neighbors in 2 disconnected worlds has 2 personas — it belongs to 2 communities as a full member (literal overlap)"* ([schema.prisma:306-308](../../apps/api/prisma/schema.prisma#L306-L308)).

Por cada memoria afectada:
1. `graph.egoNet(memoryId)` lee `MemoryEdge` ya materializado en Postgres (**no** vuelve a tocar vectores) ([memory-graph.service.ts:81-103](../../apps/api/src/modules/organization/memory-graph.service.ts#L81-L103)).
2. `egoSplit(neighbors, edgesAmong)` ([persona.service.ts:36-37](../../apps/api/src/modules/organization/persona.service.ts#L36-L37)) — implementación literal del framework **Ego-Splitting** (Epasto, Lattanzi, Paes Leme, KDD 2017, citado en [ego-split.ts:4](../../apps/api/src/modules/organization/ego-split.ts#L4)): construye la adyacencia local entre los vecinos de la memoria (el "ego" queda excluido) y llama `connectedComponents` — **cada componente conexo es una persona**. A diferencia de una partición dura tipo DBSCAN, que colapsaría todo en un solo blob, esto produce comunidades **literalmente solapadas** ([ego-split.ts:8-12](../../apps/api/src/modules/organization/ego-split.ts#L8-L12)).
3. `matchPersonas(old, fresh)` ([persona.service.ts:43-46](../../apps/api/src/modules/organization/persona.service.ts#L43-L46)) — matching estable greedy por similitud de Jaccard descendente, con desempate determinista por índice ([ego-split.ts:49-82](../../apps/api/src/modules/organization/ego-split.ts#L49-L82)). El id de la persona vieja que matchea se **reutiliza** (el efecto concreto está en [persona.service.ts:55-57](../../apps/api/src/modules/organization/persona.service.ts#L55-L57): `matchedId ?? (await prisma.memoryPersona.create(...)).id`) — así `communityId`/`personaId` no cambian en cada edición (comentario: *"REUSING a matched persona's id... so identity... stays stable"*, [:8-9](../../apps/api/src/modules/organization/persona.service.ts#L8-L9)).

### 5.5 Comunidades — histéresis online (`CommunityService` + `community-ops.ts`)

**No es Louvain ni label propagation.** Es un esquema propio de histéresis sobre el *persona graph*.

`CommunityService.reconcile(userId, affectedPersonaIds)` — único método público, 4 etapas ([community.service.ts:24,29,45,57,61](../../apps/api/src/modules/organization/community.service.ts#L24)):

1. **Asignar personas sin comunidad** — `assignPersona(personaId, edges, communityOf)` ([:31-43](../../apps/api/src/modules/organization/community.service.ts#L31-L43)): coloca la persona en la comunidad con pluralidad de peso de sus aristas hacia comunidades ya asignadas, desempate lexicográfico determinista ([community-ops.ts:49-71](../../apps/api/src/modules/organization/community-ops.ts#L49-L71)). Sin target → `executor.createCommunity(...)`.
2. **Merge/split con histéresis** — `frozenCommunities()` ([:84-92](../../apps/api/src/modules/organization/community.service.ts#L84-L92)) excluye comunidades cuyo `Space.governance === 'manual'`; `decideCommunityOps(edges, communityOf, frozen)` ([community-ops.ts:79-130](../../apps/api/src/modules/organization/community-ops.ts#L79-L130)) decide, `executor.merge/split` aplica.
3. **Proyectar membership** — `memoriesOfPersonas()` + `executor.syncMembership(userId, memoryIds)` ([:57-59,94-100](../../apps/api/src/modules/organization/community.service.ts#L57-L59)).
4. **Disparar rebuild coalescido** — `bumpAndMaybeRebuild()` incrementa `EngineComponent.changeCounter`; al llegar a `TREE_REBUILD_DELTA=8` encola `tasks.enqueueRebuild()` y resetea a 0 ([:72-82](../../apps/api/src/modules/organization/community.service.ts#L72-L82)).

`buildPersonaGraph()` ([:108-159](../../apps/api/src/modules/organization/community.service.ts#L108-L159)) arma `{edges, communityOf}` con **solo Prisma** — una consulta seed (`memoryPersona`, [:111-114](../../apps/api/src/modules/organization/community.service.ts#L111-L114)) y dos en paralelo (`personaNeighbor` [:123-126](../../apps/api/src/modules/organization/community.service.ts#L123-L126), `memoryPersona` con `communityId` [:131-134](../../apps/api/src/modules/organization/community.service.ts#L131-L134)), más `memoryEdge` filtrado por `mutual:true` ([:127-130](../../apps/api/src/modules/organization/community.service.ts#L127-L130)) — cero llamadas a mem0 o VectorStorePort en este archivo.

**La matemática de la histéresis** ([community-ops.ts:8-25](../../apps/api/src/modules/organization/community-ops.ts#L8-L25) + `engine-config.ts:17-24`):

| Constante | Valor | Regla |
|---|---|---|
| `MERGE_HI` | `0.5` | Merge solo si `coupling(A,B) ≥ 0.5` |
| `SPLIT_LO` | `0.2` | Split solo si `sparsestBipartition(C) ≤ 0.2` |

- `coupling = w / max(1e-12, min(vol_A, vol_B))` sobre cada arista inter-comunidad ([community-ops.ts:88-116](../../apps/api/src/modules/organization/community-ops.ts#L88-L116)); candidatos se ordenan descendente y se aplican greedy (cada comunidad participa una vez).
- **Cláusula anti-oscilación** (la parte "load-bearing"): antes de aceptar un merge, se calcula `sparsestBipartition()` de la **unión** — si esa bipartición tiene coupling ≤ 0.2, el merge se **rechaza** (se volvería a partir de inmediato) ([:104-110](../../apps/api/src/modules/organization/community-ops.ts#L104-L110)).
- `sparsestBipartition()` ([:195-217](../../apps/api/src/modules/organization/community-ops.ts#L195-L217)): barre ascendente los pesos únicos de arista como umbral θ, y en cada θ evalúa **cada** corte "un componente vs el resto" (no solo el más grande — un comentario explícito señala que eso era un falso negativo order-dependent con ≥3 componentes) devolviendo el corte de coupling mínimo global.
- La banda **abierta** `(0.2, 0.5)` es la zona muerta: en ese rango no pasa nada. `SPLIT_LO < MERGE_HI` es, textualmente, "the whole guarantee" contra oscilación infinita merge→split→merge ([engine-config.ts:17-24](../../apps/api/src/modules/organization/engine-config.ts#L17-L24)).
- `MIN_COMMUNITY_SIZE=3` gatea los splits: una comunidad solo se evalúa si tiene ≥6 personas (2×3) ([community-ops.ts:122](../../apps/api/src/modules/organization/community-ops.ts#L122)).

Nota de implementación: `community-ops.ts` **no** importa `graph.ts` — reimplementa su propia búsqueda de componentes (`componentsAbove`) y sus propios `crossWeightIn`/`incidentVol` en vez de reusar `connectedComponents`/`degree`/`volume`. Es una asimetría real del código, no un error — pero vale saberlo si se toca ese archivo.

### 5.6 Ejecución estructural (`StructureExecutorService`)

Se autodescribe como *"The ONLY applier of structural community ops"* ([structure-executor.service.ts:9-18](../../apps/api/src/modules/organization/structure-executor.service.ts#L9-L18)) — crear/mergear/splitear áreas y sincronizar membership, siempre vía el write-kernel + `AreasService`.

- **Merge** ([:100-142](../../apps/api/src/modules/organization/structure-executor.service.ts#L100-L142)): reconcilia colisiones de `Grant`/`FragmentShare` a favor de `includeSensitive` (el más permisivo gana); conserva el `Space` de mayor volumen (`keep`), borra el otro (`drop`) en cascada transaccional ([:144-148](../../apps/api/src/modules/organization/structure-executor.service.ts#L144-L148)).
- **Split** ([:163-178](../../apps/api/src/modules/organization/structure-executor.service.ts#L163-L178)): crea la nueva comunidad, reasigna personas, resincroniza membership.
- **`syncMembership`** ([:52-63](../../apps/api/src/modules/organization/structure-executor.service.ts#L52-L63)): lee persona→comunidad→space, calcula el closure de ancestros y escribe vía `kernel.updateMembership` — el **único** camino de escritura hacia `MemoryArea`. Merge/split además cascadean a `File.spaceId`, `Grant`, `FragmentShare`, `Space.parentId` ([:70-157](../../apps/api/src/modules/organization/structure-executor.service.ts#L70-L157)).
- También llama a `NamingService.nameArea()` para las áreas nuevas ([:170](../../apps/api/src/modules/organization/structure-executor.service.ts#L170)).

### 5.7 Árbol jerárquico offline — minimización de entropía estructural (`TreeBuilderService` + `structural-entropy.ts`)

Capa **desacoplada** de la histéresis online — el nombre "offline" viene del propio código: *"The offline encoding-tree rebuild (structural-entropy) later corrects any local drift"* ([community-ops.ts:24](../../apps/api/src/modules/organization/community-ops.ts#L24)).

`TreeBuilderService.rebuild(userId, componentId)` ([tree-builder.service.ts:33-64](../../apps/api/src/modules/organization/tree-builder.service.ts#L33-L64)):
1. Si hay `<2` `EngineNode(kind='community')` → no-op (`"nothing to nest"`, [:38](../../apps/api/src/modules/organization/tree-builder.service.ts#L38)).
2. `buildCommunityGraph()` ([:68-101](../../apps/api/src/modules/organization/tree-builder.service.ts#L68-L101)): un vértice por community-hoja; peso = suma de `MemoryEdge.weight` mutuas cuyos dos extremos caen en comunidades **distintas**. 100% Prisma (`MemoryPersona` + `MemoryEdge`) — nunca toca VectorStorePort ni mem0.
3. `buildEncodingTree()` ([structural-entropy.ts:139-159](../../apps/api/src/modules/organization/structural-entropy.ts#L139-L159)): itera `greedyPartition2D` ([:63-125](../../apps/api/src/modules/organization/structural-entropy.ts#L63-L125)), contrayendo cada partición en super-vértices (`contract()`, preserva el volumen total vía self-loops de peso `V_c - g_c`, [:215-236](../../apps/api/src/modules/organization/structural-entropy.ts#L215-L236)), hasta que ningún nivel adicional reduzca la entropía (`partition.length === current.n`, [:147](../../apps/api/src/modules/organization/structural-entropy.ts#L147)) o al tope de seguridad `g.n+1` niveles.
4. `materialize()` ([tree-builder.service.ts:105-130](../../apps/api/src/modules/organization/tree-builder.service.ts#L105-L130)): recorre el árbol top-down.
   - **Nodo hoja** (`children.length===0`): el `Space` existente se **re-parenta** solo si cambió — su identidad se preserva (puede llevar grants).
   - **Nodo interno**: **siempre** se recrea desde cero vía `areas.createChild(userId, parent, 'Grupo')` (nombre placeholder literal) — determinista: mismo grafo ⇒ mismo árbol ⇒ cero churn.
5. Cleanup: borra `Space`s internos huérfanos (primero su `MemoryArea` por FK `Restrict`, [:52-58](../../apps/api/src/modules/organization/tree-builder.service.ts#L52-L58)) y llama `executor.syncMembership` para re-proyectar `area_ids`.

**La matemática de entropía estructural** ([structural-entropy.ts:1-12](../../apps/api/src/modules/organization/structural-entropy.ts#L1-L12), citando Li & Pan 2016 y HISEvent/Cao et al. AAAI 2024):

- `se2D(g, partition)` ([:37-54](../../apps/api/src/modules/organization/structural-entropy.ts#L37-L54)) — entropía exacta de un árbol de 2 niveles:

  ```
  H = -Σ_C [ Σ_{v∈C} (d_v/vol)·log2(d_v/V_C)  +  (g_C/vol)·log2(V_C/vol) ]
  ```

  con `g_C` = corte externo de la comunidad, `V_C` = su volumen. Se usa como oráculo de correctitud en los tests, no en el camino caliente.
- `greedyPartition2D(g)` ([:63-125](../../apps/api/src/modules/organization/structural-entropy.ts#L63-L125)) — parte cada vértice como su propia comunidad y fusiona repetidamente el par **adyacente** cuyo ΔSE (forma cerrada, O(1) por candidato, `delta()` en [:81-89](../../apps/api/src/modules/organization/structural-entropy.ts#L81-L89) — matemáticamente análoga a `se2D` pero sin dependencia de código entre ambas) decrece más; para, con guarda de ruido flotante (`best = -1e-12`), cuando ningún par mejora (`if (bi < 0) break`, [:107](../../apps/api/src/modules/organization/structural-entropy.ts#L107)).
- `treeSe(root, g)` ([:161-181](../../apps/api/src/modules/organization/structural-entropy.ts#L161-L181)) — entropía general para un árbol de encoding **arbitrario**:

  ```
  H = -Σ_{α≠root} (g_α/vol)·log2(V_α/V_parent(α))
  ```

  Su propio docstring dice que sirve de *"monotonicity guard for the rebuild"* (comparar antes/después y aceptar el rebuild solo si la entropía no aumenta) — **pero esa comparación no está implementada en ningún archivo del motor**; queda como intención documentada sin código que la ejecute (ver [§9](#9-gaps-encontrados-honestidad-primero)).

### 5.8 Nombrado de áreas (`NamingService`)

Desacoplado del rebuild — no se llama desde `tree-builder.service.ts`, sino desde `StructureExecutorService` cuando se crea un área nueva.

`nameArea(userId, areaId)` ([naming.service.ts:20-51](../../apps/api/src/modules/organization/naming.service.ts#L20-L51)):
1. `VectorStorePort.scroll(P.own(userId, {areaIds:[areaId]}), {limit:200})` ([:21-24](../../apps/api/src/modules/organization/naming.service.ts#L21-L24)) — lectura **directa** de Qdrant, bypass total de mem0.
2. Heurística primaria (**sin LLM**): cuenta la frecuencia de la faceta `entities` del payload (`facetsOf()`, [facets.ts:8-16](../../apps/api/src/common/adapters/facets.ts#L8-L16)) sobre esos hasta 200 puntos; si hay alguna, el nombre es la entidad #1 capitalizada ([:25-35](../../apps/api/src/modules/organization/naming.service.ts#L25-L35)).
3. Fallback a LLM **solo si no hay ninguna entidad**: hasta 8 textos crudos → `llm.complete(prompt, {maxTokens:32, temperature:0})` pidiendo 1-3 palabras, con `.catch(()=>null)` para no romper el flujo ([:36-44](../../apps/api/src/modules/organization/naming.service.ts#L36-L44)).
4. Persiste `name`/`anchorEntities` en `Space` ([:46-50](../../apps/api/src/modules/organization/naming.service.ts#L46-L50)).

### 5.9 Bootstrap / cold start (`EngineBootstrapService`)

Wipe + rebuild + rehome idempotente ([engine-bootstrap.service.ts:47-75](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L47-L75)):
1. `wipeEngineState()` borra `memoryEdge`, `memoryPersona`, `engineComponent`, `engineTask` — exactamente esas 4 tablas ([:80-85](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L80-L85)).
2. `rebuildGraph()`: **un único** `VectorStorePort.scroll(P.own(userId), {withVectors:true, limit:100_000})` ([:88-94](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L88-L94)) — imposible de hacer vía mem0 (su único método de lectura es top-k por query). Por cada punto con vector, `graph.insert(...)` (el `Set` que retorna se descarta a propósito — el bootstrap recomputa *todas* las personas, no solo las afectadas).
3. `liveMemoryIds()` lee `Prisma.memoryIndex` (no el vector store) para la lista completa de memorias vivas ([:66,97-103](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L97-L103)).
4. `personas.recompute()` → `communities.reconcile()` → `treeBuilder.rebuild()` ([:67-71](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L67-L71)).
5. `rehomeAndDropOldAreas()` ([:105-150](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L105-L150)): mueve `Grant`/`FragmentShare`/`File`/`Lens` de las áreas viejas a la Space-comunidad con **plurality** de memorias; solo los `File` caen a `General` si no hay plurality clara (comentario explícito: *"Only Files fall back to General"*, [:18-23](../../apps/api/src/modules/organization/bootstrap/engine-bootstrap.service.ts#L18-L23)).

### 5.10 Bandeja de sugerencias + undo (`SuggestionsService`)

El motor **auto-aplica** reorganizaciones "access-preserving" en silencio y las registra para que el usuario las revise — no pide permiso antes de actuar, pero deja rastro deshacible donde es posible ([suggestions.service.ts:24-32](../../apps/api/src/modules/organization/suggestions.service.ts#L24-L32)):

- `create()` — crea `Suggestion` + `Notification` en la misma llamada ([:41-47](../../apps/api/src/modules/organization/suggestions.service.ts#L41-L47)).
- `accept()` — **no** ejecuta ninguna acción estructural: el cambio ya fue aplicado por el motor; solo marca `status='accepted'` ([:56-60](../../apps/api/src/modules/organization/suggestions.service.ts#L56-L60)).
- `dismiss()` — el único undo real, con branching por `kind` ([:62-77](../../apps/api/src/modules/organization/suggestions.service.ts#L62-L77)):
  - `duplicate` → `kernel.restore()` de la memoria superseded.
  - `split` → revierte cada `MemoryEvent` vía `revertMoveEvent()` (usa `revertPayload`, el valor *previo*, [:83-90](../../apps/api/src/modules/organization/suggestions.service.ts#L83-L90)) y borra sub-áreas hijas que quedaron vacías.
  - `merge` → **sin undo** — el área borrada no es recreable de forma sólida (comentario explícito, [:74](../../apps/api/src/modules/organization/suggestions.service.ts#L74)).

`organization.module.ts` declara los 10 providers del motor y solo importa `KernelModule` + `AreasModule` como dependencias externas — **nunca** `MemoryModule` ([organization.module.ts:22](../../apps/api/src/modules/organization/organization.module.ts#L22)).

## 6. Cómo se monta sobre mem0

**Veredicto, verificado en los 14 archivos del motor + los 6 de `modules/memory/`: cero llamadas a `Mem0Service.add()`/`Mem0Service.searchCandidates()` desde el motor.**

La razón es mecánica: `Mem0Service.searchCandidates()` ([mem0.service.ts:53](../../apps/api/src/modules/memory/mem0.service.ts#L53)) es *siempre* `this.mem0.search(query, {filters, topK})` — top-k semántico por query. El motor necesita:
- **Corpus completo** en el bootstrap (`scroll(limit:100_000)`),
- **Vecinos por coseno** en cada inserción (`knn`),

operaciones que la API de mem0 no expone. Por eso el motor tiene su propio adapter dedicado a Qdrant (`vector-store.qdrant.adapter.ts`), separado por completo del que usa mem0 internamente.

**La única costura real con mem0** (no una API call, un dato compartido): el *entity-boost* de las aristas del grafo. `memory-graph.service.ts:15-16` documenta el boost como *"shared entities via the mem0 entity store"*, y la implementación de producción de `EntityGraphPort` es `Mem0EntityGraphAdapter` ([entity-graph.mem0.adapter.ts:6-11](../../apps/api/src/common/adapters/entity-graph.mem0.adapter.ts#L6-L11)), cuyo docstring dice *"Reads mem0's `{collection}_entities` store"* y hace `scroll` directo sobre esa colección Qdrant. Es decir: el motor no llama a `Mem0Service`, pero **sí lee, vía un puerto propio, una colección que mem0 genera** — el entity store, no el store de memorias.

Tabla resumen:

| Dato que necesita el motor | Fuente real | ¿Pasa por `Mem0Service`? |
|---|---|---|
| Vector 1536d de una memoria | `VectorStorePort.retrieve/knn/scroll` (Qdrant) | No |
| Corpus completo (bootstrap) | `VectorStorePort.scroll` (Qdrant) | No |
| Entidades para el entity-boost | `EntityGraphPort` → `Mem0EntityGraphAdapter` → colección `{collection}_entities` de mem0 | No (bypass vía adapter propio, pero el dato lo generó mem0) |
| Texto de la memoria (naming fallback LLM) | payload Qdrant (`payload.data ?? payload.memory ?? payload.text`) | No |
| Extracción/dedup al escribir | `Mem0Service.add()` | Sí — esto es lo único que mem0 hace, y ocurre **antes** de que el motor entre en juego |

## 7. Tabla de umbrales (`engine-config.ts`)

Un solo archivo, compartido por el camino online, el rebuild offline y el bootstrap — *"the online/offline determinism the design depends on (a freshly-bootstrapped tree must equal what incremental edits would produce)"* ([engine-config.ts:1-6](../../apps/api/src/modules/organization/engine-config.ts#L1-L6)).

| Constante | Valor | Para qué |
|---|---|---|
| `K` | `15` | Fan-out del mutual-kNN por memoria |
| `NEAR_DUP_COS` | `0.97` | Coseno top-1 ≥ esto al escribir → supersede, no entra al grafo |
| `ENTITY_BOOST` | `0.15` | Peso extra de arista si dos memorias comparten ≥1 entidad |
| `MERGE_HI` | `0.5` | Coupling inter-comunidad ≥ esto → candidato a merge |
| `SPLIT_LO` | `0.2` | Bipartición interna más rala ≤ esto → candidato a split |
| `MIN_COMMUNITY_SIZE` | `3` | Bajo esto, la comunidad se pliega a su vecino más fuerte / General |
| `TREE_REBUILD_DELTA` | `8` | `changeCounter` por componente que dispara un rebuild completo del árbol |
| `HISEVENT_SUBSET_N` | `200` | Cap del subset jerárquico HISEvent — limita el paso greedy a `O(n³)` |

## 8. Garantías de diseño (invariantes)

- **No-oscilación por construcción**: `SPLIT_LO (0.2) < MERGE_HI (0.5)` con el mismo criterio de corte (`sparsestBipartition`) gateando ambas reglas — un split reciente nunca vuelve a mergearse de inmediato, y viceversa.
- **Determinismo online/offline**: los mismos tunables de `engine-config.ts` rigen el camino incremental y el bootstrap completo — un árbol reconstruido desde cero debe coincidir con el que producirían ediciones incrementales.
- **Áreas manuales son intocables**: `Space.governance='manual'` se excluye de `frozenCommunities()` — el motor nunca reorganiza lo que el usuario fijó a mano.
- **Un solo aplicador de mutaciones**: `StructureExecutorService` es el único camino de escritura hacia `MemoryArea`/merge/split — ni `community.service.ts` ni `tree-builder.service.ts` escriben la estructura directamente, solo leen y delegan.
- **Reorg silenciosa pero deshacible donde es posible**: el motor actúa sin pedir permiso, pero `split` y `duplicate` tienen undo real vía `MemoryEvent.revertPayload`; `merge` no, por diseño (no hay forma sólida de deshacer un borrado de área).
- **El motor nunca cruza la frontera de acceso**: todas sus lecturas de vectores usan `P.own(userId)`/`P.author(userId)` — nunca opera sobre memorias de otro usuario.

## 9. Gaps encontrados (honestidad primero)

Estos son hallazgos reales de la verificación contra el código, no crítica al diseño — quedan anotados para quien continúe trabajando en el motor:

- **El "monotonicity guard" de `treeSe()` no está implementado.** El docstring de `structural-entropy.ts` declara la intención de comparar la entropía antes/después de un rebuild y solo aceptarlo si no aumenta — pero ningún archivo del motor ejecuta esa comparación. O vive en un archivo fuera de lo auditado, o es un cabo suelto real.
- **Comentario obsoleto**: `community-ops.ts:141` dice *"NUL separator"* pero el código usa un espacio como separador de la clave `community-pair`. Inocuo mientras los ids sean UUIDs sin espacios, pero la doc miente.
- **`community-ops.ts` no reusa `graph.ts`**: reimplementa su propia búsqueda de componentes (`componentsAbove`) y sus propios `crossWeightIn`/`incidentVol` en vez de `connectedComponents`/`degree`/`volume`. No es un bug, pero es una duplicación de lógica entre dos archivos del mismo subsistema.

## 10. Glosario

| Término | Significado |
|---|---|
| **Persona** | Instanciación de UNA memoria como miembro pleno de UNA comunidad — el mecanismo que permite membership múltiple |
| **Comunidad** | Grupo de personas con alto acoplamiento interno; se materializa como un `Space(kind=community)`, una hoja del árbol |
| **Componente** | Componente conexo del persona-graph completo — la unidad sobre la que corre el encoding tree |
| **Área / Space** | Nodo del árbol visible al usuario; `kind=community` (hoja) o `kind=internal` (contenedor, engine-owned, efímero) |
| **Coupling** | `peso_cruzado / min(volumen_A, volumen_B)` — la métrica de acoplamiento entre dos grupos, usada tanto para decidir merge como split |
| **Encoding tree** | El árbol jerárquico que minimiza la entropía estructural del grafo de comunidades |
| **Bandeja / Suggestion** | La cola de propuestas que el motor auto-aplica y el usuario puede revisar/deshacer |

## 11. Procedencia de este documento

Generado con un workflow de 8 lectores + 8 verificadores adversariales corriendo en paralelo (uno por subsistema), cada verificador releyendo el código fuente de forma independiente sin confiar en las afirmaciones del lector. 2 de los 8 lectores fallaron y devolvieron output de placeholder (`"test"`/`"a"`/`"b"`) sin ningún contenido real; el paso de verificación lo detectó y esos dos verificadores rehicieron la lectura completa desde cero, así que el contenido final de esas dos secciones (runtime del motor, colocación+ejecución) viene 100% del verificador, no del lector original. Todas las citas `archivo:línea` de este doc están confirmadas por al menos un agente que leyó el código real — no son inferencias.
