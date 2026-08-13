/**
 * Ubicación y coordenadas — cómo se vuelve a la fuente.
 *
 * El plan declara `Location` como un record plano y opaco (§{Tramo 3 › Qué sale})
 * y después le pide tres cosas que un record plano y opaco no puede dar:
 * `SourceRange` con hoja·fila·columna construido del lado limpio del borde (C13),
 * alojar `column` y `z` que «se fueron a ubicación» (C23), y distinguir una región
 * de su origen (C4). Acá se resuelven con una unión discriminada, que es el
 * precedente que el propio plan ya usa para `Hint` (§{La pista}).
 */

import { PARAMETERS } from "./params.js";
import type { AdapterId } from "./identity.js";

/**
 * Un rectángulo dentro de un marco.
 *
 * PROVISIONAL(C23/H11): `Box` no se define NUNCA en el plan, y se usa en TRES
 * lugares, los tres obligatorios: `Hint.spatial.box` (`classification.ts`),
 * `Window.region.box` (`shapes.ts`) y `Coordinate.visual.box` (acá). `Location` NO
 * tiene ningún campo `Box`, ni opcional ni obligatorio — la versión de este
 * docstring que decía «dos lugares, uno de ellos opcional en `Location`»
 * describía un tipo anterior. Elijo enteros en milésimas del marco, origen
 * arriba-izquierda, eje `y` hacia abajo, con el marco identificado por un string
 * opaco — Las tres alternativas fallan en algo que el plan afirma: píxeles
 * absolutos dependen del DPI de rasterizado, que no es estable entre versiones de
 * librería y rompe el property test byte-idéntico (§{El determinismo}); floats
 * normalizados son comparables pero meten el último bit de un float derivado de un
 * modelo de layout dentro de un árbol que CI compara byte a byte; enteros
 * normalizados son las dos cosas a la vez — Si se decide al revés (floats), hay que
 * declarar una tolerancia de comparación y el test de determinismo deja de ser una
 * igualdad.
 *
 * PROVISIONAL(H11): `frame` es OBLIGATORIO — Sin él, las cajas de las 40
 * diapositivas de un `.pptx` conviven en el mismo plano y se contienen entre sí. La
 * contención solo se evalúa entre cajas del mismo marco — Si se decide al revés,
 * `.pptx` necesita que la vía sea mixta (un container por diapositiva + geometría
 * dentro). Que siga siendo obligatorio lo impone `_MarcoObligatorio`
 * (`invariantes.ts`): volverlo opcional no rompe `boxContains`, que compararía
 * `undefined !== undefined` y daría `false`.
 *
 * PROVISIONAL(C23): `z` vive acá, dentro de `Box` — El plan afirma dos veces que
 * `z` «se fue a ubicación, donde las coordenadas ya viven» (§{La pista},
 * §{Lo que se borró}) y `Location` no tiene dónde ponerlo, así que la mudanza que
 * justificó una eliminación nunca ocurrió. Es dato INERTE: nada lo lee, nada ordena
 * por él (§{La pista}), existe solo para la citación — Si se decide al revés
 * (borrarlo), la afirmación de §{Lo que se borró} queda falsa y no hay registro del
 * apilamiento visual en el único formato donde existe.
 */
export type Box = {
  /** Opaco: `"p3"`, `"slide#7"`, `"img"`. Solo el adaptador sabe qué nombra. */
  readonly frame: string;
  /** Milésimas del ancho del marco, desde el borde izquierdo. */
  readonly x: number;
  /** Milésimas del alto del marco, desde el borde superior. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Apilamiento visual. Dato inerte: nada ordena por él. */
  readonly z: number | null;
};

