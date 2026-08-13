/**
 * La proyección canónica — UNA función, tres consumidores.
 *
 * El plan necesita tres cosas que hoy son tres funciones inexistentes y que nadie
 * declaró relacionadas: la serialización canónica de la huella (H6), la
 * tokenización de la similitud de los pases 2 y 3 (H2), y el renderizado a texto
 * de `Fragmento.texto` y del embedding (H4). Si son independientes DERIVAN —H2
 * avisa que la elección de tokenización decide si «una planilla pierde 500
 * identidades o ninguna»— y nada garantiza la propiedad más elemental que el
 * reconciliador necesita: que el pase 1 y el pase 2 no se contradigan.
 *
 * PROVISIONAL(H2/H4/H6): UNA proyección por nodo con dos consumidores, y el
 * renderizado APARTE — `proyectar(cuerpo)` es única, determinística y consciente de
 * la forma; `huellaDe` = hash(codificar(proyectar(...))) y `similitud` =
 * f(proyectar(a), proyectar(b)). De ahí sale POR CONSTRUCCIÓN el invariante que la
 * auditoría reclama sin nombrarlo: `huella(a) === huella(b) ⟹ similitud(a,b) ===
 * 1`. `renderizar` queda separada porque persigue lo contrario: la huella tiene que
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

import {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  PARAMETERS as PARAMETROS,
} from "./params.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Body as Cuerpo,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Shape as Forma,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Window as Ventana,
} from "./shapes.js";

// ─────────────────────────────── El operador `‖` ─────────────────────────────

/**
 * El operador `‖` de §{Caché}, §{Lo que se borró} y §{Cómo se rebana}, que el plan
 * usa
 * tres veces y no define nunca.
 *
 * PROVISIONAL(#27): longitud prefijada por componente (`len:valor`), no separador
 * improbable ni concatenación desnuda — Sin longitud ni delimitador, un
 * `idAdaptador` terminado en dígitos seguido de una versión numérica colisiona con
 * otra terna y el caché sirve árboles equivocados EN SILENCIO, que es el modo de
 * falla que la sección del caché existe para evitar. Con longitud prefijada es
 * inyectiva POR CONSTRUCCIÓN, sin verificación que alguien pueda olvidarse — es la
 * misma preferencia que el documento aplica en todas partes: mover el invariante a
 * un lugar donde no se pueda violar — Si se decide al revés (separador `\x1f` +
 * verificación), hay que verificar en cada sitio y la verificación se olvida.
 *
 * El MISMO operador en las DOS claves de caché, no uno por sitio.
 */
export const concatenar = (...partes: readonly string[]): string =>
  partes.map((p) => `${p.length}:${p}`).join("");

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
 */
export const normalizar = (texto: string, forma: Forma): string => {
  const base = texto.normalize("NFC").replace(/\r\n?/gu, "\n");
  if (forma === "verbatim") return base;
  return base.replace(/[^\S\n]+/gu, " ").trim();
};

// ─────────────────────────────── Token ───────────────────────────────────────

/**
 * La clase de un token. Existe para que la codificación sea inyectiva: dos
 * proyecciones con los mismos textos y clases distintas no pueden colisionar.
 */
export type ClaseDeToken =
  | "forma"
  | "ordenado"
  | "esquemaEstado"
  | "esquema"
  | "palabra"
  | "linea"
  | "celda"
  | "fila"
  | "etiqueta"
  | "valor"
  | "objeto"
  | "ventana";

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
 */
export type Token = {
  readonly clase: ClaseDeToken;
  readonly texto: string;
};

const token = (clase: ClaseDeToken, texto: string): Token => ({ clase, texto });

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
 * volver a colisionar. Y va en clase propia (`esquemaEstado`), no en `esquema`: si
 * el estado viajara como un valor más, un encabezado que dijera literalmente
 * «heredado» colisionaría con el marcador.
 */
