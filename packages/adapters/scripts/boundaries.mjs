#!/usr/bin/env node
/**
 * LA FRONTERA QUE ESTE PASO EXISTE PARA PROBAR, desde el lado de los adaptadores.
 * Cero dependencias.
 *
 * «`adapters` y `emission` NUNCA se ven entre sí; `ir` es el único lugar que ambos
 * alcanzan» (§{Paquetes}). Hasta el paso 3 esa frase era CIERTA Y VACÍA por el lado que
 * importaba: no existía ningún adaptador, así que la mitad `emission ↛ adapters` no
 * tenía a dónde apuntar y la mitad `adapters ↛ emission` no tenía quién la escribiera.
 * Desde este paso las dos tienen los dos extremos en disco, y cada paquete acredita LA
 * SUYA — que es lo que hace que la frontera sea una propiedad del grafo y no una
 * revisión.
 *
 * POR QUÉ CORRE ANTES QUE `tsc` EN LA CADENA. Los extremos prohibidos son PAQUETES QUE
 * ESTE NO DECLARA, así que el resolvedor de módulos muere primero con «Cannot find
 * module '@savia-os/emission'», que **no nombra ninguna frontera**: no dice que
 * cruzarla esté prohibido, dice que falta una dependencia, y la reacción natural de
 * quien lo lee es AGREGARLA. Un guardián al que otro chequeo sombrea NO ACREDITA NADA.
 *
 * LAS SEIS GARANTÍAS:
 *
 *   1. Ningún archivo de `src/` importa un paquete que no sea `@savia-os/ir` o `yaml`.
 *      Lista BLANCA de dos, no lista negra: una negra se queda corta con el paquete que
 *      todavía no existe.
 *   2. Los dos paquetes prohibidos se nombran UNO POR UNO. Es redundante con (1) y se
 *      conserva a propósito: (1) explica la REGLA, (2) nombra la RELACIÓN.
 *   3. `yaml` está CONFINADA a `src/markdown.ts`. Es la primera dependencia de runtime
 *      del proyecto y la regla que la admite dice «solo `adapters` las tiene» — no
 *      «cualquier archivo de `adapters`». El tramo 2 decide QUIÉN lee un archivo, y si
 *      dependiera de una librería de formato, cada adaptador nuevo arrastraría la suya
 *      a la selección de los doce.
 *   4. `dependencies` es exactamente `{@savia-os/ir, yaml}`. Sin esto, (1) y (2) se
 *      satisfacen agregando la dependencia y el import EL MISMO DÍA.
 *   5. Ni un global de node en `src/`. Un import de `node:` lo ve (1); `Buffer`,
 *      `process` y `require` NO son imports y ningún regex de imports los vería. Es la
 *      razón por la que este paquete declara `TextDecoder` a mano en `src/env.d.ts` en
 *      vez de traer `@types/node`.
 *   6. Ningún guardián queda fuera de `lint`, y `build` no encadena el corredor de
 *      mutación. Vive ACÁ y en ningún otro guardián del paquete: `emission` lo pone en
 *      `invariants.mjs` y `ir` en su `boundaries.mjs`, y el prototipo del paso 3 tenía
 *      los DOS — el banco de mutación mostró que el segundo nunca llegaba a imprimir,
 *      porque el primero ya había cortado. Un chequeo que otro sombrea no acredita nada:
 *      tiene un solo dueño, y el dueño es el que corre primero.
 *
 *   · RED A — los extremos EXISTEN EN DISCO, y el corpus también. Si `src/markdown.ts`
 *     se renombrara, un script que solo busca imports prohibidos no encontraría ninguno
 *     y pasaría en verde sobre un paquete que ya no tiene el archivo que protege.
 *   · RED B — un CONTEO LAXO de imports por archivo. Si el regex dejara de reconocer la
 *     forma de un import, este script encontraría cero prohibidos y daría verde POR NO
 *     HABER MIRADO.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const MUTANTES = "scripts/mutants.mjs";

/**
 * Los únicos paquetes que este puede alcanzar, y desde dónde. `null` = cualquier
 * archivo.
 *
 * `fflate` ES LA SEGUNDA DEPENDENCIA DE RUNTIME DEL PROYECTO, y entra con su razón:
 * cuatro de los doce formatos —`.docx`, `.xlsx`, `.pptx` y `.odt`— son un zip por
 * dentro, y descomprimir DEFLATE no es algo que se escriba a mano. Se eligió sobre las
 * alternativas por tener CERO dependencias transitivas y funcionar sin los globales de
 * node, las dos cosas medidas antes de agregarla. Se descartó una librería que lee
 * `.docx` completo: devuelve HTML, o sea que hace `detect` por nosotros y borra la
 * cascada que el paso 7 existe para probar.
 *
 * SU DUEÑO NO ES UN ADAPTADOR, Y ES LA PRIMERA VEZ. `yaml` vive en `markdown.ts`
 * porque UN adaptador la usa; el zip lo consultan CUATRO, así que confinarlo a uno de
 * ellos obligaría a `.xlsx` a importar desde `docx.ts` —una dependencia entre
 * adaptadores donde no hay ninguna relación—. La regla se conserva entera, «una
 * dependencia, un dueño», y el dueño es la pieza compartida: `zip.ts`.
 */
