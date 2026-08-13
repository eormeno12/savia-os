/**
 * La proyección canónica — UNA función, tres consumidores.
 *
 * El plan necesita tres cosas que hoy son tres funciones inexistentes y que nadie
 * declaró relacionadas: la serialización canónica de la huella (H6), la
 * tokenización de la similitud de los pases 2 y 3 (H2), y el renderizado a texto
 * de `Fragment.text` y del embedding (H4). Si son independientes DERIVAN —H2
 * avisa que la elección de tokenización decide si «una planilla pierde 500
 * identidades o ninguna»— y nada garantiza la propiedad más elemental que el
 * reconciliador necesita: que el pase 1 y el pase 2 no se contradigan.
 *
 * PROVISIONAL(H2/H4/H6): UNA proyección por nodo con dos consumidores, y el
 * renderizado APARTE — `project(body)` es única, determinística y consciente de
 * la forma; `fingerprintOf` = hash(encode(project(...))) y `similarity` =
 * f(project(a), project(b)). De ahí sale POR CONSTRUCCIÓN el invariante que la
 * auditoría reclama sin nombrarlo: `huella(a) === huella(b) ⟹ similitud(a,b) ===
 * 1`. `render` queda separada porque persigue lo contrario: la huella tiene que
 * ser INYECTIVA y ESTABLE, el texto que se embebe tiene que ser LEGIBLE — Colapsar
 * las tres es imposible y dejarlas independientes es la deriva garantizada con doce
 * adaptadores y años. Separar el renderizado además lo deja evolucionar sin mover
 * un solo id, que es lo que §{Este tramo} promete: «cambian los vectores, no los
 * fragmentos, ni sus identidades, ni sus hashes» — Si se decide al revés (tres
 * funciones sueltas), dos implementaciones producen cachés disjuntos y tasas de
 * anclaje distintas sobre el mismo corpus, sin que nada se ponga rojo.
 *
 * PROVISIONAL(§{Orden}): esto expande `ir` más allá de «el contrato, SIN LÓGICA» y
 * más allá de lo que §{Paquetes} enumera — El grafo de paquetes no deja otro lugar:
 * la proyección depende de la forma del payload y la necesitan `adaptadores`,
 * `emision` e `ingesta`, y las dos primeras «NUNCA se ven entre sí» (§{Paquetes}).
 * Es palabra por palabra el argumento con el que el plan ubicó el enum `Tipo` en
 * `ir` (§{Cómo se agrega}) — Sin ella el archivo no es un contrato ejecutable sino
 * una declaración de tipos.
 */

import { PARAMETERS } from "./params.js";
import type { Body, Shape, Window } from "./shapes.js";
// El import que este archivo NO PODÍA TENER hasta el bloque 3b. Ver `fingerprintOf`:
// mientras `Authorship` vivía en `identity.ts`, nombrar este módulo la ponía en el
// alcance léxico del único archivo que calcula la huella, y era lo único —débil, por
// lectura— que impedía que entrara. Hoy la autoría y la delegación están en
// `provenance.ts` y la frontera `projection.ts ↛ provenance.ts` la impone
// `scripts/boundaries.mjs`, acreditada por miembro (M46 y M49).
import { asNodeFingerprint, type NodeFingerprint } from "./identity.js";

// ─────────────────────────────── El operador `‖` ─────────────────────────────

/**
 * El operador `‖` de §{Caché}, §{Lo que se borró} y §{Cómo se rebana}, que el plan
 * usa
 * tres veces y no define nunca.
 *
 * PROVISIONAL(#27): longitud prefijada por componente (`len:valor`), no separador
 * improbable ni concatenación desnuda — Sin longitud ni delimitador, un
 * `adapterId` terminado en dígitos seguido de una versión numérica colisiona con
 * otra terna y el caché sirve árboles equivocados EN SILENCIO, que es el modo de
 * falla que la sección del caché existe para evitar. Con longitud prefijada es
 * inyectiva POR CONSTRUCCIÓN, sin verificación que alguien pueda olvidarse — es la
 * misma preferencia que el documento aplica en todas partes: mover el invariante a
 * un lugar donde no se pueda violar — Si se decide al revés (separador `\x1f` +
 * verificación), hay que verificar en cada sitio y la verificación se olvida.
 *
 * El MISMO operador en las DOS claves de caché, no uno por sitio.
 *
 * SE LLAMA `encodeParts` Y NO `concatenate` (GLOSARIO.md, G1): el cognado nombra
 * justamente lo que esta función NO es —«ni concatenación desnuda», dos párrafos
 * arriba—, y la salvedad de R1 manda preferir el término de dominio cuando el
 * cognado significa otra cosa. Queda además en la familia de las otras dos
 * serializaciones inyectivas del archivo, `encode` y `encodeWindow`, que la llaman.
 */
