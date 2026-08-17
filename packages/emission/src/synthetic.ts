/**
 * Los NODOS SINTÉTICOS con los que se construyó el emisor. Fixtures a mano, pistas
 * a mano, CERO adaptadores.
 *
 * Esto no es andamio de test: es la prueba de que el borde R1 es real.
 *
 * > «Que el emisor se construya en el paso 2, antes que cualquier adaptador, es la
 * > prueba más dura de que el borde R1 es real: se alimenta con nodos sintéticos y
 * > pistas escritas a mano. **Si hiciera falta un adaptador para escribirlo, el
 * > diseño estaría mal.**»
 *
 * Sigue siendo cierto después de la traducción, y es verificable de un vistazo: este
 * archivo importa `@savia-os/ir` y NADA MÁS, y `package.json` declara esa única
 * dependencia. Los doce adaptadores siguen sin existir.
 *
 * Viven en `src/` y no dentro del guardián porque `Node` lleva `NODE_BRAND` y solo
 * `asNode` la pone (PROVISIONAL(H1) en `ir/src/outputs.ts`): un literal suelto en un
 * `.mjs` no puede construir un `Node`, y uno sin tipar no cotejaría contra el
 * contrato, que es justo lo que estos casos existen para cotejar.
 *
 * EL ARCHIVO SE LLAMA `synthetic.ts` Y NO `cases.ts` NI `fixtures.ts`
 * (GLOSARIO.md, B2): lo que estos casos tienen de valioso no es que sean casos,
 * es de DÓNDE salen —de una mano, sin un adaptador—, y eso es lo que nombra
 * `synthetic`. `fixtures.ts` diría exactamente lo que la primera línea niega.
 *
 * El texto de los documentos, los `name` y los `why` se quedan en ESPAÑOL: son
 * prosa, del mismo registro que los docstrings (GLOSARIO.md, sección 1), y el caso canónico
 * tiene que poder cotejarse letra por letra contra el ejemplo que publica el plan.
 */

import {
  asActorId,
  asAdapterId,
  asDelegationId,
  asInstant,
  asLocalId,
  asNode,
  asObjectKey,
  type Authorship,
  type Body,
  type Box,
  type Coordinate,
  type DelegationId,
  type Hint,
  type Location,
  type Node,
  type RecognitionLevel,
  type Role,
} from "@savia-os/ir";

// ─────────────────────────────── Constructores ───────────────────────────────

const AUTHORSHIP: Authorship = {
  actor: asActorId("usuario-sintetico"),
  when: asInstant("2026-08-10T00:00:00.000Z"),
  source: "fixture",
};

const location = (anchor: string): Location => ({
  adapter: asAdapterId("sintetico"),
  anchor,
  coordinate: { space: "source" },
  within: [],
});

/**
 * NO LLEVA `certainty`, Y NO ES UN OLVIDO DE LA TRADUCCIÓN. Este constructor
 * escribía `certeza: "declarado"` al lado de `nivel: "declarativo"`, y el bloque 3
 * de `ir` BORRÓ el campo de `RawNode`: la certeza es enteramente derivable del
 * nivel (`certaintyOfLevel`, una función pura y total), y guardar las dos las deja
 * discrepar. O sea que este fixture no estaba «escrito con otro nombre»: estaba
 * apoyado en un campo que el contrato ya no promete. Quien necesite la certeza de
 * estos nodos la deriva — `certaintyOfLevel(node.level)` — y da `"declared"`, que
 * es exactamente lo que el fixture decía.
 */
const node = (
  anchor: string,
  role: Role,
  body: Body,
  hint: Hint | null,
  delegation: readonly DelegationId[] = [],
): Node =>
  asNode({
    role,
    body,
    location: location(anchor),
    hint,
    delegation,
    attribution: null,
    level: "declarative",
    confidence: null,
    authorship: AUTHORSHIP,
  });

const prose = (text: string): Body => ({ shape: "text_span", text, marks: [] });

const heading = (t: string, level: number | null, delegation: readonly DelegationId[] = []): Node =>
  node(t, "heading", prose(t), { linkage: "level", level }, delegation);

const paragraph = (t: string, hint: Hint | null = null, delegation: readonly DelegationId[] = []): Node =>
  node(t, "paragraph", prose(t), hint, delegation);

