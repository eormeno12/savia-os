/**
 * `@savia-os/orchestration` — la espina dorsal: `ingest(bytes) → Run`.
 *
 * EL NOMBRE SE DECIDIÓ EN EL GLOSARIO ANTES DE CREAR EL DIRECTORIO (sección 14, P2). El plan
 * llama al paquete `ingesta/` y este se llama `orchestration`: `Ingestion` ya está
 * tomado dos veces —es una raíz del glosario y es un tipo exportado de `outputs.ts`,
 * el envoltorio del documento— y un paquete que exporta `ingest()` conviviendo con un
 * tipo homónimo que significa otra cosa es la homonimia que el glosario existe para
 * evitar. Lo que el paquete contiene lo nombra el propio plan: «orquestación de los
 * tramos» (§{Paquetes}). El archivo sigue siendo `src/ingest.ts` y la función `ingest`.
 *
 * ES EL ÚNICO PAQUETE QUE VE A LOS OTROS TRES, y por eso es el único lugar donde se
 * puede comprobar que los otros dos NO se ven: acá conviven `@savia-os/adapters` y
 * `@savia-os/emission`, y lo único que viaja entre ellos son tipos de `@savia-os/ir`.
 *
 * CERO DEPENDENCIAS DE RUNTIME. `sha256` entra por parámetro, igual que en `emit`, y
 * `scripts/boundaries.mjs` impone que ningún `node:` cruce: el borde de dependencias
 * coincide con el borde de formato y `adapters` es el único del lado de adentro.
 */

export {
  type Intake,
  type IngestOptions,
  type RECOGNIZED_PROOFS,
  type Run,
  type Sink,
  contextOf,
  ingest,
} from "./ingest.js";
