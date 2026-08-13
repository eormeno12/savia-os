#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutantes.mjs          las 14 mutaciones, ~16 s
//   node scripts/mutantes.mjs M8       una sola, para iterar
//
// POR QUÉ ESTO ES UN SCRIPT Y NO UNA AUDITORÍA CON AGENTES
//
// La primera versión de esta suite la corrieron nueve subagentes en copias
// aisladas: 776k tokens y veinte minutos, para una foto de un solo momento.
// Aplicar una mutación conocida es determinístico —reemplazar texto, correr un
// comando, mirar la salida—, así que no necesita criterio. Lo que sí lo necesita
// es DESCUBRIR qué mutar y ESCRIBIR el testigo que cierra un hueco; eso lo sigue
// haciendo un humano o un agente, y su resultado se deposita acá como una fila.
//
// El cambio real no es el ahorro: es que la acreditación pasó de ocurrir una vez
// a correr en cada `pnpm lint`. Una garantía que solo se verificó el día que se
// escribió es indistinguible de una que nunca funcionó.
//
// EN SERIE Y EN EL ÁRBOL, a propósito. `tsc --noEmit` tarda 0,18 s y los cinco
// guardianes 0,63 s: paralelizar en copias ahorraría trece segundos y costaría
// gestión de directorios temporales. El árbol se restaura siempre, incluso si
// algo explota, y se comprueba verde al principio Y al final.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

/**
 * Cada fila es una garantía y la forma exacta de romperla.
 *
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer
 *   EXACTAMENTE UNA VEZ. Si aparece cero o dos veces, la mutación se pudrió con
 *   una edición anterior y eso es un ERROR, no un salteo: un mutante obsoleto
 *   que se saltea en silencio es una garantía que dejó de verificarse.
 * - `espera`: lo que la salida tiene que decir. Un regex, no un exit code — que
 *   falle no alcanza, tiene que fallar POR LA RAZÓN correcta.
 * - `control`: no rompe nada y tiene que quedar VERDE. Sin controles, una suite
 *   donde todo falla es indistinguible de una donde el compilador está roto.
 */
