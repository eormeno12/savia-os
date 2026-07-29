# 05 — Sistema de diseño compartido (DRY entre app y landing)

> Cómo garantizamos que el rediseño sea **una sola fuente de verdad** consumida por
> los dos frontends (`apps/app` y `apps/landing`), y no dos copias que divergen.
> Esta es la columna vertebral de las [fundaciones](01-foundations.md): sin ella, el
> rediseño nace ya duplicado.

---

## 1. El problema, hoy (medido)

El design system **ya está duplicado**, no compartido. Los cuatro archivos del theme
son **byte por byte idénticos** entre las dos apps:

```
apps/app/src/theme/tokens.ts          ≡  apps/landing/src/theme/tokens.ts
apps/app/src/theme/semantic-tokens.ts ≡  apps/landing/src/theme/semantic-tokens.ts
apps/app/src/theme/text-styles.ts     ≡  apps/landing/src/theme/text-styles.ts
apps/app/src/theme/index.ts           ≡  apps/landing/src/theme/index.ts
```

Lo mismo con los átomos de marca: `SaviaMark`, `FadeInUp`, `EASE_SAVIA`/`BRAND_COLORS`
viven solo en `apps/landing` y el app no los usa (los reimplementaría a mano).

**Por qué es una bomba de tiempo**: el rediseño va a tocar tokens (añadir
`spaceScale`, colores de estado, superficies oscuras, textStyles de producto — ver
[01](01-foundations.md)). Con dos copias, cada cambio hay que aplicarlo dos veces; en
la práctica se aplica en una, las copias divergen, y "la marca en la app" deja de ser
"la marca en la landing". El monorepo ya tiene la infraestructura para evitarlo
(`pnpm-workspace.yaml`, `packages/*`, `workspace:*`) — solo no se está usando para el
diseño.

---

## 2. El principio: DRY el *lenguaje*, no cada componente

DRY mal aplicado es tan dañino como la duplicación. La regla que adoptamos:

> **Se comparte el lenguaje de diseño (tokens, átomos de marca, constantes de motion).
> NO se comparte la composición de dominio (las pantallas de cada app).**

- **Sí compartir**: lo que *debe* ser idéntico en ambas apps por definición de marca —
  la paleta, la tipografía, el radio de una card, la curva de easing, la marca
  geométrica, el `FadeInUp`. Si difieren, es un bug.
- **No compartir**: lo que es propio del dominio de cada app — el `AppNav` y el
  `MemoryMap` del producto, el `Pricing` y el `Hero` de la landing. Forzar estos a un
  paquete común es *falso reuso*: acopla dos cosas que cambian por razones distintas.

La línea divisoria es **"¿cambiaría esto por una razón de marca o por una razón de
producto?"**. Marca → compartido. Producto → local.

---

## 3. Arquitectura: tres capas

```
┌─────────────────────────────────────────────────────────────┐
│  @savia-os/design-tokens   (capa 1 — datos puros, sin React) │
│  tokens · semantic-tokens · text-styles · createSystem()      │
│  → exporta `system` de Chakra. CERO componentes, cero deps.   │
└─────────────────────────────────────────────────────────────┘
                     ▲                         ▲
                     │ consume                 │ consume
┌─────────────────────────────────────────────────────────────┐
│  @savia-os/ui   (capa 2 — átomos de marca, React + Framer)    │
│  SaviaMark · SaviaParticles · FadeInUp · SectionHeader ·      │
│  constants (EASE_SAVIA, BRAND_COLORS) · Provider base         │
│  + primitivas del rediseño que sean genéricas:                │
│    Card · Dialog · Toaster · EmptyState · Skeleton · Field    │
└─────────────────────────────────────────────────────────────┘
          ▲                                   ▲
          │ consume                           │ consume
┌────────────────────────┐         ┌──────────────────────────┐
│  apps/app  (capa 3)    │         │  apps/landing  (capa 3)  │
│  AppNav · MemoryMap ·  │         │  Hero · Pricing ·        │
│  SpaceCard · OtpInput· │         │  Ecosystem · Waitlist ·  │
│  CopyBlock (dominio)   │         │  secciones de marketing  │
└────────────────────────┘         └──────────────────────────┘
```

### Por qué dos paquetes y no uno