export const encodeParts = (...parts: readonly string[]): string =>
  parts.map((p) => `${p.length}:${p}`).join("");

// ─────────────────────────────── Normalización ───────────────────────────────

/**
 * Normalización del texto, PARTE DE LA DEFINICIÓN de la huella, no un detalle de
 * implementación: cambiarla invalida todas las anclas del corpus de una vez, o sea
 * que es un cambio de contrato de `ir` y se versiona como tal (mismo criterio que
 * §{Cómo se agrega} para agregar un `tipo`).
 *
 * PROVISIONAL(H6): consciente de la FORMA, no uniforme — NFC + CRLF→LF siempre;
 * para `text_span` además recortar extremos y colapsar corridas de espacio
 * horizontal; para `verbatim`, nada más — Sin normalización, guardar el mismo DOCX
 * con otro editor destruye todas las anclas. Pero una normalización uniforme
 * tampoco sirve: el plan distingue `text_span` de `verbatim` PRECISAMENTE porque en
 * `verbatim` «los espacios son significativos» (§{Tramo 3 › Qué sale}), así que
 * colapsar espacio en blanco arruina la única distinción que justifica que existan
 * dos formas — NFC y no NFKC: NFKC borra ligaduras, fracciones y superíndices, que
 * un documento real hace a propósito — Si se decide al revés (NFKC + colapso
 * uniforme), es estable pero destruye distinciones reales y contradice la semántica
 * de `verbatim`.
 *
 * ACREDITADO DESDE EL BLOQUE 3, y hasta entonces no lo estaba. Este párrafo decía
 * «PARTE DE LA DEFINICIÓN de la huella» mientras BORRAR el `.normalize("NFC")` de
 * abajo pasaba `tsc` y los cinco guardianes en verde: el guardián no tenía un solo
 * caso de normalización. Ahora lo tiene —compuesto vs descompuesto, y CRLF vs LF—
 * y el mutante M38 lo rompe a propósito en cada `pnpm lint`. La distinción importa
 * porque «una garantía que solo se verificó el día que se escribió es
 * indistinguible de una que nunca funcionó» (`scripts/mutants.mjs`).
 */
export const normalize = (text: string, shape: Shape): string => {
  const base = text.normalize("NFC").replace(/\r\n?/gu, "\n");
  if (shape === "verbatim") return base;
  return base.replace(/[^\S\n]+/gu, " ").trim();
};

// ─────────────────────────────── Token ───────────────────────────────────────

/**
 * La clase de un token. Existe para que la codificación sea inyectiva: dos
 * proyecciones con los mismos textos y clases distintas no pueden colisionar.
 *
 * LOS DOCE VALORES SON DATOS, NO NOMBRES, y de una especie que no tiene ningún otro
 * vocabulario del paquete: no van a Postgres ni al payload de Qdrant, van a la
 * PREIMAGEN DE LA HUELLA. `encode` serializa `[t.kind, t.text]`, así que el string
 * de la clase es parte de la preimagen y renombrar cualquiera de los doce cambia el
 * `ContentHash` de todo nodo del corpus. Ver GLOSARIO.md, G9 y el «OJO AL
 * DESPLEGAR» de `END_OF_ROW`.
 */
export type TokenKind =
  | "shape"
  | "ordered"
  | "schemaState"
  | "schema"
  | "word"
  | "line"
  | "cell"
  | "row"
  | "label"
  | "value"
  | "object"
  | "window";

