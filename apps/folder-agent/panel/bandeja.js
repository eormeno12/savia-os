// ────────────────────────────────────────────────────────────────────────────
// EL POPOVER. **Va en un archivo y no adentro del HTML** porque el CSP de la app es
// `default-src 'self'`: un `<script>` inline no lo pasa, y el sintoma seria una ventana
// en blanco sin ningun error visible salvo en la consola del webview.
//
// ── LA NAVEGACIÓN ENTRE SUBVISTAS ES PURA UI, Y VIVE ACÁ ────────────────────
//
// `panel.js` sigue sin estado propio: dibuja `(vista, ui)` y nada más. Pero
// `list → menu → confirmUnlink → doneUnlink → files` no es un hecho del núcleo
// —Rust no sabe ni le importa en qué pantalla está mirando la persona— así que
// ese estado (`ui.subview`, `ui.carpetaId`, `ui.toast`) es enteramente de este
// archivo. La regla que separa las dos mitades: **si cambiar de pantalla no
// necesita preguntarle nada a Rust, es `ui` y se resuelve con un repintado
// local (`renderizar`); si necesita un comando real —desvincular, abrir algo,
// agregar una carpeta—, es `invoke` y punto.**
// ────────────────────────────────────────────────────────────────────────────

import { bandeja } from "./panel.js";
import { TEXTOS } from "./textos.js";

const raiz = document.getElementById("raiz");
const { invoke } = window.__TAURI__.core;

// La última foto que llegó de Rust, y la navegación local sobre esa foto. Los
// dos sobreviven a un repintado: un "cambio" de fondo no te saca de donde
// estás mirando.
let vistaActual = null;
const ui = { subview: "list", carpetaId: null, toast: null };
let temporizadorToast = null;

// LA ALTURA DE LA VENTANA SIGUE AL CONTENIDO. Una ventana fija deja la bandeja de
// una carpeta con medio popover vacío, y la de cinco cortada por la mitad.
//
// **Va por un comando propio y no por `setSize`.** En macOS cambiar el alto tiene que
// fijar el borde de arriba —Cocoa mide desde abajo, y si no la tapa se sube encima de la
// barra— e invalidar la sombra del sistema, que esta cacheada con la silueta anterior.
// Las tres cosas son una sola operacion; ver `macos::ajustar_alto`.
async function ajustar() {
  await invoke("ajustar_alto", { alto: Math.ceil(document.body.scrollHeight) });
}

function mostrarToast(mensaje) {
  clearTimeout(temporizadorToast);
  ui.toast = mensaje;
  temporizadorToast = setTimeout(() => {
    ui.toast = null;
    renderizar();
  }, 1800);
}

// Repinta la ÚLTIMA foto conocida con el `ui` actual — sin volver a pedirle
// nada a Rust. Es lo que corre en CADA click de navegación pura y después de
// una acción que no cambió ningún dato (abrir en Finder, abrir un archivo).
async function renderizar() {
  if (!vistaActual) return;
  raiz.innerHTML = bandeja(vistaActual, ui);
  atar();
  await ajustar();
}

async function pintar() {
  // Si `vista` falla y YA HAY algo dibujado, se deja lo último. **No se pinta un estado
  // de error inventado**: el panel dice cosas sobre las carpetas del usuario, y decir
  // «Carpeta ausente» porque fallo una llamada interna seria mentir sobre su disco.
  try {
    vistaActual = await invoke("vista");
    await renderizar();
  } catch (e) {
    console.error("no se pudo pintar la vista", e);
    // **PERO SI NO HAY NADA DIBUJADO, EL FALLO TIENE QUE VERSE.** La ventana es
    // transparente: un panel que no pinta no es una ventana vacia, es NINGUNA ventana —
    // la persona hace clic en el icono, no pasa nada, y eso es indistinguible de que el
    // icono este roto. Fue exactamente el sintoma que costo diagnosticar.
    if (!raiz.firstChild) {
      const msg = String(e).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
      raiz.innerHTML =
        '<div class="bandeja"><div class="aviso-detenido">' +
        '<div class="aviso-detenido__cabecera"><span class="aviso-detenido__icono" aria-hidden="true">⚠</span></div>' +
        `<div class="aviso-detenido__cuerpo"><strong>${TEXTOS.panel.legado.errorDePintado}</strong> ${msg}</div>` +
        "</div></div>";
      await ajustar();
    }
  }
}

