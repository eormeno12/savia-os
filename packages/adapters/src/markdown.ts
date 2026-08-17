/// <reference path="./env.d.ts" />
/**
 * Tramo 3 — el adaptador `.md`. DOS casilleros y nada más (§{Dos casilleros}).
 *
 * `decompose` divide hasta la UNIDAD NATURAL DEL FORMATO —un párrafo, un ítem, un
 * bloque vallado— y nunca hasta un tamaño. `detect` es una cascada de dos eslabones.
 * No hay un tercer casillero: el piso físico lo aplica `opaqueOf`, en `registry.ts`.
 *
 * ES EL ÚNICO ARCHIVO DEL PIPELINE CON UNA DEPENDENCIA DE RUNTIME, y el guardián de
 * fronteras lo impone. `yaml` entra por el frontmatter y por nada más; ver la nota
 * larga sobre por qué no se escribe a mano, más abajo.
 *
 * LAS TRES DECISIONES DEL PASO 3, YA TOMADAS. El prototipo las llevaba como parámetros
 * de una fábrica —era lo único que hacía las dos ramas ejecutables y por lo tanto
 * medibles antes de decidir—. Están decididas, así que el parámetro se borra: una
 * opción que sobrevive a su decisión es una configuración, y una configuración es una
 * decisión que nadie tomó.
 *
 *   1. `caption` sale de DOS eslabones, no de uno. Ver la cascada.
 *   2. El frontmatter cuenta como `fields`, en la RAÍZ y como hermano.
 *   3. Los contenedores viajan por `{linkage:'parent', parent:null}` — «declaro mi id
 *      y heredo mi ruta»—, que es lo que la fase 1 del paso 3 desbloqueó en
 *      `emission/src/route.ts`. El prototipo tuvo que reservar niveles ≥ 7 de la
 *      escala de títulos para contenedores porque `parent:null` significaba RAÍZ y
 *      despegaba la lista de su sección; ese rodeo NO está acá, y con él se fue su
 *      precio: el emisor ya no necesita otro título para cerrar una lista, porque el
 *      primer bloque que no la nombra ya está afuera.
 */

import { isMap, isScalar, parseDocument, type Scalar } from "yaml";

import {
  Evidence,
  PARAMETERS,
  asAdapterId,
  asLocalId,
  asObjectKey,
  type FileAdapter,
  type Body,
  type CascadeLink,
  type Cell,
  type Classification,
  type Context,
  type Hint,
  type Mark,
  type Pair,
  type Source,
  type Unit,
} from "@savia-os/ir";

import { cascade } from "./registry.js";

const { zero: ZERO, one: ONE, notFound: NOT_FOUND } = PARAMETERS.arithmetic;
const TWO = ONE + ONE;
const THREE = TWO + ONE;

export const MARKDOWN_ID = asAdapterId("markdown");

// ─────────────────────────────── Las señales ─────────────────────────────────

/**
 * La cara del formato de la unidad: MUERE ACÁ (§{`descomponer`}). Se lee SIEMPRE por
 * `u.signals.X`, nunca aplanada sobre la unidad (PROVISIONAL(C25) de `ir`) — con las
 * señales bajo su campo, «cero fugas de formato en el nodo» (§{Invariantes}) es cierto
 * por construcción y no por revisión.
 *
 * Los valores son minúscula llana y NO repiten el formato (`heading`, no `mdHeading`):
 * el tipo ya lo dice. Es la política de GLOSARIO.md (sección 14, P3), escrita en este paso
 * porque van a ser doce vocabularios independientes y ninguno se coordina con los
 * otros once — la contracara exacta de que `role` sea cerrado.
 *
 * NO hay señal `italic` y no es olvido: «el párrafo entero está en cursiva» se lee del
 * CUERPO (`body.marks`), que es lo que la cascada ya tiene a mano, y una señal que
 * duplica un dato del cuerpo es una segunda estructura que puede discrepar.
 */
