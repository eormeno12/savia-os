# FASE 5 — Federación colectiva

> **Objetivo:** memoria **colectiva como federación** (D2): grupo + fragmentos compartidos, sin contenedor; el dato nunca sale de su autor.
> **Hito:** colaboración. · **Depende de:** FASE-3 (áreas), FASE-2 (búsqueda). · **Esfuerzo:** L.
> **Referencia:** [`08 §5`](08-plan-end-to-end.md), [`05 §3`](05-rediseno-estructural.md), spec 16 (**reemplazada** por federación — ver `0A §A`).

## Alcance
- **Grupo** (`CollectiveGroup`) + **miembros** (roles) + **fragmentos** (`FragmentShare`: un miembro comparte un área o una lente).
- **Vista unión viva** (fan-out de búsqueda por fragmento + dedup cross-persona).
- **Invitaciones** a grupo + **Pulso del grupo** (additivo, atribuido, sticky).

## Arquitectura / decisiones (de `0A`)
- **Federación, no contenedor** (D2): el dato vive en el área personal del autor; el grupo es un overlay de fragmentos. Al salir, el fragmento **se va con vos** (+ "donar snapshot").
- **Lectura colectiva centralizada** en `FederationService` (F6): el "grupo = OR de los predicados de fragmento" se encodea **una vez** (no duplicado en search/account-delete).
- **Búsqueda colectiva = fan-out** por miembro (mem0 es por partición de usuario) + merge/dedup; o Qdrant-directo si conviene (`08 §5.2`).
- **Sensible nunca auto-fluye** a un grupo sin opt-in; expulsar invalida la cache de las IAs del expulsado al instante.
- Roles gobiernan el **grupo** (membresía/invites), no editan contenido ajeno.

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F5.1** Grupo + miembros + invites | `CollectiveGroup`/`GroupMember`/`GroupInvite` (HMAC `tokenLookup` → accept O(1)); rutas de grupo + roles | crear grupo; invitar→aceptar→`GroupMember`; gestionar miembros (admin) | F3 | M |
| **F5.2** FragmentShare (compartir/salir) | compartir un área/lente como fragmento; dejar de compartir | B comparte → A lo ve; B sale → su fragmento desaparece, sus memorias **siguen suyas** | F5.1 | M |
| **F5.3** Vista unión viva | `FederationService` (predicado de fragmento único) + `GET /groups/:id/memories` (fan-out + dedup) | la unión refleja los fragmentos vivos; dedup muestra uno ("también de Ana") | F2·F5.2 | M |
| **F5.4** Pulso del grupo + grant a grupo | Pulso atribuido (additivo/sticky); `Grant(scope=group)` para que la IA de un miembro acceda | sensible no auto-fluye; expulsar corta acceso al instante | F1·F5.3 | M |

## Definition of Done
- [ ] La lógica "grupo = OR de fragmentos" existe en **un** lugar (`FederationService`), no duplicada.
- [ ] Salir de un grupo no extrae ni deja huérfanos (test).
- [ ] Sensible no se expone a un grupo sin `includeSensitive` (test).
- [ ] Expulsar a un miembro invalida la cache de sus conexiones de inmediato.
