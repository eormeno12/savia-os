# FASE 4 — Motor dinámico (split · merge · decay · sugerencias)

> **Objetivo:** la **auto-organización dinámica**, estable, reversible y consentida.
> **Hito:** la memoria se organiza sola. · **Depende de:** FASE-3. · **Esfuerzo:** L.
> **Referencia:** [`08 §4/§8`](08-plan-end-to-end.md), [`0A §B.1/§B.3/§B.5`](0A-analisis-correctitud.md), `02-INT-1/2/6/7`.

## Alcance
- **Reestructura disparada por drift**: split/merge/decay sobre el árbol, incremental.
- **Cola de sugerencias** + digest + undo (lo que toca fronteras concedidas se propone, no se aplica solo).
- **Workers** robustos (shutdown, DLQ, idempotencia) + **eval harness** con guardrails.

## Arquitectura / decisiones (de `0A`)
- **Motor partido en servicios**, **ninguno escribe directo** — emiten *proposals* al write-kernel → "no cruza scope" **por construcción** (F2): `ReclusterStrategy`, `ConsolidationService`, `NamingService`.
- **Estrategias pluggables** (F12): `SplitStrategy` (dip-test + silhouette), `MergeStrategy` (histéresis + Jaccard) → devuelven proposals; el eval es un **selector de estrategia**, no un parche al core.
- **Math puro/free-function** (F19): `CfStats`, `dip`, `twoMeans`, `silhouette` sobre arrays → testeable sin Qdrant; "histéresis ⇒ no oscila" es una **aserción**.
- **Señal de entidad inyectable** (`SimilaritySignal`/`NamingSignal`) con null-object (F13).
- **Workers como `@Processor()` del DI** con shutdown automático (F15, `02-INT-1`); **DLQ** + idempotencia (`02-INT-2`).

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F4.1** Math puro + CfStats | `CfStats(add/remove/radius/cohesión)` + `dip`/`twoMeans`/`silhouette` free-functions | property-tests: radio O(1) correcto; dip rechaza unimodal; **merge ≫ split ⇒ no oscila** | F3 | M |
| **F4.2** ReclusterStrategy (split/merge) | drift-trigger; `SplitStrategy`/`MergeStrategy` pluggables; emite proposals al write-kernel | split de área multimodal (datos sintéticos); el motor **no cruza scope** | F2·F4.1 | L |
| **F4.3** Consolidación + decay | near-dup → `superseded` (soft, reversible); decay de áreas viejas | dedup marca, no borra; undo revierte | F2·F4.1 | M |
| **F4.4** Naming | entidad dominante = nombre; LLM fallback batch (vía `LlmPort`); nunca en caliente | área nombrada por su entidad; fallback cuando no hay entidad | F2 | S |
| **F4.5** Sugerencias + digest/undo + workers | `Suggestion` queue → Bandeja; digest deshacible (`MemoryEvent`); workers `@Processor` + DLQ + graceful shutdown | aplicar/descartar sugerencia; SIGTERM cierra workers limpio; eval harness emite métricas | F2·F4.2 | M |

## Definition of Done
- [ ] El math de split/merge tiene tests puros (sin infra) y la no-oscilación es una aserción verde.
- [ ] La reorg es access-preserving (split/merge dentro de un subárbol no cambia un grant) — test.
- [ ] El motor nunca escribe directo (solo proposals al write-kernel) ni cruza scope.
- [ ] Los workers cierran limpio en SIGTERM; los fallos terminales van a DLQ.
- [ ] Decay/consolidación son reversibles (undo).
