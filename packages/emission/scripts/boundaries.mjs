/**
 * Las fronteras de `emission`, hechas grafo. Cero dependencias.
 *
 * «`adapters` y `emission` NUNCA se ven entre sí; `ir` es el único lugar que ambos
 * alcanzan» (§{Paquetes}). Hasta el paso 3 esa frase era CIERTA Y VACÍA: no había
 * ningún adaptador que se pudiera importar, así que la frontera no tenía contenido y
 * nada podía cruzarla. Desde el paso 3a el tramo 5 vive acá, y el tramo 5 es el otro
 * consumidor de `cohesionOf` — o sea el primer candidato real a mirar el formato.
 *
 * LO QUE EL GRAFO DE PAQUETES YA DA, Y LO QUE NO. `package.json` declara
 * `@savia-os/ir` y nada más, y `tsc` no resuelve un import a un paquete que no está
 * en `dependencies`. Eso ya funciona hoy y no hace falta escribirlo. Lo que NO da:
 * el error es «Cannot find module '@savia-os/adapters'», que **no nombra ninguna
 * frontera** — no dice que cruzarla esté prohibido, dice que falta una dependencia,
 * y la reacción natural de quien lo lee es AGREGARLA. Este script existe para que el
 * mensaje diga qué regla se rompió y por qué existe.
 *
 * POR QUÉ CORRE ANTES QUE `tsc` EN LA CADENA, contra el orden de `ir`. En `ir` las
 * tres fronteras son entre archivos del MISMO paquete, así que `tsc` los resuelve sin
 * problema y solo el guardián objeta: el orden da igual. Acá los dos extremos
 * prohibidos son PAQUETES QUE TODAVÍA NO EXISTEN, así que `tsc` muere primero con su
 * mensaje mudo y el guardián no llega a hablar nunca. Un guardián al que otro
 * chequeo sombrea NO ACREDITA NADA — es el mismo hallazgo que obligó a que el
 * chequeo de la cadena de guardianes tenga un solo dueño. Por eso va primero.
 *
 * LAS TRES GARANTÍAS, y las dos redes que impiden que el script mienta en verde:
 *
 *   1. Ningún archivo de `src/` importa un paquete que no sea `@savia-os/ir`. Es la
 *      forma fuerte: no una lista negra de los dos paquetes del paso 3b —que se
 *      quedaría corta con el tercero— sino una lista BLANCA de uno. `node:crypto`
 *      también está prohibido, y eso no es celo: `emit` recibe `sha256` POR
 *      PARÁMETRO justamente para que este paquete siga con cero dependencias de
 *      runtime, y un import de `node:` lo desharía sin que nada más se queje.
 *   2. Los dos paquetes del paso 3b se nombran igual, uno por uno, para que el
 *      mensaje diga «frontera» y no «paquete desconocido» el día que alguien lo
 *      escriba. Es redundante con (1) y se conserva a propósito: (1) explica la
 *      REGLA, (2) nombra la RELACIÓN.
 *   3. `dependencies` de `package.json` es exactamente `{@savia-os/ir}`. Sin esto,
 *      (1) se puede satisfacer agregando la dependencia y el import el mismo día.
 *   4. **R2 — aguas abajo se LEE `role`, nunca se RAMIFICA sobre él.** El plan la lista
 *      como «lint sobre el núcleo, detectable estáticamente» y hasta el paso 4 solo la
 *      imponía `orchestration`: un `switch (node.role)` en `src/grouping.ts` COMPILABA,
 *      y `grouping.ts` es el candidato más real de todo el repo a escribirlo, porque es
 *      el consumidor de `cohesionOf` y consultar la tabla es un renglón más largo que
 *      ramificar. El vocabulario NO se escribe acá: se DERIVA de `ROLES` en `ir`, o
 *      sería una segunda lista que queda corta justo con el rol que alguien acaba de
 *      agregar — que es el caso en el que R2 más importa.
 *
 *      LA EXENCIÓN DEL FIXTURE, y por qué no es un agujero. `src/synthetic.ts`
 *      CONSTRUYE nodos y por eso nombra roles; no los consume. Construir no es
 *      ramificar, y los sintéticos viven en `src/` y no en el guardián por una razón de
 *      tipos que su propio docstring explica (`Node` lleva `NODE_BRAND` y solo `asNode`
 *      la pone). La exención es de UN archivo, nombrado, y no es total: adentro del
 *      fixture sigue prohibida la forma que SÍ es ramificar (`=== "x"`, `case "x"`).
 *      Y tiene su propia red — si el archivo se renombrara, la exención dejaría de
 *      cubrir a nadie y este guardián lo dice en vez de quedarse callado.
 *
 *   · RED A — los extremos EXISTEN EN DISCO. Si `src/grouping.ts` se renombrara, un
 *     script que solo busca imports prohibidos no encontraría ninguno y pasaría en
 *     verde sobre un paquete que ya no tiene el archivo que la frontera protege.
 *   · RED B — un CONTEO LAXO de imports por archivo. Si el regex dejara de reconocer
 *     la forma de un import, este script encontraría cero prohibidos y daría verde
 *     por no ver nada. Se exige que cada archivo de `src/` tenga al menos un import
 *     —los cinco lo tienen, y el barril tiene cuatro relativos— y que al menos
 *     cuatro archivos importen `@savia-os/ir` por su nombre.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

/** El único paquete que este puede alcanzar. */
const PERMITIDO = "@savia-os/ir";

