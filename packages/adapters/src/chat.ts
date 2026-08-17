/**
 * El adaptador de CHAT (§{Chat}) — el canal que más tensiona la abstracción.
 *
 * El plan lo pone en el paso 5 y no en el 10 a propósito: «descubrirlo roto en el
 * paso 5 cuesta un día; en el 10, la arquitectura» (§{Orden}). Lo que prueba es una
 * sola frase, y es la más fuerte del diseño:
 *
 *     «Que el canal más distinto entre por la misma puerta es la evidencia más
 *      fuerte de que la descomposición es correcta.» (§{Chat})
 *
 * UN CHAT NO TIENE FORMA DE DOCUMENTO. No tiene extensión, ni bytes que sondear, ni
 * un `Content-Type`; no llega por una subida sino por una herramienta MCP; y no tiene
 * un documento del que heredar la autoría, porque cada mensaje trae la suya. Si
 * después de todo eso necesitara UNA excepción aguas abajo, la cintura tendría forma
 * de documento y no nos habríamos dado cuenta.
 *
 * NO LA NECESITA, y se puede leer en este archivo: las unidades que salen de acá son
 * las mismas seis formas, las compone el MISMO `recognizerOf` que compone un `.docx`,
 * y de ahí en adelante —cascada, piso, emisión, migas de pan, fragmentación— no hay
 * una línea que pregunte de dónde vino.
 *
 * LO QUE SÍ ES DISTINTO ESTÁ EN EL TIPO Y NO EN UNA RAMA. Es un `ChannelAdapter`, no
 * un `FileAdapter`:
 *
 *   · NO tiene `evidence`, así que `opaqueOf` no lo compila y no puede entrar al
 *     registro. Y no es una restricción: es que no hay concurso que ganar. El
 *     selector responde «¿quién sabe leer estos bytes?», una pregunta que solo existe
 *     bajo incertidumbre, y acá quien invoca YA SABE cuál es el adaptador. La versión
 *     del plan lo hacía competir con `porOrigen('chat', Evidencia.Firma)` y ganar
 *     siempre; eso obligaba a fabricarle una sonda con cinco campos que hablan de un
 *     archivo (`extension`, `declaredMime`, `size` en bytes, `magicBytes`,
 *     `detectedFormat`) y ninguno de los cinco es un hecho sobre un mensaje.
 *   · `decompose` devuelve `AuthoredUnit`, con la autoría OBLIGATORIA. «Esto lo dijo
 *     el CFO en marzo» es la mitad del valor de la memoria (§{Tramo 3 › Qué sale}), y
 *     un mensaje no tiene de quién heredarla.
 *
 * Y QUE EL CANAL CHAT NO SEA EL ADAPTADOR CHAT ES AHORA DECIBLE. Un PDF que alguien
 * suelta en la conversación es `{kind:'bytes', channel:'chat'}`: un archivo, que pasa
 * por el selector como cualquier otro. Este adaptador solo ve lo que llega por
 * `{kind:'message'}`. Mientras el chat competía por la sonda las dos cosas se
 * escribían igual, y `Origin` documentaba la colisión como un costo asumido.
 *
 * LO QUE ESTE ADAPTADOR NO CUBRE, y es el punto abierto P5 del plan: NO ES SLACK NI
 * TEAMS. Esas son integraciones y se parecen mucho más a un documento —un hilo es un
 * contenedor y cada mensaje una unidad con su autoría—, pero tienen algo que ningún
 * documento tiene: NADIE ELIGIÓ SUBIRLO. Hace falta un filtro de relevancia previo
 * que no existe en ninguna otra entrada, y ese filtro es capa 2/4, no este pipeline.
 * Acá lo que llega YA VIENE CURADO: una afirmación, no una transcripción —
 * precisamente porque extraer hechos de una conversación exigiría un modelo de
 * lenguaje en el camino de escritura (§{Chat}).
 */

