// ────────────────────────────────────────────────────────────────────────────
// LOS TOKENS, COPIADOS ADENTRO DE `panel/` — y por que no es un `@import` relativo.
//
// El `panel/` es el `frontendDist` de Tauri: adentro de la app empaquetada, la unica
// raiz que existe es esa carpeta. Un `@import url("../../../packages/...")` resuelve
// perfecto sirviendo el repo con un `http.server` y **404 adentro de la app**, que es
// justamente el modo de fallar que no se ve hasta el empaquetado.
//
// Asi que se copia. Y una copia sin guardian es una divergencia esperando: este script
// **verifica por omision y solo copia con `COPIAR=si`**, igual que el emisor de
// `design-tokens`. Si alguien cambia un token y no re-copia, `pnpm lint` se pone rojo
// nombrando la linea.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aca = dirname(fileURLToPath(import.meta.url));
const fuente = join(aca, "../../../packages/design-tokens/css/tokens.css");
const destino = join(aca, "../panel/tokens.css");

const CABECERA = `/* GENERADO — no se edita a mano.
 * Copia de packages/design-tokens/css/tokens.css, que a su vez lo emite
 * packages/design-tokens/scripts/emitir.mjs desde los datos.
 *
 * Vive acá porque \`panel/\` es el \`frontendDist\` de Tauri y adentro de la app
 * empaquetada no existe nada por encima de esta carpeta.
 *
 * Para re-copiar:  COPIAR=si node scripts/tokens.mjs
 */
`;

const esperado = CABECERA + readFileSync(fuente, "utf8");

if (process.env.COPIAR === "si") {
  writeFileSync(destino, esperado);
  console.log(`tokens copiados: ${destino}`);
  process.exit(0);
}

let actual;
try {
  actual = readFileSync(destino, "utf8");
} catch {
  console.error(
    `TOKENS-ERR: falta ${destino}. Para crearlo: COPIAR=si node scripts/tokens.mjs`,
  );
  process.exit(1);
}

if (actual !== esperado) {
  const a = actual.split("\n");
  const b = esperado.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error(
        `TOKENS-ERR: la copia de la bandeja quedo vieja.\n` +
          `  linea ${i + 1}\n` +
          `    en la bandeja: ${a[i] ?? "(no existe)"}\n` +
          `    en el sistema: ${b[i] ?? "(no existe)"}\n\n` +
          `  La bandeja estaria mostrando un valor que el sistema de diseno ya no tiene.\n` +
          `  Para re-copiar: COPIAR=si node scripts/tokens.mjs`,
      );
      process.exit(1);
    }
  }
}
console.log(`tokens ok     — la copia de la bandeja coincide con el sistema`);
