/**
 * Los invariantes que se verifican en el BUILD y no llevan test.
 *
 * «Lo que no necesita test porque no compila importa tanto como lo que sí: cada
 * invariante que se mueve del runtime al compilador es un test menos que mantener
 * y un bug menos que puede llegar a producción» (§{Estrategia}).
 *
 * REGLA DE ESTE ARCHIVO — el valor de fallo de una aserción NUNCA puede ser
 * asignable a su tipo de éxito. `never` queda descartado por construcción: es
 * asignable a todo, así que una aserción que falla hacia `never` no puede fallar.
 * El fallo se expresa con un OBJETO de error, y cada condición se assertea por
 * separado — nunca intersecadas, porque `true & {error}` sigue siendo asignable a
 * `true`. Las tres garantías que este paquete anunciaba y no cumplía violaban las
 * tres esta misma regla.
 *
 * Y ANTES DE ESCRIBIR UNA ASERCIÓN ACÁ: preguntarse si la violación se puede volver
 * IRREPRESENTABLE en vez de detectable. Tres de las cuatro que había se borraron
 * así, restringiendo el dato donde se escribe:
 *   · `Shape` ≡ `Body['shape']` → `Shape` se deriva de `Body` (`shapes.ts`)
 *   · el piso físico nunca da un par ilegal → anotación de `ROLE_BY_SHAPE`
 *   · «código siempre atómico» → anotación de `COHESION_BY_ROLE`
 * La cuarta —ningún payload anida un nodo— la impone el grafo de módulos:
 * `shapes.ts` no puede alcanzar `outputs.ts`, verificado por
 * `scripts/boundaries.mjs`. Sin ese import, un `Node` dentro de un `Body` es
 * inexpresable.
 *
 * Pero «restringir donde se escribe» solo cuenta mientras la restricción SIGA
 * siendo la que se escribió. Las tres anotaciones de arriba son las que se pueden
 * aflojar sin un solo error —ensanchar un literal a su unión, sacar un `satisfies`,
 * borrar un elemento de un arreglo `as const`— y las tres, aflojadas, apagan la
 * garantía en silencio. Por eso los invariantes 4, 5 y 6 no verifican los datos:
 * verifican que la RESTRICCIÓN siga vigente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL INVENTARIO, Y CUÁNTO DE ÉL ESTÁ ACREDITADO
 *
 * Este archivo es un inventario de garantías, así que se audita como tal: una
 * aserción que nadie vio DISPARAR es indistinguible de una que no puede fallar, y
 * una aserción que no puede fallar es el mismo pecado que `never`. El censo, al
 * cerrar el bloque 3b (el 4 cerró con 42 · 26 · 16; la que entró es
 * `_FingerprintIsBranded`, con su mutante M47):
 *
 *   46 aserciones de tipo · 30 con mutante que las acredita · 16 sin
 *
 * El paso 3a sumó TRES, las tres acreditadas: `_LocalFragmentHasNoId` (M53),
 * `_S7` (M54) y `_S8` (M55) — las salidas del tramo 5, PROVISIONAL(#75) en
 * `outputs.ts`. Las 16 sin mutante no se movieron.
 *
 * El bloque 3c NO movió estas tres cifras y conviene decir por qué, para que la
 * ausencia de cambio no se lea como que no se miró: sus dos filas nuevas no acreditan
 * aserciones de este archivo. M49 acredita una FRONTERA del grafo de módulos
 * (`projection.ts ↛ provenance.ts`, para `DelegationId`) y M50 un CHEQUEO de
 * `numbers.mjs` (el censo de llamadas a `NotAssignableTo`, abajo). Lo único que este
 * bloque le hizo al archivo es renombrar un operador —`Covers` → `FitsIn`, ver su
 * ficha— y las 24 llamadas siguen siendo las mismas 24 aserciones.
 *
 * Las 16 sin mutante NO son 16 huecos, y decirlo es más útil que escribir 16 filas
 * que no compran nada:
 *
 *   · 10 son la MISMA aserción sobre otro miembro de una familia ya acreditada.
 *     `_H1`, `_H3`, `_H4`, `_H5`, `_H6` son `Inhabited` aplicado a otros cinco
 *     hashes y M20 acredita el operador vía `_H2`; `_S2`, `_S3`, `_S4` son M21
 *     sobre otros tres pares; `_FormulaIsSolo` e `_ImageIsSolo` son M6 sobre otros
 *     dos roles. Un mutante por miembro agregaría filas y cero información.
 *   · 6 NO TIENEN MUTACIÓN PLAUSIBLE de una línea, y van con nombre y apellido
 *     abajo, en `SIN ACREDITACIÓN POSIBLE`. Ninguna se deja pasar en silencio.
 *
 * SIN ACREDITACIÓN POSIBLE — las seis, dichas de frente
 *
 *   · `_UsableAsString` — la única edición que la dispara es cambiar `Nominal`
 *     para que no intersecte con `Base`, y eso rompe PRIMERO en los 15
 *     constructores `as*` de `identity.ts` —16 hasta que `asDelegationId` se fue con
 *     su tipo a `provenance.ts`—: el mutante acreditaría al compilador,
 *     no a esta línea. Lo que la protege de verdad es `_GuardFires` (M18), que fija
 *     la forma de `Nominal`. Queda como SEGURO SIN ACREDITACIÓN, escrito.
 *   · las cinco mitades «hacia atrás» — `_IngestionVersionInhabited`,
 *     `_OriginalInhabited`, `_VersionOrganizationInhabited`,
 *     `_AnnotationActorInhabited` (invariante 8) y `_AncestorsInhabited`
 *     (invariante 10). Las cinco agarran el colapso a `never` de una marca nominal
 *     sobre `string`, y ese colapso es prácticamente inalcanzable: ensanchar la
 *     marca la agarra la mitad de ADELANTE, y no hay edición de una línea que la
 *     lleve a `never` sin romper antes `identity.ts`. Se conservan igual —son
 *     baratas y el día que `Nominal` cambie de forma son lo único que queda— pero
 *     se conservan SABIENDO que ningún mutante las va a poner rojas.
 *
 * Lo que el bloque 4 SÍ arregló de esas cinco: **compartían mensaje con su mitad de
 * adelante**, así que si alguna disparara, el error mandaría a leer otra cosa. Es
 * exactamente el defecto que `Inhabited` y `NotAssignableTo` documentan haber
 * evitado con sus mensajes con default. Ahora cada una dice lo suyo.
 */

import { SHAPES, type Body, type Shape } from "./shapes.js";
import type {
  CERTAINTY_RANK,
  COHESION_BY_ROLE,
  Role,
  RoleFor,
  RoleWithRequiredShape,
  ROLES,
} from "./classification.js";
import type {
  ActorId,
  ByteHash,
  CacheKey,
  ContextualFingerprint,
  ElementId,
  EmbeddingKey,
  LocalId,
  MatterHash,
  MintFn,
  NodeFingerprint,
  Nominal,
  ObjectKey,
  OrganizationId,
} from "./identity.js";
import type { Box, Coordinate, Location, SourceRange } from "./location.js";
// Se importa el VALOR y no un tipo: la aserción es sobre `ReturnType<typeof
// fingerprintOf>`, o sea sobre la firma real y no sobre una copia que pueda
// discrepar. `import type` alcanza —`typeof` sobre un valor importado como tipo es
// legal— y así este archivo no le agrega una arista de runtime al grafo.
import type { fingerprintOf } from "./projection.js";
import {
  NODE_BRAND,
  type Annotation,
  type Ingestion,
  type LocalDataRecord,
  type LocalFragment,
  type Node,
  type NodeInVersion,
  type RawNode,
  type ReconciliationMetrics,
  type StableDataRecord,
  type StableFragment,
} from "./outputs.js";
import {
  EVIDENCE_SCALE,
  type Adapter,
  type AuthoredUnit,
  type Capability,
  type ChannelAdapter,
  type Context,
  type FileAdapter,
  type OpaqueAdapter,
  type Source,
  type Unit,
} from "./adapter.js";

