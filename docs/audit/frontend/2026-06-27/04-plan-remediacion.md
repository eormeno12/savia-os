# 04 — Plan de remediación (backlog priorizado)

> Backlog accionable P0→P2. **Cada fix se resuelve en la capa correcta**, no parcheando campos
> inline pantalla por pantalla. Esfuerzo: **S** ≤0.5d · **M** ~1–2d · **L** ≥3d. "BE" = backend.

---

## Principio rector — "subir el fix una capa"

La auditoría encontró el mismo patrón una y otra vez: un valor de **marca** resuelto **inline** en una
pantalla L3 (`fontSize="14px"`, `borderColor="red.500"`, un toggle copiado, un `<Box bg=ink>`…). El
arreglo **no** es corregir cada instancia — es **mover la decisión a la capa que corresponde** para
que se propague sola y **no pueda reaparecer**:

| Tipo de gap | Capa del fix | Mecanismo |
|---|---|---|
| Un **valor** (radio, color, tamaño de texto) | **L1** `design-tokens` | token / semantic-token (override de `l2/l3`, `status.*`, etc.) |
| **Comportamiento** de un control (variante, tono) | **L1/L2** receta/variant | `defineRecipe`/`defineSlotRecipe` en `createSystem` o `variant` del componente |
| **Vocabulario** repetido (título, métrica, toggle, badge) | **L2** `@savia-os/ui` | componente semántico (`PageTitle`, `Metric`, `StatusBadge`, `SegmentedToggle`) |
| Que **no reaparezca** | gate | extender `check-design-tokens` + regla de lint |

> Regla de oro: **un edit inline en una pantalla L3 es el último recurso.** Donde la auditoría lo
> encontró, es síntoma de que faltaba el token, la receta o el componente — esos son el fix real.

**Por qué importa (caso testigo, verificado):** los `<Input>`/`<Button>` se ven cuadrados (4px) no
porque cada pantalla los estilice mal, sino porque la receta de Chakra usa `borderRadius:"l2"` y el
token `l2` nunca se redefinió en la marca → cae al default de Chakra (`{radii.sm}`=4px). **Un override
de `radii.l2/l3` arregla TODOS los controles a la vez**, sin tocar una sola pantalla.

---

## P0 — Rompe percepción o uso

### P0-1 · Controles cuadrados/grises → **1 override de token (L1)** · S
> El fix de mayor ROI de toda la auditoría: una edición, impacto en cada control del producto.

- **Root cause (verificado en `@chakra-ui/react@3.36`)**: Button (`recipes/button.js:13`) e Input
  (`recipes/input.js`) usan `borderRadius:"l2"`; el semantic `l2 → {radii.sm} → 4px`. La marca nunca
  definió el escalón de control.
- **Fix elegante**: en [`packages/design-tokens/src/tokens.ts`](../../../../packages/design-tokens/src/tokens.ts)
  completar el escalón de control redefiniendo las semantic radii (encajan bajo `chip16/message22/card28/panel40`):
  ```ts
  // tokens.radii (completar el rung "control", hoy ausente)
  l1: { value: "10px" },  // controles xs/sm
  l2: { value: "12px" },  // ← default de Button/Input/Select/Textarea/Tag  (hoy 4px)
  l3: { value: "14px" },  // controles lg (matchea inputs/botones del mockup)
  ```
  Propaga a **Button, IconButton, Input, Textarea, NativeSelect, Select, Tag…** en un solo lugar.
