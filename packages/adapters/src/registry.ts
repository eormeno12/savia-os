/// <reference path="./env.d.ts" />
/**
 * Tramo 2 — la SONDA, el REGISTRO y el SELECTOR (§{La sonda}, §{El selector}), más
 * las dos piezas que el contrato declara y que nadie había construido: la cascada
 * (§{La única}) y la FÁBRICA DEL ADAPTADOR OPACO.
 *
 * Esa fábrica era una deuda nombrada del contrato: la corrección de
 * `OpaqueAdapter.recognize` en `ir/src/adapter.ts` dice, con todas las letras, «esa
 * fábrica NO EXISTE». Acá existe, y es lo único que puede confinar a UN sitio el
 * `unknown` que `recognize` recibe.
 *
 * ESTE ARCHIVO NO IMPORTA `yaml`, Y ESO LO IMPONE EL GUARDIÁN. `adapters` es el único
 * paquete con dependencias de runtime, y la única que hay vive dentro del adaptador
 * que la necesita. El tramo 2 —decidir QUIÉN lee un archivo— no puede depender de una
 * librería de formato: si lo hiciera, cada adaptador nuevo la arrastraría a la
 * selección de los doce. Ver `scripts/boundaries.mjs`.
 *
 * NADA DE ACÁ RE-DECLARA UN TIPO DE `ir`. `Registry` es `readonly OpaqueAdapter[]` y
 * no un registro con los mismos cinco miembros: `Selection.adapter` ya es
 * `OpaqueAdapter`, y dos tipos estructuralmente iguales pueden divergir en silencio.
 */

import {
  Evidence,
  PARAMETERS,
  rank,
  roleFromBody,
  type AchievedLevel,
  type Adapter,
  type CascadeLink,
  type Classification,
  type ColdProbe,
  type Context,
  type OpaqueAdapter,
  type Origin,
  type Probe,
  type RawNode,
  type RecognitionLevel,
  type Selection,
  type Source,
  type Unit,
} from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

// ─────────────────────────────── Source ──────────────────────────────────────

/**
 * `[start, end)` — MEDIA ABIERTA, en BYTES, exactamente como lo fija `Source.range`
 * en `ir`. El modo de falla de leerla cerrada es SILENCIOSO: no hay excepción, no hay
 * aviso, y el documento entra al pipeline con agujeros. `ir` lo escribe con número —
 * un archivo de 10 bytes recorrido de a 4 devuelve 7, perdiendo el 3, el 7 y el 9.
 */
export const sourceOfBytes = (bytes: Uint8Array): Source => ({
  size: bytes.length,
  bytes: () => Promise.resolve(bytes),
  range: (start, end) => Promise.resolve(bytes.slice(start, end)),
  stream: async function* () {
    yield bytes;
  },
});

// ─────────────────────────────── Sonda ───────────────────────────────────────

/**
 * PROVISIONAL(#430) de `ir`: la extensión se normaliza UNA vez, acá —minúsculas, sin
 * punto, solo el último segmento, `null` si no hay— y no doce veces en los doce
 * adaptadores. Es «el campo del que dependen todos los evidenciadores de nivel
 * `Extension`», que es el que decide en ausencia de firma; normalizarlo en cada
 * adaptador son doce oportunidades de no hacerlo, y el síntoma es que el mismo
 * archivo elige adaptadores distintos según cómo lo nombró quien lo subió.
 */
export const extensionOf = (name: string | null): string | null => {
  if (name === null) return null;
  const dot = name.lastIndexOf(".");
  if (dot <= ZERO) return null;
  return name.slice(dot + ONE).toLowerCase();
};

export const coldProbeOf = (bytes: Uint8Array, name: string | null): ColdProbe => ({
  extension: extensionOf(name),
  declaredMime: null,
  size: bytes.length,
  // NUNCA rellenada: si el archivo es más corto, la ventana es más corta, para que
  // `size` y `magicBytes.length` no mientan (PROVISIONAL(magicBytes) de `ir`).
  magicBytes: bytes.slice(ZERO, Math.min(bytes.length, PARAMETERS.intake.magicBytes)),
  detectedFormat: null,
});

/**
 * La sonda completa. Los perezosos memoizan LA PROMESA EN VUELO y no el valor
 * resuelto (PROVISIONAL(#432) de `ir`): `select` dispara los doce evidenciadores con
 * `Promise.all`, y con memoización sobre el valor los cuatro adaptadores de zip
 * abrirían el archivo cuatro veces. La afirmación de costo del plan —«una sola
 * apertura parcial» (§{Los tres casos})— es verdadera bajo una y falsa bajo la otra.
 *
 * `zipEntries` devuelve vacío y no lanza: el paso 3 no tiene ningún adaptador de zip,
 * y hacerla fallar volvería `None` a cualquier evidenciador que la consultara — o
 * sea, decidiría por adaptadores que todavía no existen.
 */