// ─────────────────────────────── Maquinaria ──────────────────────────────────

type True<T extends true> = T;

/**
 * `true` si `From` cabe en `To`; si no, un OBJETO de error que nombra el desfase.
 *
 * El fallo NO puede ser `never`: `never` es asignable a todo, así que
 * `True<never>` compila y la aserción queda vacua. Es el error exacto que
 * tenía `_FormaEsCuerpoForma`, la aserción que vivía en `shapes.ts` y se borró, y
 * también el arreglo que la auditoría proponía para él. Un objeto no es asignable a
 * `true` y rompe el build.
 *
 * Y por eso mismo dos condiciones se assertean por SEPARADO y nunca con `&`:
 * `true & {error}` sigue siendo asignable a `true`.
 *
 * SE LLAMABA `Covers`, Y EL NOMBRE SE LEÍA AL REVÉS DE SU FIRMA. `Covers<From, To>`
 * significaba «`To` cubre a `From`», o sea que el sujeto del verbo era el SEGUNDO
 * parámetro. En español (`Cubre<De, A>`) el defecto pasaba desapercibido; en inglés
 * invita a leer «From covers To», que es lo contrario. Venía marcado desde el bloque 4
 * como decisión pendiente y este bloque la toma: **se renombra, no se invierte el
 * orden**. `FitsIn<From, To>` se lee «`From` cabe en `To`», en el orden en que están
 * escritos, y la firma no se toca.
 *
 * POR QUÉ RENOMBRAR Y NO INVERTIR, que era la otra opción válida:
 *   · Es el criterio que este archivo YA usó para el operador hermano. D7 eligió
 *     `NotAssignableTo<From, To>` sobre `Separates<A,B>` porque «CONSERVA LA
 *     DIRECCIÓN»: el nombre se lee en el orden de los parámetros. `FitsIn` le aplica
 *     el mismo criterio a este. Un criterio para los dos, no uno por operador.
 *   · La palabra «covers» ya tiene dueño en el paquete Y CON LA CONVENCIÓN CONTRARIA:
 *     `windowCovers(exterior, interior)` (`shapes.ts`, exportada por el barril) toma
 *     al que cubre PRIMERO. Invertir el orden acá arreglaba la lectura y dejaba la
 *     misma palabra haciendo dos trabajos opuestos; renombrar la desocupa.
 *   · El costo se mapeó antes de tocar nada, y es asimétrico. Los sitios de llamada
 *     son **24** (contados por AST, no a ojo: la cifra publicada desde el bloque 4
 *     decía 34 y era otra cifra sostenida a mano). Renombrar les cambia el nombre del
 *     operador y NADA MÁS: el orden de los argumentos y el mensaje —que es el tercer
 *     parámetro, un literal— quedan intactos, así que ninguna aserción puede cambiar
 *     de sentido en silencio y ninguna `espera` del corredor de mutación se toca —las
 *     que matchean mensajes producidos por este operador matchean el LITERAL, no la
 *     firma, y por eso no llevan cifra acá—. Invertir el orden obliga a releer los 24
 *     pares, y ahí sí
 *     hay un fallo MUDO posible: `_SpacesDeclared` y `_SpacesPresent` son el mismo par
 *     en las dos direcciones, así que invertir uno y no el otro deja dos copias de la
 *     misma aserción, las dos en verde, y M25 o M45 se queda sin acreditar sin que
 *     nada cambie de color. Misma lectura arreglada, superficie de error mucho mayor.
 *
 * `_ArrayCoversShapes` CONSERVA su nombre, y no por olvido: nombra la PROPIEDAD —«el
 * arreglo cubre las formas»—, no el operador. Con `FitsIn` las dos lecturas por fin
 * coinciden: `FitsIn<Shape, (typeof SHAPES)[number]>` es «`Shape` cabe en el arreglo»,
 * que es exactamente «el arreglo cubre las formas».
 */
type FitsIn<From, To, Message extends string> = [From] extends [To]
  ? true
  : { "IR-ERR": [Message, From, To] };

// ══════════════════ Invariante 1 · el arreglo cubre todas las formas ══════════
// La única dirección que ninguna anotación puede imponer: `Shape` se DERIVA de
// `Body` y `SHAPES` lleva `satisfies` (los dos en `shapes.ts`), así que el
// arreglo no puede nombrar una forma que no exista. Pero que no le FALTE ninguna
// no se puede escribir como restricción, porque un tipo no se enumera en runtime.
// Si falta una, `ROLE_BY_SHAPE` queda incompleto y el barrido «15×6 = 90»
// (§{Estrategia})
// recorre un dominio viejo — los dos fallos, mudos.

type _ArrayCoversShapes = True<
  FitsIn<Shape, (typeof SHAPES)[number], "SHAPES is missing a shape of Body">
>;

export type SHAPE_PROOFS = readonly [_ArrayCoversShapes];

// ═══════════ Invariante 2 · la salida del adaptador no tiene ids (H13) ═══════
// El acuñado al azar de `ElementId` descansa en un hecho verificable: el property
// test de determinismo del tramo 3 —«para cada adaptador a: a.reconocer(f) ≡
// a.reconocer(f), árbol byte-idéntico»— compara artefactos que NO LLEVAN ID, así que
// no se puede romper por cómo se acuñan los ids. Ese hecho era hasta ahora una
// lectura de dos archivos, y una lectura no falla cuando deja de ser cierta.
//
// Si alguien agrega un `id` a `Unit` o a `RawNode`, la tenaza que H13 declara
// inexistente vuelve a existir — y el build lo dice acá, no seis meses después.
//
// `_UnitHasNoId` está escrita desde el bloque 1b y hasta el bloque 4 NADIE LA VIO
// DISPARAR: sin ella, agregarle un `id` a `Unit` no rompía una línea. La acredita
// M40, con MC8 como control — el control es lo que distingue «`Unit` no puede
// llevar un id» de «`Unit` está congelada».

/** Error si `T` tiene la clave `K`. */
type WithoutKey<T, K extends string, Message extends string> = K extends keyof T
  ? { "IR-ERR": [Message, K, T] }
  : true;

type _UnitHasNoId = True<
  WithoutKey<Unit<unknown>, "id", "adapter output must not carry an id — see H13(a)">
>;
type _RawNodeHasNoId = True<
  WithoutKey<RawNode, "id", "what is cached by hashBytes must not carry an id — see H13(a)">
>;

// LA TERCERA ES DEL PASO 3a Y ES OTRA SALIDA, no otro productor. El tramo 5 tampoco
// acuña identidad, y por un motivo que ninguna de las dos de arriba tiene:
// `FragmentId` se DERIVA de `(DocumentId, contextualFingerprint)` (PROVISIONAL(#69))
// y el tramo 5 no tiene documento — el `DocumentId` vive en `Ingestion`, un tramo más
// arriba. O sea que un `id` acá no sería «un id de más»: sería un id IMPOSIBLE DE
// CALCULAR, y el único modo de tenerlo sería inventarle otra derivación.
//
// El campo estuvo en `Fragment` hasta este paso y nada lo señalaba, porque nadie
// había intentado producir un fragmento todavía. Ver PROVISIONAL(#75) en
// `outputs.ts`.
type _LocalFragmentHasNoId = True<
  WithoutKey<LocalFragment, "id", "the tramo-5 fragment must not carry a FragmentId — it is derived from (DocumentId, contextualFingerprint) and neither exists yet">