const box = (x: number, y: number, width: number, height: number): Box => ({
  frame: "p1",
  x,
  y,
  width,
  height,
  z: null,
});

// ─────────────────────────────── Los casos ───────────────────────────────────

export type Case = {
  readonly name: string;
  /** Qué se rompería si el emisor lo tratara mal. */
  readonly why: string;
  readonly nodes: readonly Node[];
  /**
   * El padre esperado de cada nodo, por su `location.anchor`. `null` = raíz.
   *
   * ES OBLIGATORIA, y esta versión del tipo existe porque antes solo la tenía el
   * caso canónico. El banco de mutación hizo que la vía `spatial` eligiera el
   * contenedor MÁS EXTERNO en vez del más interno —el sello colgando de la página
   * en vez del recuadro— y NINGÚN invariante se enteró: las migas se re-derivan de
   * `localParent`, así que un padre mal elegido produce migas coherentes con el
   * padre mal elegido. Sin un árbol esperado escrito a mano, la coherencia interna
   * no distingue el árbol correcto del incorrecto.
   *
   * Se compara por `anchor` y no por texto porque un `container` y un `asset` no
   * tienen texto legible. En los fixtures el ancla ES el texto, así que la traza
   * del caso canónico se lee igual que la del plan.
   */
  readonly trace: readonly (string | null)[];
};

/**
 * Un documento donde todo cuelga de la raíz. Es el caso del chat: «un mensaje no
 * tiene página, hoja ni offset» y ninguno cuelga de otro.
 *
 * Mezcla `{linkage:'none'}` con la abstención (`null`) a propósito: los dos tienen
 * que dar ruta `[]` acá, y por razones DISTINTAS —uno dice «raíz», el otro «no
 * modifico la ruta»—, que es la distinción de PROVISIONAL(#43).
 */
const FLAT: Case = {
  name: "documento plano",
  why: "si `none` o la abstención abrieran scope, todo chat sería un árbol inventado",
  nodes: [
    paragraph("Hola, ¿cómo va el contrato?", { linkage: "none" }),
    paragraph("Lo mando hoy."),
    paragraph("Perfecto."),
  ],
  trace: [null, null, null],
};

/**
 * EL EJEMPLO CANÓNICO DEL PLAN, literal (§{1 · Ruta}). Su traza es la que el plan
 * PUBLICA en §{2 · Emisor}, copiada a mano, y el guardián la compara nodo por nodo:
 * es la única forma de que el código y el documento no se separen en silencio.
 */
const NESTED: Case = {
  name: "títulos anidados (el ejemplo canónico del plan)",
  why: "es la traza que el plan publica; si no da, el emisor no es el que está escrito",
  nodes: [
    heading("Contrato de servicios", 1),
    heading("Cláusula primera", 2),
    paragraph("El proveedor entregará el equipo."),
    paragraph("El pago se realizará a treinta días."),
    heading("Cláusula segunda", 2),
    paragraph("La confidencialidad se mantiene por dos años."),
  ],
  trace: [
    null,
    "Contrato de servicios",
    "Cláusula primera",
    "Cláusula primera",
    "Contrato de servicios",
    "Cláusula segunda",
  ],
};

/**
 * Un h3 justo después de un h1. `porProminencia` los produce POR CONSTRUCCIÓN al
 * colapsar grupos de estilos, así que no es un documento raro: es el caso normal
 * de un DOCX sin mapa de estilos.
 */
const LEVEL_JUMP: Case = {
  name: "salto de nivel (h1 → h3) y nivel indeterminado",
  why: "si el emisor inventara un h2 fantasma, habría un scope sin nodo en el medio",
  nodes: [
    heading("Parte I", 1),
    heading("Sección profunda", 3),
    paragraph("Cuelga del h3, no del h1."),
    heading("Sin nivel", null),
    paragraph("Cuelga del título sin nivel."),
  ],
  trace: [null, "Parte I", "Sección profunda", "Sección profunda", "Sin nivel"],
};

const LIST = asLocalId("mdast:list:1");
const ITEM_2 = asLocalId("mdast:item:2");

