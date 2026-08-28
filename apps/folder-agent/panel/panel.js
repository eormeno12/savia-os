// ────────────────────────────────────────────────────────────────────────────
// LA VISTA · toma lo que `panel::vista` serializó + el estado de navegación LOCAL
// (`ui`) y los dibuja. Fase 5: el panel real, sobre papel claro — no el onboarding.
//
// **`vista` sigue sin derivarse: viene tal cual de Rust.** Lo único que este
// archivo agrega es `ui` (`subview`, `carpetaId`, `contieneOtra`, `vinculacion`,
// `toast`), y esos campos NO sacan nada del núcleo — son navegación pura
// (list → menu → confirmUnlink → doneUnlink → files, list → contieneOtra al
// agregar una carpeta que contiene otra ya enrolada, list → vincular al pedir
// "Volver a vincular" desde el aviso de credenciales) que `bandeja.js`
// gobierna y le pasa acá para dibujar. Ver el comentario de cabecera de
// `bandeja.js` para el porqué de que viva allá.
//
// Los textos viven en `textos.js` — el único archivo con frases en español. Este
// módulo pide una clave, nunca inventa una palabra.
// ────────────────────────────────────────────────────────────────────────────

import { TEXTOS } from "./textos.js";
import { esc } from "./dom.js";

/** El "confirmar" genérico: título, cuerpo, cancelar + una acción de riesgo
 * variable (tono y destino cambian). Antes copiado byte-a-byte en
 * `vistaVincular` (denegado/vencido/sinConexion), `vistaConfirmarCerrarSesion`,
 * `vistaConfirmUnlink` y `vistaContieneOtra` — solo el texto, el tono del
 * botón de aceptar y a qué comando/nav apunta cada uno cambiaba. */
function atributos(attrs) {
  return Object.entries(attrs ?? {})
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(" ");
}

function confirmarShell({ titulo, cuerpo, cancelar, aceptar }) {
  return `
    <div class="confirmar">
      <div class="confirmar__titulo">${esc(titulo)}</div>
      <div class="confirmar__cuerpo">${esc(cuerpo)}</div>
      <div class="confirmar__acciones">
        <button class="btn btn--secundario" type="button" ${atributos(cancelar.attrs)}>${esc(cancelar.texto)}</button>
        <button class="btn ${aceptar.tono}" type="button" ${atributos(aceptar.attrs)}>${esc(aceptar.texto)}</button>
      </div>
    </div>`;
}

// El check de 15×15 se repetía idéntico en las dos pantallas "hecho" — una
// sola vez acá.
const ICONO_CHECK =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** El "hecho" genérico: ícono de check, título, cuerpo, un botón de volver.
 * Antes copiado byte-a-byte en `vistaVincular` (aprobado) y `vistaDoneUnlink`. */
function hechoShell({ titulo, cuerpo, volver }) {
  return `
    <div class="hecho">
      <div class="hecho__cabecera">
        <span class="hecho__icono" aria-hidden="true">${ICONO_CHECK}</span>
        <div class="hecho__textos">
          <div class="hecho__titulo">${esc(titulo)}</div>
          <div class="hecho__cuerpo">${esc(cuerpo)}</div>
        </div>
      </div>
      <button class="btn btn--secundario hecho__volver" type="button" ${atributos(volver.attrs)}>${esc(volver.texto)}</button>
    </div>`;
}

// El tono del badge por estado de carpeta — mismo mapeo que el mockup
// (`folderToneKind`), pero leído del vocabulario del núcleo y no adivinado.
const TONO_DE_ESTADO = {
  sincronizado: "success",
  leyendo: "info",
  actualizando: "info",
  carpetaAusente: "danger",
  congelado: "warning",
};

// El estado de FILA (indexado/procesando/fallo/retirado) traducido a la clave
// de `textos.js.folders.archivos.estado` — que a su vez ES `panel.archivo`
// (D7: una sola palabra por estado en toda la app; ver el comentario en textos.js).
const CLAVE_DE_FILA = {
  indexado: "guardado",
  procesando: "guardando",
  fallo: "noGuardado",
  retirado: "oculto",
};

