# 0A — Análisis de correctitud del diseño (¿lo definido es lo correcto?)

> **Método:** tres revisiones adversariales **independientes** (para no sesgarse con el diseño propio) sobre `08`/`05`/`09`, contrastadas con el código actual y las specs Savia:
> 1. **Arquitectura / SOLID / testabilidad** (24 hallazgos F1–F24).
> 2. **Production-readiness / ops** (gate de los 7 imprescindibles).
> 3. **Alineación con las specs** (14/15/16/17 + memory-map 04).
>
> **Veredicto global:** los **invariantes** del diseño son sólidos y una mejora clara sobre el código actual (acceso multi-membership preservando default-deny, mem0-sidecar, outbox, paywall server-side). Lo que falta no es la *idea* sino la **descomposición** (servicios monolíticos, ports sin contrato, lógica crítica entrelazada con I/O) y la **operación** (backups, migrate, observabilidad — ni mencionados). Todo es **más barato de arreglar en papel que después de codear**.

---

## A. Alineación con specs — 3 *departures deliberados* que necesitan decisión

| Spec | Estado | Departure | Decisión |
|---|---|---|---|
| **14 — Unificación** | ⚠️ contradice | single-home (`homeSpaceId`) → **multi-membership** (`savia_area_ids[]`) | **Mejora** (solape real + el mapa refleja el acceso). → **actualizar spec 14**. |
| **15 — Frontera** | ✅ **preservado** | ninguno — `area_ids ANY` mantiene default-deny + clamp + frontera determinista (con ancestros computados al write-time) | ninguna · **testear** `closure_with_ancestors` + el filtro (que un grant a "Trabajo" exponga descendientes, no hermanos). |
| **16 — Colectivos** | ❌ reemplaza | contenedor `Space(kind=collective)` → **federación** (grupo + fragmentos) | **Decisión de producto.** Federación = más privado/limpio, pero la semántica de "drive compartido" cambia: los **archivos** quedan en el área personal y se comparten como fragmento (no se "mueven" a un contenedor). Las contribuciones **persisten** vía autoría (no vía contenedor). → **aprobar federación o volver a contenedor.** |
| **17 — Índice jerárquico** | ⚠️ contradice | capa 1 partición (un hogar) → **capa 1 con solape** (multi-membership) | **Mejora**, pero cambia el modelo mental del mapa (solape = highlight). → **actualizar spec 17**. |
| **04 — Memory Map** | ✅ cubierto | conteos pasan a Venn (no suman); layout por `primarySpaceId` | ninguna. |

**Acción:** estos 3 (14/17 multi-membership · 16 federación) son **elecciones**, no bugs. Antes de codear S4/S6 hay que **confirmarlos con producto** y **actualizar las specs** para que el código no quede "en contra" de la documentación oficial. La frontera de seguridad (15) **no** se regresiona — pero su test es obligatorio.

---

## B. Arquitectura / SOLID — correcciones (F1–F24)

> Severidad: **P0** calcifica feo / bloquea testing o correctitud · **P1** arreglar antes de construir · **P2** nice-to-have. Las P0 se foldearon en el plan (`00`).

### B.1 — Descomposición (SRP)
- **F1 (P0) — El write-kernel es un God-object** (5 razones de cambio: authZ, no-borrado/reversibilidad, math CF, la transacción, rate-limit/guardrails). → **partir** en: `WriteKernelPolicy` (decide Allow/Deny, **puro**), `MemoryMutationService` (lo único que toca Prisma, corre la `$transaction`+outbox), `CfAccumulator` (math puro), `GuardrailMonitor` (worker async — el auto-rollback es un control-loop, **no** parte de la escritura síncrona). El kernel **orquesta**, no **es** las 5 cosas.
- **F2 (P1) — El motor mezcla** routing + split + merge + decay + naming + bootstrap (distintos triggers, latencias, deps de LLM). → servicios separados; **ninguno escribe directo** — emiten *proposals* al mutation service (así "el motor no cruza scope" es **por construcción**, no por disciplina).
- **F3 (P1) — `AccessService` mezcla** compilación del filtro con resolución de grupo + lecturas DB. → `AccessFilterCompiler.compile(grants, fragments, requested)` **puro** + `GroupScopeResolver` (hace la membership/fetch **antes**).
- **F4 (P1) — `BillingService` es un transaction-script.** → `MercadoPagoPort` + `SubscriptionService` + `WebhookProcessor` (reducer **puro**).
- **F5 (P0) — El reconciliador "borra vectores huérfanos" → contradice el invariante "no-borra".** Es destructivo dentro de un loop de reintento; un bug en detección de huérfanos (fila aún no committeada por lag del relay) **borra memoria real**. → separar un `VectorGarbageCollector` (el **único** con capacidad de borrar, con grace period + dry-run + audit por borrado), y **documentar que "no-borra" es engine-scoped, no system-scoped** (ver F24).
- **F6 (P2)** — la lógica de lectura de federación está duplicada en 3 lugares → centralizar en `FederationService`.

