/**
 * QUÉ SONDAS EN ESPERA DESPIERTA UN ADAPTADOR NUEVO (§{Lo que queda}).
 *
 * ES LA MITAD DEL TRAMO 1 QUE NADIE ESCRIBIÓ, y la que el plan vende como una de las
 * mejores propiedades del sistema: «para el cliente que subió su Drive hace meses,
 * aparece contenido nuevo sin que haga nada». El mecanismo que lo produce es una
 * línea del plan —«al registrar adaptador nuevo A: para cada sonda en espera, si
 * A.evidencia(sonda) > Ninguna → encolar para reconocimiento»— y hasta acá no existía.
 *
 * NO SE LLAMA A TODO EL REGISTRO, SE LLAMA A UNO. La firma toma UN adaptador y no una
 * `Registry`, y eso no es comodidad: el plan dice «se corre **solo su** `evidencia()`»
 * porque el disparador es que ese adaptador ACABA de existir. Correr los doce sobre
 * cada sonda en cada arranque de cada réplica es O(sondas × adaptadores) y es
 * exactamente el costo que la auditoría #30 marcó.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL BRAZO `undecidable` CIERRA MEDIA `PROVISIONAL(C7)`, y por eso este archivo vale
 * más que sus cuarenta líneas.
 *
 * El contrato de `ir` deja el dilema escrito entero: el plan promete que el barrido
 * «recorre una tabla chica, NO SE LEEN ARCHIVOS de almacenamiento», y el único
 * evidenciador completo del documento hace `await s.zipEntries()`, que sí los lee. O
 * sea que la promesa y el diseño se contradicen, y las dos salidas obvias son malas:
 *
 *   · **leer los objetos** desmiente la afirmación de costo del plan, y necesita cuota
 *     y paginado que el plan no contempla;
 *   · **devolver `None`** deja a los cuatro adaptadores de zip —`.docx`, `.xlsx`,
 *     `.pptx`, `.odt`, o sea los de mayor demanda— sin rescatar NADA **y en silencio**.
 *     Es el `.pptx` que el propio plan usa como caso testigo el que se pierde.
 *
 * La salida es la que este repo ya usa en otro lado: **los perezosos RECHAZAN**, igual
 * que `materialize` en un contexto sin almacenamiento, y el adaptador que los
 * necesitaba sale en `undecidable` en vez de mentir. No lee y no calla. Con eso, el
 * hueco deja de ser un silencio y pasa a ser una lista de nombres —«estos cuatro
 * adaptadores no pueden decidir en frío»— que es lo que hace falta para dimensionar el
 * barrido caliente el día que se decida pagarlo.
 *
 * `broken` es la OTRA falla y no se mezcla con esa. `PROVISIONAL(#9)` de `ir` fija que
 * «un evidenciador que lanza cuenta como `None` + `Diagnostics.notice`», y acá el aviso
 * ES el brazo: un adaptador recién registrado que tira sobre las sondas guardadas es un
 * bug del adaptador, no un archivo que no se puede leer en frío. Confundirlos haría que
 * un bug se vea como una limitación de diseño, que es la forma más cara de esconderlo.
 */

import { Evidence, type ColdProbe, type Evidence as EvidenceValue, type OpaqueAdapter, type Origin, type Probe } from "@savia-os/ir";

/**
 * Los dos perezosos de `Probe`, por nombre. No es un vocabulario nuevo: son los dos
 * miembros que `Probe` agrega sobre `ColdProbe`, y nombrarlos acá es lo que permite
 * decir CUÁL faltó en vez de «faltó algo».
 */
export const LAZY_PROBE_FIELDS = ["zipEntries", "firstLines"] as const;
export type LazyProbeField = (typeof LAZY_PROBE_FIELDS)[number];

/**
 * QUÉ DIJO UN ADAPTADOR SOBRE UNA SONDA GUARDADA (GLOSARIO.md, P29). Cuatro brazos, y
 * cada uno nombra UNA cosa:
 *
 *   · `claimed`     — la reclama, y con qué evidencia. Va a la cola de reconocimiento.
 *   · `declined`    — la miró y no es suya. El caso normal y silencioso.
 *   · `undecidable` — NO PUDO decidir sin leer el objeto, y dice qué le faltó.
 *   · `broken`      — el evidenciador lanzó. Es un bug del adaptador.
 *
 * Los dos últimos se ven idénticos desde afuera —ninguno reclama— y separarlos es todo
 * el punto: uno es una limitación conocida del barrido en frío y el otro es un defecto.
 */
export type Claim =
  | { readonly kind: "claimed"; readonly evidence: EvidenceValue }
  | { readonly kind: "declined" }
  | { readonly kind: "undecidable"; readonly needed: LazyProbeField }
  | { readonly kind: "broken"; readonly detail: string };

/**
 * El rechazo con el que responden los perezosos de una sonda REHIDRATADA. Lleva el
 * nombre del campo adentro para que `claimedBy` pueda distinguirlo de cualquier otro
 * rechazo sin comparar mensajes de texto, que es la forma frágil de hacer lo mismo.
 */
class ColdOnly extends Error {
  constructor(readonly field: LazyProbeField) {
    super(`cold probe: ${field}() would read the object`);
  }
}

/**
 * REHIDRATA una sonda guardada SIN almacenamiento. Los perezosos rechazan, que es la
 * única forma de que «no se leen archivos» sea una garantía y no una intención.
 *
 * `origin` lo pone quien llama: una sonda guardada viene de un canal, y el barrido no
 * puede inventarlo.
 */
const coldOnly = (probe: ColdProbe, origin: Origin): Probe => ({
  ...probe,
  origin,
  zipEntries: () => Promise.reject(new ColdOnly("zipEntries")),
  firstLines: () => Promise.reject(new ColdOnly("firstLines")),
});

/**
 * Qué dice ESTE adaptador sobre CADA una de las sondas guardadas.
 *
 * DEVUELVE LOS CUATRO BRAZOS Y NO SOLO LAS QUE RECLAMA, aunque encolar sea lo único
 * que el plan pide. Filtrar acá dejaría a `undecidable` y a `broken` sin observador —y
 * los dos son hallazgos, no ruido— y quien llama filtra en una línea. Es la misma
 * decisión que `Resolution` devolviendo el PAR y no solo el adaptador.
 *
 * El orden de la salida es el de `probes`: quien llama pagina sobre su tabla y necesita
 * poder emparejar por índice sin llevar un mapa aparte.
 */
export const claimedBy = async (
  adapter: OpaqueAdapter,
  probes: readonly ColdProbe[],
  origin: Origin,
): Promise<readonly Claim[]> =>
  Promise.all(
    probes.map(async (p): Promise<Claim> => {
      try {
        const e = await adapter.evidence(coldOnly(p, origin));
        return e > Evidence.None ? { kind: "claimed", evidence: e } : { kind: "declined" };
      } catch (err) {
        return err instanceof ColdOnly
          ? { kind: "undecidable", needed: err.field }
          : { kind: "broken", detail: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
