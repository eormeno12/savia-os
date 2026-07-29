# 05 — Capa de producto sobre la base de `08` (modelos faltantes · rutas · cobertura)

> **`08` es la BASE** (memoria/áreas/acceso/federación: **multi-membership**, mem0-sidecar, write-kernel, outbox, motor dinámico). Este doc cubre **solo lo que `08` no toca**: los **modelos de producto restantes**, el **ciclo de vida de cuenta**, el **mapa de rutas completo** y la **matriz de cobertura** — todo **reconciliado al modelo de `08`**.
>
> **Qué reemplaza:** el modelo **core** (Space/MemoryIndex/Grant/Lens/Connection/AccessLog/AuthSession + acceso + outbox) y el **colectivo** → **ver `08`** (federación, no contenedor). El **plan de parches `04`** fue **retirado** (con el rebuild, construir bien vuelve moot el parche; los hallazgos viven en `02`). **Billing** → detalle en [`09-modulo-pagos.md`](09-modulo-pagos.md).
>
> **Alineado con `08`:** acceso por **`savia_area_ids ANY`** (multi-membership, no `path_ids` single-home); colectivo = **grupo + fragmentos** (no `Space(scope=collective)`).

---

## 1. Modelos de producto que complementan a `08 §2`

> El **core** ya está en [`08 §2`](08-plan-end-to-end.md): `User, AuthSession, Space, MemoryIndex, Lens, Connection, Grant, CollectiveGroup, GroupMember, FragmentShare, MemoryEvent, OutboxEvent, AccessLog`. Acá **solo** lo que `08` no incluye.

```prisma
enum FileStatus       { pending processing indexed failed }
enum SuggestionKind   { new_area split merge move duplicate }   // motor dinámico (08 §4)
enum SuggestionStatus { pending accepted dismissed }
enum NotificationKind { invite suggestion job milestone member_joined }
enum JobType          { ingest_file import_chatgpt rescue backfill account_export account_delete }
enum JobStatus        { queued running done failed }
enum SubStatus        { free active past_due canceled }
// GroupRole se define en 08 §2.

// Drive: un archivo vive en un ÁREA (Space). Su ingesta produce memorias con membership.
model File {
  id String @id @default(uuid())
  spaceId String                       // el área donde se archiva
  uploaderUserId String                // provenance (= user_id de mem0)
  name String  mimeType String  sizeBytes Int
  s3Key String                         // spaces/{spaceId}/{uuid}-{name}
  status FileStatus @default(pending)  error String?  source String @default("upload")
  createdAt DateTime @default(now())  indexedAt DateTime?
  @@index([spaceId])  @@index([uploaderUserId])
}

// Invitación a un GRUPO colectivo (federación) — reemplaza la invitación a un space.
model GroupInvite {
  id String @id @default(uuid())
  groupId String                       // → CollectiveGroup (08 §2)
  email String  role GroupRole
  invitedByUserId String
  tokenHash String  tokenLookup String @unique     // HMAC → accept O(1)
  expiresAt DateTime  acceptedAt DateTime?  createdAt DateTime @default(now())
  @@index([email, acceptedAt])         // "mis invitaciones pendientes" (Bandeja)
}

model OtpCode {
  id String @id @default(uuid())
  email String  codeHash String  expiresAt DateTime
  attempts Int @default(0)  consumedAt DateTime?  createdAt DateTime @default(now())
  @@index([email])  @@index([expiresAt])   // habilita el cron de purga (02-D4)
}

// Cola de propuestas del motor dinámico (08 §4): el ML PROPONE reorg; el usuario acepta/descarta.
model Suggestion {
  id String @id @default(uuid())
  userId String  kind SuggestionKind  status SuggestionStatus @default(pending)
  payload Json                         // {memoryIds, área propuesta, …} para aplicar al aceptar
  rationale String  createdAt DateTime @default(now())
  @@index([userId, status])
}

// Superficie de procesos para la Bandeja (correlación con BullMQ).
model Job {
  id String @id @default(uuid())
  userId String  type JobType  status JobStatus @default(queued)
  progress Int @default(0)  total Int?  bullJobId String?  resultRef String?  error String?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  @@index([userId, status])
}

// Bandeja unificada (polimórfica): invitaciones + sugerencias + jobs + hitos.
model Notification {
  id String @id @default(uuid())
  userId String  kind NotificationKind  refId String?  data Json
  seenAt DateTime?  createdAt DateTime @default(now())
  @@index([userId, seenAt])  @@index([userId, createdAt])
}

// Billing (detalle en 09-modulo-pagos.md).
model Subscription {
  id String @id @default(uuid())
  userId String @unique  status SubStatus @default(free)  plan String?
  externalRef String?                  // preapproval_id de Mercado Pago
  currentPeriodEnd DateTime?  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
}
```

---

## 2. Ciclo de vida de cuenta (`08` no lo cubre)

La **federación** hace el borrado/salida limpios por construcción: tus memorias **nunca estuvieron** en un contenedor compartido; al borrarte, tus fragmentos dejan de compartirse y tus memorias se van **con vos**.