export type MdSignals = {
  readonly block:
    | "frontmatter"
    | "heading"
    | "fenced"
    | "quote"
    | "list"
    | "item"
    | "table"
    | "image"
    | "caption"
    | "paragraph";
  /** Profundidad ATX (1..6) de un `heading`. Cero en todo lo demás. */
  readonly depth: number;
  /** De qué clase es la lista, para `list` y para sus `item`. */
  readonly ordered: boolean;
  /**
   * El ancla del contenedor del que cuelga esta unidad, o `null` si cuelga de la
   * sección vigente. Es lo único que la indentación de markdown produce y que el
   * núcleo necesita: `detect` lo convierte en `Hint.parent`.
   */
  readonly container: string | null;
  /** Índice de la unidad anterior de la misma corrida, o `-1`. Nivel POSICIONAL. */
  readonly previous: number;
};

// ─────────────────────────────── Inline ──────────────────────────────────────

const INLINE =
  /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/g;

/**
 * Las marcas se miden en unidades de código UTF-16 sobre el texto YA NORMALIZADO, con
 * `[start, end)` — la convención que `Mark` fija en `ir`. Sobre el texto CRUDO los
 * offsets señalan otra palabra: la sintaxis (`**`, backticks, corchetes) desaparece
 * del texto, y el modo de falla es mudo porque nada lo detecta salvo comparar la
 * salida. PROVISIONAL(Mark) de `ir` lo escribe para la normalización NFC; acá se ve
 * sin NFC de por medio.
 *
 * Las marcas ANIDADAS (`**a _b_**`) quedan fuera: el reconocedor no es recursivo. El
 * costo es de renderizado y no de identidad —las marcas no entran en la huella
 * (`shapes.ts`)—, y va declarado en vez de insinuado.
 */
export const inlineOf = (raw: string): { text: string; marks: readonly Mark[] } => {
  const marks: Mark[] = [];
  let text = "";
  let last = ZERO;
  INLINE.lastIndex = ZERO;
  for (let m = INLINE.exec(raw); m !== null; m = INLINE.exec(raw)) {
    text += raw.slice(last, m.index);
    const start = text.length;
    const [, bold, code, linkText, href, star, underscore] = m;
    const inner = bold ?? code ?? linkText ?? star ?? underscore ?? "";
    text += inner;
    const end = text.length;
    if (bold !== undefined) marks.push({ kind: "bold", start, end });
    else if (code !== undefined) marks.push({ kind: "code", start, end });
    else if (linkText !== undefined) marks.push({ kind: "link", start, end, href: href ?? "" });
    else marks.push({ kind: "italic", start, end });
    last = m.index + m[ZERO].length;
  }
  text += raw.slice(last);
  return { text, marks };
};

/**
 * «El párrafo ENTERO está en cursiva» — la mitad débil de la señal del epígrafe
 * posicional. Se lee del cuerpo y no de una señal: es exactamente `marks` con una sola
 * marca de cursiva que cubre todo el texto.
 */
const isWhollyItalic = (body: Body): boolean => {
  if (body.shape !== "text_span") return false;
  if (body.marks.length !== ONE) return false;
  const only = body.marks[ZERO];
  return (
    only !== undefined &&
    only.kind === "italic" &&
    only.start === ZERO &&
    only.end === body.text.length
  );
};

// ─────────────────────────────── El frontmatter ──────────────────────────────

/**
 * EL TEXTO DE UN ESCALAR, y por qué no alcanza con `scalar.value`.
 *
 * `Pair.value` es un `string`. Un escalar de texto ya viene desenrollado —comillas
 * resueltas, escapes aplicados— y es exactamente lo que hay que guardar. Uno que NO es
 * texto (un número, un booleano) llega como `number`/`boolean`, y `String(3.10)` da
 * `"3.1"`: la conversión pierde la forma que el autor escribió. Para esos se corta el
 * SOURCE por el rango del nodo, que es API pública de `yaml` y no pierde nada.
 */
const scalarTextOf = (source: string, node: Scalar): string => {
  if (typeof node.value === "string") return node.value;
  const range = node.range;
  if (range === null || range === undefined) return "";
  return source.slice(range[ZERO], range[ONE]).trim();
};