- **`@savia-os/design-tokens`** es *datos*: no importa React, no tiene `"use client"`,
  no arrastra Framer Motion. Esto importa porque la landing es **RSC-heavy** (Server
  Components por defecto) — los tokens deben poder consumirse desde un Server Component
  sin pagar el coste de cliente. Separarlos mantiene el árbol RSC limpio y el
  tree-shaking honesto.
- **`@savia-os/ui`** es *componentes*: React + Framer + Chakra. Lo cliente va aquí.

> Alternativa aceptable: un solo `@savia-os/ui` con subpath exports
> (`@savia-os/ui/system` para los tokens, `@savia-os/ui/components` para lo demás). Se
> decide en implementación; lo importante es la **separación lógica tokens ↔ componentes**,
> no el número de `package.json`. Recomendación: dos paquetes, por la limpieza RSC.

---

## 4. Qué vive dónde (tabla de decisión)

| Artefacto | Capa | Paquete |
|-----------|------|---------|
| `tokens` (paleta, radii, spacing, easings) | 1 | `@savia-os/design-tokens` |
| `semantic-tokens` (bg/fg/border, paletas) | 1 | `@savia-os/design-tokens` |
| `text-styles` | 1 | `@savia-os/design-tokens` |
| `createSystem()` → `system` + `globalCss` | 1 | `@savia-os/design-tokens` |
| `EASE_SAVIA`, `BRAND_COLORS` | 1/2 | `@savia-os/design-tokens` (constantes) |
| `SaviaMark` | 2 | `@savia-os/ui` |
| `SaviaParticles` | 2 | `@savia-os/ui` |
| `FadeInUp` / wrappers de motion | 2 | `@savia-os/ui` |
| `SectionHeader` (eyebrow+título) | 2 | `@savia-os/ui` |
| `Provider` base de Chakra | 2 | `@savia-os/ui` |
| `Card`, `Dialog`, `ConfirmDialog`, `Toaster`, `EmptyState`, `Skeleton`, `Field`, `StatusBadge` | 2 | `@savia-os/ui` (genéricos, sin copy de dominio) |
| `OtpInput`, `CopyBlock` | 2 ó 3 | `@savia-os/ui` si la landing los reusa; si no, `apps/app` |
| `SpaceGlyph`, `MemoryMap`, `AppNav`, `SpaceCard` | 3 | `apps/app` (dominio del producto) |
| `Hero`, `Pricing`, `Ecosystem`, `Waitlist` | 3 | `apps/landing` (dominio marketing) |
| `spaceColor()` / `packLayout()` | 3 | `apps/app/src/lib` (concepto de producto) |

Regla práctica para decidir capa 2 vs 3 de una primitiva nueva: **¿la landing la
usaría tal cual, sin copy ni datos de producto?** Sí → capa 2. No → capa 3.

---

## 5. Cómo lo *garantizamos* (no solo lo refactorizamos una vez)

Refactorizar a un paquete compartido es necesario pero no suficiente: hay que impedir
que la duplicación reaparezca. Seis mecanismos, de más fuerte a más blando:

1. **Fuente única física.** Los tokens existen en **un solo** archivo. Tras la
   migración, `apps/app/src/theme/` y `apps/landing/src/theme/` se **borran** y se
   reemplazan por `import { system } from "@savia-os/design-tokens"`. No hay dónde
   divergir porque no hay copia.

2. **`workspace:*` → sin drift de versión.** Ambas apps consumen `@savia-os/*` con
   `workspace:*` (como ya hacen con `@savia-os/contracts`). Siempre la misma versión,
   en el mismo commit. Imposible que una app quede atrás.

3. **Guardrail de CI/lint — "tokens o nada".** Una regla (ESLint custom o un check de
   grep en CI) que **falla el build** si aparece un hex literal o un color crudo de
   Chakra (`red.500`, `#0B2529`, etc.) fuera de `@savia-os/design-tokens`. Es el
   criterio de aceptación de [03](03-roadmap.md) convertido en gate automático:
   ```
   grep -rE '#[0-9a-fA-F]{6}|\b(red|green|blue|orange|purple|teal|pink|cyan)\.[0-9]' \
        apps/*/src --include=*.tsx | grep -v design-tokens   # debe dar vacío
   ```

4. **Preview canónico generado desde el paquete.** El `design-system-preview/` que ya
   existe en la landing (`pnpm export:ds`) se regenera **desde `@savia-os/design-tokens`**
   y pasa a ser la referencia visual única de marca para ambas apps. Un cambio de token
   se ve reflejado en un solo preview, no en dos.

