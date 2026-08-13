/**
 * La cintura: exactamente seis formas cerradas (§{Resumen}, §{Vocabulario}).
 *
 * R1 (§{R1}) dice que «nada específico de un formato lo cruza» y que «no es una
 * convención documentada: el tipo `Body` no tiene ningún miembro capaz de
 * expresarlo».
 *
 * PROVISIONAL(R1): R1 se lee en sentido DÉBIL — se permite NOMBRAR un formato, se
 * prohíbe llevar su ESTRUCTURA — Tal como está enunciada, R1 es falsa sobre el
 * propio literal del plan: `asset.mime: string` (§{Tramo 3 › Qué sale}) y
 * `verbatim.language?: string` (§{Tramo 3 › Qué sale}) son identificadores de
 * formato cruzando el borde. Y `mime` es necesario: es lo que hace posible
 * construir la sonda de un asset delegado (§{La sonda}). Sin escribir esta
 * aclaración, el primer autor de adaptador que lea R1 literalmente va a preguntar
 * por qué `mime` está permitido, y el segundo va a meter un `styleId` con el mismo
 * argumento — Si se decide al revés (R1 fuerte), hay que sacar `mime` del cuerpo y
 * la delegación se queda sin insumo para la sonda.
 */

import { PARAMETERS } from "./params.js";
import type { ObjectKey } from "./identity.js";
import { boxContains, type Box } from "./location.js";

// ─────────────────────────────── Forma ───────────────────────────────────────

/**
 * Las seis formas, enumerables en RUNTIME.
 *
 * PROVISIONAL(Shape): una sola fuente de verdad, y la fuente es `Body` — El plan
 * nombra `Shape` como tipo propio (§{Dónde vive}) y define los seis discriminantes
 * por separado en `Body` (§{Tramo 3 › Qué sale}); con dos declaraciones a mano,
 * agregar una variante a `Body` sin tocar `Shape` deja `ROLE_BY_SHAPE`
 * incompleto y el test «15×6 = 90» (§{Estrategia}) barriendo un dominio viejo, y
 * los dos fallos son mudos. Además el banco corre el invariante «formas dentro del
 * conjunto cerrado» (§{Invariantes}), que exige una lista en runtime y un tipo no
 * la da.
 *
 * LA DIVERGENCIA ES IRREPRESENTABLE, no detectable. `Shape` se DERIVA de `Body`,
 * así que no pueden discrepar; y `satisfies` impide que este arreglo nombre una
 * forma que `Body` no tiene, en la línea donde se escriba. La versión anterior
 * derivaba `Shape` del arreglo y verificaba la coincidencia con una aserción —
 * aserción que la auditoría demostró VACUA: al desalinearse evaluaba a `never`, y
 * un alias igual a `never` compila.
 *
 * Queda UNA dirección que ninguna anotación cubre —que al arreglo no le FALTE una
 * forma— porque un tipo no se puede enumerar en runtime. Vive en `invariants.ts`.
 */
export const SHAPES = [
  "text_span",
  "verbatim",
  "asset",
  "grid",
  "fields",
  "container",
] as const satisfies readonly Body["shape"][];

export type Shape = Body["shape"];

// ─────────────────────────────── Tipos colgantes ─────────────────────────────

/**
 * Una marca de estilo inline sobre `text_span.text`.
 *
 * PROVISIONAL(Mark): conjunto CERRADO de clases, con `[inicio, fin)` en unidades
 * de código UTF-16 sobre el texto YA NORMALIZADO — `Mark` está nombrada como
 * habitante de `ir` (§{Paquetes}) y nunca se define. Cerrado por el mismo argumento
 * con que el plan cerró `role` (§{Qué compraba}: «nada impedía que un clasificador
 * emitiera `titulo`, otro `heading` y otro `title`»); dejarlo abierto es reabrir
 * por la ventana lo que se cerró por la puerta, y R2 no protege porque R2 SÍ
 * permite leer para mostrar y filtrar, que es donde la deriva se vuelve visible al
 * usuario. UTF-16 porque es la unidad de `String.prototype.slice` en JS. «Ya
 * normalizado» porque si no, el orden entre normalizar y marcar queda a criterio de
 * cada uno de los doce adaptadores y los offsets se corren — Si se decide al revés
 * (clase abierta), la deriva está garantizada; si los offsets son sobre el texto
 * crudo, la normalización NFC los invalida.
 *
 * NO entra en la huella: §{Tramo 4 › Qué sale} dice «el texto» y nada más. Poner
 * una palabra en negrita conserva el id.
 */