/**
 * El frontmatter YAML, con un PARSER DE VERDAD.
 *
 * POR QUÉ NO SE ESCRIBE A MANO, que es la única línea de este paquete donde una
 * dependencia de runtime se justifica sola. `clave: valor` partido por el primer `:`
 * es YAML de juguete: se rompe con un valor entre comillas que contiene `:`, con un
 * comentario al final de la línea, con un valor multilínea (`|`, `>`), con un ancla, y
 * con cualquier clave citada. Ninguna de esas fallas es ruidosa — todas producen un
 * `Pair` con el valor equivocado y lo mandan al índice.
 *
 * Y LA ELECCIÓN DE ESQUEMA ES PARTE DE LA DECISIÓN, no un detalle. `yaml` parsea
 * **YAML 1.2 core** por omisión, y ahí `no` es el texto «no» y `2026-08-16` es el
 * texto «2026-08-16». Bajo YAML 1.1 —que es lo que la mitad de las librerías todavía
 * hacen— el primero sería el booleano `false` y el segundo un `Date`, o sea dos
 * campos del metadato real de un manual (una vigencia, un flag) convertidos a otra
 * cosa en silencio. El corpus lleva los dos casos por esta razón y por ninguna otra.
 *
 * QUÉ PASA CON LO QUE NO ES UN PAR ESCALAR. `fields` es un arreglo PLANO de `Pair`, y
 * YAML tiene listas y mapas anidados. Las tres salidas posibles eran aplanar con un
 * separador (inventa sintaxis que nadie declaró), quedarse con el primer nivel (pierde
 * en silencio) o avisar. Se avisa: la clave no entra a `fields` y sale un
 * `md.frontmatter.unsupported` con su nombre. Nunca se pierde un archivo —el resto de
 * los pares entra— y nunca se indexa basura.
 *
 * `null` de retorno = el frontmatter NO se puede leer. No se descarta: el bloque cae
 * por el recorrido normal y termina siendo prosa, que es la única salida que no pierde
 * el archivo ni indexa un `fields` inventado.
 */
const frontmatterPairsOf = (
  source: string,
  notice: (code: string, detail: string) => void,
): readonly Pair[] | null => {
  const doc = parseDocument(source, { prettyErrors: false });
  const firstError = doc.errors[ZERO];
  if (firstError !== undefined) {
    notice("md.frontmatter.invalid", firstError.message);
    return null;
  }
  if (!isMap(doc.contents)) {
    notice("md.frontmatter.invalid", "no es un mapa de clave/valor");
    return null;
  }
  const pairs: Pair[] = [];
  for (const item of doc.contents.items) {
    if (!isScalar(item.key) || typeof item.key.value !== "string") {
      notice("md.frontmatter.unsupported", "una clave que no es texto llano");
      continue;
    }
    const label = item.key.value;
    if (!isScalar(item.value)) {
      notice("md.frontmatter.unsupported", `${label}: el valor no es escalar`);
      continue;
    }
    pairs.push({ label, value: scalarTextOf(source, item.value) });
  }
  return pairs;
};

// ─────────────────────────────── decompose ───────────────────────────────────

type Draft = {
  readonly signals: MdSignals;
  readonly body: Body;
  readonly anchor: string;
};

