# Reglas de acceso y privacidad — savia-os `apps/api`

> Estado: ratificado 2026-07-07. Estandarización cross-boundary + R4 opt-in del dueño.
> Estas son LAS reglas de la frontera de acceso: qué puede leer quién, dónde se
> deciden y dónde se aplican. Reemplazan la prosa dispersa en `08-plan-end-to-end.md`,
> `15-frontier-hardening.md` y `17-hierarchical-spaces.md` como fuente única.

## El modelo en una frase

El acceso es **un predicado puro** (`AccessPredicate`, un AST) que se **aplica en un
único chokepoint** (`VectorStorePort` → adapter de Qdrant). Nadie escribe filtros de
Qdrant a mano y nadie lee memorias sin un predicado. Las reglas se **compilan** desde
el estado (grants, membresías, fragmentos) en **un solo lugar por frontera**, nunca se
chequean con `if (canRead)` sueltos.

## Las 7 reglas (R1–R7)

- **R1 — Default-deny.** Sin grants / no-miembro / fragmentos vacíos → no se lee nada.
  `P.areaIdsAny([])`, `P.or()` vacío y `compileReadPlan([], …)` colapsan a "nada".
- **R2 — Mutación author-only (IDOR).** Solo el autor muta su memoria/área.
  `AccessService.assertCanMutateMemory` / `assertCanManageSpace` / `assertOwnsConnection`.
- **R3 — Clamp solo angosta.** `requested` (áreas pedidas por el lector) intersecta,
  nunca ensancha: `predicate ∧ areaIdsAny(requested)`. Pedir un área no concedida no
  la expone.
- **R4 — Sensibilidad = opt-in del DUEÑO.** `sensitive` es una marca privada global.
  - Áreas **propias** (grant `space`, dato del propio lector): lo decide el grant del
    lector (`Grant.includeSensitive`).
  - Fragmentos de **grupo** (dato de otra persona): lo decide **el dueño del
    fragmento** (`FragmentShare.includeSensitive`), horneado por fragmento en
    `fragmentScope`. **El lector NUNCA levanta la sensibilidad de otra persona** — el
    `Grant.includeSensitive` de una conexión es **inerte** para grants a grupo.
- **R5 — Subárbol por ancestros, no hermanos.** La membresía carga sus ancestros al
  escribir (`savia_area_ids`), así un grant a un área ve sus descendientes (vía
  `areaIdsAny`) pero no sus hermanos.
- **R6 — Grupo = unión viva de fragmentos de miembros ACTUALES.** La membresía se
  re-chequea al leer (`resolveFragments` filtra por `GroupMember`): un `FragmentShare`
  huérfano (carrera con una expulsión, sin FK a `GroupMember`) nunca alimenta la vista.
- **R7 — Un chokepoint + una autoridad.** Toda lectura pasa por `VectorStorePort`
  (traducción única en `qdrant-filter.ts`, o `evaluate()` in-memory) con un
  `AccessPredicate`. Toda lectura **cross-boundary** compila su predicado en
  `compileReadPlan` (la única casa de R1–R5) y se ejecuta en
  `CrossBoundaryReadService.searchPartitions` (fan-out + dedup). Cero predicados a mano.

## Matriz (lector × dato → regla)

| Lector | Dato | ¿Ve? | Regla |
|---|---|---|---|
| Dueño (búsqueda propia) | Sus memorias | Sí, incl. `sensitive` | Owner-scoped (`P.author(self)`) |
| Conexión IA (grant `space`) | Áreas propias del dueño | Sí; `sensitive` según `Grant.includeSensitive` | R3, R4 (grant), R5 |
| Conexión IA (grant `group`) | Fragmentos de TODOS los miembros | Sí (unión viva); `sensitive` solo si el dueño del fragmento opt-in | R4 (dueño), R6, fan-out |
| Miembro (vista de grupo) | Fragmentos de otros miembros | Sí; `sensitive` solo con opt-in del dueño | R4 (dueño), R6, fan-out |
| Cualquiera | Memoria de otra persona no compartida | **No** | R1 + `fragmentScope` pin `author` |
| Cualquiera | Memoria `superseded` | **No** | `notSuperseded` en toda lectura |
| No-miembro | Vista/fragmentos del grupo | **No** | R1 (default-deny en `buildGroupReadPlan`) |

## Dónde viven las reglas (código)

**Vocabulario puro:** `common/ports/predicate.ts` (`AccessPredicate`, `P`, `evaluate`,
`isDenyAll`).

**Compilación (las reglas):**
- `access/scope-predicate.provider.ts` — `fragmentScope` (R4 por fragmento + pin
  `author`), `fragmentsPredicate`, `grantScope` (R4 por scope), `SCOPE_PROVIDERS`.
