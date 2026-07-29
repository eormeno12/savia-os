# 07 — Inventario de componentes (Fase 1)

> Entregable de la **Fase 1** del rediseño: inventario exhaustivo de todos los
> elementos visuales del mockup (`Savia - Mockup.html`) y de la especificación de
> comportamiento (`mockup-requirements.md`, `mockup-v2.md`), agrupados en **átomos**,
> **moléculas** y **organismos**. Se entrega **antes** de implementar (regla del brief).
> La auditoría Chakra vs custom (Fase 2) vive en [08-chakra-audit.md](08-chakra-audit.md).

## Cómo leer este inventario

Cada elemento lleva tres marcas:

- **Estado** — `[ex]` ya existe en `@savia-os/ui` · `[mig]` existe pero hay que
  migrarlo al sistema de recetas de Chakra (`defineRecipe`/`defineSlotRecipe`) ·
  `[new]` se construye nuevo.
- **Capa** — según la tabla de decisión de [05-shared-design-system.md §4](05-shared-design-system.md):
  **L1** `@savia-os/design-tokens` (datos) · **L2** `@savia-os/ui` (marca + genéricos,
  los reusaría la landing tal cual) · **L3** `apps/app` (dominio de producto, no los
  reusa la landing). Regla: *¿la landing lo usaría sin copy ni datos de producto?* Sí→L2, No→L3.
- **Pantallas** — códigos de pantalla donde aparece (S1, M1–M6, P1–P2, C1–C3, SB1, N1,
  CO1–CO7, A1–A2, O1–O5, F1, CT1–CT4).

Los estados visuales obligatorios por componente interactivo son **default / hover /
focus / disabled / loading**, alineados al mockup. Los organismos de pantalla además
deben cubrir **vacío / carga / error / poblado**.

---

## Átomos

| Átomo | Estado | Capa | Pantallas | Notas |
|---|---|---|---|---|
| Button | `[mig]` | L2 | todas | variantes solid/outline/plain/danger + tamaños + loading; mover a `defineRecipe` (hoy prop-styled) |
| IconButton | `[new]` | L2 | S1, M2, C1, F1, N1 | wrapper sobre Chakra IconButton |
| Input / Textarea | `[new]` | L2 | A1, M3, CT1, búsqueda, CT4 | `defineSlotRecipe`; incluye variante dark-form (mata el `darkInput` inline de OtpForm) |
| OtpInput (6 dígitos) | `[new]` | L2 | A2, O (verif.) | autofill + paste; ref: `apps/app/.../ui/OtpInput.tsx` |
| Badge / Chip | `[new]` | L2 | M1, C1, CO2, P2, M4 | conteos, etiquetas; receta con tonos |
| StatusBadge (tono neutral/success/warning/danger/info) | `[mig]` | L2 | C1, P1, N1, CT2 | icon+texto obligatorio (WCAG 1.4.1); migrar a receta |
| Avatar / AvatarGroup | `[new]` | L2 | S1 (cuenta), CO1, CO2, CO5 | Chakra Avatar + stack |
| Switch / Toggle | `[new]` | L2 | C3 (verif.), CT2, M2 (acceso) | receta |
| Checkbox / Radio | `[new]` | L2 | M2 (multiselect), CO3 (policy) | receta |
| Kbd (hint de teclado) | `[new]` | L2 | S1 (Cmd-K) | átomo para el atajo ⌘K |
| Tooltip | `[new]` | L2 | S1, M1 (peek) | wrapper Chakra |
| Divider / Separator | `[new]` | L2 | paneles | wrapper Chakra |
| Spinner / loader inline | `[new]` | L2 | async inline | wrapper Chakra |
| ProgressBar (share %) | `[new]` | L2 | M1 (lista), F1, P1 | barra de progreso/share |
| Skeleton / CardSkeleton | `[ex]` | L2 | todos los loading | ya existe |
| SaviaMark (logo) | `[ex]` | L2 | S1, A1, M1 (hero), O5 | ya existe |
| SpaceGlyph (color+inicial) | `[new]` | **L3** | M1, M2, P2, CO1 | dominio: usa `spaceColor()`; ref: `apps/app/.../ui/SpaceGlyph.tsx` |
| CopyBlock (copiar) | `[new]` | L2/L3 | C3, O3, SB1 | L2 si la landing lo reusa; si no, L3. Ref: `apps/app/.../ui/CopyBlock.tsx` |

---

## Moléculas