const ATX = /^(#{1,6})\s+(.*)$/;
const FENCE = /^```(\S*)\s*$/;
const BULLET = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)\s*$/;
const TABLE_SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const BREAK = /^(-{3,}|\*{3,}|_{3,})$/;
const FRONTMATTER_FENCE = "---";

const cellsOf = (line: string): readonly Cell[] =>
  line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => ({ text: c.trim(), type: null }));

/**
 * Un bloque nuevo INTERRUMPE un párrafo abierto. CommonMark restringe la
 * interrupción por lista a las ordenadas que empiezan en 1; acá interrumpe cualquier
 * bullet, y es una desviación deliberada: la regla de CommonMark existe para no
 * romper líneas como «el año 2026. fue…», que en un manual son mucho más raras que
 * una lista pegada al párrafo que la introduce.
 *
 * Una imagen y una tabla NO interrumpen, y ahí sí se sigue a CommonMark: una línea con
 * `![…](…)` adentro de un párrafo es una imagen INLINE, no un bloque.
 */
const interrupts = (line: string): boolean =>
  line.trim() === "" ||
  ATX.test(line) ||
  line.startsWith("```") ||
  line.startsWith(">") ||
  BREAK.test(line.trim()) ||
  BULLET.test(line);

/**
 * El adaptador emite LA FORMA FINAL, no una representación intermedia
 * (§{`descomponer`}): sabe que una valla es `verbatim`, que una imagen sola es
 * `asset`, que una tabla GFM es `grid`.
 *
 * `notice` entra POR PARÁMETRO y no como un `Diagnostics`: esta función es pura salvo
 * por ese canal, y eso es lo que la vuelve ejercitable desde el guardián sin construir
 * un `Context` entero.
 */
export const blocksOf = (
  text: string,
  notice: (code: string, detail: string) => void,
): readonly Draft[] => {
  const lines = text.split("\n");
  const out: Draft[] = [];
  /**
   * Los contenedores abiertos. `list` es el ancla de la lista y `lastItem` la del
   * último ítem que emitió — que es de quien cuelga una sublista, porque la jerarquía
   * real de markdown es lista → ítem → sublista y no lista → sublista.
   */
  const open: { indent: number; list: string; lastItem: string | null }[] = [];
  let i: number = ZERO;

  const top = (): { indent: number; list: string; lastItem: string | null } | undefined =>
    open[open.length - ONE];

  /**
   * Cierra todo contenedor a `indent` o MÁS PROFUNDO. El corte es `>=` y no `>` porque
   * la indentación es la ÚNICA señal de anidamiento de markdown y no hay marcador de
   * cierre: con `>`, dos ítems al mismo nivel abren cada uno su propia lista.
   */
  const closeTo = (indent: number): void => {
    while (open.length > ZERO && (top()?.indent ?? ZERO) >= indent) open.pop();
  };

  // El frontmatter solo cuenta si abre en la PRIMERA línea. Es la única posición en la
  // que YAML-frontmatter está definido, y aceptarlo en otra sería inventar sintaxis.
  if (lines[ZERO] === FRONTMATTER_FENCE) {
    const close = lines.indexOf(FRONTMATTER_FENCE, ONE);
    if (close === NOT_FOUND) {
      notice("md.frontmatter.unterminated", "abre con --- y nunca cierra");
    } else {
      const pairs = frontmatterPairsOf(lines.slice(ONE, close).join("\n"), notice);
      if (pairs !== null) {
        out.push({
          signals: {
            block: "frontmatter",
            depth: ZERO,
            ordered: false,
            container: null,
            previous: NOT_FOUND,
          },
          body: { shape: "fields", pairs },
          anchor: "frontmatter",
        });
        i = close + ONE;
      }
    }
    // Si el frontmatter no se pudo leer, `i` se queda en cero y el bloque entero cae
    // por el recorrido de abajo: los `---` avisan como reglas horizontales y los pares
    // terminan siendo prosa. Nada se pierde y nada entra al índice como `fields`.
  }

  for (; i < lines.length; i += ONE) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const body: string[] = [];
      let j = i + ONE;
      for (; j < lines.length && !(lines[j] ?? "").startsWith("```"); j += ONE) {
        body.push(lines[j] ?? "");
      }
      // Una valla sin cerrar se cierra al final del archivo y SE AVISA. Nunca se
      // descarta: «descartar en silencio es el peor modo de falla» (§{Estrategia}).
      if (j >= lines.length) notice("md.fence.unterminated", `abre en la línea ${i + ONE}`);
      const language = fence[ONE] ?? "";
      closeTo(ZERO);
      out.push({
        signals: {
          block: "fenced",
          depth: ZERO,
          ordered: false,
          container: null,
          previous: out.length - ONE,
        },
        body:
          language === ""
            ? { shape: "verbatim", text: body.join("\n") }
            : { shape: "verbatim", text: body.join("\n"), language: language.toLowerCase() },
        anchor: `fence#${i}`,
      });
      i = j;
      continue;
    }

    const atx = ATX.exec(line);
    if (atx !== null) {
      closeTo(ZERO);
      const depth = (atx[ONE] ?? "#").length;
      const { text: t, marks } = inlineOf(atx[TWO] ?? "");
      out.push({
        signals: {
          block: "heading",
          depth,
          ordered: false,
          container: null,
          previous: out.length - ONE,
        },
        body: { shape: "text_span", text: t, marks },
        anchor: t,
      });
      continue;
    }

    const image = IMAGE.exec(line);
    if (image !== null) {
      closeTo(ZERO);
      out.push({
        signals: {
          block: "image",
          depth: ZERO,
          ordered: false,
          container: null,
          previous: out.length - ONE,
        },
        body: {
          shape: "asset",
          ref: { object: asObjectKey(image[TWO] ?? ""), window: { scope: "whole" } },
          mime: "application/octet-stream",
        },
        anchor: `img#${i}`,
      });
      // EL EPÍGRAFE DECLARADO. El título de CommonMark —`![alt](fig.png "El
      // epígrafe")`— es la única construcción del formato que DICE «esto es el pie de
      // esta figura», así que sale por el eslabón declarativo y su certeza es
      // `declared`. Es un nodo aparte y no un campo de la imagen porque tiene que
      // poder pegarse a ella por COHESIÓN: `caption` es `satellite` e `image` es
      // `solo`, y esa asimetría solo se ejerce si son dos nodos.
      const title = image[THREE];
      if (title !== undefined && title !== "") {
        const { text: t, marks } = inlineOf(title);
        out.push({
          signals: {
            block: "caption",
            depth: ZERO,
            ordered: false,
            container: null,
            previous: out.length - ONE,
          },
          body: { shape: "text_span", text: t, marks },
          anchor: `caption#${i}`,
        });
      }
      continue;
    }

    if (line.startsWith(">")) {
      closeTo(ZERO);
      const { text: t, marks } = inlineOf(line.replace(/^>\s?/, ""));
      out.push({
        signals: {
          block: "quote",
          depth: ZERO,
          ordered: false,
          container: null,
          previous: out.length - ONE,
        },
        body: { shape: "text_span", text: t, marks },
        anchor: `quote#${i}`,
      });
      continue;
    }

    const next = lines[i + ONE] ?? "";
    if (line.includes("|") && TABLE_SEP.test(next)) {
      closeTo(ZERO);
      const headers = cellsOf(line).map((c) => c.text);
      const rows: (readonly Cell[])[] = [];
      let j = i + TWO;
      for (; j < lines.length && (lines[j] ?? "").includes("|"); j += ONE) {
        rows.push(cellsOf(lines[j] ?? ""));
      }
      out.push({
        signals: {
          block: "table",
          depth: ZERO,
          ordered: false,
          container: null,
          previous: out.length - ONE,
        },
        // `grain: "whole"` — una tabla de markdown es la TABLA CHICA de §{Las filas}:
        // la fila no es una unidad de identidad interesante. CONSECUENCIA: el `.md` no
        // produce un solo `DataRecord`, y la mitad σ del split π/σ la ejercitan los
        // nodos-fila sintéticos de `emission`.
        body: { shape: "grid", headers, rows, grain: "whole" },
        anchor: `table#${i}`,
      });
      i = j - ONE;
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      const indent = (bullet[ONE] ?? "").length;
      const ordered = /\d/.test(bullet[TWO] ?? "");
      closeTo(indent + ONE);
      if (open.length === ZERO || (top()?.indent ?? ZERO) < indent) {
        const list = `list#${i}`;
        out.push({
          signals: {
            block: "list",
            depth: ZERO,
            ordered,
            // Una sublista cuelga del ÚLTIMO ÍTEM de la lista que la contiene; una
            // lista de primer nivel no nombra a nadie y hereda la sección vigente.
            container: top()?.lastItem ?? null,
            previous: out.length - ONE,
          },
          body: { shape: "container", ordered, schema: null },
          anchor: list,
        });
        open.push({ indent, list, lastItem: null });
      }
      const enclosing = top();
      const item = `item#${i}`;
      const { text: t, marks } = inlineOf(bullet[THREE] ?? "");
      out.push({
        signals: {
          block: "item",
          depth: ZERO,
          ordered,
          container: enclosing?.list ?? null,
          previous: out.length - ONE,
        },
        body: { shape: "text_span", text: t, marks },
        anchor: item,
      });
      if (enclosing !== undefined) enclosing.lastItem = item;
      continue;
    }

    if (BREAK.test(line.trim())) {
      // Una regla horizontal no lleva contenido y no hay forma que la exprese. No se
      // borra: se avisa. Es el caso testigo de «nada se descarta en silencio».
      notice("md.thematic_break", `línea ${i + ONE}`);
      closeTo(ZERO);
      continue;
    }

    closeTo(ZERO);
    const buffer: string[] = [line];
    let j = i + ONE;
    for (; j < lines.length && !interrupts(lines[j] ?? ""); j += ONE) {
      buffer.push(lines[j] ?? "");
    }
    const { text: t, marks } = inlineOf(buffer.join(" "));
    out.push({
      signals: {
        block: "paragraph",
        depth: ZERO,
        ordered: false,
        container: null,
        previous: out.length - ONE,
      },
      body: { shape: "text_span", text: t, marks },
      anchor: `p#${i}`,
    });
    i = j - ONE;
  }
  return out;
};

