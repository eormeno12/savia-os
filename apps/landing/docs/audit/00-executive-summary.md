# Auditoría Savia Landing V3 — Resumen Ejecutivo

**Fecha:** 2026-06-18  
**Proyecto:** `apps/savia-landing-v3`  
**Stack:** Next.js 16 · React 19 · Chakra UI v3 · Framer Motion 12

---

## Estado general

El proyecto tiene una **base sólida**: arquitectura RSC correcta, theme system bien pensado, animación de scroll (EcosystemScroll) ambiciosa y bien ejecutada. Sin embargo, hay problemas que bloquean el camino a producción.

### Semáforo por área

| Área | Estado | Nivel de riesgo |
|------|--------|-----------------|
| Next.js | 🟡 Correcciones menores | Medio |
| React / Arquitectura | 🟡 Duplicaciones y muertos | Medio |
| Chakra UI | 🔴 Bugs de tokens activos | Alto |
| Framer Motion | 🟡 Incompleto + inconsistente | Medio |
| Performance | 🟡 Sin lazy loading | Medio |
| Accesibilidad | 🔴 Fallos de ARIA | Alto |
| SEO / Producción | 🔴 Archivos faltantes | Alto |

---

## Top 10 issues bloqueantes para producción

1. **Bug de casing en tokens** — `displayXl` (token) vs `displayxl` (uso) en múltiples componentes. Los tamaños de fuente display no resuelven correctamente en producción.
2. **Token inexistente** — `fontSize="titleXl"` en `isla/page.tsx` no existe en `tokens.ts`. Renderiza la string literal como valor CSS.
3. **`fontVariantNumeric="tabular-nums"`** — Prop inválida en Chakra v3; el countdown timer muestra números desalineados.
4. **Social links placeholder** — `href="#"` en el footer va a producción.
5. **Countdown hardcoded** — Fecha `2026-07-01` en código, imposible actualizar sin redeploy.
6. **`MONTHLY_SPEND_CHIPS` inconsistente** — Label "+$100" en form vs "Más de $100" en `lib/waitlist.ts`. Los datos guardados no coinciden con lo mostrado.
7. **Sin OG image** — No hay `og:image` en metadata. Los shares en redes sociales son incompletos.
8. **Sin `not-found.tsx`, `error.tsx`** — UX rota en errores y 404s.
9. **Chip de formulario sin ARIA** — `role="radiogroup"` sin `role="radio"` + `aria-checked` en los chips. Inaccessible para lectores de pantalla.
10. **`var(--chakra-colors-fg-muted)` inline** — CSS variable cruda en `pricing.tsx`. Se rompe si cambia el nombre del token.

---

## Top 5 mejoras de calidad (no bloqueantes)

1. Extraer `NAV_ITEMS` y `AVATARS` a `lib/constants.ts` (duplicados entre archivos).
2. Eliminar 5 componentes muertos (`hero-cta`, `hero-callout`, `orbital-island`, `orbital-rings`, `ecosystem-graph`).
3. Agregar animaciones de entrada (Framer Motion) a las 4 secciones estáticas.
4. Lazy loading con `next/dynamic` para `EcosystemScroll` y `HowItWorks`.
5. `prefer-reduced-motion` en `orbital-island.module.css` (falta vs otras CSS modules que sí lo tienen).

---

## Archivos del reporte

| Archivo | Contenido |
|---------|-----------|
| [01-nextjs-audit.md](./01-nextjs-audit.md) | Framework, metadata, producción |
| [02-react-architecture.md](./02-react-architecture.md) | Componentes, duplicados, anti-patterns |
| [03-chakra-ui-audit.md](./03-chakra-ui-audit.md) | Tokens, props, semantic system |
| [04-framer-motion-audit.md](./04-framer-motion-audit.md) | Animaciones, completitud, patrones |
| [05-code-quality.md](./05-code-quality.md) | TypeScript, organización, dead code |
| [06-accessibility-performance.md](./06-accessibility-performance.md) | a11y, bundle, lazy loading |
| [07-corrective-plan.md](./07-corrective-plan.md) | Plan priorizado con estimados |
