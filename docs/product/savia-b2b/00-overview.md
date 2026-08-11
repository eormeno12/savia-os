# 00 — Savia B2B: mapa de la documentación

> Toda la documentación de producto y arquitectura de Savia B2B vive en esta
> carpeta: qué es Savia, cómo funciona capa por capa, y en qué orden se
> construye. Es la fuente única de verdad — si algo se decide sobre el
> producto, se registra acá.

## Cómo está organizada

La carpeta va de lo más abstracto a lo más concreto. Cada capa del producto
se documenta en dos niveles: **modelo** (qué hace y por qué, en términos de
producto) y **técnico** (cómo se implementa). Esa separación existe para que
una decisión de producto no quede enterrada en detalle de implementación, y
para que un cambio técnico no obligue a reescribir la explicación conceptual.

```
Visión            01          qué es Savia y a qué apunta
Fundamentos       02-03       vocabulario, entidades, quién la usa
Las 5 capas       04-12       captación · memoria · gobernanza · síntesis · consumo
                              (cada una: modelo + técnico)
Crecimiento       13-15       cómo se adopta, qué pantallas necesita, hacia dónde va
Negocio           16          precios y planes
Ejecución         17          en qué orden se construye
Seguimiento       18          decisiones que siguen abiertas
```

## Índice

| # | Documento | Estado |
|---|---|---|
| 01 | [Visión](01-vision.md) | ✅ Escrito |
| 02 | [Glosario y entidades](02-glosario-y-entidades.md) | ✅ Escrito |
| 03 | [Personas y roles](03-personas-y-roles.md) | ✅ Escrito |
| 04 | [Capa 1 — Captación (modelo)](04-capa1-captacion-modelo.md) | ✅ Escrito |
| 05 | [Capa 1 — Pipeline de ingesta documental (técnico)](05-capa1-pipeline-ingesta-tecnico.md) | ⚠️ Escrito, superado en parte por el borrador — se reescribe desde él |
| 05b | Capa 1 — Flujos de eventos (técnico) | ⬜ Pendiente |
| 06-07 | Capa 2 — Memoria | 🚧 [Borrador](borrador-capa2-memoria.md) — 28 puntos abiertos |
| 08-09 | Capa 3 — Gobernanza | 🚧 [Borrador](borrador-capa3-gobernanza.md) — 19 puntos abiertos |
| 10-11 | Capa 4 — Síntesis | 🚧 [Borrador](borrador-capa4-sintesis.md) — 21 puntos abiertos · **es una reintegración, no un diseño nuevo** |
| 12 | Capa 5 — Consumo vía MCP | 🚧 [Borrador](borrador-capa5-consumo.md) — 21 puntos abiertos |
| 13 | Adopción bottom-up | ⬜ Pendiente |
| 14 | Superficies de producto | ⬜ Pendiente |
| 15 | Roadmap: asistido → autónomo | ⬜ Pendiente |
| 16 | Billing y planes | ⬜ Pendiente |
| 17 | Plan de fases | ⬜ Pendiente |
| 18 | Decisiones abiertas | ⬜ Pendiente |
| — | [Borrador: pipeline técnico tramo por tramo](borrador-pipeline-tecnico.md) | 🚧 Tramos 1–6 cerrados · **tramo 7 sin diseñar** · fuente vigente de la Capa 1 |
| — | [Lectura cruzada de capas (2026-08-10)](lectura-cruzada-capas-2026-08-10.md) | ✅ Qué necesita cada capa de la Capa 1 y no recibe — **léase antes de tocar `packages/ir`** |

El orden del índice no es el orden en que se escriben: hay dependencias
reales (las superficies dependen del modelo de datos, el plan de fases
depende de que la Capa 4 esté diseñada). Cada documento declara de qué
depende en su encabezado.

## Convenciones

- **Un término, un significado.** El vocabulario canónico está en
  [02](02-glosario-y-entidades.md). Si un documento necesita un término
  nuevo, se agrega ahí antes de usarlo.
- **Las decisiones se registran donde se toman**, con fecha, y se indexan en
  el tracker de decisiones abiertas (18). Nada queda resuelto solo en una
  conversación.
- **Lo que no está decidido se marca como tal.** Es preferible un hueco
  explícito a una definición inventada para rellenar.

---

<sub>Nota de método: `docs/product/savia-b2b-legacy/` contiene una iteración
anterior de esta documentación. Se consulta como investigación de fondo al
escribir cada documento nuevo — verificando siempre contra el código real lo
que afirma — pero no se cita en el texto ni se copia su estructura. Este plan
se escribe y se lee como si fuera la primera vez.</sub>