export type Mark =
  | { readonly kind: "bold"; readonly start: number; readonly end: number }
  | { readonly kind: "italic"; readonly start: number; readonly end: number }
  | { readonly kind: "underline"; readonly start: number; readonly end: number }
  | { readonly kind: "strikethrough"; readonly start: number; readonly end: number }
  | { readonly kind: "code"; readonly start: number; readonly end: number }
  | { readonly kind: "superscript"; readonly start: number; readonly end: number }
  | { readonly kind: "subscript"; readonly start: number; readonly end: number }
  | {
      readonly kind: "link";
      readonly start: number;
      readonly end: number;
      readonly href: string;
    };

/**
 * El tipo perfilado de una celda.
 *
 * PROVISIONAL(H7): conjunto cerrado, y EXCLUIDO de la huella — `regionesDeGrilla`
 * perfila «el tipo dominante de cada columna» (§{`regionesDeGrilla`}) para decidir
 * dónde está el encabezado y por lo tanto el `grain`, lo que presupone un sistema
 * de tipos de celda distinto de `Role` que el plan nunca define. Excluido de la
 * huella porque su parseo depende de locale (`01/02/2026`, `1.234`): si entrara,
 * cambiar la versión de la librería de fechas movería identidades — Si se decide al
 * revés (tipo dentro de la huella), una planilla reformateada pierde todas sus
 * anclas.
 */
export type CellType = "text" | "number" | "date" | "boolean" | "empty";

/**
 * Una celda de una grilla.
 *
 * PROVISIONAL(H1): `{ text, type }` y no `string` — El plan escribe `rows:
 * Cell[][]` (§{Tramo 3 › Qué sale}) y nunca define `Cell`; que no sea `string` es
 * información, porque si lo fuera habría escrito `string[][]`. El wrapper le da a
 * `regionesDeGrilla` el insumo que §{`regionesDeGrilla`} le pide sin meter parseo
 * dependiente de locale dentro de la identidad, y le da a `Registro.valores` la
 * proyección a `string` que §{Las dos salidas} exige — Si se decide al revés
 * (`Cell = string`), `regionesDeGrilla` se queda sin con qué perfilar columnas.
 */
export type Cell = {
  readonly text: string;
  readonly type: CellType | null;
};

/** Un par etiqueta/valor de la forma `fields`. */
export type Pair = {
  readonly label: string;
  readonly value: string;
};

/**
 * El grano de una grilla (§{`regionesDeGrilla`}). Separa unidad de IDENTIDAD (la
 * fila, que se hashea y se versiona) de unidad de EMBEDDING (la ventana de filas).
 */
export type Grain = "row" | "whole";

/**
 * Qué parte de un objeto es una materia descomponible.
 *
 * PROVISIONAL(C4): `Window` existe porque `ObjectRef` tiene que dejar de ser una
 * clave opaca — Ver el razonamiento completo en `MatterHash` (`identity.ts`).
 * «Referenciar el original» (§{Dónde frena}) se lee como «no escribir bytes
 * nuevos», no como «no nombrar una subregión»: es la única lectura bajo la cual
 * coexisten la terminación, la guarda de ciclo, el caché por página, la huella de
 * `asset` y la sonda del delegado — las cinco cosas que el plan afirma que
 * funcionan a la vez — Si se decide al revés (ref opaca), dos regiones distintas de
 * la misma página comparten ref, hashean idénticas y por la regla de unicidad del
 * pase 1 (§{5 · Reconciliador}) NINGUNA ancla.
 */
export type Window =
  | { readonly scope: "whole" }
  | { readonly scope: "region"; readonly box: Box }
  | { readonly scope: "range"; readonly start: number; readonly end: number };

/**
 * La referencia de un `asset`: qué objeto, y qué parte de él.
 * Dos assets con la misma `ObjectRef` hashean igual — que es correcto: son el
 * mismo contenido, y el pase 2 los separa por hueco.
 */
export type ObjectRef = {
  readonly object: ObjectKey;
  readonly window: Window;
};

