/**
 * La ORQUESTACIÓN MÍNIMA del paso 3: `ingest(bytes) → Run`.
 *
 * Sin HTTP, sin base, sin cola. Es la espina dorsal entera —tramos 2, 3, 4 y 5— y
 * nada más:
 *
 *     bytes → sonda → select → recognize → emit → group
 *
 * ESTE PAQUETE ES EL ÚNICO QUE VE A LOS OTROS TRES. `adapters` y `emission` no se
 * conocen (§{Paquetes}), y eso no lo sostiene la disciplina: lo impone el grafo de
 * paquetes, y `scripts/boundaries.mjs` lo NOMBRA. La forma de la función es la prueba:
 * los dos únicos tipos que cruzan de un lado al otro —`Node` y `Hint`— son de `ir`.
 *
 * DESDE EL PASO 4 LA ESPINA TIENE SUS TRES SALIDAS, y no dos:
 *
 *   · hay un adaptador dedicado          → se indexa, `achievedLevel:'structured'`
 *   · no hay, pero el contenido es TEXTO → lo toma el piso, `'plain_text'`
 *   · no hay y no es texto               → NO se indexa: `adapter:null` + `onHold`
 *
 * La tercera no es una falla y no es un rechazo. Guardar es INCONDICIONAL —eso es lo
 * que «nunca se pierde un archivo» quiere decir— y lo único que el umbral de
 * imprimibles decide es la INDEXACIÓN. Ver `Run.onHold`.
 *
 * LO QUE NO HACE, y no por olvido:
 *
 *   · DELEGAR. `ctx.materialize` existe y RECHAZA. Un `.md` referencia sus imágenes
 *     por URL y nunca trae bytes incrustados, así que la delegación no es ejercitable
 *     con este formato: es el paso 6 del orden de construcción. Que la profundidad
 *     máxima de este paso sea CERO no es una omisión, es un hecho verificable, y el
 *     guardián lo verifica en vez de dejarlo escrito.
 *   · RECONCILIAR. `ElementId` sale del paso 11, así que la salida lleva `LocalId`:
 *     `RoutedNode`, `LocalFragment` y `LocalDataRecord`.
 *   · RAMIFICAR SOBRE `role`. Es R2, y acá no está impuesta por el tipo: `n.role` es
 *     legible. La impone `scripts/boundaries.mjs`, que es el guardián que el paso 3
 *     debía traer y que hasta hoy no existía en ningún paquete.
 */

import { group, emit } from "@savia-os/emission";
import {
  coldProbeOf,
  coldProbeOfAsset,
  probeOf,
  recognizeMessage,
  select,
  sourceOfAsset,
  sourceOfBytes,
  type Registry,
} from "@savia-os/adapters";
import {
  PARAMETERS,
  asActorId,
  asDelegationId,
  asInstant,
  asMatterHash,
  asNode,
  windowCovers,
  windowKey,
  type AchievedLevel,
  type AdapterId,
  type BodyOf,
  type Budget,
  type CancellationSignal,
  type Channel,
  type ChannelAdapter,
  type ColdProbe,
  type Context,
  type DelegationId,
  type Degradation,
  type HashFn,
  type LocalDataRecord,
  type LocalFragment,
  type MatterHash,
  type Node,
  type Notice,
  type ObjectKey,
  type ObjectRef,
  type PerceiveFn,
  type RawNode,
  type Source,
  type RoutedNode,
  type SpendKind,
} from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

// ─────────────────────────────── El sumidero ─────────────────────────────────

/**
 * Lo que `Diagnostics` ACUMULA, que el plan nunca tipa y de lo que dependen el estado
 * `partial`, la métrica de degradación y el invariante «ninguna información se descarta
 * en silencio» (§{Invariantes}).
 *
 * Los dos métodos de `Diagnostics` devuelven `void`: lo único que los vuelve
 * verificables es que su destino esté tipado y snapshotado. Sin este tipo, «nada se
 * descarta en silencio» es una frase sin observador.
 */
export type Sink = {
  readonly notices: readonly Notice[];
  readonly degradations: readonly Degradation[];
};

/**
 * Lo que produjo UNA corrida de la espina dorsal.
 *
 * LLEVA EL ÁRBOL Y NO SOLO LAS DOS SALIDAS, y esa es una corrección al primer intento:
 * el plan pide «golden files bytes → ÁRBOL» (§{Estrategia}) y un snapshot de fragmentos
 * NO lo cubre. `mime`, `language`, `marks`, `href` y `attribution` no se renderizan, así
 * que no aparecen en `Fragment.text` y una mutación sobre cualquiera de ellos pasaría en
 * verde contra un golden de solo fragmentos. Y el árbol no es un extra del guardián:
 * es lo que el reconciliador del paso 11 consume.
 */