>;

export type MINTING_PROOFS = readonly [
  _UnitHasNoId,
  _RawNodeHasNoId,
  _LocalFragmentHasNoId,
];

// ══════════════════════════ Invariante 3 · la marca separa ═══════════════════
// La familia de hashes estuvo escrita en DOS niveles (`Nominal<Sha256Hex, …>`) y
// TODOS sus tipos eran `never`, o sea asignables a todo: una huella se asignaba a
// un `number` y a una `CacheKey`. El docstring que prometía impedirlo estaba
// escrito y era falso. Estas pruebas son para que no vuelva a poder serlo.
//
// Y desde el bloque 3b el invariante tiene DOS mitades, porque tenerlas separadas es
// lo que hizo visible el hueco: que la marca SEPARE (`_S1`–`_S6`, y las seis
// `Inhabited`) y que alguien la PONGA (`_FingerprintIsBranded`). La primera estuvo en
// verde durante cinco bloques mientras el único productor de huellas del paquete
// devolvía un `string` pelado.

/**
 * Error si `T` colapsó a `never` — un tipo sin valores posibles es asignable a TODO.
 *
 * El mensaje es un parámetro con DEFAULT, igual que en `NotAssignableTo` y por la
 * misma razón: el operador nació para marcas nominales pero no es de marcas.
 * `SourceRange` también puede colapsar —es un `Extract`, y un `Extract` que no
 * matchea da `never` sin un solo error— y reportar eso como «*brand collapsed to
 * never*» mandaría a leer `identity.ts`, que no tiene nada que ver.
 */
type Inhabited<
  T,
  Message extends string = "brand collapsed to never and no longer protects anything",
> = [T] extends [never] ? { "IR-ERR": [Message, T] } : true;

/**
 * Error si un valor de `From` se puede pasar donde se espera `To`.
 *
 * El tercer parámetro tiene DEFAULT y el default es vocabulario de marcas
 * nominales, porque es donde nació. Pero el operador no es de marcas: es «estos dos
 * tipos no se confunden», y sirve igual para un par rol⇒forma. Sin el mensaje
 * propio, una aserción sobre `RoleFor<…>` falla diciendo «la marca no separa» y
 * manda a leer `identity.ts`, que no tiene nada que ver — falla cuando tiene que
 * fallar y manda a buscar el bug al lugar equivocado, que es la mitad del trabajo
 * de un diagnóstico. Hoy NINGUNA aserción usa el default: TODAS pasan el suyo, y así
 * conviene que siga. Queda como red para que agregar una no obligue a inventar el
 * mensaje en el mismo minuto, no como opción legítima — y por eso el censo de abajo
 * cuenta las dos cosas por separado, para que «ninguna usa el default» tampoco quede
 * sostenido por esta frase.
 *
 * CENSO(numbers.mjs): 14 llamadas a NotAssignableTo, 14 con mensaje propio
 *
 * Son `_S1`–`_S8`, `_GuardFires`, `_IllegalPairStaysIllegal`, `_FrameRequired` y
 * `_FingerprintIsBranded`. Los invariantes 10 y 11 usan `FitsIn` y no este operador.
 * Las dos que entraron en el paso 3a son `_S7` y `_S8`, las dos referencias del
 * tramo 5 (PROVISIONAL(#75) en `outputs.ts`). La cifra la sigue derivando el AST: si
 * este párrafo se corrige a medias otra vez, `numbers.mjs` lo dice.
 *
 * LA CIFRA LA DERIVA EL AST DESDE ESTE BLOQUE, y hay motivo. Estuvo sostenida a mano
 * desde el bloque 4 y falló exactamente como falla una cifra a mano: se publicó
 * «nueve», el bloque 3b la recontó y eran diez —la décima entró con D24—, y la
 * corrección arregló UNA de las dos apariciones: dos párrafos más arriba esta misma
 * ficha siguió diciendo «las nueve pasan el suyo» hasta hoy. O sea que el recuento a
 * mano no solo caduca: caduca a medias, y la mitad que queda es indistinguible de la
 * que se revisó. Es la tercera vez que el paquete publica mal un número de este tipo
 * (`M9c` en `params.ts` —la cifra invertida que aprobaba el árbol mutado y rechazaba
 * el sano— y «los siete» de la familia de hashes en `identity.ts`), y las tres se
 * cierran igual: `scripts/numbers.mjs` cuenta las instanciaciones en el AST, las
 * contrasta contra la línea `CENSO(numbers.mjs)` de acá arriba y falla nombrando las
 * dos. Su mutante es M50.
 *
 * El nombre es del bloque 4 (GLOSARIO.md, D7): `NotAssignableTo` es la semántica
 * exacta de TypeScript y CONSERVA LA DIRECCIÓN. `Separates<A,B>` se lee simétrico y
 * el operador no lo es. Es el criterio que este bloque le aplicó al operador hermano,
 * que se llamaba `Covers` y hoy se llama `FitsIn`.
 */
type NotAssignableTo<
  From,
  To,
  Message extends string = "these two types do not separate",
> = [From] extends [To] ? { "IR-ERR": [Message, From, To] } : true;

// Toda la familia está habitada. Es la propiedad que se rompió.
type _H1 = True<Inhabited<ByteHash>>;
type _H2 = True<Inhabited<NodeFingerprint>>;
type _H3 = True<Inhabited<ContextualFingerprint>>;
type _H4 = True<Inhabited<EmbeddingKey>>;
type _H5 = True<Inhabited<MatterHash>>;
type _H6 = True<Inhabited<CacheKey>>;

// Y separa: los roles no se confunden entre sí ni con un `string` pelado. Cada uno
// dice QUÉ se confundió con qué, porque el mensaje es lo único que el desarrollador
// va a leer: el tipo del error ya trae los dos operandos, pero no por qué importan.
type _S1 = True<
  NotAssignableTo<NodeFingerprint, EmbeddingKey, "a node fingerprint is accepted as an embedding key">
>;
type _S2 = True<
  NotAssignableTo<NodeFingerprint, ByteHash, "a node fingerprint is accepted as a byte hash">
>;
type _S3 = True<
  NotAssignableTo<ContextualFingerprint, EmbeddingKey, "a contextual fingerprint is accepted as an embedding key">
>;
type _S4 = True<
  NotAssignableTo<MatterHash, CacheKey, "a matter hash is accepted as a cache key">
>;
type _S5 = True<
  NotAssignableTo<string, NodeFingerprint, "a bare string is accepted as a node fingerprint — the brand stopped requiring asNodeFingerprint()">
>;
type _S6 = True<
  NotAssignableTo<ElementId, LocalId, "an ElementId is accepted as a LocalId — minted and adapter-local ids no longer separate">
>;