- **`POST /account/delete`** → encola `Job(account_delete)`:
  1. Por cada **grupo** donde sos **único admin** → transferir admin (miembro más antiguo) o marcar el grupo para cierre.
  2. Borrar tus `FragmentShare` (tu contenido deja de verse en los grupos).
  3. Borrar tus `Space` (áreas) → cascade.
  4. `OutboxEvent(purge)` → borrar vectores por `user_id` en Qdrant (08 §3/§7).
  5. Borrar `User` → cascade (connections, lenses, sessions, notifications, jobs, subscription, memberships).
- **`POST /account/export`** → `Job(account_export)`: arma JSON/NDJSON (áreas, memorias con **texto desde Qdrant**, archivos, conexiones) → sube a S3 → `Job.resultRef` = presigned URL; notifica vía `Notification(job)`.

---

## 3. Mapa de rutas (lo que el front consume) — reconciliado a `08`

Contrato canónico: **`@savia-os/contracts`** (el front **deja de redeclarar DTOs**; cierra el drift de `01 §C`). `🆕` nueva · `♻️` reconciliada con `api.ts` · `✅` existe y queda.

### Auth
| | Ruta | Notas |
|---|---|---|
| ✅ | `POST /auth/request-otp · /verify-otp · /logout` · `GET /me` | `verify-otp` crea `AuthSession`. |
| ♻️ | `POST /auth/refresh` | **rota** la sesión (revoca la anterior); el front añade interceptor 401→refresh (cierra "sesión 15 min"). |

### Áreas (árbol · multi-membership)
| | Ruta | Notas |
|---|---|---|
| 🆕 | `GET /areas/tree` | árbol anidado para el MemoryMap zoomable. |
| ♻️ | `GET /areas` | nodos del árbol + conteos. **Los conteos solapan** (Venn; total = `count distinct`). |
| ✅ | `POST /areas {description}` · `PATCH /areas/:id` · `DELETE /areas/:id` | editar ⇒ `governance=manual`; borrar re-asigna membership al padre/General. |
| ♻️ | `GET /areas/:id/memories?cursor` | **miembros del área** (`savia_area_ids ANY [id]`), texto **hidratado desde Qdrant**, cursor `[createdAt,memoryId]`. |
| 🆕 | `GET /areas/:id/sample?n=3` | peek del mapa. |

### Memoria (multi-membership)
| | Ruta | Notas |
|---|---|---|
| ✅ | `POST /memory/search` | **`mem0.search` híbrido** (dense+BM25+entidades+rerank) con filtro de acceso (08 §6). |
| 🔒♻️ | `DELETE /memory/:id` | `AccessService.assertCanMutateMemory` (autor o admin de un área de su membership) — cierra **P0-1**. |
| 🆕 | `PATCH /memory/:id {sensitivity?, addAreas?, removeAreas?}` | editar **membership** (agregar/quitar de áreas) y sensibilidad (M6) — ya no es "mover home". |

### Lentes (M4 + capa 2)
| | Ruta | Notas |
|---|---|---|
| 🆕 | `GET/POST/DELETE /lenses` | sustituye `localStorage` de `saved-searches.ts`. `POST {name, query}` calcula `anchor`. |
| 🆕 | `GET /lenses/:id/memories` | evalúa el predicado en Qdrant (membresía dinámica). |

### Conexiones IA + grants
| | Ruta | Notas |
|---|---|---|
| ✅ | `POST /connections` · `GET /connections` · `DELETE /connections/:id` | token una vez; `tokenLookup` O(1). |
| 🆕 | `POST/DELETE /connections/:id/grants {scope: area\|lens\|group, …}` | conceder **un área** (subárbol vía `area_ids`), **una lente** o **un grupo**; con **preview** de qué expone (= el highlight del mapa, 08 §6.5). |

### Colectivo (FEDERACIÓN — reemplaza el contenedor)
| | Ruta | Notas |
|---|---|---|
| 🆕 | `POST /groups {name, topicLens?}` | crear un grupo colectivo. |
| 🆕 | `POST /groups/:id/fragments {areaId\|lensId}` | **compartir un fragmento** (un miembro comparte su área/lente). |
| 🆕 | `DELETE /groups/:id/fragments/:fragmentId` | dejar de compartir (tu fragmento se va con vos). |
| ♻️ | `POST /groups/:id/invites {email, role}` · `POST /invites/:token/accept` | admin invita → `GroupMember`; `tokenLookup` ⇒ accept O(1). |
| ✅ | `GET /groups/:id/members` · `PATCH/DELETE /groups/:id/members/:userId` | gestionar miembros (admin). |
| 🆕 | `GET /groups/:id/memories` | la **vista unión viva** (fan-out de búsqueda por fragmento, 08 §5.2). |

> *Reemplaza* el `make-collective` / `from-personal{mode}` del contenedor por: **crear grupo + compartir esa área como fragmento**.