export type Run = {
  readonly nodes: readonly RoutedNode[];
  readonly fragments: readonly LocalFragment[];
  readonly records: readonly LocalDataRecord[];
  readonly sink: Sink;
  readonly achievedLevel: AchievedLevel;
  readonly adapter: AdapterId | null;
  /**
   * LO QUE QUEDÓ EN ESPERA, con lo que hace falta para reintentarlo. `null` = alguien
   * lo leyó.
   *
   * `on_hold` NO ES «rechazado»: es «todavía no lo soportamos». Los bytes se guardan
   * SIEMPRE —eso es lo que «nunca se pierde un archivo» quiere decir— y lo único que no
   * ocurre es la indexación. El día que llegue el adaptador del formato, lo que está en
   * espera se procesa; sin este campo, ese día es un barrido del corpus entero.
   *
   * ES LA `ColdProbe` Y NO UN TIPO NUEVO: son exactamente «los cinco datos escalares que
   * se persisten en `documento_en_espera`» (§{Lo que queda}), y el barrido que el plan
   * describe corre «solo su `evidencia()` contra las sondas guardadas». Inventar un tipo
   * paralelo con los mismos cinco campos sería la re-declaración que el README de `ir`
   * prohíbe.
   *
   * PENDING(paso 4): faltan las DOS mitades que este paso no tiene de dónde sacar.
   * (1) El `ObjectKey` de los bytes guardados — sale del tramo 1, que es donde se sube
   * el archivo, y `ingest(bytes)` recibe un `Uint8Array` sin nombre de objeto: el enlace
   * lo tiene que poner quien persista el `Ingestion`, que ya declara `original:
   * ObjectKey`. (2) `ColdProbe.detectedFormat` sigue en `null` y va a seguir: es la
   * auditoría #32 —«nada en el diseño identifica formatos por nombre»— y hace falta un
   * catálogo de firmas paralelo al registro que no está ni en el plan ni en el grafo de
   * paquetes. Sin él, el roadmap de «qué formatos nos están pidiendo» se agrupa por
   * `null`, y eso es un hueco declarado y no una garantía.
   */
  readonly onHold: ColdProbe | null;
  /**
   * LOS ASSETS QUE ESTA CORRIDA NO PUDO DESCOMPONER porque le faltaba una capacidad.
   * Vacío = no quedó nada pendiente, y el documento está entero.
   *
   * NO ES `onHold` CON OTRO NOMBRE, y confundirlos sería caro. `onHold` es un
   * DOCUMENTO que nadie supo leer y se reintenta cuando llega un adaptador nuevo;
   * esto son PARTES de un documento que sí se leyó, y se reintentan cuando corre un
   * contexto con más capacidades. Distinto disparador, distinto destino.
   *
   * Y NO SE CONFUNDE CON «TOCÓ FONDO». Un asset que el modelo miró y devolvió igual
   * —la foto de un gato— NO entra acá: terminó. Los dos se ven idénticos desde
   * afuera —un `asset` sin hijos— y sin esta lista el segundo se re-encolaría para
   * siempre. Que la distinción exista es el motivo entero de `Adapter.requires`.
   *
   * ES `ObjectRef` Y NO UN TIPO NUEVO: son exactamente (qué objeto, qué parte), que
   * es todo lo que hace falta para rehacer el trabajo. Inventar un tipo paralelo con
   * los mismos dos campos sería la re-declaración que el README de `ir` prohíbe.
   *
   * PENDING(host): quién lo empareja con su documento. `ingest` no conoce su propio
   * `DocumentId` —vive en el tramo 1, aguas arriba— así que el job lo arma quien
   * persiste. Es el mismo hueco que `onHold` ya declara, con el mismo dueño.
   */
  readonly deferred: readonly ObjectRef[];
};

