/**
 * EL GOLDEN DEL SISTEMA. La foto de lo que Chakra resuelve HOY con nuestros tokens.
 *
 * # Por que existe
 *
 * Los tokens van a dejar de vivir en la forma de Chakra para volverse datos planos que
 * Chakra CONSUME, igual que el agente de carpeta. Es la forma que el repo ya usa en el
 * pipeline —`ir` se congela primero, sin deps, y los demas lo implementan— y le devuelve
 * la autoridad de los valores a este paquete: hoy una actualizacion de Chakra puede mover
 * un color y nadie se entera.
 *
 * Esa mudanza tiene que dejar el sistema **identico**, porque `apps/landing` depende de
 * el. Este archivo es lo que lo verifica: se toma ANTES de mover nada y cualquier valor
 * que se corra aparece con nombre y apellido.
 *
 * # Que fotografia, y que NO
 *
 * Solo **nuestros** tokens —los de `tokens.ts` y `semantic-tokens.ts`— resueltos por el
 * sistema de verdad. Chakra aporta 798 tokens contando sus defaults; fotografiarlos todos
 * daria rojo en cada parche de Chakra por cosas que no usamos, y un golden que se pone
 * rojo por ruido es un golden que la gente regenera sin leer.
 *
 * La excepcion son las referencias que salen de nuestro conjunto: se resuelven igual y por
 * eso aparecen resueltas. `{colors.white}` es hoy la unica, y viene de `defaultConfig` —
 * si Chakra le cambia el valor, esto lo dice.
 *
 * # Para regenerarlo A PROPOSITO
 *
 *     GOLDEN=reescribir node scripts/golden.mjs
 *
 * Que sea explicito no es ceremonia: si al ponerse rojo la reaccion es regenerar, el
 * archivo dice que si a todo y no protege nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const GOLDEN = join(RAIZ, "golden", "sistema-chakra.json");

const { system } = await import(join(RAIZ, "src/index.ts"));
const { tokens } = await import(join(RAIZ, "src/tokens.ts"));
const { semanticTokens } = await import(join(RAIZ, "src/semantic-tokens.ts"));
const { textStyles } = await import(join(RAIZ, "src/text-styles.ts"));

/**
 * Camina un arbol de tokens y devuelve los nombres punteados de sus hojas.
 *
 * `DEFAULT` es la sintaxis de Chakra para «el token base del grupo» y se APLANA: el
 * nombre de `bg.DEFAULT` es `bg`. Esa regla hay que dejarla escrita porque es una de las
 * pocas cosas genuinamente de Chakra que hay en estos archivos, y quien escriba el emisor
 * de CSS la va a necesitar igual.
 */
function nombres(arbol, prefijo = []) {
  const salida = [];
  for (const [clave, valor] of Object.entries(arbol)) {
    if (valor && typeof valor === "object" && "value" in valor) {
      salida.push([...prefijo, clave].filter((k) => k !== "DEFAULT").join("."));
      continue;
    }
    if (valor && typeof valor === "object") {
      salida.push(...nombres(valor, [...prefijo, clave]));
    }
  }
  return salida;
}

const foto = (arbol) => {
  const out = {};
  for (const nombre of nombres(arbol).sort()) {
    const t = system.tokens.getByName(nombre);
    out[nombre] = t
      ? {
          valor: t.value,
          origen: t.originalValue,
          var: t.extensions?.cssVar?.var ?? null,
        }
      : { AUSENTE: "el sistema no conoce este token" };
  }
  return out;
};

const actual =
  JSON.stringify(
    {
      nota: "Generado por scripts/golden.mjs. No se edita a mano.",
      crudos: foto(tokens),
      semanticos: foto(semanticTokens),
      textStyles,
      recipes: Object.fromEntries(
        ["card", "input", "marketingButton"].map((r) => [r, system.getRecipe(r) ?? null]),
      ),
      globalCss: system.getGlobalCss(),
    },
    null,
    2,
  ) + "\n";

if (process.env.GOLDEN === "reescribir") {
  writeFileSync(GOLDEN, actual);
  console.log(`golden reescrito: ${GOLDEN}`);
  process.exit(0);
}

let esperado;
try {
  esperado = readFileSync(GOLDEN, "utf8");
} catch {
  console.error(
    `GOLDEN-ERR: no existe ${GOLDEN}.\n` +
      `            Para crearlo: GOLDEN=reescribir node scripts/golden.mjs`,
  );
  process.exit(1);
}

if (actual === esperado) {
  const n = Object.keys(JSON.parse(actual).crudos).length;
  const m = Object.keys(JSON.parse(actual).semanticos).length;
  console.log(`golden ok — ${n} crudos y ${m} semanticos resueltos igual que la foto`);
  process.exit(0);
}

// EL DIFF, y hasta 12 lineas: un golden que solo dice «cambio» obliga a regenerarlo para
// ver que paso, que es exactamente el habito que lo vuelve inutil.
const a = actual.split("\n");
const b = esperado.split("\n");
const difs = [];
for (let i = 0; i < Math.max(a.length, b.length) && difs.length < 12; i += 1) {
  if (a[i] !== b[i]) difs.push(`  linea ${i + 1}\n    esperado: ${b[i] ?? "(nada)"}\n    actual:   ${a[i] ?? "(nada)"}`);
}
console.error(
  "GOLDEN-ERR: EL SISTEMA DE CHAKRA CAMBIO.\n" +
    "            `apps/landing` se ve con estos valores, asi que un cambio que no pediste\n" +
    "            le cambia el aspecto sin que nadie lo note. Si es a proposito, revisalo y\n" +
    "            recien despues: GOLDEN=reescribir node scripts/golden.mjs\n\n" +
    difs.join("\n"),
);
process.exit(1);
