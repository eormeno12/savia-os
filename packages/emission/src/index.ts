/**
 * `@savia-os/emission` — tramos 4 y 5: RUTA, EMISOR y AGRUPACIÓN.
 *
 * Depende de `@savia-os/ir` y de nada más. `emission` y `adaptadores` NUNCA se ven
 * entre sí (§{Paquetes}): `ir` es el único paquete que los dos alcanzan. Este
 * paquete se escribió ANTES de que exista un solo adaptador, alimentado con nodos
 * sintéticos, y esa es la prueba de que el borde R1 es real.
 *
 * EL PASO 3a AGREGÓ EL TRAMO 5 ACÁ Y NO EN UN PAQUETE PROPIO. No es acumulación: el
 * tramo 5 comparte el recorrido con el emisor —«no hay ninguna rama que corte»
 * (§{El recorrido})— y es el OTRO consumidor de `cohesionOf`. Y con él la prueba del
 * borde R1 se extiende: el paso 2 mostró que el emisor no necesita un adaptador para
 * escribirse; `grouping.ts` lo muestra de la agrupación, que era el candidato real a
 * mirar el formato. Desde el paso 3a la afirmación deja de ser una lectura y la
 * verifica `scripts/boundaries.mjs`, que nombra la frontera en vez de dejarla en
 * manos del resolvedor de módulos.
 *
 * LO QUE NO ESTÁ ACÁ, Y NO POR OLVIDO:
 *
 *   · el índice de reconciliación (tramo 4, pieza 3)
 *   · el acuñado de `ElementId`  (tramo 4, pieza 4)
 *   · el reconciliador de tres pases (tramo 4, pieza 5) — es el PASO 11 del orden
 *     de construcción, el último por ser el más caro de equivocar
 *
 * Por eso la salida de `emit` es `RoutedNode` y no `EmittedNode`, y la de `group` es
 * `LocalFragment`/`LocalDataRecord` y no `StableFragment`/`StableDataRecord`: el `id`
 * sale de la reconciliación, que corre después. Ver PROVISIONAL(#66) y
 * PROVISIONAL(#75) en `ir/src/outputs.ts`.
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

export { type Grouping, group } from "./grouping.js";

export {
  type Case,
  type GroupingCase,
  CASES,
  GROUPING_CASES,
  CANONICAL_CASE,
  DELEGATED_CASE,
  EDITED_HEADING,
  DANGLING_PARENT,
} from "./synthetic.js";
