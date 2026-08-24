// ────────────────────────────────────────────────────────────────────────────
// EL ONBOARDING · Fase 6, las seis pantallas. Va en un archivo y no adentro del
// HTML por el mismo motivo que `bandeja.js`: el CSP de la app es `default-src
// 'self'`, así que un `<script>` inline no pasa.
//
// Todo el texto sale de `textos.js` — ESTE archivo no escribe una sola frase en
// español. Si hace falta una palabra nueva, se agrega ahí, no acá.
// ────────────────────────────────────────────────────────────────────────────

import { TEXTOS } from "../textos.js";

const raiz = document.getElementById("raiz");
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** «Proyectos/Cliente X» a partir de una ruta absoluta — los últimos dos
 * segmentos, igual que el mockup los muestra. Es presentación pura (recorta
 * texto para que quepa en una línea), no una decisión sobre el dominio: la
 * ruta absoluta entera sigue siendo la que maneja Rust. */
function nombreCorto(rutaAbsoluta) {
  if (!rutaAbsoluta) return "";
  const partes = rutaAbsoluta.split(/[\\/]/).filter(Boolean);
  return partes.slice(-2).join("/");
}

// ═══════════════════════════════ El estado ══════════════════════════════════

let pantalla = "q1";

/** `cargando` mientras se pide el primer código; después uno de los cinco
 * estados del plan §1 (esperando/aprobado/rechazado/vencido/sinConexion). */
let q2 = { estado: "cargando", codigo: "", usuario: "" };
let q2Temporizador = null;

let q3 = { revisando: false, detectado: false };
let q3Temporizador = null;

/** `advertencia` = todavía no se abrió el diálogo nativo. `resultado` = ya
 * volvió una clasificación (`ResultadoDeEleccion` de Rust). */
let q4 = { vista: "advertencia", resultado: null, contieneOtra: null };

/** La única carpeta que el onboarding conoce — D4 dice que la interfaz
 * muestra una sola aunque el núcleo aguante más. */
let q5 = { carpeta: null };

// ═══════════════════════════════ Navegación ═════════════════════════════════

function detenerTemporizadores() {
  if (q2Temporizador) {
    clearInterval(q2Temporizador);
    q2Temporizador = null;
  }
  if (q3Temporizador) {
    clearInterval(q3Temporizador);
    q3Temporizador = null;
  }
}

async function ir(destino) {
  detenerTemporizadores();
  if (destino === "q3") {
    // La pantalla 3 NO es "paso 3 de 6" si Savia ya tiene el permiso — se
    // salta entera. En Windows `permiso_de_disco_concedido` siempre contesta
    // `true` (ver su comentario en Rust), así que ahí también se salta.
    const yaConcedido = await invoke("permiso_de_disco_concedido").catch(() => false);
    if (yaConcedido) {
      return ir("q4");
    }
  }
  pantalla = destino;
  actualizar();
  if (destino === "q2") entrarQ2();
  else if (destino === "q3") entrarQ3();
  else if (destino === "q5") entrarQ5();
}

function actualizar() {
  raiz.innerHTML = render();
  atar();
}

function atar() {
  for (const el of raiz.querySelectorAll("[data-ir]")) {
    el.addEventListener("click", () => ir(el.dataset.ir));
  }
  for (const el of raiz.querySelectorAll("[data-accion]")) {
    el.addEventListener("click", () => manejarAccion(el.dataset.accion, el.dataset));
  }
}