const PERMITIDOS = new Map([
  ["@savia-os/ir", null],
  ["yaml", "markdown.ts"],
  ["fflate", "unzip.ts"],
  ["txml", "docx.ts"],
]);

/**
 * Las relaciones prohibidas, nombradas. No son la garantía —lo es la lista blanca— sino
 * el MENSAJE: el día que alguien escriba el import, el error nombra la frontera en vez
 * de una dependencia faltante.
 */
const FRONTERAS = [
  {
    hacia: "@savia-os/emission",
    porqué:
      "el borde R1: un adaptador conoce el formato y la emisión no puede conocerlo. Si se ven, la " +
      "señal del formato cruza y R1 pasa de ser una propiedad del grafo a una convención que alguien " +
      "revisa (§{Paquetes})",
  },
  {
    hacia: "@savia-os/orchestration",
    porqué:
      "«NO hay `delegar()`»: sería la lectura literal de «la recursión ocurre sola» desde adentro del " +
      "adaptador, y rompe el grafo — este paquete pasaría a depender de `select`, que vive con el " +
      "registro. El adaptador emite `asset` y nada más; quien recorre las unidades, detecta los assets " +
      "y llama a `select` es la ORQUESTACIÓN (PROVISIONAL(H1) de `ir/src/adapter.ts`)",
  },
];

/**
 * Lo que las fronteras y el golden protegen. Si no están, el script mentiría.
 *
 * Los dos archivos del paso 4 entran por una razón MÁS FUERTE que la del `.md`. El
 * `.conf` es el único caso de texto del corpus y lleva a propósito una extensión que
 * ningún adaptador reclama: si desapareciera, el piso no tendría un solo archivo que
 * lo obligue a decidir por CONTENIDO, y una implementación que decidiera por extensión
 * pasaría en verde. El `.png` es el único caso de la rama que NO se indexa: sin él,
 * «el piso no acepta todo» es una frase sin observador y `on_hold` es código muerto.
 */
const PROTEGIDOS = [
  "src/registry.ts",
  "src/markdown.ts",
  "src/zip.ts",
  "src/unzip.ts",
  "src/docx.ts",
  "src/floor.ts",
  "src/env.d.ts",
  "corpus/manual.md",
  "corpus/manual.golden.json",
  // Los dos zips del paso 7, y son fixtures DISTINTOS que prueban ramas distintas. Sin
  // el primero, I20 no tiene sobre qué correr y la mitad del paso que no necesita
  // ninguna librería queda sin acreditar. Sin el segundo —la misma imagen, deflateada—
  // no queda un solo archivo del corpus que OBLIGUE a materializar, y las dos mitades de
  // «guardar es incondicional, indexar no» (I22 acá, I18 en la orquestación) se quedan
  // sin observador. Se nombran acá en vez de confiar en que el `readFileSync` de los
  // invariantes explote: que un guardián se caiga por un archivo que falta dice QUÉ
  // archivo, no POR QUÉ hacía falta.
  "corpus/manual.docx",
  "corpus/manual-deflated.docx",
  "corpus/servidor.conf",
  "corpus/sello.png",
];

/** Globales de node. No son imports, así que ningún regex de imports los ve. */
const GLOBALES = ["Buffer", "process.", "__dirname", "__filename", "require("];

let errores = 0;
const fallar = (qué, detalle, porqué) => {
  console.error(`ADAPTERS-ERR: ${qué}\n        ${detalle}\n        importa porque: ${porqué}`);
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
      "muta los archivos del árbol EN EL LUGAR, y turbo agenda `lint` y `build` en paralelo: se pisan y el segundo captura como «original» un archivo que el primero ya mutó. La regla de fondo es más simple que la carrera — un build no muta su fuente",
    );
  }
}

