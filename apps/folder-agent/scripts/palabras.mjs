// ────────────────────────────────────────────────────────────────────────────
// EL GUARDIAN DE «LAS PALABRAS QUE NO VIVEN FUERA DE TEXTOS.JS».
//
// D7 del plan (docs/product/savia-b2b/plan-rediseno-agente.md §1.7): todo el texto
// que una persona lee, o que un lector de pantalla anuncia, sale de `textos.js` —
// nada de prosa en español hardcodeada en `panel.js`, `bandeja.js` u `onboarding.js`.
//
// Lo que lo motivo: cuatro `aria-label` en español ("Más opciones", "Volver",
// "Atrás" x2) vivian como string literal adentro del HTML de `panel.js` y de
// `onboarding.js`. `tsc` no los ve — son strings validos. Las pruebas de Rust no
// los ven — son puro DOM. Y una revision visual del mockup TAMPOCO los ve: son
// texto que SOLO un lector de pantalla anuncia, invisible en cualquier captura
// de pantalla. Exactamente el mismo punto ciego que motiva `contraste.mjs` sobre
// el contraste no textual — una garantia de accesibilidad que ninguna revision
// visual puede confirmar por si sola.
//
// ── QUE ES ESTO Y QUE NO ES ─────────────────────────────────────────────────
// Esto NO es un parser de JavaScript. Es una heuristica de texto sobre el
// codigo fuente: encuentra fragmentos entre comillas y les pregunta si
// «parecen prosa en español» (arrancan con mayuscula, tienen una minuscula en
// español en algun lado, tienen un largo razonable). Como toda heuristica de
// texto sobre codigo, tiene puntos ciegos conocidos — mejor decirlos ahora que
// descubrirlos en produccion:
//
//   1. Solo mira texto ENTRE COMILLAS ('...', "..." — incluye los atributos
//      HTML entre comillas dobles que viven adentro de un template literal,
//      que es donde estaban las 4 violaciones reales). Prosa escrita LITERAL
//      entre backticks, sin comillas alrededor (texto HTML crudo tipo
//      `<div>Cancelar</div>`), no se detecta. Ese hueco es real; se acepta
//      porque cerrarlo entero exige un parser de verdad, y las violaciones que
//      SI existieron en este codebase (los 5 aria-label/sentinel) fueron todas
//      atributos entre comillas — el patron que este guardian si cubre.
//   2. Distinguir `/` de division de `/` de inicio de regex es, en JS de
//      verdad, un problema de gramatica completa. Acá se resuelve con la
//      misma heuristica que usan la mayoria de los tokenizers ad-hoc: si el
//      caracter no-espacio anterior es un identificador, numero, `)` o `]`,
//      es division; si no, es un regex literal y se salta entero (respetando
//      `[...]` y escapes) para que las comillas que pueda llevar adentro
//      —como en `/[&<>"]/g`, que aparece en el `esc()` de los tres archivos—
//      no se confundan con el inicio de un string. Un regex con una forma que
//      esta heuristica no anticipa puede, en teoria, hacer que se lea mal el
//      resto del archivo; no ocurre hoy en los tres archivos que se escanean.
//   3. La regla de mayuscula-inicial mira SOLO el primer caracter. Una frase
//      en minuscula ("como esta") no se detecta — no aparece en este codebase
//      hoy (los mensajes de `console.error`, que son para quien depura y no
//      para quien usa la app, siguen todos la convencion de arrancar en
//      minuscula: "no se pudo pintar la vista"), pero si algun dia una prosa
//      real empieza en minuscula, este guardian no la va a ver.
//
// ── EL UMBRAL DE LARGO ───────────────────────────────────────────────────────
// `UMBRAL_LARGO = 3`. A diferencia del piso de contraste de `contraste.mjs`
// (que cita la 1.4.11), este numero no sale de ningun estandar — es un dial de
// la heuristica, no una medida de nada del dominio, y se declara como tal en
// vez de disfrazarlo. Sirve para descartar candidatos de un caracter que las
// comillas dejan pasar solas (un separador, un glifo suelto) sin descartar
// ninguna palabra real de dos letras que hoy aparezca en los tres archivos —
// no hay ninguna. Errar bajo (permisivo) es la eleccion deliberada: un
// guardian que se equivoca hacia el rojo (un candidato de mas, que un humano
// descarta en un segundo) cuesta menos que uno que se equivoca hacia el verde
// (una violacion real que pasa desapercibida) — mismo principio que ya declara
// `contraste.mjs` sobre su propio error de resolucion de `var()`.
//
// ── LA LISTA DE RUIDO ─────────────────────────────────────────────────────
// Candidatos que matchean la forma de "prosa" pero NO lo son, y no hay forma
// generica de descartarlos sin un allowlist explicito: hoy es solo "Enter",
// el nombre de tecla que compara `bandeja.js` en su `keydown` (arranca en
// mayuscula, tiene minusculas, largo > 3 — pasa la heuristica igual que
// cualquier palabra real). Agregar una entrada nueva acá exige poder explicar
// por que NO es texto que una persona lee — no es un lugar para silenciar
// candidatos incomodos.
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

const UMBRAL_LARGO = 3;
const RUIDO = new Set(["Enter"]);

const RE_MAYUS_INICIAL = /^[A-ZÁÉÍÓÚÑÜ]/;
const RE_MINUS_ESPANOL = /[a-záéíóúñü]/;

