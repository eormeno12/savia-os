# Step 15 — La frontera limpia (hardening del enforcement)

> ✅ **Vigente bajo el rebuild (2026-06-29).** Todos los principios de esta frontera **se preservan** con multi-membership (verificado en [`0A §A`](../../audit/backend/2026-06-27/0A-analisis-correctitud.md)): default-deny, clamp `granted ∩ requested`, filtro de metadata determinista, *"el lenguaje natural es UX, nunca la frontera"*, audit always-on. **Único cambio:** el valor de frontera pasa de `space_id` (escalar) a **`savia_area_ids`** (conjunto, con ancestros) → un grant a un área expone su subárbol vía `area_ids ANY`. **Sin regresión.** Canónico: [`08 §6`](../../audit/backend/2026-06-27/08-plan-end-to-end.md).

**Objetivo**: re-asentar la frontera de acceso para que sea **determinista,
fail-closed y única**. Tras este step, el control de lectura vive en un solo lugar
del servidor, el dato mismo es fail-closed, y revocar/cambiar grants surte efecto
de inmediato. Aquí se pliegan los bugs **B1, B3, B4**.

**Depende de**: [14](14-spaces-unification.md) (`space_id` poblado y verificado).

---

## Los cinco principios (recordatorio del [overview de fase](13-collective-overview.md))

1. Una sola función de acceso, fail-closed.
2. El dato (`memory.search`) es fail-closed.
3. Lookup de token determinista (HMAC) + una sola clave de caché + invalidación
   completa.
4. `space_id` es la clave indexada de la frontera.
5. Audit siempre se escribe.

## 1 — `resolveReadableSpaces`: el único punto de decisión

Hoy el clamp vive disperso entre `mcp.tools.ts` (`requested ∩ resolved.spaceIds`)
y `memory.search` (filtro `user_id`). Se centraliza:

```
resolveReadableSpaces(connection) -> string[]
  1. grants = grants de la conexión (spaces concedidos)
  2. # en fase 16: ∩ con los spaces de los que el USUARIO es miembro
  3. return grants               # default-deny: sin grants → []
```

- Derivada **siempre en el servidor**, nunca del cliente.
- Es la única fuente del `space_id ANY [...]` que llega a Qdrant.
- En [16](16-collective-spaces.md) se le añade la intersección con la membresía del
  usuario (un grant a un Space del que el usuario ya no es miembro deja de valer).

## 2 — `memory.search` fail-closed (cierra B4)

