/// <reference path="./env.d.ts" />
/**
 * Tramo 3 — EL PISO DE TEXTO (§{El piso}, §{Qué se acepta}). Paso 4 del orden de
 * construcción.
 *
 * ES UN ADAPTADOR DEL REGISTRO Y NO UNA PROPIEDAD DEL SELECTOR, y la decisión no es de
 * simetría: la impone lo que ya está escrito en `registry.ts` y en `ir`.
 *
 *   1. `select` YA reserva el escalón. El `pool` es de dos niveles —los que superan
 *      `Floor`, y solo si no hay ninguno los que empatan en `Floor`— y `achievedLevel`
 *      sale de `evidence > Floor`, no de `a.id === 'piso'`. O sea: la parte que SÍ es
 *      del selector ya está hecha, y lo que falta es quién ocupa el escalón.
 *   2. `Selection.adapter` es `OpaqueAdapter`. Un piso que no fuera un adaptador
 *      obligaría a ensanchar ese tipo en `ir` —un contrato congelado— para expresar
 *      «ganó algo que no está en el registro».
 *   3. `ir` lo dice con todas las letras dos veces: «`Floor` reservado al adaptador
 *      piso de texto» (`Evidence`, `adapter.ts`) y «el día que haya DOS pisos la
 *      comparación por id se rompe» (`Selection`). Dos pisos son dos entradas del
 *      registro; una propiedad del selector no puede ser dos.
 *   4. EL ARGUMENTO QUE DECIDE: **el piso puede NO reclamar**. `select` devuelve `null`
 *      cuando «ni un dedicado ni el piso reclamaron estos bytes», y esa rama es el
 *      camino B de abajo. Un piso incrustado en el selector contestaría SIEMPRE, `null`
 *      sería inalcanzable, y con él se irían el estado `on_hold` y la única defensa
 *      contra indexar basura binaria. Para poder abstenerse hace falta un `EvidenceFn`
 *      sobre una sonda — que es, literalmente, un adaptador.
 *
 * EL PISO NO ACEPTA TODO, Y ESA ES LA MITAD QUE SE OLVIDA. El plan promete «nunca se
 * pierde un archivo» y eso significa que **los bytes se guardan siempre**, no que
 * siempre se produzca un fragmento. Las tres ramas, y las tres son expresables hoy:
 *
 *   A · es texto por contenido            → el piso reclama, `achievedLevel:'plain_text'`
 *   B · no es texto y hay un dedicado      → gana el dedicado; el piso no participa
 *   C · no es texto y no hay dedicado      → nadie reclama: `select` da `null`, el
 *                                            documento queda `on_hold` con su sonda
 *                                            fría, y se reprocesa el día que llegue el
 *                                            adaptador
 *
 * La B no tiene ningún adaptador que la recorra hasta el paso 6 —no existe todavía un
 * adaptador binario— pero no necesita código nuevo: es el nivel `above` del `pool`, que
 * ya está escrito. El guardián la ejercita con un adaptador SINTÉTICO, declarado como
 * tal.
 *
 * DECIDE POR CONTENIDO, NUNCA POR NOMBRE. Es el mismo principio con el que este
 * proyecto identifica un documento —`hashBytes`, por contenido y nunca por nombre— y
 * por la misma razón: la extensión miente en las dos direcciones. Un `.dat` puede ser
 * texto puro y un `.txt` puede ser basura binaria, y el caso que este adaptador existe
 * para atrapar NO es el `.txt` —que nadie escribe en una empresa— sino el `.conf`, el
 * `.ini`, el `.properties` y el `.log` sin extensión conocida. Por eso el corpus lleva
 * un `.conf` y NO lleva un `.txt`: con un `.txt` adentro, una implementación que
 * decidiera por extensión pasaría en verde y el piso sería un adaptador de `.txt`
 * disfrazado.
 *
 * EL UMBRAL ENTRA POR PARÁMETRO, y por eso esto es una FÁBRICA.
 * `PARAMETERS.intake.minPrintableProportion` es `Pending<number>` y hoy vale `null`:
 * el plan lo declara medible («curva ROC sobre un corpus etiquetado binario/texto») y
 * no lo midió. Escribir un literal acá sería el número inventado que
 * §{5 · Reconciliador} llama peor que uno pendiente. Es la misma disciplina con la que
 * `sha256` y `targetSizeChars` entran por parámetro, y no es la `MarkdownOptions` que
 * el paso 3b borró: aquello era una decisión de diseño sin tomar, esto es un parámetro
 * del contrato sin medir.
 *
 * Y LA ASIMETRÍA DEL UMBRAL VA DICHA, porque decide para qué lado se equivoca: se elige
 * el punto que minimiza el falso positivo —basura binaria indexada es costo
 * IRREVERSIBLE, «erosiona la confianza en la memoria, que es el producto entero»
 * (§{Qué se acepta})— aceptando falsos negativos —texto en `on_hold` es RECUPERABLE, se
 * reprocesa—. Rechazar es información útil; indexar basura es daño mudo.
 *
 * NO IMPORTA `yaml` NI NADA: el piso no lee ningún formato. Es la contracara exacta de
 * `markdown.ts`, y el guardián de fronteras lo impone.
 */

