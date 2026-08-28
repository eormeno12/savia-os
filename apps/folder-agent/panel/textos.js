// ────────────────────────────────────────────────────────────────────────────
// EL VOCABULARIO. El único archivo con frases en español de toda la app — el panel
// y el onboarding lo importan los dos; el resto del frontend pide una clave.
// ────────────────────────────────────────────────────────────────────────────
//
// Aplica la tabla de D7 (plan-rediseno-agente.md §1.7): los nombres internos de
// estado (`sincronizado`, `barriendo`, `carpetaAusente`, `congelado`, `indexado`,
// `procesando`, `retirado`, `fallo`) nunca llegan a la pantalla tal cual — acá se
// traducen una sola vez, y todo lo demás pide la clave, no la palabra.
//
// El copy de las seis pantallas de onboarding y de la lista de carpetas sale del
// mockup (`onboarding-mockup.dc.html`), leído entero. Tres tipos de ajuste sobre
// ese texto, cada uno marcado donde ocurre:
//   1. Los dos que el plan pide explícito: "PRIMER BARRIDO" → "La primera
//      revisión", "Abrir en el Buscador de Archivos" → "Abrir en Finder".
//   2. Otras dos apariciones sueltas de la misma palabra de motor («barrido» en
//      la pantalla 4, «Vinculado» contradiciendo «Conectado» en la pantalla 2)
//      que la regla general de D7 también alcanza aunque el plan no las cite
//      una por una.
//   3. Dos inconsistencias del propio mockup contra su propia pantalla de
//      detalle (paso 5 dice "Subido"/"Pendiente" donde el detalle de carpeta ya
//      dice "Guardado"/"Guardando…") — se unifican reusando las mismas claves de
//      `panel.archivo`, así que hay una sola palabra por estado en toda la app.

// ── Formato ───────────────────────────────────────────────────────────────
// Único cálculo que vive acá: separador de miles. No es lógica de producto, es
// gramática de número — «1.204», no «1204».
const conMiles = (n) => n.toLocaleString("es-AR");

