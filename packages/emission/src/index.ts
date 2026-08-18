/**
 * `@savia-os/emission` — tramos 4 y 5: RUTA, EMISOR, RECONCILIADOR y AGRUPACIÓN.
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
 * EL PASO 11 AGREGÓ EL RECONCILIADOR, que es la pieza 5 del tramo 4 y el último paso
 * del orden de construcción por ser el más caro de equivocar. Vive acá y no en un
 * paquete propio porque el plan lo lista junto con los otros dos («emision/ ruta ·
 * emisor · reconciliador», §{Paquetes}): partirlo en dos habría partido el tramo.
 *
 * Por eso la salida de `emit` sigue siendo `RoutedNode` y no `EmittedNode`: el `id`
 * sale de `reconcile`, que corre después. Ver PROVISIONAL(#66) y PROVISIONAL(#75) en
 * `ir/src/outputs.ts`.
 *
 * EL PASO 12 PUSO A LOS TRES EN SU ORDEN: `emit → reconcile → group`. El plan lo
 * declara al abrir el tramo 5 —«Entra: la lista plana del tramo 4, CON IDENTIDAD y
 * migas»— y hasta ese paso el código hacía lo contrario, no por decisión sino porque
 * el reconciliador no existía: `group` corría antes porque no había nada después. Así
 * que `group` consume `EmittedNode` y entrega `StableFragment`/`StableDataRecord`, con
 * las referencias a los nodos ya definitivas. Lo que NO entrega es
 * `IdentifiedFragment`: los dos campos que ese lleva —`id` y `contextualFingerprint`—
 * dependen del `DocumentId` y de una normalización que el contrato declara abierta, y
 * ninguno de los dos existe todavía en este tramo (GLOSARIO.md, P23/P24).
 *
 * LO QUE SIGUE SIN ESTAR ACÁ, Y NO POR OLVIDO:
 *
 *   · el índice de reconciliación (tramo 4, pieza 3) — las dos tablas que el plan
 *     describe son del tramo 7. Lo que sí vive acá es `KnownVersion`, que es la vista
 *     EN MEMORIA de una versión ya elegida, sin documento ni organización ni versión
 *     de bytes: para cuando llega, elegir contra qué reconciliar ya pasó
 *   · el acuñado de `ElementId` (tramo 4, pieza 4) — es reloj + azar, o sea impuro, y
 *     entra por parámetro como `MintFn` para que `reconcile` sea pura y este paquete
 *     no importe un solo `node:*`
 *   · la elección de CONTRA QUÉ versión reconciliar (`hash → documento`, con su filtro
 *     por organización) — vive un nivel más arriba, y filtrarla acá sería una máscara
 *     sobre el bug en vez de la garantía
 *   · el evento de degradación por anclaje bajo — `reconcile` es pura y devuelve las
 *     métricas; comparar contra `anchoringThreshold` y emitir es de `orchestration`
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
  type KnownVersion,
  type Anchor,
  type Match,
  type MatchBasis,
  type ReconciliationFailure,
  type Reconciliation,
  type ReconcileOptions,
  MATCH_BASES,
  knownVersionOf,
  // `anchorsOf` y `fencesOf` se exportan aunque `reconcile` sea el único llamador de
  // producto, y es superficie que se paga a sabiendas: el banco solo puede importar
  // del barril compilado, así que sin ellas la decisión que el plan NO TOMA —cuál
  // ancla parte las listas— quedaría acreditada solo a través de la salida final. Con
  // las dos afuera, el guardián COMPONE las implementaciones reales en vez de
  // reimplementar el pase 1, que sería acreditarse a sí mismo.
  anchorsOf,
  fencesOf,
  reconcile,
} from "./reconcile.js";

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
