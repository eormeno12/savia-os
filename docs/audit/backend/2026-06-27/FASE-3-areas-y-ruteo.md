# FASE 3 — Áreas (árbol) y ruteo multi-membership

> **Objetivo:** la jerarquía de **áreas** y el **ruteo** de cada memoria a un **conjunto de áreas** (membership), con las rutas que el front consume.
> **Hito:** el core de memoria funcionando (parte del "frontend-ready"). · **Depende de:** FASE-2. · **Esfuerzo:** L.
> **Referencia:** [`08 §4`](08-plan-end-to-end.md), [`05 §3`](05-rediseno-estructural.md), `01` (gap), `02-INT-3/4`.

## Alcance
- **`Space` como árbol** de áreas (parentId/path/depth/governance/CF), General en signup.
- **`RoutingService`** online: cada memoria → membership (`savia_area_ids` + ancestros) + `primary` (celda del mapa).
- **Rutas de áreas** (tree, memorias hidratadas, sample) — el mapa refleja el acceso.
- Import (ChatGPT/rescate) **encolado y ruteado** (cierra `02-INT-3/4`).

## Arquitectura / decisiones (de `0A`)
- **Ruteo online O(1), sin LLM** (F2): kNN (embeddings) + boost de entidades → membership; emite la asignación al write-kernel (no escribe directo).
- **Entidades como señal inyectable** con null-object fallback (F13): si el entity-store falla, degrada a geometría pura.
- **`savia_area_ids` incluye ancestros** (la base del subárbol-grant de FASE-1).
- Conteos **solapan** (Venn); "total" = `count distinct memoryId` (multi-membership).
- Texto **hidratado desde Qdrant** en `/areas/:id/memories` (cierra el `text:''` de `01`).

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F3.1** Árbol de áreas | `Space` con parentId/path/depth/governance/CF; General en signup (`$transaction`); `path`/cursor index | crear/editar/borrar área; borrar re-asigna membership al padre/General | F2 | M |
| **F3.2** RoutingService (membership) | kNN + entidades → `savia_area_ids`(+ancestros) + `primary`; vía write-kernel; reemplaza `classifier.classifyOne` | **unit del ruteo** (mockeando vecinos): una memoria cae en ≥1 área, sin entidad → General | F2 | M |
| **F3.3** Rutas de áreas | `GET /areas/tree`, `GET /areas`, `POST/PATCH/DELETE /areas/:id`, `GET /areas/:id/memories?cursor` (texto hidratado), `GET /areas/:id/sample?n` | grant a un área la ve por membership (incl. vía ancestro); memorias listan **con texto** | F1·F3.1 | M |
| **F3.4** Import en cola + ruteado | `import/chatgpt`/`rescue` → BullMQ Job + ruteo (no in-process) | import visible y clasificado; devuelve `jobId` | F2·F3.2 | M |

## Definition of Done
- [ ] Una memoria nueva queda en su conjunto de áreas (con ancestros) y es buscable.
- [ ] `GET /areas/:id/memories` devuelve texto real (no `''`).
- [ ] El ruteo es testeable sin Qdrant (vecinos inyectados).
- [ ] El import corre en cola y las memorias importadas aparecen clasificadas.
