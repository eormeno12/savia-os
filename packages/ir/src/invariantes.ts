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
 *   · `Forma` ≡ `Cuerpo['forma']` → `Forma` se deriva de `Cuerpo` (`formas.ts`)
 *   · el piso físico nunca da un par ilegal → anotación de `TIPO_POR_FORMA`
 *   · «código siempre atómico» → anotación de `COHESIÓN`
 * La cuarta —ningún payload anida un nodo— la impone el grafo de módulos:
 * `formas.ts` no puede alcanzar `salidas.ts`, verificado por
 * `scripts/fronteras.mjs`. Sin ese import, un `Nodo` dentro de un `Cuerpo` es
 * inexpresable.
 */

import { FORMAS, type Forma } from "./formas.js";
import type {
  ClaveDeCache,
  ClaveEmbedding,
  ElementId,
  HashBytes,
  HashMateria,
  HuellaContextual,
  HuellaNodo,
  LocalId,
  Nominal,
} from "./identidad.js";
import { MARCA_NODAL, type Nodo, type NodoCrudo } from "./salidas.js";
import type { Unidad } from "./adaptador.js";

// ─────────────────────────────── Maquinaria ──────────────────────────────────

type Verdadero<T extends true> = T;

/**
 * `true` si `De` cabe en `A`; si no, un OBJETO de error que nombra el desfase.
 *
 * El fallo NO puede ser `never`: `never` es asignable a todo, así que
 * `Verdadero<never>` compila y la aserción queda vacua. Es el error exacto que
 * tenía `_FormaEsCuerpoForma` en `formas.ts`, y también el arreglo que la auditoría
 * proponía para él. Un objeto no es asignable a `true` y rompe el build.
 *
 * Y por eso mismo dos condiciones se assertean por SEPARADO y nunca con `&`:
 * `true & {error}` sigue siendo asignable a `true`.
 */
type Cubre<De, A, Mensaje extends string> = [De] extends [A]
  ? true
  : { "IR-ERR": [Mensaje, De, A] };

// ══════════════════ Invariante 1 · el arreglo cubre todas las formas ══════════
// La única dirección que ninguna anotación puede imponer: `Forma` se DERIVA de
// `Cuerpo` y `FORMAS` lleva `satisfies` (los dos en `formas.ts`), así que el
// arreglo no puede nombrar una forma que no exista. Pero que no le FALTE ninguna
// no se puede escribir como restricción, porque un tipo no se enumera en runtime.
// Si falta una, `TIPO_POR_FORMA` queda incompleto y el barrido «15×6 = 90»
// (§{Estrategia})
// recorre un dominio viejo — los dos fallos, mudos.

type _ArregloCompleto = Verdadero<
  Cubre<Forma, (typeof FORMAS)[number], "a FORMAS le falta una forma de Cuerpo">
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
  SinClave<Unidad<unknown>, "id", "la salida del adaptador no puede llevar id — ver H13(a)">
>;
type _NodoCrudoSinId = Verdadero<
  SinClave<NodoCrudo, "id", "lo que se cachea por hashBytes no puede llevar id — ver H13(a)">
>;

export type PRUEBAS_DE_ACUÑADO = readonly [_UnidadSinId, _NodoCrudoSinId];

// ══════════════════════════ Invariante 3 · la marca separa ═══════════════════
// La familia de hashes estuvo escrita en DOS niveles (`Nominal<Sha256Hex, …>`) y
// los siete tipos eran `never`, o sea asignables a todo: una huella se asignaba a
// un `number` y a una `ClaveDeCache`. El docstring que prometía impedirlo estaba
// escrito y era falso. Estas pruebas son para que no vuelva a poder serlo.

/** Error si `T` colapsó a `never` — un tipo sin valores posibles es asignable a TODO. */
type Habitado<T> = [T] extends [never]
  ? { "IR-ERR: la marca colapsó a never y ya no protege nada": T }
  : true;

/** Error si un valor de `De` se puede pasar donde se espera `A`. */
type NoVaDonde<De, A> = [De] extends [A]
  ? { "IR-ERR: la marca no separa estos dos": [De, A] }
  : true;

// Toda la familia está habitada. Es la propiedad que se rompió.
type _H1 = Verdadero<Habitado<HashBytes>>;
type _H2 = Verdadero<Habitado<HuellaNodo>>;
type _H3 = Verdadero<Habitado<HuellaContextual>>;
type _H4 = Verdadero<Habitado<ClaveEmbedding>>;
type _H5 = Verdadero<Habitado<HashMateria>>;
type _H6 = Verdadero<Habitado<ClaveDeCache>>;

// Y separa: los roles no se confunden entre sí ni con un `string` pelado.
type _S1 = Verdadero<NoVaDonde<HuellaNodo, ClaveEmbedding>>;
type _S2 = Verdadero<NoVaDonde<HuellaNodo, HashBytes>>;
type _S3 = Verdadero<NoVaDonde<HuellaContextual, ClaveEmbedding>>;
type _S4 = Verdadero<NoVaDonde<HashMateria, ClaveDeCache>>;
type _S5 = Verdadero<NoVaDonde<string, HuellaNodo>>;
type _S6 = Verdadero<NoVaDonde<ElementId, LocalId>>;

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
type _GuardaDispara = Verdadero<NoVaDonde<_MarcaSobreMarca, string>>;

export type PRUEBAS_DE_MARCA = readonly [
  _H1, _H2, _H3, _H4, _H5, _H6,
  _S1, _S2, _S3, _S4, _S5, _S6,
  _UsableComoString,
  _GuardaDispara,
];

// ─────────────────────────────── Invariantes de runtime ──────────────────────

/**
 * Que la marca nodal exista en runtime es lo que vuelve exacta la pertenencia: sin
 * ella el chequeo sería estructural y daría `true` para cualquier objeto que
 * casualmente se parezca a un `Nodo`.
 */
export const esNodo = (v: object): v is Nodo => MARCA_NODAL in v;
