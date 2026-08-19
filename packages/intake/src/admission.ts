/**
 * LA PUERTA DEL TRAMO 1 — su mitad de RECHAZO, que es la única que ningún adaptador
 * puede tomar (§{Tramo 1 › El orden importa}, §{Tramo 1 › Decisiones}).
 *
 * LA MITAD QUE FALTA NO ES LA QUE PARECE, y conviene decirlo antes que nada porque
 * este paquete existe por la diferencia. El plan reparte el tramo 1 en cinco pasos y
 * el primero dice «validar en la puerta: tamaño · formato legible · no cifrado ·
 * antivirus». De esos cuatro:
 *
 *   · **el formato legible YA SE DECIDE**, y no acá. «¿Va a salir algo útil de acá?»
 *     lo contesta el tramo 2 entero: `select` devuelve `null` cuando nadie reclama,
 *     el piso de texto se ABSTIENE sobre binario, y sale `Run.onHold` con la sonda
 *     adentro. Reimplementarlo sería tener dos respuestas para una pregunta.
 *   · **el tamaño NO PASA POR ACÁ NUNCA.** Con subida prefirmada se impone como
 *     `content-length-range` del permiso, o sea que un archivo demasiado grande no
 *     llega a ser un documento. Ver `RejectionReason`.
 *   · quedan **cifrado** y **antivirus**, que son los dos de esta puerta.
 *
 * Y LA PUERTA NO PREVIENE, DETECTA. «La API no toca bytes: emite el permiso y después
 * verifica que el objeto llegó» (§{Tramo 1 › Decisiones}), así que cuando nos
 * enteramos de que hay bytes ya están en el bucket. La puerta es LA PRIMERA LECTURA
 * DEL OBJETO, y de ahí sale que `received` signifique «guardado pero no escaneado» y
 * que a `rejected` se llegue desde `recognizing`. El razonamiento completo, con las
 * cuatro preguntas que destrabó, está en `TRANSITIONS` de `@savia-os/ir`.
 */

import type { ObjectKey } from "@savia-os/ir";

/**
 * EL VEREDICTO DEL ANTIVIRUS (GLOSARIO.md, P27). Vocabulario cerrado: son DATOS —van
 * a Postgres— y por eso se escriben acá una vez.
 *
 * EL TERCERO ES EL QUE IMPORTA. `clean` e `infected` son los dos que cualquiera
 * escribe; `unavailable` es el que decide si este sistema es fail-open o fail-closed,
 * y sin él no hay dónde poner «el escáner no contestó» salvo adentro de uno de los
 * otros dos, que es como fail-open entra sin que nadie lo haya decidido.
 *
 * Dice que **el escáner** no contestó, no que el archivo sea raro: `unknown`
 * describiría al archivo y `error` sugeriría una falla nuestra o suya, cuando un
 * timeout no es ninguna de las dos.
 */
export const SCAN_VERDICTS = ["clean", "infected", "unavailable"] as const;
export type ScanVerdict = (typeof SCAN_VERDICTS)[number];

/**
 * EL SUJETO DEL ESCANEO ES EL OBJETO, Y ESO LO IMPONE ESTA FIRMA (GLOSARIO.md, P27).
 *
 * `outputs.ts` deja escrito que «todo objeto de nuestro bucket se escanea una vez,
 * indexado por su hash de contenido», y esa frase solo es EXPRESABLE si quien escanea
 * recibe la clave. Con una firma de solos bytes, memoizar sería una convención que
 * ningún tipo puede imponer y que la primera implementación apurada se saltea; con la
 * clave adentro, el memo es la forma natural de escribirla.
 *
 * Lo que compra es concreto y grande: como el almacenamiento se direcciona por
 * contenido, **el mismo logo adentro de cincuenta documentos se escanea UNA VEZ**. El
 * dedupe que ya existe paga el antivirus. Si el veredicto colgara del documento en vez
 * del objeto, cada reingesta lo pagaría de nuevo — y reingerir es barato por diseño.
 *
 * NO LA LLAMA `admit`, y es deliberado: ver el docstring de esa función.
 */
export type ScanFn = (object: ObjectKey, bytes: Uint8Array) => Promise<ScanVerdict>;

