# Step 02 — Data Layer (Postgres + Prisma)

**Objetivo**: todas las tablas del MVP creadas vía migración Prisma; `PrismaService`
integrado a NestJS; `/health` también verifica Postgres con `SELECT 1`.

**Depende de**: 01.

---

## Entregables

### 1. Prisma en `apps/api`

```
apps/api/prisma/schema.prisma
apps/api/src/common/clients/prisma.service.ts   # PrismaClient + onModuleInit/Destroy
```

Añadir deps: `prisma` (dev), `@prisma/client`. Scripts en `apps/api/package.json`:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:studio": "prisma studio",
"db:deploy": "prisma migrate deploy"
```

### 2. `schema.prisma` — esquema completo del MVP

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id           String        @id @default(uuid())
  email        String        @unique
  createdAt    DateTime      @default(now())
  files        File[]
  spaces       Space[]
  connections  Connection[]
  memoryIndex  MemoryIndex[]
  growthEvents GrowthEvent[]
}

model OtpCode {
  id         String    @id @default(uuid())
  email      String
  codeHash   String                // hash argon2 del código, nunca en claro
  expiresAt  DateTime
  attempts   Int       @default(0)
  consumedAt DateTime?
  createdAt  DateTime  @default(now())
  @@index([email])
}

enum FileStatus { pending processing indexed failed }

model File {
  id        String     @id @default(uuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id])
  name      String
  mimeType  String
  sizeBytes Int
  s3Key     String
  status    FileStatus @default(pending)
  error     String?
  source    String     @default("upload")   // upload | chat_import | mcp
  createdAt DateTime   @default(now())
  indexedAt DateTime?
  memories  MemoryIndex[]
  @@index([userId])
}

// Space: partición de la memoria definida en lenguaje natural por el usuario.
// Es una ventana de CONTEXTO/LECTURA, no una barrera de escritura.
// La escritura siempre es libre; Savia clasifica qué memorias pertenecen a qué spaces.
model Space {
  id                   String   @id @default(uuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id])
  name                 String                    // inferido del texto por el LLM
  description          String                    // texto libre del usuario (los límites)
  descriptionEmbedding Float[]                   // embedding de description; usado para clasificación y backfill
  version              Int      @default(1)      // sube al editar description → dispara reclasificación
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  grants               Grant[]
  @@unique([userId, name])
  @@index([userId])
}

model Connection {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  label      String                    // "Claude personal"
  tokenHash  String    @unique         // hash argon2 del token MCP
  lastSeenAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  grants     Grant[]
  accessLog  AccessLog[]
  @@index([userId])
}

// Grant = "esta conexión puede VER este space".
// Write es siempre libre (cualquier conexión puede llamar savia_remember).
model Grant {
  connectionId String
  connection   Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  spaceId      String
  space        Space      @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  @@id([connectionId, spaceId])
}

// Espejo en Postgres del mapeo memoria↔archivo↔spaces.
// Necesario para borrado en cascada y corrección manual por el usuario.
model MemoryIndex {
  memoryId      String   @id         // mismo id que en Qdrant/mem0
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  fileId        String?
  file          File?    @relation(fields: [fileId], references: [id], onDelete: SetNull)
  spaceIds      String[]             // ids de spaces asignados por el clasificador
  spaceVersions Json                 // { spaceId: version usada } → detecta stale
  source        String   @default("upload")
  createdAt     DateTime @default(now())
  @@index([userId])
  @@index([fileId])
}

model GrowthEvent {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  spaceId   String?                  // null = memoria sin espacio asignado aún
  memoryId  String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@index([userId, spaceId])
}

model AccessLog {
  id           String     @id @default(uuid())
  connectionId String
  connection   Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  action       String                // search | remember
  spaceIds     String[]              // spaces efectivos leídos (para search) o vacío (para remember)
  queryHash    String?
  resultCount  Int        @default(0)
  createdAt    DateTime   @default(now())
  @@index([connectionId, createdAt])
}
```

### 3. PrismaService + health

- `PrismaService extends PrismaClient` con `onModuleInit` (`$connect`) y
  `onModuleDestroy` (`$disconnect`). Registrar en `app.module.ts` como provider global.
- Actualizar `HealthController` para hacer `prisma.$queryRaw\`SELECT 1\`` además de
  redis/qdrant.

### 4. Enums Zod en `packages/contracts/src/enums.ts`

```ts
// packages/contracts/src/enums.ts
export const FileStatusSchema = z.enum(['pending', 'processing', 'indexed', 'failed'])
export type FileStatus = z.infer<typeof FileStatusSchema>
// No hay GrantScope — los grants son booleanos (tienes acceso al space o no).
```

---

## Notas de diseño

- **`MemoryIndex.memoryId` = id de Qdrant/mem0**: clave para borrado en cascada y
  corrección manual (step 07).
- **`spaceVersions`** detecta qué memorias quedaron stale al editar la descripción de
  un space → reclasificación incremental.
- **Write siempre libre**: no hay campo de scope en Grant. La conexión puede llamar
  `savia_remember` independientemente de sus grants; la lectura es lo controlado.
- **Hashes, nunca secretos en claro**: `OtpCode.codeHash`, `Connection.tokenHash`.
- Arrays Postgres (`String[]`) para `spaceIds` permiten filtros simples; el filtro
  real de acceso ocurre en Qdrant (payload), esto es el espejo/auditoría.

## Archivos clave

- `apps/api/prisma/schema.prisma`
- `apps/api/src/common/clients/prisma.service.ts`
- `apps/api/src/common/health/health.controller.ts` (update)
- `packages/contracts/src/enums.ts`

## Verificación

1. `pnpm --filter @savia-os/api db:migrate --name init` aplica sin errores.
2. `pnpm --filter @savia-os/api db:studio` muestra las 9 tablas.
3. `GET /health` ahora reporta `postgres: ok` vía `SELECT 1`.
4. `pnpm typecheck` pasa (cliente Prisma generado).