/**
 * Un container con hijos por vía `parent`, y un container anidado adentro.
 *
 * `container` NO LLEVA HIJOS (§{Tramo 3 › Qué sale}): la jerarquía es `localParent`
 * y nada más. Este caso es el que lo comprueba: la sublista cuelga del ítem 2 sin
 * que ningún nodo contenga a otro.
 */
const CONTAINER: Case = {
  name: "un container (y uno anidado)",
  why: "`container` no lleva hijos: si la jerarquía no sale de `localParent`, no sale de ningún lado",
  nodes: [
    node(
      "lista",
      "list",
      { shape: "container", ordered: false, schema: null },
      { linkage: "parent", id: LIST, parent: null },
    ),
    paragraph("Primero", { linkage: "parent", id: asLocalId("mdast:item:1"), parent: LIST }),
    paragraph("Segundo", { linkage: "parent", id: ITEM_2, parent: LIST }),
    node(
      "sublista",
      "ordered_list",
      { shape: "container", ordered: true, schema: null },
      { linkage: "parent", id: asLocalId("mdast:list:2"), parent: ITEM_2 },
    ),
    paragraph("Segundo.a", {
      linkage: "parent",
      id: asLocalId("mdast:item:4"),
      parent: asLocalId("mdast:list:2"),
    }),
  ],
  trace: [null, "lista", "lista", "Segundo", "sublista"],
};

const STEPS = asLocalId("mdast:list:steps");

/**
 * UN CONTENEDOR BAJO UNA SECCIÓN: hereda, abre y CIERRA. Nace en el paso 3, del
 * único bloqueante que el plan encontró midiendo: `Hint` no sabía decir «declaro mi
 * id y heredo mi ruta», que es lo que un `<ul>` de markdown necesita.
 *
 * Las tres cosas que este caso observa, y ningún caso del paso 2 observaba:
 *
 *   1. `{linkage:'parent', parent:null}` HEREDA. La lista cuelga de su `#`, no de la
 *      raíz. Antes del paso 3 significaba «raíz», y con eso la lista se despegaba de
 *      su sección.
 *   2. …y ABRE para sus hijos. Los ítems cuelgan de la lista, que no está en la pila:
 *      la encuentran por `byAdapterId`, o sea POR NOMBRE.
 *   3. …y CIERRA. El párrafo que sigue a los ítems ABSTIENE, y cuelga de la sección,
 *      no del último ítem. Es el precio que la vía `level` cobraba —un contenedor que
 *      solo terminaba cuando llegaba otro título— y acá no se paga: una ruta por
 *      referencia no mueve la pila vigente.
 *
 * Y el último nodo dice «raíz» con `{linkage:'none'}`, que es donde quedó a vivir ese
 * significado: el caso es también la comprobación de que las dos cosas se pueden
 * decir por separado.
 */
const CONTAINED: Case = {
  name: "un contenedor bajo una sección (hereda, abre y cierra)",
  why: "si el contenedor no hereda se despega de su sección, y si no cierra, todo lo que sigue a una lista cuelga del último ítem hasta el próximo título",
  nodes: [
    heading("Guía de instalación", 1),
    node(
      "pasos",
      "list",
      { shape: "container", ordered: false, schema: null },
      { linkage: "parent", id: STEPS, parent: null },
    ),
    paragraph("Descargar el paquete", {
      linkage: "parent",
      id: asLocalId("mdast:item:s1"),
      parent: STEPS,
    }),
    paragraph("Ejecutar el instalador", {
      linkage: "parent",
      id: asLocalId("mdast:item:s2"),
      parent: STEPS,
    }),
    paragraph("El instalador pide permisos de administrador."),
    paragraph("Pie del documento.", { linkage: "none" }),
  ],
  trace: [null, "Guía de instalación", "pasos", "pasos", "Guía de instalación", null],
};

const D1 = asDelegationId("delegacion:1");

