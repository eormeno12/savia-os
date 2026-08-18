/**
 * La procedencia — cómo llegó acá un contenido: quién lo trajo, cuándo, y por qué
 * camino de delegación bajó.
 *
 * ESTE MÓDULO EXISTE PARA QUE UNA FRONTERA SEA EXPRESABLE, no por tamaño ni por
 * comodidad. Nada de lo que vive acá ENTRA EN LA HUELLA —el argumento completo está
 * en cada tipo, abajo— y hasta el bloque 3b eso lo sostenía una propiedad del TEXTO
 * de `projection.ts`: aquel archivo no NOMBRABA `identity.ts`, así que estos tipos no
 * estaban en su alcance léxico y no se podían escribir. Una propiedad que se mantiene
 * por lectura, no por un guardián.
 *
 * POR QUÉ NO ALCANZABA CON PONER LA FRONTERA SOBRE `identity.ts`. `boundaries.mjs`
 * mide ALCANCE, y el alcance ya existía: `shapes.ts` importa `ObjectKey`, así que
 * `projection.ts → shapes.ts → identity.ts` es un camino real y la frontera
 * `projection.ts ↛ identity.ts` nacía VIOLADA. Verificado poniéndola a mano, con el
 * camino impreso. Y la protección por lectura caducó en el bloque 3b: `fingerprintOf`
 * devuelve `NodeFingerprint`, así que `projection.ts` PASÓ a nombrar `identity.ts`.
 *
 * Sacar estos tipos de `identity.ts` es lo que vuelve la frontera escribible:
 *
 *     projection.ts ↛ provenance.ts        (`scripts/boundaries.mjs`, acreditada)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE LLAMA `provenance.ts` Y NO `authorship.ts`
 *
 * Nació en el bloque 3b como `authorship.ts`, con UN miembro. El glosario (sección 9,
 * E1)
 * descartó ahí mismo `provenance.ts` y `outside-fingerprint.ts` con un argumento
 * correcto para ese momento: nombraban una CATEGORÍA de la que había un solo miembro
 * —`DelegationId` declaraba el mismo invariante y no se había movido—, así que el
 * nombre afirmaba una membresía que el archivo no tenía. Y dejó escrito el disparador:
 * «el día que `DelegationId` se mude, el rename es el acto visible que corresponde».
 *
 * Este bloque lo mudó, y el rename es este archivo. Con dos miembros el nombre deja de
 * prometer de más, porque hay una regla que decide quién entra y quién no —abajo— y no
 * una lista de uno. La razón de fondo es una sola para los dos: **la huella contesta
 * QUÉ ES esto; la autoría y la delegación contestan CÓMO LLEGÓ ACÁ**, y el mismo
 * contenido tiene que dar la misma huella lo traiga quien lo traiga y por el camino que
 * sea. Eso es exactamente lo que la palabra *procedencia* nombra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITERIO DE MEMBRESÍA — qué entra acá y qué no
 *
 * No es descriptivo: es lo que va a decidir la próxima mudanza. Un tipo entra si
 * cumple las TRES, y ninguna sobra:
 *
 *   1. **Dice CÓMO LLEGÓ, no QUÉ ES.** Responde quién lo trajo, cuándo, por qué
 *      camino. No responde qué contenido es ni cómo se ve.
 *   2. **La huella tiene que ser CIEGA a él.** Dos valores suyos distintos sobre el
 *      mismo contenido tienen que producir la MISMA huella. Si cambiarlo TIENE que
 *      mover la huella, es contenido: se queda en su archivo.
 *   3. **Viaja pegado al contenido, no al registro.** `OrganizationId` y `DocumentId`
 *      pasan (1) y (2) y NO entran: son la identidad de la fila del tramo 1
 *      (§{Tramo 1 › El registro}), y lo que los mantiene fuera de la huella es que la
 *      huella se calcula sobre `Body`, que no los nombra. Sin (3) el módulo se
 *      ensancha hasta ser «todo lo que no es cuerpo», que es otra vez un nombre que
 *      promete de más — el defecto exacto que E1 le señaló a `outside-fingerprint.ts`.
 *
 * LO QUE EL CRITERIO DEJA AFUERA, para que se vea que discrimina:
 *   · `RawNode.attribution` («qué eslabón de la cascada resolvió este nodo») tampoco
 *     entra en la huella, y NO es procedencia: dice cómo se RECONOCIÓ, no cómo llegó.
 *     Falla (1). Además es `string | null` y no un tipo con nombre, así que no hay nada
 *     que mudar — pero el criterio tiene que rechazarlo por la razón, no por la forma.
 *   · `ObjectKey` dice dónde quedaron los bytes, y es direccionado por CONTENIDO: el
 *     mismo contenido da la misma clave. Falla (1) por el otro lado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE MUDÓ CON `DelegationId`, y qué NO
 *
 * Se mudó también `asDelegationId`, y no por prolijidad: **es obligatorio**. Si el
 * constructor se quedaba en `identity.ts`, aquel archivo tenía que importar el tipo de
 * acá, y con eso `projection.ts → identity.ts → provenance.ts` es un camino real y la
 * frontera nace VIOLADA — el mismo modo de falla que hizo inescribible la frontera
 * contra `identity.ts` en el bloque 3b, con los papeles cambiados. Verificado dejando
 * el constructor en su lugar: `boundaries.mjs` imprime el camino y sale 1.
 *
 * `ActorId`, `Instant` y `Nominal` se quedan en `identity.ts` y este módulo los importa
 * — esa dirección es la legal, y moverlos arrastraría a los otros consumidores sin
 * cerrar nada. Con `asDelegationId` acá, `identity.ts` pasa a tener QUINCE constructores
 * y no dieciséis; la cifra está publicada en su sección de constructores y en
 * `invariants.ts`, y las dos se corrigieron en este bloque.
 */