/**
 * Coordenada de un nodo dentro de su fuente. Exactamente UNA por nodo.
 *
 * PROVISIONAL(C13/C23): unión discriminada por `space`, libre de formato, en vez
 * del record plano de §{Tramo 3 › Qué sale} — El tramo 5 tiene que construir
 * `Registro.coordenada: SourceRange // hoja · fila · columna` (§{Las dos salidas})
 * viviendo del lado limpio del borde, y las dos salidas que el plan deja son violar
 * R1 en sentido inverso (leer un tipo declarado opaco) o llamar al adaptador
 * (violar el grafo de paquetes de §{Paquetes}, donde `emision` y `adaptadores`
 * NUNCA se ven entre sí). Una unión discriminada no es «leer un tipo opaco»: es
 * estrechar sobre un discriminante, exactamente lo que el tramo 4 ya hace con
 * `Hint.linkage` (§{1 · Ruta}), admitido porque la pista «es libre de formato»
 * (§{La pista}). Una hoja es una hoja venga de `.xlsx` o de `.csv` — CONSECUENCIA:
 * §{Tramo 3 › Qué sale} queda degradado de «el TIPO es opaco» a «el ANCLA es
 * opaca». Eso hay que escribirlo en el plan — Si se decide al revés, `SourceRange`
 * no se puede tipar y el split π/σ, que es la mitad de la tesis del producto, se
 * queda sin la mitad exacta.
 *
 * EL VOCABULARIO DE `space` ES CERRADO Y ES UN COMPROMISO, no una comodidad:
 * `_EspaciosDeclarados` y `_EspaciosPresentes` (`invariantes.ts`) rompen el build
 * si entra o sale una variante, para que el plan, los doce adaptadores y todo
 * consumidor exhaustivo se actualicen en el MISMO commit. Es el mismo mecanismo con
 * el que `_QuinceRoles` fija `ROLES.length === 15`. Sin él, abrir la unión compila
 * verde y `SourceRange` —que es un `Extract`— ni siquiera se entera.
 */
export type Coordinate =
  /**
   * Toda la fuente. Es la coordenada del chat («un mensaje no tiene página, hoja ni
   * offset», §{Tramo 3 › Qué sale}), del `.zip/.eml`, del piso de texto, y de los
   * avisos de `Diagnóstico` que no cuelgan de ninguna unidad (presupuesto agotado,
   * zip bomb, fallo de decodificación).
   */
  | { readonly space: "source" }
  /**
   * Un intervalo de texto.
   *
   * PROVISIONAL(H14): `[start, end)` en CODE POINTS del texto ya decodificado por
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
  | { readonly space: "text"; readonly start: number; readonly end: number }
  /**
   * Una celda de planilla. ESTA VARIANTE ES `SourceRange`.
   *
   * PROVISIONAL(C23): `column` vive acá y es nullable — §{La pista} declara que la
   * columna «se fue a ubicación» y `Location` no la tiene; `Registro.coordenada`
   * la necesita por texto expreso (§{Las dos salidas}). Es nullable porque un
   * nodo-FILA no tiene una columna: la fila entera es la unidad — Si se decide al
   * revés (no nullable), el nodo-fila no puede construir su coordenada.
   *
   * PROVISIONAL(#45): `row` es el índice ABSOLUTO de la hoja, 1-based, tal como lo
   * muestra la interfaz de la planilla — Es humanamente verificable (el criterio
   * del predecesor, 05-capa1 L243-245), es estable ante una re-segmentación de
   * regiones, y solo cambia cuando el usuario efectivamente inserta una fila, cosa
   * que no toca la identidad porque esa sale del hash (§{5 · Reconciliador}) — Si
   * se decide al revés (relativo a la región), cualquier cambio en el algoritmo de
   * segmentación —que además no está especificado, H7— renumera todo.
   *
   * `region` es un `string` OPACO y su estabilidad NO está garantizada por nadie:
   * es un hueco abierto de otra región (H7 / auditoría #45).
   */
  | {
      readonly space: "grid";
      readonly sheet: string;
      readonly region: string;
      readonly row: number;
      readonly column: number | null;
    }
  /** Una caja dentro de un marco visual. */
  | { readonly space: "visual"; readonly box: Box }
  /**
   * Un intervalo de TIEMPO DE MEDIO: audio, video, y el eje temporal que
   * §{Tramo 3 › Qué sale} nunca llegó a tener.
   *
   * POR QUÉ EXISTE, y por qué esto es una restitución y no un agregado. El diseño
   * predecesor (05-capa1 L247-253) declaraba TRES espacios y el segundo era
   * «`'fragment'` → intervalo temporal (audio, video) **o** recuadro (imagen)».
   * Este archivo implementó cuatro y `'fragment'` degeneró en `'visual'`,
   * quedándose solo con el recuadro: el intervalo temporal SE CAYÓ, y hasta este
   * bloque ninguna línea lo registraba — parecía una omisión y fue una. La visión
   * lo pide dos veces (`t_inicio, t_fin` para video/audio, y «fuente + tiempo» para
   * texto), `EnrichmentKind` ya admite pedir una `transcription`, y sin este
   * espacio una transcripción no se puede anclar a ningún lado.
   *
   * MILISEGUNDOS ENTEROS desde el inicio del medio. Enteros, no flotantes, por el
   * mismo argumento con el que `Box` los descartó: el property test byte-idéntico
   * de §{El determinismo} dejaría de ser una igualdad y habría que declarar una
   * tolerancia. Milisegundos y no ‰ de la duración porque un adaptador de stream no
   * conoce la duración al empezar y porque un recorte movería todas las
   * coordenadas; y no segundos en float, que es lo que usan WebVTT y Whisper, por
   * lo mismo que descarta los flotantes. `Instant` (`identity.ts`) NO sirve: es
   * reloj de pared en ISO-8601, otra cosa.
   *
   * INTERVALO MEDIO ABIERTO `[start, end)`. No es una convención nueva: el paquete
   * ya la fija dos veces, en `Fuente.rango` (bytes, `adaptador.ts`) y en la
   * variante `text` de acá (code points). Escribirlo cerrado sería la tercera
   * convención del mismo paquete para la misma idea.
   *
   * EL CASO MIXTO SE EXPRESA ENCADENANDO, NO EN UN NODO — es la pregunta que
   * cualquiera se hace al leer esto. Un keyframe en el minuto 3:20 con una cara
   * detectada NO es un nodo con tiempo y caja: son DOS ESLABONES de `Location.
   * within`, el tramo de video (`{space:"time", start, end}`) y, dentro de él, el
   * fotograma (`{space:"visual", box}`). Es exactamente lo que el paquete ya hace
   * con §{La delegación es emergente}: el video delega, y el keyframe nace con su
   * propio adaptador y su ancla relativa. Meter los dos ejes en una variante daría
   * DOS maneras de decir «un recuadro» —`visual.box` y `time.box`— y nada impediría
   * que un adaptador eligiera la equivocada; es la clase de ambigüedad que
   * `SourceRange` existe para no tener («no un segundo vocabulario»).
   *
   * `SourceRange` NO se amplía con esta variante: sigue siendo solo `grid`. Un
   * intervalo de audio no produce `Registro.valores`, y decidir que sí —que un
   * turno de transcripción da hablante/texto/confianza— es una decisión de producto
   * que no se toma de contrabando dentro de un cambio de tipos.
   */
  | { readonly space: "time"; readonly start: number; readonly end: number };

