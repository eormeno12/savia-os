# Step 06 — Ingest Pipeline (BullMQ worker)

**Objetivo**: un archivo subido se convierte en memorias de forma **asíncrona**.
Se introduce el proceso `worker` (mismo código, entrypoint distinto) y la cola
BullMQ sobre Redis.

**Depende de**: 01, 02, 04, 05.

---

## Arquitectura del proceso worker

- Nuevo entrypoint `apps/api/src/worker.ts` que arranca solo los módulos necesarios
  (BullMQ processors + Memory + Prisma) sin el servidor HTTP.
- Script: `"start:worker": "node dist/worker.js"` y dev `"worker:dev": "nest start --watch --entryFile worker"`.
- Root: `pnpm worker:dev` (filtro a `@savia-os/api`).

## Cola y job

```
Cola: "ingest"
Job: { fileId, userId, source }   // source: upload | chat_import
```

Encolar:
- Al `POST /files` (step 04, update): tras crear el `File`, `ingestQueue.add(...)`.
- En onboarding (step 10) para `chat_import`.

## Processor (`apps/api/src/modules/ingest/`)

```
ingest.module.ts
ingest.queue.ts          # registro BullMQ (Queue) + conexión Redis
ingest.processor.ts      # Worker BullMQ: pipeline completo
parsers/                 # pdf.ts, text.ts, docx.ts, csv.ts, json.ts
chunk.ts                 # chunking de texto
```

Pipeline por job:

```
1. File → status=processing
2. Descargar objeto de S3 (stream)
3. Parse según mimeType:
   - pdf  → pdf-parse / unpdf
   - txt/md → texto plano
   - docx → mammoth
   - csv/json → texto estructurado
4. Chunking (p.ej. ~1–2k tokens con solape) — evita prompts gigantes en mem0
5. Por cada chunk: MemoryService.add(userId, chunk, { fileId, source })
6. (step 07) clasificación de submemorias por memoria creada
7. Emitir GrowthEvent por memoria (area provisional = "sin clasificar" hasta step 07)
8. File → status=indexed, indexedAt=now   (o failed con error en caso de fallo)
```

## Robustez

- **Reintentos** BullMQ: `attempts: 3`, `backoff` exponencial.
- **Idempotencia**: si un job se reintenta, no duplicar memorias (borrar las del
  `fileId` antes de reprocesar, o marcar progreso por chunk).
- **Concurrencia** configurable (`concurrency`), para no saturar OpenAI.
- **Límites de costo**: tope de chunks por archivo; loguear si se truncó.
- **Dead-letter**: jobs fallidos quedan en `failed` y el `File.error` guarda el motivo.

## Observabilidad

- Log estructurado por job (fileId, chunks, memorias creadas, duración).
- Opcional: Bull Board en dev para inspeccionar la cola.

## Archivos clave

- `apps/api/src/worker.ts`
- `apps/api/src/modules/ingest/*`
- `apps/api/src/modules/files/files.service.ts` (update: encolar tras crear)

## Verificación

1. `pnpm infra:up`, `pnpm api:dev`, `pnpm worker:dev`.
2. Subir un PDF desde la UI (step 04) → el `File` pasa `pending → processing →
   indexed` en segundos.
3. `POST /memory/search` recupera contenido del archivo.
4. `GrowthEvent` poblada con una fila por memoria.
5. Forzar un fallo (archivo corrupto) → `status=failed` con `error`; reintentos
   visibles en logs; sin memorias duplicadas al reintentar.
