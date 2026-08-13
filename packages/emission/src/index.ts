/**
 * `@savia-os/emission` — tramo 4, piezas 1 y 2: RUTA y EMISOR.
 *
 * Depende de `@savia-os/ir` y de nada más. `emission` y `adaptadores` NUNCA se ven
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
 * Por eso la salida de `emit` es `RoutedNode` y no `EmittedNode`: el `id` sale
 * de la reconciliación, que corre después. Ver PROVISIONAL(#66) en `ir/src/outputs.ts`.
 *
 * El paquete está ENTERO EN INGLÉS desde el bloque 5 de la reescritura, con
 * `packages/ir/GLOSARIO.md` como autoridad de nombres — los tres términos que
 * ninguna regla determinaba (`Ruta`, `Contenedor` y el nombre del archivo de
 * sintéticos) se agregaron ahí ANTES de escribirlos acá, en su sección 10. Los comentarios y las
 * anclas de cita se quedan en español a propósito: son el razonamiento, y el plan al
 * que apuntan es un documento de producto (GLOSARIO.md, sección 1).
 *
 * Los huecos que este paso tuvo que tapar para compilar están marcados
 * `PENDING(...)` con qué se eligió y qué falta medir para cerrarlo:
 *
 *     grep -rn "PENDING(" src/
 */

export {
  type Scope,
  type Route,
  type State,
  type RouteFailure,
  type Routing,
  createState,
  localOfNode,
  routeOf,
  breadcrumbOf,
} from "./route.js";

export { type EmissionFailure, type Emission, emit } from "./emitter.js";

export {
  type Case,
  CASES,
  CANONICAL_CASE,
  DELEGATED_CASE,
  EDITED_HEADING,
  DANGLING_PARENT,
} from "./synthetic.js";
