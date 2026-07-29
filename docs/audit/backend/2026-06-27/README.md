# Plan de cierre del backend de Savia — por fases (production-ready)

> **Qué es esta carpeta:** el **plan ejecutable por fases** para cerrar el backend, dejarlo **listo para conectar con el frontend** y **production-ready**. Las **fases** (`FASE-0` … `FASE-8`) son lo que se ejecuta; los docs de **diseño**, **hallazgos** y **análisis** quedan como **referencia citada**.
>
> **Estado del código:** **no cambió** desde la auditoría → los hallazgos (`01`/`02`/`03`) describen el estado actual y son **criterios de aceptación** del rebuild. **No está expuesto** (decisión D3) → se va directo al rebuild, sin parches al código viejo.
>
> **Empezá por** [`FASE-0`](FASE-0-fundacion.md) y seguí el orden de dependencias.

---

## Decisiones cerradas (fuente: `08` + producto)

| # | Decisión | Resuelto |
|---|---|---|
| D1 | Membership | **multi-membership** (`savia_area_ids`) — una memoria vive en varias áreas |
| D2 | Colectivo | **federación** (grupo + fragmentos); al salir, tu fragmento **se va con vos** + "donar snapshot" |
| D3 | Exposición | **NO expuesto** → rebuild directo, sin hotfix paralelo |
| D4 | Pricing | **$11.99/mes**, **USD o moneda local por país**, **sin plan anual** |
| D5 | Hosting | **Postgres gestionado** (RDS/Neon) → backups + migrate del proveedor; snapshots de Qdrant |
| D6 | Entidades | **entity-store de mem0** (señal secundaria + contract-test) |
| D7 | Alcance | **todo es el MVP** (en desarrollo) → F0–F8 completo, sin diferir motor/federación |
| D8 | Búsqueda | embedder caído → **fallar limpio** (cache de queries, después) |

> `08` fija D1/D2 en contra de las specs 14/16/17 → **specs `13`/`14`/`15`/`16`/`17` actualizadas** (banner que documenta el cambio y apunta al diseño canónico).

---

## Mapa de fases

```
 FASE-0 Fundación ─────────┬─► FASE-1 Seguridad ──► FASE-2 Memoria+consistencia ──┬─► FASE-3 Áreas+ruteo ─┬─► FASE-4 Motor dinámico
 (ports·config·errores·     │                                                     │                      └─► FASE-5 Federación
  logging·tests·CI·SCHEMA)  │                                                     ├─► FASE-6 Producto + CONTRATO frontend
                            └─────────────────────────────────────────────────────► FASE-7 Pagos (∥)
 (todas) ──────────────────────────────────────────────────────────────────────────► FASE-8 Producción (gate)

 HITO "listo para frontend"     = F0 + F1 + F2 + F3 + F6   (rutas + DTOs + memoria + acceso)
 HITO "production-ready"        = + F8 (observabilidad, resiliencia, backups, CI, gate)
 DIFERENCIAL (mismo MVP)        = F4 (motor) + F5 (federación)
```

| Fase | Foco | Hito | Esf. |
|---|---|---|---|
| [`FASE-0`](FASE-0-fundacion.md) | Andamiaje (ports/config/errores/logging/tests/CI) **+ schema objetivo** | base testeable | M–L |
| [`FASE-1`](FASE-1-seguridad.md) | Frontera de acceso central, IDOR, auth, rate-limit | seguro | L |
| [`FASE-2`](FASE-2-memoria.md) | Write-kernel + outbox + mem0-sidecar + búsqueda híbrida | consistencia + retrieval | L |
| [`FASE-3`](FASE-3-areas-y-ruteo.md) | Árbol de áreas + ruteo multi-membership + rutas | core de memoria | L |
| [`FASE-4`](FASE-4-motor-dinamico.md) | Split/merge/decay + sugerencias | auto-organización | L |
| [`FASE-5`](FASE-5-federacion.md) | Colectivo (federación) | colaboración | L |
| [`FASE-6`](FASE-6-producto-y-contrato.md) | Cuenta/bandeja/pulso/lentes/drive **+ `@savia-os/contracts`** | **frontend-ready** | L |
| [`FASE-7`](FASE-7-pagos.md) | Mercado Pago (freemium server-side) | monetización | L |
| [`FASE-8`](FASE-8-produccion.md) | Observabilidad · resiliencia · backups · CI/CD · gate | **production-ready** | L |

---

## Gate de producción — los 7 imprescindibles (FASE-8)

Ninguno se sirve a usuarios reales sin esto (el diseño no los menciona): **(1)** backups + restore probado · **(2)** migrate-on-deploy (expand-contract) · **(3)** env validado al boot · **(4)** outbox (o `$transaction` + Qdrant `wait:true` + reconciliador) · **(5)** graceful shutdown de workers + `jobId` · **(6)** edge del MCP (`json` limit + rate-limit pre-auth + `trust proxy`) · **(7)** fix del IDOR delete. *(D5 "gestionado" cubre 1 y 2 en gran parte.)*

