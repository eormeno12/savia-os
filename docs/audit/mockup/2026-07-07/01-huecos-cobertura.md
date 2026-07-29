# Huecos de cobertura — mockup vs. brief

Estados, pantallas o elementos que el brief (`mockup-requirements.md` + `mockup-v2.md`) pide explícitamente para una pantalla y que están ausentes o resueltos solo parcialmente en el mockup real (`Savia - Mockup.dc.html`). No es una comparación contra el código de producto — es la brecha entre lo que el propio brief de UX especificó y lo que el mockup terminó dibujando.

**Total: 61 hallazgos verificados.**

| Sección | Cantidad |
|---|---|
| Cover + Flujos principales | 2 |
| Auth (A1, A2) | 3 |
| Suscripción (SB1) | 4 |
| Shell (S1) | 4 |
| Onboarding (O1–O5) | 8 |
| Memoria (M1–M6) | 5 |
| Pulso (P1, P2) | 4 |
| Conexiones (C1, C2, C3) | 6 |
| Fuentes (F1) | 6 |
| Bandeja (N1) | 5 |
| Colectivo + Área unificada | 6 |
| Cuenta (CT1–CT4) | 6 |
| Navegación (arquitectura de información) | 1 |
| Modelo freemium | 1 |

---

## Cover + Flujos principales

### ⚪ Baja · CT2 (Flujo 5) — El diagrama de 'Gestionar suscripción' omite la rama 'mantiene suscripción'

El brief v2 especifica que la confirmación de cancelación tiene dos salidas posibles: confirma (→ cancelada con gracia) o mantiene (→ activa, sin cambios). El diagrama del mockup para el Flujo 5 solo dibuja la rama 'confirma', sin representar la opción de mantener la suscripción — un punto de decisión explícito del recorrido queda sin resolver visualmente en el propio mapa de flujos.

> **Evidencia:** HTML línea 450: '...activa→Cancelar→confirmación→gracia hasta fin de ciclo' (sin rama 'mantiene'). Cf. mockup-v2.md líneas 101-104: '├─ activa → "Cancelar" → confirmación (consecuencias + fecha de vencimiento) ├─ confirma → CT2 (cancelada con gracia...) └─ mantiene → CT2 (activa, sin cambios)'.

### ⚪ Baja · P1/P2 (Flujo 9) — El diagrama de 'Pulso' omite la rama de evento de acceso de IA en el feed

mockup-v2.md define tres ramas desde P1 (feed): reorganización→Revertir, evento de acceso de IA→ver detalle en feed, y 'Acceso'→P2. El mockup dibuja solo dos de las tres (reorganización y Acceso→P2), dejando fuera la rama de 'evento de acceso de IA' como parte del propio feed.

> **Evidencia:** HTML líneas 491-494 (solo 'reorganización→Revertir' y 'Acceso→P2 matriz IA×área'). Cf. mockup-v2.md líneas 164-169: '├─ evento de reorganización → acción "Revertir" inline ├─ evento de acceso de IA → ver detalle en feed └─ "Acceso" → P2 (matriz IA × área)'.

## Auth (A1, A2)

### 🔴 Alta · A2 (móvil) — Falta el estado "Verificando" (validating) en A2 móvil

El brief pide para A2 un "indicador de validación" (mockup-requirements.md línea 87). En desktop, A2 tiene las tres variantes completas: Inicial (línea 657), Error (línea 688) y Verificando (línea 720, con spinner y texto "Verificando tu código…"). En móvil, A2 solo tiene dos frames — Inicial (línea 751, en left:3860) y Error (línea 776, en left:4292) — y falta un tercer frame de "Verificando" en la posición donde debería estar (left:4724, siguiendo el mismo patrón de 3 frames que usa A1 móvil en líneas 601/619/637 para idle/loading/error). Esto rompe la paridad desktop/móvil pedida y deja sin resolver cómo se ve la validación del código en pantallas chicas.

> **Evidencia:** Comparar bloques: A1 móvil tiene 3 frames (601 idle, 619 loading, 637 error). A2 desktop tiene 3 frames (657 idle, 688 error, 720 validating). A2 móvil solo tiene 2 frames (751 idle, 776 error) — sin equivalente a la línea 720 en versión móvil. Brief: mockup-requirements.md línea 87 "indicador de validación".

### 🟡 Media · A1 — No existe un estado de error "de red" (envío fallido por servidor/conexión) en A1, solo error de formato de email

El brief pide explícitamente dos causas de error distintas para A1: "error (email inválido / red)" (mockup-requirements.md línea 74). El mockup solo implementa el error de validación de formato de email (líneas 588-593 desktop, 646-650 móvil, con el input marcado en rojo y el mensaje "falta algo después de la @"). No hay ningún frame que muestre qué pasa si el envío del código falla por un problema de red/servidor (ej. "No pudimos enviar el código. Intenta de nuevo."), a pesar de que ese tipo de error contextual con icono + copy dedicado sí se usa en otras partes del mismo mockup (ej. SB1 pago fallido línea 869, error de archivo en F1 líneas 1202 y 2385, CT2 pago fallido líneas 2792 y 2849). AUTH queda con un tratamiento de errores incompleto respecto al resto del sistema.

> **Evidencia:** mockup-requirements.md línea 74: "Acción principal; error (email inválido / red); indicador de carga." Único error mostrado: líneas 588-593 (desktop) y 646-650 (móvil), ambos de formato de email. Ejemplos de error de proceso/servidor en otras secciones del mismo archivo: líneas 869, 1202, 2385, 2792, 2849.

### 🟡 Media · A2 — El estado "Reenviar habilitado" tras terminar la cuenta regresiva no existe de forma independiente del error

El brief describe una transición propia: "Reenvío con cuenta regresiva → al terminar habilita 'Reenviar'" (mockup-requirements.md línea 86), independiente de si el código ingresado fue incorrecto. En el mockup, el único lugar donde el botón "Reenviar código" aparece habilitado es dentro del frame de error por código inválido/expirado (línea 714 desktop, línea 794 móvil). No hay un frame que muestre el momento en que el temporizador llega a 0:00 sin que haya habido un intento fallido — solo se ve el contador corriendo ("Reenviar en 0:42", líneas 682 y 770) y luego, directamente, el botón habilitado atado al mensaje de error. Falta representar el caso "se acabó el tiempo, aún no probé ningún código, ahora puedo reenviar".

> **Evidencia:** Brief: mockup-requirements.md línea 86. Countdown corriendo: líneas 682 (desktop) y 770 (móvil). Único "Reenviar código" habilitado: línea 714 (desktop, dentro del bloque de error línea 688) y línea 794 (móvil, dentro del bloque de error línea 776).

## Suscripción (SB1)

### 🔴 Alta · SB1 (móvil) — Solo 1 de los 5 estados obligatorios de SB1 tiene versión móvil

El brief (mockup-v2.md, sección 'Nuevas pantallas > SB1') define 5 estados para SB1: 'Sin suscripción (nuevo)', 'Suscripción cancelada', 'Procesando pago', 'Pago fallido' y 'Pago exitoso'. En el HTML, la sección móvil (líneas 879-902, comentario 'SB1 móvil · Gate (hoja inferior)') solo cubre el primer estado (el gate inicial como bottom sheet). Las variantes 'cancelada/reactivar' (líneas 844-857), 'procesando pago', 'pago fallido' y 'pago exitoso' (líneas 859-877) solo existen en tamaño desktop/tarjeta — no hay ninguna hoja inferior móvil equivalente para ellas. Reactivar una suscripción vencida o encontrarse con un pago fallido son escenarios plausibles en móvil, así que esto es una laguna de cobertura real, no solo estética — y el foco de esta revisión incluye expresamente 'mobile'.

> **Evidencia:** Líneas 879-902 (única sección móvil) vs. líneas 844-877 (estados 'cancelada', 'procesando', 'fallido', 'exitoso' presentes solo en desktop); brief cita 5 estados: 'Sin suscripción (nuevo) / Suscripción cancelada / Procesando pago / Pago fallido / Pago exitoso' (mockup-v2.md, sección SB1).

### 🟡 Media · SB1 (móvil) — El gate móvil omite el bloque 'Qué sigue siendo gratis' (transparencia del modelo freemium)

