/**
 * EL RECONCILIADOR — tramo 4, paso 11 (§{5 · Reconciliador}).
 *
 * Contesta una sola pregunta: **cuál nodo nuevo es cuál nodo viejo**. De esa
 * respuesta cuelga toda la curación del cliente por R3, y por eso el plan la llama
 * «el invariante más caro de recuperar si se rompe tarde» — un id que se mueve solo
 * despega el trabajo de una persona SIN QUE NADA SE PONGA ROJO. No falla: empeora.
 *
 * ES UNA FUNCIÓN PURA. Todo lo impuro y todo lo que el plan declara medible entra por
 * `ReconcileOptions`: acuñar un `ElementId` es reloj + azar (H13(a)), y el umbral y el
 * tope son `Pending<number>` en `null` (§{Por qué la identidad}). `Pending<number>` no
 * es asignable a `number`, así que pasar el parámetro crudo es error de compilación y
 * «ningún número inventado» deja de depender de que alguien se acuerde.
 *
 * EL PRINCIPIO DE CONSTRUCCIÓN, del que sale la mitad de las garantías: hay **una sola
 * escritura de identidad** (`take`) y **una sola fuente de verdad** (`matches`). Los
 * ids, el remapeo, las bajas y las trece métricas son PROYECCIONES de `matches`. No
 * hay contadores paralelos, así que «las métricas no suman» deja de ser algo que se
 * detecta y pasa a ser algo que no se puede escribir.
 *
 * LOS TRES PASES SON DOS FUNCIONES, y eso también es una garantía. El pase 1 es un
 * hash join (`anchorsOf`). Los pases 2 y 3 son **la misma** `resolveGap`: el pase 3 es
 * el pase 2 sobre un único hueco que es todo el residuo, porque «levantar la
 * restricción de posición» es, exactamente, no cortar. Con eso «el pase 3 conserva
 * mismo rol y misma forma» y «los DOS pases respetan el tope» dejan de ser reglas que
 * dos implementaciones puedan violar por divergencia: no hay dos implementaciones.
 *
 * NI UN LITERAL NUMÉRICO, y no es cosmética: los tres que harían falta —el cero, el
 * uno y el −1 de «no encontrado»— salen de `PARAMETERS.arithmetic`, y la búsqueda
 * binaria divide con `>> ONE` en vez de `/ 2` para no escribir un `2` que ninguna
 * sección del plan sostiene.
 *
 * LO QUE ESTE ARCHIVO NO HACE, y va dicho para que no se lea como olvido. No hashea
 * —`RoutedNode.hash` viene del emisor y `KnownNode.hash` del índice, y que los dos
 * lados sean comparables depende de eso—. No elige contra qué versión reconciliar: ese
 * paso (`hash → documento`, con su filtro por organización) vive un nivel más arriba y
 * acá la versión ya llegó elegida. Y no emite el evento de degradación: es puro,
 * devuelve las métricas y `orchestration` compara contra `anchoringThreshold`.
 */

import {
  PARAMETERS,
  encodeParts,
  project,
  similarityOfProjections,
  type ContentHash,
  type ElementId,
  type EmissionOutput,
  type EmittedNode,
  type KnownNode,
  type LocalId,
  type MintFn,
  type NodeInVersion,
  type Nominal,
  type ReconciliationMetrics,
  type RoutedNode,
  type StableBreadcrumb,
  type Token,
} from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;
const { maxMultiplicityForAnchoring: MAX_MULTIPLICITY } = PARAMETERS.identity;

/** Un elemento con la posición de la que salió. Ver `Placed` en el encabezado de los huecos. */
type Placed<T> = { readonly at: number; readonly it: T };

// ─────────────────────── La memoria de la versión anterior ───────────────────

/**
 * La versión anterior, ORDENADA por `NodeInVersion.order`, donde **el índice ES el
 * orden** (C11: «el orden de la lista vieja no se puede caminar desde nada, porque el
 * árbol viejo ya no existe»).
 *
 * LA MARCA EXISTE PARA QUE «DESORDENADA» SEA IRREPRESENTABLE, no una precondición en
 * un comentario. Un arreglo mal ordenado **no explota**: produce cercos cortos, huecos
 * mal armados y un desempate «menor `order` viejo» que es falso — y el resultado sigue
 * siendo un `EmissionOutput` perfectamente formado. Es el modo de falla
 * catastrófico-y-silencioso que este tipo cierra, y por eso su único constructor es
 * `knownVersionOf`. Ver GLOSARIO.md, P19.
 */
