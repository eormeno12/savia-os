/**
 * EL CONTENIDO DE UNA ENTRADA DE ZIP — la dueña de `fflate`, y la única pieza del
 * paquete que descomprime algo.
 *
 * VIVE APARTE DE `zip.ts` POR UNA FRONTERA, no por organización. El listado de
 * entradas lo consulta el TRAMO 2 para decidir quién lee un archivo, y la regla que
 * admite dependencias de runtime existe para que ese tramo «siga sin depender de
 * ninguna librería de formato». Juntos en un archivo, `registry.ts` importaría
 * `fflate` transitivamente y esa garantía se volvería falsa sin que ningún import lo
 * delatara. Ver el encabezado de `zip.ts`.
 *
 * SOLO LA VARIANTE SÍNCRONA DE `fflate`, y va escrito porque el import no lo delata.
 * Su mapa de exports tiene condición `node`: bajo node, `import "fflate"` resuelve a un
 * build distinto del de navegador, y la variante ASINCRÓNICA usa hilos. `inflateSync`
 * no los toca — medido borrando `Buffer` y `process` del ámbito global y repitiendo la
 * corrida—. Con la asincrónica entraría `node:worker_threads` por la puerta de atrás
 * sin que ningún especificador de import lo mostrara, que es exactamente el agujero
 * que `env.d.ts` describe para los globales.
 *
 * ES TOLERANTE Y NO LANZA, igual que `zip.ts` y por la misma razón.
 */

import { inflateSync } from "fflate";
import { zipDirectoryOf } from "./zip.js";

// Los desplazamientos del encabezado LOCAL (APPNOTE.TXT 6.3.x, sección 4.3.7) y los dos
// métodos de compresión que un zip real usa. No son parámetros: son la especificación.
const LOCAL_NOMBRE = 26; // uint16 · largo del nombre
const LOCAL_EXTRA = 28; // uint16
const LOCAL_FIJO = 30; // el encabezado local, sin las dos partes variables
const SIN_COMPRIMIR = 0;
const DEFLATE = 8;

/**
 * El contenido de UNA entrada, ya inflado, o `null` si no está o no se puede leer.
 *
 * Es el único lugar del paquete que llama a `fflate`.
 */
export const zipEntryOf = (bytes: Uint8Array, name: string): Uint8Array | null => {
  const entrada = zipDirectoryOf(bytes).find((e) => e.name === name);
  if (entrada === undefined) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const h = entrada.local;
  if (h + LOCAL_FIJO > bytes.length) return null;
  const inicio =
    h + LOCAL_FIJO + dv.getUint16(h + LOCAL_NOMBRE, true) + dv.getUint16(h + LOCAL_EXTRA, true);
  const crudo = bytes.subarray(inicio, inicio + entrada.compressed);
  if (entrada.method === SIN_COMPRIMIR) return crudo;
  if (entrada.method !== DEFLATE) return null;
  try {
    // `inflate` de `fflate` es RAW —DEFLATE sin envoltorio—, que es lo que un zip
    // guarda. La variante con envoltorio zlib es `unzlibSync`, y usarla acá devolvería
    // basura en silencio.
    return inflateSync(crudo);
  } catch {
    return null;
  }
};