Hoy, con `submemories` vacío, `search` filtra **solo** `user_id` → devuelve toda la
memoria del usuario; el default-deny vive solo en la capa MCP
([memory.service.ts:104](../../apps/api/src/modules/memory/memory.service.ts#L104)).

Cambio:

```
search(allowedSpaceIds: string[], query, { limit }):
  if allowedSpaceIds.length === 0: return []          # fail-closed EN EL DATO
  filter = { must: [{ key: 'space_id', match: { any: allowedSpaceIds } }] }
```

- Se elimina el parámetro `userId` como frontera de lectura y la rama
  `submemories`. La frontera es `space_id`.
- Cualquier caller (MCP hoy, otros mañana) hereda el default-deny sin tener que
  recordar el clamp.

## 3 — Lookup de token determinista (cierra B1 y B3)

**Problema actual (verificado):**
- `resolveTokenCached` lee/escribe la caché con clave `sha256(rawToken)`, pero
  `revoke`/`addGrant`/`removeGrant` invalidan con la clave `argon2 tokenHash` →
  **la entrada que se usa nunca se invalida** (B1): revocar tarda ≤60s en surtir
  efecto.
- `resolveToken` recorre **todas** las conexiones no revocadas y hace `argon2.verify`
  por fila (B3): O(N) argon2 por cache-miss = amplificador de DoS.

**Solución — columna de lookup determinista:**

```prisma
model Connection {
  // …
  tokenHash   String  @unique   // argon2 — solo para VERIFICAR
  tokenLookup String  @unique   // HMAC-SHA256(serverKey, rawToken) — para BUSCAR + cachear
  // …
  @@index([tokenLookup])
}
```

- `resolveToken(rawToken)`: `lookup = HMAC(serverKey, rawToken)` →
  `findUnique({ tokenLookup })` (O(1)); luego `argon2.verify` **una vez** para
  confirmar (defensa en profundidad). Se elimina el escaneo de tabla.
- **Una sola clave de caché** = el mismo `tokenLookup`. `GrantsCache.get/set/invalidate`
  usan esa clave en todos lados.
- `serverKey` desde env (`MCP_TOKEN_HMAC_KEY`), **obligatoria en producción**
  (fail-fast, como JWT en B7).

**Migración**: `tokenLookup` aditivo nullable → backfill **no es posible** (no
guardamos el raw token). Estrategia: poblar `tokenLookup` de forma perezosa la
primera vez que cada conexión se resuelve por el camino viejo, o **rotar tokens**
(emitir de nuevo) si se prefiere limpio. Documentar la decisión en el step.

## 4 — Invalidación completa de la caché

Tabla de eventos que cambian el acceso efectivo y deben invalidar la **clave única**:

| Evento | Invalida hoy | Debe invalidar |
|--------|--------------|----------------|
| Revocar conexión | clave equivocada (B1) | ✅ por `tokenLookup` |
| Añadir grant | clave equivocada (B1) | ✅ |
| Quitar grant | clave equivocada (B1) | ✅ |
| Borrar Space (cascade de Grant) | nada | ✅ — hook nuevo |
| **Cambio de membresía** (fase 16) | no existe | ✅ — invalidar **todas** las conexiones del usuario expulsado |

> El TTL de 60s deja de ser la única defensa: la invalidación dirigida hace la
> revocación inmediata. El TTL queda como red de seguridad.

## 5 — Audit always-on

- Quitar el `.catch(() => null)` de `accessLog.create` en
  [mcp.tools.ts](../../apps/api/src/modules/mcp/mcp.tools.ts) (search y remember).
  El audit es **parte de la operación**: `await` y fail-loud, o encolar de forma
  durable. Una acción privilegiada no debe completarse si su registro se pierde.
- Opcional (fase 3): hash-chain del log para tamper-evidence.

## Rate limit antes de resolver

- Mover el rate-limit MCP a **antes** de `resolveOrThrow()`, con clave por IP /
  hash del raw token, y **caché negativa** para tokens inválidos. Hoy el límite es
  por `connectionId` y solo aplica tras resolver, así que un token basura dispara
  el camino caro en cada request (mitiga el residuo de B3).

## Contracts / efectos

- `connections.ts`: sin cambio de forma pública (`spaceIds[]` se mantiene). La
  semántica de `resolveToken` interna cambia (devuelve el set que **es** la
  frontera; `userId` queda solo para atribución de escritura).
- `mcp.tools.ts`: `savia_search` pasa `resolveReadableSpaces(...)` directo a
  `memory.search`; la respuesta mapea `space_id`.

## Verificación

1. **Default-deny en el dato**: llamar `memory.search([], …)` → `[]` sin tocar
   Qdrant. Conexión sin grants → `savia_search` → `[]`.
2. **Revocación inmediata**: revocar una conexión → la siguiente llamada MCP falla
   **sin esperar** el TTL (la clave única fue invalidada).
3. **Cambio de grant inmediato**: quitar un grant → `savia_search` deja de ver ese
   Space en la siguiente llamada.
4. **Lookup O(1)**: con N conexiones, `resolveToken` hace 1 `findUnique` + 1
   `argon2.verify` (no N). Medir que no escala con N.
5. **Audit**: forzar fallo de `accessLog.create` → la operación **no** se completa
   silenciosamente (o queda encolada), nunca se pierde el registro.
6. **Fail-fast**: arrancar en `NODE_ENV=production` sin `MCP_TOKEN_HMAC_KEY` →
   el proceso MCP **no** levanta.
7. **Paridad de cutover** (heredada de 14): con dual-filter activo, los resultados
   filtrando por `user_id` y por `space_id` coinciden antes de retirar `user_id`.