export type KnownVersion = Nominal<readonly KnownNode[], "KnownVersion">;

/**
 * El join `KnownNode × NodeInVersion`, como FUNCIÓN y no como tipo.
 *
 * Toma el `order` por acceso indexado (`Pick`) y no re-declara un solo miembro, así
 * que si `NodeInVersion.order` cambia de tipo esto cambia con él — la re-declaración
 * es lo que el `README.md` de `ir` prohíbe y lo que borró a `OpaqueEntry`.
 *
 * DESEMPATE TOTAL POR `id`, y no es paranoia: un índice corrupto con dos filas del
 * mismo `order` haría que el resultado dependiera de si `sort` es estable, o sea que
 * dos corridas sobre los mismos datos podrían repartir identidades distintas. Con el
 * desempate, un índice corrupto sigue siendo REPRODUCIBLE, que es la diferencia entre
 * un bug que se puede perseguir y uno que no.
 *
 * EL `order` SE CONSUME Y SE DESCARTA. Aguas abajo el índice lo recuerda; llevarlo
 * ADEMÁS del índice del arreglo sería guardar dos veces el mismo hecho, con la
 * posibilidad de que discrepen. Por eso la salida se re-construye campo por campo en
 * vez de pasar las filas tal cual: es lo que impide que `order` viaje de contrabando.
 *
 * La conversión pasa por `unknown` porque la marca de `ir` es una intersección y
 * TypeScript no la considera solapada con un arreglo. Es el único lugar del archivo
 * donde se fuerza un tipo, y está encerrado en el único constructor de la marca.
 */
export const knownVersionOf = (
  rows: readonly (KnownNode & Pick<NodeInVersion, "order">)[],
): KnownVersion =>
  [...rows]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -ONE : a.id > b.id ? ONE : ZERO))
    .map(({ id, hash, role, shape, projection }) => ({
      id,
      hash,
      role,
      shape,
      projection,
    })) as unknown as KnownVersion;

// ─────────────────────────── Pase 1 · anclas y cercos ────────────────────────

/**
 * Un emparejamiento del pase 1, **con sus dos posiciones**: `node` es el índice en la
 * lista nueva, `known` el índice en la `KnownVersion` — que es el `order` viejo.
 *
 * Las dos van juntas porque el problema que el plan no resuelve vive exactamente en
 * que **pueden no crecer juntas**. Ver `fencesOf`.
 */
export type Anchor = {
  readonly node: number;
  readonly known: number;
};

/**
 * Los elementos cuyo hash aparece **exactamente `maxMultiplicityForAnchoring` veces**.
 *
 * EL FILTRO ES EL PARÁMETRO, Y ESO ES LA GARANTÍA. La regla anti-bug-silencioso del
 * plan —«si un hash aparece dos veces no sirve de ancla, porque emparejarlo sería
 * transferirle la identidad al elemento equivocado sin que nada lo detecte»— NO vive
 * en un `if` adentro del bucle de anclaje: vive en **qué contiene la estructura que
 * ese bucle recorre**. Un hash de multiplicidad dos no se rechaza; no se puede
 * consultar, porque no está.
 */
const uniqueOf = <T>(
  items: readonly T[],
  hashOf: (it: T) => ContentHash,
): Map<ContentHash, Placed<T>> => {
  const count = new Map<ContentHash, number>();
  const first = new Map<ContentHash, Placed<T>>();
  for (const [at, it] of items.entries()) {
    const h = hashOf(it);
    count.set(h, (count.get(h) ?? ZERO) + ONE);
    if (!first.has(h)) first.set(h, { at, it });
  }
  const unique = new Map<ContentHash, Placed<T>>();
  for (const [h, placed] of first) {
    if (count.get(h) === MAX_MULTIPLICITY) unique.set(h, placed);
  }
  return unique;
};

