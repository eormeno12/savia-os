# 08 — Auditoría Chakra vs custom (Fase 2)

> Entregable de la **Fase 2**: por cada elemento del [inventario](07-component-inventory.md),
> la decisión de cómo se construye. Verificado contra la API real de Chakra v3
> (`@chakra-ui/react` 3.36) con el MCP de Chakra (`list_components`,
> `get_component_props`, `get_component_example`).
>
> **Regla**: *no construir lo que Chakra ya resuelve bien.* **Enfoque de recetas:
> pragmático** — usar variantes built-in + `colorPalette` por token donde alcanza;
> `defineRecipe`/`defineSlotRecipe` solo donde aporta una variante de marca que
> Chakra no trae o un default centralizado.

## Cuatro decisiones posibles

- **built-in** — usar el componente de Chakra tal cual con props + `colorPalette`
  (las variantes ya existen). Sin receta, sin wrapper.
- **wrap** — wrapper fino sobre la primitiva con defaults de marca por token (p.ej.
  radii `chip`, copy, composición icon+texto). No reimplementar.
- **receta** — `defineRecipe`/`defineSlotRecipe` registrada en `createSystem`, solo
  para variantes de marca ausentes en Chakra o defaults centralizados.
- **scratch** — construir sobre primitivas (`Box`/SVG/Framer); Chakra no lo tiene.

## Tabla de decisión

| Elemento Savia | Primitiva Chakra v3 | Decisión | Razón |
|---|---|---|---|
| Button | `button` | **built-in** | variant solid/subtle/surface/outline/ghost/plain + size + `colorPalette` + loading ya existen |
| IconButton | `button` (IconButton) | **built-in** | idem Button |
| Input / Textarea | `input` / `textarea` | **receta** | base ok; falta variante **dark-form** + radii de marca → `defineSlotRecipe` |
| OtpInput | `pin-input` | **wrap** | existe; wrapper con 6 celdas + tono claro/oscuro |
| Badge / Chip | `badge` / `tag` | **built-in** | variantes + `colorPalette` cubren |
| StatusBadge | `badge` + `status` | **wrap** | composición icon+texto (WCAG 1.4.1); ya existe, se mantiene |
| Avatar / AvatarGroup | `avatar` | **built-in/wrap** | homónimo + group |
| Switch / Checkbox / Radio | `switch`/`checkbox`/`radio-group` | **built-in** | con `colorPalette` |
| Tooltip / Kbd / Divider / Spinner | `tooltip`/`kbd`/`separator`/`spinner` | **built-in** | homónimos |
| ProgressBar | `progress` | **wrap** | barra share% con color por `spaceColor` |
| CopyBlock | `clipboard` + `code-block` | **wrap** | copiar + feedback; reusa lógica de `McpConfigBlock` |
| SpaceGlyph | — | **scratch** | marca: círculo coloreado por `spaceColor` + inicial |
| Card | `card`/`box` | **receta** ✅ hecho | variantes flat/elevated/**inverse**/**interactive** que Chakra no trae → `card` recipe en `createSystem` |
| Field / EmptyState / Dialog / ConfirmDialog / Skeleton / Toaster / SectionHeader / FadeInUp / SaviaParticles | varios | **wrap (mantener)** | ya son wrappers correctos en `@savia-os/ui` |
| SearchBar | `input-group` + `input-element` | **wrap** | input prominente con icono + ⌘K hint |
| NavItem | — | **scratch** | item de nav del Shell (estado activo, lima sobre ink) |
| MetricStat | `stat` | **wrap** | número grande con textStyle `metric` |
| Stepper / WizardSteps | `steps` | **wrap** | progreso multipaso (A1, O*, C2, CO6) |
| DropZone | `file-upload` | **wrap** | DnD + overlay; flujo presign→S3→create |
| MemoryListRow | `box` + `data-list` | **wrap/scratch** | fila de memoria (texto/fecha/origen/links) |
| MemoryCell / MemoryMap | — (SVG) | **scratch** | circle-packing `d3-hierarchy` + Framer + `spaceColor` |
| SpaceCard / AreaTile | `card` | **wrap** | tarjeta de área (usa Card) |
| SavedSearchItem | `data-list` / `list` | **wrap** | nombre + conteo en vivo |
| ActivityFeedItem / FeedList | `timeline` | **wrap** | feed de eventos legibles + revert |
| AccessMatrix / AccessMatrixCell | `table` | **wrap** | grilla IA×área (grant/revoke) |
| ConnectionCard | `card` + `status` | **wrap** | health por `lastSeenAt`/`revoked` |
| ClientGuideCard | `card` + `segmented-control`/`tabs` | **wrap** | selector de cliente |
| McpConfigBlock | `clipboard` + `code-block` | **wrap** | reusa lógica de generación de config |
| NotificationItem / NotificationsTray | `popover` + `timeline` | **wrap** | bandeja desde el bell |
| MemberRow | `select` / `segmented-control` | **wrap** | rol viewer/contributor/admin |
| PolicySelector | `radio-card` / `segment-group` | **wrap** | open/restricted/approval/people-only |
| InviteLinkBox | `clipboard` + `input` | **wrap** | link + expiración |
| PlanCard / BillingRow | `card` + `table` | **wrap** | plan + historial |
| GrowthChart | `area-chart`/`line-chart`/`sparkline` | **wrap** | charts nativos Chakra v3, recoloreados con `spaceColor` |
| CommandPalette (⌘K) | `combobox` + `dialog` | **wrap** | overlay de búsqueda + acciones |
| SubscriptionGateModal (SB1) | `dialog` | **wrap** | usa Dialog existente + contenido de gate |
| AreaPanel (edición inline) | `editable` | **wrap** | nombre/descr editables inline |
| Paginación (M2) | `pagination` | **built-in** | memorias paginadas |
| Mercado Pago | — | **fuera de UI** | el front solo CTA → URL del backend (hay MCP Mercado Pago; evaluar real) |

## Conclusión

- **La mayoría es built-in o wrap fino** sobre Chakra v3 — la superficie custom real
  es pequeña: **SpaceGlyph**, **MemoryCell/MemoryMap**, **NavItem** y las
  composiciones de organismo.
- **Recetas**: solo **Card** (hecho) e **Input** (dark-form). El resto usa variantes
  built-in + `colorPalette` por token.
- **Única dependencia externa nueva**: `d3-hierarchy` (mapa). Charts salen de Chakra.

Siguiente: [Fase 3](../../../.claude/plans/) — librería, en orden átomos → moléculas
→ organismos → Shell.
