# Errores de diseño y UX — dentro del propio mockup

Inconsistencias, contradicciones y defectos de UX encontrados **dentro del mockup mismo** — no contra el brief, sino comparando el mockup contra sí mismo: números que no cuadran, patrones aplicados en una pantalla y omitidos en otra, copy que se contradice, navegación que no coincide con lo que el propio documento declara.

**Total: 55 hallazgos verificados.**

| Sección | Cantidad |
|---|---|
| Cover + Flujos principales | 2 |
| Auth (A1, A2) | 3 |
| Suscripción (SB1) | 2 |
| Shell (S1) | 4 |
| Onboarding (O1–O5) | 6 |
| Memoria (M1–M6) | 5 |
| Pulso (P1, P2) | 4 |
| Conexiones (C1, C2, C3) | 3 |
| Fuentes (F1) | 3 |
| Bandeja (N1) | 2 |
| Colectivo + Área unificada | 1 |
| Cuenta (CT1–CT4) | 5 |
| Patrones transversales | 2 |
| Navegación (arquitectura de información) | 1 |
| Copy y tono de marca | 8 |
| Modelo freemium | 4 |

---

## Cover + Flujos principales

### 🟡 Media · SB1 (Flujo 1 y Flujo 3) — El badge de SB1 usa lima como superficie dominante sobre fondo claro, contradiciendo la propia 'regla del lima' declarada en el Cover

