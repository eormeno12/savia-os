/// <reference path="./env.d.ts" />
/**
 * EL ADAPTADOR `.docx` — párrafos OOXML, cascada estilo → prominencia, pista de nivel
 * (§{Tramo 3 › El registro}).
 *
 * ES EL PASO 7, Y LO QUE PRUEBA NO ES EL FORMATO: es que LA CASCADA Y LA DELEGACIÓN SE
 * COMPONEN. Los dos mecanismos se construyeron por separado —la cascada en el paso 3,
 * la delegación en el paso 6— y este es el primer formato donde se encuentran: un
 * documento que entra por la cascada y lleva adentro una pieza que delega.
 *
 * LOS DOS ESLABONES, Y POR QUÉ HACEN FALTA DOS. Un `.docx` declara sus títulos con
 * `w:pStyle`, así que el eslabón declarativo los lee y listo. Pero la mitad de los
 * documentos corporativos no usan estilos: alguien pone el título en negrita y más
 * grande y sigue. Ese párrafo es un título y el formato no lo dice en ningún lado, así
 * que solo se puede inferir COMPARÁNDOLO CON EL RESTO DEL DOCUMENTO — «16 pt es título
 * en un documento cuyo cuerpo es de 11 pt, y es cuerpo en uno cuyo cuerpo es de 16 pt»
 * (§{`detectar`}). De ahí que `detect` sea una FÁBRICA que recibe el corpus entero.
 *
 * LA IMAGEN NO SE MATERIALIZA SI NO HACE FALTA, y esto se midió. Un `.docx` guarda sus
 * imágenes en `word/media/`, y varios escritores las guardan SIN COMPRIMIR —un PNG ya
 * está comprimido y volver a deflatearlo no gana nada—. Cuando es así, los bytes del
 * PNG están LITERALES en un rango del `.docx`, verificado sobre el corpus: la firma
 * `89 50 4e 47` aparece tal cual en `[1300, 1369)`. Entonces el asset se expresa como
 * el rectángulo de un PDF —mismo objeto, ventana más chica— y entra al pipeline por el
 * camino que ya existe, sin escribir un byte.
 *
 * CUANDO SÍ HACE FALTA, SE MATERIALIZA, y esa es la otra rama. Si la entrada está
 * deflateada sus bytes no están literales en ningún rango, así que el recorte por
 * referencia no se puede expresar y hay que PRODUCIRLOS: inflar y guardar. La pieza
 * queda con objeto PROPIO y ventana `whole`, y desde ahí entra al pipeline por el mismo
 * camino que la otra — el selector la reclama, el modelo la percibe, el subárbol se
 * injerta donde estaba. Materializar no es un camino aparte: es la misma puerta.
 *
 * Y SI EL CONTEXTO NO TIENE ALMACENAMIENTO, la imagen se ANUNCIA en vez de emitirse: un
 * aviso `docx.media_not_materialised`, y el texto del documento entra igual.
 * Descartarla en silencio sería el modo de falla que §{Diagnóstico} declara
 * inadmisible; hacer fallar el documento entero sería no degradar.
 */

import {
  Evidence,
  asAdapterId,
  type CascadeLink,
  type Classification,
  type Context,
  type FileAdapter,
  type Probe,
  type Source,
  type Unit,
  type Window,
} from "@savia-os/ir";
import { cascade } from "./registry.js";
import { zipDirectoryOf } from "./zip.js";
import { zipEntryOf } from "./unzip.js";
import { parse } from "txml";

const DOCUMENT = "word/document.xml";
const RELS = "word/_rels/document.xml.rels";
const STORED = 0;
/** El prefijo de los estilos de título en el vocabulario de Word. */
const HEADING_STYLE = "heading";

/**
 * Lo que el formato DECLARA de cada párrafo, y nada más. Mueren en el borde.
 *
 * No hay una taxonomía de bloques inventada —un `.docx` es una lista plana de `w:p` y
 * ya— así que las señales son los cuatro datos que deciden algo: el estilo, el tamaño,
 * la negrita y si el párrafo lleva una imagen. Los tres primeros los lee la cascada;
 * el cuarto lo lee `decompose` para saber qué cuerpo emitir.
 */
export type DocxSignals = {
  readonly style: string | null;
  /** En medios puntos, tal como OOXML lo escribe. `null` = el párrafo no lo declara. */
  readonly size: number | null;
  readonly bold: boolean;
};

type Nodo = { tagName?: string; attributes?: Record<string, string>; children?: unknown[] };

const esNodo = (x: unknown): x is Nodo => typeof x === "object" && x !== null;

/** El primer descendiente con ese tag, o `null`. El OOXML anida hondo y sin orden fijo. */
const buscar = (raíz: unknown, tag: string): Nodo | null => {
  if (!esNodo(raíz)) return null;
  if (raíz.tagName === tag) return raíz;
  for (const hijo of raíz.children ?? []) {
    const hallado = buscar(hijo, tag);
    if (hallado !== null) return hallado;
  }
  return null;
};

