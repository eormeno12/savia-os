# 02 — Cobertura: artboards del mockup vs implementado

> Inventario de los **48 frames** del mockup (`Savia - Mockup.dc.html`) cruzado contra las rutas
> implementadas en `apps/app/`, más las superficies del brief (`mockup-requirements.md` /
> `mockup-v2.md`) **sin artboard**. Esfuerzo: **S** ≤0.5d · **M** ~1–2d · **L** ≥3d.
>
> **Hecho clave**: el mockup solo dibuja **Auth · SB1 · Shell · Onboarding · Memoria · P1**.
> No hay artboard para **C1–C3, F1, N1, CO1–CO7, CT1–CT4 ni P2** — esas se hicieron contra el
> brief (lo confirma el conteo de 48 frames). El task lo anticipaba; queda verificado.

---

## Resumen

| Bloque | Frames mockup | Implementado | Cobertura |
|---|---|---|---|
| Auth (A1/A2) | 11 (incl. móvil) | sí (desktop responsive) | **alta** — faltan estados/móvil dedicados |
| SB1 (gate) | 4 | sí pero **stub** (sin Mercado Pago) | media |
| S1 (shell) | 4 (incl. móvil/drawer) | sí desktop · **móvil sin nav** | media |
| Onboarding (O1–O5) | 13 | **O1–O3 sí · O4/O5 no** | **parcial** |
| Memoria (M1–M6) | 14 | M1–M6 sí (M3/M6 con patrón distinto) | alta |
| Pulso (P1) | 1 | sí pero **pobre** · **P2 no** | media |
| Flujos (referencia) | 1 | n/a | — |
| **Sin artboard** (brief) | 0 | C/F/N/CO/CT parciales | ver §3 |

**Pantallas-firma del mockup implementadas**: ~6/6 superficies con artboard tienen una versión.
**Estados/variantes y superficies brief**: ~40–55% pendiente (detalle abajo).

---

## §1 — Cobertura frame por frame (los 48)

✅ implementado · 🟡 parcial / patrón distinto · ❌ falta · — referencia

