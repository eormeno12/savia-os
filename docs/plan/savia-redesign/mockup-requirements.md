# Savia — Brief de mockup

> Brief autocontenido para diseñar el producto **desde cero**. Describe qué es Savia,
> cómo se siente, y los requisitos funcionales y de UX por pantalla. No prescribe el
> diseño visual — esa es la libertad del mockup. Solo el **comportamiento, el contenido
> y la personalidad**.

## Qué es Savia

**Savia es la memoria que conecta todas tus IAs.** Un solo lugar donde vive todo lo que
tus IAs saben de ti, que cualquiera de ellas (Claude, Cursor, ChatGPT…) puede consultar
y al que contribuyen. El usuario es un experto que ya usa IA todos los días y está
cansado de repetir su contexto en cada herramienta.

## La idea que define toda la UI

Savia **organiza tu memoria sola**. El usuario no archiva, no configura la estructura, no
autoriza cada cosa: **confía en que Savia organiza bien, y solo corrige si se equivoca.**

Principios de interacción:

- **Áreas vivas, no carpetas.** La memoria se ve como un **mapa de áreas** que se organizó
  solo (dimensionadas por cuánto recuerdas de cada tema), no como un explorador de
  archivos. Las carpetas implican que tú archivas; Savia archiva por ti.
- **Buscar para encontrar, el mapa para entender.** No navegas la estructura para hallar
  algo — **preguntas y Savia sabe dónde está** (ese es el punto de organizar solo). El
  mapa es para *ver y comprender* tu memoria; la **búsqueda** es para *encontrar* en ella.
- **Corregir, no configurar.** El usuario no llena formularios de "ajustes"; actúa sobre
  el área viva: renombrar, dividir, fusionar, mover un recuerdo. Cada corrección
  **enseña** — Savia no repite el error.
- **El acceso lo configuras tú, con Savia ayudando.** _Qué IA puede ver qué_ es una
  **configuración del usuario**: Savia sugiere un default sensato y marca lo sensible, pero
  la decisión es tuya. La organización es automática; el **acceso es control explícito**, y
  **nunca se amplía sin tu decisión**.

## Personalidad

Premium, distintivo, con identidad propia — **no un dashboard SaaS genérico**. La memoria
se siente **viva y personal** ("tu memoria", primera persona). Calma: jerarquía clara,
una acción principal por pantalla, mucho aire. El mapa de la memoria es el momento que da
orgullo mostrar. Idioma **español**, voz cálida y precisa, sin jerga técnica, sin
metáforas de plantas/naturaleza.

## Arquitectura de información (superficies)

```
MEMORIA    ← buscar (la navegación primaria) + mapa/lista de áreas + búsquedas guardadas
PULSO      ← actividad en vivo (tus IAs alimentando tu memoria) + crecimiento + acceso/auditoría
CONEXIONES ← conectar tus IAs (guía paso a paso por cliente)
FUENTES    ← arrastrar y soltar → memoria organizada
CUENTA     ← perfil y plan
```

**Elementos globales (en el shell, desde cualquier pantalla):** **búsqueda**, **salto
rápido por teclado** (paleta de comandos), y **bandeja de notificaciones**.

Orden del doc: Auth → Shell → Onboarding → Memoria → Pulso → Conexiones → Fuentes →
Bandeja → Colectivo → Cuenta → Patrones transversales.

---

## AUTH

### A1 — Login: email

**Propósito:** entrada al producto; el usuario ingresa su email para recibir un código.

**Elementos:**
- Marca y nombre del producto; el one-liner ("la memoria que conecta todas tus IAs")
- Una guía breve del recorrido (entrar → reunir tu memoria → **conectar tus IAs**), con el
  paso actual marcado — un usuario nuevo debe entender que loguearse es el inicio de
  construir su memoria, y que el objetivo es conectar sus IAs
- Campo de email con label; **sin contraseñas** (se explica que llega un código)
- Acción principal; error (email inválido / red); indicador de carga

**Flujo:** email válido → A2.

### A2 — Login: código

**Propósito:** ingresar el código de 6 dígitos recibido por email.

**Elementos:**
- A qué email se envió
- 6 campos numéricos (uno por dígito), avance automático al tipear, soporte de pegar el
  código completo; debe caber sin desbordar en móvil