import {
  Evidence,
  PARAMETERS,
  asAdapterId,
  type Adapter,
  type Classification,
  type Context,
  type Source,
  type Unit,
} from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

export const TEXT_FLOOR_ID = asAdapterId("text-floor");

/**
 * El piso no lee ningún formato, así que su cara de señales es VACÍA — y vacía de
 * verdad, no `{}`: `Record<string, never>` no admite ninguna propiedad, mientras que
 * `{}` admite cualquier objeto. La diferencia importa porque `Unit<S>` es el único
 * lugar donde una señal de formato podría existir, y acá el tipo dice que no hay
 * ninguna que declarar.
 */
export type FloorSignals = Record<string, never>;

/**
 * Un code point que NO cuenta como texto: la categoría Unicode `C` (control, formato,
 * sustituto, uso privado, no asignado) más `U+FFFD`.
 *
 * `U+FFFD` va aparte y es LA SEÑAL FUERTE: es lo que `TextDecoder` pone donde los bytes
 * no eran UTF-8 válido, o sea la huella exacta de un archivo binario leído como texto.
 * Su categoría es `So` (símbolo), así que `\p{C}` NO lo atrapa — sin esta mitad un
 * `.png` mediría casi 1.0 y el piso indexaría el binario entero.
 *
 * SE ESCRIBE COMO CATEGORÍA Y NO COMO RANGO DE NÚMEROS a propósito: `0x20`, `0x7F` y
 * `0x9F` serían tres literales numéricos sueltos —lo que `params.ts` prohíbe en `ir` y
 * este paquete sigue por disciplina— y además dejarían afuera los controles C1 y los
 * caracteres de formato, que es justo lo que separa texto de binario en UTF-8.
 *
 * `U+FFFD` va por ESCAPE y no tipeado: un editor que normalice el archivo al guardar, o
 * una copia por un canal que no conserve el code point, lo volverían otra cosa sin que
 * se note — y el guardián seguiría en verde sobre un detector que ya no detecta. Es la
 * misma razón por la que el caso NFC de `ir/scripts/projection.mjs` va escapado.
 */
const UNPRINTABLE = /\p{C}|\uFFFD/u;

/** Los tres controles que SÍ son texto: sin ellos ningún archivo real pasaría. */
const PRINTABLE_CONTROL = /[\t\n\r]/u;

/**
 * La proporción de code points imprimibles de la VENTANA DE LA SONDA — exactamente la
 * magnitud que `PARAMETERS.intake.minPrintableProportion` declara y que hasta hoy nadie
 * calculaba.
 *
 * Se mide sobre la ventana y no sobre el archivo entero porque el tramo 2 se diseñó
 * ENTERO para decidir «sin haber leído el archivo entero» (§{Tramo 2}): un `.log` de
 * 200 MB no se decodifica para saber si es texto.
 *
 * UNA VENTANA VACÍA DA CERO, y es una decisión, no un caso de borde olvidado. `0/0`
 * sería `NaN` y cualquier comparación con él da `false`, o sea el mismo resultado por
 * accidente en vez de por decisión. Un archivo vacío no tiene ninguna evidencia de ser
 * texto y no hay nada que indexar en él: `on_hold` es el estado honesto, y es
 * recuperable.
 */
