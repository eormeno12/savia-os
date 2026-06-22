# Savia MVP — Overview

> Índice maestro del plan incremental del MVP de Savia. Léelo antes de cualquier step.

## Qué es Savia

Savia es "la memoria que conecta todas tus IAs". El usuario:

1. Entra con **login por OTP** (email).
2. Carga archivos en una **plataforma visual tipo Drive**; los archivos se
   convierten en **memoria** (hechos extraídos por mem0).
3. En el **onboarding** importa sus chats con IAs o pega la respuesta a un
   "prompt de rescate".
4. Define **submemorias** (áreas de su memoria) en lenguaje natural y decide qué
   IA accede a cuáles.
5. Pega la **config MCP** en su IA (Claude/Cursor/…) y Savia queda activo.
6. Ve su perfil como **áreas de memoria** y cuánto ha crecido su conocimiento por
   día/semana.

## Las dos capas (insight central)

| Capa | Qué es | Dónde vive |
|------|--------|-----------|
| **Drive** | archivos crudos | AWS S3 + Postgres (metadata) |
| **Memoria** | hechos destilados de esos archivos | mem0 OSS → Qdrant |

El Drive lista archivos; el dashboard de áreas consulta la memoria (emergente).
**No son lo mismo**: las carpetas organizan archivos; las áreas/submemorias son
cómo se clasificó el conocimiento.

## Decisiones tomadas

- **Backend**: monolito modular **NestJS** (`apps/api`), microservice-ready.
  Un solo código, tres procesos: `main` (HTTP REST), `worker` (BullMQ), `mcp`.
- **Memoria**: pure TS — `mem0ai/oss` para `add()`; `search()` directo a **Qdrant**
  con filtro de acceso. Qdrant en contenedor propio.
- **LLM/embeddings**: **OpenAI** — `gpt-4o-mini` (extracción + clasificación),
  `text-embedding-3-small` (embeddings).
- **Self-hosted**: Docker Compose en una EC2; S3 + SES gestionados.
- **Redis**: BullMQ + cache de grants + rate limit.
- **ORM**: Prisma. **Auth**: `jose` (JWT) + `argon2`. **Frontend**: Next.js 16 +
  Chakra UI v3 (mismo stack que `apps/landing`).
- **DTOs / validación**: `nestjs-zod`. Los schemas Zod viven en `packages/contracts`
  y se usan como `ZodDto` en los controllers de `apps/api` (validación automática) y
  como `z.infer<typeof Schema>` en `apps/app` (tipos + validación cliente). Un schema,
  cero duplicación.
- **Spaces (no "submemorias")**: el usuario divide su memoria en **spaces** definidos
  en lenguaje natural. Son ventanas de **contexto de lectura** para cada IA; la
  escritura es siempre libre. Savia clasifica cada memoria en los spaces que
  correspondan.

## Principio rector de seguridad

> El lenguaje natural es la **UX** de la definición de submemorias, **nunca** la
> frontera de seguridad. Se **compila** a etiquetas deterministas en write-time;
> el enforcement es un **filtro duro de metadata en Qdrant** con `default-deny`,
> clamp `granted ∩ requested`, y audit log. Nunca se confía en el LLM/prompt como
> frontera.

## Arquitectura

```
Vercel: apps/landing (marketing) + apps/app (producto)
                                   │ HTTPS (cookies Domain=.savia.com)
EC2 (Docker Compose):
  gateway (Caddy, TLS)
   ├─ api    (NestJS, proc main)   HTTP REST  → Postgres, Redis, S3, Qdrant
   ├─ worker (NestJS, proc worker) BullMQ     → parse/extract/classify → Qdrant
   ├─ mcp    (NestJS, proc mcp)    MCP HTTP   → auth token, clamp, Qdrant
   ├─ postgres   (users, files, submemories, connections, grants, audit)
   ├─ redis      (BullMQ + cache grants + rate limit)
   └─ qdrant     (vectores de memoria — el activo)
Gestionado: AWS S3 (archivos), AWS SES (OTP email), OpenAI (LLM/embeddings)
```

## Puertos (localhost, convención del repo)

| Servicio | Puerto |
|----------|--------|
| landing | 4343 |
| demo-api (existente) | 4344 |
| app (producto) | 4345 |
| api (NestJS main) | 4400 |
| mcp (NestJS) | 4401 |
| postgres | 5432 |
| redis | 6379 |
| qdrant | 6333 |

## Estructura objetivo del monorepo

```
apps/
  landing/   (existente)   demo-api/  (existente)   openmemory/ (submódulo, no se usa)
  app/       @savia-os/app   Next.js producto (4345)
  api/       @savia-os/api   NestJS (main/worker/mcp)
packages/
  tsconfig/  (existente)   contracts/ @savia-os/contracts (DTOs + Zod compartidos)
infra/       docker-compose.yml · Caddyfile · .env.example
docs/plan/savia-mvp/   (estos .md)
```

## Orden de steps

| Step | Archivo | Resultado verificable |
|------|---------|-----------------------|
| 01 | `01-infra-scaffold.md` | infra + esqueletos arrancan; `/health` OK |
| 02 | `02-data-layer.md` | esquema Postgres migrado |
| 03 | `03-auth-otp.md` | login OTP end-to-end |
| 04 | `04-files-drive.md` | subir archivo → listado en Drive |
| 05 | `05-memory-layer.md` | add/search de memoria con filtro |
| 06 | `06-ingest-pipeline.md` | archivo → memorias (async) |
| 07 | `07-submemories.md` | spaces NL + clasificación + inspección |
| 08 | `08-connections-grants.md` | conexiones + acceso a spaces (default-deny lectura) |
| 09 | `09-mcp-server.md` | IA externa consulta con scope |
| 10 | `10-onboarding-import.md` | importar chats / prompt de rescate |
| 11 | `11-dashboard-growth.md` | áreas + crecimiento |
| 12 | `12-hardening-deploy.md` | desplegable en EC2 con TLS |

Cada step se ejecuta **en orden** y termina con su **verificación** antes de pasar
al siguiente.

## Reusar lo existente

- Theme/tokens y patrones de `apps/landing` (Chakra v3, Framer Motion).
- `OPENAI_API_KEY` ya usado en `apps/demo-api`.
- `@savia-os/tsconfig` (`base`, `nextjs`).

## No tocar

- `apps/openmemory` (submódulo).
- `apps/demo-api`.

## Decisiones abiertas (se resuelven en su step)

- **Write siempre libre**: cualquier IA puede llamar `savia_remember`. Savia
  clasifica la memoria en los spaces que correspondan. El control es en la lectura.
- **Sensibilidad / exclusión** (07): MVP aditivo. "Nunca exponer X aunque esté
  co-clasificado" → fase 2.
- **Crear spaces vía MCP**: en MVP solo desde la UI del usuario.
