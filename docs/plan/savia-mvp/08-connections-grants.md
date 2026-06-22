# Step 08 — Connections (IAs) + Grants (ventanas de contexto)

**Objetivo**: el usuario crea **conexiones** (una por IA o chat que conectará) y
decide qué **spaces** puede **ver** cada una. La escritura es siempre libre.
Modelo `default-deny` en lectura.

**Depende de**: 01, 02, 03, 07.

---

## Modelo

```
Conexión   "Claude personal"  ──token──►  puede VER:  Salud
Conexión   "Cursor work"      ──token──►  puede VER:  Trabajo, Finanzas
Conexión   "ChatGPT general"  ──token──►  puede VER:  (nada aún → default-deny)

Write: cualquier conexión puede siempre llamar savia_remember.
       Savia clasifica la memoria en los spaces que correspondan.
```

Los grants no tienen scope (`read/write`): son solo "esta conexión ve este space".

## Entregables backend (`apps/api/src/modules/connections/`)

```
connections.module.ts
connections.controller.ts   # CRUD conexiones + grants
connections.service.ts
token.service.ts            # genera token opaco, hash argon2
grants.cache.ts             # cache Redis token→{connectionId,userId,spaceIds[]}
```

### Endpoints (protegidos por `JwtAuthGuard`)

- `POST /connections { label }` → genera token opaco
  (`savia_` + base64url(32 bytes)), guarda `tokenHash`,
  **devuelve el token en claro una sola vez**.
- `GET /connections` → lista (label, lastSeenAt, revoked, spaces concedidos).
- `DELETE /connections/:id` → `revokedAt=now` + invalida cache.
- `POST /connections/:id/grants { spaceId }` → concede acceso de lectura al space.
- `DELETE /connections/:id/grants/:spaceId` → revoca acceso.

### Resolución de token + cache (hot path del MCP)

`resolveToken(rawToken)` → `{ connectionId, userId, spaceIds[] }`:

1. Cache Redis `mcp:token:{hash}` (TTL ~60s) → si hit, devuelve directo.
2. Miss: buscar `Connection` por `tokenHash` (no revocada) + cargar grants + cachear.
3. **Invalidación**: al añadir/borrar grant, revocar conexión → borrar key de cache.

## Entregables frontend (`apps/app/src/`)

Vista unificada **"Mis espacios y accesos"** — el usuario ve en una sola pantalla
sus spaces y qué IAs los ven:

```
┌─ Mis espacios ────────────────────────────────────────────────────┐
│  💼 Trabajo  (87 mem)      IAs: Cursor work ✅  Claude ❌         │
│  🏥 Salud    (24 mem)      IAs: Claude ✅       Cursor work ❌    │
│  💰 Finanzas (12 mem)      IAs: (ninguna)                         │
└───────────────────────────────────────────────────────────────────┘

┌─ Mis conexiones ──────────────────────────────────────────────────┐
│  Claude personal    última vez: hace 2h   Spaces: Salud           │
│  Cursor work        última vez: hace 10m  Spaces: Trabajo         │
│  [+ Nueva conexión]                                               │
└───────────────────────────────────────────────────────────────────┘
```

Al crear una conexión: flujo rápido → nombre → copiar token → seleccionar spaces.
Los grants se pueden editar directamente desde la vista de spaces o de conexiones.

```
components/connections/SpaceControlPanel.tsx   # vista unificada (spaces + conexiones)
components/connections/NewConnectionDialog.tsx # crea → muestra token 1 vez → asigna spaces
```

## Seguridad

- Token solo en claro en la respuesta de creación; en BD solo el hash.
- `default-deny`: sin grant → la conexión no ve nada al buscar (sí puede escribir).
- Revocar invalida inmediatamente (cache + `revokedAt`).

## Contracts (`packages/contracts/src/connections.ts`)

```ts
export const CreateConnectionSchema = z.object({
  label: z.string().min(1).max(80)
})
export const ConnectionDtoSchema = z.object({
  id: z.string(), label: z.string(),
  lastSeenAt: z.string().nullable(),
  revoked: z.boolean(),
  spaceIds: z.array(z.string()),       // spaces con acceso
  createdAt: z.string()
})
export const CreateConnectionResponseSchema = ConnectionDtoSchema.extend({
  token: z.string()                    // solo en la respuesta de creación
})
export const GrantSchema = z.object({ spaceId: z.string() })

export type CreateConnectionDto      = z.infer<typeof CreateConnectionSchema>
export type ConnectionDto            = z.infer<typeof ConnectionDtoSchema>
export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponseSchema>
```

## Archivos clave

- `apps/api/src/modules/connections/*`
- `apps/app/src/components/connections/SpaceControlPanel.tsx`

## Verificación

1. `POST /connections {label:"Claude personal"}` → devuelve token una vez; solo
   `tokenHash` en BD.
2. `POST /connections/:id/grants { spaceId }` → concede acceso a "Salud".
3. `resolveToken(token)` → `{ userId, spaceIds: ["<id-salud>"] }`.
4. Editar grants → cache invalidada; siguiente resolución refleja el cambio.
5. Sin grants → `resolveToken` devuelve `spaceIds: []` (default-deny en lectura).
6. Revocar conexión → `resolveToken` falla.