// LAS DOS DEL PASO 3a. `_S6` dice que los dos ESPACIOS DE ID no se confunden; estas
// dicen que las dos SALIDAS DEL TRAMO 5 tampoco, que no se sigue de aquella: un tipo
// genérico mal parametrizado —`type LocalFragment = Fragment<ElementId>`— deja `_S6`
// intacta y colapsa igual los dos extremos del pipeline.
//
// Van sobre `StableFragment`, y hasta el paso 12 NO PODÍAN: este comentario decía
// «van sobre `Fragment<ElementId>` y no sobre `StableFragment`», porque aquel tipo
// llevaba DOS CAMPOS DE MÁS y contra él la no-asignabilidad se cumplía sola —por los
// campos ausentes— y habría seguido cumpliéndose con las dos referencias IGUALES. Era
// la diferencia entre acreditar y aparentar, y obligaba a escribir el tipo a mano.
// El paso 12 mudó esos dos campos a `IdentifiedFragment` (GLOSARIO.md, P23/P24), así
// que ahora lo ÚNICO que separa a los dos tipos es `Ref` y la fila puede nombrarlos.
//
// EL PELIGRO NO DESAPARECIÓ: SE VOLVIÓ LATENTE, y va escrito para que no se redescubra
// caro. El día que alguien le agregue UN campo a `StableFragment`, `_S7` vuelve a
// cumplirse por ese campo y deja de fijar el espacio de referencias — en verde, y sin
// que M54 avise, porque M54 seguiría rompiendo igual (por el campo, no por `Ref`). No
// tiene mutante propio: la mutación que lo mostraría es «agregar un campo Y aplicar
// M54», y este corredor aplica una fila por vez. Lo que sí lo contiene es la regla de
// P24 — los campos que un fragmento gana al adquirir identidad propia van a
// `IdentifiedFragment`, y `StableFragment` no se ensancha.
type _S7 = True<
  NotAssignableTo<LocalFragment, StableFragment, "a tramo-5 fragment is accepted where a reconciled one is required — the two ref spaces of Fragment collapsed">
>;
type _S8 = True<
  NotAssignableTo<LocalDataRecord, StableDataRecord, "a tramo-5 data record is accepted where a reconciled one is required — the two ref spaces of DataRecord collapsed">
>;

/**
 * Pero una huella SIGUE siendo un `string` hacia afuera: se concatena y sirve de
 * clave de mapa sin ceremonia. Una marca que obligue a desmarcar para usarla no
 * la usa nadie.
 *
 * Hasta el bloque 4 esta era la ÚNICA aserción del archivo que fallaba MUDA:
 * `True<NodeFingerprint extends string ? true : false>` no viola la regla del
 * archivo —`false` no es asignable a `true`, así que rompe— pero rompe con un
 * `TS2344` pelado que dice «Type 'false' does not satisfy the constraint 'true'» y
 * no dice QUÉ se rompió, en un archivo cuya tesis es que el mensaje es lo único que
 * el desarrollador va a leer. Ahora pasa por `FitsIn` y habla.
 *
 * SIGUE SIN MUTANTE, y la razón está en el encabezado: la única edición que la
 * dispara rompe primero en los 15 constructores `as*` de `identity.ts` (más el de
 * `provenance.ts`, que se fue con `DelegationId` en este bloque).
 */
type _UsableAsString = True<
  FitsIn<
    NodeFingerprint,
    string,
    "a NodeFingerprint is no longer usable as a string — the brand stopped being an intersection, and every concatenation and map key that treats it as text broke"
  >
>;

/**
 * La guarda de `Nominal` dispara: marcar sobre marcado da un OBJETO de error, no
 * un string marcado. Si alguien sacara la guarda, `_BrandOverBrand` volvería a
 * ser `never`, `never extends string` es cierto, y esta línea deja de compilar.
 */
type _BrandOverBrand = Nominal<NodeFingerprint, "Other">;
type _GuardFires = True<
  NotAssignableTo<_BrandOverBrand, string, "branding an already branded type yielded a string — the Nominal guard is gone">
>;

/**
 * LA MARCA TIENE UN PRODUCTOR, Y EL PRODUCTOR LA USA (D24, bloque 3b).
 *
 * `_S5` prueba que un `string` pelado no entra donde va un `NodeFingerprint`. Eso es
 * la mitad: prueba que la marca SEPARA, no que alguien la PONGA. Mientras
 * `fingerprintOf` devolvió `string` —el único productor de huellas del paquete— la
 * familia entera no tenía un solo productor tipado y `_S5` estuvo en verde igual.
 * Fue el quinto caso de garantía verde y falsa de este paquete: la promesa era de la
 * prosa, no del tipo.
 *
 * Se assertea sobre `ReturnType<typeof fingerprintOf>` y no sobre una firma copiada
 * acá, porque una firma copiada es otra vez dos fuentes que pueden discrepar.
 *
 * LA MITAD QUE NO SE ESCRIBE, dicho de frente: que el retorno sea EXACTAMENTE
 * `NodeFingerprint` y no otra marca de la familia (`FitsIn<ReturnType<…>,
 * NodeFingerprint>`). Se omite porque no hay edición de UNA línea que la dispare —
 * cambiar el constructor por `asMatterHash` rompe en la línea de `fingerprintOf`,
 * contra su propia anotación de retorno, y para escaparse hace falta cambiar
 * coordinadamente la anotación TAMBIÉN. Es el mismo criterio con el que el bloque 4
 * dejó seis aserciones sin mutante: sin mutación plausible, la fila acreditaría al
 * compilador. Queda escrito, no escondido.
 */
type _FingerprintIsBranded = True<
  NotAssignableTo<
    string,
    ReturnType<typeof fingerprintOf>,
    "fingerprintOf returns a bare string — the only producer of the node fingerprint brand stopped applying it, so nothing forces a fingerprint to be branded (D24)"
  >
>;

export type BRAND_PROOFS = readonly [
  _H1, _H2, _H3, _H4, _H5, _H6,
  _S1, _S2, _S3, _S4, _S5, _S6, _S7, _S8,
  _UsableAsString,
  _GuardFires,
  _FingerprintIsBranded,
];

// ═════════ Invariante 4 · «código siempre `solo`» sigue siendo exacto ════════
// La anotación de `COHESION_BY_ROLE` dice que los tres atómicos son LITERALES «a
// propósito: ensancharlos a `Cohesion` deja pasar `"normal"` en verde». Esa frase
// describía una propiedad que NADA verificaba: ensanchar el campo a `Cohesion` y
// escribir `code: "normal"` compilaba en verde, y el invariante del banco «código
// siempre `solo`» (§{Invariantes}) —que la anotación dice IMPONER— se apagaba mudo.
// Acá el campo se obliga a ser EXACTAMENTE `"solo"`, no un supertipo suyo.

type _CodeIsSolo = True<
  FitsIn<
    (typeof COHESION_BY_ROLE)["code"],
    "solo",
    "COHESION_BY_ROLE.code widened past the literal and no longer forces solo"
  >
>;
type _FormulaIsSolo = True<
  FitsIn<
    (typeof COHESION_BY_ROLE)["formula"],
    "solo",
    "COHESION_BY_ROLE.formula widened past the literal and no longer forces solo"
  >
>;
type _ImageIsSolo = True<
  FitsIn<
    (typeof COHESION_BY_ROLE)["image"],
    "solo",
    "COHESION_BY_ROLE.image widened past the literal and no longer forces solo"
  >
>;

export type COHESION_PROOFS = readonly [_CodeIsSolo, _FormulaIsSolo, _ImageIsSolo];

