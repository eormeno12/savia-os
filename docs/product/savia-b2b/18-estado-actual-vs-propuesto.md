# 17 — Estado actual vs. propuesto

> Estado: 🟡 primera pasada con hallazgos reales — a validar y expandir
> Responde a: por cada capa/tema, ¿qué existe hoy en código/copy, y qué falta para B2B?

## Cómo usar este documento

A diferencia del resto de la carpeta, este archivo **no arranca vacío** — ya
tenemos evidencia concreta de una auditoría de documentación/código hecha
antes de crear esta carpeta. Se usa como mapa de partida; cada fila se valida
o corrige a medida que se completan los docs 01-16.

## Tabla consolidada por capa

| Capa/tema | Estado hoy (verificado) | Gap para B2B |
|---|---|---|
| 1. Captación | Texto/chat y PDF/DOCX funcionando (personal) sobre un pipeline que hoy aplana todo a string plano y corta a ciegas por caracteres (`ingest/parsers/index.ts`, `chunk.ts` — parcialmente desmantelados en el redesign en curso). **Hay un diseño de reemplazo ya validado** (patrón Adapter + IR multi-formato, revisión 3 — ver [05](05-capa1-pipeline-ingesta-tecnico.md)), pero sin código escrito, y a probar primero en `apps/demo-pipeline` sin tocar producción. | Implementar el diseño validado. Hojas de cálculo, imágenes, video/audio, conectores con sync continuo — todo nuevo sobre ese contrato de adapter. Colas/reintentos/escala a nivel organización sin diseñar todavía. Decisión abierta: `DocumentLineageId` (#9 en [19](19-decisiones-abiertas.md)). |
| 2. Memoria | mem0 + Qdrant + motor de organización (`apps/api/src/modules/organization/`, alias "motor v2") funcionando para memoria personal. | Recuperación exacta/direccionable (σ) no existe como índice de búsqueda, pero **ya tiene un candidato de diseño concreto** (`SourceRange` del diseño de ingesta, ver [07](07-capa2-memoria-arquitectura-tecnica.md)) — falta implementar el lookup real. Multi-tenencia a nivel organización, sin diseñar. |
| 3. Gobernanza | Chokepoint de acceso personal **ya construido y auditado** (`grants.cache.ts` y relacionados). | Roles de organización no existen. Gobernanza a nivel skill no existe (depende de que exista Capa 4). |
| 4. Síntesis | Motor de clustering (`organization/`, motor v2) agrupa memoria en "personas"/comunidades — es organización, no síntesis procedimental. | **Es el gap más grande de todo el producto.** Ningún mecanismo genera skills/procesos canónicos hoy. |
| 5. Consumo | MCP server con `savia_search`/`savia_remember`, auth, rate limit, audit log — funcionando. | Catálogo de skills como resources no existe (depende de Capa 4). Gobernanza por-caller a nivel organización, sin extender. |
| Modelo de datos | `User, Space, MemoryIndex, Connection, CollectiveGroup, GroupMember, FragmentShare` — todo cuelga de `User`. | **No existe `Organization`/`Tenant` como entidad.** Además, el nombre `organization` ya está tomado en código por el motor de clustering (colisión, ver [02](02-glosario-y-entidades.md)). |
| Billing | Plan individual fijo vía Mercado Pago, sin seats ni concepto de organización (`docs/plan/mercadopago-subscriptions.md`). | Modelo de precios/seats de organización completo, sin empezar (ver [16](16-billing-y-planes.md)). |
| Landing / copy público | Hero, pricing y varias secciones de `apps/landing` siguen con el one-liner B2C ("La memoria que conecta todas tus IAs") que el propio `apps/landing/CLAUDE.md` marca como retirado. | Migrar copy real a "El cerebro ejecutable de cada empresa" — ya decidido, falta ejecutar. |
| Plan de redesign activo | `docs/plan/savia-redesign/` (00-08 + mockups) es B2C-personal casi en su totalidad; solo `00-overview.md` tiene un parche apuntando a la visión B2B. | Reconciliar con los prototipos ya más avanzados en `docs/plan/savia-b2b-redesign/` (`org-home-v1.html`, `governance-strategy-v1.html`), que sí modelan organización/gobernanza. |
| Auditorías (backend/frontend/mockup) | Todas escritas antes del pivot, sin awareness de B2B — no lo contradicen, lo ignoran. | Re-auditar el modelo de datos y las superficies una vez que 01, 07 y 13 estén resueltos. |

## Fuente de esta primera pasada

Auditoría de alineación B2B hecha sobre el estado del repo previo a la
creación de esta carpeta (conversación del 2026-07-27) — cubrió `docs/vision/`,
`docs/plan/savia-redesign/`, `docs/plan/savia-b2b-redesign/`, `docs/audit/*`,
`apps/landing/` (copy real), `docs/design/`, `docs/plan/mercadopago-subscriptions.md`.

**Actualización (misma fecha):** se incorporó el diseño de pipeline de
ingesta multi-formato (revisión 3) que el usuario tenía en curso — ver
[05-capa1-pipeline-ingesta-tecnico.md](05-capa1-pipeline-ingesta-tecnico.md).

## Decisiones tomadas

_(vacío — acá se registran los gaps ya resueltos, con fecha y link al doc que
los resolvió)_