/**
 * LO QUE LLEGÓ. Una puerta, dos formas de entrar, y de la línea siguiente en adelante
 * el pipeline no vuelve a preguntar cuál fue.
 *
 * ES LA DECISIÓN DEL PASO 5, y la que el plan predijo que dolería: hasta acá la
 * espina dorsal era `ingest(bytes)`, o sea que la firma de la función TENÍA FORMA DE
 * DOCUMENTO mientras el diseño afirmaba que la cintura no la tiene. Un mensaje de
 * chat no tiene bytes, ni extensión, ni sonda; llega por una herramienta MCP.
 *
 * LAS TRES SALIDAS QUE SE DESCARTARON, porque la rama existe en las tres y lo único
 * que cambia es dónde:
 *
 *   · Serializar el chat a bytes canónicos. El plan ya la rechaza (PROVISIONAL(C9)
 *     de `ir`): hay que inventar ese formato, entra en `hashBytes`, en la clave del
 *     caché y en el dedupe de blobs, y «las diez líneas de §{Chat} dejan de ser
 *     diez».
 *   · Fabricarle una sonda degenerada y hacerlo ganar el concurso por origen, que es
 *     lo que §{Chat} escribe. Funciona, y esconde la rama adentro de un constructor
 *     que inventa cinco datos falsos —`size` en bytes sobre un texto, `magicBytes`
 *     vacíos—. Una sonda fabricada TIPA IGUAL DE BIEN que una traída de un archivo:
 *     es una garantía de peldaño 5, un booleano en runtime que nadie lee.
 *   · Dos entradas, `ingest(bytes)` e `ingestMessage(msg)`. Eso es literalmente «un
 *     procesador de archivos con un chat pegado al costado», que es la frase que
 *     §{Chat} usa para describir el fracaso.
 *
 * EL PAR (ADAPTADOR, ENTRADA) LO CHEQUEA EL COMPILADOR. La variante `message` lleva
 * el adaptador YA TIPADO, así que `E` se infiere de él y la entrada se verifica
 * contra ese mismo `E`. No hay borrado, no hay `unknown`, no hay búsqueda por id que
 * pueda devolver el adaptador equivocado. En la variante `bytes` los dos parámetros
 * quedan sin usar y TypeScript los infiere `unknown`, que es lo correcto: ahí quien
 * elige el adaptador es el selector y no quien llama.
 *
 * `channel` SIGUE SIENDO LIBRE EN LA VARIANTE `bytes`, y eso es un rescate y no un
 * descuido: `{kind:'bytes', channel:'chat'}` es un PDF que alguien soltó en la
 * conversación, y es un archivo, y pasa por el selector como cualquier otro. El canal
 * chat y el adaptador chat son dos cosas distintas; mientras el chat competía por la
 * sonda se escribían igual y `Origin` documentaba la colisión como un costo asumido.
 */
export type Intake<S, E> =
  | {
      readonly kind: "bytes";
      readonly bytes: Uint8Array;
      /**
       * SU DIRECCIÓN, y la trae quien la guardó. El almacenamiento es direccionado
       * por contenido y el request guarda ANTES de encolar, así que para cuando esto
       * corre la clave ya existe. Sin ella un adaptador no puede emitir un `asset`
       * —`ObjectRef` es (objeto, ventana)— y sin `asset` no hay delegación.
       *
       * Cierra además la mitad que `Run.onHold` declaraba pendiente desde el paso 4:
       * «falta el `ObjectKey` de los bytes guardados — sale del tramo 1, y
       * `ingest(bytes)` recibe un `Uint8Array` sin nombre de objeto».
       */
      readonly object: ObjectKey;
      /** Declarado por quien subió. Alimenta `ColdProbe.declaredMime` y `Source.mime`. */
      readonly mime: string;
      readonly name: string | null;
      readonly channel: Channel;
      /**
       * QUIÉN SUBIÓ Y CUÁNDO, y por eso viven acá y no en `IngestOptions`: son un
       * hecho de ESTA entrada, no del entorno. La variante `message` no los lleva
       * porque no los necesita — cada mensaje trae su autoría adentro, y tomarla de
       * quien invocó la herramienta MCP sería atribuirle al agente lo que dijo una
       * persona.
       */
      readonly actor: string;
      /**
       * EL INSTANTE, POR PARÁMETRO Y NO POR RELOJ. Es lo que hace posible el golden:
       * un snapshot no puede contener la hora a la que se corrió. Y es la razón de
       * que `RawNode` no lleve autoría y de que el envoltorio la estampe fuera del
       * adaptador (PROVISIONAL(#22/C8) de `ir`). Vale igual para `ownAuthorship.when`
       * de un mensaje, que tampoco lo pone un reloj: lo trae la afirmación.
       */
      readonly when: string;
    }
  | {
      readonly kind: "message";
      readonly adapter: ChannelAdapter<S, E>;
      readonly input: E;
    };