La versión desktop del gate (líneas 828-833) muestra dos columnas: 'Qué desbloqueas' y 'Qué sigue siendo gratis' (organizar/explorar, importar fuentes, áreas automáticas y búsquedas guardadas, memoria colectiva). El brief describe este segundo bloque como 'transparencia total' y lo lista como elemento obligatorio de SB1 sin distinguir breakpoints. La versión móvil (líneas 883-899) solo replica la lista 'Qué desbloqueas' (líneas 892-894, 3 ítems) y elimina por completo la columna de lo que sigue siendo gratis, además de recortar el micro-copy 'Tus datos son tuyos — puedes exportarlos en cualquier momento' (presente en desktop línea 837, ausente en móvil). Esto debilita justamente el mensaje de confianza que el propio post-it del diagrama subraya ('Freemium: Savia es gratis para organizar...', línea 802) en la superficie (móvil) donde más usuarios probablemente encuentran el gate.

> **Evidencia:** Desktop: líneas 828-833 ('Qué sigue siendo gratis') y línea 837 (micro-copy de datos). Móvil: líneas 883-899 solo tienen 'Qué desbloqueas' (892-894) y omiten ambos bloques. Brief: '**Qué sigue siendo gratis** (transparencia total): organizar y explorar tu memoria · importar fuentes · áreas automáticas · búsquedas guardadas · colectivo' (mockup-v2.md, SB1 > Elementos).

### 🟡 Media · SB1 — No se ilustra la variante 'cancelada sin período de gracia'

El único estado 'cancelada' mostrado (líneas 844-857) es la variante 'con gracia', con fecha fija ('hasta el 19 de julio de 2026'). El propio brief redacta el estado como condicional: '"te guardamos todo — reactiva para seguir donde lo dejaste"; si hay período de gracia, mostrar hasta cuándo' — frase que implica un caso contrario (sin período de gracia) que también debería resolverse en copy. La especificación hermana de CT2 (que comparte el mismo modelo de cancelación/reactivación) define explícitamente dos filas distintas con copy diferente: 'Cancelada con gracia' → 'Tu acceso continúa hasta [fecha]...' vs. 'Cancelada sin gracia' → 'Sin suscripción activa. Tu memoria está intacta.' + CTA 'Reactivar — $11.99/mes' (sin fecha). El mockup de SB1 nunca muestra esta segunda variante, dejando sin resolver qué le dice el gate a un usuario cuya gracia ya venció.

> **Evidencia:** Líneas 844-857 (única variante 'cancelada', con fecha fija). Brief SB1: "si hay período de gracia, mostrar hasta cuándo" (mockup-v2.md, SB1 > Estados). Brief CT2 (Bloque 1): fila 'Cancelada con gracia' vs. fila 'Cancelada sin gracia' con copy distinto (mockup-v2.md, CT2 > Bloque 1).

### ⚪ Baja · SB1 — Nunca se muestra el gate sobre el contexto de Onboarding (O4), solo sobre Conexiones — deja ambigua la semántica de 'descartar'

El único fondo preservado detrás del gate (líneas 808-812) es la pantalla 'Conexiones · Conectar una IA'. Pero el brief define DOS orígenes distintos para SB1 con comportamientos de descarte diferentes: desde Conexiones/C1 'cancela → vuelve a donde estaba (sin perder contexto)' (diagrama de flujo 3), y desde Onboarding/O4 'más tarde → avanza a O5 sin bloqueo' (diagrama de flujo 1; y la modificación de O4 en mockup-v2.md: 'Si elige "más tarde", avanza a O5 sin bloqueo'). El mockup solo ilustra el primer caso (icono X genérico, línea 816, sin etiqueta, sobre fondo de Conexiones). No existe ninguna variante de SB1 con el contexto de O4 detrás, ni una etiqueta que distinga 'cerrar y volver' de 'más tarde y avanzar' en desktop (la versión móvil sí usa la etiqueta explícita 'Más tarde', línea 897, pero solo para el caso de gate simple). Esta ausencia deja sin resolver visualmente cómo debe comportarse el mismo control en el flujo de onboarding.

> **Evidencia:** Fondo preservado = 'Conexiones · Conectar una IA' (línea 810); icono de cierre sin etiqueta (línea 816). Diagrama de flujo 1 (Registro y onboarding): 'no → SB1 (gate) ... └─ más tarde → O5 (sin IA) → M1'. Diagrama de flujo 3 (Conectar una IA): 'no → SB1 ... └─ cancela → vuelve a donde estaba (sin perder contexto)' (ambos en mockup-v2.md, 'Flujos principales').

## Shell (S1)

### 🔴 Alta · S1 (móvil) — Falta el estado móvil "sin conexiones"

El brief exige el estado "Sin conexiones aún → 'Conectar IA' prominente" para S1, y por separado exige que el shell funcione en móvil ("Móvil: navegación accesible (drawer); búsqueda accesible..."). El mockup solo cubre ese estado vacío en escritorio (líneas 911-961). Los dos frames móviles ("default", líneas 1023-1046, y "drawer", 1048-1064) muestran datos de la cuenta ya poblada (1.248 recuerdos, áreas Trabajo/Proyectos/Savia OS — los mismos números que el frame de escritorio "con conexiones", línea 1000 vs 1032). No existe ningún frame que muestre cómo se ve en el teléfono la cuenta nueva con 0 recuerdos / 0 IAs conectadas, que es exactamente el estado que llega desde O4→O5 ("más tarde") en un dispositivo móvil.

> **Evidencia:** requirements.md L111-114: "Sin conexiones aún → 'Conectar IA' prominente" / "Móvil: navegación accesible (drawer); búsqueda accesible; nunca se oculta sin alternativa". HTML: mobile default (L1023-1046) y drawer (L1048-1064) solo muestran el estado "con conexiones" (L1032 "1.248" recuerdos, igual que L1000 del frame de escritorio con conexiones).

### 🟡 Media · S1 — No hay UI dedicada para la paleta de comandos ⌘K

El título de la sección la nombra explícitamente como pilar de S1 ("navegación persistente + búsqueda, ⌘K y bandeja globales", L905) y el brief describe la paleta de comandos como un elemento distinto de la búsqueda de memoria: "escribir para saltar a un área, una búsqueda guardada, o lo reciente" (requirements.md L104-105). En el HTML, ⌘K aparece únicamente como una etiqueta de atajo ("⌘K") pegada dentro del mismo campo de búsqueda de memoria (L939, L989) — no hay ningún frame/overlay que muestre cómo se ve la paleta abierta ni su contenido de salto rápido (áreas, búsquedas guardadas, recientes), que es un listado distinto al de resultados de búsqueda semántica de M5.

> **Evidencia:** requirements.md L104-105: "Salto rápido por teclado (paleta de comandos, ej. Cmd/Ctrl-K): escribir para saltar a un área, una búsqueda guardada, o lo reciente — pensado para el power user". HTML L939 y L989: el badge '⌘K' vive dentro del mismo input de búsqueda, sin frame propio del palette.

### 🟡 Media · S1 (móvil) — "Acceso a cuenta" no existe en el estado móvil por defecto

El brief lista "Acceso a cuenta" como elemento global del shell (requirements.md L109), presente en escritorio como la fila de avatar/nombre/email al pie del rail (L930, L981). En móvil, esa misma fila solo aparece dentro del drawer (L1061); el header del estado "default" (L1026-1029) no tiene avatar ni acceso a cuenta, y el bottom-nav (L1039-1044) tiene solo 4 ítems (Memoria/Pulso/Conexiones/Fuentes), sin un 5º ítem de Cuenta. Sumado al hallazgo de error sobre el disparador faltante del drawer, el acceso a cuenta queda de facto inalcanzable desde el estado móvil por defecto.

> **Evidencia:** requirements.md L109 "Acceso a cuenta"; HTML L1039-1044 (bottom nav sin ítem de Cuenta) vs L1061 (fila de cuenta solo dentro del drawer).

### 🟡 Media · S1 — El gate de suscripción sobre "Conectar IA" (Flujo 3 de v2) no se refleja en el shell