// ══════════ Invariante 5 · el `satisfies` de REQUIRED_SHAPE sigue atando ══════
// Su docstring dice que ese `satisfies` es LOAD-BEARING: sin él
// `RoleWithRequiredShape` queda disjunto de `Role`, `RoleFor<F>` pasa a ser los 15
// roles para toda forma, la anotación de `ROLE_BY_SHAPE` deja de restringir e
// `ILLEGAL_PAIRS` queda vacío — «sacarlo no rompe nada: apaga tres garantías en
// silencio». El silencio era literal: sacarlo compilaba. Las dos líneas van POR
// SEPARADO porque miden cosas distintas e independientes — que las claves SEAN
// roles, y que la pareja obligatoria efectivamente RESTRINJA.
//
// Y esa segunda mitad estuvo escrita desde el bloque 1b SIN NADIE QUE LA
// ACREDITARA: M8 cubría solo la primera. La acredita M44, sacándole `code` a
// `REQUIRED_SHAPE` — que no rompe el `satisfies`, no deja imports huérfanos y no
// cambia ninguna firma: `RoleFor<'text_span'>` simplemente pasa a admitir `code`.

/** Las 5 claves del mapa son roles de verdad. Muere si el `satisfies` se va. */
type _RequiredShapeKeysAreRoles = True<
  FitsIn<
    RoleWithRequiredShape,
    Role,
    "REQUIRED_SHAPE keys are no longer Role — did the satisfies go away?"
  >
>;

/** Y restringen: `code` exige `verbatim`, así que no es rol válido para `text_span`. */
type _IllegalPairStaysIllegal = True<
  NotAssignableTo<
    "code",
    RoleFor<"text_span">,
    "RoleFor<text_span> admits code — the required pair stopped restricting and text_span ⇒ code compiles"
  >
>;

export type PAIR_PROOFS = readonly [
  _RequiredShapeKeysAreRoles,
  _IllegalPairStaysIllegal,
];

// ══════════ Invariante 6 · el dominio del barrido sigue siendo 15 × 6 ═════════
// El barrido exhaustivo del banco es «15×6 = 90» (§{Estrategia}), y hasta acá esas
// dos cifras no estaban atadas a nada: borrar un rol de `ROLES` bajaba el dominio
// de 90 a 84 y los cuatro comandos seguían en verde. Fijarlas es un COMPROMISO
// DELIBERADO con el plan, no una comodidad: agregar o quitar un rol tiene que
// romper acá, para que el plan y el barrido se actualicen en el mismo commit.
//
// Las dos cifras son literales de TIPO, no valores. Por eso `scripts/numbers.mjs`
// —que prohíbe literales numéricos fuera de `params.ts`— no las cuenta: un literal
// de tipo no puede decidir comportamiento en runtime, que es lo que la regla de
// `params.ts` existe para gobernar. Fijar un hecho del contrato es lo contrario de
// inventar un umbral.
//
// Las dos mitades tienen mutante desde el bloque 4: M14 la de los roles (bloque 1b)
// y M43 la de las formas, que estuvo escrita sin fila propia hasta acá. M43 DUPLICA
// una forma en vez de borrarla, porque borrarla dispara primero `_ArrayCoversShapes`
// y la fila acreditaría el invariante 1.

type _FifteenRoles = True<
  FitsIn<
    (typeof ROLES)["length"],
    15,
    "ROLES no longer has 15 roles: the 15×6 = 90 sweep (§{Estrategia}) walks a different domain"
  >
>;
type _SixShapes = True<
  FitsIn<
    (typeof SHAPES)["length"],
    6,
    "SHAPES no longer has 6 shapes: the 15×6 = 90 sweep (§{Estrategia}) walks a different domain"
  >
>;

export type DOMAIN_PROOFS = readonly [_FifteenRoles, _SixShapes];

// ═══════ Invariante 7 · la coordenada sigue siendo lo que dice ser ═══════════
// Las cinco propiedades de `location.ts` que estaban escritas en prosa y no las
// ejecutaba nadie. Las cinco se pueden apagar con una edición de un carácter y
// ninguna se pone roja sola:
//
//   · `SourceRange` es `Extract<Coordinate, {space:"grid"}>`. Un `Extract` que no
//     matchea NO es un error: es `never`, y `never` es asignable a todo, así que
//     mover el tag una letra deja `DataRecord.coordinate` (§{Las dos salidas})
//     aceptando cualquier cosa, en verde. Es la falla de la familia de hashes en
//     otro archivo.
//   · El vocabulario de `space` es un COMPROMISO con el plan, igual que
//     `ROLES.length === 15`: agregar o sacar una variante tiene que romper acá para
//     que los doce adaptadores y todo consumidor exhaustivo se actualicen en el
//     mismo commit. Las dos direcciones van POR SEPARADO —una dice «entró algo»,
//     la otra «se fue algo»— porque son fallas distintas. Y hasta el bloque 4 solo
//     la primera tenía mutante (M25): `_SpacesPresent` estaba escrita y nadie la
//     había visto disparar. La acredita M45, BORRANDO una variante — renombrarle el
//     tag dispara también `_SpacesDeclared` y la fila acreditaría M25 de nuevo.
//   · `within` recursivo es lo único que hace citable la cadena del caso canónico
//     (§{La delegación es emergente}); aplanarlo a un solo nivel compila.
//   · `Box.frame` obligatorio es lo que impide que las cajas de 40 diapositivas
//     convivan en un plano; volverlo opcional no rompe `boxContains`, que
//     compararía `undefined !== undefined` y daría `false`.

type _SourceRangeExists = True<
  Inhabited<
    SourceRange,
    "SourceRange collapsed to never — the grid variant of Coordinate lost its tag and DataRecord.coordinate now accepts anything"
  >
>;
type _SpacesDeclared = True<
  FitsIn<
    Coordinate["space"],
    "source" | "text" | "grid" | "visual" | "time",
    "Coordinate gained a space: every exhaustive consumer and the twelve adapters walk a different domain"
  >
>;
type _SpacesPresent = True<
  FitsIn<
    "source" | "text" | "grid" | "visual" | "time",
    Coordinate["space"],
    "Coordinate lost a space: something that used to be citable no longer is"
  >
>;
type _WithinIsRecursive = True<
  FitsIn<
    Location["within"][number],
    Location,
    "Location.within stopped being recursive — the chained citation (contract.pdf → pg3 → image) is no longer expressible"
  >
>;
type _FrameRequired = True<
  NotAssignableTo<
    undefined,
    Box["frame"],
    "Box.frame became optional — boxes from different frames share one plane and contain each other"
  >
>;

export type COORDINATE_PROOFS = readonly [
  _SourceRangeExists,
  _SpacesDeclared,
  _SpacesPresent,
  _WithinIsRecursive,
  _FrameRequired,
];

