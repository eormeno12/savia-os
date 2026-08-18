/// <reference path="./env.d.ts" />
/**
 * Tramo 2 — la SONDA, el REGISTRO y el SELECTOR (§{La sonda}, §{El selector}), más
 * las dos piezas que el contrato declara y que nadie había construido: la cascada
 * (§{La única}) y la FÁBRICA DEL ADAPTADOR OPACO.
 *
 * Esa fábrica era una deuda nombrada del contrato: la corrección de
 * `OpaqueAdapter.recognize` en `ir/src/adapter.ts` decía, con todas las letras, «esa
 * fábrica NO EXISTE».
 *
 * Y LA SEGUNDA MITAD DE ESTE PÁRRAFO ERA FALSA hasta el paso 5. Decía que la fábrica
 * es «lo único que puede confinar a UN sitio el `unknown` que `recognize` recibe», y
 * `ir` ya tenía escrito por qué no: `unknown` en posición de PARÁMETRO no chequea
 * nada, así que el agujero nunca estuvo acá sino en cada sitio de llamada. Lo cerró el
 * paso 5, y no confinándolo: sacando al chat del registro. Ver `opaqueOf`.
 *
 * DESDE EL PASO 5 SON DOS COMPOSICIONES Y NO UNA, con el mismo cuerpo: `opaqueOf`
 * para el que compite por bytes y `recognizeMessage` para el que nombra su canal. Que
 * el cuerpo sea literalmente compartido (`recognizerOf`) es la prueba de §{Chat}.
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
  MAGIC_BYTES,
  PARAMETERS,
  rank,
  roleFromBody,
  type AchievedLevel,
  type Adapter,
  type AuthoredRawNode,
  type CascadeLink,
  type ChannelAdapter,
  type Classification,
  type ColdProbe,
  type Context,
  type FileAdapter,
  type OpaqueAdapter,
  type Origin,
  type Probe,
  type RawNode,
  type RecognitionLevel,
  type Selection,
  type Source,
  type BodyOf,
  type ObjectKey,
  type Unit,
} from "@savia-os/ir";
// La mitad del lector de zip que NO tiene dependencias. Ver el encabezado de `zip.ts`:
// si el selector importara la mitad que INFLA, arrastraría `fflate` y la razón escrita
// de la regla de confinación —«el tramo 2 sigue sin depender de ninguna librería de
// formato»— pasaría a ser falsa sin que ningún especificador de import lo mostrara.
import { zipEntriesOf } from "./zip.js";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

/** Sin bytes propios. No es «vacío por error»: es «esta región no ES bytes». */
const EMPTY_BYTES = new Uint8Array(ZERO);

// ─────────────────────────────── Source ──────────────────────────────────────

/**
 * `[start, end)` — MEDIA ABIERTA, en BYTES, exactamente como lo fija `Source.range`
 * en `ir`. El modo de falla de leerla cerrada es SILENCIOSO: no hay excepción, no hay
 * aviso, y el documento entra al pipeline con agujeros. `ir` lo escribe con número —
 * un archivo de 10 bytes recorrido de a 4 devuelve 7, perdiendo el 3, el 7 y el 9.
 */
export const sourceOfBytes = (
  bytes: Uint8Array,
  object: ObjectKey,
  mime: string,
): Source => ({
  ref: { object, window: { scope: "whole" } },
  mime,
  size: bytes.length,
  bytes: () => Promise.resolve(bytes),
  range: (start, end) => Promise.resolve(bytes.slice(start, end)),
  stream: async function* () {
    yield bytes;
  },
});

