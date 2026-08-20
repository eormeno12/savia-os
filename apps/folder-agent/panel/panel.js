// ────────────────────────────────────────────────────────────────────────────
// LA VISTA · toma lo que `panel::vista` serializo y lo dibuja. NADA MAS.
//
// **No deriva, no infiere y no completa.** Si un estado no viene, no se dibuja un
// estado por omision: se rompe, que es lo que se quiere. La derivacion entera vive
// en `src-tauri/src/panel.rs` y esta acreditada por `tests/panel.rs`; duplicar acá
// media regla es garantizar que las dos mitades se separen.
//
// Los textos SI viven acá: son la unica cosa de la bandeja que es idioma y no
// dominio, y el nucleo no habla ningun idioma — devuelve `sincronizado`, no
// «Sincronizado».
// ────────────────────────────────────────────────────────────────────────────

const CARPETA = {
  sincronizado: { rotulo: "Sincronizado" },
  barriendo: { rotulo: "Barriendo" },
  congelado: { rotulo: "Congelado" },
  carpetaAusente: { rotulo: "Carpeta ausente" },
};

// El motivo cambia la frase entera, no un adjetivo: uno pide reconectar y el otro
// pide una decision.
const MOTIVO = {
  noSeAlcanza: "No se alcanza. Reconectá el disco y sigue solo.",
  otraCarpeta: "Hay otra carpeta en esa ruta. Savia no toca nada hasta que lo revises.",
};

const ARCHIVO = {
  indexado: { rotulo: "indexado", icono: '<span class="tilde">✓</span>' },
  procesando: { rotulo: "procesando", icono: '<span class="pista"></span>' },
  retirado: { rotulo: "retirado", icono: "" },
  fallo: { rotulo: "no se pudo leer", icono: '<span aria-hidden="true">⚠</span>' },
};

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * El resumen de la cabecera. Cuenta lo que hay, nunca lo que se supone.
 *
 * **`indexados` NO es «cuantos archivos hay».** Es cuantos estan EN SAVIA, que es otra
 * cosa: un archivo en vuelo o uno que fallo se ven en la lista y no cuentan acá. Decir
 * «2 archivos» con tres filas debajo no es un redondeo, es una cuenta equivocada — asi
 * que cuando no coinciden se dicen los dos numeros y adonde estan los dos.
 */
function detalle(vista) {
  const carpetas = vista.carpetas.length;
  const ausentes = vista.carpetas.filter((c) => c.estado === "carpetaAusente").length;
  if (ausentes > 0) {
    return `${plural(ausentes, "carpeta", "carpetas")} sin alcanzar de ${carpetas}`;
  }
  const enSavia = vista.carpetas.reduce((n, c) => n + c.indexados, 0);
  const seguidos = vista.carpetas.reduce((n, c) => n + c.filas.length + c.ocultas, 0);
  const donde = plural(carpetas, "carpeta", "carpetas");
  return enSavia === seguidos
    ? `${plural(enSavia, "archivo", "archivos")} en ${donde}`
    : `${enSavia} de ${seguidos} archivos en Savia · ${donde}`;
}

function filaDeArchivo(f) {
  const a = ARCHIVO[f.estado];
  if (!a) throw new Error(`estado de archivo desconocido: ${f.estado}`);
  return `
    <li class="archivo" data-archivo="${esc(f.estado)}">
      <span class="archivo__nombre" title="${esc(f.ruta)}">${esc(f.ruta)}</span>
      <span class="archivo__estado">${a.icono}${esc(a.rotulo)}</span>
    </li>`;
}