/**
 * La unidad de comparación.
 *
 * PROVISIONAL(H2): grano ESTRUCTURAL, no léxico uniforme, y DISTINTO por forma —
 * Para `grid` y `fields`, un token por CELDA o por PAR (no por palabra), de modo
 * que cambiar una celda de una fila mueva 1 token de N y la similitud quede alta;
 * para `text_span`, tokens de palabra; para `verbatim`, un token por LÍNEA. Con
 * grano de palabra sobre una fila serializada, cambiar una celda de un campo corto
 * hunde la similitud por debajo de cualquier umbral, y ahí es donde H2 dice que se
 * pierden 500 identidades — Si se decide al revés (léxico uniforme), la métrica del
 * tramo 4 cambia por órdenes de magnitud sobre el mismo corpus.
 *
 * PROVISIONAL(H6): `verbatim` se tokeniza POR LÍNEA y NO por palabra — Tokenizar
 * `verbatim` por palabra descarta el espacio en blanco y hace que `"a b"` y `"a b"`
 * tengan la MISMA huella, destruyendo la única distinción que justifica que
 * `text_span` y `verbatim` sean dos formas («los espacios son significativos»,
 * §{Tramo 3 › Qué sale}). La línea es además la unidad natural de gradación de un
 * bloque de código: cambiar una línea de cincuenta deja la similitud alta. Este
 * error estaba en la primera versión de este archivo y lo encontró la prueba de
 * humo, que es exactamente cómo el banco encontró el hallazgo 10 (§{Cuarta}) — Si
 * se decide al revés, reindentar un bloque de código no mueve su id, que suena bien
 * pero significa que dos snippets distintos colisionan y ninguno ancla.
 *
 * ACREDITADO DESDE EL BLOQUE 3. El párrafo de arriba estaba escrito desde que se
 * arregló el bug y NADA lo verificaba: cambiar `lines` para que partiera por
 * `/\s+/gu` —o sea, reponer el bug exacto— pasaba `tsc` y los cinco guardianes en
 * verde, porque los casos del guardián comparaban `grid` y `container` y ninguno
 * era `verbatim`. Lo cuida el mutante M37, y su par de IGUALES (que `text_span` SÍ
 * colapsa espacio horizontal) impide el arreglo tramposo de colapsar los dos.
 */
export type Token = {
  readonly kind: TokenKind;
  readonly text: string;
};

const token = (kind: TokenKind, text: string): Token => ({ kind, text });

/**
 * LA AUSENCIA NO PUEDE SER LA CODIFICACIÓN DE NADA.
 *
 * La versión anterior escribía `(esquema ?? []).map(…)`, y con eso `null` y `[]`
 * producían LO MISMO: cero tokens. Los dos estados que el tipo distingue a
 * propósito colapsaban en la huella. Verificado antes del arreglo: un NODO-FILA
 * (`null`, «mi esquema está en el container») y una REGIÓN SIN ENCABEZADO (`[]`)
 * daban preimagen idéntica — y por la regla de unicidad del pase 1, un hash
 * repetido no ancla, así que NINGUNO DE LOS DOS anclaba. Ids movidos, curación
 * despegada, en silencio.
 *
 * La distinción no es cosmética: una planilla de 50 000 filas produce 50 000
 * identidades, y el esquema vive en el container justamente para que renombrar una
 * columna no cambie el hash de las 50 000 (anclaje 1.00 vs 0.00). El `null` de la
 * fila es lo que dice «miralo arriba», y colapsarlo anula ese diseño.
 *
 * La forma del arreglo es TOTAL a propósito: los tres casos emiten un token de
 * estado. Ninguno codifica por ausencia, así que no hay dos estados que puedan
 * volver a colisionar. Y va en clase propia (`schemaState`), no en `schema`: si
 * el estado viajara como un valor más, un encabezado que dijera literalmente
 * «inherited» colisionaría con el marcador.
 *
 * LOS TRES MARCADORES SON DATOS DE LA PREIMAGEN, igual que las doce clases de
 * `TokenKind` (GLOSARIO.md, G9). El bloque 3 los pasó de `heredado · ninguno ·
 * propio` a `inherited · none · own`, y con eso el caso adversario del guardián
 * —«un encabezado que se llama literalmente “heredado”»— dejaba de ser adversario
 * y seguía pasando: el fixture se reancló a `"inherited"` en el mismo commit.
 */
const tokensOfSchema = (
  schema: readonly string[] | null,
  shape: Shape,
): readonly Token[] => {
  if (schema === null) return [token("schemaState", "inherited")];
  if (schema.length === PARAMETERS.arithmetic.zero) {
    return [token("schemaState", "none")];
  }
  return [
    token("schemaState", "own"),
    ...schema.map((e) => token("schema", normalize(e, shape))),
  ];
};