5. **Un `Provider` base compartido.** El `globalCss`, el skip-link, la config de
   `createSystem` y el `Toaster` se configuran **una vez** en el `Provider` de
   `@savia-os/ui`. Cada app lo envuelve; no reimplementa la base.

6. **El rúbrico de PR.** Todo PR de UI se mide contra los criterios de
   [03-roadmap.md](03-roadmap.md) — "cero hex", "tipografía por `textStyle`", etc. Lo
   social respalda lo automático.

---

## 6. Migración (parte de la Fase 0)

Es un refactor de bajo riesgo porque los tokens **ya son idénticos** — extraer no
cambia ningún valor, solo el lugar:

1. Crear `packages/design-tokens/` con `name: "@savia-os/design-tokens"`, exportando
   `tokens`, `semanticTokens`, `textStyles` y `system` (mover los 4 archivos tal cual
   desde cualquiera de las dos apps — son iguales).
2. Crear `packages/ui/` con `name: "@savia-os/ui"`, dependiente de `@savia-os/design-tokens`
   y `@chakra-ui/react`; **mover** `SaviaMark`, `FadeInUp`, `SaviaParticles`,
   `SectionHeader`, constantes y el `Provider` base desde la landing.
3. En `apps/landing`: borrar `src/theme/*` y los componentes movidos; importar de los
   paquetes. **Verificar que el build y el visual no cambian** (es la red de seguridad:
   si la landing se ve igual, la extracción fue correcta).
4. En `apps/app`: borrar `src/theme/*`; importar `system` del paquete. Empezar a
   consumir `SaviaMark`/`FadeInUp` en el shell.
5. **Recién entonces** extender los tokens (`spaceScale`, estados, etc.) — una sola vez,
   en el paquete, y ambas apps lo reciben.
6. Añadir el guardrail de CI (§5.3) para que no se reintroduzcan hex.

> Orden importa: extraer **antes** de extender. Si se extienden los tokens en el app
> primero y luego se extrae, hay que reconciliar divergencias. Extraer-luego-extender
> es lineal.

### Consideraciones RSC / Chakra

- `@savia-os/design-tokens` no lleva `"use client"` — consumible desde Server
  Components de la landing.
- Los componentes de `@savia-os/ui` que usen hooks/Framer llevan `"use client"`; la
  landing ya respeta la regla de no usar `next/dynamic ssr:false` en Server Components
  ([landing/CLAUDE.md](../../../apps/landing/CLAUDE.md)) — se mantiene.
- `tsconfig`: los paquetes extienden `@savia-os/tsconfig` (ya existe). Sin config nueva.

---

## 7. Criterios de aceptación

- [ ] `apps/app/src/theme/` y `apps/landing/src/theme/` **no existen**; ambos importan
      de `@savia-os/design-tokens`.
- [ ] `SaviaMark`, `FadeInUp`, `SaviaParticles`, constantes y `Provider` base viven en
      `@savia-os/ui` y **ninguna app los redefine**.
- [ ] La landing se ve y buildea **idéntica** tras la extracción (red de seguridad).
- [ ] El guardrail de CI rechaza hex/colores crudos fuera del paquete de tokens.
- [ ] `pnpm build` de ambas apps verde con `workspace:*`.
- [ ] `design-system-preview` se genera desde el paquete compartido.
- [ ] Un cambio de token (ej. afinar `signalLime`) se hace en **un** lugar y aparece
      en ambas apps sin más ediciones.

---

## 8. Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Cómo garantizamos estandarización? | Un solo `system` de Chakra en `@savia-os/design-tokens`, consumido por ambas apps. La marca no puede divergir porque hay una sola definición. |
| ¿Cómo garantizamos DRY? | Tokens y átomos de marca en paquetes compartidos (`workspace:*`); pantallas de dominio local en cada app. DRY del lenguaje, no de la composición. |
| ¿Cómo evitamos que reaparezca la duplicación? | Fuente física única + guardrail de CI ("tokens o nada") + preview canónico + rúbrico de PR. |
| ¿Es riesgoso? | No: los tokens ya son idénticos; extraer no cambia valores. La landing intacta es la prueba. |

Esta capa es el **prerequisito #1 de la Fase 0** en [03-roadmap.md](03-roadmap.md):
todo lo demás del rediseño se construye encima de ella.
