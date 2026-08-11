/**
 * `@savia-os/emision` — tramo 4, piezas 1 y 2: RUTA y EMISOR.
 *
 * Depende de `@savia-os/ir` y de nada más. `emision` y `adaptadores` NUNCA se ven
 * entre sí (§{Paquetes}): `ir` es el único paquete que los dos alcanzan. Este
 * paquete se escribió ANTES de que exista un solo adaptador, alimentado con nodos
 * sintéticos, y esa es la prueba de que el borde R1 es real.
 *
 * LO QUE NO ESTÁ ACÁ, Y NO POR OLVIDO:
 *
 *   · el índice de reconciliación (tramo 4, pieza 3)
 *   · el acuñado de `ElementId`  (tramo 4, pieza 4)
 *   · el reconciliador de tres pases (tramo 4, pieza 5) — es el PASO 11 del orden
 *     de construcción, el último por ser el más caro de equivocar
 *
 * Por eso la salida de `emitir` es `NodoConRuta` y no `NodoEmitido`: el `id` sale
 * de la reconciliación, que corre después. Ver PROVISIONAL(#66) en `ir/src/salidas.ts`.
 *
 * Los huecos que este paso tuvo que tapar para compilar están marcados
 * `PENDIENTE(...)` con qué se eligió y qué falta medir para cerrarlo:
 *
 *     grep -rn "PENDIENTE(" src/
 */

export {
  type Scope,
  type Ruta,
  type Estado,
  type FallaDeRuta,
  type Ruteo,
  crearEstado,
  localDeNodo,
  rutaDe,
  migaDe,
} from "./ruta.js";

export { type FallaDeEmisión, type Emisión, emitir } from "./emisor.js";

export {
  type Caso,
  CASOS,
  CASO_CANÓNICO,
  CASO_DELEGADO,
  TITULO_EDITADO,
  PADRE_COLGANTE,
} from "./sinteticos.js";
