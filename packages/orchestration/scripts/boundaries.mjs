#!/usr/bin/env node
/**
 * Las fronteras de la orquestación, hechas grafo. Cero dependencias.
 *
 * ESTE PAQUETE NO TIENE PROHIBIDO VER A NADIE, y por eso su guardián no se parece a los
 * otros tres. Es el único que alcanza `adapters` y `emission` a la vez, y esa posición
 * es exactamente lo que vuelve NO VACÍA la frase «`adapters` y `emission` nunca se ven
 * entre sí» (§{Paquetes}): si nadie los compusiera, la frontera sería cierta porque
 * nadie los usa. Lo que este guardián verifica, entonces, son las tres reglas que sí lo
 * atan:
 *
 *   1. **R2 · aguas abajo se LEE `role`, nunca se RAMIFICA sobre él.** Es la única de
 *      las dos reglas del plan que ningún paquete imponía. El plan la lista como «lint
 *      sobre el núcleo, detectable estáticamente» y no existía en ningún lado: un
 *      `switch (n.role)` en este archivo compila hoy. El vocabulario NO se escribe acá,
 *      se DERIVA de `ROLES` en `ir`: escribirlo a mano sería una segunda lista que puede
 *      quedar corta justo con el rol que alguien acaba de agregar.
 *   2. **Cero dependencias de runtime.** `sha256` entra por parámetro y `targetSizeChars`
 *      también, exactamente para que este paquete no importe nada. El borde de
 *      dependencias coincide con el de formato, y `adapters` es el único del lado de
 *      adentro. Un `node:` acá lo desharía sin que nada más se queje — y un GLOBAL de
 *      node no es siquiera un import, así que se lo busca por separado.
 *   3. **`dependencies` es exactamente los tres**, y los tres SE USAN. La segunda mitad
 *      no es celo: si mañana alguien borrara el import de `@savia-os/adapters`, este
 *      paquete dejaría de componer los dos y la prueba de la frontera se evaporaría sin
 *      que ningún test se ponga rojo.
 *
 * POR QUÉ CORRE ANTES QUE `tsc`, igual que en los otros dos: el mismo criterio. Los
 * extremos de una frontera pueden no existir todavía, y el resolvedor de módulos muere
 * primero con «Cannot find module», que no nombra ninguna regla y manda a agregar la
 * dependencia.
 *
 * Y ES EL DUEÑO ÚNICO del chequeo de la cadena de guardianes, por la misma razón que en
 * `adapters`: corre primero, así que un chequeo duplicado en otro guardián nunca
 * llegaría a imprimir.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const MUTANTES = "scripts/mutants.mjs";

/** Los tres que este puede alcanzar, y que además TIENE que alcanzar. */
const PERMITIDOS = ["@savia-os/adapters", "@savia-os/emission", "@savia-os/ir"];

/** Los dos que la composición prueba. Si alguno deja de importarse, la prueba se cae. */
const OBLIGATORIOS = ["@savia-os/adapters", "@savia-os/emission"];

/** Globales de node. No son imports, así que ningún regex de imports los ve. */
const GLOBALES = ["Buffer", "process.", "__dirname", "__filename", "require("];

let errores = 0;
const fallar = (qué, detalle, porqué) => {
  console.error(`ORCHESTRATION-ERR: ${qué}\n        ${detalle}\n        importa porque: ${porqué}`);
  errores += 1;
};

// ── La cadena de guardianes · dueño ÚNICO ────────────────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const lint = pkg.scripts?.lint ?? "";
  const build = pkg.scripts?.build ?? "";
  const enDisco = readdirSync(join(RAIZ, "scripts"))
    .filter((f) => f.endsWith(".mjs"))
    .sort();

  const faltan = enDisco.filter((g) => !lint.includes(`scripts/${g}`));
  if (faltan.length > 0) {
    fallar(
      "guardian left out of `lint`",
      `no lo nombra: ${faltan.join(", ")}\n        la cadena dice: ${lint}`,
      "un guardián que no corre no avisa que no corrió: el paquete queda verde y la garantía que ese script acredita deja de existir sin que nada cambie de color",
    );
  }
  if (build.includes(MUTANTES)) {
    fallar(
      "`build` chains the mutation runner",
      `la cadena dice: ${build}`,
      "muta los archivos del árbol EN EL LUGAR, y turbo agenda `lint` y `build` en paralelo: se pisan y el segundo captura como «original» un archivo que el primero ya mutó. Un build no muta su fuente",
    );
  }
}