/**
 * El nombre "amigable" de una carpeta: los últimos dos tramos de la ruta
 * absoluta, como en el mockup («Proyectos/Cliente X»). No hay directorio de
 * inicio disponible en el webview para acortar con `~`, así que la ruta
 * completa se muestra aparte, truncada, como línea secundaria.
 */
function nombreAmigable(rutaAbsoluta) {
  const partes = String(rutaAbsoluta).split("/").filter(Boolean);
  return partes.length ? partes.slice(-2).join("/") : rutaAbsoluta;
}

function iconoArchivo(estado) {
  switch (estado) {
    case "indexado":
      return '<svg class="archivo-fila__icono" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case "procesando":
      return '<svg class="archivo-fila__icono" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8V12.5L15 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    case "fallo":
      return '<svg class="archivo-fila__icono" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.2" r="1" fill="currentColor"/></svg>';
    case "retirado":
      // La lápida: sin mockup de referencia (el mockup no ejercita este estado
      // en la vista de archivos), así que es un ícono mínimo propio — una
      // marca neutra, ni check ni error, coherente con "ya no está".
      return '<svg class="archivo-fila__icono" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    default:
      throw new Error(`estado de archivo desconocido: ${estado}`);
  }
}

/**
 * D3, ya resuelto en el núcleo: el motivo de UN archivo en `Fallo`.
 * `rechazadoPorSavia` no lleva línea de motivo aparte — el rótulo "No se pudo
 * guardar" ya lo dice todo. `desconocido` tampoco: el diseño la deja sin
 * subtítulo a propósito (ver el comentario en `textos.js`).
 */
function motivoDeFallo(fila) {
  if (fila.motivo === "noSePudoAbrir") return TEXTOS.folders.archivos.motivo.noSePudoAbrir;
  if (fila.motivo === "tipoNoCompatible") return TEXTOS.folders.archivos.motivo.tipoNoCompatible;
  return null;
}

// `enVivo` es la entrada del `Map` de progreso que `bandeja.js` arma desde el
// evento `"progreso"` (canal de la Fase 7) — NO `carpeta.progreso`, que sigue
// siendo siempre `null` (ver el doc de `Carpeta::progreso` en panel.rs:
// `panel::vista` toma el mismo candado que el barrido/drenaje sostienen, así
// que estructuralmente no puede ver ninguno en curso). Solo se usa si su
// `fase` coincide con el `estado` actual de la carpeta — una entrada de
// `"leyendo"` que sobrevivió mientras la carpeta ya pasó a `"actualizando"`
// no es progreso de lo que se está mostrando.
function badgeHtml(carpeta, enVivo) {
  const tono = TONO_DE_ESTADO[carpeta.estado];
  if (!tono) throw new Error(`estado de carpeta desconocido: ${carpeta.estado}`);
  const texto = TEXTOS.panel.estado[carpeta.estado];
  let extra = "";
  if (
    (carpeta.estado === "leyendo" || carpeta.estado === "actualizando") &&
    enVivo &&
    enVivo.fase === carpeta.estado
  ) {
    extra = `<span class="carpeta-card__progreso">${esc(TEXTOS.panel.progreso(enVivo.procesados, enVivo.total))}</span>`;
  }
  return `<span class="badge" data-tono="${esc(tono)}">${esc(texto)}</span>${extra}`;
}

