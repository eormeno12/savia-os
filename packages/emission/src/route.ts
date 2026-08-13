/**
 * Pieza 1 del tramo 4 — «Ruta: de dónde cuelga cada nodo» (§{1 · Ruta}).
 *
 * Cada pista se convierte en un CAMINO DESDE LA RAÍZ: la lista de contenedores
 * abiertos por encima del nodo. NO se incluye a sí mismo — dice de dónde cuelga,
 * no quién es (§{1 · Ruta}).
 *
 *     none       []
 *     cell       [hoja, región, fila]   — la planilla ya ES un camino
 *     level      la pila de títulos abiertos a esa profundidad
 *     parent     caminar la cadena de padres
 *     spatial    derivar contención geométrica y caminar como `parent`
 *
 * «`espacial` no es una sexta forma de armar árboles: la contención ES una
 * relación de padre, solo que calculada con geometría en vez de leída. Reusa el
 * caminador de `padre` entero» (§{1 · Ruta}). Acá eso es literal: las dos vías
 * terminan en `fromAncestor`.
 *
 * ANTES eran cinco estrategias que construían CINCO ÁRBOLES por caminos distintos.
 * Acá solo calculan rutas; el árbol lo arma el emisor una sola vez (§{1 · Ruta}).
 *
 * El «caminador» de `parent` no camina: cada nodo ya emitido dejó registrada SU
 * ruta, así que la del hijo es `route(parent) ++ [scope(parent)]` — una lectura, no
 * un recorrido. Eso no es una optimización, es lo que vuelve INEXPRESABLE un
 * ciclo: un padre tiene que haber sido emitido antes para poder ser encontrado,
 * y una cadena que solo mira hacia atrás no puede cerrarse sobre sí misma.
 */

import {
  PARAMETERS,
  asLocalId,
  boxContains,
  encodeParts,
  isLead,
  render,
  type Box,
  type Hint,
  type LocalBreadcrumb,
  type LocalId,
  type Node,
} from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

// ─────────────────────────────── Scope ───────────────────────────────────────

/**
 * Un contenedor abierto durante el recorrido.
 *
 * LAS DOS VARIANTES SON LA IMPLEMENTACIÓN DE H5, no una aserción sobre ella. El
 * emisor «asigna un `LocalId` a todo nodo Y a todo scope, incluidos los sintéticos
 * que no son nodo» (PROVISIONAL(#66)/H5 en `ir/src/identity.ts`), y los hijos de un
 * scope sintético «reciben como padre el primer ancestro que SÍ es nodo emitido».
 * Con la unión, un scope sintético NO TIENE de dónde sacar un `localParent` ni un
 * `breadcrumb`: los campos no existen en esa variante. La regla no se puede olvidar
 * porque no se puede escribir de otro modo.
 *
 * Por qué el sintético igual lleva `local`: lo pide el contrato —PROVISIONAL(#66)
 * dice «un `LocalId` a todo nodo Y a todo scope, incluidos los sintéticos»— y hoy
 * lo lee `levelOf`, que consulta el `local` de CUALQUIER scope de la pila. De ahí
 * que los tres espacios de `LocalId` estén separados por prefijo: si un scope
 * sintético pudiera colisionar con el de un título, heredaría su nivel y la escala
 * de la pila se correría sola.
 *
 * `Scope` NO SE TRADUCE (GLOSARIO.md, B7): ya era la palabra inglesa correcta
 * cuando el archivo estaba en español, igual que `Nominal` en `ir`.
 */
export type Scope =
  | {
      readonly kind: "node";
      readonly local: LocalId;
      /** No-null ⟺ el nodo que lo abrió es `lead`. Las migas son solo estos. */
      readonly breadcrumb: LocalBreadcrumb | null;
    }
  | { readonly kind: "synthetic"; readonly local: LocalId };

/** Un camino desde la raíz. Nunca contiene al nodo que lo tiene. */
export type Route = readonly Scope[];

// El espacio de `LocalId` de una corrida se parte en tres para que un id de nodo,
// uno de scope sintético y uno de adaptador no puedan confundirse por accidente.
//
// LO QUE HACE EL TRABAJO ES `encodeParts`, NO LAS LETRAS, y conviene decirlo porque
// el docstring anterior sugería lo contrario. `encodeParts` prefija cada parte con su
// longitud, así que es inyectiva: `sheet="a", region="bc"` y `sheet="ab", region="c"`
// no colisionan. Y como el resto de un local de nodo es SIEMPRE un índice decimal y
// el de un scope sintético es SIEMPRE otro `encodeParts` (que empieza por la longitud
// de `"sheet"`), las dos preimágenes no pueden coincidir ni con la misma letra
// adelante. Las letras son redundancia legible, no la garantía — el control `MC6` de
// `scripts/mutants.mjs` las colapsa y NADA se pone rojo, y está escrito ahí para que
// nadie confunda «no rompió» con «está verificado».
const NODE_PREFIX = "n";
const SYNTHETIC_PREFIX = "s";

