# Auditoría de frontend — Savia OS · 2026-06-27

> Auditoría de diseño (fidelidad vs mockup) y de prácticas de código del frontend `apps/app/`
> (Next.js 16, Chakra UI v3) + paquetes `@savia-os/ui` (L2) y `@savia-os/design-tokens` (L1).
> Entregable solo-documentación; no se modificó código de producto.

## Documentos

1. [01-fidelidad-diseno.md](01-fidelidad-diseno.md) — mockup vs implementación, por pantalla/estado, con px medidos en vivo.
2. [02-cobertura-faltante.md](02-cobertura-faltante.md) — los 48 artboards vs lo implementado; faltantes.
3. [03-practicas-codigo.md](03-practicas-codigo.md) — arquitectura/SOLID/tokens/a11y/duplicación + validación MCP Chakra/Next.
4. [04-plan-remediacion.md](04-plan-remediacion.md) — backlog P0→P2, esfuerzo S/M/L, secuencia.

## Método (verificado, no inventado)

- **Mockup**: `Savia - Mockup.dc.html` vía MCP DesignSync (project `2d623175-…`), **48 frames**
  extraídos a local y leídos por-frame (px exactos de los estilos inline).
- **Implementación**: lectura de código + **CSS computado real** medido con Chrome headless sobre
  el dev server `127.0.0.1:4345` (viewport 1320×920). Screenshot: `scratchpad/shot-login-desktop.png`.
- **Chakra v3**: validado con el MCP `chakra-ui` (`v2_to_v3_code_review`, `get_component_props`).
- **Next 16**: validado con el MCP `next-devtools` (docs bundled) + warning en vivo del dev server.
- **Gates** corridos: typecheck (app+ui) ✅ · lint (app+ui) ✅ · build app ✅ · `check-design-tokens` ✅.

---

## Veredicto

El **esqueleto del rediseño existe y, en lo estructural, es bueno**: arquitectura de capas L1/L2/L3
limpia, Chakra v3 moderno y correcto, y las pantallas-firma (login, **mapa de memoria**) están bien
resueltas con estados completos y accesibilidad real. La marca *se siente* en login y en el mapa.

**Pero no está listo para producción**, por cuatro razones que cruzan toda la app:

1. **Controles genéricos** — cada `<Input>`/`<Button>` renderiza a **4px de radio con borde gris
   de Chakra** (medido en vivo) en vez de los **14px + borde de marca** del mockup. Nunca se
   construyó la receta de Input/Button que el propio plan ([08](../../../plan/savia-redesign/08-chakra-audit.md))
   prescribía. Es lo que hace que todo se vea "casi terminado pero genérico".
2. **Sin navegación móvil** — el rail se oculta en `base` y no hay drawer/bottom-nav: en móvil no
   se puede navegar.
3. **Stubs peligrosos "terminados"** — el **paywall** activa la suscripción con un flag local (sin
   cobrar), y el botón **"Eliminar cuenta" no hace nada**. Se ven funcionales; no lo son.
4. **Tipografía sin tokenizar** — los `textStyle` de producto (`pageTitle/cardTitle/metric/caption`)
   están sin usar; ~90 tamaños en px crudos, y el guardrail **no controla tipografía**.

Resueltos los cuatro (P0-1 a P0-4 + tipografía), el producto da el salto de "borrador funcional" a
"se siente como la landing".

---

## Top 10 — los que "rompen todo"