function tarjetaDeCarpeta(carpeta, progreso) {
  const nombre = nombreAmigable(carpeta.rutaAbsoluta);
  const ausente = carpeta.estado === "carpetaAusente";
  const congelada = carpeta.estado === "congelado";
  const motivo = ausente
    ? TEXTOS.panel.motivo.carpetaAusente
    : congelada
      ? TEXTOS.panel.motivo.congelado
      : null;
  return `
    <div class="carpeta-card" data-nav="files" data-carpeta="${esc(carpeta.id)}" role="button" tabindex="0">
      <div class="carpeta-card__cabecera">
        <div class="carpeta-card__identidad">
          <div class="carpeta-card__nombre">${esc(nombre)}</div>
          <div class="carpeta-card__ruta" title="${esc(carpeta.rutaAbsoluta)}"><span>${esc(carpeta.rutaAbsoluta)}</span></div>
        </div>
        <button class="carpeta-card__menu-btn" type="button" data-nav="menu" data-carpeta="${esc(carpeta.id)}" aria-label="${esc(TEXTOS.folders.accesibilidad.masOpciones)}">⋯</button>
      </div>
      <div class="carpeta-card__docs">${esc(TEXTOS.panel.documentos.enSavia(carpeta.indexados))}</div>
      <div class="carpeta-card__badges">${badgeHtml(carpeta, progreso.get(carpeta.id))}</div>
      ${
        motivo
          ? `<div class="carpeta-card__motivo" data-tono="${ausente ? "danger" : "warning"}">${esc(motivo)}</div>`
          : ""
      }
      <div class="carpeta-card__hint">${esc(TEXTOS.folders.tocarParaVerArchivos)}</div>
    </div>`;
}

// **SIEMPRE UN BOTÓN DE VERDAD.** Antes había una variante informativa
// (`aria-disabled`, sin `data-accion`) cuando ya había una carpeta en la
// lista — D4, "por ahora Savia mira una sola a la vez". Esa restricción se
// levantó: el núcleo siempre aguantó más de una (`Almacen`/`trabajar()` ya
// recorren N raíces), así que "agregar" se ata sin condición —haya cero
// carpetas o varias— al mismo comando que usa la pantalla 4 del onboarding
// (`elegir_carpeta_con_advertencia`, ver `COMANDOS` en `bandeja.js`).
function bloqueAgregarCarpeta() {
  const t = TEXTOS.folders.agregarCarpeta;
  return `
    <button class="agregar-carpeta agregar-carpeta--activo" type="button" data-accion="agregarCarpeta">
      <div class="agregar-carpeta__titulo">${esc(t.titulo)}</div>
      <div class="agregar-carpeta__subtitulo">${esc(t.subtitulo)}</div>
    </button>`;
}

/**
 * El aviso de credenciales revocadas. No está en el mockup del rediseño —
 * D2 solo saca "Pausar" de las manos de la persona, no toca `detenido` — así
 * que esto se trae literal de la bandeja de hoy (`textos.js.panel.legado`),
 * adaptado a superficie clara. Vive arriba de la lista porque pesa más que
 * cualquier estado de carpeta: con el token revocado, nada entra, aunque las
 * carpetas se vean perfectas.
 */
function bannerDetenido() {
  const t = TEXTOS.panel.legado.detenido;
  const a = TEXTOS.panel.legado.acciones;
  return `
    <div class="aviso-detenido">
      <div class="aviso-detenido__cabecera">
        <span class="aviso-detenido__icono" aria-hidden="true">⚠</span>
        <span class="aviso-detenido__rotulo">${esc(t.rotulo)}</span>
      </div>
      <div class="aviso-detenido__detalle">${esc(t.detalle)}</div>
      <div class="aviso-detenido__cuerpo"><strong>${esc(t.avisoTitulo)}</strong> ${esc(t.avisoCuerpo)}</div>
      <div class="aviso-detenido__acciones">
        <button class="btn btn--secundario" type="button" data-accion="salir">${esc(a.salir)}</button>
        <!-- Lleva a la subvista "vincular" — bandeja.js la intercepta ANTES
             de mirar COMANDOS, porque arrancar la vinculación necesita el
             código que devuelve iniciar_vinculacion, y eso no entra en el
             patrón genérico "invoke y repintar". -->
        <button class="btn btn--primario" type="button" data-accion="vincular">${esc(a.volverAVincular)}</button>
      </div>
    </div>`;
}