| # | Frame | Estado | Dónde / nota | Falta (esfuerzo) |
|---|---|---|---|---|
| 1 | Flujos · 10 recorridos | — | mapa de navegación, no pantalla | — |
| 2 | A1 Login email — Inicial | ✅ | `(auth)/login` + `login-form.tsx` | — |
| 3 | A1 — Enviando (cargando) | ✅ | `Button loading` | — |
| 4 | A1 — Error | ✅ | `Field error` | — |
| 5–7 | A1 **móvil** (inicial/enviando/error) | 🟡 | responsive (`base/md`), no frame dedicado | revisar 360px (S) |
| 8 | A2 Código — Inicial | ✅ | `OtpInput` 6 celdas | — |
| 9 | A2 — Error | ✅ | `danger.fg` | — |
| 10 | A2 — Verificando | ✅ | `Button loading` | — |
| 11–12 | A2 **móvil** (inicial/error) | 🟡 | responsive | revisar 360px (S) |
| 13 | SB1 Gate contextual | 🟡 | `billing/subscription-gate.tsx` (**stub**) | Mercado Pago real (L, backend) |
| 14 | SB1 Cancelada — Reactivar | 🟡 | parcial | estados de gracia (M) |
| 15 | SB1 Estados de pago | ❌ | sin flujo de pago real | (L, backend) |
| 16 | SB1 **móvil** (hoja inferior) | ❌ | el gate es modal, no bottom-sheet móvil | bottom-sheet (S) |
| 17 | S1 Shell — Sin conexiones | ✅ | `AppShell`+`Shell` (rail CTA "Conectar" 🟡) | promo de rail "conecta tu 1ª IA" (S) |
| 18 | S1 Shell — Con conexiones | 🟡 | shell sí; "actividad reciente / última IA" en topbar ❌ | indicador de actividad (M) |
| 19 | S1 **móvil** búsqueda+nav inferior | ❌ | **rail oculto, sin nav móvil** | bottom-nav/drawer (M) — ver F-SHELL-1 |
| 20 | S1 **móvil** drawer | ❌ | drawer diferido "Fase 4", no construido | drawer + focus trap (M) |
| 21 | O1 Bienvenida | ✅ | `onboarding/page.tsx` WelcomeStep | — |
| 22 | O1 **móvil** | 🟡 | responsive | revisar (S) |
| 23 | O2 Importar | ✅ | ImportStep (inline) | — |
| 24 | O2 Importar · Procesando | 🟡 | sin animación "encendiéndose" | recuerdos 1×1 staggered (M) |
| 25 | O2 Importar · Éxito | 🟡 | toast, sin celebración con número grande | celebración (S) |
| 26 | O2 Rescatar | ✅ | RescueStep + `CopyBlock` | — |
| 27 | O2 Rescatar · Resultado | 🟡 | sin "✨ N recuerdos" grande | celebración (S) |
| 28 | **O4 Conectar 1ª IA — sin conectar** | ❌ | **no implementado** (stepper salta a /memoria) | **construir O4** (M) — activación |
| 29 | **O4 — Esperando verificación** | ❌ | — | verificación en vivo (M) |
| 30 | **O4 — ¡Conectada! (celebración)** | ❌ | — | pulso lima (S) |
| 31 | **O5 Listo — mapa naciente** | ❌ | **no implementado** | **construir O5** (M) — el "wow" |
| 32 | O4 **móvil** ¡Conectada! | ❌ | — | (S) |
| 33 | O5 **móvil** | ❌ | — | (S) |
| 34 | **M1 Mapa (con datos) ★** | ✅ | `MemoryMap`+`MemoryCanvas` (mapa ink ✓) | Recientes + rail búsquedas (M) — F-M1-1/2 |
| 35 | M1 Cargando (skeleton) | ✅ | `loading.tsx` + `MemorySkeleton` | — |
| 36 | M1 Vista lista | ✅ | `MemoryList` + toggle | — |
| 37 | M1 Sin memoria (vacío) | ✅ | `MemoryEmpty` | — |
| 38 | M1 Una sola área | 🟡 | cae en vacío/poblado genérico | copy dedicado "todo en General" (S) |
| 39 | M1 **móvil** lista | 🟡 | responsive; lista no es default móvil | default lista en móvil (S) |
| 40 | Área — Sin recuerdos (M2) | 🟡 | `memoria/[id]` | estado vacío dedicado (S) |
| 41 | Área — Cargando (M2) | 🟡 | `memoria/[id]` | skeleton del panel (S) |
| 42 | M3 Crear área (**modal**) | 🟡 | `/memoria/nueva` (**página**, no modal) | intercepting route `@modal` (M) |
| 43 | M5 Búsqueda — Resultados | ✅ | `memoria/resultados` + `search-results` | filtros por área/origen/fecha (M) |
| 44 | M5 — Sin resultados | 🟡 | parcial | estado + sugerencia (S) |
| 45 | M4 Búsquedas guardadas — Vacío | 🟡 | `memoria/busquedas` (**localStorage stub**) | backend (M) |
| 46 | M4 — Con varias | 🟡 | idem | backend + acceso por IA (M) |
| 47 | M6 Recuerdo individual | 🟡 | `memory-detail-dialog` (**dialog**, no frame) | decidir patrón; mover-de-área no cableado (S) |
| 48 | P1 Actividad con actividad | 🟡 | `PulsoScreen` (feed pobre, no dark shell) | tipos de evento + dark shell + resumen IAs (L) |

**Conteo**: ✅ ~13 · 🟡 ~22 · ❌ ~11 · — 2.

---

## §2 — Estados visuales faltantes (rúbrico: vacío/carga/error/poblado)

| Pantalla | Vacío | Carga | Error | Poblado | Gap |
|---|---|---|---|---|---|
| Memoria (M1) | ✅ | ✅ (`loading.tsx`) | ✅ (`error.tsx`) | ✅ | "una sola área" (38), móvil-lista |
| Pulso (P1) | ✅ | ✅ skeleton | ✅ retry | 🟡 pobre | feed rico, P2 |
| Área (M2) | 🟡 | 🟡 | ? | ✅ | estados dedicados |
| Conexiones (C1) | ✅ | ? | ? | ✅ | skeleton/error por ítem |
| Fuentes (F1) | 🟡 | ? | 🟡 | ✅ | drop-zone protagonista, absorción visible |
| Bandeja (N1) | 🟡 | ? | ? | 🟡 stub | tipos de notificación reales |
| Cuenta (CT) | n/a | ? | ? | 🟡 | export/borrar son stubs |

---

## §3 — Superficies del brief SIN artboard (cobertura vs `mockup-requirements`)

