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
 * Viven en `src/` y no dentro del guardián porque `Nodo` lleva `MARCA_NODAL` y solo
 * `comoNodo` la pone (PROVISIONAL(H1) en `ir/src/salidas.ts`): un literal suelto en un
 * `.mjs` no puede construir un `Nodo`, y uno sin tipar no cotejaría contra el
 * contrato, que es justo lo que estos casos existen para cotejar.
 */

import {
  comoActorId,
  comoAdaptadorId,
  comoClaveObjeto,
  comoDelegacionId,
  comoInstante,
  comoLocalId,
  comoNodo,
  type Autoría,
  type Caja,
  type Cuerpo,
  type DelegacionId,
  type Nodo,
  type Pista,
  type Tipo,
  type Ubicación,
} from "@savia-os/ir";

// ─────────────────────────────── Constructores ───────────────────────────────

const AUTORÍA: Autoría = {
  actor: comoActorId("usuario-sintetico"),
  cuándo: comoInstante("2026-08-10T00:00:00.000Z"),
  fuente: "fixture",
};

const ubicación = (ancla: string): Ubicación => ({
  adaptador: comoAdaptadorId("sintetico"),
  ancla,
  coordenada: { espacio: "fuente" },
  dentroDe: [],
});

const nodo = (
  ancla: string,
  tipo: Tipo,
  cuerpo: Cuerpo,
  pista: Pista | null,
  delegación: readonly DelegacionId[] = [],
): Nodo =>
  comoNodo({
    tipo,
    cuerpo,
    ubicación: ubicación(ancla),
    certeza: "declarado",
    pista,
    delegación,
    atribución: null,
    nivel: "declarativo",
    confianza: null,
    autoría: AUTORÍA,
  });

const prosa = (texto: string): Cuerpo => ({ forma: "text_span", texto, marcas: [] });

const título = (t: string, nivel: number | null, delegación: readonly DelegacionId[] = []): Nodo =>
  nodo(t, "titulo", prosa(t), { via: "nivel", nivel }, delegación);

const párrafo = (t: string, pista: Pista | null = null, delegación: readonly DelegacionId[] = []): Nodo =>
  nodo(t, "parrafo", prosa(t), pista, delegación);

const caja = (x: number, y: number, ancho: number, alto: number): Caja => ({
  marco: "p1",
  x,
  y,
  ancho,
  alto,
  z: null,
});

// ─────────────────────────────── Los casos ───────────────────────────────────

export type Caso = {
  readonly nombre: string;
  /** Qué se rompería si el emisor lo tratara mal. */
  readonly porqué: string;
  readonly nodos: readonly Nodo[];
  /**
   * El padre esperado de cada nodo, por su `ubicación.ancla`. `null` = raíz.
   *
   * ES OBLIGATORIA, y esta versión del tipo existe porque antes solo la tenía el
   * caso canónico. El banco de mutación hizo que la vía `espacial` eligiera el
   * contenedor MÁS EXTERNO en vez del más interno —el sello colgando de la página
   * en vez del recuadro— y NINGÚN invariante se enteró: las migas se re-derivan de
   * `padreLocal`, así que un padre mal elegido produce migas coherentes con el
   * padre mal elegido. Sin un árbol esperado escrito a mano, la coherencia interna
   * no distingue el árbol correcto del incorrecto.
   *
   * Se compara por `ancla` y no por texto porque un `container` y un `asset` no
   * tienen texto legible. En los fixtures el ancla ES el texto, así que la traza
   * del caso canónico se lee igual que la del plan.
   */
  readonly traza: readonly (string | null)[];
};

/**
 * Un documento donde todo cuelga de la raíz. Es el caso del chat: «un mensaje no
 * tiene página, hoja ni offset» y ninguno cuelga de otro.
 *
 * Mezcla `{via:'ninguna'}` con la abstención (`null`) a propósito: los dos tienen
 * que dar ruta `[]` acá, y por razones DISTINTAS —uno dice «raíz», el otro «no
 * modifico la ruta»—, que es la distinción de PROVISIONAL(#43).
 */
const PLANO: Caso = {
  nombre: "documento plano",
  porqué: "si `ninguna` o la abstención abrieran scope, todo chat sería un árbol inventado",
  nodos: [
    párrafo("Hola, ¿cómo va el contrato?", { via: "ninguna" }),
    párrafo("Lo mando hoy."),
    párrafo("Perfecto."),
  ],
  traza: [null, null, null],
};

/**
 * EL EJEMPLO CANÓNICO DEL PLAN, literal (§{1 · Ruta}). Su traza es la que el plan
 * PUBLICA en §{2 · Emisor}, copiada a mano, y el guardián la compara nodo por nodo:
 * es la única forma de que el código y el documento no se separen en silencio.
 */