| # | Sev | Problema | Evidencia | Doc |
|---|---|---|---|---|
| 1 | **P0** | Controles a **4px + borde gris Chakra** (vs mockup 14px + `#DDDFDC`); sin receta Input/Button | vivo: `borderRadius 4px`, `border rgb(161,161,170)` | [01 F-LOGIN-1/2], [03 TOK-2] |
| 2 | **P0** | **Sin nav móvil**: rail `display base:none`, drawer "diferido a Fase 4" nunca construido | [shell.tsx:40](../../../../packages/ui/src/organisms/shell.tsx#L40) | [01 F-SHELL-1] |
| 3 | **P0** | **Paywall falso**: "suscribe" con flag local, sin Mercado Pago | [subscription-gate.tsx:31](../../../../apps/app/src/components/billing/subscription-gate.tsx#L31) | [03 STUB-1] |
| 4 | **P0** | **"Eliminar cuenta" muerto** (acción destructiva que no hace nada, sin confirmación 2 pasos) | [cuenta-screen.tsx:129](../../../../apps/app/src/components/cuenta/cuenta-screen.tsx#L129) | [03 STUB-2] |
| 5 | **P1** | **Pulso no es oscuro**: el mockup hace todo el shell ink; el `Shell` no tiene variante dark | [pulso-screen.tsx:44](../../../../apps/app/src/components/pulso/pulso-screen.tsx#L44) | [01 F-PULSO-1] |
| 6 | **P1** | **Tipografía sin `textStyle`**: ~90 `fontSize` px crudos; guardrail no la controla | top: `onboarding/page.tsx` (12) | [03 TOK-1] |
| 7 | **P1** | **Onboarding sin activación**: O4 (conectar 1ª IA) y O5 (mapa naciente) no existen; el stepper salta a `/memoria` | [onboarding/page.tsx:21](../../../../apps/app/src/app/(app)/onboarding/page.tsx#L21) | [01 F-ONB-1] |
| 8 | **P1** | **Arcoíris** hardcodeado en charts — justo lo que [04-memory-map](../../../plan/savia-redesign/04-memory-map.md) mandó matar | [GrowthChart.tsx:18](../../../../apps/app/src/components/dashboard/GrowthChart.tsx#L18) | [03 TOK-3] |
| 9 | **P1** | **Legacy + código muerto**: rutas `/dashboard /drive /spaces /connect /connections` vivas + `AppSidebar.tsx` (252L) y `OtpForm.tsx` (190L) sin uso | nav-config, AppSidebar, OtpForm | [02 §5], [03 DUP/DEAD] |
| 10 | **P1** | **Contenido pobre vs mockup**: M1 sin "Recientes"/búsquedas-en-rail; feed de Pulso de un solo tipo de evento | memory-map, pulso-screen:160 | [01 F-M1-1/2, F-PULSO-2] |

---

## Conteo por severidad (aprox.)

| Sev | Fidelidad (01) | Cobertura (02) | Prácticas (03) | Total aprox. |
|---|---|---|---|---|
| **P0** | 1 (controles)* | — | 3 (móvil, paywall, borrar-cuenta)* | **4** |
| **P1** | ~9 | (faltantes ❌ ~11) | ~13 | **~22** + cobertura |
| **P2** | ~16 | — | ~14 | **~30** |

\* Algunos P0 aparecen en varios docs (mismo hallazgo, distinta lente).

---

## Estado de cobertura

- **Artboards del mockup (48 frames)**: ✅ ~13 · 🟡 ~22 · ❌ ~11. Las 6 superficies con artboard
  (Auth, SB1, Shell, Onboarding, Memoria, Pulso) tienen una versión funcional.
- **Pantallas-código del brief (≈34 estados/superficies, incl. las sin artboard)**: **≈11 completas ·
  ≈15 parciales · ≈8 sin construir**.
- **Confirmado**: el mockup **no** cubre C1–C3, F1, N1, CO1–CO7, CT1–CT4 ni P2 — esas se hicieron
  contra el brief, no contra artboards.
- **Faltan sobre todo**: activación (O4/O5), acceso (P2, CO3/CO4), pago real (SB1/CT2/CT3), soporte
  (CT4), móvil (nav + frames) y estados ricos (feed Pulso, health de conexiones, absorción de Fuentes).

---

## Lo que está bien (no todo es deuda)

- Capas L1/L2/L3 limpias; tokens completos (`spaceScale`, estados, `bg.inverse`, `floatDark`, textStyles).
- **Chakra v3 correcto** — sin patrones v2 (validado por MCP: `colorPalette`, `Field`, `PinInput.Root`).
- **Mapa de memoria** ("el wow"): ink, `spaceColor` determinista, marca latiendo, capa accesible `sr-only`, reduced-motion.
- Estados de Memoria/Pulso orquestados (skeleton/empty/error/poblado, sin spinner global).
- App Router correcto (Suspense en `useSearchParams`, `loading.tsx`/`error.tsx`).
- Login de alta fidelidad (salvo radii de control) y voz de marca consistente (1ª persona, español).

> **Siguiente paso recomendado**: empezar por **P0-1 (receta de controles)** — es el fix de mayor
> ROI visual y desbloquea la sensación de marca en todas las pantallas a la vez. Detalle y secuencia
> en [04-plan-remediacion.md](04-plan-remediacion.md).
