# @savia-os/landing — Reglas para Claude

## Stack

- **Next.js 16** App Router + **React 19** — Server Components por defecto. `"use client"` solo cuando se necesiten APIs de browser, event handlers, o hooks de React.
- **Chakra UI v3** (Panda CSS bajo el capó) — API principal de componentes y estilos. Importar desde `@chakra-ui/react`.
- **Framer Motion 12** — animaciones de UI. Importar desde `framer-motion`.
- **Zod** — validación de forms y datos. Schemas en `src/lib/`, nunca inline.
- **next/dynamic** — code-splitting para componentes cliente pesados.
- **Lucide React** — íconos. Tamaños: 16 (inline), 20 (botones), 24 (feature callouts).

## Arquitectura RSC

- Todos los archivos en `src/app/` y `src/components/landing/` son Server Components salvo que declaren `"use client"`.
- **`next/dynamic` con `ssr: false` NO está permitido en Server Components** — Turbopack lanza error de build. Debe usarse desde un Client Component.
- `EcosystemScroll` está lazy-cargado desde `src/app/page.tsx` (Server Component) con `ssr` por defecto (sin `ssr: false`) y un skeleton `<Box minH="100svh" />` como loading.
- `WaitlistForm` está lazy-cargado desde `src/components/landing/waitlist-section.tsx` (Client Component) con loading skeleton `<Box minH="20rem" bg="bg.inset" borderRadius="panel" />`.

## Design tokens

Todo en `src/theme/`:

| Archivo | Contenido |
|---------|-----------|
| `tokens.ts` | Paleta raw, escala de tipos, radii, sombras, spacing fluido, contenedores, easings |
| `semantic-tokens.ts` | Aliases semánticos: `bg`, `fg`, `fg.muted`, `border.subtle`, `accent` |
| `text-styles.ts` | Presets de texto: `displayXl`, `titleLg`, `bodyLg`, etc. |
| `index.ts` | Ensambla y exporta `system` con `createSystem(defaultConfig, config)` |

**Nunca hardcodear hex en componentes.** Usar siempre el nombre del token.

### Sintaxis alpha de Panda CSS

Para opacidad sobre un token semántico usar el modificador `/`:

```tsx
color="fg.inverse/28"   // 28% de opacidad
color="fg.inverse/50"   // 50% de opacidad
```

**No** usar `rgba(244,244,241,0.28)` — rompe el sistema de tokens.

### Constantes de marca

`src/lib/constants.ts` exporta:

```ts
export const BRAND_COLORS = { lime: '#E7FF18', ink: '#0B2529' }
export const EASE_SAVIA = [0.22, 1, 0.36, 1] as const
```

Nunca declarar `const LIME = '#E7FF18'` localmente — importar `BRAND_COLORS`.

## Reglas de estilizado

- Chakra style props como API primaria: `bg`, `color`, `px`, `borderRadius`, etc.
- Tokens semánticos (`bg`, `fg`) cuando el valor debe adaptarse al contexto. Tokens raw (`ink`, `lime`) para valores fijos.
- `color="fg.inverse/28"` para opacidades sobre tokens (sintaxis Panda CSS).
- `overflowX: "hidden"` va en el bloque `html`, **no** en `body` — si va en body, las sticky positions dejan de funcionar.

## Animaciones (Framer Motion)

### FadeInUp

Componente en `src/components/ui/animated-section.tsx`:

```tsx
import { FadeInUp } from '@/components/ui/animated-section';

<FadeInUp delay={0.1}>
  <MiSeccion />
</FadeInUp>
```

- Usa `useInView` con `once: true, margin: '-64px 0px'`.
- Respeta `useReducedMotion` — duración 0 y sin desplazamiento si está activo.
- `delay` prop para stagger (ej: `index * 0.12`).

### Patrón `motion.div` + `Box`

`motion.div` y `Box` de Chakra tienen prop `transition` con tipos incompatibles. Patrón correcto:

```tsx
<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: 0.7, ease: EASE_SAVIA }}
>
  <Box color="fg">contenido</Box>  {/* Chakra props aquí */}
</motion.div>
```

**No** pasar props de Framer Motion a `Box` ni viceversa.

### AnimatePresence

Usar para animaciones de montaje/desmontaje (ej: menú móvil):

