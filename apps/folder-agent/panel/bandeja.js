// ────────────────────────────────────────────────────────────────────────────
// EL POPOVER. **Va en un archivo y no adentro del HTML** porque el CSP de la app es
// `default-src 'self'`: un `<script>` inline no lo pasa, y el sintoma seria una ventana
// en blanco sin ningun error visible salvo en la consola del webview.
//
// ── LA NAVEGACIÓN ENTRE SUBVISTAS ES PURA UI, Y VIVE ACÁ ────────────────────
//
// `panel.js` sigue sin estado propio: dibuja `(vista, ui)` y nada más. Pero
// `list → menu → confirmUnlink → doneUnlink → files` (`list → contieneOtra`
// al agregar una carpeta que contiene otra ya enrolada, `list → vincular` al
// pedir "Volver a vincular" desde el aviso de credenciales) no es un hecho
// del núcleo —Rust no sabe ni le importa en qué pantalla está mirando la
// persona— así que ese estado (`ui.subview`, `ui.carpetaId`,
// `ui.contieneOtra`, `ui.vinculacion`, `ui.toast`) es enteramente de este
// archivo. La regla que separa las dos mitades: **si cambiar de pantalla no
// necesita preguntarle nada a Rust, es `ui` y se resuelve con un repintado
// local (`renderizar`); si necesita un comando real —desvincular, abrir
// algo, agregar una carpeta, vincular—, es `invoke` y punto.**
// ────────────────────────────────────────────────────────────────────────────

import { bandeja } from "./panel.js";
import { TEXTOS } from "./textos.js";
import { esc } from "./dom.js";
import { INTERVALO_DE_SONDEO_DE_VINCULACION_MS, pedirCodigoNuevo, unSondeo } from "./vinculacion.js";

const raiz = document.getElementById("raiz");
const { invoke } = window.__TAURI__.core;

// La última foto que llegó de Rust, y la navegación local sobre esa foto. Los
// dos sobreviven a un repintado: un "cambio" de fondo no te saca de donde
// estás mirando.
let vistaActual = null;
const ui = { subview: "list", carpetaId: null, contieneOtra: null, vinculacion: null, toast: null };
let temporizadorToast = null;
let temporizadorDeVinculacion = null;

// El progreso en vivo del canal de la Fase 7 (`"progreso"`, ver `main.rs`),
// por raíz: `{fase, procesados, total}`. **Nunca pasa por `invoke`, nunca se
// persiste** — es un dato de este momento, no del `Almacen`, y se pierde con
// cada reinicio del panel igual que se pierde en Rust (`Carpeta.progreso`
// siempre es `null`, ver su doc). Se limpia entero en cada `"cambio"`: para
// entonces la vuelta que lo produjo ya terminó para TODAS las raíces.
const progresoEnVivo = new Map();

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
  raiz.innerHTML = bandeja(vistaActual, ui, progresoEnVivo);
  atar();
  await ajustar();
}

