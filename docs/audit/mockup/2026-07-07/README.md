# Revisión de diseño del mockup — Savia OS · 2026-07-07

> Auditoría **del mockup en sí mismo** (`Savia - Mockup.dc.html`, Claude Design, project `2d623175-…`):
> huecos de cobertura frente al brief de UX y errores de diseño internos del propio mockup.
> **No** es una comparación mockup-vs-código de producto (eso es la [auditoría de frontend del 2026-06-27](../../frontend/2026-06-27/README.md), aparte y aún vigente).
> Entregable solo-documentación; no se tocó ni el mockup ni el código.

## Documentos

1. [01-huecos-cobertura.md](01-huecos-cobertura.md) — 61 estados/pantallas/elementos que el brief pide y el mockup no dibuja (o dibuja a medias).
2. [02-errores-diseno.md](02-errores-diseno.md) — 55 inconsistencias internas: números que no cuadran, patrones aplicados en una pantalla y omitidos en otra, copy que se contradice, navegación que no coincide con lo que el propio documento declara.
3. [03-plan-correccion.md](03-plan-correccion.md) — backlog de los 116 hallazgos por severidad (Alta → Baja), listo para retocar el mockup.

## Método (verificado, no inventado)

- **Mockup**: el export standalone de `Savia - Mockup.dc.html` (subido a Claude Design el 2026-06-30,
  tres días después de la auditoría de frontend), desempacado a HTML plano legible (3.188 líneas,
  las ~33 pantallas con todos sus estados desktop y móvil). Cada hallazgo ancla a **línea exacta** del HTML.
- **Brief canónico**: [`mockup-requirements.md`](../../../plan/savia-redesign/mockup-requirements.md)
  (v1) + [`mockup-v2.md`](../../../plan/savia-redesign/mockup-v2.md) (v2: freemium, 10 flujos,
  SB1/CT3/CT4, micro-mensajes de confianza). Donde hay conflicto v1↔v2, gana v2.
- **Proceso**: 16 revisores en paralelo (13 por sección + 3 transversales: navegación, copy/tono,
  freemium), y luego **un verificador adversarial por hallazgo** que re-abrió la evidencia citada
  antes de aceptarla. De 123 hallazgos crudos, **7 se descartaron** por no sostenerse; quedan **116**.

---

## Veredicto

El mockup **creció mucho y bien** desde la última vez: ahora sí cubre las superficies que la
auditoría de frontend daba por ausentes (Conexiones C1–C3, Fuentes F1, Bandeja N1, Colectivo
CO2–CO7, Cuenta CT1–CT4) y consolidó la buena idea de la **plantilla de área unificada** (una
privada es una colectiva con un solo miembro y la capa de Personas apagada), que reemplaza M2+CO1.
El lenguaje visual (lima solo sobre ink, lienzo claro de trabajo) está bien definido y, en las
pantallas-firma, bien ejecutado.

**Pero todavía no está listo para pasar a desarrollo como fuente de verdad**, por cinco patrones
que cruzan todo el archivo:

1. **La arquitectura de información se contradice a sí misma.** P2 ("¿Qué ve cada IA?") es, según
   el brief, el *corazón del acceso* y vive bajo **Pulso** — pero el mockup lo movió a **Conexiones**
   (rail resaltado, pestañas "Tus conexiones / Acceso"), rompiendo el límite explícito "Conexiones =
   solo conectar; los permisos se gestionan en Memoria/Pulso" y el flujo 9. El propio mockup lo
   admite en un post-it, pero nunca reconcilió el conflicto.
2. **El móvil está a medio dibujar.** No hay bottom-nav en 4 de 6 secciones (Conexiones, Fuentes,
   Pulso/P2, Bandeja), el estado móvil por defecto de S1 no tiene **cómo abrir el drawer** (ni cómo
   llegar a Cuenta), y faltan variantes móviles enteras de O2, O3, SB1 y del set Colectivo — todo
   contra la promesa de portada "Escritorio y móvil".
3. **Una promesa de datos que el propio mockup desmiente.** El micro-mensaje de confianza dice
   "Guardamos el archivo original — puedes exportarlo cuando quieras", pero O2 y F1 dicen 4 veces
   "los archivos originales no los guardamos", y CT3 (exportar) no lista el original como exportable.
   En un producto de memoria, una promesa de retención de datos que no se sostiene es peor que no hacerla.
4. **Flujos que se cortan antes del final.** El wizard CO6 (convertir en colectiva) solo tiene el
   paso 1 de 3 — falta justo la confirmación irreversible; CT4 (soporte) no tiene estados
   enviando/enviado/error; CT3 no tiene estado "primera exportación"; CO7 (invitación pública) no
   tiene estado "link vencido"; C3 no tiene "sin cliente elegido"; CT1 (eliminar cuenta) no tiene
   el botón final de confirmar.
5. **Números y fechas de ejemplo que no cuadran.** O2 celebra "247 recuerdos" con chips que suman
   178; el área "Recetas" muestra 64 / ausente / 0 en tres vistas; el badge de Bandeja dice "4"
   sobre 5 ítems; la fecha de fin de gracia es 19-jul en SB1 y 14-jul en CT2. Placeholder, sí, pero
   contaminan justo la credibilidad de los datos que el producto muestra sobre sí mismo.

Resueltos estos cinco patrones (que concentran la mayoría de los 32 hallazgos de severidad alta),
el mockup pasa de "referencia rica pero con trampas" a "fuente de verdad confiable para handoff".

---

## Top 12 — los que más importan

