# 00 — Savia B2B: qué es, a qué apunta ser, qué hay hoy, hacia dónde va

> Estado: fuente única de verdad de Savia B2B — visión, modelo de producto y
> arquitectura técnica viven todas en esta carpeta. Se completa en
> iteraciones sucesivas.

## Nota de estructura del repo (2026-07-29)

`apps/api`/`apps/app` se renombraron a `apps/legacy-api`/`apps/legacy-app` — quedan
congelados como referencia validada (diseños, algoritmos, tests reales), sin
código nuevo. `apps/api`/`apps/app` quedan libres para el B2B real (scaffold
pendiente). **Las citas `archivo:línea` de los apéndices as-built de esta
carpeta (`apx-motor-v2.md`, `apx-ingesta-pipeline-adapter-ir.md`) todavía dicen
`apps/api/...` tal como se verificaron — leer como `apps/legacy-api/...`.** No
se reescribieron esas citas para no arriesgar precisión en una edición masiva;
el contenido de cada archivo no cambió, solo el directorio que lo contiene.
Detalle completo del rename y la lógica de legado-vs-nuevo: `CLAUDE.md` raíz.

## Qué es esta carpeta

**Todo lo que hay que saber sobre Savia B2B vive acá — nada repartido entre
`docs/vision/`, `docs/architecture/` y esta carpeta.** Ese reparto existió por
un rato (visión en un lado, arquitectura as-built en otro, spec de producto
acá) y se consolidó porque tener la misma verdad en dos lugares obliga a
mantenerlos sincronizados a mano y tarde o temprano se pisan. Ya no existen
`docs/vision/` ni `docs/architecture/` — su contenido se movió acá.

Cuatro preguntas, y dónde vive la respuesta de cada una:

| Pregunta | Dónde vive |
|---|---|
| **Qué es Savia, a qué apunta ser** | [01-vision.md](01-vision.md) — el norte estratégico (ex `docs/vision/company-brain.md`) |
| **Cómo funciona** (modelo de producto, capa por capa) | 02 a 12 — entidades, personas, y las 5 capas en dos niveles (producto + técnico) |
| **Qué hay implementado hoy** | [18-estado-actual-vs-propuesto.md](18-estado-actual-vs-propuesto.md) + los apéndices as-built ([apx-motor-v2.md](apx-motor-v2.md), [apx-ingesta-pipeline-adapter-ir.md](apx-ingesta-pipeline-adapter-ir.md)) — documentación verificada línea por línea contra el código real, no aspiracional |
| **Hacia dónde debe ir** | [15-roadmap-asistido-autonomo.md](15-roadmap-asistido-autonomo.md), [17-migracion-desde-b2c.md](17-migracion-desde-b2c.md), [19-decisiones-abiertas.md](19-decisiones-abiertas.md) |

```
01-vision.md                          QUÉ es Savia y A QUÉ APUNTA SER
  (esta carpeta)                      (norte estratégico, alto nivel)
        │
        ▼
02-19 + apx-*                         CÓMO FUNCIONA — entidades, las 5 capas
  (esta carpeta)                      (producto + técnica), estado actual
                                       verificado contra código, roadmap
        │
        ▼
docs/plan/savia-b2b/ (futuro,         EN QUÉ ORDEN se construye — pasos
fuera de esta carpeta)                concretos, como ya existe en
                                       docs/plan/savia-mvp/ para el B2C
```

**No se empieza a planear implementación hasta que esta carpeta esté
razonablemente resuelta.** Es la guía; el plan (un tipo de documento distinto:
orden y pasos, no modelo ni arquitectura) viene después y vive aparte.

## Cómo se completa

La mayoría de los archivos todavía son esqueleto: propósito, insumos
existentes a revisar, sub-temas como checklist. Se llenan en iteraciones — no
hace falta terminar uno para empezar otro, pero hay dependencias (marcadas en
cada doc) que conviene respetar. Dos ya tienen contenido sustancial en vez de
solo checklist: [01-vision.md](01-vision.md) (la visión completa) y
[05-capa1-pipeline-ingesta-tecnico.md](05-capa1-pipeline-ingesta-tecnico.md)
(diseño de pipeline ya validado). Las preguntas sin resolver de todos los
archivos se centralizan en [19-decisiones-abiertas.md](19-decisiones-abiertas.md).

## Índice

### Visión (leer primero)
| # | Doc | Qué cubre |
|---|---|---|
| 01 | [Visión](01-vision.md) | Qué es Savia, el problema que ataca, la apuesta bottom-up, las 5 capas, por qué puede ganar, hacia dónde va, estado actual honesto. El norte estratégico. |