---

## Cómo se ejecuta

- Cada **FASE** es un set de **tickets** con su **Definition of Done** (tests + aceptación). No se pasa a la siguiente sin los criterios verdes.
- Los **principios transversales** (SOLID, ports&adapters, write-kernel como reference monitor, pirámide de tests, default-deny, observabilidad) aplican a **todas** las fases — están en cada FASE y fundamentados en [`0A`](0A-analisis-correctitud.md).
- **Frontend en paralelo:** cuando `FASE-6` publique el contrato en `@savia-os/contracts`, el front se conecta sin esperar el resto; el front ya falla con gracia si un endpoint aún no existe.

---

## Reemplazo limpio (sin código obsoleto ni deprecado)

> **Principio transversal (aplica a TODAS las fases):** como **no hay usuarios ni data en prod** (D7), esto es un **reemplazo limpio, no un refactor con back-compat**. El código/campos/rutas/payload viejos **se BORRAN cuando entra el nuevo** — **sin shims, sin dual-filter/cutover, sin `@deprecated`, sin flags de compat**. Se **conserva** solo lo que la auditoría rató sano (`auth`/`connections`/`grants`/`files`/`growth`); el resto se reemplaza y elimina.

Inventario de lo que se elimina, mapeado a la fase que lo borra:

| Obsoleto | Reemplazado por | Se borra en |
|---|---|---|
| `MemoryIndex.spaceIds[]` · `spaceVersions` · `manualOverride` · `Space.version` | `savia_area_ids` (multi-membership) | F0.6 |
| `homeSpaceId` (single-home) | `primarySpaceId` + membership | F0.6 |
| payload `submemories` · `space_id` · `user_id`-como-frontera | `savia_*` | F2.3 |
| `memory.service.add` dual-write sin tx + `.catch(()=>null)` | write-kernel (`$transaction`+outbox) | F2.1 |
| 4× `new OpenAI()` dispersos | `EmbeddingsPort`/adapter | F0.1 |
| `classifier.service` · `cluster.service` (k-means √n) · `reclassify.processor` | `RoutingService` + `OrganizationEngine` + workers `@Processor` | F3/F4 |
| authZ dispersa (`requireMembership` por servicio · clamp manual) | `AccessService` + guard global | F1 |
| `queryHash` base64 reversible | `queryDigest` SHA-256 | F1.7 |
| `Space(kind=collective)` + rutas contenedor (`make-collective` · `from-personal{mode}`) | `CollectiveGroup`/`FragmentShare` + rutas de federación | F0.6/F5 |
| handlers `void` + `SpaceDto` drift + `text:''` | DTOs reconciliados en `@savia-os/contracts` | F6 |
| stubs front `saved-searches.ts` · `use-subscription.ts` (localStorage) | `Lens` / `Subscription` reales | F6/F7 |

> **Gate de "no dead code"** (verificado en `FASE-8`): cero `@deprecated`/TODO-legacy/ramas de compat; sin servicios/endpoints/campos/payload-keys sin uso; `submemories` y el dense-only legacy fuera; `knip`/`ts-prune` (dead exports) verde.

---

## Referencia (se cita, no se ejecuta)

| Doc | Qué |
|---|---|
| [`0A-analisis-correctitud.md`](0A-analisis-correctitud.md) | Las 3 revisiones adversariales (SOLID F1–F24, prod-readiness, alineación con specs). El "¿es correcto?". |
| [`08-plan-end-to-end.md`](08-plan-end-to-end.md) | **Diseño base**: organización dinámica de memoria (multi-membership, mem0-sidecar, motor, write-kernel, outbox). |
| [`05-rediseno-estructural.md`](05-rediseno-estructural.md) | **Diseño de producto**: modelos faltantes, ciclo de cuenta, mapa de rutas, cobertura. |
| [`09-modulo-pagos.md`](09-modulo-pagos.md) | **Diseño de pagos**: Mercado Pago (modelo, contrato, webhook, enforcement, implementación). |
| [`01-gap-frontend.md`](01-gap-frontend.md) · [`02-rigor-implementacion.md`](02-rigor-implementacion.md) · [`03-modelo-de-datos.md`](03-modelo-de-datos.md) | **Hallazgos** sobre el código actual = criterios de aceptación. |

> **Verificación ejecutada en la auditoría:** `typecheck` del API → EXIT 0 · lectura del 100% de controllers/services/guards/processors/clients/schema · contraste `api.ts` ↔ contracts. No se levantó el stack en vivo (los hallazgos de comportamiento se derivan de lectura verificada).