/**
 * La frontera de fila de una `grid`. Va DESPUÉS de cada fila, incluida la última:
 * uniforme, sin caso especial.
 *
 * Sin esto, `filas.flatMap(f => f.map(…))` aplanaba todo y la FORMA de la tabla
 * desaparecía de la huella. Verificado antes del arreglo: `[[a,b],[c,d]]`,
 * `[[a,b,c,d]]` y `[[a],[b],[c],[d]]` daban UNA sola preimagen para tres tablas
 * distintas. Peor que un choque de identidad: reestructurar una tabla —partir una
 * columna, transponer— no cambiaba la huella, así que el reconciliador decía «sin
 * cambios», el caché de embeddings servía el vector viejo, y el cambio era
 * invisible de punta a punta.
 *
 * ES UN SEPARADOR PELADO, SIN POSICIÓN, y eso es deliberado. Codificar el índice de
 * la fila (`row:0`, `row:1`…) distinguiría igual, pero insertar una fila arriba
 * renumeraría todas las siguientes y les cambiaría la huella a todas — la misma
 * familia de error que el `ordinal` de la fórmula de identidad que el tramo 4
 * eliminó. La posición nunca entra en la huella.
 *
 * OJO AL DESPLEGAR: agregar tokens CAMBIA TODA HUELLA DE `grid` Y DE `container`.
 * Con datos en producción, la primera re-ingesta posterior a este cambio no ancla
 * nada de esas dos formas. Es el mismo evento que H16 describe («un adaptador
 * cambió y ahora produce hashes distintos») y necesita el mismo tratamiento.
 *
 * Y NO SOLO AGREGAR: **renombrar** un valor de `TokenKind` o uno de los tres
 * marcadores de `tokensOfSchema` tiene EXACTAMENTE el mismo efecto, sobre las seis
 * formas y no sobre dos. Es lo que hizo el bloque 3, doce veces más tres. Lo que
 * vuelve visible ese acto es la TABLA DE PREIMÁGENES CANÓNICAS de
 * `scripts/projection.mjs`: los casos de discriminación comparan cuerpos entre sí y
 * son ciegos a cualquier cambio que los mueva a todos a la vez — verificado
 * rompiéndolo, `"word"` → `"wrd"` pasaba los cinco guardianes en verde. Con la
 * tabla, mover el vocabulario es un acto que hay que escribir en el diff.
 */
const END_OF_ROW: Token = token("row", "");

const words = (text: string): readonly string[] =>
  text.split(/\s+/gu).filter((p) => p.length !== PARAMETERS.arithmetic.zero);

/** Las líneas EXACTAS, espacios incluidos. Ver PROVISIONAL(H6) en `Token`. */
const lines = (text: string): readonly string[] => text.split("\n");

// ─────────────────────────────── project ─────────────────────────────────────