export type IngestOptions = {
  readonly registry: Registry;
  readonly sha256: HashFn;
  /**
   * `PARAMETERS.grouping.targetSizeChars` es `Pending<number>` y hoy vale `null`, así
   * que el tipo obliga a que quien lo necesite lo provea. Escribir un literal acá sería
   * «un número inventado con precisión falsa»: el único orden de magnitud que el plan
   * da está en TOKENS y en la sección del tramo 6 — ni la unidad ni el tramo son los de
   * este parámetro.
   */
  readonly targetSizeChars: number;
  readonly budget?: Budget;
  /**
   * LA CAPACIDAD PERCEPTUAL, y `undefined` significa que este contexto no la tiene.
   *
   * Es lo único que distingue la corrida del request de la del worker, y por eso vive
   * en las OPCIONES y no en el `Intake`: no es un hecho de lo que llegó, es un hecho
   * de quién está corriendo. La misma entrada por los dos contextos da un documento
   * completo o uno con partes anotadas, sin que el llamador tenga que pedir nada
   * distinto.
   */
  readonly perceive?: PerceiveFn | null;
};

/** Sin topes. `maxMs` en `null` es lo que `ir` EXIGE para el test de determinismo. */
const NO_BUDGET: Budget = {
  maxMs: null,
  maxNodes: null,
  maxMaterializedBytes: null,
  maxInvocations: null,
  maxExpansions: null,
};

const NEVER_ABORTED: CancellationSignal = { aborted: false };

/**
 * El contexto es un CAPABILITY OBJECT del núcleo y no un contexto flaco
 * (PROVISIONAL(H1) de `ir`): con `{diagnostics, limits}` el adaptador se autolimita y
 * el núcleo no puede impedir nada — el zip bomb pasaría a depender de que los doce
 * autores se acuerden.
 *
 * NO tiene `delegar()`, y esa ausencia es estructural: sería la lectura literal de «la
 * recursión ocurre sola» desde adentro del adaptador y rompería el grafo de paquetes,
 * porque `adapters` pasaría a depender de `select`, que vive con el registro. Quien
 * recorre las unidades, detecta los assets y llama a `select` es la ORQUESTACIÓN — o
 * sea este archivo, en el paso 6.
 */
export const contextOf = (
  limits: Budget,
  /**
   * `null` = este contexto NO PUEDE percibir, y es el valor por defecto A PROPÓSITO.
   * El hilo que atiende el request se construye así, el worker con el modelo puesto,
   * y esa diferencia ES el corte entre lo liviano y lo pesado. Que el default sea la
   * ausencia importa: un contexto que lo trajera sin pedirlo pondría el trabajo caro
   * en el camino del usuario sin que nadie lo decidiera.
   */
  perceive: PerceiveFn | null = null,
): { ctx: Context; sink: Sink } => {
  const notices: Notice[] = [];
  const degradations: Degradation[] = [];
  const spent = new Map<SpendKind, number>();
  const ctx: Context = {
    diagnostics: {
      notice: (code, location, detail) =>
        void notices.push({ code, location, detail: detail ?? null }),
      degraded: (from, to, reason) => void degradations.push({ from, to, reason }),
    },
    limits,
    ancestors: [],
    depth: ZERO,
    signal: NEVER_ABORTED,
    // `false` = presupuesto agotado. DIFIERE, nunca lanza (§{Diagnóstico}).
    spend: (kind: SpendKind, amount: number): boolean => {
      const before = spent.get(kind) ?? ZERO;
      const cap =
        limits[
          kind === "ms"
            ? "maxMs"
            : kind === "nodes"
              ? "maxNodes"
              : kind === "materializedBytes"
                ? "maxMaterializedBytes"
                : kind === "invocation"
                  ? "maxInvocations"
                  : "maxExpansions"
        ];
      if (cap !== null && before + amount > cap) return false;
      spent.set(kind, before + amount);
      return true;
    },
    // El ÚNICO punto donde se consulta el caché. Es lo que vuelve cierto «un acierto de
    // caché no descuenta»: si cada adaptador invocara por su cuenta, nadie podría saber
    // si descontó o no. En el paso 3 no hay caché y la invocación es directa.
    invoke: <T,>(_key: string, work: () => Promise<T>): Promise<T> => work(),
    // RECHAZA, y eso es lo que hace verificable que la profundidad de delegación de
    // este paso sea CERO. «No llamar a `materialize` es lo que hace cumplir la
    // precondición de terminación» (§{Dónde frena}) — acá no se puede llamar.
    materialize: (_bytes: Uint8Array, _mime: string): Promise<ObjectRef> =>
      Promise.reject(new Error("ORCHESTRATION-ERR: step 3 does not materialize bytes")),
    perceive,
  };
  return { ctx, sink: { notices, degradations } };
};

// ─────────────────────────────── La delegación ───────────────────────────────

