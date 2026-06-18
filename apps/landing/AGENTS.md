# SAVIA Landing V3 — Agent Rules

## Stack
- **Next.js** (App Router) + **React 19** — Server Components by default. Only add `"use client"` when you need browser APIs, event handlers, or React hooks.
- **Chakra UI v3** — primary component and styling API. Import from `@chakra-ui/react`.
- **Lucide React** — icons only. Keep icon sizes consistent: 16 (inline), 20 (buttons), 24 (feature callouts).
- **Zod** — form validation. Define schemas in `src/lib/`, never inline.

## Design tokens
All design decisions live in `src/theme/`. Token structure:
- `tokens.ts` → raw palette, type scale, radii, shadows, spacing, sizes, easings
- `semantic-tokens.ts` → semantic aliases (`bg`, `fg`, `fg.muted`, `border.subtle`, `accent`)
- `text-styles.ts` → named text presets (`displayXl`, `titleLg`, `bodyLg`, etc.)
- `recipes.ts` → component variant overrides
- `index.ts` → assembles and exports `system`

**Never hardcode hex values in components.** Always use a token name.

## Styling rules
- Use Chakra style props as the primary styling API: `bg`, `color`, `px`, `borderRadius`, etc.
- Reference tokens directly by name: `bg="paper"`, `color="fg.muted"`, `borderRadius="card"`.
- For one-off values that don't need a token, use direct CSS values. Do not create tokens for single-use measurements.
- Use semantic tokens (`bg`, `fg`) when the value should adapt to context (e.g., section tone). Use raw tokens (`paper`, `ink`) when you want a fixed value.

## Component rules
- Keep sections in `src/components/landing/`.
- Keep content (copy, nav items, testimonials, etc.) in `src/components/landing/landing-content.ts` — never inline inside JSX.
- Keep shared primitives (SectionShell, SectionHeading, etc.) in `src/components/ui/`.
- Extract a local component when a JSX block has a clear semantic role, even if used once.
- Do not create a shared component for something used only once and unlikely to be reused.

## Accessibility
- All interactive elements must be focusable and keyboard-operable.
- Use semantic HTML: `<main>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<article>`.
- Navigation must include a mobile menu — never hide the nav without a mobile alternative.
- Animated elements must respect `prefers-reduced-motion`.
- Images must have meaningful `alt` text. Decorative images use `alt=""`.

## Copy
- Default to Spanish, premium and precise voice.
- Avoid green, leaves, plant metaphors, and nature imagery. SAVIA = continuity of memory.

## Font
- Inter loaded via `next/font/google` — CSS variable `--font-inter`.
- Display headings: weight 300 (light) for body text of headline, 600 (semibold) for emphasis parts.
- Never load fonts with `<link>` tags or from external CDNs.