// ── El DIARIO DE DESHACER del corredor de mutación · dueño ÚNICO ─────────────
// El corredor muta el árbol EN EL LUGAR, así que lo único que lo hace seguro es que el
// original de cada archivo esté EN DISCO antes de que el archivo cambie. Un `SIGKILL` —el
// que `turbo` manda a las tareas concurrentes cuando otra falla— NO EJECUTA NINGÚN
// HANDLER: un mapa en memoria muere con el proceso y la mutación queda pegada sin nadie
// que sepa revertirla. Pasó dos veces en dos días: `adapters/src/markdown.ts` con
// `role: "heading"` puesto, y ocho archivos de `packages/ir/src`.
//
// Se mira ACÁ porque el corredor NO PUEDE correrse a sí mismo adentro de su propia cadena
// —se quita de `CADENA` por eso—, así que el único testigo posible de su forma es un
// guardián que lo lea de disco. Tres formas de perder la propiedad EDITANDO EL CORREDOR, y
// una fila de mutación por cada una (D1, D2, D3):
//
//   (a) que la anotación NO ESTÉ;
//   (b) que esté DESPUÉS de la mutación — deja una ventana en la que el archivo ya cambió
//       y el diario todavía no lo sabe, que es el estado exacto que el diario existe para
//       no tener;
//   (c) que la sonda de vida dé por MUERTO un pid del que solo duda. `process.kill(pid, 0)`
//       tira `EPERM` cuando el proceso existe y es de otro usuario, y los PID se reusan:
//       solo `ESRCH` prueba que no está. Un falso «muerto» hace que una corrida repare
//       encima de otra VIVA, que es el defecto que el candado existe para impedir.
//
// NO se congela el texto del corredor: se miran esas tres formas y nada más. El control
// DC1 del propio corredor es el que lo deja verificado.
{
  const arnés = readFileSync(join(RAIZ, MUTANTES), "utf8");
  const anotar = arnés.indexOf(`apuntar(archivo, antes);`);
  const mutar = arnés.indexOf(`writeFileSync(ruta(archivo), antes.replace(buscar, reemplazar), "utf8");`);
  const desde = arnés.indexOf("const vivo = (pid)");
  const hasta = arnés.indexOf("const DIARIO =");
  const sonda = desde === -1 || hasta <= desde ? "" : arnés.slice(desde, hasta);

  if (anotar === -1) {
    fallar(
      "el corredor de mutación no escribe el original al candado",
      `${MUTANTES} no anota el texto de antes en el diario antes de mutar`,
      "el candado vuelve a ser un DETECTOR: avisa en la corrida siguiente y deja la reparación para un humano con `git diff`. Un `SIGKILL` no ejecuta handlers, así que el mapa en memoria no es un respaldo de nada",
    );
  } else if (mutar === -1 || anotar > mutar) {
    fallar(
      "el corredor de mutación muta ANTES de anotar el original",
      `${MUTANTES} escribe el archivo mutado y recién después toca el diario`,
      "entre las dos escrituras hay un intervalo en el que el archivo YA CAMBIÓ y el candado no lo sabe: morir ahí adentro es indistinguible de no tener diario. El orden es la garantía, no la presencia",
    );
  }

  if (!sonda.includes(`e.code !== "ESRCH"`) || sonda.includes("return false;")) {
    fallar(
      "el corredor de mutación da por muerto un pid del que solo duda",
      "la sonda de vida del candado no trata `ESRCH` como el ÚNICO errno que prueba la muerte",
      "`process.kill(pid, 0)` tira `EPERM` cuando el proceso existe y es de otro usuario, y los PID se reusan. Un falso «está muerto» hace que dos corridas se pisen —que es el defecto que el candado existe para impedir—; un falso «está vivo» solo cuesta una corrida que no arranca, y eso se arregla a mano",
    );
  }
}

