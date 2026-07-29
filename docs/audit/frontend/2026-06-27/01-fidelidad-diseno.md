# 01 — Fidelidad de diseño (mockup vs implementación)

> Auditoría por pantalla y estado: valor del **mockup** (`Savia - Mockup.dc.html`,
> DesignSync project `2d623175-b533-4976-8ad2-d16668f45ad7`, 48 frames, estilos inline
> en px exactos) vs **implementación** (código + CSS computado real medido con Chrome
> headless sobre el dev server `127.0.0.1:4345`, viewport 1320×920).
>
> Severidades: **P0** rompe percepción/uso · **P1** desvío notable · **P2** pulido.
>
> **Método de medición**: el código hardcodea los px (no usa el sistema de radii/control
> de marca para botones/inputs), así que el "actual" se toma del código y se **valida en
> vivo** con `getComputedStyle` donde fue posible (login). Screenshot: `scratchpad/shot-login-desktop.png`.

---

## Referencia de tokens (para leer la tabla)

| Concepto | Chakra default | Tokens Savia ([tokens.ts](../../../../packages/design-tokens/src/tokens.ts)) | Mockup usa |
|---|---|---|---|
| radii controles | sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 | `chip` 16 · `message` 22 · `card` 28 · `panel` 40 | inputs/botones **14** · nav **12** · search **13** · icon-btn **11** · cards **14/16** |
| color línea | gray.* | `line` **#DDDFDC** · `border`→line | #DDDFDC |
| ink / paper / lima | — | `ink` #0B2529 · `paper` #F4F4F1 · `signalLime` #E7FF18 | idénticos ✓ |

**Hallazgo transversal de tokens (causa raíz verificada en `@chakra-ui/react@3.36`)**: las recetas de
Chakra para **Button** (`recipes/button.js:13`) e **Input** (`recipes/input.js`) usan
`borderRadius:"l2"`, y el semantic radii `l2 → {radii.sm} → 0.25rem (4px)`. La marca **nunca redefinió
el escalón de control** (`l1/l2/l3`), así que cae al default de Chakra (4px) — confirmado en vivo
(`--chakra-radii-l2 = 4px`). El mockup pide 11–14px. La
[08-chakra-audit.md](../../../plan/savia-redesign/08-chakra-audit.md) prescribía la receta Input/Button
— no se construyó. **El fix NO es estilar cada control inline**: un override de `radii.l2/l3` en
`design-tokens` arregla **todos** los controles a la vez (ver [04 §P0-1](04-plan-remediacion.md)). → F-LOGIN-1.

---

## A — LOGIN (A1/A2) · `(auth)/login`

Estado de implementación: **alto**. Split-panel ink+paper, journey de 3 pasos, OTP 6 celdas,
cooldown. La marca recibe. Coincidencias exactas: ancho panel ink **607px** (=46% de 1320 ✓),
bg ink/paper/lima, journey (círculos 28px, gap 14px), eyebrow por `textStyle="label"`.

| ID | Elemento | Mockup (frame 02) | Actual (medido/código) | Sev | Fix |
|---|---|---|---|---|---|
| **F-LOGIN-1** | `<Input>` y `<Button>` radio | border-radius **14px** | **4px** (vivo) — `l2→sm→4px`, verificado | **P0**¹ | **override `radii.l2/l3`** en `design-tokens` (1 edit → todos los controles). NO inline |
| **F-LOGIN-2** | Borde del input | `#DDDFDC` (brand `line`) | **`rgb(161,161,170)`** (vivo) aunque `--chakra-colors-border=#DDDFDC` ✓ — el control no consume el token | **P0**¹ | registrar receta `input` en `createSystem` (patrón del `card` ya existente) que fije `borderColor:"border"` + radio de control + variante `dark-form` |
| F-LOGIN-3 | Botón "Enviarme un código" peso | `font:600` | **500** (default Chakra `lg`) | P2 | `fontWeight` en receta Button |
| F-LOGIN-4 | h3 "Entra a tu memoria." | **40px** fijo, w300, lh 1.02 | **44.88px** (vivo; `displayMd`=clamp(2rem,3.4vw,3.35rem)) | P2 | aceptable; si se quiere paridad exacta usar 40px fijo. Peso/lh ✓ |
| F-LOGIN-5 | Statement izq. "…conecta todas tus IAs" | **40px** fijo, w300, lh 1.04 | `display2xl` (~**66px** @1320, clamp 2.35rem→5vw→5rem) | P2 | desvío deliberado hacia `docs/design` ("contraste dramático"); login fue validado — documentar como intencional |
| F-LOGIN-6 | Padding panel ink | 46px 44px | 48px (`p=12`, vivo) | P2 | usar 46/44 si se busca paridad; diferencia imperceptible |
| F-LOGIN-7 | Padding form (panel paper) | **64px** vert · 56px horiz | 56px ambos (`p=14`) | P2 | `py` mayor que `px` para igualar el mockup |
| F-LOGIN-8 | Input padding-left | 18px | 16px (vivo) | P2 | en la receta Input |