// ════ Invariante 8 · los cuatro campos del envoltorio siguen marcados (H3/H13) ══
// Los cuatro entraron en el bloque 3 porque el dato que llevan NO SE RECONSTRUYE a
// posteriori: en qué versión de bytes apareció un nodo, de qué organización es esa
// fila del índice, dónde están los bytes originales, y QUIÉN curó. Los cuatro son
// marcas nominales sobre `string`, y ahí está el problema: la edición que los rompe
// NO es borrarlos —eso se ve en el diff y rompe a todos los consumidores— sino
// cambiarles la marca por otra de la MISMA FAMILIA. Las cuatro compilan:
// `ObjectKey → DocumentId`, `ByteHash → ContentHash`, `OrganizationId → DocumentId`
// y `ActorId → string` son todos `string` por debajo, así que ninguna línea de
// código deja de funcionar y el campo sigue existiendo, direccionando lo que no es.
//
// Verificado sin estas aserciones: tres de las cuatro mutaciones NO ROMPÍAN NADA, y
// la cuarta rompía por casualidad —`TS6196`, un import que quedaba huérfano—, o sea
// acreditando el linter en vez del contrato. Ver M32–M35 en `scripts/mutants.mjs`.
//
// Cada campo va en DOS aserciones, no en una intersección: hacia adelante agarra el
// cambio de marca y el ensanchamiento a `string`; hacia atrás agarra el colapso a
// `never`, que es asignable a todo y pasaría la primera en verde. Es la misma razón
// por la que `SourceRange` necesita `Inhabited` además de su tag.
//
// LAS CUATRO DE ATRÁS NO TIENEN MUTANTE Y NO LO VAN A TENER — ver el encabezado.
// Hasta el bloque 4 compartían mensaje con su mitad de adelante, así que si alguna
// disparara mandaría a leer lo que no es. Ahora cada una dice lo suyo.

type _IngestionVersionIsBytes = True<
  FitsIn<
    Ingestion["version"],
    ByteHash,
    "Ingestion.version is no longer the ByteHash of the received bytes"
  >
>;
type _IngestionVersionInhabited = True<
  FitsIn<
    ByteHash,
    Ingestion["version"],
    "Ingestion.version collapsed to never — the field still typechecks everywhere and addresses nothing"
  >
>;

type _OriginalIsAnObject = True<
  FitsIn<
    Ingestion["original"],
    ObjectKey,
    "Ingestion.original stopped being an ObjectKey — the verbatim asset is addressed by a Postgres row instead of an object"
  >
>;
type _OriginalInhabited = True<
  FitsIn<
    ObjectKey,
    Ingestion["original"],
    "Ingestion.original collapsed to never — the field still typechecks everywhere and addresses nothing"
  >
>;

type _VersionOrganizationSeparates = True<
  FitsIn<
    NodeInVersion["organization"],
    OrganizationId,
    "NodeInVersion.organization stopped being an OrganizationId — the hash → document lookup filters by the wrong thing and crosses tenants"
  >
>;
type _VersionOrganizationInhabited = True<
  FitsIn<
    OrganizationId,
    NodeInVersion["organization"],
    "NodeInVersion.organization collapsed to never — the field still typechecks everywhere and filters nothing"
  >
>;

type _AnnotationActorIsActor = True<
  FitsIn<
    Annotation["actor"],
    ActorId,
    "Annotation.actor stopped being an ActorId — curation is no longer attributable and the dedup key stops separating two curators"
  >
>;
type _AnnotationActorInhabited = True<
  FitsIn<
    ActorId,
    Annotation["actor"],
    "Annotation.actor collapsed to never — the field still typechecks everywhere and attributes nothing"
  >
>;

export type WRAPPER_PROOFS = readonly [
  _IngestionVersionIsBytes,
  _IngestionVersionInhabited,
  _OriginalIsAnObject,
  _OriginalInhabited,
  _VersionOrganizationSeparates,
  _VersionOrganizationInhabited,
  _AnnotationActorIsActor,
  _AnnotationActorInhabited,
];

// ═════════ Invariante 9 · el orden de `Certainty` va en el sentido que dice ═════
// `CERTAINTY_RANK` (`classification.ts`) cerró un hueco real: hasta el bloque 3 el
// paquete no exportaba NINGÚN orden sobre `Certainty`, y `Fragment.minCertainty`
// prometía «la peor certeza de los nodos agrupados», que no era computable con lo
// que el contrato daba.
//
// Pero una tabla de dos filas se invierte con una edición de dos palabras, y las dos
// versiones compilan: `Record<Certainty, number>` no dice nada de los valores. Y
// invertida no es un bug cualquiera — marca como `declared` lo que el pipeline
// ADIVINÓ, o sea la promesa de §{La escalera} exactamente al revés, y en el único
// dato que el plan hace viajar «hasta la skill que consuma esa memoria».
//
// Las dos cifras son literales de TIPO, igual que el `15` de `ROLES`: no deciden
// comportamiento en runtime, así que `scripts/numbers.mjs` no las cuenta. Fijar un
// hecho del contrato es lo contrario de inventar un umbral.

type _DeclaredIsBest = True<
  FitsIn<
    (typeof CERTAINTY_RANK)["declared"],
    0,
    "CERTAINTY_RANK.declared moved: the ladder now ranks what the pipeline GUESSED as the safest certainty"
  >
>;
type _InferredIsWorst = True<
  FitsIn<
    (typeof CERTAINTY_RANK)["inferred"],
    1,
    "CERTAINTY_RANK.inferred moved: the ladder now ranks a guess above a declared fact"
  >
>;

export type CERTAINTY_PROOFS = readonly [_DeclaredIsBest, _InferredIsWorst];

// ══════ Invariante 10 · la cadena que corta la recursión sigue siendo materia ══
// `Context.ancestors` es lo único que corta la recursión de la delegación
// (§{Dónde frena}). Es la MISMA familia que el invariante 8 —una marca nominal sobre
// `string` en un campo que nadie reconstruye después— con un agravante que lo pone
// en otra categoría: acá el campo no direcciona un dato, DECIDE SI EL PROCESO
// TERMINA.
//
// Cambiarle la marca por otra de la familia (`ByteHash`, `ContentHash`) o
// ensancharla a `string` compila, no rompe una línea, y la guarda de ciclo pasa a
// comparar hashes de otra cosa. Y el paquete YA DECLARÓ que ahí no hay red: el #7 de
// `adapter.ts` dice textualmente que «el invariante "la recursión termina"
// (§{Invariantes}) no se sigue de las reglas escritas» y que separar los contadores
// «le devuelve a la recursión una medida decreciente». Esa medida se apoya en que la
// cadena sea de materia.
//
// Acreditado por M41. Sin él: NO ROMPÍA. La fila lleva un SEGUNDO cambio que
// reexporta `MatterHash` en `adapter.ts`, porque la mutación natural deja el import
// huérfano y `TS6133` mataría la corrida antes del testigo — la trampa de M33,
// calcada.

type _AncestorsAreMatter = True<
  FitsIn<
    Context["ancestors"][number],
    MatterHash,
    "Context.ancestors is no longer a chain of MatterHash — the cycle guard compares hashes of another family and the recursion has no decreasing measure"
  >
>;
type _AncestorsInhabited = True<
  FitsIn<
    MatterHash,
    Context["ancestors"][number],
    "Context.ancestors collapsed to never — the chain still typechecks everywhere and can hold nothing, so the cycle guard never fires"
  >
>;

export type RECURSION_PROOFS = readonly [_AncestorsAreMatter, _AncestorsInhabited];