/**
 * QUIÉN ANCLA — el pase 1, un hash join que **no mira posición** (§{5 · Reconciliador}:
 * «lo que no cambió, sin importar dónde quedó»). Ni un índice ni un `order` aparecen
 * en el predicado, que es lo que hace que mover un nodo intacto conserve su id.
 *
 * NO SE EXIGE MISMO `role`, Y ES DELIBERADO. `project` excluye `role` a propósito
 * (PROVISIONAL(H6) en `projection.ts`: «si `role` entrara, mejorar un clasificador
 * reclasificaría nodos y les movería el id»). Dos nodos con el mismo cuerpo y distinto
 * rol tienen la MISMA huella; si coexisten en una versión su multiplicidad es dos y
 * ninguno ancla, o sea que la regla de unicidad ya cubre el caso peligroso. Lo que
 * queda permitido es lo que se quiere: un nodo reclasificado **entre versiones** ancla
 * y conserva su id. El cruce de FORMA es imposible — el primer token de la proyección
 * es la forma, así que dos formas distintas nunca comparten huella.
 *
 * `onAnchor` recibe los dos lados YA RESUELTOS, no sus índices: es lo que permite que
 * la única escritura de identidad del archivo no tenga que volver a indexar.
 *
 * Devuelve las anclas **ascendentes por `.node`** por construcción del bucle, que es
 * la precondición de `fencesOf`.
 */
export const anchorsOf = (
  nodes: readonly RoutedNode[],
  previous: KnownVersion,
  onAnchor: (fresh: Placed<RoutedNode>, old: Placed<KnownNode>) => void,
): readonly Anchor[] => {
  const uniqueNew = uniqueOf(nodes, (node) => node.hash);
  const uniqueOld = uniqueOf(previous, (known) => known.hash);
  const out: Anchor[] = [];
  for (const [at, node] of nodes.entries()) {
    const fresh = uniqueNew.get(node.hash);
    if (fresh === undefined || fresh.at !== at) continue;
    const old = uniqueOld.get(node.hash);
    if (old === undefined) continue;
    onAnchor(fresh, old);
    out.push({ node: at, known: old.at });
  }
  return out;
};

/**
 * Un eslabón de la subsecuencia creciente: el ancla y la que la precede.
 *
 * Se encadena con REFERENCIAS y no con índices a propósito. La reconstrucción por
 * índices necesita dos arreglos paralelos y tres accesos indexados por vuelta, y cada
 * uno de esos accesos es un lugar donde un fuera-de-rango se lee como «se terminó la
 * cadena» en vez de como un bug. Con el eslabón, la cadena termina cuando termina.
 */
type Link = {
  readonly anchor: Anchor;
  readonly previous: Link | null;
};

/** Primer largo cuyo eslabón tiene `known >= target`. Estricto: la subsecuencia crece de verdad. */
const lowerBound = (tails: readonly Link[], target: number): number => {
  let lo = ZERO;
  let hi = tails.length;
  while (lo < hi) {
    const mid = (lo + hi) >> ONE;
    const tail = tails[mid];
    if (tail !== undefined && tail.anchor.known < target) lo = mid + ONE;
    else hi = mid;
  }
  return lo;
};