// Las acciones REALES las nombra `panel.js` con `data-accion` y las ata este
// archivo a un comando Tauri. La navegación pura las nombra con `data-nav` y
// nunca pasa por `invoke`. Las que todavía no tienen comando (`vincular`)
// **no se atan**: un boton que no responde dice la verdad; uno que responde
// sin hacer nada, no.
const COMANDOS = {
  salir: "salir",
  abrirCarpeta: "abrir_carpeta",
  agregarCarpeta: "agregar_carpeta",
  desvincular: "desvincular",
  abrirArchivo: "abrir_archivo",
};

function atar() {
  for (const el of raiz.querySelectorAll("[data-nav], [data-accion]")) {
    el.addEventListener("click", (e) => manejarClick(e, el));
    // La tarjeta de carpeta y la fila de archivo son `<div tabindex="0">`, no
    // `<button>` — el navegador no les da activación por teclado gratis. Los
    // botones de verdad (menú, confirmar, "+ Agregar carpeta") ya la tienen y
    // este listener es un no-op inofensivo para ellos.
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      manejarClick(e, el);
    });
  }
}

async function manejarClick(e, el) {
  // Un elemento anidado (el "⋯" adentro de la tarjeta, una fila adentro de la
  // lista de archivos) nunca deja que su click también dispare al contenedor
  // que lo envuelve — mismo motivo que el mockup usa `stopPropagation` en
  // `openMenu`.
  e.stopPropagation();

  const destino = el.dataset.nav;
  if (destino) {
    ui.subview = destino;
    if (el.dataset.carpeta) ui.carpetaId = el.dataset.carpeta;
    await renderizar();
    return;
  }

  const clave = el.dataset.accion;
  const comando = COMANDOS[clave];
  if (!comando) return; // no atado a propósito — ver el comentario de arriba

  const args = {};
  if (comando === "desvincular" || comando === "abrir_carpeta") {
    args.id = el.dataset.carpeta ?? ui.carpetaId;
  }
  if (comando === "abrir_archivo") {
    args.raizId = el.dataset.raiz ?? ui.carpetaId;
    args.ruta = el.dataset.ruta;
  }

  try {
    await invoke(comando, Object.keys(args).length ? args : undefined);
  } catch (err) {
    console.error(`fallo ${comando}`, err);
    return;
  }

  if (comando === "salir") return; // la app se cierra: no hay nada que repintar

  if (comando === "abrir_carpeta") {
    // "Abrir en Finder" vuelve a la lista y avisa — igual que `openInFinder`
    // en el mockup. No cambió ningún dato: alcanza con repintar local.
    ui.subview = "list";
    mostrarToast(TEXTOS.folders.toasts.abriendoEnFinder);
    await renderizar();
    return;
  }

  if (comando === "abrir_archivo") {
    mostrarToast(TEXTOS.folders.toasts.abriendoArchivo(el.dataset.nombre ?? ""));
    await renderizar();
    return;
  }

  if (comando === "desvincular") {
    ui.subview = "doneUnlink";
  }
  // `desvincular` y `agregar_carpeta` sí cambian datos del lado de Rust —
  // se repinta desde una `vista` fresca, no desde la que ya estaba en pantalla.
  await pintar();
}

await pintar();
// El hilo de trabajo avisa cuando terminó un barrido. **Se repinta por aviso y no
// por reloj**: un `setInterval` corto gasta batería para no mostrar nada nuevo, y
// uno largo deja el panel viejo justo cuando la persona lo abre para mirarlo.
//
// La navegación local (`ui.subview`) sobrevive a este repintado: un "cambio" de
// fondo no saca a la persona de donde está mirando.
await window.__TAURI__.event.listen("cambio", pintar);