// ══════════ Invariante 11 · el orden de `EVIDENCE_SCALE` es el del plan ═══════
// `Evidence` no lleva sus seis números escritos: los DERIVA del orden de este
// arreglo, y el #429 de `adapter.ts` explica por qué eso es mejor que seis
// constantes a mano — «elimina la posibilidad de que la escala y los valores
// diverjan».
//
// Lo que esa decisión NO compra, y el docstring no decía: que el orden SIGA siendo
// el del plan. Mover una fila cambia los seis números a la vez —`Signature` deja de
// ser 4, `Floor` deja de ser 0— sin un solo error. Y `Floor = 0` no es decorativo:
// el filtro del selector es `x.e > Evidence.None` y el criterio de `achievedLevel`
// es `evidence > Floor`. Con la escala movida cambia QUIÉN GANA CADA ARCHIVO entre
// los doce adaptadores y qué cae al piso de texto, en verde.
//
// Es la misma familia que `ROLES.length === 15`, `Coordinate['space']` y
// `CERTAINTY_RANK`: un hecho del contrato atado para que cambiarlo sea un ACTO
// VISIBLE.
//
// El literal es una TUPLA DE STRINGS, no un número: `scripts/numbers.mjs` no tiene
// nada que contar acá, y el orden queda fijado sin escribir un solo `4` — que es
// mejor que la solución obvia (asertar `Evidence.Signature === 4`), porque
// `valueOfEvidence` devuelve `number` y esa aserción ni siquiera sería expresable a
// nivel de tipo.
//
// Acreditado por M42, con MC7 como control: el orden que decide los seis números es
// el del ARREGLO, no el del objeto que los expone. Un testigo que también se pusiera
// rojo al reordenar las claves de `Evidence` estaría fijando prosa.

type _EvidenceScaleOrder = True<
  FitsIn<
    typeof EVIDENCE_SCALE,
    readonly ["None", "Floor", "Content", "Extension", "Structure", "Signature"],
    "EVIDENCE_SCALE was reordered: the six values of Evidence are derived from this order (§{Evidencia}), so Signature is no longer 4 and Floor is no longer 0 — which adapter wins a file changed"
  >
>;

export type EVIDENCE_PROOFS = readonly [_EvidenceScaleOrder];

// ════ Invariante 12 · el adaptador de canal no puede entrar al concurso ══════
// Nace en el paso 5, y las cuatro pruebas de acá son las cuatro frases que hasta
// ayer eran prosa en `adapter.ts`.
//
// La frase que gobierna todo el paso es «la cintura no tiene forma de documento»
// (§{Orden}), y el chat es su caso testigo: no tiene extensión, ni bytes que
// sondear, ni un documento del que heredar la autoría. Hasta el paso 4 eso se
// resolvía haciendo que el chat fabricara una sonda con cinco campos vacíos y
// ganara el concurso por origen. Fabricar la sonda TIPA IGUAL DE BIEN que traerla
// de un archivo, así que esa era una garantía de peldaño 5: un booleano en runtime
// que nadie lee.
//
// Las cuatro se assertean POR SEPARADO y ninguna se intersecta: `true & {error}`
// sigue siendo asignable a `true`, que es la regla del encabezado de este archivo.

/** Error si `K` es OPCIONAL en `T`. `Required` es lo único que lo distingue. */
type RequiredKey<T, K extends keyof T, Message extends string> = Pick<T, K> extends Required<
  Pick<T, K>
>
  ? true
  : { "IR-ERR": [Message, K, T] };

// (a) Un adaptador de canal NO es un adaptador de archivo — le falta `evidence`, y
// `opaqueOf` (la única puerta al registro) pide un `FileAdapter`.
//
// LAS DOS INSTANCIAS COMPARTEN `S` Y `E` A PROPÓSITO. Con `ChannelAdapter<Sig,
// string>` la prueba también se pondría verde, pero por el desfase de la ENTRADA —
// acreditando que `string` no es `Source`, que no es lo que esta línea afirma. Con
// `Source` en los dos lados, la ÚNICA diferencia que queda es `evidence`, y si
// alguien se la agrega a `ChannelAdapter` esta prueba se cae. El retorno más
// angosto de `decompose` (`AuthoredUnit` en vez de `Unit`) no interfiere: los
// retornos son covariantes, así que no bloquea la asignación por su cuenta.
type _ChannelIsNotSelectable = True<
  NotAssignableTo<
    ChannelAdapter<Record<string, never>, Source>,
    FileAdapter<Record<string, never>>,
    "a ChannelAdapter became assignable to FileAdapter — it can now enter the registry and compete for bytes it was never meant to read"
  >
>;

// (b) La unidad de un adaptador de ARCHIVO no puede llevar autoría. `RawNode` es lo
// que se cachea por `hashBytes` cruzando organizaciones (§{Caché}), así que una
// autoría escrita acá o se propaga al tenant equivocado o —lo que de hecho pasaba—
// se cae en `opaqueOf` sin un aviso.
type _UnitHasNoAuthorship = True<
  WithoutKey<
    Unit<unknown>,
    "ownAuthorship",
    "Unit carries authorship again — a file adapter can now write into the tree that is cached across organizations, and opaqueOf drops it silently"
  >
>;

// (c) La del adaptador de CANAL sí, y OBLIGATORIA. Con `?` el adaptador compila sin
// ella y la corrida atribuye cada mensaje a quien lo mandó por MCP en vez de a quien
// lo dijo — que es la mitad del valor de la memoria (§{Tramo 3 › Qué sale}).
type _AuthoredUnitRequiresAuthorship = True<
  RequiredKey<
    AuthoredUnit<unknown>,
    "ownAuthorship",
    "AuthoredUnit.ownAuthorship became optional — a channel adapter can now forget it, and every message gets attributed to whoever invoked the MCP tool"
  >
>;

// (d) P14, en sus dos mitades. La entrada del registro NO es `unknown` —esa es la
// que se rompió y hay que verla romperse— y ADEMÁS es `Source`. Separadas porque la
// primera sola se quedaría verde si alguien la cambiara a `Uint8Array`, y la segunda
// sola es vacua si `Source` colapsara.
type _RegistryInputIsNotUnknown = True<
  NotAssignableTo<
    unknown,
    Parameters<OpaqueAdapter["recognize"]>[0],
    "OpaqueAdapter.recognize takes unknown again — recognize(42, ctx) compiles, and P14 is back open at every call site"
  >
>;
type _RegistryInputIsSource = True<
  FitsIn<
    Parameters<OpaqueAdapter["recognize"]>[0],
    Source,
    "OpaqueAdapter.recognize stopped taking a Source — the registry is heterogeneous again and the type no longer says what an adapter reads"
  >
>;

export type CHANNEL_PROOFS = readonly [
  _ChannelIsNotSelectable,
  _UnitHasNoAuthorship,
  _AuthoredUnitRequiresAuthorship,
  _RegistryInputIsNotUnknown,
  _RegistryInputIsSource,
];

// ════ Invariante 13 · el núcleo decide si un adaptador puede correr ══════════
// Nace en el paso 6. Las cuatro sostienen un solo mecanismo, y el mecanismo existe
// para separar dos estados que desde afuera son IDÉNTICOS —un `asset` sin hijos— y
// que tienen destinos opuestos:
//
//     no se intentó · faltaba la capacidad   →  se anota y se reintenta
//     se intentó    · devolvió lo mismo      →  punto fijo, terminó para siempre
//
// Sin la separación, la foto de un gato —que descompone en una sola región
// pictórica, o sea en sí misma— vuelve a la cola en cada pasada, para siempre.

// (a) LA PIEDRA ANGULAR: un nombre de capacidad ES un nombre de campo de `Context`.
// Es lo que vuelve genérico el chequeo del núcleo —`ctx[c] === null`— sin una tabla
// de correspondencia que alguien mantenga al día. Si los dos vocabularios se
// separan, el núcleo pasa a preguntar por un campo que no existe: `undefined !==
// null`, así que la capacidad se da por PRESENTE y el adaptador se invoca en un
// contexto que no puede satisfacerlo. Falla hacia el lado peligroso, y en silencio.
type _CapabilityIsAContextField = True<
  FitsIn<
    Capability,
    keyof Context,
    "a Capability stopped naming a Context field — the core now probes a key that does not exist, reads undefined instead of null, and invokes adapters in contexts that cannot serve them"
  >