// ── RED A · los extremos existen ─────────────────────────────────────────────
{
  const protegidos = ["src/ingest.ts", "corpus/manual.golden.json"];
  const faltantes = protegidos.filter((f) => !existsSync(join(RAIZ, f)));
  if (faltantes.length > 0) {
    fallar(
      "fronteras · un extremo no está en disco",
      `faltan: ${faltantes.join(", ")}`,
      "un guardián que barre un archivo que no existe encuentra CERO violaciones y pasa en verde. El golden entra en la lista porque es lo único que compara la salida contra algo externo al código",
    );
  }
}

/**
 * EL VOCABULARIO DE R2, DERIVADO Y NO ESCRITO. Se lee `ROLES` de `ir` a través de la
 * dependencia que este paquete ya declara. Una lista a mano acá sería una SEGUNDA
 * fuente de verdad, y quedaría corta exactamente con el rol que alguien acaba de
 * agregar — que es el caso en el que R2 más importa.
 */
const rolesDeIr = () => {
  const archivo = join(RAIZ, "node_modules", "@savia-os", "ir", "src", "classification.ts");
  if (!existsSync(archivo)) return null;
  const texto = readFileSync(archivo, "utf8");
  const m = /export const ROLES = \[([\s\S]*?)\] as const;/.exec(texto);
  if (m === null) return null;
  const roles = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  return roles.length === 0 ? null : roles;
};

const ROLES = rolesDeIr();
if (ROLES === null) {
  fallar(
    "R2 · no se pudo derivar el vocabulario de `ROLES` desde `ir`",
    "no está `node_modules/@savia-os/ir/src/classification.ts`, o cambió la forma de la declaración",
    "sin el vocabulario, el barrido de R2 no encuentra nada y este guardián da VERDE por no haber mirado — que es el modo de falla que las dos redes de los otros guardianes existen para impedir",
  );
}

