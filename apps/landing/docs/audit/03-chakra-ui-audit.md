# Auditoría Chakra UI v3

---

## 1. Bugs de tokens — Críticos

### BUG 1 — Casing inconsistente en `fontSize`

**Severidad: ALTA — Los tamaños de fuente no resuelven en producción.**

En Chakra v3 (basado en Panda CSS), los tokens se generan como CSS custom properties usando kebab-case derivado del camelCase:

```
displayXl → --chakra-font-sizes-display-xl
displayxl → --chakra-font-sizes-displayxl  (no existe!)
```

**Tokens definidos en `tokens.ts`:**
```ts
fontSizes: {
  displayXl: ...,    // genera --chakra-font-sizes-display-xl
  display2xl: ...,   // genera --chakra-font-sizes-display-2-xl
  displayLg: ...,    // genera --chakra-font-sizes-display-lg
  displayMd: ...,    // genera --chakra-font-sizes-display-md
  titleLg: ...,      // genera --chakra-font-sizes-title-lg
  bodyLg: ...,       // genera --chakra-font-sizes-body-lg
}
```

**Usos incorrectos encontrados:**

| Archivo | Línea | Token usado | Token correcto |
|---------|-------|-------------|----------------|
| `page.tsx` | 123 | `fontSize={{ base: 'displayxl', lg: 'display2xl' }}` | `'displayXl'` |
| `quote-divider.tsx` | 38 | `fontSize={{ base: 'displayLg', lg: 'displayxl' }}` | `'displayXl'` |
| `quote-divider.tsx` | 65 | `fontSize={{ base: 'displayLg', lg: 'displayxl' }}` | `'displayXl'` |
| `waitlist-form.tsx` | 407 | `fontSize={{ base: "displayLg", lg: "displayxl" }}` | `'displayXl'` |

**Usos correctos (referencia):**
- `isla/page.tsx:98` — `fontSize={{ base: "displayLg", md: "displayXl" }}` ✅
- `how-it-works.tsx` — `fontSize={{ base: 'display2xl', lg: 'display3xl' }}` ✅
- `pricing.tsx` — `fontSize={{ base: 'display2xl', lg: 'display3xl' }}` ✅

**Fix en todos los archivos afectados:**
```diff
- fontSize={{ base: 'displayxl', ... }}
+ fontSize={{ base: 'displayXl', ... }}
```

---

### BUG 2 — Token inexistente `titleXl`

**Archivo:** `src/app/design-system/isla/page.tsx:272`  
**Severidad: ALTA**

```tsx
<Text
  fontSize="titleXl"   // ← NO EXISTE en tokens.ts
```

El token `titleXl` no está definido en `src/theme/tokens.ts`. Chakra lo trata como string literal y pasa `font-size: titleXl` al CSS, que el browser ignora. La fuente queda sin tamaño definido (hereda del padre).

**Tokens de fuente definidos:** `displayXl`, `display2xl`, `display3xl`, `display4xl`, `displayLg`, `displayMd`, `titleLg`, `bodyLg`.

**Fix opciones:**
1. Cambiar a un token existente: `fontSize="displayMd"` o `fontSize="3xl"` (Chakra default).
2. Agregar `titleXl` a `tokens.ts` si hay necesidad de ese tamaño intermedio.

---

### BUG 3 — `fontVariantNumeric` no es prop válida de Chakra

**Archivo:** `src/components/landing/countdown-banner.tsx:59`  
**Severidad: MEDIA**

```tsx
<Text
  fontVariantNumeric="tabular-nums"  // ← prop no reconocida por Chakra v3
```

Chakra v3 no incluye `fontVariantNumeric` como prop del sistema de estilos. Esto puede:
1. Generar un warning de prop no reconocida.
2. No aplicar el CSS `font-variant-numeric: tabular-nums`.

El resultado: los números del countdown pueden moverse lateralmente al actualizarse cada segundo.

**Fix:**
```tsx
<Text
  style={{ fontVariantNumeric: 'tabular-nums' }}
```

---

## 2. Uso incorrecto de tokens semánticos

### 2.1 `borderBottomColor="fg"` en CountdownBanner

**Archivo:** `src/components/landing/countdown-banner.tsx:40`

```tsx
<Flex
  bg="signalLime"
  borderBottomWidth="1px"
  borderBottomColor="fg"    // ← fg es token de texto, no de borde
```

`fg` es el semantic token para **color de texto**, no de bordes. Si el tema cambia, `fg` puede ser un color que no funcione como borde.

**Fix:**
```tsx
borderBottomColor="border"  // o border.DEFAULT, o border.subtle
```

### 2.2 CSS variable cruda en `pricing.tsx`

**Archivo:** `src/components/landing/pricing.tsx:64`

```tsx
<Check
  color="var(--chakra-colors-fg-muted)"   // ← CSS variable cruda
```

Si el nombre del token cambia, esta referencia se rompe silenciosamente. Además no funciona en Server Components de forma consistente.

**Fix:** No hay una forma nativa de pasar tokens de Chakra a `color` de componentes Lucide. Opciones:
```tsx
// Opción 1: Color hardcoded con token semántico via style
<Check style={{ color: 'var(--chakra-colors-fg-muted)' }} />

// Opción 2: Wrapper con Box que define el color
<Box color="fg.muted" asChild>
  <Check size={14} />
</Box>

// Opción 3: Prop de color de Chakra (no disponible en componentes Lucide directamente)
// Usar los colores raw del tema en vez del CSS variable
```