- **Borde del input (discrepancia verificada)**: en vivo `--chakra-colors-border=#DDDFDC` ✓ pero el
  input renderiza borde **gris #A1A1AA** — el control **no consume el token de marca**. Para
  garantizar que sí (independiente del quirk de merge de Chakra), **registrar una receta `input` (y
  `button`) en `createSystem`** —mismo patrón que el `card` ya existente
  ([index.ts:48](../../../../packages/design-tokens/src/index.ts#L48))— que fije `borderColor:"border"`
  + el radio de control + la **variante `dark-form`** (mata el objeto `darkInput` inline de login/OtpForm).
- Hallazgos: F-LOGIN-1/2, TOK-2, A-2.

### P0-2 · Sin navegación móvil → **componente Drawer en el `Shell` (L2)** · M
- No parchear cada pantalla: el `Shell` (L2) debe traer la nav móvil. Portar el drawer ya escrito en
  `AppSidebar.tsx` (hoy huérfano) a `Shell` con `AnimatePresence`+focus trap, y un trigger en el
  topbar visible solo en `base`. Una vez en el `Shell`, **todas** las pantallas la heredan.
- Hallazgos: F-SHELL-1, A11Y-1. (Luego P0-2 desbloquea borrar `AppSidebar.tsx` → P1-E2.)

### P0-3 · Paywall y acciones falsas → **un único gate de capacidad (L2/L3)** · S (UI)
- No simular éxito por botón. Un solo mecanismo `useFeature("payments"|"export"|…)` + un componente
  `ComingSoon`/affordance deshabilitada. Aplicado donde falta backend, elimina de raíz la clase
  "se ve hecho pero miente".
- Hallazgos: STUB-1 (paywall), STUB-3/4/6.

### P0-4 · "Eliminar cuenta" muerto → cablear o bloquear · S (UI) · M (BE)
- Acción destructiva que no hace nada. Hasta tener endpoint: deshabilitar visiblemente. Al cablear:
  confirmación en 2 pasos (escribir email) reusando `ConfirmDialog` (ya existe en L2). No inventar UI.
- Hallazgo: STUB-2.

---

## P1 — Desvío notable

### Tema A — Tokens, tipografía y color (todo en L1/L2 + gate)

| # | Acción **elegante** (capa · mecanismo) | Symptom evitado | Hallazgo | Esf. |
|---|---|---|---|---|
| **P1-A1** | **Tipografía como vocabulario, no sweep.** (L2) crear componentes semánticos que envuelven los `textStyle` ya definidos: `PageTitle`, `SectionTitle`, `CardTitle`, `Metric`, `Caption`. Las pantallas usan `<Metric>1.248</Metric>` en vez de `fontSize=… fontWeight=…`. (gate) regla que **rechaza `fontSize`+`fontWeight` sueltos**. | reemplazar ~90 px inline a mano (y que reaparezcan) | TOK-1, GRD-2, F-ONB-3 | M |
| **P1-A2** | **Charts consumen `spaceColor()`** (la rampa de marca que ya usa el mapa) + ejes desde `fg.muted`. El chart y el mapa quedan en la misma familia. | borrar el array arcoíris inline | TOK-3 | S |
| **P1-A3** | **Usar `StatusBadge` (ya existe en L2)** en FileCard/UploadButton/GrowthStats; helper `<Delta>` para ↑/↓ (consume `success/danger`). Elimina el color crudo **y** el problema de "solo color" (a11y). | cambiar `red.500`→`danger.fg` inline | TOK-4, A11Y-4 | S |
| **P1-A4** | **Endurecer el guardrail** (gate): escanear `packages/`, regex de tipografía, `#fff`/`rgb()`. Cada limpieza de arriba se aparea con una regla → el allowlist tiende a vacío (y vaciarlo es la prueba de "hecho"). | que la deuda reaparezca | GRD-1/2/3/4 | S |

### Tema B — Pantallas-firma (variantes de componente, no wrappers ad-hoc)

| # | Acción **elegante** | Symptom evitado | Hallazgo | Esf. |
|---|---|---|---|---|
| **P1-B1** | **`Shell` con `tone="light"\|"dark"` (L2 variant)**: cuando `dark`, rail+topbar usan `bg.inverse`, NavItem activo = pill lima, search/acciones en tono inverso. Pulso pasa `tone="dark"` y **borra su `<Box bg=ink>`**. Reusable por toda pantalla de acento. | envolver el contenido en ink dejando el chrome blanco | F-PULSO-1, F-SHELL-2 | M |
| **P1-B2** | Pulso: feed con **tipos de evento** (contribuyó/leyó/reorganizó+revert) + "Resumen de IAs". El componente de feed soporta variantes de evento. | feed de un solo tipo | F-PULSO-2/3, STUB-5 | M · BE |
| **P1-B3** | M1: sección **"Recientes"** + **"Búsquedas guardadas" en el rail** (slot del `Shell`, no hardcodear el `railFooter`). | rail fijo a la cuenta | F-M1-1/2 | M |

### Tema C — Activación (build de feature, no fix de estilo)

| # | Acción | Hallazgo | Esf. |
|---|---|---|---|
| **P1-C1** | **Onboarding O4** (conectar 1ª IA, reusa C3 + verificación en vivo) y **O5** (listo + mapa naciente). El stepper hoy salta a `/memoria`. | F-ONB-1 | **L** |

### Tema D — Plataforma / arquitectura

| # | Acción **elegante** | Hallazgo | Esf. |
|---|---|---|---|
| **P1-D1** | Renombrar `middleware.ts` → `proxy.ts` (convención Next 16). | NX-1 | S |
| **P1-D2** | **Hooks de datos por dominio** (`useConnections`, `useSources`…) que encapsulan fetch+estado; las pantallas consumen el hook. No tragar errores (`.catch(()=>[])` → estado de error). Replica el buen patrón de `use-memory-data.ts`. | SOL-1 | M |

### Tema E — Limpieza estructural (borrar / redirigir, no esconder)

| # | Acción | Hallazgo | Esf. |
|---|---|---|---|
| **P1-E1** | Borrar `OtpForm.tsx` (duplicado muerto); actualizar doc 06. | DUP-2 | S |
| **P1-E2** | Borrar `AppSidebar.tsx` (252 L) tras portar su drawer (P0-2). | DEAD-1 | S |
| **P1-E3** | **Redirects en `next.config`** para rutas legacy (`/dashboard→/pulso`, `/spaces→/memoria`, `/drive→/fuentes`, `/connect|/connections→/conexiones`) + borrar `nav-config.tsx` y arreglar enlaces (`SpaceControlPanel:141`, `connect/page:111`). | DEAD-2, 02 §5 | S |
| **P1-E4** | **`SegmentedToggle` en L2** sobre `segment-group`/`segmented-control` de Chakra v3 (radii/tonos de marca); reemplaza las 2 copias (memory-map, mcp-config). | DUP-1 | S |

---

## P2 — Pulido (también en la capa correcta)

| # | Acción | Capa | Hallazgo | Esf. |
|---|---|---|---|---|
| P2-1 | NavItem: radio 12 (`xl`, no `chip`16), activo paper+ícono-lima, `py=3`, mark 26. | L2 recipe ([nav-item.tsx](../../../../packages/ui/src/organisms/nav-item.tsx)) | F-SHELL-3..9 | S |
| P2-2 | Login: heading 40px, padding 64/56 — vía los componentes de texto/tokens de P1-A1, no inline. | L1/L2 | F-LOGIN-4..8 | S |
| P2-3 | Señales del mapa (leyenda, sub-áreas, sensible, "una sola área"). | L3 + AreaDto | F-M1-3/4 | M · BE |
| P2-4 | M3/M6/SB1 como modales deep-link (intercepting routes `@modal`). | App Router | F-M1-7/8, NX-3 | M |
| P2-5 | Bajar `"use client"` en `page.tsx` de detalle; fetch en server + Suspense. | App Router | NX-2 | M |
| P2-6 | `OtpInput`: pasar `count` (requerido próximo major Chakra). | L2 | CHK-1 | S |
| P2-7 | a11y: la mayor parte la resuelven P0-2 (teclado móvil), P1-A1 (semántica), P1-A3 (ícono+texto). Resto: `onKeyDown` en roles no-nativos, convención `alt`. | L2/L3 | A11Y-2/3 | S |
| P2-8 | Badge del bell condicional; menú de cuenta+logout en rail; "última IA". | L2/L3 | STUB-7, 02§4 | M |
| P2-9 | Unificar naming a kebab-case; consolidar `McpConfigBlock`/`mcp-config` y steps de onboarding. | L3 | CON-1, DUP-3/4 | M |

---

## Cobertura nueva (construir superficies faltantes — feature, BE-dependiente)

| Superficie | Acción | Esf. |
|---|---|---|
| **P2 — Acceso ¿qué ve cada IA?** | matriz IA×área (grant/revoke/escritura) + auditoría | L · BE |
| SB1 / CT2 / CT3 | Mercado Pago hosted + historial + método + export async | L · BE |
| CT4 | Ayuda/soporte: slide-over "?" + FAQ + ticket | M |
| Colectivo CO3/CO4 | política de IAs + conectar IAs propias | M · BE |
| C3 · F1 | guía multi-cliente + descarga JSON · drop-zone protagonista + overlay | M / L |
| Móvil | frames dedicados (S1, O4/O5, SB1 hoja, M1 lista-default) | M |

---

## ¿El plan cierra **todos** los gaps? — verificación

| Clase de gap | ¿Fix en la capa correcta? | Item |
|---|---|---|
| Radio/borde de controles | ✅ L1 token + receta (verificado: `l2`) | P0-1 |
| Tipografía px-crudo | ✅ L2 componentes + gate (no sweep) | P1-A1 |
| Color de estado crudo | ✅ L2 `StatusBadge` (no swap inline) | P1-A3 |
| Arcoíris de charts | ✅ inyectar `spaceColor` | P1-A2 |
| Shell oscuro | ✅ L2 `tone` variant (no wrapper) | P1-B1 |
| Toggle duplicado | ✅ L2 `SegmentedToggle` | P1-E4 |
| Nav móvil | ✅ L2 drawer en `Shell` | P0-2 |
| Stubs peligrosos | ✅ 1 gate de capacidad | P0-3/4 |
| Legacy/muerto | ✅ redirects + borrado | P1-E |
| Datos dispersos | ✅ hooks de dominio | P1-D2 |
| a11y | ✅ mayormente derivada de P0-2/P1-A1/A3 | P2-7 |
| Reaparición de deuda | ✅ guardrail extendido | P1-A4 |
| Fidelidad fina (radios nav, paddings) | ✅ tokens/recetas L2 | P2-1/2 |
| Activación / cobertura nueva | feature (no estilo) — bien encuadrado | P1-C1, cobertura |

**Conclusión**: cada gap de estilo/marca tiene un fix **en L1/L2/gate**, no un parche inline. Los gaps
que sí requieren tocar pantallas (activación, cobertura nueva) son features, no deuda de diseño.

---

## Secuencia recomendada

```
Sprint 1 — desbloquea calidad percibida (casi todo S, máximo ROI)
  P0-1 (token l2/l3 + receta input/button)   ← 1 edit, arregla todos los controles
  P1-A1 (componentes de texto + lint)
  P1-A2/A3/A4 (charts + StatusBadge + guardrail)
  P0-2 (drawer en Shell) · P1-E1/E2/E3 (limpieza) · P1-D1 (proxy)

Sprint 2 — firma
  P1-B1 (Shell tone=dark) → P1-B2 (feed Pulso) → P1-B3 (Recientes/rail)
  P1-E4 (SegmentedToggle) · P0-3/4 (stubs honestos)

Sprint 3 — activación + datos
  P1-C1 (O4/O5) · P1-D2 (hooks de datos)

Backlog — cobertura nueva (BE): P2 acceso · pagos · CT4 · CO3/CO4 · F1 · móvil
```

**Camino crítico de calidad percibida**: P0-1 (token de control) → P1-A1 (vocabulario tipográfico) →
P1-B1 (`Shell` oscuro) → P1-C1 (activación). Los tres primeros son ediciones de **librería**, no de
pantallas: cambian todo el producto a la vez.
