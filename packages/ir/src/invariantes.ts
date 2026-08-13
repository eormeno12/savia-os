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
 * `shapes.ts` no puede alcanzar `salidas.ts`, verificado por
 * `scripts/fronteras.mjs`. Sin ese import, un `Nodo` dentro de un `Body` es
 * inexpresable.
 *
 * Pero «restringir donde se escribe» solo cuenta mientras la restricción SIGA
 * siendo la que se escribió. Las tres anotaciones de arriba son las que se pueden
 * aflojar sin un solo error —ensanchar un literal a su unión, sacar un `satisfies`,
 * borrar un elemento de un arreglo `as const`— y las tres, aflojadas, apagan la
 * garantía en silencio. Por eso los invariantes 4, 5 y 6 no verifican los datos:
 * verifican que la RESTRICCIÓN siga vigente.
 */

import {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  SHAPES as FORMAS,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  type Shape as Forma,
} from "./shapes.js";
import type {
  COHESION_BY_ROLE,
  Role,
  RoleFor,
  RoleWithRequiredShape,
  ROLES,
} from "./classification.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  ByteHash as HashBytes,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  CacheKey as ClaveDeCache,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  ContextualFingerprint as HuellaContextual,
  ElementId,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  EmbeddingKey as ClaveEmbedding,
  LocalId,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  MatterHash as HashMateria,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  NodeFingerprint as HuellaNodo,
  Nominal,
} from "./identity.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Box as Caja,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Coordinate as Coordenada,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Location as Ubicación,
  SourceRange,
} from "./location.js";
import { MARCA_NODAL, type Nodo, type NodoCrudo } from "./salidas.js";
import type { Unidad } from "./adaptador.js";

// ─────────────────────────────── Maquinaria ──────────────────────────────────

type Verdadero<T extends true> = T;

/**
 * `true` si `De` cabe en `A`; si no, un OBJETO de error que nombra el desfase.
 *
 * El fallo NO puede ser `never`: `never` es asignable a todo, así que
 * `Verdadero<never>` compila y la aserción queda vacua. Es el error exacto que
 * tenía `_FormaEsCuerpoForma`, la aserción que vivía en `shapes.ts` y se borró, y
 * también el arreglo que la auditoría proponía para él. Un objeto no es asignable a
 * `true` y rompe el build.
 *
 * Y por eso mismo dos condiciones se assertean por SEPARADO y nunca con `&`:
 * `true & {error}` sigue siendo asignable a `true`.
 */
type Cubre<De, A, Mensaje extends string> = [De] extends [A]
  ? true
  : { "IR-ERR": [Mensaje, De, A] };

// ══════════════════ Invariante 1 · el arreglo cubre todas las formas ══════════
// La única dirección que ninguna anotación puede imponer: `Shape` se DERIVA de
// `Body` y `SHAPES` lleva `satisfies` (los dos en `shapes.ts`), así que el
// arreglo no puede nombrar una forma que no exista. Pero que no le FALTE ninguna
// no se puede escribir como restricción, porque un tipo no se enumera en runtime.
// Si falta una, `ROLE_BY_SHAPE` queda incompleto y el barrido «15×6 = 90»
// (§{Estrategia})
// recorre un dominio viejo — los dos fallos, mudos.

type _ArregloCompleto = Verdadero<
  Cubre<Forma, (typeof FORMAS)[number], "SHAPES is missing a shape of Body">
>;

export type PRUEBAS_DE_FORMA = readonly [_ArregloCompleto];

// ═══════════ Invariante 2 · la salida del adaptador no tiene ids (H13) ═══════
// El acuñado al azar de `ElementId` descansa en un hecho verificable: el property
// test de determinismo del tramo 3 —«para cada adaptador a: a.reconocer(f) ≡
// a.reconocer(f), árbol byte-idéntico»— compara artefactos que NO LLEVAN ID, así que
// no se puede romper por cómo se acuñan los ids. Ese hecho era hasta ahora una
// lectura de dos archivos, y una lectura no falla cuando deja de ser cierta.
//
// Si alguien agrega un `id` a `Unidad` o a `NodoCrudo`, la tenaza que H13 declara
// inexistente vuelve a existir — y el build lo dice acá, no seis meses después.

