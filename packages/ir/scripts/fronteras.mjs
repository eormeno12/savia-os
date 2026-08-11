/**
 * Las fronteras del grafo de módulos. Cero dependencias.
 *
 * Hay invariantes que no se expresan como tipo pero sí como ALCANCE: si un módulo
 * no puede nombrar un tipo, no puede contenerlo. Esta es la técnica que el plan ya
 * nombra en la regla R1 («la frontera de formato la impone el grafo de paquetes»),
 * aplicada acá a la frontera de nodos.
 *
 *   `formas.ts` no puede alcanzar `salidas.ts`.
 *
 * Por qué eso ES el invariante «ningún payload anida un nodo»
 * (§{Tramo 3 › Qué sale}): lo que vuelve `Nodo` a un `Nodo` es `MARCA_NODAL`, que
 * vive solo en `salidas.ts`. Sin
 * alcanzarlo, un nodo dentro de un `Cuerpo` es inexpresable — no hace falta
 * detectarlo. Y la dirección natural del grafo ya es la contraria (`salidas.ts`
 * importa `formas.ts`), así que violar la frontera exige introducir un CICLO.
 *
 * Reemplaza a un detector recursivo de ~50 líneas que estuvo roto desde que se
 * escribió: no veía el anidamiento a través de un campo opcional, de una unión con
 * `null`, de `(Nodo | null)[]`, de `Nodo | string`, ni más allá de 6 niveles —
 * donde además respondía «limpio». Esto se prueba agregando el import y mirando
 * fallar el comando; aquello no se podía probar leyéndolo.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** `origen` no puede alcanzar `prohibido`, ni directa ni transitivamente. */
const FRONTERAS = [
  {
    origen: "formas.ts",
    prohibido: "salidas.ts",
    porque:
      "un Cuerpo que alcanza a Nodo puede anidarlo, y el árbol deja de ser plano (§{Tramo 3 › Qué sale})",
  },
];

const importsDe = (archivo) => {
  const código = readFileSync(join(SRC, archivo), "utf8");
  const rutas = [...código.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1]);
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

if (violaciones > 0) process.exit(1);
console.log(`fronteras ok (${FRONTERAS.length} verificada${FRONTERAS.length === 1 ? "" : "s"})`);
