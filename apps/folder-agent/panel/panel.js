// ────────────────────────────────────────────────────────────────────────────
// LA VISTA · toma lo que `panel::vista` serializó + el estado de navegación LOCAL
// (`ui`) y los dibuja. Fase 5: el panel real, sobre papel claro — no el onboarding.
//
// **`vista` sigue sin derivarse: viene tal cual de Rust.** Lo único que este
// archivo agrega es `ui` (`subview`, `carpetaId`, `toast`), y esos tres campos
// NO sacan nada del núcleo — son navegación pura (list → menu → confirmUnlink →
// doneUnlink → files) que `bandeja.js` gobierna y le pasa acá para dibujar. Ver
// el comentario de cabecera de `bandeja.js` para el porqué de que viva allá.
//
// Los textos viven en `textos.js` — el único archivo con frases en español. Este
// módulo pide una clave, nunca inventa una palabra.
// ────────────────────────────────────────────────────────────────────────────

import { TEXTOS } from "./textos.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

// El tono del badge por estado de carpeta — mismo mapeo que el mockup
// (`folderToneKind`), pero leído del vocabulario del núcleo y no adivinado.
const TONO_DE_ESTADO = {
  sincronizado: "success",
  barriendo: "info",
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

function badgeHtml(carpeta) {
  const tono = TONO_DE_ESTADO[carpeta.estado];
  if (!tono) throw new Error(`estado de carpeta desconocido: ${carpeta.estado}`);
  const texto = TEXTOS.panel.estado[carpeta.estado];
  let extra = "";
  // `carpeta.progreso` HOY siempre es `null` (ver el doc de `Carpeta::progreso`
  // en panel.rs) — así que "no mostrar nada" es el camino normal, y esta rama
  // queda escrita mirando hacia adelante, sin ejercitar todavía. La frase es
  // literal y no sale de `textos.js`: esa clave no existe aún porque el campo
  // nunca tuvo un valor real que la pidiera — anotado para cuando la Fase 7
  // llene `progreso` de verdad.
  if (carpeta.estado === "barriendo" && carpeta.progreso) {
    const { procesados, total } = carpeta.progreso;
    extra = `<span class="carpeta-card__progreso">${esc(procesados)} de ${esc(total)} documentos</span>`;
  }
  return `<span class="badge" data-tono="${esc(tono)}">${esc(texto)}</span>${extra}`;
}

function tarjetaDeCarpeta(carpeta) {
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
      <div class="carpeta-card__badges">${badgeHtml(carpeta)}</div>
      ${
        motivo
          ? `<div class="carpeta-card__motivo" data-tono="${ausente ? "danger" : "warning"}">${esc(motivo)}</div>`
          : ""
      }
      <div class="carpeta-card__hint">${esc(TEXTOS.folders.tocarParaVerArchivos)}</div>
    </div>`;
}

function bloqueAgregarCarpeta(activo) {
  const t = TEXTOS.folders.agregarCarpeta;
  if (activo) {
    // Sin carpetas todavía (lista vacía, o recién se dejó de mirar la única
    // que había): acá sí hace falta poder agregar, así que el bloque es un
    // botón de verdad y se ata a `agregar_carpeta`.
    return `
      <button class="agregar-carpeta agregar-carpeta--activo" type="button" data-accion="agregarCarpeta">
        <div class="agregar-carpeta__titulo">${esc(t.titulo)}</div>
        <div class="agregar-carpeta__subtitulo">${esc(t.subtitulo)}</div>
      </button>`;
  }
  // D4: el núcleo aguanta más de una carpeta, la interfaz muestra una sola —
  // así que con una carpeta ya en la lista, este bloque es informativo, no
  // interactivo (igual que en el mockup: opacidad reducida, sin `onClick`).
  return `
    <div class="agregar-carpeta" aria-disabled="true">
      <div class="agregar-carpeta__titulo">${esc(t.titulo)}</div>
      <div class="agregar-carpeta__subtitulo">${esc(t.subtitulo)}</div>
    </div>`;
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
        <!-- "vincular" todavía no tiene comando (ver bandeja.js: COMANDOS no lo
             lista) — el botón se dibuja igual y NO se ata: un botón que no
             responde dice la verdad; uno que responde sin hacer nada, no. -->
        <button class="btn btn--primario" type="button" data-accion="vincular">${esc(a.volverAVincular)}</button>
      </div>
    </div>`;
}

// ── Subvista: list ──────────────────────────────────────────────────────────
function vistaLista(vista) {
  const banner = vista.detenido === "credenciales" ? bannerDetenido() : "";
  const carpetas = vista.carpetas;
  const cuerpo = carpetas.length
    ? `${carpetas.map(tarjetaDeCarpeta).join("")}${bloqueAgregarCarpeta(false)}`
    : bloqueAgregarCarpeta(true);
  return `
    ${banner}
    <div class="carpetas-lista">
      <div class="carpetas-lista__titulo">${esc(TEXTOS.folders.titulo)}</div>
      ${cuerpo}
    </div>
    <button class="pie-salir" type="button" data-accion="salir">${esc(TEXTOS.panel.legado.acciones.salir)}</button>`;
}

// ── Subvista: menu (⋯) ──────────────────────────────────────────────────────
function vistaMenu(vista, carpetaId) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  // Defensivo: sin una carpeta que identificar no hay menú que mostrar — se
  // cae a la lista en vez de inventar un título vacío.
  if (!c) return vistaLista(vista);
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
function vistaConfirmUnlink(vista, carpetaId) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  if (!c) return vistaLista(vista);
  const nombre = nombreAmigable(c.rutaAbsoluta);
  const t = TEXTOS.folders.confirmarDejarDeMirar;
  return `
    <div class="confirmar">
      <div class="confirmar__titulo">${esc(t.titulo(nombre))}</div>
      <div class="confirmar__cuerpo">${esc(t.cuerpo(c.indexados))}</div>
      <div class="confirmar__acciones">
        <button class="btn btn--secundario" type="button" data-nav="list">${esc(t.cancelar)}</button>
        <button class="btn btn--peligro" type="button" data-accion="desvincular" data-carpeta="${esc(c.id)}">${esc(t.aceptar)}</button>
      </div>
    </div>`;
}

