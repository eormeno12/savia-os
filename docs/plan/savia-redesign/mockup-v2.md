# Savia — Extensión del brief de mockup (v2)

> Complemento de [`mockup-requirements.md`](mockup-requirements.md). Agrega el
> modelo de negocio freemium, las pantallas de suscripción/exportación/soporte,
> los micro-mensajes de confianza, las modificaciones puntuales a pantallas
> existentes, y la sección de flujos principales que debe insertarse al inicio
> del brief original (antes de AUTH). Claude Design debe leer ambos archivos.

---

## Flujos principales

> Insertar al inicio de `mockup-requirements.md`, antes de la sección `## AUTH`.
> Los códigos de pantalla (A1, O4…) referencian las especificaciones de cada archivo.

Cada árbol muestra la secuencia de pantallas y los puntos de decisión. Las ramas
`├─` son caminos alternativos; `→` es la transición directa.

---

### 1 — Registro y onboarding

```
A1 (email)
  → A2 (OTP)
    → ¿usuario existente?
      ├─ sí ──────────────────────────────────────────────── → M1
      └─ no → O1 (bienvenida — elegir cómo arrancar)
                ├─ Importar conversaciones → O2 → O4
                ├─ Rescatar con prompt    → O3 → O4
                └─ Empezar vacío ──────────────── O4
                                          (conectar primera IA)
                                            → ¿suscrito?
                                              ├─ sí ──────────────── → O5 → M1
                                              └─ no → SB1 (gate)
                                                        ├─ paga ───── → O5 → M1
                                                        └─ más tarde → O5 (sin IA) → M1
```

---

### 2 — Uso diario: explorar y encontrar

```
S1 (shell — cualquier pantalla)
  ├─ búsqueda ──────────────────── → M1 (resultados filtrados por query)
  ├─ área en el mapa ───────────── → M2 (detalle del área)
  │                                    ├─ recuerdo → M3
  │                                    ├─ acceso   → P2
  │                                    └─ compartir con personas → CO6
  ├─ Cmd/Ctrl-K (salto rápido) ─── → área o búsqueda guardada → M1 / M2
  └─ campana (bandeja) ─────────── → N1
```

---

### 3 — Conectar una IA

```
S1 ("Conectar IA") o C1 (lista de conexiones)
  → ¿suscrito?
    ├─ sí → C2 (elegir cliente)
    │         → C3 (guía de configuración + bloque para copiar)
    │           → ¿conexión verificada?
    │             ├─ sí → C1 (conexión activa)
    │             └─ no → C3 (error + reintentar)
    └─ no → SB1 (gate de suscripción)
              ├─ paga    → C2 → C3
              └─ cancela → vuelve a donde estaba (sin perder contexto)
```

---

### 4 — Área colectiva: convertir e invitar

```
M2 → "Compartir con personas"
  → CO6 (wizard: definir visibilidad + política de IAs)
    → CO1 (área colectiva activa)
      ├─ Personas ────── → CO2 (lista de miembros)
      │                      └─ "Invitar" → CO5 (generar link)
      │                                       → link enviado
      │                                         → CO7 (invitado acepta — vista pública)
      │                                           → CO1
      ├─ Política de IAs → CO3 (admin configura qué IAs entran)
      │                      → cada miembro: CO4 (conecta sus propias IAs al área)
      └─ invitación recibida (N1) → CO7 → CO1
```

---

### 5 — Gestionar suscripción

```
CT2 (plan / suscripción)
  ├─ sin suscripción
  │     → "Suscribirme" → Mercado Pago (hosted)
  │                         ├─ exitoso  → CT2 (activa)
  │                         └─ fallido  → CT2 (error de pago)
  │
  ├─ activa → "Cancelar"
  │             → confirmación (consecuencias + fecha de vencimiento)
  │               ├─ confirma → CT2 (cancelada con gracia hasta fin de ciclo)
  │               └─ mantiene → CT2 (activa, sin cambios)
  │
  ├─ cancelada con gracia → "Reactivar"
  │                           → ¿método de pago guardado?
  │                             ├─ sí → cobro inmediato → CT2 (activa)
  │                             └─ no → Mercado Pago → CT2 (activa / fallida)
  │
  └─ pago fallido → "Actualizar método de pago"
                      → Mercado Pago (hosted) → CT2 (activa / sigue fallida)
```

