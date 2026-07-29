# FASE 6 — Capa de producto + contrato del frontend  ★ frontend-ready

> **Objetivo:** las superficies que el front consume + **el contrato único** en `@savia-os/contracts`. Al cerrar esta fase, **el frontend se conecta** (con F0–F3 ya hechas).
> **Hito:** **frontend-ready**. · **Depende de:** FASE-2, FASE-3 (y FASE-5 para colectivo). · **Esfuerzo:** L.
> **Referencia:** [`05 §2/§3`](05-rediseno-estructural.md), [`01`](01-gap-frontend.md) (stubs/drift), [`08 §6.5`](08-plan-end-to-end.md) (mapa).

## Alcance
- **El contrato** (`@savia-os/contracts`) como **fuente única** de DTOs — el front lo importa, **deja de redeclarar** (cierra el drift de `01 §C`).
- **Superficies:** Cuenta (export/delete), Bandeja (`Notification`), Pulso (eventos+revert), Lentes (búsquedas guardadas), Drive (por área).
- **Mapa:** `tree` + `sample` + el highlight = preview de acceso (`08 §6.5`).

## Arquitectura / decisiones (de `0A`)
- **Contrato canónico**: publicar en `@savia-os/contracts` los DTOs reconciliados a multi-membership + federación; el front borra sus interfaces locales (`SpaceDto`/`SpaceMemoryDto`/`CollectiveMember`).
- **Ciclo de cuenta** (F5/0A `02-D2`): `account/delete` purga **Qdrant (`user_id`) + S3 (`users/{userId}/`) + entity-store de mem0** (las cascadas Prisma solo cubren Postgres).
- **`Notification`/`Job`/`Suggestion`** alimentan una Bandeja polimórfica (no 3 endpoints sueltos).

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F6.1** Contrato `@savia-os/contracts` | publicar DTOs (Area/MemoryResult/GroupDto/LensDto/InboxItem/GrowthEvent/SubscriptionDto…) reconciliados; el front los importa | `typecheck` del front contra el paquete; sin DTOs locales redeclarados | F3·F5 | M |
| **F6.2** Cuenta (export/delete) | `account/export` (Job→S3 presigned); `account/delete` (Job: transfiere admin, borra spaces, **purga Qdrant+S3+entity-store**, borra User) | export entrega presigned URL; delete no rompe colectivos y purga todo | F2·F5 | M |
| **F6.3** Bandeja + Pulso | `Notification` (invites+suggestions+jobs+hitos) + badge; `Job` surface; Pulso eventos tipados + `revert` (`MemoryEvent`) | la bandeja unifica las fuentes; revert usa `revertPayload` | F4·F5 | M |
| **F6.4** Lentes + Drive | `Lens` (búsquedas guardadas, sustituye `localStorage`); Drive por área con ACL por membership | lente concede acceso con preview; subir archivo exige `contributor+` en área compartida | F1·F3 | M |

## Definition of Done
- [ ] Todos los métodos de `api.ts` resuelven contra un endpoint con shape compatible (cierra `01`).
- [ ] El front importa `@savia-os/contracts` y no redeclara DTOs.
- [ ] `account/delete` purga Postgres **y** Qdrant **y** S3 (test).
- [ ] La Bandeja unifica invitaciones + sugerencias + jobs.
- [ ] **El frontend puede conectarse** end-to-end (auth → áreas → memoria → colectivo → cuenta).