/**
 * QUIÉN PARTE LAS LISTAS — **la decisión que el plan no toma**, y la mitad que hace
 * que no cueste identidad.
 *
 * EL PROBLEMA. El pase 1 no mira posición, así que las anclas PUEDEN CRUZARSE, y el
 * corpus lo hace: la cita de `manual.md` pasa del orden viejo 12 al nuevo 3 y además
 * cambia de padre. Pero el pase 2 dice «las anclas parten AMBAS listas en tramos», y
 * eso solo está definido si son monótonas **en los dos lados**. Partir por el orden
 * viejo deja tramos con inicio mayor que fin —un rango invertido devuelve vacío SIN
 * DECIR NADA, y los nodos de ese tramo desaparecen del pase 2—; clamparlos mete un
 * nodo en dos tramos y lo deja emparejable dos veces. Las dos mitades fallan **en
 * silencio**. Partir por el orden nuevo es simétrico y falla igual del otro lado.
 *
 * LA SALIDA. **Cercos = la subsecuencia estrictamente creciente más larga** sobre
 * `.known`. Y la frase que lo vuelve gratis:
 *
 *     UN ANCLA QUE NO ES CERCO SIGUE EMPAREJADA, y sigue contando en `byHash`.
 *     Lo único que pierde es el derecho a PARTIR LAS LISTAS.
 *
 * Eso es lo que vuelve compatibles las dos frases del plan: «el hash no mira posición»
 * y «las anclas parten ambas listas» son **dos usos distintos de la misma ancla**, y
 * solo el segundo exige orden. `take` ya corrió en el pase 1, antes de que exista el
 * concepto de cerco, así que degradar un ancla a no-cerco no puede quitarle el id —no
 * hay dónde escribirlo.
 *
 * POR QUÉ LA SUBSECUENCIA MÁS LARGA Y NO UN DESCARTE VORAZ. Maximizar los cercos
 * minimiza el hueco más grande, lo que contiene la ambigüedad (§{Residuos aceptados})
 * y baja el consumo del tope (§{Tramo 4 › Costo}). Medido contra el corpus: deja 18 de
 * 19 anclas como cerco y descarta exactamente la cita movida; el voraz de izquierda a
 * derecha acepta la cita primero —viene temprano en la lista nueva, con `known` alto—
 * y después tiene que descartar las once anclas de `known` menor, dejando huecos del
 * doble de tamaño. Quince líneas menos a cambio de una garantía medible.
 *
 * Y ES LA SEGUNDA MITAD DE UN ALGORITMO QUE EL PLAN YA IMPORTÓ A MEDIAS: el pase 1 es
 * el primer paso del *patience diff* palabra por palabra («solo los hashes que
 * aparecen una única vez de cada lado»), y §{Residuos aceptados} invoca a git de
 * frente. Faltaba el segundo paso, que es esto.
 *
 * PROVISIONAL(#91): entre dos subsecuencias máximas del mismo largo, cuál sale la fija
 * el algoritmo y no una regla escrita — paciencia con cota inferior estricta y
 * predecesor capturado al insertar es determinístico para una entrada dada, pero otro
 * algoritmo de la misma complejidad elegiría otra. La salida sigue siendo válida: solo
 * cambia CUÁL ancla se degradó a no-cerco, lo que mueve `bySimilarity` contra
 * `byResidue` sin mover ningún id — Si se decide al revés (una regla de desempate
 * escrita), hay que elegirla y sostenerla en un invariante propio.
 */
export const fencesOf = (anchors: readonly Anchor[]): readonly Anchor[] => {
  const tails: Link[] = [];
  for (const anchor of anchors) {
    const length = lowerBound(tails, anchor.known);
    tails[length] = {
      anchor,
      previous: length === ZERO ? null : tails[length - ONE] ?? null,
    };
  }
  const out: Anchor[] = [];
  let link = tails.length === ZERO ? null : tails[tails.length - ONE] ?? null;
  while (link !== null) {
    out.push(link.anchor);
    link = link.previous;
  }
  return out.reverse();
};

// ──────────────────────── Emparejamientos y superficie ───────────────────────

/**
 * Con qué criterio se emparejó cada nodo. Vocabulario CERRADO y DATO: viaja en
 * `matches` y lo leen los guardianes.
 *
 * Son los tres campos de `ReconciliationMetrics` sin el prefijo —`byHash`,
 * `bySimilarity`, `byResidue`— y NO los tres títulos del plan: el pase 2 empareja POR
 * SIMILITUD, el hueco es DÓNDE y no CÓMO. Tampoco se numeran: el ordinal miente el día
 * que se reordene un pase. Ver GLOSARIO.md, P17.
 */
export const MATCH_BASES = ["hash", "similarity", "residue"] as const;
export type MatchBasis = (typeof MATCH_BASES)[number];

const [BY_HASH, BY_SIMILARITY, BY_RESIDUE] = MATCH_BASES;

/**
 * La ÚNICA fuente de verdad del archivo: los ids, el remapeo, las bajas y las trece
 * métricas se derivan de acá.
 *
 * `local` es el lado nuevo e `id` el viejo — las dos palabras que el contrato ya usa
 * para exactamente esos dos lados (`RoutedNode.local`, `EmittedNode.id`).
 */
export type Match = {
  readonly local: LocalId;
  readonly id: ElementId;
  readonly by: MatchBasis;
};

