# 03 — Prácticas de código / arquitectura

> Hallazgos de arquitectura, capas, "tokens o nada", duplicación, stubs, frontera
> Server/Client, accesibilidad y consistencia. Cada uno con `archivo:línea`, evidencia y fix.
> Validado contra el **MCP de Chakra v3** y el **MCP de Next 16** donde corresponde.
>
> Severidades: **P0** rompe uso · **P1** desvío notable · **P2** pulido.

---

## §0 — Gates (corridos en esta auditoría)

| Gate | Comando | Resultado |
|---|---|---|
| typecheck app | `pnpm --filter @savia-os/app typecheck` | ✅ exit 0 |
| typecheck ui | `pnpm --filter @savia-os/ui typecheck` | ✅ exit 0 |
| lint app | `pnpm --filter @savia-os/app lint` | ✅ exit 0 |
| lint ui | `pnpm --filter @savia-os/ui lint` | ✅ exit 0 |
| build app | `pnpm --filter @savia-os/app build` | ✅ exit 0 |
| tokens guardrail | `node scripts/check-design-tokens.mjs` | ✅ "sin colores crudos fuera del allowlist" |
| Next 16 dev | `next dev` | ⚠️ **"The 'middleware' file convention is deprecated. Please use 'proxy' instead."** |

Verde en lo automatizado. **Pero** el guardrail de tokens tiene puntos ciegos grandes (§4) y la
deuda allowlisted sigue sin migrar.

---

## §1 — Capas L1/L2/L3 — **bien**

La separación de [05-shared-design-system](../../../plan/savia-redesign/05-shared-design-system.md)
se respeta:

- **L1** `@savia-os/design-tokens`: datos puros, **sin `"use client"`** ([index.ts] ✓), `system`
  vía `createSystem`. `spaceScale`, estados, `bg.inverse`, `floatDark`, textStyles de producto
  todos presentes ([tokens.ts](../../../../packages/design-tokens/src/tokens.ts)).
- **L2** `@savia-os/ui`: marca + genéricos. `Card` (receta flat/elevated/inverse/interactive),
  `Dialog`, `ConfirmDialog`, `Toaster/notify`, `EmptyState`, `Skeleton`, `Field`, `StatusBadge`,
  `Avatar`, `OtpInput`, `CopyBlock`, `ProgressBar`, `SearchBar`, `Stepper`, `MetricStat`, `DropZone`,
  `CommandPalette`, `NavItem`, `Shell`. Barrel limpio en `index.ts`.
- **L3** `apps/app`: `SpaceGlyph`, `MemoryMap/Canvas/Cell`, paneles de dominio, `space-colors.ts`,
  `pack-layout.ts`. `SpaceGlyph` correctamente en L3 (usa `spaceColor`). ✓

**Observaciones menores:**

| ID | Hallazgo | Sev |
|---|---|---|
| A-1 | El inventario [07](../../../plan/savia-redesign/07-component-inventory.md) listaba `SubscriptionGateModal`, `AccessMatrix`, `NotificationsTray` como L2 genéricos; en realidad `SubscriptionGate` vive en L3 (`billing/`) y `AccessMatrix`/`NotificationsTray` no existen. No es un error de capa, sí de cobertura. | P2 |
| A-2 | Primitivas Chakra usadas inline sin wrapper L2 (`Kbd`, `Tooltip`, `Separator`, `Spinner`, `IconButton`, `Input`). Aceptable (built-in), pero **`Input` sí necesitaba receta** (radii/dark-form) y no la tiene → §4 / F-LOGIN-1. | P1 |

---

## §2 — Chakra v3 — **uso correcto** (validado con MCP)

`grep` de patrones v2 (`colorScheme=`, `isDisabled=`, `isLoading=`, `leftIcon=`, `<Divider`,
`<Modal`, `spacing=` en Stack, `apply=`) → **0 resultados** en `apps/app/src` y `packages/ui/src`.

Validado contra `mcp__chakra-ui__v2_to_v3_code_review`:

