# Auditoría Next.js

---

## 1. Configuración general

### ✅ Correcto

- `serverExternalPackages: ["googleapis"]` — correcto para evitar que googleapis se bundlee en el cliente.
- `next/font/google` con `variable` y `display: "swap"` — patrón óptimo.
- `metadata` y `viewport` exportados correctamente desde `layout.tsx`.
- `metadataBase` configurado con `siteConfig.url`.
- `"use server"` en `actions.ts` con Server Actions de React 19.
- `useActionState` (React 19) para el formulario — patrón moderno correcto.

### ❌ Problemas

#### P1 — Sin OG Image
**Archivo:** `src/app/layout.tsx:27`

No hay `og:image` ni `twitter:image` en metadata. Al compartir la URL en redes, no aparece preview visual.

**Fix:**
```ts
// src/app/opengraph-image.tsx  (Next.js route automática)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };

export default async function Image() {
  return new ImageResponse(
    <div style={{ background: '#0B2529', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Marca + tagline */}
    </div>,
    { ...size }
  );
}
```

O como alternativa, agregar una imagen estática en `/public/og-image.png` y referenciarla:
```ts
openGraph: {
  images: [{ url: '/og-image.png', width: 1200, height: 630 }],
},
```

#### P2 — Sin `not-found.tsx` ni `error.tsx`
**Directorio:** `src/app/`

Next.js usa `not-found.tsx` para 404 y `error.tsx` para errores de runtime. Sin ellos, Next muestra páginas de error genéricas sin marca.

**Fix:** Crear `src/app/not-found.tsx` y `src/app/error.tsx`.

```tsx
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <Box as="main" minH="100svh" display="flex" alignItems="center" justifyContent="center" bg="bg">
      {/* Mensaje branded 404 */}
    </Box>
  );
}
```

#### P3 — Sin `robots.txt` ni sitemap
**Directorio:** `src/app/`

Next.js genera estos automáticamente desde archivos de ruta. Sin ellos, los crawlers indexan todo sin restricciones.

**Fix:**
```ts
// src/app/robots.ts
import { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/design-system/'] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}

// src/app/sitemap.ts
import { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  ];
}
```

#### P4 — Countdown con fecha hardcodeada
**Archivo:** `src/components/landing/countdown-banner.tsx:6`

```ts
const TARGET = new Date("2026-07-01T00:00:00"); // ← hardcoded
```

Cuando la fecha pase, el banner simplemente desaparece (retorna `null`). No hay forma de actualizar la fecha sin redeploy. Tampoco hay manejo de timezone — la fecha se interpreta en el timezone del navegador del usuario, lo que hace que el countdown sea inconsistente globalmente.

**Fix opciones:**
- Leer desde `NEXT_PUBLIC_LAUNCH_DATE` env var.
- Usar una fecha en UTC explícita: `"2026-07-01T00:00:00Z"`.

```ts
const LAUNCH_DATE = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-07-01T00:00:00Z';
const TARGET = new Date(LAUNCH_DATE);
```

#### P5 — Footer social links placeholder
**Archivo:** `src/components/landing/site-footer.tsx:40`

```ts
{ label: 'Instagram', href: '#', ... },
{ label: 'TikTok', href: '#', ... },
{ label: 'LinkedIn', href: '#', ... },
```

`href="#"` en producción scrollea al top de la página. Debe ser la URL real o el link debe ocultarse hasta tener URL.

#### P6 — `"use client"` innecesario en `orbital-island.tsx`
**Archivo:** `src/components/landing/orbital-island.tsx:1`

El componente solo usa `Image` de next/image y estilos CSS. No usa hooks ni APIs de browser. La directiva `"use client"` aumenta el JS bundle innecesariamente.

**Fix:** Eliminar `"use client"`. El componente puede ser Server Component.

> Nota: `OrbitalIsland` tampoco se usa en la landing principal (`page.tsx` usa `IslandImage`). Ver sección de dead code.