const importsDe = (texto) =>
  [...texto.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

/** Sin comentarios: un docstring que EXPLICA R2 no está ramificando sobre `role`. */
const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const archivos = readdirSync(SRC)
  .filter((f) => f.endsWith(".ts"))
  .sort();

const usados = new Set();
for (const archivo of archivos) {
  const texto = readFileSync(join(SRC, archivo), "utf8");
  const especificadores = importsDe(texto);

  // ── RED B · el regex sigue reconociendo imports ────────────────────────────
  if (especificadores.length === 0 && !archivo.endsWith(".d.ts")) {
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
      `los únicos paquetes que la orquestación puede alcanzar son: ${PERMITIDOS.join(", ")}`,
      "este paquete tiene CERO dependencias de runtime: `sha256` y `targetSizeChars` entran por parámetro exactamente para eso, y `adapters` es el único paquete del pipeline del lado de adentro del borde. Un `node:` acá lo desharía sin que nada más se queje",
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

  // ── R2 · no se ramifica sobre `role` ───────────────────────────────────────
  if (ROLES !== null) {
    const ramifica = ROLES.filter((r) => new RegExp(`["']${r}["']`).test(código));
    if (ramifica.length > 0) {
      fallar(
        `R2 · src/${archivo} nombra un literal de \`role\``,
        `menciona: ${ramifica.join(", ")}`,
        "«aguas abajo se LEE `role`, nunca se RAMIFICA sobre él» es lo único que impide que la semántica del formato se re-derive en cada tramo. `cohesionOf`, `isLead`, `roleFromBody` e `isRowNode` viven en `ir` justamente para que ningún consumidor tenga que escribir el nombre de un rol; el día que uno lo escriba, agregar el rol dieciséis pasa a ser una búsqueda por todo el repo",
      );
    }
  }
}

// ── La composición existe, y por eso la frontera no es vacía ─────────────────
{
  const sinUsar = OBLIGATORIOS.filter((p) => !usados.has(p));
  if (sinUsar.length > 0) {
    fallar(
      "fronteras · la orquestación dejó de componer los dos lados",
      `no importa: ${sinUsar.join(", ")}`,
      "es la RED de este paquete, y la única que le corresponde: «`adapters` y `emission` nunca se ven entre sí» es una frase que se puede cumplir por VACÍO —nadie los usa— y lo que la vuelve una afirmación es que alguien los componga. Ese alguien es este paquete: si deja de importar uno, las dos fronteras de los otros siguen verdes sobre un pipeline que no existe",
    );
  }
}

// ── `lint` se ORDENA por el grafo, no solo `build` ───────────────────────────
//
// HALLAZGO MEDIDO EN ESTE PASO, Y ES LA MITAD QUE `I11b` NO CUBRÍA. `emission` ya fija
// que `build` no puede encadenar el corredor de mutación, porque el corredor muta `src/`
// EN EL LUGAR y turbo agenda `lint` y `build` del mismo paquete en paralelo. Con un
// cuarto paquete el problema se agranda y cambia de forma: `orchestration#lint` COMPILA
// LAS FUENTES DE `adapters` —es el único paquete cuyos guardianes leen el `src/` de
// otro— y `adapters#lint` las muta. Con el `dependsOn: ["^build"]` solo, los dos quedan
// sin arista entre sí y turbo los corre a la vez.
//
// NO ES TEÓRICO: se reprodujo. `turbo lint --filter=@savia-os/orchestration
// --filter=@savia-os/adapters` falló con cinco invariantes rojos de `orchestration`
// —el golden, el frontmatter, las dos mitades del satélite y el tamaño objetivo— sobre
// un árbol SANO, porque el compilado de `adapters` que leyó tenía la mutación de `S17`
// puesta. El candado de exclusión mutua del corredor no lo cubre: protege dos corridas
// de mutación sobre el MISMO árbol, y acá son dos árboles distintos.
//
// El arreglo es una arista: `lint` pasa a depender también del `lint` de sus
// dependencias. Se verifica desde acá y no desde otro paquete porque este es el único
// para el que el orden es una PRECONDICIÓN — los demás solo leen su propio `src/`.
{
  const turbo = resolve(RAIZ, "..", "..", "turbo.json");
  if (!existsSync(turbo)) {
    fallar(
      "la cadena · no está `turbo.json`",
      `esperaba ${turbo}`,
      "sin el archivo no se puede verificar el orden, y este guardián daría verde por no haber mirado",
    );
  } else {
    const deps = JSON.parse(readFileSync(turbo, "utf8")).tasks?.lint?.dependsOn ?? [];
    if (!deps.includes("^lint")) {
      fallar(
        "la cadena · `lint` no se ordena por el grafo de paquetes",
        `\`tasks.lint.dependsOn\` es ${JSON.stringify(deps)} y le falta "^lint"`,
        "los guardianes de este paquete COMPILAN el `src/` de `adapters`, y el corredor de mutación de `adapters` lo muta en el lugar. Sin la arista, turbo los corre en paralelo y los invariantes de acá se ponen rojos sobre un árbol sano — que es la peor clase de rojo, porque el que lo lee busca el bug donde no está. Reproducido en el paso 3b",
      );
    }
  }
}

// ── El grafo DECLARADO coincide con el usado ─────────────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const declaradas = Object.keys(pkg.dependencies ?? {}).sort();
  if (declaradas.join(",") !== [...PERMITIDOS].sort().join(",")) {
    fallar(
      "fronteras · `dependencies` no es exactamente los tres",
      `declara: ${declaradas.length === 0 ? "(ninguna)" : declaradas.join(", ")}\n        esperaba: ${[...PERMITIDOS].sort().join(", ")}`,
      "sin este chequeo, la lista blanca de imports se satisface agregando la dependencia y el import EL MISMO DÍA: el grafo de paquetes es lo que de verdad impone las reglas, y este es el lugar donde se lo mira",
    );
  }
}

if (errores > 0) {
  console.error(`ORCHESTRATION-ERR: ${errores} violación(es) de frontera.`);
  process.exit(1);
}
console.log(
  `fronteras ok (${archivos.length} archivos de src, ${PERMITIDOS.length} paquetes permitidos, ` +
    `los ${OBLIGATORIOS.length} lados compuestos, R2 sobre ${ROLES.length} roles derivados de \`ir\`)`,
);
