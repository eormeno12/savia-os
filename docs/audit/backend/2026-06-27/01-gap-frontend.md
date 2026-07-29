# 01 — Gap frontend ↔ backend

> **Estado:** describe el **código actual** (sin cambios desde la auditoría). Estos hallazgos son **criterios de aceptación** del rebuild en [`08`](08-plan-end-to-end.md), no un backlog de parches sobre el código viejo. La capa de rutas/contrato objetivo está en [`05`](05-rediseno-estructural.md).

Contrato fuente: [`apps/app/src/lib/api.ts`](../../../../apps/app/src/lib/api.ts).
Contrato canónico: `packages/contracts/src/*` (`@savia-os/contracts`).
Backend: `apps/api/src/modules/**`.

Convención de la columna **Estado**:
`✅ OK` shape compatible · `⚠️ drift` el endpoint existe pero el shape/tipo difiere · `🔶 vacío` responde pero con datos sin hidratar · `❌ falta` el front lo usa y el backend no lo implementa.

---

## A. Método de `api.ts` → endpoint → shape

### Auth

| `api.ts` | Endpoint backend | Estado | Nota |
|---|---|---|---|
| `requestOtp(email)` → `{message}` | `POST /auth/request-otp` [auth.controller.ts:16](../../../../apps/api/src/modules/auth/auth.controller.ts#L16) | ✅ OK | IP de `x-forwarded-for` (spoofeable, ver `02-SEC-3`). |
| `verifyOtp(email,code)` → `{id,email,createdAt}` | `POST /auth/verify-otp` [auth.controller.ts:24](../../../../apps/api/src/modules/auth/auth.controller.ts#L24) | ✅ OK | Setea cookies access(15m)+refresh(30d). |
| `logout()` → `{message}` | `POST /auth/logout` [auth.controller.ts:38](../../../../apps/api/src/modules/auth/auth.controller.ts#L38) | ⚠️ drift | Sólo limpia cookies; **no revoca** el refresh (sigue válido 30d). |
| `me()` → `{id,email}` | `GET /auth/me` [auth.controller.ts:45](../../../../apps/api/src/modules/auth/auth.controller.ts#L45) | ✅ OK | |
| *(ninguno)* | `POST /auth/refresh` [auth.controller.ts:30](../../../../apps/api/src/modules/auth/auth.controller.ts#L30) | 🟠 **huérfano** | El front **nunca llama refresh** (no hay interceptor 401 ni caller en `api.ts`/`middleware.ts`). El access token expira a los 15 min → 401 sin recuperación. Ver "Endpoints huérfanos". |

### Files

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `files.presign(name,mime,size)` | `POST /files/presign` [files.controller.ts:16](../../../../apps/api/src/modules/files/files.controller.ts#L16) | ✅ OK | Valida mime/size en server. |
| `files.create(...)` → `{id}` | `POST /files` [files.controller.ts:21](../../../../apps/api/src/modules/files/files.controller.ts#L21) | ⚠️ drift menor | El front tipa `{id}` pero el server devuelve la fila File completa ([files.service.ts:44](../../../../apps/api/src/modules/files/files.service.ts#L44)). Inocuo. |
| `files.list()` | `GET /files` [files.controller.ts:26](../../../../apps/api/src/modules/files/files.controller.ts#L26) | ✅ OK | `memoryCount` incluido. |
| `files.delete(id)` | `DELETE /files/:id` [files.controller.ts:36](../../../../apps/api/src/modules/files/files.controller.ts#L36) | ✅ OK | User-scoped (`findFirst {id,userId}`). |

### Spaces

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `spaces.create(description)` → `SpaceDto` | `POST /spaces` [spaces.controller.ts:31](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L31) | ⚠️ **drift de tipo** | El server devuelve `{…,kind,isDefault,role}` **sin** `version`; el `SpaceDto` del front declara `version` y omite `kind/isDefault/role`. Ver §C. |
| `spaces.list()` → `SpaceDto[]` | `GET /spaces` [spaces.controller.ts:39](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L39) | ⚠️ drift de tipo | Igual que arriba. **Esto es lo que rompe el listado de colectivos**, no un dato faltante. |
| `spaces.update(id,{desc,name})` → `SpaceDto` | `PATCH /spaces/:id` [spaces.controller.ts:44](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L44) | ⚠️ drift de tipo | Requiere rol `admin`. |
| `spaces.delete(id)` | `DELETE /spaces/:id` [spaces.controller.ts:53](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L53) | ✅ OK | Bloquea borrar General; re-homea huérfanos. |
| `spaces.memories(id,cursor,limit)` → `SpaceMemoryDto[]` | `GET /spaces/:id/memories` [spaces.controller.ts:59](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L59) | 🔶 **vacío** | Devuelve `text:''` y `otherSpaces:[]` **siempre** ([spaces.service.ts:143-149](../../../../apps/api/src/modules/spaces/spaces.service.ts#L143-L149)). El texto vive en Qdrant y no se hidrata. El tipo del front omite `homeSpaceId` (que el contrato sí trae). |
| `spaces.removeMemory(spaceId,memId)` | `DELETE /spaces/:id/memories/:memoryId` [spaces.controller.ts:69](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L69) | ⚠️ semántico | "Quitar" = re-homear al General del usuario. Sin check de autor en colectivos (`02-AUTHZ-2`). |
| `spaces.addMemory(spaceId,memId)` | `POST /spaces/:id/memories/:memoryId` [spaces.controller.ts:79](../../../../apps/api/src/modules/spaces/spaces.controller.ts#L79) | ✅ OK | Sólo memorias propias (`{memoryId,userId}`). |

### Connections

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `connections.create(label)` → `ConnectionCreateResponse` | `POST /connections` [connections.controller.ts:28](../../../../apps/api/src/modules/connections/connections.controller.ts#L28) | ✅ OK | Devuelve `token` en claro una sola vez. |
| `connections.list()` → `ConnectionDto[]` | `GET /connections` [connections.controller.ts:36](../../../../apps/api/src/modules/connections/connections.controller.ts#L36) | ✅ OK | `spaceIds` desde grants. |
| `connections.revoke(id)` | `DELETE /connections/:id` [connections.controller.ts:41](../../../../apps/api/src/modules/connections/connections.controller.ts#L41) | ✅ OK | User-scoped + invalida cache. |
| `connections.addGrant(connId,spaceId)` | `POST /connections/:id/grants` [connections.controller.ts:47](../../../../apps/api/src/modules/connections/connections.controller.ts#L47) | ✅ OK | Verifica ownership de conn **y** membership del space. |
| `connections.removeGrant(connId,spaceId)` | `DELETE /connections/:id/grants/:spaceId` [connections.controller.ts:57](../../../../apps/api/src/modules/connections/connections.controller.ts#L57) | ✅ OK | |

### Growth

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `growth.areas()` → `AreaDto[]` | `GET /growth/areas` [growth.controller.ts:11](../../../../apps/api/src/modules/growth/growth.controller.ts#L11) | ⚠️ incompleto | `AreaDto = {spaceId,name,count,share}`. Faltan `isDefault/kind/role/lastSeen/sensitivity/peek` que pide MemoryMap (ver §B). |
| `growth.summary(range)` → `GrowthSummary` | `GET /growth?range=` [growth.controller.ts:16](../../../../apps/api/src/modules/growth/growth.controller.ts#L16) | ⚠️ sin validación | `range` se lee inline sin enum pipe (default `week`). Shape OK. |
| `growth.accessActivity()` → `AccessActivity[]` | `GET /growth/access-activity` [growth.controller.ts:25](../../../../apps/api/src/modules/growth/growth.controller.ts#L25) | ✅ OK | Pulso usa esto; faltan eventos "ricos" tipados (ver §B Pulso). |

### Onboarding

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `onboarding.rescuePrompt()` → `{prompt}` | `GET /onboarding/rescue-prompt` [onboarding.controller.ts:19](../../../../apps/api/src/modules/onboarding/onboarding.controller.ts#L19) | ✅ OK | Constante. |
| `onboarding.ingestRescue(text)` → `{count}` | `POST /onboarding/rescue` [onboarding.controller.ts:24](../../../../apps/api/src/modules/onboarding/onboarding.controller.ts#L24) | ⚠️ funcional | Agrega memoria **sin clasificar** → `homeSpaceId=null` → invisible en search hasta backfill futuro (`02-FUNC-1`). |
| `onboarding.importChatGpt(content)` → `{queued}` | `POST /onboarding/import/chatgpt` [onboarding.controller.ts:32](../../../../apps/api/src/modules/onboarding/onboarding.controller.ts#L32) | ⚠️ funcional | Dice `queued` pero corre **in-process** fire-and-forget ([onboarding.service.ts:46-54](../../../../apps/api/src/modules/onboarding/onboarding.service.ts#L46-L54)). Sin cola/reintento; memorias sin clasificar. |
| `onboarding.suggestSpaces()` → `SuggestedSpace[]` | `GET /onboarding/suggest-spaces` [onboarding.controller.ts:40](../../../../apps/api/src/modules/onboarding/onboarding.controller.ts#L40) | ✅ OK | Clustering por embeddings. |

### Memory

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `memory.search(query,{spaceIds,limit})` → `MemoryResult[]` | `POST /memory/search` [memory.controller.ts:29](../../../../apps/api/src/modules/memory/memory.controller.ts#L29) | ✅ OK | Clamp a member spaces (default-deny correcto). |
| `memory.delete(id)` | `DELETE /memory/:id` [memory.controller.ts:46](../../../../apps/api/src/modules/memory/memory.controller.ts#L46) | 🔴 **IDOR P0** | Sin check de propiedad → borra cualquier memoria por id. Ver `02-P0-1`. |
| *(ninguno)* | `POST /memory/add` [memory.controller.ts:20](../../../../apps/api/src/modules/memory/memory.controller.ts#L20) | 🟠 huérfano | El front no lo usa (memorias se crean vía files/onboarding/mcp). |

### Collective

| `api.ts` | Endpoint | Estado | Nota |
|---|---|---|---|
| `makeCollective(spaceId)` → `SpaceDto` | `POST /spaces/:id/make-collective` [collective.controller.ts:37](../../../../apps/api/src/modules/collective/collective.controller.ts#L37) | ⚠️ **mismatch de retorno** | El handler responde **204 / void** (no devuelve `SpaceDto`). El front tipa `SpaceDto` → recibirá vacío. |
| `fromPersonal(sourceSpaceId,name)` → `SpaceDto` | `POST /spaces/from-personal` [collective.controller.ts:49](../../../../apps/api/src/modules/collective/collective.controller.ts#L49) | ⚠️ **mismatch de body + retorno** | El server espera `{sourceSpaceId, mode:'move'|'copy', members[]}` y devuelve `{spaceId}`; el front envía `{sourceSpaceId,name}` y espera `SpaceDto`. **Body incompatible** → fallará validación Zod (falta `mode`/`members`). |
| `invite(spaceId,email,role)` → `{token}` | `POST /spaces/:id/invites` [collective.controller.ts:59](../../../../apps/api/src/modules/collective/collective.controller.ts#L59) | ⚠️ mismatch de retorno | El handler responde **204/void**; el front espera `{token}`. El token va por email, no en el body. |
| `acceptInvite(token)` → `{spaceId}` | `POST /invites/:token/accept` [collective.controller.ts:69](../../../../apps/api/src/modules/collective/collective.controller.ts#L69) | ⚠️ drift menor | El server devuelve `{spaceId, role}`; el front tipa sólo `{spaceId}`. Compatible. |
| `members(spaceId)` → `CollectiveMember[]` | `GET /spaces/:id/members` [collective.controller.ts:76](../../../../apps/api/src/modules/collective/collective.controller.ts#L76) | ⚠️ drift | El server devuelve `{userId,email,role}` (sin `joinedAt`); el front tipa `joinedAt: string` → `undefined` en runtime. |
| `setRole(spaceId,userId,role)` → `CollectiveMember` | `PATCH /spaces/:id/members/:userId` [collective.controller.ts:81](../../../../apps/api/src/modules/collective/collective.controller.ts#L81) | ⚠️ mismatch de retorno | El handler responde **void**; el front espera `CollectiveMember`. |
| `removeMember(spaceId,userId)` | `DELETE /spaces/:id/members/:userId` [collective.controller.ts:91](../../../../apps/api/src/modules/collective/collective.controller.ts#L91) | ✅ OK | Admin-only; no auto-expulsión. |
| `grantWrite(connId,spaceId,canWrite)` → `{ok}` | `PATCH /connections/:connectionId/grants/:spaceId/write` [collective.controller.ts:103](../../../../apps/api/src/modules/collective/collective.controller.ts#L103) | ⚠️ drift de retorno | El handler responde **void**; el front espera `{ok:boolean}`. |

---

## B. Inventario de stubs / `TODO(backend)` y capacidad faltante

| Capacidad | Dónde (front) | Estado actual | Backend necesario |
|---|---|---|---|
| **Búsquedas guardadas (M4)** | [lib/saved-searches.ts:4](../../../../apps/app/src/lib/saved-searches.ts#L4) | 100% `localStorage` | `GET/POST/DELETE /saved-searches` + modelo `SavedSearch{userId,query,label,count,createdAt}`. |
| **Suscripción / freemium (SB1)** | [lib/use-subscription.ts:9](../../../../apps/app/src/lib/use-subscription.ts#L9), `billing/subscription-gate.tsx:31,38` | `localStorage` falsificable; Mercado Pago sin cablear | `GET /subscription` + `POST /subscription/checkout` (URL MP) + webhook de MP + modelo `Subscription`. |
| **Bandeja: invitaciones** | `bandeja/bandeja-screen.tsx:62` | No mostradas | `GET /invites?pending=true` → invites donde `email = user.email`, `acceptedAt=null`, no expiradas. **El modelo `CollectiveInvite` ya existe**; falta el endpoint de listado para el invitado. |
| **Bandeja: procesos / jobs** | `bandeja/bandeja-screen.tsx:62` | No mostrados | `GET /jobs` con estado de ingest/import (BullMQ ya tiene progreso por job). |
| **Bandeja: hitos** | `bandeja/bandeja-screen.tsx:62` | No mostrados | Derivable de `GrowthEvent` (p.ej. "1k recuerdos en X"). Endpoint nuevo. |
| **Cuenta: exportar memoria (CT3)** | `cuenta/cuenta-screen.tsx:99` | Botón "próximamente" | `POST /account/export` (job → S3 presigned). |
| **Cuenta: borrar cuenta (CT4)** | `cuenta/cuenta-screen.tsx:129` | Botón "próximamente" | `POST /account/delete` (borra User + cascada Qdrant). Requiere cascadas que hoy faltan, ver `03`. |
| **Pulso: eventos ricos + Recientes (P1)** | `pulso/pulso-screen.tsx:160` | Sólo "consultó N veces" | `GET /growth/events?cursor` con `type: read\|contribute\|reorganize\|revert` + `spaceId,count,ts`. `AccessLog` ya tiene `action`/`resultCount`. |
| **MemoryMap: default/sensibilidad/lastSeen/peek (M1)** | `memory/use-memory-data.ts`, `memory/memory-list.tsx:52` | Heurística `name==='general'`; columnas faltan | Extender `AreaDto` con `isDefault,kind,role,lastSeen,sensitivity` + `GET /spaces/:id/sample?n=3` para el peek. |
| **Colectivo: filtrar por kind/role (CO1)** | `colectivo/page.tsx:13` | Muestra todos los spaces | **Ya resuelto en backend** (`SpaceDto.kind/role`); falta que el front consuma `@savia-os/contracts` en vez del `SpaceDto` local. |
| **M6: Mover de área** | `memory/memory-detail-dialog.tsx:129` | Botón deshabilitado | Endpoints `add/removeMemory` **existen**; sólo falta cablear UI. |
| **M6: Marcar sensible** | `memory/memory-detail-dialog.tsx:129` | Botón deshabilitado | Campo `sensitivity` en `MemoryIndex` + `PATCH /memory/:id` + exponerlo en `MemoryResult`/`SpaceMemoryDto`. |
| **Revert de growth events** | `pulso/pulso-screen.tsx:160` | Sólo `memory.delete` | `POST /growth/events/:id/revert` (orquesta deletes/re-homes) o eventos tipados reversibles. |

---

## C. Drift de contrato `SpaceDto` (el hallazgo central del gap)

| Campo | `@savia-os/contracts` `SpaceDtoSchema` ([spaces.ts:17](../../../../packages/contracts/src/spaces.ts#L17)) | Lo que devuelve el server ([spaces.service.ts:253](../../../../apps/api/src/modules/spaces/spaces.service.ts#L253)) | `SpaceDto` local del front ([api.ts:209](../../../../apps/app/src/lib/api.ts#L209)) |
|---|---|---|---|
| `kind` | ✅ `'private'\|'collective'` | ✅ lo envía | ❌ **no declarado** |
| `role` | ✅ `viewer\|contributor\|admin` | ✅ lo envía | ❌ **no declarado** |
| `isDefault` | ✅ boolean | ✅ lo envía | ❌ no declarado |
| `version` | ❌ no existe | ❌ no lo envía | ⚠️ **declarado** → siempre `undefined` |

**Implicación:** el dato que la pantalla Colectivo necesita (`kind`/`role`) **ya viaja en el JSON**. El bug es que el front mantiene una interfaz `SpaceDto` propia y obsoleta en vez de importar la de `@savia-os/contracts`. Fix = borrar el `SpaceDto` local y reexportar el del paquete de contratos. Lo mismo aplica a `SpaceMemoryDto` (falta `homeSpaceId`), `CollectiveMember` (sobra `joinedAt`).

---

## D. Endpoints huérfanos (backend sin consumidor en `api.ts`)

| Endpoint | Por qué | Acción |
|---|---|---|
| `POST /auth/refresh` | El front no implementa rotación de sesión → access token muere a los 15 min. | **Cablear** un interceptor 401→refresh en `api.ts`, o el endpoint es muerto y la sesión es de 15 min. (P1 funcional) |
| `POST /memory/add` | Memorias se crean por files/onboarding/mcp; el front nunca añade memoria suelta. | Mantener (lo usan tests/otros) o documentar como interno. |

## E. Endpoints "rotos" (front llama, backend no cumple el contrato)

1. **`collective.fromPersonal`** — body incompatible: el front manda `{sourceSpaceId,name}`, el server exige `{sourceSpaceId, mode, members[]}` con Zod. **Llamada falla con 400.** (Contrato roto.)
2. **`collective.makeCollective` / `invite` / `setRole` / `grantWrite`** — el front espera cuerpos (`SpaceDto`/`{token}`/`CollectiveMember`/`{ok}`) que los handlers devuelven como **204/void**. No rompe la operación, pero el front recibe `undefined` donde tipa un objeto.
3. **`spaces.memories`** — responde con `text:''`: la lista de recuerdos de un space se ve **sin texto**. (Contrato cumplido en forma, vacío en fondo.)

> Estos mismatches de colectivo sugieren que el front de Colectivo se escribió contra un contrato *previsto* y el backend evolucionó a otro (204 + token por email). Reconciliar `api.ts` con los handlers reales (rutas objetivo en `05 §3`).