function manejarAccion(nombre, dataset) {
  switch (nombre) {
    case "q2-pedir-otro":
      pedirCodigoNuevo();
      break;
    case "q2-reintentar":
      // La vinculación server-side sigue viva (un `Err` de red no la consume,
      // ver `sondear_vinculacion` en Rust) — no hace falta pedir código nuevo.
      q2 = { ...q2, estado: "esperando" };
      actualizar();
      sondear();
      iniciarSondeoDeVinculacion();
      break;
    case "q2-continuar":
      ir("q3");
      break;
    case "q3-abrir-ajustes":
      abrirAjustesYSondear();
      break;
    case "q4-elegir":
      q4 = { vista: "advertencia", resultado: null, contieneOtra: null };
      actualizar();
      invoke("elegir_carpeta_con_advertencia").catch((e) =>
        console.error("no se pudo abrir el selector de carpeta", e),
      );
      break;
    case "q4-reemplazar":
      reemplazarCarpeta(dataset.id);
      break;
    case "q6-terminar":
      terminarOnboarding();
      break;
    default:
      console.warn("accion de onboarding sin manejar:", nombre);
  }
}

// ═══════════════════════════ Pantalla 2 · vincular ═══════════════════════════

/** Cadencia del sondeo de `enroll.claim`. Decisión de UX, no del canal — no
 * aplica la disciplina de `contrato::parametros` (esos son números que
 * deciden comportamiento del protocolo; este decide cuán seguido esta
 * VENTANA pregunta). 2s: bastante rápido para que aprobar desde el teléfono
 * se sienta instantáneo, bastante lento para no convertir cada segundo de
 * espera en un POST contra la API. */
const INTERVALO_DE_SONDEO_DE_VINCULACION_MS = 2000;

async function entrarQ2() {
  q2 = { estado: "cargando", codigo: "", usuario: "" };
  actualizar();
  await pedirCodigoNuevo();
}

async function pedirCodigoNuevo() {
  try {
    const r = await invoke("iniciar_vinculacion");
    q2 = { estado: "esperando", codigo: r.codigo, usuario: "" };
  } catch (e) {
    console.error("no se pudo iniciar la vinculacion", e);
    q2 = { estado: "sinConexion", codigo: "", usuario: "" };
  }
  actualizar();
  if (q2.estado === "esperando") iniciarSondeoDeVinculacion();
}

function iniciarSondeoDeVinculacion() {
  if (q2Temporizador) clearInterval(q2Temporizador);
  q2Temporizador = setInterval(sondear, INTERVALO_DE_SONDEO_DE_VINCULACION_MS);
}

async function sondear() {
  let r;
  try {
    r = await invoke("sondear_vinculacion");
  } catch (e) {
    console.error("fallo el sondeo de vinculacion", e);
    return;
  }
  if (r.estado === "pendiente") return; // nada que repintar
  if (q2Temporizador) {
    clearInterval(q2Temporizador);
    q2Temporizador = null;
  }
  q2 = { ...q2, estado: r.estado, usuario: r.usuario ?? "" };
  actualizar();
}

function vistaQ2() {
  const t = TEXTOS.onboarding.q2;
  const codigoQuieto = q2.estado === "esperando" || q2.estado === "sinConexion";
  const bloqueEstado = bloqueDeEstadoQ2(t);
  return `
    <div class="pantalla__contenido">
      <div class="pantalla__cuerpo">
        <div class="encabezado-de-paso">
          <button class="boton--fantasma" data-ir="q1" aria-label="Atrás">&larr;</button>
          <div class="eyebrow" style="margin-bottom:0;">${esc(t.eyebrow)}</div>
        </div>
        <div class="cuerpo">${esc(t.cuerpo)}</div>
        <div class="q2__panel">
          <div class="q2__codigo ${codigoQuieto ? "" : "q2__codigo--apagado"}">
            <div class="q2__codigo-etiqueta">${esc(t.etiquetaCodigo)}</div>
            <div class="q2__codigo-valor">${esc(q2.codigo || "······")}</div>
            ${codigoQuieto ? `<div class="q2__vence">${esc(t.vence)}</div>` : ""}
          </div>
          <div class="q2__separador"></div>
          ${bloqueEstado}
        </div>
      </div>
    </div>`;
}

