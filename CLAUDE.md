# savia-os — Monorepo

## Estructura

**El repo tiene tres zonas y se distinguen por carpeta, no por prefijo.** `apps/` y
`packages/` son la línea principal — **B2B es el producto, no un anexo**. `legacy/` es el
B2C congelado. `lab/` son experimentos que no forman parte del producto.

```
savia-os/
├── apps/                 ── LÍNEA PRINCIPAL · B2B ──────────────────────────────
│   ├── landing/          @savia-os/landing        Next.js 16, puerto 4343 (marketing + showcase DS)
│   ├── api/               (vacío — el B2B nuevo va acá; scaffold pendiente)
│   └── app/               (vacío — el B2B nuevo va acá; scaffold pendiente)
├── packages/
│   ├── ir/               @savia-os/ir             el contrato del pipeline de ingesta · 0 deps
│   ├── emission/         @savia-os/emission       tramo 4: ruta + emisor
│   ├── ui/               @savia-os/ui             sistema de diseño (Atomic Design) sobre Chakra v3
│   ├── design-tokens/    @savia-os/design-tokens  foundations: tokens Chakra (createSystem)
│   └── tsconfig/         @savia-os/tsconfig       tsconfigs compartidos
│
├── legacy/               ── CONGELADO (2026-07-29) · el producto B2C ───────────
│   ├── api/              @savia-os/legacy-api     NestJS. No se le agrega código nuevo. Es la
│   │                                              referencia validada (diseños, algoritmos, tests)
│   │                                              para reintegrar en apps/api — ver
│   │                                              docs/product/savia-b2b-legacy/apx-motor-v2.md y
│   │                                              .claude/agents/planner-savia.md ("se reintegra
│   │                                              como diseño validado", nunca copy-paste).
│   ├── app/              @savia-os/legacy-app     Next.js 16 — misma razón.
│   └── contracts/        @savia-os/legacy-contracts   tipos/contratos del B2C. Solo lo importan
│                                                      los dos de arriba.
│
├── lab/                  ── EXPERIMENTOS · fuera del producto ──────────────────
│   ├── demo-api/         @savia-os/demo-api       demo con @modelcontextprotocol/sdk
│   ├── demo-ocr/          (Python — server.py, weights/. No es workspace de pnpm)
│   └── openmemory/        (submódulo git → eormeno12/mem0)
│
├── package.json          pnpm@11.7.0 + turbo@2.9.x
├── pnpm-workspace.yaml   apps/* · packages/* · legacy/* · lab/*
└── turbo.json
```

**La regla de la división:** si algo está en `legacy/`, es una carpeta que no se abre
para escribir — solo para leer diseños validados y reintegrarlos. Si está en `apps/` o
`packages/`, es la línea viva. Escribir en `legacy/` es un hallazgo bloqueante.

Comandos legado: `legacy-api:dev`, `legacy-worker:dev`, `legacy-mcp:dev`, `legacy-app:dev`, `legacy-db:migrate`, `legacy-db:deploy` (antes `api:dev`/`worker:dev`/`mcp:dev`/`app:dev`/`db:migrate`/`db:deploy` — renombrados el 2026-07-29 para dejar `api:dev`/`app:dev` libres para cuando exista el B2B nuevo). El CI de `legacy-api` está deshabilitado a propósito en `.github/workflows-disabled/api-ci.yml` (movido fuera de `.github/workflows/`, que es lo que GitHub Actions escanea) — código congelado no necesita gastar minutos de CI.

## Comandos desde la raíz

```
pnpm landing:dev        # dev server en 127.0.0.1:4343
pnpm landing:build      # build de producción con caché Turbo
pnpm landing:typecheck  # tsc --noEmit
pnpm landing:lint       # eslint
pnpm build              # build de todos los workspaces
```

## Reglas del monorepo

- Gestor de paquetes: **pnpm**. Nunca usar npm ni yarn en este repo.
- Imports entre workspaces: `workspace:*` en `package.json`.
- Configs TypeScript compartidas: extender desde `@savia-os/tsconfig/nextjs` o `@savia-os/tsconfig/base`.
- Turbo cachea `.next/**` y `dist/**`. No modificar `turbo.json` salvo que cambie el pipeline.

## Sistema de diseño (Atomic Design)

El design system compartido sigue la metodología **Atomic Design** de Brad Frost.
Detalle completo e inventario en [`packages/ui/README.md`](packages/ui/README.md).

- **Foundations (sub-atómico)**: tokens en `@savia-os/design-tokens`. Tokens ≠ átomos.
- **`packages/ui/src/`** por niveles: `foundations/` → `atoms/` → `molecules/` → `organisms/` → `templates/`.
- **Pages**: viven en cada app (`apps/*/src/app/`). Los componentes por feature de las apps son la capa de páginas y se organizan por dominio, no por nivel atómico.
- Las apps consumen `@savia-os/ui` **solo por el barrel** (`import { X } from "@savia-os/ui"`), nunca por ruta profunda.
- Clasificar por composición del render: átomo = solo primitivos Chakra/HTML; molécula = 2+ átomos, un trabajo; organismo = autónomo con estado; template = esqueleto de página.

## Apps actuales

| Workspace | Ruta | Puerto | Estado |
|-----------|------|--------|--------|
| `@savia-os/landing` | `apps/landing/` | 4343 | activo |
| `@savia-os/legacy-app` | `legacy/app/` | 4345 | congelado — referencia, no tocar |
| `@savia-os/legacy-api` | `legacy/api/` | 4400 (main) / 4401 (mcp) | congelado — referencia, no tocar |
| `@savia-os/legacy-contracts` | `legacy/contracts/` | — | congelado — solo lo usan los dos de arriba |
| — | `apps/app/`, `apps/api/` | — | B2B nuevo, scaffold pendiente |
| `@savia-os/demo-api` | `lab/demo-api/` | — | experimento, fuera del producto |

## Contexto del proyecto

Savia OS es el monorepo de producto de Savia. **Dirección de producto actual: B2B —
Savia como el cerebro ejecutable de cada empresa.** Arranca desde la memoria de cada
persona (lo que ya existe hoy) y, vía lo colaborativo, hace emerger el cerebro de la
organización: conocimiento disperso → memoria confiable → skills ejecutables que
cualquier IA de la empresa consume por MCP. Visión completa y las 5 capas del producto
en [`docs/product/savia-b2b/01-vision.md`](docs/product/savia-b2b/01-vision.md) — léelo antes de
tomar decisiones de producto o de copy. El resto de la carpeta sigue en reescritura limpia,
archivo por archivo (2026-07-29) — lo que falta reescribir vive en
[`docs/product/savia-b2b-legacy/`](docs/product/savia-b2b-legacy/00-overview.md).

Las reglas específicas de cada app están en su propio `CLAUDE.md` o `AGENTS.md`.

## Referencias de librerías

@.claude/llms/mem0.txt

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