/**
 * La proyección canónica de un `Body` a tokens. Determinística, total sobre las
 * seis formas, sin acceso a nada fuera del payload.
 *
 * QUÉ ENTRA Y QUÉ NO — la regla, no la lista:
 *
 * PROVISIONAL(H6): **entra en la huella lo que una persona vería si leyera el nodo;
 * queda afuera todo lo que un clasificador, un detector o el pipeline concluyeron
 * sobre él** — Es R3 (§{R3}) aplicada a la huella. De ahí sale directo, sin
 * discutir campo por campo: `marks` NO (poner una palabra en negrita conserva el
 * id), `language` NO (una re-detección de lenguaje no cambia el contenido), `mime`
 * NO (es derivable de los bytes), `grain` NO (un cambio `whole`↔`row` es una
 * conclusión del clasificador), `deferred` NO (además está PROHIBIDO por
 * §{La delegación tardía}), `role` NO (ver abajo), `Location` NO (§{Por qué esto},
 * §{Tercera}: mover un párrafo sin editarlo da 0 ids movidos), `Authorship` NO,
 * `parentId` NO, `breadcrumbs` NO, `delegation` NO, `attribution` NO — La ventaja
 * de la regla sobre la lista es que el próximo campo que se agregue a una forma se
 * resuelve solo, que es el criterio que el plan usa en todas partes. COSTO
 * ACEPTADO: dos `verbatim` con el mismo texto y lenguajes distintos colisionan.
 *
 * PROVISIONAL(H6): `shape` SÍ participa, `role` NO — El pase 2 ya restringe el
 * emparejamiento a «mismo tipo y misma forma» (§{5 · Reconciliador}), así que la
 * discriminación por rol se recupera aguas abajo sin pagar la fragilidad; y
 * `shape` es un hecho que el adaptador LEE del formato (§{`descomponer`}), no una
 * conclusión de un clasificador, así que incluirla no acopla la identidad a las
 * mejoras de clasificación. Si `role` entrara, mejorar un clasificador —que es el
 * objetivo declarado de la métrica de atribución (§{Observabilidad})—
 * reclasificaría nodos y les movería el id, que es exactamente la causa «un
 * adaptador cambió» que el plan admite no poder distinguir de un documento
 * reescrito (§{Degradación}, H16) — COSTO ACEPTADO Y ESCRIBIBLE: un `heading` y un
 * `paragraph` con texto idéntico no anclan y caen al pase 2, donde el filtro por
 * rol los separa correctamente — Si se decide al revés (`role` dentro), cada mejora
 * del clasificador despega curación.
 *
 * PROVISIONAL(C14): la huella de `container` NO es «la forma y si es ordenado»
 * (§{Tramo 4 › Qué sale}) sino eso MÁS su esquema — Con dos valores de dominio,
 * todos los containers no-ordenados de un documento hashean idéntico y, por la
 * regla de unicidad del pase 1 (§{5 · Reconciliador}), NINGUNO ancla jamás. Es
 * literalmente el hallazgo 10 (500 filas hashearon idénticas) aplicado a otra
 * forma, presentado en la misma sección como cobertura completa — RESIDUO ACEPTADO
 * Y DECLARADO: un container DESNUDO (sin esquema) sigue sin poder anclar por el
 * pase 1 y se resuelve siempre por similitud. Hay que escribirlo porque la
 * alternativa —que nadie lo note— es exactamente el «colapso en silencio» que el
 * plan nombra como su peor modo de falla. Corolario para la métrica: si los
 * containers desnudos no pueden anclar POR CONSTRUCCIÓN, el denominador de
 * `anchoring` mide en parte una imposibilidad.
 *
 * PROVISIONAL(H6): la huella de `asset` NO es solo «la referencia al objeto»
 * (§{Tramo 4 › Qué sale}) sino el par (objeto, ventana) — Con la referencia sola, y
 * por la precondición de terminación que obliga a referenciar el original
 * (§{Dónde frena}), dos regiones distintas de la MISMA página comparten
 * `ObjectRef`, hashean idénticas y ninguna ancla. Con el par, dos regiones
 * distintas dan huellas distintas y 200 apariciones del mismo logo entero siguen
 * colisionando entre sí — que es correcto: son el mismo contenido, y el pase 2 las
 * separa por hueco.
 *
 * PROVISIONAL(C3): la huella de un nodo-FILA son sus celdas y NADA MÁS — porque
 * `headers` es `null` en un nodo-fila y el esquema vive en el container. Es lo
 * que hace verdadera la medición de §{Las filas} («renombrar una columna toca UN
 * nodo»), declarada requisito medido, anclaje 1.00 vs 0.00.
 *
 * PROVISIONAL(#64): la huella es sobre CONTENIDO y nada más, y las filas repetidas
 * NO anclan — RESIDUO ACEPTADO, registrado acá en vez de dejado implícito, porque
 * la tentación de meter algo posicional para desempatar va a reaparecer cada vez
 * que alguien mire la métrica de anclaje, y la posición está prohibida por
 * §{Por qué la identidad} y §{Tramo 4 › Decisiones}. Y la cifra publicada de
 * §{Cuarta} (502 anclas, anclaje 1.00) depende de una HIPÓTESIS —500 filas de
 * contenido distinto entre sí— que hay que declarar junto a la cifra: una planilla
 * real con columnas de estado o categoría produce filas enteras repetidas → ninguna
 * ancla → todas al pase 2 en un solo hueco → el escenario cuadrático de
 * §{Tramo 4 › Costo}.
 */