¹ El desvío **en login** es visualmente P2, pero la causa (controles a 4px/borde gris) es **sistémica
→ P0**: afecta cada input/botón del producto. Por eso se prioriza como P0 en [README](README.md) y [04](04-plan-remediacion.md).

**Nota de duplicación (ver 03)**: la página monta [`login-form.tsx`](../../../../apps/app/src/components/auth/login-form.tsx)
(el vivo, sobre paper, botón ink). Existe además [`OtpForm.tsx`](../../../../apps/app/src/components/auth/OtpForm.tsx)
(190 líneas, estilo **dark-form** con `darkInput` + botón lima) **sin usar**. La doc
[06-execution §S1.1](../../../plan/savia-redesign/06-execution.md) referencia `OtpForm.tsx` →
drift doc↔código. El `OtpForm.tsx` muerto contradice la regla del lima (botón lima sobre form, no
sobre ink completo) y debe borrarse.

---

## S1 — SHELL · `(app)/layout.tsx` → `AppShell` → `Shell`

Estado: **alto** en desktop. Coincidencias **exactas**: rail **240px** (`w=60`), topbar **72px**
(`h=18`), search `maxW=560px`, gap de nav **4px** (`gap=1`), padding rail 24/16, `pb` logo 24.
[`shell.tsx`](../../../../packages/ui/src/organisms/shell.tsx).