async function pintar() {
  // La vuelta que este "cambio" cierra ya terminó su barrido y su drenaje
  // para TODAS las raíces (`main.rs` emite un solo `"cambio"` al final del
  // bloque que recorre `raices`) — cualquier progreso que quedara en el
  // `Map` es de una vuelta que ya no está en curso.
  progresoEnVivo.clear();
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
      const msg = esc(e);
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
// nunca pasa por `invoke`.
//
// **`agregarCarpeta` va a `elegir_carpeta_con_advertencia`, no a un comando
// propio del panel.** Es el mismo comando que usa la pantalla 4 del
// onboarding — clasifica la elección (ya la miro / esta contiene una que ya
// miro / no se puede leer) antes de enrolar, y el panel escucha el mismo
// evento `"resultado-carpeta"` para reaccionar. DRY: un solo lugar que sabe
// clasificar una carpeta candidata, dos superficies que lo llaman.
//
// **`vincular`/`vincularReintentar`/`vincularResumir`/`vincularVolver` NO
// están acá.** Van a `iniciar_vinculacion`/`sondear_vinculacion` — los mismos
// dos comandos que la pantalla 2 del onboarding, DRY otra vez (ver
// `./vinculacion.js`) — pero ninguno entra en el patrón genérico "invoke y
// repintar" de `manejarClick`: arrancar la vinculación necesita el código que
// devuelve la respuesta para dibujarlo, y el sondeo es un `setInterval`
// propio, no un click más. Se interceptan aparte, antes de mirar esta tabla —
// ver `manejarClick`.
//
// Cada entrada dice el comando de Tauri, cómo armar sus argumentos (si
// necesita), y su política de repintado tras invocar — **las tres son
// distintas y a propósito, no una sola por default**:
//   - `"ninguno"`: la app se cierra (`salir`), no hay nada que repintar.
//   - `"local"`: repinta la ÚLTIMA `vista` conocida con el `ui` que
//     `despuesDeInvocar` haya dejado — el comando no cambió ningún dato del
//     lado de Rust (abrir en Finder, abrir un archivo) o el cambio ya se
//     refleja solo sin pedir nada nuevo (`cerrar_sesion` se anima local
//     mientras el hilo de trabajo persiste el cierre).
//   - `"fresco"`: pide una `vista` nueva — el comando sí cambió datos
//     (`desvincular`, `reemplazar_carpeta`, `elegir_carpeta_con_advertencia`).
const COMANDOS = {
  salir: { comando: "salir", repintado: "ninguno" },
  abrirCarpeta: {
    comando: "abrir_carpeta",
    args: (el) => ({ id: el.dataset.carpeta ?? ui.carpetaId }),
    repintado: "local",
    despuesDeInvocar: () => {
      // "Abrir en Finder" vuelve a la lista y avisa — igual que
      // `openInFinder` en el mockup.
      ui.subview = "list";
      mostrarToast(TEXTOS.folders.toasts.abriendoEnFinder);
    },
  },
  agregarCarpeta: { comando: "elegir_carpeta_con_advertencia", repintado: "fresco" },
  desvincular: {
    comando: "desvincular",
    args: (el) => ({ id: el.dataset.carpeta ?? ui.carpetaId }),
    repintado: "fresco",
    despuesDeInvocar: () => {
      ui.subview = "doneUnlink";
    },
  },
  abrirArchivo: {
    comando: "abrir_archivo",
    args: (el) => ({ raizId: el.dataset.raiz ?? ui.carpetaId, ruta: el.dataset.ruta }),
    repintado: "local",
    despuesDeInvocar: (el) => {
      mostrarToast(TEXTOS.folders.toasts.abriendoArchivo(el.dataset.nombre ?? ""));
    },
  },
  reemplazarCarpeta: {
    comando: "reemplazar_carpeta",
    args: (el) => ({ idAReemplazar: el.dataset.carpeta ?? ui.contieneOtra?.id }),
    repintado: "fresco",
    despuesDeInvocar: () => {
      ui.subview = "list";
      ui.contieneOtra = null;
    },
  },
  cerrarSesion: {
    comando: "cerrar_sesion",
    repintado: "local",
    despuesDeInvocar: () => {
      // La app se cierra sola en cuanto el hilo de trabajo persista el cierre
      // (hasta `demo::INTERVALO`) — no hay `vista` fresca que pedir mientras
      // tanto, y pedirla arriesga una carrera contra el propio cierre.
      ui.subview = "cerrandoSesion";
    },
  },
};

function detenerSondeoDeVinculacion() {
  if (temporizadorDeVinculacion) {
    clearInterval(temporizadorDeVinculacion);
    temporizadorDeVinculacion = null;
  }
}

async function iniciarVinculacion() {
  detenerSondeoDeVinculacion();
  ui.subview = "vincular";
  ui.vinculacion = { estado: "cargando", codigo: "", usuario: "" };
  await renderizar();
  ui.vinculacion = await pedirCodigoNuevo(invoke);
  await renderizar();
  if (ui.vinculacion.estado === "esperando") {
    temporizadorDeVinculacion = setInterval(sondearVinculacion, INTERVALO_DE_SONDEO_DE_VINCULACION_MS);
  }
}

// `sinConexion`: la vinculación server-side sigue viva (un `Err` de red no la
// consume) — no hace falta pedir código nuevo, alcanza con reanudar el sondeo.
// Mismo criterio que `onboarding.js` distingue con `q2-reintentar` vs.
// `q2-pedir-otro`; acá lo dispara el botón que `vistaVincular` arma con
// `data-accion="vincularResumir"` solo para ese estado.
async function resumirSondeoDeVinculacion() {
  ui.vinculacion = { ...ui.vinculacion, estado: "esperando" };
  await renderizar();
  await sondearVinculacion();
  temporizadorDeVinculacion = setInterval(sondearVinculacion, INTERVALO_DE_SONDEO_DE_VINCULACION_MS);
}

async function sondearVinculacion() {
  let r;
  try {
    r = await unSondeo(invoke);
  } catch (e) {
    console.error("fallo el sondeo de vinculacion", e);
    return;
  }
  if (!r) return; // pendiente, nada que repintar
  detenerSondeoDeVinculacion();
  ui.vinculacion = { ...ui.vinculacion, ...r };
  await renderizar();
}

// Cancelar durante la espera, o volver después de "Reconectado": las dos
// veces hay que parar el sondeo si sigue corriendo y traer una `vista`
// fresca — el aviso de credenciales tarda hasta el próximo `"cambio"` en
// desaparecer (lo drena `trabajar()`, no este comando), así que no hay nada
// más que hacer del lado de Rust acá.
async function volverDeVincular() {
  detenerSondeoDeVinculacion();
  ui.subview = "list";
  ui.vinculacion = null;
  await pintar();
}

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

  // Interceptadas ANTES de `COMANDOS` — ver el comentario ahí sobre por qué
  // quedan afuera del patrón genérico "invoke y repintar".
  if (clave === "vincular" || clave === "vincularReintentar") {
    await iniciarVinculacion();
    return;
  }
  if (clave === "vincularResumir") {
    await resumirSondeoDeVinculacion();
    return;
  }
  if (clave === "vincularVolver") {
    await volverDeVincular();
    return;
  }

  const descriptor = COMANDOS[clave];
  if (!descriptor) return; // no atado a propósito — ver el comentario de arriba

  const args = descriptor.args ? descriptor.args(el) : undefined;

  try {
    await invoke(descriptor.comando, args);
  } catch (err) {
    console.error(`fallo ${descriptor.comando}`, err);
    return;
  }

  descriptor.despuesDeInvocar?.(el);

  if (descriptor.repintado === "ninguno") return; // la app se cierra: no hay nada que repintar
  if (descriptor.repintado === "local") {
    // No cambió ningún dato del lado de Rust (o el cambio ya se refleja sin
    // pedir nada nuevo): alcanza con repintar la última `vista` conocida.
    await renderizar();
    return;
  }
  // "fresco": `desvincular`, `reemplazar_carpeta` y
  // `elegir_carpeta_con_advertencia` (esta última cuando resuelve "aceptada")
  // cambian datos del lado de Rust — se repinta desde una `vista` fresca, no
  // desde la que ya estaba en pantalla. `elegir_carpeta_con_advertencia` en sí
  // resuelve de inmediato (el diálogo nativo es asincrónico, ver el
  // comentario de `resultado-carpeta` más abajo), así que este `pintar()` acá
  // no encuentra nada nuevo todavía — el repintado de verdad llega con el
  // evento.
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

// El progreso en vivo de `Leyendo`/`Actualizando` (canal de la Fase 7,
// `ciclo::barrer_reportando`/`ciclo::drenar_reportando`). **Repinta local, no
// pide `vista()`**: el progreso no es un dato del `Almacen` —`main.rs` lo
// emite desde adentro del candado, mientras el barrido/drenaje todavía está
// en curso— así que no hay nada nuevo que pedirle a Rust, solo un número que
// ya llegó en el propio evento.
await window.__TAURI__.event.listen("progreso", async (evento) => {
  const { raiz: raizId, fase, procesados, total } = evento.payload;
  progresoEnVivo.set(raizId, { fase, procesados, total });
  await renderizar();
});

// Cómo resuelve `elegir_carpeta_con_advertencia` — por evento, no por valor de
// retorno, porque el diálogo nativo es asincrónico (mismo motivo que documenta
// `onboarding.js` para la pantalla 4, que escucha el mismo evento). `aceptada`
// no necesita tocar `ui`: el `"cambio"` que el propio comando emite ya trae la
// carpeta nueva a la próxima `vista`; acá solo hace falta avisarlo con un toast.
await window.__TAURI__.event.listen("resultado-carpeta", async (evento) => {
  const r = evento.payload;
  if (r.resultado === "aceptada") {
    mostrarToast(TEXTOS.folders.toasts.carpetaAgregada);
    await renderizar();
    return;
  }
  if (r.resultado === "contieneOtra") {
    ui.subview = "contieneOtra";
    ui.contieneOtra = { id: r.id, ruta: r.ruta };
    await renderizar();
    return;
  }
  // yaMirando / noPuedeLeer / muyGrande: un aviso corto alcanza, no hace falta
  // una pantalla — mismos textos que la pantalla 4 del onboarding.
  const t = TEXTOS.folders.elegirCarpeta.resultados[r.resultado];
  mostrarToast(t ? t.titulo : r.resultado);
  await renderizar();
});