### B.2 — Inversión de dependencias / ports (DIP)
- **F7 (P0) — Los ports están NOMBRADOS pero sin contrato** (y hoy hay **0** abstracciones; 7 `new` de vendors, 2 con `new OpenAI()` desde `process.env` dentro de un método). → **definir las interfaces YA**, angostas y vendor-neutrales. Clave: `VectorStorePort.knn(vector, **predicate**, k)` — un **predicado de acceso**, NO el filtro crudo de Qdrant (hoy `QdrantService` pasa `filter as any` → la DSL de Qdrant *es* la abstracción = leak).
- **F8 (P1)** — sin `MercadoPagoPort`; `09` hardcodea URLs de MP en el servicio.
- **F9 (P1) — La frontera mem0-sidecar es más ancha de lo que parece:** depende de **números de línea de la fuente de mem0** (L264/L1057) y del **nombre interno** `{collection}_entities` (que se puebla en un `try/catch` que solo `console.warn`). Eso es un fork implícito. → `EntityGraphPort` (único que conoce el naming interno) + **contract test pineado a la versión de mem0** que rompe CI si cambia el shape.
- **F10 (P2)** — la dimensión 256/1536 (Matryoshka) se filtra por todo el motor → `Vector` como value type con `truncate(dims)` en el adapter.

### B.3 — Open/Closed
- **F11 (P0) — `Grant.scope ∈ {space|lens|group}` se compila con `if/if/if`** = switch-smell sobre el eje de **mayor churn** del producto (los "entity grants" ya están implícitos por `savia_entities`). Cada scope nuevo edita el compiler + resolver + preview + DTO. → `ScopePredicateProvider` polimórfico por scope; el compiler solo hace `OR`. Agregar "entity grant" = un provider nuevo, **cero** ediciones al core.
- **F12 (P1)** — split/merge hardcodeados (dip/two-means/silhouette; Jaccard/cos) pero el eval los va a swapear → `SplitStrategy`/`MergeStrategy` que devuelven *proposals*; el eval es un **selector de estrategia**, no un parche a `recluster_node`.
- **F13 (P1) — "entidades = señal secundaria" se viola:** `anchorEntities` es load-bearing en naming, estabilidad y merge (`entity_jaccard`). Si el entity store falla (best-effort), se pierden las 3 a la vez. → un `SimilaritySignal` (el término `β`) + `NamingSignal` inyectables, con **null-object fallback** (geometría pura).

### B.4 — Módulos / acoplamiento (NestJS)
- **F14 (P0) — El write-kernel no tiene módulo → imán de dependencias circulares** (lo invocan Routing, Recluster, Consolidation y el webhook de billing; hoy `SpacesModule` ya re-provee Prisma/Qdrant local y `mcp.tools` importa 5 módulos juntos). → `KernelModule` dedicado + un **`@Global() InfraModule`** (Prisma/Qdrant/Embeddings como ports) → mata el re-provisioning.
- **F15 (P1) — Los workers BullMQ están fuera del DI** (free functions) → no se les inyectan ports y el shutdown queda manual (= el INT-1 actual). → `@nestjs/bullmq` `@Processor()` providers con `OnModuleDestroy → worker.close()` gratis + testeables.
- **F16 (P2)** — `Lens` doble (smart-folder + topic) y `Grant` polimórfico acoplan MemoryModule↔FederationModule → aislar `lens_pred` tras el mismo `ScopePredicateProvider` (F11).

### B.5 — Testabilidad
- **F17 (P0) — El state-machine del webhook es untesteable** como está (HMAC + `mpFetch` + idempotencia + branching en un handler). El branch que más importa ("recycling ⇒ no degradar; 3 fallos ⇒ free") **necesita secuencia/estado**. → **reducer puro** `applyMpEvent(state, event): {nextState, planChange, payment}`; test table-driven `authorized→approved→recycling→recycling→failed` **sin infra**.
- **F18 (P0) — El filtro de acceso debe ser PURO para testear** default-deny / clamp / sensibilidad / subárbol-por-ancestros — los paths de seguridad. → `compile(...)` puro + un evaluador `Predicate.matches(payload)` para aseverar **en memoria** que un payload dado es/no es visible para un set de grants. **Ese** es el test que cierra IDOR/over-share.
- **F19 (P1)** — el math de split/merge debe ser puro e inyectado (`CfStats` value object + `dip/twoMeans/silhouette` como free functions sobre arrays). La claim de F4.5 ("histéresis ⇒ no oscila") se vuelve **una aserción**, no una esperanza.
- **F20 (P1)** — la **clave de idempotencia** del webhook está sub-especificada (`data.id` vs `data.id:rid`); MP manda varios *tipos* para el mismo `data.id` → un evento legítimo podría deduplicarse mal. → `idemKey(event)` puro y documentado (`type:dataId:rid`), unit-testeado.

