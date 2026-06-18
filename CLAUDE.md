# savia-os — Monorepo

## Estructura

```
savia-os/
├── apps/
│   └── landing/          @savia-os/landing   Next.js 16, puerto 4343
├── packages/
│   └── tsconfig/         @savia-os/tsconfig  tsconfigs compartidos
├── package.json          pnpm@11.7.0 + turbo@2.9.x
├── pnpm-workspace.yaml
└── turbo.json
```

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

## Apps actuales

| Workspace | Ruta | Puerto |
|-----------|------|--------|
| `@savia-os/landing` | `apps/landing/` | 4343 |

## Contexto del proyecto

Savia OS es el monorepo de producto de Savia — la memoria que conecta todas tus IAs.
Las reglas específicas de cada app están en su propio `CLAUDE.md` o `AGENTS.md`.
