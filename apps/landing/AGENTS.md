# @savia-os/landing — Agent Quick Reference

> Complete guidelines are in **CLAUDE.md**. This file is a quick-reference summary.

## Stack
Next.js 16 App Router · React 19 · Chakra UI v3 (Panda CSS) · Framer Motion 12 · Zod · Lucide React

## Key rules
- Server Components by default. `"use client"` only for browser APIs, event handlers, React hooks.
- `next/dynamic` with `ssr: false` is NOT allowed in Server Components — Turbopack build error.
- Never hardcode hex values. Use design tokens from `src/theme/`. Brand constants from `src/lib/constants.ts`.
- `overflowX: "hidden"` on `html`, not `body` (breaks sticky positioning).
- Copy language: Spanish. One-liner: "La memoria que conecta todas tus IAs."

## Commands (from monorepo root)
pnpm landing:dev · pnpm landing:build · pnpm landing:typecheck · pnpm landing:lint

## Do-not patterns
Do not hardcode hex in components. Do not pass Framer Motion props to Chakra `Box`.
Do not use `href="#"` for pending links. Do not add `ssr: false` in Server Components.

See **CLAUDE.md** for complete guidelines, animation patterns, Zod validation, and accessibility rules.
