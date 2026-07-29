# Savia — Bundle para Claude Design (fundamentos)

Librería local de **previews HTML auto-contenidos** lista para subir a un proyecto de
design-system en [claude.ai/design](https://claude.ai/design). Cada archivo es un
"card": HTML estático, sin dependencias, con los **valores reales** de Savia y un
marcador en la primera línea (`<!-- @dsCard group="…" -->`) que el panel de Design
System usa para indexarlo.

> **Fuente de verdad:** la implementación de la landing (`apps/landing`) y el paquete
> de tokens (`@savia-os/design-tokens`). Los valores hex, textStyles, spacing, radii,
> sombras, easings y la voz están copiados 1:1 de ahí, no de docs previos.

## Contenido (primer corte — solo fundamentos)

| Card | Grupo | Qué cubre |
|------|-------|-----------|
| `index.html` | Overview | Portada, dirección y los tres adjetivos guía |
| `foundations/color-palette.html` | Color | Paleta de marca + estados |
| `foundations/color-lime-rule.html` | Color | **La regla del lima** (sobre oscuro vs. claro) — la pieza de firma |
| `foundations/color-surfaces.html` | Color | Claro/oscuro + tokens semánticos (bg/fg/border) |
| `foundations/color-space-scale.html` | Color | Rampa de spaces ink→lima (no arcoíris) |
| `foundations/typography.html` | Tipografía | Inter, pesos, escala fluida, highlight ink |
| `foundations/spacing-layout.html` | Espaciado | Stack/sección fluidos, contenedores, layout |
| `foundations/radii-shadows.html` | Espaciado | Radios + profundidad (incl. floatDark) |
| `foundations/motion.html` | Motion | Curva `easings.savia` + duraciones |
| `foundations/voice.html` | Voz | Atributos, sí/no, léxico |
| `foundations/brand-mark.html` | Marca | Mark de 4 pliegues + lockup |

## Cómo revisarlo

Abrí cualquier archivo en el navegador (doble click o `open design-system/index.html`).
Son estáticos: no necesitan build ni servidor.

## Cómo subirlo a Claude Design

El push se hace con la herramienta **DesignSync** (ideal con el skill `/design-sync`),
desde esta carpeta como `localDir`:

1. `list_projects` → elegí un proyecto existente de tipo design-system, o `create_project`.
2. `finalize_plan` con `writes: ["**/*.html"]` y `localDir` = `design-system/`.
3. `write_files` con cada `localPath` → el contenido sube directo (no pasa por el modelo).

Los cards aparecen agrupados por el `group` del marcador `@dsCard`.

## Próximos cortes (cuando quieras)

- **Componentes core**: botones/CTA, Card (flat/elevated/inverse), Field/inputs,
  StatusBadge, EmptyState, Dialog, PageHero.
- **Piezas ricas de landing**: memory-graph, orbital-rings, persona-card, isla, hero.