// ── El DIARIO DE DESHACER del corredor de mutación · dueño ÚNICO ─────────────
// El corredor muta el árbol EN EL LUGAR, así que lo único que lo hace seguro es que el
// original de cada archivo esté EN DISCO antes de que el archivo cambie. Un `SIGKILL` —el
// que `turbo` manda a las tareas concurrentes cuando otra falla— NO EJECUTA NINGÚN
// HANDLER: un mapa en memoria muere con el proceso y la mutación queda pegada sin nadie
// que sepa revertirla. Pasó dos veces en dos días: `src/markdown.ts` con `role: "heading"`
// puesto, y ocho archivos de `packages/ir/src`.
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
  const faltantes = PROTEGIDOS.filter((f) => !existsSync(join(RAIZ, f)));
  if (faltantes.length > 0) {
    fallar(
      "fronteras · un extremo no está en disco",
      `faltan: ${faltantes.join(", ")}`,
      "un guardián que busca imports prohibidos en un archivo que no existe encuentra CERO y pasa en verde: la frontera queda sin dueño y nadie se entera. El corpus y su golden entran en la lista por lo mismo: son los dos únicos archivos del paquete que no son código y sin los cuales una mutación de comportamiento no rompe nada",
    );
  }
}

/**
 * Todo especificador de import/export de un archivo. Deliberadamente LAXO: cubre
 * `import … from "x"`, `export … from "x"`, `import "x"` e `import("x")`, sin distinguir
 * tipos de valores — un `import type` cruza la frontera igual, porque lo que la frontera
 * protege es el GRAFO DE MÓDULOS y no el bundle.
 */
