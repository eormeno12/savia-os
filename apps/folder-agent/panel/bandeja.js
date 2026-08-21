// ────────────────────────────────────────────────────────────────────────────
// EL POPOVER. **Va en un archivo y no adentro del HTML** porque el CSP de la app es
// `default-src 'self'`: un `<script>` inline no lo pasa, y el sintoma seria una ventana
// en blanco sin ningun error visible salvo en la consola del webview.
// ────────────────────────────────────────────────────────────────────────────

import { bandeja } from "./panel.js";

const raiz = document.getElementById("raiz");
const { invoke } = window.__TAURI__.core;

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

async function pintar() {
  // Si `vista` falla y YA HAY algo dibujado, se deja lo último. **No se pinta un estado
  // de error inventado**: el panel dice cosas sobre las carpetas del usuario, y decir
  // «Carpeta ausente» porque fallo una llamada interna seria mentir sobre su disco.
  try {
    raiz.innerHTML = bandeja(await invoke("vista"));
    atar();
    await ajustar();
  } catch (e) {
    console.error("no se pudo pintar la vista", e);
    // **PERO SI NO HAY NADA DIBUJADO, EL FALLO TIENE QUE VERSE.** La ventana es
    // transparente: un panel que no pinta no es una ventana vacia, es NINGUNA ventana —
    // la persona hace clic en el icono, no pasa nada, y eso es indistinguible de que el
    // icono este roto. Fue exactamente el sintoma que costo diagnosticar.
    if (!raiz.firstChild) {
      raiz.innerHTML =
        '<div class="bandeja"><div class="aviso">' +
        '<span class="aviso__icono">\u26a0</span>' +
        "<span><strong>El panel no pudo dibujarse.</strong> " +
        String(e).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]) +
        "</span></div></div>";
      await ajustar();
    }
  }
}

// Las acciones las NOMBRA `panel.js` y las ATA este archivo. Las que todavia no hacen
// nada **no se atan**: un boton que no responde dice la verdad; uno que responde sin
// hacer nada, no.
const COMANDOS = { salir: "salir", abrir: "abrir_carpeta" };

function atar() {
  for (const b of raiz.querySelectorAll("[data-accion]")) {
    const comando = COMANDOS[b.dataset.accion];
    // `vincular` todavia no tiene comando y **no se ata**: un boton que no responde dice
    // la verdad; uno que responde sin hacer nada, no.
    if (!comando) continue;
    b.addEventListener("click", async () => {
      try {
        await invoke(comando);
      } catch (e) {
        console.error(`fallo ${comando}`, e);
        return;
      }
      // Se repinta EN EL ACTO y no se espera al proximo aviso del hilo: hasta 3 segundos
      // de boton que no hace nada visible es un boton que la persona vuelve a apretar.
      if (comando !== "salir") await pintar();
    });
  }
}

await pintar();
// El hilo de trabajo avisa cuando terminó un barrido. **Se repinta por aviso y no
// por reloj**: un `setInterval` corto gasta batería para no mostrar nada nuevo, y
// uno largo deja el panel viejo justo cuando la persona lo abre para mirarlo.
await window.__TAURI__.event.listen("cambio", pintar);