/**
 * Un subárbol delegado: una imagen dentro de un contrato que media hora después
 * resultó tener un acta con sus propios títulos.
 *
 * Lo que este caso protege (§{2 · Emisor}): «un título que un modelo de layout
 * encuentra dentro de una página escaneada se mezcla con los niveles del contrato
 * que lo contiene». El `Acta` de adentro es `level 1` y NO puede cerrar el
 * `level 1` de afuera: cuelga del punto de injerto y numera relativo a él.
 *
 * EL NODO `{linkage:'none'}` DE ADENTRO NO ESTÁ DE ADORNO, y esta versión del caso
 * existe porque la anterior no lo tenía. El banco de mutación rompió el emisor
 * (`state.floor = 0` siempre, que es «el delegado no abre su propio scope») y este
 * caso NO SE ENTERÓ: con un `asset` como punto de injerto, la escala de niveles ya
 * frena sola contra un scope que no es de vía `level`, así que el piso quedaba
 * redundante para el título. Para `none` no lo es —«raíz» tiene que ser la raíz
 * DEL MARCO, no la del documento— y ahí la mutación se ve. Es el caso del `.eml`
 * dentro del `.zip`, que abstiene siempre.
 */
const DELEGATED: Case = {
  name: "un subárbol delegado",
  why: "un `level 1` delegado que cierre el `level 1` del padre mezcla dos escalas y reordena el documento entero",
  nodes: [
    heading("Contrato de servicios", 1),
    heading("Anexo fotográfico", 2),
    node(
      "foto",
      "image",
      {
        shape: "asset",
        ref: { object: asObjectKey("sha256:aaa"), window: { scope: "whole" } },
        mime: "image/png",
      },
      null,
    ),
    heading("Acta de recepción", 1, [D1]),
    paragraph("Se recibieron doce equipos.", null, [D1]),
    paragraph("Firmado en la sede.", { linkage: "none" }, [D1]),
    paragraph("De vuelta en el contrato."),
  ],
  trace: [
    null,
    "Contrato de servicios",
    "Anexo fotográfico",
    "foto",
    "Acta de recepción",
    "foto",
    "Anexo fotográfico",
  ],
};

/**
 * Vía `cell`: la planilla YA ES un camino (§{1 · Ruta}), y ninguno de sus tres scopes
 * es un nodo. Es el caso canónico de H5 — los hijos de un scope sintético cuelgan
 * del primer ancestro que SÍ es nodo, que acá no existe: todos son raíz.
 *
 * Dos celdas de la misma fila y dos filas de la misma región: si los scopes
 * sintéticos no se reconocieran entre nodos, la fila se cerraría y reabriría en
 * cada celda y el prefijo compartido sería siempre 0.
 */
const CELLS: Case = {
  name: "vía cell (scopes sintéticos, H5)",
  why: "materializar hoja/región/fila como containers los haría hashear todos igual y no anclarían nunca",
  nodes: [
    paragraph("Acme", { linkage: "cell", sheet: "Ventas", region: "r1", row: 2 }),
    paragraph("1200", { linkage: "cell", sheet: "Ventas", region: "r1", row: 2 }),
    paragraph("Beta", { linkage: "cell", sheet: "Ventas", region: "r1", row: 3 }),
    paragraph("900", { linkage: "cell", sheet: "Ventas", region: "r1", row: 3 }),
  ],
  trace: [null, null, null, null],
};

/**
 * Vía `spatial`: «la contención ES una relación de padre, solo que calculada con
 * geometría en vez de leída» (§{1 · Ruta}).
 *
 * EL CUARTO NODO ABSTIENE, Y ES DEL PASO 3. `spatial` es una ruta POR REFERENCIA
 * —la geometría ubicó a ESE nodo— y por lo tanto no mueve la pila vigente. Sin un
 * nodo que abstenga después, la afirmación no se ejerce nunca: los tres primeros
 * traen su propia caja, así que da igual qué haya en la pila y la clasificación de
 * la vía pasaba EN VERDE con las dos respuestas. Con el cuarto puesto, el mutante
 * que la cambia se pone rojo.
 */
const SPATIAL: Case = {
  name: "vía spatial (contención geométrica)",
  why: "si `spatial` no reusara el caminador de `parent`, habría dos semánticas de árbol; y si moviera la pila, lo que abstiene después quedaría dentro del último recuadro",
  nodes: [
    paragraph("Marco entero", { linkage: "spatial", box: box(0, 0, 1000, 1000) }),
    paragraph("Recuadro", { linkage: "spatial", box: box(100, 100, 400, 400) }),
    paragraph("Sello dentro del recuadro", { linkage: "spatial", box: box(150, 150, 100, 100) }),
    paragraph("Nota al margen, sin caja."),
  ],
  trace: [null, "Marco entero", "Recuadro", null],
};