const importsDe = (texto) =>
  [...texto.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

/**
 * Sin comentarios, para el barrido de globales y SOLO para él. Un docstring que
 * EXPLICA por qué no se usa `Buffer` no está usando `Buffer`, y sin este paso el
 * guardián se pondría rojo sobre su propia documentación — que es la forma más rápida
 * de que alguien lo apague. El barrido de imports sí corre sobre el texto crudo: su
 * regex exige `from`/`import` pegado a una comilla, así que una mención en prosa no lo
 * dispara, y un import comentado prefiero verlo.
 */
const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const archivos = readdirSync(SRC)
  .filter((f) => f.endsWith(".ts"))
  .sort();

// ── RED A2 · un dueño declarado EXISTE EN DISCO ──────────────────────────────
// Sin esto, declarar `["txml", "docx.ts"]` antes de escribir `docx.ts` pasa en VERDE:
// ningún archivo importa el paquete, así que el chequeo de confinamiento de abajo no
// corre nunca, y `dependencies` coincide con la lista blanca porque la lista blanca es
// lo que se acaba de tocar. Queda una dependencia sin consumidor y un dueño que no
// existe — el mismo «exención sin dueño» que RED A impide para los extremos, entrando
// por la otra puerta. Es la red que sostuvo el orden en que se escribió el paso 7:
// `txml` se declaró recién cuando `docx.ts` existió, y hasta entonces esta red era lo
// único que podía decir la diferencia entre «confinada» y «nunca chequeada».
{
  const huérfanos = [...PERMITIDOS.entries()]
    .filter(([, dueño]) => dueño !== null && !existsSync(join(SRC, dueño)))
    .map(([paquete, dueño]) => `${paquete} → src/${dueño}`);
  if (huérfanos.length > 0) {
    fallar(
      "fronteras · una dependencia declara un dueño que no existe",
      huérfanos.join(", "),
      "una dependencia de runtime sin consumidor es una que nadie puede justificar, y un dueño inexistente vuelve inalcanzable el chequeo de confinamiento: las dos mitades de la regla quedan verdes sin verificar nada",
    );
  }
}

let conIr = 0;
for (const archivo of archivos) {
  const texto = readFileSync(join(SRC, archivo), "utf8");
  const especificadores = importsDe(texto);

  // ── RED B · el regex sigue reconociendo imports ────────────────────────────
  // Un `.d.ts` de ambiente no importa nada POR DISEÑO —declara globales— así que queda
  // exento de esta mitad y no de las otras: se lo sigue mirando por si trae un
  // especificador prohibido, que es lo que lo convertiría en un módulo.
  if (especificadores.length === 0 && !archivo.endsWith(".d.ts")) {
    fallar(
      `fronteras · \`src/${archivo}\` no declara un solo import`,
      "o el archivo quedó aislado, o el reconocedor de imports de este script dejó de reconocer su forma",
      "las dos posibilidades son graves y la segunda es peor: con el reconocedor roto, este guardián no encuentra ningún import prohibido y da VERDE por no ver nada",
    );
  }

  for (const e of especificadores) {
    if (e.startsWith(".")) continue;

    const frontera = FRONTERAS.find((f) => e === f.hacia || e.startsWith(`${f.hacia}/`));
    if (frontera !== undefined) {
      fallar(
        `frontera cruzada · src/${archivo}  ↛  ${frontera.hacia}`,
        `el import es \`${e}\``,
        frontera.porqué,
      );
      continue;
    }

    if (!PERMITIDOS.has(e)) {
      fallar(
        `frontera cruzada · src/${archivo} importa \`${e}\``,
        `los únicos paquetes que \`adapters\` puede alcanzar son: ${[...PERMITIDOS.keys()].join(", ")}`,
        "`ir` es el único lugar que `adapters` y `emission` alcanzan (§{Paquetes}), y la única dependencia de runtime del proyecto entra por el frontmatter y por nada más: una segunda se agrega ACÁ, con su razón, no de costado",
      );
      continue;
    }

    const dueño = PERMITIDOS.get(e);
    if (dueño !== null && archivo !== dueño) {
      fallar(
        `confinamiento roto · src/${archivo} importa \`${e}\``,
        `\`${e}\` solo puede vivir en \`src/${dueño}\``,
        "es la primera dependencia de runtime del proyecto y la regla que la admite dice «solo `adapters` las tiene», no «cualquier archivo de `adapters`». Encerrada en el adaptador que la usa, el tramo 2 —decidir QUIÉN lee un archivo— sigue sin depender de ninguna librería de formato",
      );
      continue;
    }

    if (e === "@savia-os/ir") conIr += 1;
  }

  const código = sinComentarios(texto);
  for (const g of GLOBALES) {
    if (!código.includes(g)) continue;
    fallar(
      `fronteras · src/${archivo} usa el global de node \`${g}\``,
      "un global no es un import, así que el reconocedor de arriba no lo ve",
      "es exactamente el agujero por el que este paquete NO trae `@types/node`: con esos tipos en alcance, `src/` puede usar node sin escribir un solo `import` y la lista blanca de imports deja de decir la verdad. Lo que el paquete toma del entorno se declara a mano en `src/env.d.ts`",
    );
  }
}

if (conIr < FRONTERAS.length) {
  fallar(
    "fronteras · el reconocedor encontró menos imports de `ir` de los que hay",
    `${conIr} imports de \`@savia-os/ir\`, y al menos ${FRONTERAS.length} hay`,
    "es la segunda mitad de la RED B: un conteo bajo dice que el regex se quedó corto, y un regex corto no ve el import prohibido tampoco",
  );
}

// ── El grafo DECLARADO coincide con el usado ─────────────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const declaradas = Object.keys(pkg.dependencies ?? {}).sort();
  const esperadas = [...PERMITIDOS.keys()].sort();
  if (declaradas.join(",") !== esperadas.join(",")) {
    fallar(
      "fronteras · `dependencies` no es exactamente la lista blanca",
      `declara: ${declaradas.length === 0 ? "(ninguna)" : declaradas.join(", ")}\n        esperaba: ${esperadas.join(", ")}`,
      "sin este chequeo, la lista blanca de imports se satisface agregando la dependencia y el import EL MISMO DÍA: el grafo de paquetes es lo que de verdad impone R1, y este es el lugar donde se lo mira",
    );
  }
}

// Se DERIVA del mapa y no se escribe a mano. La versión anterior decía «`yaml`
// confinada a src/markdown.ts» y caducó en el momento en que entró la segunda: una
// cifra o una lista mantenida a mano en el resumen de un guardián es la misma clase de
// mentira que el guardián existe para impedir.
const confinadas = [...PERMITIDOS.entries()]
  .filter(([, dueño]) => dueño !== null)
  .map(([paquete, dueño]) => `${paquete}→src/${dueño}`);

if (errores > 0) {
  console.error(`ADAPTERS-ERR: ${errores} violación(es) de frontera.`);
  process.exit(1);
}
console.log(
  `fronteras ok (${archivos.length} archivos de src, ${FRONTERAS.length} fronteras nombradas, ` +
    `${PERMITIDOS.size} paquetes permitidos, ${confinadas.length} confinada(s): ${confinadas.join(", ")})`,
);
