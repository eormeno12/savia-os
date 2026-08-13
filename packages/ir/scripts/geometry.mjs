/**
 * Las dos funciones de `location.ts` que deciden ESTRUCTURA y no se pueden expresar
 * como tipo. Cero dependencias.
 *
 * `boxContains` es la relación de padre de la vía `spatial` (§{1 · Ruta}) y
 * `compareBoxes` es lo que desempata a sus candidatos. Las dos estaban escritas en
 * prosa y no las ejecutaba nadie, y las dos se apagan con una edición de una línea
 * que compila en verde:
 *
 *   · borrar `if (parent.frame !== child.frame) return false` — las cajas de las 40
 *     diapositivas de un `.pptx` pasan a convivir en un plano y a contenerse entre
 *     sí (§{La pista});
 *   · invertir el signo del área — la cascada elige como padre al ancestro más
 *     grande en vez del más chico.
 *
 * Ninguno de los dos falla ruidoso. Degradan como una colisión de huella: el nodo
 * cuelga del padre equivocado, nada se pone rojo, y la curación del cliente se
 * despega en silencio. Es el mismo modo de falla por el que existe
 * `scripts/projection.mjs`, y por eso este guardián se escribe igual: casos con un
 * «porqué» al lado, para que el que los lea sepa qué se pierde si los borra.
 *
 * TODO CASO DE ORDEN VERIFICA TAMBIÉN ANTISIMETRÍA — `sign(cmp(a,b)) === -sign(cmp(b,a))`
 * —, incluido el caso en que el comparador devuelve 0. Que devuelva 0 para dos cajas
 * idénticas NO es un defecto: el `PROVISIONAL(H11)` lo declara y obliga al llamador a
 * desempatar con `LocalLocation.anchor`. Verificar que sigue sin ser total es
 * verificar que esa obligación sigue existiendo (§{Puntos}).
 *
 * Compila el paquete a un directorio temporal porque node no resuelve los imports
 * `.js` del código fuente a los `.ts` de disco.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const salida = mkdtempSync(join(tmpdir(), "ir-geometry-"));

try {
  execFileSync(
    join(RAIZ, "node_modules", ".bin", "tsc"),
    ["--outDir", salida, "--noEmit", "false", "--declaration", "false"],
    { cwd: RAIZ, stdio: "inherit" },
  );

  const { boxContains, compareBoxes } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );

  /** Una caja en milésimas del marco. `z` es inerte: ninguna de las dos lo lee. */
  const caja = (frame, x, y, width, height) => ({ frame, x, y, width, height, z: null });

  const PAGINA = caja("p1", 0, 0, 1000, 1000);

  /** `[nombre, padre, hijo, esperado, porqué]` */
  const CONTENCIÓN = [
    [
      "una caja adentro de la página",
      PAGINA,
      caja("p1", 100, 100, 200, 200),
      true,
      "si el caso feliz fallara, la vía espacial no colgaría NADA y el árbol quedaría plano",
    ],
    [
      "MARCOS DISTINTOS no se contienen, aunque la geometría encaje",
      PAGINA,
      caja("p2", 100, 100, 200, 200),
      false,
      "sin el marco, las cajas de las 40 diapositivas de un .pptx conviven en un plano y se contienen entre sí",
    ],
    [
      "desbordar por UN entero ya no es contención",
      PAGINA,
      caja("p1", 900, 100, 101, 200),
      false,
      "la contención es ESTRICTA y la tolerancia vive en PARAMETERS.geometry.containmentTolerance, hoy 0",
    ],
    [
      "una caja se contiene a sí misma",
      PAGINA,
      PAGINA,
      true,
      "los bordes cuentan: con `>` en vez de `>=` una región que cubre su marco entero dejaría de anclar",
    ],
    [
      "y la contención NO es simétrica",
      caja("p1", 100, 100, 200, 200),
      PAGINA,
      false,
      "si lo fuera, padre e hijo serían intercambiables y la cascada podría invertir el árbol",
    ],
  ];

  /** `[nombre, a, b, signoEsperado, porqué]` — `a` va antes que `b` si el signo es -1. */
  const ORDEN = [
    [
      "área ascendente manda",
      caja("p1", 0, 0, 10, 10),
      PAGINA,
      -1,
      "el padre por vía espacial es el ancestro MÁS CHICO que contiene; invertido, todo cuelga de la raíz",
    ],
    [
      "a igual área desempata `y`",
      caja("p1", 500, 100, 100, 100),
      caja("p1", 0, 200, 100, 100),
      -1,
      "arriba antes que abajo: es el orden de lectura, y de él sale el orden de la cola del emisor",
    ],
    [
      "a igual área y misma `y` desempata `x`",
      caja("p1", 100, 100, 100, 100),
      caja("p1", 500, 100, 100, 100),
      -1,
      "izquierda antes que derecha, por lo mismo",
    ],
    [
      "dos cajas idénticas dan 0 — el orden NO es total",
      caja("p1", 100, 100, 100, 100),
      caja("p1", 100, 100, 100, 100),
      0,
      "está declarado en PROVISIONAL(H11): el llamador DEBE desempatar con el ancla. Si esto pasara a ±1, alguien habría inventado un criterio en silencio",
    ],
  ];

  let fallas = 0;
  const fallar = (msg) => {
    console.error(`IR-ERR: ${msg}`);
    fallas += 1;
  };

  for (const [nombre, padre, hijo, esperado, porqué] of CONTENCIÓN) {
    const obtenido = boxContains(padre, hijo);
    if (obtenido === esperado) continue;
    fallar(
      `boxContains — ${nombre}\n` +
        `        esperaba ${esperado}, obtuvo ${obtenido}\n` +
        `        importa porque: ${porqué}`,
    );
  }

  const signo = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);

  for (const [nombre, a, b, esperado, porqué] of ORDEN) {
    const obtenido = signo(compareBoxes(a, b));
    if (obtenido !== esperado) {
      fallar(
        `compareBoxes — ${nombre}\n` +
          `        esperaba signo ${esperado}, obtuvo ${obtenido}\n` +
          `        importa porque: ${porqué}`,
      );
    }
    const inverso = signo(compareBoxes(b, a));
    if (inverso !== -obtenido) {
      fallar(
        `compareBoxes — ANTISIMETRÍA rota en «${nombre}»\n` +
          `        cmp(a,b) = ${obtenido} y cmp(b,a) = ${inverso}\n` +
          `        importa porque: un comparador no antisimétrico da un orden que depende de cómo llegó el arreglo, y §{Estrategia} pide salida determinística`,
      );
    }
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `geometría ok (${CONTENCIÓN.length} casos de contención, ${ORDEN.length} de orden)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
