/**
 * `PARAMETERS` — el ÚNICO objeto con valores numéricos de todo el paquete.
 *
 * Regla de gobierno, tomada del propio plan (§{5 · Reconciliador}):
 *
 * > «El umbral de similitud no se fija por decreto. Es un parámetro; se barre
 * > sobre el corpus y el valor por defecto sale de esa medición. **Un número
 * > inventado con precisión falsa es peor que uno declarado como pendiente.**»
 *
 * Por eso ningún otro archivo de `ir` contiene un literal numérico: si un número
 * decide comportamiento, vive acá, con nombre, unidad, qué decide y cómo se
 * mediría el definitivo. Lo verifica `scripts/numbers.mjs`, que recorre el AST de
 * cada archivo de `src/` — no es una promesa de estilo. Los que están en `null` son
 * los que el plan declara load-bearing y que NO se pueden inventar sin invalidar
 * las cifras que el banco de pruebas reporta (auditoría H3): quien los necesite
 * tiene que proveerlos, y el tipo lo obliga.
 *
 * CENSO(numbers.mjs): 29 numéricos = 18 pending en null + 11 con valor
 *
 * Esa línea NO se sostiene a mano: `scripts/numbers.mjs` la deriva del AST y falla
 * si discrepa. La versión anterior de esta cifra vivía en el plan, decía «17 campos
 * en `null`» y el árbol sano tenía 18 — o sea que publicaba como correcto el estado
 * que resulta de convertir un pendiente en un número inventado, y un auditor que
 * verificara contra ella aprobaba el árbol roto y rechazaba el sano. Es exactamente
 * el modo de falla que la cita de arriba denuncia, reproducido en la cifra que
 * existía para protegerlo.
 *
 * Nomenclatura: este archivo YA está en inglés — el bloque 1 ejecutó P1 acá, sobre
 * `shapes.ts` y sobre `classification.ts`. El argumento que sostenía el español
 * («que cada símbolo se pueda cotejar contra su línea del borrador») caducó cuando
 * el cotejo pasó a hacerlo `scripts/citas.mjs` contra SECCIONES del plan: una
 * sección sobrevive al rename de un símbolo, un número de línea no. El plan sigue
 * en español y las anclas de sección lo citan tal cual. Ver PROVISIONAL(P1) en
 * `index.ts` para lo que todavía no se tradujo.
 */

/** Un parámetro que el plan declara medible y todavía no midió. `null` = sin valor. */
export type Pending<T> = T | null;

