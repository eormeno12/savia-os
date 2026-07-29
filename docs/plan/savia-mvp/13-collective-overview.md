# Fase 2 — Memoria colectiva: visión y mapa de cambios

> 🔄 **Reemplazado por FEDERACIÓN (2026-06-29) — decisión D2.** La visión de colectivo-como-**contenedor** (`Space(kind=collective)`) de este doc y de [`16`](16-collective-spaces.md) pasó a **federación**: grupo + fragmentos compartidos, el dato queda con su autor. Ver el banner de [`16`](16-collective-spaces.md) y la fuente canónica [`08 §5`](../../audit/backend/2026-06-27/08-plan-end-to-end.md) / [`FASE-5`](../../audit/backend/2026-06-27/FASE-5-federacion.md). Lo de abajo es **contexto histórico**.

> Índice maestro de la Fase 2. **Complementa** el plan MVP (steps 00–12), no lo
> reemplaza. Léelo antes de cualquier step 14–16. Esta fase asume el MVP **ya
> implementado**.

## Qué añade esta fase

La capacidad de **memoria colectiva**: el usuario puede compartir un área de su
memoria con otras personas para **generar y consultar conocimiento en común**,
como un **drive compartido**. Varios usuarios aportan a un mismo espacio y todos
lo consultan, con roles (quién lee, quién escribe, quién administra).

## El cambio conceptual central: de dos ejes a uno

El MVP modela la memoria con **dos ejes**:

| Eje | Cardinalidad | Qué es | Hoy en Qdrant |
|-----|-------------|--------|---------------|
| Dueño | 1 por memoria | frontera de seguridad | `user_id` |
| Spaces | 0..N por memoria | lentes temáticas (multi-tag) | `submemories: []` |

La Fase 2 los **unifica en una sola primitiva — el `Space`**:

> Un **Space** es a la vez la lente, el contenedor, **el dueño y la frontera de
> seguridad**. Cada memoria vive en **un** Space (su *hogar*). Un Space es
> **privado** (1 miembro) o **colectivo** (N miembros con roles). "Compartir" =
> añadir miembros.

```
Usuario
 └─ es miembro de N Spaces
      ├─ "General"  (privado, por defecto — toda memoria nace aquí)
      ├─ "Salud"    (privado)
      └─ "Equipo"   (colectivo — varios miembros con roles)
Cada memoria: home_space_id = uno. Archivos, growth, grants → cuelgan del Space.
```

### Qué se gana

- **Filtro de lectura único y trivial**: `space_id ANY (mis spaces)` reemplaza
  `user_id = yo`. Desaparece todo caso especial personal/colectivo.
- **Promoción privado→colectivo = añadir un miembro. Cero movimiento de datos.**
- **Visibilidad inequívoca**: una memoria en un solo Space no puede "filtrarse"
  por estar co-clasificada en un space compartido (el riesgo del multi-tag).
- `mem0` particiona por `space_id` → dedup/conflictos acotados al Space.
- Archivos compartidos (drive) salen del mismo modelo (`File.spaceId`).

### Qué se pierde (decisión consciente)

El **multi-tag**: hoy una memoria puede estar en 0..N spaces. En el modelo nuevo
tiene **un hogar**. El clasificador del [step 07](07-submemories.md) pasa de
**multi-etiqueta** a **enrutado** (elige el mejor hogar). Si en el futuro se
quiere "aparece al filtrar por varias áreas", se recupera con *tags secundarios
de solo-navegación* que **nunca cruzan la frontera de compartición** (fase 3).

## Principio rector actualizado — la frontera limpia

Extiende el principio de seguridad del [overview:52](00-overview.md). La frontera
debe cumplir, **sin excepciones**:

1. **Una sola función de acceso, fail-closed**: `resolveReadableSpaces(connection)`
   deriva en el servidor `membership ∩ grants`, **vacío por defecto**. Es el único
   lugar que decide acceso de lectura.
2. **El dato es fail-closed**: `memory.search` **exige** un set de spaces no vacío;
   sin scope no devuelve nada. La seguridad no depende del caller.
3. **Lookup de token determinista**: `tokenLookup = HMAC(serverKey, rawToken)`
   indexado → O(1), **una sola** clave de caché, **invalidada en todo evento que
   cambie acceso** (grant, revoke, **membresía**).
4. **`space_id` es la clave indexada de la frontera** (no `user_id`); mem0
   particiona por Space.
5. **Audit siempre se escribe** (await, fail-loud), nunca best-effort.

## Mapa de cambios a los steps existentes

