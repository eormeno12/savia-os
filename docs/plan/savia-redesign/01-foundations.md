# 01 — Fundaciones del rediseño

> La capa que debe existir **antes** de tocar cualquier pantalla. Sin esto, cada
> superficie reinventa colores de estado, modales y estados de carga. Con esto, el
> rediseño de superficies es ensamblaje. Léelo después de
> [00-overview.md](00-overview.md).
>
> ✅ **Estado: implementado.** Todo este documento ya está construido y verificado
> (ver [03-roadmap.md → Fase 0](03-roadmap.md)). Quedó como referencia del *qué* se
> construyó; este doc lista la intención, y el código vivo es la fuente.
>
> **Reglas visuales → [`docs/design`](../../design/savia-design-system.md).** Este doc
> cubre la *estructura* de las fundaciones (qué tokens/primitivas existen); **cómo se
> usan visualmente** (la regla del lima, botones, superficies, highlight ink) lo
> gobierna la guía de diseño. Algún detalle de color aquí fue afinado en Fase 1 — ante
> conflicto, manda `docs/design`.
>
> **Prerequisito (cumplido)**: se construyó sobre los paquetes compartidos
> (`@savia-os/design-tokens`, `@savia-os/ui`) descritos en
> [05-shared-design-system.md](05-shared-design-system.md). Los tokens se **extendieron
> en el paquete**, no en cada app.

---

## 1. Extender el theme (en el paquete compartido)

Tras la extracción ([05](05-shared-design-system.md)), el theme vive en
`@savia-os/design-tokens` y se extiende **ahí una sola vez** — ambas apps lo reciben.
El theme actual es correcto pero incompleto: define la paleta y algo de tipografía,
pero le faltan **colores de estado**, **paleta de spaces** y **superficies oscuras**.
Lo que falta es exactamente lo que las pantallas hoy resuelven con hex crudo.

### 1.1 Colores de estado (semantic-tokens.ts)

Hoy: `red.500`, `green.600`, `orange.500` dispersos. Añadir tokens semánticos y un
`colorPalette` por estado (Chakra lee las 8 sub-keys para Badge/Button):

```ts
// añadir a semantic-tokens.ts → colors
success: { solid, contrast, fg, muted, subtle, emphasized, focusRing, border }, // verde calmo, no Chakra green
warning: { … }, // ámbar
danger:  { … }, // rojo de marca, para destructivo
info:    { … }, // teal derivado de ink
status: {
  pending:    { value: "{colors.slateText}" },
  processing: { value: "…ámbar…" },
  indexed:    { value: "…success.fg…" },
  failed:     { value: "…danger.fg…" },
},
```

Mapea: errores de form → `colorPalette="danger"`, estado de archivo en
[`FileCard`](../../../apps/app/src/components/drive/FileCard.tsx) → `status.*`,
deltas de [`GrowthStats`](../../../apps/app/src/components/dashboard/GrowthStats.tsx)
(↑/↓) → `success`/`danger`.

### 1.2 Paleta de spaces (la que mata el arcoíris)

El problema #1 de identidad: [`GrowthChart`](../../../apps/app/src/components/dashboard/GrowthChart.tsx)
y [`AreasOverview`](../../../apps/app/src/components/dashboard/AreasOverview.tsx)
asignan colores de Chakra (`blue/purple/teal/orange…`) a cada space. Reemplazar por
una **escala derivada de la marca** — variaciones tonales de ink→teal→lima que se
sienten una familia, no un semáforo:

```ts
// tokens.ts → colors.spaceScale (6–8 pasos, todos en el rango ink/teal/lima)
spaceScale: {
  1: { value: "#0B2529" }, // ink
  2: { value: "#1C4A4A" },
  3: { value: "#2E6B5E" },
  4: { value: "#4C8C5F" },
  5: { value: "#86B23C" },
  6: { value: "#C9E32B" },
  7: { value: "#E7FF18" }, // signalLime
  // …afinar en implementación con contraste AA garantizado sobre paper
},
```

Función determinista `spaceColor(spaceId | index)` en `lib/space-colors.ts` que
mapea cada space a un paso estable. Un solo lugar; charts, cards, badges y el mapa
de memoria lo consumen.