/** Error si `T` tiene la clave `K`. */
type SinClave<T, K extends string, Mensaje extends string> = K extends keyof T
  ? { "IR-ERR": [Mensaje, K, T] }
  : true;

type _UnidadSinId = Verdadero<
  SinClave<Unidad<unknown>, "id", "adapter output must not carry an id — see H13(a)">
>;
type _NodoCrudoSinId = Verdadero<
  SinClave<NodoCrudo, "id", "what is cached by hashBytes must not carry an id — see H13(a)">
>;

export type PRUEBAS_DE_ACUÑADO = readonly [_UnidadSinId, _NodoCrudoSinId];

// ══════════════════════════ Invariante 3 · la marca separa ═══════════════════
// La familia de hashes estuvo escrita en DOS niveles (`Nominal<Sha256Hex, …>`) y
// TODOS sus tipos eran `never`, o sea asignables a todo: una huella se asignaba a
// un `number` y a una `ClaveDeCache`. El docstring que prometía impedirlo estaba
// escrito y era falso. Estas pruebas son para que no vuelva a poder serlo.

/**
 * Error si `T` colapsó a `never` — un tipo sin valores posibles es asignable a TODO.
 *
 * El mensaje es un parámetro con DEFAULT, igual que en `NoVaDonde` y por la misma
 * razón: el operador nació para marcas nominales pero no es de marcas. `SourceRange`
 * también puede colapsar —es un `Extract`, y un `Extract` que no matchea da `never`
 * sin un solo error— y reportar eso como «*brand collapsed to never*» mandaría a
 * leer `identity.ts`, que no tiene nada que ver.
 */
type Habitado<
  T,
  Mensaje extends string = "brand collapsed to never and no longer protects anything",
> = [T] extends [never] ? { "IR-ERR": [Mensaje, T] } : true;

/**
 * Error si un valor de `De` se puede pasar donde se espera `A`.
 *
 * El tercer parámetro tiene DEFAULT y el default es vocabulario de marcas
 * nominales, porque es donde nació. Pero el operador no es de marcas: es «estos dos
 * tipos no se confunden», y sirve igual para un par rol⇒forma. Sin el mensaje
 * propio, una aserción sobre `RoleFor<…>` falla diciendo «la marca no separa» y
 * manda a leer `identity.ts`, que no tiene nada que ver — falla cuando tiene que
 * fallar y manda a buscar el bug al lugar equivocado, que es la mitad del trabajo
 * de un diagnóstico. Hoy NINGUNA aserción usa el default —las nueve pasan el suyo,
 * y así conviene que siga—; queda como red para que agregar una no obligue a
 * inventar el mensaje en el mismo minuto, no como opción legítima.
 */
type NoVaDonde<
  De,
  A,
  Mensaje extends string = "these two types do not separate",
> = [De] extends [A] ? { "IR-ERR": [Mensaje, De, A] } : true;

// Toda la familia está habitada. Es la propiedad que se rompió.
type _H1 = Verdadero<Habitado<HashBytes>>;
type _H2 = Verdadero<Habitado<HuellaNodo>>;
type _H3 = Verdadero<Habitado<HuellaContextual>>;
type _H4 = Verdadero<Habitado<ClaveEmbedding>>;
type _H5 = Verdadero<Habitado<HashMateria>>;
type _H6 = Verdadero<Habitado<ClaveDeCache>>;

// Y separa: los roles no se confunden entre sí ni con un `string` pelado. Cada uno
// dice QUÉ se confundió con qué, porque el mensaje es lo único que el desarrollador
// va a leer: el tipo del error ya trae los dos operandos, pero no por qué importan.
type _S1 = Verdadero<
  NoVaDonde<HuellaNodo, ClaveEmbedding, "a node fingerprint is accepted as an embedding key">
>;
type _S2 = Verdadero<
  NoVaDonde<HuellaNodo, HashBytes, "a node fingerprint is accepted as a byte hash">
>;
type _S3 = Verdadero<
  NoVaDonde<HuellaContextual, ClaveEmbedding, "a contextual fingerprint is accepted as an embedding key">
>;
type _S4 = Verdadero<
  NoVaDonde<HashMateria, ClaveDeCache, "a matter hash is accepted as a cache key">
