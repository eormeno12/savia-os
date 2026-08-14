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

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

/** El único paquete que este puede alcanzar. */
const PERMITIDO = "@savia-os/ir";

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

let conIr = 0;
for (const archivo of archivos) {
  const especificadores = importsDe(readFileSync(join(SRC, archivo), "utf8"));

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
    `1 paquete permitido: ${PERMITIDO})`,
);