/** El único archivo que puede NOMBRAR un rol, porque construye nodos en vez de leerlos. */
const FIXTURE = "synthetic.ts";

/**
 * Las relaciones prohibidas, nombradas. No son la garantía —lo es la lista blanca de
 * arriba— sino el MENSAJE: el día que alguien escriba el import, el error nombra la
 * frontera en vez de una dependencia faltante.
 */
const FRONTERAS = [
  {
    hacia: "@savia-os/adapters",
    porqué:
      "el borde R1: un adaptador conoce el formato y `emission` no puede conocerlo. Si se ven, " +
      "la señal del formato cruza y R1 pasa de ser una propiedad del grafo a una convención que " +
      "alguien revisa (§{R1})",
  },
  {
    hacia: "@savia-os/ingestion",
    porqué:
      "la orquestación llama a este paquete, no al revés. Un import en esta dirección hace ciclo " +
      "y vuelve inarrancable el orden de construcción (§{Paquetes})",
  },
];

/** Los archivos que las fronteras protegen. Si no están, el script mentiría. */
const PROTEGIDOS = ["grouping.ts", "emitter.ts", "route.ts"];

let errores = 0;
const fallar = (qué, detalle, porqué) => {
  console.error(`EMISSION-ERR: ${qué}\n        ${detalle}\n        importa porque: ${porqué}`);
  errores += 1;
};

const archivos = readdirSync(SRC)
  .filter((f) => f.endsWith(".ts"))
  .sort();

// ── RED A · los extremos existen ─────────────────────────────────────────────
const faltantes = PROTEGIDOS.filter((f) => !archivos.includes(f));
if (faltantes.length > 0) {
  fallar(
    "fronteras · un extremo no está en disco",
    `faltan: ${faltantes.join(", ")}`,
    "un guardián que busca imports prohibidos en un archivo que no existe encuentra CERO y pasa en verde: la frontera queda sin dueño y nadie se entera",
  );
}

/**
 * Todo especificador de import/export de un archivo. Deliberadamente LAXO: cubre
 * `import … from "x"`, `export … from "x"`, `import "x"` e `import("x")`, sin
 * distinguir tipos de valores — un `import type` cruza la frontera igual, porque lo
 * que la frontera protege es el GRAFO DE MÓDULOS y no el bundle.
 */
