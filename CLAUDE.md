# savia-os — Monorepo

## Estructura

**Savia B2B se está reconstruyendo (ver "Contexto del proyecto" abajo). El repo tiene código legado y código nuevo — no asumas cuál es cuál por el nombre solo, leé esta sección.**

```
savia-os/
├── apps/
│   ├── landing/          @savia-os/landing        Next.js 16, puerto 4343 (marketing + showcase DS)
│   ├── api/               (vacío — el B2B nuevo va acá; scaffold pendiente)
│   ├── app/                (vacío — el B2B nuevo va acá; scaffold pendiente)
│   ├── legacy-api/        @savia-os/legacy-api     NestJS — CONGELADO (2026-07-29). No se le agrega
│   │                                                código nuevo. Es la referencia validada (diseños,
│   │                                                algoritmos, tests) para reintegrar en apps/api — ver
│   │                                                docs/product/savia-b2b/apx-motor-v2.md y
│   │                                                .claude/agents/planner-savia.md ("se reintegra como
│   │                                                diseño validado", nunca copy-paste).
│   └── legacy-app/        @savia-os/legacy-app     Next.js 16 — CONGELADO, misma razón.
├── packages/
│   ├── ui/               @savia-os/ui             sistema de diseño (Atomic Design) sobre Chakra v3
│   ├── design-tokens/    @savia-os/design-tokens  foundations: tokens Chakra (createSystem)
│   ├── contracts/        @savia-os/contracts      tipos/contratos compartidos
│   └── tsconfig/         @savia-os/tsconfig       tsconfigs compartidos
├── package.json          pnpm@11.7.0 + turbo@2.9.x
├── pnpm-workspace.yaml
└── turbo.json
```

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
| `@savia-os/legacy-app` | `apps/legacy-app/` | 4345 | congelado — referencia, no tocar |
| `@savia-os/legacy-api` | `apps/legacy-api/` | 4400 (main) / 4401 (mcp) | congelado — referencia, no tocar |
| — | `apps/app/`, `apps/api/` | — | B2B nuevo, scaffold pendiente |

## Contexto del proyecto

Savia OS es el monorepo de producto de Savia. **Dirección de producto actual: B2B —
Savia como el cerebro ejecutable de cada empresa.** Arranca desde la memoria de cada
persona (lo que ya existe hoy) y, vía lo colaborativo, hace emerger el cerebro de la
organización: conocimiento disperso → memoria confiable → skills ejecutables que
cualquier IA de la empresa consume por MCP. Visión completa y las 5 capas del producto
en [`docs/product/savia-b2b/01-vision.md`](docs/product/savia-b2b/01-vision.md) — léelo antes de
tomar decisiones de producto o de copy.

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