// ── El panel ─────────────────────────────────────────────────────────────
const panel = {
  // Los cinco estados de carpeta. Tabla D7, primera mitad — `barriendo` se separó
  // en dos: mientras el agente recorre el disco local (`leyendo`) y mientras ya
  // está subiendo/confirmando con Savia (`actualizando`). Antes era un solo
  // rótulo cubriendo los dos momentos.
  estado: {
    sincronizado: "Al día",
    leyendo: "Leyendo",
    actualizando: "Actualizando",
    carpetaAusente: "No está",
    congelado: "En pausa",
  },

  // Las dos frases largas que acompañan a `carpetaAusente` y `congelado`: dicen
  // qué pasó y qué hacer, sin nombrar el mecanismo. Son el modelo de todo lo demás.
  motivo: {
    carpetaAusente: "No la encontramos. ¿Se desconectó un disco o se movió la carpeta?",
    congelado: "Desaparecieron muchos archivos de golpe. Savia puso todo en pausa hasta confirmar que está bien.",
  },

  // Los cuatro estados de archivo. Tabla D7, segunda mitad.
  archivo: {
    guardado: "Guardado",
    guardando: "Guardando…",
    noGuardado: "No se pudo guardar",
    oculto: "Oculto",
  },

  // D3: el motivo del fallo por archivo, solo la mitad que el agente sabe decir
  // hoy (tipo no compatible, no se pudo abrir). Las dos frases son literales del
  // plan, que a su vez cita el mockup. La variante `Desconocido` no tiene texto
  // — el diseño la pinta sin subtítulo a propósito, así que acá no hay clave.
  motivoDeFallo: {
    noSePudoAbrir: "No se pudo abrir: tiene contraseña.",
    tipoNoCompatible: "Este tipo de archivo no es compatible.",
  },

  // El contador de documentos que agrega D7 ("Y lo chico que también es nuevo").
  documentos: {
    enSavia: (n) => `${conMiles(n)} ${n === 1 ? "documento" : "documentos"} en Savia`,
  },

  // El contador en vivo del badge, mientras la carpeta está `leyendo` o
  // `actualizando` (canal de progreso, Fase 7). Antes vivía literal en
  // `panel.js` —fuera de este archivo, un punto ciego ya documentado del
  // guardián `palabras.mjs`— porque `Carpeta.progreso` nunca traía un valor
  // real que lo pidiera. "Archivos" y no "documentos": es la misma cuenta que
  // `onboarding.q5.progreso` ya usa para el mismo concepto (progreso del
  // primer barrido), no una segunda palabra para lo mismo.
  progreso: (procesados, total) => `${conMiles(procesados)} de ${conMiles(total)} archivos`,

  // «Dejar de mirar»: la lectura de D1 en el plan (nunca ocultar lo ya
  // guardado) no es lo que pasa de verdad — el servidor SÍ oculta los
  // documentos de la carpeta al dejar de mirarla: quedan sin usar, guardados
  // solo para no tener que volver a subirlos si la agregas otra vez. Las tres
  // frases dicen eso, explícito, en los tres momentos (el ítem de menú, la
  // confirmación, el resultado) — corregido contra el texto anterior, que
  // decía que seguían disponibles.
  dejarDeMirar: {
    menu: {
      titulo: "Dejar de mirar esta carpeta",
      subtitulo: "Savia deja de revisarla. Lo que ya guardó queda oculto, no disponible.",
    },
    confirmar: {
      titulo: (carpeta) => `¿Dejar de mirar «${carpeta}»?`,
      cuerpo: (n) =>
        `Savia no vuelve a revisarla. Los ${conMiles(n)} documentos que ya guardó quedan ocultos — no vas a poder verlos ni buscarlos — y se guardan solo para no tener que subirlos de nuevo si la agregas otra vez.`,
      cancelar: "Cancelar",
      // El mockup dice "Desvincular" acá — la acción ya no se llama así (D1/D7),
      // así que el botón usa el mismo verbo que el ítem de menú que lo abrió.
      aceptar: "Dejar de mirar",
    },
    hecho: {
      titulo: "Listo, Savia dejó de mirarla",
      cuerpo: "Sus documentos quedan ocultos. Si la agregas de nuevo, Savia no tiene que volver a subirlos.",
      volver: "Volver a la lista",
    },
  },

  // "Abrir en el Buscador de Archivos" → Finder, el otro ajuste que el plan pide
  // explícito. Se usa tanto en el menú de la carpeta como en el toast.
  finder: {
    abrir: "Abrir en Finder",
    abrirSubtitulo: "Ver la carpeta como cualquier otra en tu Mac",
    abriendoToast: "Abriendo en Finder…",
  },

  archivoSuelto: {
    tocarParaAbrir: "Toca un archivo guardado para abrirlo.",
    abriendoToast: (nombre) => `Abriendo ${nombre}…`,
  },

  agregarCarpeta: {
    titulo: "+ Agregar carpeta",
    subtitulo: "Puedes mirar más de una a la vez.",
  },

  // ── Lo que sigue en pie del panel de hoy y el mockup no cubre ────────────
  // D2 saca el botón "Pausar" de la persona, pero no toca el estado de
  // credenciales revocadas (`vista.detenido === "credenciales"`) ni el aviso de
  // error de pintado — ninguno de los dos aparece en el mockup del rediseño
  // porque no es parte de las seis pantallas ni de la lista de carpetas. Se
  // trae literal del `panel.js`/`bandeja.js` de hoy, sin inventar nada nuevo,
  // para que la Fase 5 tenga de dónde sacarlo si el flujo sigue existiendo.
  legado: {
    detenido: {
      rotulo: "Sin acceso",
      detalle: "Nada entra a Savia desde este equipo",
      avisoTitulo: "Savia no está entrando.",
      avisoCuerpo: "El acceso de este equipo dejó de valer.",
    },
    acciones: {
      salir: "Salir",
      abrirCarpeta: "Abrir carpeta",
      volverAVincular: "Volver a vincular",
      cerrarSesion: "Cerrar sesión",
    },
    // Prefijo del aviso cuando `vista()` falla y no hay nada dibujado todavía;
    // el mensaje de la excepción se concatena aparte, no es texto traducible.
    errorDePintado: "El panel no pudo dibujarse.",
    // "Cerrar sesión" generaliza "Dejar de mirar" (arriba) a TODAS las
    // carpetas a la vez, mismo criterio de D7: mismas palabras ("ocultos, no
    // disponibles", "se guardan solo para no subirlos de nuevo") para el
    // mismo hecho, ahora sobre el dispositivo entero en vez de una carpeta.
    confirmarCerrarSesion: {
      titulo: "¿Cerrar sesión?",
      cuerpo: (n) =>
        `Savia deja de mirar todas tus carpetas y vas a tener que conectar tu cuenta de nuevo la próxima vez que la abras. Los ${conMiles(n)} documentos que ya guardó quedan ocultos — no vas a poder verlos ni buscarlos — y se guardan solo para no tener que subirlos de nuevo si agregas las mismas carpetas otra vez.`,
      cancelar: "Cancelar",
      aceptar: "Cerrar sesión",
    },
    cerrandoSesion: {
      titulo: "Cerrando sesión…",
      cuerpo: "Savia se cierra en unos segundos. Al volver a abrirla, te va a pedir que conectes tu cuenta de nuevo.",
    },
  },
};

