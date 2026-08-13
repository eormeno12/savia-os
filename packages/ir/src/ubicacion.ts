/**
 * Ubicación y coordenadas — cómo se vuelve a la fuente.
 *
 * El plan declara `Ubicación` como un record plano y opaco (§{Tramo 3 › Qué sale})
 * y después le pide tres cosas que un record plano y opaco no puede dar:
 * `SourceRange` con hoja·fila·columna construido del lado limpio del borde (C13),
 * alojar `columna` y `z` que «se fueron a ubicación» (C23), y distinguir una región
 * de su origen (C4). Acá se resuelven con una unión discriminada, que es el
 * precedente que el propio plan ya usa para `Pista` (§{La pista}).
 */

import {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  PARAMETERS as PARAMETROS,
} from "./params.js";
import type { AdaptadorId } from "./identidad.js";

/**
 * Un rectángulo dentro de un marco.
 *
 * PROVISIONAL(C23/H11): `Caja` no se define NUNCA en el plan, y se usa en dos
 * lugares (`Pista.espacial`, obligatoria; `Ubicación`, opcional). Elijo enteros en
 * milésimas del marco, origen arriba-izquierda, eje `y` hacia abajo, con el marco
 * identificado por un string opaco — Las tres alternativas fallan en algo que el
 * plan afirma: píxeles absolutos dependen del DPI de rasterizado, que no es estable
 * entre versiones de librería y rompe el property test byte-idéntico
 * (§{El determinismo}); floats normalizados son comparables pero meten el último
 * bit de un float derivado de un modelo de layout dentro de un árbol que CI compara
 * byte a byte; enteros normalizados son las dos cosas a la vez — Si se decide al
 * revés (floats), hay que declarar una tolerancia de comparación y el test de
 * determinismo deja de ser una igualdad.
 *
 * PROVISIONAL(H11): `marco` es OBLIGATORIO — Sin él, las cajas de las 40
 * diapositivas de un `.pptx` conviven en el mismo plano y se contienen entre sí. La
 * contención solo se evalúa entre cajas del mismo marco — Si se decide al revés,
 * `.pptx` necesita que la vía sea mixta (un container por diapositiva + geometría
 * dentro).
 *
 * PROVISIONAL(C23): `z` vive acá, dentro de `Caja` — El plan afirma dos veces que
 * `z` «se fue a ubicación, donde las coordenadas ya viven» (§{La pista},
 * §{Lo que se borró}) y `Ubicación` no tiene dónde ponerlo, así que la mudanza que
 * justificó una eliminación nunca ocurrió. Es dato INERTE: nada lo lee, nada ordena
 * por él (§{La pista}), existe solo para la citación — Si se decide al revés
 * (borrarlo), la afirmación de §{Lo que se borró} queda falsa y no hay registro del
 * apilamiento visual en el único formato donde existe.
 */
export type Caja = {
  /** Opaco: `"p3"`, `"slide#7"`, `"img"`. Solo el adaptador sabe qué nombra. */
  readonly marco: string;
  /** Milésimas del ancho del marco, desde el borde izquierdo. */
  readonly x: number;
  /** Milésimas del alto del marco, desde el borde superior. */
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** Apilamiento visual. Dato inerte: nada ordena por él. */
  readonly z: number | null;
};

/**
 * Coordenada de un nodo dentro de su fuente. Exactamente UNA por nodo.
 *
 * PROVISIONAL(C13/C23): unión discriminada por `espacio`, libre de formato, en vez
 * del record plano de §{Tramo 3 › Qué sale} — El tramo 5 tiene que construir
 * `Registro.coordenada: SourceRange // hoja · fila · columna` (§{Las dos salidas})
 * viviendo del lado limpio del borde, y las dos salidas que el plan deja son violar
 * R1 en sentido inverso (leer un tipo declarado opaco) o llamar al adaptador
 * (violar el grafo de paquetes de §{Paquetes}, donde `emision` y `adaptadores`
 * NUNCA se ven entre sí). Una unión discriminada no es «leer un tipo opaco»: es
 * estrechar sobre un discriminante, exactamente lo que el tramo 4 ya hace con
 * `Pista.via` (§{1 · Ruta}), admitido porque la pista «es libre de formato»
 * (§{La pista}). Una hoja es una hoja venga de `.xlsx` o de `.csv` — CONSECUENCIA:
 * §{Tramo 3 › Qué sale} queda degradado de «el TIPO es opaco» a «el ANCLA es
 * opaca». Eso hay que escribirlo en el plan — Si se decide al revés, `SourceRange`
 * no se puede tipar y el split π/σ, que es la mitad de la tesis del producto, se
 * queda sin la mitad exacta.
 */