export const printableProportionOf = (window: Uint8Array): number => {
  const points = [...new TextDecoder("utf-8").decode(window)];
  if (points.length === ZERO) return ZERO;
  let printable = ZERO;
  for (const point of points) {
    if (!UNPRINTABLE.test(point) || PRINTABLE_CONTROL.test(point)) printable += ONE;
  }
  return printable / points.length;
};

/**
 * La única estructura que un archivo de texto tiene: la LÍNEA EN BLANCO.
 *
 * No se reflowea. Un salto de línea adentro de un bloque se conserva, porque el piso no
 * sabe si lo puso el autor o el ancho de una terminal, y adivinarlo sería leer un
 * formato que no existe. No cuesta identidad: la huella de un `text_span` se proyecta
 * por PALABRA (`projection.ts`), así que dónde caen los saltos no la mueve.
 */
type Block = { readonly text: string; readonly line: number };

/**
 * El bloque abierto se sella en UN SOLO SITIO, igual que `reopen` en
 * `emission/src/grouping.ts` y por la misma lección: el recorrido cierra en dos lugares
 * —al encontrar la línea en blanco y al terminar el archivo— y con dos copias del sellado
 * las dos pueden desincronizarse en silencio. El último bloque de un archivo sin línea
 * final en blanco es exactamente el caso que la copia olvidada se come.
 */
const sealOf = (open: { readonly text: readonly string[]; readonly line: number }): Block => ({
  text: open.text.join("\n"),
  line: open.line,
});

const blocksOfText = (text: string): readonly Block[] => {
  const out: Block[] = [];
  let open: { text: string[]; line: number } | null = null;
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") {
      if (open !== null) out.push(sealOf(open));
      open = null;
      continue;
    }
    if (open === null) open = { text: [line], line: i };
    else open.text.push(line);
  }
  if (open !== null) out.push(sealOf(open));
  return out;
};

/**
 * El piso, con su umbral. Los DOS casilleros y nada más, igual que el `.md`.
 *
 * `evidence` responde `Floor` y NUNCA más alto: es el escalón que la escala le reserva,
 * y subirlo un peldaño le ganaría archivos a adaptadores dedicados que sí saben leerlos
 * (§{El selector}). Y responde `None` —no `Floor`— cuando el contenido no es texto:
 * `Floor` significa «lo puedo leer como texto plano», y sobre un `.png` eso es falso.
 *
 * `detect` se ABSTIENE SIEMPRE, sin ninguna cascada. Es C1 llevado al límite: un archivo
 * de texto plano no DECLARA nada sobre sus bloques, así que quien responde es el piso
 * físico de `opaqueOf` (`roleFromBody` + `level:'physical'` + `attribution:null`), y la
 * métrica de §{Observabilidad} lee exactamente eso — «este documento lo resolvió el piso
 * entero», que es la verdad. Una cascada acá inventaría títulos a partir de líneas
 * cortas, que es adivinar un formato inexistente y estamparlo como si el documento lo
 * hubiera dicho.
 *
 * `level: 'physical'` por lo mismo: es el escalón en el que este adaptador trabaja, y
 * `certaintyOfLevel('physical')` da `declared` porque la FORMA se leyó —es texto, y eso
 * es un hecho de los bytes— aunque la estructura no exista.
 */
export const textFloorAdapter = (
  minPrintableProportion: number,
): Adapter<FloorSignals, Source> => ({
  id: TEXT_FLOOR_ID,
  level: "physical",
  version: "1",
  evidence: (probe) =>
    Promise.resolve(
      printableProportionOf(probe.magicBytes) >= minPrintableProportion
        ? Evidence.Floor
        : Evidence.None,
    ),
  decompose: (input: Source, _ctx: Context) =>
    input.bytes().then((bytes) =>
      blocksOfText(new TextDecoder("utf-8").decode(bytes)).map(
        (b): Unit<FloorSignals> => ({
          signals: {},
          body: { shape: "text_span", text: b.text, marks: [] },
          location: { anchor: `line#${b.line}`, coordinate: { space: "source" } },
        }),
      ),
    ),
  detect: () => (): Classification | null => null,
});
