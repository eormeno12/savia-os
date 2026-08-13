/**
 * Identidad y huella — los tipos que nombran cosas y los que las hashean.
 *
 * Todo lo de acá es un `string` en runtime. Los tipos están MARCADOS
 * (nominalmente) porque el propio plan dice preferir mover invariantes del
 * runtime al compilador — «cada invariante que se mueve del runtime al
 * compilador es un test menos y un bug menos» (§{Estrategia}) — y porque esta
 * familia de valores ya se confundió una vez: el hallazgo 10 del banco
 * (§{Cuarta}) fue exactamente eso.
 */

declare const nominal: unique symbol;

// PENDING(glosario D22): `Marcado → Branded` es derivación directa de la raíz
// `Marca → Brand`, pero NINGUNA regla de composición del glosario cubre los
// participios. Las otras dos candidatas eran `AlreadyBranded` (dos palabras para un
// tipo privado de una línea) y `Marked` (colisiona con `Mark`, la marca de estilo
// inline de `shapes.ts`, que es justamente la colisión que el glosario separó al
// dar `Brand` y `Mark` a las dos `Marca` del paquete).
/** Una base que YA lleva marca. Ver la guarda de `Nominal`. */
type Branded = { readonly [nominal]: string };

/**
 * Marca nominal: dos alias de `string` con etiquetas distintas dejan de ser
 * intercambiables.
 *
 * LA MARCA ES PLANA — un solo nivel, siempre. Toda marca comparte la clave
 * `nominal`, así que marcar sobre marcado pediría que esa única propiedad fuera a
 * la vez `"A"` y `"B"`: una contradicción, no una conjunción. TypeScript reduce el
 * tipo entero a `never`, y como `never` es asignable a TODO, los tipos que iban a
 * quedar más protegidos quedan sin ninguna protección — con el build en verde.
 * Es exactamente lo que pasaba acá: toda la familia de hashes era `never` y una
 * huella se asignaba a un `number`.
 *
 * La guarda de abajo hace que la reincidencia sea un error de compilación en el
 * lugar donde se declara el tipo, y no una lista que alguien tenga que mantener:
 * vale para toda marca futura sin tocar nada.
 *
 * Si algún día hiciera falta que una marca sea SUBTIPO de otra, no alcanza con
 * sacar la guarda: hay que darle a cada marca su propia clave (`declare const` por
 * tipo), porque dos claves distintas sí componen. Se descartó por costar ~20 líneas
 * de andamio para un subtipado sin un solo consumidor.
 *
 * PENDING(glosario D21): el parámetro se llama `Label` por el precedente del
 * bloque 1 (`Par.etiqueta → label`). «Brand **tag**» es el término de arte de la
 * técnica, y ninguna regla de composición del glosario elige entre los dos — con la
 * salvedad de que `label` en `Pair` es un dato que un humano lee y acá es un
 * discriminante de tipo.
 */
export type Nominal<Base, Label extends string> = [Base] extends [Branded]
  ? { "IR-ERR: branding an already branded type collapses to never — the brand is FLAT": Base }
  : Base & { readonly [nominal]: Label };

// ─────────────────────────────── Identificadores ─────────────────────────────