export type Coordenada =
  /**
   * Toda la fuente. Es la coordenada del chat («un mensaje no tiene página, hoja ni
   * offset», §{Tramo 3 › Qué sale}), del `.zip/.eml`, del piso de texto, y de los
   * avisos de `Diagnóstico` que no cuelgan de ninguna unidad (presupuesto agotado,
   * zip bomb, fallo de decodificación).
   */
  | { readonly espacio: "fuente" }
  /**
   * Un intervalo de texto.
   *
   * PROVISIONAL(H14): `[inicio, fin)` en CODE POINTS del texto ya decodificado por
   * el adaptador — El plan escribe `rango?: [number, number]`
   * (§{Tramo 3 › Qué sale}) y no lo menciona en ninguna otra línea: ningún tramo lo
   * lee, ningún adaptador lo produce. Y el documento predecesor rechaza los offsets
   * exactos como coordenada útil (05-capa1 L243-245: «paga en una interfaz de
   * resaltado fino, no acá»). Prefiero definirlo a borrarlo, porque el borrado es
   * irreversible desde el archivo y el plan lo escribió a propósito — La referencia
   * solo es válida una vez que H14 fije la regla de detección de codificación:
   * hasta entonces dos implementaciones dan offsets distintos — Si se decide al
   * revés (borrarlo), se pierde un campo de una firma literal del plan sin que
   * nadie lo haya pedido.
   */
  | { readonly espacio: "texto"; readonly desde: number; readonly hasta: number }
  /**
   * Una celda de planilla. ESTA VARIANTE ES `SourceRange`.
   *
   * PROVISIONAL(C23): `columna` vive acá y es nullable — §{La pista} declara que la
   * columna «se fue a ubicación» y `Ubicación` no la tiene; `Registro.coordenada`
   * la necesita por texto expreso (§{Las dos salidas}). Es nullable porque un
   * nodo-FILA no tiene una columna: la fila entera es la unidad — Si se decide al
   * revés (no nullable), el nodo-fila no puede construir su coordenada.
   *
   * PROVISIONAL(#45): `fila` es el índice ABSOLUTO de la hoja, 1-based, tal como lo
   * muestra la interfaz de la planilla — Es humanamente verificable (el criterio
   * del predecesor, 05-capa1 L243-245), es estable ante una re-segmentación de
   * regiones, y solo cambia cuando el usuario efectivamente inserta una fila, cosa
   * que no toca la identidad porque esa sale del hash (§{5 · Reconciliador}) — Si
   * se decide al revés (relativo a la región), cualquier cambio en el algoritmo de
   * segmentación —que además no está especificado, H7— renumera todo.
   *
   * `región` es un `string` OPACO y su estabilidad NO está garantizada por nadie:
   * es un hueco abierto de otra región (H7 / auditoría #45).
   */
  | {
      readonly espacio: "grid";
      readonly hoja: string;
      readonly región: string;
      readonly fila: number;
      readonly columna: number | null;
    }
  /** Una caja dentro de un marco visual. */
  | { readonly espacio: "visual"; readonly caja: Caja };

/**
 * La coordenada de grilla, que es lo que `Registro` necesita (§{Las dos salidas}).
 * Es la variante `grid` de `Coordenada`, no un segundo vocabulario: «un elemento
 * con dos coordenadas puede tenerlas contradictorias, y ningún tipo lo impediría»
 * (05-capa1 L255-256).
 */
export type SourceRange = Extract<Coordenada, { espacio: "grid" }>;

/**
 * Lo que produce un adaptador: ancla + coordenada, SIN el id del adaptador.
 *
 * PROVISIONAL(§{Chat}): el campo `adaptador` lo estampa la orquestación, no el
 * adaptador — §{Tramo 3 › Qué sale} lo declara obligatorio y el único ejemplo
 * literal de construcción de una `Ubicación` en todo el plan (el adaptador de chat,
 * §{Chat}) lo omite: `ubicación: { ancla: \`msg#${i}\` }`. El ejemplo que el plan
 * vende como «diez líneas» y «la evidencia más fuerte de que la descomposición es
 * correcta» (§{Chat}) no compila contra el tipo del mismo documento. Quien invocó
 * al adaptador es el único que sabe con certeza cuál es — Si se decide al revés
 * (cada adaptador lo rellena), son doce repeticiones de una constante que ya está
 * en `Adaptador.id`, y un adaptador que la copie mal rompe la citación sin que nada
 * se ponga rojo.
 *
 * OJO: sacar `adaptador` es NECESARIO y NO SUFICIENTE. El ejemplo del chat tiene
 * CUATRO defectos frente al contrato, enumerados y verificados con el compilador en
 * `PROVISIONAL(§{Chat})` de `Unidad` (`adaptador.ts`). Este de acá es uno.
 *
 * PROVISIONAL(#ancla): `ancla` es opaca, NO es identidad, NO tiene garantía de
 * estabilidad entre versiones, y tiene que ser única dentro de (documento,
 * adaptador) — El plan no dice nada sobre ella y es el único campo universal, el
 * único que hace posible la citación. Exigir estabilidad obligaría a cada adaptador
 * a inventar identificadores estables, que es exactamente la fórmula de una sola
 * versión que el tramo 4 existe para eliminar — Si se decide al revés (ancla
 * estable), se reintroduce el problema que §{Por qué la identidad} demuestra
 * insoluble.
 */