La opción más correcta para producción es usar el color semántico como valor CSS de referencia solo desde tokens confirmados.

### 2.3 Colores hardcodeados que deberían ser tokens

Múltiples instancias de colores inline que rompen la consistencia del sistema de tokens:

| Archivo | Línea | Valor hardcoded | Token correcto |
|---------|-------|----------------|----------------|
| `pricing.tsx` | 129 | `color="rgba(244,244,241,0.28)"` | `color="fg.inverse"` con `opacity` |
| `pricing.tsx` | 152 | `color="rgba(244,244,241,0.5)"` | `color="fg.inverse"` con `opacity` |
| `ecosystem-scroll.tsx` | 302 | `color="rgba(244,244,241,.36)"` | `color="fg.inverse"` con `opacity` o `fg.subtle` |
| `waitlist-form.tsx` | 302 | `color="rgba(244,244,241,.36)"` | — |
| `control-section.tsx` | PLATFORM.bg | `"#FDEEE8"`, `"#E9F9F4"`, etc. | Tokens de terceros (ok si son brand externos) |

> Los colores de plataformas externas (Claude=naranja, ChatGPT=verde, etc.) pueden permanecer hardcodeados ya que son brand de terceros.

### 2.4 `signalLime` como color semántico directo

**Archivos:** múltiples

`signalLime` es un token raw (no semántico). Usarlo directamente como `color="signalLime"` o `bg="signalLime"` es correcto pero crea dependencia del nombre del raw token. En un sistema escalable, este color debería tener un alias semántico.

Actualmente no hay problema real ya que el token es estable, pero documentarlo para cuando se agregue modo oscuro.

---

## 3. textStyles — Subutilizados

### 3.1 Definición vs uso

Los `textStyles` están bien definidos en `text-styles.ts`:
- `displayXl`, `display2xl`, `display3xl`, `displayMd`
- `titleLg`
- `bodyLg`
- `label`

Pero la mayoría de componentes **no los usa**. En cambio, repiten los valores manualmente:

```tsx
// Patrón repetido en how-it-works.tsx, pricing.tsx, control-section.tsx, etc.:
fontSize="xs"
fontWeight="700"
letterSpacing="0.12em"
textTransform="uppercase"
color="fg.muted"
```

Esto es exactamente el textStyle `label`. Debería usarse como:
```tsx
<Text textStyle="label" color="fg.muted">
```

**Inventario de oportunidades:**

| Componente | Uso actual | textStyle equivalente |
|------------|------------|----------------------|
| Eyebrow de secciones | `fontSize="xs" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase"` | `textStyle="label"` |
| Body texto grande | `fontSize="bodyLg" lineHeight="1.65"` | `textStyle="bodyLg"` |
| Títulos de sección | `fontSize={{ base: 'display2xl', lg: 'display3xl' }} fontWeight="300" lineHeight="0.95"` | Combinar `textStyle="display2xl"` con responsive |

---

## 4. Sistema de colorPalettes

### ✅ Bien implementado

Los tres colorPalettes (`lime`, `ink`, `mist`) tienen los 8 keys que Button de Chakra requiere. El patrón `colorPalette="lime"` funciona correctamente para variantes `solid`, `outline`, `ghost`, `subtle`, `surface`, `plain`.

### ⚠️ Observación

El botón de `Chip` en `waitlist-form.tsx` usa colores hardcodeados en vez de `colorPalette`:

```tsx
<ChakraButton
  bg={selected ? "bg.inverse" : "bg.subtle"}
  color={selected ? "fg.inverse" : "fg.muted"}
  borderColor={selected ? "transparent" : "border"}
```

Podría simplificarse usando `colorPalette="ink"` con la variante correcta, aunque el diseño actual requiere un estado binario que el sistema de variantes no captura de forma nativa.

---

## 5. globalCss

**Archivo:** `src/theme/index.ts`

### ✅ Correcto

- `scrollBehavior: "smooth"` en html — correcto para scroll de anclas.
- `textRendering: "geometricPrecision"` — válido para Inter.
- `overflowX: "hidden"` en body — previene scroll horizontal.

### ⚠️ Observación

`overflowX: "hidden"` en `body` puede interferir con `position: sticky` en algunos navegadores (especialmente cuando el elemento sticky tiene un ancestro con overflow oculto). Verificar en Safari iOS.

La alternativa más segura:
```ts
"html": {
  overflowX: "hidden",  // overflow en html en vez de body
}
```

---

## 6. `orbital-island.tsx` — `"use client"` innecesario

Ya documentado en el reporte de Next.js, pero desde el lado Chakra: el componente usa `Image` de next/image y CSS modules. No usa ningún hook de Chakra que requiera cliente. El `"use client"` debe eliminarse.

---

## 7. Design System — Rotas internas

### `/design-system/isla/page.tsx`

Referencia tokens y textStyles que no existen:
- `fontSize="titleXl"` (línea 272) — no existe
- `textStyle="titleLg"` — existe ✅

### Recomendación

Agregar un test automatizado que verifique que todos los tokens usados en el DS existen en el tema activo.