| Molécula | Estado | Capa | Pantallas | Notas |
|---|---|---|---|---|
| Card (flat/elevated/inverse/interactive) | `[mig]` | L2 | todas | migrar variantes a `defineRecipe` |
| Field (label+control+error) | `[ex]` | L2 | A1, M3, CT1, CT4 | ya existe |
| EmptyState (icon+título+acción) | `[ex]` | L2 | todos los vacíos | ya existe |
| ConfirmDialog (danger) | `[ex]` | L2 | M2 delete, CT1 delete-account, C1 revoke | ya existe |
| SectionHeader (eyebrow+título) | `[ex]` | L2 | tops de sección | ya existe |
| FadeInUp (motion) | `[ex]` | L2 | transiciones | ya existe |
| SaviaParticles (fondo) | `[ex]` | L2 | M1 hero, O5 | ya existe |
| Toaster / notify | `[ex]` | L2 | global | ya existe |
| SearchBar (prominente) | `[new]` | L2 | S1, M1, M5 | navegación primaria por búsqueda |
| NavItem | `[new]` | L2 | S1 | item de nav del Shell |
| MetricStat (número grande) | `[new]` | L2 | M1 hero, P1 | usa textStyle `metric` |
| Stepper / WizardSteps | `[new]` | L2 | A1 journey, O*, C2, CO6 | progreso multipaso |
| DropZone (drag-drop archivo/texto) | `[new]` | L2 | O2, F1 | HTML5 DnD + overlay |
| MemoryListRow | `[new]` | L3 | M2, M5, M6 | fila de memoria (texto+fecha+origen+links) |
| MemoryCell (círculo orgánico) | `[new]` | L3 | M1 | celda del mapa; ver [04-memory-map.md](04-memory-map.md) §4 |
| SpaceCard / AreaTile | `[new]` | L3 | M1 (fallback lista) | tarjeta de área |
| SavedSearchItem | `[new]` | L3 | M4 | nombre + conteo en vivo |
| ActivityFeedItem (evento + revert) | `[new]` | L3 | P1 | frase legible + acción revert inline |
| AccessMatrixCell | `[new]` | L3 | P2 | celda IA×área (grant/revoke) |
| ConnectionCard (health) | `[new]` | L3 | C1 | estado conectado/sin-actividad/problema |
| ClientGuideCard | `[new]` | L3 | C3 | selector de cliente (Claude/Cursor/…) |
| McpConfigBlock (copy + verify) | `[new]` | L3 | C3 | reusa lógica de `McpConfigBlock.tsx` |
| NotificationItem | `[new]` | L3 | N1 | invitación/sugerencia/proceso/hito |
| MemberRow (selector de rol) | `[new]` | L3 | CO2 | viewer/contributor/admin |
| PolicySelector | `[new]` | L3 | CO3 | open/restricted/approval/people-only |
| InviteLinkBox (copiar link) | `[new]` | L3 | CO5 | link + expiración |
| PlanCard / BillingRow | `[new]` | L3 | CT2, SB1 | plan + historial de facturación |
| GrowthChart | `[new]` | L3 | P1, M1 | recoloreado vía `spaceColor` inyectado |

---

## Organismos

| Organismo | Estado | Capa | Pantallas | Notas |
|---|---|---|---|---|
| Dialog (modal base) | `[ex]` | L2 | SB1, M3, CO5… | ya existe |
| CommandPalette (⌘K) | `[new]` | L2 | global | overlay genérico; nav la inyecta la app |
| SubscriptionGateModal (SB1) | `[new]` | L2 | SB1 | wrapper sobre Dialog + contenido de gate |
| AccessMatrix (P2) | `[new]` | L2/L3 | P2 | grilla genérica; datos de producto |
| NotificationsTray (N1) | `[new]` | L2/L3 | N1, S1 (bell) | bandeja desplegable |
| Shell (S1) — **el último** | `[new]` | L2 | global | marca+nav+search+⌘K+bell+Connect-IA+cuenta; nav por props |
| MemoryMap (M1) | `[new]` | **L3** | M1 | circle-packing d3 + `spaceColor` + Framer; ver [04-memory-map.md](04-memory-map.md) |
| AreaPanel (M2) | `[new]` | L3 | M2 | editable + memorias paginadas + multiselect + acceso por-IA |
| FeedList (P1) | `[new]` | L3 | P1 | feed + GrowthChart + resumen IA + revert |
| ConnectionList (C1) | `[new]` | L3 | C1 | lista con health |
| NewConnectionFlow (C2) | `[new]` | L3 | C2 | wizard 2 pasos |
| ConnectionGuide (C3) | `[new]` | L3 | C3 | guía por cliente + verificación en vivo |
| CollectiveView (CO1) | `[new]` | L3 | CO1 | vista de área colectiva |
| MembersPanel (CO2) | `[new]` | L3 | CO2 | miembros + roles |
| PolicyPanel (CO3) | `[new]` | L3 | CO3 | política de acceso de IAs |
| ConnectMyIAs (CO4) | `[new]` | L3 | CO4 | conectar IAs propias al área |
| InviteFlow (CO5) | `[new]` | L3 | CO5 | invitar persona (link) |
| ConvertWizard (CO6) | `[new]` | L3 | CO6 | convertir a colectiva (3 pasos) |
| AcceptInvite (CO7) | `[new]` | L3 | CO7 | página pública de aceptación |
| OnboardingFlow (O1–O5) | `[new]` | L3 | O1–O5 | welcome/import/rescue/connect/done |
| SourcesBoard (F1) | `[new]` | L3 | F1 | drop zone central, organizado por contribución |
| AccountPanels (CT1–CT4) | `[new]` | L3 | CT1–CT4 | perfil/plan/export/ayuda |

---

## Resumen cuantitativo

- **Ya existen** en `@savia-os/ui` (reusar tal cual): Skeleton/CardSkeleton, SaviaMark,
  Card¹, Field, EmptyState, ConfirmDialog, SectionHeader, FadeInUp, SaviaParticles,
  Toaster/notify, Dialog, StatusBadge¹, SaviaProvider. (¹ requieren migración a recetas.)
- **A migrar** a sistema de recetas: Button, Card, StatusBadge (+ Input nuevo como receta).
- **Nuevos átomos**: ~12 · **Nuevas moléculas**: ~20 · **Nuevos organismos**: ~22.
- **Capas**: la marca y los genéricos van a **L2** (`@savia-os/ui`); todo lo que toca
  `spaceColor`/datos de producto (SpaceGlyph, MemoryMap, MemoryListRow, paneles de
  sección) va a **L3** (`apps/app`), por la regla de [05 §4](05-shared-design-system.md).

## Próximo paso

[08-chakra-audit.md](08-chakra-audit.md) — Fase 2: por cada elemento, decidir
extender-receta / wrapper / construir-desde-cero, verificando la API real de Chakra v3
con el **MCP de Chakra UI** (`list_components`, `get_component_props`,
`get_component_example`).
