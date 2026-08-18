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
 * SUPERADO POR P14, Y SE DEJA ESCRITO ACÁ PARA QUE NADIE LEA EL PÁRRAFO DE ARRIBA COMO
 * VIGENTE. La medición del rango es correcta y la conclusión no: `ref.object` entra en la
 * huella, así que expresar la imagen como una ventana sobre el contenedor le da al mismo
 * logo TANTAS IDENTIDADES COMO CONTENEDORES lo lleven, y el caché de reconocimiento se
 * indexa por ahí. La decisión tomada es materializar todo asset cuyos bytes ya existan y
 * dejar la ventana por referencia para los que todavía no existen —el rectángulo de un
 * PDF—. Está en Puntos abiertos, P14, con el costo y lo que mueve.
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
const STYLES = "word/styles.xml";
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
  /**
   * El tamaño que el DOCUMENTO declara en `word/styles.xml`, constante en todas las
   * unidades. `null` = el documento tampoco lo declara.
   *
   * VA SEPARADO DE `size` Y NO RESUELTO ADENTRO DE ÉL, y eso conserva entera la frase
   * que abre este tipo: `size` es lo que el PÁRRAFO declara, y meterle el heredado lo
   * volvería mentira. Quien los combina es el eslabón que necesita la combinación.
   */
  readonly defaultSize: number | null;
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

const señalesDe = (p: Nodo, defaultSize: number | null): DocxSignals => ({
  style: buscar(p, "w:pStyle")?.attributes?.["w:val"] ?? null,
  size: enteroDe(buscar(p, "w:sz")),
  defaultSize,
  bold: buscar(p, "w:b") !== null,
});

/**
 * EL TAMAÑO QUE EL DOCUMENTO DECLARA, leído de `word/styles.xml`. `null` = no lo
 * declara, o no hay `styles.xml`, o no infla — un `.docx` sin estilos no es un archivo
 * roto, así que se abstiene sin avisar, igual que el resto del adaptador.
 *
 * EL ORDEN LO FIJA EL FORMATO, no una preferencia: el estilo por defecto de párrafo
 * —`Normal` en la práctica— PISA a `docDefaults`, que es el escalón más bajo de la
 * cascada de Word. Por eso se busca primero el estilo y solo después el default.
 *
 * NO SE BUSCA `w:sz` SOBRE LA RAÍZ, y esa es la trampa de este archivo: `buscar` es un
 * DFS de primer match, así que sobre `w:styles` entero devolvería el `w:sz` del PRIMER
 * estilo que aparezca —casi siempre `Heading1`—, y el adaptador terminaría creyendo que
 * el cuerpo del documento mide lo que miden sus títulos. La búsqueda se acota primero al
 * nodo del estilo, y recién ahí se baja.
 */
const tamañoPorDefectoDe = (bytes: Uint8Array): number | null => {
  const xml = zipEntryOf(bytes, STYLES);
  if (xml === null) return null;
  const raíz = parse(new TextDecoder().decode(xml)) as unknown[];
  const estilos = raíz.flatMap((n) => (esNodo(n) ? recolectar(n, "w:style", []) : []));
  const normal = estilos.find(
    (e) =>
      e.attributes?.["w:styleId"] === "Normal" ||
      (e.attributes?.["w:default"] === "1" && e.attributes?.["w:type"] === "paragraph"),
  );
  const delEstilo = normal === undefined ? null : enteroDe(buscar(normal, "w:sz"));
  if (delEstilo !== null) return delEstilo;
  const defaults = raíz.flatMap((n) => (esNodo(n) ? recolectar(n, "w:rPrDefault", []) : []));
  const primero = defaults[0];
  return primero === undefined ? null : enteroDe(buscar(primero, "w:sz"));
};

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
 * EL TAMAÑO QUE RIGE UNA UNIDAD: lo que la corrida declara, y si no declara, lo que
 * declara el documento. Es la cascada de OOXML —`w:r/w:rPr/w:sz` pisa al estilo, y el
 * estilo pisa a `docDefaults`— resuelta en una línea.
 *
 * SE APLICA ANTES DE CONTAR, y ahí está toda la decisión de este bloque. La versión
 * obvia —«saco el modal de lo declarado, y si queda `null` uso el del documento»—
 * ARREGLA EL CASO RARO Y DEJA PASAR EL FRECUENTE, y se midió: en el documento típico de
 * este hueco el cuerpo NO declara y el título SÍ, así que el histograma queda `{32: 1}`,
 * el modal queda 32 —el tamaño del propio título— y `32 <= 32` lo mata. El respaldo
 * nunca se ejecutaría, porque el modal nunca es `null`.
 *
 * Dicho al derecho: el default NO COMPITE con el modal, lo ALIMENTA. Ocupa el lugar de
 * las unidades que se abstuvieron, que es justamente lo que las vuelve el CUERPO en vez
 * de invisibles. Entre unidades sigue ganando el modal OBSERVADO, y tiene que seguir
 * ganando: un `.docx` puede declarar `Normal = 22` y tener sus cuarenta párrafos
 * pisados a 24 por corrida, y ahí el 22 es una declaración muerta.
 */