/**
 * Trabajo diferido sobre un asset. Declara QUÉ FALTA, nunca un resultado.
 *
 * PROVISIONAL(#54): enum cerrado de clases de trabajo, sin campo de resultado — El
 * campo `deferred: Enrichment[]` (§{Tramo 3 › Qué sale}) no tiene productor,
 * consumidor ni tramo en todo el documento, y es cómo una imagen se vuelve texto
 * consultable («un bloque: asset con descripción pendiente»,
 * §{La delegación es emergente}). El conflicto de fondo es de ubicación: si el
 * RESULTADO va en el `Body`, R3 lo borra en cada re-ingesta («se regenera entero
 * desde los bytes», §{R3}); si va en anotaciones, entonces no está en el cuerpo,
 * que es donde el tipo lo pone. Sin resultado, no hay conflicto: cuando el
 * enriquecimiento llega, la descripción se emite como nodo hijo mediante
 * RE-EMISIÓN, que es el mecanismo que §{La delegación tardía} ya diseñó y el banco
 * ya midió («delegación tardía injerta un subárbol → 0 ids movidos», §{Tercera}) —
 * Si se decide al revés (con resultado), o se pierde en cada re-ingesta o el
 * `Body` deja de ser desechable y se rompe R3, que el plan considera de las tres
 * fundamentales.
 *
 * SOSPECHA A RESOLVER CON EL DUEÑO DEL TRAMO 3: la reforma de la delegación unificó
 * «descripción de imágenes» y «reconocimiento de escaneados» en un solo mecanismo
 * (§{La delegación es emergente}) y eliminó `role:'delegado'` y el clasificador
 * `miembros` por redundantes con ella (§{Lo que se borró}). `deferred` sobrevivió
 * sin que nadie revisara si le pasa lo mismo: un asset delegado YA es una unidad de
 * trabajo independiente que se agenda sola (§{La delegación es emergente}), así que
 * «pendiente» podría ser un estado de la cola y no un campo del cuerpo. Si es así,
 * este campo sobra.
 */
export type EnrichmentKind = "description" | "ocr" | "transcription";

export type Enrichment = {
  readonly kind: EnrichmentKind;
};

// ─────────────────────────────── Cuerpo ──────────────────────────────────────

/**
 * La unión discriminada de las seis formas con su payload. Es lo que cruza el
 * borde de formato (§{Tramo 3 › Qué sale}).
 *
 * Tres desviaciones del literal del plan, todas marcadas en su campo:
 *  - `container.schema`  (C3 + C14)
 *  - `grid.headers: readonly string[] | null` (era `string[]`)
 *  - `asset.ref: ObjectRef` como par (objeto, ventana) (C4)
 */
export type Body =
  | {
      readonly shape: "text_span";
      readonly text: string;
      readonly marks: readonly Mark[];
    }
  | {
      readonly shape: "verbatim";
      readonly text: string;
      /**
       * NO entra en la huella: el mismo snippet en Python y en Ruby es el mismo
       * nodo. Coherente con §{Tramo 4 › Qué sale} («el texto») y con que cambiar la
       * etiqueta de lenguaje no cambia el contenido. PROVISIONAL(R1): normalizar a
       * minúsculas al construir, sin cerrar el vocabulario — Los lenguajes son
       * ilimitados por naturaleza, pero `js` vs `javascript` vs `JavaScript` es la
       * misma deriva por la que se cerró `role` — Si se decide al revés (sin
       * normalizar), la deriva es visible al usuario porque R2 permite leer para
       * mostrar y filtrar.
       */
      readonly language?: string;
    }
  | {
      readonly shape: "asset";
      readonly ref: ObjectRef;
      /**
       * PROVISIONAL(R1): normalizar a minúsculas y sin parámetros al construir.
       * NO entra en la huella: es derivable de los bytes referenciados, así que
       * incluirlo solo agregaría una fuente de inestabilidad (una re-detección de
       * mime movería el id) sin poder discriminante real.
       */
      readonly mime: string;
      /**
       * NO entra en la huella. Está PROHIBIDO por §{La delegación tardía}: «el
       * asset que ganó hijos → su contenido no cambió → MISMO id». Si entrara, cada
       * enriquecimiento resuelto movería el id.
       */
      readonly deferred: readonly Enrichment[];
    }
  | {
      readonly shape: "grid";
      /**
       * PROVISIONAL(C3): `null` = «esta región no tiene fila de encabezado» y `[]`
       * = «tiene encabezado y sus celdas están vacías» — `string[]` a secas no
       * distingue las dos, y el grano decide la cardinalidad de nodos de toda la
       * planilla (50 000 identidades vs 1) mientras `headers` entra en la
       * huella de `grid` (§{Tramo 4 › Qué sale}), así que la ambigüedad se propaga
       * a identidad y a conteo. Además el NODO-FILA usa `null` para decir «mi
       * esquema está en el container» — Si se decide al revés (`[]` para las dos
       * cosas), el arreglo vacío significa dos cosas a la vez y el nodo-fila es
       * indistinguible de una región sin encabezado.
       */
      readonly headers: readonly string[] | null;
      readonly rows: readonly (readonly Cell[])[];
      readonly grain: Grain;
    }
  | {
      readonly shape: "fields";
      /**
       * ARREGLO, no mapa: el orden es material de la huella
       * (§{Tramo 4 › Qué sale}) y los
       * duplicados son expresables. Una región real tiene etiquetas repetidas. */
      readonly pairs: readonly Pair[];
    }
  | {
      readonly shape: "container";
      readonly ordered: boolean;
      /**
       * El esquema de la planilla, cuando este container agrupa filas.
       *
       * PROVISIONAL(C3): campo NUEVO, no está en §{Tramo 3 › Qué sale} — Es la
       * decisión más fuertemente MEDIDA del documento y hoy es inexpresable:
       * §{Las filas} dice «cada fila es un nodo», §{Las filas} dice «el esquema
       * vive en el container, no en la fila» (anclaje 1.00 vs 0.00, §{Cuarta}), y
       * `container` es `{shape, ordered}` — no tiene dónde ponerlo. Las otras
       * cinco formas o no sirven (`fields` y `grid` reintroducen el esquema en la
       * fila, que es exactamente el caso medido como 0.00) o rompen la cintura de
       * seis (una séptima forma `row`). De paso mitiga C14: los containers de
       * planilla dejan de hashear todos igual — Si se decide al revés,
       * `Registro.valores` no se puede construir y «la composición del fragmento
       * toma las etiquetas del container» (§{Las filas}) no tiene de dónde
       * tomarlas.
       *
       * SÍ entra en la huella del container. COSTO QUE CONTRADICE UNA CIFRA
       * PUBLICADA: agregar una fila mueve el hash del container, así que la
       * medición estrella «anclaje 1.00 · 502 anclas · 1 alta» (§{Las filas}) pasa
       * a ser 501 anclas + 1 alta + 1 container movido. Es 1 id movido, no 0.
       */
      readonly schema: readonly string[] | null;
    };

