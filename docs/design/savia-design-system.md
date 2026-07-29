# Cómo diseñar Savia

> La guía canónica de diseño de Savia. Destilada de la landing (`apps/landing`) y
> del producto (`apps/app`), e iterada en pantallas reales. Si vas a diseñar o
> construir cualquier UI de Savia, **léela primero**. Reemplaza las reglas dispersas;
> ante una duda de diseño, esta es la fuente.

> **Estrella polar:** Savia es _"el cerebro ejecutable de cada empresa"_ (dirección
> B2B, ver [`docs/product/savia-b2b/01-vision.md`](../product/savia-b2b/01-vision.md)) — construido
> bottom-up desde _"la memoria que conecta todas tus IAs"_ de cada persona. El producto
> debe sentirse **único e impactante — un outlier**, no un SaaS claro y genérico.
> Cada pantalla se piensa; ninguna se deja "prolija pero olvidable".

---

## Índice

1. [Filosofía y dirección](#1-filosofía-y-dirección)
2. [Color — y la regla del lima](#2-color--y-la-regla-del-lima)
3. [Superficies: claro vs. oscuro](#3-superficies-claro-vs-oscuro)
4. [Botones y CTAs](#4-botones-y-ctas)
5. [Énfasis en titulares claros (highlight ink)](#5-énfasis-en-titulares-claros-highlight-ink)
6. [Tipografía](#6-tipografía)
7. [Espaciado y layout](#7-espaciado-y-layout)
8. [Motion](#8-motion)
9. [Imágenes y marca](#9-imágenes-y-marca)
10. [Voz y copy](#10-voz-y-copy)
11. [Accesibilidad](#11-accesibilidad)
12. [Arquitectura (DRY) y tokens](#12-arquitectura-dry-y-tokens)
13. [Primitivas disponibles](#13-primitivas-disponibles)
14. [Checklist antes de entregar](#14-checklist-antes-de-entregar)

---

## 1. Filosofía y dirección

**Dirección: "Contraste dramático".** Lienzo claro como base, puntuado por
**superficies oscuras de firma** (paneles ink) donde vive la marca y brilla el lima.
No es un producto oscuro completo (eso lo evaluamos y descartamos), ni un SaaS claro
plano. Es la **tensión** entre ambos lo que da carácter.

Tres adjetivos guía (toda decisión se mide contra ellos):

| Adjetivo | Significa | Anti-patrón a matar |
|----------|-----------|---------------------|
| **Vivo** | Motion con propósito, profundidad, superficies que respiran | Tablas planas, spinners, saltos de layout |
| **Calmo** | Jerarquía clara, espacio generoso, una acción primaria por pantalla | Densidad, 8 colores compitiendo, todo al mismo peso |
| **Tuyo** | Primera persona, la memoria como retrato del usuario | "Dashboard", "items", copy de plantilla |

El login (`apps/app/src/app/(auth)/login`) es el **ejemplo trabajado de referencia**:
mira ahí cómo se aplican todas estas reglas juntas.

---

## 2. Color — y la regla del lima

### Paleta de marca

| Token | Hex | Uso |
|-------|-----|-----|
| `ink` | `#0B2529` | Teal profundo. Texto sobre claro, superficies oscuras de firma. |
| `softInk` | `#152F34` | Ink secundario (capas sobre ink). |
| `paper` | `#F4F4F1` | Fondo claro cálido. Texto sobre oscuro. |
| `signalLime` | `#E7FF18` | **Acento eléctrico de marca.** Ver la regla abajo. |
| `signalLimeSoft` | `#F1FF67` | Variante tenue del lima. |
| `mist` | `#ECEDEA` | Fondo claro sutil (`bg.subtle`). |
| `line` | `#DDDFDC` | Bordes y divisores. |
| `slateText` | `#53606C` | Texto secundario (`fg.muted`). |

Estados (calmos, de marca, **nunca** los defaults de Chakra): `success`, `warning`,
`danger`, `info` (cada uno como `colorPalette`), `dangerSoft` (rojo legible **sobre
ink**), y `status.*` (pending/processing/indexed/failed). Spaces: la rampa
`spaceScale` (ink→teal→lima) vía `spaceColor(spaceId)` — **nunca** colores arcoíris.

### ⚠️ La regla del lima (la más importante de todo el sistema)

> **El lima solo funciona sobre superficies oscuras.**

- Lima sobre ink: **~14:1** de contraste → brilla, eléctrico, premium.
- Lima sobre claro (paper/mist): **~1.05:1** → prácticamente invisible, y como fill
  grande se ve **chillón y barato**.

**Nunca** pongas texto lima ni un fill lima grande sobre una superficie clara.
Si quieres lima en un contexto claro, **reubica el elemento a una superficie oscura**
(o usa la técnica de highlight ink, §5).

Dónde aparece el lima, entonces (siempre sobre oscuro):
- El **mark** del logo sobre paneles ink.
- **Botones primarios** (fill lima + texto ink) — que viven sobre fondos ink (§4).
- **Highlight ink** para enfatizar una palabra en un titular claro (§5).
- Acentos puntuales en paneles oscuros (números/métricas en `PageHero`, íconos del
  nav activo sobre el pill ink, checks sobre círculos ink).

**Antes de poner lima, pregúntate: "¿está sobre oscuro?"** Si no, no va lima ahí.

---

## 3. Superficies: claro vs. oscuro

- **Claro (`bg` paper / `bg.subtle` mist)** = áreas de trabajo y contenido. Texto en
  `fg` (ink) / `fg.muted`.
- **Oscuro (`bg.inverse` ink)** = superficies de **firma**: heroes, formularios con
  CTA primario, momentos "wow", resultados celebrados. Texto en `fg.inverse` (paper)
  / `fg.inverse/70`. **Es donde vive el lima.**

**Cuándo ir a oscuro:**
- El **hero/título de pantalla** → `PageHero` (panel ink con tipografía display).
- Un **formulario cuyo CTA primario importa** → el form va sobre ink (login).
- Un **resultado celebrado** ("47 recuerdos creados") → card ink con la métrica en lima.
- Un **momento de cierre** ("Tu memoria está viva") → card ink.

Para dar **profundidad** a una superficie oscura sin saturar: un **glow radial lima**
muy sutil (`bg=signalLime` + `filter=blur(110px)` + `opacity≈0.08`). Es la alternativa
preferida a las partículas (ver §8).

---

## 4. Botones y CTAs

**El botón primario de Savia = fill lima + texto ink, SIEMPRE sobre un fondo ink.**
Es el botón de marca (igual que la landing). Como el lima necesita oscuro, esto
implica que **los CTAs primarios se alojan en superficies oscuras** (paneles hero,
cards ink, formularios oscuros).

| Contexto | Primario | Secundario |
|----------|----------|------------|
| **Superficie oscura** (ink) | `colorPalette="lime"` → fill lima + texto ink | `variant="outline"` con `color="fg.inverse"` + `borderColor="fg.inverse/30"` |
| **Superficie clara** (paper) | `colorPalette="ink"` → fill ink + texto **paper** | `variant="ghost"` / `variant="plain"` en `fg.muted` |

Reglas duras:
- ❌ **Nunca texto lima en un botón ink** (se probó: "se ve fatal"). El `ink.contrast`
  es paper.
- ❌ **Nunca un botón fill lima sobre claro** (chillón + el texto ink no contrasta con
  el entorno).
- ✅ Si tu pantalla necesita un CTA primario lima, **dale un fondo oscuro** donde
  apoyarlo (un panel, una card, una franja).

---

## 5. Énfasis en titulares claros (highlight ink)

Para enfatizar una palabra con lima **dentro de un titular sobre fondo claro**, no
uses texto lima (invisible). Usa un **highlight tipo marcador con fondo ink y texto
lima** — así el lima queda sobre oscuro, dentro de lo claro.

```tsx
La memoria que{" "}
<Box
  as="span"
  display="inline-block"
  bg="ink"
  color="signalLime"
  fontWeight="400"      // peso ligero: el bloque ya da peso visual
  lineHeight="1"        // hug: que la banda abrace la palabra, no un bloque alto
  px="0.14em"
  py="0.03em"           // banda fina; subir esto la engruesa (se siente tosca)
  borderRadius="0.07em"
>
  conecta
</Box>{" "}
todas tus IAs.
```

Claves aprendidas:
- `inline-block` + `lineHeight="1"` + `py` mínimo → banda fina que abraza el texto
  (un bloque alto se siente "grueso y tosco").
- Peso del texto ligero (400): el bloque ink ya aporta el énfasis.
- En **paneles oscuros** el énfasis sí puede ser texto lima directo → usa `HeroEm` de
  `PageHero` (no necesita highlight, ya está sobre oscuro).

---

## 6. Tipografía

**Fuente:** Inter (`--font-inter`), cargada con `next/font`. En `fontFamily` inline
(canvas/svg) siempre `'var(--font-inter), system-ui, sans-serif'`.

**Regla dura:** usa siempre un `textStyle`; **nunca** `fontSize` + `fontWeight`
sueltos y arbitrarios.

| `textStyle` | Para | Notas |
|-------------|------|-------|
| `displayXl/2xl/3xl` | Titulares hero grandes | peso **300**, line-height comprimido (~0.9–1.1) |
| `pageTitle` | Título de pantalla | displayMd, peso 600 |
| `cardTitle` | Título de card/sección | lg, 600 |
| `titleLg` | Subtítulos | 600 |
| `metric` | Números grandes | tabular-nums, 700 |
| `bodyLg` / cuerpo | Texto | peso 400, line-height holgado (1.5–1.75) |
| `caption` | Texto auxiliar | sm |
| `label` | Eyebrows / etiquetas | 12px, uppercase, letter-spacing 0.12em |

Jerarquía de display: peso **300 (light)** para el cuerpo del headline, **600** para
la palabra de énfasis. Headlines con line-height apretado; cuerpo con line-height
expandido para respirar.

---

## 7. Espaciado y layout

- **Generoso.** Los formularios necesitan aire: `gap="8"` entre bloques, `gap="3"`
  entre label e input. Un form apretado "se siente plano".
- **Una sola pantalla cuando aplica.** En pantallas tipo login, fija a `h="100svh"` +
  `overflow="hidden"` y posiciona los adornos en `absolute` (no en flujo) para no
  generar scroll.
- **Patrón split-panel** (login): un lado **oscuro con el formulario directo sobre el
  fondo** (sin card), y el otro **claro que complementa con espacio** (statement
  editorial + journey). El formulario va en lo oscuro; lo claro respira.
- **Claridad de propósito para usuarios nuevos.** Si una pantalla no se explica sola
  (p. ej. "¿para qué me logueo?"), muestra el **journey en pasos** (stepper vertical:
  número + título + qué es). El paso actual se marca activo (círculo ink).
- Usa los tokens de contenedor (`sizes.container*`) y de spacing fluido; no inventes
  anchos sueltos.

---

## 8. Motion

- Curva de marca: `EASE_SAVIA = [0.22, 1, 0.36, 1]` (de `@savia-os/ui`).
- **Entrada**: envuelve secciones en `FadeInUp`. Stagger por índice (`delay = i*0.08`).
- **Micro-interacciones**: hover de cards = lift sutil; éxito = flash/pulso.
- **Siempre** respeta `prefers-reduced-motion` (ya resuelto en `FadeInUp`).
- **Partículas (`SaviaParticles`)**: tienen sentido en **secciones puntuales**, **no**
  como fondo de toda la app (eso es solo la landing). En el producto, prefiere el
  **glow radial** (§3) para profundidad. No abuses.

---

## 9. Imágenes y marca

- **`SaviaMark`** (la forma geométrica de 4 pliegues): logo, loaders, acentos.
  Lockup del logo = **mark + wordmark "SAVIA"** (uppercase, letter-spacing 0.08em).
  Sobre oscuro, el **mark va en lima** (brilla) y el wordmark en paper.
- **La isla de Savia** (`savia-island.png`, render 3D de la memoria flotante): pieza
  hero de marca. Úsala con criterio en momentos clave; si la pones, que **no genere
  scroll** (posición absoluta, sangrando del borde). No es decoración de relleno.
- Imágenes decorativas: `alt=""`. Nunca metáforas de plantas/naturaleza.

---

## 10. Voz y copy

- Idioma: **español**, voz premium y precisa.
- **One-liner oficial:** _"La memoria que conecta todas tus IAs."_ Alinea el copy a
  esta idea: una sola memoria, **reunida** de todas tus IAs, **conectada** de vuelta a
  todas. (Ej. journey del login: Entra → Reúne tu memoria → Conéctala a tus IAs.)
- Léxico preferido: **memoria, conecta, reúne, recuerda, tus IAs, contexto, la capa**.
- Evitar: _plataforma, solución, integra, sincroniza, almacena_. **Sin metáforas de
  plantas / savia-sap / verde / naturaleza** — Savia = continuidad de la memoria.
- Primera persona y orientado al usuario ("tu memoria", "tus IAs"). Explica el
  propósito, no solo la mecánica.

---

## 11. Accesibilidad

- **Contraste AA** garantizado. Verifica cada uso de lima (debe ir sobre oscuro) y la
  tinta de `spaceScale` (la función `spaceColor` ya devuelve la tinta legible).
- **Nunca color solo**: estados con ícono + texto (`StatusBadge`), no solo color.
- **Focus visible**: sobre claro usa un anillo **ink** (el lima no se ve); sobre
  oscuro, lima. Todo interactivo operable por teclado.
- HTML semántico (`<main>`, `<nav>`, `<table>` para matrices, labels en inputs vía
  `Field`). Respeta `prefers-reduced-motion`.

---

## 12. Arquitectura (DRY) y tokens

- **Fuente única de verdad**: `@savia-os/design-tokens` (el `system` de Chakra:
  tokens, semantic-tokens, text-styles). **Ambas apps** lo consumen vía
  `transpilePackages`. No dupliques el theme.
- **Primitivas compartidas**: `@savia-os/ui` (átomos de marca + primitivas genéricas).
  La composición de dominio vive local en cada app.
- **Regla "tokens o nada"**: ❌ cero hex hardcodeado, ❌ cero colores crudos de Chakra
  (`red.500`, etc.) fuera del paquete de tokens. Si falta un color, **se añade al
  token primero**. Hay un guardrail de CI (`pnpm check:tokens`,
  `scripts/check-design-tokens.mjs`) que lo enforza.
- Para opacidad sobre un token usa la sintaxis Panda: `color="fg.inverse/70"` (no
  `rgba(...)`).

---

## 13. Primitivas disponibles

De **`@savia-os/ui`** (compartidas app + landing):

| Primitiva | Para |
|-----------|------|
| `SaviaProvider` | Provider base (system + Toaster) |
| `SaviaMark` | La marca geométrica |
| `SaviaParticles` | Partículas atmosféricas (uso puntual) |
| `FadeInUp` | Entrada animada (respeta reduced-motion) |
| `SectionHeader` | Eyebrow + título + descripción |
| `Card` | Superficie: `variant="flat" | "elevated" | "inverse"` (inverse = panel ink). Autocontenida (fija su propio `color`). |
| `Dialog` / `ConfirmDialog` | Modal con focus-trap/Esc; confirmaciones destructivas (reemplazan `window.confirm`) |
| `Toaster` / `notify` | Toasts (`notify.success/error/info/...`) |
| `EmptyState` | Estado vacío unificado |
| `Skeleton` / `CardSkeleton` | Carga (en vez de spinner) |
| `Field` | Input con label + error + aria |
| `StatusBadge` | Pill de estado (ícono + texto, nunca solo color) |
| `BRAND_COLORS`, `EASE_SAVIA` | Constantes de marca |

De **`apps/app`** (dominio del producto): `PageHero` + `HeroEm` (panel ink de firma /
énfasis lima sobre oscuro), `PageHeader` (encabezado claro), `SpaceGlyph` (avatar de
space con `spaceColor`), `OtpInput` (con `tone="dark"`), `CopyBlock`, y
`lib/space-colors.ts`.

---

## 14. Checklist antes de entregar

- [ ] **Lima solo sobre oscuro.** Ningún texto/fill lima sobre claro.
- [ ] **CTA primario** = lima sobre ink, o ink sobre claro. Nunca texto lima en botón.
- [ ] **Cero hex / colores Chakra crudos** (`pnpm check:tokens` en verde).
- [ ] **Tipografía por `textStyle`**, sin `fontSize`+`fontWeight` sueltos.
- [ ] **Todos los estados** diseñados: carga (skeleton), vacío (`EmptyState`), error
      (toast), éxito.
- [ ] **Motion** con `FadeInUp`/`EASE_SAVIA` y `prefers-reduced-motion`.
- [ ] **A11y**: contraste AA, ícono+texto (no solo color), focus visible, teclado,
      labels.
- [ ] **Responsive** 320px → desktop; sin scroll indebido.
- [ ] **Voz Savia**: español, primera persona, alineado al one-liner, sin metáforas de
      plantas.
- [ ] **Test del outlier**: ¿esta pantalla se siente única y considerada, o es un SaaS
      genérico? Si es lo segundo, no está lista.
