/**
 * Las fronteras del grafo de módulos. Cero dependencias.
 *
 * Hay invariantes que no se expresan como tipo pero sí como ALCANCE: si un módulo
 * no puede nombrar un tipo, no puede contenerlo. Esta es la técnica que el plan ya
 * nombra en la regla R1 («la frontera de formato la impone el grafo de paquetes»),
 * aplicada acá a la frontera de nodos.
 *
 *   `shapes.ts` no puede alcanzar `outputs.ts`.
 *
 * Por qué eso ES el invariante «ningún payload anida un nodo»
 * (§{Tramo 3 › Qué sale}): lo que vuelve `Node` a un `Node` es `NODE_BRAND`, que
 * vive solo en `outputs.ts`. Sin
 * alcanzarlo, un nodo dentro de un `Body` es inexpresable — no hace falta
 * detectarlo. Y la dirección natural del grafo ya es la contraria (`outputs.ts`
 * importa `shapes.ts`), así que violar la frontera exige introducir un CICLO.
 *
 * Reemplaza a un detector recursivo de ~50 líneas que estuvo roto desde que se
 * escribió: no veía el anidamiento a través de un campo opcional, de una unión con
 * `null`, de `(Nodo | null)[]`, de `Nodo | string`, ni más allá de 6 niveles —
 * donde además respondía «limpio». Esto se prueba agregando el import y mirando
 * fallar el comando; aquello no se podía probar leyéndolo.
 *
 * Y UNA SEGUNDA COSA QUE NO ES UNA FRONTERA DEL GRAFO, dicho de frente para que no
 * parezca que se coló: la CADENA DE GUARDIANES de `package.json`. Va acá y no en un
 * guardián nuevo porque `lint` corre SIETE y siete son los que tiene que correr —un
 * guardián que existe para vigilar a los guardianes sería el octavo, y el paquete no
 * lo quiere—. De los seis scripts, este es el que ya razona sobre nombres escritos a
 * mano que nada verifica («el archivo exento se nombra por STRING», más abajo) y es
 * el PRIMERO de la cadena, así que si algo falta se entera antes que nadie.
 * `packages/emission` tiene los dos chequeos desde su bloque 5 (I11a/I11b) y `ir` no
 * los tenía, siendo que el accidente que I11b describe —`turbo` corriendo `lint` y
 * `build` en paralelo, el corredor de mutación mutando el árbol en el lugar— dejó
 * mutaciones pegadas en OCHO archivos de `packages/ir/src`. El que se lo comió no
 * tenía el chequeo.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

/** El guardián que muta el árbol en el lugar: va en `lint` y NUNCA en `build`. */
const MUTANTES = "scripts/mutants.mjs";

/** `origen` no puede alcanzar `prohibido`, ni directa ni transitivamente. */
const FRONTERAS = [
  {
    origen: "shapes.ts",
    // Renombrado en el bloque 3 (`salidas.ts` → `outputs.ts`). El chequeo de
    // existencia de más abajo —el de 1b— es el que agarra que esta línea quede
    // corrida: verificado renombrando el archivo sin tocar la constante, sale 1 con
    // «la frontera nombra un archivo que no existe — salidas.ts» en vez de mentir
    // en verde. Es por lo que el chequeo existe.
    prohibido: "outputs.ts",
    porque:
      "un Body que alcanza a Node puede anidarlo, y el árbol deja de ser plano (§{Tramo 3 › Qué sale})",
  },
  {
    // Bloque 3b. Esta frontera NO EXISTÍA porque era INESCRIBIBLE: mientras
    // `Authorship` vivía en `identity.ts`, el camino `projection.ts → shapes.ts →
    // identity.ts` ya existía (por `ObjectKey`) y la frontera nacía violada —
    // verificado, con el camino impreso. Lo que la vuelve escribible es haber mudado
    // `Authorship` a un archivo propio, y esa es la única razón por la que ese
    // archivo existe.
    //
    // El bloque 3b la escribió como `projection.ts ↛ authorship.ts` y cubría UN tipo.
    // Este bloque le mudó `DelegationId` —que declaraba el mismo invariante y del
    // lado alcanzable no lo protegía nada— y con dos miembros el archivo pasa a
    // llamarse por la categoría: `provenance.ts`. La frontera no cambió de forma; lo
    // que cambió es cuánto cubre, y por eso el `porque` de abajo nombra las DOS
    // razones. Está acreditada por miembro: M46 con `Authorship`, M49 con
    // `DelegationId` — un solo mutante que importara los dos se pondría rojo por el
    // primero y no acreditaría al segundo.
    origen: "projection.ts",
    prohibido: "provenance.ts",
    porque:
      "la huella contesta QUÉ ES un contenido, no CÓMO LLEGÓ. Si la autoría entrara, el mismo contenido subido por dos personas daría huellas distintas y se caen el caché de reconocimiento —que cruza organizaciones POR DISEÑO (§{Caché})— y la deduplicación; si entrara la delegación, la re-emisión por delegación tardía movería identificadores, contra el «cero identificadores movidos» de §{La delegación tardía}",
  },
];