/**
 * El identificador estable del tramo 4. Sale de la RECONCILIACIÓN, nunca de una
 * fórmula (§{Tramo 4 › Qué sale}, §{Tramo 4 › Decisiones}). Es el ancla de todas
 * las anotaciones por R3.
 *
 * H13(a) — SE ACUÑA AL AZAR. ULID o UUIDv7: marca de tiempo + azar, 128 bits,
 * ordenable por instante de acuñado, sin coordinación. El orden monótono no es
 * cosmético — reduce la fragmentación del índice en Postgres frente a ids
 * puramente aleatorios.
 *
 * La auditoría lo planteó como una tenaza —«si son aleatorios falla el property
 * test de determinismo; si son derivados vuelve la fórmula de una sola versión»— y
 * una de las dos mordazas no existe. El test dice «para cada adaptador a:
 * a.reconocer(f) ≡ a.reconocer(f), árbol byte-idéntico»: compara LA SALIDA DE UN
 * ADAPTADOR, y esa salida NO TIENE IDS. `Unit<S>` lleva `signals`, `body`,
 * `location` y `ownAuthorship`; `RawNode` tampoco lleva id. El `id` nace dos
 * pasos después, en `EmittedNode`, que produce el tramo 4. Un test que compara
 * artefactos sin ids no puede romperse por cómo se acuñan los ids.
 *
 * Y el tramo 4 tiene su propio invariante, que es otro: no «byte-idéntico» sino
 * «ids movidos = 0» (los 7 casos adversariales). Dos garantías, dos artefactos,
 * dos tramos. La otra mordaza SÍ es real: derivarlos reintroduce
 * `hash(migas ‖ contenido ‖ ordinal)`, formalmente eliminada, y editar un título
 * despegaría la curación de toda su sección.
 *
 * H13(b) — UNICIDAD GLOBAL, y el documento lo lleva el CONTENEDOR, no cada
 * referencia. Con 128 bits de azar la unicidad global es gratis: no se elige, se
 * obtiene. Lo que sí se decide es si cada referencia arrastra su documento, y la
 * respuesta es no: un `Fragment` pertenece a UN documento, un `DataRecord` también,
 * una anotación también — así que el contenedor ya lo sabe y repetirlo por
 * elemento sería ALMACENAR ALGO DERIVABLE, lo mismo que el plan prohíbe con
 * `depth`, `siblingIndex` y `ordinal`. La tabla de nodos sí lleva su columna
 * `documento` (borrado en cascada, filtro por tenant, particionado); las
 * referencias no la repiten. Los tipos ya lo asumían: `Fragment.nodes` y
 * `DataRecord.node` son `ElementId` a secas.
 *
 * H13(c) — UN ID ES ESTABLE DESDE QUE SE PERSISTE. La idempotencia del emisor no
 * la da el acuñado: la da el reconciliador. Volver a emitir no acuña ids frescos —
 * reconcilia contra el índice, y lo que no cambió ancla por hash y conserva su id.
 * Por eso una re-emisión por delegación tardía «no mueve nada». Antes de
 * persistirse, un id no existe para nadie.
 *
 * REQUISITO QUE ESTO IMPONE AL TRAMO 7, y que no estaba escrito: el índice de
 * reconciliación y los nodos se persisten EN LA MISMA TRANSACCIÓN. Si una corrida
 * guarda los nodos y no el índice, la próxima re-ingesta no tiene contra qué
 * reconciliar, se mueven todos los ids y se despega toda la curación — en silencio.
 *
 * CONSECUENCIA ABIERTA: con unicidad global el id NO lleva su organización adentro,
 * así que la separación entre tenants queda enteramente en el filtro de lectura
 * (§{Tramo 1 › El registro}), o sea en una garantía de runtime que hay que
 * acordarse de aplicar en cada consulta. Eso es de la capa de control de acceso, no
 * de este pipeline, pero elegir unicidad global es lo que lo vuelve necesario.
 */
export type ElementId = Nominal<string, "ElementId">;

/**
 * Identificador provisional, válido SOLO dentro de una corrida del emisor.
 *
 * PROVISIONAL(#66): restauro `LocalKey` del diseño predecesor (05-capa1 L417-419:
 * «válida solo dentro de esa corrida… no es identidad persistente») — El plan tiene
 * una dependencia circular declarada: `parentId: ElementId` lo produce el EMISOR
 * (§{Tramo 4 › Qué sale}) y los `ElementId` salen de la RECONCILIACIÓN
 * (§{Tramo 4 › Qué sale}), que corre después y necesita la lista plana ya emitida.
 * El emisor no puede escribir un id que todavía no existe. El emisor asigna un
 * `LocalId` a todo nodo Y a todo scope (incluidos los sintéticos que no son nodo,
 * auditoría H5); el reconciliador produce un mapa `LocalId → ElementId` y el
 * remapeo de `parentId` es una pasada lineal — Si se decide al revés (emisor
 * corriendo dos veces), se duplica el recorrido que el tramo declara único
 * (§{2 · Emisor}) y hay que decidir qué se conserva entre pasadas.
 *
 * PROVISIONAL(H5): los hijos de un scope SINTÉTICO (uno que no corresponde a ningún
 * nodo emitido — no hay nodo «hoja» ni «región» en la vía `celda`, y un `<div>`
 * puede no ser unidad) reciben como padre el primer ancestro que SÍ es nodo
 * emitido — Materializar el scope sintético como `container` inundaría el
 * documento de containers que por C14 hashean todos igual y nunca anclan: sería
 * cambiar un problema por uno peor — Si se decide al revés, hay que darle a esos
 * containers sintéticos payload discriminante o aceptar que ninguno ancle.
 */
