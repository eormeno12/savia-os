/**
 * Las propiedades de la proyección que ningún tipo puede expresar. Cero dependencias.
 *
 * `proyectar` es la única tokenización del sistema: de ella salen la HUELLA (la
 * identidad de un nodo) y la SIMILITUD (los pases 2 y 3 del reconciliador). Su
 * propiedad central es de COMPORTAMIENTO, no de tipos:
 *
 *     cuerpos distintos  ⟹  preimágenes distintas
 *
 * Y romperla no se ve. Dos nodos distintos con la misma huella no fallan: por la regla
 * de unicidad del pase 1 —un hash repetido no ancla— simplemente NINGUNO de los dos
 * ancla, los dos reciben ids nuevos, y la curación del cliente se despega en silencio.
 *
 * Los casos de abajo no son hipotéticos: los cinco primeros FALLABAN, y se verificaron
 * corriendo esto contra la versión anterior. Ver `tokensDeEsquema` y `FIN_DE_FILA` en
 * `proyeccion.ts` para el porqué de cada uno.
 *
 * Compila el paquete a un directorio temporal porque node no resuelve los imports
 * `.js` del código fuente a los `.ts` de disco.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const salida = mkdtempSync(join(tmpdir(), "ir-proyeccion-"));

try {
  execFileSync(
    join(RAIZ, "node_modules", ".bin", "tsc"),
    ["--outDir", salida, "--noEmit", "false", "--declaration", "false"],
    { cwd: RAIZ, stdio: "inherit" },
  );

  const { preimagenDeHuella, renderizar, similitud } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );

  const celda = (texto) => ({ texto, tipo: null });
  const grid = (encabezados, filas, grano = "entero") => ({
    forma: "grid",
    encabezados,
    filas,
    grano,
  });
  const container = (esquema, ordenado = true) => ({
    forma: "container",
    ordenado,
    esquema,
  });

  /** Cuerpos que TIENEN que tener preimágenes distintas entre sí. */
  const DISTINTOS = [
    {
      nombre: "nodo-fila (esquema heredado) vs región sin encabezado",
      porqué:
        "colapsaban por `encabezados ?? []`; una planilla de 50 000 filas depende de esta distinción",
      cuerpos: [grid(null, [[celda("x"), celda("y")]], "fila"), grid([], [[celda("x"), celda("y")]])],
    },
    {
      nombre: "container con esquema heredado vs sin esquema",
      porqué: "el mismo `??`, y anulaba el campo que C3 agregó para arreglar C14",
      cuerpos: [container(null), container([])],
    },
    {
      nombre: "tres tablas con las MISMAS celdas y distinta forma",
      porqué:
        "sin frontera de fila, reestructurar una tabla no cambiaba la huella y el cambio era invisible de punta a punta",
      cuerpos: [
        grid(null, [[celda("a"), celda("b")], [celda("c"), celda("d")]]),
        grid(null, [[celda("a"), celda("b"), celda("c"), celda("d")]]),
        grid(null, [[celda("a")], [celda("b")], [celda("c")], [celda("d")]]),
      ],
    },
    {
      nombre: 'un encabezado que se llama literalmente "heredado" vs esquema heredado',
      porqué:
        "es la razón por la que el marcador va en clase propia (`esquemaEstado`) y no como un valor más de `esquema`",
      cuerpos: [grid(["heredado"], [[celda("x")]]), grid(null, [[celda("x")]])],
    },
    {
      nombre: "una fila vacía al final cuenta",
      porqué: "la frontera va DESPUÉS de cada fila, sin caso especial para la última",
      cuerpos: [grid(null, [[celda("a")]]), grid(null, [[celda("a")], []])],
    },
    {
      nombre: "orden de las filas",
      porqué: "el contenido de una tabla incluye en qué orden está",
      cuerpos: [
        grid(null, [[celda("a")], [celda("b")]]),
        grid(null, [[celda("b")], [celda("a")]]),
      ],
    },
  ];

  /** Cuerpos que TIENEN que dar la misma preimagen. Sin esto, nada anclaría nunca. */
  const IGUALES = [
    {
      nombre: "dos cuerpos idénticos",
      cuerpos: [grid(["A"], [[celda("x")]]), grid(["A"], [[celda("x")]])],
    },
  ];

  let fallas = 0;
  const fallar = (msg) => {
    console.error(`IR-ERR: ${msg}`);
    fallas += 1;
  };

  for (const caso of DISTINTOS) {
    const huellas = new Set(caso.cuerpos.map(preimagenDeHuella));
    if (huellas.size !== caso.cuerpos.length) {
      fallar(
        `colisión de huella — ${caso.nombre}\n` +
          `        ${caso.cuerpos.length} cuerpos distintos → ${huellas.size} preimagen(es)\n` +
          `        importa porque: ${caso.porqué}`,
      );
    }
  }

  for (const caso of IGUALES) {
    const huellas = new Set(caso.cuerpos.map(preimagenDeHuella));
    if (huellas.size !== 1) fallar(`deberían tener la misma huella — ${caso.nombre}`);
    if (similitud(caso.cuerpos[0], caso.cuerpos[1]) !== 1) {
      fallar(`similitud de cuerpos idénticos ≠ 1 — ${caso.nombre}`);
    }
  }

  // `renderizar`: un esquema vacío no es una línea de encabezado vacía.
  const conEsquemaVacío = renderizar(grid([], [[celda("x"), celda("y")]]), ["A", "B"]);
  if (conEsquemaVacío.startsWith("\n")) {
    fallar(
      "renderizar — `encabezados: []` produjo una primera línea VACÍA\n" +
        `        obtenido: ${JSON.stringify(conEsquemaVacío)}\n` +
        "        importa porque: ese texto va al embedding, y la línea en blanco es el mecanismo que hace renderizable una fila sola",
    );
  }
  const heredando = renderizar(grid(null, [[celda("x"), celda("y")]]), ["A", "B"]);
  if (!heredando.startsWith("A\tB\n")) {
    fallar(`renderizar — \`null\` no heredó el esquema del container: ${JSON.stringify(heredando)}`);
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `proyección ok (${DISTINTOS.length} casos de discriminación, ${IGUALES.length} de igualdad, 2 de renderizado)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