/**
 * «Un asset delega si algún adaptador reclama sus bytes»
 * (§{La delegación es emergente}) — y eso es LITERALMENTE `select()`, el tramo 2,
 * aplicado a la parte.
 *
 * TODO EL PASO 6 ES ESTA SECCIÓN, y es corta por diseño: no hay maquinaria nueva de
 * recursión. La reforma que la hizo emergente borró `role:'delegado'` y el
 * clasificador de contenedores por declarar algo que el sistema puede deducir, y el
 * registro tampoco necesita una fila para «contenedores»: un `.zip` es un adaptador
 * que emite un asset por miembro, y la recursión ocurre sola.
 *
 * VIVE ACÁ Y NO EN UN ADAPTADOR, y esa frontera es la que sostiene el grafo de
 * paquetes: `ctx` no tiene `delegar()` porque eso obligaría a `adapters` a depender
 * de `select`, que vive con el registro (PROVISIONAL(H1) de `ir`). El adaptador emite
 * `asset` y nada más; quien recorre las unidades, les construye sonda y llama a
 * `select` es la orquestación.
 */

/** Lo que produce expandir una lista: los nodos, lo que quedó pendiente, y si hubo delegación. */
type Expansion = {
  readonly nodes: readonly RawNode[];
  readonly deferred: readonly ObjectRef[];
  readonly delegated: boolean;
};

const NOTHING: Expansion = { nodes: [], deferred: [], delegated: false };

/**
 * La MATERIA de un asset — el par (objeto, ventana) — que es lo que la guarda de
 * ciclo compara y lo que nombra un marco de delegación.
 *
 * SIN HASHEAR, y no es una omisión: `ObjectKey` ya *es* el hash del contenido, así
 * que componerlo con la ventana identifica la materia sin colisiones y sin pedirle
 * una función de hash a nadie. El nombre del tipo dice «hash» porque describe lo que
 * garantiza —dos materias distintas nunca coinciden— y no cómo se calcula.
 */
const matterOf = (ref: ObjectRef): MatterHash =>
  asMatterHash(`${ref.object}#${windowKey(ref.window)}`);

/**
 * PUNTO FIJO — «si descomponer un asset devuelve un solo bloque cuyo contenido es el
 * mismo que entró, se tocó fondo» (§{Dónde frena}).
 *
 * NO ES UNA REGLA SOBRE IMÁGENES. Vale para cualquier cosa que no se abra más, y por
 * eso también cubre el `.zip` que se contiene a sí mismo. Es la definición más
 * honesta de «no se puede descomponer más» que existe: se descubre HACIÉNDOLO, no
 * declarándolo.
 *
 * Y descansa por completo en la precondición de terminación: la región referencia el
 * original en vez de materializar un recorte, así que la ventana que vuelve es
 * comparable con la que fue. Si cada nivel generara bytes nuevos, la ref sería otra
 * siempre y esta función devolvería `false` para siempre.
 */
const isFixedPoint = (raw: readonly RawNode[], ref: ObjectRef): boolean => {
  const [only] = raw;
  return (
    raw.length === ONE &&
    only !== undefined &&
    only.body.shape === "asset" &&
    only.body.ref.object === ref.object &&
    windowCovers(only.body.ref.window, ref.window)
  );
};

const expand = async (
  nodes: readonly RawNode[],
  origin: Source,
  chain: readonly DelegationId[],
  ctx: Context,
  registry: Registry,
): Promise<Expansion> => {
  const out: RawNode[] = [];
  const deferred: ObjectRef[] = [];
  let delegated = false;

  for (const node of nodes) {
    // La cadena se estampa ACÁ y nunca en el adaptador: «el adaptador delegado no
    // sabe que fue delegado» (PROVISIONAL(#C21) de `ir`). Y es una CADENA y no un id
    // suelto porque el emisor necesita distinguir bajar un nivel de bajar tres — sin
    // eso, la cita encadenada del ejemplo canónico no se puede armar.
    out.push(chain.length === ZERO ? node : { ...node, delegation: chain });
    if (node.body.shape !== "asset") continue;

    const sub = await delegateOne(node, node.body, origin, chain, ctx, registry);
    out.push(...sub.nodes);
    deferred.push(...sub.deferred);
    delegated = delegated || sub.delegated;
  }
  return { nodes: out, deferred, delegated };
};