/**
 * La `Source` de UNA PARTE de otra, sin escribir un byte.
 *
 * ES LA PIEZA QUE VUELVE COMPATIBLES LAS DOS MITADES DE §{Dónde frena}. La
 * precondición de terminación exige «referenciar el original, nunca materializar un
 * recorte» —si cada nivel generara bytes nuevos el hash cambiaría siempre y el punto
 * fijo no dispararía jamás—, y a la vez el delegado tiene que ser SONDEABLE. Con
 * `Window` de por medio las dos conviven, que es exactamente lo que `PROVISIONAL(C4)`
 * decidió: «referenciar» se lee como NO ESCRIBIR BYTES NUEVOS, no como no poder
 * nombrar una subregión.
 *
 * `range` es el caso con bytes propios —un miembro de `.zip`, un adjunto de `.eml`—:
 * se leen del original con un `range()` y la sonda sale honesta, con firma y todo.
 *
 * `region` y `whole` NO TIENEN BYTES PROPIOS. Un rectángulo de una página renderizada
 * no existe en ningún lado hasta que alguien la renderiza, y renderizar es
 * materializar. Devuelve VACÍO a propósito: la evidencia de esos delegados no puede
 * venir del contenido, y viene del mime que declaró el padre (`Evidence.Structure`).
 * Fingir bytes acá sería devolverle al selector los del original —los del PDF entero—
 * y el ejemplo canónico del plan (contrato.pdf → pg3 → adaptador `imagen`) elegiría
 * otra vez el adaptador de PDF, que es el bug H9 exacto.
 *
 * LA CLAVE NO CAMBIA. Sigue siendo la del objeto que la contiene, y tiene que serlo:
 * es lo que hace que la guarda de ciclo y el caché vean la misma materia, y lo que
 * permite que el punto fijo compare `(objeto, ventana)` contra lo que entró.
 */
export const sourceOfAsset = (
  origin: Source,
  asset: BodyOf<"asset">,
  /**
   * CÓMO SE TRAE UN OBJETO PROPIO, y por qué entra por parámetro. Un asset
   * MATERIALIZADO no es un recorte del original: sus bytes se guardaron aparte y solo
   * se recuperan yendo al almacenamiento. Este paquete no puede alcanzarlo —no puede
   * importar nada más que `ir`, `yaml`, `fflate` y `txml`— así que quien compone los
   * dos lados le pasa el resolvedor. `null` = este contexto no puede traer objetos, y
   * entonces un asset materializado se comporta como un rectángulo: sin bytes.
   */
  resolve: ((object: ObjectKey) => Promise<Uint8Array | null>) | null = null,
): Source => {
  const { ref, mime } = asset;
  const shared = { ref, mime } as const;
  // EL TERCER CASO, y hasta el paso 7 no existía porque nada se materializaba. Un
  // objeto PROPIO —dirección distinta de la del origen— sí tiene bytes, y confundirlo
  // con el rectángulo de una página es lo que hacía este código cuando las dos cosas
  // caían en la misma rama: la única pregunta era «¿es un rango?», y como la respuesta
  // era no para los dos, los dos volvían vacíos. Uno con razón y el otro mal.
  if (ref.object !== origin.ref.object && resolve !== null) {
    let traído: Promise<Uint8Array> | null = null;
    // Se memoiza LA PROMESA EN VUELO por la misma razón que `zipEntries`: el selector
    // dispara los evidenciadores en paralelo y cada uno puede pedir los bytes.
    const traer = () => {
      if (traído === null) traído = resolve(ref.object).then((b) => b ?? EMPTY_BYTES);
      return traído;
    };
    return {
      ...shared,
      size: origin.size,
      bytes: traer,
      range: (a, b) => traer().then((all) => all.subarray(Math.max(ZERO, a), Math.max(ZERO, b))),
      stream: async function* () {
        yield await traer();
      },
    };
  }
  if (ref.window.scope !== "range") {
    // SIN BYTES PROPIOS, y devolverlo vacío es lo correcto, no una carencia. Un
    // rectángulo de una página renderizada no existe hasta que alguien la renderiza,
    // y renderizar es materializar — lo que §{Dónde frena} prohíbe, porque si cada
    // nivel generara bytes el hash cambiaría siempre y el punto fijo no dispararía
    // jamás.
    //
    // FINGIR BYTES ACÁ ES EL BUG H9 EXACTO: devolver los del original le daría al
    // selector los primeros 4 KB del PDF entero, `esImagen` daría `None`, ganaría
    // otra vez el adaptador de PDF y el ejemplo canónico del plan —contrato.pdf →
    // pg3 → adaptador `imagen`— no funcionaría. Por eso la evidencia de estos
    // delegados no puede venir del contenido y viene del mime que declaró el padre.
    //
    // Los PÍXELES son otra cosa y no salen de acá: el modelo los pide por `ref`, que
    // es lo que `Source` lleva desde el paso 6. Renderizar para un modelo no escribe
    // un objeto nuevo, así que no toca la precondición.
    return {
      ...shared,
      size: ZERO,
      bytes: () => Promise.resolve(EMPTY_BYTES),
      range: () => Promise.resolve(EMPTY_BYTES),
      stream: async function* () {
        yield EMPTY_BYTES;
      },
    };
  }
  const { start, end } = ref.window;
  const size = Math.max(ZERO, end - start);
  return {
    ...shared,
    size,
    bytes: () => origin.range(start, end),
    // `[start, end)` MEDIA ABIERTA, la misma convención que `Source.range` de `ir`
    // fija con número: leerla cerrada pierde un byte de cada tramo, en silencio.
    range: (a, b) =>
      origin.range(start + Math.max(ZERO, a), start + Math.min(size, Math.max(ZERO, b))),
    stream: async function* () {
      yield await origin.range(start, end);
    },
  };
};

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
 * `zipEntries` NO LANZA, y eso sobrevive al paso 7: un zip ilegible devuelve la lista
 * vacía, porque hacerla fallar volvería `None` a cualquier evidenciador que la
 * consultara — o sea, un archivo corrupto decidiría por los cuatro adaptadores de zip
 * en vez de dejar que cada uno se abstenga.
 *
 * PENDING(cola del zip): la frase del plan tiene DOS MITADES y hoy se cumple UNA. «Una
 * sola apertura parcial» (§{Los tres casos}) — lo de «una sola» lo da la memoización de
 * la promesa en vuelo, que es la mitad que decide el costo con doce evidenciadores
 * corriendo. Lo de «parcial» NO: se lee el archivo entero. El directorio central y su
 * registro de fin están al FINAL, así que la lectura parcial es una COLA y no un
 * prefijo, y su ventana es un número que decide comportamiento y que nadie midió —el
 * registro de fin son 22 bytes más un comentario de hasta 64 KiB, así que la cola no
 * tiene tope conocido—. Inventarlo acá sería la precisión falsa que `PARAMETERS` existe
 * para impedir. Se mide cuando llegue `.xlsx`, que es donde un archivo grande deja de
 * ser hipotético; sobre un `.docx` de kilobytes la diferencia no se puede cronometrar.
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
      if (entries === null) entries = source.bytes().then(zipEntriesOf);
      return entries;
    },
  };
};