export type LocalId = Nominal<string, "LocalId">;

/** Identificador de un adaptador del registro. Único dentro del registro. */
export type AdapterId = Nominal<string, "AdapterId">;

/**
 * Quién dijo algo.
 *
 * PROVISIONAL(#22): SIEMPRE un usuario de Savia, nunca un actor externo sin
 * resolver — §{Tramo 1 › El registro} y el glosario son tajantes: todo lo que se
 * guarda tiene un `User` dueño, sin excepción; para conectores de organización, el
 * usuario raíz. La atribución cruda del documento («María López», del OOXML) viaja
 * en `Authorship.source`, que es un `string` libre — Si se decide al revés (unión
 * de usuario Savia y actor externo), todo consumidor de `ActorId` tiene que
 * ramificar y no se compra nada que `source` no dé.
 */
export type ActorId = Nominal<string, "ActorId">;

/** El tenant. Toda lectura posterior se filtra por acá (§{Tramo 1 › El registro}). */
export type OrganizationId = Nominal<string, "OrganizationId">;

/** La fila `documento` del tramo 1 (§{Tramo 1 › El registro}). */
export type DocumentId = Nominal<string, "DocumentId">;

/**
 * Dónde quedó un objeto en el almacenamiento direccionado por contenido
 * (§{Tramo 1 › El registro}).
 */
export type ObjectKey = Nominal<string, "ObjectKey">;

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
 */
export type DelegationId = Nominal<string, "DelegationId">;

/**
 * Identificador de un fragmento, para deduplicar resultados de búsqueda
 * (§{Tramo 7} dedupica por `fragmentoId` y `Fragment` no tiene ese campo —
 * auditoría #69).
 *
 * PROVISIONAL(#69): se deriva de `(DocumentId, contextualFingerprint)` — Si fuera
 * el hash a secas, dos fragmentos idénticos de documentos distintos serían el mismo
 * id y el dedupe colapsaría dos documentos en un solo resultado; y a la vez el
 * caché por contenido EXIGE que compartan hash. Derivarlo del par separa la
 * identidad de recuperación de la clave de caché de vectores. Va sobre la huella
 * CONTEXTUAL y no sobre el texto limpio (que ya no existe como huella, ver C2 en
 * `ContextualFingerprint`): con el texto limpio, dos fragmentos del mismo documento
 * con el mismo texto en secciones distintas serían el mismo id — Si se decide al
 * revés (id acuñado y persistido), hay que declarar su política de estabilidad entre
 * re-ingestas, y `nodos` está declarado justamente como «lo que sobrevive a que el
 * fragmento se rearme» (§{Las dos salidas}), lo que sugiere que el id no.
 *
 * NO es un ancla de curación: por R3 la curación cuelga de `ElementId` (§{R3}).
 */
export type FragmentId = Nominal<string, "FragmentId">;

/**
 * Un instante.
 *
 * Es RELOJ DE PARED, no tiempo de medio: el momento en que algo pasó en el mundo,
 * no un offset dentro de un audio o un video. Eso último es
 * `Coordinate` con `space: "time"` (`location.ts`), y son enteros en milisegundos
 * desde el inicio del medio, no un ISO-8601.
 *
 * PROVISIONAL(C8): string ISO-8601 en UTC con precisión de milisegundos
 * (`2026-08-09T14:03:11.000Z`) — Es el único de los tres candidatos (`Date`, epoch
 * ms, ISO) que un golden file puede congelar tal cual, que compara bien como cadena
 * y que no arrastra zona horaria ni mutabilidad — Si se decide al revés (epoch ms),
 * el snapshot deja de ser legible y la comparación byte-idéntica de
 * §{El determinismo} pasa a depender de la representación numérica.
 */
export type Instant = Nominal<string, "Instant">;

