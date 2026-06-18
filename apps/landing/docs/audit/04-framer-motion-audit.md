# Auditoría Framer Motion

---

## 1. Estado actual de animaciones

| Sección | Animación | Estado |
|---------|-----------|--------|
| `SaviaParticles` | Float CSS (4 variantes) | ✅ Correcto — CSS puro, eficiente |
| `EcosystemScroll` | Scroll-driven assembly | ✅ Bien ejecutado, con fallback |
| `SiteHeader` mobile | CSS transition inline | 🟡 Funcional pero inconsistente |
| `HowItWorks` | Ninguna | ❌ Sin animación |
| `ControlSection` | Ninguna | ❌ Sin animación |
| `Pricing` | Ninguna | ❌ Sin animación |
| `WaitlistSection` | Ninguna | ❌ Sin animación |
| `QuoteDivider` | Ninguna | ❌ Sin animación |
| `SiteFooter` | Ninguna | ❌ Sin animación |
| `CountdownBanner` | Ninguna | 🟡 No necesaria |
| `IslandImage` | Ninguna | 🟡 No critica |
| `OrbitalIsland` | CSS rotation | — (no usada en landing) |

**Conclusión:** Solo `EcosystemScroll` usa Framer Motion. El resto de la landing es completamente estático. Para una landing de producto premium esto es una oportunidad significativa de mejora visual.

---

## 2. EcosystemScroll — Análisis profundo

**Archivo:** `src/components/landing/ecosystem-scroll.tsx`

### ✅ Lo que está bien

- **`useReducedMotion` correctamente implementado** — fallback estático para usuarios que prefieren movimiento reducido.
- **`useMotionValueEvent`** usado correctamente para actualizar estado React solo cuando el phase cambia, no en cada frame.
- **`AnimatePresence mode="wait"`** correcto para las transiciones de texto de fase.
- **Responsive** — detecta `mobile/tablet/desktop` para ajustar posiciones.
- **`aria-label` en la section** — accesible.

### ⚠️ Observaciones

#### O1 — `useScroll` manual en lugar de uso declarativo

La implementación actual:
```ts
const { scrollY } = useScroll();
const scrollYProgress = useTransform(scrollY, (y) => {
  const { top, height, vp } = boundsRef.current;
  const range = height - vp;
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, (y - top) / range));
});
```

Framer Motion ofrece `useScroll` con `target` y `offset` que logra exactamente esto declarativamente:

```ts
const { scrollYProgress } = useScroll({
  target: sectionRef,
  offset: ['start start', 'end end'],
});
```

La diferencia: la implementación actual es equivalente en funcionalidad pero más frágil (depende de `boundsRef` actualizado por `ResizeObserver` manual). El API declarativo de Framer Motion maneja resize internamente.

> Mantener el approach actual es válido si se necesita comportamiento de scroll más preciso, pero documentar la decisión.

#### O2 — `AnimatePresence` sin `initial={false}` en el phase text

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={phase}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
```

Sin `initial={false}`, cuando el componente monta por primera vez (phase=0), se ejecuta la animación `initial → animate`. El usuario ve el texto de fase 0 hacer fade-in aunque ya debería estar visible. Esto puede ser intencional, pero en UX puede verse como un flash innecesario.

```tsx
<AnimatePresence initial={false} mode="wait">
```

#### O3 — `LABEL` style object con `system-ui` en lugar de Inter

**Archivo:** `ecosystem-scroll.tsx:237`

```ts
const LABEL: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',  // ← no usa Inter
```

Los labels "Chats", "Apps", "Archivos" bajo los logos no usan la fuente de la marca.

**Fix:**
```ts
fontFamily: 'var(--font-inter), system-ui, sans-serif',
```

#### O4 — `AssembledStatic` también usa `fontFamily: 'system-ui'`

**Archivo:** `ecosystem-scroll.tsx:88`

```tsx
style={{ fontFamily: 'system-ui', ... }}
```

Mismo problema en el fallback estático.

#### O5 — `AnimatePresence` en la lista de IAs sin `mode="wait"`

```tsx
<AnimatePresence>
  {showIas && IAS.map(...)}
</AnimatePresence>
```

Sin `mode="wait"`, los elementos entran simultáneamente. Esto es intencional (stagger por `delay: i * 0.09`), pero si en el futuro `showIas` vuelve a `false`, los exits también serán simultáneos. Considerar documentarlo.

---

## 3. Animaciones faltantes — Propuesta

Las 4 secciones estáticas principales deberían tener animaciones de entrada scroll-triggered. El patrón recomendado con Framer Motion es usar `whileInView` para simplicidad:

### 3.1 Patrón recomendado — `useInView` + `motion.div`

```tsx
// src/components/ui/animated-section.tsx
"use client";

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';

type AnimatedSectionProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export function FadeInUp({ children, delay = 0 }: AnimatedSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10% 0px' });
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? false : { opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
```

### 3.2 Propuesta por sección

#### `HowItWorks`
- Cards de pasos entran con stagger (0.1s entre cada uno).
- `FadeInUp` con `delay={i * 0.12}` para cada card.

#### `ControlSection`
- Tabla entra desde abajo como bloque.
- Toggles hacen un micro-pulse al entrar.

#### `Pricing`
- Feature list: cada item con stagger.
- Tarjeta de precio: entra desde la derecha o con scale up.
- El badge `SAVIA PRO` pulsa al aparecer.

#### `WaitlistSection`
- Copy lado izquierdo entra desde la izquierda.
- Formulario entra desde la derecha.
- Ambos con `FadeInUp` simple.

#### `QuoteDivider`
- Quote entra con fade desde abajo.
- Las comillas `"` hacen una entrada sutil en scale.

---

## 4. `SiteHeader` — Migrar overlay a Framer Motion

**Archivo:** `src/components/landing/site-header.tsx:134–139`

Actualmente usa CSS transition inline:
```tsx
style={{
  opacity: menuOpen ? 1 : 0,
  transform: menuOpen ? 'translateY(0)' : 'translateY(-12px)',
  transition: 'opacity 220ms ease, transform 220ms ease',
  pointerEvents: menuOpen ? 'auto' : 'none',
}}
```

**Problema:** No usa `AnimatePresence`, por lo que el overlay permanece en el DOM cuando está cerrado (solo invisible). Esto:
1. Aumenta el DOM size innecesariamente.
2. El overlay "cerrado" puede recibir clics del teclado (`Tab` puede llegar a elementos dentro).

**Fix con Framer Motion:**
```tsx
<AnimatePresence>
  {menuOpen && (
    <motion.div
      id="mobile-menu"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--chakra-z-indices-modal)', ... }}
    >
      {/* contenido */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5. Patrones de easing

El tema define:
```ts
easings: {
  savia: { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
},
```

Pero en `EcosystemScroll` y las transiciones de `SiteHeader` se usa `'easeInOut'` genérico. Para consistencia, las animaciones de Framer Motion deberían usar el easing de marca:

```ts
// Constante compartida
export const EASE_SAVIA = [0.22, 1, 0.36, 1] as const;

// Uso:
transition={{ duration: 0.6, ease: EASE_SAVIA }}
```

---

## 6. `OrbitalIsland` — CSS animations vs Framer Motion

**Archivo:** `src/components/landing/orbital-island.tsx`

Los anillos orbitales usan CSS animations puras (`orbital-island.module.css`). Esto es correcto para animaciones continuas (loops infinitos), ya que:
- CSS animations se ejecutan en el compositor thread (sin bloquear JS).
- Son más eficientes que `useAnimation` de Framer para loops.
- Se benefician de GPU acceleration automática.

> No migrar a Framer Motion. Los CSS keyframes son la herramienta correcta aquí.

Sin embargo, **falta `prefers-reduced-motion`** en `orbital-island.module.css`:

```css
/* Falta esto: */
@media (prefers-reduced-motion: reduce) {
  .ringCw, .ringCcw, .chipCw, .chipCcw, .node {
    animation: none;
  }
}
```

El archivo `how-it-works.module.css` sí lo tiene (referencia correcta). `orbital-island.module.css` no.

---

## 7. Resumen de prioridades Framer Motion

| Priority | Task | Esfuerzo |
|----------|------|----------|
| P1 | Fix `fontFamily` en `EcosystemScroll` labels | 5min |
| P2 | Fix `fontVariantNumeric` (cross-listed con Chakra) | 5min |
| P3 | Migrar header mobile overlay a `AnimatePresence` | 1h |
| P4 | Agregar `FadeInUp` a `HowItWorks` cards | 30min |
| P5 | Agregar animaciones a `Pricing` (stagger features) | 45min |
| P6 | Agregar animaciones a `WaitlistSection` | 30min |
| P7 | Agregar animaciones a `ControlSection` tabla | 45min |
| P8 | Agregar animaciones a `QuoteDivider` | 20min |
| P9 | `prefers-reduced-motion` en orbital-island.module.css | 10min |
| P10 | Constante `EASE_SAVIA` compartida | 15min |
