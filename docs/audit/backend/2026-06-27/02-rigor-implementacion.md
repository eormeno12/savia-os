# 02 — Rigor de implementación (seguridad / authz / integridad / colas / errores)

> **Estado:** describe el **código actual** (sin cambios desde la auditoría). Estos hallazgos son los **criterios de aceptación** del rebuild en [`08`](08-plan-end-to-end.md) (su fase *transversal* los lista). El plan de parches `04` fue **retirado** — con el rebuild, construir bien desde el diseño vuelve moot el parche; lo que el diseño no cubre (helmet, throttler, env-validation, etc.) queda acá como acceptance criteria.

Severidades: **P0** vuln / pérdida o fuga de datos / contrato roto en prod · **P1** gap o riesgo real · **P2** mejora.
Cada hallazgo: descripción · evidencia (`archivo:línea`) · por qué importa · fix concreto · práctica oficial.

Resumen de conteo: **3× P0**, **9× P1**, **8× P2**.

---

## P0

### P0-1 — IDOR: `DELETE /memory/:id` borra memorias de cualquier usuario
- **Evidencia:** [memory.controller.ts:46-49](../../../../apps/api/src/modules/memory/memory.controller.ts#L46-L49) →
  ```ts
  @Delete(':id')
  deleteOne(@Param('id') id: string) { return this.memory.deleteByMemoryId(id); }
  ```
  y [memory.service.ts:173-176](../../../../apps/api/src/modules/memory/memory.service.ts#L173-L176): `deleteByMemoryId` hace `qdrant.deletePoint(memoryId)` + `memoryIndex.deleteMany({where:{memoryId}})` **sin filtrar por `userId` ni por space**. Nótese que el handler ni siquiera inyecta `@CurrentUser()`.
- **Por qué importa:** los `memoryId` se exponen en `/memory/search` (`MemoryResult.id`), en `savia_search` (MCP) y en `/spaces/:id/memories` (`memoryId`). Un miembro de un colectivo —o cualquiera que obtenga un id (logs, otra cuenta, fuerza bruta de UUID es inviable pero la fuga del id no lo es)— puede **borrar memoria ajena en Qdrant y Postgres**. Es destrucción de datos cross-tenant (integridad + disponibilidad).
- **Fix:** scoping de propiedad antes de borrar. Resolver la fila y verificar que el usuario es **autor** *o* **admin del home space**:
  ```ts
  @Delete(':id')
  async deleteOne(@Param('id') id, @CurrentUser() u: JwtPayload) {
    const row = await this.prisma.memoryIndex.findUnique({ where: { memoryId: id } });
    if (!row) throw new NotFoundException();
    const owns = row.userId === u.sub;
    const isAdmin = row.homeSpaceId && await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: row.homeSpaceId, userId: u.sub } } }).then(m => m?.role === 'admin');
    if (!owns && !isAdmin) throw new ForbiddenException();
    return this.memory.deleteByMemoryId(id);
  }
  ```
- **Práctica oficial:** NestJS — la authorization a nivel de objeto **la implementa el desarrollador**, no el framework: *"Authorization refers to the process that determines what a user is able to do… is orthogonal and independent from authentication"* (https://docs.nestjs.com/security/authorization). El patrón recomendado es verificar ownership/rol en un guard o en el service.

### P0-2 — Sin atomicidad cross-store: vectores y filas huérfanas
- **Evidencia:** `grep -r '\$transaction' apps/api/src` sólo aparece en `auth.service` (provisión del General) y `collective.service` (acceptInvite). **Ninguna** escritura de memoria es transaccional:
  - `add`: `mem0.add` (Qdrant) → `memoryIndex.createMany` → `growthEvent.createMany`, sin envolver ([memory.service.ts:65-95](../../../../apps/api/src/modules/memory/memory.service.ts#L65-L95)).
  - `rehome` / `applyToMemory` / `removeMemoryFromSpace`: `qdrant.setPayload` → `memoryIndex.update` → `growthEvent.updateMany().catch(()=>null)` ([memory.service.ts:179-191](../../../../apps/api/src/modules/memory/memory.service.ts#L179-L191), [classifier.service.ts:207-227](../../../../apps/api/src/modules/spaces/classifier.service.ts#L207-L227), [spaces.service.ts:217-235](../../../../apps/api/src/modules/spaces/spaces.service.ts#L217-L235)).
- **Por qué importa:** si Postgres falla tras escribir Qdrant, queda un **vector visible sin fila de índice** (fantasma, no rastreable, no borrable por `deleteByFile`); si Qdrant falla tras Postgres, queda **fila sin vector**. En `rehome`, si la 2ª escritura falla, **la frontera de seguridad (space_id en Qdrant) y el `homeSpaceId` en Postgres divergen** → un recuerdo aparece bajo un space pero el índice cree otro. No hay reconciliación ni outbox.
- **Fix:** (1) envolver las escrituras *Postgres↔Postgres* en `prisma.$transaction([...])` (createMany memoryIndex + createMany growthEvent; update memoryIndex + update growthEvent). (2) Para Qdrant↔Postgres, adoptar patrón **outbox / compensación**: escribir Postgres primero como "pending", luego Qdrant, luego marcar "committed"; un reconciliador periódico borra vectores sin fila committed y reintenta filas sin vector. (3) Usar `wait:true` en las escrituras de Qdrant cuando se requiere read-after-write.
- **Práctica oficial:** Prisma — *"All operations should succeed or fail together without making unwanted changes to the database"* (https://www.prisma.io/docs/orm/prisma-client/queries/transactions). Qdrant — las escrituras son asíncronas vía WAL; pasar `wait=true` para *"wait for changes to actually happen"* (https://qdrant.tech/documentation/concepts/points/).

### P0-3 — `queryHash` es base64 reversible del query del usuario
- **Evidencia:** [mcp.tools.ts:88](../../../../apps/api/src/modules/mcp/mcp.tools.ts#L88): `queryHash: Buffer.from(query).toString('base64').slice(0, 64)` persistido en `AccessLog.queryHash` ([schema.prisma:187](../../../../apps/api/prisma/schema.prisma#L187)).
- **Por qué importa:** no es un hash; es el **texto de la consulta del usuario codificado y recuperable**, guardado en claro en la DB y etiquetado como "hash" (induce a tratarlo como anonimizado). El query de búsqueda puede contener información sensible (nombres, proyectos, datos). Es una fuga de PII en reposo + violación del principio de minimización.
- **Fix:** o bien hashear de verdad (`createHash('sha256').update(query).digest('hex')`) si sólo se necesita para dedupe/correlación, o bien **no almacenar** el contenido del query (guardar sólo `resultCount` + longitud). Renombrar el campo acorde.
- **Práctica oficial:** OWASP — minimización y protección de datos sensibles en logs; los registros de auditoría no deben almacenar contenido sensible recuperable (Logging Cheat Sheet / Privacy by design).

---

## SEC — Autenticación / cookies / CORS

### SEC-1 (P1) — Refresh JWT sin rotación ni revocación; logout no invalida
- **Evidencia:** `refresh` reemite sólo el access y **reutiliza el mismo refresh** ([auth.service.ts:84-96](../../../../apps/api/src/modules/auth/auth.service.ts#L84-L96)); `logout` sólo borra cookies del cliente ([auth.service.ts:98-102](../../../../apps/api/src/modules/auth/auth.service.ts#L98-L102)). El refresh vive 30 días ([jwt.service.ts:41](../../../../apps/api/src/modules/auth/jwt.service.ts#L41)) y no hay denylist/`jti`/versión de token.
- **Por qué importa:** un refresh token robado (XSS aparte: es `HttpOnly`, pero phishing, malware, backup) es válido 30 días y **no se puede revocar**; logout no lo mata. No hay detección de replay.
- **Fix:** rotación de refresh (emitir uno nuevo e invalidar el anterior en cada `refresh`), persistir un `tokenVersion`/`jti` por usuario o sesión y validarlo; en logout incrementar la versión / añadir `jti` a denylist en Redis con TTL = vida del refresh.
- **Práctica oficial:** OWASP — *"refresh token rotation (issuing new refresh tokens and invalidating old ones immediately to detect replay attempts)"* (OAuth2 Cheat Sheet); access tokens cortos + denylist de `jti` en logout (JWT Cheat Sheet); regenerar credencial tras cambio de privilegio (Session Management Cheat Sheet).

### SEC-2 (P1) — Sin guard global: seguridad *opt-in* por controller
- **Evidencia:** no hay `APP_GUARD` en `app.module.ts` ([app.module.ts:14-28](../../../../apps/api/src/app.module.ts#L14-L28)); cada controller repite `@UseGuards(JwtAuthGuard)`. Hoy todos lo aplican, pero un controller nuevo que lo olvide queda **público por defecto**.
- **Por qué importa:** el modelo correcto es *default-deny*. Con seguridad opt-in, un descuido = endpoint abierto. Ya hay 1 caso latente: `MemoryController.deleteOne` está protegido a nivel clase pero no chequea ownership (P0-1) — síntoma de que la authZ no está centralizada.
- **Fix:** registrar `JwtAuthGuard` como `APP_GUARD` global y un decorador `@Public()` (vía `Reflector` + metadata) para `request-otp/verify-otp/refresh/health`.
- **Práctica oficial:** NestJS — *"we can set up a guard globally for our entire application"* via `APP_GUARD` y exceptuar rutas con metadata `@Public()` + `Reflector` (https://docs.nestjs.com/guards, https://docs.nestjs.com/security/authorization).

### SEC-3 (P2) — Rate-limit de OTP por IP es spoofeable
- **Evidencia:** [auth.controller.ts:19](../../../../apps/api/src/modules/auth/auth.controller.ts#L19) toma `req.headers['x-forwarded-for'].split(',')[0]` como IP. Sin `trust proxy` confiable, el cliente controla ese header.
- **Por qué importa:** el cap por IP (5/h) se evade enviando `X-Forwarded-For` arbitrario. El cap por email (5/h) sigue vigente, así que el impacto está acotado, pero la métrica por IP es ilusoria.
- **Fix:** configurar `app.set('trust proxy', 1)` y usar `req.ip`, o tomar la IP del header **sólo** detrás del gateway (Caddy ya añade `X-Via-Gateway`). Mejor: migrar a `@nestjs/throttler`.
- **Práctica oficial:** NestJS — *"A common technique to protect applications from brute-force attacks is rate-limiting"* con `@nestjs/throttler` y `@Throttle()` por ruta (https://docs.nestjs.com/security/rate-limiting). OWASP Authentication Cheat Sheet: throttling de intentos por **cuenta**, no sólo IP.

### SEC-4 (P2) — Sin helmet ni CSRF token; SameSite=Lax
- **Evidencia:** `main.ts` no usa helmet; cookies `httpOnly + sameSite:'lax' + secure` por entorno ([auth.service.ts:9-13,72-79](../../../../apps/api/src/modules/auth/auth.service.ts#L9-L13)). No hay token CSRF.
- **Por qué importa:** `SameSite=Lax` ya bloquea el envío de cookies en POST cross-site (mitiga CSRF para las mutaciones, que son POST/PATCH/DELETE), así que el riesgo CSRF es bajo. Faltan, sin embargo, headers de seguridad (helmet) y `SameSite=Strict` para cookies de auth.
- **Fix:** `app.use(helmet())`; considerar `SameSite=Strict` para las cookies de sesión; si se agregan mutaciones por GET, añadir CSRF token.
- **Práctica oficial:** NestJS Helmet (https://docs.nestjs.com/security/helmet); MDN `Set-Cookie` (`SameSite` mitiga CSRF; `Strict` es el más estricto).

### SEC-5 (P2) — `clearCookies` usa default de dominio distinto que `set`
- **Evidencia:** `verifyOtp` setea con `COOKIE_DOMAIN` default `''` ([auth.service.ts:69](../../../../apps/api/src/modules/auth/auth.service.ts#L69)) pero `clearCookies` usa default `'localhost'` ([auth.service.ts:99](../../../../apps/api/src/modules/auth/auth.service.ts#L99)). Si `COOKIE_DOMAIN` no está seteado, el dominio de borrado no coincide con el de seteo y el navegador puede **no borrar** la cookie.
- **Fix:** unificar el default y derivar `domain`/`secure` de un único helper.

### SEC-6 (P1) — MCP: sin rate-limit por IP ni límite de payload; DB hit por request no autenticado
- **Evidencia:** [mcp.ts:47-66](../../../../apps/api/src/mcp.ts#L47-L66): cada `POST /mcp` resuelve token (DB lookup) antes del rate-limit (que es **por conexión**, [mcp.tools.ts:13-20](../../../../apps/api/src/modules/mcp/mcp.tools.ts#L13-L20)). Tokens inválidos no pasan por rate-limit → cada request inválido pega a Postgres (`findUnique` por `tokenLookup`). `express.json()` sin `limit` explícito.
- **Por qué importa:** vector de DoS de bajo costo contra Postgres con tokens basura; el rate-limit sólo aplica **después** de autenticar. El servicio MCP es de cara a internet (vía Caddy).
- **Fix:** rate-limit por IP en el `POST /mcp` (Redis o gateway), `express.json({limit:'64kb'})`, y un throttle barato antes del lookup. Documentar que Caddy debe aplicar rate-limit de borde.
- **Práctica oficial:** NestJS rate-limiting / `@nestjs/throttler`.

### SEC-7 (P2) — `inferName`/`spaces.service` instancian OpenAI con `process.env.OPENAI_API_KEY ?? ''`
- **Evidencia:** [spaces.service.ts:238](../../../../apps/api/src/modules/spaces/spaces.service.ts#L238) crea un `new OpenAI()` por llamada con key de `process.env` (no del ConfigService) y default `''`. Hay 3 instanciaciones dispersas (memory, classifier, spaces).
- **Por qué importa:** con key vacía falla en runtime sin validación; 3 fuentes de verdad para el mismo secreto; `inferName` crea un cliente por request.
- **Fix:** un único `Embeddings/LLM port` inyectable (la spec `14-spaces-unification` ya lo pide) + validar `OPENAI_API_KEY` al boot.

---

## AUTHZ — Aislamiento y propiedad

### AUTHZ-1 (✅ correcto) — `search` default-deny verificado
- `memory.controller.search` resuelve member spaces y hace `effective = memberSpaceIds.filter(id => requestedSet.has(id))` ([memory.controller.ts:31-43](../../../../apps/api/src/modules/memory/memory.controller.ts#L31-L43)); `memory.service.search` retorna `[]` si `allowedSpaceIds` vacío ([memory.service.ts:111](../../../../apps/api/src/modules/memory/memory.service.ts#L111)). MCP replica el patrón con grants ∩ membership ([mcp.tools.ts:74-80](../../../../apps/api/src/modules/mcp/mcp.tools.ts#L74-L80)). **No se encontró IDOR de lectura.** Probar el abuso (pasar `spaceIds` de otro tenant) resulta en intersección vacía → `[]`. Bien.

### AUTHZ-2 (P1) — `removeMemoryFromSpace` sin check de autor en colectivos
- **Evidencia:** [spaces.service.ts:153-165](../../../../apps/api/src/modules/spaces/spaces.service.ts#L153-L165): exige rol `contributor|admin` en el space, pero busca la fila sólo por `{memoryId, homeSpaceId: spaceId}` —**sin** verificar autoría— y la re-homea al **General del que la quita**. `addMemoryToSpace` sí valida `{memoryId, userId}` ([spaces.service.ts:171-173](../../../../apps/api/src/modules/spaces/spaces.service.ts#L171-L173)).
- **Por qué importa:** en un colectivo, un `contributor` puede **sacar el recuerdo de otro miembro** y moverlo a su propio General → pérdida de dato para el colectivo + apropiación. Asimetría de control.
- **Fix:** para "quitar de space", re-homear a un destino del **colectivo o del autor**, no del actor; o exigir `admin` o autoría. Definir la política de quién puede mover qué.
- **Práctica oficial:** NestJS authorization (verificación de ownership a nivel objeto).

### AUTHZ-3 (P2) — `updateGrantWrite` no verifica la pertenencia de la conexión
- **Evidencia:** [collective.service.ts:215-235](../../../../apps/api/src/modules/collective/collective.service.ts#L215-L235): el admin del space puede togglear `canWrite` de **cualquier** grant sobre ese space, incluso de conexiones de otros miembros. Es defendible (el admin gobierna la escritura al colectivo), pero no se valida que la conexión sea de un miembro.
- **Fix:** documentar la política; opcionalmente, validar que `connection.userId` sea miembro del space.

### AUTHZ-4 (P2) — Files sin ACL por space en colectivos
- **Evidencia:** `presign`/`create` aceptan archivos del usuario y los key-ean en `users/{userId}/...` ([files.service.ts:34-50](../../../../apps/api/src/modules/files/files.service.ts#L34-L50)); el schema permite `File.spaceId` pero el flujo no lo setea ni valida membership del space destino (la spec `16-collective` prevé `spaces/{spaceId}/...` con ACL). Hoy los archivos son personales, así que no hay fuga, pero el Drive colectivo no está cableado.
- **Fix:** al subir a un colectivo, exigir membership y key-ear por `spaceId`.

---

## INT — Integridad / colas / consistencia

### INT-1 (P1) — Workers sin `worker.close()`: jobs stalled en cada deploy
- **Evidencia:** [worker.ts:32-41](../../../../apps/api/src/worker.ts#L32-L41) arranca los workers pero **no guarda la referencia** ni los cierra en `SIGTERM` (sólo `app.close()`). Los `Worker` BullMQ quedan vivos hasta el `process.exit`.
- **Por qué importa:** BullMQ es *at-least-once*: un worker matado a mitad de job no renueva el lock → el job queda **stalled** y se re-procesa. En cada deploy/restart se pueden duplicar reprocesamientos.
- **Fix:** guardar las referencias y `await Promise.all([ingestWorker.close(), reclassifyWorker.close()])` antes de `app.close()`/`exit`.
- **Práctica oficial:** BullMQ — *"It is important to properly close the workers to minimize the risk of stalled jobs"*; manejar SIGTERM y `await worker.close()` (https://docs.bullmq.io/guide/going-to-production).

### INT-2 (P1) — Sin `jobId` determinista (dedupe) ni DLQ
- **Evidencia:** `ingestQueue.add('ingest', {fileId,...})` sin `jobId` ([files.service.ts:48](../../../../apps/api/src/modules/files/files.service.ts#L48)); idem reclassify ([spaces.service.ts:48](../../../../apps/api/src/modules/spaces/spaces.service.ts#L48)). `removeOnFail` descarta fallidos (no hay dead-letter). La idempotencia se logra con `deleteByFile` al reintentar ([ingest.processor.ts:51](../../../../apps/api/src/modules/ingest/ingest.processor.ts#L51)).
- **Por qué importa:** si el mismo `fileId` se encola dos veces (doble `POST /files`, o re-entrega tras stall), corren 2 jobs concurrentes (`concurrency:2`) que hacen `deleteByFile` + re-ingest entrelazados → ventana de duplicación de vectores. Sin DLQ no hay inspección de jobs muertos.
- **Fix:** `add('ingest', data, { jobId: 'ingest:' + fileId })` para deduplicar; mover fallidos terminales a una cola/registro DLQ en vez de `removeOnFail`.
- **Práctica oficial:** BullMQ — *"if you add a job with an existing id then that job will just be ignored"* (https://docs.bullmq.io/guide/jobs/job-ids) y diseño *at-least-once* → procesadores idempotentes (https://docs.bullmq.io/patterns/idempotent-jobs).

### INT-3 (P1) — `import/chatgpt` corre in-process, no en cola
- **Evidencia:** [onboarding.service.ts:42-57](../../../../apps/api/src/modules/onboarding/onboarding.service.ts#L42-L57): `Promise.all(chunks.map(add)).catch(()=>null)` en el proceso de la API, sin `await`, devolviendo `{queued: n}`.
- **Por qué importa:** el nombre miente ("queued"): no hay cola, ni reintento, ni backpressure. Un import grande bloquea el event loop de la API y se **pierde por completo si el proceso reinicia** a mitad. Compite con el tráfico HTTP.
- **Fix:** encolar en BullMQ (un job por conversación o por lote) como hace `files`. Devolver un `jobId` para que la Bandeja muestre progreso.
- **Práctica oficial:** BullMQ going-to-production (trabajo asíncrono fuera del request).

### INT-4 (P1) — Memorias importadas/rescate nunca se clasifican → invisibles
- **Evidencia:** `ingestRescue` y `importChatGpt` llaman `memory.add(...)` **sin** invocar al classifier ([onboarding.service.ts:38,49](../../../../apps/api/src/modules/onboarding/onboarding.service.ts#L38-L49)), a diferencia del ingest de files que sí clasifica ([ingest.processor.ts:83-90](../../../../apps/api/src/modules/ingest/ingest.processor.ts#L83-L90)). `add` deja `homeSpaceId=null` y `space_id=null` en Qdrant.
- **Por qué importa:** `search` sólo matchea `space_id ∈ allowedSpaceIds`; una memoria con `space_id=null` **no es visible para nadie** hasta que un `backfill` (al crear/editar un space) la capture dentro del top-200. El rescate de ChatGPT —el gancho de onboarding— produce memoria que el usuario no puede buscar.
- **Fix:** clasificar tras importar (igual que ingest), o homear al General por defecto (`spaceId = generalSpace.id`) cuando no hay match.

### INT-5 (P2) — `submemories` legacy: rama de lectura no acotada (riesgo de fuga si el cutover quedó incompleto)
- **Evidencia:** el filtro de `search` es `space_id ∈ allowed` **OR** `submemories ∈ allowed` ([memory.service.ts:121-136](../../../../apps/api/src/modules/memory/memory.service.ts#L121-L136)). El `add` actual nunca escribe `submemories`; sólo existe en puntos legacy.
- **Por qué importa:** mientras dure el dual-filter, un punto legacy con `submemories=[X,Y]` es visible para miembros de X **y** de Y. Si en el modelo legacy un recuerdo "multi-home" cruzaba tenants, ese punto es legible por ambos. El riesgo depende de cuán limpio quedó el backfill; **no hay evidencia en código del estado del cutover** (ningún conteo "puntos sin space_id").
- **Fix:** ejecutar un conteo en Qdrant de puntos con `space_id=null`/sólo `submemories`; cuando sea 0, **eliminar la rama `submemories`** del filtro y dropear el payload. Documentar el cutover con evidencia.
- **Práctica oficial:** Qdrant payload indexing/filtros (https://qdrant.tech/documentation/concepts/indexing/).

### INT-6 (P2) — `.catch(() => null)` silencia divergencias críticas
- **Evidencia:** updates de `growthEvent` y borrados se tragan errores: [memory.service.ts:167,190](../../../../apps/api/src/modules/memory/memory.service.ts#L167-L190), [spaces.service.ts:120,234](../../../../apps/api/src/modules/spaces/spaces.service.ts#L120-L234), [classifier.service.ts:226](../../../../apps/api/src/modules/spaces/classifier.service.ts#L226), [connections.service.ts:156](../../../../apps/api/src/modules/connections/connections.service.ts#L156).
- **Por qué importa:** una divergencia Qdrant↔Postgres se pierde sin telemetría; `remove` re-homea huérfanos con `.catch(()=>null)` (línea 120) → si falla, borra el space igual dejando memorias con `homeSpaceId` colgando.
- **Fix:** loguear (warn + métrica) en lugar de tragar; reservar `.catch` para efectos verdaderamente best-effort y documentarlo.

### INT-7 (P2) — `remove` de space hace N re-homes secuenciales sin transacción
- **Evidencia:** [spaces.service.ts:104-126](../../../../apps/api/src/modules/spaces/spaces.service.ts#L104-L126): loop de `rehomeMemory` (cada uno Qdrant+Postgres) y luego `space.delete`. Si el proceso muere a mitad, parte de las memorias quedaron re-homeadas y el space sigue existiendo (operación no idempotente ni reanudable).
- **Fix:** mover el re-home a un job de cola idempotente; borrar el space sólo cuando no queden `homeSpaceId = spaceId`.

---

## ERR / OBS — Errores y observabilidad

### ERR-1 (P2) — Errores de dominio con `throw new Error(...)` → 500 en vez de 4xx
- **Evidencia:** `requireMembership` lanza `new Error('Se requiere rol...')` ([spaces.service.ts:210](../../../../apps/api/src/modules/spaces/spaces.service.ts#L210)); `remove` General lanza `new Error(...)` ([spaces.service.ts:109](../../../../apps/api/src/modules/spaces/spaces.service.ts#L109)). NestJS los mapea a **500** y filtra el mensaje interno.
- **Por qué importa:** un fallo de autorización legítimo se reporta como error de servidor (semántica HTTP incorrecta) y puede filtrar detalle. Mezcla con `ForbiddenException`/`NotFoundException` usados correctamente en otros sitios.
- **Fix:** usar `ForbiddenException`/`BadRequestException` consistentemente.
- **Práctica oficial:** NestJS exception filters / built-in HTTP exceptions.

### ERR-2 (P2) — Sin manejo de timeout/retry para OpenAI/Qdrant/S3
- **Evidencia:** `openai.embeddings.create` sin timeout ni retry/backoff ([memory.service.ts:115](../../../../apps/api/src/modules/memory/memory.service.ts#L115), [classifier.service.ts:42](../../../../apps/api/src/modules/spaces/classifier.service.ts#L42)); el SDK reintenta por defecto pero no hay control explícito ni circuit breaker. Un 429/timeout de OpenAI en `search` propaga 500.
- **Por qué importa:** dependencias externas caídas tumban requests de usuario; sin backoff se amplifican rate limits.
- **Fix:** `new OpenAI({ timeout, maxRetries })` centralizado + manejo de 429 con backoff exponencial + jitter; degradar `search` con mensaje claro.
- **Práctica oficial:** OpenAI — *"automatically retry requests with a random exponential backoff"* + jitter (https://platform.openai.com/docs/guides/rate-limits, OpenAI Cookbook).

### ERR-3 (P2) — Healthchecks: worker sin health; MCP health estático
- **Evidencia:** `/health` HTTP chequea redis/qdrant/postgres (bien). El **worker** no expone health (compose lo nota), y `/health` del MCP es `{status:'ok'}` estático ([mcp.ts:68-70](../../../../apps/api/src/mcp.ts#L68-L70)) — no verifica dependencias.
- **Fix:** liveness/readiness para worker (p.ej. heartbeat en Redis) y health real en MCP (ping a Redis/DB).

### OBS-1 (P2) — Config sin validación al boot
- **Evidencia:** `ConfigService` sólo expone 3 getters con default ([config.ts](../../../../apps/api/src/common/config/config.ts)); no hay `validationSchema`. `OPENAI_API_KEY`, `AWS_*`, `COOKIE_DOMAIN`, `CORS_ORIGIN` se leen ad-hoc con defaults silenciosos.
- **Por qué importa:** un deploy con env faltante arranca y falla en runtime (primer embedding / primer email / CORS roto) en vez de fallar al boot.
- **Fix:** `ConfigModule.forRoot({ validationSchema: Joi.object({...}).required-en-prod })`.
- **Práctica oficial:** NestJS — *"It is standard practice to throw an exception during application startup if required environment variables haven't been provided"* (https://docs.nestjs.com/techniques/configuration#schema-validation).

---

## Lo que está BIEN (para no romperlo en la remediación)

- **OTP**: argon2, TTL 10m, lockout 5/código contando sólo fallos, consumo en éxito (anti-replay), rate-limit email+IP en Redis ([otp.service.ts](../../../../apps/api/src/modules/auth/otp.service.ts)). Alineado con OWASP MFA Cheat Sheet (TTL corto, single-use, attempt limits).
- **Tokens MCP**: aleatorios 32B, guardados como argon2 (verificación) + HMAC lookup O(1) indexado (búsqueda), verificación argon2 defense-in-depth ([token.service.ts](../../../../apps/api/src/modules/connections/token.service.ts), [connections.service.ts:130-159](../../../../apps/api/src/modules/connections/connections.service.ts#L130-L159)).
- **Grants**: `addGrant` valida ownership de conexión **y** membership del space; cache de grants con invalidación en revoke/role-change/expulsión.
- **Audit log MCP**: `await` fail-loud (sin `.catch`) — la auditoría es parte de la operación.
- **JWT/HMAC**: fail-fast en producción si faltan secretos ([jwt.service.ts:18](../../../../apps/api/src/modules/auth/jwt.service.ts#L18), [connections.service.ts:33](../../../../apps/api/src/modules/connections/connections.service.ts#L33)).
- **Provisión de General**: en `$transaction` (space + member admin) ([auth.service.ts:46-60](../../../../apps/api/src/modules/auth/auth.service.ts#L46-L60)).
- **Growth SQL**: `$queryRaw` parametrizado (sin inyección) ([growth.service.ts:103-115](../../../../apps/api/src/modules/growth/growth.service.ts#L103-L115)).
- **Files**: validación de mime/tamaño y presign con `content-length-range` + `Content-Type` fijo (anti-abuso de S3).
- **CORS**: orígenes explícitos + `credentials:true` (no wildcard) ([main.ts:14-24](../../../../apps/api/src/main.ts#L14-L24)).