import type { ActorId, Instant, Nominal, ObjectKey } from "./identity.js";

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
 * Hoy lo impone el grafo de módulos DE VERDAD, porque el tipo vive en un archivo que
 * `projection.ts` no alcanza: `scripts/boundaries.mjs` verifica
 * `projection.ts ↛ provenance.ts` y la frontera está acreditada rompiéndola (M46).
 */
export type Authorship = {
  readonly actor: ActorId;
  readonly when: Instant;
  /** Atribución cruda del documento, tal como venía: `"María López (OOXML)"`. */
  readonly source: string;
};

/**
 * Identificador de un marco de delegación. Lo acuña el orquestador de la
 * recursión, NO el adaptador delegado (que no sabe que fue delegado).
 *
 * PROVISIONAL(C21): existe porque el emisor ramifica sobre «si BAJÓ de un subárbol
 * delegado» / «si SUBIÓ a un subárbol delegado» (§{2 · Emisor}) y NINGÚN tipo del
 * plan lleva ese dato: `tipo:'delegado'` se eliminó a propósito
 * (§{Lo que se borró}) y `ubicación.adaptador` no sirve (un zip dentro de un zip da
 * el mismo adaptador arriba y abajo). El propio plan se reprocha haber afirmado el
 * mecanismo «sin mecanismo» (§{Cuarta}) y lo lista entre los resueltos (§{Puntos})
 * habiendo cambiado solo la prosa — Viaja como CADENA (`Nodo.delegación`) y no como
 * valor suelto, porque la cadena además hace expresables la composición de rutas a
 * través de la frontera (auditoría #13) y la cita encadenada (#15) — Si se decide
 * al revés (un solo id, o nada), el emisor no puede distinguir bajar un nivel de
 * bajar tres, y el ejemplo canónico contrato.pdf → pg3 → imagen no se puede citar.
 *
 * NUNCA entra en la huella: si entrara, la re-emisión por delegación tardía
 * movería ids, contra §{La delegación tardía} («cero identificadores movidos»).
 *
 * QUIÉN LO IMPONE, y la versión anterior de esta línea que decía NADIE. El bloque 3b
 * mudó `Authorship` a un archivo propio para que una frontera pudiera imponer su
 * mitad del invariante, y dejó este tipo en `identity.ts`: no hacía falta moverlo para
 * que esa frontera cerrara y el corte se quiso mínimo. El costo estaba escrito y era
 * real: hasta ese bloque `projection.ts` no nombraba `identity.ts` y este tipo no
 * estaba en su alcance léxico; al importar `asNodeFingerprint` pasó a estarlo, así que
 * su protección pasó de DÉBIL a NINGUNA y quedó sostenida por una línea de prosa —la
 * lista de PROVISIONAL(H6) en `project`, «`delegation` NO»—. Este bloque lo cierra por
 * donde el 3b lo dejó anotado: el tipo se mudó acá, la frontera es la misma
 * (`projection.ts ↛ provenance.ts`) y cubre a los dos, y está acreditada rompiéndola
 * por CADA miembro por separado — M46 con `Authorship`, M49 con este tipo. Dos filas y
 * no una: un mutante que importara los dos se pondría rojo por `Authorship` solo, y no
 * acreditaría nada de lo que este bloque hizo.
 */