export const PARAMETERS = {
  /**
   * Constantes de contrato, NO parámetros calibrables. Existen para que el resto
   * del paquete no tenga ningún literal numérico suelto. Nadie las mide.
   */
  arithmetic: {
    zero: 0,
    one: 1,
    /** Lo que devuelve `Array.prototype.indexOf` cuando no encuentra. */
    notFound: -1,
  },

  // ───────────────────────────── Tramo 1 · Recepción ─────────────────────────

  intake: {
    /**
     * Tamaño de la ventana de la sonda, en bytes (plan §{Qué se acepta},
     * §{La sonda}: «los primeros 4 KB, nada más»). Decide: sobre qué corre el gate
     * de imprimibles, cuánto ocupa la tabla `documento_en_espera` (≈ este valor ×
     * documentos en espera) y qué evidenciadores pueden responder sin leer el
     * objeto. Se mide: no se mide, se declara. Fijado en 4096 (potencia de dos) y
     * no en 4000, para que coincida con el tamaño de bloque de cualquier lector.
     * Ver PROVISIONAL(bytesMágicos) en `adaptador.ts`.
     */
    magicBytes: 4096,

    /**
     * Proporción mínima de code points imprimibles sobre la ventana de la sonda
     * para aceptar un archivo por el piso de texto (plan §{Qué se acepta}:
     * «proporción razonable», sin número). Decide: la frontera entre indexar y
     * `en_espera` para TODO archivo sin adaptador dedicado. El plan le carga la
     * consecuencia máxima («erosiona la confianza en la memoria, que es el producto
     * entero», §{Qué se acepta}). Se mide: curva ROC sobre un corpus etiquetado
     * binario/texto; se elige el punto que minimiza el falso positivo (basura
     * binaria indexada = costo irreversible) aceptando falsos negativos (texto en
     * `en_espera` = recuperable). Sin valor porque cualquier número cambia el
     * corpus entero.
     */
    minPrintableProportion: null as Pending<number>,

    /**
     * Tope de tamaño de archivo en la puerta, en bytes (plan §{El orden},
     * §{Tramo 1 › Decisiones}: sin valor ni alcance). Decide: qué se rechaza. Con
     * subida prefirmada tiene que aplicarse como política del permiso
     * (content-length-range), no como chequeo de la API, que no toca bytes
     * (§{Tramo 1 › Decisiones}). Se mide: percentil alto de la distribución de
     * tamaños del corpus B2B real, cruzado con el techo de memoria del worker que
     * después lo decodifica.
     */
    maxFileSize: null as Pending<number>,

    /**
     * Reintentos antes de la cola de descarte (plan §{Tramo 1 › Decisiones}: «tras
     * N reintentos»). Decide: cuándo un documento pasa a `fallido` y dispara
     * alerta. Se mide: distribución observada de éxitos por número de intento en
     * producción; N = el intento a partir del cual la probabilidad marginal de
     * éxito cae por debajo del costo del reintento.
     */
    maxRetries: null as Pending<number>,
  },

  // ───────────────────────────── Tramo 3 · Presupuesto ───────────────────────

  budget: {
    /**
     * Techo de tiempo de pared por corrida, en milisegundos (plan §{Diagnóstico}).
     * Decide: nada del contenido, solo cuándo se corta. Es el ÚNICO de los cinco
     * que NO es determinístico, y por eso queda fuera del contrato de pureza: el
     * property test de §{El determinismo} corre con este valor en `null`. Se mide:
     * p99 observado por ruta (decenas de ms declarativo, cientos posicional,
     * segundos perceptual — §{Tramo 3 › Costo}) por un factor de holgura.
     */
    maxMs: null as Pending<number>,

    /**
     * Techo de nodos emitidos por corrida (plan §{Diagnóstico}).
     * Decide: si un `.csv` de un millón de filas termina o se degrada.
     * Se mide: distribución de nodos por documento del corpus real; el techo va
     * por encima del p99 legítimo y por debajo del punto donde el worker se
     * queda sin memoria.
     */
    maxNodes: null as Pending<number>,

    /**
     * Techo de bytes MATERIALIZADOS en memoria por corrida (plan §{Diagnóstico}
     * dice «bytesMáximos» sin decir de qué bytes). Decide: la defensa contra el zip
     * bomb, que es chico al leerse y enorme al descomprimirse. El nombre lleva la
     * semántica a propósito. Se mide: relación observada bytes-de-entrada →
     * bytes-materializados por formato; el techo cubre la tasa de expansión de un
     * OOXML legítimo.
     */
    maxMaterializedBytes: null as Pending<number>,

    /**
     * Techo del costo perceptual: descomposiciones con modelo antes de diferir el
     * resto (plan §{Diagnóstico}, punto abierto P2 — el único que el plan
     * reconoce). Decide: cuántos assets se descomponen ya y cuántos quedan
     * encolados. Se mide: sobre documentos corporativos reales, cuánto tarda en
     * converger la cola de pendientes. Si crece sin drenar, está mal calibrado
     * (§{Observabilidad}).
     */
    maxInvocations: null as Pending<number>,

    /**
     * Techo de expansiones de la recursión de delegación por corrida. NO existe en
     * el plan: es la medida decreciente que le falta a la terminación (auditoría
     * #7). `maxInvocations` no sirve porque «un acierto de caché no descuenta»
     * (§{Diagnóstico}), así que una cadena infinita de assets
     * distintos-pero-cacheados no consume nada. Este contador descuenta SIEMPRE,
     * incluso en acierto de caché, porque lo que acota no es el dinero sino la
     * terminación. Se mide: profundidad y ancho observados de la delegación sobre
     * el corpus (la observabilidad ya declara «profundidad media»,
     * §{Observabilidad}).
     */
    maxExpansions: null as Pending<number>,

    /**
     * Corridas máximas por documento (re-emisiones por delegación tardía, asset
     * re-encolado o adaptador nuevo). Decide: el costo total de un documento
     * hostil, que el presupuesto «por corrida» (§{Tramo 3 › Decisiones}) no acota,
     * y que el «techo por documento» (§{Dónde frena}) acotaría a costa de persistir
     * un saldo entre corridas separadas por horas. Se mide: cuántas re-emisiones
     * necesita un documento sano hasta drenar sus pendientes — el mismo dato que
     * P2.
     */
    maxRunsPerDocument: null as Pending<number>,
  },

  // ───────────────────────────── Tramo 3 · Geometría ─────────────────────────

  geometry: {
    /**
     * Unidades por marco de una `Box`: las coordenadas son enteros en milésimas
     * del ancho/alto del marco.
     * Decide: que `Box` sea comparable entre adaptadores (un PPTX en EMU y una
     * imagen en píxeles caen en la misma escala) Y determinística (enteros, no
     * floats derivados de un modelo de layout, que el property test de
     * byte-identidad de §{El determinismo} no toleraría).
     * Se mide: no se mide. 1000 da resolución sub-píxel en cualquier página real
     * sin acercarse al límite de un entero de 32 bits.
     */
    unitsPerFrame: 1000,

    /**
     * Tolerancia de contención geométrica, en unidades de marco.
     * Decide: la vía `espacial` entera — quién es padre de quién en PPTX y en
     * la salida de un modelo de layout (plan §{1 · Ruta}, auditoría H11).
     * Se mide: distribución de solapamiento parcial en salidas reales del modelo
     * de layout. Provisional 0 = contención estricta, porque el error degrada a
     * «cuelga de la raíz», que es visible, en vez de a «cuelga del vecino
     * equivocado», que es silencioso.
     */
    containmentTolerance: 0,
  },

  // ───────────────────────────── Tramo 4 · Identidad ─────────────────────────

  identity: {
    /**
     * Multiplicidad máxima de un hash para que el pase 1 lo use como ancla (plan
     * §{5 · Reconciliador}: «solo los hashes que aparecen una única vez de cada
     * lado»). Decide: la regla anti-bug-silencioso del reconciliador. NO es tunable
     * — es el invariante del pase 1. Está acá solo porque es un número. Se mide: no
     * se mide. Lo que sí hay que medir es la frecuencia de hashes repetidos en
     * planillas reales (auditoría #64): una columna de estado produce filas enteras
     * repetidas y entonces NINGUNA ancla.
     */
    maxMultiplicityForAnchoring: 1,

    /**
     * Umbral de similitud de los pases 2 y 3, en [0,1]. Decide: qué se considera
     * «el mismo nodo editado» y por tanto qué identidad se conserva — el peor modo
     * de falla del pipeline cuelga de él (§{Por qué la identidad}). Se mide:
     * barrido sobre el corpus, se reporta la curva, el valor por defecto sale de
     * esa medición (§{5 · Reconciliador}, §{Estrategia}). Es el único parámetro que
     * el plan declara explícitamente medido-y-no-elegido, y aun así no figura en
     * P1–P5.
     */
    similarityThreshold: null as Pending<number>,

    /**
     * Tope de comparaciones de los pases 2 y 3, por corrida.
     * Decide: si el reconciliador termina cuando no hay anclas. Medido por el
     * banco: 500 filas sin anclas → un solo hueco → 4× el tiempo (3.8 ms →
     * 15.3 ms); «a 50 000 filas eso no termina» (§{Tramo 4 › Costo}). El plan
     * identifica
     * la necesidad y no la lleva ni a decisión ni a punto abierto.
     * Se mide: curva tiempo vs tamaño de hueco sobre el corpus; el tope es donde
     * el pase deja de caber en el presupuesto de la corrida.
     * Al superarlo el hueco se resuelve como altas + bajas y se emite el evento
     * de anclaje bajo — nunca se trunca en silencio.
     */
    maxComparisons: null as Pending<number>,

    /**
     * Umbral de `anclaje` por debajo del cual se registra el evento de
     * degradación, en [0,1] (plan §{Degradación}).
     * Decide: la única alerta del peor modo de falla del pipeline.
     * Se mide: distribución de anclaje sobre re-ingestas reales; el umbral va
     * por debajo del p1 de las re-ingestas sanas.
     * OJO: el denominador NO está en el plan (auditoría #62) — ver
     * `DENOMINADOR_DE_ANCLAJE` en `salidas.ts`.
     */
    anchoringThreshold: null as Pending<number>,
  },

  // ───────────────────────── Proyección · huella · similitud ─────────────────

  projection: {
    /**
     * Tamaño del n-grama de tokens con el que se calcula la similitud.
     * Decide, según la auditoría H2, «si una planilla pierde 500 identidades o
     * ninguna»: los tokens son ESTRUCTURALES (una celda = un token, un par = un
     * token), así que cambiar una celda de una fila de N mueve 1 token de N y la
     * similitud queda alta. Con grano de palabra sobre una fila serializada,
     * cambiar una celda de un campo corto hunde la similitud.
     * Se mide: barrido conjunto con `similarityThreshold` sobre el corpus; se
     * reportan las dos curvas juntas porque no son independientes.
     */
    nGramSize: 2,

    /** Similitud mínima. Constante de contrato: define el codominio, no se mide. */
    minSimilarity: 0,
    /** Similitud máxima. Constante de contrato: define el codominio, no se mide. */
    maxSimilarity: 1,
  },

  // ───────────────────────────── Tramo 5 · Agrupación ────────────────────────

  grouping: {
    /**
     * Tamaño objetivo de un fragmento, en CARACTERES (code points del texto ya
     * normalizado). Decide: la granularidad de todo el índice — número de
     * fragmentos, sus huellas, la tasa de acierto del caché de embeddings y el
     * número de vectores. La unidad NO puede ser tokens: «este tramo no conoce el
     * modelo de embeddings» (§{Este tramo}) y si las fronteras dependieran de un
     * modelo, actualizarlo invalidaría todos los hashes de fragmento de golpe
     * (§{Por qué la diferencia}). Caracteres es la única unidad estable ante un
     * cambio de embedder. Se mide: evaluación de recuperación sobre corpus real —
     * «cuánto texto es útil como resultado de búsqueda», que el plan declara
     * decisión de producto (§{Este tramo}). El único orden de magnitud que el plan
     * da está en tokens («~300», §{Por qué la miga}) y está en la sección del tramo
     * 6, o sea que ni siquiera es de este tramo.
     */
    targetSizeChars: null as Pending<number>,

    /**
     * Solapamiento entre fragmentos, en caracteres. Fijado en 0 por decisión
     * tomada: `OVERLAP_CHARS` se eliminó porque «las migas lo dan sin duplicar»
     * (§{Los títulos}, §{Lo que se borró}). NO es un pendiente: es una decisión
     * cerrada del plan. Se mide: no se mide. Reintroducirlo revierte una
     * eliminación argumentada.
     */
    fragmentOverlapChars: 0,

    /**
     * Longitud máxima del texto de una miga, en caracteres, antes de truncar.
     * Decide: si el mismo título produce la misma miga entre ingestas. Ese
     * string se concatena al texto antes de embeber Y va al payload para filtrar
     * por sección de forma exacta (§{Las cinco}), así que sin regla el filtro deja de
     * matchear en silencio (auditoría #50).
     * Se mide: distribución de longitud de títulos reales; el truncado cae por
     * encima del p99 para que casi nunca dispare.
     */
    maxBreadcrumbLength: null as Pending<number>,
  },

  // ───────────────────────────── Tramo 6 · Embeddings ────────────────────────

  embeddings: {
    /**
     * Límite del modelo, en tokens. Dato del proveedor, no se mide.
     * Decide: cuándo un fragmento se vectoriza en N ventanas (§{Cómo se rebana}).
     */
    modelLimitTokens: null as Pending<number>,

    /**
     * Solapamiento entre ventanas DENTRO de un fragmento, en tokens.
     * NO hereda el 0 de los fragmentos: el argumento que borró `OVERLAP_CHARS`
     * se apoya en que la miga compensa la frontera ENTRE fragmentos, y dentro de
     * un fragmento no hay miga que compense (auditoría H15).
     * Se mide: recuperación de contenido que cae exactamente sobre una frontera
     * de ventana.
     */
    windowOverlapTokens: null as Pending<number>,

    /**
     * Techo de ventanas por fragmento. Decide: que «nada: el ventaneo se ajusta
     * solo» (§{Este tramo}) deje de ser una afirmación de costo sin techo. Un
     * `.log` de 200 MB por el piso de texto, o un JS minificado como `verbatim`,
     * producen N ilimitado. Al agotarse aplica la misma semántica que el resto del
     * plan: diferir y marcar `parcial`, nunca truncar en silencio. Se mide:
     * distribución de tamaño de nodo del corpus real.
     */
    maxWindowsPerFragment: null as Pending<number>,
  },

  // ───────────────────────────── Tramo 7 · Búsqueda ──────────────────────────

  search: {
    /**
     * Factor de sobre-fetch antes de deduplicar por `FragmentoId`.
     * Decide: que un top-10 no quede en 3 resultados después del dedupe, porque
     * las N ventanas de un mismo fragmento colapsan en uno (§{Cómo se rebana}).
     * Se mide: distribución del número de ventanas por fragmento del corpus; el
     * factor cubre el p99.
     */
    overFetchFactor: null as Pending<number>,
  },
} as const;
