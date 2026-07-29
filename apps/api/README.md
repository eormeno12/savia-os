# apps/api — Savia B2B (pendiente)

Esta carpeta está reservada para la implementación limpia del backend de
Savia B2B. Todavía no tiene scaffold — se arma cuando arranque la primera
tarea real del rebuild (vía `planner-savia`), no antes.

- **No es** el backend anterior. Eso vive en [`apps/legacy-api/`](../legacy-api/),
  congelado como referencia (diseños/algoritmos ya validados, tests reales) —
  ver `apps/legacy-api/RUNBOOK.md` y `docs/product/savia-b2b/apx-motor-v2.md`.
- Antes de escribir código acá: usar el agente `planner-savia` para convertir
  el requerimiento en criterios de aceptación explícitos.
- Contexto de producto/arquitectura: [`docs/product/savia-b2b/`](../../docs/product/savia-b2b/00-overview.md)
  (en reescritura limpia, archivo por archivo) — mientras un archivo no esté
  reescrito ahí, la fuente vigente es su equivalente en
  [`docs/product/savia-b2b-legacy/`](../../docs/product/savia-b2b-legacy/00-overview.md).