// ── La cadena de guardianes ───────────────────────────────────────────────────
// Dos mitades de la misma regla, y las dos se comprueban antes de tocar el grafo:
// si la cadena está mal, lo que este script diga del grafo importa menos.
//
//   (a) `lint` los nombra a TODOS. Un guardián que no corre NO AVISA QUE NO CORRIÓ:
//       el paquete queda verde y la garantía que ese script acredita deja de existir
//       sin que nada cambie de color. Cubre las dos formas de perderlo —omitirlo, y
//       nombrarlo mal, que es lo que deja un rename a medio hacer—. Es la falla que
//       `GLOSARIO.md` (sección 6) documenta haber tenido con `mutantes.mjs`.
//   (b) `build` NO puede nombrar al corredor de mutación. No es una excepción a (a):
//       es la otra mitad. `mutants.mjs` edita los archivos del árbol EN EL LUGAR y
//       los restaura, y `turbo` agenda `lint` y `build` del mismo paquete en
//       PARALELO: si los dos lo encadenan, el segundo captura como «original» un
//       archivo que el primero ya mutó. La regla de fondo es más simple que la
//       carrera: un build no muta su fuente.
{
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const lint = pkg.scripts?.lint ?? "";
  const build = pkg.scripts?.build ?? "";
  const enDisco = readdirSync(join(RAIZ, "scripts")).filter((f) => f.endsWith(".mjs")).sort();

  const faltan = enDisco.filter((g) => !lint.includes(`scripts/${g}`));
  if (faltan.length > 0) {
    console.error(
      `IR-ERR: guardian left out of \`lint\` — ${faltan.join(", ")}\n` +
        `        la cadena dice: ${lint}\n` +
        "        un guardián que no corre no avisa que no corrió: el paquete queda verde y la\n" +
        "        garantía que ese script acredita deja de existir sin que nada cambie de color",
    );
    process.exit(1);
  }

  if (build.includes(MUTANTES)) {
    console.error(
      `IR-ERR: \`build\` chains the mutation runner — ${MUTANTES}\n` +
        `        la cadena dice: ${build}\n` +
        "        muta los archivos del árbol en el lugar, y turbo corre `lint` y `build` en\n" +
        "        paralelo: se pisan y dejan mutaciones pegadas. Va solo en `lint`",
    );
    process.exit(1);
  }
}

/** Módulos que el BFS encontró importados y no están en disco. */
const faltantes = new Set();

/**
 * Los módulos que `archivo` importa, en nombres de disco.
 *
 * El archivo puede NO EXISTIR, y no es un caso raro: durante un rename por etapas
 * (`formas.ts` → `shapes.ts`) todo import a un módulo todavía sin renombrar apunta a
 * un archivo que no está. La versión anterior hacía `readFileSync` a secas y salía
 * con un `ENOENT` crudo de Node, con stack trace y sin el «porque» — falla ruidosa,
 * sí, pero el mensaje habla de `fs.readFileSync` y no de fronteras, así que el que
 * lo lee no sabe si rompió el guardián o el contrato.
 *
 * Un módulo que no está no aporta aristas, así que el recorrido sigue sin él y el
 * BFS termina y dice lo que sí pudo ver. Pero el script NO sale en verde: un grafo
 * recorrido a medias no acredita la frontera, y quedarse callado es el mismo error
 * que el chequeo de más abajo existe para no cometer. Se reporta una vez por módulo
 * y el exit lo decide el cierre.
 */
