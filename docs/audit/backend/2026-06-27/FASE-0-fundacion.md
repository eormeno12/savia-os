# FASE 0 — Fundación (andamiaje + schema objetivo)

> **Objetivo:** una base **limpia, testeable y vendor-desacoplada** + el **schema objetivo** migrado. Sin esto, las fases siguientes acoplan a vendors y no son testeables.
> **Hito:** base sobre la que todo lo demás se construye. · **Depende de:** — · **Esfuerzo:** M–L.
> **Referencia:** [`08 §2/§3`](08-plan-end-to-end.md), [`05 §1`](05-rediseno-estructural.md), [`0A §B.2/§C`](0A-analisis-correctitud.md), `02-SEC-7/OBS-1/ERR-1`.

## Alcance
- **Ports & adapters** (DIP): el dominio depende de interfaces, no de OpenAI/Qdrant/mem0/S3.
- **Config validada al boot** (Joi) en los 3 entrypoints (main/worker/mcp).
- **Errores, logging, helmet** transversales.
- **Test harness + CI** (la pirámide de tests vive desde acá).
- **Schema objetivo** migrado (Postgres **gestionado**, D5) — es el substrato de todas las fases.

## Modelo de datos
La migración completa al modelo de [`08 §2`](08-plan-end-to-end.md) (core) + [`05 §1`](05-rediseno-estructural.md) (producto). Decisiones de modelado de [`0A` F22/F23](0A-analisis-correctitud.md): **CHECK** `exactly-one-non-null` en `Grant{spaceId?,lensId?,groupId?}` y `FragmentShare`; **enums en columnas** (no strings); cascadas `onDelete` explícitas; índices/cursor estable.

## Arquitectura / decisiones (de `0A`)
- `VectorStorePort.knn(vector, **predicate**, k)` — toma un **predicado de acceso**, NO el filtro crudo de Qdrant (F7/F9).
- `EntityGraphPort` es el **único** que conoce `{collection}_entities` de mem0 → contract-test pineado a la versión (F9).
- **`@Global() InfraModule`** exporta los ports → mata el re-provisioning por módulo (F14).
- Un solo `EmbeddingsPort`/adapter → elimina los 4 `new OpenAI()` dispersos (F7, `02-SEC-7`).

## Tickets
| Ticket | Qué | Aceptación | Tam |
|---|---|---|---|
| **F0.1** Ports + `@Global InfraModule` | `EmbeddingsPort`·`LlmPort`·`VectorStorePort`(`knn(predicate)`)·`EntityGraphPort` + adapters OpenAI/mem0-Qdrant | el dominio no importa SDKs de vendor; test de adapter mockeado | M |
| **F0.2** Config al boot (Joi) | `validationSchema` que **falla en prod** si falta `OPENAI/JWT/MCP/AWS/MP_*`, en main/worker/mcp | boot falla con env faltante + test | S |
| **F0.3** ExceptionFilter + helmet | domain→HTTP correcto sin filtrar internals; `helmet()` | `Forbidden`→403; error inesperado→500 sin stack | S |
| **F0.4** Logging + requestId + PII | pino JSON; interceptor `requestId` (propagable a jobs BullMQ); redacta email/query/token | logs JSON con `requestId`; PII redactada | S |
| **F0.5** Test harness + CI | jest(unit)+supertest(e2e)+testcontainers(PG/Qdrant/Redis); CI: typecheck·lint·test·`migrate diff` | CI verde en un PR | M |
| **F0.6** Migración del schema objetivo | Prisma → `08 §2`+`05 §1`; CHECK constraints; enums en columnas; cascadas; **Postgres gestionado** + `migrate deploy` en pipeline | `migrate reset/deploy` desde cero verde; drift vacío | L |

## Definition of Done
- [ ] Cero `new OpenAI()`/`new QdrantClient()` fuera de los adapters.
- [ ] El API **no bootea** sin los env requeridos.
- [ ] CI corre typecheck+lint+test+drift en cada PR.
- [ ] El schema objetivo aplica desde cero y el cliente Prisma genera.
- [ ] Un test de adapter (embeddings mockeado) y uno del exception filter pasan.