/**
 * DOS CANDIDATOS EMPATADOS EN PROFUNDIDAD Y EN ÁREA. Nace en el bloque 5, y no de
 * una idea: de un mutante que no rompía.
 *
 * `isInnerThan` desempata por tres reglas —ruta más larga, área menor y, al final,
 * el emitido más tarde— y la tercera vive en un solo carácter (`<=` en vez de `<`).
 * Cambiarlo pasaba EN VERDE contra los siete casos anteriores: en todos ellos las
 * cajas que compiten están anidadas, así que la primera regla ya decide y la
 * tercera no llega a ejercerse nunca. O sea que la regla existía, estaba
 * documentada, y NADA la verificaba.
 *
 * «Izquierda» y «Derecha» son hermanas —se solapan pero ninguna contiene a la
 * otra—, tienen la MISMA área y las dos contienen a «Empate». Con la regla puesta
 * gana la emitida más tarde; sin ella, la primera. Es la única forma de que el
 * árbol lo note.
 */
const TIED_BOXES: Case = {
  name: "cajas empatadas (el desempate por orden de emisión)",
  why: "sin la tercera regla de `isInnerThan` el desempate no es total, y cuál de las dos gana queda decidido por un `<=` que nadie mira",
  nodes: [
    paragraph("Página", { linkage: "spatial", box: box(0, 0, 1000, 1000) }),
    paragraph("Izquierda", { linkage: "spatial", box: box(100, 100, 200, 200) }),
    paragraph("Derecha", { linkage: "spatial", box: box(150, 150, 200, 200) }),
    paragraph("Empate", { linkage: "spatial", box: box(200, 200, 50, 50) }),
  ],
  trace: [null, "Página", "Página", "Derecha"],
};

// ─────────────────────────────── El título editado ───────────────────────────

/**
 * EL CASO QUE SOSTIENE EL TRAMO (§{Por qué esto funciona}).
 *
 *                      v1                              v2
 *     #1  heading    "Cláusula primera"              "Cláusula 1ª"      ← editado
 *     #2  paragraph  ruta [Contrato, Cláusula primera]  ruta [Contrato, Cláusula 1ª]
 *
 * La RUTA del párrafo cambió; su HUELLA no. Con la fórmula original
 * —`hash(migas ‖ contenido ‖ ordinal)`— ese párrafo habría recibido un id nuevo y
 * toda la curación del cliente en esa sección se habría despegado EN SILENCIO.
 *
 * Lo que el emisor tiene que garantizar para que el reconciliador pueda anclarlo
 * es exactamente esto: la ruta entra en `breadcrumbs` y NUNCA en `hash`.
 */
const edited = (editableHeading: string): readonly Node[] => [
  heading("Contrato de servicios", 1),
  heading(editableHeading, 2),
  paragraph("El proveedor entregará el equipo."),
];

const editedCase = (editableHeading: string): Case => ({
  name: `título editado · "${editableHeading}"`,
  why: "la ruta del párrafo cambia y su huella no: es lo que salva la curación del cliente",
  nodes: edited(editableHeading),
  trace: [null, "Contrato de servicios", editableHeading],
});

export const EDITED_HEADING = {
  v1: edited("Cláusula primera"),
  v2: edited("Cláusula 1ª"),
} as const;

export const CASES: readonly Case[] = [
  FLAT,
  NESTED,
  LEVEL_JUMP,
  CONTAINER,
  CONTAINED,
  DELEGATED,
  CELLS,
  SPATIAL,
  TIED_BOXES,
  editedCase("Cláusula primera"),
  editedCase("Cláusula 1ª"),
];

/** El caso canónico. Su `trace` es la que el plan publica en §{2 · Emisor}. */
export const CANONICAL_CASE = NESTED;
/** El caso delegado, para el guardián de la escala de niveles. */
export const DELEGATED_CASE = DELEGATED;

/**
 * Una pista `parent` que apunta a un nodo que NUNCA se emitió. No es un caso de
 * `CASES` —no tiene emisión válida— y existe para acreditar que la falla es un
 * OBJETO DE ERROR y no una raíz silenciosa. Ver PENDING(#46) en `route.ts`.
 */