/** El `LocalId` del nodo en la posición `i` de la secuencia. Determinístico. */
export const localOfNode = (i: number): LocalId =>
  asLocalId(encodeParts(NODE_PREFIX, String(i)));

const synthetic = (key: string): Scope => ({
  kind: "synthetic",
  local: asLocalId(encodeParts(SYNTHETIC_PREFIX, key)),
});

// ─────────────────────────────── Estado ──────────────────────────────────────

/**
 * Un nodo ya emitido, visto como el ancestro del que pueden colgar los que siguen.
 *
 * SE LLAMA `Ancestor` Y NO `Container` (GLOSARIO.md, B3): en español
 * `Contenedor` y el valor `"container"` de `SHAPES` eran dos palabras distintas, y
 * traducir el tipo por su cognado las FUNDE justo en los dos archivos que citan la
 * forma en prosa. Es el caso inverso a `Marca → Mark` (GLOSARIO.md, sección 4).
 */
type Ancestor = {
  readonly route: Route;
  readonly scope: Scope;
};

/**
 * Todo lo que el recorrido lleva en la mano. Es MUTABLE a propósito: el tramo
 * declara UN SOLO recorrido (§{2 · Emisor}), y un estado inmutable obligaría a copiar la
 * pila por nodo, que es el costo que «microsegundos por nodo» (§{Tramo 4 › Costo}) no admite.
 */
export type State = {
  /**
   * LA PILA. «El árbol nunca existe como estructura: es la pila durante el
   * recorrido» (§{2 · Emisor}). Después de cada nodo vale la RUTA VIGENTE: lo que
   * hereda el que abstiene.
   */
  stack: Scope[];
  /**
   * Piso impuesto por el marco de delegación vigente. Un subárbol delegado «abre
   * su propio scope y no participa de la escala de niveles del documento padre»
   * (§{2 · Emisor}): nada por debajo de este índice se cierra desde adentro, y la
   * raíz de `none` y de `cell` es este piso, no el 0 absoluto.
   */
  floor: number;
  /** El nivel con el que se abrió cada scope de vía `level`. Solo esos. */
  readonly levelOf: Map<LocalId, number>;
  /** `hint.id` (espacio del ADAPTADOR) → el nodo ya emitido que lo declaró. */
  readonly byAdapterId: Map<LocalId, Ancestor>;
  /** Nodos ya emitidos con caja, en orden de emisión. Para la vía `spatial`. */
  readonly boxes: (Ancestor & { readonly box: Box })[];
};

export const createState = (): State => ({
  stack: [],
  floor: ZERO,
  levelOf: new Map(),
  byAdapterId: new Map(),
  boxes: [],
});

// ─────────────────────────────── Ruteo ───────────────────────────────────────

/**
 * Por qué el fallo es un OBJETO y no un `null` ni una excepción: `Route` es
 * `readonly Scope[]` y `[]` es una ruta legítima —la raíz—, así que devolver `[]`
 * ante un padre inexistente haría que «referencia rota» y «cuelga de la raíz»
 * codifiquen a lo mismo. Un objeto de error no es asignable a `Route`.
 *
 * PENDING(#46): la política ante referencias COLGANTES, ADELANTADAS o CÍCLICAS.
 * `ir/src/classification.ts` la declara «pendiente del tramo 4», o sea de acá, y
 * el plan no la menciona. Elijo lo mínimo: el emisor CORTA. No degrada a raíz
 * porque eso es exactamente la colisión de arriba, y no la ignora porque un padre
 * adelantado rompería el invariante «todo `localParent` fue emitido antes», que es
 * lo que hace acíclico al grafo. Lo que falta medir para cerrarlo: con qué
 * frecuencia los adaptadores reales producen la referencia rota — si es nunca,
 * cortar es correcto; si es rutina, hay que elegir entre raíz-con-aviso y
 * descartar el nodo, y las dos exigen un canal de diagnóstico que este paso no
 * tiene.
 */
export type RouteFailure = {
  readonly kind: "parent-not-emitted";
  readonly parent: LocalId;
};

