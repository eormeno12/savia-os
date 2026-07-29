# 06 — Ejecución paso a paso

> El orden de construcción del rediseño, atomizado. Cada **step** es del tamaño de
> un PR/commit: tiene objetivo, archivos, acciones y un *Done-when* verificable.
> Ejecutar en orden — las dependencias son estrictas hacia atrás. Mapea las fases de
> [03-roadmap.md](03-roadmap.md) a pasos concretos.

**Convención de cada step**: `objetivo · archivos · acciones · Done-when (✓)`.
**Regla de oro**: ningún step de superficie ([Fases 1–4](#fase-1)) empieza hasta que
[Fase 0](#fase-0) esté mergeada. Dentro de Fase 0, el orden es lineal.

> **Diseño**: cada step respeta [`docs/design`](../../design/savia-design-system.md)
> (la regla del lima, botones, superficies, highlight ink, voz) y su checklist §14.
>
> **Progreso**: ✅ **Fase 0 completa** (S0.1–S0.11). 🚧 **S1.1 Login hecho** (con
> aprendizajes ya en `docs/design`: form sobre ink, CTA lima sobre oscuro, journey de
> pasos, OTP responsive). S1.2 Onboarding en curso.

---

## Fase 0 — Fundaciones (bloqueante)

### S0.1 — Crear `@savia-os/design-tokens` (extraer, sin cambiar valores)
- **Objetivo**: fuente única del `system` de Chakra. Sin modificar ningún token aún.
- **Archivos**: nuevo `packages/design-tokens/{package.json,tsconfig.json,src/}`.
- **Acciones**:
  1. `package.json` → `name: "@savia-os/design-tokens"`, `exports` de `./` y `./system`;
     dep `@chakra-ui/react`, devDep `@savia-os/tsconfig`.
  2. **Mover** `tokens.ts`, `semantic-tokens.ts`, `text-styles.ts`, `index.ts` desde
     `apps/landing/src/theme/` a `packages/design-tokens/src/` (son idénticos a los del
     app — da igual de cuál se copien). `index.ts` exporta `system`, `tokens`,
     `semanticTokens`, `textStyles`.
  3. `tsconfig.json` extiende `@savia-os/tsconfig/base`.
- **Done-when ✓**: `pnpm --filter @savia-os/design-tokens build` (o typecheck) verde.

### S0.2 — Landing consume el paquete (red de seguridad)
- **Objetivo**: probar la extracción dejando la landing **idéntica**.
- **Archivos**: `apps/landing/package.json`, `apps/landing/src/components/ui/provider.tsx`,
  borrar `apps/landing/src/theme/*`.
- **Acciones**:
  1. Añadir dep `"@savia-os/design-tokens": "workspace:*"`.
  2. Reemplazar imports `@/theme` → `@savia-os/design-tokens`.
  3. **Borrar** `apps/landing/src/theme/`.
- **Done-when ✓**: `pnpm landing:build` verde **y** la landing se ve pixel-idéntica
  (comparar `/` antes/después). Si difiere → la extracción introdujo un cambio: revertir
  y reconciliar.

### S0.3 — Crear `@savia-os/ui` (átomos de marca)
- **Objetivo**: paquete de componentes de marca compartidos.
- **Archivos**: nuevo `packages/ui/`; mover desde landing: `savia-mark.tsx`,
  `animated-section.tsx` (`FadeInUp`), `savia-particles.tsx` + `.module.css`,
  `section-header.tsx`, `constants.ts` (`EASE_SAVIA`, `BRAND_COLORS`), `provider.tsx` base.
- **Acciones**:
  1. `package.json` → `name: "@savia-os/ui"`, deps `@savia-os/design-tokens`,
     `@chakra-ui/react`, `framer-motion`, `lucide-react`. Subpath exports
     (`./primitives`, `./brand`, `./provider`).
  2. Mover componentes; los que usan hooks/Framer mantienen `"use client"`.
  3. El `Provider` base centraliza `system` + `globalCss` + `Toaster` (este último en S0.9).
- **Done-when ✓**: `pnpm --filter @savia-os/ui typecheck` verde.

### S0.4 — Landing consume `@savia-os/ui`; borrar duplicados
- **Acciones**: dep `workspace:*`; reemplazar imports de los componentes movidos;
  borrar sus copias en `apps/landing`.
- **Done-when ✓**: `pnpm landing:build` verde, landing idéntica. **Fin de la extracción.**

### S0.5 — App consume los paquetes; borrar su `theme/`
- **Archivos**: `apps/app/package.json`, `apps/app/src/components/ui/provider.tsx`,
  borrar `apps/app/src/theme/*`.
- **Acciones**: deps `@savia-os/design-tokens` + `@savia-os/ui` (`workspace:*`);
  `provider.tsx` usa el `system`/`Provider` del paquete; borrar `apps/app/src/theme/`.
- **Done-when ✓**: `pnpm --filter @savia-os/app build` verde; app funciona idéntica.

### S0.6 — Guardrail de CI "tokens o nada"
- **Objetivo**: impedir que reaparezca la duplicación / el hex crudo.
- **Archivos**: `turbo.json` o script en CI; opcional regla ESLint.
- **Acciones**: check que falla si hay hex literal o color crudo de Chakra fuera de
  `packages/design-tokens`:
  ```
  grep -rE '#[0-9a-fA-F]{6}|\b(red|green|blue|orange|purple|teal|pink|cyan)\.[0-9]' \
       apps/*/src --include=*.tsx ; test $? -ne 0
  ```
- **Done-when ✓**: el check corre en CI y pasa (limpiando los hex existentes del app o
  marcándolos como deuda explícita a resolver en sus steps).

### S0.7 — Extender tokens (una sola vez, en el paquete)
- **Objetivo**: añadir lo que falta para el rediseño. Ambas apps lo reciben.
- **Archivos**: `packages/design-tokens/src/{tokens,semantic-tokens,text-styles}.ts`.
- **Acciones** (ver [01-foundations.md §1](01-foundations.md)):
  - `colors.spaceScale` (rampa ink→teal→lima, 6–8 pasos, AA garantizado).
  - `colorPalette` de estado: `success`, `warning`, `danger`, `info` + `status.*`.
  - `shadows.floatDark`; habilitar uso de `bg.inverse`/`fg.inverse`.
  - `textStyles`: `pageTitle`, `cardTitle`, `metric`, `caption`.
- **Done-when ✓**: typecheck verde; los nuevos tokens aparecen en `pnpm export:ds`.

### S0.8 — `space-colors.ts` (matar el arcoíris)
- **Archivos**: `apps/app/src/lib/space-colors.ts`.
- **Acciones**: `spaceColor(spaceId) → { fill, ink }` determinista por `spaceId`
  (no por índice), separación tipo golden-ratio sobre `spaceScale`, contraste AA.
- **Done-when ✓**: test unit: mismo `spaceId` → mismo color; reordenar lista no cambia colores.

### S0.9 — Primitivas genéricas en `@savia-os/ui`
- **Archivos**: `packages/ui/src/primitives/*`.
- **Acciones**: `Card` (flat/elevated/inverse), `Dialog` + `ConfirmDialog`
  (AnimatePresence, focus trap, Esc), `Toaster`/`useToast` (montar en Provider base),
  `EmptyState`, `Skeleton`/`CardSkeleton`, `Field` (label+error+aria), `StatusBadge`
  (consume `status.*`, ícono+texto).
- **Done-when ✓**: cada primitiva con story/preview mínima; typecheck verde; reduced-motion
  respetado en Dialog/Toaster.

### S0.10 — Primitivas de dominio en `apps/app`
- **Archivos**: `apps/app/src/components/ui/*`.
- **Acciones**: `PageHeader` (eyebrow+`pageTitle`+acción), `SpaceGlyph` (color+inicial,
  slot para miembros/propiedad — colectivos ya existen en backend), `OtpInput` (6 celdas),
  `CopyBlock` (feedback de copia + toast).
- **Done-when ✓**: typecheck verde; usables en aislamiento.

### S0.11 — App-shell + sidebar + página raíz
- **Archivos**: `apps/app/src/components/layout/AppNav.tsx` (→ sidebar),
  `apps/app/src/app/(app)/layout.tsx`, `apps/app/src/app/page.tsx`.
- **Acciones** (ver [01-foundations.md §4–5](01-foundations.md)): sidebar vertical
  colapsable con `SaviaMark`+wordmark, agrupación semántica (Tu memoria / Fuentes /
  IAs), activo con presencia (pill lima), menú de cuenta + logout con `ConfirmDialog`;
  drawer móvil con focus trap (`AnimatePresence`); página raíz → splash de marca.
- **Done-when ✓**: navegación funciona en desktop y móvil; logout pide confirmación;
  `axe` sin errores críticos en el shell.

> **Cierre Fase 0**: app y landing corren sobre el mismo design system compartido;
> existe la librería de primitivas; el shell tiene identidad. Las superficies se montan
> encima. **Criterios de aceptación**: [05 §7](05-shared-design-system.md) +
> [03 rúbrico](03-roadmap.md).

---

## Fase 1 — Puerta de entrada

### S1.1 — Login ✅ *hecho y validado*
- **Archivos**: `apps/app/src/app/(auth)/login/page.tsx`,
  `apps/app/src/components/auth/OtpForm.tsx`, `apps/app/src/components/ui/OtpInput.tsx`.
- **Construido** (la implementación final, que afinó la spec original a la dirección de
  `docs/design`): **split-panel** — lado claro con statement editorial, highlight ink en
  "conecta" y **journey de 3 pasos** (Entra → Reúne → Conecta, paso actual activo); lado
  oscuro con el **formulario directo sobre ink** (sin card), logo lima+wordmark, `OtpInput`
  de 6 celdas **responsive** (flex, sin overflow a 360px), errores en `dangerSoft`,
  reenvío con cooldown, CTA **lima sobre ink**, `FadeInUp`. Copy alineado al one-liner.
  Glow radial en vez de partículas. Una sola pantalla sin scroll.
- **Bug resuelto**: `OtpInput` pasaba `value.split("")` (array corto) → celdas vacías
  renderizaban "undefined"; se normaliza a array de largo 6.
- **Done-when ✓**: validado visualmente (desktop/tablet/móvil 360px), OTP sin
  "undefined", rúbrico [03](03-roadmap.md) + `docs/design` §14 cumplidos.

### S1.2 — Onboarding (secuencia cinematográfica)
- **Archivos**: `apps/app/src/app/(app)/onboarding/page.tsx`, `RescueStep.tsx`,
  `ImportStep.tsx`, `SuggestedSpaces.tsx`.
- **Acciones** ([02 §Onboarding](02-surfaces.md)): progreso por pasos numerados;
  rutas como cards con afordancia; dropzone con feedback de drag; animación "memoria
  encendiéndose" (recuerdos con `FadeInUp` staggered); `CopyBlock` para rescue;
  `SuggestedSpaces` con `SpaceGlyph` y edición evidente; **persistir estado** (localStorage);
  done con superficie ink.
- **Done-when ✓**: refresh no reinicia; cada sub-step con estados; rúbrico completo.

---

## Fase 2 — El corazón funcional

### S2.1 — Connections (el handshake + grants lectura/escritura)
- **Archivos**: `apps/app/src/components/connections/SpaceControlPanel.tsx`,
  `NewConnectionDialog.tsx`, `apps/app/src/lib/api.ts` (toggle de `canWrite`).
- **Acciones** ([02 §Connections](02-surfaces.md)): `NewConnectionDialog` sobre el
  primitivo `Dialog` con pasos 1·2·3 y `CopyBlock`; estado "tu IA está escuchando" con
  pulso lima a la primera llamada; matriz como `<table>` semántica con `SpaceGlyph` y
  **tri-estado por celda** (sin acceso → lectura → lectura+escritura, consumiendo
  `PATCH connections/:id/grants/:spaceId/write`, hoy ausente en la UI); buscador +
  acciones masivas; errores reales (revertir optimista + toast); revoke con
  `ConfirmDialog` de consecuencia.
- **Done-when ✓**: la matriz togglea lectura **y** escritura; navegable por teclado/lector;
  sin `confirm()`; rúbrico completo.

### S2.2 — Connect (MCP)
- **Archivos**: `apps/app/src/app/(app)/connect/page.tsx`, `McpConfigBlock.tsx`.
- **Acciones** ([02 §Connect](02-surfaces.md)): iconos de marca (simple-icons);
  `CopyBlock` por cliente + descarga JSON; cards de capacidades; CTA con tokens (no
  `blue`). Evaluar fusión con Connections.
- **Done-when ✓**: config copiable/descargable; cero colores crudos; rúbrico completo.

---

## Fase 3 — Contenido y memoria

### S3.1 — Drive
- **Archivos**: `apps/app/src/components/drive/{FileGrid,FileCard,UploadButton}.tsx`.
- **Acciones** ([02 §Drive](02-surfaces.md)): drag-and-drop con overlay; cola de subida
  con barra por archivo; `StatusBadge` (`status.*`) + retry en fallidos; borrar con
  `ConfirmDialog` + toast; `EmptyState`/`CardSkeleton`; sort/filtro; link archivo→memoria
  (recuerdos generados + space destino).
- **Done-when ✓**: subida multi-archivo visible; retry funciona; rúbrico completo.

### S3.2 — Spaces (con tipo, rol y modelo unificado)
- **Archivos**: `apps/app/src/components/spaces/{SpacesList,SpaceCard,SpaceForm,SpaceMemories}.tsx`.
- **Acciones** ([02 §Spaces](02-surfaces.md)): `SpaceCard` con `SpaceGlyph` + hover lift
  + expand `AnimatePresence`; **badge de propiedad** (privado/colectivo), **avatares de
  miembros** y `role` visibles, `isDefault` como hogar (datos ya en `SpaceDto`: `kind`,
  `role`, `isDefault`); `SpaceForm` en `Dialog` con validación en vivo (`Field`) + toast +
  flash lima; `SpaceMemories` con `homeSpaceId` + `otherSpaces` navegables y re-hogar
  según permiso; acciones respetan `role`; borrar con `ConfirmDialog`.
- **Done-when ✓**: tipo/rol/miembros visibles; permisos respetados en UI; sin `confirm()`;
  rúbrico completo.

### S3.2b — Colectivos (superficie nueva; backend ya implementado)
- **Archivos**: `apps/app/src/lib/api.ts` (**añadir** métodos de colectivo),
  `apps/app/src/components/collective/*` (nuevo), ruta de aceptar invitación.
- **Acciones** ([02 §Colectivos](02-surfaces.md)): extender `api.ts` con
  make-collective, from-personal (move/copy), invites (+accept), members (list/rol/quitar);
  wizard de convertir/promover en `Dialog` con consecuencia; **panel de miembros**
  (avatar, email, rol editable, quitar con `ConfirmDialog`); **invitar** (`Field` email +
  rol + `CopyBlock` del link); pantalla de **aceptar invitación** con marca; estados
  vacío/carga/error.
- **Done-when ✓**: flujo completo invitar→aceptar→gestionar roles funciona contra los
  endpoints existentes; permisos respetados; rúbrico completo.

### S3.3 — Dashboard tokenizado
- **Archivos**: `apps/app/src/app/(app)/dashboard/page.tsx`,
  `dashboard/{GrowthStats,GrowthChart,AccessActivity}.tsx`.
- **Acciones** ([02 §Dashboard](02-surfaces.md)): hero de memoria (superficie ink +
  `metric` + `SaviaParticles`); `GrowthStats` con `metric` y deltas `success`/`danger`;
  `GrowthChart` recoloreado con `spaceColor()`, ejes accesibles, animación de altura;
  `AccessActivity` con `SpaceGlyph` + pulso; todos los estados (`EmptyState`/`CardSkeleton`).
  *(El mapa de memoria es S3.4.)*
- **Done-when ✓**: cero arcoíris/hex; estados completos; rúbrico completo.

### S3.4 — Mapa de memoria V1 (el momento wow)
- **Archivos**: `apps/app/src/components/dashboard/memory-map/*`,
  `apps/app/src/lib/pack-layout.ts`; reemplaza `AreasOverview` en `dashboard/page.tsx`.
- **Acciones** ([04-memory-map.md §13–14](04-memory-map.md)): `d3-hierarchy.pack()` +
  SVG + Framer; `MemoryMap`/`MemoryCanvas`/`MemoryCell`/`MarkPulse`/`MemoryPeek`/
  `MemoryList`/`MemoryEmpty`; color por `spaceColor`; tamaño ∝ `sqrt(count)`; tipografía
  adaptativa; marca latiendo + partículas; entrada creciendo desde 0; hover lift+atenuar;
  peek nombre/count/share; capa accesible (lista semántica + teclado); reduced-motion;
  layout determinista.
- **Done-when ✓**: [04 §15 criterios de aceptación](04-memory-map.md) completos; test
  "qué lindo, qué es eso"; 60 FPS con ~30 celdas.

---

## Fase 4 — Pulido y firma

### S4.1 — Mapa de memoria fast-follow
- **Acciones** ([04 §14](04-memory-map.md)): peek con recuerdos de ejemplo (requiere
  endpoint de muestreo — coordinar con plan funcional); crecimiento en vivo por delta;
  modo retrato + exportar imagen; selección que filtra el `GrowthChart`.
- **Done-when ✓**: exportar PNG funciona; ejemplos reales en peek.

### S4.2 — Auditoría de motion y reduced-motion end-to-end
- **Acciones**: revisar toda animación contra `prefers-reduced-motion`; curvas =
  `EASE_SAVIA`; ninguna animación bloquea interacción.
- **Done-when ✓**: con reduced-motion activo, cero movimiento; UX intacta.

### S4.3 — Pasada de accesibilidad
- **Acciones**: `axe` por pantalla; `aria-label` en todo icon-button; foco visible;
  navegación por teclado completa; sin info solo-por-color.
- **Done-when ✓**: `axe` sin errores críticos en las 10 superficies.

### S4.4 — Pasada responsive
- **Acciones**: probar 320px → desktop en cada pantalla; drawer móvil; modales y mapa
  responsive; targets ≥44px.
- **Done-when ✓**: ninguna pantalla rota o con scroll horizontal en 320px.

---

## Tabla de dependencias

| Step | Depende de | Puede ir en paralelo con |
|------|-----------|--------------------------|
| S0.1 → S0.6 | lineal (extracción) | — |
| S0.7 → S0.11 | S0.6 | S0.8/S0.9/S0.10 entre sí (parcial) |
| Fase 1 (S1.x) | Fase 0 completa | Fase 2, 3 |
| Fase 2 (S2.x) | Fase 0 | Fase 1, 3 |
| Fase 3.1–3.3 | Fase 0 | Fase 1, 2 |
| S3.2b (colectivos) | S0.9/S0.10 (Dialog, Field, SpaceGlyph), S3.2 | S3.1, S3.3 |
| S3.4 (mapa V1) | S0.7 (`spaceScale`), S0.8, S3.3 | — |
| Fase 4 | la superficie correspondiente | — |

**Camino crítico**: S0.1→S0.6 (extracción lineal) → S0.7 (tokens) → S0.8 → S3.3 → S3.4
(el wow). Todo lo demás cuelga de Fase 0 y paraleliza.

---

## Checklist maestro

```
Fase 0 — Fundaciones ✅
  [x] S0.1  @savia-os/design-tokens (extraer)
  [x] S0.2  Landing consume tokens (idéntica)
  [x] S0.3  @savia-os/ui (átomos de marca)
  [x] S0.4  Landing consume ui; borrar duplicados
  [x] S0.5  App consume paquetes; borrar theme/
  [x] S0.6  Guardrail CI "tokens o nada"
  [x] S0.7  Extender tokens (spaceScale, estados, textStyles, dangerSoft)
  [x] S0.8  space-colors.ts
  [x] S0.9  Primitivas genéricas (@savia-os/ui)
  [x] S0.10 Primitivas de dominio (apps/app) + PageHero/HeroEm
  [x] S0.11 Shell + sidebar + splash
Fase 1 — Puerta de entrada
  [x] S1.1  Login (split-panel, form oscuro, highlight ink, journey, OTP responsive)
  [ ] S1.2  Onboarding (en curso)
Fase 2 — Corazón funcional
  [ ] S2.1  Connections (handshake)
  [ ] S2.2  Connect (MCP)
Fase 3 — Contenido y memoria
  [ ] S3.1  Drive
  [ ] S3.2  Spaces (tipo/rol/miembros, modelo unificado)
  [ ] S3.2b Colectivos (api.ts + invitar/aceptar/miembros) ← backend listo
  [ ] S3.3  Dashboard tokenizado
  [ ] S3.4  Mapa de memoria V1  ← wow
Fase 4 — Pulido y firma
  [ ] S4.1  Mapa fast-follow
  [ ] S4.2  Auditoría de motion
  [ ] S4.3  Accesibilidad
  [ ] S4.4  Responsive
```