const MUTANTES = [
  {
    id: "M1",
    garantía: "SHAPES no admite una forma que Body no tenga",
    cambios: [[
      `  "container",\n] as const satisfies readonly Body["shape"][];`,
      `  "container",\n  "row",\n] as const satisfies readonly Body["shape"][];`,
    ]],
    espera: /TS2322/,
  },
  {
    id: "M2",
    garantía: "a SHAPES no le puede faltar una forma de Body",
    cambios: [[
      `  "fields",\n  "container",\n] as const satisfies`,
      `  "fields",\n] as const satisfies`,
    ]],
    espera: /SHAPES is missing a shape of Body/,
  },
  {
    id: "M4",
    garantía: "el piso físico no puede dar un par rol⇒forma ilegal",
    cambios: [[`  text_span: "paragraph",`, `  text_span: "code",`]],
    espera: /TS2322/,
  },
  {
    id: "M5",
    garantía: "«código siempre solo» — el valor no se puede cambiar",
    cambios: [[`  readonly code: "solo";`, `  readonly code: "normal";`]],
    espera: /TS2322/,
  },
  {
    id: "M6",
    garantía: "«código siempre solo» — el TIPO no se puede ensanchar",
    cambios: [[`  readonly code: "solo";`, `  readonly code: Cohesion;`]],
    espera: /widened past the literal/,
    nota: "pasaba en verde hasta PRUEBAS_DE_COHESIÓN (bloque 1b)",
  },
  {
    id: "M7",
    garantía: "el satisfies rechaza una clave que no es un Role, en su línea",
    cambios: [[`  image: "asset",\n}`, `  image: "asset",\n  codeblock: "verbatim",\n}`]],
    espera: /TS2353|TS2561/,
    nota: "escalón ②: la anotación lo rechaza donde se escribe",
  },
  {
    id: "M8",
    garantía: "y si alguien saca el satisfies, el testigo lo agarra igual",
    cambios: [
      [`  image: "asset",\n}`, `  image: "asset",\n  codeblock: "verbatim",\n}`],
      [`} as const satisfies Partial<Record<Role, Shape>>;`, `} as const;`],
    ],
    espera: /REQUIRED_SHAPE keys are no longer Role/,
    nota: "sacar el satisfies SOLO no rompe nada —las claves siguen siendo roles—; lo que impide es ESCRIBIR una que no lo sea. Sin el testigo, illegalPairs iba de 25 a 0 mudo",
  },
  {
    id: "M14",
    garantía: "el barrido 15×6 recorre el dominio que dice recorrer",
    cambios: [[`  "quote",\n  "list",`, `  "list",`]],
    espera: /ROLES no longer has 15 roles/,
    nota: "pasaba en verde hasta PRUEBAS_DE_DOMINIO (bloque 1b)",
  },
  {
    id: "M9b",
    garantía: "un campo Pending<T> no puede llevar un número inventado",
    cambios: [[
      `    minPrintableProportion: null as Pending<number>,`,
      `    minPrintableProportion: 0.82 as Pending<number>,`,
    ]],
    espera: /Pending<T> field with a value/,
    nota: "la cifra publicada decía 17 y el árbol sano tiene 18: verificar contra ella aprobaba el árbol MUTADO",
  },
  {
    id: "M9c",
    garantía: "el censo publicado en el docstring no se puede desincronizar",
    cambios: [[
      ` * CENSO(numbers.mjs): 29 numéricos = 18 pending en null + 11 con valor`,
      ` * CENSO(numbers.mjs): 28 numéricos = 17 pending en null + 11 con valor`,
    ]],
    espera: /census published by params\.ts does not match/,
    nota: "es exactamente la cifra vieja: escribirla de nuevo tiene que ser imposible",
  },
  {
    id: "M11",
    garantía: "ningún literal numérico de valor fuera de params.ts",
    cambios: [[`export const ROLES = [`, `export const _CAP = 42;\nexport const ROLES = [`]],
    espera: /numeric literal outside params/,
  },
  {
    id: "M12c",
    garantía: "R1 — shapes.ts no puede alcanzar salidas.ts (anidar un nodo)",
    cambios: [[
      `export type Shape = Body["shape"];`,
      // El import tiene que USARSE: si queda huérfano, tsc lo rechaza con TS6133
      // antes de que el guardián de fronteras llegue a correr, y el mutante
      // estaría probando el linter en vez de la frontera.
      `import type { Nodo } from "./salidas.js";\nexport type _Anida = Nodo;\nexport type Shape = Body["shape"];`,
    ]],
    espera: /frontera/i,
  },
  {
    id: "M12d",
    garantía: "el guardián de fronteras avisa si su regex dejó de ver imports",
    cambios: [[
      `import type { ClaveObjeto } from "./identidad.js";`,
      `import type { ClaveObjeto } from './identidad.js';`,
    ]],
    espera: /no le parece importar nada|frontera/i,
    nota: "con comillas simples el grafo quedaba sin aristas y decía «fronteras ok»",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "MC1",
    control: true,
    garantía: "reordenar ROLE_BY_SHAPE sin cambiar ningún par no rompe nada",
    cambios: [[
      `  text_span: "paragraph",\n  verbatim: "code",`,
      `  verbatim: "code",\n  text_span: "paragraph",`,
    ]],
  },
  {
    id: "MC2",
    control: true,
    garantía: "un comentario nuevo no rompe nada",
    cambios: [[
      `export type Shape = Body["shape"];`,
      `// control MC2: comentario inocuo\nexport type Shape = Body["shape"];`,
    ]],
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`, así que no hay que
// mantener la ruta al día por separado.
const ARCHIVOS = ["src/shapes.ts", "src/classification.ts", "src/params.ts"];

const guardianes = () => {
  try {
    const salida = execSync(
      `./node_modules/.bin/tsc --noEmit && node scripts/fronteras.mjs && ` +
        `node scripts/proyeccion.mjs && node scripts/citas.mjs && node scripts/numbers.mjs`,
      { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { verde: true, salida };
  } catch (e) {
    return { verde: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

const ubicar = (buscar) => {
  const encontrados = ARCHIVOS.filter((a) => readFileSync(ruta(a), "utf8").includes(buscar));
  if (encontrados.length !== 1) {
    throw new Error(
      `el texto a mutar aparece en ${encontrados.length} archivos (esperaba 1)` +
        `${encontrados.length ? ": " + encontrados.join(", ") : ""}\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
  return encontrados[0];
};

const soloUno = (texto, buscar, id) => {
  const n = texto.split(buscar).length - 1;
  if (n !== 1) {
    throw new Error(
      `${id}: el texto a mutar aparece ${n} veces (esperaba 1). El mutante se pudrió ` +
        `con una edición anterior — arreglalo, no lo saltees: un mutante obsoleto es ` +
        `una garantía que dejó de verificarse.\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
};

// ── Corrida ──────────────────────────────────────────────────────────────────
const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`IR-ERR: no existe el mutante «${soloEste}»`);
  process.exit(1);
}

const base = guardianes();
if (!base.verde) {
  console.error(
    `IR-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
      base.salida.split("\n").slice(0, 12).map((l) => "  " + l).join("\n"),
  );
  process.exit(1);
}

let fallos = 0;
for (const m of lista) {
  const originales = new Map();
  try {
    for (const [buscar, reemplazar] of m.cambios) {
      const archivo = ubicar(buscar);
      const antes = readFileSync(ruta(archivo), "utf8");
      if (!originales.has(archivo)) originales.set(archivo, antes);
      soloUno(antes, buscar, m.id);
      writeFileSync(ruta(archivo), antes.replace(buscar, reemplazar), "utf8");
    }

    const r = guardianes();
    let ok, detalle;
    if (m.control) {
      ok = r.verde;
      detalle = ok ? "verde, como corresponde" : "ROMPIÓ — el arnés o el compilador están mal";
    } else if (r.verde) {
      ok = false;
      detalle = "NO ROMPIÓ — la garantía se perdió";
    } else if (!m.espera.test(r.salida)) {
      ok = false;
      detalle = `rompió, pero no por la razón esperada (${m.espera})`;
    } else {
      ok = true;
      detalle = "rompió como corresponde";
    }

    console.log(`  ${ok ? "✓" : "✗"} ${m.id.padEnd(6)} ${m.garantía}`);
    if (!ok) {
      fallos++;
      console.log(`         ${detalle}`);
      if (m.nota) console.log(`         nota: ${m.nota}`);
      console.log(r.salida.split("\n").filter(Boolean).slice(0, 4).map((l) => "         │ " + l).join("\n"));
    }
  } catch (e) {
    fallos++;
    console.log(`  ✗ ${m.id.padEnd(6)} ${m.garantía}\n         ${e.message}`);
  } finally {
    // Pase lo que pase, el árbol vuelve. Sin esto un crash deja el repo mutado.
    for (const [archivo, texto] of originales) writeFileSync(ruta(archivo), texto, "utf8");
  }
}

const cierre = guardianes();
if (!cierre.verde) {
  console.error(`\nIR-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nIR-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
