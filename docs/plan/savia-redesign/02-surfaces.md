# 02 — Rediseño por superficie

> Specs concretas pantalla por pantalla. Cada una asume las
> [fundaciones](01-foundations.md) ya en su lugar (primitivas, tokens de estado,
> motion). El formato: **qué hay hoy → qué cambia → momento de firma**.
>
> ⚠️ **El tratamiento visual lo gobierna [`docs/design`](../../design/savia-design-system.md).**
> Estas specs describen **estructura y comportamiento** de cada pantalla; el **color,
> los botones y el lima** siguen la guía. En particular: donde abajo se mencione "botón
> lima", "pulso lima" o acentos lima, aplica la **regla del lima** (solo sobre oscuro)
> — un CTA lima vive sobre un panel/superficie ink, no sobre claro.

**Estado**: ✅ Login hecho · 🚧 Onboarding en curso · ⏳ resto pendiente.

Orden por impacto en la primera impresión: Login → Onboarding → Dashboard →
Connections → Connect → Drive → Spaces.

---

## Login ✅ *hecho*

> La spec de abajo fue la intención inicial; la **implementación final** (split-panel,
> form sobre ink, journey de pasos, highlight ink) está en
> [06 §S1.1](06-execution.md#s11--login--hecho-y-validado) y gobernada por `docs/design`.
> Lo que sigue se conserva como contexto del *antes*.

**Hoy** ([`login/page.tsx`](../../../apps/app/src/app/\(auth\)/login/page.tsx),
[`OtpForm.tsx`](../../../apps/app/src/components/auth/OtpForm.tsx)): card centrada
genérica, input de email, código en un campo con `letterSpacing="0.35em"`, errores
en `red.500`, sin labels.

**Cambia**:
- Fondo: ink (`bg.inverse`) o paper con `SaviaParticles` sutiles. La
  marca presente: `SaviaMark` grande + wordmark + one-liner "La memoria que conecta
  todas tus IAs".
- `OtpInput` de 6 celdas (primitivo nuevo): auto-advance, paste de código completo,
  teclado numérico, foco visible.
- `Field` con label real ("Tu email"), error con `colorPalette="danger"` + ícono.
- Estados: botón con loading real, reenvío con cooldown visible ("Reenviar en 0:42"),
  éxito → transición suave al app (no redirect seco).
- `FadeInUp` en la entrada de la card.

**Firma**: tres segundos, pero establecen "esto es premium". La marca te recibe.

---

## Onboarding

**Hoy** ([`onboarding/page.tsx`](../../../apps/app/src/app/\(app\)/onboarding/page.tsx),
+ `RescueStep`, `ImportStep`, `SuggestedSpaces`): wizard de 4 pasos, barra de
progreso horizontal de colores, cajas clickeables poco evidentes, `<pre>` chico
para el prompt, sin estado persistido (refresh = reinicio).

**Cambia** — es el **primer "wow"**, tratarlo como una secuencia cinematográfica:
- **Progreso** como pasos numerados con conector animado, no barras de color.
- **Welcome**: pantalla con `SaviaParticles`, marca, y dos rutas (`RescueStep` /
  `ImportStep`) como cards grandes con `SpaceGlyph`/iconos, hover lift, recomendado
  con badge lima. Afordancia clara de "clickeable".
- **Import**: dropzone con feedback de drag real (borde lima al arrastrar), y al
  procesar, **animación de "la memoria encendiéndose"**: recuerdos apareciendo uno
  a uno (`FadeInUp` staggered) en vez de "Procesando…".
- **Rescue**: el prompt en `CopyBlock` (copia con toast), textarea con altura
  responsive, resultado celebrado ("✨ 47 recuerdos creados").
- **SuggestedSpaces**: cada sugerencia como card con `SpaceGlyph` de color, nombre
  editable evidente (no input fantasma), ejemplos expandibles, accept/reject con
  estado visual claro. Footer con CTA primaria grande.
- **Persistir estado** en `localStorage` o query param: refresh no reinicia.
- **Done**: pantalla de celebración con superficie ink, las próximas acciones
  ("Conecta tu primera IA") como cards grandes, no botones chicos.

**Firma**: ver tu memoria materializarse desde tus chats viejos. El momento "ajá".

---

## Dashboard — "el mapa de tu memoria"

**Hoy** ([`dashboard/page.tsx`](../../../apps/app/src/app/\(app\)/dashboard/page.tsx)
+ `GrowthStats`, `AreasOverview`, `GrowthChart`, `AccessActivity`): título
`fontSize="2xl" fontWeight="800"`, 3 stat cards, barra apilada + leyenda redundante,
chart SVG con paleta arcoíris hardcodeada, lista de actividad. Sin estados vacíos
(secciones desaparecen sin datos).

**Cambia** — es el **retrato del usuario y el principal momento de firma**:

- **Hero de memoria**: superficie ink con `pageTitle` "Tu memoria", el total de
  recuerdos como `metric` grande, y un sub-texto en primera persona. `SaviaParticles`
  de fondo.
- **El mapa de memoria** (reemplaza `AreasOverview` + leyenda): el momento wow del
  producto. Visualización orgánica de spaces como celdas/burbujas dimensionadas por
  volumen, en la familia tonal de marca, con la `SaviaMark` latiendo. **Spec completo
  y detallado — algoritmo de layout, color, motion, interacción, estados, a11y y plan
  técnico — en [04-memory-map.md](04-memory-map.md).**
- **GrowthStats**: stat cards con `textStyle="metric"`, deltas con `success`/`danger`
  semánticos (no `green.500`/`red.400`), íconos de tendencia, sparkline opcional.
- **GrowthChart**: misma data, pero colores de `spaceColor()`, ejes accesibles
  (ARIA, no solo posición en px), toggle día/semana como segmented control claro,
  animación de altura al montar. Considerar reemplazar el SVG a mano por barras
  tokenizadas consistentes con el mapa.
- **AccessActivity**: "tus IAs conectadas" con `SpaceGlyph`/avatar por IA, estado
  vivo (último visto humanizado ya existe), pulso lima en actividad reciente.
- **Todos los estados**: vacío con `EmptyState` (CTA a onboarding), carga con
  `CardSkeleton` (no spinner), no más secciones que desaparecen.

**Firma**: el mapa. Único de Savia, orgánico, tuyo.

---

## Connections — "solo conectar"

> **Decisión de IA (del usuario):** la conexión **solo conecta** — los permisos
> (qué IA ve qué memoria) **se gestionan desde Spaces**, no aquí. Mentalmente: decides
> "¿quién ve *esta* memoria?" parado en el space, no en una matriz de conexiones.

**Hoy**: matriz spaces×conexiones de pills, modal de 3 pasos, `confirm()` para revoke.

**Cambia** — ✅ *hecho*:
- **NewConnectionDialog** → primitivo `Dialog`, 2 pasos (nombre → config MCP con
  `McpConfigBlock`), `notify` al crear, hint de que el acceso se concede desde Spaces.
  **Sin** checklist de grants.
- **Panel** → solo lista de conexiones: `Card` con label, último visto humanizado,
  chips read-only de los spaces que ya ve (`SpaceGlyph`), y revoke con `ConfirmDialog`.
  `EmptyState`/`CardSkeleton`. **Sin** matriz de permisos.
- **Los permisos viven en Spaces** (ver §Spaces): el toggle "¿qué IAs ven este space?".
- *Fast-follow*: estado "tu IA está escuchando" + **pulso lima** a la primera llamada;
  grants de **escritura** (requiere exponer `canWrite` en el backend — ver nota abajo).

> **Nota de datos (write grants)**: el backend tiene `PATCH .../grants/:spaceId/write`
> pero `connections.findAll` hace `select: { spaceId: true }` y `ConnectionDtoSchema`
> solo expone `spaceIds` — **la lista no devuelve `canWrite`**, así que la UI no puede
> mostrar lectura vs escritura. Exponerlo NO es presentación-pura: requiere `select`
> con `canWrite` + campo en el contrato. Pendiente de decidir.

**Firma**: el pulso de la primera llamada. "Funcionó, mi IA ya recuerda."

---

## Connect (MCP)

**Hoy** ([`connect/page.tsx`](../../../apps/app/src/app/\(app\)/connect/page.tsx),
[`McpConfigBlock.tsx`](../../../apps/app/src/components/connect/McpConfigBlock.tsx)):
página estática con iconos emoji, features en texto, CTA en caja azul (`blue`
hardcodeado), config en `<pre>` sin resaltar.

**Cambia**:
- Iconos de marca reales (Claude/Cursor con `simple-icons` como la landing), no emoji.
- Guía paso a paso con `CopyBlock` por cliente, config tokenizada/resaltada, botón
  de descarga del JSON.
- "Qué puede hacer tu IA" como cards con `SpaceGlyph`/iconos consistentes.
- CTA con tokens de marca (lima/ink), no `blue`.
- Idealmente fundir Connect + Connections en un solo flujo coherente (hoy se solapan).

---

## Drive

**Hoy** ([`FileGrid.tsx`](../../../apps/app/src/components/drive/FileGrid.tsx),
[`FileCard.tsx`](../../../apps/app/src/components/drive/FileCard.tsx),
[`UploadButton.tsx`](../../../apps/app/src/components/drive/UploadButton.tsx)):
grid de cards, estado de archivo con colores Chakra crudos, upload solo por click
con `%` en el botón, `confirm()` para borrar, sin drag-and-drop, sin retry.

**Cambia**:
- **Drag-and-drop** sobre todo el grid con overlay de marca al arrastrar.
- **Cola de subida** visible: barra de progreso por archivo, no solo `%` en botón.
- `FileCard` con `StatusBadge` (`status.*`, ícono+texto), thumbnail por tipo,
  **retry** en fallidos, hover lift.
- Borrado con `ConfirmDialog`, éxito con toast.
- `EmptyState` con CTA clara; `CardSkeleton` en carga.
- Sort/filtro (nombre, fecha, estado) y toggle grid/lista si hay volumen.
- **Encadenar al onboarding del concepto**: el Drive debe dejar claro que "archivo →
  memoria" (insight de las dos capas del [overview MVP](../savia-mvp/00-overview.md)):
  mostrar cuántos recuerdos generó cada archivo, link al space donde aterrizaron.

---

## Spaces

**Hoy** ([`SpacesList.tsx`](../../../apps/app/src/components/spaces/SpacesList.tsx),
`SpaceCard`, `SpaceForm`, `SpaceMemories`): grid de cards, form siempre visible,
validación tardía, `confirm()` para borrar, badges de versión confusos, memorias
sin paginar, `confirm()` nativo.

> **El backend ya soporta colectivos** (step [16](../savia-mvp/16-collective-spaces.md)):
> el contrato `SpaceDto` trae `kind` (private/collective), `role` (viewer/contributor/
> admin) e `isDefault`. El frontend hoy lo ignora. Esta superficie **debe exponerlo**.

**Cambia**:
- 🔑 **Aquí viven los permisos** (decisión de IA): cada space gestiona **"¿qué IAs
  pueden ver esta memoria?"** — un toggle por conexión (consume `addGrant`/`removeGrant`
  con `spaceId` desde el lado del space). Es el hogar mental de los permisos; Connections
  solo conecta. (Grants de escritura: pendiente de exponer `canWrite` en backend.)