import {
  asAdapterId,
  type ChannelAdapter,
  type Classification,
  type Context,
  type AuthoredUnit,
  type Mark,
  type RawAuthorship,
} from "@savia-os/ir";

/** `id: 'chat'` (§{Chat}), marcado. Un literal suelto no es asignable a `AdapterId`. */
export const CHAT_ID = asAdapterId("chat");

/**
 * CERO señales, y el tipo lo dice: `Record<string, never>` es el `{}` de §{Chat}
 * escrito de forma que un campo nuevo no compile.
 *
 * Es el único adaptador que puede tenerlo vacío con honestidad. Las señales son «lo
 * específico del formato, que MUERE acá» (`Unit`), y un mensaje curado no tiene
 * formato: nadie eligió un `styleId` ni un cuerpo de letra. Que la cara de señales
 * quede vacía sin que nada más cambie es, por sí solo, media prueba de §{Chat}.
 */
export type ChatSignals = Record<string, never>;

/** Un párrafo de la afirmación, tal como lo manda quien invoca (§{Chat}). */
export type Paragraph = {
  readonly text: string;
  readonly marks: readonly Mark[];
};

/**
 * LO QUE RECIBE EL ADAPTADOR: una afirmación curada, no una transcripción.
 *
 * UN mensaje, UN autor. No es una limitación provisional: es P5. Un hilo con varios
 * autores es Slack, y Slack necesita el filtro de relevancia que no existe. Cuando
 * exista, un hilo serán varias afirmaciones, no un `Message` con autores adentro.
 *
 * `author` es una `RawAuthorship` de `ir` y no una copia con los mismos tres campos:
 * dos tipos estructuralmente iguales divergen en silencio, que es justo lo que el
 * README de `ir` prohíbe.
 */
export type Message = {
  readonly author: RawAuthorship;
  readonly paragraphs: readonly Paragraph[];
};

/**
 * Los DOS casilleros, y nada más. Igual que el `.md` y que el piso.
 *
 * `level: 'physical'` con el argumento del piso, no con el de un adaptador dedicado:
 * es el escalón en el que este adaptador trabaja, y acá la FORMA se leyó —quien
 * invocó dijo «estos son los párrafos», y eso es un hecho— mientras que la estructura
 * no existe. `certaintyOfLevel('physical')` da `declared`, que es lo correcto.
 *
 * `detect` SE ABSTIENE SIEMPRE, sin cascada, y el plan lo anota en la misma línea:
 * «se abstiene: el piso responde 'parrafo'». Quien resuelve es el piso físico de
 * `recognizerOf` (`roleFromBody` + `level:'physical'` + `attribution:null`), y con
 * `ROLE_BY_SHAPE.text_span = 'paragraph'` el rol que sale es exactamente ese. Una
 * cascada acá inventaría títulos a partir de mensajes cortos.
 *
 * Y LA ABSTENCIÓN NO ABRE SCOPE, que es lo que impide que todo chat sea un árbol
 * inventado (`emission/synthetic.ts`): los párrafos cuelgan planos de la raíz, porque
 * «un mensaje no tiene página, hoja ni sección» (`location.ts`). Por eso la
 * coordenada es `{space:'source'}` —toda la fuente— y no una página que no existe.
 */
export const chatAdapter: ChannelAdapter<ChatSignals, Message> = {
  id: CHAT_ID,
  level: "physical",
  version: "1",
  // Bytes y parseo: no necesita nada del núcleo, así que corre en cualquier contexto.
  requires: [],
  decompose: (input: Message, _ctx: Context) =>
    Promise.resolve(
      input.paragraphs.map(
        (p, i): AuthoredUnit<ChatSignals> => ({
          signals: {},
          body: { shape: "text_span", text: p.text, marks: p.marks },
          location: { anchor: `msg#${i}`, coordinate: { space: "source" } },
          ownAuthorship: input.author,
        }),
      ),
    ),
  detect: () => (): Classification | null => null,
};