/**
 * Los tres son violaciones de CONTRATO, no condiciones de datos, y cada alternativa
 * silenciosa es catastrófica:
 *
 * - `duplicate-local-id`: dos nodos nuevos colapsan a una entrada de la tabla de
 *   remapeo y uno se come el id del otro. `emit` ya garantiza locales únicos, pero
 *   esta función no recibe una `Emission` —recibe `readonly RoutedNode[]`— y el
 *   llamador no está obligado a haber usado `emit`.
 * - `duplicate-element-id`: un `mint` roto, o un índice con ids repetidos. Con 128
 *   bits de azar no debería pasar nunca, **y esa es exactamente la razón** por la que
 *   sin detección pasaría desapercibido hasta chocar contra la clave primaria del
 *   tramo 7, una transacción después.
 * - `unknown-local-ref`: un `localParent` o una `breadcrumb.ref` fuera de la tabla.
 */
export type ReconciliationFailure =
  | { readonly kind: "duplicate-local-id"; readonly position: number; readonly local: LocalId }
  | { readonly kind: "duplicate-element-id"; readonly position: number; readonly id: ElementId }
  | { readonly kind: "unknown-local-ref"; readonly position: number; readonly local: LocalId };

/**
 * `{ok:false}` NO es asignable a `{ok:true}`: el llamador no puede leer `output` sin
 * haber mirado `ok`. Mismo precedente que `Emission` y misma razón que I10 — «un padre
 * colgante no es una raíz silenciosa».
 *
 * `matches` viaja AL LADO de `output` y no adentro. `EmissionOutput` es el contrato de
 * `ir` y queda intacto: la atribución por nodo es EVIDENCIA PARA EL GUARDIÁN —sin ella
 * un reconciliador que acierta por casualidad se ve igual que uno que funciona— y no
 * una columna que el tramo 7 tendría que persistir e ignorar.
 */
export type Reconciliation =
  | { readonly ok: true; readonly output: EmissionOutput; readonly matches: readonly Match[] }
  | { readonly ok: false; readonly failure: ReconciliationFailure };

/**
 * Los cinco obligatorios. Olvidar uno es error de compilación, no un `null` mudo.
 *
 * VA COMO OBJETO Y NO POSICIONAL, rompiendo el precedente de `emit(nodes, sha256)` y
 * `group(nodes, target)`, por una razón que esos dos no tienen: hay **dos pares del
 * mismo tipo y adyacentes** —`number, number` y `string | null, string | null`— que
 * transpuestos compilan y mienten en silencio.
 */
export type ReconcileOptions = {
  readonly mint: MintFn;
  /** `PARAMETERS.identity.similarityThreshold`, YA MEDIDO. Sin default: un default es un número inventado. */
  readonly similarityThreshold: number;
  /** `PARAMETERS.identity.maxComparisons`, YA MEDIDO. Gobierna LOS DOS pases de similitud, por corrida. */
  readonly maxComparisons: number;
  /** H16: desambigua «documento reescrito» de «un adaptador cambió». No es derivable acá. */
  readonly previousAdapter: string | null;
  readonly previousVersion: string | null;
};

/**
 * Los dos lados de un tramo entre cercos consecutivos. Ver GLOSARIO.md, P13.
 *
 * Los elementos viajan con su posición (`Placed`) y no como índices sueltos: adentro
 * de un hueco no queda un solo acceso indexado, así que «leí el nodo equivocado» no es
 * un bug que haya que evitar — es uno que no se puede escribir.
 */
type Gap = {
  readonly fresh: readonly Placed<RoutedNode>[];
  readonly old: readonly Placed<KnownNode>[];
};

/**
 * Parte una lista en `boundaries.length + 1` tramos, salteando los bordes y lo que ya
 * quedó emparejado.
 *
 * LOS DOS LADOS USAN ESTA MISMA FUNCIÓN, y eso es lo que vuelve estructural que el
 * hueco `g` del lado nuevo y el `g` del viejo salgan del MISMO par de cercos
 * consecutivos: un hueco cuyos dos lados vengan de anclas distintas no es detectable,
 * es inescribible.
 *
 * CONSERVACIÓN POR CONSTRUCCIÓN: cada elemento suelto entra en EXACTAMENTE un tramo,
 * porque el recorrido lo visita una vez y el borde NO RETROCEDE. Vale aunque los
 * cercos fueran no monótonos — o sea que un bug en `fencesOf` degrada la CALIDAD del
 * emparejamiento (y se ve en `byResidue`, que es justo lo que el plan dice que sube
 * «si algo reordena mucho») pero NO PUEDE hacer desaparecer ni duplicar un elemento.
 * Es lo que separa «los huecos quedaron mal» de «se perdieron nodos».
 */