#### P7 — No hay `loading.tsx`
Sin `loading.tsx`, no hay estado de carga skeleton mientras se carga la página. Para el formulario especialmente, la ausencia de Suspense puede causar layout shift en rutas lentas.

---

## 2. Server Actions

### ✅ Correcto

- Honeypot implementado correctamente (silent success).
- Validación con Zod en el servidor.
- Extracción de UTM desde referer.
- Fallback local para desarrollo.
- `headers()` llamado correctamente con `await` (React 19 / Next 16).

### ⚠️ Observaciones

#### O1 — Singleton de Sheets en módulo-level
**Archivo:** `src/lib/google-sheets.ts:30-32`

```ts
let sheetsClient: ... | null = null;
let spreadsheetId: string | null = null;
let sheetRange: string | null = null;
```

Este patrón es intencional para reutilizar la conexión de Sheets entre requests en el mismo proceso Node. Es válido en Next.js App Router (Node runtime). Solo documentarlo.

#### O2 — No hay rate limiting en la Server Action
**Archivo:** `src/app/actions.ts`

La acción no tiene rate limiting por IP. Un bot puede llamar la acción directamente (bypasseando el honeypot HTML) en bulk. Considerar:
- Verificación de `referer` header
- Rate limiting con Upstash o similar
- CAPTCHA invisible (Cloudflare Turnstile)

#### O3 — `localEmails` es un Set en memoria
**Archivo:** `src/app/actions.ts:17`

```ts
const localEmails = new Set<string>();
```

En desarrollo, este set se resetea en cada hot-reload. Es solo para dev, está correcto. Pero hay que documentar que no persiste entre requests en producción serverless (cada invocación es stateless).

---

## 3. Next.js Image

### ✅ Correcto

- `priority` en `IslandImage` (above-the-fold, correcto).
- `sizes` prop configurado en ambos modos de `IslandImage`.
- `draggable={false}` para UX.
- `fill` con `objectFit: "contain"` correcto.

### ⚠️ Observaciones

#### O1 — `aria-label` en contenedor, `alt=""` en imagen
**Archivo:** `src/components/landing/island-image.tsx`

El patrón actual pone el texto alternativo en el `div` contenedor (`aria-label`) y deja `alt=""` en la imagen. El correcto para imágenes decorativas es:
- `alt=""` en la imagen (correcto — la ignora NVDA/VoiceOver)
- El `aria-label` en el div es redundante ya que no es un elemento interactivo

Si la imagen es decorativa: dejar solo `alt=""`. Si es significativa: poner `alt` descriptivo en la imagen.

---

## 4. Arquitectura RSC

### ✅ Correcto

| Componente | Tipo | Justificación |
|------------|------|---------------|
| `layout.tsx` | Server | Correcto |
| `page.tsx` | Server | Correcto — importa Client Components válido |
| `actions.ts` | Server Action | Correcto |
| `provider.tsx` | Client | Necesario para ChakraProvider |
| `site-header.tsx` | Client | Necesario (useState, useEffect) |
| `countdown-banner.tsx` | Client | Necesario (useState, useEffect) |
| `waitlist-form.tsx` | Client | Necesario (useActionState, state) |
| `ecosystem-scroll.tsx` | Client | Necesario (useScroll, useTransform) |
| `savia-particles.tsx` | Server | Correcto — solo CSS |
| `island-image.tsx` | Server | Correcto — solo next/image |
| `how-it-works.tsx` | Server | Correcto — solo Chakra + CSS |
| `pricing.tsx` | Server | Correcto |
| `control-section.tsx` | Server | Correcto |
| `quote-divider.tsx` | Server | Correcto |
| `waitlist-section.tsx` | Server | Correcto |
| `site-footer.tsx` | Server | Correcto |

### ❌ Problema

| Componente | Tipo actual | Debería ser |
|------------|------------|-------------|
| `orbital-island.tsx` | Client | Server (no usa hooks) |
| `hero-cta.tsx` | Client | — (eliminar, no se usa) |