export const project = (body: Body): readonly Token[] => {
  const head = token("shape", body.shape);
  switch (body.shape) {
    case "text_span":
      return [
        head,
        ...words(normalize(body.text, body.shape)).map((p) =>
          token("word", p),
        ),
      ];
    case "verbatim":
      return [
        head,
        ...lines(normalize(body.text, body.shape)).map((l) =>
          token("line", l),
        ),
      ];
    case "asset":
      return [
        head,
        token("object", body.ref.object),
        token("window", encodeWindow(body.ref.window)),
      ];
    case "grid":
      return [
        head,
        ...tokensOfSchema(body.headers, body.shape),
        ...body.rows.flatMap((row) => [
          ...row.map((c) => token("cell", normalize(c.text, body.shape))),
          END_OF_ROW,
        ]),
      ];
    case "fields":
      return [
        head,
        ...body.pairs.flatMap((pair) => [
          token("label", normalize(pair.label, body.shape)),
          token("value", normalize(pair.value, body.shape)),
        ]),
      ];
    case "container":
      return [
        head,
        token("ordered", String(body.ordered)),
        ...tokensOfSchema(body.schema, body.shape),
      ];
  }
};

/**
 * Canonicalización de una `Window`.
 *
 * RESIDUO DECLARADO (C4): las coordenadas de `Box` son ENTEROS en milésimas del
 * marco precisamente para que esto sea exacto. Si alguna vez `Box` pasa a floats,
 * dos corridas dan `MatterHash` distintos y el caché por página deja de acertar.
 */
export const encodeWindow = (v: Window): string => {
  switch (v.scope) {
    case "whole":
      return encodeParts(v.scope);
    case "range":
      return encodeParts(v.scope, String(v.start), String(v.end));
    case "region":
      return encodeParts(
        v.scope,
        v.box.frame,
        String(v.box.x),
        String(v.box.y),
        String(v.box.width),
        String(v.box.height),
        String(v.box.z),
      );
  }
};

// ─────────────────────────────── encode · huella ─────────────────────────────

/**
 * Serialización inyectiva de una proyección. Es la PREIMAGEN de la huella: `ir` la
 * define entera y el llamador solo aplica sha256, que no es una decisión de diseño.
 */
export const encode = (tokens: readonly Token[]): string =>
  encodeParts(...tokens.flatMap((t) => [t.kind, t.text]));

/** La preimagen de la huella de un nodo. Pura, sin dependencias, determinística. */
export const preimageOfFingerprint = (body: Body): string =>
  encode(project(body));

/** Una función de hash provista por el llamador. `ir` no depende de `node:crypto`. */
export type HashFn = (preimage: string) => string;

/**
 * `fingerprintOf` — el material de la próxima reconciliación (§{Tramo 4 › Qué sale}).
 *
 * D24 — CERRADO EN EL BLOQUE 3b. Devuelve `NodeFingerprint`, y la marca se aplica
 * ACÁ ADENTRO. Hasta este bloque devolvía `string` pelado con «que marque el
 * llamador» escrito al lado, así que la familia de marcas de `identity.ts` no tenía
 * UN SOLO productor tipado: la marca probaba que separa —`_S5`, en verde todo el
 * tiempo— y nadie probaba que el productor la usara.
 *
 * POR QUÉ LA MARCA VA ADENTRO Y NO EN `HashFn`. La alternativa era
 * `HashFn = (preimage: string) => NodeFingerprint`, que también obliga, pero obliga
 * AL LLAMADOR: `node:crypto` devuelve `string`, así que los doce adaptadores y el
 * emisor tendrían que marcar en su envoltorio de sha256 — y ese mismo envoltorio es
 * el que va a calcular `ByteHash` y `MatterHash`, que son otras marcas. Una función
 * de hash que solo sabe producir huellas de nodo o se duplica por marca o se
 * desmarca con un `as`, y ahí la marca vuelve a ser ceremonia. Con la marca adentro,
 * `HashFn` sigue siendo «sha256 y nada más» y el único camino a un `NodeFingerprint`
 * es esta función: producir una huella sin marcar no es algo que un guardián
 * detecte, es algo que no se puede escribir.
 *
 * QUÉ LO DESTRABÓ, porque no se pudo antes y el registro vale: marcar exige importar
 * `identity.ts`, y ahí vivía `Authorship`, que NO PUEDE ENTRAR EN LA HUELLA. Lo
 * único que lo impedía era que este archivo no NOMBRARA aquel —protección de
 * nombrabilidad, sostenida por lectura—, y el import la habría caducado. La frontera
 * que la reemplaza era INESCRIBIBLE mientras `Authorship` viviera en `identity.ts`,
 * porque `shapes.ts` importa `ObjectKey` y el camino ya existía:
 *
 *     IR-ERR: frontera violada — projection.ts alcanza identity.ts
 *             camino: projection.ts → shapes.ts → identity.ts
 *
 * El bloque 3b mudó `Authorship` a un archivo propio —un tipo, el corte mínimo— y con
 * eso la frontera `projection.ts ↛ provenance.ts` existe, la impone
 * `scripts/boundaries.mjs` y está acreditada rompiéndola. Recién ahí este import
 * dejó de comprar un tipo vendiendo un invariante.
 *
 * LO QUE ESTE IMPORT EMPEORÓ, Y ESTE BLOQUE CERRÓ. El corte del 3b fue mínimo y dejó
 * afuera a `DelegationId`, que declara el mismo invariante («NUNCA entra en la
 * huella»): este import lo metió en el alcance léxico de este archivo sin ninguna
 * frontera que lo protegiera, y lo sostenía la lista de PROVISIONAL(H6) en `project`
 * («`delegation` NO»), que es prosa. Se mudó al mismo archivo —que por eso pasó a
 * llamarse `provenance.ts`, la categoría que cubre a los dos: no QUÉ ES el contenido
 * sino CÓMO LLEGÓ—, la frontera es una sola y está acreditada por miembro: M46 con
 * `Authorship`, M49 con `DelegationId`.
 */
