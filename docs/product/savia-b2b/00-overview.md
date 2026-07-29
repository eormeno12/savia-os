# 00 — Savia B2B: reescritura limpia (en progreso)

> Estado: arrancando de cero, archivo por archivo. Esta carpeta reemplaza a
> [`docs/product/savia-b2b-legacy/`](../savia-b2b-legacy/00-overview.md), que
> queda **congelada como guía de referencia** — mismo principio que aplicamos
> al código (`apps/legacy-api`/`apps/legacy-app` vs `apps/api`/`apps/app`):
> lo legacy no se copia tal cual, se usa como blueprint validado y se
> reintegra/reescribe con criterio propio en cada archivo nuevo.

## Por qué se reescribe en vez de seguir editando lo legacy

`docs/product/savia-b2b-legacy/` tenía valor real (`01-vision.md` completo,
5 de 9 decisiones bloqueantes ya resueltas, dos apéndices as-built) pero
también arrastraba huecos estructurales: sin plan de fases/secuencia, con
`18-estado-actual-vs-propuesto.md` desactualizado a los dos días de escrito,
con un desfasaje de numeración interno (headers de `10`/`11` dicen `09`/`10`),
y con la auditoría técnica de fase 1 (2026-07-29) sin persistir en ningún
archivo del repo. Reescribir file por file, en vez de parchear, es la
oportunidad de resolver eso de una vez — igual que decidimos para el código.

## Cómo se usa lo legacy

Cada archivo nuevo que se escriba acá debe, antes de darse por terminado:

1. Leer el archivo equivalente en `docs/product/savia-b2b-legacy/` (si existe).
2. Verificar contra el código real (`apps/legacy-api`/`apps/legacy-app`) lo
   que el legacy afirma — no asumir que sigue siendo cierto.
3. Reintegrar lo que siga siendo válido, reescribir lo que no, y **fijar la
   numeración correctamente** desde el arranque (header y nombre de archivo
   coinciden).
4. Registrar explícitamente qué cambió respecto al legacy y por qué, para
   que quede trazable.

Las decisiones ya resueltas en
[`docs/product/savia-b2b-legacy/19-decisiones-abiertas.md`](../savia-b2b-legacy/19-decisiones-abiertas.md)
siguen vigentes salvo que el archivo nuevo correspondiente diga lo contrario
explícitamente — no hay que volver a discutirlas desde cero.

## Índice (se completa a medida que se reescribe cada archivo)

_(vacío — cada archivo se agrega acá cuando se reescribe, con un link. Hasta
entonces, el índice de referencia es el de
[`docs/product/savia-b2b-legacy/00-overview.md`](../savia-b2b-legacy/00-overview.md).)_