| Cód | Superficie | Ruta | Estado | Falta (esfuerzo) |
|---|---|---|---|---|
| C1 | Lista de conexiones | `conexiones` | ✅ | health (problema/sin-actividad), pulso 1ª llamada (M) |
| C2 | Nueva conexión (2 pasos) | `conexiones/nueva` | ✅ | — |
| C3 | Guía por cliente | `conexiones/nueva` | 🟡 | selector multi-cliente (Claude/Cursor/Windsurf/ChatGPT), descarga JSON, verificación en vivo (M) |
| F1 | Fuentes | `fuentes` | 🟡 | drop-zone **protagonista** + overlay global, "absorción visible" (recuerdos/áreas destino), agrupar por contribución (L) |
| N1 | Bandeja | `bandeja` | 🟡 stub | invitaciones/sugerencias/procesos/hitos reales; marcar-leídas (M, backend) |
| **P2** | Acceso ¿qué ve cada IA? | — | ❌ | **matriz IA×área** (grant/revoke), capacidad de escritura, auditoría (L) |
| CO1 | Área colectiva | `colectivo/[id]` | 🟡 | avatares apilados, recuerdos con "quién contribuyó", dos accesos (M) |
| CO2 | Personas/miembros | `members-panel.tsx` | ✅ | — |
| CO3 | Política de IAs (admin) | — | ❌ | open/restricted/approval/people-only (M) |
| CO4 | Conectar mis IAs al área | — | ❌ | (M) |
| CO5 | Invitar persona (link) | `colectivo/[id]` | 🟡 | `Field` email+rol, `CopyBlock` link, expiración, pendientes (S) |
| CO6 | Convertir a colectiva (wizard) | `colectivo/convertir` | 🟡 | wizard 3 pasos + visibilidad por defecto (no mover/copiar) (M) |
| CO7 | Aceptar invitación (pública) | `invitar/[token]` | ✅ | estados link expirado/revocado (S) |
| CT1 | Perfil | `cuenta` | ✅ | borrar cuenta en 2 pasos (escribir email) (S) |
| CT2 | Plan/Suscripción | `cuenta` | 🟡 stub | bloques estado/incluye/método/historial; Mercado Pago (L, backend) |
| CT3 | Exportar mis datos | `cuenta` | ❌ stub | botón muerto (`TODO`); job async + N1 (M, backend) |
| CT4 | Ayuda y soporte | — | ❌ | slide-over "?" + FAQ + ticket (M) |

---

## §4 — Elementos globales del shell faltantes

| Elemento | Brief (S1) | Estado |
|---|---|---|
| Búsqueda prominente | sí | ✅ (trigger ⌘K) |
| Salto rápido ⌘K | sí | ✅ `CommandPalette` |
| Campana / bandeja | sí | 🟡 link a `/bandeja`; sin badge real |
| Ícono ayuda "?" (slide-over CT4) | sí (`mockup-v2`) | ❌ botón presente, sin panel |
| "Conectar IA" siempre accesible | sí | ✅ |
| Menú de cuenta (avatar + logout) | sí | 🟡 fila de cuenta **sin menú/logout** en el rail |
| Indicador "última IA que consultó" | sí (S1 con conexiones) | ❌ |
| Nav móvil (drawer/bottom) | sí | ❌ **no existe** |

---

## §5 — Rutas legacy huérfanas (deuda de cobertura inversa)

Coexisten con las nuevas superficies y **siguen alcanzables**:

| Ruta legacy | Superseded por | Enlazada desde | Acción |
|---|---|---|---|
| `/dashboard` | `pulso` + mapa de M1 | `nav-config.tsx` (no usado) | borrar o redirigir (S) |
| `/spaces` | `memoria` | `SpaceControlPanel.tsx:141`, `nav-config.tsx` | redirigir → `memoria` (S) |
| `/drive` | `fuentes` | `nav-config.tsx` | redirigir → `fuentes` (S) |
| `/connect` | `conexiones/nueva` | `nav-config.tsx`, link interno | borrar/redirigir (S) |
| `/connections` | `conexiones` | `connect/page.tsx:111`, `nav-config.tsx` | redirigir → `conexiones` (S) |

Detalle en [03-practicas §legacy](03-practicas-codigo.md).

---

## §6 — Veredicto de cobertura

- **Superficies-firma con artboard**: todas tienen una versión funcional (login, shell, memoria/mapa,
  pulso, onboarding base). El esqueleto del rediseño **está**.
- **Lo que falta es la "cola" del producto**: la **activación** (O4/O5), el **acceso** (P2, CO3/CO4),
  el **pago real** (SB1/CT2/CT3), el **soporte** (CT4), el **móvil** (nav + frames), y los **estados
  ricos** (feed de Pulso, health de conexiones, absorción de Fuentes).
- **Estimación gruesa**: ~6 superficies "alta", ~10 "parcial", ~6 "no construida". El grueso del
  esfuerzo restante es **backend-dependiente** (pagos, saved-searches, eventos de pulso, export).
