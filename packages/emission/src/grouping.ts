/**
 * Tramo 5 — «Agrupación»: UN recorrido, DOS salidas (§{Las dos salidas}).
 *
 *     para cada nodo:
 *         según su cohesión:
 *             lead       → cierra el fragmento en curso; entra a las migas
 *             satellite  → se pega al fragmento vivo, nunca queda solo
 *             solo       → fragmento propio, sin mezclarse con vecinos
 *             normal     → si entra en el objetivo, se suma; si no, cierra y abre otro
 *         si es una fila de planilla → emite además un registro
 *
 * VIVE EN `emission` Y NO EN UN PAQUETE PROPIO, y no es comodidad: comparte el
 * recorrido con el emisor —«no hay ninguna rama que corte» (§{El recorrido})— y
 * consume `cohesionOf`, que es el otro consumidor declarado de la misma tabla de
 * `ir`. Partirlo en dos paquetes obligaría a que la agrupación viera `role` para
 * decidir, que es exactamente lo que R2 prohíbe fuera de `ir`.
 *
 * Y ES LA SEGUNDA PRUEBA DE QUE EL BORDE R1 ES REAL. El paso 2 probó que el EMISOR
 * no necesita un adaptador para escribirse; este archivo lo extiende a la
 * agrupación: importa `@savia-os/ir` y NADA MÁS, se alimenta de los nodos sintéticos
 * de `synthetic.ts` y de nodos-fila escritos a mano, y los doce adaptadores siguen
 * sin existir. Si hubiera hecho falta uno solo, el borde no sería real.
 *
 * CORRE DESPUÉS DEL RECONCILIADOR, y desde el paso 12 el tipo lo dice: consume
 * `EmittedNode` y no `EmittedNode`. El plan lo declara al abrir el tramo —«Entra: la
 * lista plana del tramo 4, CON IDENTIDAD y migas» (§{Las dos salidas})— y hasta este
 * paso el código hacía lo contrario, no por decisión sino porque el reconciliador no
 * existía todavía: `group` corría antes porque no había nada después.
 *
 * LO QUE ESTE TRAMO SIGUE SIN HACER, y no por olvido: no acuña identidad PROPIA ni
 * calcula huellas. Su salida es `StableFragment` y `StableDataRecord` —las referencias
 * a los nodos ya son definitivas, que es lo que `Stable*` significa en las tres
 * familias— y NO `IdentifiedFragment`: ese lleva además `id` y
 * `contextualFingerprint`, y acá no hay con qué. El `FragmentId` se deriva de
 * `(DocumentId, contextualFingerprint)` y el `DocumentId` vive en `Ingestion`, un
 * tramo más arriba; la huella depende de una normalización que el contrato declara
 * abierta. Ver GLOSARIO.md P23/P24 y PROVISIONAL(#75) en `ir/src/outputs.ts`.
 */

import {
  PARAMETERS,
  acceptsSatellite,
  cohesionOf,
  fieldKey,
  isRowNode,
  rank,
  render,
  type Cohesion,
  type FieldValue,
  type StableBreadcrumb,
  type StableDataRecord,
  type StableFragment,
  type ElementId,
  type RecognitionLevel,
  type EmittedNode,
} from "@savia-os/ir";

const { zero: ZERO } = PARAMETERS.arithmetic;

/** Las dos salidas del recorrido. Salen juntas o el split π/σ es media promesa. */
export type Grouping = {
  readonly fragments: readonly StableFragment[];
  readonly records: readonly StableDataRecord[];
};

// ─────────────────────────────── El acumulador ───────────────────────────────

/**
 * El fragmento VIVO. Mutable a propósito, igual que `State` en `route.ts`: el tramo
 * declara un solo recorrido y copiar el acumulador por nodo es el costo que
 * «microsegundos por nodo» (§{Tramo 5 › Costo}) no admite.
 *
 * `order` NO se almacena en el fragmento: es andamio del recorrido. Los fragmentos
 * de los títulos huérfanos se emiten al final (ver abajo) y hay que reponerles el
 * orden de lectura; después el campo se cae, porque un consumidor que lo leyera
 * estaría almacenando algo derivable de `nodes` — lo mismo que §{2 · Emisor} prohíbe
 * con `depth`, `siblingIndex` y `ordinal`.
 */
type Open = {
  readonly order: number;
  readonly parts: string[];
  readonly breadcrumbs: readonly StableBreadcrumb[];
  readonly nodes: ElementId[];
  readonly cohesion: Cohesion;
  readonly levels: RecognitionLevel[];
  readonly confidences: (number | null)[];
};

/**
 * El PEOR nivel, por `rank()`. TOTAL, sin caso de error: el vacío no existe porque
 * un fragmento siempre tiene al menos un nodo.
 *
 * NO se guarda la certeza: se deriva con `certaintyOfLevel(minLevel)`. Ver el #74 de
 * `Fragment` en `ir/src/outputs.ts` — guardar las dos las deja discrepar. Y «el
 * peor» es el MÁXIMO del rank aunque el campo se llame `min`: es la trampa que el
 * #74 documenta haber desarmado al pasar de `Certainty` a `RecognitionLevel`.
 */