>;
type _S5 = Verdadero<
  NoVaDonde<string, HuellaNodo, "a bare string is accepted as a node fingerprint — the brand stopped requiring asNodeFingerprint()">
>;
type _S6 = Verdadero<
  NoVaDonde<ElementId, LocalId, "an ElementId is accepted as a LocalId — minted and adapter-local ids no longer separate">
>;

/**
 * Pero una huella SIGUE siendo un `string` hacia afuera: se concatena y sirve de
 * clave de mapa sin ceremonia. Una marca que obligue a desmarcar para usarla no
 * la usa nadie.
 */
type _UsableComoString = Verdadero<HuellaNodo extends string ? true : false>;

/**
 * La guarda de `Nominal` dispara: marcar sobre marcado da un OBJETO de error, no
 * un string marcado. Si alguien sacara la guarda, `_MarcaSobreMarca` volvería a
 * ser `never`, `never extends string` es cierto, y esta línea deja de compilar.
 */
type _MarcaSobreMarca = Nominal<HuellaNodo, "Otra">;
type _GuardaDispara = Verdadero<
  NoVaDonde<_MarcaSobreMarca, string, "branding an already branded type yielded a string — the Nominal guard is gone">
>;

export type PRUEBAS_DE_MARCA = readonly [
  _H1, _H2, _H3, _H4, _H5, _H6,
  _S1, _S2, _S3, _S4, _S5, _S6,
  _UsableComoString,
  _GuardaDispara,
];

// ═════════ Invariante 4 · «código siempre `solo`» sigue siendo exacto ════════
// La anotación de `COHESION_BY_ROLE` dice que los tres atómicos son LITERALES «a
// propósito: ensancharlos a `Cohesion` deja pasar `"normal"` en verde». Esa frase
// describía una propiedad que NADA verificaba: ensanchar el campo a `Cohesion` y
// escribir `code: "normal"` compilaba en verde, y el invariante del banco «código
// siempre `solo`» (§{Invariantes}) —que la anotación dice IMPONER— se apagaba mudo.
// Acá el campo se obliga a ser EXACTAMENTE `"solo"`, no un supertipo suyo.

type _CódigoEsSolo = Verdadero<
  Cubre<
    (typeof COHESION_BY_ROLE)["code"],
    "solo",
    "COHESION_BY_ROLE.code widened past the literal and no longer forces solo"
  >
>;
type _FórmulaEsSolo = Verdadero<
  Cubre<
    (typeof COHESION_BY_ROLE)["formula"],
    "solo",
    "COHESION_BY_ROLE.formula widened past the literal and no longer forces solo"
  >
>;
type _ImagenEsSolo = Verdadero<
  Cubre<
    (typeof COHESION_BY_ROLE)["image"],
    "solo",
    "COHESION_BY_ROLE.image widened past the literal and no longer forces solo"
  >
>;

export type PRUEBAS_DE_COHESIÓN = readonly [_CódigoEsSolo, _FórmulaEsSolo, _ImagenEsSolo];

// ══════════ Invariante 5 · el `satisfies` de REQUIRED_SHAPE sigue atando ══════
// Su docstring dice que ese `satisfies` es LOAD-BEARING: sin él
// `RoleWithRequiredShape` queda disjunto de `Role`, `RoleFor<F>` pasa a ser los 15
// roles para toda forma, la anotación de `ROLE_BY_SHAPE` deja de restringir e
// `ILLEGAL_PAIRS` queda vacío — «sacarlo no rompe nada: apaga tres garantías en
// silencio». El silencio era literal: sacarlo compilaba. Las dos líneas van POR
// SEPARADO porque miden cosas distintas e independientes — que las claves SEAN
// roles, y que la pareja obligatoria efectivamente RESTRINJA.

/** Las 5 claves del mapa son roles de verdad. Muere si el `satisfies` se va. */
type _ClavesDeFormaObligadaSonRoles = Verdadero<
  Cubre<
    RoleWithRequiredShape,
    Role,
    "REQUIRED_SHAPE keys are no longer Role — did the satisfies go away?"
  >
>;

