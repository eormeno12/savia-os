/**
 * EL GUARDIAN DE FRONTERAS, al estilo de `packages/ir/scripts/boundaries.mjs`.
 *
 * **Los datos no importan nada, y eso es la propiedad entera.** Si `tokens.ts` gana un
 * import de Chakra, «los valores salen sin ese runtime» deja de ser cierto — y esa frase
 * es lo que justifico elegir Tauri para el agente de carpeta: el borrador dice que si los
 * valores no salieran sin Chakra, «el webview costaria igual que lo nativo y no compraria
 * nada».
 *
 * Sin este guardian la propiedad se sostiene en que nadie escriba un import por
 * costumbre, y un import de mas no rompe nada visible: la landing sigue andando y el
 * agente se entera el dia que alguien intente construirlo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Los tres que forman el contrato. `index.ts` y las recipes NO estan: son el adaptador. */
const SIN_DEPENDENCIAS = ["tokens.ts", "semantic-tokens.ts", "data.ts", "css.ts"];

/** `data.ts` reexporta a sus dos hermanos; ningun otro relativo esta permitido. */
const RELATIVOS_PERMITIDOS = new Set(["./tokens", "./semantic-tokens"]);

let fallas = 0;
for (const archivo of SIN_DEPENDENCIAS) {
  const src = readFileSync(join(SRC, archivo), "utf8");
  const imports = [...src.matchAll(/^\s*(?:import|export)\s.*?from\s+["']([^"']+)["']/gm)].map(
    (m) => m[1],
  );
  for (const especificador of imports) {
    const relativo = especificador.startsWith(".");
    if (relativo && RELATIVOS_PERMITIDOS.has(especificador)) continue;
    console.error(
      `BOUNDARIES-ERR: src/${archivo} importa \`${especificador}\`.\n` +
        `                Los datos no dependen de nada: son el contrato, y el adaptador de\n` +
        `                Chakra (src/index.ts) y el emisor de CSS son sus consumidores.\n` +
        `                Un import acá vuelve falsa la frase que justifico el webview del\n` +
        `                agente — que los valores salen sin el runtime de Chakra.`,
    );
    fallas += 1;
  }
  // Ni globals de node ni `require`: el emisor de CSS los va a importar desde un script,
  // pero tambien los va a importar un bundler de navegador.
  for (const prohibido of ["process.", "require(", "__dirname", "node:"]) {
    if (src.includes(prohibido)) {
      console.error(`BOUNDARIES-ERR: src/${archivo} usa \`${prohibido}\`, que no existe en todos sus consumidores.`);
      fallas += 1;
    }
  }
}

if (fallas > 0) process.exit(1);
console.log(`boundaries ok — ${SIN_DEPENDENCIAS.join(", ")} sin dependencias`);
