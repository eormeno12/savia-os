/**
 * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (§{2 · Emisor}).
 *
 *     para cada nodo, en orden de lectura:
 *         si BAJÓ de un subárbol delegado  → cerrar sus scopes
 *         si SUBIÓ a un subárbol delegado  → el nodo que delegó abre un scope propio
 *         común = prefijo compartido entre la ruta anterior y la actual
 *         cerrar los scopes por encima de común
 *         abrir los scopes nuevos
 *         parentId ← el tope de la pila
 *         migas    ← los scopes abiertos que son TÍTULOS
 *
 * Este archivo es esas ocho líneas y nada más. Lo que hace que sean suficientes:
 *
 * > **El árbol nunca existe como estructura.** Es la pila durante el recorrido. Por
 * > eso se puede emitir en streaming sin materializar el documento en memoria, y
 * > por eso `container` no necesita llevar hijos. (§{2 · Emisor})
 *
 * Y las dos salidas NO son lo mismo, que fue un error escrito en el propio plan:
 * «`parentId` es el tope de la pila. Las migas son solo los scopes que son
 * títulos» (§{2 · Emisor}). La ruta es ESTRUCTURAL —en HTML los scopes son `body /
 * div / section / ul / li`— y las migas son LEGIBLES.
 *
 * NO SE ALMACENA NADA DERIVABLE: ni `depth`, ni `siblingIndex`, ni `ordinal`
 * (§{2 · Emisor}). Se caminan desde `localParent` cuando hagan falta — el guardián
 * de invariantes los camina para verificar las migas, que es la prueba de que se
 * puede.
 *
 * LO QUE ESTE PASO NO HACE: reconciliar. `id: ElementId` sale de la reconciliación
 * (paso 11), que corre DESPUÉS y necesita esta lista ya emitida; por eso la salida
 * es `RoutedNode` y no `EmittedNode` — ver PROVISIONAL(#66) en `ir/src/outputs.ts`.
 * El emisor no acuña identidad, y esa es toda la tesis del tramo: «la ruta sirve
 * para estructura y migas; la identidad sale de comparar dos versiones»
 * (§{Por qué esto funciona}).
 */

import {
  PARAMETERS,
  asNodeFingerprint,
  fingerprintOf,
  type DelegationId,
  type HashFn,
  type LocalId,
  type Node,
  type RoutedNode,
} from "@savia-os/ir";

import {
  breadcrumbOf,
  createState,
  localOfNode,
  routeOf,
  type Route,
  type Scope,
  type State,
} from "./route.js";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

// ─────────────────────────────── Salida ──────────────────────────────────────

/**
 * Por qué el fallo es un objeto y no un nodo degradado: ver PENDING(#46) en
 * `route.ts`. `{ok:false}` no es asignable a `{ok:true}`, así que el llamador no
 * puede leer `nodes` sin haber mirado antes.
 */
export type EmissionFailure = {
  readonly kind: "parent-not-emitted";
  /** Índice en la secuencia de entrada. */
  readonly position: number;
  readonly parent: LocalId;
};

export type Emission =
  | { readonly ok: true; readonly nodes: readonly RoutedNode[] }
  | { readonly ok: false; readonly failure: EmissionFailure };

// ─────────────────────────────── Delegación ──────────────────────────────────

/**
 * Un marco de delegación abierto.
 *
 * SE LLAMA `DelegationFrame` Y NO `Frame` (GLOSARIO.md, B6): en español
 * `marco` nombra también el marco de una `Box` (`Box.frame`, «p3», «slide#7»), que
 * es otra cosa. Es una homonimia que el español TENÍA y que el nombre largo
 * deshace; escribir `Frame` la habría importado tal cual.
 *
 * `base` es la altura de la pila ANTES del injerto y `floor` la de después. Los dos
 * hacen falta y son distintos: cerrar el marco trunca la pila a `base` (se va también
 * el scope del nodo que delegó), mientras que la escala de niveles de adentro no
 * puede bajar de `floor` (el injerto es el fondo del subárbol, no algo que el
 * subárbol pueda cerrar). Con un solo número, o el injerto sobrevive al cierre o
 * un `level 1` delegado cierra el título del documento padre — que es exactamente
 * lo que §{2 · Emisor} prohíbe.
 */
type DelegationFrame = {
  readonly id: DelegationId;
  readonly base: number;
  readonly floor: number;
};

const prefixOfDelegation = (
  a: readonly DelegationId[],
  b: readonly DelegationId[],
): number => {
  let i = ZERO;
  while (i < a.length && i < b.length && a[i] === b[i]) i += ONE;
  return i;
};

// ─────────────────────────────── El recorrido ────────────────────────────────

/**
 * «`parentId` ← el tope de la pila» (§{2 · Emisor}), con H5: si el tope es un scope
 * SINTÉTICO —una hoja, una región, un `<div>` que no es unidad— el padre es el
 * primer ancestro que sí es nodo emitido. Materializar el sintético como
 * `container` inundaría el documento de containers que por C14 hashean todos
 * igual y no anclan nunca: sería cambiar un problema por uno peor.
 */
const parentOf = (stack: Route): LocalId | null => {
  for (let i = stack.length - ONE; i >= ZERO; i -= ONE) {
    const s = stack[i];
    if (s?.kind === "node") return s.local;
  }
  return null;
};

