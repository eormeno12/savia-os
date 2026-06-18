# Plan Correctivo — Priorizado

---

## Fase 0: Bugs críticos antes de producción (< 2h total)

Estas correcciones bloquean directamente la experiencia de usuario o introducen bugs visibles.

---

### 0.1 — Fix casing de tokens `displayXl` (30 min)

**Archivos:** `page.tsx`, `quote-divider.tsx`, `waitlist-form.tsx`

```diff
# page.tsx:123
- fontSize={{ base: 'displayxl', lg: 'display2xl' }}
+ fontSize={{ base: 'displayXl', lg: 'display2xl' }}

# quote-divider.tsx:38 y :65
- fontSize={{ base: 'displayLg', lg: 'displayxl' }}
+ fontSize={{ base: 'displayLg', lg: 'displayXl' }}

# waitlist-form.tsx (SuccessCard):
- fontSize={{ base: "displayLg", lg: "displayxl" }}
+ fontSize={{ base: "displayLg", lg: "displayXl" }}
```

---

### 0.2 — Fix token `titleXl` inexistente (10 min)

**Archivo:** `src/app/design-system/isla/page.tsx:272`

Elegir una de estas opciones:
```diff
- fontSize="titleXl"
+ fontSize="displayMd"   # o el tamaño más apropiado
```

O agregar el token en `tokens.ts`:
```ts
fontSizes: {
  // ... existentes ...
  titleXl: { value: "clamp(28px, 2.4vw, 44px)" },
}
```

---

### 0.3 — Fix `fontVariantNumeric` en CountdownBanner (5 min)

**Archivo:** `src/components/landing/countdown-banner.tsx:59`

```diff
- fontVariantNumeric="tabular-nums"
+ style={{ fontVariantNumeric: 'tabular-nums' }}
```

---

### 0.4 — Fix `borderBottomColor="fg"` en CountdownBanner (5 min)

**Archivo:** `src/components/landing/countdown-banner.tsx:40`

```diff
- borderBottomColor="fg"
+ borderBottomColor="border"
```

---

### 0.5 — Fix opciones duplicadas en WaitlistForm (15 min)

**Archivo:** `src/components/landing/waitlist-form.tsx`

Importar desde `lib/waitlist.ts` y eliminar las redefiniciones locales:

```diff
- const EXPERIENCE_CHIPS = [...]
- const AI_TOOL_OPTIONS = [...]
- const MONTHLY_SPEND_CHIPS = [...]

+ import { experienceOptions as EXPERIENCE_CHIPS, AI_TOOL_OPTIONS, monthlySpendOptions as MONTHLY_SPEND_CHIPS } from '@/lib/waitlist';
```

> Atención: el label "+$100" vs "Más de $100" — usar el de `lib/waitlist.ts` como fuente de verdad.

---

### 0.6 — Fix footer social links placeholder (5 min)

**Archivo:** `src/components/landing/site-footer.tsx:40`

Actualizar con URLs reales o esconder condicionalmente:

```ts
const SOCIAL_ITEMS = [
  { label: 'Instagram', href: 'https://instagram.com/savia_ai', Icon: SocialInstagramIcon },
  { label: 'TikTok', href: 'https://tiktok.com/@savia_ai', Icon: SocialTikTokIcon },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/savia-ai', Icon: SocialLinkedInIcon },
];
```

---

### 0.7 — Fix CSS variable cruda en Pricing (10 min)

**Archivo:** `src/components/landing/pricing.tsx:64`

```diff
- color="var(--chakra-colors-fg-muted)"
+ style={{ color: 'var(--chakra-colors-fg-muted)' }}
```

O mejor, usar un `Box` wrapper que propague el color:
```tsx
<Box color="fg.muted" asChild lineHeight={1} flexShrink={0} mt="3px">
  <Check size={14} strokeWidth={2} />
</Box>
```

---

## Fase 1: Limpieza y deuda técnica (2–4h)

---

### 1.1 — Eliminar dead code (30 min)

Eliminar los siguientes archivos:
- `src/components/landing/hero-cta.tsx`
- `src/components/landing/hero-cta.module.css`
- `src/components/landing/hero-callout.tsx`
- `src/components/landing/ecosystem-graph.tsx`
- `src/components/landing/ecosystem-graph.module.css`

> Decisión pendiente: `orbital-island.tsx`, `orbital-rings.tsx` — mantener si hay planes de uso en el DS o futuras secciones; eliminar si no.