- `SpaceCard` con `SpaceGlyph` de color (de `spaceScale`), `cardTitle`, conteo como
  `metric` chico, hover lift, expand suave (`AnimatePresence`) para `SpaceMemories`.
- **Tipo y rol visibles**: badge de propiedad (privado vs **colectivo**) y, en
  colectivos, **stack de avatares de miembros** + tu `role`. El space `isDefault`
  ("General") se marca como tu hogar de memoria.
- `SpaceForm` en `Dialog` (no siempre visible); validación en vivo con `Field`;
  éxito → toast + el nuevo space hace flash lima al aparecer.
- Quitar/explicar el badge de versión (hoy sin contexto).
- `SpaceMemories` paginado/virtualizado, texto completo en hover/expand, `homeSpaceId`
  marcado y "otros spaces" (`otherSpaces`) como links navegables. Acción de re-hogar
  (mover memoria de space) si el `role` lo permite.
- Borrado con `ConfirmDialog`.
- **Acciones por permiso**: contributor escribe, viewer solo lee, admin gestiona. La
  UI **respeta `role`** — oculta/deshabilita lo no permitido (no es frontera de
  seguridad —el backend lo es— pero sí la UX correcta).

---

## Colectivos (superficie nueva — backend ya implementado)

**Hoy**: **no existe en el frontend**, pese a que el backend expone toda la API
([`collective.controller`](../../../apps/api/src/modules/collective/collective.controller.ts),
contratos en [`spaces.ts`](../../../packages/contracts/src/spaces.ts)). El `api.ts`
del app no tiene estos métodos — hay que **añadirlos** (consumo, sin tocar backend).

