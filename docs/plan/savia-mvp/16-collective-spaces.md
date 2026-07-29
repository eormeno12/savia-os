# Step 16 — Spaces colectivos (drive compartido de conocimiento)

> 🔄 **Reemplazado por FEDERACIÓN (2026-06-29) — decisión D2.** El modelo de **colectivo-como-contenedor** (`Space(kind=collective)` con membresía compartida) de este doc **fue reemplazado** por una **federación**: un colectivo es un **grupo (`CollectiveGroup`) + fragmentos compartidos (`FragmentShare`)**, donde cada miembro comparte un fragmento de **su** memoria personal y **el dato nunca sale de su autor**.
> **Se preserva:** roles (viewer/contributor/admin), invitaciones, write-grants, el objetivo de "conocimiento compartido".
> **Cambia:** los **archivos** viven en el área personal del autor y se comparten como fragmento (no se "mueven" a un contenedor); las contribuciones **persisten por autoría**, no por contenedor; **al salir, tu fragmento se va con vos** (+ opción "donar snapshot").
> Fuente canónica: [`08 §5`](../../audit/backend/2026-06-27/08-plan-end-to-end.md); rutas en [`05 §3`](../../audit/backend/2026-06-27/05-rediseno-estructural.md); razón en [`0A §A`](../../audit/backend/2026-06-27/0A-analisis-correctitud.md). Lo de abajo queda como **contexto histórico**.

**Objetivo**: convertir un `Space` en **colectivo** — varios usuarios con roles que
aportan y consultan memoria y archivos en común, como un drive compartido. Incluye
invitaciones, promoción desde un Space personal, escritura permisada y la UI.

**Depende de**: [14](14-spaces-unification.md) (primitiva `Space` + single-home),
[15](15-frontier-hardening.md) (frontera limpia). **Solo después de probar la
frontera con todos los spaces aún privados.**

---

## Modelo

Reutiliza la primitiva de [14](14-spaces-unification.md): un colectivo **es un
Space con `kind=collective` y N miembros**. No hay entidad nueva de "colectivo".

```
Space "Equipo Producto"  kind=collective
  ├─ SpaceMember(ana,   admin)        lee · escribe · gestiona
  ├─ SpaceMember(beto,  contributor)  lee · escribe
  └─ SpaceMember(carla, viewer)       lee
  memorias: home_space_id = "Equipo Producto", author_id = quien la aportó
  archivos: File.spaceId = "Equipo Producto"  (S3 prefix spaces/{id})
```

### Roles (`SpaceRole`)

| Rol | Lee | Escribe | Gestiona miembros / borra ajeno |
|-----|-----|---------|--------------------------------|
| `viewer` | ✅ | — | — |
| `contributor` | ✅ | ✅ | — |
| `admin` | ✅ | ✅ | ✅ |

**Asimetría con lo personal**: en un Space privado eres `admin` → el "write libre"
del MVP se conserva como *consecuencia del rol*. En un colectivo, escribir exige
`role ≥ contributor` (no es libre).

## Invitaciones (reusa SES/OTP)

```prisma
model CollectiveInvite {                 // NEW
  id         String    @id @default(uuid())
  spaceId    String
  space      Space     @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  email      String
  role       SpaceRole
  tokenHash  String                       // argon2 del token de invitación
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime  @default(now())
  @@index([email])
}
```

- `POST /spaces/:id/invites { email, role }` (solo `admin`) → genera token, envía
  email vía `MailService` (mismo canal que el OTP).
- Aceptar (`POST /invites/:token/accept`, usuario autenticado) → crea
  `SpaceMember(role)` y consume la invitación.
- Reutiliza el patrón de hash + expiración + consumo-único del OTP.

## Escritura permisada (`canWrite`)

La frontera de escritura se añade a la de lectura:

- **Grants ganan `canWrite`** para spaces colectivos:

```prisma
model Grant {
  connectionId String
  spaceId      String
  canWrite     Boolean @default(false)    // NEW — relevante en colectivos
  // …
}
```

- `savia_remember(content, space?)`:
  - sin `space` → hogar = General del usuario (privado, write libre).
  - con `space` colectivo → exige `role ≥ contributor` **y** `Grant.canWrite` de la
    conexión. Si no, error. El hogar de la memoria es ese Space; `author_id` = el
    usuario de la conexión.
- Subida de archivos a un colectivo → mismo chequeo `role ≥ contributor`.

## Lectura: `resolveReadableSpaces` se completa

En [15](15-frontier-hardening.md) la función devolvía `grants`. Ahora intersecta con
la **membresía del usuario**:

```
resolveReadableSpaces(connection):
  grants      = spaces concedidos a la conexión
  memberSpaces= spaces donde connection.user es SpaceMember
  return grants ∩ memberSpaces        # un grant a un space del que ya no eres miembro no vale
```

- `savia_search(query, spaces?)`: `effective = (spaces ?? readable) ∩ readable`.
  Un colectivo se lee igual que un space privado — el filtro `space_id ANY effective`
  no distingue. La frontera única hace que "compartir" no requiera código nuevo de
  lectura.

## Drive compartido (archivos)

