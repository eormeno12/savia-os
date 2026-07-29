# Mapa de navegación end-to-end — Savia app · 2026-07-22

> Mapa interactivo de las pantallas de `apps/app/` (Next.js 16, modo mock) con capturas reales,
> cada botón/link/tab y a dónde lleva, y los puntos de fricción encontrados al recorrer el código.
> Entregable solo-documentación; no se modificó código de producto.

**Abrir:** [mapa-navegacion.html](mapa-navegacion.html) (self-contained, funciona offline — arrastralo
a un navegador o `open mapa-navegacion.html`). Clusters por feature, click en cualquier pantalla para
ver la captura grande + la lista de sus elementos interactivos, panel "Puntos a revisar" con los 36
hallazgos de abajo enlazados a su pantalla.

## Método (verificado, no inventado)

- **Capturas**: build de producción de `apps/app` con `NEXT_PUBLIC_MOCK=1` (ya es el default de
  `.env.local` — sirve toda la UI desde `src/lib/api.mock.ts`, sin backend ni auth) + `next start`
  en `:4345` (`next dev` revienta con EMFILE en macOS en esta máquina). 19 rutas
  navegadas con `puppeteer-core` a 1440×960 @2x, incluyendo IDs dinámicos reales del mock
  (`area-trabajo`, `group-fundadores`, `lens-decisiones`, `inv-1`).
- **Navegación**: 19 agentes en paralelo, uno por pantalla, cada uno leyendo `page.tsx` + sus
  componentes propios (dialogs, paneles, subcomponentes) y listando todo elemento interactivo con
  su destino exacto (ruta, modal, acción local, o externo). El chrome global (`AppShell.tsx` +
  `nav.tsx`) se mapeó a mano leyendo el componente completo.
- **Sin correr nada más que lectura de código real** — cero hallazgos inventados; cada uno cita el
  archivo/comportamiento concreto que lo origina (ver el detalle de cada pantalla en el mapa).

## Alcance

19 pantallas (`login`, `onboarding`, `invitar/[token]`, `/` splash, `bandeja`, 6 de `memoria`, 3 de
`colectivo`, 2 de `conexiones`, `cuenta`, `pulso`, `fuentes`) + el `AppShell` (sidebar, ⌘K,
topbar) como nodo de chrome global. 44 conexiones de navegación, 36 puntos a revisar.

## Veredicto

La navegación troncal (Memoria ↔ Pulso ↔ Conexiones ↔ Fuentes vía sidebar, ⌘K como atajo universal)
está bien resuelta y es consistente. Los problemas concentran en tres patrones que se repiten en
casi todas las pantallas:

1. **Dead-ends disfrazados de acción real** — botones/links que parecen llevar a algo y no hacen
   nada, o hacen un toast en vez de navegar.
2. **Dos implementaciones de lo mismo, solo una conectada** — componentes completos y mejor
   resueltos que quedaron huérfanos mientras `page.tsx` usa una versión propia más pobre.
3. **Fallos de red que se tragan en silencio** — el `catch` oculta el error en vez de mostrarlo,
   dejando a un usuario real sin saber si "no hay nada" o "algo falló".

## Hallazgos priorizados

### 🔴 Navegación rota o inalcanzable

- **Colectivo no está en ningún nav global.** No hay entrada en el sidebar, ⌘K ni el botón
  "Conectar IA". Único camino encontrado: Bandeja → click en una notificación puntual
  (invitación o "se unió al grupo") → `/colectivo/{id}`. Si el usuario no clickea esa notificación
  puntual, Colectivo es inalcanzable.
- **`components/onboarding/` está desconectado.** `apps/app/src/app/(app)/onboarding/page.tsx` no
  importa `RescueStep.tsx`, `SuggestedSpaces.tsx` ni `ImportStep.tsx` (0 importadores, confirmado
  por grep) — define versiones locales más pobres: sin upload de archivo real, sin pantalla de
  resultado con conteo, y sin el paso de curación de spaces sugeridos por embedding clustering que
  el propio stepper de 4 pasos ("Bienvenida · Poblar · Conectar · Listo") sugiere que debería
  existir. "Conectar" y "Listo" nunca se marcan como completados — son dead states visuales.
- **`/memoria/busquedas/[id]`: las filas de coincidencias no son clickeables.** `MemoryRow` se
  invoca sin `onClick` pese a que el propio componente documenta que debería ser "clickable to open
  the detail dialog" — se renderiza como `<div>` inerte.
- **`/fuentes`: archivos en estado `failed` son un dead-end total** — sin botón de reintentar ni de
  eliminar, la fila roja queda ahí para siempre.

### 🟠 Bugs funcionales concretos

- **Login**: el eyebrow "Paso 1 de 2 · Entrar" nunca cambia a "Paso 2 de 2" (está fuera del
  condicional `step==='email'`). El botón "Cambiar" no resetea el cooldown de reenvío del OTP.
