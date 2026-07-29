# FASE 2 — Memoria y consistencia (write-kernel · outbox · mem0-sidecar · búsqueda)

> **Objetivo:** **una sola vía de escritura** con consistencia cross-store + el substrato mem0 + la **búsqueda híbrida**. Cierra P0-2 e INT-*.
> **Hito:** memoria consistente + retrieval real. · **Depende de:** FASE-0 (schema/ports), FASE-1 (acceso). · **Esfuerzo:** L.
> **Referencia:** [`08 §3/§6.3/§7`](08-plan-end-to-end.md), [`0A §B.1/§B.2`](0A-analisis-correctitud.md), `02-P0-2/INT-1..7`.

## Alcance
- **Write-kernel**: toda mutación de memoria pasa por un único punto, transaccional, con outbox.
- **mem0-sidecar**: mem0 en el borde (`add`/`search`); nosotros poseemos la organización sobre el mismo Qdrant vía `savia_*`.
- **Búsqueda híbrida** de mem0 con filtro de acceso.

## Arquitectura / decisiones (de `0A`, las P0)
- **Write-kernel partido** (F1): `WriteKernelPolicy` (decide Allow/Deny — scope-confined, no-borrado, reversible, sensible-gated — **puro**) + `MemoryMutationService` (lo único que toca Prisma: `$transaction(MemoryIndex + MemoryEvent + OutboxEvent)`) + `CfAccumulator` (math puro). Vive en un **`KernelModule`** sobre el `@Global InfraModule` (F14) → sin circular-deps.
- **Outbox** (F5): `OutboxRelay` (worker `@Processor` del DI) aplica a Qdrant (`setPayload`/upsert, `wait:true`) → `committed` y reintenta `failed`. El **borrado de huérfanos NO va acá** → `VectorGarbageCollector` separado (único con capacidad de borrar; grace + dry-run + audit) — el reconciliador que borra contradecía el invariante "no-borra".
- **mem0 = dependencia, no fork** (`08 §3`): `VectorStorePort` adapter (`scroll(with_vectors)` reusa embeddings, `setPayload`); `EntityGraphPort` para `{collection}_entities`.
- **Provenance = `user_id` de mem0**; payload `savia_area_ids/primary/entities/sensitivity/superseded` (un `PayloadSchema` tipado, F23).

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F2.1** Write-kernel (policy + mutation) | `WriteKernelPolicy` puro + `MemoryMutationService` (`$transaction`+outbox) + `CfAccumulator`; `KernelModule` | **toda** mutación pasa por aquí; unit del policy (rechaza cross-scope y delete-duro); test de fallo parcial (PG ok, Qdrant down → no inconsistencia visible) | F0/F1 | L |
| **F2.2** OutboxRelay + VectorGC | relay (`@Processor`, `wait:true`, retry) + GC separado (grace/dry-run/audit) + reconciliador de `failed` | test: vector huérfano se borra **solo** tras grace; relay idempotente (jobId determinista) | F2.1 | M |
| **F2.3** mem0-sidecar (adapters) | `VectorStorePort`/`EntityGraphPort` sobre la colección de mem0; `PayloadSchema` tipado; drop `submemories`/legacy | lee vectores sin re-embeber; contract-test del entity-store pineado a la versión de mem0 | F0.1 | M |
| **F2.4** Búsqueda híbrida | `memory.search` → `mem0.search(query, filters=AccessFilter)` (dense+BM25+entidades+rerank) | e2e: search filtrado por `savia_area_ids` + match de término exacto (BM25); embedder caído → **falla limpio** (D8) | F1·F2.3 | M |

## Definition of Done
- [ ] No existe ninguna escritura de memoria fuera del write-kernel (`grep` de `$transaction`/`mem0.add` confinado).
- [ ] Bajo fallo parcial no quedan vectores huérfanos ni filas sin vector (test del reconciliador).
- [ ] El borrado de vectores ocurre **solo** en el `VectorGarbageCollector`, con audit.
- [ ] Search usa la recuperación híbrida de mem0 y respeta el filtro de acceso.
- [ ] `submemories` y el dense-only legacy eliminados.
