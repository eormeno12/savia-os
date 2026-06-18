# Auditoría de Calidad de Código

---

## 1. TypeScript

### 1.1 `isla/page.tsx` — Token sin tipo

**Archivo:** `src/app/design-system/isla/page.tsx:272`

```tsx
fontSize="titleXl"
```

`titleXl` no existe en los tokens del tema. TypeScript no detecta esto porque `fontSize` acepta `string` (no hay generación de tipos de tokens en el setup actual).

**Solución a largo plazo:** Chakra v3 puede generar tipos de tokens con `npx @chakra-ui/cli typegen ./src/theme/index.ts`. Esto permite que TypeScript valide que los tokens usados existen.

### 1.2 Narrow de tipo explícito innecesario en `waitlist-form.tsx`

**Archivo:** `src/components/landing/waitlist-form.tsx:51`

```tsx
<SuccessCard email={submittedEmail} status={state.status as "success" | "duplicate"} />
```

El cast `as "success" | "duplicate"` es necesario porque TypeScript no puede narrowear el tipo después del check `isConfirmed = state.status === "success" || state.status === "duplicate"`. 

Para eliminar el cast, refactorizar la condición de render:

```tsx
if (state.status === 'success' || state.status === 'duplicate') {
  return <SuccessCard email={submittedEmail} status={state.status} />;
}
```

Aquí TypeScript infiere el tipo correctamente sin necesidad de cast.

### 1.3 `handleSubmit` en `waitlist-form.tsx`

**Archivo:** `src/components/landing/waitlist-form.tsx:85`

```ts
function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
```

Debería ser `React.FormEvent<HTMLFormElement>`.

### 1.4 `LIME_NODES` en orbital-island — índice como key

**Archivo:** `src/components/landing/orbital-island.tsx:137`

```tsx
{LIME_NODES.map((node, i) => (
  <circle key={i} ...>
```

El array es estático y no se reordena, por lo que usar índice como key no causará bugs. Pero por consistencia, podría ser `key={`node-${node.cx}-${node.cy}`}`.

---

## 2. Organización de archivos

### 2.1 Estructura actual

```
src/
├── app/
│   ├── actions.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── design-system/
│       ├── brand/page.tsx
│       ├── buttons/page.tsx
│       ├── colors/page.tsx
│       ├── isla/page.tsx        ← DS page
│       ├── island/page.tsx      ← ¿duplicado?
│       ├── layout.tsx
│       ├── logo/page.tsx
│       ├── page.tsx
│       ├── tokens/page.tsx
│       ├── typography/page.tsx
│       └── voice/page.tsx
├── components/
│   ├── design-system/
│   │   ├── chatgpt-icon.tsx
│   │   ├── ds-nav.tsx
│   │   └── savia-mark.tsx
│   ├── landing/
│   │   ├── [16 componentes]
│   └── ui/
│       ├── button.tsx
│       └── provider.tsx
├── lib/
│   ├── google-sheets.ts
│   ├── site.ts
│   └── waitlist.ts
└── theme/
    ├── index.ts
    ├── semantic-tokens.ts
    ├── text-styles.ts
    └── tokens.ts
```

### 2.2 `design-system/isla` vs `design-system/island`

Existen dos rutas del DS:
- `/design-system/isla/page.tsx` — Documentación en español de la isla
- `/design-system/island/page.tsx` — No leído aún

Probablemente una es una versión anterior y la otra la actual. Verificar y eliminar la duplicada.

### 2.3 Reorganización propuesta

```
src/
├── app/
│   ├── (landing)/             ← Route group (sin layout propio)
│   │   └── page.tsx
│   ├── design-system/
│   ├── actions.ts             ← Server Actions para landing
│   ├── error.tsx              ← NUEVO
│   ├── layout.tsx
│   ├── not-found.tsx          ← NUEVO
│   ├── opengraph-image.tsx    ← NUEVO
│   ├── robots.ts              ← NUEVO
│   └── sitemap.ts             ← NUEVO
├── components/
│   ├── landing/
│   │   ├── [componentes de sección]
│   │   └── hero/              ← NUEVO: subcarpeta para hero sub-components
│   │       ├── hero-badge.tsx
│   │       └── hero-headline.tsx
│   └── ui/
│       ├── animated-section.tsx  ← NUEVO
│       ├── button.tsx
│       ├── provider.tsx
│       └── section-header.tsx    ← NUEVO
└── lib/
    ├── constants.ts           ← NUEVO: NAV_ITEMS, AVATARS, etc.
    ├── google-sheets.ts
    ├── site.ts
    └── waitlist.ts
```