// ─────────────────────────────── detect ──────────────────────────────────────

/**
 * «Declaro mi id y HEREDO mi ruta» — `{linkage:'parent', parent:null}` desde la fase 1
 * del paso 3. Es lo que un `<ul>` necesita y lo único que `Hint` no sabía decir: sus
 * ítems lo encuentran por nombre (`byAdapterId`) y él queda bajo su `##`.
 *
 * El id es el ANCLA de la unidad, sin una segunda acuñación: dos identificadores para
 * el mismo nodo son dos cosas que pueden discrepar, y el ancla ya tiene que ser única
 * para que el adaptador pueda re-encontrar la unidad.
 */
const containerHint = <S extends MdSignals>(u: Unit<S>): Hint => ({
  linkage: "parent",
  id: asLocalId(u.location.anchor),
  parent: u.signals.container === null ? null : asLocalId(u.signals.container),
});

/**
 * C1 · Un clasificador declarativo resuelve SOLO cuando la declaración informa
 * (§{La única}). Un párrafo de markdown no es una declaración de «esto es cuerpo»: es
 * la AUSENCIA de declaración, así que se ABSTIENE y responde el piso físico. Sin C1
 * este eslabón resolvería todo y ningún otro correría nunca — y lo que se perdería no
 * es el rol, que sale igual por los dos caminos, sino el NIVEL: la métrica que
 * §{Observabilidad} llama «la importante» diría que el documento entero lo resolvió un
 * clasificador declarativo.
 */