/**
 * La sonda fría de un ASSET DELEGADO (PROVISIONAL(H9) de `ir`).
 *
 * Los cinco campos, y tres de ellos dicen «no aplica» con todas las letras:
 *
 *   · `extension`     `null`. Un rectángulo de la página 3 no tiene nombre de archivo.
 *   · `declaredMime`  LO QUE DECLARÓ EL PADRE, y es la única evidencia que un delegado
 *                     sin bytes propios puede ofrecer. El adaptador que abrió el PDF
 *                     es el único que sabe que esa página es un ráster.
 *   · `size`          el de la ventana.
 *   · `magicBytes`    los de la ventana SI la ventana es bytes; vacíos si es un
 *                     rectángulo. Ver `sourceOfAsset`: fingirlos devolvería los del
 *                     original y el ejemplo canónico elegiría otra vez al padre.
 *   · `detectedFormat` `null`, igual que en la sonda de un archivo (auditoría #32).
 *
 * ES LA MITAD DE LA ORQUESTACIÓN Y NO DEL PADRE, aunque el dato salga del padre. El
 * adaptador declara —`asset.mime`, `asset.ref.window`— y quien hace I/O sobre el
 * original es quien recorre las unidades. Si la armara el padre, `adapters` pasaría a
 * leer objetos y a depender de `select`, y eso es exactamente lo que
 * `PROVISIONAL(H1)` prohíbe al negarle un `delegar()` al contexto.
 */