export const DANGLING_PARENT: readonly Node[] = [
  paragraph("Cuelga de un padre que no existe", {
    linkage: "parent",
    id: asLocalId("mdast:item:9"),
    parent: asLocalId("mdast:list:inexistente"),
  }),
];

// ══════════════════════════ Los casos de AGRUPACIÓN (paso 3a) ════════════════
//
// Mismo argumento que arriba, un tramo más adelante: nodos a mano, CERO adaptadores.
// El paso 2 probó que el EMISOR no necesita un adaptador para escribirse; estos casos
// lo prueban de la AGRUPACIÓN, que es el otro consumidor de `cohesionOf`. Si para
// ejercitar el tramo 5 hubiera hecho falta un `.md`, el borde R1 no sería real.
//
// VIVEN EN ESTE ARCHIVO Y NO EN UNO PROPIO, contra lo que el plan del paso 3
// presupuestaba (`synthetic-rows.ts`). La razón es la de B2 en el GLOSARIO: lo que
// estos casos tienen de valioso es DE DÓNDE SALEN, y eso es lo que nombra
// `synthetic`. Un segundo archivo con la misma tesis parte el archivo por TRAMO, que
// es la única cosa que estos casos no distinguen — y agrega una pieza.
//
// Y CUBREN LA MITAD σ, que ningún adaptador del paso 3 alcanza: una tabla de markdown
// es la tabla chica (`grain: "whole"`) y NO emite registros, así que sin nodos-fila
// escritos a mano «un recorrido, DOS salidas» quedaría acreditado a medias.

/**
 * Un caso de agrupación: los nodos, y las DOS salidas esperadas escritas a mano.
 *
 * `fragments` y `records` son el GOLDEN, y son de la misma especie que `Case.trace`:
 * lo único que este paquete compara contra algo EXTERNO al código. Van acá y no en un
 * archivo de snapshot a propósito — un snapshot se regenera con una tecla, y eso es
 * exactamente el modo de falla que `M18` existe para impedir. Escrito en `src/` y
 * tipado, editarlo para que el test pase es un acto visible en el diff, y tiene su
 * propio mutante.
 */
export type GroupingCase = {
  readonly name: string;
  /** Qué se rompería si el tramo 5 lo tratara mal. */
  readonly why: string;
  readonly nodes: readonly Node[];
  /**
   * El tamaño objetivo con el que se agrupa ESTE caso.
   *
   * ES UN PARÁMETRO DEL BANCO, NO DEL PRODUCTO, y va dicho para que nadie lo lea
   * como una medición: `PARAMETERS.grouping.targetSizeChars` sigue en `null` porque
   * el plan lo declara medible («evaluación de recuperación sobre corpus real») y
   * este paso no lo midió. Los valores de abajo están elegidos para que el corte
   * ocurra —o no ocurra— sobre un caso de seis líneas.
   */
  readonly targetSizeChars: number;
  /** El `text` esperado de cada fragmento, en orden de lectura. */
  readonly fragments: readonly string[];
  /** Las claves esperadas de cada registro, en orden. Ver `fieldKey` en `ir`. */
  readonly records: readonly (readonly string[])[];
};

const withLevel = (t: string, level: RecognitionLevel, confidence: number | null): Node =>
  asNode({
    role: "paragraph",
    body: prose(t),
    location: location(t),
    hint: null,
    delegation: [],
    attribution: null,
    level,
    confidence,
    authorship: AUTHORSHIP,
  });

/**
 * Dos secciones seguidas, y un título final que no alcanzó a contextualizar nada.
 *
 * Las tres cosas que fija: un `lead` CIERRA el fragmento en curso (si no, el
 * fragmento cruza la frontera de sección y se archiva bajo la equivocada); un `lead`
 * NO arranca un fragmento con su texto (si no, el título se embebe dos veces, una en
 * el cuerpo y otra en la miga); y el título que no contextualizó nada NO se evapora.
 */