mockup-v2.md, Flujo 3 ("Conectar una IA", L57-70) lista explícitamente a S1 ("Conectar IA") junto con C1 como puntos de entrada que, sin suscripción activa, deben derivar a SB1 (gate). La sección "Modificaciones a pantallas existentes" de v2 sí agrega a C1 la posibilidad de mostrar un hint "requiere suscripción" (L243-247), pero la modificación de S1 (L208-214) solo agrega el ícono de ayuda "?" y no menciona el comportamiento de gate. Ninguno de los tres CTAs de "Conectar IA" del shell (header L944/995, tarjeta del rail L928, hero del main L955) refleja de ningún modo (lock, badge, copy) que la acción pueda estar bloqueada por falta de suscripción, dejando sin resolver visualmente un camino que el propio flujo de v2 dice que empieza en S1.

> **Evidencia:** mockup-v2.md L60-69 (Flujo 3): "S1 ('Conectar IA') o C1 ... → ¿suscrito? ... no → SB1 (gate de suscripción)"; L208-214 (modificación de S1 en v2, solo agrega el ícono "?"); HTML L944, L928, L955, L995 sin ninguna señal de gate.

## Onboarding (O1–O5)

### 🔴 Alta · O5 — Falta el estado "O5 (sin IA)" que el propio flujo v2 define como alcanzable

El diagrama de flujo #1 de mockup-v2.md define una rama explícita: si en O4 el usuario elige "más tarde" sin suscribirse, el destino es "O5 (sin IA) → M1". El mockup de O5 (desktop y mobile) solo muestra la variante con una IA ya conectada (stat "1 · IA conectada" hardcodeado), sin ninguna variante alternativa para 0 IA conectada (que debería, al menos, cambiar ese stat y probablemente el copy de celebración).

> **Evidencia:** mockup-v2.md línea 37: "└─ más tarde → O5 (sin IA) → M1"; HTML líneas 1364-1390 (O5 desktop) y 1405-1421 (O5 mobile); stat hardcodeado en línea 1377: "1 ... IA conectada".

### 🔴 Alta · O2 / O3 — No existe ninguna variante móvil de Importar (O2) ni de Rescatar (O3); O4 móvil solo cubre "conectada"

De los 5 pasos de onboarding, en la sección solo hay frame móvil para O1, O4 y O5, y de O4 solo se muestra el estado "conectada" (faltan "sin conectar" y "esperando verificación" en mobile). O2 (con sus 3 estados: vacío/procesando/éxito) y O3 (con sus 2 estados: vacío/resultado) no tienen ninguna variante móvil, a pesar de ser pasos centrales del recorrido de activación y de que el resto del onboarding sí se diseñó responsive.

> **Evidencia:** Únicos frames móviles rotulados dentro de la sección Onboarding (líneas 1066-1422): línea 1117 "O1 móvil", línea 1393 "O4 móvil · ¡Conectada!", línea 1405 "O5 móvil". No hay entrada "O2 móvil", "O3 móvil", ni "O4 móvil · sin conectar/esperando".

### 🟡 Media · O2 — La "guía de cómo exportar" nunca muestra contenido real, solo un menú de navegación

El brief pide que O2 incluya una guía de cómo exportar de cada origen (ChatGPT, Claude, Gemini), aclarando "hay que guiarlo igual que la conexión" (mismo nivel de detalle que C3). El mockup solo muestra tres filas con logo + nombre + chevron ">" que sugieren navegación a más detalle, pero en ningún frame del archivo se ve el contenido de esa guía (dónde está el botón de exportar en cada servicio, pasos, capturas). Es un menú, no una guía.

> **Evidencia:** mockup-requirements.md líneas 140-141: "guía de cómo exportar de cada origen (...) hay que guiarlo igual que la conexión"; HTML líneas 1169-1174 (filas ChatGPT/Claude/Gemini con chevron; no hay ningún expandido de esas filas en todo el archivo — verificado por búsqueda de "Cómo exportar").

### 🟡 Media · O3 — Falta el estado "procesando" que el brief pide explícitamente para O3

El brief lista los estados de O3 como "vacío / procesando / resultado celebrado" y pide un "indicador de carga" como elemento. El mockup muestra el estado vacío (botón "Crear mis recuerdos" deshabilitado) y salta directo al resultado celebrado (63 recuerdos creados); no hay ningún frame intermedio con indicador de carga entre pegar la respuesta y ver el resultado.

> **Evidencia:** mockup-requirements.md líneas 155-160: "acción principal; indicador de carga (...) Estados: vacío / procesando / resultado celebrado."; HTML O3 vacío en líneas 1233-1271 y O3 resultado en líneas 1274-1292, sin frame "procesando" entre ambos.

### 🟡 Media · O3 — El botón "Copiar prompt" no tiene ningún estado de confirmación

El brief pide "bloque con el prompt + copiar (con confirmación)". El botón "Copiar prompt" no muestra ningún estado alterno (ej. "¡Copiado!" o un check temporal) en ningún frame del archivo completo; se buscó "copiado"/"clipboard" en todo el documento y no aparece ninguna vez.

> **Evidencia:** mockup-requirements.md líneas 155-156: "bloque con el prompt + copiar (con confirmación)"; HTML línea 1261 (botón "Copiar prompt" sin estado de confirmación visible en ningún otro lugar del archivo).

### ⚪ Baja · O2 — Falta el estado "pendiente" en la cola de procesamiento de archivos

El brief especifica "cola con estado por archivo (pendiente/procesando/listo/error) y progreso". El frame O2 · procesando solo muestra tres de los cuatro estados (Procesando…, Listo, Error); no hay ningún archivo mostrado en estado "pendiente" (en cola, sin empezar aún).

> **Evidencia:** mockup-requirements.md líneas 142-143: "cola con estado por archivo (pendiente/procesando/listo/error)"; HTML líneas 1194-1203 (solo procesando/listo/error, ningún archivo pendiente).

### ⚪ Baja · O1-O5 — Ninguna pantalla de onboarding ofrece un control explícito de "volver atrás"

El brief define el onboarding como un recorrido donde "se puede volver atrás" y "el progreso se persiste". Ninguno de los frames de O1 a O5 incluye un botón de retroceso (flecha "Atrás", "Volver"); las únicas salidas disponibles son "Guardar y salir" (abandona el flujo entero) o "Hacerlo más tarde" (avanza, no retrocede). No hay indicación de que el stepper de progreso sea clicable para saltar a un paso anterior.

> **Evidencia:** mockup-requirements.md línea 120: "Se puede volver atrás."; HTML — cabeceras de O1 (1073-1085), O2 (1143-1156), O3 (1236-1248), O4 (1299-1302), O5 (1368): ninguna incluye control de retroceso.

### ⚪ Baja · O4 — "Hacerlo más tarde" no reafirma que se puede conectar después desde Conexiones

El brief define esta opción como: "hacerlo más tarde (se puede conectar desde Conexiones cuando quiera)". En el mockup, el botón "Hacerlo más tarde" no va acompañado de ningún copy que transmita esa garantía explícita al usuario que decide saltar el paso protagonista del onboarding.

> **Evidencia:** mockup-requirements.md líneas 171-172: "opción de hacerlo más tarde (se puede conectar desde Conexiones cuando quiera)"; HTML líneas 1301 y 1342 (botón sin copy adicional de reafirmación).

## Memoria (M1–M6)

### 🔴 Alta · M1 — No existe ningún estado que muestre el mapa "anidándose" (drill-down con migas de pan sobre el lienzo), pese a ser un requisito explícito del mapa en M1

El brief pide que el mapa de M1 sea "anidable": entrar a un área con sub-áreas despliega esas sub-áreas dentro del propio lienzo, con migas de pan para saber dónde se está — descrito como algo distinto de "seleccionar un área → su panel (M2)". El mockup solo muestra el mapa plano de nivel superior (con "Savia OS" marcado "3 sub" pero sin ningún frame que ilustre entrar a esa área y ver sus sub-áreas dentro del lienzo con breadcrumbs encima). El único breadcrumb del documento vive en M2 (nivel de área), no en el mapa de M1. El propio diagrama de flujo del documento codifica "área en mapa → M2 detalle" como la única transición, sin rama para la exploración anidada dentro del mapa.

> **Evidencia:** Brief mockup-requirements.md líneas 204-207: "anidables (entrar a un área despliega sus sub-áreas), con migas de pan para saber dónde estás. Seleccionar un área → su panel (M2)". HTML línea 1472 ("Savia OS... 142 · 3 sub" sin estado de drill-down); línea 417 (diagrama de flujo: "área en mapa → M2 detalle" como única transición).