/**
 * La coordenada de grilla, que es lo que `DataRecord` necesita (§{Las dos salidas}).
 * Es la variante `grid` de `Coordinate`, no un segundo vocabulario: «un elemento
 * con dos coordenadas puede tenerlas contradictorias, y ningún tipo lo impediría»
 * (05-capa1 L255-256).
 *
 * OJO CON EL `Extract`: si el tag de la variante `grid` se moviera una letra, esto
 * NO sería un error — sería `never`, y `never` es asignable a todo, así que
 * `Registro.coordenada` pasaría a aceptar CUALQUIER COSA, en verde. Es la misma
 * falla que tuvo la familia de hashes, en otro archivo. Lo agarra
 * `_SourceRangeExiste` (`invariantes.ts`).
 */
export type SourceRange = Extract<Coordinate, { space: "grid" }>;

/**
 * Lo que produce un adaptador: ancla + coordenada, SIN el id del adaptador.
 *
 * PROVISIONAL(§{Chat}): el campo `adapter` lo estampa la orquestación, no el
 * adaptador — §{Tramo 3 › Qué sale} lo declara obligatorio y el único ejemplo
 * literal de construcción de una `Location` en todo el plan (el adaptador de chat,
 * §{Chat}) lo omite: `ubicación: { ancla: \`msg#${i}\` }`. El ejemplo que el plan
 * vende como «diez líneas» y «la evidencia más fuerte de que la descomposición es
 * correcta» (§{Chat}) no compila contra el tipo del mismo documento. Quien invocó
 * al adaptador es el único que sabe con certeza cuál es — Si se decide al revés
 * (cada adaptador lo rellena), son doce repeticiones de una constante que ya está
 * en `Adaptador.id`, y un adaptador que la copie mal rompe la citación sin que nada
 * se ponga rojo.
 *
 * OJO: sacar `adapter` es NECESARIO y NO SUFICIENTE. El ejemplo del chat tiene
 * CUATRO defectos frente al contrato, enumerados y verificados con el compilador en
 * `PROVISIONAL(§{Chat})` de `Unidad` (`adaptador.ts`). Este de acá es uno.
 *
 * PROVISIONAL(#ancla): `anchor` es opaca, NO es identidad, NO tiene garantía de
 * estabilidad entre versiones, y tiene que ser única dentro de (documento,
 * adaptador) — El plan no dice nada sobre ella y es el único campo universal, el
 * único que hace posible la citación. Exigir estabilidad obligaría a cada adaptador
 * a inventar identificadores estables, que es exactamente la fórmula de una sola
 * versión que el tramo 4 existe para eliminar — Si se decide al revés (ancla
 * estable), se reintroduce el problema que §{Por qué la identidad} demuestra
 * insoluble.
 */