// ── El onboarding — seis pantallas ──────────────────────────────────────────
const onboarding = {
  // El mismo "Atrás" vuelve en dos botones de volver distintos (Q2→Q1,
  // Q4→Q3) — una sola clave, no dos copias de la misma palabra.
  accesibilidad: {
    atras: "Atrás",
  },

  // 1 · Qué es esto
  q1: {
    eyebrow: "ANTES DE EMPEZAR",
    titulo: "Esto es lo que va a pasar con tus archivos.",
    hechos: [
      "Savia mira una carpeta y sube lo que hay dentro.",
      "La eliges tú, y la puedes sacar cuando quieras.",
      "Lo que sube entra a tu nombre, no al de tu empresa.",
    ],
    boton: "Empezar",
  },

  // 2 · Vincular el equipo (cinco estados del código)
  q2: {
    // El mockup dice "VINCULAR TU CUENTA" acá y "Vinculado" en el estado
    // aprobado — dos palabras para lo mismo en la misma tarjeta (D7 lo señala
    // textual). Gana "conectar" en los dos lugares.
    eyebrow: "Conectar tu cuenta",
    cuerpo: "Aprueba este código desde tu cuenta de Savia, en el navegador o el teléfono.",
    etiquetaCodigo: "CÓDIGO",
    vence: "Vence en 4 min",
    esperando: {
      titulo: "Esperando tu aprobación",
      cuerpo: "Puede tardar unos minutos. Cuando lo apruebes desde tu cuenta, esta pantalla avisa sola.",
    },
    aprobado: {
      titulo: "Conectado", // era "Vinculado"
      cuerpo: (nombre) => `Conectado a la cuenta de ${nombre}.`,
      boton: "Continuar",
    },
    rechazado: {
      titulo: "Código rechazado",
      cuerpo: "Alguien lo rechazó desde tu cuenta.",
      boton: "Pedir otro código",
    },
    vencido: {
      titulo: "El código venció",
      cuerpo: "Pasó el tiempo antes de que lo aprobaras.",
      boton: "Pedir otro código",
    },
    sinConexion: {
      titulo: "Sin conexión",
      cuerpo: "No pudimos comunicarnos con el servidor. Revisa tu red.",
      boton: "Reintentar",
    },
  },

  // 3 · Permiso de disco — dos contextos: la primera vez (adentro del
  // onboarding) y cuando vuelve a aparecer después, sola, sobre el panel.
  q3: {
    // El nombre de carpeta que se muestra antes de que exista una carpeta
    // elegida — es el sentinel documentado en `permiso_de_disco_concedido`
    // (Rust): la carpeta contra la que efectivamente se prueba el permiso.
    // Sigue siendo texto que la persona lee, así que vive acá y no como
    // literal en `onboarding.js`.
    carpetaCandidataPorDefecto: "Documentos",
    primeraVez: {
      titulo: (carpeta) => `Savia no puede leer ${carpeta}.`,
      cuerpo: "macOS pide permiso explícito para esta carpeta. Ábrelo en Ajustes del Sistema y activa Savia.",
      boton: "Abrir Ajustes del Sistema",
    },
    vuelveDespues: {
      eyebrow: "Savia dejó de poder leer una carpeta",
      titulo: (carpeta) => `No puede leer ${carpeta}`,
      // El mockup mezcla voseo acá ("Abrí… activá…") con tuteo en el resto
      // (D7, punto 4). Pasa a tuteo, como todo lo demás.
      cuerpo: "Abre Ajustes del Sistema y activa Savia para esta carpeta.",
      boton: "Abrir Ajustes del Sistema",
    },
    buscandoPermiso: "Buscando el permiso…",
    permisoDetectado: "Permiso detectado, continuando…",
  },

  // 4 · Elegir la carpeta — la advertencia previa y los cuatro rechazos.
  q4: {
    eyebrow: "ELEGIR CARPETA",
    titulo: "Antes de elegir, tres cosas.",
    bullets: [
      "Todo lo que haya adentro — y en las subcarpetas — va a subir a tu memoria.",
      "Empieza por algo chico. Así puedes revisar qué subió antes de sumar más.",
      "Puedes sacar la carpeta después. Sacarla no borra nada.",
    ],
    boton: "Elegir carpeta…",
    resultados: {
      noPuedeLeer: {
        titulo: "No podemos leer esta carpeta",
        cuerpo: "Es un problema de permiso, no de la carpeta que elegiste.",
        boton: "Revisar permisos",
      },
      yaMirando: {
        titulo: "Ya estás mirando esta carpeta",
        cuerpo: "Es la misma carpeta que ya está en tu lista, o una que la contiene.",
        boton: "Elegir otra",
      },
      contieneOtra: {
        titulo: "Esta carpeta contiene otra que ya sigues",
        cuerpo: (carpeta) => `«${carpeta}» quedaría adentro de esta. Puedes reemplazarla por la nueva.`,
        botonPrimario: "Reemplazar",
        botonSecundario: "Elegir otra",
      },
      muyGrande: {
        titulo: "Es demasiado grande para empezar",
        // El mockup dice "…demasiados archivos para un primer barrido" —
        // "barrido" es la misma palabra de motor que D7 saca de la pantalla 5,
        // colada acá también. Se reescribe sin nombrar el mecanismo.
        cuerpo: "Elegiste todo el disco (o toda tu carpeta personal) — son demasiados archivos para empezar. Elige algo más chico.",
        boton: "Elegir otra",
      },
    },
  },

  // 5 · Primer barrido — la pantalla que D7 señala por nombre.
  q5: {
    // "PRIMER BARRIDO" → "La primera revisión", el otro ajuste explícito del plan.
    eyebrow: "La primera revisión",
    titulo: "Savia está mirando tu carpeta.",
    progreso: (hechos, total) => `${conMiles(hechos)} de ${conMiles(total)} archivos`,
    subiendo: (nombre) => `Subiendo: ${nombre}`,
    // Frase exacta de la tabla D7 para "barrido" — reemplaza "El barrido sigue solo".
    avisoCerrar: "Puedes cerrar esta ventana, Savia sigue sola.",
    seccionArchivos: "Archivos",
    // El mockup usa "Subido" acá para el archivo que salió bien, distinto de
    // "Guardado" que usa la lista de detalle para el mismo estado. Se unifica
    // reusando la clave de `panel.archivo` — una palabra por estado, en toda
    // la app, tal como pide D7.
    filaOk: panel.archivo.guardado,
    // Los mismos dos motivos de D3, para las filas que fallan durante el barrido.
    motivo: panel.motivoDeFallo,
    // Sin esto, la pantalla no tenía ninguna forma de llegar a Q6 — ni el
    // mockup ni el plan definen una condición automática ("cuando termine el
    // barrido" no es un momento observable con un total que hoy es `null`,
    // ver `Carpeta.progreso`), así que "puedes cerrar esta ventana, Savia
    // sigue sola" se vuelve literal: seguir es una acción de la persona, no
    // algo que el barrido dispara solo.
    continuar: "Continuar",
  },

  // 6 · Listo
  q6: {
    eyebrow: "LISTO",
    titulo: "Así vas a encontrar Savia de ahora en más.",
    cuerpo: "Este ícono vive en tu barra de menú. Ábrelo para ver tus carpetas o agregar una nueva.",
    boton: "Empezar a usar Savia",
  },
};