export const coldProbeOfAsset = async (source: Source): Promise<ColdProbe> => ({
  extension: null,
  declaredMime: source.mime,
  size: source.size,
  magicBytes: source.size === ZERO ? EMPTY_BYTES : await source.range(ZERO, MAGIC_BYTES),
  detectedFormat: null,
});

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
const recognizerOf = <S, E>(
  a: Adapter<S, E>,
  units: readonly Unit<S>[],
): ((u: Unit<S>) => RawNode) => {
  const detect = a.detect(units);
  return (u) => {
    const r = detect(u) as Resolution | null;
    return {
      role: r === null ? roleFromBody(u.body) : r.role,
      body: u.body,
      location: { ...u.location, adapter: a.id, within: [] },
      hint: r === null ? null : r.hint,
      // SE COPIA TAL CUAL, y no se deriva: el único que sabe de dónde salieron los
      // bytes es el adaptador que abrió el contenedor. Acá ese dato ya no existe.
      whence: u.whence,
      delegation: [],
      attribution: r === null ? null : r.attribution,
      level: r === null ? "physical" : r.level,
      confidence: r === null ? null : r.confidence,
    };
  };
};

/**
 * La composición para el adaptador que COMPITE POR BYTES, que es lo que entra al
 * registro.
 *
 * `input` es una `Source` Y NO UN `unknown`, y eso cierra P14. El encabezado de este
 * archivo decía que esta fábrica era «lo único que puede confinar a UN sitio el
 * `unknown` que `recognize` recibe», y era falso por la razón que `ir` ya tenía
 * escrita: `unknown` en posición de PARÁMETRO no chequea nada, así que el agujero no
 * estaba acá sino en cada sitio de llamada. Lo que lo cerró no fue confinarlo: fue
 * que el chat dejara de estar en el registro, con lo que ya no hay nada heterogéneo
 * que borrar.
 *
 * PIDE UN `FileAdapter`, y ese es el único portón al registro. Un `ChannelAdapter` no
 * tiene `evidence`, así que no es asignable y NO COMPILA acá — «un adaptador de canal
 * no puede entrar al concurso» es un error de tipo y no una convención (invariante 12
 * de `ir`, acreditado por M57 con MC10 de control).
 */
export const opaqueOf = <S,>(a: FileAdapter<S>): OpaqueAdapter => ({
  id: a.id,
  level: a.level,
  version: a.version,
  // Sobrevive al borrado de `S`: es lo único que el núcleo consulta para saber si
  // puede invocar a este adaptador, y solo se llega acá desde `select`.
  requires: a.requires,
  evidence: (probe) => a.evidence(probe),
  recognize: async (input: Source, ctx: Context): Promise<readonly RawNode[]> => {
    const units = await a.decompose(input, ctx);
    return units.map(recognizerOf(a, units));
  },
});

/**
 * La composición para el adaptador que NOMBRA SU CANAL (§{Chat}).
 *
 * ES LA MISMA COMPOSICIÓN —`recognizerOf`, arriba, sin una rama de diferencia— y esa
 * es la afirmación que el paso 5 existe para probar: «que el canal más distinto entre
 * por la misma puerta es la evidencia más fuerte de que la descomposición es
 * correcta» (§{Chat}). Un mensaje de chat recorre los mismos dos casilleros, la misma
 * cascada, el mismo piso y las mismas seis formas que un `.docx`.
 *
 * LO ÚNICO QUE CAMBIA ES DE DÓNDE SALE LA AUTORÍA, y por eso no devuelve `RawNode`
 * sino `AuthoredRawNode`. En un archivo la autoría es del documento y vale para las
 * mil unidades; acá cada mensaje trae la suya y no hay documento del que heredarla.
 * Viaja cruda —`ingest` la marca, igual que marca la del camino de archivo— porque
 * acuñar no es trabajo de un adaptador.
 *
 * NO DEVUELVE UN ADAPTADOR OPACO, y no por asimetría: la opacidad existe para que el
 * registro sea una colección homogénea de `S` distintos, y acá no hay colección. Quien
 * llama trae el adaptador YA TIPADO, así que el par (adaptador, entrada) lo chequea el
 * compilador en vez de perderse en un borrado.
 */
export const recognizeMessage = async <S, E>(
  a: ChannelAdapter<S, E>,
  input: E,
  ctx: Context,
): Promise<readonly AuthoredRawNode[]> => {
  const units = await a.decompose(input, ctx);
  const node = recognizerOf(a, units);
  // Sin zip por índice: la autoría sale de LA MISMA unidad de la que sale el nodo.
  return units.map((u) => ({ ...node(u), ownAuthorship: u.ownAuthorship }));
};
