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
 * (§{2 · Emisor}). Se caminan desde `padreLocal` cuando hagan falta — el guardián
 * de invariantes los camina para verificar las migas, que es la prueba de que se
 * puede.
 *
 * LO QUE ESTE PASO NO HACE: reconciliar. `id: ElementId` sale de la reconciliación
 * (paso 11), que corre DESPUÉS y necesita esta lista ya emitida; por eso la salida
 * es `NodoConRuta` y no `NodoEmitido` — ver PROVISIONAL(#66) en `ir/src/salidas.ts`.
 * El emisor no acuña identidad, y esa es toda la tesis del tramo: «la ruta sirve
 * para estructura y migas; la identidad sale de comparar dos versiones»
 * (§{Por qué esto funciona}).
 */

import {
  PARAMETROS,
  comoHuellaNodo,
  huellaDe,
  type DelegacionId,
  type FunciónHash,
  type LocalId,
  type Nodo,
  type NodoConRuta,
} from "@savia-os/ir";

import {
  crearEstado,
  localDeNodo,
  migaDe,
  rutaDe,
  type Estado,
  type Ruta,
  type Scope,
} from "./ruta.js";

const { cero: CERO, uno: UNO } = PARAMETROS.aritmética;

// ─────────────────────────────── Salida ──────────────────────────────────────

/**
 * Por qué el fallo es un objeto y no un nodo degradado: ver PENDIENTE(#46) en
 * `ruta.ts`. `{ok:false}` no es asignable a `{ok:true}`, así que el llamador no
 * puede leer `nodos` sin haber mirado antes.
 */
export type FallaDeEmisión = {
  readonly clase: "padre-no-emitido";
  /** Índice en la secuencia de entrada. */
  readonly posición: number;
  readonly padre: LocalId;
};

export type Emisión =
  | { readonly ok: true; readonly nodos: readonly NodoConRuta[] }
  | { readonly ok: false; readonly falla: FallaDeEmisión };

// ─────────────────────────────── Delegación ──────────────────────────────────

/**
 * Un marco de delegación abierto.
 *
 * `base` es la altura de la pila ANTES del injerto y `piso` la de después. Los dos
 * hacen falta y son distintos: cerrar el marco trunca la pila a `base` (se va también
 * el scope del nodo que delegó), mientras que la escala de niveles de adentro no
 * puede bajar de `piso` (el injerto es el fondo del subárbol, no algo que el
 * subárbol pueda cerrar). Con un solo número, o el injerto sobrevive al cierre o
 * un `nivel 1` delegado cierra el título del documento padre — que es exactamente
 * lo que §{2 · Emisor} prohíbe.
 */
type Marco = {
  readonly id: DelegacionId;
  readonly base: number;
  readonly piso: number;
};

const prefijoDeDelegación = (
  a: readonly DelegacionId[],
  b: readonly DelegacionId[],
): number => {
  let i = CERO;
  while (i < a.length && i < b.length && a[i] === b[i]) i += UNO;
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
const padreDe = (pila: Ruta): LocalId | null => {
  for (let i = pila.length - UNO; i >= CERO; i -= UNO) {
    const s = pila[i];
    if (s?.clase === "nodo") return s.local;
  }
  return null;
};

/** «Las migas son solo los scopes que son títulos» (§{2 · Emisor}). La misma pila. */
const migasDe = (pila: Ruta): NodoConRuta["migas"] =>
  pila.flatMap((s) => (s.clase === "nodo" && s.miga !== null ? [s.miga] : []));

/** Cierra los marcos que se abandonaron y abre los nuevos. Devuelve el piso. */
const reencuadrar = (
  estado: Estado,
  marcos: Marco[],
  anterior: readonly DelegacionId[],
  actual: readonly DelegacionId[],
  últimoScope: Scope | null,
): void => {
  const común = prefijoDeDelegación(anterior, actual);
  // BAJÓ: cerrar sus scopes.
  while (marcos.length > común) {
    const ido = marcos.pop();
    if (ido !== undefined) estado.pila.length = ido.base;
  }
  // SUBIÓ: el nodo que delegó abre un scope propio.
  for (const id of actual.slice(común)) {
    const base = estado.pila.length;
    if (últimoScope !== null) estado.pila.push(últimoScope);
    marcos.push({ id, base, piso: estado.pila.length });
  }
  const tope = marcos[marcos.length - UNO];
  estado.piso = tope === undefined ? CERO : tope.piso;
};

/**
 * `sha256` viene por parámetro, igual que en `huellaDe`: `ir` no depende de
 * `node:crypto` y `emision` tampoco. El emisor es una función pura de
 * `(nodos, sha256)`, que es lo que hace verificable el invariante de determinismo.
 */
export const emitir = (nodos: readonly Nodo[], sha256: FunciónHash): Emisión => {
  const estado = crearEstado();
  const marcos: Marco[] = [];
  const salida: NodoConRuta[] = [];
  let anterior: readonly DelegacionId[] = [];
  let últimoScope: Scope | null = null;

  for (const [i, nodo] of nodos.entries()) {
    reencuadrar(estado, marcos, anterior, nodo.delegación, últimoScope);
    anterior = nodo.delegación;

    const ruteo = rutaDe(estado, nodo.pista);
    if (!ruteo.ok) {
      return { ok: false, falla: { ...ruteo.falla, posición: i } };
    }

    // «Cerrar los scopes por encima de común, abrir los nuevos» (§{2 · Emisor}).
    //
    // EN UN EMISOR POR LOTES ESO ES, EXACTAMENTE, ESTO: la pila pasa a ser la ruta.
    // Acá estuvo escrito el prefijo compartido del plan —`común`, cerrar hasta ahí,
    // abrir el resto—, y el banco de mutación demostró que NO HACÍA NADA: se
    // aleatorizó la identidad de los scopes sintéticos, de modo que el prefijo
    // compartido pasara a ser 0 en cada nodo, y la salida no se movió un byte.
    // Es aritmética: el resultado de cerrar hasta `común` y abrir el resto es
    // `ruta`, para todo `común`. Se borra en vez de dejarlo como una aserción que
    // no puede fallar. Vuelve el día que el emisor EMITA los abrir/cerrar —el
    // streaming que §{2 · Emisor} promete—, porque ahí sí hay un observador que
    // distingue «no cambió nada» de «cerré y reabrí todo».
    estado.pila = [...ruteo.ruta];

    const local = localDeNodo(i);
    salida.push({
      ...nodo,
      local,
      padreLocal: padreDe(estado.pila),
      migas: migasDe(estado.pila),
      // La huella NO ve la ruta ni las migas. Es lo que hace que editar un título
      // no despegue la curación de su sección (§{Por qué esto funciona}).
      hash: comoHuellaNodo(huellaDe(nodo.cuerpo, sha256)),
    });

    const propio: Scope = { clase: "nodo", local, miga: migaDe(nodo, local) };
    const contenedor = { ruta: [...estado.pila], scope: propio };
    if (nodo.pista !== null) {
      if (nodo.pista.via === "padre") estado.porIdDeAdaptador.set(nodo.pista.id, contenedor);
      if (nodo.pista.via === "espacial") {
        estado.cajas.push({ ...contenedor, caja: nodo.pista.caja });
      }
    }
    if (ruteo.abre !== null) {
      estado.nivelDe.set(local, ruteo.abre.nivel);
      estado.pila.push(propio);
    }
    últimoScope = propio;
  }

  return { ok: true, nodos: salida };
};
