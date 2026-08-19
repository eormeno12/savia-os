#!/usr/bin/env node
/**
 * LAS FRONTERAS DE `intake`. Cero dependencias.
 *
 * ESTE PAQUETE TIENE UNA FRONTERA QUE NINGÚN OTRO TIENE, y es la razón por la que
 * existe como paquete en vez de como dos funciones adentro de `adapters`:
 *
 *   A · **`admission.ts` NO ALCANZA `@savia-os/adapters`.** Es la garantía central del
 *       tramo 1 y está impuesta por el GRAFO, no por prosa. `admit` decide con
 *       `{ scan, encrypted }` —dos hechos YA ESTABLECIDOS— y la razón de que no los
 *       calcule es exactamente la de `fingerprintOf` recibiendo `Body`: lo que la firma
 *       no admite no se puede colar. Si este archivo pudiera importar `adapters`,
 *       tendría a mano el lector de zip, y la primera versión apurada de «detectar
 *       cifrado» se escribiría acá adentro —con su `try/catch`, que es por donde
 *       fail-open entra sin que nadie lo haya decidido—. Con la frontera, esa versión
 *       ni siquiera compila.
 *
 *   B · **cero dependencias de runtime**, ni un `node:` ni un global de node. Igual que
 *       `ir`, `emission` y `orchestration`, y por el mismo motivo: la mitad de
 *       aceptación del tramo 1 vive en `adapters` justamente para que la de rechazo no
 *       necesite saber de formatos.
 *
 * LAS DOS REDES, que son la lección que los otros tres guardianes ya pagaron: un script
 * que solo busca imports prohibidos no encuentra ninguno cuando su reconocedor de
 * imports se rompe, y da VERDE por no haber mirado. Por eso se verifica también que los
 * archivos protegidos EXISTAN y que cada uno declare al menos un import.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

const IR = "@savia-os/ir";

/**
 * EL ÚNICO PAQUETE QUE `intake` ALCANZA, Y NO ERA EL PLAN.
 *
 * Este paquete se scaffoldeó declarando `adapters` además de `ir`, porque «la mitad de
 * aceptación vive allá». **Este guardián lo desmintió en su primera corrida**: nada lo
 * importaba. Y no es que faltara escribirlo — es que no hace falta, y ese es el
 * hallazgo. `claimedBy` recibe un `OpaqueAdapter`, que es un tipo de `ir`; quien elige
 * cuál adaptador pasarle es el host. `intake` habla del CONTRATO de adaptador, nunca de
 * un adaptador.
 *
 * Lo que compra es la frontera A, y ahora es del paquete entero en vez de un archivo:
 * **`admit` no puede calcular `encrypted` ni aunque alguien quiera**. Detectar «cifrado
 * sin contraseña» es saber de formatos —el bit 0 del *general purpose bit flag* de un
 * zip, el `/Encrypt` del tráiler de un PDF— y ese conocimiento está del otro lado de
 * esta línea. Sin ella, la primera versión apurada se escribe acá adentro con su
 * `try/catch`, que es por donde fail-open entra sin que nadie lo haya decidido.
 */
const PERMITIDOS = [IR];

/**
 * Las relaciones prohibidas, nombradas. No son la garantía —lo es la lista blanca de
 * arriba— pero un `emission` que se cuele tiene que fallar diciendo QUÉ se rompió.
 */
const FRONTERAS = [
  {
    prohibido: "@savia-os/emission",
    porqué:
      "sería un SEGUNDO compositor de los dos lados que R1 mantiene separados. Lo que " +
      "vuelve no vacía a R1 es que `orchestration` sea el único que los junta; un " +
      "paquete más que alcance los dos convierte la regla en una convención",
  },
];

/** Globales de node. No son imports, así que ningún regex de imports los ve. */
const GLOBALES = ["Buffer", "process.", "__dirname", "__filename", "require("];

const PROTEGIDOS = ["admission.ts", "claims.ts"];

let errores = 0;
const fallar = (qué, detalle, porqué) => {
  console.error(`INTAKE-ERR: ${qué}\n        ${detalle}\n        importa porque: ${porqué}`);
  errores += 1;
};