const recolectar = (raíz: unknown, tag: string, salida: Nodo[]): Nodo[] => {
  if (!esNodo(raíz)) return salida;
  if (raíz.tagName === tag) salida.push(raíz);
  for (const hijo of raíz.children ?? []) recolectar(hijo, tag, salida);
  return salida;
};

/** El texto de un párrafo: la concatenación de sus `w:t`, en orden. */
const textoDe = (p: Nodo): string =>
  recolectar(p, "w:t", [])
    .flatMap((t) => (t.children ?? []).filter((c): c is string => typeof c === "string"))
    .join("");

const enteroDe = (n: Nodo | null): number | null => {
  const v = n?.attributes?.["w:val"];
  if (v === undefined) return null;
  const parsed = Number.parseInt(v, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const señalesDe = (p: Nodo): DocxSignals => ({
  style: buscar(p, "w:pStyle")?.attributes?.["w:val"] ?? null,
  size: enteroDe(buscar(p, "w:sz")),
  bold: buscar(p, "w:b") !== null,
});

/**
 * EL PRIMER ESLABÓN — lo que el formato DICE. Declarativo, y se ABSTIENE donde la
 * declaración no informa: un párrafo sin `w:pStyle` no es «no es un título», es «el
 * formato no opina», y confundir las dos cosas es lo que dejaría al segundo eslabón
 * sin nada que hacer.
 */
const byDocxStyle = <S extends DocxSignals,>(): CascadeLink<S> => ({
  name: "byDocxStyle",
  level: "declarative",
  detect:
    () =>
    (u: Unit<S>): Classification | null => {
      const style = u.signals.style;
      if (style === null) return null;
      const normal = style.toLowerCase();
      if (!normal.startsWith(HEADING_STYLE)) return null;
      const nivel = Number.parseInt(normal.slice(HEADING_STYLE.length), 10);
      const level = Number.isNaN(nivel) ? null : nivel;
      return {
        role: level === 1 ? "heading" : "subheading",
        hint: { linkage: "level", level },
      };
    },
});

/**
 * EL SEGUNDO ESLABÓN — los títulos que el formato NO declara (§{`porProminencia`}).
 *
 * ES RELATIVO AL DOCUMENTO Y POR ESO ES UNA FÁBRICA. El tamaño del cuerpo no es un
 * número que se pueda escribir acá: es el tamaño MÁS FRECUENTE de este documento. Un
 * párrafo destacado es el que está por encima de ese modo y en negrita — las dos
 * cosas, porque solo el tamaño confunde una cita destacada con un título, y sola la
 * negrita confunde una palabra enfatizada en un párrafo largo.
 *
 * PENDING(docDefaults): si un documento declara el tamaño de su cuerpo SOLO en
 * `word/styles.xml` —en `docDefaults` o en el estilo Normal— y no en cada corrida,
 * este eslabón no tiene contra qué comparar y se ABSTIENE. Es lo correcto: sin cuerpo
 * conocido, «más grande» no significa nada. Pero el costo es real y hay que medirlo
 * antes de decidir si vale leer `styles.xml`: esos documentos pierden sus títulos sin
 * estilo y caen al piso como párrafos. Se mide contando, sobre documentos corporativos
 * reales, cuántos declaran tamaño por corrida y cuántos solo por defecto.
 *
 * Es `physical` y no `declarative`: sale de propiedades del render, no de algo que el
 * documento afirme. Eso lo pone DESPUÉS en la cascada, que `cascade` reordena por
 * nivel, así que un párrafo con estilo declarado nunca llega hasta acá.
 */
const byProminence = <S extends DocxSignals,>(): CascadeLink<S> => ({
  name: "byProminence",
  level: "physical",
  detect: (units) => {
    const cuenta = new Map<number, number>();
    for (const u of units) {
      const s = u.signals.size;
      if (s !== null) cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
    }
    let cuerpo: number | null = null;
    let mayor = 0;
    for (const [tamaño, veces] of cuenta) {
      if (veces > mayor) {
        mayor = veces;
        cuerpo = tamaño;
      }
    }
    return (u: Unit<S>): Classification | null => {
      const { size, bold } = u.signals;
      if (cuerpo === null || size === null) return null;
      if (!bold || size <= cuerpo) return null;
      // SIN NIVEL, y `null` no es «no sé»: es «es un título y su nivel se deduce de
      // dónde está» — el emisor lo abre bajo el título vigente más profundo. Inventar
      // un número acá sería fabricar una jerarquía que el documento no declara.
      return { role: "subheading", hint: { linkage: "level", level: null } };
    };
  },
});

const MIME_POR_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

const mimeDe = (nombre: string): string => {
  const ext = nombre.slice(nombre.lastIndexOf(".") + 1).toLowerCase();
  return MIME_POR_EXTENSION[ext] ?? "application/octet-stream";
};

export const DOCX_ID = asAdapterId("docx");

export const docxAdapter: FileAdapter<DocxSignals> = {
  id: DOCX_ID,
  level: "declarative",
  version: "1",
  // Ni almacenamiento ni modelo: la imagen sin comprimir se expresa como un rango del
  // propio `.docx`, así que este adaptador corre en cualquier contexto.
  requires: [],
  /**
   * LA EVIDENCIA NO PUEDE VENIR DE LOS BYTES MÁGICOS. `.docx`, `.xlsx`, `.pptx` y
   * `.odt` empiezan los cuatro con `PK\x03\x04`, así que la firma no distingue nada
   * (§{Los tres casos}). Lo que los separa es QUÉ ENTRADAS tiene el zip, y eso lo
   * responde la sonda sin descomprimir.
   */
  evidence: (probe: Probe) =>
    probe.zipEntries().then((entradas) =>
      entradas.includes(DOCUMENT) ? Evidence.Signature : Evidence.None,
    ),
  decompose: async (input: Source, ctx: Context) => {
    const bytes = await input.bytes();
    {
      const xml = zipEntryOf(bytes, DOCUMENT);
      if (xml === null) {
        ctx.diagnostics.notice("docx.unreadable", null, `${DOCUMENT} could not be inflated`);
        return [];
      }
      // Los rels resuelven `r:embed="rId7"` → `media/sello.png`. Sin ellos una imagen
      // no es ubicable, así que se avisa y el texto entra igual.
      const relsXml = zipEntryOf(bytes, RELS);
      const destinos = new Map<string, string>();
      if (relsXml !== null) {
        const árbol = parse(new TextDecoder("utf-8").decode(relsXml));
        for (const raíz of árbol) {
          for (const r of recolectar(raíz, "Relationship", [])) {
            const id = r.attributes?.["Id"];
            const target = r.attributes?.["Target"];
            if (id !== undefined && target !== undefined) destinos.set(id, target);
          }
        }
      }
      const directorio = zipDirectoryOf(bytes);
      const árbol = parse(new TextDecoder("utf-8").decode(xml));
      const párrafos: Nodo[] = [];
      for (const raíz of árbol) recolectar(raíz, "w:p", párrafos);

      const salida: Unit<DocxSignals>[] = [];
      for (const [i, p] of párrafos.entries()) {
        const señales = señalesDe(p);
        const blip = buscar(p, "a:blip");
        const embed = blip?.attributes?.["r:embed"] ?? null;
        if (embed !== null) {
          const target = destinos.get(embed);
          const nombre = target === undefined ? null : `word/${target}`;
          const entrada = nombre === null ? undefined : directorio.find((e) => e.name === nombre);
          if (entrada === undefined) {
            ctx.diagnostics.notice("docx.missing_media", null, `${embed} does not resolve to a zip entry`);
            continue;
          }
          if (entrada.method !== STORED) {
            // COMPRIMIDA: sus bytes NO están literales en ningún rango del `.docx`, así
            // que el recorte por referencia no se puede expresar y hay que producirlos.
            // Eso es materializar, y es la ÚNICA rama de este adaptador que necesita
            // almacenamiento — la otra mitad de los `.docx` reales, que guardan sus
            // medios sin comprimir, no lo toca.
            const inflada = zipEntryOf(bytes, entrada.name);
            if (inflada === null) {
              ctx.diagnostics.notice("docx.unreadable_media", null, `${entrada.name} could not be inflated`);
              continue;
            }
            const mime = mimeDe(entrada.name);
            // SIN ALMACENAMIENTO, `materialize` RECHAZA y la imagen se ANUNCIA en vez de
            // emitirse. No es descartar en silencio: el documento entra sin esa pieza y
            // el aviso dice cuál. «Guardar es incondicional, indexar no.»
            const ref = await ctx.materialize(inflada, mime).catch(() => null);
            if (ref === null) {
              ctx.diagnostics.notice(
                "docx.media_not_materialised",
                null,
                `${entrada.name} is deflated and this context cannot materialise`,
              );
              continue;
            }
            salida.push({
              signals: señales,
              body: { shape: "asset", ref, mime },
              location: { anchor: `img#${i}`, coordinate: { space: "source" } },
            });
            continue;
          }
          const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const h = entrada.local;
          const inicio = h + 30 + dv.getUint16(h + 26, true) + dv.getUint16(h + 28, true);
          const window: Window = { scope: "range", start: inicio, end: inicio + entrada.compressed };
          salida.push({
            signals: señales,
            body: { shape: "asset", ref: { object: input.ref.object, window }, mime: mimeDe(entrada.name) },
            location: { anchor: `img#${i}`, coordinate: { space: "source" } },
          });
          continue;
        }
        const texto = textoDe(p);
        if (texto === "") continue;
        salida.push({
          signals: señales,
          body: { shape: "text_span", text: texto, marks: [] },
          location: { anchor: `p#${i}`, coordinate: { space: "source" } },
        });
      }
      return salida;
    }
  },
  detect: (units) => {
    const run = cascade([byProminence<DocxSignals>(), byDocxStyle<DocxSignals>()])(units);
    return (u): Classification | null => run(u);
  },
};