El Cover, en la misma página, declara explícitamente dos reglas: (a) visualmente, en la tarjeta 'La regla del lima' (líneas 383-389): 'El lima solo brilla sobre lo oscuro'; y en el subtítulo del hero (línea 356): 'superficies ink de firma donde brilla el lima'; y (b) semánticamente, en la leyenda de la sección de Flujos (línea 394): 'Lima = el camino feliz'. Sin embargo, el badge de SB1 en los Flujos 1 (línea 407) y 3 (línea 429) rompe ambas reglas a la vez: pinta la píldora completa en lima sólido (background:#E7FF18) apoyada directamente sobre el fondo claro de la tarjeta (#F8F8F6/#fff) — exactamente la superficie que la regla del lima prohíbe — e invierte la convención usada para los nodos de 'camino feliz' reales (M1, CO1, P1, N1: fondo ink oscuro + chip lima pequeño). Además, SB1 es un gate de pago (una fricción, no el camino feliz), por lo que darle el tratamiento visual más lima-saturado de todo el diagrama contradice también la leyenda semántica del propio mapa de flujos.

> **Evidencia:** Línea 356: 'Lienzo claro de trabajo, puntuado por superficies ink de firma donde brilla el lima.' · Líneas 384-387 ('La regla del lima'): 'El lima solo brilla sobre lo oscuro.' · Línea 394: 'Lima = el camino feliz.' · Línea 407 y línea 429: badge SB1 con `background:#E7FF18` (pastilla completa) sobre tarjeta de fondo claro, en vez del patrón ink+chip-lima usado en M1/CO1/P1/N1.

### 🟡 Media · M2 → M3 (Flujo 2, Uso diario) — El flujo 'Uso diario' enruta la apertura de un recuerdo desde M2 hacia M3 (Crear área) en vez de M6 (Recuerdo individual)

En el Flujo 2, la fila 'área en mapa → M2 detalle → M3 · P2 · CO6' (línea 417) reproduce textualmente el árbol de mockup-v2.md (línea 48: '├─ recuerdo → M3'). Pero según la propia taxonomía de pantallas del brief, M3 es 'Crear área' (mockup-requirements.md, sección M3: 'crear un lugar propio en tu memoria... solo nombra un lugar') y M6 es 'Recuerdo individual' ('ver y gestionar un recuerdo puntual'). El propio M5 (Búsqueda) confirma el destino correcto: 'abrir un resultado → recuerdo (M6)'. Abrir un recuerdo desde el panel de un área (M2) no puede llevar lógicamente a la pantalla de creación de áreas; el destino correcto es M6. El mockup no corrige este error heredado de v2 y lo deja como parte del mapa de navegación oficial.

> **Evidencia:** HTML línea 417: '...M2</b>detalle...→...M3 · P2 · CO6'. Cf. mockup-v2.md línea 48 ('recuerdo → M3'); mockup-requirements.md definición de M3 (~línea 245-252, 'Crear área') vs. M6 (~línea 276-282, 'Recuerdo individual') y M5 (~línea 273, 'abrir un resultado → recuerdo (M6)').

## Auth (A1, A2)

### 🟡 Media · A2 (desktop + móvil, todas las variantes) — El indicador "Paso 1 de 2" nunca avanza a "Paso 2 de 2" al pasar de A1 a A2

Las seis variantes de A1 (idle/loading/error, desktop y móvil) muestran "Paso 1 de 2 · Entrar", y las seis variantes de A2 (idle/error/validating, desktop y móvil) muestran exactamente el mismo texto "Paso 1 de 2 · Entrar" — nunca incrementa a "Paso 2 de 2" pese a que A2 es el segundo paso del login (ingresar el código, después de haber enviado el email). El propio mockup demuestra que sabe hacerlo bien en otra pantalla: C2 (Nueva conexión) sí incrementa correctamente de "Paso 1 de 2" (línea 2210) a "Paso 2 de 2 · Claude del trabajo" (línea 2226) entre sus dos pasos. Esto confirma que el patrón existe en el sistema pero no se aplicó en AUTH, dejando al usuario sin señal de progreso real dentro del login.

> **Evidencia:** Líneas 530,558,586,609,627,645 (A1, todas "Paso 1 de 2 · Entrar") vs líneas 671,702,734,759,783 (A2, también "Paso 1 de 2 · Entrar" — debería ser "Paso 2 de 2"). Contraste con el uso correcto en C2: línea 2210 "Paso 1 de 2" → línea 2226 "Paso 2 de 2 · Claude del trabajo".

### 🟡 Media · A1 — El copy de error de email contradice el propio dato de ejemplo que lo dispara

En el estado de error de A1 (desktop y móvil), el campo muestra value="tomas@estudio" y el mensaje de error dice "Revisa tu email — falta algo después de la @" (desktop) / "Falta algo después de la @." (móvil). Pero después de la @ en el ejemplo SÍ hay contenido ("estudio"); lo que realmente falta es el punto y el dominio/TLD (ej. ".co"). El copy describe una condición ("nada después de la @") que el propio ejemplo no cumple, lo que puede llevar a implementar una validación equivocada (ej. solo chequear que exista texto tras la @, que ya se cumple en el ejemplo mostrado) o a que el usuario no entienda qué corregir.

> **Evidencia:** Línea 591 (input value="tomas@estudio") + línea 592 ("Revisa tu email — falta algo después de la @."); línea 648 (mismo value en móvil) + línea 649 ("Falta algo después de la @."). Brief: mockup-requirements.md línea 74 "error (email inválido / red)" no especifica el mensaje, pero exige que el error sea correcto y accionable.

### 🟡 Media · A2 — El foco inicial de las celdas del código OTP recae en la 2ª celda, no en la 1ª

En el estado "Inicial" de A2 (antes de que el usuario escriba nada), las 6 celdas del código están vacías, pero la segunda celda tiene un borde distintivo (#0B2529, color de foco) mientras la primera y las demás usan el borde neutro (#DDDFDC). Esto ocurre igual en desktop y en móvil. El brief pide "avance automático al tipear" (mockup-requirements.md línea 85), lo que implica que el cursor/foco debe iniciar en la primera celda vacía, no en la segunda — tal como está dibujado, sugiere (incorrectamente) que la primera celda ya fue completada o saltada.

> **Evidencia:** Desktop: líneas 675 (celda 1, borde #DDDFDC) y 676 (celda 2, borde #0B2529) dentro del bloque "A2 · Código — Inicial" (línea 657). Móvil: líneas 763 (celda 1) y 764 (celda 2) dentro de "A2 móvil · Inicial" (línea 751).

## Suscripción (SB1)

### 🔴 Alta · SB1 — El estado 'cancelada / reactivar' rompe el patrón de modal-con-contexto-preservado y no ofrece forma de descartarlo, contradiciendo el propio principio 'no es un muro'

El gate inicial ('sin suscripción', líneas 804-842) sigue correctamente el patrón especificado: se renderiza como modal sobre un fondo atenuado que preserva la pantalla de origen (líneas 808-813, comentario '<!-- contexto detrás (preservado) -->') y tiene un icono de cierre (X) explícito (línea 816) que permite descartarlo sin perder el contexto, en línea con 'se presenta como modal o pantalla intermedia, sin perder el contexto actual' y con el principio freemium 'la suscripción no bloquea el acceso al producto — bloquea la conexión con IAs'. El estado 'cancelada' (líneas 844-857), en cambio, se renderiza como una pantalla completa aislada (background:#0B2529 a pantalla completa, sin overlay, sin fondo de otra pantalla detrás) y no incluye ningún icono de cierre, botón 'más tarde' ni forma de volver a donde estaba — solo el CTA 'Reactivar'. Esto contradice: (a) la definición de SB1 ('se presenta como modal o pantalla intermedia, sin perder el contexto actual'), (b) el diagrama de flujo 3 que exige la rama 'cancela → vuelve a donde estaba (sin perder contexto)' para cualquier presentación de SB1, y (c) el principio explícito de que SB1 'debe ganarse el pago... no imponiendo un bloqueo' — visualmente comunica un muro total de la app en vez de un gate contextual y reversible, justo lo opuesto de lo que el brief pide para esta pantalla.

> **Evidencia:** Gate inicial con contexto preservado + cierre: líneas 808-813 y 816. Estado 'cancelada' sin contexto ni cierre: líneas 847-857 (ningún icono de cierre, ningún fondo de otra pantalla, layout de pantalla completa). Brief: 'Se presenta como modal o pantalla intermedia, sin perder el contexto actual' y 'La pantalla debe ganarse el pago explicando qué cambia al suscribirse, no imponiendo un bloqueo' (mockup-v2.md, SB1 > Propósito/Cuándo se activa); 'La suscripción no bloquea el acceso al producto — bloquea la conexión con IAs' (mockup-v2.md, Modelo de negocio); diagrama de flujo 3: 'cancela → vuelve a donde estaba (sin perder contexto)'.

### ⚪ Baja · SB1 — La reactivación cobra 'de inmediato' al primer clic, sin el paso de confirmación que describe el propio flujo de reactivación

El botón 'Reactivar — $11.99/mes' (línea 854) va acompañado del texto 'Tu método de pago sigue guardado · cobro inmediato' (línea 855), es decir, un solo clic dispara el cargo. El flujo de reactivación descrito en el brief para este mismo camino (método de pago guardado) especifica un paso intermedio: 'confirmación directa "¿Reactivar por $11.99/mes?" → cobro inmediato → acceso restaurado'. El mockup colapsa ese paso de confirmación en el propio botón de acción (que ya muestra el precio), por lo que no queda claro si existe o no una interacción de confirmación real antes del cargo, o si el clic en 'Reactivar' cobra directamente sin ningún paso intermedio — dejando ambigua una decisión de UX que el brief sí especifica como un paso separado.

> **Evidencia:** Botón + subtexto de cobro inmediato: líneas 854-855. Brief: 'Si el método de pago sigue válido: confirmación directa "¿Reactivar por $11.99/mes?" → cobro inmediato → acceso restaurado al instante' (mockup-v2.md, CT2 > Flujo de reactivación).

## Shell (S1)

### 🔴 Alta · S1 (móvil) — El estado móvil "default" no tiene ningún disparador para abrir el drawer

El header del frame "S1 móvil · default" (L1026-1029) contiene solo: logo, ícono de ayuda, campana y el campo de búsqueda — ningún ícono de menú/hamburguesa u otro control que abra el drawer de navegación mostrado en el frame contiguo ("S1 móvil · Drawer de navegación", L1048-1064). Los dos frames están etiquetados como estados del mismo componente S1, pero no hay ninguna afordancia visible en el primero que lleve al segundo: la navegación secundaria (drawer) queda huérfana, sin mecanismo de apertura definido.

> **Evidencia:** HTML L1026-1029 (header móvil default, sin hamburguesa): '<svg ...saviaMark/><span>SAVIA</span><div title="Ayuda"...><div ...bell...>' seguido directo del buscador en L1028; comparar con L1050 donde el drawer aparece como frame separado sin relación visual ("S1 móvil · Drawer de navegación") con el anterior.

### 🟡 Media · S1 — Triple CTA redundante para "conectar tu primera IA" en el estado sin conexiones

El brief de personalidad exige "jerarquía clara, una acción principal por pantalla" (requirements.md L39-40). En el frame de escritorio "S1 — Sin conexiones" (L911-961) coexisten, visibles simultáneamente sin scroll, tres botones para la misma acción: el CTA persistente del header "Conectar IA" (L944), la tarjeta del rail "Conectar mi primera IA" (L928) y el hero del main "Conectar mi primera IA" (L955). Más allá del botón de header (que el propio brief pide que sea siempre accesible, L108), duplicar la misma invitación como dos bloques promocionales grandes (rail + hero) en la misma vista contradice el principio de una sola acción principal por pantalla.

> **Evidencia:** requirements.md L39-40: "Calma: jerarquía clara, una acción principal por pantalla, mucho aire." HTML: L944 ("Conectar IA"), L928 ("Conectar mi primera IA"), L955 ("Conectar mi primera IA") — los tres visibles en el mismo frame de 860px sin overflow (L914: overflow:hidden).

### ⚪ Baja · S1 — Copy inconsistente entre escritorio y móvil para los mismos elementos globales

El placeholder del buscador global cambia de "Busca cualquier recuerdo o área…" en escritorio (L938, L988) a "Busca en tu memoria…" en móvil (L1028); el tooltip del ícono de ayuda cambia de "Ayuda y soporte" en escritorio (L942, L993) a solo "Ayuda" en móvil (L1027). Son el mismo elemento global (búsqueda siempre visible, ícono de ayuda de v2) descrito una sola vez en el brief, por lo que no hay justificación funcional para que el copy varíe según el breakpoint.

> **Evidencia:** HTML L938/L988 ("Busca cualquier recuerdo o área…") vs L1028 ("Busca en tu memoria…"); L942/L993 (title="Ayuda y soporte") vs L1027 (title="Ayuda").

### ⚪ Baja · S1 — El ícono de campana no tiene etiqueta accesible, a diferencia del ícono de ayuda contiguo

En las tres apariciones del ícono de campana (L943, L994, L1027) no hay atributo `title` ni equivalente textual, mientras que el ícono de ayuda inmediatamente adyacente en cada uno de esos mismos header sí lo tiene (`title="Ayuda y soporte"` / `title="Ayuda"`, L942, L993, L1027). Es una inconsistencia puntual dentro del mismo grupo de íconos del header, no una observación genérica de accesibilidad.

> **Evidencia:** HTML L942 (`title="Ayuda y soporte"`) seguido de L943 (bell sin `title`); mismo patrón en L993/994 y dentro de L1027 (help con `title="Ayuda"` y bell sin title en la misma línea).

## Onboarding (O1–O5)

### 🔴 Alta · O2 — Los números de la celebración de éxito no cuadran entre sí

En O2 · éxito, el número grande dice "247 recuerdos guardados", pero los 5 chips de área que se listan a continuación (Trabajo·64, Proyectos·41, Lecturas·33, Recetas·22, Viajes·18) suman solo 178 — una diferencia de 69, sin ningún indicador de "+N áreas más" que explique el resto. Esto rompe el patrón que sí es correcto en la pantalla equivalente de O3 (Rescatar · resultado), donde los chips (28+17+11+7=63) coinciden exactamente con el número grande ("63 recuerdos creados"), lo que confirma que se trata de un error aritmético real y no de una vista parcial intencional.

> **Evidencia:** HTML línea 1218 ("247" recuerdos guardados) vs líneas 1221-1225 (64+41+33+22+18=178); contraste con línea 1281 ("63" recuerdos creados) vs líneas 1284-1287 (28+17+11+7=63, exacto).

### 🟡 Media · O4 — El copy visible para el usuario expone el código interno de pantalla "(SB1)"

La nota de suscripción en O4 dice literalmente: "Conectar requiere suscripción — $11.99/mes. Al pulsar te mostramos el detalle (SB1)." "SB1" es el código de pantalla que usa el propio brief para identificar internamente el gate de suscripción; es una anotación de diseño que se filtró al copy que vería el usuario final, algo que nunca debería aparecer en producción.

> **Evidencia:** HTML línea 1307: "Al pulsar te mostramos el detalle (SB1)."

### 🟡 Media · O4 — El selector de cliente de O4 no reutiliza completamente la lista de C3

El brief indica que O4 "reutiliza la guía por cliente (C3)". C3 define su selector como "Claude Code, Claude Desktop, Cursor, Windsurf, ChatGPT, 'otro cliente compatible'" (6 opciones). El selector mostrado en O4 solo ofrece 4: Claude Code, Claude Desktop, Cursor y ChatGPT — faltan Windsurf y "otro cliente compatible".

> **Evidencia:** mockup-requirements.md línea 166-167 ("Reutiliza la guía por cliente (C3)") y línea 366 (lista completa de C3: "Claude Code, Claude Desktop, Cursor, Windsurf, ChatGPT, 'otro cliente compatible'"); HTML líneas 1310-1314 (solo 4 opciones listadas en O4).

### 🟡 Media · O1-O5 — El stepper de progreso pierde pasos ya completados a medida que avanza el recorrido

O1 y las variantes "vacío" de O2/O3 muestran el stepper completo de 4 pasos (círculos + líneas conectoras, "Bienvenida" marcada como completada). Al llegar a O4 "sin conectar" el indicador se reduce a un texto plano de solo 3 elementos ("Poblar · Conectar · Listo"), omitiendo "Bienvenida". En O5 se reduce aún más, a solo 2 elementos ("Conectar · Listo"), omitiendo también "Poblar". El usuario pierde la referencia visual del recorrido completo justo en los pasos más críticos (conectar la IA y el cierre), lo que es inconsistente con el propio requisito de que "el progreso se persiste" a lo largo de todo el onboarding.

> **Evidencia:** HTML líneas 1076-1082 (O1, 4 pasos con círculos y líneas conectoras) y 1145-1153 (O2 vacío, 4 pasos) vs línea 1300 (O4 sin conectar: solo "Poblar · Conectar · Listo") y línea 1368 (O5: solo "Conectar · Listo").

### 🟡 Media · O1 — En mobile, ninguna de las 3 tarjetas de O1 conserva el botón de acción que tiene en desktop

En O1 desktop, cada una de las 3 tarjetas ("Importar conversaciones", "Rescatar con un prompt", "Empezar vacío") tiene su propio botón explícito ("Importar", "Rescatar", "Saltar por ahora →"). En la versión móvil de O1, las mismas 3 tarjetas se muestran solo con badge/título/descripción, sin ningún botón — no hay afordancia visual de que la tarjeta sea tappable ni de qué acción dispara al tocarla.

> **Evidencia:** HTML líneas 1096, 1102, 1108 (botones explícitos en las 3 tarjetas de O1 desktop) vs líneas 1127-1133 (las mismas 3 tarjetas en O1 móvil, sin ningún botón).

### ⚪ Baja · O2 — Se usa la misma inicial "G" para representar a ChatGPT y a Gemini

En la guía "Cómo exportar" y en la cola de procesamiento, el badge de ChatGPT usa la letra "G" (verde) y el de Gemini también usa "G" (azul). Aunque el color distingue a ambos, usar la misma inicial para dos servicios distintos —y que además no corresponde a ninguno de los dos, ya que ChatGPT no empieza con G— es una elección de copy confusa, sobre todo comparado con Claude, que sí usa su inicial correcta ("C") en los mismos listados.

> **Evidencia:** HTML línea 1171 (ChatGPT, badge "G", bg #10A37F) y línea 1173 (Gemini, badge "G", bg #4285F4); repetido en línea 1195 (chatgpt-export.zip con badge "G" en la cola de procesamiento).

## Memoria (M1–M6)

### 🔴 Alta · M1 / M2 — El área "Recetas" tiene tres conteos de recuerdos contradictorios entre mapa, lista y panel de área

En el mapa de M1 con datos, la burbuja "Recetas" muestra 64 recuerdos. En la vista M1 lista (toggle) del mismo estado "con datos", la fila "Recetas" no existe (la lista solo tiene 6 filas). Y en el panel M2 usado como ejemplo de "sin recuerdos", el área se llama también "Recetas" y se etiqueta con "0 recuerdos" y el mensaje "Aún no hay recuerdos aquí". Son tres representaciones de la misma área con datos incompatibles (64 / ausente / 0) dentro del mismo documento, sin que se trate de estados temporales distintos explicados (mapa y lista se presentan como el mismo estado "con datos", solo cambia el toggle).

> **Evidencia:** HTML línea 1476 (mapa: "Recetas...64"); líneas 1557-1562 (lista: filas Trabajo/Proyectos/Savia OS/Clientes/Personal/Lecturas, sin fila Recetas); línea 1671 (M2: "Recetas"... "0 recuerdos", "Aún no hay recuerdos aquí"). Brief: M1 exige que mapa y lista sean vistas alternativas de los mismos datos ("Toggle mapa / lista: una lista de todas las áreas... como alternativa rápida al mapa").

### 🔴 Alta · M1 — La vista de lista de M1 no incluye todas las áreas que muestra el mapa del mismo estado

El header de M1 (mapa y lista) declara "9 áreas" y el mapa dibuja 9 burbujas nombradas (Trabajo, Proyectos, Clientes, Savia OS, Lecturas, Recetas, Personal, Recursos, Viajes). La vista de lista del mismo estado "con datos" solo renderiza 6 filas (Trabajo, Proyectos, Savia OS, Clientes, Personal, Lecturas), omitiendo Recetas, Recursos y Viajes. El brief define la lista como "una lista de todas las áreas" — una alternativa completa al mapa, no un subconjunto.

> **Evidencia:** HTML línea 1551 ("9 áreas" en el header de la vista lista); líneas 1557-1562 (solo 6 filas); comparar con mapa líneas 1466-1482 (9 burbujas). Brief mockup-requirements.md línea 208: "Toggle mapa / lista: una lista de todas las áreas (nombre, conteo, ordenable) como alternativa rápida al mapa para escanear/gestionar a escala".

### 🔴 Alta · M2 — M2 "sin recuerdos" omite por completo el panel de Acceso (Personas/IAs) y las acciones Compartir/⋯ que su propio skeleton de carga anticipa

En el estado "sin recuerdos" de M2 (Recetas), el contenido es una sola columna centrada con el mensaje vacío — no hay panel lateral de "Acceso" (ni Personas ni "IAs que la ven"), ni botón "Compartir", ni menú "⋯" de acciones (renombrar más allá del lápiz inline, dividir, fusionar, marcar sensible, eliminar). Esto contradice al propio estado "cargando" de M2, que sí reserva una columna skeleton de 330px para ese panel (el mismo ancho que usa el panel de Acceso en la plantilla de referencia), revelando que el diseño lo esperaba ahí. El brief lista "¿Quién ve esta área?" y las "Acciones (corrección)" como elementos permanentes de M2, no condicionados a tener recuerdos.

> **Evidencia:** HTML líneas 1668-1673 (sin recuerdos: una sola columna, sin rail de Acceso ni botones Compartir/⋯); línea 1700 (skeleton de carga: `<div style="width:330px">...` reservando la columna); líneas 3045-3048 y 3061-3075 (plantilla de referencia: botones "Compartir"/"⋯" en el header y panel de Acceso de 330px con Personas + "IAs que la ven"). Brief mockup-requirements.md líneas 236-241: "¿Quién ve esta área?... Acciones (corrección): renombrar, dividir, fusionar..., marcar sensible, compartir con personas..., eliminar".

### 🟡 Media · M2 — La pestaña "Personas" se muestra activa y con contador en áreas privadas, contradiciendo la propia anotación de diseño de "capa apagada"

El mockup rotula explícitamente la plantilla de área privada como "capa de Personas apagada" y explica que "Compartir solo enciende la capa de Personas". Sin embargo, en las dos instancias renderizadas de área privada (la usada como M2 "sin recuerdos" y la plantilla de referencia rotulada "Área — Privada (capa Personas apagada)"), la pestaña "Personas" aparece igual de visible, con el mismo layout y un badge de conteo ("1"), que en la versión colectiva ("Personas 5"); solo cambia el color del badge. Nada en el render indica que la capa esté realmente apagada/oculta. Esto también contradice el brief original de M2, que dice que la sección de personas solo aplica "si es colectiva".

> **Evidencia:** HTML línea 3018-3019 (anotación: "una privada es una colectiva con un solo miembro y la capa de Personas apagada" / "Compartir solo enciende la capa de Personas"); línea 3023 (label "Área — Privada (capa Personas apagada)"); línea 3051 (tab "Personas" con badge "1" totalmente visible); línea 1671 (mismo patrón en el M2 "sin recuerdos", área "Recetas" etiquetada "Privada" con tab "Personas 1"). Brief mockup-requirements.md línea 238: "...aquí es el atajo en contexto. Si es colectiva, también las personas (→ CO2)".

### ⚪ Baja · M2 — El buscador de M2 usa el placeholder genérico de toda la app en vez del placeholder contextual al área, que la propia plantilla de referencia sí usa

En M2 "sin recuerdos" el campo de búsqueda muestra el placeholder genérico "Busca cualquier recuerdo o área…", igual que en M1. La plantilla de referencia de área unificada (usada para M2 con datos) usa en cambio "Busca en Trabajo…", es decir, contextualiza el placeholder al nombre del área activa. La instancia de M2 dentro de la sección MEMORIA no sigue ese patrón contextual ya establecido por el propio mockup para la misma pantalla.

> **Evidencia:** HTML línea 1667 ("Busca cualquier recuerdo o área…" dentro del panel de "Recetas"); línea 3036 ("Busca en Trabajo…" en la plantilla de referencia de área).

## Pulso (P1, P2)

### 🔴 Alta · P2 (nav) — P2 ("¿Qué ve cada IA?") vive bajo la sección de navegación Conexiones, contradiciendo la arquitectura de información canónica del brief

El mockup marca explícitamente, dos veces, que movió el acceso fuera de Pulso: "la pestaña Acceso (¿qué ve cada IA?) ahora vive bajo Conexiones, no aquí" (nota junto al título de Pulso) y "el acceso de cada IA vive en Conexiones" (subtítulo de la sección). En consecuencia, en P2 el ítem de sidebar resaltado es "Conexiones" (no "Pulso"), y los tabs superiores son "Tus conexiones | Acceso". Esto contradice: (a) la tabla de arquitectura de información del brief, que ubica "acceso/auditoría" dentro de PULSO; (b) el texto explícito de la sección CONEXIONES: "Solo conectar tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso"; y (c) el flujo #9 de v2 ("S1 → Pulso → P1 ... → 'Acceso' → P2"), que muestra que se llega a P2 haciendo clic en "Acceso" **dentro de Pulso**, no dentro de Conexiones. Ni v1 ni v2 autorizan este cambio de sección — es una desviación del propio mockup respecto al brief canónico, y además P1 no ofrece ningún tab o enlace "Acceso" que permita llegar a P2 desde Pulso como indica el flujo.

> **Evidencia:** HTML línea 1873 (nota adhesiva) y línea 1872 (subtítulo de sección) vs. mockup-requirements.md línea 48 ("PULSO ← ... + acceso/auditoría") y línea 336 ("Solo conectar tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso"); mockup-v2.md líneas 161-170 (flujo 9: Pulso → P1 → "Acceso" → P2). Confirmado en HTML líneas 2026 (nav activo = Conexiones) y 2032 (tabs "Tus conexiones | Acceso"); P1 (líneas 1876-2015) no tiene ningún tab/enlace "Acceso".

### 🔴 Alta · P2 (mobile) — P2 móvil no tiene ninguna forma de volver a otras secciones (sin bottom nav, sin flecha de volver)

Todas las demás pantallas móviles de esta sección (p. ej. P1 móvil) incluyen la barra de navegación inferior persistente (Memoria / Pulso / Conexiones / Fuentes). P2 móvil, en cambio, solo tiene el header con logo + tabs "Tus conexiones | Acceso" y termina directamente en el contenido de las tarjetas, sin bottom nav ni botón de retroceso. Esto viola el requisito explícito del shell para móvil: "navegación accesible (drawer); búsqueda accesible; **nunca se oculta sin alternativa**". Un usuario que llega a P2 en móvil queda sin ruta visible de regreso a Memoria/Pulso/Fuentes.

> **Evidencia:** HTML líneas 2102-2113 (P2 móvil, sin bottom nav) comparado con líneas 1995-2015 (P1 móvil, que sí incluye el bottom nav en líneas 2008-2013) vs. mockup-requirements.md línea 114 ("Móvil: navegación accesible (drawer); búsqueda accesible; nunca se oculta sin alternativa").

### 🟡 Media · P2 — El control "Puede contribuir (escribir recuerdos)" solo existe para Claude, no para Cursor, pese a que el brief exige que sea visible y configurable para cada IA

El brief pide, como elemento propio de P2: "Capacidad de contribución: si esa IA puede agregar memoria (escritura), visible y configurable" — para cada IA conectada. En la tarjeta de Claude aparece el toggle "Puede contribuir (escribir recuerdos)" activado. La tarjeta de Cursor, en cambio, omite por completo esa fila/control: solo muestra "Puede leer" y el botón "Editar acceso", sin ningún toggle de contribución (ni activado ni desactivado). Esto rompe la exigencia de que la capacidad de escritura sea "visible y configurable" para todas las IAs — un usuario no tiene forma, desde esta pantalla, de otorgarle a Cursor permiso de escritura si quisiera.

> **Evidencia:** mockup-requirements.md líneas 322-323 ("Capacidad de contribución ... visible y configurable") vs. HTML línea 2043 (toggle presente en la tarjeta de Claude) y línea 2047 (tarjeta de Cursor, sin ningún control de contribución).

### ⚪ Baja · P2 (mobile) — Inconsistencia de iconografía: la señal de "sensible" usa un ícono SVG en desktop pero un emoji de texto en móvil

En la variante desktop de P2, la etiqueta de sensibilidad se resuelve con un ícono SVG de candado dibujado ("Personal · sensible", con <svg> de candado). En la variante móvil, la misma señal se resuelve con el emoji de texto "🔒" incrustado en la etiqueta ("Personal 🔒"), mezclando dos sistemas de iconografía distintos para la misma señal de cuidado entre breakpoints del mismo producto.

> **Evidencia:** HTML línea 2040 (ícono SVG de candado en "Personal · sensible", desktop) vs. línea 2108 ("Personal 🔒" con emoji, móvil).

## Conexiones (C1, C2, C3)

### 🔴 Alta · C1 / C2 / C3 — "Acceso" vive dentro de Conexiones, contradiciendo la arquitectura de información del brief

El brief es explícito: la sección Conexiones es "Solo conectar tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso", y P2 (dentro de Pulso) es descrito como "el hogar del acceso". El mockup, sin embargo, rotula la sección entera como "C1–C3 + Acceso · conectar tus IAs y decidir qué ve cada una", incorpora una pestaña "Acceso" dentro del propio header de Conexiones (junto a "Tus conexiones"), y repite dos veces el copy "Conexiones → Acceso" como referencia de dónde configurar permisos. Esto es una contradicción interna consistente (aparece 4 veces), no un desliz aislado: el usuario buscaría el control de acceso en un lugar distinto al que el brief define como su "hogar".

> **Evidencia:** mockup-requirements.md L336: "Solo conectar tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso." L316-317: P2 es "la vista consolidada del acceso... Es el 'hogar' del acceso". HTML L2116: "CONEXIONES ... C1–C3 + Acceso · conectar tus IAs y decidir qué ve cada una"; L2134: pestañas "Tus conexiones" / "Acceso" dentro del header de Conexiones; L2234: "El acceso de lectura lo configuras luego en Conexiones → Acceso."; L2283: "...hasta que le des acceso en Conexiones → Acceso."

### 🟡 Media · C1 — "Revocar" no tiene paso de confirmación en ningún estado mostrado

El brief pide explícitamente "revocar (con confirmación)" como parte del ítem de lista de C1, y el patrón transversal exige que toda acción destructiva o irreversible pida confirmación. En las tres tarjetas de conexión de escritorio, el botón "Revocar" no tiene ningún modal, paso intermedio o estado asociado que confirme la acción antes de ejecutarla — es un botón de un solo clic que corta el acceso de una IA de inmediato.

> **Evidencia:** mockup-requirements.md L345: "...y revocar (con confirmación); acceso a la guía (C3)." L580 (patrón transversal): "Confirmación: las acciones destructivas o irreversibles siempre piden confirmación." HTML L2138-2140: tres botones "Revocar" sin ningún estado de confirmación en todo el rango de C1 (L2119-2202).

### 🟡 Media · C1 (mobile) — En móvil, las tarjetas de Claude y Cursor no exponen ninguna acción ("Ver guía"/"Revocar")

El brief requiere que cada ítem de la lista ofrezca acceso a la guía (C3) y a revocar. En la versión móvil de C1, solo la tarjeta con problema (ChatGPT) tiene un botón ("Arreglar"); las tarjetas de Claude y Cursor —activas y sin problema— no muestran ningún botón, menú ni chevron que indique cómo llegar a "Ver guía" o "Revocar" en ese formulario. La lógica de interacción para esas dos acciones requeridas queda rota en el layout móvil tal como está dibujado.

> **Evidencia:** mockup-requirements.md L342-346 (elementos de C1, incluye "acceso a la guía (C3)" y "revocar" por cada ítem). HTML L2198-2199: tarjetas de Claude y Cursor en móvil sin botones ni afordancia de tap visible, a diferencia de la tarjeta de ChatGPT (L2197) que sí tiene "Arreglar".

## Fuentes (F1)

### 🔴 Alta · F1 (vacío/absorbiendo) — Contradicción directa: "no guardamos los archivos originales" vs. el micro-mensaje de confianza de v2

El mockup afirma dos veces, en "F1 vacío" y "F1 absorbiendo", que los archivos originales NO se guardan ("Destilamos/Destilando recuerdos. Los archivos originales no los guardamos."). Esto contradice literalmente el micro-mensaje de confianza que mockup-v2.md especifica para exactamente este momento ("Procesando fuente"): "Destilando recuerdos. Guardamos el archivo original y el procesamiento — puedes exportarlos en cualquier momento." Es la afirmación opuesta sobre si Savia retiene o no el archivo original, y además rompe la promesa de CT3 (exportar datos) de que los datos crudos "siempre son tuyos" y se pueden exportar en cualquier momento — si no se guarda el original, no hay nada que exportar de él.

> **Evidencia:** HTML línea 2316: "Destilamos recuerdos. Los archivos originales no los guardamos." y línea 2341: "Destilando recuerdos. Los archivos originales no los guardamos." vs. mockup-v2.md líneas 462-463: "*Procesando fuente:* \"Destilando recuerdos. Guardamos el archivo original y el procesamiento — puedes exportarlos en cualquier momento.\""

### 🟡 Media · F1 (con fuentes) — Conteo incorrecto: el grupo "Lecturas" dice "1 fuente" pero muestra 2 tarjetas

El encabezado del grupo "Lecturas" declara "· 1 fuente · 33 recuerdos ·", pero debajo se renderizan dos tarjetas de fuente distintas (resumen-libro.txt y notas-libro.md). Debería decir "2 fuentes", como sí hace correctamente el grupo "Trabajo" inmediatamente arriba ("· 2 fuentes · 106 recuerdos", con 2 tarjetas: reunion-q3.pdf 64 + okrs-equipo.md 42 = 106, que sí suma bien). El caso de Lecturas es una inconsistencia aritmética/de copy dentro de la misma pantalla.

> **Evidencia:** HTML línea 2383: "Lecturas ... · 1 fuente · 33 recuerdos · también alimentó Recetas" seguido en líneas 2385-2386 de dos tarjetas de fuente (resumen-libro.txt con error, notas-libro.md "Absorbida · 33 recuerdos"); compárese con línea 2376 ("Trabajo ... · 2 fuentes · 106 recuerdos") con 2 tarjetas en líneas 2378-2379 que sí cuadran.

### ⚪ Baja · F1 (absorbiendo → con fuentes) — El nombre del archivo cambia entre el frame "absorbiendo" y el frame "con fuentes"

En "F1 absorbiendo" el archivo en proceso (68%, en camino a la categoría de trabajo) se llama "reunion-estrategia-q3.pdf". En "F1 con fuentes", el archivo aparentemente equivalente ya absorbido en el grupo "Trabajo" se llama "reunion-q3.pdf" (sin "estrategia"). Si ambos frames representan la misma narrativa de progreso de una sola fuente (como sugiere su disposición contigua en el canvas de la sección), el nombre debería ser idéntico en ambos estados.

> **Evidencia:** HTML línea 2344: "reunion-estrategia-q3.pdf" (F1 absorbiendo) vs. línea 2378: "reunion-q3.pdf" (F1 con fuentes).

## Bandeja (N1)

### 🟡 Media · N1 — El badge de "no leídas" (4) es inconsistente con los 5 ítems mostrados, y ningún ítem tiene tratamiento visual de leído/no-leído

El brief exige explícitamente el estado "con notificaciones (no leídas resaltadas)", implicando que debe haber una distinción visual entre lo leído y lo no leído. En el mockup, el badge del header muestra "4", pero el panel renderiza 5 ítems en total (1 invitación + 2 sugerencias + 2 en "Al día"), y los 5 tienen exactamente el mismo tratamiento visual dentro de su categoría (mismo fondo, mismo peso de fuente, sin punto/indicador de "nuevo"). No hay ninguna forma de que el usuario identifique, mirando la pantalla, cuál de los 5 ítems es el que no cuenta para el badge — la única pista posible es inferir por la marca de tiempo ("hace 2 h" vs "ayer"), lo cual no es un tratamiento visual de "resaltado" como pide el brief.

> **Evidencia:** Brief: "con notificaciones (no leídas resaltadas)" (mockup-requirements.md, línea 434). Badge "4" en línea 2439. Ítems renderizados: invitación (línea 2443), sugerencia 1 (línea 2448), sugerencia 2 (línea 2449), "Al día" ítem 1 con timestamp "hace 2 h" (línea 2455), "Al día" ítem 2 con timestamp "ayer" (línea 2456) — total 5, sin ningún estilo (negrita, punto, fondo distinto) que diferencie leído de no leído.

### ⚪ Baja · N1 — El estado "cargando" no tiene forma de cerrarse, a diferencia de los otros dos estados del drawer

Tanto "con notificaciones" como "sin notificaciones" incluyen un ícono de cerrar (X) en el header del drawer, permitiendo al usuario descartar la bandeja en cualquier momento ("todo revisable cuando quiera", según el patrón transversal de la sección). El estado "cargando" omite ese ícono, dejando el header con solo el título "Bandeja" — sin ninguna forma visible de cerrar el panel mientras carga.

> **Evidencia:** Header con notificaciones (línea 2439) termina con el ícono de cerrar (path M6 6l12 12M18 6L6 18). Header sin notificaciones (línea 2470) también incluye el mismo ícono. Header cargando (línea 2482) es solo el div con el título "Bandeja", sin ningún ícono de cierre.

## Colectivo + Área unificada

### 🟡 Media · CO2 — El badge "Personas · 5" no coincide con la lista real de miembros, que solo tiene 4

En la pestaña Personas del área colectiva "Marca 2025", tanto el badge del tab ("Personas 5") como el stack de avatares del encabezado (A, T, M, +2 = 5 personas) afirman que hay 5 miembros. Pero el listado real de miembros bajo ese mismo encabezado solo enumera 4 personas: Tomás (tú, admin), Ana Vidal (admin), Marco Ruiz (contributor) y Lucía Paz (viewer). Falta un quinto miembro en la lista para que cuadre con el conteo mostrado en el propio tab y en la plantilla unificada (que replica el mismo "Personas · 5" con el mismo stack de avatares). Es una inconsistencia de datos verificable dentro del propio mockup, no una interpretación.

> **Evidencia:** HTML línea 2535 (badge "Personas <span>5</span>") y línea 2530 (stack de avatares A/T/M/+2) vs. líneas 2540-2543 (solo 4 filas de miembros: Tomás, Ana, Marco, Lucía). La misma discrepancia se repite en la plantilla unificada, línea 3111 ("Personas <span>5</span>") con rail que muestra 3 nombres + '+2' en el stack (línea 3106), sin que el quinto miembro aparezca en ningún listado completo del archivo.

## Cuenta (CT1–CT4)

### 🔴 Alta · CT1 — El flujo de 'confirmación en dos pasos' para eliminar cuenta no tiene un control final para confirmar

La zona peligrosa de CT1 muestra el botón 'Eliminar cuenta' y, debajo, directamente el campo 'Para confirmar, escribe tu email' (líneas 2698-2701), pero no hay ningún botón adicional para efectivamente confirmar/ejecutar la eliminación después de escribir el email, ni una distinción visual entre 'paso 1' (advertencia) y 'paso 2' (campo de email + confirmar). Tal como está dibujado, el usuario podría escribir su email y no tener ninguna acción que ejecutar — el flujo de confirmación en dos pasos que exige el brief queda incompleto en el propio mockup.

> **Evidencia:** HTML líneas 2698-2701: el bloque termina en el <input> sin botón de confirmación asociado. Brief (mockup-requirements.md l.543-545): "zona peligrosa: eliminar cuenta (...); confirmación en dos pasos, escribiendo el email)."

### 🟡 Media · CT2 — La pantalla 'Pago fallido' omite el Bloque 2 ('Qué incluye tu plan') pese a etiquetarse como 'En gracia'

La página completa de CT2 en estado Pago fallido (líneas 2776-2806) muestra la alerta, el método de pago, la tarjeta de plan (etiquetada 'En gracia · 5 días', línea 2795) y el historial — pero no incluye el bloque 'Qué incluye tu plan' que sí aparece en el estado Activa (línea 2764) con exactamente el mismo contenido ('Conectar IAs ilimitadas', 'Actividad en vivo', 'Que tus IAs lean y recuerden'). El brief condiciona ese bloque a 'cuando hay suscripción activa o en gracia', y esta pantalla se autodenomina 'en gracia', por lo que el bloque debería estar presente y no lo está.

> **Evidencia:** Bloque 'Qué incluye tu plan' presente en Activa: línea 2764. Ausente en Pago fallido: líneas 2792-2802 (alerta → dos columnas → historial, sin ese bloque), aun etiquetando el plan como "En gracia · 5 días" en línea 2795. Brief (mockup-v2.md l.275): "Solo se muestra cuando hay suscripción activa o en gracia."

### 🟡 Media · CT2 — El CTA del estado 'Cancelada' (sin gracia) no incluye el precio que exige el brief

En el frame de los 5 estados de Bloque 1, el botón del estado 'Cancelada' (sin gracia) dice simplemente 'Reactivar' (línea 2848) — idéntico al del estado 'En gracia' (línea 2847). El brief diferencia explícitamente la copy de ambos: para 'Cancelada con gracia' el CTA es 'Reactivar' (sin precio), pero para 'Cancelada sin gracia' el CTA debe ser 'Reactivar — $11.99/mes' (con precio, porque ya no hay contexto reciente de plan visible). Al usar el mismo texto para ambos estados se pierde la distinción de transparencia de precio que pide el brief.

> **Evidencia:** Línea 2847 ("En gracia"): botón "Reactivar". Línea 2848 ("Cancelada"): botón también "Reactivar" (sin precio). Brief (mockup-v2.md l.267-268): "Cancelada con gracia | ... CTA 'Reactivar'" vs "Cancelada sin gracia | ... CTA 'Reactivar — $11.99/mes'".

### ⚪ Baja · CT4 (slide-over) — Las categorías del ticket tienen copy distinto entre el slide-over y la pantalla completa del mismo panel

La pantalla completa de CT4 usa las categorías 'Algo no funciona' / 'Tengo una pregunta' / 'Quiero sugerir algo' (línea 2885). El slide-over, para el mismo formulario, usa 'No funciona' / 'Pregunta' / 'Sugerencia' (línea 2935). El brief dice que ambos puntos de entrada 'abren el mismo panel', lo que sugiere que debería ser literalmente el mismo copy, no una paráfrasis abreviada distinta en cada contexto.

> **Evidencia:** Línea 2885 (pantalla completa): "Algo no funciona", "Tengo una pregunta", "Quiero sugerir algo". Línea 2935 (slide-over): "No funciona", "Pregunta", "Sugerencia". Brief (mockup-v2.md l.419): "Ambos abren el mismo panel."

### ⚪ Baja · CT1 — El chip de usuario en el pie de la barra lateral aparece resaltado solo en Perfil, no en las otras pestañas de Cuenta

En CT1 (Perfil), el chip de usuario al pie de la barra lateral tiene fondo resaltado (#ECEDEA) y texto en negrita (línea 2687). En las demás pestañas de la misma sección Cuenta — Plan en sus tres estados (líneas 2719, 2755, 2787) y Ayuda (línea 2865) — el mismo chip aparece sin resaltar y con menor peso de fuente. Las cuatro pantallas pertenecen al mismo apartado 'Cuenta' navegado desde el mismo punto de entrada (el chip/avatar del shell), por lo que el indicador de 'sección activa' debería comportarse igual en las cuatro, no solo en Perfil.

> **Evidencia:** Línea 2687 (CT1): "background:#ECEDEA... font:600 13px". Líneas 2719, 2755, 2787 (CT2), 2865 (CT4): mismo chip sin "background" resaltado y con "font:500".

## Patrones transversales

### 🔴 Alta · Patrones (Confirmar · Procesando fuente) vs O2/F1/CT3 — El micro-mensaje "Procesando fuente" promete guardar el archivo original y poder exportarlo, pero el resto del mockup dice explícitamente lo contrario

El panel de Patrones Transversales reproduce literalmente el copy del brief v2 para 'Confirmar → Procesando fuente': "Destilando recuerdos. Guardamos el archivo original y el procesamiento — puedes exportarlos en cualquier momento." Pero en las pantallas concretas donde ese mismo momento ocurre de verdad (O2 Importar, y F1 Fuentes), el mockup dice justo lo opuesto: "Los archivos originales no los guardamos" (repetido 4 veces: vacío de O2, procesando de O2, vacío de F1, absorbiendo de F1). Además, CT3 (Exportar mis datos) lista exactamente qué se puede exportar — recuerdos, estructura de áreas, búsquedas guardadas, registro de actividad — y en ningún lugar incluye "el archivo original", confirmando que el producto, tal como está diseñado en el resto del mockup, NO permite exportar el archivo fuente. El micro-mensaje de 'Confirmar' —cuya función explícita es dar fe de algo que ya es cierto— transmite entonces una promesa de confianza sobre retención/exportabilidad de datos que el propio mockup contradice en al menos 3 secciones distintas (Onboarding, Fuentes, Cuenta). Esto es especialmente grave tratándose de un patrón cuyo propósito es "claro, cuidadoso" y generar confianza: una promesa de este tipo que no se sostiene en el resto del producto es peor que no hacerla.

> **Evidencia:** Línea 3166 (Patrones): «Procesando fuente. Destilando recuerdos. Guardamos el archivo original y el procesamiento — puedes exportarlos en cualquier momento.» — CONTRA línea 1160 (O2): «Suéltalas aquí y destilamos tus recuerdos. Los archivos originales no los guardamos.»; línea 1192 (O2 procesando): «Los archivos originales no los guardamos — solo lo que vale la pena recordar.»; línea 2316 (F1 vacío): «Destilamos recuerdos. Los archivos originales no los guardamos.»; línea 2341 (F1 absorbiendo): «Destilando recuerdos. Los archivos originales no los guardamos.»; y líneas 2969-2972 (CT3 'Qué incluye') que no listan el archivo original como exportable. Brief v2 línea 462-463 es la fuente del texto de Patrones: «*Procesando fuente:* "Destilando recuerdos. Guardamos el archivo original y el procesamiento — puedes exportarlos en cualquier momento."»

### 🟡 Media · Patrones (Confirmar) — La tarjeta "Procesando fuente" usa un spinner (acción en curso) dentro de la columna "Confirmar", que se define como "efectivo de inmediato" / acción ya consumada

El encabezado de la columna 'Confirmar' explica la función del patrón: «"Efectivo de inmediato". Da fe de que la acción ya surtió efecto.» Los otros tres ejemplos de esa misma columna (Acceso revocado, Corrección aplicada, Importación completada) ilustran esto correctamente con un ícono de check verde (stroke #2F7048), señalando un hecho ya consumado. Pero la cuarta tarjeta, "Procesando fuente", usa un spinner animado (`class="sav-spin"`) en vez del check — es decir, muestra visualmente una acción en curso, todavía sin resultado, no un hecho consumado. Esto rompe tanto la semántica ("ya surtió efecto" vs. algo que aún se está procesando) como la consistencia visual (3 checks verdes + 1 spinner) dentro de la misma categoría del patrón, en la misma tarjeta que además hereda del brief la ambigüedad de clasificar un estado de progreso bajo la función 'Confirmar'.

> **Evidencia:** Línea 3162: «"Efectivo de inmediato". Da fe de que la acción ya surtió efecto.» vs línea 3166: `<span class="sav-spin">...</span>` + «Procesando fuente. Destilando recuerdos...» — comparar con el ícono check (`stroke="#2F7048"` `path d="M5 12l5 5L20 6"`) usado en las líneas 3164, 3165 y 3167 de la misma columna.

## Navegación (arquitectura de información)

### 🔴 Alta · P2 (nav) — P2 ("¿Qué ve cada IA?") vive bajo el rail de Conexiones, no bajo Pulso — contradice la arquitectura de información canónica del brief

El brief define la IA como MEMORIA / PULSO / CONEXIONES / FUENTES / CUENTA, coloca P2 explícitamente bajo el encabezado '## PULSO' (mockup-requirements.md líneas 286-330: 'P2 — Acceso: ¿qué ve cada IA? (configuración + auditoría)... la vista consolidada del acceso'), y para CONEXIONES aclara sin ambigüedad: 'Solo conectar tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso' (línea 336). El propio flujo v2 (Flujo 9 — Pulso) confirma la ruta: 'S1 → Pulso → P1 (feed de actividad) → "Acceso" → P2 (matriz IA × área)' (mockup-v2.md líneas 161-169). Sin embargo, en el mockup real las 4 variantes de P2 (con accesos, sin conexiones, cargando, móvil) resaltan el ítem 'Conexiones' del rail (background:#0B2529;color:#F4F4F1) mientras 'Pulso' queda en gris apagado, y la cabecera de P2 muestra las pestañas 'Tus conexiones' / 'Acceso' — el mismo patrón de pestañas que usa C1 (líneas 2032, 2074, 2095, 2105, y en C1: línea 2134). El propio mockup lo reconoce por escrito: el encabezado de sección PULSO dice '(el acceso de cada IA vive en Conexiones)' y un post-it aclara '◆ P1 protagonista en ink. Nota: la pestaña Acceso (¿qué ve cada IA?) ahora vive bajo Conexiones, no aquí' (líneas 1872-1873); y el encabezado de sección CONEXIONES se retitula a mano 'C1–C3 + Acceso' (línea 2116). Es una reubicación deliberada pero nunca reconciliada con el brief: viola además el límite explícito de que Conexiones es 'solo conectar', y diluye el estatus de P2 como 'el corazón del producto / la vista consolidada del acceso' dentro de Pulso.

> **Evidencia:** mockup-requirements.md L44-51 (IA), L286-330 (## PULSO, spec de P2), L334-336 (## CONEXIONES: 'Los permisos de lectura se gestionan en Memoria/Pulso'); mockup-v2.md L161-169 (Flujo 9: S1→Pulso→P1→"Acceso"→P2); mockup-decoded.html L1872-1873 (encabezado PULSO + post-it de reubicación), L2017-2114 (las 4 variantes de P2: rail con 'Conexiones' resaltado en #0B2529/#F4F4F1 y 'Pulso' en gris #53606C; pestañas 'Tus conexiones'/'Acceso'), L2116 y L2134 (encabezado CONEXIONES retitulado 'C1–C3 + Acceso'; pestañas idénticas en C1)

## Copy y tono de marca

### 🟡 Media · CO7 — Metáfora ajena al léxico de marca: "el cerebro del equipo"

La página pública de aceptar invitación (CO7) es la única de las ~33 pantallas donde aparece la palabra "cerebro". La misma pantalla usa primero "memoria compartida" como eyebrow y dos líneas después describe la acción de unirse como agregar recuerdos "al cerebro del equipo", en vez de reforzar "memoria colectiva"/"memoria compartida" — término ya fijado en SB1 ("Memoria colectiva") y usado consistentemente en CO2, CO3 y la plantilla de Área unificada. Rompe el léxico de marca ("memoria") justo en la pantalla que forma la primera impresión de alguien que todavía no es usuario de Savia.

> **Evidencia:** L.2664: «Te invitaron a una memoria compartida» / L.2666: «...podrás leer y agregar recuerdos al cerebro del equipo.» — cf. L.832 «Memoria colectiva» (SB1) y el uso de "Colectiva"/"memoria" en CO2 (L.2527), CO3 (L.2572) y Área unificada (L.3103).

### 🟡 Media · F1 / O2 — Cuatro verbos distintos para la misma acción de "absorber" un archivo

El concepto central de convertir un archivo en recuerdos se nombra con verbos distintos incluso dentro de una MISMA pantalla. En F1 «Absorbiendo»: el título dice «Absorbiendo en tu memoria» (L.2340), el subtítulo inmediato debajo dice «Destilando recuerdos...» (L.2341), y la fila de progreso del archivo dice «Convirtiéndose en recuerdos…» (L.2344) — tres verbos en una sola pantalla. En F1 «Vacío» el mismo bloque de texto mezcla «absorbe» (L.2314) con «Destilamos recuerdos» dos líneas después (L.2316). En O2 «Procesando»: el título dice «Destilando tus recuerdos.» (L.1191) pero la etiqueta de estado por archivo dice «Procesando…» (L.1195). En total: absorber, destilar, convertirse en, procesar, para un solo concepto que además es central al pilar "memoria/recuerda" del producto.

> **Evidencia:** L.2340 «Absorbiendo en tu memoria»; L.2341 «Destilando recuerdos...»; L.2344 «Convirtiéndose en recuerdos…»; L.2314 «absorbe»; L.2316 «Destilamos recuerdos»; L.1191 «Destilando tus recuerdos.»; L.1195 «Procesando…».

### ⚪ Baja · CT2 — "Actualizar" vs "Cambiar" método de pago en la misma pantalla

En CT2 «Pago fallido» el banner superior usa el CTA «Actualizar método de pago» (L.2792) y, en la tarjeta de método de pago ubicada inmediatamente debajo, el botón para la MISMA acción (cambiar la tarjeta guardada) dice «Cambiar método de pago» (L.2794). El mismo patrón se repite entre el resumen de estados de Bloque 1 ("Actualizar método de pago", L.2849) y el estado "Activa" / el diagrama de Flujo 5, que usan "Cambiar método de pago" (L.2762, L.452) para la tarjeta de pago.

> **Evidencia:** L.2792 «Actualizar método de pago» y L.2794 «Cambiar método de pago» — ambos botones visibles en la misma pantalla CT2 «Pago fallido»; también L.2762 y L.2849.

### ⚪ Baja · O1 (móvil) — "Guardar y salir" (desktop) se convierte en solo "Salir" en móvil

En O1–O3 de escritorio el control superior derecho para abandonar el onboarding dice consistentemente «Guardar y salir» (L.1084, 1154, 1188, 1247). En O1 móvil el control equivalente, en la misma posición, dice solo «Salir» (L.1121) — sin la reafirmación de que el progreso se conserva, para la misma acción dentro del mismo flujo.

> **Evidencia:** L.1084/1154/1188/1247 «Guardar y salir» (desktop) vs L.1121 «Salir» (O1 móvil).

### ⚪ Baja · M2 — El copy de vacío de un área la llama "tema" en vez de "área"

En el área "Recetas" sin recuerdos, toda la interfaz nombra la entidad como "área" (breadcrumb "Tu memoria / Recetas", pestañas Recuerdos/Personas/IAs, badge "0 recuerdos"), pero el copy explicativo dice: "Se llena sola cuando tus IAs o tus fuentes aporten algo sobre este tema." — usando "tema" en la frase que precisamente debería reforzar el concepto de "área".

> **Evidencia:** L.1672: «...aporten algo sobre este tema. También puedes mover recuerdos desde otra área.» — la misma oración usa "tema" y "área" para referirse, en apariencia, a la misma entidad.

### ⚪ Baja · M1 / O4 / C3 — "Cliente" nombra dos conceptos distintos y no relacionados en el mismo producto

"Cliente" se usa para el software de IA que el usuario conecta ("Elige tu cliente", O4 L.1308; "Cliente", C3 L.2250) y, a la vez, es el nombre de un área de memoria del propio usuario sobre sus clientes de negocio ("Clientes", área visible en el mapa y lista de M1: L.1008/1470/1560; también en el diagrama de Flujo 3, L.428). El mismo término para "la app que conecto" y "mis clientes de negocio" puede generar ambigüedad, en especial porque el buscador global busca "cualquier recuerdo o área" con la misma palabra de por medio.

> **Evidencia:** L.1308 «Elige tu cliente» (O4), L.2250 «Cliente» (C3) vs L.1008/1470/1560 área «Clientes» (M1).

### ⚪ Baja · M1 — "A medida que creces" roza la metáfora de crecimiento/naturaleza que el proyecto pide evitar

En M1 "una sola área", el copy dice: "Savia descubrirá áreas a medida que creces — o crea una tú cuando quieras." Aunque "crecer" es un verbo de uso general y no es una violación literal del léxico prohibido (planta/hoja/verde), es el punto del mockup que más se acerca a una metáfora de crecimiento orgánico, justamente en el producto cuyo propio nombre ("Savia") el brief señala como la ironía a evitar reforzar con más lenguaje de ese campo semántico.

> **Evidencia:** L.1618: «Savia descubrirá áreas a medida que creces — o crea una tú cuando quieras.»

### ⚪ Baja · O2 / C2 / CO6 — Etiqueta de "avanzar" inconsistente entre asistentes multi-paso: "Continuar" vs "Siguiente"

Para la acción de avanzar al siguiente paso dentro de un flujo guiado, O2 (Poblar) usa consistentemente "Continuar" (L.1174, 1205, 1227, 1289), mientras que los asistentes de C2 ("Paso 1 de 2") y CO6 ("1 Visibilidad 2 Configuración 3 Confirmar") usan "Siguiente" (L.2214, L.2651) para la misma función de UI (botón primario que avanza un paso numerado). No es un error grave, pero es una divergencia de vocabulario para el mismo patrón de interacción repetido en el producto.

> **Evidencia:** L.1174/1205/1227/1289 «Continuar» (O2) vs L.2214/2651 «Siguiente» (C2, CO6), ambos como CTA primario de avance en flujos con stepper numerado.

## Modelo freemium

### 🔴 Alta · SB1 / CT2 — Fecha de fin de gracia por cancelación inconsistente entre SB1 y CT2 (19 jul vs 14 jul)

SB1 · 'Suscripción cancelada — Reactivar (período de gracia)' dice: 'Tienes acceso a tus IAs hasta el 19 de julio de 2026; después se desconectan'. Pero en CT2 esa misma condición de cuenta (cancelada, en gracia) usa consistentemente el 14 de julio de 2026: la renovación de la Activa dice 'Próxima renovación: 14 de julio de 2026', el modal de confirmación de cancelación dice 'Tu acceso continúa hasta el 14 de julio de 2026 (fin del ciclo actual)', y la tarjeta-resumen 'En gracia' de Bloque 1 dice 'Acceso hasta el 14 jul'. El '19 de julio' que usa SB1 es en realidad, en el resto del mockup, la fecha límite de gracia por PAGO FALLIDO (un escenario distinto: 14 jul falla el cobro → 19 jul vence la gracia de 5 días), no la de una cancelación voluntaria. SB1 mezcla la semántica de dos estados de cuenta distintos, exactamente el tipo de incoherencia que el modelo freemium no puede permitirse si el usuario consulta su estado en dos lugares.

> **Evidencia:** L853 SB1: 'Tienes acceso a tus IAs hasta el 19 de julio de 2026; después se desconectan, pero nada se borra.' vs L2761 CT2 Activa: 'Próxima renovación: 14 de julio de 2026'; L2831 CT2 modal cancelación: 'Tu acceso continúa hasta el 14 de julio de 2026 (fin del ciclo actual)'; L2847 CT2 Bloque1 'En gracia': 'Acceso hasta el 14 jul.' El 19 de julio solo aparece, en el resto del mockup, como deadline de Pago fallido (L2792, L2795, L2849: 'Actualiza tu método de pago antes del 19 de julio' / 'En gracia · 5 días' / 'Reintentamos el cobro el 19 de julio').

### 🟡 Media · CT2 — Fecha de facturación inconsistente dentro de la propia pantalla de Cuenta (día 1 vs día 14 del mes)

CT2 dice en todos lados que el cobro/renovación ocurre el día 14 de cada mes ('Próxima renovación: 14 de julio de 2026'; 'No pudimos cobrar el 14 de julio'), pero el Bloque 4 (Historial de facturación) — tanto en el estado Activa como en Pago fallido — lista los cobros anteriores como '01 jun 2026', '01 may 2026', '01 abr 2026' (día 1, no día 14). Es decir, dentro de la misma cuenta y la misma pantalla, el día de cobro salta del 1 al 14 sin ninguna explicación (cambio de fecha de ciclo, prorrateo, etc.). Esto contamina la fuente de verdad que SB1 debería reflejar cuando muestra fechas de gracia/cobro.

> **Evidencia:** L2761 'Próxima renovación: 14 de julio de 2026' y L2792 'No pudimos cobrar el 14 de julio' vs L2767–2769 historial Activa ('01 jun 2026', '01 may 2026', '01 abr 2026') y L2799–2801 historial Pago fallido ('14 jul 2026 · Fallido', '01 jun 2026 · Pagado', '01 may 2026 · Pagado').

### 🟡 Media · O1/O4/C1/M1/M2/P2 (icono) — El mismo ícono de candado significa tres cosas distintas: 'requiere suscripción', 'área sensible' y 'sin acceso concedido'

El glifo de candado (rect+arco) que anuncia el gate de suscripción en el disclaimer de O1, el banner de O4 y el hint de C1 ('Requiere suscripción · $11.99/mes') es exactamente el mismo SVG que se usa para marcar un área como 'Sensible' en el mapa de M1/M2 y en CO3, y también el que ilustra el estado vacío de Acceso en P2 ('Aún no hay IAs que dar acceso'). Un mismo símbolo visual para tres conceptos no relacionados (paywall, privacidad, permisos) diluye justo la señal que el modelo freemium necesita para que el usuario distinga con un vistazo 'esto cuesta' de 'esto es privado' o 'esto no tiene acceso otorgado'.

> **Evidencia:** Candado-suscripción: L1111 (O1), L1134 (O1 móvil), L1307 (O4), L2163 (C1 sin conexiones, 'Requiere suscripción · $11.99/mes'). Mismo ícono para 'Sensible': L1004, L1012, L1463, L1478, L1561, L1640, L1865 ('Marcar sensible'), L3177 ('Marcado como sensible'). Mismo ícono para 'sin acceso otorgado' en P2: L2075.

### ⚪ Baja · SB1 / CT2 — El orden de los 3 beneficios de la suscripción no coincide entre SB1 y CT2

SB1 lista 'Qué desbloqueas' en el orden: (1) conectar IAs, (2) que tus IAs busquen y recuerden, (3) actividad en vivo. CT2 (estado Activa, Bloque 2 'Qué incluye tu plan') lista los mismos 3 beneficios en el orden: (1) conectar IAs, (2) actividad en vivo, (3) que tus IAs lean y recuerden. Es el mismo contenido de negocio (la propuesta de valor de los $11.99/mes) presentado con distinto orden en las dos pantallas que deberían ser espejo una de otra.

> **Evidencia:** L823–826 SB1: Conectar → Busquen y recuerden → Actividad en vivo. L2764 CT2 Activa: Conectar → Actividad en vivo → Lean y recuerden.
