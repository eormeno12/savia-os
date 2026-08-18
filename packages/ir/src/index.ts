/**
 * `@savia-os/ir` — el contrato del pipeline de ingesta.
 *
 * CERO dependencias. `adapters` y `emission` nunca se ven entre sí; `ir` es el
 * único lugar que ambos alcanzan (§{Cómo se agrega}, §{Paquetes}). Se congela y se
 * versiona primero: todo depende de él, él no depende de nada (§{Paquetes}).
 *
 * NINGUNA definición de este paquete se re-declara afuera. Si un tipo de acá hace
 * falta en otro lado, se importa. Si hace falta uno nuevo, se agrega ACÁ y es un
 * cambio de contrato, visible como tal en el diff (§{Cómo se agrega}).
 *
 * El paquete está ENTERO EN INGLÉS. La traducción se hizo en cuatro bloques, de
 * abajo hacia arriba del grafo de imports: el 1 pasó `shapes.ts`,
 * `classification.ts` y `params.ts` —con ellos los literales de `Role` y de
 * `Linkage`—; el 2, `identidad.ts → identity.ts` y `ubicacion.ts → location.ts`;
 * el 3, `proyeccion.ts → projection.ts` y `salidas.ts → outputs.ts`; el 4,
 * `adaptador.ts → adapter.ts` e `invariantes.ts → invariants.ts`, y con ellos los
 * guardianes (`fronteras.mjs → boundaries.mjs`, `citas.mjs → citations.mjs`,
 * `mutantes.mjs → mutants.mjs`). Los comentarios y las anclas de cita se quedan en
 * español a propósito: son el razonamiento, y el plan al que apuntan es un
 * documento de producto (GLOSARIO.md, sección 1).
 *
 * El costo de traducir el fondo primero fue visible y grepeable mientras duró:
 *
 *     grep -rc "alias temporal" src/
 *
 * contaba los alias que los consumidores todavía en español necesitaban. Hoy da UNO,
 * y ese uno es ESTA LÍNEA, que contiene el texto y se cuenta a sí misma. El total
 * real es CERO. (La versión anterior de este párrafo publicaba la cifra uno arriba;
 * el bloque 3 lo corrigió y el 4 lo deja en su caso degenerado. Se conserva igual:
 * es lo que vuelve VERIFICABLE la afirmación «entero en inglés», y el día que
 * alguien introduzca un alias nuevo la cifra deja de ser 1.)
 *
 * El argumento que sostenía el español entero era el cotejo contra el borrador, y
 * caducó: las citas de este paquete nombran SECCIONES, no líneas ni símbolos
 * (`scripts/citations.mjs`), y una sección sobrevive a un rename. Lo que queda del
 * argumento original es el orden: se tradujo por bloques, cada uno verde en los
 * SIETE comandos que `package.json` encadena antes del siguiente.
 *
 * El bump a `1.0.0` fue acá: la traducción cerró y ningún símbolo exportado
 * sobrevive con su nombre en español. `packages/emission` —el único consumidor—
 * se puso al día en el bloque 5 y compila contra estos nombres; su `DEUDA.md`,
 * que declaraba el rojo mientras tanto, ya no existe.
 *
 * Cómo leer las decisiones forzadas:
 *
 *     grep -rn "PROVISIONAL(" src/
 *
 * Cada una dice qué se eligió, por qué, y qué cambia si se decide al revés.
 *
 * Cómo cotejar contra el plan:
 *
 *     node scripts/citations.mjs
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
  /** El acuñador del paso 11. Entra por parámetro: acuñar es impuro (P20). */
  type MintFn,
  type AdapterId,
  type ActorId,
  type OrganizationId,
  type DocumentId,
  type ObjectKey,
  type FragmentId,
  type Instant,
  type ByteHash,
  type NodeFingerprint,
  type ContentHash,
  type ContextualFingerprint,
  type EmbeddingKey,
  type MatterHash,
  type CacheKey,
  asElementId,
  asLocalId,
  asAdapterId,
  asActorId,
  asOrganizationId,
  asDocumentId,
  asObjectKey,
  asFragmentId,
  asInstant,
  asByteHash,
  asNodeFingerprint,
  asContextualFingerprint,
  asEmbeddingKey,
  asMatterHash,
  asCacheKey,
} from "./identity.js";