const importsDe = (texto) =>
  [...texto.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const archivos = readdirSync(SRC)
  .filter((f) => f.endsWith(".ts"))
  .sort();

// ── RED A · los extremos existen ─────────────────────────────────────────────
const faltantes = PROTEGIDOS.filter((f) => !archivos.includes(f));
if (faltantes.length > 0) {
  fallar(
    `fronteras · faltan archivos protegidos: ${faltantes.join(", ")}`,
    `src/ tiene: ${archivos.join(", ")}`,
    "un guardián que busca imports prohibidos en un archivo que no existe encuentra CERO y pasa en verde: la frontera queda sin dueño y nadie se entera",
  );
}

const usados = new Set();
for (const archivo of archivos) {
  const texto = readFileSync(join(SRC, archivo), "utf8");
  const especificadores = importsDe(texto);

  // ── RED B · el regex sigue reconociendo imports ────────────────────────────
  if (especificadores.length === 0) {
    fallar(
      `fronteras · \`src/${archivo}\` no declara un solo import`,
      "o el archivo quedó aislado, o el reconocedor de imports de este script dejó de reconocer su forma",
      "la segunda posibilidad es peor: con el reconocedor roto, este guardián no encuentra ningún import prohibido y da VERDE por no ver nada",
    );
  }

  for (const e of especificadores) {
    if (e.startsWith(".")) continue;
    if (PERMITIDOS.includes(e)) {
      usados.add(e);
      continue;
    }
    fallar(
      `frontera cruzada · src/${archivo} importa \`${e}\``,
      `los únicos paquetes que \`intake\` puede alcanzar son: ${PERMITIDOS.join(", ")}`,
      "este paquete tiene CERO dependencias de runtime. Un `node:` acá lo ataría al entorno, y `@savia-os/emission` lo convertiría en un segundo compositor de los dos lados que R1 mantiene separados — el único que compone es `orchestration`",
    );
  }

  const código = sinComentarios(texto);

  for (const g of GLOBALES) {
    if (!código.includes(g)) continue;
    fallar(
      `fronteras · src/${archivo} usa el global de node \`${g}\``,
      "un global no es un import, así que el reconocedor de arriba no lo ve",
      "es la mitad del borde de dependencias que un barrido de imports NUNCA puede cubrir: sin este chequeo, `Buffer.from(...)` deja el paquete atado a node y la lista blanca de imports sigue diciendo la verdad",
    );
  }

  // ── Las fronteras nombradas ────────────────────────────────────────────────
  // La lista blanca ya las cubre; esto existe para que el mensaje diga QUÉ se rompió y
  // no solo «paquete no permitido».
  for (const f of FRONTERAS) {
    if (!especificadores.includes(f.prohibido)) continue;
    fallar(`frontera cruzada · src/${archivo} alcanza \`${f.prohibido}\``, "no puede importarlo", f.porqué);
  }
}

// ── Los dos permitidos SE USAN, y el declarado coincide con el usado ─────────
{
  const sinUsar = PERMITIDOS.filter((p) => !usados.has(p));
  if (sinUsar.length > 0) {
    fallar(
      `fronteras · la lista blanca permite lo que nadie importa: ${sinUsar.join(", ")}`,
      `usados: ${[...usados].sort().join(", ") || "(ninguno)"}`,
      "una lista blanca con una entrada muerta es una puerta abierta que nadie mira: el día que alguien importe ese paquete, el guardián lo deja pasar sin decir nada. La lista se declara para lo que hay, no para lo que podría haber",
    );
  }

  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const declaradas = Object.keys(pkg.dependencies ?? {}).sort();
  if (declaradas.join(",") !== [...PERMITIDOS].sort().join(",")) {
    fallar(
      "fronteras · `dependencies` no coincide con la lista blanca",
      `declara: ${declaradas.join(", ") || "(ninguna)"} · permite: ${[...PERMITIDOS].sort().join(", ")}`,
      "sin este chequeo, la lista blanca de imports se satisface agregando la dependencia y el import EL MISMO DÍA: el grafo de paquetes es lo que de verdad impone las fronteras, y este es el lugar donde se lo mira",
    );
  }
}

// ── La cadena de guardianes ──────────────────────────────────────────────────
// Las dos mitades que `ir` y `adapters` ya pagaron. (a) `lint` los nombra a TODOS: un
// guardián que no corre NO AVISA QUE NO CORRIÓ. (b) `build` no puede encadenar el
// corredor de mutación, que edita los archivos del árbol EN EL LUGAR mientras `turbo`
// corre `lint` y `build` del mismo paquete en paralelo.
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const lint = pkg.scripts?.lint ?? "";
  const build = pkg.scripts?.build ?? "";
  const enDisco = readdirSync(join(RAIZ, "scripts")).filter((f) => f.endsWith(".mjs")).sort();

  const faltan = enDisco.filter((g) => !lint.includes(`scripts/${g}`));
  if (faltan.length > 0) {
    fallar(
      `guardian left out of \`lint\` — ${faltan.join(", ")}`,
      `la cadena dice: ${lint}`,
      "un guardián que no corre no avisa que no corrió: el paquete queda verde y la garantía que ese script acredita deja de existir sin que nada cambie de color",
    );
  }

  if (build.includes("scripts/mutants.mjs")) {
    fallar(
      "`build` chains the mutation runner — scripts/mutants.mjs",
      `la cadena dice: ${build}`,
      "muta los archivos del árbol en el lugar, y turbo corre `lint` y `build` en paralelo: se pisan y dejan mutaciones pegadas. Va solo en `lint`",
    );
  }
}

if (!existsSync(join(RAIZ, "src", "index.ts"))) {
  fallar(
    "fronteras · no hay barril",
    "falta src/index.ts",
    "las apps consumen los paquetes SOLO por el barril; sin él, cada consumidor elige su ruta profunda y el contrato deja de tener una sola cara",
  );
}

if (errores > 0) {
  console.error(`INTAKE-ERR: ${errores} violación(es) de frontera.`);
  process.exit(1);
}
console.log(
  `fronteras ok (${archivos.length} archivos de src, ${FRONTERAS.length} frontera nombrada, ` +
    `${PERMITIDOS.length} paquetes permitidos: ${PERMITIDOS.join(", ")})`,
);