```tsx
<AnimatePresence>
  {menuOpen && <MobileMenu onClose={close} />}
</AnimatePresence>
```

### Arquitectura de animaciones de secciones

- Las secciones individuales (`ControlSection`, `Pricing`, `WaitlistSection`, etc.) **no** contienen su propio `FadeInUp` — son componentes limpios.
- El wrapping con `FadeInUp` se hace desde `src/app/page.tsx` para centralizar el control.
- Stagger por tarjeta se maneja internamente en el componente (ej: `HowItWorks`).

## Menú móvil — focus trap

`MobileMenu` en `site-header.tsx` implementa:

- `role="dialog"` + `aria-modal={true}` + `aria-label="Menú de navegación"`.
- El botón hamburguesa tiene `aria-haspopup="dialog"`.
- Focus trap manual: listener `keydown` en `document` con `querySelectorAll('a[href], button')` para ciclar Tab/Shift+Tab entre primer y último elemento focusable.
- Escape cierra el menú.
- Al montar, hace focus en el primer elemento interactivo.

## Validación con Zod (single source of truth)

`waitlistSchema` en `src/lib/waitlist.ts` es la única fuente de verdad para validación del form. No duplicar reglas en el componente.

Patrón en `waitlist-form.tsx`:

```ts
function buildPayload() {
  return { email: emailValue, role: roleValue, experience, aiTools: [...aiTools].join(','), monthlySpend };
}
function fieldError(field: string): string | undefined {
  if (!submitAttempted && !touched.has(field)) return undefined;
  const result = waitlistSchema.safeParse(buildPayload());
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === field)?.message;
}
function handleSubmit(e: { preventDefault(): void }) {
  setSubmitAttempted(true);
  if (!waitlistSchema.safeParse(buildPayload()).success) { e.preventDefault(); return; }
  setSubmittedEmail(emailValue.trim().toLowerCase());
}
```

## Reglas de componentes

- Secciones del landing: `src/components/landing/`.
- Primitivos compartidos: `src/components/ui/`.
- Copy y contenido (nav items, testimonials, etc.): nunca inline en JSX — extraer a constantes.
- Extraer componente local cuando un bloque JSX tiene un rol semántico claro, aunque se use una sola vez.
- No crear componente compartido para algo que solo se usa una vez.

## Links sociales — patrón "próximamente"

`SOCIAL_ITEMS` en `site-footer.tsx` usa `href: ''` cuando la URL no está configurada:

```tsx
href ? (
  <Link href={href} target="_blank" rel="noopener noreferrer">...</Link>
) : (
  <Box as="span" opacity={0.3} cursor="not-allowed" aria-label={`${label} (próximamente)`}>...</Box>
)
```

Nunca usar `href="#"` para links pendientes.

## Accesibilidad

- Todo elemento interactivo debe ser focusable y operable con teclado.
- HTML semántico: `<main>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<article>`.
- Navegación incluye menú móvil — nunca ocultar nav sin alternativa mobile.
- Animaciones respetan `prefers-reduced-motion` (ver `FadeInUp`).
- Imágenes: `alt` descriptivo. Decorativas: `alt=""`.

## Copy

- Idioma por defecto: **español**, voz premium y precisa.
- Nunca metáforas de plantas, hojas, verde, naturaleza. Savia = continuidad de la memoria.
- One-liner oficial: **"La memoria que conecta todas tus IAs."**
- Léxico preferido: "memoria", "conecta", "recuerda", "tus IAs", "la capa", "contexto".
- Evitar: "plataforma", "solución", "integra", "sincroniza", "almacena".

## Tipografía

- Inter cargada con `next/font/google` en `layout.tsx`. Variable CSS: `--font-inter`.
- En `fontFamily` inline (canvas, svg): `'var(--font-inter), system-ui, sans-serif'` — nunca solo `'system-ui'`.
- Display headings: peso 300 (light) para cuerpo del headline, 600 (semibold) para énfasis.
- Nunca cargar fuentes con `<link>` ni desde CDNs externos.

## Comandos

Desde la raíz del monorepo:
```
pnpm landing:dev        # 127.0.0.1:4343
pnpm landing:build      # build con caché Turbo
pnpm landing:typecheck
pnpm landing:lint
```

Desde `apps/landing/`:
```
pnpm dev
pnpm build
pnpm typecheck
pnpm export:ds          # genera design-system-preview/ estático
```
