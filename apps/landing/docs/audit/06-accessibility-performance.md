# Auditoría Accesibilidad & Performance

---

## PARTE 1: Accesibilidad (a11y)

### A1 — Chips de formulario sin ARIA de selección

**Archivo:** `src/components/landing/waitlist-form.tsx:135–145`  
**Severidad: ALTA — WCAG 4.1.2 (Name, Role, Value)**

Los contenedores de chips tienen `role="radiogroup"` pero los chips internos son `<button>` sin `role="radio"` ni `aria-checked`. Para un lector de pantalla (NVDA, VoiceOver), estos botones son indistinguibles — no transmiten si están seleccionados.

```tsx
// Actual (incorrecto para radiogroup):
<Grid role="radiogroup">
  <ChakraButton
    onClick={() => setExperience(value)}
    bg={selected ? "bg.inverse" : "bg.subtle"}
  >
    {label}
  </ChakraButton>
</Grid>

// Fix correcto:
<Box role="radiogroup" aria-labelledby="seniority-label">
  {EXPERIENCE_CHIPS.map(({ value, label }) => (
    <Box
      key={value}
      role="radio"
      aria-checked={experience === value}
      tabIndex={experience === value ? 0 : -1}  // roving tabindex
      onClick={() => setExperience(value)}
      onKeyDown={(e) => {
        // Soporte para flechas de teclado en radiogroup
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { /* next */ }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { /* prev */ }
      }}
    >
      {label}
    </Box>
  ))}
</Box>
```

> Para chips de **multi-select** (IAs), usar `role="checkbox"` con `aria-checked` en lugar de `role="radio"`.

---

### A2 — `ToggleVisual` sin estado accesible

**Archivo:** `src/components/landing/control-section.tsx:33–48`

El toggle visual es puramente decorativo — no transmite estado `on/off` a lectores de pantalla.

```tsx
function ToggleVisual({ on }: { on: boolean }) {
  return (
    <Box borderRadius="full" ...>
      <Box ... />  {/* sin aria */}
    </Box>
  );
}
```

El contexto de uso es en una tabla de permisos de solo lectura (no interactivo), por lo que el toggle es visual puro. Sin embargo, la tabla debería comunicar el estado al lector de pantalla.

**Fix:** La celda que contiene el toggle debería tener `aria-label` o el texto del estado:

```tsx
<Flex key={p.id} justify="center" align="center" aria-label={tema.permissions[pi] ? 'Activado' : 'Desactivado'}>
  <ToggleVisual on={tema.permissions[pi]} aria-hidden="true" />
</Flex>
```

---

### A3 — Mobile menu sin focus trap

**Archivo:** `src/components/landing/site-header.tsx`

El overlay del menú móvil se abre sobre todo el contenido pero no atrapa el foco. Un usuario de teclado puede tabular fuera del overlay hacia el contenido detrás.

**Fix:** Usar `@chakra-ui/react`'s `FocusLock` o implementar focus trap manual:

```tsx
import { FocusLock } from '@chakra-ui/focus-lock'; // o @radix-ui/react-focus-trap

{menuOpen && (
  <FocusLock>
    <motion.div role="dialog" aria-modal="true" aria-label="Menú principal">
      {/* contenido */}
    </motion.div>
  </FocusLock>
)}
```

Con la migración a `AnimatePresence` propuesta en el reporte de Framer Motion, el focus trap se gestiona más fácilmente al desmontar el overlay.

---

### A4 — Skip link no funciona correctamente

**Archivo:** `src/app/page.tsx:28–36`

```tsx
<a href="#inicio" style={{ position: 'absolute', left: '-9999px', ... }}>
  Ir al contenido
</a>
```

**Problema 1:** El enlace salta a `#inicio` pero `#inicio` es el Hero section, que ya es el primer elemento visible. Un skip link debería saltar el header de navegación para ir al contenido principal.

**Problema 2:** El skip link debería volverse visible al recibir foco (not just `left: -9999px`). Con la posición absoluta, un usuario que presiona Tab verá el foco perdido en el vacío sin ningún indicador visual.