---

### 6 — Importar una fuente

```
F1 (arrastrar o seleccionar archivo / URL)
  → procesando (placeholder en F1 — asíncrono)
    → ¿éxito?
      ├─ sí → notificación en N1 → recuerdos visibles en M1
      └─ no → F1 (error contextual + reintentar; los demás recuerdos intactos)
```

---

### 7 — Ayuda y soporte

```
S1 ("?") ──────────────────── → CT4 como slide-over (sin perder la pantalla actual)
Cuenta (menú) ─────────────── → CT4 pantalla completa (con historial de tickets)

CT4 (en ambos casos):
  → FAQ colapsable
      → ¿resuelto?
        ├─ sí → cierra panel / vuelve a Cuenta
        └─ no → formulario de ticket (categoría + asunto + mensaje + screenshot)
                  → enviar
                    ├─ éxito → confirmación con nº de ticket
                    └─ error → reintentar (sin perder el contenido del formulario)
```

---

### 8 — Exportar mis datos

```
CT3 → "Solicitar exportación" (formato JSON y/o CSV)
  → procesando en segundo plano
    → N1 (notificación "tu exportación está lista")
      → CT3 → "Descargar"
                → ¿link vigente (< 48 h)?
                  ├─ sí    → descarga
                  └─ vencido → CT3 (solicitar de nuevo)
```

---

### 9 — Pulso: revisar actividad y controlar acceso

```
S1 → Pulso → P1 (feed de actividad)
               ├─ evento de reorganización → acción "Revertir" inline
               ├─ evento de acceso de IA   → ver detalle en feed
               └─ "Acceso" ─────────────── → P2 (matriz IA × área)
                                                ├─ conceder acceso → P2 (actualizado)
                                                └─ revocar acceso  → P2 (actualizado)
```

---

### 10 — Bandeja de notificaciones

```
S1 (campana) → N1
  ├─ invitación a área colectiva  → CO7 (aceptar)
  ├─ exportación lista            → CT3 (descargar)
  ├─ importación completada       → M1 (ver recuerdos nuevos)
  └─ actividad de IA (resumen)    → P1 (ver feed completo)
```

---

## Modelo de negocio (freemium)

Savia tiene dos niveles de acceso:

| | Gratis | Con suscripción ($11.99/mes) |
|---|---|---|
| Organizar y explorar memoria | ✓ | ✓ |
| Importar fuentes (drag & drop) | ✓ | ✓ |
| Áreas automáticas y búsquedas guardadas | ✓ | ✓ |
| Memoria colectiva | ✓ | ✓ |
| **Conectar IAs (Claude, Cursor, ChatGPT…)** | ✗ | ✓ |
| **Actividad en vivo (qué hacen tus IAs)** | ✗ | ✓ |
| **Que tus IAs lean y recuerden** | ✗ | ✓ |

La suscripción no bloquea el acceso al producto — bloquea la conexión con IAs.
El gate aparece de forma contextual, solo cuando el usuario intenta conectar.
Pasarela de pago: **Mercado Pago**.

---

## Modificaciones a pantallas existentes del brief original

### S1 — Shell (modificación)

Agregar al listado de elementos globales:

- **Icono de ayuda "?"** (junto a la campana): abre el panel de soporte (CT4) como
  slide-over desde cualquier pantalla — para cuando el usuario tiene un problema ahora mismo.

---

### O1 — Bienvenida (modificación)

Agregar al pie de la pantalla, antes del CTA de avanzar:

- **Disclaimer de modelo** (texto muted, discreto — visible pero sin interrumpir):
  *"Savia es gratis para organizar y explorar tu memoria. Conectar tus IAs requiere
  suscripción ($11.99/mes)."* — honesto desde el inicio, sin alarmismo.

---

### O4 — Conectar primera IA (modificación)

Agregar comportamiento de gate:

- **Gate de suscripción:** si el usuario pulsa "Conectar" sin suscripción activa →
  aparece SB1 (modal o pantalla intermedia). Si ya está suscrito, fluye directo.
  Si elige "más tarde", avanza a O5 sin bloqueo.

Estados adicionales: **gate de suscripción (→ SB1)** · **"Más tarde" (avanza sin conectar)**.

---

### C1 — Lista de conexiones (modificación)

Agregar comportamiento de gate:

- **Gate de suscripción:** si el usuario pulsa "Conectar una IA" sin suscripción
  activa → aparece SB1 antes de llegar a C2. El botón puede mostrar un hint
  "requiere suscripción" si no tiene una activa.

Estado adicional: **sin suscripción** (CTA con hint de suscripción).

---

### CT2 — Plan / Suscripción (reescritura — reemplaza al brief original)

**Propósito:** el usuario entiende de un vistazo qué tiene, qué le cuesta y cuándo se renueva.
Puede gestionar por completo su suscripción sin salir de Savia excepto para el pago, donde
se delega a Mercado Pago (flujo hosted).

---

#### Bloque 1 — Estado actual del plan

Siempre visible en la parte superior. Cambia según el estado:

| Estado | Qué muestra |
|---|---|
| **Sin suscripción** | Banner protagonista: qué desbloquea + CTA "Suscribirme — $11.99/mes" |
| **Activa** | "Plan mensual · $11.99/mes · Próxima renovación: [fecha]" · CTA secundario "Cancelar" |
| **Cancelada con gracia** | "Tu acceso continúa hasta [fecha]. Después, las IAs se desconectarán." · CTA "Reactivar" |
| **Cancelada sin gracia** | "Sin suscripción activa. Tu memoria está intacta." · CTA "Reactivar — $11.99/mes" |
| **Pago fallido** | Alerta roja prominente: "No pudimos cobrar el [fecha]. Actualiza tu método de pago antes del [fecha límite] para no perder el acceso." · CTA "Actualizar método de pago" |

---

#### Bloque 2 — Qué incluye tu plan

Solo se muestra cuando hay suscripción activa o en gracia. Lista compacta de lo que desbloquea
la suscripción (sin inventar límites técnicos si no existen):

- Conectar IAs ilimitadas (Claude, Cursor, ChatGPT y compatibles)
- Actividad en vivo — qué hace cada IA con tu memoria
- Que tus IAs lean y recuerden automáticamente

---

#### Bloque 3 — Método de pago

- Muestra el medio actual: tipo de tarjeta / medio + últimos 4 dígitos + vencimiento
- CTA: "Cambiar método de pago" → flujo hosted de Mercado Pago (nueva pestaña o modal)
- Solo visible cuando hay suscripción activa o en gracia; en pago fallido es el elemento
  más prominente de la pantalla

---

#### Bloque 4 — Historial de facturación

Lista paginada, cronológico inverso:

| Fecha | Período | Monto | Estado | Acción |
|---|---|---|---|---|
| 01 jun 2026 | jun 2026 | $11.99 | Pagado | Ver comprobante |
| 01 may 2026 | may 2026 | $11.99 | Pagado | Ver comprobante |
| 01 abr 2026 | abr 2026 | $11.99 | Fallido | — |

- "Ver comprobante" abre o descarga el PDF/recibo de Mercado Pago
- Sin historial → "Aquí aparecerán tus facturas cuando actives la suscripción"

---

#### Flujo de cancelación (desde "Cancelar")

No preguntar el motivo — evitar fricción innecesaria.

1. **Confirmación única:** panel o modal con las consecuencias claras:
   - "Tu acceso continúa hasta [fecha de fin de ciclo actual]."
   - "Después de esa fecha tus IAs se desconectarán, pero toda tu memoria se conserva."
   - "Puedes reactivar en cualquier momento."
   - CTA "Confirmar cancelación" (danger) + "Mantener suscripción" (primario)
2. **Post-cancelación:** vuelve a CT2 con el estado "Cancelada con gracia" y un micro-mensaje:
   "Cancelación confirmada. Tienes acceso hasta el [fecha]. Puedes reactivar cuando quieras."