const tokensDeEsquema = (
  esquema: readonly string[] | null,
  forma: Forma,
): readonly Token[] => {
  if (esquema === null) return [token("esquemaEstado", "heredado")];
  if (esquema.length === PARAMETROS.arithmetic.zero) {
    return [token("esquemaEstado", "ninguno")];
  }
  return [
    token("esquemaEstado", "propio"),
    ...esquema.map((e) => token("esquema", normalizar(e, forma))),
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
 * la fila (`fila:0`, `fila:1`…) distinguiría igual, pero insertar una fila arriba
 * renumeraría todas las siguientes y les cambiaría la huella a todas — la misma
 * familia de error que el `ordinal` de la fórmula de identidad que el tramo 4
 * eliminó. La posición nunca entra en la huella.
 *
 * OJO AL DESPLEGAR: agregar tokens CAMBIA TODA HUELLA DE `grid` Y DE `container`.
 * Con datos en producción, la primera re-ingesta posterior a este cambio no ancla
 * nada de esas dos formas. Es el mismo evento que H16 describe («un adaptador
 * cambió y ahora produce hashes distintos») y necesita el mismo tratamiento.
 */
const FIN_DE_FILA: Token = token("fila", "");

const palabras = (texto: string): readonly string[] =>
  texto.split(/\s+/gu).filter((p) => p.length !== PARAMETROS.arithmetic.zero);

/** Las líneas EXACTAS, espacios incluidos. Ver PROVISIONAL(H6) en `Token`. */
const líneas = (texto: string): readonly string[] => texto.split("\n");

// ─────────────────────────────── proyectar ───────────────────────────────────

/**
 * La proyección canónica de un `Cuerpo` a tokens. Determinística, total sobre las
 * seis formas, sin acceso a nada fuera del payload.
 *
 * QUÉ ENTRA Y QUÉ NO — la regla, no la lista:
 *
 * PROVISIONAL(H6): **entra en la huella lo que una persona vería si leyera el nodo;
 * queda afuera todo lo que un clasificador, un detector o el pipeline concluyeron
 * sobre él** — Es R3 (§{R3}) aplicada a la huella. De ahí sale directo, sin
 * discutir campo por campo: `marcas` NO (poner una palabra en negrita conserva el
 * id), `lenguaje` NO (una re-detección de lenguaje no cambia el contenido), `mime`
 * NO (es derivable de los bytes), `grano` NO (un cambio `entero`↔`fila` es una
 * conclusión del clasificador), `pendientes` NO (además está PROHIBIDO por
 * §{La delegación tardía}), `tipo` NO (ver abajo), `Location` NO (§{Por qué esto},
 * §{Tercera}: mover un párrafo sin editarlo da 0 ids movidos), `Authorship` NO,
 * `parentId` NO, `migas` NO, `delegación` NO, `atribución` NO — La ventaja de la
 * regla sobre la lista es que el próximo campo que se agregue a una forma se
 * resuelve solo, que es el criterio que el plan usa en todas partes. COSTO
 * ACEPTADO: dos `verbatim` con el mismo texto y lenguajes distintos colisionan.
 *
 * PROVISIONAL(H6): `forma` SÍ participa, `tipo` NO — El pase 2 ya restringe el
 * emparejamiento a «mismo tipo y misma forma» (§{5 · Reconciliador}), así que la
 * discriminación por tipo se recupera aguas abajo sin pagar la fragilidad; y
 * `forma` es un hecho que el adaptador LEE del formato (§{`descomponer`}), no una
 * conclusión de un clasificador, así que incluirla no acopla la identidad a las
 * mejoras de clasificación. Si `tipo` entrara, mejorar un clasificador —que es el
 * objetivo declarado de la métrica de atribución (§{Observabilidad})—
 * reclasificaría nodos y les movería el id, que es exactamente la causa «un
 * adaptador cambió» que el plan admite no poder distinguir de un documento
 * reescrito (§{Degradación}, H16) — COSTO ACEPTADO Y ESCRIBIBLE: un `titulo` y un
 * `parrafo` con texto idéntico no anclan y caen al pase 2, donde el filtro por tipo
 * los separa correctamente — Si se decide al revés (`tipo` dentro), cada mejora del
 * clasificador despega curación.
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
 * `anclaje` mide en parte una imposibilidad.
 *
 * PROVISIONAL(H6): la huella de `asset` NO es solo «la referencia al objeto»
 * (§{Tramo 4 › Qué sale}) sino el par (objeto, ventana) — Con la referencia sola, y
 * por la precondición de terminación que obliga a referenciar el original
 * (§{Dónde frena}), dos regiones distintas de la MISMA página comparten
 * `RefObjeto`, hashean idénticas y ninguna ancla. Con el par, dos regiones
 * distintas dan huellas distintas y 200 apariciones del mismo logo entero siguen
 * colisionando entre sí — que es correcto: son el mismo contenido, y el pase 2 las
 * separa por hueco.
 *
 * PROVISIONAL(C3): la huella de un nodo-FILA son sus celdas y NADA MÁS — porque
 * `encabezados` es `null` en un nodo-fila y el esquema vive en el container. Es lo
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
export const proyectar = (cuerpo: Cuerpo): readonly Token[] => {
  const cabecera = token("forma", cuerpo.shape);
  switch (cuerpo.shape) {
    case "text_span":
      return [
        cabecera,
        ...palabras(normalizar(cuerpo.text, cuerpo.shape)).map((p) =>
          token("palabra", p),
        ),
      ];
    case "verbatim":
      return [
        cabecera,
        ...líneas(normalizar(cuerpo.text, cuerpo.shape)).map((l) =>
          token("linea", l),
        ),
      ];
    case "asset":
      return [
        cabecera,
        token("objeto", cuerpo.ref.object),
        token("ventana", codificarVentana(cuerpo.ref.window)),
      ];
    case "grid":
      return [
        cabecera,
        ...tokensDeEsquema(cuerpo.headers, cuerpo.shape),
        ...cuerpo.rows.flatMap((fila) => [
          ...fila.map((c) => token("celda", normalizar(c.text, cuerpo.shape))),
          FIN_DE_FILA,
        ]),
      ];
    case "fields":
      return [
        cabecera,
        ...cuerpo.pairs.flatMap((par) => [
          token("etiqueta", normalizar(par.label, cuerpo.shape)),
          token("valor", normalizar(par.value, cuerpo.shape)),
        ]),
      ];
    case "container":
      return [
        cabecera,
        token("ordenado", String(cuerpo.ordered)),
        ...tokensDeEsquema(cuerpo.schema, cuerpo.shape),
      ];
  }
};

/**
 * Canonicalización de una `Ventana`.
 *
 * RESIDUO DECLARADO (C4): las coordenadas de `Box` son ENTEROS en milésimas del
 * marco precisamente para que esto sea exacto. Si alguna vez `Box` pasa a floats,
 * dos corridas dan `MatterHash` distintos y el caché por página deja de acertar.
 */
export const codificarVentana = (v: Ventana): string => {
  switch (v.scope) {
    case "whole":
      return concatenar(v.scope);
    case "range":
      return concatenar(v.scope, String(v.start), String(v.end));
    case "region":
      return concatenar(
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

// ─────────────────────────────── codificar · huella ──────────────────────────

/**
 * Serialización inyectiva de una proyección. Es la PREIMAGEN de la huella: `ir` la
 * define entera y el llamador solo aplica sha256, que no es una decisión de diseño.
 */
export const codificar = (tokens: readonly Token[]): string =>
  concatenar(...tokens.flatMap((t) => [t.clase, t.texto]));

/** La preimagen de la huella de un nodo. Pura, sin dependencias, determinística. */
export const preimagenDeHuella = (cuerpo: Cuerpo): string =>
  codificar(proyectar(cuerpo));

/** Una función de hash provista por el llamador. `ir` no depende de `node:crypto`. */
export type FunciónHash = (preimagen: string) => string;

/**
 * `huellaDe` — el material de la próxima reconciliación (§{Tramo 4 › Qué sale}).
 * El tipo del retorno es `string` en bruto: quien lo marque como `NodeFingerprint`
 * es el llamador, con `asNodeFingerprint(...)`.
 *
 * PENDING(D24): eso NO es una decisión cerrada, es un hueco conocido. Nadie está
 * OBLIGADO a marcar, así que la familia de marcas de `identity.ts` no tiene un solo
 * productor tipado. Marcar acá exigiría que este archivo importe `identity.ts`, y
 * esa arista volvería `Authorship` alcanzable desde el archivo que calcula la
 * huella — hoy «`Authorship` NO entra en la huella» lo impone justamente que esa
 * arista no exista. Ver el PENDING(D24) de `NodeFingerprint`.
 */
export const huellaDe = (cuerpo: Cuerpo, sha256: FunciónHash): string =>
  sha256(preimagenDeHuella(cuerpo));

// ─────────────────────────────── similitud ───────────────────────────────────

const clave = (t: Token): string => concatenar(t.clase, t.texto);

const nGramas = (tokens: readonly Token[]): readonly string[] => {
  const n = Math.min(PARAMETROS.projection.nGramSize, tokens.length);
  if (n === PARAMETROS.arithmetic.zero) return [];
  return tokens
    .map((_, i) => tokens.slice(i, i + n))
    .filter((g) => g.length === n)
    .map((g) => concatenar(...g.map(clave)));
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
 * y no admiten gradación. O sea que `umbralDeSimilitud` gobierna de hecho solo
 * `text_span`, `verbatim`, `grid` y `fields`.
 */
export const similitudDeProyecciones = (
  a: readonly Token[],
  b: readonly Token[],
): number => {
  const ga = nGramas(a);
  const gb = nGramas(b);
  if (
    ga.length === PARAMETROS.arithmetic.zero &&
    gb.length === PARAMETROS.arithmetic.zero
  ) {
    return PARAMETROS.projection.maxSimilarity;
  }
  const restantes = [...gb];
  const comunes = ga.filter((g) => {
    const i = restantes.indexOf(g);
    if (i === PARAMETROS.arithmetic.notFound) return false;
    restantes.splice(i, PARAMETROS.arithmetic.one);
    return true;
  });
  const unión = ga.length + gb.length - comunes.length;
  if (unión === PARAMETROS.arithmetic.zero) {
    return PARAMETROS.projection.maxSimilarity;
  }
  return comunes.length / unión;
};

/** La similitud que consumen los pases 2 y 3, sobre cuerpos. */
export const similitud = (a: Cuerpo, b: Cuerpo): number =>
  similitudDeProyecciones(proyectar(a), proyectar(b));

// ─────────────────────────────── renderizar ──────────────────────────────────

/**
 * El texto LEGIBLE de un nodo: lo que va a `Fragmento.texto` y al embedding.
 * SEPARADA de la huella a propósito — ver el PROVISIONAL(H2/H4/H6) del encabezado.
 *
 * PROVISIONAL(#53): devuelve `null` para `asset` y `container`, que no tienen texto
 * — Obliga al tramo 5 a decidir explícitamente qué hace con un fragmento sin texto
 * en vez de embeber cadena vacía, que la mayoría de las APIs rechaza y que
 * colisiona en el caché con todos los demás fragmentos vacíos. La decisión
 * recomendada: se emite el fragmento con `texto: ''` y `vectores: 0`, se persiste,
 * y el enriquecimiento posterior lo re-emite — así §{El recorrido} («un nodo entra
 * entero en algún fragmento, siempre») sigue siendo cierto — Si se decide al revés
 * (omitir el fragmento), el nodo no entra en ninguno y el invariante es falso.
 *
 * PROVISIONAL(H4): `grid` se renderiza como TSV, no como markdown con pipes — Es lo
 * único que este archivo puede fijar sin decidir por el tramo 6, y una grilla en
 * markdown con pipes puede DUPLICAR los tokens de la misma grilla en TSV, lo que
 * cambia si se ventanea y en cuántas ventanas. `esquemaDelContainer` es lo que
 * hace posible renderizar una fila sola, que §{Las filas} declara necesario y no
 * provee — Si se decide al revés (markdown), N ventanas cambia para toda planilla.
 */
export const renderizar = (
  cuerpo: Cuerpo,
  esquemaDelContainer: readonly string[] | null,
): string | null => {
  switch (cuerpo.shape) {
    case "text_span":
    case "verbatim":
      return normalizar(cuerpo.text, cuerpo.shape);
    case "asset":
      return null;
    case "container":
      return null;
    case "fields":
      return cuerpo.pairs.map((p) => `${p.label}\t${p.value}`).join("\n");
    case "grid": {
      // `null` HEREDA del container («mi esquema está arriba»); `[]` NO hereda,
      // porque dice explícitamente «esta región no tiene encabezados».
      const encabezados = cuerpo.headers ?? esquemaDelContainer;
      const filas = cuerpo.rows.map((f) => f.map((c) => c.text).join("\t"));
      // Un esquema VACÍO no es una línea de encabezado vacía: es no tener línea.
      // Antes, `encabezados: []` producía `"\nx\ty"` — con la primera línea en
      // blanco—, que es justo el mecanismo que hace renderizable una fila sola.
      return encabezados === null ||
        encabezados.length === PARAMETROS.arithmetic.zero
        ? filas.join("\n")
        : [encabezados.join("\t"), ...filas].join("\n");
    }
  }
};

/**
 * La política de claves de `Registro.valores`.
 *
 * PROVISIONAL(#55): las etiquetas vacías se rellenan por POSICIÓN (`col_1`,
 * `col_2`) y las repetidas se desambiguan con sufijo posicional —
 * `Record<string,string>` (§{Las dos salidas}) exige claves únicas y no vacías, y
 * una planilla real tiene columnas sin encabezado, encabezados repetidos y filas
 * cortas. `ir` es el único paquete que `adaptadores` y `emision` alcanzan a la vez,
 * así que es el único lugar donde la política puede vivir sin romper el grafo de
 * §{Paquetes} — Si se decide al revés (que cada consumidor invente sus claves), dos
 * implementaciones producen `Registro` distintos para la misma planilla. RIESGO
 * CONOCIDO: colisiona con un encabezado real que se llame literalmente `col_3`.
 */
export const claveDeCampo = (
  etiqueta: string | null,
  posición: number,
  yaUsadas: ReadonlySet<string>,
): string => {
  const base =
    etiqueta === null || etiqueta.trim().length === PARAMETROS.arithmetic.zero
      ? `col_${posición}`
      : etiqueta.trim();
  return yaUsadas.has(base) ? `${base}__${posición}` : base;
};
