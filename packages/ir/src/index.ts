/**
 * `@savia-os/ir` — el contrato del pipeline de ingesta.
 *
 * CERO dependencias. `adaptadores` y `emision` nunca se ven entre sí; `ir` es el
 * único lugar que ambos alcanzan (§{Cómo se agrega}, §{Paquetes}). Se congela y se
 * versiona primero: todo depende de él, él no depende de nada (§{Paquetes}).
 *
 * NINGUNA definición de este paquete se re-declara afuera. Si un tipo de acá hace
 * falta en otro lado, se importa. Si hace falta uno nuevo, se agrega ACÁ y es un
 * cambio de contrato, visible como tal en el diff (§{Cómo se agrega}).
 *
 * PROVISIONAL(P1): el paquete está A MEDIO TRADUCIR, y el estado es visible en esta
 * misma lista de exports. El bloque 1 pasó a inglés `shapes.ts`, `classification.ts`
 * y `params.ts` —con ellos los literales de `Role` y de `Linkage`, y sus nombres
 * exportados—; el bloque 2 pasó `identidad.ts → identity.ts` y
 * `ubicacion.ts → location.ts`, las dos capas del fondo del grafo de imports.
 * `proyeccion.ts`, `salidas.ts`, `adaptador.ts` e `invariantes.ts` siguen en
 * español, con tilde en los exportados (`Diagnóstico`, `huellaDe`), que es la
 * mezcla exacta del plan. El costo de traducir el fondo primero es visible y
 * grepeable: `grep -rc "alias temporal" src/` cuenta los alias que los consumidores
 * todavía en español necesitan, y es la cifra que baja sola con cada bloque
 * siguiente. (La cuenta se hace sobre el texto del comentario y no sobre el
 * marcador, para que esta línea no se cuente a sí misma.)
 *
 * El argumento que sostenía el español entero era el cotejo contra el borrador, y
 * caducó: las citas de este paquete nombran SECCIONES, no líneas ni símbolos
 * (`scripts/citas.mjs`), y una sección sobrevive a un rename. Lo que queda del
 * argumento original es el orden: se traduce por bloques, cada uno verde en los
 * cinco comandos antes del siguiente, y el bump de versión mayor de `ir` va cuando
 * el último bloque cierre — nunca de contrabando dentro de otro cambio.
 *
 * Cómo leer las decisiones forzadas:
 *
 *     grep -rn "PROVISIONAL(" src/
 *
 * Cada una dice qué se eligió, por qué, y qué cambia si se decide al revés.
 *
 * Cómo cotejar contra el plan:
 *
 *     node scripts/citas.mjs
 *
 * Toda cita de este paquete nombra una SECCIÓN del borrador, no una línea. El
 * script las resuelve, imprime el texto de cada sección al lado, y falla si alguna
 * dejó de existir. La versión anterior citaba números de línea y no verificaba
 * nada: el plan creció, las 389 citas quedaron corridas hasta 339 líneas, y el
 * paquete siguió compilando en verde. Un encabezado se puede renombrar —y entonces el
 * script grita—, pero no se corre solo.
 */

// Parámetros — el único objeto con literales numéricos de todo el paquete.
export { PARAMETERS, type Pending } from "./params.js";

// Identidad y huella.
export {
  type Nominal,
  type ElementId,
  type LocalId,
  type AdapterId,
  type ActorId,
  type OrganizationId,
  type DocumentId,
  type ObjectKey,
  type DelegationId,
  type FragmentId,
  type Instant,
  type ByteHash,
  type NodeFingerprint,
  type ContentHash,
  type ContextualFingerprint,
  type EmbeddingKey,
  type MatterHash,
  type CacheKey,
  type Authorship,
  asElementId,
  asLocalId,
  asAdapterId,
  asActorId,
  asOrganizationId,
  asDocumentId,
  asObjectKey,
  asDelegationId,
  asFragmentId,
  asInstant,
  asByteHash,
  asNodeFingerprint,
  asContextualFingerprint,
  asEmbeddingKey,
  asMatterHash,
  asCacheKey,
} from "./identity.js";

// Ubicación y coordenadas.
export {
  type Box,
  type Coordinate,
  type SourceRange,
  type LocalLocation,
  type Location,
  boxContains,
  compareBoxes,
} from "./location.js";

// Las seis formas.
export {
  SHAPES,
  type Shape,
  type Body,
  type BodyOf,
  type Mark,
  type Cell,
  type CellType,
  type Pair,
  type Grain,
  type Window,
  type ObjectRef,
  type Enrichment,
  type EnrichmentKind,
  windowCovers,
  isRowNode,
} from "./shapes.js";

// Clasificación.
export {
  ROLES,
  type Role,
  CERTAINTIES,
  type Certainty,
  RECOGNITION_LEVELS,
  type RecognitionLevel,
  rank,
  certaintyOfLevel,
  LINKAGES,
  type Linkage,
  type Hint,
  type Classification,
  COHESIONS,
  type Cohesion,
  COHESION_BY_ROLE,
  cohesionOf,
  isLead,
  acceptsSatellite,
  ROLE_BY_SHAPE,
  roleFromBody,
  REQUIRED_SHAPE,
  type RoleWithRequiredShape,
  type RoleFor,
  isLegalPair,
  ROLE_SHAPE_PAIRS,
  ILLEGAL_PAIRS,
} from "./classification.js";

// La proyección canónica y lo que deriva de ella.
export {
  concatenar,
  normalizar,
  type ClaseDeToken,
  type Token,
  proyectar,
  codificarVentana,
  codificar,
  preimagenDeHuella,
  type FunciónHash,
  huellaDe,
  similitudDeProyecciones,
  similitud,
  renderizar,
  claveDeCampo,
} from "./proyeccion.js";

// Salidas del pipeline.
export {
  MARCA_NODAL,
  type EsNodo,
  type NodoCrudo,
  type Nodo,
  comoNodo,
  type Miga,
  type MigaLocal,
  type MigaEstable,
  type NodoConRuta,
  type NodoEmitido,
  DENOMINADOR_DE_ANCLAJE,
  type MétricasReconciliación,
  type SalidaDeEmisión,
  type NodoConocido,
  type NodoEnVersión,
  type Fragmento,
  type Vector,
  type Valor,
  type Registro,
  type AnotaciónPropuesta,
  type Anotación,
  type Anotador,
  type Ingesta,
  CANALES,
  type Canal,
  NIVELES_LOGRADOS,
  type NivelLogrado,
  ESTADOS_DE_DOCUMENTO,
  type EstadoDeDocumento,
} from "./salidas.js";

// Contrato de adaptador.
export {
  ESCALA_EVIDENCIA,
  type NombreDeEvidencia,
  Evidencia,
  type Origen,
  type SondaFría,
  type Sonda,
  type Evidenciador,
  type Selección,
  type Diagnóstico,
  type Aviso,
  type Degradación,
  type Presupuesto,
  type ClaseDeGasto,
  type SeñalDeCancelación,
  type Contexto,
  type Unidad,
  type Fuente,
  type Eslabón,
  type Adaptador,
  type AdaptadorOpaco,
  BYTES_MAGICOS,
} from "./adaptador.js";

// Invariantes de compilación.
export {
  type PRUEBAS_DE_FORMA,
  type PRUEBAS_DE_ACUÑADO,
  type PRUEBAS_DE_MARCA,
  type PRUEBAS_DE_COHESIÓN,
  type PRUEBAS_DE_PAREJA,
  type PRUEBAS_DE_DOMINIO,
  type PRUEBAS_DE_COORDENADA,
  esNodo,
} from "./invariantes.js";