- `access/read-plan.ts` — **`compileReadPlan`**: la única casa de la frontera de
  lectura cross-boundary. Grants → `ReadPartition[]` (una partición `{ownerUserId,
  predicate}` por dueño), R1–R5 aplicadas una sola vez.
- `access/access-filter.compiler.ts` — `compileAccessFilter`: la forma PLANA (single
  partition) de los mismos invariantes; es la declaración pura que prueba la suite de
  spec-15. Comparte `grantScope`/`fragmentScope` con el plan.

**Autoridad (orquesta DB → reglas):** `access/access.service.ts`
- `buildConnectionReadPlan(connectionId, requested?)` — plan de lectura de una conexión.
- `buildGroupReadPlan(groupId, viewerUserId, requested?)` — plan de la vista de grupo
  (asserta membresía = default-deny para no-miembros).
- `assertCanMutateMemory` / `assertCanManageSpace` / `assertOwnsConnection` (R2).

**Ejecución (fan-out único):** `memory/cross-boundary-read.service.ts`
- `searchPartitions(plan, query, limit, viewer)` — busca cada partición en la partición
  de SU dueño (`memory.search(ownerUserId, …)`), mergea y `dedupeCrossPerson` (el viewer
  nunca en `alsoFrom`).

**Chokepoint (aplicación):** `common/adapters/vector-store.qdrant.adapter.ts` — único
importador de `compilePredicate` (`common/adapters/qdrant-filter.ts`); `knn`/`scroll`
cortocircuitan `denyAll` sin red; `retrieve`/`setPayload`/`deletePoints` re-chequean cada
punto by-id con `evaluate`.

## Entrada por frontera

| Frontera | Entrada | Camino |
|---|---|---|
| Conexión / MCP | `mcp.tools.ts savia_search` | `buildConnectionReadPlan` → `searchPartitions` |
| Vista de grupo | `collective.controller GET /groups/:id/memories` | `federation.service.search` → `buildGroupReadPlan` → `searchPartitions` |

## Inventario de construcción de predicados

- **Cross-boundary (2):** conexión (`buildConnectionReadPlan`) y grupo
  (`buildGroupReadPlan`) — AMBOS por `compileReadPlan` + `searchPartitions`. Ningún
  predicado a mano.
- **Owner-scoped:** fijan la partición del propio usuario → no pueden filtrar
  cross-persona. Dos formas canónicas:
  - **`P.own(userId, { areaIds?, includeSuperseded? })`** — el scan/búsqueda de "mis
    memorias" (búsqueda propia, áreas, lentes, naming, motor v2, previewMatch, export,
    purge). `areaIds` vacío = todas mis áreas (NO default-deny — eso es concepto de
    grant). Migrados en Fase 2.
  - **`P.author(userId)`** — 5 ops **by-id** sobre una memoria específica ya conocida
    como mía (`memory.service` retrieve/delete del punto recién creado o en edición,
    `kernel.currentAreasFor`, `engine.worker` retrieve). Es la primitiva atómica, no
    "hand-rolling" — se deja tal cual.
- **Writes match-all (2):** `outbox/vector-gc.ts:62`, `outbox/outbox-relay.ts:58` usan
  `P.and()` (match-all) sobre `[memoryId]`. **Auditados (Fase 2): seguros** — son
  eventos internos (system-produced) por-id, y el write-kernel ya validó la propiedad
  del `memoryId` al encolar el evento. Endurecer a `P.author` requeriría una columna
  `OutboxEvent.userId` (no existe hoy) + poblarla en el kernel → hardening diferido,
  no bloqueante. Los comentarios en ambos sitios documentan el razonamiento.

## Qué cambió en esta estandarización (2026-07-07)

1. **R4 pasó de per-grant a opt-in del dueño.** Antes el compilador gateaba
   sensibilidad por grant (`access-filter.compiler.ts:24` viejo), y un grant a grupo
   con `includeSensitive=true` habría expuesto lo `sensitive` de OTRO dueño. Ahora la
   sensibilidad de grupo la decide `FragmentShare.includeSensitive` (nueva columna),
   horneada en `fragmentScope`. El lector nunca la levanta.
2. **Se arregló el under-read de conexiones.** Antes una conexión con grant a grupo leía
   una sola partición (`memory.search(conn.userId)`) → solo veía lo que aportó su propio
   dueño. Ahora hace fan-out por dueño y lee la unión real del grupo.
3. **Un solo núcleo cross-boundary.** Federación dejó de armar su predicado a mano; usa
   la misma `compileReadPlan` + `searchPartitions` que MCP. R4 vive en un solo lugar.
