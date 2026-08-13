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
  type DelegationId,
  type Hint,
  type Location,
  type Node,
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
        deferred: [],
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
 */
const SPATIAL: Case = {
  name: "vía spatial (contención geométrica)",
  why: "si `spatial` no reusara el caminador de `parent`, habría dos semánticas de árbol",
  nodes: [
    paragraph("Marco entero", { linkage: "spatial", box: box(0, 0, 1000, 1000) }),
    paragraph("Recuadro", { linkage: "spatial", box: box(100, 100, 400, 400) }),
    paragraph("Sello dentro del recuadro", { linkage: "spatial", box: box(150, 150, 100, 100) }),
  ],
  trace: [null, "Marco entero", "Recuadro"],
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
