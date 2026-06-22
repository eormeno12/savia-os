# Step 01 — Infra & Scaffold (Fundación)

**Objetivo**: `docker compose up` levanta postgres + redis + qdrant; `apps/api`
(NestJS) arranca y responde `GET /health` verificando los 3 backings; `apps/app`
(Next.js) arranca en 4345. Todo integrado a Turbo/pnpm.

**Depende de**: nada (primer step).

---

## Entregables

### 1. `infra/docker-compose.yml` (solo backings en este step)

```yaml
name: savia
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: savia
      POSTGRES_PASSWORD: savia
      POSTGRES_DB: savia
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U savia"]
      interval: 5s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333", "6334:6334"]
    volumes: ["qdrantdata:/qdrant/storage"]
volumes:
  pgdata: {}
  redisdata: {}
  qdrantdata: {}
```

> `gateway` (Caddy), `api`, `worker`, `mcp` se añaden al compose en el step 12
> (despliegue). En local corren con `pnpm dev` fuera de Docker.

### 2. `infra/.env.example`

```bash
# Postgres
DATABASE_URL=postgresql://savia:savia@localhost:5432/savia
# Redis
REDIS_URL=redis://localhost:6379
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=savia_memories
# OpenAI (mismo key que demo-api)
OPENAI_API_KEY=
# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
COOKIE_DOMAIN=localhost
# AWS (se usan desde step 03/04)
AWS_REGION=us-east-1
AWS_S3_BUCKET=
AWS_SES_FROM=no-reply@savia.com
# Procesos internos
INTERNAL_TOKEN=dev-internal-token
API_PORT=4400
MCP_PORT=4401
```

### 3. `apps/api` — scaffold NestJS

Estructura mínima:

```
apps/api/
├── src/
│   ├── main.ts                 # bootstrap HTTP (proc main, puerto 4400)
│   ├── app.module.ts
│   ├── common/
│   │   ├── config/             # ConfigModule (@nestjs/config) tipado
│   │   ├── health/             # HealthModule + HealthController
│   │   └── clients/            # PrismaService, RedisService, QdrantService (singletons)
│   └── modules/                # (vacío aún; se llenan en steps siguientes)
├── package.json                # @savia-os/api
├── tsconfig.json               # extends @savia-os/tsconfig/base
├── nest-cli.json
└── Dockerfile                  # (se completa en step 12)
```

`package.json` (clave):

```json
{
  "name": "@savia-os/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "start:worker": "node dist/worker.js",
    "start:mcp": "node dist/mcp.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@nestjs/common": "^11", "@nestjs/core": "^11",
    "@nestjs/platform-express": "^11", "@nestjs/config": "^4",
    "@nestjs/terminus": "^11",
    "nestjs-zod": "^4",
    "ioredis": "^5", "@qdrant/js-client-rest": "^1",
    "@savia-os/contracts": "workspace:*",
    "reflect-metadata": "^0.2", "rxjs": "^7"
  },
  "devDependencies": {
    "@savia-os/tsconfig": "workspace:*",
    "@nestjs/cli": "^11", "typescript": "^5.9", "eslint": "^9"
  }
}
```

- **HealthController** (`GET /health`): usa `@nestjs/terminus` o checks manuales →
  `pg_isready` (Prisma `SELECT 1` se añade en step 02; aquí basta TCP), `redis.ping()`,
  `qdrant /healthz`. Devuelve `{ status, postgres, redis, qdrant }`.
- **Clients singleton** en `common/clients/`: `RedisService` (ioredis con `REDIS_URL`),
  `QdrantService` (`@qdrant/js-client-rest` con `QDRANT_URL`). `PrismaService` se
  añade en step 02.

### 4. `apps/app` — scaffold Next.js (producto)

```
apps/app/
├── src/app/                    # App Router; layout raíz + página placeholder
├── src/theme/                  # copiar/compartir tokens de apps/landing
├── package.json                # @savia-os/app, dev en 4345
├── tsconfig.json               # extends @savia-os/tsconfig/nextjs
└── next.config.ts
```

`package.json` scripts: `"dev": "next dev -H 127.0.0.1 -p 4345"`, `build`, `start`,
`typecheck`, `lint`. Dependencias base iguales a `apps/landing` (Chakra v3, framer-motion,
lucide-react, zod). Reusar el theme de landing (en este step, copiar `src/theme/`; se
puede extraer a un paquete compartido más adelante si conviene).

### 5. `packages/contracts` — schemas Zod + tipos compartidos

```
packages/contracts/
├── src/
│   └── index.ts                # export {} (placeholder; se llena por step)
├── package.json                # @savia-os/contracts
│                               # exports: { ".": "./src/index.ts" } (o dist/ si se compila)
└── tsconfig.json               # extends @savia-os/tsconfig/base
```

**Patrón DTO** (aplica a todos los steps siguientes):

1. **`packages/contracts`** define el schema Zod:
   ```ts
   // packages/contracts/src/auth.ts
   export const RequestOtpSchema = z.object({ email: z.string().email() })
   export type RequestOtpDto = z.infer<typeof RequestOtpSchema>
   ```

2. **`apps/api`** usa `nestjs-zod` para convertirlo en `ZodDto` y validar:
   ```ts
   // apps/api/src/modules/auth/auth.controller.ts
   import { createZodDto } from 'nestjs-zod'
   import { RequestOtpSchema } from '@savia-os/contracts'
   class RequestOtpDto extends createZodDto(RequestOtpSchema) {}

   @Post('request-otp')
   requestOtp(@Body() dto: RequestOtpDto) { ... }
   ```
   En `main.ts` registrar el `ZodValidationPipe` global:
   ```ts
   app.useGlobalPipes(new ZodValidationPipe())
   ```

3. **`apps/app`** importa el schema para tipar las llamadas y validar en cliente:
   ```ts
   import { RequestOtpSchema, type RequestOtpDto } from '@savia-os/contracts'
   ```

Resultado: un solo schema, validación automática en el server, tipos en el cliente, sin `class-validator` ni duplicación.

Se llenará con schemas concretos a partir del step 02.

### 6. Integración Turbo / scripts root

En `package.json` root añadir scripts:

```json
"infra:up": "docker compose -f infra/docker-compose.yml up -d",
"infra:down": "docker compose -f infra/docker-compose.yml down",
"api:dev": "turbo dev --filter=@savia-os/api",
"app:dev": "turbo dev --filter=@savia-os/app"
```

`turbo.json` ya cubre `build/dev/typecheck/lint` con `outputs` `dist/**` y `.next/**`;
no requiere cambios salvo que se necesite un task nuevo.

---

## Archivos clave

- `infra/docker-compose.yml`, `infra/.env.example`
- `apps/api/src/main.ts`, `apps/api/src/common/health/*`, `apps/api/src/common/clients/*`
- `apps/app/src/app/layout.tsx`, `apps/app/package.json`
- `packages/contracts/*`
- `package.json` (root, scripts)

## Verificación

1. `cp infra/.env.example apps/api/.env` y completar `OPENAI_API_KEY`, `JWT_SECRET`.
2. `pnpm install` (raíz) instala los nuevos workspaces.
3. `pnpm infra:up` → `docker ps` muestra postgres/redis/qdrant healthy.
4. `pnpm api:dev` → `curl localhost:4400/health` = `200` con `postgres/redis/qdrant: ok`.
5. `pnpm app:dev` → `http://127.0.0.1:4345` carga la página placeholder.
6. `pnpm typecheck` pasa en todos los workspaces.
