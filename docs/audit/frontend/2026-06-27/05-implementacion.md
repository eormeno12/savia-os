# 05 — Implementación (sesión 2026-06-27)

> Registro de lo implementado del [plan de remediación](04-plan-remediacion.md). Se priorizó la
> **capa de librería** (L1/L2) y lo que **no depende de backend**. Todos los gates en verde:
> `typecheck` (app+ui) · `lint` (app+ui) · `build` app · `check-design-tokens`. Verificado en vivo
> con Chrome headless donde aplica.

## Hecho ✅

| Item | Qué se hizo | Capa | Verificación |
|---|---|---|---|
| **P0-1 (radio)** | Override de `radii.l1/l2/l3` (10/12/14px) en [semantic-tokens.ts](../../../../packages/design-tokens/src/semantic-tokens.ts). Chakra's Button/Input/Select/Textarea leen `l2` → ahora **12px**. | L1 | **vivo**: input y botón `4px → 12px` (medido). 1 edit, todos los controles |
| **P0-1 (borde input)** | Receta `input` ([recipes/input.ts](../../../../packages/design-tokens/src/recipes/input.ts), vía MCP de Chakra — merge, +variante `dark-form`) + regla scoped en [globals.css](../../../../apps/app/src/app/globals.css). **Causa raíz** (diagnóstico CDP): el campo de login es `autoFocus` → en `:focus` (no-teclado) Chakra 3.36 pinta un gris pese a que el token = `#DDDFDC` en todo scope; lo gana una regla fuera del alcance de token/receta/globalCss. Fix: `:not([data-invalid])` (no `:not(:focus)`, que excluía el campo autofocus). | L1 + app | **vivo**: borde `#A1A1AA → #DDDFDC` (medido); foco por ring (box-shadow), invalid conserva borde de error |
| **P1-D1 (proxy)** | `middleware.ts` → [`proxy.ts`](../../../../apps/app/src/proxy.ts) (`export function proxy`), convención Next 16. | app | build: `ƒ Proxy (Middleware)`, sin warning de deprecación |
| **P1-E1/E2** | Borrados: `OtpForm.tsx` (dup muerto), `AppSidebar.tsx` (252 L), `nav-config.tsx`. | app | typecheck verde, sin refs colgadas |
| **P1-E3 (legacy)** | Redirects en [next.config.ts](../../../../apps/app/next.config.ts) (`/dashboard→/pulso`, `/spaces→/memoria`, `/drive→/fuentes`, `/connect|/connections→/conexiones`) **+ borrado de los árboles legacy** (5 rutas + `components/{drive,spaces,dashboard,connect}` + `SpaceControlPanel`/`NewConnectionDialog`). | app | build: rutas legacy ausentes del manifest |
| **TOK-3 + TOK-4** | Resueltos **por borrado**: el arcoíris de `GrowthChart` y los `red/green/orange.500` de `FileCard/UploadButton/GrowthStats/SpaceForm` vivían en esos árboles legacy. | app | guardrail: **0 colores crudos** en código vivo (solo `layout.tsx` themeColor) |
| **window.confirm** | Eliminados (estaban en `FileGrid`/`SpaceCard`, borrados). | app | grep: 0 en código vivo (rúbrico cumplido) |
| **P0-2 (nav móvil)** | Drawer móvil portado al [`Shell`](../../../../packages/ui/src/organisms/shell.tsx) (hamburguesa + `Drawer` + focus trap). Lo heredan todas las pantallas. | L2 | typecheck/build verde |
| **P1-A1 (tipografía)** | Vocabulario semántico en L2: [`typography.tsx`](../../../../packages/ui/src/primitives/typography.tsx) (`PageTitle/SectionTitle/CardTitle/Metric/Caption/Eyebrow`) + adopción inicial en `login-form`. | L2 | exportado del barrel; usado en login |
| **P1-A4 (guardrail)** | [check-design-tokens.mjs](../../../../scripts/check-design-tokens.mjs) extendido: escanea `packages/`, hex de 3 dígitos, allowlist depurada, y **reporte de tipografía** (`fontSize/fontWeight`) que tiende a 0. | gate | corre verde; reporta 179 usos sueltos a migrar |
| **P1-B1 (Shell oscuro)** | `tone="light"\|"dark"` en `Shell` + `NavItem` (compound variant). Pulso usa `tone="dark"` y dejó de envolver su contenido en ink. | L2 | **vivo**: `/memoria` rail blanco + nav ink/lima ✓ (sin regresión); `/pulso` rail **ink** + nav **lima/ink** ✓ (= frame 48). Screenshot `evidencia/` |

## Diferido ⏳ (con razón)

| Item | Por qué |
|---|---|
| **P0-3/P0-4 (stubs)** | Paywall y export/borrar-cuenta requieren backend (Mercado Pago, endpoints). El fix de UI honesta (`useFeature`/`ComingSoon`) es chico pero se dejó para no mezclar con backend. |
| **P1-A1 (migración completa)** | El vocabulario existe y el guardrail lo mide; migrar los 179 `fontSize` restantes es incremental (cada pantalla a su tiempo, sin churn masivo). |
| **P1-A2/A3 (en vivo)** | Ya resueltos por borrado del legacy; no quedó color crudo en pantallas vivas que retokenizar. `GrowthChart` de Pulso (nuevo) ya usa tokens. |
| **P1-B2/B3, P1-C1, cobertura nueva** | Features (feed de Pulso rico, Recientes, O4/O5, P2, pagos, CT4, móvil-frames): build, no deuda de estilo — siguen el roadmap. |

## Gates (corrida final)

```
typecheck @savia-os/ui    ✓
typecheck @savia-os/app   ✓
lint @savia-os/ui         ✓
lint @savia-os/app        ✓
build @savia-os/app       ✓  (rutas legacy ausentes; ƒ Proxy)
check-design-tokens       ✓  (0 colores crudos; 179 tipografías reportadas)
```

## Evidencia visual

- `evidencia/login-desktop-1320.png` — login (controles ya a 12px).
- `evidencia/shell-pulso-dark.png` — Pulso con el shell oscuro (rail ink, nav lima).
- `evidencia/shell-memoria-light.png` — Memoria con el shell claro (sin regresión).
