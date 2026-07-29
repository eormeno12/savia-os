# FASE 8 — Producción (observabilidad · resiliencia · datos · CI/CD · gate)

> **Objetivo:** que el sistema sea **operable, observable, recuperable y resiliente**. Es el **gate de producción**.
> **Hito:** **production-ready**. · **Depende de:** todas. · **Esfuerzo:** L.
> **Referencia:** [`0A §C`](0A-analisis-correctitud.md) (prod-readiness), `02` (transversal), [`08 §7`](08-plan-end-to-end.md), [`09 §6`](09-modulo-pagos.md).

> ⚠️ Las revisiones marcaron que el diseño **no menciona** backups, migrate-on-deploy ni observabilidad. Esta fase los hace explícitos.

## Gate de producción — los 7 imprescindibles
1. **Backups + restore probado** (Postgres y Qdrant). *(D5 gestionado cubre Postgres; Qdrant necesita snapshots del volumen.)*
2. **Migrate-on-deploy** (step one-shot `migrate deploy`, expand-contract). *(D5 lo facilita.)*
3. **Env validado al boot** (ya en F0.2 — verificar en los 3 entrypoints).
4. **Outbox** (ya en F2 — verificar relay+reconciler+GC + métrica de lag).
5. **Graceful shutdown + `jobId`** (ya en F2/F4 — verificar en todos los workers).
6. **Edge del MCP** (ya en F1.6 — + rate-limit de borde en Caddy).
7. **Fix del IDOR** (ya en F1.4).

## Alcance (lo nuevo de esta fase)
| Área | Qué |
|---|---|
| **Observabilidad** | logs JSON (pino) con `requestId` **propagado al job de BullMQ**, niveles, **redacción de PII**; **métricas Prometheus** (latencia/errores HTTP, **depth/failed/stalled de colas, DLQ, lag del outbox**, latencia+429 de OpenAI, **$/usuario**) + alertas; **healthchecks reales** (worker heartbeat, MCP pinga deps). |
| **Resiliencia** | timeouts + retry/backoff+jitter + **circuit breaker** en los ports externos; **degradación clara** (embedder caído → "búsqueda no disponible", no 500 — **D8**); back-pressure en ingest; **DLQ** + reclaim de stalled ante reinicio de Redis. |
| **Costo/latencia** | **batch de embeddings**, cache de embeddings de query, `scroll` acotado, **cap de costo/rate por tenant**, ceiling de frecuencia del clustering. |
| **Datos** | backups + restore drill; snapshots de Qdrant; expand-contract en migraciones; export/delete GDPR (purga Qdrant+S3+entity-store). |
| **CI/CD** | typecheck+lint+test + **migration-drift** + cobertura (≥ `AccessFilter` default-deny + reducer del webhook); **load/abuse testing** (IDOR, tenant ajeno, replay, DoS del edge MCP); build de imagen; sandbox de pagos. |
| **Seguridad ops** | secrets gestionados; rate-limit de borde (Caddy) en `/mcp` y `/webhooks`; CORS/helmet; `trust proxy`. |

## Tickets
| Ticket | Qué | Aceptación | Tam |
|---|---|---|---|
| **F8.1** Backups + restore | `pg_dump`/WAL (gestionado) + snapshots Qdrant + **restore drill documentado** | restore probado desde backup | M |
| **F8.2** Migrate-on-deploy | step one-shot `migrate deploy` + expand-contract | el rollout migra antes de arrancar la API | S |
| **F8.3** Observabilidad | pino+requestId+PII redaction; métricas Prometheus + alertas; health reales | `/health` refleja deps caídas; métricas de cola/outbox visibles | L |
| **F8.4** Resiliencia | timeouts/retry/circuit-breaker en ports; degradación limpia; DLQ; back-pressure | OpenAI down → search "no disponible" (no 500); colas no se desbordan | M |
| **F8.5** Costo/latencia | batch embeddings; cache de query; `scroll` acotado; cap por tenant | $/usuario medido; sin scroll ilimitado | M |
| **F8.6** CI/CD + load/abuse | gates completos + load test del edge MCP + sandbox de pagos | CI gates verdes; load test pasa | M |
| **F8.7** Runbook | deploy, rollback, **restore**, on-call de webhooks/colas | runbook revisado | S |
| **F8.8** Gate "no dead code" | verificar que el **reemplazo fue limpio**: cero `@deprecated`/TODO-legacy/ramas de compat; sin servicios/endpoints/campos/payload-keys sin uso; `submemories`/dense-only fuera | `knip`/`ts-prune` verde; grep de legacy vacío; el inventario del README todo borrado | S |

## Definition of Done (= production-ready)
- [ ] Los **7 imprescindibles** verdes.
- [ ] Restore probado; `migrate deploy` en el rollout.
- [ ] `/health` real; métricas + alertas de cola/outbox/costo.
- [ ] OpenAI/Qdrant down → degradación limpia (no 500).
- [ ] CI con gates (typecheck/lint/test/drift/cobertura) + load/abuse test del edge.
- [ ] Runbook (deploy/rollback/restore) documentado.