- **Cuenta**: "Actualizar método de pago" abre el mismo modal que "Activar suscripción" — no existe
  ningún flujo real de actualizar tarjeta para un pago rechazado. `SubscriptionGate.subscribe()`
  llama `onActivated?.()` inmediatamente al recibir el `checkoutUrl`, antes de que el usuario
  complete el pago en Mercado Pago. `HelpSection` ("Enviar" del formulario de contacto) es
  enteramente simulado — no pega a ningún backend (`POST /support/tickets` está pendiente en el
  propio código) y notifica éxito igual.
- **`/colectivo/convertir`**: la elección de visibilidad por defecto se guarda en estado local
  nomás — el código deja explícito que `POST /groups` todavía no tiene el campo `defaultRole`, así
  que esa elección del usuario no tiene efecto.
- **`/memoria/nueva`**: el manejo de error combinado create+update de un área puede mostrar un
  error cuando el área sí se creó (solo falló el rename) — falso negativo para el usuario.

### 🟡 Fallos de red silenciosos

- **Cuenta / Facturación**: si `GET /billing/payments` falla, la card completa desaparece sin
  ningún mensaje — puede ocultar problemas reales de facturación.
- **Fuentes**: si `areas.list()` falla, el link "→ Área" simplemente no aparece para ningún
  archivo, sin reintento ni error visible.
- **`/memoria/busquedas/[id]`**: `matchesUnavailable` (el vector store falló) se renderiza
  exactamente igual que "no hay coincidencias todavía" — un usuario con resultados reales pero un
  hiccup momentáneo ve el mismo empty state, sin retry.
- **`/conexiones/nueva`**: el polling de verificación (cada 4s) traga errores sin backoff ni límite
  de reintentos — un fallo persistente deja al usuario esperando indefinidamente.
- **Bandeja**: `removeLens()` no captura errores de `api.lenses.delete` — un fallo de red al
  eliminar una búsqueda guardada no da feedback visible.

### 🔵 Inconsistencias de patrón

- **Confirmación asimétrica**: en `/colectivo/[id]` cambiar el rol de un miembro se aplica sin
  `ConfirmDialog`, mientras que "Quitar" y "Salir" sí lo piden, para acciones de riesgo similar.
  En Bandeja, "Ignorar" una sugerencia de Savia persiste pero "Descartar" una sugerencia de área es
  puro estado de cliente — dos patrones de "descartar" visualmente idénticos, comportamiento
  distinto.
- **"Revertir" en Pulso** ejecuta la mutación al click sin modal de confirmación, pese a deshacer
  una reorganización automática — inconsistente con el resto de acciones destructivas de la app.
- **Cards de solo-lectura que se sienten navegables**: en Pulso, el nombre del área afectada en
  cada `EventCard` es texto plano (no un link a `/memoria/{areaId}`); las filas de conexión del
  panel "Tus IAs" tampoco navegan a `/conexiones`. En `/memoria` raíz, las tarjetas de "Recientes"
  no tienen `onClick` pese a lucir como el resto de la lista, que sí navega.
- **`/conexiones`**: una conexión revocada muestra el label "Con problema" (tone `danger`) — engañoso,
  no es un problema técnico, es que el usuario mismo la revocó — y queda sin ninguna acción posible
  (ni reconectar ni eliminar el registro).
- **Toggle Mapa/Lista de `/memoria`** es estado local: al recargar la página siempre vuelve a
  "Mapa" aunque el usuario haya elegido "Lista".

## Pantallas auditadas

| Pantalla | Ruta | Elementos propios | Hallazgos |
|---|---|---|---|
| Login | `/login` | 5 | copy, cooldown |
| Onboarding | `/onboarding` | 9 | componentes huérfanos |
| Invitar | `/invitar/[token]` | 4 | sin retry en error |
| `/` (splash) | `/` | 0 | inalcanzable (redirect en `proxy.ts`) |
| Bandeja | `/bandeja` | 12 | CTA engañoso, dead-end silencioso |
| Memoria · raíz | `/memoria` | 9 | toggle no persiste, cards inertes |
| Memoria · área detalle | `/memoria/[id]` | 20 | dos soluciones de "vacío" |
| Memoria · nueva | `/memoria/nueva` | 3 | falso negativo de error |
| Memoria · resultados | `/memoria/resultados` | 9 | — |
| Memoria · búsquedas | `/memoria/busquedas` | 5 | error no capturado |
| Memoria · búsqueda detalle | `/memoria/busquedas/[id]` | 3 | filas no clickeables, error oculto |
| Colectivo | `/colectivo` | 4 | — |
| Colectivo · detalle | `/colectivo/[id]` | 15 | confirmación asimétrica |
| Colectivo · convertir | `/colectivo/convertir` | 8 | opción sin efecto en backend |
| Conexiones | `/conexiones` | 4 | label engañoso, sin acciones |
| Conexiones · nueva | `/conexiones/nueva` | 10 | polling sin backoff |
| Cuenta | `/cuenta` | 24 | pago, soporte simulado, facturación oculta |
| Pulso | `/pulso` | 4 | cards inertes, sin confirmación |
| Fuentes | `/fuentes` | 2 | archivos fallidos sin salida |

Relacionado: [../2026-06-27/](../2026-06-27/) (auditoría de fidelidad de diseño y prácticas de código).