// ─────────────────────────────── Familia de hashes ───────────────────────────

// SEIS tipos marcados y un séptimo NOMBRE, `ContentHash`, que es alias de
// `NodeFingerprint`. La cifra importa: `invariants.ts` la fija con seis
// `Inhabited<…>` y seis mensajes propios, y la prosa de este archivo decía «los
// siete» —residuo de antes de que `HuellaFragmento` se borrara, borrado que este
// mismo archivo cuenta más abajo—. Es el modo de falla que `M9c` impide en
// `params.ts` y que acá no verifica nadie: si mañana entra un miembro nuevo, esta
// línea y las seis de `invariants.ts` se actualizan juntas.
//
// Los seis llevan el MISMO valor en runtime —64 hexadecimales en minúscula— y
// roles que no se pueden confundir. La FORMA no está en el tipo: no hay un
// `Sha256Hex` del que los seis deriven, porque (a) marcar sobre marcado colapsa
// —ver `Nominal`— y (b) un supertipo común sería justo el agujero que esta familia
// viene a tapar: cualquier función que reciba «un sha256» acepta los seis roles
// indistintamente. Quien garantiza la forma es la única función que calcula
// sha256, con un test ahí; validar en cada constructor sería una regex por nodo y
// por fragmento para atrapar un error de programación, no un error de datos.
//
// Las pruebas de que esta familia efectivamente separa están en `invariants.ts`.

// PENDING(glosario D17): `HashBytes → ByteHash`. El glosario fija el patrón
// `Hash<X>` ⇒ `<X>Hash` con `HashMateria → MatterHash`, pero no fija el NÚMERO del
// modificador, y acá el modificador es un plural. `ByteHash` es el compuesto inglés canónico (el modificador va
// en singular) y coincide con el mensaje que `invariants.ts` ya tenía escrito
// («a node fingerprint is accepted as a byte hash»). Las otras dos eran `BytesHash`
// (conserva el plural, lee mal) y `FileHash` (nombra lo hasheado, e invita justo a
// la confusión con el checksum multipart que el docstring de abajo descarta).
/**
 * sha256 del archivo crudo (§{Tramo 1 › El registro}). Dedupe de blobs,
 * idempotencia de reintento y componente de la clave del caché de reconocimiento.
 *
 * PROVISIONAL(#37): lo calcula el WORKER en la primera lectura del objeto, no la
 * puerta — La API no toca bytes (subida prefirmada, §{Tramo 1 › Decisiones}), así
 * que nadie puede calcular en la puerta un hash de bytes que la puerta no ve; y el
 * checksum multipart del almacenamiento es un hash de hashes que depende del tamaño
 * de parte, o sea que el mismo archivo con chunks distintos daría `hashBytes`
 * distintos. La primera lectura ya ocurre para descomponer, así que el costo
 * incremental es cero — Consecuencia que hay que aceptar: `hashBytes` es NULLABLE
 * en la fila `documento` entre la recepción y la primera lectura, y por lo tanto el
 * dedupe de blobs (§{Tramo 1 › Decisiones}) NO puede ocurrir en la puerta ni ser la
 * clave de escritura del objeto. Eso contradice el orden de §{El orden} y toca C6.
 */
export type ByteHash = Nominal<string,"ByteHash">;