| # | Sev | Pantalla | Problema | Doc |
|---|---|---|---|---|
| 1 | 🔴 | P2 (nav) | "¿Qué ve cada IA?" vive bajo **Conexiones**, no bajo Pulso — rompe la IA canónica y el límite "Conexiones = solo conectar" | [02](02-errores-diseno.md) |
| 2 | 🔴 | Fuentes / Patrones | "No guardamos los archivos originales" (O2, F1 ×4) **contradice** el micro-mensaje "guardamos el original, puedes exportarlo" | [02](02-errores-diseno.md) |
| 3 | 🔴 | S1 móvil | El estado por defecto no tiene disparador para abrir el drawer → nav secundaria, "Conectar IA" y Cuenta quedan inalcanzables | [02](02-errores-diseno.md) |
| 4 | 🔴 | C1/F1/P2/N1 móvil | El bottom-nav solo existe en M1 y P1 móvil; 4 secciones quedan sin ruta de regreso | [01](01-huecos-cobertura.md) |
| 5 | 🔴 | CO6 | El wizard "convertir en colectiva" solo tiene el paso 1; faltan pasos 2 y 3 (incl. la confirmación irreversible) | [01](01-huecos-cobertura.md) |
| 6 | 🔴 | O2 | La celebración dice "247 recuerdos" pero los chips suman 178 (O3, la pantalla gemela, sí cuadra) | [02](02-errores-diseno.md) |
| 7 | 🔴 | M1 | El área "Recetas" tiene tres conteos contradictorios: 64 (mapa) / ausente (lista) / 0 (panel) | [02](02-errores-diseno.md) |
| 8 | 🔴 | SB1/CT2 | Fecha de fin de gracia por cancelación: 19-jul en SB1, 14-jul en CT2 (19-jul es la de *pago fallido*) | [02](02-errores-diseno.md) |
| 9 | 🔴 | SB1 móvil | Solo 1 de los 5 estados obligatorios de SB1 tiene versión móvil (falta reactivar, pago fallido, etc.) | [01](01-huecos-cobertura.md) |
| 10 | 🔴 | C1/S1/P1 | No hay ningún estado visual para "IAs desconectadas por impago" (distinto de "token inválido" o "nunca conectado") | [01](01-huecos-cobertura.md) |
| 11 | 🔴 | CT4 | El formulario de soporte no tiene estados enviando / enviado (nº ticket) / error, aunque su propio diagrama los promete | [01](01-huecos-cobertura.md) |
| 12 | 🔴 | O5 | Falta el estado "O5 sin IA" — el desenlace esperado de todo usuario que no paga en el gate (muestra "1 IA conectada" hardcodeado) | [01](01-huecos-cobertura.md) |

---

## Conteo por severidad

| Severidad | Huecos (01) | Errores (02) | Total |
|---|---|---|---|
| 🔴 Alta | 18 | 14 | **32** |
| 🟡 Media | 32 | 24 | **56** |
| ⚪ Baja | 11 | 17 | **28** |
| **Total** | **61** | **55** | **116** |

## Hallazgos por sección

| Sección | Huecos | Errores | Total |
|---|---|---|---|
| Cover + Flujos | 2 | 2 | 4 |
| Auth (A1, A2) | 3 | 3 | 6 |
| Suscripción (SB1) | 4 | 2 | 6 |
| Shell (S1) | 4 | 4 | 8 |
| Onboarding (O1–O5) | 8 | 6 | 14 |
| Memoria (M1–M6) | 5 | 5 | 10 |
| Pulso (P1, P2) | 4 | 4 | 8 |
| Conexiones (C1, C2, C3) | 6 | 3 | 9 |
| Fuentes (F1) | 6 | 3 | 9 |
| Bandeja (N1) | 5 | 2 | 7 |
| Colectivo + Área unificada | 6 | 1 | 7 |
| Cuenta (CT1–CT4) | 6 | 5 | 11 |
| Patrones transversales | 0 | 2 | 2 |
| Navegación (IA) | 1 | 1 | 2 |
| Copy / tono | 0 | 8 | 8 |
| Freemium | 1 | 4 | 5 |

---

## Lo que está bien (no todo es deuda)

- **El lenguaje visual está definido y es coherente**: "el lima solo brilla sobre lo oscuro" se
  respeta en las 33 pantallas reales de producto (la única violación son 2 badges del diagrama-resumen de flujos).
- **La plantilla de área unificada** (privada = colectiva de un miembro, capa Personas apagada) es
  una buena consolidación que elimina la duplicación M2/CO1 del brief original.
- **Cobertura de estados rica** en las pantallas-firma: Auth, M1 (mapa) y P1 tienen vacío / cargando
  / con datos / error bien resueltos, la mayoría con variante móvil.
- **Los flujos end-to-end existen** (10 diagramas), lo que permitió cruzar cada pantalla contra su
  recorrido y detectar los cortes (ese cruce es de donde salen los hallazgos de arquitectura y freemium).
- **La sección de micro-mensajes de confianza** documenta el patrón Delimitar/Confirmar/Devolver-el-control
  casi verbatim del brief (el problema es de coherencia con el resto, no de la sección en sí).

> **Siguiente paso recomendado**: resolver primero el hallazgo #1 (dónde vive P2 / el acceso) — es una
> decisión de arquitectura que arrastra a Conexiones, Pulso y la navegación, y conviene fijarla antes
> de tocar cualquier otra cosa. Después, la tanda móvil (#3, #4) y las contradicciones de datos/copy
> (#2, #6, #7, #8). Secuencia completa en [03-plan-correccion.md](03-plan-correccion.md).
