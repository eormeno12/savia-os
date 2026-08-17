/**
 * El adaptador `imagen` (§{La delegación es emergente}) — el que vuelve cierta la
 * frase del paso 6:
 *
 *     «Una imagen es un documento como cualquier otro.»
 *
 * Y no la vuelve cierta escribiendo nada especial. Emite las mismas seis formas que
 * el `.md`, lo compone el MISMO `recognizerOf`, y aguas abajo —fragmentación,
 * migas, huellas— no hay una línea que pregunte de dónde vino. Lo único que este
 * archivo tiene y los otros tres no es una declaración de UNA palabra:
 * `requires: ["perceive"]`.
 *
 * ESE `requires` ES EL CORTE ENTRE EL HILO RÁPIDO Y EL WORKER, y no es una regla que
 * alguien respeta: el contexto del request trae `perceive: null`, así que el núcleo
 * compara antes de invocar y este adaptador NO PUEDE correr ahí. Su asset queda
 * anotado y lo levanta el worker, que sí lo trae. «Lo pesado no bloquea» deja de ser
 * disciplina y pasa a ser algo que ese contexto no puede hacer.
 *
 * LA UNIFICACIÓN QUE HACE POSIBLE TODO ESTO es de la reforma de la delegación
 * (§{La delegación es emergente}): antes había DOS mecanismos —`modeloLayout` para
 * páginas escaneadas y un enriquecimiento `descripción` para imágenes— y ahora hay
 * uno solo. Toda imagen se descompone en bloques, y la descripción es el CASO
 * DEGENERADO: cuando el layout encuentra una sola región y es pictórica.
 *
 *     página escaneada  →  heading · paragraph · grid
 *     foto de un PPT    →  heading · viñetas
 *     captura de tabla  →  un grid
 *     foto de un gato   →  UN asset = lo que entró  →  punto fijo, fondo
 *
 * Las cuatro filas salen del mismo código. La última no lleva un caso especial: sale
 * sola de que el modelo devuelva honestamente una sola región pictórica.
 */

import {
  Evidence,
  PARAMETERS,
  asAdapterId,
  type Body,
  type Box,
  type Classification,
  type Context,
  type FileAdapter,
  type Probe,
  type Region,
  type Source,
  type Unit,
  type Window,
  windowKey,
} from "@savia-os/ir";

import { cascade } from "./registry.js";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;
const { unitsPerFrame: FRAME } = PARAMETERS.geometry;

export const IMAGE_ID = asAdapterId("image");

/**
 * Lo específico de este formato, que MUERE en el borde: dónde estaba la región y
 * cuánta confianza declaró el modelo.
 *
 * Las dos las lee la cascada de abajo y ninguna cruza. Es la misma disciplina que
 * `styleId` en un `.docx`: la cara de señales existe para que «cero fugas de formato
 * en el nodo» (§{Invariantes}) sea cierto por construcción y no por revisión.
 */
export type ImageSignals = {
  readonly box: Box;
  readonly confidence: number;
};

// ─────────────────────────────── Evidencia ───────────────────────────────────

/**
 * Las firmas son HECHOS DE CADA FORMATO, no umbrales: no deciden un comportamiento
 * que se pueda calibrar, identifican bytes que solo un PNG puede tener. Por eso van
 * literales acá y no en `PARAMETERS`, igual que `ROLES.length === 15` es un literal
 * de tipo y no una medición.
 */
const SIGNATURES: readonly (readonly number[])[] = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], //       JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF87a / GIF89a
];

const EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
]);

const IMAGE_PREFIX = "image/";

const startsWith = (haystack: Uint8Array, needle: readonly number[]): boolean =>
  needle.length <= haystack.length && needle.every((b, i) => haystack[i] === b);

/**
 * LAS TRES ALTURAS DE LA ESCALA, Y EL ORDEN IMPORTA — «contenido sobre extensión»
 * (§{Tramo 2 › Decisiones}).
 *
 * `Structure` PARA EL MIME DECLARADO POR EL PADRE es la decisión del paso 6, y es lo
 * que vuelve seleccionable a un delegado sin bytes propios. La página 3 de un PDF es
 * un rectángulo: no tiene firma que oler —y fabricarle una sería devolver los bytes
 * del PDF entero, que es el bug H9—, así que la única evidencia disponible es que el
 * adaptador de PDF, que sí abrió el archivo, declaró `image/png`.
 *
 * Y VA EN `Structure` Y NO EN `Signature` a propósito. `Signature` está definida como
 * «firma inequívoca EN EL CONTENIDO» (§{Evidencia}) y un mime declarado no es
 * contenido: es el testimonio de quien lo leyó. `Structure` significa «el formato lo
 * declaró», que es exactamente esto — el padre ES el formato. `adapter.ts` dejó
 * escrito que el día que un adaptador quisiera ganar por origen había que tomar esta
 * decisión antes; es hoy, y esta es.
 */
const evidenceOf = (probe: Probe): Evidence => {
  if (SIGNATURES.some((sig) => startsWith(probe.magicBytes, sig))) {
    return Evidence.Signature;
  }
  if (probe.declaredMime !== null && probe.declaredMime.startsWith(IMAGE_PREFIX)) {
    return Evidence.Structure;
  }
  if (probe.extension !== null && EXTENSIONS.has(probe.extension)) {
    return Evidence.Extension;
  }
  return Evidence.None;
};

// ─────────────────────────────── Descomponer ─────────────────────────────────

/** La ventana de una región, con el caso degenerado dicho: si la cubre toda, es toda. */
const windowOfBox = (box: Box): Window =>
  box.x === ZERO && box.y === ZERO && box.width === FRAME && box.height === FRAME
    ? { scope: "whole" }
    : { scope: "region", box };