// ── La lista de carpetas (no es onboarding, es el panel real) ──────────────
const folders = {
  titulo: "Carpetas",
  tocarParaVerArchivos: "Toca la carpeta para ver sus archivos",
  agregarCarpeta: panel.agregarCarpeta,

  // D7 alcanza también lo que anuncia un lector de pantalla, no solo el texto
  // visible: los `aria-label` de navegación pura, sin texto al lado que ya
  // los cargue, viven acá.
  accesibilidad: {
    masOpciones: "Más opciones",
    volver: "Volver",
  },

  // El menú «⋯» de una carpeta: abrir en Finder o dejar de mirarla.
  menu: {
    finder: panel.finder,
    dejarDeMirar: panel.dejarDeMirar.menu,
    cancelar: "Cancelar",
  },

  confirmarDejarDeMirar: panel.dejarDeMirar.confirmar,
  dejarDeMirarHecho: panel.dejarDeMirar.hecho,

  // Los resultados de `elegir_carpeta_con_advertencia` — el mismo comando que
  // usa la pantalla 4 del onboarding (`yaMirando`, `contieneOtra`,
  // `noPuedeLeer`, `muyGrande`). Mismo mecanismo, mismas frases: no hay una
  // segunda redacción de "ya estás mirando esta carpeta" escondida acá.
  elegirCarpeta: {
    resultados: onboarding.q4.resultados,
    cancelar: "Cancelar",
  },

  // La vista de archivos de una carpeta.
  archivos: {
    // El mockup usa "Pendiente" acá para el archivo en vuelo, distinto de
    // "Guardando…" que dice la tabla D7 para el mismo estado interno
    // (`Procesando`). Se unifica con `panel.archivo`, mismo motivo que en q5.
    estado: panel.archivo,
    motivo: panel.motivoDeFallo,
    tocarParaAbrir: panel.archivoSuelto.tocarParaAbrir,
    vacio: "Sin archivos todavía.",
    // Reemplaza a `vacio` mientras la carpeta esta en `leyendo`/`actualizando` sin
    // ninguna fila confirmada todavia — sin esto, una carpeta grande recien agregada se
    // ve identica a una vacia de verdad mientras trabaja, y "se demora en cargar" es
    // indistinguible de "esta roto". `enVivo` es la entrada del Map de progreso
    // (`{procesados, total}` o `undefined` si el primer aviso todavia no llego).
    cargando: (estado, enVivo) =>
      enVivo
        ? `${panel.estado[estado]}… ${panel.progreso(enVivo.procesados, enVivo.total)}`
        : `${panel.estado[estado]}…`,
  },

  toasts: {
    abriendoEnFinder: panel.finder.abriendoToast,
    abriendoArchivo: panel.archivoSuelto.abriendoToast,
    carpetaAgregada: "Carpeta agregada",
  },

  // "Volver a vincular" desde el aviso de credenciales — mismo mecanismo que
  // la pantalla 2 del onboarding (`iniciar_vinculacion`/`sondear_vinculacion`,
  // el mismo código de un solo uso, el mismo sondeo), disparado ahora por
  // perder el acceso en vez de por instalar por primera vez. Los estados que
  // no cambian de sentido se reusan tal cual — DRY, misma razón que
  // `elegirCarpeta` reusa `onboarding.q4.resultados` más arriba. Los que SÍ
  // cambian de sentido ("conectar por primera vez" vs. "reconectar") se
  // reescriben acá.
  vincular: {
    eyebrow: "Reconectar Savia",
    cuerpo: "Aprueba este código desde tu cuenta de Savia, en el navegador o el teléfono.",
    etiquetaCodigo: onboarding.q2.etiquetaCodigo,
    vence: onboarding.q2.vence,
    esperando: onboarding.q2.esperando,
    aprobado: {
      titulo: "Reconectado",
      cuerpo: (nombre) => `Reconectado a la cuenta de ${nombre}.`,
      boton: "Volver a mis carpetas",
    },
    rechazado: onboarding.q2.rechazado,
    vencido: onboarding.q2.vencido,
    sinConexion: onboarding.q2.sinConexion,
    cancelar: "Cancelar",
  },
};

export const TEXTOS = { panel, onboarding, folders };