// ── Subvista: vincular ───────────────────────────────────────────────────────
// "Volver a vincular" desde el aviso de credenciales. Mismo mecanismo que la
// pantalla 2 del onboarding (`iniciar_vinculacion`/`sondear_vinculacion`,
// sondeados ahora por `bandeja.js`) — pero la carpeta ya está enrolada, así
// que no hay pantallas 3-6 que repetir: al aprobar, vuelve directo a la lista.
function vistaVincular(vista, vinculacion, progreso) {
  // Defensivo, mismo patrón que `vistaContieneOtra`: sin el estado que
  // `bandeja.js` arma al arrancar el flujo, no hay nada que mostrar acá.
  if (!vinculacion) return vistaLista(vista, progreso);
  const t = TEXTOS.folders.vincular;
  if (vinculacion.estado === "aprobado") {
    const s = t.aprobado;
    return hechoShell({
      titulo: s.titulo,
      cuerpo: s.cuerpo(vinculacion.usuario),
      volver: { texto: s.boton, attrs: { "data-accion": "vincularVolver" } },
    });
  }
  if (vinculacion.estado === "denegado" || vinculacion.estado === "vencido" || vinculacion.estado === "sinConexion") {
    const clave = vinculacion.estado === "denegado" ? "rechazado" : vinculacion.estado;
    const s = t[clave];
    // `sinConexion` no gastó el código pendiente (ver `sondear_vinculacion` en
    // Rust) — reanuda el sondeo en vez de pedir uno nuevo, mismo criterio que
    // `onboarding.js` (`q2-reintentar` vs. `q2-pedir-otro`). Antes las tres
    // ramas caían al mismo botón y "Reintentar" en un blip de red quemaba un
    // código todavía válido.
    const accion = vinculacion.estado === "sinConexion" ? "vincularResumir" : "vincularReintentar";
    return confirmarShell({
      titulo: s.titulo,
      cuerpo: s.cuerpo,
      cancelar: { texto: t.cancelar, attrs: { "data-accion": "vincularVolver" } },
      aceptar: { texto: s.boton, tono: "btn--primario", attrs: { "data-accion": accion } },
    });
  }
  // cargando / esperando: mismo bloque, el código pasa de "······" al valor
  // real apenas `iniciar_vinculacion` contesta — igual que `codigoQuieto` en
  // la pantalla 2 del onboarding.
  const codigoQuieto = vinculacion.estado === "esperando";
  return `
    <div class="confirmar">
      <div class="confirmar__titulo">${esc(t.eyebrow)}</div>
      <div class="confirmar__cuerpo">${esc(t.cuerpo)}</div>
      <div class="vincular__panel">
        <div class="vincular__codigo ${codigoQuieto ? "" : "vincular__codigo--apagado"}">
          <div class="vincular__codigo-etiqueta">${esc(t.etiquetaCodigo)}</div>
          <div class="vincular__codigo-valor">${esc(vinculacion.codigo || "······")}</div>
          ${codigoQuieto ? `<div class="vincular__vence">${esc(t.vence)}</div>` : ""}
        </div>
        <div class="vincular__separador"></div>
        <div class="confirmar__titulo" style="font-size:var(--texto-fila);">${esc(t.esperando.titulo)}</div>
        <div class="confirmar__cuerpo">${esc(t.esperando.cuerpo)}</div>
      </div>
      <div class="confirmar__acciones">
        <button class="btn btn--secundario" type="button" data-accion="vincularVolver">${esc(t.cancelar)}</button>
      </div>
    </div>`;
}

// ── Subvista: confirmarCerrarSesion ──────────────────────────────────────────
// "Cerrar sesión" es más destructivo que "Dejar de mirar" una sola carpeta —
// desenrola TODAS a la vez y pide una cuenta de nuevo en el próximo arranque —
// así que pide la misma confirmación explícita que `confirmUnlink`, mismo
// markup, mismo verbo de D7 para lo que le pasa a los documentos.
function vistaConfirmarCerrarSesion(vista) {
  const t = TEXTOS.panel.legado.confirmarCerrarSesion;
  return confirmarShell({
    titulo: t.titulo,
    cuerpo: t.cuerpo(vista.indexados),
    cancelar: { texto: t.cancelar, attrs: { "data-nav": "list" } },
    aceptar: { texto: t.aceptar, tono: "btn--peligro", attrs: { "data-accion": "cerrarSesion" } },
  });
}