export type UbicaciónLocal = {
  readonly ancla: string;
  readonly coordenada: Coordenada;
};

/**
 * Lo que cruza el borde: ubicación local + quién puede resolverla + la cadena de
 * contenedores por los que se llegó hasta acá.
 *
 * PROVISIONAL(#15): `dentroDe` es recursivo — Un nodo que nació dentro de una
 * imagen que estaba dentro de la página 3 de un PDF tiene `adaptador: 'imagen'` y
 * un ancla relativa a la imagen; el adaptador de imagen no sabe nada del PDF ni de
 * la página 3, y un record plano no puede expresar la cadena. La cadena es lo único
 * que hace citable el caso canónico del propio plan (§{La delegación es emergente})
 * — NO viola el no-anidamiento (§{Tramo 3 › Qué sale}), que es sobre `Cuerpo`
 * anidando `Nodo`, no sobre `Ubicación` anidando `Ubicación` — Si se decide al
 * revés (reconstruirla en la citación caminando `parentId` hasta el nodo `asset`
 * que delegó), hace falta el resolvedor que C13 demuestra que no tiene dónde vivir
 * en el grafo de paquetes.
 */
export type Ubicación = UbicaciónLocal & {
  readonly adaptador: AdaptadorId;
  /** De afuera hacia adentro. Vacío = el nodo nació en el documento raíz. */
  readonly dentroDe: readonly Ubicación[];
};

// ─────────────────────────────── Geometría ───────────────────────────────────

/**
 * Contención geométrica: la relación de padre de la vía `espacial` (§{1 · Ruta}).
 *
 * PROVISIONAL(H11): contención ESTRICTA, con tolerancia 0 y exigiendo el mismo
 * marco — El plan pide «derivar contención geométrica» y no define el predicado: ni
 * tolerancia, ni qué hacer con solapamiento parcial (habitual en PPTX y en salidas
 * de modelos de layout), ni con cajas idénticas. Estricta porque el error degrada a
 * «cuelga de la raíz», que es visible, en vez de a «cuelga del vecino equivocado»,
 * que es silencioso — Si se decide al revés (umbral de área), hace falta un número,
 * que es exactamente el tipo de parche que §{Segunda} declara no querer.
 */
export const cajaContiene = (padre: Caja, hijo: Caja): boolean => {
  if (padre.marco !== hijo.marco) return false;
  const t = PARAMETROS.geometry.containmentTolerance;
  return (
    hijo.x >= padre.x - t &&
    hijo.y >= padre.y - t &&
    hijo.x + hijo.ancho <= padre.x + padre.ancho + t &&
    hijo.y + hijo.alto <= padre.y + padre.alto + t
  );
};

/**
 * Orden determinístico entre cajas del mismo marco: área ascendente, después `y`,
 * después `x`.
 *
 * PROVISIONAL(H11): sin campo nuevo de desempate — El plan afirma que al sacar `z`
 * de la pista «desapareció la ambigüedad de dos cajas con el mismo z»
 * (§{La pista}); en realidad se mudó, porque ahora nada rompe el empate. Este
 * comparador NO es total: dos cajas idénticas devuelven 0 y el llamador DEBE
 * desempatar con `UbicaciónLocal.ancla`, que sí es única dentro del documento — Si
 * se decide al revés (reponer `z` en la pista), se revierte una decisión que el
 * plan lista entre los puntos resueltos (§{Puntos}).
 */
export const compararCajas = (a: Caja, b: Caja): number => {
  const áreaA = a.ancho * a.alto;
  const áreaB = b.ancho * b.alto;
  if (áreaA !== áreaB) return áreaA - áreaB;
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
};