/** Y restringen: `code` exige `verbatim`, así que no es rol válido para `text_span`. */
type _ParIlegalSigueIlegal = Verdadero<
  NoVaDonde<
    "code",
    RoleFor<"text_span">,
    "RoleFor<text_span> admits code — the required pair stopped restricting and text_span ⇒ code compiles"
  >
>;

export type PRUEBAS_DE_PAREJA = readonly [
  _ClavesDeFormaObligadaSonRoles,
  _ParIlegalSigueIlegal,
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

type _QuinceRoles = Verdadero<
  Cubre<
    (typeof ROLES)["length"],
    15,
    "ROLES no longer has 15 roles: the 15×6 = 90 sweep (§{Estrategia}) walks a different domain"
  >
>;
type _SeisFormas = Verdadero<
  Cubre<
    (typeof FORMAS)["length"],
    6,
    "SHAPES no longer has 6 shapes: the 15×6 = 90 sweep (§{Estrategia}) walks a different domain"
  >
>;

export type PRUEBAS_DE_DOMINIO = readonly [_QuinceRoles, _SeisFormas];

// ═══════ Invariante 7 · la coordenada sigue siendo lo que dice ser ═══════════
// Las cinco propiedades de `location.ts` que estaban escritas en prosa y no las
// ejecutaba nadie. Las cinco se pueden apagar con una edición de un carácter y
// ninguna se pone roja sola:
//
//   · `SourceRange` es `Extract<Coordinate, {space:"grid"}>`. Un `Extract` que no
//     matchea NO es un error: es `never`, y `never` es asignable a todo, así que
//     mover el tag una letra deja `Registro.coordenada` (§{Las dos salidas})
//     aceptando cualquier cosa, en verde. Es la falla de la familia de hashes en
//     otro archivo.
//   · El vocabulario de `space` es un COMPROMISO con el plan, igual que
//     `ROLES.length === 15`: agregar o sacar una variante tiene que romper acá para
//     que los doce adaptadores y todo consumidor exhaustivo se actualicen en el
//     mismo commit. Las dos direcciones van POR SEPARADO —una dice «entró algo»,
//     la otra «se fue algo»— porque son fallas distintas.
//   · `within` recursivo es lo único que hace citable la cadena del caso canónico
//     (§{La delegación es emergente}); aplanarlo a un solo nivel compila.
//   · `Box.frame` obligatorio es lo que impide que las cajas de 40 diapositivas
//     convivan en un plano; volverlo opcional no rompe `boxContains`, que
//     compararía `undefined !== undefined` y daría `false`.

type _SourceRangeExiste = Verdadero<
  Habitado<
    SourceRange,
    "SourceRange collapsed to never — the grid variant of Coordinate lost its tag and DataRecord.coordinate now accepts anything"
  >
>;
type _EspaciosDeclarados = Verdadero<
  Cubre<
    Coordenada["space"],
    "source" | "text" | "grid" | "visual" | "time",
    "Coordinate gained a space: every exhaustive consumer and the twelve adapters walk a different domain"
  >
>;
type _EspaciosPresentes = Verdadero<
  Cubre<
    "source" | "text" | "grid" | "visual" | "time",
    Coordenada["space"],
    "Coordinate lost a space: something that used to be citable no longer is"
  >
>;
type _WithinEsRecursivo = Verdadero<
  Cubre<
    Ubicación["within"][number],
    Ubicación,
    "Location.within stopped being recursive — the chained citation (contract.pdf → pg3 → image) is no longer expressible"
  >
>;
type _MarcoObligatorio = Verdadero<
  NoVaDonde<
    undefined,
    Caja["frame"],
    "Box.frame became optional — boxes from different frames share one plane and contain each other"
  >
>;

export type PRUEBAS_DE_COORDENADA = readonly [
  _SourceRangeExiste,
  _EspaciosDeclarados,
  _EspaciosPresentes,
  _WithinEsRecursivo,
  _MarcoObligatorio,
];

// ─────────────────────────────── Invariantes de runtime ──────────────────────

/**
 * Que la marca nodal exista en runtime es lo que vuelve exacta la pertenencia: sin
 * ella el chequeo sería estructural y daría `true` para cualquier objeto que
 * casualmente se parezca a un `Nodo`.
 */
export const esNodo = (v: object): v is Nodo => MARCA_NODAL in v;