| Step MVP | Qué cambia en Fase 2 | Dónde se detalla |
|----------|----------------------|------------------|
| [02 data-layer](02-data-layer.md) | `Space` gana `kind`+miembros; `MemoryIndex.spaceIds[]`→`homeSpaceId`; `File.spaceId`; `GrowthEvent.spaceId` no-null; nuevas tablas `SpaceMember`/`CollectiveInvite` | [14](14-spaces-unification.md), [16](16-collective-spaces.md) |
| [05 memory-layer](05-memory-layer.md) | `add(spaceId,…)`; `search` filtra `space_id ANY` y es fail-closed; payload `space_id` | [14](14-spaces-unification.md), [15](15-frontier-hardening.md) |
| [07 submemories](07-submemories.md) | clasificador multi-tag → **enrutado single-home**; "crear space desde memoria" = re-hogar; se elimina `spaceVersions`/`manualOverride`/`version` | [14](14-spaces-unification.md) |
| [08 connections-grants](08-connections-grants.md) | `resolveToken` por HMAC + caché única + invalidación completa; grants pueden exponer spaces colectivos; `canWrite` | [15](15-frontier-hardening.md), [16](16-collective-spaces.md) |
| [09 mcp-server](09-mcp-server.md) | `savia_search` clampa contra spaces-miembro; `savia_remember(space?)` con permiso de escritura | [15](15-frontier-hardening.md), [16](16-collective-spaces.md) |
| [11 dashboard-growth](11-dashboard-growth.md) | growth por Space-miembro (incluye colectivos); fin del doble conteo y del bucket "sin clasificar" | [14](14-spaces-unification.md), [16](16-collective-spaces.md) |
| [04 files-drive](04-files-drive.md) | archivos cuelgan de un Space; prefijo S3 `spaces/{spaceId}`; drive por Space | [16](16-collective-spaces.md) |

## Orden de la Fase 2

| Step | Archivo | Resultado verificable |
|------|---------|-----------------------|
| 13 | `13-collective-overview.md` | (este doc) visión + mapa |
| 14 | [14-spaces-unification.md](14-spaces-unification.md) | modelo unificado `Space` (todo privado aún); single-home; mismo comportamiento de cara al usuario sobre la base nueva |
| 15 | [15-frontier-hardening.md](15-frontier-hardening.md) | frontera limpia: `resolveReadableSpaces`, search fail-closed, HMAC + caché única, audit always-on |
| 16 | [16-collective-spaces.md](16-collective-spaces.md) | colectivos: miembros, roles, invitaciones, drive compartido, promoción desde personal, UI |

**14 → 15 → 16, en orden.** Cada step termina con su verificación antes de pasar.

## Principio de migración (no negociable)

El cambio toca el **núcleo de seguridad** y hay (o habrá) datos. Por eso:

- **Migración aditiva primero**: columnas nuevas nullable, sin borrar nada.
- **Dual-filter en el cutover**: el código lee **a la vez** `user_id` Y `space_id`
  hasta verificar paridad; solo entonces se retira `user_id`.
- **Nunca** quitar `user_id` y meter `space_id` en el mismo deploy.
- **No borrar el payload `user_id`**: se degrada a *autor/provenance* (lo usan
  onboarding y clustering para agregados cross-space). Deja de ser frontera de
  lectura, no desaparece.
- **Colectivos al final**: introducir `kind=collective` y escritura compartida
  **solo** tras probar la frontera con todos los spaces aún privados, y entonces
  **re-auditar cada grant** (un grant que antes exponía solo lo propio, en un
  space colectivo expone lo de otros → riesgo de escalada).

## Bugs que se pliegan a esta fase

El [análisis previo](.) identificó bugs de la frontera. Los que **reescriben las
mismas líneas** se arreglan dentro de estos steps (no antes):

- **B1** caché sha256 vs argon2 (invalidación no-op) → [15](15-frontier-hardening.md)
- **B3** `resolveToken` escanea O(N) con argon2 → [15](15-frontier-hardening.md)
- **B4** `memory.search` no fail-closed → [15](15-frontier-hardening.md)
- **B5** divergencias Postgres↔Qdrant al borrar space / corregir manualmente →
  [14](14-spaces-unification.md) (Qdrant-first + reconcile)

Los quick fixes independientes (**B2** growth ×2, **B6** lockout OTP, **B7**
secretos/OTP en logs) ya están aplicados fuera de esta fase.

## Decisiones cerradas (de diseño, ya acordadas)

1. **Compartir ambos**: un Space colectivo es dueño de **memoria y archivos** (S3).
2. **Single-home confirmado**: una memoria, un hogar (se renuncia al multi-tag).
3. **Promoción = mover** (default), copiar como opción; **nunca** se promueve el
   Space personal/General completo.
4. **Miembro que sale**: sus aportes **se quedan** en el colectivo (`author_id`
   preservado).
5. **Gestión de colectivos solo por UI** en esta fase (MCP lee/escribe, no crea).