### 🟡 Media · M1 — No hay forma visible de llegar a la pantalla completa de Búsquedas guardadas (M4) desde M1

El sidebar de M1 "con datos" lista únicamente 2 búsquedas guardadas fijas ("Todo sobre Fredd", "Decisiones de pricing"), sin ningún enlace "ver todas" ni acceso a gestionar el listado completo. El propio M4 "con varias" muestra 3 búsquedas guardadas (incluye "Recetas veganas", ausente del sidebar de M1), lo que confirma que el sidebar no refleja ni da acceso al conjunto completo. El brief lista explícitamente "Búsquedas guardadas (M4)" como uno de los "Accesos" que debe tener M1.

> **Evidencia:** HTML líneas 1440-1442 (sidebar con solo 2 ítems, sin enlace "ver todas"); líneas 1826-1845 (M4 con varias muestra 3 ítems, incluyendo uno no presente en el sidebar de M1). Brief mockup-requirements.md línea 213: "Accesos: Crear área (M3), Búsquedas guardadas (M4)".

### 🟡 Media · M1 (móvil) — Solo se ilustra la vista de lista en móvil; no hay ningún estado que muestre el mapa adaptado a pantalla chica, pese a que el toggle Mapa/Lista está presente y accionable ahí mismo

El brief exige que en móvil "el mapa se adapta (navegación por toques, entrar/salir de áreas con migas)", y que la lista sea solo la vista *por defecto*, no la única disponible. En el mockup, la única pantalla móvil de M1 es "M1 móvil · Lista (vista por defecto en móvil)"; sin embargo, esa misma pantalla incluye el control Mapa/Lista (con "Mapa" visible como opción no seleccionada), lo que implica que el usuario puede cambiar a mapa en móvil — comportamiento que el documento nunca ilustra en ningún frame.

> **Evidencia:** Brief mockup-requirements.md línea 219: "Móvil: el mapa se adapta (navegación por toques, entrar/salir de áreas con migas); si el mapa es difícil en pantalla chica, la lista es la vista por defecto en móvil". HTML línea 1627 ("M1 móvil · Lista (vista por defecto en móvil)"); línea 1634 (toggle Mapa/Lista presente en el header móvil, con "Mapa" como opción inactiva). Búsqueda en todo el archivo confirma que no existe ningún otro frame "M1 móvil" con el mapa.

### 🟡 Media · M4 — Ningún ítem de "Búsquedas guardadas — Con varias" expone editar la búsqueda en lenguaje natural ni eliminar

El brief define como elementos de M4, por cada búsqueda guardada: abrir, editar la búsqueda en lenguaje natural, control de acceso por IA, y eliminar. En el estado "con varias" (que es precisamente el que debería demostrar la gestión de varios ítems), cada fila solo tiene: icono, nombre + descripción, badge opcional de acceso por IA, conteo, y una flecha de "abrir". No hay ningún ícono, menú "⋯" ni afordancia de edición o eliminación en ninguna de las tres filas mostradas.

> **Evidencia:** Brief mockup-requirements.md líneas 259-262: "abrir una → sus recuerdos...; editar la búsqueda en lenguaje natural; control de acceso por IA...; eliminar". HTML líneas 1827-1833, 1834-1839 y 1840-1845 (cada fila termina en el chevron "M9 6l6 6-6 6" de abrir, sin editar/eliminar).

### ⚪ Baja · M2 — El estado "sin recuerdos" promete la acción de mover recuerdos desde otra área pero no ofrece ningún control para hacerlo

El copy del estado vacío de M2 dice "También puedes mover recuerdos desde otra área", pero el único botón disponible en esa pantalla es "Sumar fuentes a Recetas". No hay un segundo CTA (ni siquiera secundario) que permita iniciar el movimiento de recuerdos desde otra área, dejando esa frase sin una acción correspondiente en la misma pantalla.

> **Evidencia:** HTML línea 1672: texto "...También puedes mover recuerdos desde otra área." seguido de un único botón "Sumar fuentes a Recetas", sin acción para "mover recuerdos".

## Pulso (P1, P2)

### 🟡 Media · P1 — Falta el elemento "Recientes" (últimos recuerdos agregados, navegables) como pieza distinta del feed de eventos

El brief lista "Recientes" como un elemento propio de P1, separado del "Feed de actividad": "los últimos recuerdos agregados (de quién/qué), navegables" — es decir, debe poder abrirse el recuerdo concreto que se acaba de crear. En las 4 variantes de P1 (con actividad, sin actividad, cargando, móvil) solo existe el feed de eventos legibles ("Claude recordó 3 cosas nuevas en Trabajo", etc.); no hay ningún listado de recuerdos individuales con affordance de apertura hacia el recuerdo (M6). El feed no sustituye a "Recientes" porque describe el evento, no da acceso navegable a cada recuerdo nuevo.

> **Evidencia:** mockup-requirements.md líneas 297-304 ("**Recientes**: los últimos recuerdos agregados (de quién/qué), navegables") vs. HTML líneas 1897-1904 (única lista existente es el feed de eventos, sin ítems de recuerdo individuales navegables).

### 🟡 Media · P2 — Ausente el elemento "Sugerencias de Savia" en las cuatro variantes de P2

El brief exige en P2: "Sugerencias de Savia: defaults sensatos y avisos ('la nueva área Fredd se parece a lo que Claude ya ve, ¿le das acceso?') — aceptar o ignorar". Ninguna de las variantes de P2 (con accesos, sin conexiones, cargando, móvil) muestra ese tipo de aviso/nudge inline; solo aparecen las tarjetas de acceso actual (Claude, Cursor, ChatGPT) sin ninguna sugerencia contextual de Savia. El único lugar del brief donde sí aparece una sugerencia similar es N1 (Bandeja), pero P2 la exige como elemento propio de su pantalla "hogar" del acceso.

> **Evidencia:** mockup-requirements.md líneas 319-327 (bullet "Sugerencias de Savia") vs. HTML líneas 2017-2078 (tarjetas de Claude/Cursor/ChatGPT sin ningún banner de sugerencia).

### 🟡 Media · P1 — No se cubre el gate de suscripción para las acciones "Conectar IA" que viven dentro de Pulso

Según el modelo freemium de v2, "Actividad en vivo (qué hacen tus IAs)" y "conectar IAs" son features de pago. La sección SB1 enumera explícitamente sus puntos de entrada: "al pulsar 'Conectar IA' sin suscripción... desde O4 o desde C1/C2" — pero no menciona los botones "Conectar IA" (header, estado con actividad) ni "Conectar mi primera IA" (estado sin actividad) que aparecen dentro de P1. Ninguna de las variantes de P1 refleja que el propio acceso a Pulso, o a conectar una IA desde ahí, dependa de la suscripción (no hay hint "requiere suscripción" como el que sí se pide para C1 en la modificación de v2).

> **Evidencia:** mockup-v2.md líneas 190-198 (tabla freemium) y líneas 356-361 ("Cuándo se activa: ... desde O4 o desde C1/C2") vs. HTML línea 1890 (botón "Conectar IA" en P1 con actividad) y línea 1960 ("Conectar mi primera IA" en P1 sin actividad), ninguno con indicación de gate.

### 🟡 Media · P2 — "Historial / auditoría" no tiene contenido propio visible en ninguna variante de P2

El brief describe P2 como "la vista consolidada del acceso ... con su historial ... Historial / auditoría: qué pudo leer cada IA y cuándo". En el mockup solo existe un botón "Ver historial" en el header de la variante "con accesos" (sin acción/estado visible al activarlo); las variantes sin conexiones, cargando y móvil ni siquiera incluyen ese botón. No hay ninguna pantalla o panel que muestre el registro de auditoría en sí (qué leyó cada IA y cuándo), pese a que el brief lo trata como parte constitutiva de la pantalla "hogar del acceso".

> **Evidencia:** mockup-requirements.md línea 328 ("Historial / auditoría: qué pudo leer cada IA y cuándo") vs. HTML línea 2032 (solo un botón "Ver historial", sin contenido de auditoría en ningún estado de P2).

## Conexiones (C1, C2, C3)

### 🔴 Alta · C3 — Selector de cliente incompleto: faltan Windsurf y "otro cliente compatible"