export type LocalLocation = {
  readonly anchor: string;
  readonly coordinate: Coordinate;
};

/**
 * Lo que cruza el borde: ubicación local + quién puede resolverla + la cadena de
 * contenedores por los que se llegó hasta acá.
 *
 * PROVISIONAL(#15): `within` es recursivo — Un nodo que nació dentro de una
 * imagen que estaba dentro de la página 3 de un PDF tiene `adapter: 'imagen'` y
 * un ancla relativa a la imagen; el adaptador de imagen no sabe nada del PDF ni de
 * la página 3, y un record plano no puede expresar la cadena. La cadena es lo único
 * que hace citable el caso canónico del propio plan (§{La delegación es emergente})
 * — NO viola el no-anidamiento (§{Tramo 3 › Qué sale}), que es sobre `Body`
 * anidando `Node`, no sobre `Location` anidando `Location` — Si se decide al
 * revés (reconstruirla en la citación caminando `parentId` hasta el nodo `asset`
 * que delegó), hace falta el resolvedor que C13 demuestra que no tiene dónde vivir
 * en el grafo de paquetes.
 *
 * Aplanarla a `readonly LocalLocation[]` COMPILA, y ahí «la imagen dentro de la
 * página 3 del PDF» deja de ser expresable sin un solo error. Lo agarra
 * `_WithinEsRecursivo` (`invariantes.ts`).
 */
export type Location = LocalLocation & {
  readonly adapter: AdapterId;
  /** De afuera hacia adentro. Vacío = el nodo nació en el documento raíz. */
  readonly within: readonly Location[];
};

// ─────────────────────────────── Geometría ───────────────────────────────────

/**
 * Contención geométrica: la relación de padre de la vía `spatial` (§{1 · Ruta}).
 *
 * PROVISIONAL(H11): contención ESTRICTA, con la tolerancia de
 * `PARAMETERS.geometry.containmentTolerance` —hoy 0, o sea estricta— y exigiendo el
 * mismo marco. El número vive en `params.ts` y está declarado provisional ahí
 * («Se mide: distribución de solapamiento parcial en salidas reales del modelo de
 * layout»), así que transcribirlo acá volvería esta línea falsa el día que se mida —
 * El plan pide «derivar contención geométrica» y no define el predicado: ni
 * tolerancia, ni qué hacer con solapamiento parcial (habitual en PPTX y en salidas
 * de modelos de layout), ni con cajas idénticas. Estricta porque el error degrada a
 * «cuelga de la raíz», que es visible, en vez de a «cuelga del vecino equivocado»,
 * que es silencioso — Si se decide al revés (umbral de área), hace falta un número,
 * que es exactamente el tipo de parche que §{Segunda} declara no querer.
 *
 * La exigencia del mismo marco no la impone ningún tipo: borrar esa línea compila
 * en verde y los guardianes de tipos pasan. La ejecuta `scripts/geometry.mjs`.
 */
export const boxContains = (parent: Box, child: Box): boolean => {
  if (parent.frame !== child.frame) return false;
  const t = PARAMETERS.geometry.containmentTolerance;
  return (
    child.x >= parent.x - t &&
    child.y >= parent.y - t &&
    child.x + child.width <= parent.x + parent.width + t &&
    child.y + child.height <= parent.y + parent.height + t
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
 * desempatar con `LocalLocation.anchor`, que sí es única dentro del documento — Si
 * se decide al revés (reponer `z` en la pista), se revierte una decisión que el
 * plan lista entre los puntos resueltos (§{Puntos}).
 *
 * Que el orden sea ASCENDENTE, que sea antisimétrico y que NO sea total lo ejecuta
 * `scripts/geometry.mjs`: invertir el signo compila en verde.
 */
export const compareBoxes = (a: Box, b: Box): number => {
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  if (areaA !== areaB) return areaA - areaB;
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
};