// La aserción que estaba acá se borró: `Shape` se deriva de `Body` (ver arriba),
// así que no hay dos conjuntos que puedan discrepar. Además no verificaba nada —
// al desalinearse evaluaba a `never`, y un alias igual a `never` compila.

/**
 * El payload de una forma dada. Deja escribir funciones por forma sin repetir la
 * unión.
 */
export type BodyOf<F extends Shape> = Extract<Body, { shape: F }>;

// ─────────────────────────────── Predicados ──────────────────────────────────

/**
 * `exterior` cubre a `interior`.
 *
 * PROVISIONAL(C4): el PUNTO FIJO deja de ser igualdad de hashes y pasa a ser
 * cobertura de ventanas — §{Dónde frena} lo dice en prosa («si descomponer un asset
 * devuelve un solo bloque cuyo contenido es el mismo que entró, se tocó fondo») y
 * el plan lo implementa comparando hashes, que es lo que choca con la guarda de
 * ciclo. Como predicado de cobertura, además saca del camino de terminación el
 * umbral «cubre casi todo su origen» (H3), que es literalmente el tipo de umbral
 * que §{Segunda} declara no querer — Si se decide al revés, hace falta un
 * porcentaje inventado y la terminación depende de él.
 *
 * RESIDUO SIN RESOLVER: la canonicalización de `Window` (redondeo de cajas)
 * tiene que ser exacta o dos corridas dan `MatterHash` distintos.
 */
export const windowCovers = (exterior: Window, interior: Window): boolean => {
  if (exterior.scope === "whole") return true;
  if (interior.scope === "whole") return false;
  if (exterior.scope === "region" && interior.scope === "region") {
    return boxContains(exterior.box, interior.box);
  }
  if (exterior.scope === "range" && interior.scope === "range") {
    return interior.start >= exterior.start && interior.end <= exterior.end;
  }
  return false;
};

/**
 * Un nodo-FILA: la unidad de identidad de una planilla con `grain: 'row'`.
 *
 * PROVISIONAL(C3): un nodo-fila es un `grid` con `headers: null`, exactamente
 * una fila y `grain: 'row'` — Es la única lectura que satisface a la vez la
 * medición (renombrar una columna toca UN nodo, porque la huella de la fila son
 * solo sus celdas), el conteo de seis formas cerradas, y el hecho de que `grain`
 * exista en el payload de `grid`. El banco ya lo dice sin darse cuenta: «la huella
 * usaba `text ?? ref ?? rows`, y una fila no tiene ninguno de los tres»
 * (§{Tramo 4 › Qué sale}), o sea que el nodo-fila ya existía en la simulación con
 * una forma que no es ninguna de las tres que tienen esos campos — Si se decide al
 * revés (`fields`), es el caso medido como anclaje 0.00 y destrucción de todas las
 * anclas; si se decide por una séptima forma `row`, se rompe la cintura de seis
 * (§{Resumen}, §{Vocabulario}, §{Cuarta}) y el test pasa de 15×6=90 a 15×7=105.
 */
export const isRowNode = (body: Body): boolean =>
  body.shape === "grid" &&
  body.grain === "row" &&
  body.headers === null &&
  body.rows.length === PARAMETERS.arithmetic.one;