**Fix:**
```tsx
// Skip link visible al foco
<a
  href="#main-content"
  style={{
    position: 'absolute',
    top: '-100px',
    left: '16px',
    zIndex: 9999,
    background: '#E7FF18',
    color: '#0B2529',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 700,
    transition: 'top 0.2s',
  }}
  onFocus={(e) => { e.currentTarget.style.top = '16px'; }}
  onBlur={(e) => { e.currentTarget.style.top = '-100px'; }}
>
  Saltar al contenido principal
</a>

// Y en el Hero section:
<Box as="main" id="main-content" ...>
```

---

### A5 — CountdownBanner sin accesibilidad de timer

**Archivo:** `src/components/landing/countdown-banner.tsx`

Un timer que se actualiza cada segundo con `setInterval` sin `aria-live` es invisible para lectores de pantalla. Sin embargo, un `aria-live` en un contador de segundos sería extremadamente ruidoso (anunciaría cada segundo).

**Recomendación:** No usar `aria-live` en el timer. En cambio, proporcionar el contenido de forma estática con texto descriptivo para no-videntes:

```tsx
<Flex ... role="timer" aria-label={`Disponible en ${time.d} días, ${time.h} horas, ${time.m} minutos`}>
  {/* contenido visual */}
</Flex>
```

El `role="timer"` comunica que es un contador de tiempo pero no hace anuncios automáticos.

---

### A6 — `QuoteDivider` como `<section>` sin nombre accesible

**Archivo:** `src/components/landing/quote-divider.tsx`

```tsx
<Box as="section" py={...}>
```

Las secciones HTML5 (`<section>`) requieren un nombre accesible (aria-label o aria-labelledby con un heading). Sin nombre, los lectores de pantalla las anuncian simplemente como "section" sin contexto.

**Fix opciones:**
```tsx
// Opción 1: aria-label
<Box as="section" aria-label="Testimonial">

// Opción 2: Cambiar a div (si no es realmente una sección de navegación)
<Box as="div">

// Opción 3: Agregar un heading visualmente oculto
<Box as="section">
  <Text as="h2" srOnly>Testimonio de usuario</Text>
  {/* contenido */}
</Box>
```

---

### A7 — Logo sin texto alternativo para lectores de pantalla

**Archivos:** `site-header.tsx`, `site-footer.tsx`

```tsx
<Link href="#inicio">
  <SaviaMark size={18} color={LIME} />  {/* SVG sin aria */}
  <Box as="span" ...>SAVIA</Box>
</Link>
```

El `SaviaMark` SVG tiene `aria-hidden`? Verificar. Si el SVG es solo decorativo y el texto "SAVIA" identifica el link, el patrón actual puede ser correcto (el texto es el label del link). Sin embargo, verificar que `SaviaMark` tenga `aria-hidden="true"`.

---

### A8 — `form` en `waitlist-form.tsx` sin `aria-label`

**Archivo:** `src/components/landing/waitlist-form.tsx:111`

```tsx
<form action={formAction} onSubmit={handleSubmit} noValidate>
```

Para múltiples formularios en la misma página, el formulario debería tener `aria-label` o `aria-labelledby`:

```tsx
<form
  aria-label="Formulario de early access a Savia"
  action={formAction}
  onSubmit={handleSubmit}
  noValidate
>
```

---

## PARTE 2: Performance

### P1 — Sin lazy loading para componentes pesados

**Archivo:** `src/app/page.tsx`

Todos los componentes se importan estáticamente. Para una landing de muchas secciones, los componentes below-the-fold deberían cargarse con `next/dynamic`:

```tsx
import dynamic from 'next/dynamic';

const EcosystemScroll = dynamic(
  () => import('@/components/landing/ecosystem-scroll').then(m => m.EcosystemScroll),
  { loading: () => <Box h="300vh" bg="#0B2529" />, ssr: false }
);

const HowItWorks = dynamic(
  () => import('@/components/landing/how-it-works').then(m => m.HowItWorks),
);
```