// ── Subvista: cerrandoSesion ─────────────────────────────────────────────────
// `cerrar_sesion` ya corrió — falta que el hilo de trabajo lo persista y
// cierre la app (hasta `demo::INTERVALO`, ver `Compartido::cerrar_sesion_pendiente`
// en `main.rs`). No hay nada más que ofrecer mientras tanto: ni "Cancelar" (ya
// se pidió, no hay vuelta atrás) ni ningún dato que mostrar.
function vistaCerrandoSesion() {
  const t = TEXTOS.panel.legado.cerrandoSesion;
  return `
    <div class="confirmar">
      <div class="confirmar__titulo">${esc(t.titulo)}</div>
      <div class="confirmar__cuerpo">${esc(t.cuerpo)}</div>
    </div>`;
}

// ── Subvista: list ──────────────────────────────────────────────────────────
function vistaLista(vista, progreso) {
  const banner = vista.detenido === "credenciales" ? bannerDetenido() : "";
  const carpetas = vista.carpetas;
  // **Las tarjetas van adentro de su propio scroll; el título y "Agregar
  // carpeta" no.** Sin esto la bandeja crece con cada carpeta que se agrega —
  // sin techo — hasta tapar la pantalla. El límite lo pone
  // `.carpetas-lista__cuerpo` en `panel.css`; acá solo hace falta no meter el
  // título ni el botón adentro de esa caja, para que sigan siempre visibles.
  const tarjetas = carpetas.map((c) => tarjetaDeCarpeta(c, progreso)).join("");
  return `
    ${banner}
    <div class="carpetas-lista">
      <div class="carpetas-lista__titulo">${esc(TEXTOS.folders.titulo)}</div>
      ${tarjetas ? `<div class="carpetas-lista__cuerpo">${tarjetas}</div>` : ""}
      ${bloqueAgregarCarpeta()}
    </div>
    <div class="pie">
      <button class="pie-accion" type="button" data-nav="confirmarCerrarSesion">${esc(TEXTOS.panel.legado.acciones.cerrarSesion)}</button>
      <button class="pie-accion" type="button" data-accion="salir">${esc(TEXTOS.panel.legado.acciones.salir)}</button>
    </div>`;
}

// ── Subvista: menu (⋯) ──────────────────────────────────────────────────────
function vistaMenu(vista, carpetaId, progreso) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  // Defensivo: sin una carpeta que identificar no hay menú que mostrar — se
  // cae a la lista en vez de inventar un título vacío.
  if (!c) return vistaLista(vista, progreso);
  const nombre = nombreAmigable(c.rutaAbsoluta);
  const finder = TEXTOS.folders.menu.finder;
  const dejar = TEXTOS.folders.menu.dejarDeMirar;
  return `
    <div class="menu">
      <div class="menu__titulo">«${esc(nombre)}»</div>
      <div class="menu__opciones">
        <button class="menu__opcion" type="button" data-accion="abrirCarpeta" data-carpeta="${esc(c.id)}">
          <span class="menu__opcion-icono" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z" stroke="currentColor" stroke-width="1.5"/></svg></span>
          <span class="menu__opcion-textos">
            <span class="menu__opcion-titulo">${esc(finder.abrir)}</span>
            <span class="menu__opcion-subtitulo">${esc(finder.abrirSubtitulo)}</span>
          </span>
        </button>
        <button class="menu__opcion" type="button" data-nav="confirmUnlink" data-carpeta="${esc(c.id)}">
          <span class="menu__opcion-icono menu__opcion-icono--danger" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 8L16 16M9 4H15M9 20H15M4 9V15M20 9V15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
          <span class="menu__opcion-textos">
            <span class="menu__opcion-titulo menu__opcion-titulo--danger">${esc(dejar.titulo)}</span>
            <span class="menu__opcion-subtitulo">${esc(dejar.subtitulo)}</span>
          </span>
        </button>
      </div>
      <button class="menu__cancelar" type="button" data-nav="list">${esc(TEXTOS.folders.menu.cancelar)}</button>
    </div>`;
}