>;

// (b) `requires` es del conjunto CERRADO, no `string[]`. Con strings sueltos un typo
// —`"percieve"`— es un adaptador que no corre nunca y nadie se entera: el núcleo
// busca un campo inexistente y cae en la misma rama de (a).
type _RequiresIsClosed = True<
  FitsIn<
    Adapter<unknown, unknown>["requires"],
    readonly Capability[],
    "Adapter.requires widened past the closed set — a typo in a capability name is now an adapter that silently never runs"
  >
>;

// (c) `Context.perceive` ADMITE `null`, y eso es la mitad del corte entre el hilo
// rápido y el worker. Si dejara de admitirlo, el contexto del request no sería
// construible sin un modelo, y «lo pesado no bloquea» volvería a ser una regla que
// alguien respeta en vez de algo que ese contexto NO PUEDE hacer.
type _PerceiveCanBeAbsent = True<
  FitsIn<
    null,
    Context["perceive"],
    "Context.perceive stopped admitting null — a context without a perceptual model is no longer expressible, so the request thread has to carry one and heavy work is back on it"
  >
>;

// (d) La lápida se sostiene: el `asset` no vuelve a llevar trabajo pendiente. Ver el
// razonamiento en `shapes.ts` — el cuerpo se regenera entero en cada re-ingesta y
// está fuera de la huella, así que no puede registrar nada durable.
type _AssetCarriesNoPendingWork = True<
  WithoutKey<
    Extract<Body, { readonly shape: "asset" }>,
    "deferred",
    "the asset body carries deferred work again — it is regenerated whole on every re-ingest and excluded from the fingerprint, so it cannot durably record anything; pending belongs to Run, not to the content"
  >
>;

export type CHANNEL_CAPABILITY_PROOFS = readonly [
  _CapabilityIsAContextField,
  _RequiresIsClosed,
  _PerceiveCanBeAbsent,
  _AssetCarriesNoPendingWork,
];

// ═══ Invariante 14 · los tres canales del reconciliador siguen siendo obligatorios ═
// Los tres campos que el paso 11 agregó a `ReconciliationMetrics` NO son marcas
// nominales como los del invariante 8: son `number` pelado. Así que la mutación que
// los mata no es cambiarles la marca —no tienen— sino **volverlos opcionales**, y esa
// es la edición de UN CARÁCTER que alguien hace de buena fe para «no romper a los que
// ya construyen el objeto».
//
// Por qué eso es catastrófico y no cosmético: los tres existen porque una promesa del
// plan es falsa sin ellos. Con `comparisons?`, un reconciliador que no lo reporta
// compila, y `PARAMETERS.identity.maxComparisons` —que el plan declara MEDIBLE— se
// queda para siempre sin instrumento, o sea que el tope se elige a ojo. Con
// `uncompared?`, agotar el presupuesto vuelve a ser invisible y «nunca se trunca en
// silencio» deja de ser verdad. Con `ambiguous?`, el peor modo de falla del tramo
// —la huella deja de cubrir una forma, todo hashea igual, la identidad colapsa— pierde
// su única señal en la primera ingesta.
//
// LA ASERCIÓN DE IDA ES LA QUE TRABAJA, y conviene decir por qué alcanza: un campo
// opcional hace que `ReconciliationMetrics["comparisons"]` sea `number | undefined`,
// que NO cabe en `number`. La misma aserción agarra además el ensanchamiento a
// `string`. La de vuelta agarra el colapso a `never`, que es asignable a todo y
// pasaría la primera en verde — mismo par y misma razón que el invariante 8. Y como
// allá, LAS TRES DE ATRÁS NO TIENEN MUTANTE: cada una dice lo suyo para que si alguna
// dispara no mande a leer lo que no es, pero colapsar un campo a `never` no es una
// edición que alguien haga de buena fe, que es el filtro con el que este corredor
// decide qué fila merece existir.
//
// `MintFn` va en esta banda y no en la del invariante 8 porque no es un campo sino una
// FIRMA, y se assertea sobre `ReturnType<MintFn>` por el precedente de `fingerprintOf`:
// sobre la firma real, no sobre una copia que pueda discrepar. Si devolviera `string`,
// cualquier función que produzca texto entra como acuñador y el reconciliador reparte
// ids sin marca — que es exactamente el agujero que `asElementId` existe para tapar.

type _ComparisonsIsRequiredCount = True<
  FitsIn<
    ReconciliationMetrics["comparisons"],
    number,
    "ReconciliationMetrics.comparisons became optional or stopped being a count — the only channel that could ever measure maxComparisons reports nothing, and the plan declares that parameter measurable"
  >
>;
type _ComparisonsInhabited = True<
  FitsIn<
    number,
    ReconciliationMetrics["comparisons"],
    "ReconciliationMetrics.comparisons collapsed to never — the field still typechecks everywhere and counts nothing"
  >
>;

type _UncomparedIsRequiredCount = True<
  FitsIn<
    ReconciliationMetrics["uncompared"],
    number,
    "ReconciliationMetrics.uncompared became optional or stopped being a count — exhausting the comparison budget is invisible again and «never truncates silently» goes back to being false"
  >
>;
type _UncomparedInhabited = True<
  FitsIn<
    number,
    ReconciliationMetrics["uncompared"],
    "ReconciliationMetrics.uncompared collapsed to never — the field still typechecks everywhere and counts nothing"
  >
>;

type _AmbiguousIsRequiredCount = True<
  FitsIn<
    ReconciliationMetrics["ambiguous"],
    number,
    "ReconciliationMetrics.ambiguous became optional or stopped being a count — a fingerprint that stopped covering a shape collapses identity with no signal on the first ingestion"
  >
>;
type _AmbiguousInhabited = True<
  FitsIn<
    number,
    ReconciliationMetrics["ambiguous"],
    "ReconciliationMetrics.ambiguous collapsed to never — the field still typechecks everywhere and counts nothing"
  >
>;

type _MintProducesElementIds = True<
  FitsIn<
    ReturnType<MintFn>,
    ElementId,
    "MintFn stopped returning an ElementId — any text-producing function is accepted as a minter and the reconciler hands out unbranded ids"
  >
>;

export type RECONCILIATION_PROOFS = readonly [
  _ComparisonsIsRequiredCount,
  _ComparisonsInhabited,
  _UncomparedIsRequiredCount,
  _UncomparedInhabited,
  _AmbiguousIsRequiredCount,
  _AmbiguousInhabited,
  _MintProducesElementIds,
];

// ─────────────────────────────── Invariantes de runtime ──────────────────────

/**
 * Que la marca nodal exista en runtime es lo que vuelve exacta la pertenencia: sin
 * ella el chequeo sería estructural y daría `true` para cualquier objeto que
 * casualmente se parezca a un `Node`.
 *
 * HUECO CONOCIDO: es la única garantía de este archivo que NO tiene ni mutante ni
 * guardián, porque no hay arnés de runtime para `outputs.ts` / `invariants.ts`.
 * `geometry.mjs` demuestra que el patrón existe (compila a un temporal e importa
 * `index.js`), así que lo que falta es un guardián nuevo —que nace en inglés por
 * GLOSARIO.md, sección 6— y no una fila de mutante. Queda para el bloque 5.
 */
export const isNode = (v: object): v is Node => NODE_BRAND in v;