function bloqueDeCarpeta(c) {
  const e = CARPETA[c.estado];
  if (!e) throw new Error(`estado de carpeta desconocido: ${c.estado}`);
  const ausente = c.estado === "carpetaAusente";
  const cuerpo = ausente
    ? `<p class="vacio">${esc(MOTIVO[c.porque] ?? "")}</p>`
    : `<ul class="archivos">${c.filas.map(filaDeArchivo).join("")}</ul>` +
      // EL «Y N MAS» NUNCA SE OMITE CUANDO HAY OCULTAS. Una lista truncada sin el
      // numero se lee como la lista entera.
      (c.ocultas > 0
        ? `<p class="mas">y ${plural(c.ocultas, "archivo más", "archivos más")}</p>`
        : "");
  return `
    <section class="carpeta" data-estado="${esc(c.estado)}">
      <header class="carpeta__cabecera">
        <span class="punto"></span>
        <span class="carpeta__ruta"><span>${esc(c.rutaAbsoluta)}</span></span>
        <span class="carpeta__estado">${esc(e.rotulo)}</span>
      </header>
      ${cuerpo}
    </section>`;
}

export function bandeja(vista) {
  const e = CARPETA[vista.estado];
  if (!e) throw new Error(`estado agregado desconocido: ${vista.estado}`);
  // El aviso de credenciales manda sobre el pie: mientras no se vuelva a vincular,
  // «Pausar» no tiene nada que pausar.
  const detenido = vista.detenido === "credenciales";

  // ── QUE DICE LA CABECERA, Y EN QUE ORDEN ─────────────────────────────────
  //
  // El agregado es el peor estado de las CARPETAS, y hay dos cosas que no son estados
  // de carpeta y pesan mas que cualquiera de los cuatro. Las dos llegan como campos
  // aparte de `Vista` justamente para que la precedencia se decida acá:
  //
  //   detenido  >  fallos  >  agregado
  //
  // `detenido` primero: con el token revocado todas las carpetas pueden estar
  // perfectas —su ultima foto sigue siendo «sincronizada», y lo es— pero nada entra.
  // `fallos` despues: una carpeta con un archivo ilegible TAMBIEN sigue sincronizada,
  // y su ultimo barrido cerro completo. Las dos veces la frase verdadera sobre las
  // carpetas es la respuesta tranquilizadora, y el agregado es lo unico visible con el
  // panel cerrado.
  //
  // **EL ROTULO CAMBIA CON EL TONO, NUNCA SOLO EL TONO.** Teñir de rojo un punto que
  // dice «Sincronizado» pone al color a contradecir a la palabra, que es el modo exacto
  // en que un estado deja de ser accesible: quien no distingue el rojo lee «todo bien».
  const cabecera = detenido
    ? { tono: "detenido", rotulo: "Sin acceso", detalle: "Nada entra a Savia desde este equipo" }
    : vista.fallos > 0
      ? {
          tono: "fallo",
          rotulo: `${plural(vista.fallos, "archivo", "archivos")} sin leer`,
          detalle: detalle(vista),
        }
      : { tono: vista.estado, rotulo: e.rotulo, detalle: detalle(vista) };

  return `
    <div class="bandeja">
      <header class="cabecera" data-estado="${esc(cabecera.tono)}">
        <span class="punto punto--grande"></span>
        <span class="cabecera__texto">
          <span class="cabecera__estado">${esc(cabecera.rotulo)}</span>
          <span class="cabecera__detalle">${esc(cabecera.detalle)}</span>
        </span>
      </header>
      ${
        detenido
          ? `<div class="aviso">
               <span class="aviso__icono">⚠</span>
               <span><strong>Savia no está entrando.</strong> El acceso de este equipo dejó de valer.</span>
             </div>`
          : ""
      }
      <div class="carpetas">${vista.carpetas.map(bloqueDeCarpeta).join("")}</div>
      <footer class="pie">
        ${
          detenido
            ? `<button class="accion">Ajustes</button>
               <button class="accion accion--afirmativa">Volver a vincular</button>`
            : `<button class="accion">Pausar</button>
               <button class="accion">Abrir carpeta</button>
               <button class="accion separador">Ajustes</button>`
        }
      </footer>
    </div>`;
}