/**
 * LOS DOS MOTIVOS DE RECHAZO, y son exactamente los que el plan nombra menos uno
 * (GLOSARIO.md, P28).
 *
 * «Se rechaza solo en la puerta: cifrado sin contraseña, tamaño excedido, y lo que
 * marque el antivirus» (§{Tramo 1 › Decisiones}). **El tamaño no está y no es un
 * olvido**: con subida prefirmada se impone como política del permiso
 * (`content-length-range`), que es la única palanca PREVENTIVA que la subida directa
 * deja en pie. Un `oversize` acá sería un valor que no puede ocurrir, y un valor que
 * no puede ocurrir es peor que ninguno porque invita a escribir la rama que lo produce.
 */
export const REJECTION_REASONS = ["encrypted", "infected"] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * LO QUE LA PUERTA DECIDIÓ, en tres brazos (GLOSARIO.md, P26).
 *
 * El tercero —`retry`— es la razón de que este tipo exista en vez de un booleano.
 * Codifica FAIL-CLOSED: si el escáner no contestó, el documento **no avanza y no se
 * rechaza**; se queda en `recognizing` y se reintenta, y tras `maxRetries` cae a
 * `failed` con alerta, que es la única transición que el plan ya nombraba para eso.
 *
 * EL COSTO VA ESCRITO PORQUE ES REAL: si el escáner se cae una hora, nada se indexa
 * esa hora. Se elige igual, y la razón es que «antivirus obligatorio — requisito
 * enterprise, no opcional» (§{Tramo 1 › Decisiones}) es FALSO bajo cualquier otra
 * política. Fail-open indexa contenido que nadie miró, y retractar un fragmento ya
 * vectorizado no es una operación que este pipeline tenga.
 */
export type Admission =
  | { readonly kind: "admitted" }
  | { readonly kind: "rejected"; readonly reason: RejectionReason }
  | { readonly kind: "retry" };

/**
 * LOS DOS HECHOS QUE LA PUERTA NECESITA, y ninguno lo establece ella.
 *
 * `encrypted` ES EVIDENCIA, Y LA EVIDENCIA ES DEL TRAMO 2. Saber si un archivo está
 * «cifrado sin contraseña» es saber de formatos —el bit 0 del *general purpose bit
 * flag* de un zip, el `/Encrypt` del tráiler de un PDF—, y ese conocimiento vive en
 * `@savia-os/adapters` por diseño. Calcularlo acá duplicaría el lector de zip y sería
 * la re-declaración que el README de `ir` prohíbe.
 */
export type Gateway = {
  readonly scan: ScanVerdict;
  readonly encrypted: boolean;
};

/**
 * LA PUERTA. Pura, sincrónica y total: seis casos y ni uno más.
 *
 * NO RECIBE LOS BYTES NI LA `ScanFn`, Y ESA ES LA GARANTÍA. Es la misma decisión que
 * `fingerprintOf` recibiendo `Body` en vez del nodo: **lo que la firma no admite no se
 * puede colar**. Con los bytes adentro, alguien escribe el escaneo acá, lo envuelve en
 * un `try/catch`, y el `catch` decide fail-open sin que la decisión aparezca en ningún
 * lado. Con los dos hechos ya establecidos, el fail-closed está en la TABLA y se puede
 * barrer entera: tres veredictos × dos valores de `encrypted`, y el guardián recorre
 * los seis.
 *
 * EL ORDEN DE LAS DOS PRIMERAS RAMAS DECIDE ALGO, y no es estético. Un archivo
 * infectado Y cifrado se rechaza por `infected`: el mensaje al usuario tiene que decir
 * lo que importa, y «está cifrado» invita a resubirlo con contraseña, que es
 * exactamente lo que no queremos que haga con un archivo infectado.
 *
 * Y `unavailable` GANA SOBRE `encrypted`, que es la que sale al revés. La tentación es
 * rechazar por cifrado sin esperar al escáner —«total, ya sabemos que no entra»— y es
 * fail-open disfrazado: el veredicto de cifrado se toma sobre metadatos que el propio
 * archivo declara, así que un archivo hostil que miente sobre su bit de cifrado saldría
 * rechazado sin haber pasado por el antivirus, y ese objeto queda en el bucket con la
 * marca equivocada. Primero se sabe si está limpio; después se discute si se puede leer.
 */
export const admit = (gateway: Gateway): Admission => {
  if (gateway.scan === "infected") return { kind: "rejected", reason: "infected" };
  if (gateway.scan === "unavailable") return { kind: "retry" };
  if (gateway.encrypted) return { kind: "rejected", reason: "encrypted" };
  return { kind: "admitted" };
};
