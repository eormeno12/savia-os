# 03 — Ejecución, fases y aceptación

> Cómo aterrizar el rediseño sin romper el MVP en vuelo. Léelo después de
> [01-foundations.md](01-foundations.md) y [02-surfaces.md](02-surfaces.md).
>
> **El lenguaje visual lo gobierna [`docs/design/savia-design-system.md`](../../design/savia-design-system.md)**
> (la regla del lima, contraste dramático, botones, highlight ink, voz). Este plan
> define **qué** construir y en qué orden; la guía define **cómo se ve**. Ante un
> conflicto, manda la guía de diseño.

## Estado de avance

| Hito | Estado |
|------|--------|
| **Fase 0 — Fundaciones** (paquetes, tokens, primitivas, shell) | ✅ **Completada y verificada** (build + typecheck verdes, landing idéntica, guardrail activo). |
| **Lenguaje de diseño "Contraste dramático"** | ✅ **Codificado** en [`docs/design`](../../design/savia-design-system.md) tras iterarlo en el login. |
| **S1.1 — Login** | ✅ **Hecho y validado** (split-panel, form oscuro, highlight ink, journey de pasos, OTP responsive, copy alineado al one-liner). |
| **S1.2 — Onboarding** | 🚧 En curso (welcome/rescue/done alineados a la dirección; falta re-validar el flujo completo). |
| **Fases 2–4** | ⏳ Pendientes — a construir sobre las fundaciones, gobernadas por `docs/design`. |

> Aprendizaje clave de Fase 1, ya incorporado a la guía: **el lima solo vive sobre
> oscuro**; los CTAs primarios (lima-fill + ink) se alojan en superficies ink; en
> claro el primario es ink. Esto reescribe cualquier mención previa de "botón lima
> sobre claro" en los docs de superficies — manda `docs/design`.

## Principio de secuencia

**Fundaciones primero, superficies después.** Cada superficie del [doc 02](02-surfaces.md)
depende de las primitivas del [doc 01](01-foundations.md). Construir una pantalla
antes que sus primitivas garantiza reescribirla. El orden no es negociable:

```
Fase 0 (theme + primitivas + shell)  ──►  Fases 1–4 (superficies, en paralelo)
```

Dentro de las superficies, el orden es por **primera impresión** (login/onboarding/
dashboard antes que spaces/drive), porque definen si el rediseño "se siente".

---

## Decisiones de alcance

1. **App-shell → sidebar vertical colapsable.** ✅ *Decidido.* Navegación lateral
   natural para "áreas de memoria", escala a colectivos, deja el top para contexto de
   página. Top-nav se reserva como layout móvil (drawer). → Fase 0.
2. **Design system compartido → paquetes `workspace:*`.** ✅ *Decidido.* Hoy el theme
   está duplicado byte por byte. Se extrae a `@savia-os/design-tokens` (el `system` de
   Chakra) y `@savia-os/ui` (`SaviaMark`, `FadeInUp`, constantes, primitivas genéricas),
   consumidos por ambas apps. La composición de dominio queda local en cada app.
   Arquitectura completa y mecanismos de garantía DRY en
   [05-shared-design-system.md](05-shared-design-system.md). → Fase 0.
3. **Mapa de memoria orgánico → pendiente (V1 Fase 3 vs. fast-follow Fase 5).**
   Es el mayor momento wow pero también el de más esfuerzo. Spec completo en
   [04-memory-map.md](04-memory-map.md), que **recomienda Fase 3** (es la firma, el
   resto de pantallas no depende de él) y ya parte el alcance en V1 vs fast-follow.
   Fase 3 puede, como alternativa, entregar un dashboard tokenizado correcto (sin
   arcoíris, con estados) y diferir el mapa a Fase 5 sin bloquear el resto.

---

## Fases

### Fase 0 — Fundaciones ✅ *completada*
> Todo lo de abajo está implementado y verificado. Resumen de lo construido:
> `@savia-os/design-tokens` y `@savia-os/ui` (extraídos, landing idéntica); tokens
> extendidos (estados, `dangerSoft`, `spaceScale` con contraste AA verificado,
> superficies oscuras, textStyles de producto); `space-colors.ts`; las primitivas
> genéricas y de dominio (incl. `PageHero`/`HeroEm`); sidebar + drawer móvil; splash;
> guardrail `pnpm check:tokens` con allowlist de deuda.

0. **Extraer el design system a paquetes compartidos primero** (el prerequisito #1 —
   ver [05-shared-design-system.md](05-shared-design-system.md)): crear
   `@savia-os/design-tokens` y `@savia-os/ui`, borrar los `theme/` duplicados de ambas
   apps, verificar que la landing queda idéntica, añadir el guardrail de CI "tokens o
   nada". **Extraer antes de extender.**
- Extender `@savia-os/design-tokens`: estados, `spaceScale`, superficies oscuras,
  textStyles de producto (una sola vez, ambas apps lo reciben).
- `apps/app/src/lib/space-colors.ts` (`spaceColor()` consume `spaceScale`).
- Primitivas: las genéricas (`Card`, `Dialog`, `ConfirmDialog`, `Toaster`, `EmptyState`,
  `Skeleton`, `Field`, `StatusBadge`) en `@savia-os/ui`; las de dominio (`SpaceGlyph`,
  `PageHeader`, `OtpInput`/`CopyBlock` si no las reusa la landing) en `apps/app`.