function bloqueDeEstadoQ2(t) {
  if (q2.estado === "cargando" || q2.estado === "esperando") {
    const s = t.esperando;
    return `
      <div class="estado-con-icono">
        <div class="estado-con-icono__icono--punto"></div>
        <div>
          <div class="estado-con-icono__titulo">${esc(s.titulo)}</div>
          <div class="estado-con-icono__cuerpo">${esc(s.cuerpo)}</div>
        </div>
      </div>`;
  }
  if (q2.estado === "aprobado") {
    const s = t.aprobado;
    return `
      <div class="estado-con-icono">
        <div class="estado-con-icono__icono tono-exito">&#10003;</div>
        <div>
          <div class="estado-con-icono__titulo">${esc(s.titulo)}</div>
          <div class="estado-con-icono__cuerpo">${s.cuerpo(esc(q2.usuario))}</div>
          <div class="estado-con-icono__accion">
            <button class="boton boton--primario boton--chica" data-accion="q2-continuar">${esc(s.boton)}</button>
          </div>
        </div>
      </div>`;
  }
  if (q2.estado === "denegado") {
    const s = t.rechazado;
    return bloqueDeErrorQ2("tono-peligro", "&#10005;", s.titulo, s.cuerpo, s.boton, "q2-pedir-otro");
  }
  if (q2.estado === "vencido") {
    const s = t.vencido;
    return bloqueDeErrorQ2("tono-aviso", "&#9201;", s.titulo, s.cuerpo, s.boton, "q2-pedir-otro");
  }
  // sinConexion
  const s = t.sinConexion;
  return bloqueDeErrorQ2("tono-info", "&#8635;", s.titulo, s.cuerpo, s.boton, "q2-reintentar");
}