### Drive
| | Ruta | Notas |
|---|---|---|
| ♻️ | `POST /files/presign · /files {areaId}` | key `spaces/{areaId}/…`; ACL por membership; subir exige `contributor+` si el área es fragmento compartido. |
| ♻️ | `GET /files?areaId=` · `GET/DELETE /files/:id` | muestra `uploader`. |

### Pulso (growth)
| | Ruta | Notas |
|---|---|---|
| ✅ | `GET /growth/areas` | `AreaDto` con `lastSeen` derivado; conteos **solapados** (multi-membership). |
| ✅ | `GET /growth?range=` | (validar enum). |
| 🆕 | `GET /growth/events?cursor` · `POST /growth/events/:id/revert` | feed tipado desde `MemoryEvent`; revert vía `revertPayload`. |
| ✅ | `GET /growth/access-activity` | |

### Bandeja (Notification)
| | Ruta | Notas |
|---|---|---|
| 🆕 | `GET /inbox?unseen=` · `POST /inbox/:id/seen` | proyección de `Notification` (invite + suggestion + job + milestone) → badge. |
| 🆕 | `GET /jobs` · `GET /jobs/:id` | procesos (import/export/backfill). |
| 🆕 | `GET /suggestions` · `POST /suggestions/:id/(accept\|dismiss)` | cola del motor dinámico (08 §4). |

### Cuenta / Billing
| | Ruta | Notas |
|---|---|---|
| 🆕 | `POST /account/export · /account/delete` | §2 (Job + purga Qdrant). |
| 🆕 | `GET /subscription · POST /subscription/checkout · POST /webhooks/mercadopago` | **detalle en [`09`](09-modulo-pagos.md)**. |

---

## 4. Matriz de cobertura — hallazgo (01/02/03) → cómo se cierra → ruta

| Hallazgo / capacidad | Cierra (modelo de `08` salvo nota) | Ruta |
|---|---|---|
| **P0-1** IDOR delete | `AccessService.assertCanMutateMemory` + guard global (08 §6) | `DELETE /memory/:id` |
| **P0-2** atomicidad cross-store | write-kernel + outbox (08 §3/§6/§7) | (interno) |
| **P0-3** queryHash | `AccessLog.queryDigest` SHA-256 | `savia_search` |
| **SEC-1** refresh | `AuthSession` (familia+revoke, 08 §2) | `POST /auth/refresh` |
| **SEC-2** guard opt-in | `APP_GUARD` + `@Public()` (08 §6) | todas |
| **SEC-3/4/6/7 · OBS-1 · ERR-2/3** hardening | **fase transversal de `08`** (helmet, throttler, env-validation, OpenAI retry, health…) | — |
| **AUTHZ-2/3/4** | `assertCan*` (08 §6) | grants, drive, memories |
| **INT-1..7** colas/integridad | outbox + `jobId` determinista + `worker.close` + `Job` (08 §3/§7) | ingest, import |
| **D-1/D-2/D-3/D-4** schema | cascadas (08 §2), `account_delete` (§2), cursor `[createdAt,memoryId]`, `OtpCode @@index([expiresAt])` (§1) | `DELETE /areas`, `/account/delete` |
| **Gap `SpaceDto`/`text:''`/mismatches** | front consume `@savia-os/contracts`; texto hidratado de Qdrant | `GET /areas`, `/areas/:id/memories` |
| **Stub búsquedas guardadas** | `Lens` (08 §2) | `/lenses` |
| **Stub suscripción** | `Subscription` + webhook MP | `/subscription` ([`09`](09-modulo-pagos.md)) |
| **Bandeja invites/procesos/hitos** | `Notification` + `Job` + `Suggestion` (§1) | `/inbox`, `/jobs`, `/suggestions` |
| **Cuenta export/delete** | §2 | `/account/*` |
| **Pulso eventos ricos + revert** | `MemoryEvent` (08 §2) | `/growth/events` |
| **MemoryMap multi-área / colectivo** | áreas multi-membership + federación (08) | `/areas/tree`, `/groups/*` |
| **Índice dinámico (17)** | motor de `08 §4` + `Suggestion` | `/suggestions` |

**Todos los hallazgos de `01`/`02`/`03` quedan cubiertos por la base de `08` + estos modelos de producto**, no por endpoints sueltos.

---

## 5. Relación con la auditoría

- **`01`/`02`/`03`** = hallazgos del **código actual** (sin cambios) → criterios de aceptación.
- **`08`** = la **base** (organización dinámica de memoria/áreas/acceso/federación).
- **`05`** (este doc) = la **capa de producto** sobre la base (modelos faltantes, cuenta, rutas, cobertura).
- **`09`** = el módulo de **pagos** (Mercado Pago).
- **`04`/`06`/`07`** = **retirados** (parches / borradores de clustering superseded).

**Orden de ejecución** (base antes que features): ver [`08 §9`](08-plan-end-to-end.md) (P0 substrato → P1 árbol+acceso → P2 búsqueda mem0 → P3 motor+mapa → P4 federación → P5 evolución → P6 profundidad), con la **fase transversal** (hardening de `02`) y **esta capa de producto** (§3) montándose sobre P1+.