const importsDe = (texto) =>
  [...texto.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

/**
 * EL VOCABULARIO DE R2, DERIVADO Y NO ESCRITO. Se lee `ROLES` de `ir` a través de la
 * dependencia que este paquete ya declara. Una lista a mano acá sería una SEGUNDA fuente
 * de verdad, y quedaría corta exactamente con el rol que alguien acaba de agregar.
 */
const rolesDeIr = () => {
  const archivo = join(RAIZ, "node_modules", "@savia-os", "ir", "src", "classification.ts");
  if (!existsSync(archivo)) return null;
  const m = /export const ROLES = \[([\s\S]*?)\] as const;/.exec(readFileSync(archivo, "utf8"));
  if (m === null) return null;
  const roles = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  return roles.length === 0 ? null : roles;
};

const ROLES = rolesDeIr();
if (ROLES === null) {
  fallar(
    "R2 · no se pudo derivar el vocabulario de `ROLES` desde `ir`",
    "no está `node_modules/@savia-os/ir/src/classification.ts`, o cambió la forma de la declaración",
    "sin el vocabulario, el barrido de R2 no encuentra nada y este guardián da VERDE por no haber mirado — que es el modo de falla que las dos redes de arriba existen para impedir",
  );
}

/** Sin comentarios: un docstring que EXPLICA R2 no está ramificando sobre `role`. */
const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

// RED del fixture: si `synthetic.ts` se renombrara, la exención de abajo dejaría de
// cubrir a nadie y el barrido pasaría a exigirle al archivo nuevo algo que ningún
// constructor de nodos puede cumplir — o, peor, la exención quedaría apuntando al vacío
// y nadie se enteraría de que el guardián dejó de tener una excepción que justificar.
if (!archivos.includes(FIXTURE)) {
  fallar(
    `R2 · el fixture exento \`src/${FIXTURE}\` no está en disco`,
    `los archivos de src son: ${archivos.join(", ")}`,
    "la exención existe porque los sintéticos CONSTRUYEN nodos y por eso nombran roles. Una exención que no cubre ningún archivo es una excepción sin dueño: el día que alguien la lea no va a poder decidir si sigue haciendo falta",
  );
}

let conIr = 0;
for (const archivo of archivos) {
  const especificadores = importsDe(readFileSync(join(SRC, archivo), "utf8"));

  // ── R2 · no se ramifica sobre `role` ───────────────────────────────────────
  if (ROLES !== null) {
    const código = sinComentarios(readFileSync(join(SRC, archivo), "utf8"));
    // El fixture puede NOMBRAR un rol —lo escribe adentro de un nodo— pero no
    // RAMIFICAR sobre él. Los demás no pueden ni nombrarlo: no tienen por qué.
    const prohibido =
      archivo === FIXTURE
        ? (r) => new RegExp(`(?:===|!==|case)\\s*["']${r}["']|["']${r}["']\\s*(?:===|!==)`).test(código)
        : (r) => new RegExp(`["']${r}["']`).test(código);
    const ramifica = ROLES.filter(prohibido);
    if (ramifica.length > 0) {
      fallar(
        `R2 · src/${archivo} nombra un literal de \`role\``,
        `menciona: ${ramifica.join(", ")}`,
        "«aguas abajo se LEE `role`, nunca se RAMIFICA sobre él» es lo único que impide que la semántica del formato se re-derive en cada tramo. `cohesionOf`, `isLead`, `roleFromBody` e `isRowNode` viven en `ir` justamente para que ningún consumidor tenga que escribir el nombre de un rol; el día que uno lo escriba, agregar el rol dieciséis pasa a ser una búsqueda por todo el repo — y este paquete es el candidato más real, porque consultar `cohesionOf` es un renglón más largo que ramificar",
      );
    }
  }

  // ── RED B · el regex sigue reconociendo imports ────────────────────────────
  if (especificadores.length === 0) {
    fallar(
      `fronteras · \`src/${archivo}\` no declara un solo import`,
      "o el archivo quedó aislado, o el reconocedor de imports de este script dejó de reconocer su forma",
      "las dos posibilidades son graves y la segunda es peor: con el reconocedor roto, este guardián no encuentra ningún import prohibido y da VERDE por no ver nada",
    );
  }

  for (const e of especificadores) {
    if (e.startsWith(".")) continue;
    if (e === PERMITIDO) {
      conIr += 1;
      continue;
    }
    const frontera = FRONTERAS.find((f) => e === f.hacia || e.startsWith(`${f.hacia}/`));
    if (frontera !== undefined) {
      fallar(
        `frontera cruzada · src/${archivo}  ↛  ${frontera.hacia}`,
        `el import es \`${e}\``,
        frontera.porqué,
      );
      continue;
    }
    fallar(
      `frontera cruzada · src/${archivo} importa \`${e}\``,
      `el único paquete que \`emission\` puede alcanzar es \`${PERMITIDO}\``,
      "«`ir` es el único lugar que ambos alcanzan» (§{Paquetes}), y `emission` no tiene NINGUNA dependencia de runtime: `emit` recibe `sha256` por parámetro justamente para no importar `node:crypto`",
    );
  }
}

if (conIr < PROTEGIDOS.length) {
  fallar(
    "fronteras · el reconocedor encontró menos imports de `ir` de los que hay",
    `${conIr} archivos importan \`${PERMITIDO}\`, y al menos ${PROTEGIDOS.length} lo hacen`,
    "es la segunda mitad de la RED B: un conteo bajo dice que el regex se quedó corto, y un regex corto no ve el import prohibido tampoco",
  );
}

// ── El grafo DECLARADO coincide con el usado ─────────────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const declaradas = Object.keys(pkg.dependencies ?? {}).sort();
  if (declaradas.length !== 1 || declaradas[0] !== PERMITIDO) {
    fallar(
      "fronteras · `dependencies` declara algo más que `ir`",
      `declara: ${declaradas.length === 0 ? "(ninguna)" : declaradas.join(", ")}`,
      "sin este chequeo, la lista blanca de imports se satisface agregando la dependencia y el import EL MISMO DÍA: el grafo de paquetes es lo que de verdad impone R1, y este es el lugar donde se lo mira",
    );
  }
}

if (errores > 0) {
  console.error(`EMISSION-ERR: ${errores} violación(es) de frontera.`);
  process.exit(1);
}
console.log(
  `fronteras ok (${archivos.length} archivos de src, ${FRONTERAS.length} fronteras nombradas, ` +
    `1 paquete permitido: ${PERMITIDO}, R2 sobre ${ROLES.length} roles derivados de \`ir\`)`,
);