const efectivo = (s: DocxSignals): number | null => s.size ?? s.defaultSize;

/**
 * EL SEGUNDO ESLABÓN — los títulos que el formato NO declara (§{`porProminencia`}).
 *
 * ES RELATIVO AL DOCUMENTO Y POR ESO ES UNA FÁBRICA. El tamaño del cuerpo no es un
 * número que se pueda escribir acá: es el tamaño MÁS FRECUENTE de este documento. Un
 * párrafo destacado es el que está por encima de ese modo y en negrita — las dos
 * cosas, porque solo el tamaño confunde una cita destacada con un título, y sola la
 * negrita confunde una palabra enfatizada en un párrafo largo.
 *
 * EL CUERPO HEREDADO CUENTA COMO CUERPO, y hasta la deuda del paso 7 no contaba. Un
 * documento que declara el tamaño SOLO en `word/styles.xml` dejaba a este eslabón sin
 * modal y lo hacía abstenerse para todos, así que perdía sus títulos sin estilo y caía
 * entero al piso — la mitad de los documentos corporativos, no un caso raro.
 *
 * LO QUE NO ALCANZABA ERA EL RESPALDO OBVIO, y ese es el hallazgo de este bloque. «Si
 * el modal queda `null`, uso el de `styles.xml`» arregla el caso raro y deja pasar el
 * frecuente: en el documento típico el cuerpo NO declara y el título SÍ, así que el
 * modal NO queda `null` — queda igual al tamaño del propio título, y la comparación se
 * cumple contra sí misma. El respaldo nunca se ejecutaría. Por eso la cascada se
 * resuelve POR UNIDAD y antes de contar (ver `efectivo`), y por eso el fixture del
 * banco declara `docDefaults` y `Normal` en desacuerdo: sin eso, el orden de precedencia
 * que el formato fija no tendría observador.
 *
 * Sigue siendo cierto que sin cuerpo conocido «más grande» no significa nada: un
 * documento que no declara el tamaño en ningún lado deja el modal en `null` y este
 * eslabón se abstiene para todos, igual que antes.
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
      const s = efectivo(u.signals);
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
      const tamaño = efectivo(u.signals);
      if (cuerpo === null || tamaño === null) return null;
      if (!u.signals.bold || tamaño <= cuerpo) return null;
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

      // UNA VEZ POR DOCUMENTO, no por párrafo: es un dato del archivo, y leerlo adentro
      // del bucle abriría e inflaría `styles.xml` una vez por unidad.
      const porDefecto = tamañoPorDefectoDe(bytes);

      const salida: Unit<DocxSignals>[] = [];
      for (const [i, p] of párrafos.entries()) {
        const señales = señalesDe(p, porDefecto);
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
              // DE DÓNDE SALIÓ, y acá el campo hace su trabajo entero: la dirección
              // del objeto es el hash de SU CONTENIDO, así que la misma imagen en
              // cincuenta documentos da una sola clave —a propósito— y con ella se
              // pierde de cuál salió esta. `whence` es lo único que lo conserva.
              whence: { container: input.ref.object, path: entrada.name },
              location: { anchor: `img#${i}`, coordinate: { space: "source" } },
            });
            continue;
          }
          const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const h = entrada.local;
          const inicio = h + 30 + dv.getUint16(h + 26, true) + dv.getUint16(h + 28, true);
          const window: Window = { scope: "range", start: inicio, end: inicio + entrada.compressed };
          // LA MISMA PROCEDENCIA QUE LA OTRA RAMA, y no `null`, aunque acá el objeto ya
          // sea el contenedor. La ventana dice DÓNDE EN BYTES; no dice cómo se llamaba.
          // Y que un `.docx` guarde su logo comprimido o sin comprimir es una decisión
          // del escritor de Word: si de eso dependiera que la pieza sepa de dónde salió,
          // la respuesta a «de dónde vino esta imagen» cambiaría según quién exportó el
          // archivo. Va ARRIBA de `body` y no abajo para que el par de líneas sea un
          // ancla de mutación única: con la sangría sola no alcanza, porque la de esta
          // rama es SUBCADENA de la de la otra.
          salida.push({
            signals: señales,
            whence: { container: input.ref.object, path: entrada.name },
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
          whence: null,
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