El brief exige que C3 ofrezca 6 opciones de cliente: Claude Code, Claude Desktop, Cursor, Windsurf, ChatGPT y "otro cliente compatible". El mockup solo lista 4 (Claude Code, Cursor, Claude Desktop, ChatGPT), sin scroll ni indicador de "+más". Un usuario con Windsurf, o con cualquier cliente MCP no listado explícitamente, no tiene forma de completar la conexión guiada.

> **Evidencia:** mockup-requirements.md L366-367: "Selector de cliente: Claude Code, Claude Desktop, Cursor, Windsurf, ChatGPT, 'otro cliente compatible'". HTML L2251-2256: solo 4 entradas (Claude Code, Cursor, Claude Desktop, ChatGPT).

### 🔴 Alta · C3 — Falta el estado "sin cliente elegido"

El brief define 4 estados explícitos para C3: sin cliente elegido / cliente elegido / esperando verificación / conectada. El mockup solo materializa dos paneles: "Cliente elegido (Cursor)" y "Conectada". No existe ningún panel que muestre cómo se ve la guía antes de que el usuario elija un cliente (p.ej. qué se ve en el panel derecho, si hay un cliente preseleccionado por defecto o un placeholder "elige un cliente para empezar").

> **Evidencia:** mockup-requirements.md L379: "Estados: sin cliente elegido / cliente elegido (sus pasos) / esperando verificación / conectada." HTML: únicamente aparecen los comentarios de ancla "C3 · Guía de conexión — Cliente elegido (Cursor)" (L2242) y "C3 · Guía de conexión — Conectada" (L2276); no hay un tercer panel "sin cliente elegido".

### 🟡 Media · C3 — No hay referencia visual de dónde pegar el bloque de configuración

El brief pide, como elemento propio de C3, "una referencia visual de dónde pegarlo" (un screenshot o diagrama anotado de la interfaz del cliente). El panel de Cursor solo tiene los pasos en texto y el bloque JSON para copiar/descargar, sin ninguna imagen o mockup de la UI real de Cursor que señale el lugar exacto donde va la configuración.

> **Evidencia:** mockup-requirements.md L373: "una referencia visual de dónde pegarlo". HTML L2246-2270: los dos pasos ("En Cursor, abre Ajustes → MCP..." y "Pega este bloque") están resueltos solo con texto + bloque de código; no hay imagen/captura.

### 🟡 Media · C1 — "Sin conexiones" (v1) y "sin suscripción" (v2) se muestran como un único estado sin distinguir

mockup-v2.md agrega un estado nuevo y distinto para C1 ("sin suscripción", con hint de suscripción en el CTA) además del estado original "sin conexiones" de mockup-requirements.md. El mockup colapsa ambos en un solo panel que siempre exhibe "Requiere suscripción · $11.99/mes" bajo el botón. Un usuario que YA pagó la suscripción pero simplemente no conectó ninguna IA todavía vería ese mismo mensaje, sugiriendo incorrectamente que debe pagar de nuevo.

> **Evidencia:** mockup-v2.md L239-247 (modificación a C1): "Estado adicional: sin suscripción (CTA con hint de suscripción)." mockup-requirements.md L348: "sin conexiones (qué es conectar una IA + CTA)". HTML L2147-2166, hint fijo en L2163: "Requiere suscripción · $11.99/mes" sin condicional visible para el caso "ya suscrito, aún sin conectar".

### 🟡 Media · C2 — El paso 1 de C2 no incluye elegir cliente, pese a que el diagrama de flujo v2 lo rotula así

El diagrama de flujo "3 — Conectar una IA" de mockup-v2.md etiqueta el primer paso como "C2 (elegir cliente)" y deja la configuración de copiar para C3. Sin embargo, el propio mockup-requirements.md (y el mockup real) define C2-paso1 como solo nombrar la conexión, dejando la elección de cliente para C3. El mockup no resuelve esta discrepancia entre los dos documentos: su C2-paso1 ("Nombra esta conexión") no ofrece ningún selector de cliente, dejando sin cumplir la lectura literal del diagrama v2.

> **Evidencia:** mockup-v2.md L59-66: "C2 (elegir cliente) → C3 (guía de configuración + bloque para copiar)". HTML L2205-2218 (C2 paso1: solo campo de nombre, sin selector de cliente); la elección de cliente ocurre recién en C3, L2251-2256.

### ⚪ Baja · C1 — El estado "con problema" solo ilustra el caso "token inválido"

El brief da dos ejemplos de "con problema": token inválido y bloqueada por límite. El mockup únicamente representa el primero (ChatGPT, mensaje "El token dejó de ser válido"); no hay ninguna tarjeta ni variante que muestre una conexión bloqueada por límite de uso, que probablemente requiera un copy y una acción de arreglo distintos (p.ej. esperar vs. regenerar token).

> **Evidencia:** mockup-requirements.md L344: "con problema —token inválido, bloqueada por límite—". HTML L2138: única tarjeta de error, ChatGPT, "El token dejó de ser válido. Vuelve a generarlo para reanudar."

## Fuentes (F1)

### 🔴 Alta · F1 (vacío/absorbiendo) — Falta la sugerencia opcional de área al soltar

El brief exige explícitamente que al soltar un archivo aparezca un hint opcional "¿a qué área pertenece? (opcional)", con default "que Savia lo organice", y que nunca sea obligatorio. Ninguno de los 5 frames de F1 (vacío, absorbiendo, con fuentes, cargando, móvil) muestra este control: en "F1 vacío" el drop-zone termina en el botón "Explorar archivos" sin pedir ningún hint, y en "F1 absorbiendo" se salta directo a las barras de progreso (68%, En cola) sin haber pasado por ese paso.

> **Evidencia:** mockup-requirements.md líneas 400-401: "Al soltar, sugerencia opcional: '¿a qué área pertenece? (opcional)' — un hint para Savia; por defecto 'que Savia lo organice'. Nunca obligatorio." vs. HTML líneas 2311-2317 (vacío, termina en botón sin hint) y 2342-2349 (absorbiendo, pasa directo a progreso).

### 🔴 Alta · F1 (con fuentes) — Falta la acción "re-sugerir área" por fuente

El brief lista "re-sugerir área" como una de las acciones obligatorias por fuente, junto a estado/recuerdos/reintentar/eliminar. En el estado "con fuentes" ninguna de las 4 tarjetas de fuente (reunion-q3.pdf, okrs-equipo.md, resumen-libro.txt, notas-libro.md) expone un control para re-sugerir a qué área pertenece; solo se ve "Reintentar" en la fuente fallida. Esto rompe la filosofía de "corregir, no configurar" del producto: si Savia clasificó mal una fuente, el mockup no ofrece manera de corregirlo desde Fuentes.

> **Evidencia:** mockup-requirements.md líneas 409-411: "Por fuente: nombre, estado (procesando / absorbida / fallida), recuerdos generados, áreas destino (links), re-sugerir área, reintentar (si falló), eliminar (con confirmación)" vs. HTML líneas 2378-2379 y 2385-2386 (tarjetas de fuente sin ese control).

### 🔴 Alta · F1 (con fuentes) — Falta selección múltiple y eliminar por fuente

El brief pide explícitamente "selección múltiple para reintentar/eliminar varias" en la vista organizada por contribución, y "eliminar (con confirmación)" como acción individual por fuente. Ninguna tarjeta de fuente en "F1 con fuentes" tiene checkbox de selección ni botón de eliminar/papelera; la única acción visible en toda la pantalla es "Reintentar" en la fuente con error. El patrón transversal "Acciones en lote" del brief ("en listas de recuerdos, fuentes se puede seleccionar varios y actuar") tampoco se refleja aquí.

> **Evidencia:** mockup-requirements.md líneas 407-408 ("selección múltiple para reintentar/eliminar varias") y línea 411 ("eliminar (con confirmación)"), más línea 575 (patrón transversal "Acciones en lote") vs. HTML líneas 2372-2389 (grid de tarjetas sin checkboxes ni botón eliminar).

### 🟡 Media · F1 (todas) — No se representa la opción de importar por URL