// ── Subvista: doneUnlink ────────────────────────────────────────────────────
// No necesita datos de la carpeta — ya se desvinculó y ya no está en `vista`.
function vistaDoneUnlink() {
  const t = TEXTOS.folders.dejarDeMirarHecho;
  return `
    <div class="hecho">
      <div class="hecho__cabecera">
        <span class="hecho__icono" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <div class="hecho__textos">
          <div class="hecho__titulo">${esc(t.titulo)}</div>
          <div class="hecho__cuerpo">${esc(t.cuerpo)}</div>
        </div>
      </div>
      <button class="btn btn--secundario hecho__volver" type="button" data-nav="list">${esc(t.volver)}</button>
    </div>`;
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
function vistaArchivos(vista, carpetaId) {
  const c = vista.carpetas.find((x) => x.id === carpetaId);
  if (!c) return vistaLista(vista);
  const nombre = nombreAmigable(c.rutaAbsoluta);
  return `
    <div class="archivos-vista">
      <div class="archivos-vista__cabecera">
        <button class="archivos-vista__atras" type="button" data-nav="list" aria-label="${esc(TEXTOS.folders.accesibilidad.volver)}">←</button>
        <div class="archivos-vista__nombre" title="${esc(c.rutaAbsoluta)}">${esc(nombre)}</div>
      </div>
      <div class="archivos-vista__badges">${badgeHtml(c)}</div>
      <div class="archivos-vista__divisor"></div>
      <div class="archivos-vista__lista">
        ${
          c.filas.length
            ? c.filas.map((f) => filaDeArchivo(f, c.id)).join("")
            : `<div class="archivos-vista__vacio">Sin archivos todavía.</div>`
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
 *   - `ui.subview`: "list" | "menu" | "confirmUnlink" | "doneUnlink" | "files"
 *   - `ui.carpetaId`: qué carpeta está en foco (menu / confirmUnlink / files)
 *   - `ui.toast`: mensaje efímero, o `null`
 */
export function bandeja(vista, ui = {}) {
  const subview = ui.subview ?? "list";
  let inner;
  switch (subview) {
    case "list":
      inner = vistaLista(vista);
      break;
    case "menu":
      inner = vistaMenu(vista, ui.carpetaId);
      break;
    case "confirmUnlink":
      inner = vistaConfirmUnlink(vista, ui.carpetaId);
      break;
    case "doneUnlink":
      inner = vistaDoneUnlink();
      break;
    case "files":
      inner = vistaArchivos(vista, ui.carpetaId);
      break;
    default:
      throw new Error(`subvista desconocida: ${subview}`);
  }
  const toast = ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : "";
  return `<div class="bandeja">${inner}${toast}</div>`;
}
