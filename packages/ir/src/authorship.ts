/**
 * La autoría — quién dijo qué y cuándo.
 *
 * ESTE MÓDULO EXISTE PARA QUE UNA FRONTERA SEA EXPRESABLE, no por tamaño ni por
 * comodidad. `Authorship` NO ENTRA EN LA HUELLA —el argumento completo está en el
 * tipo, abajo— y hasta el bloque 3b eso lo sostenía una propiedad del TEXTO de
 * `projection.ts`: aquel archivo no NOMBRABA `identity.ts`, así que `Authorship` no
 * estaba en su alcance léxico y no se podía escribir. Una propiedad que se mantiene
 * por lectura, no por un guardián.
 *
 * POR QUÉ NO ALCANZABA CON PONER LA FRONTERA SOBRE `identity.ts`. `boundaries.mjs`
 * mide ALCANCE, y el alcance ya existía: `shapes.ts` importa `ObjectKey`, así que
 * `projection.ts → shapes.ts → identity.ts` es un camino real y la frontera
 * `projection.ts ↛ identity.ts` nacía VIOLADA. Verificado poniéndola a mano, con el
 * camino impreso. Y la protección por lectura tenía que caducar igual en este
 * bloque: `fingerprintOf` devuelve `NodeFingerprint`, así que `projection.ts` PASA a
 * nombrar `identity.ts`, y con eso `Authorship` habría entrado en su alcance léxico.
 *
 * Sacar `Authorship` de `identity.ts` es lo que vuelve la frontera escribible:
 *
 *     projection.ts ↛ authorship.ts        (`scripts/boundaries.mjs`, acreditada)
 *
 * ES EL CORTE MÍNIMO: se mudó UN tipo. `ActorId` e `Instant` se quedan en
 * `identity.ts` y este módulo los importa — esa dirección es la legal, y moverlos
 * arrastraría a los otros consumidores sin cerrar nada más. `outputs.ts` es el único
 * consumidor de código (`Node = RawNode & { authorship } & BrandedAsNode`) y ya
 * importaba de los dos archivos, así que el corte le agrega una línea de import y
 * ningún cambio de tipo.
 *
 * LO QUE EL CORTE NO CUBRE, dicho de frente: `DelegationId` (`identity.ts`) declara
 * el MISMO invariante —«NUNCA entra en la huella»— y NO se movió, porque no hace
 * falta para que esta frontera cierre y el corte se quiso mínimo. Consecuencia real
 * y no cosmética: antes de este bloque `projection.ts` no nombraba `identity.ts` y
 * `DelegationId` tampoco estaba en su alcance léxico; ahora sí lo está. O sea que su
 * protección pasó de débil a ninguna, y hoy la sostiene solo la lista de
 * PROVISIONAL(H6) en `project` («`delegation` NO»). Cerrarlo es mudarlo acá —y
 * entonces el módulo deja de ser «la autoría» y pasa a ser «lo que no entra en la
 * huella», que es un nombre y una decisión de contrato— o darle su propia frontera.
 * Va escrito como decisión pendiente, no escondido como olvido.
 */

import type { ActorId, Instant } from "./identity.js";

/**
 * Quién dijo qué y cuándo. Obligatoria en todos los nodos (§{Tramo 3 › Qué sale}):
 * «esto lo dijo el CFO en marzo» es la mitad del valor de la memoria.
 *
 * PROVISIONAL(C8/#22): `Authorship` NO forma parte de lo que produce un adaptador
 * ni de lo que se cachea. Se inyecta DESPUÉS del caché, al componer `Node` a partir
 * de `RawNode` — Resuelve dos cosas de un golpe y es gratis, porque ya está
 * latente en los tipos escritos (`Unidad<S>` de §{`descomponer`} NO lleva autoría y
 * `Node` de §{Tramo 3 › Qué sale} sí): (1) el property test de determinismo
 * byte-idéntico (§{El determinismo}) no puede pasar con un timestamp en cada nodo,
 * y sellarlo una vez por documento en el tramo 1 lo arregla sin cambiar ningún
 * tipo; (2) el caché de reconocimiento se indexa por `hashBytes` y el acierto cruza
 * organizaciones POR DISEÑO (§{Caché}), así que si la autoría viajara adentro del
 * árbol cacheado se propagaría la del primer subidor a otro tenant (auditoría #22)
 * — Si se decide al revés, o el property test se declara inaplicable, o el caché
 * deja de cruzar organizaciones y se cae la optimización insignia de §{Caché}.
 *
 * PROVISIONAL(#14): un subárbol que llega tarde por delegación HEREDA el `when` de
 * su documento, no sella el instante real de la descomposición — Por producto:
 * «lo dijo el CFO en marzo» se refiere a marzo, no al momento en que drenó nuestra
 * cola. Y porque si no, dos re-ingestas producen nodos con `when` distinto — Si se
 * decide al revés, cada re-emisión cambia la autoría de todo lo delegado.
 *
 * `Authorship` NO ENTRA EN LA HUELLA. Esto NO está dicho en ningún lado del plan y
 * es la única razón por la que sellar una vez por documento alcanza: de ahí cuelgan
 * que el caché de reconocimiento pueda cruzar organizaciones (§{Caché}) y que el
 * mismo contenido subido por dos personas dé la misma huella —o sea, la
 * deduplicación—.
 *
 * QUIÉN LO IMPONE, y las dos versiones anteriores de esta línea que eran falsas:
 *   · La primera decía que lo imponía el grafo de módulos —«`projection.ts` no
 *     importa `identity.ts`, punto»—. FALSO, y se corrigió en el bloque 3:
 *     `shapes.ts` importa `ObjectKey`, así que el camino ya existía y una frontera
 *     contra `identity.ts` nacía violada.
 *   · La segunda decía que lo sostenía la NOMBRABILIDAD: `projection.ts` no nombraba
 *     `identity.ts`, así que este tipo no estaba en su alcance léxico. Era cierto
 *     mientras duró, pero es una propiedad del texto de otro archivo, sostenida por
 *     lectura — y `fingerprintOf` la habría caducado sola al importar
 *     `asNodeFingerprint`.
 * Hoy lo impone el grafo de módulos DE VERDAD, porque el tipo se mudó a un archivo
 * que `projection.ts` no alcanza: `scripts/boundaries.mjs` verifica
 * `projection.ts ↛ authorship.ts` y la frontera está acreditada rompiéndola.
 */
export type Authorship = {
  readonly actor: ActorId;
  readonly when: Instant;
  /** Atribución cruda del documento, tal como venía: `"María López (OOXML)"`. */
  readonly source: string;
};