El diagrama de flujo 6 de mockup-v2.md ("Importar una fuente") especifica tres modos de entrada: "arrastrar o seleccionar archivo / URL". El mockup de F1 solo implementa arrastrar-y-soltar y el botón "Explorar archivos"/"Explorar" (selector de archivo del sistema); en ninguno de los 5 frames hay un campo o control para pegar/ingresar una URL como fuente.

> **Evidencia:** mockup-v2.md línea 120: "F1 (arrastrar o seleccionar archivo / URL)" vs. HTML líneas 2311-2317 (vacío) y 2423 (móvil), que solo ofrecen "Explorar archivos"/"Explorar".

### 🟡 Media · F1 móvil — Cobertura móvil incompleta: un solo frame híbrido en vez de los estados declarados

El desktop cubre explícitamente los 4 estados exigidos por el brief (vacío / absorbiendo / con fuentes / cargando). El móvil, en cambio, tiene un único frame ("F1 móvil · Soltar + contribución") que mezcla la zona de soltar protagonista propia del estado vacío con una fuente ya absorbida y agrupada ("Trabajo · 106 recuerdos", con solo 1 de 2 tarjetas mostradas) al mismo tiempo. No hay ningún frame móvil para "absorbiendo" (proceso de absorción visible) ni para "cargando" (skeleton), pese a que el patrón transversal de carga aplica "a todo el app autenticado".

> **Evidencia:** HTML líneas 2416-2429 (único frame móvil, mezcla drop-zone hero + grupo con recuerdos) vs. mockup-requirements.md línea 413-414 ("Estados: vacío... / absorbiendo... / con fuentes... / cargando") y línea 576 ("Carga: cada sección carga independiente con un placeholder").

### ⚪ Baja · F1 (vacío) — No se representa el overlay de "soltar sobre toda la app"

El brief indica que, además de la zona de soltar protagonista, "también se puede soltar sobre toda el app (overlay al arrastrar)". Ninguno de los 5 frames de F1 muestra este estado de overlay global al arrastrar un archivo sobre cualquier pantalla del producto.

> **Evidencia:** mockup-requirements.md líneas 397-399: "También se puede soltar sobre toda el app (overlay al arrastrar)" — sin frame correspondiente en ninguna de las 5 vistas de F1 (líneas 2293-2429).

## Bandeja (N1)

### 🔴 Alta · N1 — Falta el tipo de notificación "exportación lista", requerido por v2 y por el propio diagrama de flujo del mockup

Ninguno de los 4 estados de N1 (con notificaciones, sin notificaciones, cargando, móvil) incluye una notificación de tipo "tu exportación está lista" que lleve a CT3 a descargar. Esto no es solo un hueco contra el brief v2 (que introduce CT3 y el flujo 8 "Exportar mis datos": CT3 solicitar → segundo plano → N1 «lista» → CT3 descargar); es una contradicción interna del propio mockup: el diagrama de flujo "10 — Bandeja de notificaciones" que el mismo archivo dibuja lista explícitamente 4 destinos desde N1 — invitación→CO7, exportación→CT3 descargar, importación→M1, actividad IA→P1 — pero la pantalla N1 real solo implementa 3 de los 4 grupos (Invitación / Sugerencias de Savia / Al día con importación y actividad IA), sin ningún ítem de exportación en ningún estado.

> **Evidencia:** Diagrama de flujo (línea 503): "exportación → CT3 descargar" dentro del bloque "10 Bandeja" (líneas 497-506). CT3 existe en el mockup (líneas 2946-3009, estados "con historial" y "preparando"). Sin embargo, N1 con notificaciones (líneas 2433-2462) solo tiene grupos "Invitación" (línea 2442), "Sugerencias de Savia" (línea 2446) y "Al día" (línea 2453) con dos ítems (líneas 2455-2456), ninguno sobre exportación. Tampoco aparece en N1 cargando (2477-2486) ni N1 móvil (2489-2501).

### 🟡 Media · N1 — Falta la acción "vaciar" en todos los estados de la bandeja

El brief pide explícitamente dos acciones de gestión de la lista: "Marcar como leídas; vaciar". El mockup solo implementa "Marcar leídas" (estado con notificaciones); no hay ningún botón/acción de "vaciar" (limpiar todo) en ningún estado de N1, ni en desktop ni en móvil.

> **Evidencia:** Brief: "Marcar como leídas; vaciar" (mockup-requirements.md, sección N1, línea 432). En el HTML, el header de N1 con notificaciones (línea 2439) solo tiene el botón "Marcar leídas" y el icono de cerrar (X); no existe un control de vaciar en esa línea ni en el header de N1 sin notificaciones (línea 2470), N1 cargando (línea 2482) o N1 móvil (línea 2492).

### 🟡 Media · N1 — Los ítems de "Al día" (procesos terminados / hitos de actividad) no muestran ninguna señal de que lleven a su contexto

El brief exige que "cada ítem lleva a su contexto (el área, la conexión, etc.)", y el propio diagrama de flujo del mockup especifica que "importación → M1 recuerdos nuevos" y "actividad IA → P1 feed completo". Sin embargo, en la pantalla N1 real esos dos ítems (importación de ChatGPT completada, y "tus IAs agregaron 50 recuerdos") se renderizan como filas planas de solo lectura — sin chevron, subrayado, ni ningún otro indicio visual de que sean interactivos o naveguen a otra pantalla — a diferencia de la tarjeta de invitación y las de sugerencias, que sí tienen botones de acción explícitos.

> **Evidencia:** Brief: "cada ítem lleva a su contexto (el área, la conexión, etc.)" (mockup-requirements.md, línea 432). Diagrama de flujo (líneas 504-505): "importación → M1 recuerdos nuevos", "actividad IA → P1 feed completo". En el HTML, líneas 2455-2456: ambos ítems son divs planos sin ícono de navegación, link ni ninguna otra affordance de clic, a diferencia de las tarjetas de invitación (línea 2443, con botones Aceptar/Rechazar) y de sugerencias (líneas 2448-2449, con botones Dar acceso/Separar).

### 🟡 Media · N1 (mobile) — La variante móvil solo cubre el estado "con notificaciones"; no hay móvil para "sin notificaciones" ni "cargando", y omite acciones de gestión

De los 3 estados que el brief define para N1 (sin notificaciones / con notificaciones / cargando), la variante móvil del mockup solo muestra el caso "con notificaciones". No hay evidencia de cómo se adapta el estado vacío ("Estás al día") ni el estado de carga (skeletons) a la pantalla chica. Además, el header móvil no incluye ningún equivalente a "Marcar leídas" ni "vaciar" (ni siquiera un menú de overflow), dejando sin resolver cómo se ejecutan esas acciones en móvil.

> **Evidencia:** N1 móvil (líneas 2488-2501) es la única variante mobile presente para esta sección. Su header (línea 2492) solo tiene flecha de volver, título "Bandeja" y badge "4" — sin botón de "Marcar leídas" (presente en desktop, línea 2439) ni de "vaciar" (ausente en general, ver hallazgo separado).

### ⚪ Baja · N1 (mobile) — La variante móvil omite el tipo de notificación "hitos de actividad"

El brief define 4 tipos de contenido para N1: invitaciones, sugerencias de Savia, procesos terminados, e hitos de actividad (ej. "tus IAs agregaron 50 recuerdos esta semana"). La versión de escritorio muestra los 4 tipos (agrupando procesos e hitos bajo "Al día"), pero la variante móvil solo muestra invitación, sugerencia y el ítem de importación (proceso terminado) — el hito de actividad semanal no aparece en ningún lugar de la variante móvil, dejando sin resolver cómo luce ese tipo de contenido en pantalla chica.

> **Evidencia:** Brief: "Hitos de actividad: ej. 'tus IAs agregaron 50 recuerdos esta semana'" (mockup-requirements.md, línea 431). N1 móvil (líneas 2493-2499) solo incluye: Invitación (línea 2495), Sugerencia (línea 2497) e importación de ChatGPT (línea 2498) — sin ningún ítem de tipo "hito de actividad", presente en la versión desktop (línea 2456).

## Colectivo + Área unificada

### 🔴 Alta · CO6 — El wizard de conversión solo tiene el paso 1; los pasos 2 y 3 no existen en el mockup

