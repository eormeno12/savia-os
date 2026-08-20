/**
 * EMITE `css/tokens.css`, Y EL ARCHIVO EMITIDO ES SU PROPIO GOLDEN.
 *
 * Se commitea a propósito: lo consume un binario de Rust que no va a correr Node en su
 * build, así que el artefacto tiene que existir en el repo. Y como está commiteado, un
 * cambio de token muestra su efecto en CSS dentro del mismo diff — que es justo lo que
 * hace falta para revisarlo.
 *
 * Por eso este script no solo escribe: **compara**. Si lo emitido no es lo commiteado,
 * falla. Para regenerar a propósito:
 *
 *     EMITIR=si node scripts/emitir.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "css", "tokens.css");

const { tokens } = await import(join(RAIZ, "src/tokens.ts"));
const { semanticTokens } = await import(join(RAIZ, "src/semantic-tokens.ts"));
const { aCss, verificarReferencias } = await import(join(RAIZ, "src/css.ts"));

// PRIMERO LAS COLGANTES, porque una referencia rota no rompe el CSS: sale como
// `var(--x)` y el navegador la deja vacia. Un panel sin fondo, en silencio.
const colgantes = verificarReferencias(tokens, semanticTokens);
if (colgantes.length > 0) {
  console.error("EMITIR-ERR: hay referencias que no apuntan a ningun token emitido.");
  console.error("            En CSS eso no falla: la variable queda vacia y el color");
  console.error("            desaparece sin que nada avise.\n");
  for (const c of colgantes) console.error(`  ${c.desde}  →  ${c.a}  (no existe)`);
  process.exit(1);
}

const actual = aCss(tokens, semanticTokens);

// **CERO CHAKRA, Y ES LA PROPIEDAD ENTERA DEL ARTEFACTO.** Si un nombre de variable
// dijera `chakra`, el agente estaria cargando nombres de un runtime que no tiene.
//
// SE MIRAN LAS DECLARACIONES Y NO LOS COMENTARIOS, y lo aprendio fallando: la primera
// corrida se disparo con la cabecera de este mismo archivo, que explica por que el prefijo
// NO dice `chakra`. Es el mismo caso que `sin_comentarios()` en los guardianes del agente
// de carpeta — un guardian que busca algo no se puede disparar con la prosa que lo
// menciona, y la salida es sacar los comentarios, nunca censurar la prosa.
const declaraciones = actual.replace(/\/\*[\s\S]*?\*\//g, "");
if (/chakra/i.test(declaraciones)) {
  console.error("EMITIR-ERR: una declaracion del CSS emitido menciona `chakra`.");
  console.error("            El agente no lo tiene adentro: ese nombre no significa nada ahi.");
  process.exit(1);
}

// ^ VA ANTES DE LA BIFURCACION, y lo aprendio fallando: estaba despues, o sea que
// `EMITIR=si` escribia y salia sin pasar por aca. El guardian era inalcanzable
// exactamente en el camino que ESCRIBE el archivo — el unico donde puede entrar algo
// malo. Un control que solo corre cuando ya no hay nada que controlar no controla nada.


if (process.env.EMITIR === "si") {
  writeFileSync(DESTINO, actual);
  console.log(`emitido: ${DESTINO}`);
  process.exit(0);
}

let esperado;
try {
  esperado = readFileSync(DESTINO, "utf8");
} catch {
  console.error(`EMITIR-ERR: no existe ${DESTINO}. Para crearlo: EMITIR=si node scripts/emitir.mjs`);
  process.exit(1);
}

if (actual !== esperado) {
  const a = actual.split("\n");
  const b = esperado.split("\n");
  const difs = [];
  for (let i = 0; i < Math.max(a.length, b.length) && difs.length < 10; i += 1) {
    if (a[i] !== b[i]) difs.push(`  linea ${i + 1}\n    commiteado: ${b[i] ?? "(nada)"}\n    emitido:    ${a[i] ?? "(nada)"}`);
  }
  console.error(
    "EMITIR-ERR: `css/tokens.css` no es lo que emiten los tokens de hoy.\n" +
      "            Lo consume el agente de carpeta, asi que quedaria con valores viejos.\n" +
      "            Si el cambio es a proposito: EMITIR=si node scripts/emitir.mjs\n\n" +
      difs.join("\n"),
  );
  process.exit(1);
}

const n = (actual.match(/^\s+--savia-/gm) ?? []).length;
console.log(`emisor ok — ${n} variables, sin una linea de JavaScript`);