/**
 * La huella de identidad de un NODO. Es lo que el próximo reconciliador usa como
 * material (§{Tramo 4 › Qué sale}).
 *
 * PENDING(D24): HOY ESTE TIPO NO TIENE NI UN PRODUCTOR. `fingerprintOf`
 * (`projection.ts`) devuelve `string` pelado, así que la marca protege HACIA
 * ADENTRO —nadie puede pasar una huella donde va una clave de caché— y no protege
 * hacia afuera: cualquier `string` sirve de huella y nadie está obligado a llamar
 * a `asNodeFingerprint`. La aserción `_S5` de `invariants.ts` está verde mientras
 * eso pasa, así que la promesa es de la prosa, no del tipo.
 *
 * NO SE ARREGLA ACÁ, y el argumento se CORRIGIÓ en el bloque 3 porque el que estaba
 * escrito era más fuerte de lo que ningún guardián puede sostener. Decía que
 * «`Authorship` NO entra en la huella» lo impone el escalón ② —«`projection.ts` no
 * importa `identity.ts`, punto»— y que agregar el import volvería `Authorship`
 * ALCANZABLE. `boundaries.mjs` mide ALCANCE, y el alcance ya existe: verificado
 * poniendo la frontera a mano,
 *
 *     IR-ERR: frontera violada — projection.ts alcanza identity.ts
 *             camino: projection.ts → shapes.ts → identity.ts
 *
 * porque `shapes.ts` importa `ObjectKey` de acá. O sea que la frontera
 * `projection.ts ↛ identity.ts` es hoy INESCRIBIBLE: nace violada.
 *
 * Lo que sí es cierto es más angosto: `projection.ts` no NOMBRA este archivo, así
 * que `Authorship` no está en su alcance léxico. Eso es una propiedad del texto de
 * aquel archivo, no del grafo, y se sostiene por lectura y no por un guardián.
 *
 * De que `Authorship` no entre en la huella cuelgan que el caché de reconocimiento
 * pueda cruzar organizaciones (§{Caché}) y que el mismo contenido subido por dos
 * personas dé la misma huella, así que la protección débil no alcanza y cambiar el
 * retorno ahora compraría un tipo y vendería un invariante. Por eso el bloque 3b
 * PARTE ESTE ARCHIVO: mover `NodeFingerprint`, `asNodeFingerprint`, la familia de
 * hashes y `ObjectKey` a un módulo del fondo que no alcance `Authorship` no es una
 * comodidad, es la única forma de que la frontera sea expresable — y ahí sí la
 * puede imponer `boundaries.mjs`, con su propio mutante.
 *
 * DOS COSAS QUE EL BLOQUE 4 LE AGREGA A LA CHECKLIST DE 3b, y ninguna es una deuda
 * nueva — el bloque 4 dejó a D24 exactamente donde estaba:
 *   1. `adapter.ts` nombra símbolos de LOS DOS LADOS del corte propuesto: importa
 *      `MatterHash` (que va al módulo de hashes) y `AdapterId` (que se queda acá).
 *      Después del split va a importar de DOS módulos. No viola ninguna frontera
 *      —ninguna lo nombra— pero es una línea de import más a mover.
 *   2. El invariante 10 de `invariants.ts` le da a `MatterHash` un consumidor fuera
 *      de este archivo que además es una GARANTÍA ACREDITADA (M41). Es evidencia a
 *      favor del split: la familia de hashes tiene vida propia. Y si 3b mueve
 *      `MatterHash` de módulo, M41 se pudre y falla RUIDOSO («el texto a mutar
 *      aparece en 0 archivos»), que es lo correcto.
 *
 * Y UN HUECO QUE EL BLOQUE 4 ENCONTRÓ Y NO ARREGLA, porque es de este archivo: el
 * censo de más arriba afirma que la familia son SEIS y que «esta línea y las seis de
 * `invariants.ts` se actualizan juntas». NADIE LO VERIFICA. Es el modo de falla que
 * `M9c` impide en `params.ts` —el mismo que la propia línea nombra— y se cierra con
 * el mismo patrón: un `CENSO(...)` en el docstring que un guardián AST coteje.
 *
 * PROVISIONAL(ContentHash): el plan usa el MISMO nombre `ContentHash` para esto y
 * para el hash del texto de un fragmento (§{Tramo 4 › Qué sale} vs
 * §{Las dos salidas}) — dominios, entradas, normalizaciones, reglas de invalidación
 * y consumidores distintos. Marco toda la familia y conservo `ContentHash` como
 * alias público de la huella de nodo, para que las dos citas del plan sigan
 * verificables — Si se decide al revés (un alias opaco para todo), nada impide
 * pasar una huella de nodo donde va una clave de caché de embeddings, ni un
 * `hashBytes` donde va una huella: es la confusión que el documento ya pagó una vez
 * (hallazgo 10, §{Cuarta}).
 *
 * Que la separación EXISTA y no sea solo esta prosa lo prueba `BRAND_PROOFS`
 * en `invariants.ts`. Esta misma promesa estuvo escrita acá mientras los seis
 * tipos eran `never` y no separaban nada.
 */