El propio modal de CO6 dibuja un stepper de 3 pasos ("1 Visibilidad · 2 Configuración · 3 Confirmar") pero solo se maqueta el contenido del paso 1 (visibilidad). No hay ninguna pantalla para el paso 2 (nombre editable + modo de acceso de IAs por defecto, que reutilizaría CO3) ni para el paso 3 (resumen + botón "Convertir" con advertencia de irreversibilidad + cancelar). El botón "Siguiente" del paso 1 no tiene destino visible en el archivo. Esto deja sin resolver justo la parte más delicada del flujo: la confirmación irreversible que el brief pide explícitamente.

> **Evidencia:** HTML líneas 2637-2655 (único frame de CO6, con el stepper de 3 pasos en la línea 2643 pero sin frames para los pasos 2/3). Brief: mockup-requirements.md líneas 522-524: "Paso 2 — Configuración inicial: nombre (editable); modo de acceso de IAs por defecto (CO3)" / "Paso 3 — Confirmación: resumen; 'Convertir' (irreversible, con advertencia clara); cancelar". Confirmado con grep: solo aparece "CO6 · Convertir un área en colectiva (paso 1 — visibilidad)" en todo el archivo, ningún "paso 2"/"paso 3".

### 🔴 Alta · CO7 — Falta por completo el estado de invitación vencida/revocada

El brief pide explícitamente un estado de error para CO7 cuando el link expiró o fue revocado ("mensaje de error + CTA"). El mockup solo muestra la variante de invitación vigente (con el footer "Esta invitación vence en 6 días"); no existe ninguna variante de esta pantalla pública mostrando el mensaje de error ni el CTA correspondiente. Es una pantalla pública sin login — sin este estado, un usuario con un link caducado no tiene ninguna guía.

> **Evidencia:** HTML líneas 2657-2670 (único frame de CO7, estado 'vigente'). Brief: mockup-requirements.md línea 534-535: "...si el link expiró o fue revocado → mensaje de error + CTA."

### 🟡 Media · CO3 — No existe la advertencia de "área sensible + modo abierto" que pide el brief

El brief pide una señal de cuidado específica: advertencia cuando el área colectiva es sensible y el modo de acceso de IAs es "Abierto". En el mockup, el área de ejemplo ("Marca 2025") no está marcada como sensible y ninguna otra pantalla del set Colectivo combina sensibilidad + modo abierto, por lo que ese estado de advertencia no aparece en ningún lugar del archivo (verificado con grep de "sensible" en todo el HTML).

> **Evidencia:** HTML líneas 2551-2598 (CO3, tab IAs de Marca 2025, sin badge de sensibilidad ni advertencia). Brief: mockup-requirements.md línea 490: "Señal de cuidado: advertencia si el área es sensible y el modo es abierto." El grep global de 'sensible' (líneas 1477, 1865, 2040, 2876, 3177) no incluye ningún caso ligado a Colectivo/CO3.

### 🟡 Media · CO4 — Solo se maqueta el estado "con aprobación / pendiente"; faltan "abierto" y "bloqueado"

El brief define tres estados posibles para CO4 según la política del admin: abierto (conexión inmediata), pendiente (con aprobación) y bloqueado (solo personas, con explicación de que las IAs no pueden conectarse). El modal maquetado fija el copy en "Esta área usa modo Con aprobación" y solo ilustra ese caso (Claude conectada, Cursor pendiente, ChatGPT apagada). No hay ninguna variante donde el switch conecte de inmediato (modo abierto) ni ninguna donde los switches estén deshabilitados con el texto explicativo de que las IAs no pueden entrar (modo solo personas).

> **Evidencia:** HTML líneas 2600-2618 (único frame de CO4, texto fijo "Esta área usa modo Con aprobación" en línea 2608). Brief: mockup-requirements.md líneas 499-504: "...si es 'solo personas', se explica que las IAs no pueden conectarse aquí" / "Estados: según la política (abierto / pendiente / bloqueado)."

### 🟡 Media · CO1 (área unificada, variante colectiva) — El estado vacío específico de área colectiva ("invitar gente, conectar fuentes") no se maqueta tras la fusión con M2

El brief original de CO1 pedía un estado vacío propio: "vacía (cómo se puebla — invitar gente, conectar fuentes)", distinto del vacío de un área privada porque incluye la idea de invitar personas. Tras la fusión anunciada en la nota adhesiva ("Reemplaza M2 + CO1"), la plantilla unificada solo muestra el estado 'con recuerdos' tanto para la variante privada como para la colectiva (líneas 3021-3140); el único estado vacío de panel de área que existe en todo el archivo es el de M2 pre-fusión (línea 1672, "Aún no hay recuerdos aquí... Se llena sola cuando tus IAs o tus fuentes aporten algo"), que no menciona invitar personas. El requisito específico de CO1 quedó sin heredero visual en la plantilla unificada.

> **Evidencia:** Brief: mockup-requirements.md líneas 459-460 ("Estados: vacía (cómo se puebla — invitar gente, conectar fuentes) / con recuerdos / cargando"). HTML: nota adhesiva línea 3019 ("Reemplaza M2 + CO1"); único vacío de panel de área en línea 1672 ("Aún no hay recuerdos aquí... también puedes mover recuerdos desde otra área", sin mención de invitar gente); frames de Área unificada (3021-3140) solo en estado 'con recuerdos'.

### ⚪ Baja · CO2–CO7 — Ninguna pantalla de Colectivo tiene variante móvil, a pesar de la promesa general del propio documento

La portada del canvas afirma "33 pantallas, cada una con sus estados... Escritorio y móvil", y en efecto hay variantes móviles curadas para A1, A2, SB1, S1, O1, O4, O5, M1, P1, P2, C1, F1 y N1. Sin embargo ninguna pantalla de Colectivo (CO2, CO3, CO4, CO5, CO6, CO7) ni la plantilla de Área unificada tiene una variante móvil en todo el archivo. Nota: el brief de mockup-requirements.md no exige explícitamente 'Móvil:' para estas pantallas (a diferencia de M1/S1), así que esto es más una promesa incumplida del propio documento que una violación directa del brief; se señala por la brecha entre la afirmación de portada y la cobertura real de esta sección.

> **Evidencia:** HTML línea 356 ("33 pantallas, cada una con sus estados — vacío, cargando y con datos. Escritorio y móvil."). Grep de 'móvil' en todo el archivo: 13 pantallas cubiertas (líneas 602, 620, 638, 752, 776, 881, 1024, 1050, 1118, 1394, 1406, 1627, 1996, 2103, 2191, 2418, 2490), ninguna con prefijo CO ni 'Área'.

## Cuenta (CT1–CT4)

### 🔴 Alta · CT4 — Faltan los estados 'enviando', 'enviado (nº de ticket)' y 'error de envío' del formulario de soporte

Tanto la versión pantalla-completa de CT4 (líneas 2853-2902) como el slide-over (2904-2944) solo muestran el formulario de ticket ya rellenado y listo para enviar (asunto y mensaje con texto de ejemplo). No existe ningún frame que muestre el botón 'Enviar' en estado de carga, la confirmación con número de ticket, ni el estado de error con reintento — a pesar de que el propio mockup incluye un diagrama de flujo (línea 474) que promete explícitamente esos tres estados: 'ticket → éxito (nº) / error → reintentar'.

> **Evidencia:** HTML líneas 2853-2944 (ningún frame de éxito/error); línea 474: "FAQ → resuelto → cierra · no → ticket → éxito (nº) / error → reintentar". Brief (mockup-v2.md l.440-441): "Estados: vacío (FAQ primero) / enviando / enviado (nº de ticket) / error de envío (reintentar)."

### 🔴 Alta · CT3 — No existe el estado 'sin exportaciones previas' (primera exportación, sin historial)

El único frame 'listo para solicitar' de CT3 (líneas 2946-2989) siempre muestra el panel 'Exportaciones anteriores' con dos ítems de historial (uno listo, uno vencido). No hay ningún frame que represente al usuario que nunca exportó nada, pese a que el brief lo lista como estado explícito. El mockup sí usa en otras pantallas un patrón consistente de estado vacío (borde punteado + ícono + título 'Aún no...' + CTA — ver líneas 1672, 1801 y 2075) pero nunca lo aplica al panel de historial de CT3.

> **Evidencia:** HTML líneas 2946-2989 (panel de historial siempre poblado); patrón de vacío usado en otras pantallas: líneas 1672, 1801, 2075. Brief (mockup-v2.md l.410-411): "Estados: sin exportaciones previas / preparando (...) / listo para descargar / link vencido (...)".

