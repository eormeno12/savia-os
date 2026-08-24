// ────────────────────────────────────────────────────────────────────────────
// EL GUARDIAN DE LA PRECEDENCIA — que el JS no la recalcule.
//
// panel.rs decide, en `fn peso` (EstadoDeCarpeta, usada por `max_by_key`) y en
// `fn prioridad` (EstadoDeArchivo, usada por `sort_by_key`), CUAL estado gana
// cuando una carpeta o un archivo admite mas de una lectura — «carpeta ausente»
// le gana a «congelado», que le gana a «barriendo»; «fallo» le gana a
// «procesando», que le gana a «retirado», que le gana a «indexado». Esa decision
// esta probada por los 12 tests de crates/aplicacion/tests/panel.rs. Una vez que
// Rust la resolvio, `carpeta.estado` / `fila.estado` le llegan al JS YA
// DECIDIDOS — un string, no una entrada para volver a decidir.
//
// LO QUE ESTA PERMITIDO: leer `estado` y usarlo como CLAVE de una tabla de
// presentacion — un lookup a texto, a icono, a clase CSS (`TONO_DE_ESTADO` y
// `CLAVE_DE_FILA` en panel.js son el ejemplo correcto: el valor es una
// etiqueta, nunca un numero que se compare). Tambien esta permitido comparar
// el `estado` de UNA sola variable contra distintos literales — un switch, una
// cadena de `if` que siempre consulta lo mismo — porque eso es «¿como pinto
// esto?», no «¿quien gana?».
//
// LO QUE ESTA PROHIBIDO: cualquier cosa que ponga un NUMERO detras de un valor
// de estado para compararlo u ordenarlo, o que compare el `estado` de DOS
// carpetas/archivos DISTINTOS entre si. Eso es recalcular lo que panel.rs ya
// resolvio, y la copia en JS puede desincronizarse de la version en Rust sin
// que ningun test lo note — panel.rs no sabe que el JS existe.
//
// Tres huellas, elegidas porque son la traduccion directa a JS de como
// `peso`/`prioridad` estan escritas del lado Rust:
//   1. un objeto literal con 2+ propiedades cuyo VALOR es un entero desnudo —
//      la forma exacta de una tabla de prioridad ({no_esta: 0, en_pausa: 1,
//      actualizando: 2}), calcada de los `match … => 0/1/2/3` de panel.rs.
//   2. un `.sort(` o `.reduce(` cuyo callback menciona `estado` — ordenar o
//      acumular por estado es la operacion que solo panel.rs tiene permiso de
//      hacer (`sort_by_key`, `max_by_key`).
//   3. dos variables DISTINTAS con `.estado` en la misma linea — la firma de
//      un `if (a.estado === X && b.estado === Y)` que compara dos estados
//      entre si en vez de mirar uno solo para decidir como pintarlo.
//
// Sale 0 si ninguna huella aparece en los tres archivos que SI leen `estado`
// (panel.js, bandeja.js, onboarding.js). No mide estilo en general — un objeto
// con valores numericos en otro archivo, por otro motivo (un z-index, un
// orden de columnas), no lo toca: esto vive adentro del perimetro exacto
// donde `estado` puede aparecer.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aca = dirname(fileURLToPath(import.meta.url));

const ARCHIVOS = [
  join(aca, "../panel/panel.js"),
  join(aca, "../panel/bandeja.js"),
  join(aca, "../panel/onboarding/onboarding.js"),
];

function lineaDe(texto, indice) {
  let n = 1;
  for (let i = 0; i < indice; i++) if (texto[i] === "\n") n++;
  return n;
}

/** Extrae la llamada completa (parentesis balanceados) que arranca en `(`. */
function extraerLlamada(texto, indiceApertura) {
  let profundidad = 0;
  for (let i = indiceApertura; i < texto.length; i++) {
    if (texto[i] === "(") profundidad++;
    else if (texto[i] === ")") {
      profundidad--;
      if (profundidad === 0) return texto.slice(indiceApertura, i + 1);
    }
  }
  return texto.slice(indiceApertura);
}

/**
 * Huella 1: un objeto literal plano ({} sin anidar) con 2+ propiedades cuyo
 * valor es SIEMPRE un entero desnudo. `TONO_DE_ESTADO`/`CLAVE_DE_FILA` no
 * matchean — sus valores son strings, no numeros.
 */