export type NodeFingerprint = Nominal<string,"NodeFingerprint">;

/**
 * Alias público de `NodeFingerprint`, para que las citas de §{Tramo 4 › Qué sale}
 * sigan verificando.
 */
export type ContentHash = NodeFingerprint;

/**
 * La huella del texto de un fragmento CON sus migas concatenadas. La ÚNICA huella
 * de fragmento: identidad, dedupe y base de la clave del caché de vectores.
 *
 * C2 — RESUELTO, y por derivación, no por elección. La contradicción era:
 * §{Las dos salidas} dice que `texto` es LIMPIO y que su hash es la clave del caché
 * de embeddings; §{Cómo se rebana} dice que lo que se embebe es texto + migas. Con el hash
 * sobre texto limpio, 300 contratos con la misma cláusula comparten entrada y 299
 * reciben un vector que codifica la sección de OTRO documento — sin señal, y para
 * siempre.
 *
 * La regla que lo cierra: LA CLAVE DE UN CACHÉ NO SE ELIGE, SE DERIVA — tiene que
 * ser exactamente la entrada de la función que se cachea. La función es «embeber
 * este texto con este modelo» y la entrada lleva la miga, porque decidimos
 * concatenarla. Cualquier otra clave no es un caché, es un bug.
 *
 * Consecuencias, todas aceptadas:
 *   · El titular «una cláusula estándar en 300 contratos → 1 vector»
 *     (§{Por qué la diferencia}) pasa a
 *     ser «…BAJO LA MISMA SECCIÓN → 1 vector». Sigue siendo grande: las plantillas
 *     de contrato usan títulos estandarizados.
 *   · El borrado del tramo de Diferencia SE SOSTIENE con otro argumento: mismo
 *     documento + fragmento intacto + títulos intactos → misma clave → acierto. El
 *     trabajo del viejo tramo 8 se conserva entero (§{Por qué la diferencia} hay
 *     que reescribirlo).
 *   · Editar un título ahora FALLA el caché de todos los descendientes y los
 *     re-embebe. Es lo correcto: sus vectores efectivamente cambiaron. Con la clave
 *     sobre texto limpio acertaba y servía vectores calculados con la miga vieja.
 *
 * Y por eso `HuellaFragmento` (sobre texto limpio) se BORRÓ: su propósito declarado
 * era «identidad y diferencia»; la diferencia ya no existe, y la identidad tiene
 * que llevar la miga o dos fragmentos del mismo documento con el mismo texto en
 * secciones distintas colisionan. Ese borrado es el que dejó la familia en SEIS.
 */
export type ContextualFingerprint = Nominal<string,"ContextualFingerprint">;

/**
 * La clave del caché de vectores. Una POR VECTOR, no por fragmento:
 *
 *     sha256( miga ‖ texto[rebanada i] ‖ versiónEmbedder )
 *
 * Es exactamente la entrada de la función que se cachea — ver C2 en
 * `ContextualFingerprint`. No es `ContextualFingerprint ‖ versiónEmbedder`, que
 * solo coincidiría cuando el fragmento entra en un vector (N = 1): con N > 1 la
 * huella cubre el texto entero y cada rebanada tiene su propia clave, que es lo que
 * hace que el reuso funcione a nivel de rebanada.
 *
 * La compone el tramo 6, el único que conoce el embedder y el único que rebana.
 */
export type EmbeddingKey = Nominal<string,"EmbeddingKey">;

