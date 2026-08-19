/**
 * `@savia-os/intake` — EL TRAMO 1, su mitad de RECHAZO.
 *
 * QUÉ NO ESTÁ ACÁ, Y ES LA MITAD MÁS GRANDE. «¿Va a salir algo útil de acá?» —la
 * pregunta con la que abre §{Qué se acepta}— **ya está contestada** por el tramo 2:
 * `select` devuelve `null` cuando nadie reclama, el piso de texto se abstiene sobre
 * binario, y sale `Run.onHold` con la sonda adentro. Este paquete no la vuelve a
 * contestar. Lo que agrega son las dos cosas que ningún adaptador puede decidir: si un
 * archivo se RECHAZA, y qué documentos en espera despierta un adaptador nuevo.
 *
 * NO LO IMPORTA `orchestration` NI NADIE DEL PIPELINE, y es a propósito: el tramo 1
 * corre ANTES, y su salida no es un `Run` sino un veredicto y una fila. Quien los
 * compone es el host —`apps/api`, que todavía no existe—. Por eso este paquete es
 * hermano de `orchestration` y no su dependencia ni su dependiente.
 *
 * Y NO ALCANZA `adapters`, aunque la mitad de aceptación viva allá. Se scaffoldeó
 * declarándolo y el guardián de fronteras lo desmintió en su primera corrida: nada lo
 * importaba, y no porque faltara escribirlo. `claimedBy` recibe un `OpaqueAdapter`, que
 * es un tipo de `ir`; este paquete habla del CONTRATO de adaptador y nunca de un
 * adaptador. Con eso, «`admit` no calcula `encrypted`» dejó de ser una convención de
 * firma y pasó a ser el grafo de módulos: no puede, aunque alguien quiera.
 */

export {
  type Admission,
  type Gateway,
  type RejectionReason,
  type ScanFn,
  type ScanVerdict,
  REJECTION_REASONS,
  SCAN_VERDICTS,
  admit,
} from "./admission.js";

export {
  type Claim,
  type LazyProbeField,
  LAZY_PROBE_FIELDS,
  claimedBy,
} from "./claims.js";