const byMarkdownBlock = <S extends MdSignals,>(): CascadeLink<S> => ({
  name: "byMarkdownBlock",
  level: "declarative",
  detect:
    () =>
    (u: Unit<S>): Classification | null => {
      const s = u.signals;
      switch (s.block) {
        case "frontmatter":
          // HERMANO, NO ANCESTRO. `{linkage:'none'}` = raíz explícita, sin abrir
          // scope. El frontmatter está ANTES de todas las secciones y no pertenece a
          // ninguna; si abriera scope entraría en la miga de todo el documento, y
          // `ContextualFingerprint` es `sha256(miga ‖ texto)` — o sea que editar
          // `version:` re-embebería el documento entero.
          return { role: "fields", hint: { linkage: "none" } };
        case "heading":
          return {
            role: s.depth === ONE ? "heading" : "subheading",
            hint: { linkage: "level", level: s.depth },
          };
        case "fenced":
          return { role: "code", hint: null };
        case "quote":
          return { role: "quote", hint: null };
        case "image":
          return { role: "image", hint: null };
        case "caption":
          return { role: "caption", hint: null };
        case "table":
          return { role: "table", hint: null };
        case "list":
          return { role: s.ordered ? "ordered_list" : "list", hint: containerHint(u) };
        case "item":
          return { role: "paragraph", hint: containerHint(u) };
        case "paragraph":
          return null;
      }
    },
});