---

### 1.2 — Centralizar constantes compartidas (30 min)

Crear `src/lib/constants.ts`:

```ts
// src/lib/constants.ts

export const NAV_ITEMS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Cómo funciona', href: '#flujo' },
  { label: 'Plug & play', href: '#integraciones' },
  { label: 'Control', href: '#control' },
  { label: 'Planes', href: '#planes' },
] as const;

export const COMMUNITY_AVATARS = [
  { label: 'AI', bg: '#0B2529', fg: '#F4F4F1' },
  { label: 'UX', bg: '#1A4A4E', fg: '#F4F4F1' },
  { label: 'PM', bg: '#E7FF18', fg: '#0B2529' },
  { label: 'DV', bg: '#53606C', fg: '#F4F4F1' },
] as const;

export const BRAND_COLORS = {
  lime: '#E7FF18',
  ink: '#0B2529',
  paper: '#F4F4F1',
} as const;

export const COMMUNITY_COUNT = '+1,000';
```

Actualizar `site-header.tsx`, `site-footer.tsx`, `page.tsx`, `waitlist-section.tsx` para importar desde aquí.

---

### 1.3 — Extraer `SectionHeader` como componente UI (1h)

Crear `src/components/ui/section-header.tsx` con el patrón eyebrow + headline + description.

Actualizar `HowItWorks`, `ControlSection`, `Pricing`, `WaitlistSection`.

---

### 1.4 — Extraer `AvatarStack` como componente (30 min)

Crear `src/components/landing/avatar-stack.tsx` y usarlo en `page.tsx` y `waitlist-section.tsx`.

---

### 1.5 — Fix JSX en datos en `HowItWorks` (30 min)

Cambiar el array `STEPS` para usar identificadores en lugar de JSX:

```ts
type StepVisual = 'mcp-config' | 'chat-capture' | 'memory-bridge';

const STEPS: Array<{ num: string; title: string; desc: string; visual: StepVisual; active: boolean }> = [
  { num: '01', visual: 'mcp-config', ... },
  ...
];

const VISUAL_MAP: Record<StepVisual, React.ComponentType> = {
  'mcp-config': McpConfigMini,
  'chat-capture': ChatCaptureMini,
  'memory-bridge': MemoryBridgeMini,
};
```

---

### 1.6 — Countdown configurable por env var (15 min)

**Archivo:** `src/components/landing/countdown-banner.tsx`

```ts
const LAUNCH_DATE_STR = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-07-01T00:00:00Z';
const TARGET = new Date(LAUNCH_DATE_STR);
```

Agregar al `.env.example`:
```
NEXT_PUBLIC_LAUNCH_DATE=2026-07-01T00:00:00Z
```

---

### 1.7 — `prefers-reduced-motion` en orbital-island.module.css (10 min)

```css
@media (prefers-reduced-motion: reduce) {
  .ringCw, .ringCcw, .chipCcw, .chipCw, .node {
    animation: none;
  }
}
```

---

### 1.8 — Fix handleSubmit type en WaitlistForm (5 min)

```diff
- function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
+ function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
```

---

## Fase 2: Accesibilidad (3–5h)

---

### 2.1 — Chips con ARIA correcto (2h)

Reescribir `Chip` en `waitlist-form.tsx` para soporte de radiogroup/checkbox:

```tsx
// Para seniority y monthlySpend (solo uno): role="radio" con roving tabindex
// Para AI tools (múltiples): role="checkbox" con aria-checked

function Chip({ label, selected, onClick, multiselect = false }: ChipProps) {
  return (
    <Box
      role={multiselect ? 'checkbox' : 'radio'}
      aria-checked={selected}
      tabIndex={selected || multiselect ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onClick(); }}
      // ... estilos
    >
      {label}
    </Box>
  );
}
```

---

### 2.2 — Skip link funcional (30 min)

Actualizar skip link en `page.tsx` para ser visible al foco y apuntar a `#main-content`.

---

### 2.3 — Mobile menu focus trap (1h)

Instalar `@chakra-ui/focus-lock` o implementar focus trap custom. Migrar overlay a `AnimatePresence`.

---

### 2.4 — ToggleVisual accesible (30 min)

Agregar `aria-label` a las celdas de la tabla en `ControlSection`:

```tsx
<Flex key={p.id} justify="center" align="center" aria-label={tema.permissions[pi] ? 'Activado' : 'Desactivado'}>
  <ToggleVisual on={tema.permissions[pi]} aria-hidden />
</Flex>
```

---

### 2.5 — QuoteDivider con nombre accesible (15 min)

```tsx
<Box as="section" aria-label={props.kind === 'pain' ? 'Testimonio' : 'Dato de impacto'}>
```

---

## Fase 3: SEO y producción (2–3h)

---

### 3.1 — OG Image (2h)

Crear `src/app/opengraph-image.tsx` con Next.js ImageResponse:

```tsx
import { ImageResponse } from 'next/og';
export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ background: '#0B2529', color: '#F4F4F1', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '80px', justifyContent: 'flex-end' }}>
      <div style={{ fontSize: 18, color: '#E7FF18', marginBottom: 24, letterSpacing: '0.12em', textTransform: 'uppercase' }}>SAVIA</div>
      <div style={{ fontSize: 64, fontWeight: 300, lineHeight: 1.05, marginBottom: 32, maxWidth: '80%' }}>
        La memoria que <span style={{ fontWeight: 700 }}>conecta</span> todas tus IAs
      </div>
      <div style={{ fontSize: 20, color: 'rgba(244,244,241,0.6)' }}>
        savia.dev
      </div>
    </div>
  );
}
```

---

### 3.2 — `robots.ts` y `sitemap.ts` (30 min)

```ts
// src/app/robots.ts
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/design-system/'] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}

// src/app/sitemap.ts
export default function sitemap() {
  return [{ url: siteConfig.url, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 }];
}
```

---

### 3.3 — `not-found.tsx` y `error.tsx` (1h)

Páginas brandadas para errores y 404.

---

## Fase 4: Animaciones y UX (4–8h)

---

### 4.1 — `FadeInUp` utility component (30 min)

Crear `src/components/ui/animated-section.tsx` con el helper reutilizable.

---

### 4.2 — Animar `HowItWorks` (45 min)

Cards de pasos con stagger usando `FadeInUp`.

---

### 4.3 — Animar `Pricing` (1h)

Feature list con stagger + tarjeta con scale entrance.

---

### 4.4 — Animar `WaitlistSection` (45 min)

Copy desde izquierda + form desde derecha con `FadeInUp`.

---

### 4.5 — Animar `QuoteDivider` (30 min)

Quote con fade desde abajo.

---

### 4.6 — Header mobile con `AnimatePresence` (1h)

Migrar overlay CSS a Framer Motion + focus trap.

---

### 4.7 — Fix font en `EcosystemScroll` labels (10 min)

```diff
- fontFamily: 'system-ui, sans-serif',
+ fontFamily: 'var(--font-inter), system-ui, sans-serif',
```

---

### 4.8 — Constante `EASE_SAVIA` (15 min)

```ts
// src/lib/constants.ts (o src/lib/motion.ts)
export const EASE_SAVIA = [0.22, 1, 0.36, 1] as const;
```

Usar en todas las transiciones de Framer Motion.

---

## Resumen de esfuerzo

| Fase | Descripción | Estimado |
|------|-------------|----------|
| **Fase 0** | Bugs bloqueantes | ~1.5h |
| **Fase 1** | Limpieza y deuda técnica | ~3.5h |
| **Fase 2** | Accesibilidad | ~4h |
| **Fase 3** | SEO y producción | ~3.5h |
| **Fase 4** | Animaciones y UX | ~5h |
| **Total** | | **~17.5h** |

---

## Orden recomendado de implementación

1. **Hoy mismo (Fase 0):** bugs visibles → push
2. **Sesión 2 (Fase 1 + 3.2 + 3.3):** limpieza + archivos de producción faltantes
3. **Sesión 3 (Fase 2):** accesibilidad
4. **Sesión 4 (Fase 3.1 + Fase 4):** OG image + animaciones

---

## Archivos a crear (nuevos)

```
src/
├── app/
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── opengraph-image.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── landing/
│   │   └── avatar-stack.tsx
│   └── ui/
│       ├── animated-section.tsx
│       └── section-header.tsx
└── lib/
    └── constants.ts
```

## Archivos a eliminar

```
src/components/landing/
├── hero-cta.tsx          ❌
├── hero-cta.module.css   ❌
├── hero-callout.tsx      ❌
├── ecosystem-graph.tsx   ❌
└── ecosystem-graph.module.css ❌
```
