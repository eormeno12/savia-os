-- El relay y el GC reintentaban TODO lo pending en cada tick (1s / 30s) sin
-- backoff: un outage de Qdrant de pocos segundos saturaba MAX_ATTEMPTS y dejaba
-- filas varadas en 'failed' para siempre (el relay solo lee 'pending'). Este
-- timestamp marca cuándo una fila vuelve a ser elegible — null = elegible ya.
ALTER TABLE "OutboxEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- Permite a processBatch()/processPurges() saltar filas no vencidas sin escanear
-- todo (status, createdAt) — crítico bajo outage prolongado.
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");