### B.6 — Anti-patrones
- **F21 (P1)** — transaction-script en kernel/webhook/account_delete → empujar invariantes a **tipos ricos** (una `MemoryMutation` que conoce su inverso; un agregado `Subscription` con `applyEvent()` que enforce transiciones legales; una `Membership` que computa su closure-con-ancestros).
- **F22 (P1) — Primitive obsession:** `Grant{spaceId?, lensId?, groupId?}` y `FragmentShare{spaceId?, lensId?}` modelan un sum-type como 3 columnas nullable + tag (la DB puede representar **estados ilegales**); `09` tiene `planType/status` como string libre. → **CHECK constraint** (exactly-one-non-null) o `(scopeType, scopeId)`; promover `planType/status` a los enums que `09` ya define.
- **F23 (P2)** — las claves `savia_*` son un contrato público desparramado como string-literals → un módulo `PayloadSchema` (typed keys + encode/decode) dueño del `QdrantAdapter` + contract test (las claves que el filtro **lee** = las que el kernel **escribe**).
- **F24 (P2) — "Cero autorización" es un over-claim** que esconde una superficie de authZ real (cada read default-deny, write a fragmento colectivo con `canWrite`+rol, transfer de admin en delete, `RequirePlan` de billing). El slogan aplica **solo al reorg interno del motor**. → renombrar: *"el motor de reorg no necesita autorización (scope-confined + reversible); todos los reads/writes de cara al humano siguen siendo default-deny autorizados."*

---

## C. Production-readiness — el gate (lo que el diseño NO menciona)

> El diseño es un *target*; casi nada de su maquinaria de ops existe aún. Estos son los **imprescindibles para servir usuarios reales** — el diseño los nombra como one-liners o los omite.

**P0 — bloquean el launch:**
1. **Backups + restore probado** (Postgres y Qdrant). Hoy = named volume en un host → perder el volumen = pérdida total. **El diseño nunca lo menciona.**
2. **Migrate-on-deploy** (`prisma migrate deploy` en un step one-shot antes de la API; expand-contract). Hoy no corre en ningún lado.
3. **Env validado al boot** (Joi). Con `OPENAI_API_KEY=''` el API bootea verde y todo falla en runtime; `MP_*`/`JWT_*`/`AWS_*` degradan en silencio. (era P2 en el audit → es **P0 para este deploy**.)
4. **Outbox** (o al menos `$transaction` + Qdrant `wait:true` + reconciliador). **No existe** — el diseño lo hace su respuesta a la atomicidad pero es un build real, no un one-liner.
5. **Graceful shutdown de workers + `jobId` determinista** (INT-1/2) — cada deploy hoy deja jobs stalled → ingest duplicado.
6. **Edge del MCP**: `json({limit})` + rate-limit por IP **antes** del lookup de token (hoy tokens basura = DoS gratis a Postgres) + `trust proxy` (anti XFF-spoof). Caddy sin rate-limit.
7. **Fix del IDOR delete** (audit P0-1).

**P1 — pronto:** logging JSON con `requestId` propagado al job (sin PII) · métricas + monitoreo de colas (depth/failed/stalled/DLQ/lag de outbox/$ por usuario) · DLQ + comportamiento ante reinicio de Redis · resiliencia (timeouts/retry/circuit-breaker/**degradación** — search **no** degrada hoy: el embedder está en el hot path sin fallback) · seguridad del webhook de billing (con el módulo) · rotación de refresh · health real (worker/MCP).

**P2 — hardening:** ceilings de costo/latencia (**batch de embeddings**, cache de query, `scroll` acotado, cap por tenant) · cutover de `submemories` · export/delete GDPR que purgue **Qdrant + S3 + entity store de mem0** (las cascadas solo cubren Postgres) · helmet/cookie · CI con gates · cron de `OtpCode` · errores de dominio → HTTP.

---

## D. Veredicto y qué se incorpora al plan

**¿Lo definido es lo correcto?** Los **invariantes** sí (acceso, integridad, sidecar, paywall). Pero hay que **corregir**:

1. **Decisiones de producto/spec (A):** confirmar multi-membership (14/17) y **federación vs contenedor (16)**; actualizar specs. *(Bloquea S4/S6.)*
2. **Descomposición (B, las P0):** definir **contratos de ports** (F7), partir el **write-kernel** en policy-puro + mutation-I/O (F1), **sacar el borrado de vectores del reconciliador** (F5), `AccessFilterCompiler` **puro** (F3/F18), **`ScopePredicateProvider`** por scope (F11), `KernelModule` + `@Global InfraModule` (F14), reducer de webhook **puro** (F17). → **foldeadas en `00`** (transversal + S0/S1/S2/S5/S8).
3. **Operación (C):** los **7 imprescindibles** → el "Gate de producción" de `00` + S9.

> **Lo que NO cambia:** la dirección (organización dinámica, multi-membership, federación, mem0-sidecar, write-kernel, outbox, paywall server-side). El rebuild es correcto; este análisis lo hace **testeable, extensible y operable**.