| Escenario | Estándar v3 | En el código |
|---|---|---|
| `colorScheme_to_colorPalette` | `colorPalette` | ✅ usa `colorPalette` (login, pulso, members…) |
| `form_control_to_field` | `Field.Root/Label/ErrorText` | ✅ wrapper `Field` propio sobre el patrón |
| `pin_input_changes` | `PinInput.Root` + `HiddenInput`+`Control`+`Input index` | ✅ [otp-input.tsx:19-26](../../../../packages/ui/src/primitives/otp-input.tsx#L19) |
| `modal_to_dialog` | `Dialog` | ✅ `Dialog`/`ConfirmDialog` propios |
| `divider_to_separator` | `Separator` | ✅ no usa `Divider` |

**Único hallazgo (forward-compat):**

| ID | Hallazgo | Evidencia | Sev |
|---|---|---|---|
| CHK-1 | `OtpInput` no pasa `count`. El MCP indica que `PinInput` `count` *"will be required in next major version"* (mejora aria SSR). | [otp-input.tsx:19](../../../../packages/ui/src/primitives/otp-input.tsx#L19) | P2 |

**Veredicto**: no afirmar "Chakra mal usado" — está moderno y correcto. El problema no es *cómo* se
usa Chakra, sino *qué no se tematizó* (controles, §4).

---

## §3 — Frontera Server/Client + App Router (Next 16)

**Bien:**
- `useSearchParams` envuelto en `Suspense` a nivel de página ([login/page.tsx:83](../../../../apps/app/src/app/(auth)/login/page.tsx#L83),
  [memoria/resultados/page.tsx:9](../../../../apps/app/src/app/(app)/memoria/resultados/page.tsx#L9)) — convención correcta de Next 16 (docs bundled `proxy.md`/streaming).
- `memoria` tiene `loading.tsx` + `error.tsx` (streaming + error boundary). ✓

**Hallazgos:**

| ID | Hallazgo | Evidencia | Sev | Fix |
|---|---|---|---|---|
| **NX-1** | **`middleware.ts` deprecado** en Next 16 → renombrar a `proxy.ts`. Confirmado en vivo por el dev server. | [middleware.ts](../../../../apps/app/src/middleware.ts) + warning de `next dev` | **P1** | renombrar a `proxy.ts` (export `proxy`); docs bundled `01-app/01-getting-started/16-proxy.md` |
| NX-2 | `"use client"` por default: **75%** de `.tsx` en app (56/75), **83%** en ui (20/24); **10 `page.tsx` son client** (`colectivo`, `colectivo/[id]`, `colectivo/convertir`, `conexiones/nueva`, `memoria/[id]`, `memoria/nueva`, `memoria/busquedas`, `onboarding`, `dashboard`, `invitar/[token]`). Páginas de detalle que podrían fetch en server y streamear. | varios | P2 | mover fetch a server components / `Suspense`; dejar client solo el árbol interactivo |
| NX-3 | Sin intercepting/parallel routes para modales deep-link (M3 crear-área, M6 recuerdo, SB1). Se resolvió con páginas/dialogs. | `memoria/nueva` (página) | P2 | `@modal` slot para M3/M6 según mockup |

---

## §4 — "Tokens o nada" — el mayor hueco sistémico

### 4a. Tipografía: los `textStyle` de producto no se usan

- `textStyle=` solo se usa para **`label`** (eyebrows). Los estilos de producto definidos en
  [text-styles.ts](../../../../packages/design-tokens/src/text-styles.ts) —`pageTitle`, `cardTitle`,
  `metric`, `caption`— están **prácticamente sin consumir**. Las métricas usan `fontSize="displayLg"`
  suelto, no `textStyle="metric"`.
- **`fontSize=` : 217 ocurrencias** · **`fontWeight=` : 116** · **~90 tamaños en px crudos**
  (`fontSize="13px"`, `"14px"`, `"15px"`…). El rúbrico de [03-roadmap](../../../plan/savia-redesign/03-roadmap.md)
  dice explícito: *"Tipografía por `textStyle`, sin `fontSize`+`fontWeight` sueltos"*.

Top ofensores: `onboarding/page.tsx` (12), `connect/page.tsx` (10), `onboarding/ImportStep.tsx` (8),
`cuenta-screen.tsx` (7), `subscription-gate.tsx` (7), `login-form.tsx` (7), `memoria/busquedas/page.tsx` (7).

| ID | Hallazgo | Sev | Fix (elegante, no sweep inline) |
|---|---|---|---|
| **TOK-1** | `textStyle` de producto sin adoptar; ~90 `fontSize` en px crudos. **El guardrail no controla tipografía** (§4c). | **P1** | **(L2)** componentes semánticos que envuelven los `textStyle` (`PageTitle/SectionTitle/CardTitle/Metric/Caption`) → las pantallas usan `<Metric>` en vez de `fontSize=…`; **(gate)** regla que rechaza `fontSize`+`fontWeight` sueltos. El valor es el vocabulario + el gate, no el barrido manual. |

### 4b. Radii de control y colores crudos

| ID | Hallazgo | Evidencia | Sev |
|---|---|---|---|
| **TOK-2** | **Causa raíz (verificada)**: Button (`recipes/button.js:13`) e Input (`recipes/input.js`) de Chakra usan `borderRadius:"l2"`; semantic `l2→{radii.sm}→4px`. La marca nunca redefinió `l1/l2/l3` → controles a **4px** (vivo) vs mockup 11–14px. Borde del input renderiza **gris `rgb(161,161,170)`** aunque `--chakra-colors-border=#DDDFDC` ✓ (el control no consume el token). | login-form.tsx:86; falta el rung de control en [tokens.ts](../../../../packages/design-tokens/src/tokens.ts) | **P0** |
| **TOK-2-fix** | **Fix elegante**: override `radii.l2/l3` (1 edit → todos los controles) + registrar receta `input`/`button` en `createSystem` (patrón del `card` existente, [index.ts:48](../../../../packages/design-tokens/src/index.ts#L48)) con `borderColor:"border"` + variante `dark-form`. **Nunca estilar un control inline.** | — | — |
| **TOK-3** | **Paleta arcoíris** hardcodeada en charts — justo lo que [04-memory-map §5](../../../plan/savia-redesign/04-memory-map.md) mandó matar. 8 colores + ejes `#718096`. **Fix**: inyectar `spaceColor()` (la rampa que ya usa el mapa) + ejes `fg.muted`. | [GrowthChart.tsx:18-19,127,138](../../../../apps/app/src/components/dashboard/GrowthChart.tsx#L18) | **P1** |
| TOK-4 | Colores Chakra crudos de estado (`orange.500/green.600/red.500/red.400`). **Fix elegante**: usar `StatusBadge` (ya existe en L2, consume `status.*`, ícono+texto) en vez de swap `red.500`→`danger.fg` inline → elimina el color crudo **y** el "solo color" (a11y) de un golpe. | [FileCard.tsx:22-24](../../../../apps/app/src/components/drive/FileCard.tsx#L22), [UploadButton.tsx:77](../../../../apps/app/src/components/drive/UploadButton.tsx#L77), [GrowthStats.tsx:50](../../../../apps/app/src/components/dashboard/GrowthStats.tsx#L50), [SpaceForm.tsx:62](../../../../apps/app/src/components/spaces/SpaceForm.tsx#L62) | P1 |
| TOK-5 | Hex crudo `#ffffff` en L2 **no detectado** por el guardrail (no escanea `packages/`). | [savia-particles.tsx:7](../../../../packages/ui/src/brand/savia-particles.tsx#L7) | P2 |

### 4c. El guardrail `check-design-tokens.mjs` — puntos ciegos

Leído ([scripts/check-design-tokens.mjs](../../../../scripts/check-design-tokens.mjs)). Pasa **solo
porque** los 6 ofensores están en su `ALLOWLIST` (deuda declarada): `layout.tsx`, `GrowthChart`,
`GrowthStats`, `SpaceForm`, `FileCard`, `UploadButton`.

| ID | Punto ciego | Sev |
|---|---|---|
| GRD-1 | **Solo escanea `apps/app/src`** — `packages/ui/src` y `packages/design-tokens` quedan fuera (de ahí TOK-5). | P1 |
| GRD-2 | **No controla tipografía** (`fontSize`/`fontWeight`/px) — TOK-1 invisible. | P1 |
| GRD-3 | No detecta hex de 3 dígitos (`#fff`), `rgb()/rgba()/hsl()`, ni nombres CSS. | P2 |
| GRD-4 | Salta líneas-comentario y los 6 archivos allowlisted — la deuda real (14 hits) sigue oculta. | P2 |

---

## §5 — Duplicación y código muerto

| ID | Hallazgo | Evidencia | Sev | Fix |
|---|---|---|---|---|
| **DUP-1** | **Segmented toggle duplicado**: mismo `HStack bg=bg.subtle rounded p=1` + `chakra.button aria-pressed` en dos sitios (solo difiere `px`). | [memory-map.tsx:86-118](../../../../apps/app/src/components/memory/memory-map.tsx#L86) (Mapa/Lista) y [mcp-config.tsx:21-44](../../../../apps/app/src/components/connections/mcp-config.tsx#L21) (selector cliente) | P1 | extraer `SegmentedToggle` a L2 (`segment-group` de Chakra) |
| **DUP-2** | **Login duplicado**: `OtpForm.tsx` (190 L, estilo dark, **sin uso**) vs `login-form.tsx` (el vivo). | [OtpForm.tsx](../../../../apps/app/src/components/auth/OtpForm.tsx) | P1 | borrar `OtpForm.tsx`; actualizar doc 06 |
| DEAD-1 | `AppSidebar.tsx` (**252 L**) — sidebar+drawer **no renderizado** por nadie (reemplazado por `AppShell`). | [AppSidebar.tsx](../../../../apps/app/src/components/layout/AppSidebar.tsx) | P1 | borrar (o portar su drawer a `Shell` para F-SHELL-1) |
| DEAD-2 | `nav-config.tsx` — `NAV_GROUPS` apunta a **rutas legacy** y no lo usa el shell vivo (usa `lib/nav.tsx`). | [nav-config.tsx:27-40](../../../../apps/app/src/components/layout/nav-config.tsx#L27) | P2 | borrar |
| DUP-3 | Steps de onboarding inline en `page.tsx` **y** componentes paralelos `components/onboarding/{ImportStep,RescueStep,SuggestedSpaces}.tsx` (probable no-uso de estos últimos). | onboarding/page.tsx vs components/onboarding/* | P2 | consolidar a un set |
| DUP-4 | `McpConfigBlock.tsx` (connect, legacy) vs `mcp-config.tsx` (conexiones) — dos bloques de config MCP. | connect/ vs connections/ | P2 | unificar en uno (L2/L3) |

---

## §6 — Stubs / TODO backend (riesgo de producción)

Nada de `mock`/`dummy`/`hardcoded data`. Pero sí **funciones que fingen éxito sin backend** — el
riesgo más serio porque la UI se ve "terminada":

| ID | Hallazgo | Evidencia | Sev |
|---|---|---|---|
| **STUB-1** | **Paywall falso**: el gate "activa" la suscripción con un **flag local**, sin Mercado Pago. Un usuario "se suscribe" sin que se cobre nada. | [subscription-gate.tsx:31,38](../../../../apps/app/src/components/billing/subscription-gate.tsx#L31), [use-subscription.ts:9](../../../../apps/app/src/lib/use-subscription.ts#L9) | **P0** |
| **STUB-2** | **Botón "Eliminar cuenta" muerto** — no llama a ningún endpoint (la acción más destructiva del producto **no hace nada**, y tampoco hay confirmación en 2 pasos del brief). | [cuenta-screen.tsx:129](../../../../apps/app/src/components/cuenta/cuenta-screen.tsx#L129) | **P0** |
| STUB-3 | "Exportar mis datos" — botón muerto (`TODO` job). | [cuenta-screen.tsx:99](../../../../apps/app/src/components/cuenta/cuenta-screen.tsx#L99) | P1 |
| STUB-4 | Búsquedas guardadas solo en `localStorage` (sin endpoint). | [saved-searches.ts:4](../../../../apps/app/src/lib/saved-searches.ts#L4) | P1 |
| STUB-5 | Feed de Pulso con un solo tipo de evento (`TODO`: aportó/reorganizó/revert). | [pulso-screen.tsx:160](../../../../apps/app/src/components/pulso/pulso-screen.tsx#L160) | P1 |
| STUB-6 | Bandeja sin tipos reales (`TODO`: invitaciones/procesos). | [bandeja-screen.tsx:62](../../../../apps/app/src/components/bandeja/bandeja-screen.tsx#L62) | P1 |
| STUB-7 | Badge del bell siempre encendido (`TODO`). | [AppShell.tsx:112](../../../../apps/app/src/components/layout/AppShell.tsx#L112) | P2 |

> Recomendación: estas pantallas deben **deshabilitar visiblemente** la acción ("Próximamente"/
> tooltip) en lugar de simular éxito. STUB-1 y STUB-2 no deben llegar a producción tal cual.

---

## §7 — SOLID / presentación vs datos

| ID | Hallazgo | Sev | Fix |
|---|---|---|---|
| SOL-1 | Sin librería de datos (SWR/React Query). **~25 componentes** hacen fetch imperativo en `useEffect` con `.catch(()=>[])` que **traga errores**. Solo `use-memory-data.ts` extrae el patrón a un hook. | P1 | extraer hooks por dominio (`useConnections`, `useSources`…); no tragar errores → estado de error real |
| SOL-2 | Orquestación correcta donde existe: `MemoriaScreen` separa loading/error/empty/poblado en componentes ([memoria-screen.tsx](../../../../apps/app/src/components/memory/memoria-screen.tsx)). Buen patrón a replicar. | — (positivo) | — |
| SOL-3 | `AppShell` (organismo) hace `api.me()` + `api.growth.areas()` en mount ([AppShell.tsx:30-33](../../../../apps/app/src/components/layout/AppShell.tsx#L30)). Aceptable (datos de chrome) pero acopla shell a API. | P2 | inyectar por contexto/props |

---

## §8 — Accesibilidad

**Bien**: `aria-label` consistente en icon-buttons; `useReducedMotion` en 6 componentes de motion;
`memory-cell` (`role="button"`+aria-label) y `memory-list` (`role="link"`); SVGs decorativos
`aria-hidden`; **capa accesible `sr-only`** del mapa junto al canvas ([memory-map.tsx:76](../../../../apps/app/src/components/memory/memory-map.tsx#L76));
`NavItem` con `_focusVisible` (outline ink).

| ID | Gap | Sev | Fix |
|---|---|---|---|
| **A11Y-1** | **Sin navegación móvil** → en móvil no hay forma (teclado/táctil) de cambiar de sección (F-SHELL-1). | P0 | drawer/bottom-nav |
| A11Y-2 | `alt=`/`VisuallyHidden`/`sr-only` = 0 ocurrencias salvo el mapa; sin convención de texto alternativo para imágenes futuras. | P2 | convención `alt` |
| A11Y-3 | `role=` total = 4; semántica explícita mínima fuera de nativos. Verificar que `role="button"`/`"link"` tengan handler de teclado (Enter/Space), no solo el rol. | P2 | añadir `onKeyDown` donde falte |
| A11Y-4 | Estados por color en charts/estados legacy (TOK-4) sin ícono+texto en algunos casos. | P2 | `StatusBadge` (ícono+texto) en vez de color crudo |

---

## §9 — Consistencia / convenciones

| ID | Hallazgo | Sev |
|---|---|---|
| CON-1 | **Naming mixto** de componentes: PascalCase legacy (`FileCard.tsx`, `SpaceCard.tsx`, `AppSidebar.tsx`, `OtpForm.tsx`) vs kebab-case nuevo (`memory-map.tsx`, `pulso-screen.tsx`, `login-form.tsx`). Conviven dos convenciones por la transición. | P2 |
| CON-2 | Anchos de contenedor sin unificar (existen tokens `sizes.container*` poco usados); el main del shell usa padding fijo. | P2 |
| CON-3 | Voz en 1ª persona y español ✓ (consistente y de calidad en las pantallas nuevas). | — (positivo) |
| CON-4 | `relative-time.ts` español ✓; buen detalle de marca. | — (positivo) |

---

## §10 — Lo que está bien (para no desbalancear)

- Arquitectura de capas L1/L2/L3 limpia y bien separada.
- Chakra v3 moderno y correcto (validado por MCP).
- `MemoryCanvas` (el "wow") bien resuelto: ink, `spaceColor` determinista, marca latiendo, capa
  accesible, reduced-motion.
- Estados de Memoria/Pulso bien orquestados (skeleton/empty/error/poblado sin spinner global).
- Suspense + loading/error de App Router correctos.
- Login de alta fidelidad (salvo radii de control).