export const fingerprintOf = (body: Body, sha256: HashFn): NodeFingerprint =>
  asNodeFingerprint(sha256(preimageOfFingerprint(body)));

// ─────────────────────────────── similarity ──────────────────────────────────

const key = (t: Token): string => encodeParts(t.kind, t.text);

const nGrams = (tokens: readonly Token[]): readonly string[] => {
  const n = Math.min(PARAMETERS.projection.nGramSize, tokens.length);
  if (n === PARAMETERS.arithmetic.zero) return [];
  return tokens
    .map((_, i) => tokens.slice(i, i + n))
    .filter((g) => g.length === n)
    .map((g) => encodeParts(...g.map(key)));
};

/**
 * Similitud entre dos proyecciones, en `[0,1]`. Jaccard sobre MULTICONJUNTOS de
 * n-gramas de tokens.
 *
 * PROVISIONAL(H2): multiconjuntos y no conjuntos — Una planilla con cincuenta
 * celdas repetidas tiene que poder distinguirse de una con una; con conjuntos,
 * colapsan.
 *
 * GARANTÍA POR CONSTRUCCIÓN: dos cuerpos con la misma huella tienen la misma
 * proyección, los mismos n-gramas y por lo tanto similitud 1. El pase 1 y el pase
 * 2 no pueden contradecirse.
 *
 * LO QUE ESTA FUNCIÓN NO DECIDE, y el plan tampoco (auditoría H2): si el
 * emparejamiento del reconciliador es voraz, por orden o asignación óptima; qué
 * pasa con empates; si se admite 1:N (un párrafo que se parte en dos es la edición
 * más común y el plan asume 1:1 implícitamente); si el pase 3 conserva la
 * restricción «mismo tipo y misma forma»; y si un emparejamiento del pase 2 puede
 * revocarse ante un candidato mejor del pase 3. Eso es del reconciliador, no del
 * contrato.
 *
 * `asset` y `container` DEGENERAN a 0/1: sus proyecciones son de dos o tres tokens
 * y no admiten gradación. O sea que `similarityThreshold` gobierna de hecho solo
 * `text_span`, `verbatim`, `grid` y `fields`.
 */
export const similarityOfProjections = (
  a: readonly Token[],
  b: readonly Token[],
): number => {
  const ga = nGrams(a);
  const gb = nGrams(b);
  if (
    ga.length === PARAMETERS.arithmetic.zero &&
    gb.length === PARAMETERS.arithmetic.zero
  ) {
    return PARAMETERS.projection.maxSimilarity;
  }
  const remaining = [...gb];
  const common = ga.filter((g) => {
    const i = remaining.indexOf(g);
    if (i === PARAMETERS.arithmetic.notFound) return false;
    remaining.splice(i, PARAMETERS.arithmetic.one);
    return true;
  });
  const union = ga.length + gb.length - common.length;
  if (union === PARAMETERS.arithmetic.zero) {
    return PARAMETERS.projection.maxSimilarity;
  }
  return common.length / union;
};