**Se crea** — el detalle de gestión de un space colectivo, accesible desde `SpaceCard`:
- **Convertir a colectivo** (`POST spaces/:id/make-collective`) y **promover desde
  personal** (`POST spaces/from-personal`, modo move/copy) — wizard en `Dialog` que
  explica la consecuencia (mover vs copiar memorias).
- **Panel de miembros** (`GET/PATCH/DELETE spaces/:id/members/...`): lista con avatar,
  email, `role`; cambiar rol (viewer/contributor/admin); quitar miembro — todo con
  `ConfirmDialog` en acciones destructivas y respetando permisos.
- **Invitaciones** (`POST spaces/:id/invites`): `Field` de email + selector de rol,
  link/token para compartir vía `CopyBlock`; pantalla de **aceptar invitación**
  (`POST invites/:token/accept`) con presencia de marca.
- **Estados**: vacío ("aún sin miembros, invita a alguien"), carga, error — todos
  diseñados.

**Firma**: ver tu memoria volverse compartida — el primer colaborador entrando a un
space que era solo tuyo.

---

## Patrones transversales (aplican a todas)

- **Contenedores**: unificar anchos. Hoy conviven `maxW="800px"`, `640px`, `1280px`
  sin criterio. Usar los tokens `sizes.container*` del theme.
- **Encabezado de página**: todas usan `PageHeader` (eyebrow + `pageTitle` + acción).
- **Estados**: toda fetch tiene skeleton / empty / error con `EmptyState`/`Toaster`.
- **Accesibilidad**: `aria-label` en todo icon-button, `Field` con labels, focus
  visible, `<table>` semántica en la matriz, estados con ícono+texto no solo color.
- **Voz**: primera persona, español premium, sin metáforas de plantas.