> `EcosystemScroll` tiene el mayor impacto: `framer-motion` + lógica de scroll compleja. `ssr: false` porque usa `useScroll`.

### P2 — `SaviaParticles` — 13 SVG fijos

**Archivo:** `src/components/landing/savia-particles.tsx`

13 SVG con posición `fixed` crean 13 layers de compositing permanentes que ocupan GPU durante toda la sesión. Cada partícula tiene animación CSS con 4 keyframes.

**Evaluación:** El impacto es bajo para partículas simples con CSS animations (el browser las optimiza a GPU por `transform`/`opacity`). Sin embargo, en dispositivos móviles de gama baja puede afectar scroll performance.

**Optimización:** Agregar `will-change: transform` en el CSS module para forzar layer promotion desde el inicio y evitar re-compositing:

```css
.particle {
  will-change: transform;
}
```

### P3 — `MiniUI` components en `HowItWorks` no memoizados

**Archivo:** `src/components/landing/how-it-works.tsx`

`McpConfigMini`, `ChatCaptureMini`, `MemoryBridgeMini` son componentes complejos con muchos elementos. Como `HowItWorks` es un Server Component y las minis no usan props reactivos, no hay re-render problem. Pero si se convierte a Client (para animaciones), considerar `React.memo`.

### P4 — `OrbitalIsland` no usado pero importado en DS pages

`OrbitalIsland` no está en `page.tsx` pero el componente existe y puede ser incluido en el bundle si se importa desde el DS. Verificar que no esté incluido inadvertidamente.

### P5 — Fuentes optimizadas correctamente

✅ `Inter` con `next/font/google` — genera `@font-face` local, sin network request.
✅ `subsets: ["latin", "latin-ext"]` — solo los caracteres necesarios para español.
✅ `display: "swap"` — texto visible mientras carga.

### P6 — No hay `bundle-analyzer` configurado

Para producción, considerar:

```bash
npm install @next/bundle-analyzer
```

```ts
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer';
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default withBundleAnalyzer(nextConfig);
```

Esto permite identificar si Framer Motion o lucide-react están inflando el bundle.

### P7 — `googleapis` en serverExternalPackages

✅ Ya configurado en `next.config.ts`. `googleapis` no se incluye en el client bundle.

### P8 — `lucide-react` tree-shaking

Lucide React soporta tree-shaking con named imports:

```tsx
// ✅ Correcto (ya usado):
import { ArrowUpRight } from 'lucide-react';
import { Check, Sparkles } from 'lucide-react';

// ❌ No usar:
import * as Icons from 'lucide-react';
```

El proyecto ya usa named imports. ✅

### P9 — Imagen de la isla — optimización

La imagen `/hero/savia-island.png` se carga con `priority` en el Hero (correcto). El `sizes` prop está configurado. Verificar que el archivo PNG esté optimizado (WebP cuando sea posible).

**Recomendación:** Considerar agregar `placeholder="blur"` con un blurDataURL generado, para un efecto de carga más suave:

```tsx
<Image
  src="/hero/savia-island.png"
  alt=""
  fill
  sizes="..."
  priority
  placeholder="blur"
  blurDataURL="data:image/png;base64,..."  // tiny placeholder
/>
```

---

## Resumen de issues a11y por severidad

| ID | Issue | Severidad | WCAG |
|----|-------|-----------|------|
| A1 | Chips sin role/aria-checked | 🔴 Alta | 4.1.2 |
| A3 | Mobile menu sin focus trap | 🔴 Alta | 2.1.2 |
| A2 | Toggle sin estado accesible | 🟡 Media | 4.1.2 |
| A4 | Skip link no funciona bien | 🟡 Media | 2.4.1 |
| A5 | Timer sin role="timer" | 🟡 Media | — |
| A6 | Section sin nombre accesible | 🟡 Media | 1.3.6 |
| A7 | Logo SVG sin aria-hidden | 🟢 Baja | 4.1.2 |
| A8 | Form sin aria-label | 🟢 Baja | — |