/**
 * Región → unidad. Dos formas y ninguna decisión de rol: eso es de la cascada.
 *
 * `text: null` ⇒ `asset`, y ahí nace el caso degenerado. Si el modelo devuelve UNA
 * sola región pictórica que cubre el marco entero, esta función emite un `asset` con
 * `window: 'whole'` — o sea exactamente lo que entró. El punto fijo lo detecta
 * comparando refs, sin que este archivo tenga una rama que diga «esto es una foto y
 * no se descompone». Se descubre haciéndolo, no declarándolo (§{Dónde frena}).
 *
 * El `mime` sale del de la fuente y no de una re-detección: una región de una imagen
 * es del mismo formato que la imagen, y `Body.asset.mime` está fuera de la huella
 * justamente para que una re-detección no mueva identidades (PROVISIONAL(R1)).
 */
const bodyOf = (source: Source, region: Region): Body =>
  region.text === null
    ? {
        shape: "asset",
        ref: { object: source.ref.object, window: windowOfBox(region.box) },
        mime: source.mime,
      }
    : { shape: "text_span", text: region.text, marks: [] };

/**
 * La clave del caché, y sale SIN HASHEAR NADA porque el almacenamiento es
 * direccionado por contenido: `ObjectKey` ya *es* el hash. Con esto los 200
 * encabezados que repiten el mismo logo son UNA invocación al modelo y 199 aciertos
 * (§{La delegación es emergente}), y la versión invalida sola — `version` cubre el
 * adaptador entero, `decompose` incluido (PROVISIONAL(#25/C20)).
 */
const cacheKeyOf = (version: string, source: Source): string =>
  `${IMAGE_ID}:${version}:${source.ref.object}:${windowKey(source.ref.window)}`;

// ─────────────────────────────── Clasificar ──────────────────────────────────

/**
 * UN SOLO ESLABÓN, y perceptual. Lo que el modelo devuelve son regiones con caja y
 * confianza; el rol lo decide acá, mirando geometría — que es la misma jugada que
 * `porProminencia` en un `.docx`, un escalón más abajo en la escalera.
 *
 * `porArriba`: la región más alta del marco, si además es la única a esa altura, es
 * el título. No inventa nada que el documento no muestre —la posición es un hecho de
 * la imagen— y por ser `perceptual` viaja con `certainty: 'inferred'` y con la
 * confianza que declaró el modelo, que es lo que permite que una skill decida no
 * citarla como autoridad (§{La escalera}).
 *
 * NO HAY UN ESLABÓN POR TAMAÑO DE LETRA, y la ausencia es deliberada: `Region` no
 * trae altura de tipografía y agregarla sería pedirle al modelo un dato de formato
 * para que este archivo ramifique sobre él. Cuando se mida que hace falta, entra como
 * un eslabón más — que es para lo que la cascada existe.
 */
const topmostIsHeading = <S extends ImageSignals>(units: readonly Unit<S>[]) => {
  const tops = units.map((u) => u.signals.box.y);
  const highest = tops.length === ZERO ? ZERO : Math.min(...tops);
  const howManyAtTop = tops.filter((y) => y === highest).length;
  return (u: Unit<S>): Classification | null =>
    howManyAtTop === ONE && u.signals.box.y === highest && u.body.shape === "text_span"
      ? { role: "heading", hint: { linkage: "none" } }
      : null;
};

// ─────────────────────────────── El adaptador ────────────────────────────────

const VERSION = "1";

export const imageAdapter: FileAdapter<ImageSignals> = {
  id: IMAGE_ID,
  level: "perceptual",
  version: VERSION,
  /**
   * LA ÚNICA LÍNEA QUE ESTE ADAPTADOR TIENE Y LOS OTROS TRES NO.
   *
   * Con ella, el núcleo sabe que en un contexto sin modelo este adaptador ni se
   * intenta, y su asset queda anotado en vez de darse por terminado. Sin ella, «no lo
   * intenté» y «lo intenté y tocó fondo» serían el mismo `asset` sin hijos, y la foto
   * de un gato volvería a la cola en cada pasada, para siempre.
   */
  requires: ["perceive"],
  evidence: (probe) => Promise.resolve(evidenceOf(probe)),
  decompose: async (source: Source, ctx: Context): Promise<readonly Unit<ImageSignals>[]> => {
    const { perceive } = ctx;
    if (perceive === null) {
      // INALCANZABLE SI EL NÚCLEO CUMPLE, y por eso TIRA en vez de degradar. Llegar
      // acá significa que alguien invocó sin mirar `requires`, o sea que el contrato
      // que separa «no lo intenté» de «tocó fondo» está roto. Devolver `[]` sería
      // indistinguible de una imagen vacía y el asset se daría por terminado: el
      // documento saldría diciendo que no había nada que leer. Un fallo ruidoso es
      // recuperable; ese silencio no.
      throw new Error(
        "ADAPTERS-ERR: the image adapter was invoked without the `perceive` capability — " +
          "the core must check `Adapter.requires` against the context before invoking",
      );
    }
    const regions = await ctx.invoke(cacheKeyOf(VERSION, source), () => perceive(source));
    return regions.map(
      (region, i): Unit<ImageSignals> => ({
        signals: { box: region.box, confidence: region.confidence },
        body: bodyOf(source, region),
        // `visual` es la coordenada que `location.ts` reserva para esto, y lleva la
        // caja: es lo que permite citar «acá, en esta parte de la imagen».
        location: { anchor: `r#${i}`, coordinate: { space: "visual", box: region.box } },
      }),
    );
  },
  detect: cascade([
    {
      name: "topmost",
      level: "perceptual",
      detect: topmostIsHeading,
    },
  ]),
};