- Reenvío con cuenta regresiva → al terminar habilita "Reenviar"
- Error (código incorrecto / expirado); indicador de validación

**Flujo:** correcto → O1 (usuario nuevo) · M1 (usuario existente).

---

## SHELL

### S1 — Estructura del app

**Propósito:** navegación persistente y los elementos globales del app autenticada.

**Elementos:**
- Marca + nombre
- Navegación: **Memoria, Pulso, Conexiones, Fuentes**; indicador de sección activa
- **Búsqueda de memoria siempre visible** (la navegación primaria): un campo prominente
  para encontrar cualquier recuerdo o área desde cualquier pantalla
- **Salto rápido por teclado** (paleta de comandos, ej. Cmd/Ctrl-K): escribir para saltar
  a un área, una búsqueda guardada, o lo reciente — pensado para el power user
- **Bandeja de notificaciones** (campana): invitaciones recibidas, sugerencias de Savia,
  importaciones terminadas, actividad de IAs (→ Bandeja, N1); con indicador de no leídas
- Acción "Conectar IA" siempre accesible (alta frecuencia)
- Acceso a cuenta

**Estados:**
- Sin conexiones aún → "Conectar IA" prominente
- Con conexiones → indicador sutil de actividad reciente (última IA que consultó)
- Móvil: navegación accesible (drawer); búsqueda accesible; nunca se oculta sin alternativa

---

## ONBOARDING

> Recorrido de activación. Se puede volver atrás. El progreso se **persiste** (recargar no
> lo pierde). Es el primer "wow" (ver nacer tu memoria) **y** lleva a la activación real:
> **conectar tu primera IA** — sin una IA conectada, Savia no sirve, así que conectar es el
> paso protagonista, no un extra. Pasos: **Bienvenida · Poblar · Conectar · Listo**.

### O1 — Bienvenida

**Propósito:** dar la bienvenida y elegir cómo arrancar la memoria.

**Elementos:** bienvenida personalizada; explicación breve del recorrido; tres caminos como
tarjetas — **Importar conversaciones**, **Rescatar con prompt**, o **Empezar vacío** (saltar
y dejar que la memoria se construya sola cuando conectes tus IAs); cuál es la recomendada;
progreso (Bienvenida).

**Flujo:** elegir → O2 / O3, o saltar directo a O4.

### O2 — Importar

**Propósito:** subir exports de chats; Savia los procesa y extrae recuerdos.

**Elementos:** zona de carga con arrastrar y soltar; **guía de cómo exportar de cada origen**
(ChatGPT, Claude, Gemini…) — porque exportar de cada uno es distinto, hay que guiarlo igual
que la conexión; cola con estado por archivo (pendiente/procesando/listo/error) y progreso;
al terminar, **los recuerdos aparecen de a uno, animados** (no un bloque seco) — la memoria
"encendiéndose"; resumen ("X recuerdos"); continuar (se habilita cuando ≥1 archivo terminó);
progreso (Poblar).

**Estados:** sin archivos / procesando / éxito celebrado / error con reintento.

**Flujo:** continuar → O4.

### O3 — Rescatar

**Propósito:** el usuario copia un prompt, lo pega en su IA, y trae la respuesta a Savia.

**Elementos:** explicación en 2 pasos (copiar → pegar en tu IA → traer la respuesta); bloque
con el prompt + copiar (con confirmación); campo grande para pegar la respuesta; acción
principal; indicador de carga; al terminar, resultado celebrado ("X recuerdos creados",
número grande); progreso (Poblar).

**Estados:** vacío / procesando / resultado celebrado.

**Flujo:** continuar → O4.

### O4 — Conectar tu primera IA (activación)

**Propósito:** **el paso clave** — conectar una IA para que empiece a usar (y alimentar) tu
memoria. Reutiliza la guía por cliente (C3).