### 1.3 Superficies oscuras

La landing puntúa el ritmo con bloques `bg.inverse` (ink). El app es 100% claro y
por eso se siente plano. Habilitar superficies oscuras como **acento deliberado**:
hero del dashboard, card de "tu IA conectada", footer del onboarding. Ya existe
`bg.inverse` / `fg.inverse` en [`semantic-tokens.ts`](../../../apps/app/src/theme/semantic-tokens.ts) —
falta usarlo. Añadir `shadows.floatDark` para profundidad sobre ink.

### 1.4 Escala tipográfica de producto

`textStyles` actual tiene displays grandes (landing) pero falta el rango medio que
un producto usa todo el tiempo. Añadir:

```ts
pageTitle:    { fontSize "displayMd", fontWeight 600, lineHeight 1.02 }, // título de pantalla
sectionTitle: { = titleLg },                                            // ya existe
cardTitle:    { fontSize "lg", fontWeight 600, lineHeight 1.2 },
metric:       { fontSize "3xl", fontWeight 700, lineHeight 1, fontVariantNumeric "tabular-nums" },
caption:      { fontSize "sm", color implícito fg.muted },
```

Regla dura para superficies: **nunca `fontSize` + `fontWeight` sueltos**; siempre
`textStyle`. Un PR que introduzca `fontSize="2xl" fontWeight="800"` se rechaza.

---

## 2. Lenguaje de motion

Portar `EASE_SAVIA` y `BRAND_COLORS` a `apps/app/src/lib/constants.ts` (idénticos a
la landing). Framer Motion ya es viable (mismo stack). Reglas:

- **Entrada de página**: cada pantalla envuelve su contenido en `FadeInUp` con
  stagger por sección (`delay = index * 0.08`).
- **Micro-interacciones**: hover de cards = lift sutil (`y: -2`, `shadows.soft → float`)
  con `durations.fast`. Toggle/switch con `EASE_SAVIA`.
- **Éxito**: el toast entra con spring corto; el ítem creado (space, archivo)
  hace un flash lima de 1 frame.
- **Datos**: barras/celdas del dashboard animan su altura al montar (`scaleY` desde 0).
- **Pulso lima**: portar el keyframe de `how-it-works.module.css` para "primera
  llamada recibida" en conexiones.
- **Siempre** `useReducedMotion` → duración 0, sin desplazamiento. (Patrón ya
  resuelto en `FadeInUp`.)

> Regla de la landing que aplica igual: `motion.div` lleva las props de Framer,
> `Box` de Chakra anidado lleva las style props. Nunca mezclar.

---

## 3. Librería de primitivas (`apps/app/src/components/ui`)

Hoy **no existe**. Cada pantalla estiliza inline: `<Box border="1px solid"
borderColor="border.subtle" borderRadius="card"…>` repetido decenas de veces. Esto
es la causa mecánica de la inconsistencia. Crear estos primitivos y migrar todo a
ellos:

| Primitivo | Reemplaza | Notas |
|-----------|-----------|-------|
| `Surface` / `Card` | el `<Box border…>` repetido | variantes: `flat`, `elevated`, `inverse`. Radii `card`, shadow `soft`, hover lift opcional. |
| `PageHeader` | los `<HStack>` de título ad-hoc | eyebrow (`label`) + `pageTitle` + acción primaria + descripción. Uno por pantalla. |
| `Dialog` | **todos los `window.confirm()`** y el modal inline de conexiones | overlay con blur, `Esc`/click-fuera, focus trap (patrón de `site-header.tsx`), `AnimatePresence`. |
| `ConfirmDialog` | los 4 `confirm()` destructivos | variante danger, copy de consecuencia ("Esto desconecta a 3 IAs"). |
| `Toaster` / `useToast` | el silencio actual | éxito/error/info. Chakra v3 trae `createToaster`; configurarlo una vez en `provider.tsx`. |
| `EmptyState` | los 5 estados vacíos distintos | icono o `SaviaMark`, título, descripción, CTA. Un solo look. |
| `Skeleton` / `CardSkeleton` | los `<Spinner/>` | shimmer con `bg.subtle`. Layout estable, sin saltos. |
| `Field` | inputs sueltos sin label | label + input + helper/error + `aria-describedby`. Resuelve accesibilidad de forms de un golpe. |
| `OtpInput` | el campo con `letter-spacing` | 6 celdas individuales, auto-advance, paste, teclado numérico. |
| `StatusBadge` | badges de estado ad-hoc | consume `status.*`; ícono + texto (no solo color → accesible). |
| `CopyBlock` | el `<pre>` + copy de [`McpConfigBlock`](../../../apps/app/src/components/connect/McpConfigBlock.tsx) | feedback de copia claro (toast + check), monospace tokenizado. |
| `SpaceGlyph` | — | avatar de space: celda de color `spaceScale` + inicial o `SaviaMark`. Reusado en nav, cards, mapa. |