function tablaDePrioridad(texto) {
  const violaciones = [];
  for (const m of texto.matchAll(/\{[^{}]*\}/g)) {
    const props = m[0]
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (props.length < 2) continue;
    const todasNumericas = props.every((p) => /^[\w"'$]+\s*:\s*-?\d+$/.test(p));
    if (todasNumericas) {
      violaciones.push({
        linea: lineaDe(texto, m.index),
        detalle: `un objeto con ${props.length} valores enteros — forma de tabla de prioridad: ${m[0].replace(/\s+/g, " ")}`,
      });
    }
  }
  return violaciones;
}

/** Huella 2: `.sort(` o `.reduce(` cuyo callback menciona `estado`. */
function ordenOAcumulacionPorEstado(texto) {
  const violaciones = [];
  for (const m of texto.matchAll(/\.(sort|reduce)\s*\(/g)) {
    const apertura = m.index + m[0].length - 1;
    const llamada = extraerLlamada(texto, apertura);
    if (/estado/.test(llamada)) {
      violaciones.push({
        linea: lineaDe(texto, m.index),
        detalle: `.${m[1]}( con "estado" en el callback: ${llamada.replace(/\s+/g, " ").slice(0, 100)}`,
      });
    }
  }
  return violaciones;
}

/**
 * Huella 3: dos variables DISTINTAS con `.estado` en la misma linea — la
 * firma de comparar el estado de dos carpetas/archivos entre si. Una sola
 * variable repetida (`q2.estado === "a" || q2.estado === "b"`) no cuenta:
 * eso es leer UN estado, no comparar DOS. El lookbehind niega el caso
 * `TEXTOS.panel.estado[carpeta.estado]`: ahi `estado` es el NOMBRE de una
 * clave de traduccion (`panel.estado` no es una variable con un campo
 * `.estado`, es parte de la ruta `TEXTOS.panel.estado`), y solo cuenta si es
 * el primer eslabon de la cadena — no uno en el medio de otra ruta.
 */
function comparacionCruzada(texto) {
  const violaciones = [];
  texto.split("\n").forEach((linea, i) => {
    const idents = new Set(
      [...linea.matchAll(/(?<!\.)\b([A-Za-z_$][\w$]*)\.estado\b/g)].map((m) => m[1]),
    );
    if (idents.size >= 2) {
      violaciones.push({
        linea: i + 1,
        detalle: `dos variables (${[...idents].join(", ")}) con .estado en la misma linea: ${linea.trim()}`,
      });
    }
  });
  return violaciones;
}

const DETECTORES = [
  ["tabla de prioridad", tablaDePrioridad],
  ["orden/acumulacion por estado", ordenOAcumulacionPorEstado],
  ["comparacion cruzada de estado", comparacionCruzada],
];

let fallo = false;
for (const ruta of ARCHIVOS) {
  const texto = readFileSync(ruta, "utf8");
  for (const [nombre, detector] of DETECTORES) {
    for (const v of detector(texto)) {
      fallo = true;
      console.error(`  ✗ ${ruta}:${v.linea}  [${nombre}]\n      ${v.detalle}`);
    }
  }
}

if (fallo) {
  console.error(
    "\nPRECEDENCIA-ERR: panel.js/bandeja.js/onboarding.js parecen estar RECALCULANDO\n" +
      "                  cual estado gana, en vez de leer el que panel.rs ya decidio. Esa\n" +
      "                  decision vive en `fn peso`/`fn prioridad`\n" +
      "                  (crates/aplicacion/src/panel.rs) y esta probada ahi — el JS solo\n" +
      "                  puede usar `estado` como clave de una tabla de presentacion\n" +
      "                  (texto, icono, clase), nunca como entrada de una comparacion.\n" +
      "                  Si esto es realmente presentacion y la heuristica se equivoco,\n" +
      "                  ajustala en scripts/precedencia.mjs en vez de esquivarla.",
  );
  process.exit(1);
}
console.log(
  `precedencia ok — ${ARCHIVOS.length} archivos, sin tablas de prioridad, sin ordenar/acumular por estado, sin comparar el estado de dos variables entre si`,
);