const worstLevel = (ls: readonly RecognitionLevel[]): RecognitionLevel =>
  ls.reduce((worst, l) => (rank(l) > rank(worst) ? l : worst), "declarative");

/**
 * `null` de afuera = NINGÚN nodo reportó confianza, o sea el fragmento enteramente
 * declarativo, que es el MÁS confiable. Nunca «cero». Ver el #74 de `Fragment`.
 */
const confidenceOf = (cs: readonly (number | null)[]): StableFragment["confidence"] => {
  const reported = cs.filter((c): c is number => c !== null);
  const first = reported[ZERO];
  if (first === undefined) return null;
  return {
    min: reported.reduce((m, c) => (c < m ? c : m), first),
    hasNull: reported.length !== cs.length,
  };
};

const sealOf = (o: Open): StableFragment & { readonly order: number } => ({
  order: o.order,
  // Las migas NO se concatenan acá: el tramo 6 las concatena al embeber
  // (§{Las dos salidas}). Meterlas en `text` duplicaría el título — y además
  // rompería la regla que cierra C2 en `ir`: la clave de un caché es la ENTRADA de
  // la función que cachea, y si la miga ya viniera adentro se concatenaría dos veces.
  text: o.parts.join("\n"),
  breadcrumbs: o.breadcrumbs,
  nodes: o.nodes,
  minLevel: worstLevel(o.levels),
  confidence: confidenceOf(o.confidences),
});

// ─────────────────────────────── Los registros ───────────────────────────────

/**
 * La mitad σ del split π/σ. Solo la produce un nodo-FILA (§{Las filas}).
 *
 * El esquema viene del CONTAINER, no de la fila: «si cada fila cargara sus
 * etiquetas, renombrar una columna cambiaría el hash de las 50 000» (§{Las filas}).
 * Y las claves salen de `fieldKey`, que vive en `ir` porque es la única forma de que
 * dos consumidores no inventen dos `DataRecord` distintos de la misma planilla.
 */
const recordOf = (
  n: EmittedNode,
  schema: readonly string[] | null,
): StableDataRecord | null => {
  if (n.body.shape !== "grid") return null;
  if (n.location.coordinate.space !== "grid") return null;
  const row = n.body.rows[ZERO];
  if (row === undefined) return null;
  const used = new Set<string>();
  const values: FieldValue[] = [];
  for (const [i, cell] of row.entries()) {
    const key = fieldKey(schema?.[i] ?? null, i, used);
    used.add(key);
    values.push({ label: key, value: cell.text });
  }
  return { coordinate: n.location.coordinate, values, node: n.id };
};

// ─────────────────────────────── El recorrido ────────────────────────────────

/**
 * `targetSizeChars` viene POR PARÁMETRO y no de `PARAMETERS.grouping.targetSizeChars`,
 * que es `Pending<number>` y hoy vale `null`: el tipo obliga a que quien lo necesite
 * lo provea. Es la misma disciplina con la que `sha256` entra por parámetro al
 * emisor, y por la misma razón — el único orden de magnitud que el plan da está
 * dado en TOKENS y en la sección del tramo 6, así que escribirlo acá sería meter un
 * número inventado por la ventana.
 */
