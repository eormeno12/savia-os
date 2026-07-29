# 04 — El mapa de memoria

> **El momento wow del producto.** Spec exhaustivo de la visualización que reemplaza
> el dashboard de barras genéricas por el retrato vivo de la memoria del usuario.
> Profundiza el resumen del [dashboard en 02-surfaces.md](02-surfaces.md#dashboard) y
> asume las [fundaciones](01-foundations.md) (tokens `spaceScale`, motion, primitivas).
>
> ⚠️ **Color y lima → [`docs/design`](../../design/savia-design-system.md).** El mapa
> es candidato natural a vivir sobre una **superficie ink** (el hero del dashboard),
> donde el lima y la `SaviaMark` brillan y las celdas `spaceScale` contrastan. Aplica
> la regla del lima al diseñar peek, acentos y el latido de la marca.

---

## 1. Intención

Cuando un usuario abre Savia, la primera pregunta emocional es *"¿qué sabe de mí mi
memoria?"*. El mapa la responde de un vistazo: **cada uno de tus spaces es una forma
viva, su tamaño es cuánto recuerda, y juntos dibujan un organismo que creció solo.**

No es un gráfico. Es un **retrato**. El criterio de éxito no es "comunica datos con
precisión" (para eso está el chart de crecimiento), sino tres cosas:

1. **Reconocimiento** — "ese soy yo": el usuario ve sus áreas de vida reflejadas.
2. **Orgullo** — querría capturarlo y compartirlo (ver §11, shareability).
3. **Invitación** — da ganas de tocarlo y entrar a explorar.

Si una captura del mapa no genera "qué es eso, qué lindo" en alguien que no conoce
Savia, el rediseño de esta pantalla falló.

> **Anti-objetivos** (lo que el mapa NO es): no es un treemap corporativo de
> rectángulos, no es un grafo de nodos-y-aristas (eso sugiere relaciones que no
> modelamos hoy), no es un pie chart, y no usa el arcoíris de Chakra. Es orgánico,
> tonal y de marca.

---

## 2. Modelo de datos (lo que ya existe)

El endpoint `GET /growth/areas` ya devuelve **exactamente** lo que el mapa necesita
([`AreaDto`](../../../apps/app/src/lib/api.ts)):

```ts
interface AreaDto {
  spaceId: string;  // identidad estable → color y posición deterministas
  name: string;     // etiqueta de la celda
  count: number;    // nº de recuerdos → área de la celda
  share: number;    // % del total → redundante con count, útil para copy
}
```

No requiere cambios de backend para V1. El mapa es **puramente de presentación**
sobre datos existentes. (Mejoras opcionales de datos en §12.)

Derivados que calcula el cliente:
- `total = Σ count` — el número del hero.
- `maxCount = max(count)` — normalización de tamaños.
- `spaceColor(spaceId)` — color estable desde `spaceScale` (ver §5).

---

## 3. Anatomía visual

```
   ┌──────────────────────────────────────────────────────┐
   │  TU MEMORIA                                            │  ← hero (superficie ink)
   │  1.247 recuerdos · 8 spaces · +156 esta semana        │
   │                                                        │
   │            ╭───────────────╮                           │
   │         ╭──┤   Trabajo      ├──╮      ╭──────╮          │
   │      ╭──┤  │     412        │  ├╮     │Salud │          │
   │      │Pr│  ╰──────◇────────╯  ││     │  88  │          │  ← celdas (spaceScale)
   │      │oy│        ◇ marca       ╰╮     ╰──────╯          │
   │      │201│      latiendo        │  ╭─────────╮          │
   │      ╰───╯   ╭──────────╮       │  │ Familia │          │
   │              │ Finanzas │   ╭───┴╮ │   190   │          │
   │              │   64     │   │Ocio│ ╰─────────╯          │
   │              ╰──────────╯   │ 22 │                      │
   │                             ╰────╯   · partículas ·     │  ← SaviaParticles, opacity baja
   └──────────────────────────────────────────────────────┘
```

Capas, de atrás hacia adelante:

1. **Lienzo** — superficie del dashboard. Puede ser `paper` (claro) o `bg.inverse`
   (ink) para el modo "retrato". Recomendación V1: **paper**, con opción ink para el
   modo compartir (§11).
2. **`SaviaParticles`** — atmósfera, `opacity` baja (~0.10), detrás de las celdas.
   Respeta `prefers-reduced-motion` (se congela).
3. **`SaviaMark`** — la marca de 4 pliegues, grande y tenue, anclada al centroide del
   conjunto de celdas. **Late** suavemente (scale 1 → 1.03, `durations.slow`, ease
   `EASE_SAVIA`, infinito). Es el "corazón" del organismo. `opacity` ~0.12–0.18.
4. **Celdas** — una por space (§4).
5. **Etiquetas y peek** — nombre + count dentro de cada celda; tooltip/peek en hover.

---

## 4. La celda (space)

Cada space es **una forma redondeada orgánica**, no un rectángulo ni un círculo
perfecto. Decisión de forma:

- **Recomendada**: *círculos con radio variable*, empaquetados (circle-packing). Es
  lo más "orgánico", la matemática es robusta y madura, y lee como "células".
- Alternativa: *superellipse / squircle* (rectángulos super-redondeados, `radii.card`
  exagerado) empaquetados en treemap — más legible para nombres largos, menos orgánico.

> **Decisión V1: circle-packing.** Si las etiquetas sufren en círculos pequeños, se
> evalúa squircle en fast-follow. (Ver §6, tipografía adaptativa, que mitiga esto.)

### Contenido de la celda

Por orden de prioridad (se degrada según el tamaño disponible — §6):

| Elemento | Cuándo se muestra |
|----------|-------------------|
| Nombre del space | siempre que quepa; si no, solo en hover/peek |
| Count (`metric` chico, tabular) | en celdas medianas y grandes |
| `SpaceGlyph` / inicial | celdas chicas donde no cabe texto |
| Share % | solo en peek/hover, no en reposo (evita ruido) |

### Estilo

- Relleno: color de `spaceColor(spaceId)` (§5), con un sutil gradiente radial hacia
  un tono adyacente de la escala para dar volumen (no flat).
- Borde: `1px` del mismo tono más oscuro, o ninguno si el contraste con el lienzo basta.
- Sombra: `shadows.soft` en reposo; `shadows.float` + lift en hover.
- Radio (si squircle): `radii.panel` exagerado.

---

## 5. Color — matar el arcoíris

Hoy: `PALETTE = ["blue","purple","teal","orange",…]` de Chakra
([`AreasOverview.tsx:11`](../../../apps/app/src/components/dashboard/AreasOverview.tsx)).
Se ve como un semáforo y rompe la marca.

**Reemplazo**: la rampa `spaceScale` (definida en [01-foundations.md §1.2](01-foundations.md))
— una familia tonal **ink → teal → verde → lima**, toda dentro del universo de marca.
Función determinista en `lib/space-colors.ts`:

```ts
// Color estable por space, independiente del orden de la lista.
// Hash del spaceId → paso de la rampa. Mismo space = mismo color siempre.
function spaceColor(spaceId: string): { fill: string; ink: string };
```

Reglas:
- **Determinismo por `spaceId`**, no por índice de array (hoy es por índice → el color
  de un space cambia si reordena la lista; inaceptable para un "retrato").
- **Contraste AA garantizado** entre el texto de la celda y su relleno: la función
  devuelve también el color de tinta legible (`ink` claro u oscuro según el paso).
- **Distinguibilidad**: con muchos spaces, distribuir los pasos para que vecinos no
  colisionen (no solo `hash % N` — separación máxima tipo golden-ratio sobre la rampa).
- El space "General" / hogar (ver [unificación 14](../savia-mvp/14-spaces-unification.md))
  puede reservar el tono `ink` base como ancla visual.

---

## 6. Dimensionado y tipografía adaptativa

### Tamaño de celda

Área (no diámetro) proporcional a `count`, para que la percepción visual coincida con
la magnitud:

```
radio_i = radioMin + (radioMax − radioMin) · sqrt(count_i / maxCount)
```

- `sqrt` porque el ojo compara **áreas**, no radios.
- `radioMin` garantiza que un space con 1 recuerdo siga siendo tocable (≥44px de
  diámetro en su caja de hit, aunque el círculo sea menor).
- Clamp del rango total al viewport disponible; si la suma desborda, se escala todo el
  conjunto (no se recorta ninguna celda).

### Tipografía dentro de la celda

El texto **se adapta al tamaño de la celda** (no un `fontSize` fijo):

| Diámetro celda | Muestra |
|----------------|---------|
| Grande (> 140px) | nombre (`cardTitle`) + count (`metric`) + glyph |
| Mediana (90–140px) | nombre (truncado) + count |
| Chica (60–90px) | count solo, o inicial |
| Mínima (< 60px) | `SpaceGlyph` (color + inicial); nombre solo en peek |

El nombre nunca se deforma ni desborda: trunca con ellipsis y se revela completo en
el peek (§7).

---

## 7. Interacción

### Hover / focus (peek)

Al apuntar o enfocar una celda:
- La celda hace **lift** (`y: -4`, `shadows.soft → float`, `durations.fast`).
- Las demás bajan a `opacity` ~0.55 (foco por contraste, no por línea).
- Aparece un **peek**: panel flotante anclado a la celda con nombre completo, count,
  share %, y **2–3 recuerdos de ejemplo** (requiere endpoint de muestreo — §12; en V1
  sin ejemplos, solo nombre+count+share).

### Click / Enter

Navega al detalle del space (`/spaces/[id]` o un drawer lateral con sus recuerdos).
Transición: la celda se expande hacia la vista de detalle (shared-element si el tiempo
lo permite; si no, `FadeInUp` simple).

### Selección (opcional, fast-follow)

Estado seleccionado persistente que filtra el `GrowthChart` de abajo al space elegido
— conecta el mapa con el resto del dashboard.

---

## 8. Motion — el organismo respira

Todo motion respeta `prefers-reduced-motion` (congela a estado final, sin loops).
Curva siempre `EASE_SAVIA`.

| Momento | Animación |
|---------|-----------|
| **Entrada** (montaje) | celdas crecen desde `scale: 0` con stagger por tamaño (las grandes primero), `durations.soft`, ease overshoot. La marca hace fade-in al final. |
| **Reposo** (idle) | la `SaviaMark` central **late** (scale 1→1.03, `durations.slow`, loop). Partículas derivan. Las celdas, opcionalmente, una micro-oscilación de ±1px desfasada (sensación "vivo"), muy sutil. |
| **Crecimiento** | cuando llega un recuerdo nuevo a un space (tras subir un archivo / importar / vía MCP), su celda **crece** a su nuevo radio con un pulso lima de 1 ciclo. "Viste tu memoria expandirse." |
| **Hover** | lift + atenuación del resto (§7). |
| **Salida a detalle** | expansión de la celda / transición compartida. |

El "crecimiento en vivo" puede ser: (a) al refetch tras una acción del usuario en la
misma sesión, o (b) realtime si hay canal. V1: al refetch. Realtime = fast-follow.

---

## 9. Estados

Ningún estado se deja sin diseñar (rúbrico de [03](03-roadmap.md)).

| Estado | Tratamiento |
|--------|-------------|
| **Cargando** | skeleton del mapa: siluetas circulares en `bg.subtle` con shimmer, en una composición plausible — no un spinner. La marca aparece estática. |
| **Vacío (0 spaces / 0 recuerdos)** | `EmptyState` cálido: la `SaviaMark` sola, "Tu memoria está por nacer", CTA a onboarding/Drive. Es el estado del usuario nuevo — debe invitar, no frustrar. |
| **Un solo space** | una celda grande centrada con la marca; copy "Toda tu memoria vive en *General* — créale spaces para organizarla". |
| **Pocos (2–5)** | composición holgada, celdas grandes, mucho aire. |
| **Muchos (> ~20)** | empaquetado denso; celdas mínimas pasan a glyphs; opción "ver todos" → lista. No saturar: agrupar la cola larga en una celda "+12 más". |
| **Dominante (un space >70%)** | una celda enorme y satélites; el copy lo nombra ("La mayoría de tu memoria es *Trabajo*"). |
| **Error** | `EmptyState` de error con retry + toast; nunca pantalla en blanco. |

---

## 10. Responsive y accesibilidad

### Responsive

- **Desktop**: mapa completo, alto generoso (≥ 420px), peek flotante.
- **Tablet**: mismo mapa, celdas reescaladas, peek como bottom-sheet.
- **Móvil**: el packing 2D se aprieta. Dos opciones:
  - (a) mapa compacto scrolleable + tap para peek (bottom-sheet),
  - (b) **fallback a lista ordenada** de spaces con `SpaceGlyph` + barra de proporción.
  Recomendación: mantener el mapa en móvil (es la firma) pero con un toggle a lista para
  accesibilidad/escaneo. La lista **también** es la capa accesible (abajo).

### Accesibilidad — no negociable

El mapa visual es una capa sobre datos; la **representación accesible es de primera
clase**, no un afterthought:

- **Alternativa semántica siempre presente**: una `<table>`/lista oculta-visualmente
  (`<ul>` con nombre, count, share) que los lectores de pantalla recorren. El SVG/canvas
  decorativo es `aria-hidden`, y el contenedor expone un resumen (`aria-label="Mapa de
  tu memoria: 8 spaces, 1.247 recuerdos"`).
- **Teclado**: cada celda es focusable (tabindex / elemento nativo), orden lógico (por
  tamaño desc), `Enter` navega, focus ring visible de marca.
- **Color + texto**: nunca solo color para distinguir spaces — siempre etiqueta o glyph.
- **`prefers-reduced-motion`**: sin latido, sin crecimiento animado, sin partículas en
  movimiento; todo a estado final.
- **Contraste AA** en todo texto sobre celda (garantizado por `spaceColor`, §5).

---

## 11. Shareability — el orgullo

El mapa es lo que el usuario querría mostrar. Apalancarlo (puede ser fast-follow):

- **Modo retrato**: variante en superficie `ink` con la marca y el wordmark, pensada
  para captura — proporción de card social.
- **Exportar imagen**: botón "Guardar imagen de tu memoria" (render a PNG vía canvas /
  `html-to-image`). Marca de agua sutil "savia". Crecimiento orgánico de marca: cada
  captura compartida es publicidad.
- Métrica de vanidad incluida ("1.247 recuerdos · creciendo +12%/semana").

---

## 12. Datos: lo que mejora el mapa (opcional, no bloqueante)

V1 funciona con `AreaDto` actual. Mejoras que potencian la experiencia, a coordinar
con el plan funcional:

- **Muestreo de recuerdos por space** (`GET /spaces/:id/sample?n=3`) → habilita el peek
  con ejemplos reales (§7). Alto impacto en el "wow".
- **Delta por space** (cuánto creció cada uno en el rango) → habilita la animación de
  crecimiento dirigida y un copy más rico.
- **`createdAt` del space** → ordenar o colorear por antigüedad (memoria "vieja" vs
  "nueva").
- **Colectivos — ya implementados** ([16](../savia-mvp/16-collective-spaces.md)): el
  `AreaDto` debe extenderse (o cruzarse con `GET /spaces`) para traer `kind` y `role`,
  que **ya existen** en el backend. La celda de un space colectivo lleva un anillo/badge
  de propiedad y un slot de **avatares de miembros**; la del space `isDefault`
  ("General") se ancla como hogar. No es "anticipar": es renderizar estado real. Diseñar
  la celda con estos slots desde V1.

---

## 13. Plan técnico

### Tecnología de render

| Opción | Veredicto |
|--------|-----------|
| **SVG + React** | **Recomendado para V1.** Celdas como `<circle>`/`<path>`, animables con Framer Motion (`motion.circle`), focusables, accesibles, nítidas. Suficiente hasta ~50–80 celdas. |
| Canvas | Solo si el conteo de celdas o partículas degrada FPS. Pierde accesibilidad nativa (hay que reconstruir hit-testing y foco). Fast-follow si hace falta escala. |
| DOM/Chakra `Box` absolutos | Viable para squircles; peor para círculos empacados. |

### Algoritmo de layout

- **`d3-hierarchy` → `pack()`** para circle-packing: maduro, determinista, una
  dependencia chica y tree-shakeable. Se le pasa `{children: areas}` con `value=count`
  y devuelve `{x, y, r}` por celda. **No** se trae todo d3, solo `d3-hierarchy`.
- Semilla determinista para que el layout sea **estable entre cargas** (el retrato no
  debe "saltar" cada visita). El orden de entrada al packing se fija por `spaceId`.
- El cálculo es barato (decenas de celdas) y memoizable (`useMemo` sobre `areas`).

### Componentes (en `apps/app/src/components/dashboard/memory-map/`)

```
MemoryMap.tsx        // orquesta: fetch-derived props, layout, estados, a11y wrapper
  ├─ MemoryCanvas    // SVG: partículas + marca latiendo + celdas
  │   ├─ MemoryCell  // una celda: forma + label adaptativa + motion + foco
  │   └─ MarkPulse   // SaviaMark central latiendo
  ├─ MemoryPeek      // panel/bottom-sheet de hover/focus
  ├─ MemoryList      // alternativa accesible + fallback móvil
  └─ MemoryEmpty     // estados vacío/error
```

`spaceColor()` y `packLayout()` viven en `lib/`. `SaviaMark`, `SaviaParticles`,
`FadeInUp`, `EASE_SAVIA` vienen de `@savia-os/ui` (extraídos en Fase 0, ver
[03-roadmap.md](03-roadmap.md)).

### Reemplazo

`MemoryMap` sustituye `AreasOverview` + la barra de leyenda en
[`dashboard/page.tsx`](../../../apps/app/src/app/\(app\)/dashboard/page.tsx). El
`GrowthChart` permanece (recoloreado con `spaceColor`), debajo del mapa.

---

## 14. Alcance: V1 vs fast-follow

Para no convertir el mapa en un agujero de tiempo que bloquee el resto del rediseño,
se parte en dos:

### V1 (el wow ya presente)
- Circle-packing con `d3-hierarchy`, SVG + Framer Motion.
- `spaceColor` desde `spaceScale` (arcoíris muerto).
- Tipografía adaptativa por tamaño.
- Marca latiendo + partículas.
- Motion de entrada (crecer desde 0) y hover (lift + atenuar).
- Peek con nombre/count/share (sin ejemplos).
- Todos los estados (cargando/vacío/un-space/muchos/error).
- Capa accesible (lista semántica) + teclado + reduced-motion.
- Click → detalle del space.

### Fast-follow
- Peek con **recuerdos de ejemplo** (requiere endpoint de muestreo, §12).
- Animación de **crecimiento en vivo** dirigida por delta.
- **Modo retrato + exportar imagen** (§11).
- Selección que filtra el `GrowthChart`.
- Avatares de miembros / propiedad para colectivos.
- Canvas si el SVG no escala.

> **Decisión de fase pendiente** ([03-roadmap.md](03-roadmap.md), decisión 3): si V1
> del mapa entra en la **Fase 3** del rediseño o llega como **Fase 5** mientras la
> Fase 3 entrega un dashboard tokenizado correcto pero con la visualización aún
> sencilla. Recomendación: **Fase 3** — es la firma, justifica adelantarlo; el resto
> de pantallas no depende de él.

---

## 15. Criterios de aceptación del mapa

Además del rúbrico general de [03](03-roadmap.md):

- [ ] Cero colores de Chakra crudos; todo color sale de `spaceColor`/`spaceScale`.
- [ ] El color de un space es **estable** ante reordenamiento de la lista.
- [ ] Tamaño de celda ∝ `sqrt(count)`; el conjunto nunca recorta una celda (escala).
- [ ] Contraste AA de toda etiqueta sobre su celda.
- [ ] Capa accesible: lista semántica + `aria-label` resumen + foco por teclado.
- [ ] `prefers-reduced-motion`: sin latido, crecimiento ni deriva.
- [ ] Layout **determinista** entre recargas (no "salta").
- [ ] Estados cargando/vacío/un-space/muchos/error, todos diseñados.
- [ ] 60 FPS con ~30 celdas en gama media; sin jank en la animación de entrada.
- [ ] Una captura del mapa pasa el test "qué lindo, qué es eso".