function pareceProsaEnEspanol(texto) {
  const t = texto.trim();
  if (t.length < UMBRAL_LARGO) return false;
  if (!RE_MAYUS_INICIAL.test(t)) return false;
  if (!RE_MINUS_ESPANOL.test(t)) return false;
  if (RUIDO.has(t)) return false;
  return true;
}

/**
 * Recorre el archivo caracter a caracter y junta los candidatos: el contenido
 * de todo string '...'/"..." de verdad, mas cada substring entre comillas
 * dobles que aparezca adentro del texto literal de un template — que es donde
 * viven los atributos HTML (`aria-label="..."`) de este codebase. Comentarios
 * (`//` y `/* *​/`) y expresiones `${...}` se recorren para no perderse el
 * codigo que sigue, pero lo que hay ADENTRO de un comentario nunca se junta
 * como candidato.
 */
function candidatosDe(src) {
  const candidatos = [];
  let i = 0;
  const n = src.length;
  let linea = 1;
  let ultimoSig = null;

  const esDivisionAntes = () => ultimoSig !== null && /[\w$)\]]/.test(ultimoSig);

  function saltarRegex() {
    i++; // el "/" inicial
    let enClase = false;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "[") { enClase = true; i++; continue; }
      if (c === "]") { enClase = false; i++; continue; }
      if (c === "/" && !enClase) { i++; break; }
      if (c === "\n") break; // regex sin cerrar en la linea: se abandona la heuristica acá
      i++;
    }
    while (i < n && /[a-z]/i.test(src[i])) i++; // flags (g, i, ...)
    ultimoSig = "/";
  }

  function leerString(quote) {
    const lineaInicio = linea;
    i++;
    const inicio = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "\n") linea++;
      if (c === quote) break;
      i++;
    }
    candidatos.push({ texto: src.slice(inicio, i), linea: lineaInicio });
    i++;
    ultimoSig = quote;
  }

  function comillasDentroDeTexto(texto, lineaBase) {
    const re = /"([^"\n]*)"/g;
    let m;
    while ((m = re.exec(texto))) {
      const off = (texto.slice(0, m.index).match(/\n/g) || []).length;
      candidatos.push({ texto: m[1], linea: lineaBase + off });
    }
  }

  const saltarComentarioLinea = () => { while (i < n && src[i] !== "\n") i++; };
  function saltarComentarioBloque() {
    i += 2;
    while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
      if (src[i] === "\n") linea++;
      i++;
    }
    i += 2;
  }

  function escanearExpresion() {
    // Adentro de un `${...}` de un template: es codigo de verdad — puede
    // traer sus propios strings, comentarios, templates anidados y llaves.
    let profundidad = 1;
    while (i < n && profundidad > 0) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { saltarComentarioLinea(); continue; }
      if (c === "/" && src[i + 1] === "*") { saltarComentarioBloque(); continue; }
      if (c === "/" && !esDivisionAntes()) { saltarRegex(); continue; }
      if (c === '"' || c === "'") { leerString(c); continue; }
      if (c === "`") { leerTemplate(); continue; }
      if (c === "{") { profundidad++; i++; ultimoSig = c; continue; }
      if (c === "}") { profundidad--; i++; ultimoSig = c; continue; }
      if (c === "\n") { linea++; i++; continue; }
      if (c !== " " && c !== "\t") ultimoSig = c;
      i++;
    }
  }

  function leerTemplate() {
    i++; // el backtick inicial
    let texto = "";
    let lineaTexto = linea;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { texto += c + (src[i + 1] ?? ""); i += 2; continue; }
      if (c === "`") { i++; break; }
      if (c === "$" && src[i + 1] === "{") {
        if (texto) comillasDentroDeTexto(texto, lineaTexto);
        texto = "";
        i += 2;
        ultimoSig = "{";
        escanearExpresion();
        lineaTexto = linea;
        continue;
      }
      if (c === "\n") linea++;
      texto += c;
      i++;
    }
    if (texto) comillasDentroDeTexto(texto, lineaTexto);
    ultimoSig = "`";
  }

  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { saltarComentarioLinea(); continue; }
    if (c === "/" && src[i + 1] === "*") { saltarComentarioBloque(); continue; }
    if (c === "/" && !esDivisionAntes()) { saltarRegex(); continue; }
    if (c === '"' || c === "'") { leerString(c); continue; }
    if (c === "`") { leerTemplate(); continue; }
    if (c === "\n") { linea++; i++; continue; }
    if (c !== " " && c !== "\t") ultimoSig = c;
    i++;
  }

  return candidatos;
}

let fallo = false;
for (const ruta of ARCHIVOS) {
  const src = readFileSync(ruta, "utf8");
  const nombre = ruta.split("/").slice(-2).join("/");
  for (const { texto, linea } of candidatosDe(src)) {
    if (!pareceProsaEnEspanol(texto)) continue;
    fallo = true;
    console.error(`  ✗ ${nombre}:${linea}  ${JSON.stringify(texto)}`);
  }
}

if (fallo) {
  console.error(
    `\nPALABRAS-ERR: hay prosa en español hardcodeada fuera de textos.js. Si es texto que\n` +
      `              alguien lee o que un lector de pantalla anuncia, la clave se agrega a\n` +
      `              textos.js y el archivo la referencia. Si es un falso positivo genuino\n` +
      `              (no es texto de interfaz), se justifica en la lista RUIDO de este\n` +
      `              script — no se lo hace desaparecer subiendo el umbral.`,
  );
  process.exit(1);
}
console.log(`palabras ok   — sin prosa en español fuera de textos.js en los ${ARCHIVOS.length} archivos escaneados`);