#### Flujo de reactivación (desde "Reactivar")

- Si el método de pago sigue válido: confirmación directa "¿Reactivar por $11.99/mes?" → cobro
  inmediato → acceso restaurado al instante → micro-mensaje: "Bienvenido de vuelta. Tus IAs
  ya pueden conectarse."
- Si no hay método guardado o el anterior falló: flujo hosted de Mercado Pago primero, luego
  confirmación automática al volver.

---

### CO6 — Convertir un área en colectiva (corrección de modelo mental)

El brief original pregunta al usuario si quiere **mover o copiar** los recuerdos al colectivo.
Esta pregunta es incorrecta: usa la metáfora del sistema de archivos y no refleja cómo funciona
Savia. Los recuerdos **no tienen una ubicación física que cambia** — compartir es solo visibilidad
y acceso.

**Corrección:** eliminar por completo la decisión "Mover / Copiar" del paso 1. Los recuerdos
siguen viviendo donde siempre. Lo único que cambia al convertir un área en colectiva es **quién
puede verla y qué pueden hacer con ella**.

**Paso 1 reemplazado — ¿qué verán los miembros?**
- **Visibilidad por defecto para nuevos miembros:** Lectura · Lectura + contribución (pueden
  agregar recuerdos al área colectiva)
- Nota de transparencia: "Tus recuerdos no se mueven ni se duplican — los miembros solo ganan
  visibilidad sobre esta área."
- El admin siempre puede ajustar el acceso individualmente en CO2 después.

Los pasos 2 (configuración de IAs, CO3) y 3 (confirmación) del wizard no cambian.

---

## Nuevas pantallas

### SB1 — Suscribirse (gate contextual)

**Propósito:** aparece cuando el usuario intenta conectar una IA sin suscripción
activa — desde O4 o desde C1/C2. No es un muro en el login. La pantalla debe
ganarse el pago explicando qué cambia al suscribirse, no imponiendo un bloqueo.

**Cuándo se activa:** al pulsar "Conectar IA" sin suscripción. Se presenta como
modal o pantalla intermedia, sin perder el contexto actual.

**Elementos:**
- **Contexto del modelo:** "Savia es gratis para organizar tu memoria. Para
  conectar tus IAs y que recuerden por ti, activa tu suscripción."
- **Un solo plan:** precio **$11.99 / mes**, facturado mensualmente, cancelable
  cuando quiera
- **Qué desbloquea** (en lenguaje del producto): conectar Claude, Cursor, ChatGPT
  y cualquier IA compatible · que tus IAs busquen y recuerden usando tu memoria ·
  actividad en vivo de lo que cada IA hace con tu memoria
- **Qué sigue siendo gratis** (transparencia total): organizar y explorar tu
  memoria · importar fuentes · áreas automáticas · búsquedas guardadas · colectivo
- **CTA primario:** "Suscribirme — $11.99/mes" → Mercado Pago
- **Tranquilidad:** "Cancela cuando quieras. Sin permanencia."
- **Micro-copy:** "Tus datos son tuyos — puedes exportarlos en cualquier momento."

**Estados:**
- **Sin suscripción (nuevo):** tono de propuesta, no de bloqueo — "un paso para
  conectar tus IAs"
- **Suscripción cancelada:** "te guardamos todo — reactiva para seguir donde lo
  dejaste"; si hay período de gracia, mostrar hasta cuándo
- **Procesando pago:** indicador, sin doble-clic
- **Pago fallido:** error contextual + reintentar ("no se hizo ningún cargo")
- **Pago exitoso:** confirmación breve → continúa el flujo que lo trajo aquí

**Flujo:** exitoso → retoma O4 (si venía de onboarding) o C2 (si venía de
Conexiones) · cancelar → vuelve a donde estaba sin perder el progreso.

---

### CT3 — Exportar mis datos

**Propósito:** el usuario puede descargar toda su memoria en bruto — señal
inequívoca de que sus datos le pertenecen y que Savia no los retiene. Si puedes
llevarte tus datos, no dependes de nosotros.