export type Routing =
  | {
      readonly ok: true;
      readonly route: Route;
      /**
       * No-null ⟺ el nodo ABRE SU PROPIO SCOPE, y trae el nivel ya resuelto con
       * el que hay que registrarlo. Un solo campo para las dos cosas porque son
       * la misma: lo único que abre scope por sí mismo es un título de vía
       * `level`, y lo único que hace falta saber de él después es su nivel.
       */
      readonly opens: { readonly level: number } | null;
    }
  | { readonly ok: false; readonly failure: RouteFailure };

/** La raíz VIGENTE: el fondo del marco de delegación, no el fondo absoluto. */
const root = (state: State): Route => state.stack.slice(ZERO, state.floor);

/** `route(parent) ++ [scope(parent)]`. El caminador que `spatial` reusa entero. */
const fromAncestor = (a: Ancestor): Route => [...a.route, a.scope];

/**
 * El nivel del título abierto MÁS PROFUNDO dentro del marco vigente.
 *
 * `levelOfTop` y no `topLevel`: «tope» es el tope de LA PILA, o sea lo más
 * INTERNO, y «top level» en inglés significa justo lo contrario —lo más externo—.
 */
const levelOfTop = (state: State, stack: Route): number => {
  for (let i = stack.length - ONE; i >= state.floor; i -= ONE) {
    const s = stack[i];
    if (s === undefined) continue;
    const n = state.levelOf.get(s.local);
    if (n !== undefined) return n;
  }
  return ZERO;
};

/**
 * «La pila de títulos abiertos a esa profundidad» (§{1 · Ruta}).
 *
 * PROVISIONAL(#44) de `ir`: `level: null` = «es un título pero no se pudo determinar
 * su nivel», y acá se lee como el nivel abierto más profundo + 1, que es lo que
 * ese PROVISIONAL declara.
 *
 * Los SALTOS (h1 → h3, que `porProminencia` produce por construcción) «son legales
 * y el emisor los normaliza»: normalizar es no inventar niveles intermedios — se
 * cierra lo que está a este nivel o más profundo y se cuelga de lo que quedó. Un
 * h3 después de un h1 cuelga del h1, sin un h2 fantasma en el medio.
 */
const byLevel = (state: State, declared: number | null): { route: Route; level: number } => {
  const open = [...state.stack];
  const level = declared ?? levelOfTop(state, open) + ONE;
  while (open.length > state.floor) {
    const top = open[open.length - ONE];
    if (top === undefined) break;
    const its = state.levelOf.get(top.local);
    // Un scope que no es de vía `level` no participa de esta escala y la frena.
    if (its === undefined || its < level) break;
    open.pop();
  }
  return { route: open, level };
};

/**
 * Ninguno de los tres scopes es un nodo: es el caso canónico de H5.
 *
 * HALLAZGO DEL BANCO DE MUTACIÓN, ANOTADO Y NO TAPADO: si se borra el componente
 * `row` —dos filas distintas colapsando en el mismo scope— NINGÚN invariante de
 * este paso se entera, y no por falta de invariantes. Cuando los tres scopes son
 * sintéticos, H5 hace que el padre sea el primer ancestro que SÍ es nodo, así que
 * la profundidad de la parte sintética no llega a la salida: ni a `localParent`, ni
 * a `breadcrumbs`, ni a `hash`. La ruta de `cell` es, en el paso 2, INOBSERVABLE.
 *
 * NO se borra por eso. Lo que borré cuando el banco lo declaró muerto fue código
 * mío que era un no-op ARITMÉTICO (ver el comentario del recorrido en `emitter.ts`);
 * esto es un dato que el plan especifica (§{1 · Ruta}) y que tiene consumidores
 * declarados aguas abajo — el tramo 5 agrupa por la forma `container` y el
 * reconciliador necesita saber qué celdas eran la misma fila. Borrarlo sería
 * decidir por ellos desde el único tramo que no lo mira.
 */
const byCell = (state: State, h: Extract<Hint, { linkage: "cell" }>): Route => [
  ...root(state),
  synthetic(encodeParts("sheet", h.sheet)),
  synthetic(encodeParts("region", h.sheet, h.region)),
  synthetic(encodeParts("row", h.sheet, h.region, String(h.row))),
];

const area = (b: Box): number => b.width * b.height;