- `File.spaceId` (de [14](14-spaces-unification.md)) ya permite que un archivo viva
  en un Space. Para colectivos:
  - Prefijo S3 `spaces/{spaceId}/{uuid}-{name}` (en vez de `users/{userId}/…`).
  - `presign`/`create` aceptan `spaceId`; chequeo `role ≥ contributor`.
  - `GET /files?spaceId=` lista por Space; ACL = **membresía** del Space (cualquier
    miembro descarga; solo `contributor+` sube; `admin` o el autor borra).
- La ingesta escribe memorias con `homeSpaceId = file.spaceId` y `author_id`.

## Promoción: de Space personal a colectivo

Dos caminos de creación de colectivo:

1. **Colectivo vacío**: `POST /spaces { kind: collective, … }` + invitaciones.
2. **Desde un Space personal** (lo más potente del modelo único):
   - **Mover** (default): el Space privado **pasa a** `kind=collective` y se añaden
     miembros. **Cero movimiento de datos** — tú lo sigues viendo por membresía.
     Las conexiones tuyas con grant a ese Space pero sin grant explícito tras la
     conversión: avisar en UI (su visibilidad cambia de contexto).
   - **Copiar** (opción): se crea un colectivo nuevo y se **re-hogan copias** de
     las memorias seleccionadas (original queda privado). Útil si quieres conservar
     un fork privado. Coste: duplicación.
   - **Regla dura**: nunca se promueve el Space **General/personal completo** (sería
     fuga total). Solo un Space temático o una selección curada.

## Re-auditoría de grants (riesgo de escalada)

> Un `Grant` que en el MVP solo exponía *lo propio* (doble-gateado por `user_id`),
> en un Space que se vuelve colectivo ahora expone *lo de otros miembros*.

- Al convertir un Space a colectivo, **re-confirmar cada grant existente** sobre él
  (UI: "estas IAs verán ahora también lo que aporten los demás — ¿confirmas?").
- `addGrant` se autoriza por **membresía admin** del Space (no por `space.ownerUserId`).

## Endpoints (backend)

```
POST   /spaces/:id/make-collective            # admin: kind private→collective
POST   /spaces/:id/invites { email, role }    # admin
POST   /invites/:token/accept                 # invitado autenticado
GET    /spaces/:id/members                     # miembros + roles
PATCH  /spaces/:id/members/:userId { role }    # admin
DELETE /spaces/:id/members/:userId             # admin → invalida caché de sus conexiones (step 15)
POST   /spaces/from-personal { sourceSpaceId, mode: move|copy, members[] }
```

Cada operación de gestión exige rol `admin`; escritura exige `contributor+`.

## Contracts (`packages/contracts/src/`)

```ts
export const SpaceRoleSchema = z.enum(['viewer', 'contributor', 'admin'])
export const SpaceKindSchema = z.enum(['private', 'collective'])

// SpaceDto gana: kind, role (del usuario actual), memberCount
export const SpaceMemberDtoSchema = z.object({
  userId: z.string(), email: z.string(), role: SpaceRoleSchema,
})
export const InviteSchema = z.object({
  email: z.string().email(), role: SpaceRoleSchema,
})
export const PromoteSpaceSchema = z.object({
  sourceSpaceId: z.string(),
  mode: z.enum(['move', 'copy']),
  members: z.array(InviteSchema),
})
// McpRememberInputSchema gana: space?: z.string()
// Grant/connections: canWrite?: boolean en la asignación de grants
```

## Frontend (`apps/app/src/`)

- **Vista de Space**: badge privado/colectivo, lista de miembros + roles, botón
  "Compartir" (→ invitar) y "Convertir en colectivo".
- **Drive por Space**: el [drive](04-files-drive.md) se filtra por Space; en uno
  colectivo se ve quién subió cada archivo (`author`/`uploader`).
- **Compartir un space personal**: diálogo con `mode: move|copy` + invitar miembros,
  con la advertencia de re-auditoría de grants.
- **Aceptar invitación**: pantalla `/invites/:token`.
- `SpaceControlPanel` ([08](08-connections-grants.md)): los grants a spaces
  colectivos muestran el toggle `canWrite`.

## Verificación

1. `make-collective` sobre un Space privado → `kind=collective`; el creador es
   `admin`; cero memorias movidas.
2. Invitar a B como `contributor` → B acepta → B ve las memorias del Space en
   `savia_search` (vía membresía) y puede `savia_remember(space)`.
3. Invitar a C como `viewer` → C lee pero `savia_remember(space)` de C → error.
4. B sube un archivo al Space → se ingiere con `homeSpaceId` del Space y
   `author_id=B`; A y C lo consultan; el original `author` se ve en el drive.
5. **Salida de miembro**: A expulsa a B → la caché de **todas** las conexiones de B
   se invalida (step 15) → B deja de leer de inmediato; **los aportes de B se
   quedan** en el Space (`author_id` preservado).
6. **Promoción desde personal (move)**: convertir "Trabajo" (privado) → colectivo;
   las memorias **no se mueven**; A las sigue viendo; los nuevos miembros también.
7. **Regla dura**: intentar promover el Space **General** → rechazado.
8. **Re-auditoría**: un grant previo a "Trabajo" se marca para re-confirmación al
   convertirlo en colectivo.
9. **Frontera**: una conexión con grant a un colectivo del que el usuario fue
   expulsado → `resolveReadableSpaces` lo excluye (grant ∩ membresía).