**Elementos:**
- **Qué incluye** (en lenguaje del usuario, no técnico): recuerdos (texto, fecha,
  área, origen), estructura de áreas, búsquedas guardadas, registro de actividad
  (qué IA leyó qué y cuándo)
- **Formato:** JSON (legible por máquina) y CSV (recuerdos). Ambos opcionales
- **Proceso asíncrono:** solicitar → Savia prepara en segundo plano → notificación
  en la Bandeja (N1) cuando esté listo → descargar. No se espera en pantalla
- **Validez del link:** vence en 48 h — tiempo restante visible
- **Historial de exportaciones:** fecha · estado (preparando / listo / vencido) ·
  re-descargar si sigue vigente
- **Mensaje de contexto:** "Estos son tus datos, en bruto. Savia los procesa para
  organizarlos, pero siempre son tuyos."

**Estados:** sin exportaciones previas / preparando ("te avisamos cuando esté
listo") / listo para descargar / link vencido (solicitar de nuevo).

---

### CT4 — Ayuda y soporte

**Propósito:** el usuario puede enviarnos un ticket desde dos puntos de entrada —
el icono "?" del shell (urgente, sin perder contexto) y esta sección de Cuenta
(deliberado). Ambos abren el mismo panel. Auto-servicio primero (FAQ), ticket para
lo que no se resuelve solo.

**Elementos:**
- **FAQ rápido** (3–5 preguntas colapsables respondidas): "¿Por qué mi IA no ve
  ciertos recuerdos?", "¿Cómo exporto mis datos?", "¿Cómo cancelo mi suscripción?",
  "¿Qué pasa con mis datos si elimino mi cuenta?" — reduce tickets antes de que lleguen
- **Formulario de ticket:**
  - Categoría: **Algo no funciona** · **Tengo una pregunta** · **Quiero sugerir algo**
  - Asunto (texto corto)
  - Mensaje (campo amplio)
  - Adjuntar screenshot (opcional)
  - CTA: "Enviar" con indicador de carga
- **Confirmación:** número de ticket + "Te responderemos a tu email en menos de 48 h"

**Desde el shell ("?"):** slide-over lateral — el usuario no abandona la pantalla
donde encontró el problema.

**Desde Cuenta (CT4):** pantalla completa + historial de tickets anteriores debajo
del formulario (asunto · estado: abierto/resuelto · fecha).

**Estados:** vacío (FAQ primero) / enviando / enviado (nº de ticket) / error
de envío (reintentar).

---

## Nuevo patrón transversal

### Micro-mensajes de confianza

Cada acción relevante lleva un mensaje breve que cumple una de tres funciones.
Nunca burocrático ni alarmista — claro, cuidadoso, en primera persona.

**Delimitar** — "solo esto, nada más":
- *Acceso concedido:* "Claude ya puede ver tu memoria de Trabajo — solo los
  recuerdos que acabas de autorizar. Nada más."
- *Primera conexión:* "Tu IA está conectada. No puede ver nada hasta que tú le
  des acceso."

**Confirmar** — "efectivo de inmediato":
- *Acceso revocado:* "Claude ya no tiene acceso a Trabajo. Efectivo de inmediato."
- *Corrección aplicada:* "Entendido — Savia no volverá a clasificar contenido
  similar ahí."
- *Procesando fuente:* "Destilando recuerdos. Guardamos el archivo original y el
  procesamiento — puedes exportarlos en cualquier momento."
- *Importación completada:* "X recuerdos guardados — y solo tuyos hasta que
  decidas compartirlos."

**Devolver el control** — "puedes revertirlo":
- *Reorganización en feed P1:* "Savia separó 'Pricing' de 'Savia OS'. ← Revertir"
- *Área marcada sensible:* "Marcado como sensible. Savia pedirá tu confirmación
  antes de que cualquier IA acceda a esto."
- *Error acotado:* "No pudimos leer este archivo. Tus demás recuerdos están
  intactos."
- *Eliminar cuenta:* "Esto borra toda tu memoria de forma permanente. No podemos
  recuperarla después."