const delegateOne = async (
  node: RawNode,
  asset: BodyOf<"asset">,
  origin: Source,
  chain: readonly DelegationId[],
  ctx: Context,
  registry: Registry,
): Promise<Expansion> => {
  const matter = matterOf(asset.ref);

  // ── GUARDA DE CICLO ────────────────────────────────────────────────────────
  // Protege del archivo armado a propósito —A contiene B contiene A— donde el punto
  // fijo NO alcanza, porque cada paso sí devuelve algo distinto (§{Dónde frena}).
  if (ctx.ancestors.includes(matter)) {
    ctx.diagnostics.notice(
      "delegation.cycle",
      node.location,
      `matter ${matter} is already an ancestor: the container contains itself`,
    );
    return NOTHING;
  }

  const source = sourceOfAsset(origin, asset);
  const probe = probeOf(
    await coldProbeOfAsset(source),
    // El origen `delegated` estrena productor: existe desde el paso 1 y nadie lo
    // había construido. `by` es quien EMITIÓ el asset, que es el dato que hace
    // legible una cascada de delegaciones en la observabilidad.
    { kind: "delegated", by: node.location.adapter },
    source,
  );
  const selection = await select(registry, probe);

  // Nadie lo reclama: el asset se queda como está, sin hijos y sin pendiente. No es
  // una falla — es un binario que todavía no sabemos abrir, y ya está guardado.
  if (selection === null) return NOTHING;

  // ── ¿PUEDE ESTE CONTEXTO INVOCARLO? ────────────────────────────────────────
  // La decisión la toma el NÚCLEO comparando la declaración estática del adaptador
  // contra lo que este contexto trae, y la toma ANTES de llamarlo. Que el adaptador
  // no opine es lo que vuelve confiable la distinción entre «no se intentó» y «se
  // intentó y tocó fondo»: los dos dejan un `asset` sin hijos, y solo el primero
  // vuelve a la cola.
  const missing = selection.adapter.requires.filter((c) => ctx[c] === null);
  if (missing.length > ZERO) {
    ctx.diagnostics.notice(
      "delegation.deferred",
      node.location,
      `adapter ${selection.adapter.id} requires ${JSON.stringify(missing)}, which this context does not provide`,
    );
    return { nodes: [], deferred: [asset.ref], delegated: false };
  }

  const inner: Context = {
    ...ctx,
    ancestors: [...ctx.ancestors, matter],
    depth: ctx.depth + ONE,
  };
  const raw = await selection.adapter.recognize(source, inner);

  if (isFixedPoint(raw, asset.ref)) {
    ctx.diagnostics.notice(
      "delegation.bottomed",
      node.location,
      `${selection.adapter.id} returned the same matter it was given: nothing further to decompose`,
    );
    return NOTHING;
  }

  const below = await expand(raw, source, [...chain, asDelegationId(matter)], inner, registry);
  return { ...below, delegated: true };
};

// ─────────────────────────────── La espina dorsal ────────────────────────────

const EMPTY = { nodes: [], fragments: [], records: [] } as const;

/**
 * Lo que las DOS entradas producen, y a partir de acá no hay dos caminos.
 *
 * El `on_hold` no es una falla y no es un rechazo: es «todavía no lo soportamos». Y
 * solo lo puede producir la variante `bytes` — un mensaje siempre tiene su adaptador,
 * porque quien lo invocó lo trajo.
 */
type Recognized =
  | {
      readonly onHold: null;
      readonly nodes: readonly Node[];
      readonly achievedLevel: AchievedLevel;
      readonly adapter: AdapterId;
      readonly deferred: readonly ObjectRef[];
    }
  | { readonly onHold: ColdProbe };

/**
 * «EN ESPERA» Y «LEÍDO» NO SE CONFUNDEN, y desde el paso 5 lo dice el TIPO.
 *
 * Hasta acá era una garantía de runtime: el campo `enEspera` estaba en el golden
 * justamente para que llenarlo de más fuera un acto visible, y el mutante S84 lo
 * acreditaba poniéndole una sonda fría a un documento que se había indexado perfecto.
 * Con `Recognized` partida en dos variantes esa mutación DEJÓ DE SER ESCRIBIBLE —el
 * compilador la rechaza por dos lados a la vez: la variante en espera no admite los
 * otros campos, y ensanchar `onHold` rompe el discriminante que estrecha el resto—, así
 * que la fila pasó a acreditar esta aserción en vez de un diff de snapshot.
 *
 * Son dos estados con destinos distintos: uno se reintenta el día que llega un adaptador
 * nuevo, el otro no. Confundirlos hace crecer la cola de reprocesamiento con documentos
 * que ya están en el índice y que ningún adaptador nuevo va a arreglar.
 *
 * El valor de fallo es un OBJETO y nunca `never`, por la misma razón que en `ir`: `never`
 * es asignable a todo, así que una aserción que falla hacia `never` no puede fallar.
 */
type True<T extends true> = T;
export type RECOGNIZED_PROOFS = True<
  Extract<Recognized, { readonly adapter: AdapterId }>["onHold"] extends null
    ? true
    : {
        "ORCHESTRATION-ERR": "the read variant of Recognized can carry a cold probe again — a document that WAS read can be queued for reprocessing, and the sweep grows with documents already in the index";
      }