### 🟡 Media · CT2 — Los micro-mensajes de confianza específicos de cancelación y reactivación nunca aparecen

El brief especifica textualmente dos micro-mensajes para el flujo de suscripción: el post-cancelación ('Cancelación confirmada. Tienes acceso hasta el [fecha]. Puedes reactivar cuando quieras.') y el de reactivación exitosa ('Bienvenido de vuelta. Tus IAs ya pueden conectarse.'). Ninguno de los dos aparece en ningún frame de CT2, ni tampoco en la sección de 'Micro-mensajes de confianza' del propio mockup (líneas 3146-3184), que sí reproduce verbatim los otros 8 ejemplos del patrón (Acceso concedido, Acceso revocado, Corrección aplicada, Procesando fuente, Importación completada, Reorganización, Sensible, Eliminar cuenta).

> **Evidencia:** Grep sobre el archivo completo: sin coincidencias para "Cancelación confirmada" ni "Bienvenido de vuelta". Sección de patrones en líneas 3146-3184 no incluye estos dos casos. Brief (mockup-v2.md l.317-318 y l.320-324): "Post-cancelación: ... micro-mensaje: 'Cancelación confirmada...'" / "...micro-mensaje: 'Bienvenido de vuelta. Tus IAs ya pueden conectarse.'"

### 🟡 Media · CT2 — Los estados 'Cancelada con gracia' y 'Cancelada sin gracia' de Bloque 1 no tienen página completa, solo una tarjeta de resumen

De los 5 estados de Bloque 1 que exige el brief (Sin suscripción, Activa, Cancelada con gracia, Cancelada sin gracia, Pago fallido), solo 3 (Sin suscripción, Activa, Pago fallido) tienen una página CT2 completa con sidebar, tabs y los Bloques 2/3/4 renderizados (líneas 2708-2806). 'Cancelada con gracia' y 'Cancelada sin gracia' solo existen como tarjetas compactas de 20px de alto dentro del frame de 'los 5 estados' (líneas 2847-2848), sin que se pueda verificar cómo se comportan ahí el Bloque 2 (qué incluye) ni el Bloque 3 (método de pago) que el brief condiciona a estos estados.

> **Evidencia:** Páginas completas solo para 3 de 5 estados: líneas 2708-2742 (sin suscripción), 2744-2774 (activa), 2776-2806 (pago fallido). 'En gracia' y 'Cancelada' solo como swatch: líneas 2847-2848. Brief (mockup-v2.md l.263-269) define 5 estados de Bloque 1 con contenido propio cada uno.

### 🟡 Media · CT2 — Falta el modal de confirmación de reactivación ('¿Reactivar por $11.99/mes?')

El brief especifica un paso de confirmación explícito antes de reactivar cuando el método de pago sigue guardado: '¿Reactivar por $11.99/mes? → cobro inmediato → acceso restaurado al instante'. El mockup construye un modal dedicado y detallado para la cancelación (líneas 2808-2839, con consecuencias enumeradas y dos CTAs) pero no existe ningún modal equivalente para la reactivación dentro de CT2 — solo aparece un botón 'Reactivar' suelto en el swatch (líneas 2847-2848) sin paso de confirmación. El único texto sobre 'cobro inmediato' que existe en el archivo pertenece a SB1 (línea 855), que es un flujo distinto (gate de suscripción al conectar una IA, no el botón 'Reactivar' de CT2).

> **Evidencia:** Modal de cancelación sí existe: líneas 2808-2839. Ningún modal de reactivación en CT2; único texto relacionado está en SB1 (línea 855, fuera de CT2). Brief (mockup-v2.md l.320-322): "Si el método de pago sigue válido: confirmación directa '¿Reactivar por $11.99/mes?' → cobro inmediato → acceso restaurado al instante".

### 🟡 Media · CT4 — El slide-over de ayuda omite por completo el control 'Adjuntar screenshot'

La versión pantalla-completa de CT4 incluye el control de adjuntar captura (línea 2890: 'Adjuntar screenshot' con etiqueta 'opcional'). El slide-over, que según el brief 'abre el mismo panel', reproduce Categoría/Asunto/Mensaje/Enviar (líneas 2935-2938) pero no incluye en absoluto el control de adjuntar screenshot, pese a que sería especialmente útil reportar un problema visual sin abandonar la pantalla donde ocurrió.

> **Evidencia:** Formulario completo con adjuntar screenshot: línea 2890. Formulario del slide-over sin ese control: líneas 2935-2938. Brief (mockup-v2.md l.419): "Ambos abren el mismo panel."; l.430: "Adjuntar screenshot (opcional)" listado como parte del formulario de ticket.

## Navegación (arquitectura de información)

### 🔴 Alta · C1/F1/P2/N1 (mobile) — La barra de navegación inferior móvil (Memoria/Pulso/Conexiones/Fuentes) solo existe en M1 y P1 móvil; el resto de secciones no la tiene

El patrón de bottom-nav de 4 ítems con el activo resaltado aparece en 'M1 móvil · Lista' (líneas 1643-1648) y en 'P1 móvil' (líneas 2008-2013), pero está ausente en 'C1 móvil' (líneas 2189-2202), 'F1 móvil' (líneas 2416-2429), 'P2 móvil' (líneas 2102-2113) y 'N1 móvil' (líneas 2489-2501): estos frames terminan en el propio contenido de la pantalla sin ningún control para saltar a otra sección. Esto es consistente con (y amplía) el hallazgo ya reportado de que 'P2 móvil no tiene ninguna forma de volver a otras secciones', pero el problema no es exclusivo de P2 — Conexiones y Fuentes móvil tienen el mismo vacío, y S1 define la navegación móvil como 'accesible (drawer); búsqueda accesible; nunca se oculta sin alternativa' (mockup-requirements.md L114), regla que estos frames no cumplen.

> **Evidencia:** mockup-decoded.html L1643-1648 (bottom nav presente en M1 móvil), L2008-2013 (bottom nav presente en P1 móvil) vs. L2189-2202 (C1 móvil sin bottom nav), L2416-2429 (F1 móvil sin bottom nav), L2102-2113 (P2 móvil sin bottom nav), L2489-2501 (N1 móvil sin bottom nav); mockup-requirements.md L114 ('Móvil: navegación accesible... nunca se oculta sin alternativa')

## Modelo freemium

### 🔴 Alta · C1 / S1 / P1 — No existe ningún estado visual para 'IAs desconectadas por falta de suscripción' (distinto de 'nunca conectado' o 'token inválido')

El corazón del modelo freemium en v2 es que, al cancelar sin reactivar o al vencer la gracia, 'las IAs se desconectarán' (texto literal de CT2 y de la confirmación de cancelación) pero la memoria permanece intacta. Sin embargo, ningún estado de C1, S1 o P1 ilustra ese momento: C1 solo tiene 'con conexiones (una con problema · token inválido)', 'sin conexiones' y 'cargando'; S1 solo tiene 'sin conexiones' (genérico) y 'con conexiones'; P1 solo tiene 'con actividad', 'sin actividad' y 'cargando'. No hay un frame que muestre, por ejemplo, en C1 tarjetas de Claude/Cursor con badge 'Desconectada — tu suscripción venció' (distinto del badge 'Con problema' de token inválido), ni en P1 un mensaje de silencio que diga 'tus IAs se desconectaron el 19 de julio — reactiva para que vuelvan a leer y recordar' en vez del genérico 'Conecta una IA para empezar el pulso'. Sin ese estado, el usuario que vive exactamente el escenario central del negocio (dejar de pagar) no tiene ninguna pantalla que le explique visualmente qué le pasó a sus conexiones.

> **Evidencia:** CT2 promete el efecto ('Después de esa fecha tus IAs se desconectarán, pero toda tu memoria se conserva' L2832; 'Acceso hasta el 14 jul. Después, las IAs se desconectan' L2847) pero C1 solo lista estados 'Con conexiones (una con problema)' L2120, 'Sin conexiones' L2149 y 'Cargando' L2170; P1 solo lista 'Con actividad' L1877, 'Sin actividad' L1942 y 'Cargando' L1968 — ninguno atribuido a vencimiento de suscripción.
