/**
 * Las propiedades de la proyección que ningún tipo puede expresar. Cero dependencias.
 *
 * `project` es la única tokenización del sistema: de ella salen la HUELLA (la
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
 * corriendo esto contra la versión anterior. Ver `tokensOfSchema` y `END_OF_ROW` en
 * `projection.ts` para el porqué de cada uno.
 *
 * TRES BLOQUES, Y EL TERCERO NO ES DECORATIVO. Los casos de DISTINTOS e IGUALES
 * comparan cuerpos ENTRE SÍ, así que son ciegos por construcción a cualquier cambio
 * que mueva a TODOS a la vez: renombrar un valor de `TokenKind` cambia toda huella
 * del corpus y estos casos siguen pasando. Verificado sobre el prototipo del bloque
 * 3 —`"word"` → `"wrd"` pasaba `tsc` y los cinco guardianes en verde—, y es
 * exactamente el cambio que ese bloque hizo doce veces al traducir el vocabulario.
 * Por eso existe la TABLA DE PREIMÁGENES CANÓNICAS: una preimagen fijada por forma,
 * las seis, atada al contrato igual que `ROLES.length === 15`. No es un umbral
 * inventado: es un hecho que se vuelve un ACTO VISIBLE si alguien lo mueve.
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
const salida = mkdtempSync(join(tmpdir(), "ir-projection-"));

try {
  execFileSync(
    join(RAIZ, "node_modules", ".bin", "tsc"),
    ["--outDir", salida, "--noEmit", "false", "--declaration", "false"],
    { cwd: RAIZ, stdio: "inherit" },
  );

  const { preimageOfFingerprint, render, similarity } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );

  const celda = (text) => ({ text, type: null });
  const grid = (headers, rows, grain = "whole") => ({
    shape: "grid",
    headers,
    rows,
    grain,
  });
  const container = (schema, ordered = true) => ({
    shape: "container",
    ordered,
    schema,
  });
  const texto = (text) => ({ shape: "text_span", text, marks: [] });
  const verbatim = (text) => ({ shape: "verbatim", text });
  const activo = (object, window) => ({ shape: "asset", ref: { object, window } });
  const campos = (pairs) => ({ shape: "fields", pairs });

  /** Cuerpos que TIENEN que tener preimágenes distintas entre sí. */
  const DISTINTOS = [
    {
      nombre: "nodo-fila (esquema heredado) vs región sin encabezado",
      porqué:
        "colapsaban por `encabezados ?? []`; una planilla de 50 000 filas depende de esta distinción",
      cuerpos: [grid(null, [[celda("x"), celda("y")]], "row"), grid([], [[celda("x"), celda("y")]])],
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
      // El fixture se reancló en el bloque 3, junto con la traducción del marcador.
      // Con el marcador en `inherited`, un encabezado literal `"heredado"` deja de
      // ser adversario: el caso seguiría PASANDO y ya no probaría lo que dice, que
      // es el modo de falla peor —una fila que cuenta como cobertura y no cubre.
      nombre: 'un encabezado que se llama literalmente "inherited" vs esquema heredado',
      porqué:
        "es la razón por la que el marcador va en clase propia (`schemaState`) y no como un valor más de `schema`",
      cuerpos: [grid(["inherited"], [[celda("x")]]), grid(null, [[celda("x")]])],
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
    {
      // H-1. El guardián no tenía UN SOLO caso de `verbatim`, así que reponer el bug
      // original —tokenizar por palabra en vez de por línea— pasaba en verde.
      nombre: "verbatim: los espacios son significativos",
      porqué:
        "es la única distinción que justifica que `text_span` y `verbatim` sean dos formas (§{Tramo 3 › Qué sale}); tokenizar `verbatim` por palabra reintroduce el bug de la primera versión del archivo, y con él reindentar un bloque de código no mueve su id y dos snippets distintos colisionan",
      cuerpos: [verbatim("a b"), verbatim("a  b"), verbatim("a\nb")],
    },
    {
      // H-5. `asset` no tenía cobertura, y es la forma cuya huella el plan casi deja
      // como «la referencia al objeto» a secas.
      nombre: "tres ventanas del MISMO objeto",
      porqué:
        "con la referencia sola, y por la precondición que obliga a referenciar el original (§{Dónde frena}), dos regiones distintas de la misma página comparten `ObjectRef`, hashean idénticas y NINGUNA ancla",
      cuerpos: [
        activo("k", { scope: "whole" }),
        activo("k", { scope: "range", start: 0, end: 10 }),
        activo("k", {
          scope: "region",
          box: { frame: "p1", x: 0, y: 0, width: 500, height: 500, z: 0 },
        }),
      ],
    },
    {
      // H-5. `fields` tampoco tenía cobertura: si etiqueta y valor compartieran clase
      // de token, un par invertido daría la misma preimagen.
      nombre: "fields con etiqueta y valor intercambiados",
      porqué:
        "`label` y `value` son clases de token DISTINTAS justamente para esto; con una sola clase, «Total: 100» y «100: Total» son el mismo nodo",
      cuerpos: [
        campos([{ label: "a", value: "b" }]),
        campos([{ label: "b", value: "a" }]),
      ],
    },
  ];

  /** Cuerpos que TIENEN que dar la misma preimagen. Sin esto, nada anclaría nunca. */
  const IGUALES = [
    {
      nombre: "dos cuerpos idénticos",
      cuerpos: [grid(["A"], [[celda("x")]]), grid(["A"], [[celda("x")]])],
    },
    {
      // El PAR de H-1: sin este caso, «arreglar» verbatim colapsando TODO el espacio
      // en las dos formas tampoco se vería, y la asimetría es la propiedad entera.
      nombre: "text_span SÍ colapsa el espacio horizontal",
      cuerpos: [texto("a b"), texto("a  b")],
    },
    {
      // H-2. El guardián no tenía un solo caso de normalización, así que borrar el
      // `.normalize("NFC")` —que el propio archivo llama «PARTE DE LA DEFINICIÓN de
      // la huella»— pasaba limpio.
      nombre: "NFC: el mismo texto compuesto y descompuesto",
      // Escritos con ESCAPES y no con la tilde tipeada: los dos son «café» en
      // pantalla y el punto es que en DISCO sean bytes distintos. Un editor que
      // normalice el archivo al guardar volvería este caso vacuo sin que se note.
      cuerpos: [texto("caf\u00e9"), texto("cafe\u0301")],
    },
    {
      nombre: "CRLF y LF son la misma línea en verbatim",
      cuerpos: [verbatim("a\r\nb"), verbatim("a\nb")],
    },
  ];

  /**
   * Una preimagen FIJADA por forma, las seis. Lo único del guardián que mira la
   * codificación en vez de compararla consigo misma.
   *
   * Cómo se lee: `encodeParts` prefija cada componente con su longitud (`len:valor`)
   * y `encode` serializa el par `[kind, text]` de cada token. O sea que estos strings
   * llevan LOS NOMBRES DE LAS CLASES DE TOKEN adentro, que es exactamente lo que se
   * quiere atar: cambiar `"word"` mueve la primera fila y nada más lo notaría.
   */
  const CANÓNICAS = [
    {
      nombre: "text_span",
      cuerpo: texto("a b"),
      preimagen: "5:shape9:text_span4:word1:a4:word1:b",
    },
    {
      nombre: "verbatim",
      cuerpo: verbatim("a\nb"),
      preimagen: "5:shape8:verbatim4:line1:a4:line1:b",
    },
    {
      nombre: "asset",
      cuerpo: activo("k", { scope: "whole" }),
      preimagen: "5:shape5:asset6:object1:k6:window7:5:whole",
    },
    {
      nombre: "grid",
      cuerpo: grid(null, [[celda("x")]], "row"),
      preimagen: "5:shape4:grid11:schemaState9:inherited4:cell1:x3:row0:",
    },
    {
      nombre: "fields",
      cuerpo: campos([{ label: "a", value: "b" }]),
      preimagen: "5:shape6:fields5:label1:a5:value1:b",
    },
    {
      nombre: "container",
      cuerpo: container(null, true),
      preimagen: "5:shape9:container7:ordered4:true11:schemaState9:inherited",
    },
  ];

  let fallas = 0;
  const fallar = (msg) => {
    console.error(`IR-ERR: ${msg}`);
    fallas += 1;
  };

  for (const caso of DISTINTOS) {
    const huellas = new Set(caso.cuerpos.map(preimageOfFingerprint));
    if (huellas.size !== caso.cuerpos.length) {
      fallar(
        `colisión de huella — ${caso.nombre}\n` +
          `        ${caso.cuerpos.length} cuerpos distintos → ${huellas.size} preimagen(es)\n` +
          `        importa porque: ${caso.porqué}`,
      );
    }
  }

  for (const caso of IGUALES) {
    const huellas = new Set(caso.cuerpos.map(preimageOfFingerprint));
    if (huellas.size !== 1) fallar(`deberían tener la misma huella — ${caso.nombre}`);
    if (similarity(caso.cuerpos[0], caso.cuerpos[1]) !== 1) {
      fallar(`similitud de cuerpos idénticos ≠ 1 — ${caso.nombre}`);
    }
  }

  // El contador sale del LOOP y no de `CANÓNICAS.length` a propósito. Al escribir
  // esta tabla la primera vez, el loop no se insertó y el script imprimió
  // «6 preimágenes canónicas» sin haber comparado ninguna — un contador de cosas que
  // nunca miró, que es el modo de falla exacto que este paquete existe para no
  // tener. Lo destapó un mutante (M39 decía NO ROMPIÓ), no una lectura. Con el
  // contador acá adentro, el número que se imprime no puede mentir.
  let comparadas = 0;
  for (const caso of CANÓNICAS) {
    const obtenida = preimageOfFingerprint(caso.cuerpo);
    comparadas += 1;
    if (obtenida !== caso.preimagen) {
      fallar(
        `la preimagen canónica de ${caso.nombre} cambió\n` +
          `        esperada: ${caso.preimagen}\n` +
          `        obtenida: ${obtenida}\n` +
          "        importa porque: la preimagen es la ENTRADA del sha256 que da la identidad de\n" +
          "        cada nodo, así que esto reescribe el ContentHash de TODO el corpus y la primera\n" +
          "        re-ingesta posterior no ancla nada. Si el cambio es deliberado, actualizar esta\n" +
          "        tabla es el acto que lo vuelve visible en el diff — y hay que tratarlo como H16",
      );
    }
  }
  if (comparadas !== CANÓNICAS.length) {
    fallar(
      `el loop de canónicas comparó ${comparadas} de ${CANÓNICAS.length}\n` +
        "        un contador que no coincide con la tabla es una tabla que no se está mirando",
    );
  }

  // `render`: un esquema vacío no es una línea de encabezado vacía.
  const conEsquemaVacío = render(grid([], [[celda("x"), celda("y")]]), ["A", "B"]);
  if (conEsquemaVacío.startsWith("\n")) {
    fallar(
      "render — `headers: []` produjo una primera línea VACÍA\n" +
        `        obtenido: ${JSON.stringify(conEsquemaVacío)}\n` +
        "        importa porque: ese texto va al embedding, y la línea en blanco es el mecanismo que hace renderizable una fila sola",
    );
  }
  const heredando = render(grid(null, [[celda("x"), celda("y")]]), ["A", "B"]);
  if (!heredando.startsWith("A\tB\n")) {
    fallar(`render — \`null\` no heredó el esquema del container: ${JSON.stringify(heredando)}`);
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `proyección ok (${DISTINTOS.length} casos de discriminación, ${IGUALES.length} de igualdad, ` +
      `${comparadas} preimágenes canónicas, 2 de renderizado)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