>;

/**
 * TRAMO 2 + 3 POR EL LADO DE LOS BYTES: sonda, selector, y la autoría del documento.
 *
 * LA AUTORÍA SE ESTAMPA ACÁ Y NO EN EL ADAPTADOR. El caché de reconocimiento se
 * indexa por `hashBytes` y cruza organizaciones POR DISEÑO (§{Caché}), y la autoría es
 * por documento y por tenant: si viajara adentro del árbol cacheado, el primer subidor
 * quedaría como autor del mismo archivo en otro tenant (PROVISIONAL(#22/C8)).
 */
const recognizedOfBytes = async (
  intake: Extract<Intake<unknown, unknown>, { kind: "bytes" }>,
  registry: Registry,
  ctx: Context,
): Promise<Recognized> => {
  const source = sourceOfBytes(intake.bytes, intake.object, intake.mime);
  const cold = coldProbeOf(intake.bytes, intake.name);
  const probe = probeOf(cold, { kind: "channel", channel: intake.channel }, source);
  const selection = await select(registry, probe);

  // `null` es un resultado LEGÍTIMO y no un error disfrazado: ningún adaptador —ni el
  // piso de texto— puede leer estos bytes. El documento queda `on_hold`; no se pierde,
  // no se rompe, y nadie tiene que capturar nada.
  //
  // Y NO SE VA EN SILENCIO. Hasta el paso 4 esta rama devolvía la corrida vacía sin un
  // solo aviso: un documento que nadie sabe leer salía EXACTAMENTE igual que uno que
  // alguien leyó y del que no sacó nada, y el invariante «ninguna información se
  // descarta en silencio» lo cumplía por no haber nada escrito. El aviso lleva la sonda
  // fría en el detalle porque es lo que hace accionable el estado: es lo que un humano
  // lee para saber qué formato pedir, y lo que un barrido futuro filtra sin abrir un
  // solo archivo.
  if (selection === null) {
    ctx.diagnostics.notice(
      "intake.on_hold",
      null,
      `no adapter claimed these bytes: extension ${JSON.stringify(cold.extension)}, ` +
        `${cold.size} bytes, detected format ${JSON.stringify(cold.detectedFormat)}`,
    );
    return { onHold: cold };
  }

  const raw = await selection.adapter.recognize(source, ctx);

  // EL BUCLE. Todo asset que salga de acá vuelve a entrar por la misma puerta, y lo
  // que traiga se injerta en esta misma lista plana — «el contenido incrustado hereda
  // el contexto jerárquico de su contenedor» (§{La delegación es emergente}). El
  // emisor no necesita saber nada de esto: compara cadenas de delegación y reencuadra
  // solo, y eso está construido desde el paso 2.
  const grown = await expand(raw, source, [], ctx, registry);

  return {
    onHold: null,
    nodes: grown.nodes.map((n) =>
      asNode({
        ...n,
        authorship: {
          actor: asActorId(intake.actor),
          when: asInstant(intake.when),
          source: "upload",
        },
      }),
    ),
    // `mixed` ESTRENA PRODUCTOR, y es el ejemplo estrella del plan: «198 páginas
    // estructuradas + 2 delegadas» (PROVISIONAL(#2) de `ir`). Sale de que HUBO
    // delegación, no de que haya corrido un modelo: un `.docx` con un `.xlsx` adentro
    // también es mixto, y no hay modelo en el camino.
    achievedLevel: grown.delegated ? "mixed" : selection.achievedLevel,
    adapter: selection.adapter.id,
    deferred: grown.deferred,
  };
};

/**
 * TRAMO 3 POR EL LADO DEL MENSAJE. No hay tramo 2, y esa ausencia es la decisión.
 *
 * NO ES UN ATAJO: es que no hay pregunta que hacer. El selector responde «¿quién sabe
 * leer estos bytes?», que solo tiene sentido bajo incertidumbre de formato, y acá
 * quien invoca trajo el adaptador. Hacerlo pasar igual obligaría a fabricarle una
 * sonda con cinco campos que hablan de un archivo, y una sonda fabricada tipa igual de
 * bien que una real.
 *
 * `achievedLevel: 'structured'` porque lo leyó un adaptador dedicado — la escala
 * distingue eso de haber caído al piso de texto (§{Tramo 1 › El registro}), y un
 * mensaje no cae al piso: nunca hubo bytes que nadie supiera leer.
 *
 * LA AUTORÍA VIENE DE CADA NODO Y NO DE QUIEN LLAMÓ, que es la otra mitad de la
 * decisión. Es `AuthoredRawNode`: la trajo el adaptador pegada a la unidad, obligatoria
 * por tipo, y acá solo se MARCA. Tomarla de quien invocó la herramienta MCP —que es lo
 * que pasaría si el mensaje entrara por la puerta de los bytes— le atribuiría al agente
 * lo que dijo una persona, y «esto lo dijo el CFO en marzo» es la mitad del valor de la
 * memoria (§{Tramo 3 › Qué sale}).
 */
