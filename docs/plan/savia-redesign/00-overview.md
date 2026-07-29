# Savia App — Rediseño UI/UX

> Plan maestro del rediseño de la interfaz del producto (`apps/app`). Léelo antes
> de cualquier cambio visual. Hermano del plan funcional en
> [`docs/plan/savia-mvp/`](../savia-mvp/00-overview.md): aquel define **qué hace**
> el producto; este define **cómo se ve y se siente**.
>
> 🎨 **El cómo-se-ve lo gobierna [`docs/design/savia-design-system.md`](../../design/savia-design-system.md)**
> (la guía canónica de diseño). Este plan define el *qué* y el *orden*.
>
> 📍 **Estado**: Fase 0 (fundaciones) ✅ completa · Login ✅ hecho · Onboarding 🚧 ·
> resto ⏳. Detalle en [03-roadmap.md → Estado de avance](03-roadmap.md#estado-de-avance).
>
> 🏢 **Dirección de producto actual: B2B** (Savia como el cerebro ejecutable de cada
> empresa — ver [`docs/product/savia-b2b/01-vision.md`](../../product/savia-b2b/01-vision.md)). Las
> pantallas de este plan (`apps/app` de hoy) son la capa de memoria personal, el wedge
> bottom-up hacia el cerebro organizacional — no asumas que el usuario individual es
> el destino final al proponer superficies nuevas.

## TL;DR

El MVP funciona pero **no se siente Savia**. Heredó los design tokens de la marca
(`ink`, `paper`, `signalLime`) pero los aplica como un template SaaS genérico:
superficies planas, tipografía de sistema, cero motion, cero elementos de firma.
La landing —misma paleta— se siente premium, atmosférica y con identidad. **El
producto debe heredar ese lenguaje, no solo sus colores.**

Este plan cierra esa brecha en tres frentes:

1. **Fundaciones** — extender el theme del app con motion, superficies, primitivas
   reutilizables (Card, Dialog, Toast, EmptyState, Skeleton) y un app-shell con
   identidad. → [01-foundations.md](01-foundations.md)
2. **Superficies** — rediseño pantalla por pantalla, de login a dashboard.
   → [02-surfaces.md](02-surfaces.md)
3. **Ejecución** — fases, orden de dependencias y criterios de aceptación.
   → [03-roadmap.md](03-roadmap.md)

---

## Diagnóstico: por qué se siente "SaaS sin pensar"

Auditamos las 10 superficies del app (`apps/app/src`). El patrón es consistente y
el problema es **sistémico, no cosmético**. Cinco causas raíz:

### 1. La marca se quedó en la landing

Savia tiene un lenguaje visual distintivo y documentado
([`apps/landing/CLAUDE.md`](../../../apps/landing/CLAUDE.md), `design-system-preview/`):
lima eléctrico sobre ink profundo, tipografía display peso 300 con palabra-énfasis
700, la **marca geométrica de 4 pliegues** (`SaviaMark`), **partículas**
atmosféricas flotantes (`SaviaParticles`), curva de easing propia
(`EASE_SAVIA = [0.22, 1, 0.36, 1]`), eyebrows en mayúsculas, superficies ink
oscuras para puntuar el ritmo.

**El app no usa ni uno solo de estos elementos.** La nav dice `savia` en `fontSize="sm"`
en vez del `SaviaMark`. No hay una sola animación Framer. No hay un solo display
heading. El acento lima solo aparece, tímidamente, en un par de botones. El
resultado: la marca termina en `/login` y nunca entra al producto.

### 2. Los tokens existen pero se evaden

[`tokens.ts`](../../../apps/app/src/theme/tokens.ts) define `radii.card`,
`shadows.soft/float`, `textStyles.displayMd`, `easings.savia`, `durations.*` —
**y casi nada de eso se usa.** En su lugar:

- Charts con paleta arcoíris de Chakra hardcodeada
  ([`GrowthChart.tsx:18`](../../../apps/app/src/components/dashboard/GrowthChart.tsx):
  `#4299e1, #9f7aea, #38b2ac…`; [`AreasOverview.tsx`](../../../apps/app/src/components/dashboard/AreasOverview.tsx):
  `blue, purple, teal, orange…`). Rompen la paleta de marca y se ven como Bootstrap.
- Errores en `color="red.500"`, éxitos en `green.600`, processing en `orange.500` —
  defaults de Chakra, no tokens semánticos.
- Headings en `fontSize="2xl" fontWeight="800"` en vez de `textStyle="displayMd"`.
- Sombras `borderRadius="xl"` planas en vez de `shadows.soft` + `radii.card`.

### 3. Cero capa de feedback y estado

- **Diálogos de confirmación con `window.confirm()` nativo** en borrados de spaces,
  files, conexiones y revokes. Rompe el sistema de diseño en su momento más crítico
  (acciones destructivas).
- **Sin toasts.** Crear un space, subir un archivo, copiar config, revocar acceso:
  todo ocurre en silencio o con texto inline fácil de perder.
- **Sólo `<Spinner/>`** como estado de carga, nunca skeletons. Cada pantalla
  parpadea de spinner centrado a contenido.
- **Estados vacíos inconsistentes**: unos con card de borde punteado, otros con
  texto plano gris, otros inexistentes (el dashboard simplemente no renderiza
  secciones sin datos).

### 4. El app-shell no tiene jerarquía ni hogar

[`AppNav.tsx`](../../../apps/app/src/components/layout/AppNav.tsx): seis ítems
planos en una fila, iconos 16px + texto, logout perdido a la derecha. **Sin
logo de marca, sin agrupación (contenido vs. administración), sin menú móvil**
(los ítems harían wrap en pantallas chicas), sin indicación de en qué sección
estás más allá de un cambio de color sutil. El layout es un `maxW="1280px"`
centrado sobre `bg.subtle` — correcto, pero anónimo.

### 5. Accesibilidad y responsive como afterthought

Botones de solo-icono sin `aria-label`, inputs de OTP sin `<label>`, matriz de
conexiones que no es `<table>` (invisible para lectores de pantalla), estados
comunicados solo por color (verde=concedido), sin focus rings visibles, targets
táctiles por debajo de 44px, modales de ancho fijo que desbordan en móvil. La
landing ya resolvió todo esto (focus trap, `prefers-reduced-motion`, HTML
semántico) — el app no heredó ninguna de esas prácticas.

### 6. La UI quedó atrás del backend — los colectivos ya existen y no se ven

El plan funcional ([`savia-mvp`](../savia-mvp/00-overview.md)) está implementado
**hasta el step 16 inclusive**: la unificación de spaces ([14](../savia-mvp/14-spaces-unification.md)),
la frontera limpia ([15](../savia-mvp/15-frontier-hardening.md)) y los **spaces
colectivos** ([16](../savia-mvp/16-collective-spaces.md)) están en producción en el
backend. Los contratos ([`packages/contracts/src/spaces.ts`](../../../packages/contracts/src/spaces.ts))
ya exponen `kind` (private/collective), `role` (viewer/contributor/admin), `isDefault`
(el space "General"), miembros, invitaciones, promoción (move/copy) y grants con
`canWrite` (lectura **y** escritura).

**El frontend no expone nada de esto.** El `api.ts` del app no tiene un solo método
de colectivo; `SpaceCard`/`SpacesList` no conocen `kind`, `role` ni miembros; la
matriz de conexiones solo togglea lectura, ignorando `canWrite`. Es decir: **el
rediseño no es solo cosmético — debe cerrar la brecha funcional con un backend que
ya soporta colaboración.** Los colectivos dejan de ser "anticipar" y pasan a ser
**superficie de primera clase** del rediseño (ver [02-surfaces.md](02-surfaces.md)).

---

## Visión: "tu memoria, viva"

Savia no es un gestor de archivos ni un panel de admin. Es **la memoria que
conecta todas tus IAs** — algo que crece, se organiza solo y vive entre el usuario
y sus modelos. El producto debe **sentirse vivo y personal**, no transaccional.

Tres adjetivos guía para cada decisión de diseño:

| Adjetivo | Significa | Anti-patrón a matar |
|----------|-----------|---------------------|
| **Vivo** | Motion con propósito, datos que respiran, superficies con profundidad | Tablas estáticas, spinners, saltos de layout |
| **Calmo** | Jerarquía clara, espacio generoso, una acción primaria por pantalla | Densidad de info, 8 colores compitiendo, todo al mismo peso |
| **Tuyo** | Lenguaje en primera persona, áreas de memoria como retrato del usuario | "Dashboard", "items", copy de plantilla |

### Los momentos "wow" (señales de firma)

El rediseño no es solo prolijidad: necesita **3–4 momentos memorables** que solo
Savia tiene. Estos son los candidatos, en orden de impacto/esfuerzo:

1. **El mapa de tu memoria** — reemplazar el dashboard de barras genéricas por una
   visualización orgánica de tus *spaces* como un organismo: celdas/burbujas
   dimensionadas por volumen de recuerdos, con la marca de 4 pliegues latiendo en
   el centro y partículas sutiles. Es el retrato del usuario; debe dar orgullo
   compartirlo. **Es EL momento wow** — spec completo y detallado en
   [04-memory-map.md](04-memory-map.md).
2. **Onboarding cinematográfico** — el primer contacto. Hoy es un wizard de barras.
   Debe ser una secuencia guiada con `FadeInUp`, partículas de fondo, la
   memoria "encendiéndose" recuerdo a recuerdo cuando se importa. Primer "wow".
3. **El handshake de conexión** — conectar una IA es el corazón del producto.
   Hoy es un modal de 3 pasos con `<pre>`. Debe sentirse como emparejar un
   dispositivo: copia con feedback claro, estado "tu IA está escuchando" en vivo,
   pulso lima cuando llega la primera llamada (ya existe la animación de pulso en
   la landing).
4. **Login con presencia** — la marca, partículas atmosféricas, un input de OTP de
   6 celdas (no un campo con `letter-spacing`). Tres segundos, pero marcan el tono.

### Principios de diseño (el rúbrico)

Cada PR de UI se evalúa contra esto:

- **Tokens o nada.** Cero hex hardcodeado, cero colores de Chakra crudos. Si falta
  un token (p. ej. colores de estado, paleta de spaces), se añade al theme primero.
- **Una jerarquía tipográfica.** `displayMd` para títulos de página, `titleLg` para
  secciones, `bodyLg`/`md` para cuerpo, `label` para eyebrows. Nada de `fontSize`
  arbitrario.
- **Motion con propósito y opcional.** `EASE_SAVIA`, `FadeInUp` en entradas,
  micro-interacciones en hover/éxito. Siempre respeta `prefers-reduced-motion`.
- **Todo estado tiene diseño.** Loading (skeleton), vacío (con CTA), error (con
  recuperación), éxito (toast). Ninguno se deja al azar.
- **Móvil y teclado primero.** Nav con drawer, modales responsive, targets ≥44px,
  focus visible, `aria-label` en todo icono, HTML semántico.
- **Voz Savia.** Español premium, primera persona ("tu memoria", "tus IAs"). Sin
  metáforas de plantas. Léxico de [`CLAUDE.md`](../../../apps/landing/CLAUDE.md#copy).

---

## Qué se reutiliza de la landing (no reinventar)

La landing ya resolvió la mitad del trabajo. Portamos, no recreamos:

| Asset landing | Ruta | Uso en el app |
|---------------|------|---------------|
| `SaviaMark` | [`design-system/savia-mark.tsx`](../../../apps/landing/src/components/design-system/savia-mark.tsx) | Logo de nav, loaders, centro del mapa de memoria |
| `FadeInUp` | [`ui/animated-section.tsx`](../../../apps/landing/src/components/ui/animated-section.tsx) | Entradas de página y secciones |
| `SaviaParticles` | `landing/savia-particles.tsx` | Fondo atmosférico de login, onboarding y mapa de memoria |
| Patrón pulso lima | `how-it-works.module.css` | "Primera llamada recibida" en conexiones |
| `EASE_SAVIA`, `BRAND_COLORS` | `lib/constants.ts` | Constantes de marca (portar a `apps/app/src/lib`) |
| `SectionHeader` (eyebrow+título) | `ui/section-header.tsx` | Encabezados de sección dentro del app |

> **Decidido**: hoy el theme está **duplicado byte por byte** entre las dos apps. El
> rediseño lo corrige extrayendo el lenguaje de diseño a paquetes compartidos —
> `@savia-os/design-tokens` (el `system` de Chakra) y `@savia-os/ui` (átomos de marca y
> primitivas) — consumidos por `apps/app` y `apps/landing` vía `workspace:*`. La
> estandarización y el DRY transversales se detallan en
> [05-shared-design-system.md](05-shared-design-system.md).

---

## Alcance

**Incluye**: las 10 superficies de `apps/app` (shell, login, dashboard, spaces,
connections, drive, connect, onboarding, página raíz), el theme del app, la librería
de primitivas, y —nuevo, por el estado del backend— **exponer en la UI las features
colectivas ya implementadas** (steps [14–16](../savia-mvp/14-spaces-unification.md)):
`kind` private/collective, roles, miembros, invitaciones, promoción de space, y grants
de lectura/escritura. El frontend `api.ts` se extiende con esos métodos (consumo de
endpoints existentes, sin cambios de backend).

**No incluye**: cambios de backend/contratos (ya están; solo se consumen), la landing
salvo la extracción del design system compartido ([05](05-shared-design-system.md)), y
features funcionales nuevas más allá de exponer lo que el backend ya ofrece.

## Mapa de documentos

| Doc | Contenido |
|-----|-----------|
| [00-overview.md](00-overview.md) | Este. Diagnóstico, visión, principios, momentos wow. |
| [01-foundations.md](01-foundations.md) | Theme extendido, motion, librería de primitivas, app-shell. |
| [02-surfaces.md](02-surfaces.md) | Rediseño pantalla por pantalla con specs concretas. |
| [03-roadmap.md](03-roadmap.md) | Fases, dependencias, criterios de aceptación, riesgos. |
| [04-memory-map.md](04-memory-map.md) | **El momento wow.** Spec completo del mapa de memoria orgánico. |
| [05-shared-design-system.md](05-shared-design-system.md) | **DRY entre app y landing.** Arquitectura de paquetes compartidos y cómo se garantiza. |

> **Guía canónica de diseño:** las reglas visuales de Savia (la regla del lima,
> contraste dramático, botones, highlight ink, voz, etc.) viven en
> [`docs/design/savia-design-system.md`](../../design/savia-design-system.md) —
> léela antes de diseñar o construir cualquier UI.