/** La similitud que consumen los pases 2 y 3, sobre cuerpos. */
export const similarity = (a: Body, b: Body): number =>
  similarityOfProjections(project(a), project(b));

// ─────────────────────────────── render ──────────────────────────────────────

/**
 * El texto LEGIBLE de un nodo: lo que va a `Fragment.text` y al embedding.
 * SEPARADA de la huella a propósito — ver el PROVISIONAL(H2/H4/H6) del encabezado.
 *
 * PROVISIONAL(#53): devuelve `null` para `asset` y `container`, que no tienen texto
 * — Obliga al tramo 5 a decidir explícitamente qué hace con un fragmento sin texto
 * en vez de embeber cadena vacía, que la mayoría de las APIs rechaza y que
 * colisiona en el caché con todos los demás fragmentos vacíos. La decisión
 * recomendada: se emite el fragmento con `text: ''` y `vectores: 0`, se persiste,
 * y el enriquecimiento posterior lo re-emite — así §{El recorrido} («un nodo entra
 * entero en algún fragmento, siempre») sigue siendo cierto — Si se decide al revés
 * (omitir el fragmento), el nodo no entra en ninguno y el invariante es falso.
 *
 * PROVISIONAL(H4): `grid` se renderiza como TSV, no como markdown con pipes — Es lo
 * único que este archivo puede fijar sin decidir por el tramo 6, y una grilla en
 * markdown con pipes puede DUPLICAR los tokens de la misma grilla en TSV, lo que
 * cambia si se ventanea y en cuántas ventanas. `containerSchema` es lo que
 * hace posible renderizar una fila sola, que §{Las filas} declara necesario y no
 * provee — Si se decide al revés (markdown), N ventanas cambia para toda planilla.
 */
export const render = (
  body: Body,
  containerSchema: readonly string[] | null,
): string | null => {
  switch (body.shape) {
    case "text_span":
    case "verbatim":
      return normalize(body.text, body.shape);
    case "asset":
      return null;
    case "container":
      return null;
    case "fields":
      return body.pairs.map((p) => `${p.label}\t${p.value}`).join("\n");
    case "grid": {
      // `null` HEREDA del container («mi esquema está arriba»); `[]` NO hereda,
      // porque dice explícitamente «esta región no tiene encabezados».
      const headers = body.headers ?? containerSchema;
      const rows = body.rows.map((f) => f.map((c) => c.text).join("\t"));
      // Un esquema VACÍO no es una línea de encabezado vacía: es no tener línea.
      // Antes, `headers: []` producía `"\nx\ty"` — con la primera línea en
      // blanco—, que es justo el mecanismo que hace renderizable una fila sola.
      return headers === null || headers.length === PARAMETERS.arithmetic.zero
        ? rows.join("\n")
        : [headers.join("\t"), ...rows].join("\n");
    }
  }
};

/**
 * La política de claves de `DataRecord.values`.
 *
 * PROVISIONAL(#55): las etiquetas vacías se rellenan por POSICIÓN (`col_1`,
 * `col_2`) y las repetidas se desambiguan con sufijo posicional —
 * `Record<string,string>` (§{Las dos salidas}) exige claves únicas y no vacías, y
 * una planilla real tiene columnas sin encabezado, encabezados repetidos y filas
 * cortas. `ir` es el único paquete que `adaptadores` y `emision` alcanzan a la vez,
 * así que es el único lugar donde la política puede vivir sin romper el grafo de
 * §{Paquetes} — Si se decide al revés (que cada consumidor invente sus claves), dos
 * implementaciones producen `DataRecord` distintos para la misma planilla. RIESGO
 * CONOCIDO: colisiona con un encabezado real que se llame literalmente `col_3`.
 */
export const fieldKey = (
  label: string | null,
  position: number,
  alreadyUsed: ReadonlySet<string>,
): string => {
  const base =
    label === null || label.trim().length === PARAMETERS.arithmetic.zero
      ? `col_${position}`
      : label.trim();
  return alreadyUsed.has(base) ? `${base}__${position}` : base;
};
