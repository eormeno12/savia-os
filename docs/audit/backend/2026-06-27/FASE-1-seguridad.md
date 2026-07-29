# FASE 1 — Seguridad y frontera de acceso

> **Objetivo:** una **única capa de autorización**, default-deny, **pura y unit-testeable**. Cierra el **IDOR P0-1** y el hardening de auth.
> **Hito:** backend seguro. · **Depende de:** FASE-0 (schema + ports). · **Esfuerzo:** L.
> **Referencia:** [`08 §6`](08-plan-end-to-end.md), [`0A §B.1/§B.3/§B.5`](0A-analisis-correctitud.md), `02-P0-1/P0-3/SEC-1..6/AUTHZ`, spec 15.

## Alcance
- **AccessService** = la única fuente de decisiones de acceso (lectura, mutación, gestión).
- **Guard global** default-deny + `@Public()`.
- **Auth robusta**: rotación/revocación de refresh, cookies, rate-limit, edge MCP.

## Arquitectura / decisiones (de `0A`, las P0)
- **Compilador PURO separado del I/O** (F3/F18): `AccessFilterCompiler.compile(grants, fragments, requested) → Predicate` es **pura** (sin DB); `GroupScopeResolver` hace membership/fetch **antes**. Un evaluador `Predicate.matches(payload)` permite **testear en memoria** que un payload es/no visible para un set de grants — el test que cierra IDOR/over-share.
- **OCP por provider** (F11): cada scope (space/lens/group, y "entity grant" futuro) es un `ScopePredicateProvider`; el compiler solo hace `OR`. **Nada de `if/if/if`.**
- **`AccessService` orquesta, no compila** (F1): expone `assertCanMutateMemory`/`assertCanRead/Write/ManageSpace`.
- La frontera es `savia_area_ids ANY` (multi-membership, con **ancestros** al write-time) ∩ sensibilidad, clamp `granted∩requested`, default-deny → preserva spec 15 (verificado en `0A §A`).

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F1.1** AccessFilterCompiler **PURO** + providers | `compile(...) → Predicate`; `ScopePredicateProvider` space/lens/group; evaluador `Predicate.matches` | **suite unit sin infra:** default-deny · clamp · sensibilidad (`sensitive` no fluye sin `includeSensitive`) · subárbol-por-ancestros (grant "Trabajo" ve descendientes, **no** hermanos) | F0.1 | M |
| **F1.2** GroupScopeResolver | membership + fetch de fragmentos (I/O) → data plana al compiler | test con grupo+fragmentos | F0.6 | S |
| **F1.3** AccessService + `assertCan*` | `assertCanMutateMemory` (autor o admin del área), `assertCanRead/Write/ManageSpace` | tests por assert | F0.6·F1.1 | M |
| **F1.4** Guard global + **fix IDOR** | `JwtAuthGuard` como `APP_GUARD` + `@Public()` (auth/health/webhook); `DELETE /memory/:id` vía `assertCanMutateMemory` | **e2e IDOR:** A crea → B borra → **403/404** | F0.6·F1.3 | M |
| **F1.5** AuthSession (rotación/revocación) | refresh **rota+revoca**; logout invalida (jti denylist Redis); cookie helper único (SameSite/Secure por entorno) | e2e: refresh rota · logout invalida | F0.6 | M |
| **F1.6** Rate-limit + edge MCP | `@nestjs/throttler` (OTP/login); MCP `json({limit})` + rate-limit por IP **antes** del lookup + `trust proxy` | throttler bloquea; token basura no pega a PG sin throttle | F0.2 | M |
| **F1.7** `queryDigest` SHA-256 | reemplaza el base64 reversible (PII) | AccessLog guarda hash, no texto | F0.6 | S |

## Definition of Done
- [ ] La suite unit del `AccessFilterCompiler` cubre default-deny / clamp / sensibilidad / subárbol (los 4 invariantes de spec 15).
- [ ] El **e2e del IDOR** pasa (A crea, B borra → 403).
- [ ] Refresh rota y logout invalida (test).
- [ ] Ningún controller queda público por olvido (guard global).
- [ ] El edge MCP no permite DoS pre-auth contra Postgres.