// ── Subvista: confirmUnlink ─────────────────────────────────────────────────
function vistaConfirmUnlink(vista, carpetaId, progreso) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  if (!c) return vistaLista(vista, progreso);
  const nombre = nombreAmigable(c.rutaAbsoluta);
  const t = TEXTOS.folders.confirmarDejarDeMirar;
  return confirmarShell({
    titulo: t.titulo(nombre),
    cuerpo: t.cuerpo(c.indexados),
    cancelar: { texto: t.cancelar, attrs: { "data-nav": "list" } },
    aceptar: {
      texto: t.aceptar,
      tono: "btn--peligro",
      attrs: { "data-accion": "desvincular", "data-carpeta": c.id },
    },
  });
}

// ── Subvista: contieneOtra ───────────────────────────────────────────────────
// La candidata elegida contiene una raíz que ya se mira — mismo resultado que
// clasifica la pantalla 4 del onboarding (`clasificar_y_actuar` en Rust, el
// mismo comando para las dos superficies). Reusa el markup de `confirmar`:
// es la misma forma (título, cuerpo, cancelar/aceptar) que ya tiene el CSS.
function vistaContieneOtra(vista, datos, progreso) {
  // Defensivo, mismo patrón que `vistaMenu`/`vistaConfirmUnlink`/`vistaArchivos`:
  // sin la candidata que identificar no hay nada que mostrar acá.
  if (!datos) return vistaLista(vista, progreso);
  const t = TEXTOS.folders.elegirCarpeta.resultados.contieneOtra;
  const nombre = nombreAmigable(datos.ruta);
  return confirmarShell({
    titulo: t.titulo,
    cuerpo: t.cuerpo(nombre),
    cancelar: { texto: TEXTOS.folders.elegirCarpeta.cancelar, attrs: { "data-nav": "list" } },
    aceptar: {
      texto: t.botonPrimario,
      tono: "btn--primario",
      attrs: { "data-accion": "reemplazarCarpeta", "data-carpeta": datos.id },
    },
  });
}

// ── Subvista: doneUnlink ────────────────────────────────────────────────────
// No necesita datos de la carpeta — ya se desvinculó y ya no está en `vista`.
function vistaDoneUnlink() {
  const t = TEXTOS.folders.dejarDeMirarHecho;
  return hechoShell({
    titulo: t.titulo,
    cuerpo: t.cuerpo,
    volver: { texto: t.volver, attrs: { "data-nav": "list" } },
  });
}

function filaDeArchivo(fila, carpetaId) {
  const clave = CLAVE_DE_FILA[fila.estado];
  if (!clave) throw new Error(`estado de archivo desconocido: ${fila.estado}`);
  const rotulo = TEXTOS.folders.archivos.estado[clave];
  const esGuardado = fila.estado === "indexado";
  const esFallo = fila.estado === "fallo";
  const motivo = esFallo ? motivoDeFallo(fila) : null;
  const atributos = esGuardado
    ? ` data-accion="abrirArchivo" data-raiz="${esc(carpetaId)}" data-ruta="${esc(fila.ruta)}" data-nombre="${esc(fila.ruta)}"`
    : "";
  return `
    <div class="archivo-fila${esGuardado ? " archivo-fila--clicable" : ""}" data-estado="${esc(fila.estado)}"${esGuardado ? ' role="button" tabindex="0"' : ""}${atributos}>
      <div class="archivo-fila__linea">
        <span class="archivo-fila__identidad">
          ${iconoArchivo(fila.estado)}
          <span class="archivo-fila__nombre">${esc(fila.ruta)}</span>
        </span>
        <span class="archivo-fila__estado">${esc(rotulo)}</span>
      </div>
      ${motivo ? `<div class="archivo-fila__motivo">${esc(motivo)}</div>` : ""}
    </div>`;
}