const TWO_SECTIONS: GroupingCase = {
  name: "dos secciones y un título que no contextualizó nada",
  why: "sin el cierre, el filtro por sección del tramo 7 devuelve texto de otra sección y el error es MUDO; sin el fragmento propio, el último título desaparece del índice en silencio",
  nodes: [
    heading("Cláusula primera", 1),
    paragraph("El proveedor entrega el equipo."),
    paragraph("El pago es a treinta días."),
    heading("Cláusula segunda", 1),
    paragraph("La confidencialidad dura dos años."),
    heading("Anexo", 1),
  ],
  targetSizeChars: 200,
  fragments: [
    "El proveedor entrega el equipo.\nEl pago es a treinta días.",
    "La confidencialidad dura dos años.",
    "Anexo",
  ],
  records: [],
};

/**
 * El bloque de código: el argumento del «vector turbio», en sus dos direcciones.
 *
 * `code` es `solo` por la tabla de `ir`, y `solo` tiene que cortar HACIA ATRÁS —no se
 * pega al párrafo que lo precede— y HACIA ADELANTE —el párrafo que lo sigue no se le
 * pega a él—. Las dos mitades se rompen por separado y por eso hacen falta los tres
 * nodos: con dos, cerrar al ABRIR no dice nada sobre qué pasa DESPUÉS de cerrar.
 */
const CODE_BLOCK: GroupingCase = {
  name: "el bloque de código no se mezcla con sus vecinos",
  why: "un bloque de código con el párrafo que lo precede no representa bien a ninguno de los dos, y el vector queda turbio para los dos",
  nodes: [
    heading("Instalación", 1),
    paragraph("Corré el comando:"),
    node("cmd", "code", { shape: "verbatim", text: "pnpm install", language: "bash" }, null),
    paragraph("Y listo."),
  ],
  targetSizeChars: 200,
  fragments: ["Corré el comando:", "pnpm install", "Y listo."],
  records: [],
};

/**
 * La imagen y su epígrafe: el ÚNICO par que exige `solo` y `satellite` a la vez, y
 * el caso canónico de PROVISIONAL(C16) en `ir`.
 *
 * La imagen es `asset`, así que `render` da `null` y su fragmento arranca SIN texto
 * (PROVISIONAL(#53)): el nodo entra igual, y el epígrafe le pone el texto. Si el
 * satélite no se pegara, quedarían dos fragmentos —uno vacío con la imagen y otro de
 * una línea con el epígrafe— y ninguno de los dos sirve para recuperar nada.
 */
const CAPTIONED_IMAGE: GroupingCase = {
  name: "la imagen y su epígrafe son una unidad",
  why: "«un epígrafe termina siendo un fragmento de una línea sin su imagen» es exactamente lo que PROVISIONAL(C16) de `ir` decide evitar",
  nodes: [
    heading("Anexo fotográfico", 1),
    node(
      "foto",
      "image",
      {
        shape: "asset",
        ref: { object: asObjectKey("sha256:bbb"), window: { scope: "whole" } },
        mime: "image/png",
      },
      null,
    ),
    node("epigrafe", "caption", prose("Figura 1 — el tablero."), null),
    paragraph("El tablero se instaló en marzo."),
  ],
  targetSizeChars: 200,
  fragments: ["Figura 1 — el tablero.", "El tablero se instaló en marzo."],
  records: [],
};

/**
 * El corte por tamaño, y el ÚNICO caso que solo ve el golden.
 *
 * No lleva invariante propio a propósito: `targetSizeChars` es `Pending` en
 * `params.ts` («se mide: evaluación de recuperación sobre corpus real»), así que
 * escribir un invariante sobre el número sería inventar la medición que el plan
 * declara pendiente. Lo que el golden fija es que el número DECIDE algo.
 */
const SIZE_CUT: GroupingCase = {
  name: "el tamaño objetivo decide dónde corta un `normal`",
  why: "el número de fragmentos es el que fija toda huella de fragmento y toda clave de caché de embeddings: si el objetivo dejara de decidir, el documento entero sería un solo vector",
  nodes: [
    heading("Notas", 1),
    paragraph("Uno."),
    paragraph("Dos."),
    paragraph("Tres."),
  ],
  targetSizeChars: 8,
  fragments: ["Uno.\nDos.", "Tres."],
  records: [],
};

/**
 * Un fragmento que agrupa un nodo declarativo y uno perceptual.
 *
 * Es el único caso donde los dos campos que `ir` justifica en el #74 se EJERCEN:
 * `minLevel` tiene que ser el PEOR por `rank()` —el máximo, aunque el campo se llame
 * `min`— y `confidence` tiene que distinguir «no reportó» de «reportó bajo». Sin un
 * nodo que reporte confianza y otro que no, `hasNull` es constante y su mutación pasa
 * en verde.
 */
