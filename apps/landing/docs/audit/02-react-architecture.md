# Auditoría React — Arquitectura y Componentes

---

## 1. Componentes muertos (Dead Code)

Los siguientes archivos existen en el repositorio pero **no se importan en ningún componente activo**:

| Archivo | Estado | Acción |
|---------|--------|--------|
| `components/landing/hero-cta.tsx` | No importado | Eliminar |
| `components/landing/hero-callout.tsx` | No importado | Eliminar |
| `components/landing/orbital-island.tsx` | No importado | Eliminar |
| `components/landing/orbital-rings.tsx` | No importado | Evaluar |
| `components/landing/ecosystem-graph.tsx` | No importado | Eliminar |
| `components/landing/ecosystem-graph.module.css` | No importado | Eliminar |
| `components/landing/hero-cta.module.css` | Solo usado por `hero-cta.tsx` | Eliminar con el tsx |

> **Nota sobre `orbital-rings.tsx`:** Tiene tres variantes bien documentadas (`OrbitalRingsHero`, `OrbitalRingsDark`, `OrbitalRingsLime`). La DS page de `isla/page.tsx` menciona que no deben combinarse con la isla. Si hay planes para usarlo en otras secciones, mantenerlo; de lo contrario, eliminar.

**Impacto de eliminar:** Reduce el surface de mantenimiento, evita confusión de qué usar, y reduce el bundle potencial si algún bundler los incluye por error.

---

## 2. Datos duplicados

### 2.1 `AVATARS` — duplicado exacto

**Archivo A:** `src/app/page.tsx:18–23`  
**Archivo B:** `src/components/landing/waitlist-section.tsx:5–10`

```ts
// Idéntico en ambos archivos:
const AVATARS = [
  { label: 'AI', bg: '#0B2529', fg: '#F4F4F1' },
  { label: 'UX', bg: '#1A4A4E', fg: '#F4F4F1' },
  { label: 'PM', bg: '#E7FF18', fg: '#0B2529' },
  { label: 'DV', bg: '#53606C', fg: '#F4F4F1' },
] as const;
```

**Fix:** Extraer a `src/lib/constants.ts`.

### 2.2 `NAV_ITEMS` — duplicado exacto

**Archivo A:** `src/components/landing/site-header.tsx:8–14`  
**Archivo B:** `src/components/landing/site-footer.tsx:6–12`

```ts
// Idéntico en ambos archivos:
const NAV_ITEMS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Cómo funciona', href: '#flujo' },
  { label: 'Plug & play', href: '#integraciones' },
  { label: 'Control', href: '#control' },
  { label: 'Planes', href: '#planes' },
] as const;
```

**Fix:** Extraer a `src/lib/constants.ts`.

### 2.3 Opciones de formulario — duplicadas con discrepancia

**Archivo de referencia:** `src/lib/waitlist.ts` (source of truth)  
**Archivo con duplicado:** `src/components/landing/waitlist-form.tsx`

| Dato | En `lib/waitlist.ts` | En `waitlist-form.tsx` | Discrepancia |
|------|---------------------|----------------------|--------------|
| `EXPERIENCE_CHIPS` | Exportado como `experienceOptions` | Redefinido como `EXPERIENCE_CHIPS` | Sin discrepancia de labels, solo duplicación |
| `AI_TOOL_OPTIONS` | Exportado | Redefinido | Idéntico |
| `MONTHLY_SPEND_CHIPS` | `"100+": "Más de $100"` | `"100+": "+$100"` | **BUG: labels distintos** |

El campo `monthlySpend` en la hoja de cálculo recibe el valor `"100+"` (correcto), pero el label que ve el usuario es `"+$100"` en el form y `"Más de $100"` en la librería. Inconsistencia en UX.

**Fix:** Importar directamente desde `lib/waitlist.ts` en `waitlist-form.tsx`:

```ts
import { experienceOptions, AI_TOOL_OPTIONS, monthlySpendOptions } from '@/lib/waitlist';
```

---

## 3. Anti-patterns en datos de componentes

### 3.1 JSX como propiedad de datos en `how-it-works.tsx`

**Archivo:** `src/components/landing/how-it-works.tsx:386–408`

```ts
const STEPS = [
  {
    num: '01',
    title: 'Añade Savia como MCP',
    desc: '...',
    visual: <McpConfigMini />,  // ← JSX en datos: anti-pattern
    active: true,
  },
  ...
] as const;
```

**Problema:** Los datos (`STEPS`) deberían ser serializables. Incluir JSX en datos:
1. Los datos no se pueden exportar/importar como JSON.
2. Complica el testing unitario.
3. Oculta la relación entre datos y rendering.
4. Hace que `as const` no funcione realmente (el tipo de `visual` es `JSX.Element`, no inferencia de valor).

**Fix:** Usar un identificador y un mapa de renderizado:

```ts
const STEPS = [
  { num: '01', visual: 'mcp-config', ... },
  { num: '02', visual: 'chat-capture', ... },
  { num: '03', visual: 'memory-bridge', ... },
] as const;

const VISUAL_MAP = {
  'mcp-config': McpConfigMini,
  'chat-capture': ChatCaptureMini,
  'memory-bridge': MemoryBridgeMini,
} as const;

// En render:
const Visual = VISUAL_MAP[step.visual];
<Visual />
```

### 3.2 Índice como `key` en listas sin identificador estable

**Archivo:** `src/components/landing/control-section.tsx:144`

```tsx
{PLATFORMS.map((_, pi) => (
  <Flex key={pi} ...>  // ← índice como key
```

Cuando `PLATFORMS` es estático y nunca se reordena, usar índice es aceptable. Pero el patrón consistente es usar identificadores estables.