---

## 3. Constantes sin centralizar

### 3.1 Color `#E7FF18` (signalLime) en múltiples archivos

| Archivo | Uso |
|---------|-----|
| `site-header.tsx:16` | `const LIME = '#E7FF18'` |
| `site-footer.tsx:73` | `color="#E7FF18"` inline |
| `ecosystem-scroll.tsx:85` | `fill="#E7FF18"` en SVG |
| `savia-particles.tsx:6` | `const LIME = "#E7FF18"` |
| `waitlist-form.tsx:391` | `color="#E7FF18"` |
| `orbital-island.tsx` | `fill="#E7FF18"` múltiples veces |

Dentro de componentes Chakra, usar el token `signalLime` o `lime.solid` es la forma correcta. Pero para elementos SVG y estilos inline (donde los tokens de Chakra no aplican), debería exportarse desde `lib/constants.ts`:

```ts
// src/lib/constants.ts
export const BRAND = {
  lime: '#E7FF18',
  ink: '#0B2529',
  paper: '#F4F4F1',
} as const;
```

---

## 4. Comentarios y documentación

### 4.1 Lo que está bien

- `ecosystem-scroll.tsx` tiene comentarios explicativos en la geometría de las posiciones (útil, no obvio).
- `orbital-island.tsx` documenta la relación entre PIECE, HALF y las posiciones.
- `semantic-tokens.ts` documenta los 8 keys que Button de Chakra lee.
- `tokens.ts` documenta qué ya existe en Chakra y qué se está añadiendo.

### 4.2 Lo que falta

- `google-sheets.ts` — El singleton module-level debería documentar por qué (connection reuse).
- `waitlist.ts` — Los valores de `experienceOptions` y `monthlySpendOptions` con `satisfies` son correctos pero sin comentario es difícil entender por qué `satisfies` y no solo tipado normal.

---

## 5. ESLint

No hay archivo de configuración de ESLint visible (`eslint.config.js`, `.eslintrc.js`, o `.eslintrc.json`). El script `"lint": "eslint ."` existe en `package.json` pero sin config, ESLint usará defaults o puede fallar.

**Fix:** Verificar si existe `eslint.config.mjs` (que Next.js 16 genera por defecto) y si no, crear:

```js
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
```

---

## 6. CSS Modules — consistencia

### 6.1 `how-it-works.module.css` — bien

```css
@media (prefers-reduced-motion: reduce) {
  .dotActive { animation: none; }
}
```

### 6.2 `orbital-island.module.css` — falta

No tiene `@media (prefers-reduced-motion)`. Los anillos orbitales no se detienen para usuarios con esta preferencia.

### 6.3 `savia-particles.module.css` — necesita verificación

No fue leído en esta auditoría. Verificar si tiene `prefers-reduced-motion`.

### 6.4 Naming

Los class names en CSS Modules usan camelCase (`.ringCw`, `.chipCcw`, `.dotActive`). Consistente y correcto para Modules.

---

## 7. Dependencies — versiones

```json
"next": "^16.2.6",
"react": "^19.2.6",
"@chakra-ui/react": "^3.21.0",
"framer-motion": "^12.40.0",
```

Stack moderno y actualizado. El `^` permite minor updates automáticas, lo que es el comportamiento esperado.

**Posible issue con `^16.2.6` de Next.js** — Las `^` versiones en production packages a veces causan inconsistencias. Para producción, considerar pin exacto (`"16.2.6"`) o uso de `package-lock.json` (que ya existe).

---

## 8. `lib/google-sheets.ts` — seguridad

### 8.1 `JSON.parse` sin try/catch

**Archivo:** `src/lib/google-sheets.ts:47`

```ts
const parsed = JSON.parse(raw) as ServiceAccount;
```

Si `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` tiene JSON malformado, esto lanzará una excepción no manejada que se propagará como error 500.

**Fix:**
```ts
let parsed: ServiceAccount;
try {
  parsed = JSON.parse(raw) as ServiceAccount;
} catch {
  throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON is not valid JSON');
}
```

### 8.2 `quoteSheetName` — previene injection

La función `quoteSheetName` escapa correctamente las comillas simples en el nombre de la hoja. Buen trabajo de seguridad.
