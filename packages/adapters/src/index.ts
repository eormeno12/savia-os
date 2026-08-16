/**
 * `@savia-os/adapters` — tramos 2 y 3: la SONDA, el REGISTRO, el SELECTOR, la CASCADA,
 * la fábrica del adaptador opaco y el primer adaptador de verdad.
 *
 * Depende de `@savia-os/ir` y de `yaml`, y de nada más. `adapters` y `emission` NUNCA
 * se ven entre sí (§{Paquetes}): `ir` es el único paquete que los dos alcanzan. Hasta
 * este paso esa frase era CIERTA Y VACÍA —`emission` se escribió entero con nodos
 * sintéticos porque no había ningún adaptador que importar—, y desde acá la frontera
 * tiene dos extremos reales. Lo que la impone es el grafo de paquetes; lo que la
 * NOMBRA es `scripts/boundaries.mjs`, y las dos direcciones están acreditadas
 * rompiéndolas, una por paquete.
 *
 * ES EL ÚNICO PAQUETE DEL PIPELINE CON DEPENDENCIAS DE RUNTIME, y el borde de
 * dependencias coincide con el borde de formato: `ir`, `emission` y `orchestration`
 * siguen en cero. La única que hay —`yaml`, para el frontmatter— está CONFINADA a
 * `src/markdown.ts` y el guardián lo impone: el tramo 2 decide quién lee un archivo y
 * no puede depender de una librería de formato, o cada adaptador nuevo la arrastraría
 * a la selección de los doce.
 *
 * LO QUE NO ESTÁ ACÁ, Y NO POR OLVIDO:
 *
 *   · los otros once adaptadores — el `.txt` es el paso 4 y el `chat` el 5
 *   · `delegar()`. No existe y no puede existir: sería la lectura literal de «la
 *     recursión ocurre sola» desde adentro del adaptador y rompería el grafo — este
 *     paquete pasaría a depender de la orquestación. El adaptador emite `asset` y nada
 *     más (PROVISIONAL(H1) de `ir/src/adapter.ts`), y esa frontera también está
 *     nombrada y acreditada.
 *
 * Los nombres que ninguna regla determinaba se decidieron en `packages/ir/GLOSARIO.md`
 * (sección 14) ANTES de escribir una línea: la regla para nombrar un paquete nuevo, la política
 * de los vocabularios de señales, `Registry`, `opaqueOf` y `Resolution`. Los huecos
 * que este paso tuvo que dejar abiertos están marcados y son grepeables:
 *
 *     grep -rn "PENDING(" src/
 */

export {
  type Registry,
  type Resolution,
  cascade,
  coldProbeOf,
  extensionOf,
  opaqueOf,
  probeOf,
  registryOf,
  select,
  sourceOfBytes,
} from "./registry.js";

export {
  MARKDOWN_ID,
  type MdSignals,
  blocksOf,
  inlineOf,
  markdownAdapter,
} from "./markdown.js";