const splitAround = <T>(
  items: readonly T[],
  boundaries: readonly number[],
  keep: (at: number) => boolean,
): readonly (readonly Placed<T>[])[] => {
  const out: Placed<T>[][] = [[]];
  let edge = ZERO;
  for (const [at, it] of items.entries()) {
    if (boundaries[edge] === at) {
      edge += ONE;
      out.push([]);
      continue;
    }
    if (!keep(at)) continue;
    const current = out[out.length - ONE];
    if (current !== undefined) current.push({ at, it });
  }
  while (out.length < boundaries.length + ONE) out.push([]);
  return out;
};

// ───────────────────────────────── El reconciliador ──────────────────────────

export const reconcile = (
  nodes: readonly RoutedNode[],
  previous: KnownVersion,
  options: ReconcileOptions,
): Reconciliation => {
  const n = nodes.length;
  const m = previous.length;

  // ── La tabla local y su guarda ─────────────────────────────────────────────
  // VA PRIMERO porque el remapeo entero cuelga de este mapa: con dos nodos
  // compartiendo `local`, uno se come el id del otro EN SILENCIO y `parentId` apunta
  // al equivocado.
  const locals = new Map<LocalId, number>();
  for (const [at, node] of nodes.entries()) {
    if (locals.has(node.local)) {
      return { ok: false, failure: { kind: "duplicate-local-id", position: at, local: node.local } };
    }
    locals.set(node.local, at);
  }

  const assigned = new Array<ElementId | null>(n).fill(null);
  const taken = new Array<boolean>(m).fill(false);
  const matches: Match[] = [];

  /** La ÚNICA escritura de identidad del archivo. */
  const take = (fresh: Placed<RoutedNode>, old: Placed<KnownNode>, by: MatchBasis): void => {
    if (assigned[fresh.at] !== null || taken[old.at]) return;
    assigned[fresh.at] = old.it.id;
    taken[old.at] = true;
    matches.push({ local: fresh.it.local, id: old.it.id, by });
  };

  let spent = ZERO;
  let uncompared = ZERO;

  // Se cuenta SIEMPRE, también en la primera ingesta: es la única señal del colapso de
  // identidad que suena cuando todavía no hay versión anterior contra la cual el
  // anclaje pueda caer.
  const ambiguous = n - uniqueOf(nodes, (node) => node.hash).size;

  if (m > ZERO) {
    // ── Pase 1 · anclas ──────────────────────────────────────────────────────
    const anchors = anchorsOf(nodes, previous, (fresh, old) => take(fresh, old, BY_HASH));

    // ── Cercos y huecos ──────────────────────────────────────────────────────
    const fences = fencesOf(anchors);
    const freshSides = splitAround(
      nodes,
      fences.map((fence) => fence.node),
      (at) => assigned[at] === null,
    );
    const oldSides = splitAround(
      previous,
      fences.map((fence) => fence.known),
      (at) => taken[at] === false,
    );
    const gaps: Gap[] = freshSides.map((fresh, g) => ({ fresh, old: oldSides[g] ?? [] }));

    // ── La única máquina de similitud ────────────────────────────────────────
    const projections = new Map<number, readonly Token[]>();
    const projectionOf = (fresh: Placed<RoutedNode>): readonly Token[] => {
      const memo = projections.get(fresh.at);
      if (memo !== undefined) return memo;
      const made = project(fresh.it.body);
      projections.set(fresh.at, made);
      return made;
    };

    const resolveGap = (gap: Gap, basis: MatchBasis): boolean => {
      // 1 · CUBETAS. No es una optimización: es la guarda «mismo tipo y misma forma»
      //     escrita como DOMINIO en vez de como condición. Un par de roles distintos
      //     no se rechaza — NO SE ENUMERA. Y resuelve en un solo sitio la asimetría
      //     entre los dos tipos: la forma del lado nuevo vive en `body.shape` y la del
      //     viejo en `shape`. La clave se arma con `encodeParts`, que prefija cada
      //     parte con su largo, así que no hay separador que se pueda falsificar.
      const buckets = new Map<string, { fresh: Placed<RoutedNode>[]; old: Placed<KnownNode>[] }>();
      const bucket = (key: string) => {
        const found = buckets.get(key);
        if (found !== undefined) return found;
        const made = { fresh: [] as Placed<RoutedNode>[], old: [] as Placed<KnownNode>[] };
        buckets.set(key, made);
        return made;
      };
      for (const fresh of gap.fresh) {
        bucket(encodeParts(fresh.it.role, fresh.it.body.shape)).fresh.push(fresh);
      }
      for (const old of gap.old) {
        bucket(encodeParts(old.it.role, old.it.shape)).old.push(old);
      }

      // 2 · COSTO EXACTO, no estimado: la cantidad de llamadas a
      //     `similarityOfProjections` que este hueco haría, ni una más ni una menos,
      //     calculada sin comparar nada.
      let cost = ZERO;
      for (const b of buckets.values()) cost += b.fresh.length * b.old.length;

      // 3 · TODO O NADA. Un hueco a medias ES truncar en silencio: los primeros pares
      //     emparejan y los últimos no, sin ninguna diferencia observable entre «no
      //     había par» y «se acabó el presupuesto». Abandonado, los DOS lados siguen
      //     sueltos y salen como altas + bajas por el mismo camino que todo lo demás,
      //     así que «truncar» no es un estado alcanzable — y `uncompared` lo cuenta.
      if (spent + cost > options.maxComparisons) {
        uncompared += gap.old.length;
        return false;
      }

      // 4 · PUNTUAR. Único sitio que llama a `similarityOfProjections` y único que
      //     incrementa `spent`. `>=` y no `>`: la función GARANTIZA que dos cuerpos
      //     con la misma huella dan el máximo, y con `>` un umbral de uno los
      //     rechazaría.
      const pairs: { fresh: Placed<RoutedNode>; old: Placed<KnownNode>; score: number }[] = [];
      for (const b of buckets.values()) {
        for (const fresh of b.fresh) {
          for (const old of b.old) {
            spent += ONE;
            const score = similarityOfProjections(projectionOf(fresh), old.it.projection);
            if (score >= options.similarityThreshold) pairs.push({ fresh, old, score });
          }
        }
      }

      // 5 · VORAZ POR SIMILITUD DESCENDENTE, CON ORDEN TOTAL. Las tres claves hacen
      //     falta. La segunda es lo único que vuelve VERDADERA la frase del plan «se
      //     emparejan EN ORDEN dentro de su hueco» (§{Residuos aceptados}): con
      //     cincuenta párrafos idénticos todas las similitudes valen lo mismo y el
      //     orden de lectura SOLO emerge del desempate. La tercera lo vuelve total: no
      //     depende de que `sort` sea estable.
      pairs.sort(
        (a, b) => b.score - a.score || a.old.at - b.old.at || a.fresh.at - b.fresh.at,
      );
      for (const pair of pairs) take(pair.fresh, pair.old, basis);
      return true;
    };

    // ── Pase 2 · los huecos, en ORDEN DE LECTURA ─────────────────────────────
    // PROVISIONAL(#92): el presupuesto se gasta en orden de lectura, así que un hueco
    // grande temprano puede dejar sin comparación a huecos chicos tardíos que habrían
    // costado poco. Es determinístico y VISIBLE (`uncompared`), y con el chequeo de
    // costo ANTES de entrar un hueco gigante no se come el presupuesto de los demás:
    // se abandona entero y los que siguen se resuelven igual — Si se decide al revés
    // (ordenar los huecos por costo creciente), cambia el orden de emparejamiento y
    // con él el golden del caso de los duplicados, y el plan no lo sostiene.
    const resolved = gaps.map((gap) => resolveGap(gap, BY_SIMILARITY));

    // ── Pase 3 · el residuo, la MISMA función sobre un solo hueco ────────────
    // Los elementos de un hueco ABANDONADO no entran: si entraran, el presupuesto no
    // sería un presupuesto — el hueco se re-intentaría entero, ahora global.
    const residue: { fresh: Placed<RoutedNode>[]; old: Placed<KnownNode>[] } = { fresh: [], old: [] };
    for (const [g, gap] of gaps.entries()) {
      if (resolved[g] !== true) continue;
      for (const fresh of gap.fresh) if (assigned[fresh.at] === null) residue.fresh.push(fresh);
      for (const old of gap.old) if (taken[old.at] === false) residue.old.push(old);
    }
    resolveGap(residue, BY_RESIDUE);
  }

  // ── Armado y remapeo ───────────────────────────────────────────────────────
  const ids = new Map<LocalId, ElementId>();
  const seen = new Set<ElementId>();
  for (const [at, node] of nodes.entries()) {
    const id = assigned[at] ?? options.mint();
    if (seen.has(id)) {
      return { ok: false, failure: { kind: "duplicate-element-id", position: at, id } };
    }
    seen.add(id);
    ids.set(node.local, id);
  }

  const emitted: EmittedNode[] = [];
  for (const [at, node] of nodes.entries()) {
    // `local` y `localParent` SE DESTRUCTURAN AFUERA, porque valen SOLO dentro de una
    // corrida del emisor: persistidos junto al `ElementId` dejan dos identidades por
    // nodo, y la provisional es la que se ve primero.
    //
    // Y ESTO NO NECESITA GUARDIÁN — se midió. El paso 11 le escribió el mutante que lo
    // acreditara y las dos ediciones que producen la fuga las rechaza el COMPILADOR:
    // agregar la clave a mano da `TS2353` (un literal sí tiene chequeo de propiedades
    // de más contra `EmittedNode`) y cambiar `...rest` por `...node` deja `rest` sin
    // usar y da `TS6133`. La guarda de runtime que se había escrito en `orchestration`
    // se borró por eso: era un peldaño más bajo de la escalera para una violación que
    // ya es irrepresentable acá arriba.
    const { local, localParent, breadcrumbs, ...rest } = node;
    const id = ids.get(local);
    if (id === undefined) {
      return { ok: false, failure: { kind: "unknown-local-ref", position: at, local } };
    }
    // PROHIBIDO `?? null`: haría indistinguible «referencia rota» de «cuelga de la
    // raíz», que es literalmente lo que I10 declara inaceptable en este paquete.
    let parentId: ElementId | null = null;
    if (localParent !== null) {
      const found = ids.get(localParent);
      if (found === undefined) {
        return { ok: false, failure: { kind: "unknown-local-ref", position: at, local: localParent } };
      }
      parentId = found;
    }
    const stable: StableBreadcrumb[] = [];
    for (const crumb of breadcrumbs) {
      // La miga se remapea por su REFERENCIA, no por su texto: es el punto entero de
      // C15 — el texto de un título es mutable por diseño.
      const ref = ids.get(crumb.ref);
      if (ref === undefined) {
        return { ok: false, failure: { kind: "unknown-local-ref", position: at, local: crumb.ref } };
      }
      stable.push({ ref, text: crumb.text });
    }
    // Es un recorrido que EMITE UNO POR CADA ENTRADA, nunca un filtro: «ninguna
    // información se descarta en silencio» no es un test, es la forma de la expresión.
    emitted.push({ ...rest, id, parentId, breadcrumbs: stable });
  }

  const removals: ElementId[] = [];
  for (const [at, known] of previous.entries()) {
    if (taken[at] === false) removals.push(known.id);
  }

  // ── Métricas · TODAS derivadas de `matches` ────────────────────────────────
  // De esta derivación sale gratis, sin ninguna aserción de runtime:
  //     byHash + bySimilarity + byResidue + additions === newNodes
  //     byHash + bySimilarity + byResidue + removals  === oldNodes
  const countOf = (basis: MatchBasis) => matches.filter((match) => match.by === basis).length;
  const byHash = countOf(BY_HASH);
  const metrics: ReconciliationMetrics = {
    // Dividir por cero da NaN, y `NaN < umbral` es `false`: sin esta rama la única
    // alerta del peor modo de falla queda MUDA justo donde no hay nada que preservar.
    // Se elige la verdad vacua —de los cero nodos viejos se preservaron los cero— y no
    // cero, porque con cero TODA primera ingesta dispara la alerta, y una alerta que
    // suena siempre se ignora. `oldNodes` viaja crudo para que el llamador distinga.
    anchoring: m === ZERO ? ONE : byHash / m,
    byHash,
    bySimilarity: countOf(BY_SIMILARITY),
    byResidue: countOf(BY_RESIDUE),
    additions: n - matches.length,
    removals: removals.length,
    oldNodes: m,
    newNodes: n,
    previousAdapter: options.previousAdapter,
    previousVersion: options.previousVersion,
    comparisons: spent,
    uncompared,
    ambiguous,
  };

  return { ok: true, output: { nodes: emitted, removals, metrics }, matches };
};