const ANIDADOS: Caso = {
  nombre: "títulos anidados (el ejemplo canónico del plan)",
  porqué: "es la traza que el plan publica; si no da, el emisor no es el que está escrito",
  nodos: [
    título("Contrato de servicios", 1),
    título("Cláusula primera", 2),
    párrafo("El proveedor entregará el equipo."),
    párrafo("El pago se realizará a treinta días."),
    título("Cláusula segunda", 2),
    párrafo("La confidencialidad se mantiene por dos años."),
  ],
  traza: [
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
const SALTO_DE_NIVEL: Caso = {
  nombre: "salto de nivel (h1 → h3) y nivel indeterminado",
  porqué: "si el emisor inventara un h2 fantasma, habría un scope sin nodo en el medio",
  nodos: [
    título("Parte I", 1),
    título("Sección profunda", 3),
    párrafo("Cuelga del h3, no del h1."),
    título("Sin nivel", null),
    párrafo("Cuelga del título sin nivel."),
  ],
  traza: [null, "Parte I", "Sección profunda", "Sección profunda", "Sin nivel"],
};

const LISTA = comoLocalId("mdast:list:1");
const ITEM_2 = comoLocalId("mdast:item:2");

/**
 * Un container con hijos por vía `padre`, y un container anidado adentro.
 *
 * `container` NO LLEVA HIJOS (§{Tramo 3 › Qué sale}): la jerarquía es `padreLocal`
 * y nada más. Este caso es el que lo comprueba: la sublista cuelga del ítem 2 sin
 * que ningún nodo contenga a otro.
 */
const CONTAINER: Caso = {
  nombre: "un container (y uno anidado)",
  porqué: "`container` no lleva hijos: si la jerarquía no sale de `padreLocal`, no sale de ningún lado",
  nodos: [
    nodo(
      "lista",
      "lista",
      { forma: "container", ordenado: false, esquema: null },
      { via: "padre", id: LISTA, padre: null },
    ),
    párrafo("Primero", { via: "padre", id: comoLocalId("mdast:item:1"), padre: LISTA }),
    párrafo("Segundo", { via: "padre", id: ITEM_2, padre: LISTA }),
    nodo(
      "sublista",
      "lista_ordenada",
      { forma: "container", ordenado: true, esquema: null },
      { via: "padre", id: comoLocalId("mdast:list:2"), padre: ITEM_2 },
    ),
    párrafo("Segundo.a", { via: "padre", id: comoLocalId("mdast:item:4"), padre: comoLocalId("mdast:list:2") }),
  ],
  traza: [null, "lista", "lista", "Segundo", "sublista"],
};

const D1 = comoDelegacionId("delegacion:1");

/**
 * Un subárbol delegado: una imagen dentro de un contrato que media hora después
 * resultó tener un acta con sus propios títulos.
 *
 * Lo que este caso protege (§{2 · Emisor}): «un título que un modelo de layout
 * encuentra dentro de una página escaneada se mezcla con los niveles del contrato
 * que lo contiene». El `Acta` de adentro es `nivel 1` y NO puede cerrar el
 * `nivel 1` de afuera: cuelga del punto de injerto y numera relativo a él.
 *
 * EL NODO `{via:'ninguna'}` DE ADENTRO NO ESTÁ DE ADORNO, y esta versión del caso
 * existe porque la anterior no lo tenía. El banco de mutación rompió el emisor
 * (`estado.piso = 0` siempre, que es «el delegado no abre su propio scope») y este
 * caso NO SE ENTERÓ: con un `asset` como punto de injerto, la escala de niveles ya
 * frena sola contra un scope que no es de vía `nivel`, así que el piso quedaba
 * redundante para el título. Para `ninguna` no lo es —«raíz» tiene que ser la raíz
 * DEL MARCO, no la del documento— y ahí la mutación se ve. Es el caso del `.eml`
 * dentro del `.zip`, que abstiene siempre.
 */
const DELEGADO: Caso = {
  nombre: "un subárbol delegado",
  porqué: "un `nivel 1` delegado que cierre el `nivel 1` del padre mezcla dos escalas y reordena el documento entero",
  nodos: [
    título("Contrato de servicios", 1),
    título("Anexo fotográfico", 2),
    nodo(
      "foto",
      "imagen",
      {
        forma: "asset",
        ref: { objeto: comoClaveObjeto("sha256:aaa"), ventana: { alcance: "entero" } },
        mime: "image/png",
        pendientes: [],
      },
      null,
    ),
    título("Acta de recepción", 1, [D1]),
    párrafo("Se recibieron doce equipos.", null, [D1]),
    párrafo("Firmado en la sede.", { via: "ninguna" }, [D1]),
    párrafo("De vuelta en el contrato."),
  ],
  traza: [
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
 * Vía `celda`: la planilla YA ES un camino (§{1 · Ruta}), y ninguno de sus tres scopes
 * es un nodo. Es el caso canónico de H5 — los hijos de un scope sintético cuelgan
 * del primer ancestro que SÍ es nodo, que acá no existe: todos son raíz.
 *
 * Dos celdas de la misma fila y dos filas de la misma región: si los scopes
 * sintéticos no se reconocieran entre nodos, la fila se cerraría y reabriría en
 * cada celda y el prefijo compartido sería siempre 0.
 */
const CELDAS: Caso = {
  nombre: "vía celda (scopes sintéticos, H5)",
  porqué: "materializar hoja/región/fila como containers los haría hashear todos igual y no anclarían nunca",
  nodos: [
    párrafo("Acme", { via: "celda", hoja: "Ventas", región: "r1", fila: 2 }),
    párrafo("1200", { via: "celda", hoja: "Ventas", región: "r1", fila: 2 }),
    párrafo("Beta", { via: "celda", hoja: "Ventas", región: "r1", fila: 3 }),
    párrafo("900", { via: "celda", hoja: "Ventas", región: "r1", fila: 3 }),
  ],
  traza: [null, null, null, null],
};

/**
 * Vía `espacial`: «la contención ES una relación de padre, solo que calculada con
 * geometría en vez de leída» (§{1 · Ruta}).
 */
const ESPACIAL: Caso = {
  nombre: "vía espacial (contención geométrica)",
  porqué: "si `espacial` no reusara el caminador de `padre`, habría dos semánticas de árbol",
  nodos: [
    párrafo("Marco entero", { via: "espacial", caja: caja(0, 0, 1000, 1000) }),
    párrafo("Recuadro", { via: "espacial", caja: caja(100, 100, 400, 400) }),
    párrafo("Sello dentro del recuadro", { via: "espacial", caja: caja(150, 150, 100, 100) }),
  ],
  traza: [null, "Marco entero", "Recuadro"],
};

// ─────────────────────────────── El título editado ───────────────────────────

/**
 * EL CASO QUE SOSTIENE EL TRAMO (§{Por qué esto funciona}).
 *
 *                      v1                              v2
 *     #1  título     "Cláusula primera"              "Cláusula 1ª"      ← editado
 *     #2  párrafo    ruta [Contrato, Cláusula primera]  ruta [Contrato, Cláusula 1ª]
 *
 * La RUTA del párrafo cambió; su HUELLA no. Con la fórmula original
 * —`hash(migas ‖ contenido ‖ ordinal)`— ese párrafo habría recibido un id nuevo y
 * toda la curación del cliente en esa sección se habría despegado EN SILENCIO.
 *
 * Lo que el emisor tiene que garantizar para que el reconciliador pueda anclarlo
 * es exactamente esto: la ruta entra en `migas` y NUNCA en `hash`.
 */
const editado = (títuloEditable: string): readonly Nodo[] => [
  título("Contrato de servicios", 1),
  título(títuloEditable, 2),
  párrafo("El proveedor entregará el equipo."),
];

const casoEditado = (títuloEditable: string): Caso => ({
  nombre: `título editado · "${títuloEditable}"`,
  porqué: "la ruta del párrafo cambia y su huella no: es lo que salva la curación del cliente",
  nodos: editado(títuloEditable),
  traza: [null, "Contrato de servicios", títuloEditable],
});

export const TITULO_EDITADO = {
  v1: editado("Cláusula primera"),
  v2: editado("Cláusula 1ª"),
} as const;

export const CASOS: readonly Caso[] = [
  PLANO,
  ANIDADOS,
  SALTO_DE_NIVEL,
  CONTAINER,
  DELEGADO,
  CELDAS,
  ESPACIAL,
  casoEditado("Cláusula primera"),
  casoEditado("Cláusula 1ª"),
];

/** El caso canónico. Su `traza` es la que el plan publica en §{2 · Emisor}. */
export const CASO_CANÓNICO = ANIDADOS;
/** El caso delegado, para el guardián de la escala de niveles. */
export const CASO_DELEGADO = DELEGADO;

/**
 * Una pista `padre` que apunta a un nodo que NUNCA se emitió. No es un caso de
 * `CASOS` —no tiene emisión válida— y existe para acreditar que la falla es un
 * OBJETO DE ERROR y no una raíz silenciosa. Ver PENDIENTE(#46) en `ruta.ts`.
 */
export const PADRE_COLGANTE: readonly Nodo[] = [
  párrafo("Cuelga de un padre que no existe", {
    via: "padre",
    id: comoLocalId("mdast:item:9"),
    padre: comoLocalId("mdast:list:inexistente"),
  }),
];
