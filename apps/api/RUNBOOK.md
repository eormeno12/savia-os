# Savia API — Runbook (operación)

Procesos: **api** (`main.ts`, HTTP), **worker** (`worker.ts`, BullMQ + timers), **mcp** (`mcp.ts`, edge MCP).
Dependencias: Postgres (gestionado, D5), Qdrant, Redis, OpenAI, S3/SES, Mercado Pago.

## Deploy

1. **Migrar primero** (expand-contract, one-shot): `pnpm --filter @savia-os/api db:deploy`
   (`prisma migrate deploy`). Las migraciones son aditivas; no romper el esquema viejo en el mismo deploy.
2. `prisma generate` (en el build de la imagen).
3. Arrancar `api`, `worker`, `mcp`. Cada uno **valida el env al boot** (zod) y **no levanta** si falta un secreto en producción.
4. Healthcheck: `GET /health` → `{status:"ok", deps:{postgres,qdrant,redis}}`. `degraded` ⇒ una dep caída.

## Rollback

- Código: redeploy de la imagen anterior. Las migraciones son **expand-contract** → la imagen vieja
  sigue funcionando contra el esquema nuevo (no se borran columnas en el mismo release que las deja de usar).
- Nunca correr `migrate reset` en producción.

## Backups + restore (gate de producción #1)

- **Postgres:** snapshots automáticos del proveedor gestionado (RDS/Neon) + PITR. **Drill mensual:**
  restaurar a una instancia temporal y correr `GET /health` + un `search` de prueba.
- **Qdrant:** snapshot del volumen (`POST /collections/savia_memories/snapshots`) en cron; subir a S3.
  Restore: crear colección desde snapshot. El payload `savia_*` viaja en el snapshot.
- **Reconciliación:** Postgres es la verdad del árbol; el **OutboxRelay** reaplica `savia_*` a Qdrant.
  Tras un restore de Qdrant desfasado, los `OutboxEvent committed` no se reaplican solos → re-emitir
  `set_payload` por `MemoryIndex` si hace falta (script de reconciliación).

## Observabilidad

- **Logs:** JSON (pino) con `requestId` (propagable a jobs). PII redactada (email/código/token/query).
- **Métricas:** `GET /metrics` (Prometheus): `savia_outbox_events{status}` (lag del outbox — **alertar si
  `pending` crece**), `savia_memories_total`, `savia_areas_total`, `savia_users_total`.
- **Outbox `failed`:** un evento pasa a `failed` tras 12 intentos con backoff exponencial (10s→60min tope,
  ~3.4h total). **No es un callejón sin salida:** `RetentionWorker` (cron horario) resucita TODAS las filas
  `failed` a `pending` (reset `attempts=0`) cada hora — si Qdrant sigue caído, vuelve a fallar y reintenta
  solo; si se recuperó, el próximo tick del relay la aplica. `lastError` se conserva en la resurrección
  (no se borra) para diagnóstico. **Alertar si `failed` se mantiene > 0 de forma sostenida durante varias
  horas/resurrecciones** (no un pico aislado) — eso indica un problema real, no un blip transitorio.
- **Colas:** BullMQ `ingest`/`import` con `removeOnFail` (DLQ); reintentos exhaustos → `File.status=failed`
  / `Job.status=failed`.

## Incidentes comunes

- **OpenAI caído:** el circuit breaker abre → `search`/`add` responden **503 "no disponible"** (no 500).
  Se recupera solo tras el cooldown. La data está intacta.
- **Outbox `pending` crece:** Qdrant caído o el worker no corre. Verificar `worker` vivo y Qdrant `GET /healthz`.
- **Outbox `failed` no baja tras varias horas:** la resurrección horaria no alcanza a estabilizarlo —
  Qdrant lleva caído más de ~3-4 ciclos de backoff, o hay un error de datos que SIEMPRE falla (no
  transitorio). Revisar: `SELECT id, kind, attempts, "lastError" FROM "OutboxEvent" WHERE status='failed'
  ORDER BY "createdAt" DESC LIMIT 20;`. Error de conectividad → tratar como el caso anterior. Error de
  datos (payload inválido, `memoryId` inexistente) → la resurrección no lo arregla sola; requiere
  intervención manual (corregir el payload o purgar la fila).
- **Webhook MP duplicado:** idempotente por `WebhookEvent` PK — no reprocesa.
- **Revocar acceso de una IA al instante:** `DELETE /connections/:id` (invalida la cache) o bajar el
  plan del dueño a `free` (el gateway MCP corta en la siguiente llamada).

## GDPR

- `POST /account/export` → `Job(account_export)` (síncrono dentro del request) → JSON subido a S3, `resultRef` = URL presignada (o el JSON embebido si S3 no está habilitado).
- `POST /account/delete` → encola `Job(account_delete)` y devuelve `{jobId}` de inmediato — la purga real (**Postgres cascade + Qdrant `user_id` + entity-store + S3 `users/{id}/`**) corre async en el proceso `worker` (`AccountDeleteWorker`, misma forma que `import_chatgpt`). Pollear `GET /jobs/:jobId` hasta `status` en `done`/`failed`.

## Edge MCP

- `mcp` detrás de Caddy con rate-limit de borde + `trust proxy`. Body JSON acotado (256 kb).
  Rate-limit por IP **antes** de resolver el token (no pega a Postgres con tokens basura).