Estos primitivos son el **80% del trabajo de consistencia**. Una vez existen, cada
pantalla del [doc 02](02-surfaces.md) es composición.

---

## 4. App-shell con identidad

Rediseñar [`AppNav`](../../../apps/app/src/components/layout/AppNav.tsx) y
[`(app)/layout.tsx`](../../../apps/app/src/app/\(app\)/layout.tsx).

### Estructura

- **Logo de marca**: `SaviaMark` (lima) + wordmark "SAVIA" (uppercase, letter-spacing
  como la landing) — no el `Text fontSize="sm"` actual.
- **Agrupación semántica** de la nav, no seis ítems planos:
  - *Tu memoria*: Inicio/Onboarding, Dashboard, Spaces
  - *Fuentes*: Drive
  - *IAs*: Conexiones, Conectar IA
  Separadores sutiles o labels de grupo.
- **Indicador de sección activo** con presencia: barra/pill lima, no solo cambio de
  color. `pathname.startsWith` actual es frágil (orden de rutas) — usar match exacto
  por segmento.
- **Cuenta/logout** en un menú (avatar), no un botón suelto. Logout con `ConfirmDialog`,
  no acción inmediata.

### Layout — sidebar vertical (decidido)

**Sidebar vertical colapsable** a la izquierda (no top-nav): un producto de "áreas de
memoria" se navega mejor lateralmente, deja el top para contexto de página, y escala a
más secciones (colectivos). El top-nav se reserva como layout móvil (drawer). El
sidebar colapsa a íconos para dar más ancho al contenido.

### Móvil (hoy inexistente)

Drawer con `AnimatePresence` + focus trap (patrón ya implementado en
`site-header.tsx` de la landing — portar). Targets ≥44px. La nav nunca desaparece
sin alternativa.

### Fondo atmosférico

`SaviaParticles` muy sutiles en las pantallas-hero (login, onboarding, hero del
dashboard y fondo del mapa de memoria). Dan la profundidad atmosférica de la landing
sin distraer. (Savia ya **no** usa orbital rings — no portarlos.)

---

## 5. Página raíz y carga

- [`app/page.tsx`](../../../apps/app/src/app/page.tsx) (hoy texto centrado "Savia"):
  convertir en **splash de marca** real con `SaviaMark` animado mientras el
  middleware decide el redirect — no un flash de texto sin estilo.
- Estado de carga global: pantalla de marca con `SaviaMark` latiendo, no spinner
  de Chakra.

---

## Entregable de esta fase

PRs encadenados (la base, antes de cualquier pantalla):
0. **Extracción** ([05](05-shared-design-system.md)): `@savia-os/design-tokens` +
   `@savia-os/ui`; borrar `theme/` duplicados; landing idéntica; guardrail de CI.
1. Extiende los tokens en `@savia-os/design-tokens` (estados, `spaceScale`, superficies
   oscuras, textStyles de producto).
2. Primitivas: genéricas en `@savia-os/ui`, de dominio en `apps/app/src/components/ui/*`.
3. Crea `apps/app/src/lib/space-colors.ts` (constantes de marca ya vienen del paquete).
4. Rediseña shell + sidebar + página raíz.
5. Configura `Toaster` en el `Provider` base de `@savia-os/ui`.

Sin tocar todavía la lógica de las pantallas: solo la base. Las superficies
([doc 02](02-surfaces.md)) se montan encima.