### Fundamentos
| # | Doc | Qué cubre |
|---|---|---|
| 02 | [Glosario y entidades](02-glosario-y-entidades.md) | Vocabulario canónico + modelo de datos. Incluye una colisión de nombres real ya detectada (`organization` en código ≠ `Organization` empresa). |
| 03 | [Personas y roles](03-personas-y-roles.md) | Quién usa el producto: individuo, equipo, admin de org, agente/IA ejecutora. |

### Las 5 capas — producto y técnica
| # | Doc | Capa | Nivel |
|---|---|---|---|
| 04 | [Captación — producto](04-capa1-captacion-producto.md) | 1 | Producto |
| 05 | [Pipeline de ingesta — técnico](05-capa1-pipeline-ingesta-tecnico.md) | 1 | Técnico — diseño ya validado, ver [apx-ingesta-pipeline-adapter-ir.md](apx-ingesta-pipeline-adapter-ir.md) |
| 06 | [Memoria — modelo](06-capa2-memoria-modelo.md) | 2 | Producto |
| 07 | [Memoria — arquitectura técnica](07-capa2-memoria-arquitectura-tecnica.md) | 2 | Técnico |
| 08 | [Gobernanza — modelo](08-capa3-gobernanza-modelo.md) | 3 | Producto |
| 09 | [Gobernanza — implementación técnica](09-capa3-gobernanza-implementacion-tecnica.md) | 3 | Técnico |
| 10 | [Síntesis — modelo](10-capa4-sintesis-modelo.md) ⚠️ | 4 | Producto — **el corazón del producto** |
| 11 | [Motor de síntesis — técnico](11-capa4-motor-sintesis-tecnico.md) ⚠️ | 4 | Técnico — **el gap más grande**, ver [apx-motor-v2.md](apx-motor-v2.md) |
| 12 | [Consumo vía MCP](12-capa5-consumo-mcp.md) | 5 | Producto + técnico |

### Crecimiento y experiencia de producto
| # | Doc | Qué cubre |
|---|---|---|
| 13 | [Adopción bottom-up](13-adopcion-bottom-up.md) | Mecánica de emergencia individuo → equipo → organización. |
| 14 | [Superficies de producto](14-superficies-de-producto.md) | Pantallas y flujos concretos, sobre los prototipos ya existentes. |
| 15 | [Roadmap asistido → autónomo](15-roadmap-asistido-autonomo.md) | Qué hace el producto en cada etapa del roadmap de la visión. |

### Negocio y transición
| # | Doc | Qué cubre |
|---|---|---|
| 16 | [Billing y planes](16-billing-y-planes.md) | Modelo de precios/seats de organización. |
| 17 | [Migración desde B2C](17-migracion-desde-b2c.md) | Cómo se transforma lo ya construido sin romperlo. |

### Seguimiento
| # | Doc | Qué cubre |
|---|---|---|
| 18 | [Estado actual vs. propuesto](18-estado-actual-vs-propuesto.md) | Hallazgos reales de código/copy — qué existe hoy vs qué falta, capa por capa. |
| 19 | [Decisiones abiertas](19-decisiones-abiertas.md) | Tracker único de todas las preguntas pendientes de la carpeta. |

### Apéndices técnicos (as-built, verificados línea por línea contra el código)
| Doc | Qué cubre |
|---|---|
| [apx-motor-v2.md](apx-motor-v2.md) | El motor v2 de clustering (`apps/api/src/modules/organization/`) — persona graph + encoding tree. Insumo central de la Capa 4. |
| [apx-ingesta-pipeline-adapter-ir.md](apx-ingesta-pipeline-adapter-ir.md) | Diseño del patrón Adapter + IR para ingesta multi-formato (revisión 3, validado, sin código escrito todavía). Insumo central de la Capa 1. |

## Relación con el resto del repo

- **No reemplaza** `docs/plan/savia-mvp/` (la base B2C ya construida) ni
  `docs/plan/savia-redesign/` (el redesign de frontend en curso) — los usa
  como insumo de lo que ya existe, y señala dónde quedaron desactualizados
  respecto al pivot (ver [18](18-estado-actual-vs-propuesto.md)).
- **Sí construye directamente sobre** `docs/plan/savia-b2b-redesign/prototypes/`
  (`org-home-v1.html`, `governance-strategy-v1.html`) — son la exploración de
  producto B2B más avanzada que existe hoy en el repo.
- **Es la referencia que cita `CLAUDE.md` raíz** — "léelo antes de tomar
  decisiones de producto o de copy" apunta acá (a [01-vision.md](01-vision.md)
  primero, y al resto de la carpeta para el detalle).