**Fix:** Usar `p.id` que ya existe en los datos:

```tsx
{PLATFORMS.map((p, pi) => (
  <Flex key={p.id} ...>
```

### 3.3 `page.tsx` hace demasiado

**Archivo:** `src/app/page.tsx`

La página principal tiene el widget de avatares con todo su markup y datos inline. Debería extraerse como componente:

```tsx
// Extraer a src/components/landing/hero-badge.tsx
export function HeroBadge({ count }: { count: string }) { ... }
```

---

## 4. Componentes compartidos que faltan

### 4.1 `SectionHeader` repetido 5 veces

El patrón eyebrow + headline + subtext se repite idéntico en:
- `how-it-works.tsx`
- `control-section.tsx`
- `pricing.tsx`
- `waitlist-section.tsx`
- `quote-divider.tsx` (variante)

```tsx
// Patrón repetido:
<Stack gap="5" mb={...} maxW="containerNarrow">
  <Text fontSize="xs" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="fg.muted">
    {eyebrow}
  </Text>
  <Text as="h2" fontSize={...} fontWeight="300" lineHeight="0.95" color="fg.muted">
    {headline}
  </Text>
  <Text fontSize="bodyLg" color="fg.muted" lineHeight="1.65" maxW={...}>
    {description}
  </Text>
</Stack>
```

**Fix:** Crear `src/components/ui/section-header.tsx`:

```tsx
type SectionHeaderProps = {
  eyebrow: string;
  headline: React.ReactNode;
  description?: React.ReactNode;
  maxW?: string;
};

export function SectionHeader({ eyebrow, headline, description, maxW = 'containerNarrow' }: SectionHeaderProps) {
  return (
    <Stack gap="5" maxW={maxW}>
      <Text textStyle="label" color="fg.muted">{eyebrow}</Text>
      <Text as="h2" textStyle="display2xl" color="fg.muted" textWrap="balance">{headline}</Text>
      {description && (
        <Text textStyle="bodyLg" color="fg.muted" lineHeight="1.65" textWrap="pretty">{description}</Text>
      )}
    </Stack>
  );
}
```

### 4.2 `AvatarStack` repetido

El avatar stack (4 avatares superpuestos con badge de comunidad) se duplica en `page.tsx` y `waitlist-section.tsx`. Extraer a `src/components/landing/avatar-stack.tsx`.

---

## 5. Estado en `WaitlistForm`

### 5.1 Validación duplicada entre cliente y servidor

**Archivo:** `src/components/landing/waitlist-form.tsx:54–68`

La función `fieldError` implementa validación manual en el cliente que duplica las reglas de `waitlistSchema` en `lib/waitlist.ts`. Si las reglas cambian en el schema, el cliente no se actualiza automáticamente.

**Fix:** Compartir la lógica de validación:

```ts
// Usar schema.shape para derivar reglas del cliente
import { waitlistSchema } from '@/lib/waitlist';

// Para validación en tiempo real, usar safeParse parcial
function validateField(field: keyof WaitlistInput, value: unknown) {
  const schema = waitlistSchema.shape[field];
  return schema.safeParse(value);
}
```

### 5.2 `handleSubmit` previene submit pero no limpia errores

**Archivo:** `src/components/landing/waitlist-form.tsx:85–98`

Cuando el usuario corrige un error y resubmite, el estado `submitAttempted` persiste, lo cual es correcto. Pero el estado `state.status === 'error'` del server action persiste de un submit anterior hasta que se hace un nuevo submit. Si el usuario corrige el email y hay un error de red anterior, el mensaje de error antiguo permanece visible.

### 5.3 `e: React.SyntheticEvent<HTMLFormElement>` debería ser `React.FormEvent`

**Archivo:** `src/components/landing/waitlist-form.tsx:85`

```ts
function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
```

`SyntheticEvent` es la clase base. Para `onSubmit` de un `<form>`, el tipo correcto es `React.FormEvent<HTMLFormElement>`.

---

## 6. `CtaButton` — coupling innecesario

**Archivo:** `src/components/landing/cta-button.tsx`

```tsx
type CtaButtonProps = Pick<ButtonProps, 'size' | 'w' | 'onClick'> & {
  children?: React.ReactNode;
};
```

El prop `onClick` viene de `ButtonProps` pero el componente interno usa `LinkButton` (que renderiza un `<a>`). Un `<a>` tiene `onClick: MouseEventHandler<HTMLAnchorElement>` pero `ButtonProps['onClick']` es `MouseEventHandler<HTMLButtonElement>`. Aunque TypeScript lo permite porque `MouseEventHandler` es covariante, semánticamente es incorrecto y puede causar confusión.

**Además:** El `href` está hardcodeado a `"#comunidad"`. Si la sección cambia de id, hay que actualizar este componente también. Considerar pasar `href` como prop:

```tsx
type CtaButtonProps = Pick<ButtonProps, 'size' | 'w'> & {
  children?: React.ReactNode;
  href?: string;
};

export function CtaButton({ href = '#comunidad', children = 'Solicitar acceso', ...props }: CtaButtonProps) {
```

---

## 7. `Chip` — falta de prop drilling tipado

**Archivo:** `src/components/landing/waitlist-form.tsx:262–303`

El `Chip` es un sub-componente privado del form (no exportado). Su `onClick` no tiene tipo explícito — usa `() => void` implícito desde el callback de `setExperience`/`setMonthlySpend`.

Además, el `Chip` no tiene tipo de `value` — es solo un presentacional. En el contexto de `role="radiogroup"`, debería tener:
- `value` prop para identificación
- `aria-checked` para ARIA semántico (ver sección de accesibilidad)