**Elementos:** explicación de por qué este paso importa (aquí "se enchufa" tu memoria a tu
IA); selector de cliente + pasos específicos (como C3); **verificación en vivo** ("esperando
la primera llamada de tu IA → ¡conectada!") como el momento de éxito; opción de **hacerlo más
tarde** (se puede conectar desde Conexiones cuando quiera); progreso (Conectar).

**Estados:** sin conectar / esperando verificación / conectada (celebración).

**Flujo:** conectada o "más tarde" → O5.

### O5 — Listo

**Propósito:** cerrar mostrando que la memoria ya está viva y **mostrar el mapa naciente**.

**Elementos:**
- Celebración ("Tu memoria está viva")
- **Vista previa del mapa**: las áreas que Savia organizó sola — el momento *se organizó solo*
- Resumen: total de recuerdos, número de áreas, IA conectada (si la hay)
- Acciones: **Explorar mi memoria** (→ Memoria), **Sumar más fuentes** (→ Fuentes)

---

## MEMORIA

> La superficie central: encontrar, ver y gestionar tu memoria. **Buscar es la navegación
> primaria; el mapa es para entender.**

### M1 — Memoria (buscar + mapa/lista)

**Propósito:** encontrar cualquier cosa al instante y ver el retrato de tu memoria.

**Elementos:**
- **Búsqueda prominente** (lo primero, la acción principal): en lenguaje natural, encuentra
  recuerdos y áreas sin que el usuario sepa dónde están
- **Hero**: "Tu memoria"; total de recuerdos como número grande; sub-texto (nº de áreas,
  cuánto creció)
- **Mapa de áreas** (para comprender/explorar): las áreas como formas **dimensionadas por
  volumen**, con su nombre y conteo; **anidables** (entrar a un área despliega sus
  sub-áreas), con **migas de pan** para saber dónde estás. Seleccionar un área → su panel
  (M2)
- **Toggle mapa / lista**: una **lista** de todas las áreas (nombre, conteo, ordenable) como
  alternativa rápida al mapa para escanear/gestionar a escala
- **Recientes**: acceso a lo último que tú o tus IAs agregaron (→ Pulso P1) — navegar por
  tiempo, no solo por tema
- Señales sutiles en las áreas: **sensible**, **viva** (creció/cambió hace poco)
- Accesos: **Crear área** (M3), **Búsquedas guardadas** (M4)

**Estados:** sin memoria (vacío con CTA a onboarding) / con datos / cargando (placeholder
del mapa, no spinner global) / una sola área ("todo está en General; Savia descubrirá áreas
a medida que creces, o crea una tú").

**Móvil:** el mapa se adapta (navegación por toques, entrar/salir de áreas con migas); si el
mapa es difícil en pantalla chica, la **lista** es la vista por defecto en móvil. La búsqueda
siempre arriba.

### M2 — Panel de área (gestión)

**Propósito:** explorar un área y **gestionarla** corrigiendo: sus recuerdos, quién la ve,
sus acciones.

**Elementos:**
- **Encabezado**: nombre (editable en línea), descripción, conteo; señal de **origen**
  (organizada por Savia / creada por ti) y de **tipo** (privada / colectiva); señal de
  **sensibilidad** si aplica
- **Sub-áreas** (si tiene): forma de entrar a ellas
- **Recuerdos del área**: lista paginada; cada uno con texto, fecha y **origen** (archivo o
  qué IA lo escribió); si vive también en otras áreas, links a ellas; **selección múltiple**
  para mover o eliminar varios a la vez; acción **mover** a otra área (corrección)
- **¿Quién ve esta área?**: control de acceso por IA (dar / quitar), con Savia sugiriendo un
  default y resaltando lo sensible — es **el mismo modelo de acceso** que se ve consolidado
  en Pulso (P2); aquí es el atajo en contexto. Si es colectiva, también las personas (→ CO2)
- **Acciones (corrección):** renombrar, **dividir**, **fusionar** con otra área, marcar
  **sensible**, **compartir con personas** (→ convertir a colectiva, CO6), eliminar (con
  confirmación). Toda corrección **enseña** a Savia.

**Estados:** sin recuerdos (cómo se puebla) / con recuerdos / cargando.

### M3 — Crear área

**Propósito:** crear un lugar propio en tu memoria cuando lo quieras (el resto emerge solo).
No se le pide al usuario elegir "tipos" — solo nombra un lugar.

**Elementos:** nombre y una descripción breve de qué va ahí; Savia la va llenando por
clasificación; confirmación. (Para juntar recuerdos por tema *sin* crear un lugar, está
"guardar una búsqueda" — M5/M4.)

### M4 — Búsquedas guardadas

**Propósito:** búsquedas guardadas como grupos que **cruzan las áreas** y se actualizan solas
("todo sobre Fredd, esté donde esté"). Son **vistas**, no lugares.

**Elementos:** lista de búsquedas guardadas (nombre, conteo de coincidencias que se actualiza
solo); abrir una → sus recuerdos (de distintas áreas); **editar la búsqueda en lenguaje
natural**; **control de acceso por IA** (el mismo modelo, atajo en contexto); eliminar. Se
crean **desde una búsqueda** (M5 → "guardar como grupo"). Queda claro que **no son lugares en
el mapa**: son cortes transversales.

**Estados:** sin búsquedas guardadas (qué son + CTA a crear desde una búsqueda) / con varias.

### M5 — Búsqueda

**Propósito:** la navegación primaria — encontrar cualquier cosa en lenguaje natural.

**Elementos:** campo de búsqueda; resultados como recuerdos (texto, área, origen), agrupados
por área; **filtros** (por área, por origen —archivo o IA—, por fecha); abrir un resultado →
recuerdo (M6); acción **"guardar esta búsqueda como grupo"** (→ M4); estado sin resultados
con sugerencia.

### M6 — Recuerdo individual

**Propósito:** ver y gestionar un recuerdo puntual.

**Elementos:** texto completo; fecha; **origen** (archivo o IA que lo escribió); áreas a las
que pertenece (su lugar principal marcado + otras como links); señal de sensibilidad;
acciones: mover de área, marcar sensible, eliminar (con confirmación).

---

## PULSO

> La vida de tu memoria: **lo que tus IAs hacen con ella en vivo**, cómo crece, y quién ve
> qué. Es donde el loop del producto se siente y donde se gana la confianza para delegar la
> organización en Savia.

### P1 — Actividad en vivo

**Propósito:** **el corazón del producto** — ver tu memoria viva: lo que tus IAs consultan y
**contribuyen**, y lo que Savia organiza, en tiempo casi real.

**Elementos:**
- **Feed de actividad**: eventos legibles, no técnicos —
  - *"Claude recordó 3 cosas nuevas en Trabajo"* (una IA **contribuyó** memoria)
  - *"Cursor consultó tu memoria de Proyectos"* (una IA **leyó**)
  - *"Savia separó 'Pricing' de Savia"* / *"fusionó dos áreas parecidas"* (Savia
    **reorganizó**) — con opción de **revertir**, para que la organización automática sea
    transparente, no mágica-opaca
- **Recientes**: los últimos recuerdos agregados (de quién/qué), navegables
- **Crecimiento**: recuerdos creados hoy / esta semana y variación vs el período anterior;
  gráfico de crecimiento diario (últimos 7–14 días)
- **Resumen de IAs**: cada conexión con su última consulta (tiempo relativo) y señal de
  actividad reciente

**Estados:** sin actividad aún (qué aparecerá aquí) / con actividad / cargando (placeholder
por sección).

### P2 — Acceso: ¿qué ve cada IA? (configuración + auditoría)

**Propósito:** la **vista consolidada** del acceso — qué ve cada IA, configurable acá mismo,
con su historial. Es el "hogar" del acceso; los atajos en cada área/búsqueda guardada operan
el mismo modelo.

**Elementos:**
- Por cada IA conectada: **qué puede leer** (áreas y búsquedas guardadas), en lenguaje del
  usuario, con **control de acceso ahí mismo** (dar / quitar)
- **Capacidad de contribución**: si esa IA puede **agregar** memoria (escritura), visible y
  configurable
- **Señal de cuidado**: si una IA tiene acceso a algo sensible, se resalta
- **Sugerencias de Savia**: defaults sensatos y avisos ("la nueva área 'Fredd' se parece a
  lo que Claude ya ve, ¿le das acceso?") — aceptar o ignorar; **el acceso nunca se amplía
  sin tu decisión**
- **Historial / auditoría**: qué pudo leer cada IA y cuándo

**Estados:** sin conexiones (qué aparecerá aquí) / con accesos / cargando.

---

## CONEXIONES

> Solo **conectar** tus IAs. Los permisos de lectura se gestionan en Memoria/Pulso.

### C1 — Lista de conexiones

**Propósito:** ver las IAs conectadas, su estado, y conectar nuevas.

**Elementos:** título; "Conectar una IA" (acción principal); lista, cada ítem con nombre,
**estado de salud** (conectada y activa / sin actividad / **con problema** —token inválido,
bloqueada por límite—), última actividad (tiempo relativo), señal de actividad reciente, un
resumen de solo lectura de qué puede ver y si puede contribuir, y revocar (con confirmación);
acceso a la guía (C3).

**Estados:** sin conexiones (qué es conectar una IA + CTA) / con conexiones / con una conexión
en problema (resaltada, con cómo arreglarla) / cargando (placeholder por ítem).

### C2 — Nueva conexión

**Propósito:** nombrar la IA y obtener su configuración, en 2 pasos.

**Elementos:**
- **Paso 1:** nombre de la conexión (ej. "Claude del trabajo") → siguiente
- **Paso 2:** la configuración lista; botón **"Ver cómo instalarla" → C3** (guía del cliente);
  nota de que el acceso de lectura se configura en Memoria/Pulso; cerrar

### C3 — Guía de conexión por cliente

**Propósito:** **guiar paso a paso**, reconociendo que **cada IA se conecta distinto** — no
sirve un bloque de config genérico.

**Elementos:**
- **Selector de cliente**: Claude Code, Claude Desktop, Cursor, Windsurf, ChatGPT, "otro
  cliente compatible"
- Según el cliente, **los pasos específicos de ESE cliente** (difieren):
  - dónde está su archivo de configuración (la ruta), **o** el comando que debe correr,
    **o** la ruta en su interfaz (Ajustes → …)
  - el bloque de configuración exacto para ese cliente, listo para copiar
  - opción de **descargar** el archivo de configuración
  - una referencia visual de dónde pegarlo
- **Verificación en vivo**: cómo saber que quedó conectada ("esperando la primera llamada de
  tu IA → conectada")
- Sección "Qué podrá hacer tu IA con Savia" (buscar en tu memoria, recordar lo nuevo)
- CTA final: "Ver mis conexiones" → C1

**Estados:** sin cliente elegido / cliente elegido (sus pasos) / esperando verificación /
conectada.

---

## FUENTES

> **Echas algo y Savia lo absorbe en tu memoria.** No es un gestor de archivos sueltos: es de
> dónde Savia aprende. La interacción central es **arrastrar y soltar**; Savia procesa,
> extrae recuerdos y los **organiza solo**. El usuario nunca ve "archivos sueltos" — ve
> **cómo lo que aporta se vuelve memoria organizada**.

### F1 — Fuentes

**Propósito:** alimentar la memoria arrastrando lo que quieras recordar; Savia lo absorbe y
organiza solo. El usuario puede, opcionalmente, **sugerir a qué área pertenece**.

**Elementos:**
- **Zona de soltar protagonista** (el centro de la pantalla): "Arrastra aquí documentos,
  notas, lo que quieras recordar — Savia lo organiza en tu memoria." También se puede soltar
  sobre toda el app (overlay al arrastrar)
- **Al soltar, sugerencia opcional**: "¿a qué área pertenece? (opcional)" — un **hint** para
  Savia; por defecto "que Savia lo organice". Nunca obligatorio
- **Absorción visible, no "archivo subido"**: cada fuente muestra que **se está convirtiendo
  en recuerdos** (progreso), y al terminar **cuántos recuerdos generó y en qué áreas
  aterrizaron** — siempre atada a lo que se volvió
- **Vista organizada por contribución, no por archivos sueltos**: las fuentes se presentan
  **agrupadas por las áreas que alimentaron** (o cada fuente con sus áreas destino y conteo),
  de modo que se sienta parte de la memoria; **selección múltiple** para reintentar/eliminar
  varias
- Por fuente: nombre, **estado** (procesando / absorbida / fallida), recuerdos generados,
  **áreas destino** (links), **re-sugerir área**, reintentar (si falló), eliminar (con
  confirmación)

**Estados:** vacío (zona de soltar protagonista + concepto **fuente → memoria**) / absorbiendo
(proceso visible) / con fuentes (organizadas por contribución) / cargando.

---

## BANDEJA

### N1 — Notificaciones / bandeja

**Propósito:** un lugar único para lo que requiere la atención del usuario, accesible desde la
campana del shell. Nada bloqueante; todo revisable cuando quiera.

**Elementos:** lista de notificaciones, agrupadas o en orden cronológico —
- **Invitaciones recibidas** a áreas colectivas (de un usuario ya logueado): quién, a qué
  área, con qué rol → **aceptar / rechazar** desde aquí
- **Sugerencias de Savia**: ej. "¿compartir la nueva área 'Fredd' con Claude?", "Savia
  encontró sub-temas en Trabajo, ¿los separo?" → aceptar / ignorar (nunca expande acceso solo)
- **Procesos terminados**: "tu importación de ChatGPT terminó: 240 recuerdos"
- **Hitos de actividad**: ej. "tus IAs agregaron 50 recuerdos esta semana"
- Marcar como leídas; vaciar; cada ítem lleva a su contexto (el área, la conexión, etc.)

**Estados:** sin notificaciones (al día) / con notificaciones (no leídas resaltadas) /
cargando.

---

## COLECTIVO (memoria colaborativa)

> Un **área colectiva** es una memoria **compartida entre varias personas** — un cerebro de
> equipo. Dos capas de acceso: **quién (personas)** participa, y **qué IAs** pueden conectarse.
> Compartir con personas es el **único setup deliberado** (es irreversible — alguien más la
> verá). Se inicia desde el panel de un área (M2 → "compartir con personas" → CO6).

### CO1 — Área colectiva (cómo se ve la memoria colaborativa)

**Propósito:** la memoria compartida del equipo: explorarla y ver quién/qué participa.

**Elementos:**
- **Encabezado de equipo**: nombre del área; **avatares apilados de los miembros**; tu rol;
  señal clara de que es **colectiva** (se siente distinto a un área privada)
- **Recuerdos compartidos**: la memoria del área; cada recuerdo indica **quién contribuyó**
  (persona o IA) — se ve que es colaborativa
- **Dos accesos visibles**: las **personas** (→ CO2) y las **IAs** según la política (→ CO3)
- **Acciones según rol**: contribuir un recuerdo; gestionar miembros e invitar (admin);
  configurar la política de IAs (admin); editar nombre/descripción (admin)

**Estados:** vacía (cómo se puebla — invitar gente, conectar fuentes) / con recuerdos /
cargando.

### CO2 — Personas del área (miembros)

**Propósito:** gestionar quién participa y con qué rol.

**Elementos:** lista de miembros (avatar, email, rol: viewer/contributor/admin); cambiar rol
en línea (admin); quitar miembro (con confirmación); "Invitar persona" (→ CO5); el propio
usuario aparece (no puede quitarse si es el único admin).

**Roles:** **viewer** solo lee · **contributor** lee y agrega · **admin** lee, agrega, gestiona
miembros, configura el área y su política de IAs.

**Estados:** solo tú / con miembros.

### CO3 — Política de acceso de IAs (admin)

**Propósito:** el admin decide **cómo pueden conectarse las IAs** a esta memoria compartida —
de abierto a cerrado.

**Elementos:**
- **Modo de acceso de IAs** (selector con explicación de cada uno):
  - **Abierto:** cada miembro puede conectar sus propias IAs libremente
  - **Restringido:** solo IAs de una **lista aprobada** por el admin
  - **Con aprobación:** cuando un miembro conecta una IA, el admin la **aprueba** antes
  - **Solo personas:** ninguna IA accede (colaboración humana pura)
- Si es restringido / con aprobación: la **lista de IAs aprobadas o pendientes** (aprobar /
  rechazar / quitar)
- **IAs conectadas ahora mismo** (de cualquier miembro): nombre, de qué miembro es, última
  actividad — el admin puede **revocar** cualquiera
- Señal de cuidado: advertencia si el área es sensible y el modo es abierto

**Estados:** según modo; sin IAs conectadas / con IAs.

### CO4 — Conectar mis IAs a un área colectiva (cada miembro)

**Propósito:** un miembro decide cuáles de **sus propias IAs** acceden a esta memoria
compartida, dentro de lo que permite la política del admin.

**Elementos:** lista de las conexiones del propio usuario con control por IA (conectar /
desconectar de esta área); si la política es "con aprobación", la IA queda **pendiente** hasta
que el admin la apruebe; si es "solo personas", se explica que las IAs no pueden conectarse
aquí.

**Estados:** según la política (abierto / pendiente / bloqueado).

### CO5 — Invitar persona

**Propósito:** invitar a alguien al área con un rol.

**Elementos:** email del invitado; selector de rol con descripción breve; "Enviar invitación";
resultado: link generado con copiar; indicación de expiración (en cuántos días); lista de
invitaciones pendientes (email, rol, vencimiento) con opción de revocar.

### CO6 — Convertir un área en colectiva (wizard)

**Propósito:** guiar la conversión dejando clarísimas las consecuencias.

**Elementos:**
- **Paso 1 — Consecuencias:** qué cambia (el área podrá tener miembros y una política de IAs);
  decisión sobre los recuerdos actuales: **Mover** (pasan al colectivo y dejan de ser solo
  tuyos) o **Copiar** (quedan en un área privada tuya **y** también en la colectiva)
- **Paso 2 — Configuración inicial:** nombre (editable); **modo de acceso de IAs** por defecto
  (CO3)
- **Paso 3 — Confirmación:** resumen; "Convertir" (irreversible, con advertencia clara); cancelar

**Flujo:** completado → el área pasa a colectiva → CO1.

### CO7 — Aceptar invitación (página pública)

**Propósito:** lo que ve alguien que recibió un link de invitación **sin estar logueado** (un
usuario ya logueado las acepta desde la Bandeja, N1).

**Elementos:** marca + nombre del producto; a qué área lo invitaron; quién lo invitó; el rol y
su descripción; si no tiene cuenta → "Crear cuenta y unirme" (→ login); si ya tiene → "Unirme";
si el link expiró o fue revocado → mensaje de error + CTA.

---

## CUENTA

### CT1 — Perfil

**Elementos:** email (solo lectura); fecha de creación; cerrar sesión; **zona peligrosa**:
eliminar cuenta (advertencia de que borra toda tu memoria, irreversible; confirmación en dos
pasos, escribiendo el email).

### CT2 — Plan / Suscripción

**Propósito:** ver el plan y gestionar la suscripción (pasarela de pago).

**Elementos:** plan actual (nombre, precio, qué incluye: límites de memoria/áreas/conexiones);
estado (activa / cancelada / en gracia); fecha de renovación o vencimiento; acción según estado
(Suscribirme / Gestionar / Reactivar); historial de pagos (fecha, monto, estado, comprobante);
comparativa de planes si hay más de uno.

**Estados:** sin suscripción (énfasis en el CTA y qué desbloquea) / activa (énfasis en la
renovación) / pago fallido (alerta prominente + actualizar método de pago).


---

## PATRONES TRANSVERSALES

Aplican a todo el app autenticado:

- **Organización automática, acceso configurable:** Savia **organiza sola** (y aprende de tus
  correcciones — no repite el error); el **acceso lo configuras tú** (qué IA ve qué, qué IAs
  entran a un colectivo), con Savia sugiriendo defaults y marcando lo sensible. La
  organización no te pide aprobar nada; el **acceso nunca se amplía sin tu decisión**.
- **Navegación:** **buscar para encontrar** (no navegas la estructura — preguntas y Savia
  sabe dónde está); el **mapa para entender**; **salto rápido por teclado** para ir a un
  destino conocido; **recientes** para navegar por tiempo.
- **Transparencia:** el usuario siempre **ve** lo que Savia organizó y puede corregirlo, y
  siempre puede **auditar** qué vio cada IA y cuándo.
- **Acciones en lote:** en listas (recuerdos, fuentes) se puede seleccionar varios y actuar.
- **Carga:** cada sección carga independiente con un placeholder (no un spinner global).
- **Vacío:** toda lista/sección vacía tiene un mensaje explicativo y una acción clara.
- **Error:** contextual, en lenguaje del usuario (no códigos); los errores globales aparecen
  como notificación no bloqueante.
- **Confirmación:** las acciones destructivas o irreversibles siempre piden confirmación.
- **Feedback de acción:** toda acción exitosa tiene una confirmación visual breve.
- **Seguridad visible:** lo **sensible** se marca; "¿qué ve cada IA?" siempre accesible.
- **Idioma:** español, primera persona ("tu memoria", "tus IAs"), sin jerga técnica.