const importsDe = (archivo) => {
  if (!existsSync(join(SRC, archivo))) {
    faltantes.add(archivo);
    return [];
  }
  const código = readFileSync(join(SRC, archivo), "utf8");
  const rutas = [...código.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1]);

  // Un segundo conteo, LAXO y por otro camino, para detectar que el primero se
  // quedó ciego. Un regex que deja de reconocer un import no falla: devuelve una
  // arista menos, el BFS no encuentra el camino prohibido, y el guardián imprime
  // «frontera ok» sin haber verificado nada. Chequear `length > 0` no alcanza —
  // con tres imports y uno roto quedan dos, y el conteo sigue pareciendo sano.
  const laxo = [...código.matchAll(/from\s+['"`]\.\//g)].length;
  if (laxo !== rutas.length) {
    console.error(
      `IR-ERR: el guardián no ve todos los imports de ${archivo}\n` +
        `        cuenta laxa: ${laxo} · reconocidos por el regex: ${rutas.length}\n` +
        `        el regex de importsDe() se quedó corto (¿comillas? ¿import multilínea?):\n` +
        `        el grafo tiene menos aristas que el código y «frontera ok» no significaría nada`,
    );
    process.exit(1);
  }

  // `verbatimModuleSyntax` obliga a la extensión `.js`; en disco es `.ts`.
  return rutas.map((r) => r.replace(/^\.\//, "").replace(/\.js$/, ".ts"));
};

/** Camino desde `origen` hasta `destino`, o `null` si no se alcanza. */
const camino = (origen, destino) => {
  const pendientes = [[origen]];
  const vistos = new Set([origen]);
  while (pendientes.length > 0) {
    const ruta = pendientes.shift();
    for (const vecino of importsDe(ruta[ruta.length - 1])) {
      if (vecino === destino) return [...ruta, vecino];
      if (vistos.has(vecino)) continue;
      vistos.add(vecino);
      pendientes.push([...ruta, vecino]);
    }
  }
  return null;
};

// Los dos extremos se nombran por STRING, y `camino()` devuelve `null` tanto cuando
// el destino no se alcanza como cuando el destino NO EXISTE. Sin este chequeo, un
// rename de cualquiera de los dos archivos deja la frontera SIN VERIFICAR y el
// script imprime «fronteras ok» igual: verificado durante la reescritura a inglés,
// con un import prohibido puesto a mano y el guardián en verde.
let inexistentes = 0;
for (const { origen, prohibido } of FRONTERAS) {
  for (const extremo of [origen, prohibido]) {
    if (existsSync(join(SRC, extremo))) continue;
    inexistentes += 1;
    console.error(
      `IR-ERR: la frontera nombra un archivo que no existe — ${extremo}\n` +
        `        sin él la frontera no se verifica y este script mentiría en verde`,
    );
  }
}
if (inexistentes > 0) process.exit(1);

// Y el grafo tiene que tener aristas. El BFS se alimenta de UN regex, y un regex que
// deriva no falla: devuelve cero. Si mañana el formateador pasa las comillas dobles a
// simples, o `verbatimModuleSyntax` deja de exigir la extensión `.js`, `importsDe`
// devuelve `[]` para todo, `camino()` no alcanza nada, y este script imprime
// «fronteras ok (1 verificada)» sin haber verificado nada — verde por no haber
// mirado, que es el modo de falla que el paquete entero trata de no tener. El origen
// de una frontera siempre importa algo; si no importa nada, el que se rompió es el
// lector, no el código.
let ciegas = 0;
for (const { origen } of FRONTERAS) {
  if (importsDe(origen).length > 0) continue;
  ciegas += 1;
  console.error(
    `IR-ERR: ${origen} no le parece importar nada a este guardián\n` +
      "        el regex de importsDe() dejó de reconocer los imports (¿comillas? ¿extensión?):\n" +
      "        el grafo quedó sin aristas y «fronteras ok» no significaría nada",
  );
}
if (ciegas > 0) process.exit(1);

let violaciones = 0;
for (const { origen, prohibido, porque } of FRONTERAS) {
  const ruta = camino(origen, prohibido);
  if (ruta === null) continue;
  violaciones += 1;
  console.error(
    `IR-ERR: frontera violada — ${origen} alcanza ${prohibido}\n` +
      `        camino: ${ruta.join(" → ")}\n` +
      `        porque: ${porque}`,
  );
}

// Los módulos que el BFS quiso abrir y no estaban. Va DESPUÉS de las violaciones a
// propósito: si además hay una frontera rota, lo primero que se lee es la frontera
// rota, que es la noticia grande.
for (const archivo of faltantes) {
  console.error(
    `IR-ERR: import a un módulo que no existe — ${archivo}\n` +
      "        alguien lo importa y en disco no está (¿rename a medio hacer?)\n" +
      "        el BFS lo salteó, así que esta corrida NO acredita la frontera",
  );
}

if (violaciones > 0 || faltantes.size > 0) process.exit(1);
console.log(
  `fronteras ok (${FRONTERAS.length} verificada${FRONTERAS.length === 1 ? "" : "s"}; ` +
    "la cadena de `lint` nombra a todos los guardianes y `build` no encadena el corredor de mutación)",
);