export type DelegationId = Nominal<string, "DelegationId">;

/**
 * Constructor de `DelegationId`. Vive acá y no con los quince de `identity.ts` por
 * OBLIGACIÓN, no por prolijidad: allá tendría que importar el tipo de este archivo, y
 * ese import vuelve `projection.ts → identity.ts → provenance.ts` un camino real que
 * viola la frontera. Está explicado en el encabezado, y verificado.
 *
 * Es una conversión, no una validación: quien construye es responsable de la forma,
 * igual que los quince de `identity.ts`.
 */
export const asDelegationId = (v: string): DelegationId => v as DelegationId;

/**
 * DE DÓNDE SALIERON LOS BYTES — el contenedor donde se encontró la referencia, y la
 * referencia tal como estaba escrita ahí (GLOSARIO.md, P25).
 *
 * ES LA OTRA MITAD DE UN PAR. `ObjectKey` dice dónde quedó un objeto EN NUESTRO
 * almacenamiento y es direccionado por contenido; este dice dónde estaba antes de que
 * le diéramos esa dirección. Las dos rutas se guardan, y ninguna de las dos sirve sola:
 * la interna no dice de dónde vino, y la original no dice dónde buscarlo.
 *
 * POR QUÉ NO ALCANZABA CON `ObjectKey`, y es la razón de fondo de todo el tipo. La
 * clave es el hash del contenido, así que el logo que aparece en cincuenta documentos
 * da CINCUENTA VECES LA MISMA CLAVE — y eso es deliberado: es lo que hace que se guarde
 * una vez y el modelo lo describa una vez. Pero las rutas de origen son cincuenta
 * distintas. **Una clave, N procedencias.** Colgarle la ruta al objeto obliga a pisar,
 * a ignorar o a acumular, y las tres o pierden información o vuelven al almacenamiento
 * un registro con estado. Colgándosela al NODO la cantidad calza sola: hay un nodo por
 * aparición, y cada uno lleva la suya.
 *
 * UNA SOLA FORMA PARA LOS DOS CASOS, y no hizo falta una unión. Un `.docx` da
 * `(el .docx, "word/media/sello.png")`; un `.md` que referencia una imagen por enlace
 * dará `(el .md, "https://cdn.acme.com/fig.png")`. En los dos hay un contenedor y una
 * dirección relativa a él. `path` es OPACO a propósito: interpretarlo —resolverlo,
 * bajarlo, validarlo— es trabajo de quien lo escribió, y este tipo solo lo transporta.
 *
 * `container` ES UNA `ObjectKey` y no un nombre de archivo ni una `Source`, porque
 * tiene que seguir siendo cierto después de que alguien renombre el documento: es la
 * única dirección del contenedor que no se mueve.
 *
 * NUNCA ENTRA EN LA HUELLA, y acá eso no es una promesa sino la firma: `fingerprintOf`
 * recibe `Body`, y este viaja como HERMANO de `body` en `RawNode`, no como campo suyo.
 * No hay forma de escribir el código que lo cuele. Si entrara, la misma imagen traída
 * desde dos documentos serían dos identidades y toda la curación de esa figura se
 * despegaría — que es el modo de falla exacto que el direccionamiento por contenido
 * existe para impedir. Es el mismo lugar y la misma razón que `DelegationId`, y la
 * frontera `projection.ts ↛ provenance.ts` lo cubre sin escribir una línea nueva.
 */
export type Whence = {
  readonly container: ObjectKey;
  readonly path: string;
};