/**
 * El contenedor geométrico MÁS INTERNO, con desempate total: primero el de ruta
 * más larga (el más profundo del árbol que ya se armó), después el de área menor,
 * y por último el emitido más tarde.
 *
 * LA TERCERA REGLA NO COMPRA DETERMINISMO, Y EL DOCSTRING ANTERIOR DECÍA QUE SÍ.
 * Decía que sin ella «la salida dependería del orden de iteración de un `Set`», y
 * acá no hay ningún `Set`: los candidatos viven en `State.boxes`, que es un
 * ARREGLO en orden de emisión, así que las dos variantes (`<=` y `<`) son
 * igualmente determinísticas. Lo que la tercera regla compra es que el desempate
 * sea TOTAL y ELEGIDO: entre dos cajas de la misma profundidad y la misma área
 * que contienen a la misma, gana la emitida más tarde —la más cercana en orden de
 * lectura— en vez de quedar decidido por el detalle de si la comparación es
 * estricta. El caso `cajas empatadas` de `synthetic.ts` es el que lo observa; sin
 * él, `<=` y `<` daban el mismo árbol y la regla no era acreditable.
 */
const isInnerThan = (a: Ancestor & { box: Box }, b: Ancestor & { box: Box }): boolean =>
  a.route.length !== b.route.length ? a.route.length > b.route.length : area(a.box) <= area(b.box);

const bySpatial = (state: State, box: Box): Route => {
  let best: (Ancestor & { box: Box }) | null = null;
  for (const cand of state.boxes) {
    if (!boxContains(cand.box, box)) continue;
    if (best === null || isInnerThan(cand, best)) best = cand;
  }
  return best === null ? root(state) : fromAncestor(best);
};

/**
 * Las cinco pistas, más la abstención. TOTAL: no hay pista sin ruta.
 *
 * La abstención (`hint === null`) NO es `{linkage:'none'}` — ver PROVISIONAL(#43) en
 * `ir/src/classification.ts`. `null` = «no modifica la ruta»: hereda la pila
 * vigente, que es la que muestra el ejemplo canónico (§{1 · Ruta}: un párrafo con
 * pista «—» y ruta `[Contrato, Cláusula primera]`). `{linkage:'none'}` = «raíz», y
 * con ambos significando lo mismo el árbol de todo DOCX colapsa.
 */
export const routeOf = (state: State, hint: Hint | null): Routing => {
  if (hint === null) return { ok: true, route: [...state.stack], opens: null };
  switch (hint.linkage) {
    case "none":
      return { ok: true, route: root(state), opens: null };
    case "level": {
      const { route, level } = byLevel(state, hint.level);
      return { ok: true, route, opens: { level } };
    }
    case "cell":
      return { ok: true, route: byCell(state, hint), opens: null };
    case "parent": {
      if (hint.parent === null) return { ok: true, route: root(state), opens: null };
      const parent = state.byAdapterId.get(hint.parent);
      if (parent === undefined) {
        return { ok: false, failure: { kind: "parent-not-emitted", parent: hint.parent } };
      }
      return { ok: true, route: fromAncestor(parent), opens: null };
    }
    case "spatial":
      return { ok: true, route: bySpatial(state, hint.box), opens: null };
  }
};

// ─────────────────────────────── Miga ────────────────────────────────────────

/**
 * «Ahí la cohesión `lead` se gana el sueldo dos veces: marca dónde abre un chunk Y
 * qué títulos están abiertos. No hay una segunda estructura para las migas»
 * (§{2 · Emisor}). Esta función es todo lo que el emisor sabe sobre migas: el resto
 * lo hace la misma pila.
 *
 * `isLead` viene de `ir` y no se replica: ramificar sobre `role` fuera de `ir`
 * violaría R2 — ver PROVISIONAL(C1) en `ir/src/classification.ts`.
 *
 * PENDING(#50): la normalización del texto de la miga sigue abierta en `ir`
 * (`Breadcrumb`, `outputs.ts`). Acá se aplica lo único que `ir` ya declara —el
 * truncado por `PARAMETERS.grouping.maxBreadcrumbLength`, que hoy es `null`, o sea
 * sin truncar— y no se inventa ninguna regla más: ese string entra en
 * `ContextualFingerprint`, así que una normalización inventada acá movería huellas
 * de fragmento en cuanto se decida la de verdad.
 */
export const breadcrumbOf = (node: Node, local: LocalId): LocalBreadcrumb | null => {
  if (!isLead(node.role, node.body.shape)) return null;
  // `null` heredaría el esquema de un container; un título no tiene esquema.
  const text = render(node.body, null);
  // Un `lead` sin texto legible (un `asset`) no puede ser miga de nada.
  if (text === null) return null;
  const cap = PARAMETERS.grouping.maxBreadcrumbLength;
  return { ref: local, text: cap === null ? text : text.slice(ZERO, cap) };
};