/**
 * La identidad de una MATERIA descomponible: el par (objeto, ventana) ya
 * canonicalizado.
 *
 * PROVISIONAL(C4): existe para desatascar las dos guardas de terminación, que hoy
 * exigen hashes mutuamente excluyentes sobre el mismo valor. §{Dónde frena} obliga
 * a que una región que cubre casi todo su origen REFERENCIE el original;
 * §{Dónde frena} corta la recursión cuando un hash de contenido ya está en la
 * cadena de ancestros. Con un solo hash: o la guarda de ciclo mata la primera
 * descomposición legítima de toda página escaneada (incluido el caso canónico
 * §{La delegación es emergente} y el «contrato escaneado» que el banco reporta
 * verificado, §{Segunda}), o el punto fijo no dispara jamás. Y el caché por página
 * (§{Caché}) colapsa: si todas las páginas referencian el mismo original, todas
 * colisionan — Separo el valor: `MatterHash = sha256(objeto ‖ ventana canónica)`
 * alimenta el caché por página y la guarda de ciclo (dos páginas → dos ventanas →
 * dos hashes; A→B→A → el A interior es otro objeto con ventana completa → mismo
 * `MatterHash` → corta), y el punto fijo deja de ser igualdad de hashes y pasa a
 * ser lo que §{Dónde frena} dice en prosa: «descomponer devolvió exactamente un
 * bloque cuya ventana cubre la de entrada» (ver `windowCovers` en `shapes.ts`) — Si
 * se decide al revés (un solo hash), hay que elegir cuál de los tres mecanismos
 * —punto fijo, ciclo, caché por página— se sacrifica.
 */
export type MatterHash = Nominal<string,"MatterHash">;

/**
 * La clave del caché de reconocimiento (§{Caché}).
 * `sha256(hashBytes ‖ adapterId ‖ adapterVersion ‖ modelVersion?)`.
 */
export type CacheKey = Nominal<string,"CacheKey">;

// ─────────────────────────────── Constructores ───────────────────────────────
// `ir` no tiene lógica, pero sin constructores nadie puede producir un valor
// marcado y el contrato es inusable. Son conversiones, no validaciones: quien
// construye es responsable de la forma (ULID, hex de 64, ISO-8601).
//
// Son DIECISÉIS. R4 del glosario dice «los 15 constructores de marca» y es una
// errata suya, no del archivo: `grep -c '^export const as' src/identity.ts` = 16.

export const asElementId = (v: string): ElementId => v as ElementId;
export const asLocalId = (v: string): LocalId => v as LocalId;
export const asAdapterId = (v: string): AdapterId => v as AdapterId;
export const asActorId = (v: string): ActorId => v as ActorId;
export const asOrganizationId = (v: string): OrganizationId => v as OrganizationId;
export const asDocumentId = (v: string): DocumentId => v as DocumentId;
export const asObjectKey = (v: string): ObjectKey => v as ObjectKey;
export const asDelegationId = (v: string): DelegationId => v as DelegationId;
export const asFragmentId = (v: string): FragmentId => v as FragmentId;
export const asInstant = (v: string): Instant => v as Instant;

export const asByteHash = (v: string): ByteHash => v as ByteHash;
export const asNodeFingerprint = (v: string): NodeFingerprint => v as NodeFingerprint;
export const asContextualFingerprint = (v: string): ContextualFingerprint =>
  v as ContextualFingerprint;
export const asEmbeddingKey = (v: string): EmbeddingKey => v as EmbeddingKey;
export const asMatterHash = (v: string): MatterHash => v as MatterHash;
export const asCacheKey = (v: string): CacheKey => v as CacheKey;

// ─────────────────────────────── Autoría ─────────────────────────────────────

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
 * `Authorship` NO entra en la huella. Esto NO está dicho en ningún lado del plan y
 * es la única razón por la que sellar una vez por documento alcanza. Hoy lo sostiene
 * que `projection.ts` —el único archivo que calcula la huella— no NOMBRE este
 * archivo, así que `Authorship` no está en su alcance léxico y no se puede escribir.
 *
 * OJO, Y ESTO SE CORRIGIÓ EN EL BLOQUE 3: no lo impone el grafo de módulos. La
 * versión anterior de esta línea decía que sí, y es falso — `shapes.ts` importa
 * `ObjectKey` de acá, así que `projection.ts` YA ALCANZA `identity.ts` y una
 * frontera que lo prohíba nace violada (verificado). La protección es de
 * nombrabilidad, que es más débil y se sostiene por lectura. Ver PENDING(D24) en
 * `NodeFingerprint`: es el mismo hecho mirado desde el otro lado, la razón por la
 * que `fingerprintOf` sigue devolviendo un `string`, y lo que el bloque 3b arregla
 * partiendo este archivo.
 */
export type Authorship = {
  readonly actor: ActorId;
  readonly when: Instant;
  /** Atribución cruda del documento, tal como venía: `"María López (OOXML)"`. */
  readonly source: string;
};
