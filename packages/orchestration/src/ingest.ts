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
  probeOf,
  select,
  sourceOfBytes,
  type Registry,
} from "@savia-os/adapters";
import {
  PARAMETERS,
  asActorId,
  asInstant,
  asNode,
  type AchievedLevel,
  type AdapterId,
  type Budget,
  type CancellationSignal,
  type Context,
  type Degradation,
  type HashFn,
  type LocalDataRecord,
  type LocalFragment,
  type Node,
  type Notice,
  type ObjectRef,
  type RoutedNode,
  type SpendKind,
} from "@savia-os/ir";

const { zero: ZERO } = PARAMETERS.arithmetic;

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
};

export type IngestOptions = {
  readonly registry: Registry;
  readonly name: string | null;
  readonly sha256: HashFn;
  /**
   * `PARAMETERS.grouping.targetSizeChars` es `Pending<number>` y hoy vale `null`, así
   * que el tipo obliga a que quien lo necesite lo provea. Escribir un literal acá sería
   * «un número inventado con precisión falsa»: el único orden de magnitud que el plan
   * da está en TOKENS y en la sección del tramo 6 — ni la unidad ni el tramo son los de
   * este parámetro.
   */
  readonly targetSizeChars: number;
  /**
   * El instante de la autoría, POR PARÁMETRO. Es lo que hace posible el golden: un
   * snapshot no puede contener un reloj. Y es la razón de que `RawNode` no lleve
   * autoría y de que el envoltorio la estampe acá (PROVISIONAL(#22/C8) de `ir`).
   */
  readonly when: string;
  readonly actor: string;
  readonly budget?: Budget;
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
export const contextOf = (limits: Budget): { ctx: Context; sink: Sink } => {
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
  };
  return { ctx, sink: { notices, degradations } };
};

// ─────────────────────────────── La espina dorsal ────────────────────────────

const EMPTY = { nodes: [], fragments: [], records: [] } as const;

export const ingest = async (bytes: Uint8Array, options: IngestOptions): Promise<Run> => {
  const source = sourceOfBytes(bytes);
  const probe = probeOf(
    coldProbeOf(bytes, options.name),
    { kind: "channel", channel: "frontend" },
    source,
  );
  const selection = await select(options.registry, probe);
  const { ctx, sink } = contextOf(options.budget ?? NO_BUDGET);

  // `null` es un resultado LEGÍTIMO y no un error disfrazado: ningún adaptador —ni el
  // piso— puede leer estos bytes. El documento queda `on_hold`; no se pierde, no se
  // rompe, y nadie tiene que capturar nada.
  if (selection === null) {
    return { ...EMPTY, sink, achievedLevel: "plain_text", adapter: null };
  }

  const raw = await selection.adapter.recognize(source, ctx);

  // LA AUTORÍA SE ESTAMPA ACÁ Y NO EN EL ADAPTADOR. El caché de reconocimiento se
  // indexa por `hashBytes` y cruza organizaciones POR DISEÑO (§{Caché}), y la autoría
  // es por documento y por tenant: si viajara adentro del árbol cacheado, el primer
  // subidor quedaría como autor del mismo archivo en otro tenant (PROVISIONAL(#22/C8)).
  const nodes: readonly Node[] = raw.map((n) =>
    asNode({
      ...n,
      authorship: {
        actor: asActorId(options.actor),
        when: asInstant(options.when),
        source: "upload",
      },
    }),
  );

  const emission = emit(nodes, options.sha256);
  if (!emission.ok) {
    // La emisión falla con un OBJETO, no con una excepción, y acá se convierte en un
    // aviso: un documento que no se pudo emitir tampoco se pierde en silencio.
    ctx.diagnostics.notice(
      "emission.failed",
      null,
      `${emission.failure.kind} at position ${emission.failure.position}`,
    );
    return { ...EMPTY, sink, achievedLevel: selection.achievedLevel, adapter: selection.adapter.id };
  }

  const grouped = group(emission.nodes, options.targetSizeChars);
  return {
    nodes: emission.nodes,
    fragments: grouped.fragments,
    records: grouped.records,
    sink,
    achievedLevel: selection.achievedLevel,
    adapter: selection.adapter.id,
  };
};
