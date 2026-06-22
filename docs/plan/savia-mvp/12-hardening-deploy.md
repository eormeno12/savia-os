# Step 12 — Endurecimiento + despliegue

**Objetivo**: dejar el MVP desplegable en una EC2 con Docker Compose, TLS, secretos,
respaldos y el borrado en cascada verificado. Cierra el end-to-end por HTTPS.

**Depende de**: todos los steps anteriores.

---

## 1. Compose completo (`infra/docker-compose.yml`)

Añadir a los backings (postgres/redis/qdrant) los servicios de aplicación:

```yaml
  gateway:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile", "caddydata:/data"]
    depends_on: [api, mcp]
  api:
    build: { context: .., dockerfile: apps/api/Dockerfile }
    command: node dist/main.js
    env_file: [./.env]
    depends_on: [postgres, redis, qdrant]
  worker:
    build: { context: .., dockerfile: apps/api/Dockerfile }
    command: node dist/worker.js
    env_file: [./.env]
    depends_on: [postgres, redis, qdrant]
  mcp:
    build: { context: .., dockerfile: apps/api/Dockerfile }
    command: node dist/mcp.js
    env_file: [./.env]
    depends_on: [postgres, redis, qdrant]
```

- **Solo `gateway` expuesto** a internet; `api/mcp/worker/postgres/redis/qdrant` en
  la red interna de Docker (sin `ports` públicos).
- `apps/api/Dockerfile` multi-stage: build con pnpm (workspace), `prisma generate`,
  output `dist/`; imagen final node slim. Los 3 procesos comparten la misma imagen.

## 2. `infra/Caddyfile` (TLS + reverse proxy)

```
app.savia.com  { reverse_proxy ... }    # (o Vercel sirve app; ver nota)
api.savia.com  { reverse_proxy api:4400 }
mcp.savia.com  { reverse_proxy mcp:4401 }
```

- TLS automático (Let's Encrypt) vía Caddy.
- Subdominios bajo `savia.com` para que las cookies `Domain=.savia.com` funcionen
  entre `app` (frontend) y `api`.
- Rate limit a nivel gateway (capa extra sobre el de Redis).

> Nota frontend: `apps/app` puede ir en **Vercel** (como landing) apuntando a
> `api.savia.com`/`mcp.savia.com`, o dockerizarse tras el gateway. Para el MVP, Vercel
> para `app` + backend self-hosted es lo más simple; documentar la opción elegida.

## 3. Secretos y config

- Producción: `OPENAI_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, credenciales
  AWS, `INTERNAL_TOKEN` vía **AWS SSM Parameter Store / Secrets Manager** (o `.env`
  cifrado fuera del repo). Nunca en git.
- `COOKIE_DOMAIN=.savia.com`, CORS de `api` permitiendo `https://app.savia.com`.
- `INTERNAL_TOKEN` para llamadas entre procesos (endpoints internos de memoria).

## 4. Borrado en cascada (verificar de punta a punta)

- `DELETE /files/:id` debe borrar: objeto S3, fila `File`, **memorias en Qdrant**
  (filtro `file_id`) y filas `MemoryIndex`, y opcionalmente `GrowthEvent` asociados.
- Borrar usuario (GDPR): purga `delete_all` por `user_id` en Qdrant + cascada en
  Postgres + objetos S3 del prefijo `users/{userId}/`.

## 5. Respaldos y operación

- **Snapshots EBS** automáticos de los volúmenes `pgdata` y `qdrantdata`.
- `prisma migrate deploy` en el arranque/CI de despliegue.
- Healthchecks del compose + reinicio (`restart: unless-stopped`).
- Runbook básico: cómo desplegar, ver logs (`docker compose logs -f api`), restaurar
  snapshot, rotar secretos, escalar `worker` (`--scale worker=N`).

## 6. Privacidad / seguridad (datos sensibles: salud, personal)

- Cifrado en reposo (EBS + S3 SSE), TLS en tránsito.
- Región de datos definida (`AWS_REGION`).
- Política de borrado (GDPR) y de retención de `AccessLog`.
- Rate limit + audit (steps 03/09) ya en su sitio; revisar límites en prod.

## 7. Camino de evolución (no en MVP)

- Compose → **ECS Fargate** (no Kubernetes) cuando un host se quede corto.
- Postgres → **RDS** cuando los datos de usuarios sean críticos.
- Embeddings → `fastembed` en CPU si el costo de OpenAI lo justifica.
- Graph store (Neo4j) para queries multi-hop.

## Archivos clave

- `infra/docker-compose.yml` (completo), `infra/Caddyfile`, `apps/api/Dockerfile`
- `infra/.env.example` (prod vars), runbook en `docs/`

## Verificación (end-to-end en EC2)

1. `docker compose up -d` en la EC2; todos los servicios healthy; solo gateway expuesto.
2. `https://api.savia.com/health` = 200.
3. Login OTP (SES real) desde `https://app.savia.com`.
4. Subir archivo → ingesta → `indexed`; memorias clasificadas.
5. Conectar una IA externa a `https://mcp.savia.com` con un token; `savia_search`
   respeta los grants; `AccessLog` registra.
6. Dashboard muestra áreas + crecimiento.
7. Borrar archivo → memorias eliminadas de Qdrant + `MemoryIndex` (cascada).
8. Restaurar un snapshot EBS de prueba y verificar integridad.