const MIXED_LEVELS: GroupingCase = {
  name: "niveles y confianzas mezclados en un fragmento",
  why: "«la certeza viaja con el nodo, sobrevive a la fragmentación y llega hasta la skill» (§{La escalera}) no tiene mecanismo si el fragmento comprime mal",
  nodes: [
    heading("Escaneo", 1),
    withLevel("Leído del formato.", "declarative", null),
    withLevel("Adivinado por un modelo.", "perceptual", 0.42),
  ],
  targetSizeChars: 200,
  fragments: ["Leído del formato.\nAdivinado por un modelo."],
  records: [],
};

// ─────────────────────────────── La mitad σ ──────────────────────────────────

const REGION = asLocalId("region#A");

const at = (row: number): Coordinate => ({
  space: "grid",
  sheet: "Hoja1",
  region: "A",
  row,
  column: null,
});

/** El container lleva EL ESQUEMA; las filas no. Ver §{Las filas}. */
const region = (schema: readonly string[]): Node =>
  asNode({
    role: "list",
    body: { shape: "container", ordered: false, schema },
    location: {
      adapter: asAdapterId("sintetico"),
      anchor: "region#A",
      coordinate: at(1),
      within: [],
    },
    hint: { linkage: "parent", id: REGION, parent: null },
    delegation: [],
    attribution: null,
    level: "declarative",
    confidence: null,
    authorship: AUTHORSHIP,
  });

/** Un nodo-FILA: `grid` con `headers: null`, exactamente una fila y `grain: "row"`. */
const rowNode = (row: number, texts: readonly string[]): Node =>
  asNode({
    role: "table",
    body: {
      shape: "grid",
      headers: null,
      rows: [texts.map((text) => ({ text, type: null }))],
      grain: "row",
    },
    location: {
      adapter: asAdapterId("sintetico"),
      anchor: `row#${row}`,
      coordinate: at(row),
      within: [],
    },
    hint: { linkage: "parent", id: asLocalId(`row#${row}`), parent: REGION },
    delegation: [],
    attribution: null,
    level: "declarative",
    confidence: null,
    authorship: AUTHORSHIP,
  });

/**
 * Una región de planilla: la mitad σ del split π/σ, y la única salida EXACTA.
 *
 * El esquema vive en el CONTAINER y no en la fila: «si cada fila cargara sus
 * etiquetas, renombrar una columna cambiaría el hash de las 50 000 y destruiría todas
 * las anclas» (§{Las filas}). La contrapartida declarada es que la composición del
 * fragmento va a BUSCARLO — por eso cada fila se renderiza con su línea de
 * encabezado.
 *
 * La tercera columna del esquema está VACÍA y la cuarta REPITE a la primera: es
 * exactamente lo que `fieldKey` existe para resolver, y una planilla real las tiene.
 */
const SPREADSHEET: GroupingCase = {
  name: "región de planilla · dos filas",
  why: "las filas son nodos y el esquema vive en el container; sin registros, la mitad σ del split π/σ no existe y la planilla solo se puede buscar por similitud",
  nodes: [
    region(["proveedor", "cuit", "", "proveedor"]),
    rowNode(2, ["Acme", "30-1", "x", "Acme SA"]),
    rowNode(3, ["Beta", "30-2", "y", "Beta SRL"]),
  ],
  targetSizeChars: 200,
  fragments: [
    "proveedor\tcuit\t\tproveedor\nAcme\t30-1\tx\tAcme SA\n" +
      "proveedor\tcuit\t\tproveedor\nBeta\t30-2\ty\tBeta SRL",
  ],
  records: [
    ["proveedor", "cuit", "col_2", "proveedor__3"],
    ["proveedor", "cuit", "col_2", "proveedor__3"],
  ],
};

export const GROUPING_CASES: readonly GroupingCase[] = [
  TWO_SECTIONS,
  CODE_BLOCK,
  CAPTIONED_IMAGE,
  SIZE_CUT,
  MIXED_LEVELS,
  SPREADSHEET,
];