// ── Subvista: files ──────────────────────────────────────────────────────────
function vistaArchivos(vista, carpetaId, progreso) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  if (!c) return vistaLista(vista, progreso);
  const nombre = nombreAmigable(c.rutaAbsoluta);
  const enVivo = progreso.get(c.id);
  // Sin fila y todavia trabajando (`leyendo`/`actualizando`) es un caso distinto de
  // vacia de verdad: la primera es "espera, esto sigue"; la segunda es un hecho
  // permanente. Confundirlas es lo que se ve como "se demora en cargar".
  const trabajando = c.estado === "leyendo" || c.estado === "actualizando";
  return `
    <div class="archivos-vista">
      <div class="archivos-vista__cabecera">
        <button class="archivos-vista__atras" type="button" data-nav="list" aria-label="${esc(TEXTOS.folders.accesibilidad.volver)}">←</button>
        <div class="archivos-vista__nombre" title="${esc(c.rutaAbsoluta)}">${esc(nombre)}</div>
      </div>
      <div class="archivos-vista__badges">${badgeHtml(c, enVivo)}</div>
      <div class="archivos-vista__divisor"></div>
      <div class="archivos-vista__lista">
        ${
          c.filas.length
            ? c.filas.map((f) => filaDeArchivo(f, c.id)).join("")
            : trabajando
              ? `<div class="archivos-vista__cargando">${esc(TEXTOS.folders.archivos.cargando(c.estado, enVivo))}</div>`
              : `<div class="archivos-vista__vacio">${esc(TEXTOS.folders.archivos.vacio)}</div>`
        }
        ${
          // El "y N más" nunca se omite cuando hay ocultas — mismo principio
          // que la bandeja de hoy: una lista truncada sin el número se lee
          // como la lista entera.
          c.ocultas > 0 ? `<div class="archivos-vista__mas">y ${esc(c.ocultas)} más</div>` : ""
        }
      </div>
      <div class="archivos-vista__pie">${esc(TEXTOS.folders.archivos.tocarParaAbrir)}</div>
    </div>`;
}

/**
 * El punto de entrada. `ui` es navegación local, gobernada por `bandeja.js`:
 *   - `ui.subview`: "list" | "menu" | "confirmUnlink" | "doneUnlink" | "files" | "contieneOtra"
 *   - `ui.carpetaId`: qué carpeta está en foco (menu / confirmUnlink / files)
 *   - `ui.contieneOtra`: `{id, ruta}` de la raíz que quedaría adentro de la
 *     candidata — la respuesta `contieneOtra` de `elegir_carpeta_con_advertencia`
 *   - `ui.toast`: mensaje efímero, o `null`
 *
 * `progreso` es el `Map<raizId, {fase, procesados, total}>` que `bandeja.js`
 * arma desde el evento `"progreso"` — vive fuera de `vista` por el mismo
 * motivo que `Carpeta.progreso` (en Rust) se queda en `null` para siempre: el
 * candado que protege `vista()` no puede ver un barrido/drenaje en curso, así
 * que el progreso en vivo tiene que llegar por un canal aparte.
 */
export function bandeja(vista, ui = {}, progreso = new Map()) {
  const subview = ui.subview ?? "list";
  let inner;
  switch (subview) {
    case "list":
      inner = vistaLista(vista, progreso);
      break;
    case "menu":
      inner = vistaMenu(vista, ui.carpetaId, progreso);
      break;
    case "confirmUnlink":
      inner = vistaConfirmUnlink(vista, ui.carpetaId, progreso);
      break;
    case "contieneOtra":
      inner = vistaContieneOtra(vista, ui.contieneOtra, progreso);
      break;
    case "vincular":
      inner = vistaVincular(vista, ui.vinculacion, progreso);
      break;
    case "confirmarCerrarSesion":
      inner = vistaConfirmarCerrarSesion(vista);
      break;
    case "cerrandoSesion":
      inner = vistaCerrandoSesion();
      break;
    case "doneUnlink":
      inner = vistaDoneUnlink();
      break;
    case "files":
      inner = vistaArchivos(vista, ui.carpetaId, progreso);
      break;
    default:
      throw new Error(`subvista desconocida: ${subview}`);
  }
  const toast = ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : "";
  return `<div class="bandeja">${inner}${toast}</div>`;
}