// Procedencia — cómo llegó acá un contenido. Archivo propio desde el bloque 3b: es lo
// que vuelve escribible la frontera `projection.ts ↛ provenance.ts`, o sea lo único
// que puede imponer que ni la autoría ni la delegación entren en la huella
// (`scripts/boundaries.mjs`). Nació como `authorship.ts` con un solo miembro y se
// renombró al mudarse `DelegationId`, que declaraba el mismo invariante sin ninguna
// frontera que lo impusiera. El criterio de membresía está en su encabezado.
export {
  type Authorship,
  type DelegationId,
  asDelegationId,
  /** De dónde salieron los bytes de un asset: contenedor + ruta adentro. */
  type Whence,
} from "./provenance.js";

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
  windowCovers,
  windowKey,
  isRowNode,
} from "./shapes.js";

// Clasificación.
export {
  ROLES,
  type Role,
  CERTAINTIES,
  type Certainty,
  CERTAINTY_RANK,
  worstCertainty,
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
  encodeParts,
  normalize,
  type TokenKind,
  type Token,
  project,
  encodeWindow,
  encode,
  preimageOfFingerprint,
  type HashFn,
  /** La misma, sobre BYTES: deriva la dirección de un asset materializado. */
  type ByteHashFn,
  fingerprintOf,
  similarityOfProjections,
  similarity,
  render,
  fieldKey,
} from "./projection.js";

// Salidas del pipeline.
export {
  NODE_BRAND,
  type BrandedAsNode,
  type RawNode,
  type Node,
  asNode,
  type Breadcrumb,
  type LocalBreadcrumb,
  type StableBreadcrumb,
  type RoutedNode,
  type EmittedNode,
  ANCHORING_DENOMINATOR,
  type ReconciliationMetrics,
  type EmissionOutput,
  type KnownNode,
  type NodeInVersion,
  type Fragment,
  type LocalFragment,
  type StableFragment,
  /** El fragmento que además tiene identidad propia (P24). Lo produce el tramo 7. */
  type IdentifiedFragment,
  type Vector,
  type FieldValue,
  type DataRecord,
  type LocalDataRecord,
  type StableDataRecord,
  type ProposedAnnotation,
  type Annotation,
  type AnnotationKey,
  type Annotator,
  type Ingestion,
  CHANNELS,
  type Channel,
  ACHIEVED_LEVELS,
  type AchievedLevel,
  DOCUMENT_STATES,
  type DocumentState,
} from "./outputs.js";

// Contrato de adaptador.
export {
  EVIDENCE_SCALE,
  type EvidenceName,
  CAPABILITIES,
  type Capability,
  type Region,
  type PerceiveFn,
  /** El almacenamiento que el pipeline GESTIONA y no implementa. */
  type Storage,
  Evidence,
  type Origin,
  type ColdProbe,
  type Probe,
  type EvidenceFn,
  type Selection,
  type Diagnostics,
  type Notice,
  type Degradation,
  type Budget,
  type SpendKind,
  type CancellationSignal,
  type Context,
  type Unit,
  type AuthoredUnit,
  type RawAuthorship,
  type AuthoredRawNode,
  type Source,
  type CascadeLink,
  type Adapter,
  type FileAdapter,
  type ChannelAdapter,
  type OpaqueAdapter,
  MAGIC_BYTES,
} from "./adapter.js";

// Invariantes de compilación.
export {
  type SHAPE_PROOFS,
  type MINTING_PROOFS,
  type BRAND_PROOFS,
  type COHESION_PROOFS,
  type PAIR_PROOFS,
  type DOMAIN_PROOFS,
  type COORDINATE_PROOFS,
  type WRAPPER_PROOFS,
  type CERTAINTY_PROOFS,
  type RECURSION_PROOFS,
  type EVIDENCE_PROOFS,
  type CHANNEL_PROOFS,
  type CHANNEL_CAPABILITY_PROOFS,
  isNode,
} from "./invariants.js";