export const group = (
  nodes: readonly EmittedNode[],
  targetSizeChars: number,
): Grouping => {
  const sealed: (StableFragment & { readonly order: number })[] = [];
  const records: StableDataRecord[] = [];
  /** El esquema de cada container ya emitido, para las filas que cuelgan de él. */
  const schemaOf = new Map<ElementId, readonly string[] | null>();

  const started = (i: number, n: EmittedNode, text: string, cohesion: Cohesion): Open => ({
    order: i,
    parts: text === "" ? [] : [text],
    breadcrumbs: n.breadcrumbs,
    nodes: [n.id],
    cohesion,
    levels: [n.level],
    confidences: [n.confidence],
  });

  const add = (o: Open, n: EmittedNode, text: string): Open => {
    if (text !== "") o.parts.push(text);
    o.nodes.push(n.id);
    o.levels.push(n.level);
    o.confidences.push(n.confidence);
    return o;
  };

  const sizeOf = (o: Open): number => o.parts.reduce<number>((t, p) => t + p.length, ZERO);

  // NO se usan closures para MUTAR `open`: TypeScript ignora las asignaciones hechas
  // dentro de una función anidada al estrechar, así que `open` se quedaría estrechado
  // a `null` para todo el recorrido y `open.cohesion` sería `never`. `reopen` solo lo
  // LEE y devuelve el nuevo acumulador; la asignación se queda en el sitio de
  // llamada, que es lo que el compilador acepta sin un solo `as`.
  let open: Open | null = null;

  /**
   * Sella el fragmento en curso y abre uno nuevo. ES EL ÚNICO SITIO DEL RECORRIDO
   * QUE ABRE, y esa unicidad es el arreglo de un BUG REAL.
   *
   * El bug: la rama `else` de `satellite` abría un fragmento propio SIN sellar el
   * anterior, así que el fragmento en curso se perdía entero. Lo destapó un mutante
   * que forzaba la rama, no un invariante — porque la rama es INALCANZABLE
   * (`acceptsSatellite` solo rechaza `lead`, y un `lead` nunca deja fragmento
   * abierto), y una rama inalcanzable no la mira nadie.
   *
   * Arreglarlo en el sitio dejaba TRES copias del par sellar-y-abrir, dos
   * alcanzables y una no, y la que no lo es volvería a poder desincronizarse en
   * silencio. Con una sola función, «abrir sin sellar» deja de ser un descuido
   * posible: `started` no se llama desde el recorrido. Es la diferencia entre
   * arreglar el bug y volverlo inescribible.
   */
  const reopen = (i: number, n: EmittedNode, text: string, cohesion: Cohesion): Open => {
    if (open !== null) sealed.push(sealOf(open));
    return started(i, n, text, cohesion);
  };

  for (const [i, n] of nodes.entries()) {
    if (n.body.shape === "container") schemaOf.set(n.id, n.body.schema);
    const schema = n.parentId === null ? null : schemaOf.get(n.parentId) ?? null;

    // PROVISIONAL(#53): `render` devuelve `null` para `asset` y `container`. El nodo
    // entra igual, con texto vacío — «un nodo entra entero en algún fragmento,
    // SIEMPRE» (§{El recorrido}). Omitirlo haría falso ese invariante, y el `null`
    // existe justamente para OBLIGAR a decidirlo acá en vez de embeber cadena vacía
    // por accidente.
    const text = render(n.body, schema) ?? "";

    if (isRowNode(n.body)) {
      const record = recordOf(n, schema);
      if (record !== null) records.push(record);
    }

    const cohesion = cohesionOf(n.role, n.body.shape);
    switch (cohesion) {
      case "lead":
        // «Un `lead` NO arranca un fragmento con su texto: cierra el anterior y
        // entra a las migas» (§{Los títulos}). Su texto no entra en ningún cuerpo.
        if (open !== null) sealed.push(sealOf(open));
        open = null;
        break;
      case "satellite":
        // «Nunca queda solo». `acceptsSatellite` es de `ir`: un satélite SÍ se pega
        // a un fragmento cuyo único nodo es `solo` (PROVISIONAL(C16)).
        // PROVISIONAL(#52) de `ir`: un satélite SIN fragmento vivo abre uno propio.
        //
        // LA MITAD «NO SE ACEPTA» ES HOY INALCANZABLE, y va dicho en vez de
        // insinuado: `acceptsSatellite` solo rechaza `lead`, y un `lead` nunca deja
        // fragmento abierto. Se llama igual —la regla vive en `ir` y consultarla es
        // lo que impide que este paquete la re-derive, que es R2— y el control
        // `MC12` de `scripts/mutants.mjs` fija que hoy no decide nada, para que la
        // rama no se lea como verificada.
        open =
          open !== null && acceptsSatellite(open.cohesion)
            ? add(open, n, text)
            : reopen(i, n, text, cohesion);
        break;
      case "solo":
        // «Fragmento propio, sin mezclarse con vecinos»: el vector turbio.
        open = reopen(i, n, text, cohesion);
        break;
      case "normal":
        // Las tres condiciones son una sola pregunta —«¿cabe en el que está
        // abierto?»— y las tres se rompen por separado: que exista, que no sea
        // `solo`, y que entre en el objetivo.
        open =
          open !== null &&
          open.cohesion !== "solo" &&
          sizeOf(open) + text.length <= targetSizeChars
            ? add(open, n, text)
            : reopen(i, n, text, cohesion);
        break;
    }
  }
  if (open !== null) sealed.push(sealOf(open));

  // «Un título que no llegó a contextualizar nada NO PUEDE EVAPORARSE: emite su
  // propio fragmento» (§{Los títulos}). Se decide por DERIVACIÓN y no por una
  // bandera durante el recorrido: es un `lead` cuya referencia no aparece en las
  // migas de ningún fragmento emitido. Así el caso «un `##` final sin contenido»
  // sale solo, y «un nodo entra entero en algún fragmento, siempre» queda verdadero
  // en su forma corregida — ver el invariante de cobertura en `scripts/invariants.mjs`.
  const referenced = new Set(sealed.flatMap((f) => f.breadcrumbs.map((b) => b.ref)));
  for (const [i, n] of nodes.entries()) {
    if (cohesionOf(n.role, n.body.shape) !== "lead") continue;
    if (referenced.has(n.id)) continue;
    sealed.push(
      sealOf({
        order: i,
        parts: [render(n.body, null) ?? ""],
        breadcrumbs: n.breadcrumbs,
        nodes: [n.id],
        cohesion: "lead",
        levels: [n.level],
        confidences: [n.confidence],
      }),
    );
  }

  const ordered = [...sealed].sort((a, b) => a.order - b.order);
  return {
    fragments: ordered.map(({ order: _order, ...f }) => f),
    records,
  };
};