const recognizedOfMessage = async <S, E>(
  intake: Extract<Intake<S, E>, { kind: "message" }>,
  ctx: Context,
): Promise<Recognized> => {
  const raw = await recognizeMessage(intake.adapter, intake.input, ctx);
  return {
    onHold: null,
    nodes: raw.map(({ ownAuthorship, ...n }) =>
      asNode({
        ...n,
        authorship: {
          actor: asActorId(ownAuthorship.actor),
          when: asInstant(ownAuthorship.when),
          source: ownAuthorship.source,
        },
      }),
    ),
    achievedLevel: "structured",
    adapter: intake.adapter.id,
    // Un mensaje curado no trae piezas incrustadas con bytes: lo que llega es una
    // afirmación, no un contenedor (§{Chat}). Vacío por construcción, no por olvido.
    deferred: [],
  };
};

export const ingest = async <S, E>(
  intake: Intake<S, E>,
  options: IngestOptions,
): Promise<Run> => {
  const { ctx, sink } = contextOf(options.budget ?? NO_BUDGET, options.perceive ?? null);

  // LA ÚNICA RAMA DE TODO EL ARCHIVO, y está acá arriba a propósito. De la línea
  // siguiente en adelante no hay una sola pregunta sobre de dónde vino esto: emisión,
  // agrupación, migas de pan y fragmentación son literalmente el mismo código para un
  // `.docx` de doscientas páginas y para un mensaje de tres párrafos.
  const recognized =
    intake.kind === "message"
      ? await recognizedOfMessage(intake, ctx)
      : await recognizedOfBytes(intake, options.registry, ctx);

  if (recognized.onHold !== null) {
    return {
      ...EMPTY,
      sink,
      achievedLevel: "plain_text",
      adapter: null,
      onHold: recognized.onHold,
      deferred: [],
    };
  }

  const { nodes, achievedLevel, adapter, deferred } = recognized;

  // ALGUIEN SUPO LEERLO Y NO SALIÓ NADA, y eso tampoco se va en silencio.
  //
  // Es el mismo defecto que el paso 4 le cerró a la rama de `on_hold`, en el otro
  // extremo del camino: allá nadie sabía leer los bytes, acá un adaptador dedicado los
  // leyó y devolvió cero unidades. Sin este aviso los dos casos salen EXACTAMENTE
  // iguales que un documento vacío de verdad, y «ninguna información se descarta en
  // silencio» (§{Invariantes}) lo cumple por no haber nada escrito — que es cumplirlo
  // de la peor manera.
  //
  // LO ENCONTRÓ EL CHAT, y no es del chat. Un `.docx` del que el adaptador no saca nada
  // hace lo mismo, pero casi nunca pasa; una herramienta MCP manda una afirmación vacía
  // sin ningún esfuerzo, así que el canal nuevo volvió alcanzable un hueco que ya
  // estaba. Va acá y no en la rama del mensaje, justamente porque no es de esa rama.
  if (nodes.length === ZERO) {
    ctx.diagnostics.notice(
      "intake.empty",
      null,
      `adapter ${JSON.stringify(adapter)} claimed the input and produced no nodes`,
    );
  }

  const emission = emit(nodes, options.sha256);
  if (!emission.ok) {
    // La emisión falla con un OBJETO, no con una excepción, y acá se convierte en un
    // aviso: un documento que no se pudo emitir tampoco se pierde en silencio.
    ctx.diagnostics.notice(
      "emission.failed",
      null,
      `${emission.failure.kind} at position ${emission.failure.position}`,
    );
    return {
      ...EMPTY,
      sink,
      achievedLevel,
      adapter,
      deferred,
      // NO va a `on_hold`: alguien SÍ supo leer esto y lo que falló fue la emisión. Son
      // dos estados con destinos distintos —uno se reintenta cuando llega un adaptador
      // nuevo, el otro no— y confundirlos pondría a re-barrer un documento que ningún
      // adaptador nuevo va a arreglar.
      onHold: null,
    };
  }

  const grouped = group(emission.nodes, options.targetSizeChars);
  return {
    nodes: emission.nodes,
    fragments: grouped.fragments,
    records: grouped.records,
    sink,
    achievedLevel,
    adapter,
    onHold: null,
    deferred,
  };
};