| ID | Elemento | Mockup (frame 17/34) | Actual ([archivo:línea]) | Sev | Fix |
|---|---|---|---|---|---|
| **F-SHELL-1** | Navegación móvil | móvil = nav inferior + drawer (frames 19/20) | **inexistente**: rail `display={{base:"none",md:"flex"}}` y `Shell` difiere el drawer a "Fase 4" — no construido ([shell.tsx:40-41](../../../../packages/ui/src/organisms/shell.tsx#L40), comentario L26-27) | **P0** | en móvil **no hay forma de navegar**. Construir drawer (`AnimatePresence`+focus trap) o bottom-nav. `AppSidebar.tsx` tiene un drawer pero está huérfano |
| **F-SHELL-2** | Shell oscuro (acento) | P1 hace **todo** el shell ink (rail+topbar+contenido, frame 48) | `Shell` es siempre paper/blanco; no hay variante dark | **P1** | añadir prop `tone`/variant ink al `Shell` (ver F-PULSO-1) |
| F-SHELL-3 | NavItem radio | 12px | `chip`=**16px** ([nav-item.tsx:21](../../../../packages/ui/src/organisms/nav-item.tsx#L21)) | P2 | usar `xl`(12) en NavItem |
| F-SHELL-4 | NavItem activo | pill ink + label **paper** + ícono lima | label **e** ícono lima completos ([nav-item.tsx:38-42](../../../../packages/ui/src/organisms/nav-item.tsx#L38)) | P2 | el mockup es más sobrio (solo ícono lima); decisión de marca, documentar |
| F-SHELL-5 | NavItem padding-y | 12px | 10px (`py=2.5`) | P2 | `py=3` |
| F-SHELL-6 | SaviaMark rail | 26px | 24px ([shell.tsx:55](../../../../packages/ui/src/organisms/shell.tsx#L55)) | P2 | `size={26}` |
| F-SHELL-7 | Topbar padding-x | 26px | 24px (`px=6`) | P2 | imperceptible |
| F-SHELL-8 | Gap acciones topbar | 14px | 12px (`gap=3`, [AppShell](../../../../apps/app/src/components/layout/AppShell.tsx#L95)) | P2 | `gap=3.5` |
| F-SHELL-9 | Padding main | 54px 56px | 48px vert (`py=12`) · 56px horiz | P2 | `py=14`-ish |
| F-SHELL-10 | Punto del bell | solo si hay no-leídas | **siempre visible** (`TODO(fase4)`, [AppShell:112](../../../../apps/app/src/components/layout/AppShell.tsx#L112)) | P2 | condicionar a no-leídas |

---

## M1 — MEMORIA (mapa) · `(app)/memoria` → `MemoriaScreen`/`MemoryMap`

Estado: **medio-alto**. El **mapa coincide** con el mockup: superficie **ink** `rounded card`(28px),
glow lima, `SaviaMark` latiendo, celdas `spaceColor` (no arcoíris), capa accesible `sr-only`
([memory-canvas.tsx:48-119](../../../../apps/app/src/components/memory/memory-canvas.tsx#L48)). Buen
trabajo del "wow". Faltan elementos de contenido del frame 34.

| ID | Elemento | Mockup (frame 34) | Actual | Sev | Fix |
|---|---|---|---|---|---|
| **F-M1-1** | Sección "Recientes" | 3 cards de fuente (Claude/Cursor/file) bajo el mapa | **ausente** ([memory-map.tsx](../../../../apps/app/src/components/memory/memory-map.tsx) solo hero+toggle+canvas) | **P1** | añadir `Recientes` (consume `growth.accessActivity`/feed); link "Ver en Pulso →" |
| **F-M1-2** | "Búsquedas guardadas" en el rail | sección de nav en el rail con 2 búsquedas + conteo | **ausente**: el `railFooter` de [AppShell:63](../../../../apps/app/src/components/layout/AppShell.tsx#L63) solo trae la cuenta | **P1** | inyectar búsquedas guardadas al rail (hoy son una página aparte `/memoria/busquedas`) |
| F-M1-3 | Leyenda del mapa | top-right "● Viva / 🔒 Sensible" | ausente | P2 | añadir leyenda + señales por celda |
| F-M1-4 | Señales por celda | anillo sub-áreas, borde dashed "sensible", dot "viva" | ausente (celda lisa) | P2 | requiere exponer `kind/sensitive/subCount` en `AreaDto` |
| F-M1-5 | Hero métrica | **58px** fijo, lh .9 | `displayLg` ~**53px** @1320, lh .9 ✓ | P2 | cercano; ok |
| F-M1-6 | View toggle radios | track 11px, pill 9px, pad 3px | track `lg`(8), pill `md`(6), pad 4px ([memory-map.tsx:88-116](../../../../apps/app/src/components/memory/memory-map.tsx#L88)) | P2 | y además **duplicado** (ver 03 → `SegmentedToggle`) |
| F-M1-7 | "Crear área" (M3) | **modal** sobre M1 | **página** `/memoria/nueva` | P2 | el brief y mockup lo piden como modal deep-link (intercepting route `@modal`) |
| F-M1-8 | "Recuerdo" (M6) | **frame** propio | **dialog** (`memory-detail-dialog`) | P2 | aceptable, pero el mockup M6 es pantalla; decidir patrón |

---

## P1 — PULSO · `(app)/pulso` → `PulsoScreen`

Estado: **medio**. El contenido es ink con glow ✓, pero la firma "shell oscuro" no se logra y el
feed es mucho más pobre que el mockup.

| ID | Elemento | Mockup (frame 48) | Actual ([pulso-screen.tsx](../../../../apps/app/src/components/pulso/pulso-screen.tsx)) | Sev | Fix |
|---|---|---|---|---|---|
| **F-PULSO-1** | Shell oscuro | rail **ink**, topbar **ink**, nav "Pulso"=pill **lima**, todo el chrome dark | solo el `<Box bg=bg.inverse>` del contenido es ink; el rail/topbar siguen blancos ([pulso-screen.tsx:44](../../../../apps/app/src/components/pulso/pulso-screen.tsx#L44)) | **P1** | depende de F-SHELL-2 (variante dark del `Shell`) |
| **F-PULSO-2** | Feed de eventos | tipos ricos: "Claude recordó 3 cosas (contribuyó)", "Cursor consultó (leyó)", "Savia separó… **Revertir**" | **un solo tipo**: "X consultó N veces · leyó"; sin contribuyó/reorganizó/revert (`TODO(backend)` [L160](../../../../apps/app/src/components/pulso/pulso-screen.tsx#L160)) | **P1** | requiere tipos de evento del backend; UI debe soportar variantes + acción revert |
| F-PULSO-3 | "Resumen de IAs" | columna con cada IA + última consulta | ausente (la columna derecha es solo `GrowthChart`) | P1 | añadir resumen por conexión |
| F-PULSO-4 | h2 "Tu memoria, en vivo." | **34px** | `displayMd` ~45px | P2 | usar 34px o un textStyle dedicado |
| F-PULSO-5 | P2 (acceso/auditoría) | — (sin artboard, brief P2) | **no implementado** | P1 | ver cobertura (02) |

---

## O1–O5 — ONBOARDING · `(app)/onboarding`

Estado: **parcial / en curso** ([03-roadmap](../../../plan/savia-redesign/03-roadmap.md) lo marca
🚧). El mockup tiene O1, O2(importar/rescatar +procesando/éxito), O4(conectar +verificación
+celebración), O5(listo +mapa naciente).

| ID | Elemento | Mockup (frames 21–33) | Actual ([onboarding/page.tsx](../../../../apps/app/src/app/(app)/onboarding/page.tsx)) | Sev | Fix |
|---|---|---|---|---|---|
| **F-ONB-1** | Pasos O4 + O5 | "Conectar primera IA" (paso **protagonista**) + "Listo / tu memoria está viva" | **no implementados**: `stepIndex = step==="welcome" ? 0 : 1` ([L21](../../../../apps/app/src/app/(app)/onboarding/page.tsx#L21)) nunca llega a Conectar/Listo; import/rescue → `router.push("/memoria")` | **P1** | construir O4 (reusa C3 + verificación en vivo) y O5 (mapa naciente). Es la **activación** del producto |
| F-ONB-2 | "Memoria encendiéndose" | recuerdos apareciendo 1×1 (`FadeInUp` staggered) en O2·procesando | no presente (import va directo) | P2 | animación de resultado |
| F-ONB-3 | Tipografía | mode-cards 20px, h2 46px, etc. | **px sueltos** (12 `fontSize`, 7 `fontWeight` en el archivo) sin `textStyle` | P2 | ver 03 (tipografía) |
| F-ONB-4 | Duplicación de steps | — | el page define `WelcomeStep/ImportStep/RescueStep` **inline** mientras existen `components/onboarding/{ImportStep,RescueStep,SuggestedSpaces}.tsx` aparte | P2 | consolidar; los de `components/onboarding/` parecen no usarse por el page |

---

## SB1 — Gate de suscripción · `components/billing/subscription-gate.tsx`

| ID | Elemento | Mockup (frames 13–16) | Actual | Sev | Fix |
|---|---|---|---|---|---|
| F-SB1-1 | Pasarela | CTA → Mercado Pago (hosted) | **stub**: "activa" la suscripción con un flag local; sin Mercado Pago (`TODO(backend)` [subscription-gate.tsx:31,38](../../../../apps/app/src/components/billing/subscription-gate.tsx#L31)) | **P0**¹ | ver 03 — un paywall que se "paga" sin cobrar es riesgo de producción |
| F-SB1-2 | Estados de pago | procesando/fallido/exitoso (frame 15) | parciales (sin flujo real de pago) | P1 | depende del backend |

¹ severidad de **práctica/producto**, no de fidelidad visual; se lista aquí por contexto SB1 y se detalla en [03](03-practicas-codigo.md).

---

## Pantallas sin artboard (construidas contra el brief, no contra el mockup)

C1–C3 (conexiones), F1 (fuentes), N1 (bandeja), CO1–CO7 (colectivo), CT1–CT4 (cuenta) y P2 **no
tienen frame en el mockup** (confirmado: 48 frames, ninguno cubre estas superficies). Su fidelidad
se evalúa contra `mockup-requirements.md`/`mockup-v2.md` y `docs/design`, no contra px de artboard.
Hallazgos principales en [02-cobertura](02-cobertura-faltante.md) y [03-prácticas](03-practicas-codigo.md):
notablemente, varias arrastran colores Chakra crudos (FileCard/UploadButton/GrowthStats),
`window.confirm` (FileGrid/SpaceCard) y stubs (cuenta export/borrar).

---

## "Detalles que rompen todo" (fidelidad)

1. **Controles a 4px + borde gris** (F-LOGIN-1/2): cada input y botón del producto se ve más
   cuadrado y genérico que el mockup. Es lo primero que delata "no terminado".
2. **Pulso no es oscuro** (F-PULSO-1 + F-SHELL-2): la pantalla-firma del loop del producto pierde
   su dramatismo porque el chrome no acompaña.
3. **Sin navegación móvil** (F-SHELL-1): en móvil el producto queda sin nav.
4. **Onboarding sin activación** (F-ONB-1): el "wow" de conectar la primera IA y ver nacer el mapa
   —el punto del onboarding— no existe todavía.