export const probeOf = (cold: ColdProbe, origin: Origin, source: Source): Probe => {
  let lines: Promise<readonly string[]> | null = null;
  let entries: Promise<readonly string[]> | null = null;
  return {
    ...cold,
    origin,
    firstLines: () => {
      if (lines === null) {
        lines = source
          .range(ZERO, Math.min(source.size, PARAMETERS.intake.magicBytes))
          .then((b) => new TextDecoder("utf-8").decode(b).split("\n"));
      }
      return lines;
    },
    zipEntries: () => {
      if (entries === null) entries = Promise.resolve([]);
      return entries;
    },
  };
};

// ─────────────────────────────── Registro ────────────────────────────────────

/**
 * El registro es por IMPORT EXPLÍCITO, nunca por escaneo del sistema de archivos
 * (§{Tramo 2 › Decisiones tomadas}).
 *
 * Es `readonly OpaqueAdapter[]` y no un tipo propio: el registro guarda exactamente
 * lo que `Selection.adapter` devuelve, y darle un nombre nuevo a la misma forma es
 * abrir dos tipos que pueden divergir.
 */
export type Registry = readonly OpaqueAdapter[];

/**
 * Los `id` tienen que ser ÚNICOS, cosa que el plan nunca declara y que
 * PROVISIONAL(#427) de `ir` nombra como el hueco: «con dos iguales el comparador da 0
 * y la clave de caché colisiona». El registro es el único lugar donde se puede
 * imponer, porque es el único que ve a los doce a la vez.
 *
 * LANZA en vez de devolver un error: construir el registro es un acto de arranque del
 * proceso, no una operación sobre datos de un usuario. Un registro mal armado no es
 * un documento roto —que es la clase de falla que este paquete DIFIERE— sino un
 * despliegue roto, y arrancar con él es peor que no arrancar.
 */
export const registryOf = (entries: Registry): Registry => {
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.id)) {
      throw new Error(`ADAPTERS-ERR: two adapters share the id ${e.id}`);
    }
    seen.add(e.id);
  }
  return entries;
};

// ─────────────────────────────── Selector ────────────────────────────────────

/**
 * `select` — §{El selector}, con las tres correcciones que `ir` declara.
 *
 * PROVISIONAL(#429): `Floor` NO compite en el mismo `sort` que los dedicados. El
 * filtro literal del plan es `x.e > Evidence.None`, así que `Floor = 0` pasa y empata
 * con un dedicado que devuelva `Floor`, y quién gana lo decide **el orden alfabético
 * del nombre del adaptador**. Se elige entre los que superan `Floor`; solo si no hay
 * ninguno se cae al piso.
 *
 * PROVISIONAL(#427): el desempate compara por CODE UNITS (`<` / `>` crudo) y no con
 * `localeCompare`, que depende de ICU y del locale del proceso — el desempate que el
 * plan declara «precondición de que el caché sea válido» no lo estaría entre entornos.
 *
 * PROVISIONAL(#9): un evidenciador que LANZA cuenta como `None` y no hace fallar la
 * selección de los doce. `Promise.all` propaga el rechazo, y esto es un pipeline donde
 * «los archivos rotos son la norma, no la excepción» (§{Los decodificadores}).
 *
 * PROVISIONAL(#3): devuelve el PAR y no solo el adaptador, y de ahí sale
 * `achievedLevel` — el campo que «vuelve visible la degradación»
 * (§{Tramo 1 › El registro}) y que sin esto nadie produce. Se deriva de `evidence > Floor` y no de
 * comparar `a.id === 'piso'`, que sería ramificar sobre la identidad de un adaptador
 * desde afuera.
 *
 * `null` es un resultado LEGÍTIMO —ni un dedicado ni el piso reclamaron estos bytes—
 * y no un error disfrazado: el documento queda `on_hold`, no se pierde y no se rompe.
 */
export const select = async (registry: Registry, probe: Probe): Promise<Selection | null> => {
  const scored = await Promise.all(
    registry.map(async (a) => {
      try {
        return { a, e: await a.evidence(probe) };
      } catch {
        return { a, e: Evidence.None };
      }
    }),
  );
  const above = scored.filter((x) => x.e > Evidence.Floor);
  const pool = above.length > ZERO ? above : scored.filter((x) => x.e === Evidence.Floor);
  const winner = [...pool].sort(
    (x, y) => y.e - x.e || (x.a.id < y.a.id ? -ONE : x.a.id > y.a.id ? ONE : ZERO),
  )[ZERO];
  if (winner === undefined) return null;
  const achievedLevel: AchievedLevel = winner.e > Evidence.Floor ? "structured" : "plain_text";
  return { adapter: winner.a, evidence: winner.e, achievedLevel };
};

// ─────────────────────────────── Cascada ─────────────────────────────────────

