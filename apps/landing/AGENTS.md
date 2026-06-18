# @savia-os/landing — Agent Rules

## Stack

- **Next.js 16** App Router + **React 19** — Server Components by default. `"use client"` only for browser APIs, event handlers, or React hooks.
- **Chakra UI v3** (Panda CSS) — primary component and styling API. Import from `@chakra-ui/react`.
- **Framer Motion 12** — UI animations. Import from `framer-motion`.
- **Zod** — form validation. Define schemas in `src/lib/`, never inline.
- **next/dynamic** — code-splitting for heavy client components.
- **Lucide React** — icons only. Sizes: 16 (inline), 20 (buttons), 24 (feature callouts).

## RSC Architecture

- All files in `src/app/` and `src/components/landing/` are Server Components unless they declare `"use client"`.
- **`next/dynamic` with `ssr: false` is NOT allowed in Server Components** — Turbopack throws a build error. Use it only from Client Components.
- `EcosystemScroll`: lazy-loaded from `src/app/page.tsx` (Server Component) with default SSR and `<Box minH="100svh" />` loading skeleton.
- `WaitlistForm`: lazy-loaded from `src/components/landing/waitlist-section.tsx` (Client Component) with `<Box minH="20rem" bg="bg.inset" borderRadius="panel" />` loading skeleton.

## Design tokens

All decisions live in `src/theme/`:

| File | Content |
|------|---------|
| `tokens.ts` | Raw palette, type scale, radii, shadows, fluid spacing, containers, easings |
| `semantic-tokens.ts` | Semantic aliases: `bg`, `fg`, `fg.muted`, `border.subtle`, `accent` |
| `text-styles.ts` | Named text presets: `displayXl`, `titleLg`, `bodyLg`, etc. |
| `index.ts` | Assembles and exports `system` via `createSystem(defaultConfig, config)` |

**Never hardcode hex values in components.** Always use a token name.

### Panda CSS alpha syntax

For opacity on a semantic token, use the `/` modifier:

```tsx
color="fg.inverse/28"   // 28% opacity
color="fg.inverse/50"   // 50% opacity
```

Do **not** use `rgba(244,244,241,0.28)` — it breaks the token system.

### Brand constants

`src/lib/constants.ts` exports:

```ts
export const BRAND_COLORS = { lime: '#E7FF18', ink: '#0B2529' }
export const EASE_SAVIA = [0.22, 1, 0.36, 1] as const
```

Never declare `const LIME = '#E7FF18'` locally — import `BRAND_COLORS`.

## Styling rules

- Chakra style props as primary API: `bg`, `color`, `px`, `borderRadius`, etc.
- Semantic tokens (`bg`, `fg`) when the value should adapt to context. Raw tokens for fixed values.
- `overflowX: "hidden"` belongs on `html`, **not** `body` — on body it breaks sticky positioning.

## Animations (Framer Motion)

### FadeInUp

Component at `src/components/ui/animated-section.tsx`:

```tsx
import { FadeInUp } from '@/components/ui/animated-section';

<FadeInUp delay={0.1}>
  <MySection />
</FadeInUp>
```

- Uses `useInView` with `once: true, margin: '-64px 0px'`.
- Respects `useReducedMotion` — zero duration and no displacement when active.
- `delay` prop for stagger (e.g. `index * 0.12`).

### `motion.div` + `Box` pattern

`motion.div` and Chakra's `Box` both have a `transition` prop with incompatible types. Correct pattern:

```tsx
<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: 0.7, ease: EASE_SAVIA }}
>
  <Box color="fg">content</Box>  {/* Chakra props here */}
</motion.div>
```

Do **not** pass Framer Motion props to `Box` or vice versa.

### Section animation architecture

- Individual sections (`ControlSection`, `Pricing`, `WaitlistSection`) are clean components — they do **not** contain their own `FadeInUp`.
- `FadeInUp` wrapping is applied at `src/app/page.tsx` level for centralized control.
- Per-card stagger is handled internally by the component (e.g. `HowItWorks`).

### AnimatePresence

Use for mount/unmount animations (e.g. mobile menu):

```tsx
<AnimatePresence>
  {menuOpen && <MobileMenu onClose={close} />}
</AnimatePresence>
```

## Mobile menu — focus trap

`MobileMenu` in `site-header.tsx`:

- `role="dialog"` + `aria-modal={true}` + `aria-label="Menú de navegación"`.
- Hamburger button has `aria-haspopup="dialog"`.
- Manual focus trap: `keydown` listener on `document`, cycles Tab/Shift+Tab between first/last focusable elements from `querySelectorAll('a[href], button')`.
- Escape closes the menu.
- On mount, focuses the first interactive element.

## Form validation — Zod as single source of truth

`waitlistSchema` in `src/lib/waitlist.ts` is the single source of truth. Do not duplicate rules in the component.

Pattern in `waitlist-form.tsx`:

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
```

## Component rules

- Landing sections: `src/components/landing/`.
- Shared primitives: `src/components/ui/`.
- Content (copy, nav items, testimonials): never inline in JSX — extract to constants.
- Extract a local component when a JSX block has a clear semantic role, even if used once.
- Do not create a shared component for something used only once and unlikely to be reused.

## Social links — "coming soon" pattern

`SOCIAL_ITEMS` in `site-footer.tsx` uses `href: ''` when the URL is not yet configured:

```tsx
href ? (
  <Link href={href} target="_blank" rel="noopener noreferrer">...</Link>
) : (
  <Box as="span" opacity={0.3} cursor="not-allowed" aria-label={`${label} (próximamente)`}>...</Box>
)
```

Never use `href="#"` for pending links.

## Accessibility

- All interactive elements must be focusable and keyboard-operable.
- Use semantic HTML: `<main>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<article>`.
- Navigation must include a mobile menu — never hide nav without a mobile alternative.
- Animated elements must respect `prefers-reduced-motion`.
- Images: meaningful `alt`. Decorative images: `alt=""`.

## Copy

- Default language: **Spanish**, premium and precise voice.
- Avoid green, leaves, plant, nature metaphors. Savia = continuity of memory.
- Official one-liner: **"La memoria que conecta todas tus IAs."**
- Preferred vocabulary: "memoria", "conecta", "recuerda", "tus IAs", "la capa", "contexto".
- Avoid: "plataforma", "solución", "integra", "sincroniza", "almacena".

## Typography

- Inter loaded via `next/font/google` in `layout.tsx`. CSS variable: `--font-inter`.
- In inline `fontFamily` (canvas, SVG): `'var(--font-inter), system-ui, sans-serif'` — never just `'system-ui'`.
- Display headings: weight 300 for headline body, 600 for emphasis parts.
- Never load fonts with `<link>` tags or from external CDNs.

## Commands

From monorepo root:
```
pnpm landing:dev        # 127.0.0.1:4343
pnpm landing:build
pnpm landing:typecheck
pnpm landing:lint
```

From `apps/landing/`:
```
pnpm dev
pnpm build
pnpm typecheck
pnpm export:ds
```