/**
 * «Las migas son solo los scopes que son títulos» (§{2 · Emisor}). La misma pila.
 *
 * LEE `s.kind` SIN GUARDA Y SUS DOS HERMANOS NO: `parentOf` escribe `s?.kind` y
 * `levelOfTop` (`route.ts`) hace `if (s === undefined) continue`, porque los dos
 * indexan la pila y `noUncheckedIndexedAccess` los obliga. Acá el `flatMap` tipa el
 * elemento como `Scope`, así que el compilador no pide nada — y esa diferencia es
 * REAL, no cosmética: la pila puede tener AGUJEROS si alguna vez `state.stack.length`
 * se asigna hacia arriba (en JavaScript agrandar un arreglo por su `length` deja
 * huecos). Hoy no puede pasar, y el motivo es el piso: `reframe` trunca a
 * `frame.base` y la escala de niveles nunca vacía la pila por debajo de
 * `frame.floor`, que es estrictamente mayor. El mutante `M19` lo demostró al revés —
 * con el piso roto, este `flatMap` es el que explota primero, con un `TypeError` que
 * no nombra ningún invariante.
 */
const breadcrumbsOf = (stack: Route): RoutedNode["breadcrumbs"] =>
  stack.flatMap((s) => (s.kind === "node" && s.breadcrumb !== null ? [s.breadcrumb] : []));

/** Cierra los marcos que se abandonaron y abre los nuevos. Fija el piso. */
const reframe = (
  state: State,
  frames: DelegationFrame[],
  previous: readonly DelegationId[],
  current: readonly DelegationId[],
  lastScope: Scope | null,
): void => {
  const common = prefixOfDelegation(previous, current);
  // BAJÓ: cerrar sus scopes.
  while (frames.length > common) {
    const gone = frames.pop();
    if (gone !== undefined) state.stack.length = gone.base;
  }
  // SUBIÓ: el nodo que delegó abre un scope propio.
  for (const id of current.slice(common)) {
    const base = state.stack.length;
    if (lastScope !== null) state.stack.push(lastScope);
    frames.push({ id, base, floor: state.stack.length });
  }
  const top = frames[frames.length - ONE];
  state.floor = top === undefined ? ZERO : top.floor;
};

/**
 * `sha256` viene por parámetro, igual que en `fingerprintOf`: `ir` no depende de
 * `node:crypto` y `emission` tampoco. El emisor es una función pura de
 * `(nodes, sha256)`, que es lo que hace verificable el invariante de determinismo.
 */
export const emit = (nodes: readonly Node[], sha256: HashFn): Emission => {
  const state = createState();
  const frames: DelegationFrame[] = [];
  const output: RoutedNode[] = [];
  let previous: readonly DelegationId[] = [];
  let lastScope: Scope | null = null;

  for (const [i, node] of nodes.entries()) {
    reframe(state, frames, previous, node.delegation, lastScope);
    previous = node.delegation;

    const routing = routeOf(state, node.hint);
    if (!routing.ok) {
      return { ok: false, failure: { ...routing.failure, position: i } };
    }

    // «Cerrar los scopes por encima de común, abrir los nuevos» (§{2 · Emisor}).
    //
    // EN UN EMISOR POR LOTES ESO ES, EXACTAMENTE, ESTO: la pila pasa a ser la ruta.
    // Acá estuvo escrito el prefijo compartido del plan —`común`, cerrar hasta ahí,
    // abrir el resto—, y el banco de mutación demostró que NO HACÍA NADA: se
    // aleatorizó la identidad de los scopes sintéticos, de modo que el prefijo
    // compartido pasara a ser 0 en cada nodo, y la salida no se movió un byte.
    // Es aritmética: el resultado de cerrar hasta `común` y abrir el resto es
    // `route`, para todo `común`. Se borra en vez de dejarlo como una aserción que
    // no puede fallar. Vuelve el día que el emisor EMITA los abrir/cerrar —el
    // streaming que §{2 · Emisor} promete—, porque ahí sí hay un observador que
    // distingue «no cambió nada» de «cerré y reabrí todo».
    state.stack = [...routing.route];

    const local = localOfNode(i);
    output.push({
      ...node,
      local,
      localParent: parentOf(state.stack),
      breadcrumbs: breadcrumbsOf(state.stack),
      // La huella NO ve la ruta ni las migas. Es lo que hace que editar un título
      // no despegue la curación de su sección (§{Por qué esto funciona}).
      hash: asNodeFingerprint(fingerprintOf(node.body, sha256)),
    });

    const own: Scope = { kind: "node", local, breadcrumb: breadcrumbOf(node, local) };
    const ancestor = { route: [...state.stack], scope: own };
    if (node.hint !== null) {
      if (node.hint.linkage === "parent") state.byAdapterId.set(node.hint.id, ancestor);
      if (node.hint.linkage === "spatial") {
        state.boxes.push({ ...ancestor, box: node.hint.box });
      }
    }
    if (routing.opens !== null) {
      state.levelOf.set(local, routing.opens.level);
      state.stack.push(own);
    }
    lastScope = own;
  }

  return { ok: true, nodes: output };
};