/**
 * Lo que sabe un eslabón que resolvió, y que `Adapter.detect` NO puede devolver.
 *
 * `Classification` es `{role, hint}`; `CascadeLink` lleva además `name`, `level` y
 * `confidence`, y los tres son exactamente el dato del que sale «qué eslabón resolvió
 * cada nodo», que §{Observabilidad} llama LA IMPORTANTE.
 *
 * PENDING(H3): `Adapter.detect` declara `Classification | null` y por lo tanto TIRA
 * los tres campos. La composición de `recognize` los recupera con un `as`, y ese `as`
 * vive en UN solo sitio —`opaqueOf`, abajo— porque es el único punto por el que pasa
 * todo adaptador. Cerrarlo es ampliar el retorno de `Adapter.detect` en `ir`, que es
 * un cambio de contrato y no se hace de costado: queda escrito como hueco en vez de
 * disfrazado de garantía.
 */
export type Resolution = Classification & {
  readonly level: RecognitionLevel;
  readonly attribution: string;
  readonly confidence: number | null;
};

/**
 * `enCascada` (§{La única}): «declarado siempre antes que inferido; el orden del autor
 * solo desempata dentro de la misma clase. El invariante se cumple POR CONSTRUCCIÓN,
 * no por revisión».
 *
 * LA ESTABILIDAD DE `Array.prototype.sort` ES LOAD-BEARING, y `ir` pide que esté
 * escrito: «el orden del autor solo desempata dentro de la misma clase» solo es cierto
 * porque el sort de ES2019 es estable.
 *
 * `rank` viene de `ir` y no se replica. Reordena por NIVEL y no por certeza porque con
 * dos valores de certeza `positional` y `perceptual` empatan, y ahí el orden lo decide
 * el autor — que es justo lo que el reordenamiento existe para evitar.
 */
export const cascade =
  <S,>(links: readonly CascadeLink<S>[]) =>
  (units: readonly Unit<S>[]) => {
    const fns = [...links]
      .sort((a, b) => rank(a.level) - rank(b.level))
      .map((c) => ({
        level: c.level,
        name: c.name,
        confidence: c.confidence ?? null,
        f: c.detect(units),
      }));
    return (u: Unit<S>): Resolution | null => {
      for (const { level, name, confidence, f } of fns) {
        const r = f(u);
        if (r !== null) return { ...r, level, attribution: name, confidence };
      }
      // Sin regla de totalidad: donde nadie resuelve responde el piso físico (§{El piso}).
      return null;
    };
  };

// ─────────────────────────────── El adaptador opaco ──────────────────────────

/**
 * `recognize` es la COMPOSICIÓN de los dos casilleros, no un tercer casillero
 * (PROVISIONAL(C8) de `ir`): aplicar `decompose`, aplicar `detect`, y donde `detect`
 * se abstuvo aplicar `roleFromBody` con el nivel del piso.
 *
 * EL PISO ES `physical` Y NO EL NIVEL DEL ADAPTADOR. La forma se LEYÓ del formato, no
 * se adivinó, y `certaintyOfLevel("physical")` da `declared`, que es exactamente lo
 * que §{El piso} promete. Con `declarative` la certeza no cambiaría —los dos mapean a
 * `declared`— y lo que se perdería es la ATRIBUCIÓN, que es la métrica de salud de
 * toda la capa de reconocimiento.
 *
 * `attribution: null` significa «lo resolvió el piso», y nadie más lo escribe. Sin esa
 * convención, «si en DOCX el 60 % de los nodos los resuelve `porProminencia` en vez de
 * `porStyleId`, no hay un bug: hay un mapa de estilos incompleto» (§{Observabilidad})
 * es una lectura imposible.
 *
 * `confidence: null` es NO APLICA y nunca «cero»: el piso físico no infiere nada, así
 * que no hay confianza que reportar. Solo un eslabón que declara la suya la trae, y
 * por eso `Fragment.confidence` necesita sus dos campos.
 *
 * ES LA ÚNICA FÁBRICA, y por eso el `as` de PENDING(H3) vive en un solo sitio. Sin
 * ella, `ir` documenta que el agujero está en CADA SITIO DE LLAMADA.
 */
export const opaqueOf = <S, E>(a: Adapter<S, E>): OpaqueAdapter => ({
  id: a.id,
  level: a.level,
  version: a.version,
  evidence: (probe) => a.evidence(probe),
  recognize: async (input: unknown, ctx: Context): Promise<readonly RawNode[]> => {
    const units = await a.decompose(input as E, ctx);
    const detect = a.detect(units);
    return units.map((u) => {
      const r = detect(u) as Resolution | null;
      return {
        role: r === null ? roleFromBody(u.body) : r.role,
        body: u.body,
        location: { ...u.location, adapter: a.id, within: [] },
        hint: r === null ? null : r.hint,
        delegation: [],
        attribution: r === null ? null : r.attribution,
        level: r === null ? "physical" : r.level,
        confidence: r === null ? null : r.confidence,
      };
    });
  },
});
