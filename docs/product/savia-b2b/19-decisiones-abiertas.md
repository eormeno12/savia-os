# 18 — Decisiones abiertas (tracker)

> Estado: 📝 vacío — se completa a medida que avanzamos
> Responde a: ¿qué preguntas siguen sin resolver, y quién/cuándo las resolvió?

## Cómo usar este documento

Cada documento de esta carpeta tiene su propia sección "Preguntas abiertas".
Este archivo es el **índice único** de todas ellas — para no tener que revisar
18 archivos buscando qué falta. Reglas:

1. Nada pasa al futuro plan de implementación mientras su fila siga "Abierta"
   y sea bloqueante.
2. Al resolver una pregunta, se actualiza esta tabla **y** la sección
   "Decisiones tomadas" del documento de origen.
3. No todo lo que queda abierto bloquea — marcar cuáles son bloqueantes para
   arrancar a construir vs. cuáles se pueden decidir sobre la marcha.

## Tracker

| # | Pregunta | Doc de origen | Bloqueante | Estado | Decisión | Fecha |
|---|---|---|---|---|---|---|
| 1 | Colisión de nombres: `organization` (módulo de código, motor de clustering) vs `Organization` (entidad de empresa) | [02](02-glosario-y-entidades.md), [11](11-capa4-motor-sintesis-tecnico.md) | Sí | Abierta | | |
| 2 | ¿Qué dispara la síntesis de un skill (cron, umbral, pedido manual)? | [11](11-capa4-motor-sintesis-tecnico.md) | Sí | Abierta | | |
| 3 | ¿El motor de síntesis es una evolución del motor v2 o un servicio nuevo? | [11](11-capa4-motor-sintesis-tecnico.md) | Sí | Abierta | | |
| 4 | ¿Qué componentes del pipeline de ingesta actual sobreviven al redesign en curso? | [05](05-capa1-pipeline-ingesta-tecnico.md) | Sí | Abierta | | |
| 5 | ¿Qué dispara la formalización de una organización a partir de uso individual/colectivo? | [13](13-adopcion-bottom-up.md) | Sí | Abierta | | |
| 6 | Modelo de billing de organización (por seat, plano, híbrido) | [16](16-billing-y-planes.md) | No (puede decidirse después de tener el producto) | Abierta | | |
| 7 | ¿Se mantiene Mercado Pago para B2B o se cambia de proveedor? | [16](16-billing-y-planes.md) | No | Abierta | | |
| 8 | ¿Una persona puede pertenecer a más de una organización? | [03](03-personas-y-roles.md) | Sí | Abierta | | |
| 9 | `DocumentLineageId` — qué identifica que un archivo subido es una nueva versión de otro ya ingestado (3 caminos evaluados: declarado por el usuario / inferido por nombre+área+uploader / diferido fuera de alcance) | [05](05-capa1-pipeline-ingesta-tecnico.md) | Sí — sin esto la reconciliación de identidad no es ejercitable en producción | Abierta (recomendación del diseño original: diferir para la prueba, declarado por el usuario para producción) | | |
| 10 | ¿Se copia el diseño de pipeline multi-formato desde `~/.claude/plans/` (fuera del repo) a `docs/architecture/`? | [05](05-capa1-pipeline-ingesta-tecnico.md) | No, pero recomendado antes de implementar | **Resuelta** | Sí — copiado a [`docs/product/savia-b2b/apx-ingesta-pipeline-adapter-ir.md`](apx-ingesta-pipeline-adapter-ir.md) | 2026-07-27 |

_(agregar filas a medida que aparecen nuevas preguntas en cualquier documento)_

## Gaps de la ingesta multi-formato

Detalle de la decisión #9, tal como quedó planteado en el diseño original
(revisión 3, sección 11):

| Camino | Qué implica |
|---|---|
| (a) El usuario declara el reemplazo | Explícito y correcto. Requiere UI y un campo nuevo en `File`. |
| (b) Se infiere por nombre + área + uploader | Cero UI. Falso positivo cuando dos archivos distintos comparten nombre en una misma área. |
| (c) Se difiere — la reconciliación queda fuera de alcance por ahora | Honesto: deja la identidad como capacidad diseñada y no ejercitada todavía. |

Recomendación del diseño original: **(c) para la prueba en `apps/demo-pipeline`, (a) para producción.**

## Decisiones ya tomadas (histórico)

_(vacío — mover acá las filas resueltas de la tabla de arriba, para no perder
el registro de por qué se decidió algo)_