/**
 * EL EPÍGRAFE POR POSICIÓN — el segundo eslabón por el que se llega a `caption`.
 *
 * Markdown solo tiene UNA construcción que declara un epígrafe (el título del enlace
 * de imagen, que resuelve el eslabón de arriba) y prácticamente nadie la escribe. Lo
 * que la gente escribe es un párrafo en cursiva debajo de la figura, y eso son DOS
 * señales que hay que exigir juntas: cursiva Y adyacente a un asset.
 *
 * EL NIVEL ES `positional` Y NO `physical`, y no es una etiqueta. La cursiva sola no
 * dice «epígrafe» —dice énfasis— y lo que lo dice es estar pegado a una imagen, que es
 * POSICIÓN. El nivel lo fija la señal más débil de las dos. `certaintyOfLevel`
 * convierte `positional` en `inferred`, así que el nodo pasa de «el documento lo dijo»
 * a «Savia lo concluyó», y `Fragment.minLevel` de todo fragmento que lo contenga
 * empeora con él. Inferirlo y estampar `declarative` es exactamente lo que
 * `certaintyOfLevel` existe para impedir.
 *
 * NO HAY UMBRAL DE LONGITUD, a propósito: no separaría nada que el resto no separe ya
 * —una cita larga se escribe con `>`, que es declarativo y la atrapa el primer
 * eslabón— y sería un número que nadie midió.
 *
 * NO DECLARA `confidence`, y eso también es una decisión. El eslabón no tiene ninguna
 * medición de con qué frecuencia acierta, y `CascadeLink.confidence` es opcional
 * justamente para que un eslabón que no midió nada se quede callado: `RawNode.confidence
 * = null` significa NO APLICA, que es lo cierto. Lo que el adaptador SÍ puede afirmar
 * es la categoría —`positional`— y eso ya viaja. Un 0.5 sería precisión falsa sobre
 * una medición que este paso no hizo.
 *
 * La adyacencia se mira sobre `body.shape === "asset"` y no sobre la señal `image`: lo
 * que hace epígrafe a un epígrafe es estar pegado a un ACTIVO, que es vocabulario de
 * `ir`, y esa lectura sobrevive al día que el `.md` emita un asset por otra vía.
 */
const byNearbyItalic = <S extends MdSignals,>(): CascadeLink<S> => ({
  name: "byNearbyItalic",
  level: "positional",
  detect:
    (units) =>
    (u: Unit<S>): Classification | null => {
      if (u.signals.block !== "paragraph") return null;
      if (!isWhollyItalic(u.body)) return null;
      const previous = units[u.signals.previous];
      if (previous === undefined || previous.body.shape !== "asset") return null;
      return { role: "caption", hint: null };
    },
});

// ─────────────────────────────── El adaptador ────────────────────────────────

export const markdownAdapter: FileAdapter<MdSignals> = {
  id: MARKDOWN_ID,
  level: "declarative",
  version: "1",
  // Bytes y parseo: no necesita nada del núcleo, así que corre en cualquier contexto.
  requires: [],
  /**
   * `evidence()` responde por la FORMA, nunca por el valor del contenido
   * (§{Tramo 2 › Decisiones tomadas}). Markdown no tiene firma de bytes: lo más alto
   * que puede declarar honestamente es `Extension`. El criterio operativo de `ir` dice
   * que `Signature` es «una secuencia de bytes que NO PUEDE aparecer en otro formato»,
   * y `# ` puede aparecer en cualquier texto — declarar de más acá le gana archivos a
   * adaptadores que sí tienen firma.
   */
  evidence: (probe) =>
    Promise.resolve(
      probe.extension === "md" || probe.extension === "markdown"
        ? Evidence.Extension
        : Evidence.None,
    ),
  decompose: (input: Source, ctx: Context) =>
    input.bytes().then((bytes) => {
      const text = new TextDecoder("utf-8").decode(bytes);
      const drafts = blocksOf(text, (code, detail) => ctx.diagnostics.notice(code, null, detail));
      return drafts.map(
        (d): Unit<MdSignals> => ({
          signals: d.signals,
          body: d.body,
          location: { anchor: d.anchor, coordinate: { space: "source" } },
        }),
      );
    }),
  detect: (units) => {
    // Se escriben AL REVÉS del orden de ejecución a propósito: `cascade` reordena por
    // nivel, y si el orden del autor decidiera, el eslabón posicional le ganaría al
    // declarativo y un epígrafe declarado se reportaría como inferido.
    const run = cascade([byNearbyItalic<MdSignals>(), byMarkdownBlock<MdSignals>()])(units);
    return (u): Classification | null => run(u);
  },
};