function bloqueDeErrorQ2(tono, glifo, titulo, cuerpo, boton, accion) {
  return `
    <div class="estado-con-icono">
      <div class="estado-con-icono__icono ${tono}">${glifo}</div>
      <div>
        <div class="estado-con-icono__titulo">${esc(titulo)}</div>
        <div class="estado-con-icono__cuerpo">${esc(cuerpo)}</div>
        <div class="estado-con-icono__accion">
          <button class="boton boton--primario boton--chica" data-accion="${accion}">${esc(boton)}</button>
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════ Pantalla 3 · permiso de disco ══════════════════

const INTERVALO_DE_SONDEO_DE_PERMISO_MS = 1500;
/** Cuánto se queda "Permiso detectado, continuando…" en pantalla antes de
 * avanzar sola. Solo para que la persona alcance a leer el cambio — no es una
 * medición de nada, es una pausa de lectura. */
const PAUSA_ANTES_DE_AVANZAR_MS = 800;

async function entrarQ3() {
  q3 = { revisando: false, detectado: false };
  actualizar();
}

async function abrirAjustesYSondear() {
  try {
    await invoke("abrir_ajustes_de_privacidad");
  } catch (e) {
    // Mac-only por diseño (ver el comando en Rust); en otra plataforma esta
    // pantalla ya se saltó desde `ir()`, así que un error acá es informativo.
    console.error("no se pudo abrir Ajustes del Sistema", e);
  }
  q3 = { ...q3, revisando: true };
  actualizar();
  if (q3Temporizador) clearInterval(q3Temporizador);
  q3Temporizador = setInterval(sondearPermiso, INTERVALO_DE_SONDEO_DE_PERMISO_MS);
}

async function sondearPermiso() {
  const concedido = await invoke("permiso_de_disco_concedido").catch(() => false);
  if (!concedido) return;
  if (q3Temporizador) {
    clearInterval(q3Temporizador);
    q3Temporizador = null;
  }
  q3 = { ...q3, detectado: true };
  actualizar();
  setTimeout(() => ir("q4"), PAUSA_ANTES_DE_AVANZAR_MS);
}

function vistaQ3() {
  const t = TEXTOS.onboarding.q3;
  // Sentinel documentado en `permiso_de_disco_concedido` (Rust): en Q3
  // todavía no hay una carpeta elegida, así que el nombre que se muestra es
  // el de la carpeta contra la que efectivamente se prueba el permiso.
  const carpetaCandidata = "Documentos";
  return `
    <div class="pantalla__contenido">
      <div class="q3 pantalla__cuerpo">
        <div class="titulo">${esc(t.primeraVez.titulo(carpetaCandidata))}</div>
        <div class="cuerpo">${esc(t.primeraVez.cuerpo)}</div>
        <div class="q4__accion">
          <button class="boton boton--primario" data-accion="q3-abrir-ajustes">${esc(t.primeraVez.boton)}</button>
        </div>
        ${
          q3.revisando
            ? `<div class="q3__estado">
                 <div class="q3__punto ${q3.detectado ? "q3__punto--detectado" : ""}"></div>
                 <div class="q3__estado-texto">${esc(q3.detectado ? t.permisoDetectado : t.buscandoPermiso)}</div>
               </div>`
            : ""
        }
      </div>
    </div>`;
}

// ═══════════════════════════ Pantalla 4 · elegir carpeta ════════════════════

function vistaQ4() {
  const t = TEXTOS.onboarding.q4;
  const bloque = q4.vista === "advertencia" ? bloqueAdvertenciaQ4(t) : bloqueResultadoQ4(t);
  return `
    <div class="pantalla__contenido">
      <div class="pantalla__cuerpo">
        <div class="encabezado-de-paso">
          <button class="boton--fantasma" data-ir="q3" aria-label="Atrás">&larr;</button>
          <div class="eyebrow" style="margin-bottom:0;">${esc(t.eyebrow)}</div>
        </div>
        <div class="titulo" style="margin-top:8px;">${esc(t.titulo)}</div>
        <div class="q4__bullets">
          ${t.bullets
            .map(
              (b, i) =>
                `<div class="q4__bullet"><div class="q4__numero">${i + 1}</div><div class="q4__bullet-texto">${esc(b)}</div></div>`,
            )
            .join("")}
        </div>
        ${bloque}
      </div>
    </div>`;
}

function bloqueAdvertenciaQ4(t) {
  return `<div class="q4__accion"><button class="boton boton--primario" data-accion="q4-elegir">${esc(t.boton)}</button></div>`;
}

function bloqueResultadoQ4(t) {
  const r = q4.resultado;
  if (r === "contieneOtra") {
    const d = t.resultados.contieneOtra;
    const nombre = nombreCorto(q4.contieneOtra.ruta);
    return `
      <div class="q4__resultado tono-aviso">
        <div class="q4__resultado-titulo">${esc(d.titulo)}</div>
        <div class="q4__resultado-cuerpo">${esc(d.cuerpo(nombre))}</div>
        <div class="q4__resultado-acciones">
          <button class="boton boton--chica" data-accion="q4-reemplazar" data-id="${esc(q4.contieneOtra.id)}">${esc(d.botonPrimario)}</button>
          <button class="boton boton--chica boton--secundario" data-accion="q4-elegir">${esc(d.botonSecundario)}</button>
        </div>
      </div>`;
  }
  const mapa = {
    noPuedeLeer: { tono: "tono-peligro", d: t.resultados.noPuedeLeer, ir: "q3" },
    yaMirando: { tono: "tono-info", d: t.resultados.yaMirando, accion: "q4-elegir" },
    muyGrande: { tono: "tono-peligro", d: t.resultados.muyGrande, accion: "q4-elegir" },
  };
  const info = mapa[r];
  if (!info) return "";
  const disparador = info.ir
    ? `data-ir="${info.ir}"`
    : `data-accion="${info.accion}"`;
  return `
    <div class="q4__resultado ${info.tono}">
      <div class="q4__resultado-titulo">${esc(info.d.titulo)}</div>
      <div class="q4__resultado-cuerpo">${esc(info.d.cuerpo)}</div>
      <div class="q4__resultado-acciones">
        <button class="boton boton--chica" ${disparador}>${esc(info.d.boton)}</button>
      </div>
    </div>`;
}

async function reemplazarCarpeta(id) {
  try {
    await invoke("reemplazar_carpeta", { idAReemplazar: id });
    ir("q5");
  } catch (e) {
    console.error("no se pudo reemplazar la carpeta", e);
  }
}

// El diálogo nativo resuelve por evento, no por valor de retorno — mismo
// motivo que `agregar_carpeta` en `main.rs`: `pick_folder` puede tardar lo
// que tarde la persona en elegir, y un comando que espera eso deja la
// ventana colgada.
await listen("resultado-carpeta", (evento) => {
  if (pantalla !== "q4") return;
  const payload = evento.payload;
  if (payload.resultado === "aceptada") {
    ir("q5");
    return;
  }
  q4 = {
    vista: "resultado",
    resultado: payload.resultado,
    contieneOtra: payload.resultado === "contieneOtra" ? payload : null,
  };
  actualizar();
});

// ═══════════════════════════ Pantalla 5 · primer barrido ════════════════════

async function entrarQ5() {
  await actualizarQ5();
}

async function actualizarQ5() {
  try {
    const vista = await invoke("vista");
    q5 = { carpeta: vista.carpetas[0] ?? null };
  } catch (e) {
    console.error("no se pudo leer la vista", e);
  }
  if (pantalla === "q5") actualizar();
}

// El mismo evento que ya usa el panel de hoy (`bandeja.js`): el hilo de
// trabajo avisa cuando terminó una vuelta. Acá solo importa mientras la
// pantalla 5 está activa.
await listen("cambio", () => {
  if (pantalla === "q5") actualizarQ5();
});

function vistaQ5() {
  const t = TEXTOS.onboarding.q5;
  const carpeta = q5.carpeta;
  const filas = carpeta ? carpeta.filas : [];
  const enProceso = filas.find((f) => f.estado === "procesando");
  // `carpeta.progreso` (aplicacion::panel::Carpeta) es SIEMPRE `null` hoy —
  // no hay canal de progreso todavía (Fase 7). Mientras sea `null`, se
  // muestra lo que SÍ hay: cuántos ya quedaron en Savia. El día que el canal
  // exista, esta rama se activa sola.
  const cifra =
    carpeta && carpeta.progreso
      ? esc(t.progreso(carpeta.progreso.procesados, carpeta.progreso.total))
      : `${esc(carpeta ? String(carpeta.indexados) : "0")} ${carpeta && carpeta.indexados === 1 ? "archivo" : "archivos"} en Savia`;
  return `
    <div class="pantalla__contenido">
      <div class="pantalla__cuerpo" style="display:flex;flex-direction:column;flex:1;min-height:0;">
        <div class="eyebrow">${esc(t.eyebrow)}</div>
        <div class="titulo">${esc(t.titulo)}</div>
        <div class="q5__progreso">
          <div class="q5__cifra">${cifra}</div>
          ${enProceso ? `<div class="q5__subiendo">${esc(t.subiendo(enProceso.ruta))}</div>` : ""}
        </div>
        <div class="q5__aviso">
          <span aria-hidden="true">&#9201;</span>
          <div class="q5__aviso-texto">${esc(t.avisoCerrar)}</div>
        </div>
        <div class="q5__seccion">${esc(t.seccionArchivos)}</div>
        <div class="q5__lista">
          ${filas.map(filaDeArchivoQ5).join("")}
        </div>
        <div class="q5__pie">
          <button class="boton boton--primario" data-ir="q6">${esc(t.continuar)}</button>
        </div>
      </div>
    </div>`;
}

function filaDeArchivoQ5(f) {
  const fallo = f.estado === "fallo";
  let etiqueta = "";
  if (fallo) {
    const motivos = TEXTOS.onboarding.q5.motivo;
    etiqueta = f.motivo === "noSePudoAbrir" ? motivos.noSePudoAbrir
      : f.motivo === "tipoNoCompatible" ? motivos.tipoNoCompatible
      : ""; // rechazadoPorSavia / desconocido: sin subtitulo, a proposito
  } else if (f.estado === "indexado") {
    etiqueta = TEXTOS.onboarding.q5.filaOk;
  } else if (f.estado === "procesando") {
    etiqueta = TEXTOS.panel.archivo.guardando;
  } else if (f.estado === "retirado") {
    etiqueta = TEXTOS.panel.archivo.oculto;
  }
  return `
    <div class="fila-archivo">
      <div class="fila-archivo__nombre-grupo">
        <span aria-hidden="true">${fallo ? "&#9888;" : "&#10003;"}</span>
        <span class="fila-archivo__nombre" title="${esc(f.ruta)}">${esc(f.ruta)}</span>
      </div>
      <span class="fila-archivo__estado ${fallo ? "fila-archivo__estado--fallo" : ""}">${esc(etiqueta)}</span>
    </div>`;
}

// ═══════════════════════════════ Pantalla 6 · listo ══════════════════════════

function vistaQ6() {
  const t = TEXTOS.onboarding.q6;
  const carpeta = q5.carpeta;
  return `
    <div class="pantalla__contenido">
      <div class="q6 pantalla__cuerpo">
        <div class="q6__intro">
          <div class="eyebrow">${esc(t.eyebrow)}</div>
          <div class="titulo" style="max-width:30ch;">${esc(t.titulo)}</div>
          <div class="cuerpo" style="max-width:44ch;">${esc(t.cuerpo)}</div>
        </div>
        <div class="q6__vista-previa">
          <div class="q6__vista-previa-titulo">${esc(TEXTOS.folders.titulo)}</div>
          <div class="q6__vista-previa-fila">
            <div>
              <div class="q6__vista-previa-nombre">${esc(nombreCorto(carpeta ? carpeta.rutaAbsoluta : ""))}</div>
              <div class="q6__vista-previa-detalle">${esc(TEXTOS.panel.documentos.enSavia(carpeta ? carpeta.indexados : 0))}</div>
            </div>
            <span class="insignia tono-exito">${esc(TEXTOS.panel.estado.sincronizado)}</span>
          </div>
        </div>
        <div class="q6__pie">
          <button class="boton boton--primario" data-accion="q6-terminar">${esc(t.boton)}</button>
        </div>
      </div>
    </div>`;
}

async function terminarOnboarding() {
  try {
    await invoke("terminar_onboarding");
  } catch (e) {
    console.error("no se pudo terminar el onboarding", e);
  }
}

// ═══════════════════════════════ Pantalla 1 · qué es esto ═══════════════════

function vistaQ1() {
  const t = TEXTOS.onboarding.q1;
  return `
    <div class="pantalla__contenido">
      <div class="pantalla__resplandor"></div>
      <div class="pantalla__cuerpo" style="display:flex;flex-direction:column;flex:1;position:relative;">
        <div class="eyebrow">${esc(t.eyebrow)}</div>
        <div class="titulo">${esc(t.titulo)}</div>
        <div class="q1__hechos">
          ${t.hechos
            .map(
              (h, i) =>
                `<div class="q1__hecho"><div class="q1__numero">${i + 1}</div><div class="q1__texto">${esc(h)}</div></div>`,
            )
            .join("")}
        </div>
        <div class="q1__pie">
          <button class="boton boton--primario" data-ir="q2">${esc(t.boton)}</button>
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════ El despachador ═════════════════════════════

const VISTAS = { q1: vistaQ1, q2: vistaQ2, q3: vistaQ3, q4: vistaQ4, q5: vistaQ5, q6: vistaQ6 };

function render() {
  const oscura = pantalla === "q1";
  return `<div class="pantalla ${oscura ? "pantalla--oscura" : ""}">${VISTAS[pantalla]()}</div>`;
}

actualizar();
