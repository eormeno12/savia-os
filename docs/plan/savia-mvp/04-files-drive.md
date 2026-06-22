# Step 04 — Files + Drive UI

**Objetivo**: subir archivos a AWS S3 vía presigned URL y verlos listados en una
vista tipo Drive con su estado. (La ingesta a memoria llega en el step 06.)

**Depende de**: 01, 02, 03.

---

## Flujo de upload (directo a S3, sin pasar el archivo por la API)

```
1. Frontend → POST /files/presign {name, mimeType, sizeBytes}
   - API valida límites (tamaño, tipo, cuota), genera s3Key, devuelve presigned PUT URL
2. Frontend → PUT (archivo) directo a S3 con la URL
3. Frontend → POST /files {name, mimeType, sizeBytes, s3Key}
   - API crea File status=pending
4. (step 06) se encola el job de ingesta
```

## Entregables backend (`apps/api/src/modules/files/`)

```
files.module.ts
files.controller.ts       # presign, create, list, get, delete
files.service.ts          # lógica + límites
s3.service.ts             # @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner
```

Endpoints (todos protegidos por `JwtAuthGuard`, scoped al `userId` de la sesión):

- `POST /files/presign` → `{ uploadUrl, s3Key }`. `s3Key = users/{userId}/{uuid}-{name}`.
- `POST /files` → registra metadata (`status=pending`, `source=upload`).
- `GET /files` → lista del usuario (paginada), con `status`.
- `GET /files/:id` → detalle (incluye nº de memorias vía `MemoryIndex` cuando exista).
- `DELETE /files/:id` → borra el objeto S3, la fila `File`, y (step 06+) sus
  memorias en Qdrant + `MemoryIndex` (borrado en cascada).

**Límites MVP** (configurables): tamaño máx (p.ej. 20 MB), tipos permitidos
(`pdf, txt, md, docx, csv, json`), nº máx de archivos por usuario, rate de subida
(Redis). Devolver 413/415/429 según corresponda.

## Entregables frontend (`apps/app/src/`)

```
app/(app)/drive/page.tsx          # vista Drive
components/drive/FileGrid.tsx     # grid/lista con estado (pending/processing/indexed/failed)
components/drive/UploadButton.tsx # presign → PUT S3 → POST /files; progreso
components/drive/FileCard.tsx     # nombre, tipo, tamaño, estado, nº memorias
```

- Upload directo a S3 desde el navegador con la presigned URL (con barra de
  progreso via `XMLHttpRequest`/`fetch`).
- Mostrar el estado de cada archivo; polling ligero o refetch para ver el cambio
  `pending → indexed` (relevante tras step 06).
- Acción borrar con confirmación.

## S3 / CORS bucket

El bucket S3 necesita CORS que permita `PUT` desde el origin del frontend
(`app.savia.com` / `127.0.0.1:4345`). Documentar la policy en `infra/` (referencia,
no se aplica desde código).

## UX del "gap" Drive vs memoria

Cuidar la expectativa: el usuario sube un archivo y verá "archivo guardado", pero
la memoria es un *resumen*. En el `FileCard` mostrar ambos: estado del archivo +
(tras step 06) "N memorias extraídas".

## Contracts (`packages/contracts/src/files.ts`)

```ts
export const PresignRequestSchema = z.object({
  name: z.string(), mimeType: z.string(), sizeBytes: z.number().int().positive()
})
export const CreateFileSchema = z.object({
  name: z.string(), mimeType: z.string(), sizeBytes: z.number().int(), s3Key: z.string()
})
export const FileDtoSchema = z.object({
  id: z.string(), name: z.string(), mimeType: z.string(), sizeBytes: z.number(),
  status: z.enum(['pending','processing','indexed','failed']),
  memoryCount: z.number().optional(), createdAt: z.string(), indexedAt: z.string().nullable()
})
export type PresignRequest = z.infer<typeof PresignRequestSchema>
export type CreateFileDto  = z.infer<typeof CreateFileSchema>
export type FileDto        = z.infer<typeof FileDtoSchema>
```

`createZodDto` en el controller; tipos importados en `apps/app`.

## Archivos clave

- `apps/api/src/modules/files/*`
- `apps/app/src/app/(app)/drive/*`, `apps/app/src/components/drive/*`
- `packages/contracts/src/files.ts`

## Verificación

1. Subir un PDF desde la UI → aparece en S3 bajo `users/{userId}/...` y en la lista
   con `status=pending`.
2. Validaciones: archivo > límite → 413; tipo no permitido → 415.
3. `DELETE /files/:id` borra el objeto en S3 y la fila.
4. La lista está scoped: un usuario no ve archivos de otro.
