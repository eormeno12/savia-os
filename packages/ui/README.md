# @savia-os/ui

Sistema de diseño compartido de Savia, organizado según la metodología
**Atomic Design** de Brad Frost. Lo consumen `apps/app` y `apps/landing`
exclusivamente a través del barrel (`import { X } from "@savia-os/ui"`), nunca
por ruta profunda — así los componentes se pueden reorganizar internamente sin
tocar las apps.

## Los niveles

```
@savia-os/design-tokens   ← FOUNDATIONS (tokens: color, tipografía, spacing, radii…)
        │
packages/ui/src/
  foundations/   valores de marca sub-atómicos (espejo JS de los tokens)
  atoms/         primitivos indivisibles — no contienen otro componente del proyecto
  molecules/     un grupo de átomos con un único trabajo
  organisms/     secciones autónomas que componen moléculas/átomos
  templates/     esqueletos de layout a nivel de página, con slots de contenido
```

> **Las `pages` viven en cada app** (`apps/*/src/app/`), no en la librería. Una
> página es la instancia concreta de un template con contenido real. Por eso los
> componentes por feature de las apps (`auth/`, `memory/`, `bandeja/`…) se
> organizan por dominio, no por nivel atómico: son la capa de páginas.

> **Tokens ≠ átomos.** Los tokens (color `signalLime`, `radii.card`, escala de
> tipos) son la capa *sub-atómica* y viven en `@savia-os/design-tokens`. Un color
> o un `clamp()` no es un átomo porque no es una unidad de UI renderizable.

## Inventario por nivel

| Nivel | Componentes |
|-------|-------------|
| **foundations** | `BRAND_COLORS`, `EASE_SAVIA` |
| **atoms** | `SaviaMark`, `Card`, `Avatar`/`AvatarGroup`, `ProgressBar`, `Skeleton`/`SkeletonText`/`CardSkeleton`, `StatusBadge`, `MetricStat`, `NavItem`, tipografía (`PageTitle`, `SectionTitle`, `CardTitle`, `Metric`, `Caption`, `Eyebrow`) |
| **molecules** | `Field`, `OtpInput`, `CopyBlock`, `Dialog`, `EmptyState`, `SearchBar`, `DropZone`, `Stepper`, `SectionHeader`, `Toaster` |
| **organisms** | `CommandPalette`, `ConfirmDialog`, `SaviaParticles` |
| **templates** | `Shell` |
| **fuera de la jerarquía** | `SaviaProvider` (entrada del sistema), `FadeInUp` (utilidad de motion) — no son UI renderizable, por eso no se les asigna nivel |

## Regla para clasificar

Se clasifica por la **composición real del render**, no por el nombre:

- **átomo** si compone solo primitivos de Chakra/HTML (ej. `NavItem` es un `<a>`
  estilizado; `MetricStat` renderiza un único `Stat`).
- **molécula** si agrupa 2+ átomos con sentido propio para un solo trabajo
  (ej. `Field` = label + control + error; `Dialog` = overlay + panel + slots).
- **organismo** si es autónomo y compone moléculas/átomos, normalmente con estado
  (ej. `ConfirmDialog` compone `Dialog`; `CommandPalette` posee estado de filtro).
- **template** si define el esqueleto de una página con slots (ej. `Shell`).

### Casos-borde (decididos, fáciles de revertir)

- **`MetricStat` → átomo** (no molécula): renderiza un único `Stat` de Chakra como
  una unidad presentacional. Si prefieres tratar `label + valor + tendencia` como
  composición de átomos, muévelo a `molecules/`.
- **`NavItem` → átomo** (no organismo): es un ancla estilizada con variantes
  `tone`/`active`, sin componer otros componentes ni tener estado.
- **`Toaster` → molécula**: un toast es `icono + mensaje + acción + cerrar`; el
  `SaviaProvider` lo monta una sola vez, pero la unidad en sí es una molécula.

## Añadir un componente

1. Decide el nivel con la regla de arriba (por composición del render).
2. Crea el archivo en la carpeta del nivel.
3. Expórtalo desde `src/index.ts`, bajo la sección del nivel correspondiente.