- Shell + `AppNav` (sidebar de marca, agrupación, móvil drawer, activo con presencia).
- Página raíz → splash de marca.
- **Entregable**: PRs encadenados (extracción → extensión → primitivas → shell). El app
  sigue funcionando y **la landing queda visualmente idéntica** tras la extracción.

### Fase 1 — Puerta de entrada 🚧 *en curso*
- ✅ **Login** — split-panel (form oscuro + statement claro con journey), highlight ink
  en "conecta", OTP de 6 celdas responsive, copy alineado al one-liner. Hecho y validado.
- 🚧 **Onboarding** — welcome con `PageHero`, mode-cards, stepper, "memoria
  encendiéndose" (result cards oscuros con métrica lima), done en superficie ink,
  persistencia. Alineado a la dirección; falta re-validar el flujo completo.
- **Por qué juntas**: son el primer contacto; el "wow" inicial vive aquí.

### Fase 2 — El corazón funcional
- Connections (Dialog, handshake, pulso lima, matriz accesible, errores reales).
- Connect (config tokenizada, iconos de marca; evaluar fusión con Connections).

### Fase 3 — Contenido y memoria
- Drive (drag-drop, cola de subida, retry, estados, link archivo→memoria).
- Spaces (Dialog form, SpaceGlyph, paginación, **tipo/rol/miembros**) + superficie de
  colectivos (invitar/aceptar/roles — backend ya implementado).
- Dashboard tokenizado (sin arcoíris, estados completos, stats/chart de marca).
- **Mapa de memoria V1** ([04-memory-map.md](04-memory-map.md) §14) — el momento wow.
  Recomendado aquí; diferible a Fase 4 si la fase se sobrecarga.

### Fase 4 — Pulido y firma
- Mapa de memoria: fast-follow ([04-memory-map.md](04-memory-map.md) §14) — peek con
  ejemplos, crecimiento en vivo, modo retrato/exportar. (O el V1 completo si se difirió.)
- Micro-interacciones, auditoría de motion, `prefers-reduced-motion` end-to-end.
- Pasada de accesibilidad (axe), pasada responsive (320px→desktop).

---

## Criterios de aceptación (el rúbrico, verificable)

Un PR de superficie no se mergea hasta cumplir **todos** (el rúbrico completo de
diseño vive en [`docs/design` §14](../../design/savia-design-system.md#14-checklist-antes-de-entregar)):

- [ ] **Regla del lima**: ningún texto/fill lima sobre claro; CTA primario = lima
  sobre ink, o ink sobre claro; nunca texto lima en botón. (Ver `docs/design` §2/§4.)
- [ ] **Cero hex/colores Chakra crudos.** `pnpm check:tokens` en verde (guardrail con
  allowlist de deuda que se vacía conforme se rediseña cada superficie).
- [ ] **Cero `window.confirm`/`alert`.** Reemplazados por `ConfirmDialog`.
- [ ] **Tipografía por `textStyle`**, sin `fontSize`+`fontWeight` sueltos.
- [ ] **Tres estados presentes**: skeleton, empty (`EmptyState`), error (toast).
- [ ] **Motion**: entrada con `FadeInUp`, respeta `prefers-reduced-motion`.
- [ ] **A11y**: `aria-label` en icon-buttons, labels en inputs (`Field`), focus
  visible, sin info solo-por-color, navegable con teclado.
- [ ] **Responsive**: usable y prolijo de 320px a desktop; nav con drawer en móvil.
- [ ] **Voz Savia**: primera persona, español, sin metáforas de plantas.

### Señal de éxito global

El rediseño funciona si: (1) una captura del dashboard es **compartible con orgullo**;
(2) un usuario nuevo siente el "wow" en login→onboarding sin que se lo expliquen;
(3) ninguna pantalla se distingue visualmente de la landing en calidad percibida.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Rediseño bloquea features del MVP en vuelo | Fase 0 no cambia comportamiento; superficies son independientes y mergeable de a una. |
| Mapa de memoria se vuelve un agujero de tiempo | Diferir a Fase 5; Fase 3 entrega dashboard correcto sin él. |
| Divergencia de design system con landing | Fuente única en `@savia-os/design-tokens` + guardrail de CI "tokens o nada" ([05](05-shared-design-system.md)); imposible divergir con una sola definición. |
| Motion molesta o satura | `prefers-reduced-motion` obligatorio; motion sutil, `EASE_SAVIA`, nunca bloquea interacción. |
| Colectivos ([16](../savia-mvp/16-collective-spaces.md)) obligan a rehacer cards | `SpaceCard`/`SpaceGlyph` con slots para miembros y propiedad desde el día 1. |
| Accesibilidad se deja para el final | Está en el rúbrico de cada PR, no es una fase aparte. |

---

## Relación con el plan funcional

El [`savia-mvp`](../savia-mvp/00-overview.md) está implementado **hasta el step 16
inclusive**: unificación de spaces ([14](../savia-mvp/14-spaces-unification.md)),
frontera limpia ([15](../savia-mvp/15-frontier-hardening.md)) y spaces colectivos
([16](../savia-mvp/16-collective-spaces.md)) ya viven en el backend y los contratos.

Por eso este plan es **mayormente de presentación, pero no solo**: además de rediseñar,
**cierra la brecha del frontend con el backend** exponiendo las features colectivas que
hoy no se ven (tipo de space, roles, miembros, invitaciones, promoción, grants de
escritura). No cambia contratos ni backend — solo **consume** endpoints existentes y
extiende el `api.ts` del app. Los colectivos son superficie de primera clase
(S3.2/S3.2b en [06-execution.md](06-execution.md)), no "anticipación".
