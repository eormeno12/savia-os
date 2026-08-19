/**
 * Las salidas del pipeline — qué produce cada tramo y qué consume el siguiente.
 */

import type {
  ActorId,
  ByteHash,
  ContentHash,
  ContextualFingerprint,
  DocumentId,
  ElementId,
  EmbeddingKey,
  FragmentId,
  Instant,
  LocalId,
  ObjectKey,
  OrganizationId,
} from "./identity.js";
// La procedencia vive en su propio módulo desde el bloque 3b, y no por tamaño: es lo
// que vuelve escribible `projection.ts ↛ provenance.ts`. Nació como `authorship.ts`
// con un solo miembro; `DelegationId` se le sumó en este bloque y el archivo pasó a
// llamarse por la categoría, que ya tiene criterio. Ver su encabezado.
import type { Authorship, DelegationId, Whence } from "./provenance.js";
import type { Body, Shape } from "./shapes.js";
import type { Token } from "./projection.js";
import type { Hint, RecognitionLevel, Role } from "./classification.js";
import type { Location, SourceRange } from "./location.js";

// ─────────────────────────────── La marca nodal ──────────────────────────────

/**
 * La marca que hace de ESTE archivo la frontera del no-anidamiento.
 *
 * PROVISIONAL(H1): `Node` lleva una marca nominal obligatoria — El plan exhibe
 * `NoAnida<Cuerpo>` como su prueba más fuerte, «no compila si está mal»
 * (§{Estrategia}). Esa versión ya no existe: la auditoría la mostró vacua y el
 * reemplazo recursivo tampoco veía el nodo a través de un campo opcional, de una
 * unión con `null`, de `(Node | null)[]`, de `Node | string`, ni más allá de seis
 * niveles. Hoy el invariante lo impone el GRAFO DE MÓDULOS: `shapes.ts` no puede
 * alcanzar este archivo (`scripts/boundaries.mjs`), y como `NODE_BRAND` vive solo
 * acá, un `Node` dentro de un `Body` es inexpresable en vez de detectable.
 * La marca sigue siendo necesaria: TypeScript es estructural, así que sin ella
 * cualquier objeto que casualmente se parezca a un `Node` lo sería.
 * Con la marca, el detector es EXACTO — COSTO: `Node` deja de ser un objeto plano
 * construible por literal suelto y hay que usar `asNode`. Son dos sitios en todo
 * el sistema (la composición Unit+Classification→Node y el emisor), no los doce
 * adaptadores, que construyen `Unit` — Si se decide al revés (sin marca), el
 * invariante siempre pasa y es indistinguible de uno que funciona.
 *
 * LA INTERFAZ SE LLAMA `BrandedAsNode` Y NO `IsNode` (GLOSARIO.md, G2): R3 manda
 * `es*→is*`, pero `IsNode` quedaría a una mayúscula de `isNode`, el type guard de
 * runtime de `invariants.ts`, y son cosas distintas — un tipo y un predicado.
 */
export const NODE_BRAND: unique symbol = Symbol("savia.ir.node");

export interface BrandedAsNode {
  readonly [NODE_BRAND]: true;
}

// ─────────────────────────────── Tramo 3 ─────────────────────────────────────

/**
 * Lo que produce un adaptador y lo ÚNICO que se cachea por `hashBytes`.
 *
 * PROVISIONAL(#22/C8): `RawNode` no lleva `Authorship` — Ver el razonamiento
 * completo en `Authorship` (`identity.ts`). En una frase: el caché de reconocimiento
 * cruza organizaciones POR DISEÑO (§{Caché}) y `Authorship` es por documento y por
 * tenant, así que si viajara adentro del árbol cacheado se propagaría la del primer
 * subidor a otro tenant. Partir el tipo mueve el invariante del runtime al
 * compilador, que es el criterio declarado del propio plan (§{Estrategia}). Es
 * además el tipo que los golden files de adaptadores (§{Estrategia}) necesitan,
 * porque un snapshot no puede contener un timestamp.
 *
 * NO LLEVA `certainty`, Y ESO ES UN CAMBIO DEL BLOQUE 3. Lo llevaba, junto con
 * `level`, y `certaintyOfLevel` (`classification.ts`) es una función PURA Y TOTAL
 * del nivel: la certeza era enteramente derivable del campo de al lado. Guardar las
 * dos las deja discrepar —un nodo con `level: "perceptual"` y `certainty:
 * "declared"` compilaba— y nada lo impedía. Es el mismo pecado que el paquete ya
 * borró con `CARDINALITIES`: la regla es hacer la contradicción INEXPRESABLE, no
 * detectable. Quien necesite la certeza la deriva, que es una llamada:
 *
 *     certaintyOfLevel(node.level)
 *
 * No se conserva «por comodidad del consumidor» porque ese es exactamente el
 * argumento que produce dos fuentes de verdad. Y no rompe ninguna promesa del plan:
 * «la certeza viaja con el nodo y llega hasta la skill» (§{La escalera}) sigue
 * siendo cierta — viaja el nivel, que dice estrictamente más.
 */
export type RawNode = {
  readonly role: Role;
  readonly body: Body;
  readonly location: Location;
  /**
   * PROVISIONAL(#43): campo NUEVO, no está en §{Tramo 3 › Qué sale} — El tramo 4
   * declara que recibe «la secuencia de nodos del tramo 3, CADA UNO CON SU PISTA»
   * (§{Tramo 4}) y `Node` tiene cinco campos, ninguno la pista. La pista nace en
   * `Classification` (§{`detectar`}) y no llega a ningún tipo declarado. Sin ella
   * el emisor —paso 2 del orden de construcción, §{Orden}— no tiene entrada y es
   * inescribible. Es una omisión, no una decisión: el plan dice tres veces que la
   * pista es el producto estructural del tramo 3 y que el tramo 4 la consume —
   * Legal por R1: la pista ya es libre de formato (§{La pista}). `null` = el
   * clasificador se abstuvo, hereda la ruta del nodo anterior; ver PROVISIONAL(#43)
   * en `Classification` — Si se decide al revés (pares `[Node, Hint][]`), hay que
   * nombrar un tipo intermedio que el plan no nombra y decidir dónde vive.
   */
  readonly hint: Hint | null;
  /**
   * PROVISIONAL(C21): campo NUEVO — La cadena de marcos de delegación por los que
   * se llegó a este nodo, de afuera hacia adentro. Vacío = documento raíz. Lo
   * escribe el ORQUESTADOR al injertar, nunca el adaptador (que no sabe que fue
   * delegado). El emisor compara la cadena del nodo anterior con la actual para
   * decidir «BAJÓ» / «SUBIÓ» (§{2 · Emisor}) — Ver el razonamiento en
   * `DelegationId`. NO entra en la huella.
   */
  readonly delegation: readonly DelegationId[];
  /**
   * DE DÓNDE SALIERON LOS BYTES de este nodo. `null` = del propio documento. Sale de
   * la unidad del adaptador y se copia tal cual; ver `Unit.whence` y `Whence`.
   *
   * ES HERMANO DE `body`, Y AHÍ ESTÁ LA GARANTÍA. `fingerprintOf` recibe `Body`, así
   * que un campo de este nivel NO PUEDE entrar en la huella: no es que hoy no entre,
   * es que no hay forma de escribir el código que lo cuele. Adentro de `Body` quedaría
   * afuera solo por omisión —porque `project` casualmente lee `ref` y nada más— y el
   * próximo que agregue una rama lo rompería sin enterarse.
   *
   * Y TIENE QUE NO ENTRAR: la clave de un objeto es el hash de su contenido, o sea que
   * la misma imagen traída desde dos documentos da UNA sola dirección a propósito. Si
   * la procedencia moviera la huella, serían dos identidades para la misma figura y
   * toda la curación de una de las dos se despegaría.
   */
  readonly whence: Whence | null;
  /**
   * PROVISIONAL(#61): campo NUEVO — Qué eslabón de la cascada resolvió este nodo.
   * `null` = lo resolvió el piso físico. La observabilidad lo llama «la importante»
   * y «el indicador de salud de toda la capa de reconocimiento»
   * (§{Observabilidad}), y `enCascada` (§{La única}) DESCARTA cuál eslabón
   * resolvió: el caso que la sección describe (60% resuelto por prominencia en DOCX
   * = mapa de estilos incompleto) es indistinguible con solo la certeza, porque
   * prominencia, geometría y modelo son los tres `inferred` — NO entra en la huella
   * (si entrara, mejorar un clasificador movería todos los ids) ni en la
   * comparación de similitud de los pases 2 y 3 — Si se decide al revés (por
   * `Diagnostics`), son 50 000 avisos en una planilla.
   */
  readonly attribution: string | null;
  /**
   * El nivel de la escalera que lo resolvió. Ver PROVISIONAL(C18/C19).
   *
   * Es el ÚNICO campo de certidumbre que se almacena: la certeza sale de acá con
   * `certaintyOfLevel(level)` y el orden sale de `rank(level)`. Ver el párrafo del
   * tipo sobre por qué `certainty` no está.
   */
  readonly level: RecognitionLevel;
  /**
   * PROVISIONAL(C19): campo NUEVO, `null` salvo en el nivel perceptual —
   * §{La escalera} declara que el perceptual produce «`inferido` + confianza» y
   * §{La escalera} promete que «una skill puede decidir no citar como autoridad
   * algo reconocido con confianza baja», y la certeza tiene dos valores y ningún
   * número: la promesa que el plan usa para distinguirse («la diferencia entre un
   * pipeline que adivina y uno que declara cuánto está adivinando», §{La escalera})
   * no tiene implementación — El umbral de citabilidad vive fuera de este pipeline
   * (capa de skills), pero el campo tiene que nacer acá o no existe.
   *
   * `null` significa NO APLICA —el piso físico no infiere nada, así que no hay
   * confianza que reportar— y NUNCA «cero». Es la distinción que `Fragment.confidence`
   * tiene que preservar al agregar, y por eso lleva `hasNull` aparte.
   */
  readonly confidence: number | null;
};

/**
 * Un nodo del tramo 3, ya con autoría. Es `RawNode` + lo que es por documento.
 * §{Tramo 3 › Qué sale} lo declara con cinco campos; los otros están
 * justificados uno por uno arriba.
 */
export type Node = RawNode & { readonly authorship: Authorship } & BrandedAsNode;

/** Constructor: la marca nodal no se escribe a mano. */
export const asNode = (n: RawNode & { readonly authorship: Authorship }): Node => ({
  ...n,
  [NODE_BRAND]: true,
});

// ─────────────────────────────── Tramo 4 ─────────────────────────────────────

/**
 * Un elemento de las migas de pan.
 *
 * PROVISIONAL(C15/#50/#73): `breadcrumbs` deja de ser `string[]`
 * (§{Tramo 4 › Qué sale}, §{Las dos salidas}) y pasa a llevar la REFERENCIA al
 * nodo-título además de su texto — Tres cosas lo obligan. (1) C15: un `lead` «no
 * arranca un fragmento con su texto: cierra el anterior y entra a las migas»
 * (§{Los títulos}) y `text` es LIMPIO, así que el texto de un título no entra en el
 * `text` de NINGÚN fragmento y «un nodo entra entero en algún fragmento, siempre»
 * (§{El recorrido}) es falso para todos los `lead`. Con la referencia, el título
 * queda referenciado desde el fragmento. (2) La miga va al payload del tramo 7
 * «para filtrar por sección de forma exacta» (§{Las cinco}) y el texto de un título
 * es MUTABLE POR DISEÑO: un filtro guardado por «Cláusula primera» deja de matchear
 * cuando alguien la renombra, EN SILENCIO — la misma edición a la que el tramo 4
 * dedica una sección entera a sobrevivir. Filtrando por la referencia, sobrevive.
 * (3) Con `string[]` no hay forma de saber de qué nodo salió una miga — Si se
 * decide al revés, el filtro por sección es por texto mutable y el texto de los
 * `lead` solo persiste en la tabla de nodos.
 *
 * SIGUE ABIERTO Y HAY QUE DECIDIRLO (auditoría #50): normalización y truncado del
 * texto de la miga (ver `PARAMETERS.grouping.maxBreadcrumbLength`). Ese string
 * entra en `ContextualFingerprint`, así que sin regla el mismo título produce migas
 * distintas entre ingestas. El bloque 3 lo dejó abierto ENTERO a propósito: la
 * mitad que es número está declarada `Pending` en `params.ts`, y la mitad que es
 * regla —qué normalización, dónde trunca— se puede cerrar acá con `normalize`, pero
 * es un agregado al contrato que este bloque no tenía decidido.
 */
export type Breadcrumb<Ref> = {
  readonly ref: Ref;
  readonly text: string;
};

/** Migas durante el recorrido del emisor: los `ElementId` todavía no existen. */
export type LocalBreadcrumb = Breadcrumb<LocalId>;
/** Migas ya reconciliadas. */
export type StableBreadcrumb = Breadcrumb<ElementId>;

/**
 * La salida del EMISOR, antes del reconciliador.
 *
 * PROVISIONAL(#66): tipo NUEVO — El plan declara un solo tipo entre el tramo 4 y el
 * 5 (`EmittedNode`, §{Tramo 4 › Qué sale}), y ese tipo no puede ser la salida del
 * emisor: dice que `id` sale «de la reconciliación» y `parentId` «del emisor», y el
 * emisor corre ANTES. La salida intermedia existe, es sobre la que corre el
 * reconciliador, y no era escribible — Ver el razonamiento completo en `LocalId`.
 */
export type RoutedNode = Node & {
  readonly local: LocalId;
  readonly localParent: LocalId | null;
  readonly breadcrumbs: readonly LocalBreadcrumb[];
  readonly hash: ContentHash;
};

/** La salida del tramo 4 (§{Tramo 4 › Qué sale}). */
export type EmittedNode = Node & {
  /** De la reconciliación, no de una fórmula. */
  readonly id: ElementId;
  /** Del emisor, remapeado desde `localParent`. */
  readonly parentId: ElementId | null;
  /** Del emisor, misma pila. */
  readonly breadcrumbs: readonly StableBreadcrumb[];
  /** Material para la próxima reconciliación. */
  readonly hash: ContentHash;
};

/**
 * El denominador de la métrica `anchoring`.
 *
 * PROVISIONAL(#62): el conteo del lado VIEJO — §{Degradación} define `anclaje` como
 * «proporción de nodos emparejados por el pase 1» sin decir sobre qué total. Con
 * 500 nodos viejos y 5 nuevos el número cambia radicalmente según se use el conteo
 * nuevo, el viejo, el máximo o el mínimo, y por eso los tres valores que el banco
 * reporta (1.00, 0.38, 0.00) NO son reproducibles. Elijo el viejo porque es lo que
 * la métrica dice vigilar: cuánta identidad previa se preservó, o sea cuánta
 * curación del cliente sobrevivió — Si se decide al revés (`max`), borrar 400 de
 * 500 nodos también dispara la alerta, que puede ser deseable pero es otra cosa.
 * Las tres cantidades crudas se emiten igual para que el número sea reconstruible.
 *
 * El valor es un vocabulario cerrado de UN elemento y es DATO, no nombre
 * (GLOSARIO.md, G8): viaja al evento de degradación.
 */
export const ANCHORING_DENOMINATOR = "old" as const;

/** Las cinco cantidades de «degradación honesta» (§{Degradación}). */
export type ReconciliationMetrics = {
  /** Proporción en [0,1] sobre `ANCHORING_DENOMINATOR`. */
  readonly anchoring: number;
  readonly byHash: number;
  readonly bySimilarity: number;
  /** Si crece, algo reordena mucho. */
  readonly byResidue: number;
  readonly additions: number;
  readonly removals: number;
  /** Crudas, para que `anchoring` sea reconstruible con otro denominador. */
  readonly oldNodes: number;
  readonly newNodes: number;
  /**
   * PROVISIONAL(H16): campos NUEVOS — §{Degradación} identifica con precisión que
   * un anclaje bajo «puede ser un documento reescrito, o puede ser que UN ADAPTADOR
   * CAMBIÓ», que «esas dos causas se ven idénticas desde afuera», y se detiene ahí.
   * Las consecuencias NO son simétricas: en el primer caso reemplazar en bloque es
   * correcto; en el segundo DESTRUYE LA CURACIÓN DE TODOS LOS DOCUMENTOS DE ESE
   * FORMATO A LA VEZ. El dato que las desambigua existe (id y versión del adaptador
   * están en la clave del caché) y el plan no lo adjunta al evento — Si se decide
   * al revés, la única alerta del peor modo de falla no es accionable.
   */
  readonly previousAdapter: string | null;
  readonly previousVersion: string | null;
  /**
   * PROVISIONAL(#88): campo NUEVO — Llamadas a `similarityOfProjections` que hizo
   * esta corrida, sumando los pases 2 y 3. Es el ÚNICO canal por el que
   * `PARAMETERS.identity.maxComparisons` se puede medir alguna vez: su docstring
   * dice «se mide: curva tiempo vs tamaño de hueco sobre el corpus», y sin este
   * número no hay de dónde sacar la curva. El plan declara el parámetro medible y
   * no le deja instrumento — Si se decide al revés, el tope se elige a ojo, que es
   * exactamente lo que «ningún número inventado» prohíbe.
   */
  readonly comparisons: number;
  /**
   * PROVISIONAL(#89): campo NUEVO — Nodos VIEJOS que se fueron a `removals` sin que
   * el presupuesto de `maxComparisons` les diera su comparación. Sin él, agotar el
   * tope es INVISIBLE: `byHash` no se mueve, así que `anchoring` tampoco, así que el
   * evento de anclaje bajo no se dispara y la promesa «nunca se trunca en silencio»
   * es literalmente falsa. Las dos condiciones coinciden en el caso que las motivó
   * —renombrar una columna deja cero anclas Y revienta el presupuesto—, y por eso la
   * contradicción no se veía; pero un documento con anclaje alto y UN SOLO HUECO
   * ENORME trunca en silencio. Ver la corrección del docstring de `maxComparisons`
   * en `params.ts`, y GLOSARIO.md, P21 — Si se decide al revés, el truncado deja de
   * ser distinguible de «no había nada que emparejar».
   */
  readonly uncompared: number;
  /**
   * PROVISIONAL(#90): campo NUEVO — Nodos NUEVOS cuyo hash no es único de su lado, o
   * sea que no pueden ni intentar anclar (`maxMultiplicityForAnchoring`). Es la única
   * señal del peor modo de falla del tramo —«la huella no cubre una forma, todos
   * hashean igual, el pase 1 no ancla NINGUNO y la identidad colapsa en silencio»,
   * §{Tramo 4 › Qué sale}— que suena en la PRIMERA ingesta, antes de que exista
   * versión anterior contra la que comparar. El plan cuenta que ya pasó: las 500
   * filas de una planilla hashearon idénticas y una inserción movió 500
   * identificadores.
   *
   * OJO AL LEERLO: tiene un piso NO NULO conocido y no se lee contra cero. Los
   * `container` desnudos —misma forma, mismo `ordered`, sin esquema— hashean igual
   * POR CONSTRUCCIÓN, así que un documento sano con dos listas simples ya reporta
   * ambigüedad. Se lee contra la línea de base del propio documento: lo que importa
   * es que SALTE, no que sea cero.
   */
  readonly ambiguous: number;
};

/**
 * La salida completa del tramo 4.
 *
 * PROVISIONAL(#63): un objeto, no un arreglo — El reconciliador produce altas Y
 * BAJAS («lo que sigue sin par: del lado nuevo son altas, del lado viejo, bajas»,
 * §{5 · Reconciliador}) y cinco métricas, y el único tipo de salida declarado es
 * `EmittedNode`, que es solo el lado nuevo. El tramo 7 tiene que borrar filas y
 * puntos de lo que ya no existe y NADIE LE ENTREGA LA LISTA: sin eso el índice
 * acumula contenido borrado que sigue siendo recuperable con procedencia confiable
 * — Si se decide al revés (bajas por `Diagnostics`), pierden tipo y el tramo 7 no
 * las puede consumir programáticamente.
 *
 * SIGUE ABIERTO (auditoría #19): qué pasa con una anotación cuyo nodo es una baja.
 * ¿Se borra en cascada? ¿Queda huérfana? ¿Se resucita si el párrafo vuelve? El plan
 * resuelve el caso del nodo que sobrevive con otro id y no el del que desaparece.
 * El bloque 3 no lo cierra —es política de persistencia del tramo 7 y ningún tipo
 * la expresa— pero le SUBE EL PESO: con `Annotation.actor`, lo que una cascada
 * borra deja de ser «una anotación» y pasa a ser curación ATRIBUIBLE a una persona.
 */
export type EmissionOutput = {
  readonly nodes: readonly EmittedNode[];
  readonly removals: readonly ElementId[];
  readonly metrics: ReconciliationMetrics;
};

// ──────────────────── El índice de reconciliación (C12 · C11) ────────────────
/**
 * Lo que el reconciliador necesita recordar de la versión anterior. Es la ENTRADA
 * del tramo 4, igual que `EmissionOutput` es su salida.
 *
 * POR QUÉ EXISTE — C12. Los pases 2 y 3 emparejan por PARECIDO, así que necesitan
 * el contenido viejo y no solo su hash; y R3 declara la IR «descartable, se
 * regenera entera desde los bytes». La auditoría planteó la contradicción bien y la
 * clasificó mal: el `ElementId` NO está en el documento — no se lee de los bytes,
 * lo CONCLUYE el reconciliador. Cae del lado de las ANOTACIONES en R3, no del de la
 * IR, que es por eso que ya vive en Postgres anclando la curación. Esto no es «la
 * IR persistida»: es la evidencia que sostiene esa conclusión, y su único
 * consumidor es la próxima reconciliación. R3 estaba escrita como si el id viniera
 * solo.
 *
 * Re-reconocer los bytes viejos NO es alternativa: devuelve nodos, no devuelve sus
 * identidades, que son justamente lo que se está preservando.
 *
 * QUÉ NO GUARDA. No el `Body` con su ubicación, pistas, autoría y marcas: solo la
 * PROYECCIÓN, porque `similarityOfProjections` opera sobre `Token[]` y no sobre
 * cuerpos. La costura ya estaba en `projection.ts`.
 */
export type KnownNode = {
  readonly id: ElementId;
  /**
   * Material del pase 1 (hash join sobre hashes únicos de cada lado).
   *
   * Y del paso anterior a los tres pases: leído al revés (`hash → documento`) es
   * como se ELIGE contra qué versión reconciliar cuando el canal no trae un id
   * estable. Con la misma regla de unicidad un nivel más arriba — solo votan los
   * hashes que aparecen en un único documento del corpus—, porque si no, 300
   * contratos de la misma plantilla se emparejan entre sí por el articulado común.
   */
  readonly hash: ContentHash;
  /** El pase 2 exige mismo tipo y misma forma antes de medir parecido. */
  readonly role: Role;
  readonly shape: Shape;
  /** Material de los pases 2 y 3. Va a `similarityOfProjections`. */
  readonly projection: readonly Token[];
};

/**
 * En qué versión de qué documento apareció un nodo, y en qué posición.
 *
 * EL ORDEN — C11. «No se almacena nada derivable: ni `depth`, ni `siblingIndex`, ni
 * `ordinal`» (§{2 · Emisor}) es correcto y aplica a la IR: en la versión VIVA todo
 * eso se camina desde `parentId`. Pero el pase 2 «parte AMBAS listas en tramos» y
 * el orden de la lista vieja no se puede caminar desde nada, porque el árbol viejo
 * ya no existe. Por eso `order` vive acá y no en el nodo: no se está duplicando
 * algo derivable, se está recordando algo irrecuperable.
 *
 * LA VERSIÓN ES `ByteHash`, no un contador — no hace falta secuencia ni
 * coordinación: los bytes que produjeron la versión LA IDENTIFICAN, y ya están en
 * la fila `documento`. Mismos bytes, misma versión; bytes distintos, versión
 * distinta.
 *
 * SE ACUMULA, NO SE REEMPLAZA. La primera versión de este diseño tiraba la anterior
 * para ahorrar espacio. No ahorra: `KnownNode` está direccionado por contenido,
 * y un nodo que no cambió entre versiones es LA MISMA FILA —mismo id, mismo hash,
 * misma proyección— así que se guarda una vez. Cincuenta versiones con 1 % de
 * cambio cuestan ≈ 1,05 versiones. Es el mecanismo de git, y tirar la anterior
 * cerraba las consultas temporales («¿qué decía este contrato en marzo?») a cambio
 * de nada.
 *
 * AGREGADO(H3): `organization`. Sin ella, el paso «`hash → documento`» de
 * `KnownNode.hash` elige contra qué versión reconciliar mirando TODO el corpus, y
 * el corpus cruza tenants: dos organizaciones que subieron el mismo contrato
 * estándar se eligen mutuamente y la reconciliación arrastra ids de un tenant al
 * otro. El filtro tiene que existir donde se hace la consulta, y este es el único
 * tipo que la describe. No envenena el caché de reconocimiento —ver `Ingestion`—
 * porque esta fila NO viaja adentro del árbol cacheado: es el índice, no la IR.
 */
export type NodeInVersion = {
  readonly document: DocumentId;
  readonly organization: OrganizationId;
  /**
   * ATÓMICO CON LOS NODOS — H13(c). Esta fila y el `EmittedNode` que la origina se
   * persisten en la MISMA transacción. Si una corrida guarda los nodos y no el
   * índice, la próxima re-ingesta no tiene contra qué reconciliar: se mueven todos
   * los ids y se despega toda la curación, en silencio. Es un requisito sobre el
   * tramo 7 que ningún tipo puede imponer.
   */
  readonly version: ByteHash;
  /** Posición en la lista plana emitida. Ver C11 arriba. */
  readonly order: number;
  readonly node: ElementId;
};

// ─────────────────────────────── Tramo 5 ─────────────────────────────────────

/**
 * La salida difusa del tramo 5 (§{Las dos salidas}).
 *
 * Dos desviaciones del literal, las dos marcadas en su campo: `hash` se parte en
 * dos (C2) y `breadcrumbs` gana referencia (C15).
 *
 * PROVISIONAL(#75): el tipo se PARAMETRIZA por `Ref` y pierde DOS campos, que pasan
 * a `StableFragment` — El tipo declaraba `nodes: ElementId[]` y `breadcrumbs:
 * StableBreadcrumb[]`, y el tramo 5 corre ANTES del reconciliador: no hay forma de
 * que produzca un `ElementId`. Es el MISMO desajuste que este archivo ya resolvió
 * para las migas (`Breadcrumb<Ref>` / `LocalBreadcrumb` / `StableBreadcrumb`,
 * PROVISIONAL(C15/#50/#73)) y para los nodos (`RoutedNode` / `EmittedNode`,
 * PROVISIONAL(#66)), así que la respuesta es la misma y no una tercera.
 *
 * PARAMETRIZAR SOLO POR `Ref` NO ALCANZABA, y eso se midió: quedaban DOS campos que
 * el tramo 5 tampoco puede producir, y por razones distintas.
 *   · `id: FragmentId` se deriva de `(DocumentId, contextualFingerprint)`
 *     (PROVISIONAL(#69)) y el tramo 5 no tiene documento: el `DocumentId` vive en el
 *     envoltorio `Ingestion`, un tramo más arriba. Es el mismo argumento de H13(a)
 *     que ya deja a `Unit` y a `RawNode` sin `id`, y se asevera igual —
 *     `_LocalFragmentHasNoId` en `invariants.ts`.
 *   · `contextualFingerprint` es `sha256(miga ‖ texto)` y la miga entra en la
 *     preimagen. La NORMALIZACIÓN de ese texto está declarada ABIERTA en
 *     `Breadcrumb` (auditoría #50, `PARAMETERS.grouping.maxBreadcrumbLength` en
 *     `null`): calcularla hoy congela una preimagen cuya regla el propio contrato
 *     dice que no está decidida, y esa preimagen es la base de la clave del caché de
 *     vectores. Un hash mal preimaginado no falla: sirve el vector de otro para
 *     siempre.
 *
 * Si se decide al revés (un solo `Fragment` con `ElementId`), el tramo 5 no tiene
 * tipo de salida y lo declara localmente en `emission` — que es exactamente lo que
 * el encabezado de `index.ts` prohíbe: «ninguna definición de este paquete se
 * re-declara afuera».
 */
export type Fragment<Ref> = {
  /** LIMPIO — las migas no van adentro (§{Las dos salidas}). */
  readonly text: string;
  /** El tramo 6 las concatena al embeber (§{Las dos salidas}). */
  readonly breadcrumbs: readonly Breadcrumb<Ref>[];
  /** Procedencia; sobrevive a que el fragmento se rearme (§{Las dos salidas}). */
  readonly nodes: readonly Ref[];
  /**
   * PROVISIONAL(#74): campo NUEVO, el PEOR nivel de reconocimiento de los nodos
   * agrupados, por `rank()` — «La certeza no se queda en este tramo: viaja con el
   * nodo, sobrevive a la fragmentación y LLEGA HASTA LA SKILL QUE CONSUMA ESA
   * MEMORIA» (§{La escalera}) es una promesa central del documento y no tiene
   * mecanismo en ningún tramo posterior al 3: un fragmento agrupa N nodos que
   * pueden diferir. `certeza: 'mixto'` se borró porque «se calculaba y NO LO LEÍA
   * NADIE» (§{Lo que se borró}) — el lector que la leería es este, y todavía no
   * existía cuando se borró — Si se decide al revés (join por `nodes` en el tramo
   * 7), la promesa depende de una consulta que nadie declaró. La AUTORÍA, en
   * cambio, NO se comprime: es multivaluada por naturaleza y «esto lo dijo el CFO
   * en marzo» exige el actor, no un resumen — va por join.
   *
   * ES `RecognitionLevel` Y NO `Certainty`, Y ESE ES EL ARREGLO DEL BLOQUE 3. El
   * campo se llamaba `minCertainty` y prometía «la PEOR certeza de los nodos
   * agrupados», que NO ERA COMPUTABLE: el paquete no exportaba ningún orden sobre
   * `Certainty`. Peor, si alguien lo deducía de `CERTAINTIES.indexOf` —`declared`=0,
   * `inferred`=1— la peor era el MÁXIMO mientras el campo se llamaba `min`, así que
   * un consumidor razonable escribía `Math.min` y obtenía lo contrario de lo
   * prometido, en verde. Sobre `RecognitionLevel` el orden ya existe (`rank`, que es
   * un `indexOf` sobre la escalera), es total y va en el sentido correcto, y «el
   * peor» es de verdad el máximo del rank.
   *
   * Y LA CERTEZA NO SE ALMACENA: se deriva con `certaintyOfLevel(minLevel)`. Con eso
   * la contradicción «`minCertainty: "declared"` con confianza baja» deja de ser
   * detectable y pasa a ser INEXPRESABLE, que es la regla del paquete. Es el mismo
   * movimiento que `RawNode` hizo con su propio `certainty`.
   */
  readonly minLevel: RecognitionLevel;
  /**
   * PROVISIONAL(#74): campo NUEVO — La confianza numérica agregada de los nodos
   * agrupados. `RawNode.confidence` existe y su docstring nombra al consumidor («el
   * umbral de citabilidad vive fuera de este pipeline, capa de skills»), y sin este
   * campo MORÍA EN EL NODO: el fragmento comprimía la certeza y no la confianza,
   * así que la única pregunta que la capa de skills hace en el punto donde decide
   * citar —«¿este fragmento supera mi umbral?»— exigía un join que nadie declaró.
   *
   * LA FORMA TIENE DOS CAMPOS PORQUE EL `null` DEL NODO SIGNIFICA ALGO. En
   * `RawNode.confidence`, `null` es «NO APLICA» —el piso físico no infiere nada, así
   * que no hay confianza que reportar— y nunca «cero». Cualquier agregación tiene
   * que decir qué hace con él, y las formas de un solo número pierden información
   * justo en el campo que existe para decidir si citar:
   *   · ignorando los `null`, «todos confiables» es indistinguible de «hay un nodo
   *     sobre el que no sé nada»;
   *   · dejando que un `null` contamine, un solo nodo declarativo —que es el caso
   *     NORMAL, y el más confiable— tira el agregado entero y el `null` cambia de
   *     significar «no aplica» a «no sé», que no es lo que el campo del nodo dice.
   * Con los dos campos, las dos preguntas se hacen por separado y ninguna se pierde:
   *   · `min` es el piso de los nodos QUE REPORTARON;
   *   · `hasNull` dice si alguno de los agrupados no reportaba.
   *
   * EL `null` DE AFUERA ES «NO APLICA», IGUAL QUE EN EL NODO, y nunca «cero»: es el
   * fragmento en el que NINGÚN nodo reportó confianza, o sea el fragmento
   * enteramente declarativo, que es el más confiable de todos. Leerlo como cero
   * invierte exactamente el sentido. Un consumidor que quiera «citable» pregunta
   * `confidence === null || (confidence.min >= umbral && !confidence.hasNull)`.
   *
   * LO QUE ESTE CAMPO NO GUARDA, declarado: cuántos nodos eran `null`, ni cuáles. Si
   * hiciera falta, están en `nodes`.
   */
  readonly confidence: {
    readonly min: number;
    readonly hasNull: boolean;
  } | null;
};

/**
 * El fragmento tal como sale del TRAMO 5: agrupado, sin identidad y sin huella.
 * Referencia los nodos por su `LocalId`, que es lo único que existe antes del
 * reconciliador.
 */
export type LocalFragment = Fragment<LocalId>;

/**
 * El fragmento cuyas REFERENCIAS ya son las definitivas: lo que produce el tramo 5
 * una vez que el reconciliador corrió, en el orden que el plan declara («Entra: la
 * lista plana del tramo 4, con identidad y migas», §{Las dos salidas}).
 *
 * `Stable*` SIGNIFICA UNA SOLA COSA EN LAS TRES FAMILIAS, y desde el paso 12 también
 * acá: el espacio de referencias es el definitivo, igual que en `StableBreadcrumb` y
 * `StableDataRecord`. Hasta este paso este tipo llevaba además `id` y
 * `contextualFingerprint`, o sea que «Stable» quería decir una cosa en dos familias y
 * otra en la tercera; los dos campos se mudaron a `IdentifiedFragment`, que dice qué
 * son. Ver GLOSARIO.md, P23 — y ahí también el precio, dicho de frente: un tipo
 * exportado cambió de significado.
 *
 * ES EL TIPO SOBRE EL QUE `_S7` YA ASSERTEABA SIN NOMBRARLO. La aserción se escribía
 * contra `Fragment<ElementId>` a mano y el comentario explicaba por qué NO contra
 * `StableFragment`: con los dos campos de más, la no-asignabilidad se cumplía sola
 * —por los campos ausentes— y habría seguido cumpliéndose con las dos referencias
 * iguales. Sin ellos, lo único que separa a los dos tipos es `Ref`, que es lo que esa
 * fila existe para fijar.
 */
export type StableFragment = Fragment<ElementId>;

/**
 * El fragmento que además tiene IDENTIDAD PROPIA: lo que el tramo 6 embebe y el tramo
 * 7 indexa. Es el `Fragment` completo que el plan declara (§{Las dos salidas}).
 *
 * LOS DOS CAMPOS DE MÁS NO SON UN ADORNO DEL NOMBRE, y son lo que la orquestación NO
 * PUEDE producir — por eso `Run` entrega `StableFragment` y no esto:
 *   · `id` se deriva de `(DocumentId, contextualFingerprint)` y el `DocumentId` vive
 *     en el envoltorio `Ingestion`, un tramo más arriba.
 *   · la huella sale de una preimagen cuya normalización el contrato todavía declara
 *     abierta (`PARAMETERS.grouping.maxBreadcrumbLength` en `null`). Calcularla hoy
 *     congela la base de la clave del caché de vectores con una regla sin decidir, y
 *     un hash mal preimaginado NO FALLA: sirve el vector de otro, para siempre.
 * Mientras las dos cosas falten no hay fragmento completo que producir, y el tipo lo
 * dice en vez de dejarlo a la disciplina.
 *
 * NO SE LLAMA `IndexedFragment`, y la razón está en GLOSARIO.md, P24: ese nombre
 * nombra lo que un tramo POSTERIOR le hace —el mismo defecto que `CascadeResult` y
 * `plainTextAdapter`— y encima mentiría durante todo el rato en que el fragmento
 * todavía no está indexado. Lo que los dos campos compran es identidad: la huella es
 * la de contenido, y el `id` es la dirección que se deriva de ella.
 */
export type IdentifiedFragment = StableFragment & {
  /** Ver PROVISIONAL(#69) en `FragmentId`. */
  readonly id: FragmentId;
  /**
   * La ÚNICA huella del fragmento: `sha256(miga ‖ texto)`. Identidad, dedupe y base
   * de `FragmentId`. Ver C2 en `ContextualFingerprint` — la huella sobre texto
   * limpio se borró. NO es la clave del caché de vectores: esa es por rebanada y
   * lleva además la versión del embedder.
   */
  readonly contextualFingerprint: ContextualFingerprint;
};

/**
 * La salida del tramo 6. Un fragmento produce N ≥ 1 de estos.
 *
 * NO existe el sustantivo «ventana» acá. El tramo 4 ya usa `window` para la región
 * de un objeto (`ObjectRef`) y el tramo 5 para el ventaneo de filas de una grilla
 * (§{Los decodificadores}); un tercer sentido era la colisión de vocabulario que la
 * auditoría marca en H15. No hace falta ninguno: un fragmento da N vectores y el
 * vector ya es el sustantivo. El caso normal es N = 1, sin rama.
 *
 * Cómo se rebana, cuando el texto excede el límite del modelo:
 *
 *     B = L − m         L = tokens máximos del embedder, m = tokens de la miga
 *     N = ceil(T / B)   T = tokens del texto limpio
 *     vector i  =  embeber( miga ‖ texto[(i−1)·B : i·B] )
 *
 * Rebanadas consecutivas de exactamente `B` tokens, la última con el resto, SIN
 * solapamiento, y la miga en TODAS (si fuera solo en la primera, las siguientes
 * quedan descontextualizadas — el problema que el tramo 5 declara resuelto en
 * §{Los títulos}; cuesta ~1 %).
 *
 * POR QUÉ EL CORTE CAE DONDE CAE, a mitad de palabra si toca — C17. El invariante
 * de §{Dos casilleros} prohíbe partir «porque partir exige conocer el formato». La
 * distinción que el documento nunca hizo:
 *   · PARTIR   = producir unidades que el sistema después trata por separado
 *                (identidad, cita, recuperación). Prohibido fuera del tramo 3.
 *   · REBANAR  = cortar una secuencia de tokens en pedazos de tamaño fijo que nadie
 *                mira por separado y que dedupican a la misma unidad. Aritmética.
 * Cortar BIEN —respetando oraciones, sin romper un bloque de código— SÍ sería
 * contrabando de formato. La arbitrariedad del corte es lo que lo vuelve legal. La
 * prueba para distinguirlos: ¿algo aguas abajo distingue los pedazos? Si sí, es
 * partir.
 *
 * La última rebanada puede quedar diminuta (miga + 3 tokens) y se acepta: si
 * matchea, devuelve el FRAGMENTO CORRECTO, porque el tramo 7 dedupica por
 * `FragmentId`. Balancear las rebanadas lo evitaría, pero cambia el tamaño de
 * todas ante cualquier edición y con eso se pierde el reuso del caché.
 *
 * DEBILIDAD CONOCIDA: una edición en el medio de un fragmento grande corre todas
 * las fronteras siguientes, así que esas rebanadas fallan el caché aunque su texto
 * no cambió. La solución conocida es rebanado por contenido (rolling hash,
 * FastCDC), que es igual de agnóstico al formato y re-sincroniza las fronteras
 * solo. No se adopta ahora porque solo se ejerce en fragmentos que exceden `L`
 * (minoría) y trae dos números nuevos que justificar. GATILLO escrito de antemano:
 * si al medir los fragmentos rebanados no son minoría, o si el re-embebido tras
 * editar documentos grandes pesa.
 */
export type Vector = {
  readonly fragment: FragmentId;
  /** `i` de `N`. Da unicidad de fila; nada aguas abajo lo interpreta. */
  readonly order: number;
  /** Lo que se cacheó. Ver `EmbeddingKey`: es por rebanada, no por fragmento. */
  readonly key: EmbeddingKey;
  readonly values: readonly number[];
};

/**
 * Un par de `DataRecord.values` que admite etiquetas ausentes y repetidas.
 *
 * SE LLAMA `FieldValue` Y NO `Value` (GLOSARIO.md, G3): `Value` es correcto y vacío,
 * y queda a un carácter de `Vector.values` y de `DataRecord.values`, que son otra
 * cosa. `FieldValue` ata además con `fieldKey` (`projection.ts`), que es la política
 * de claves de exactamente estos pares.
 */
export type FieldValue = {
  readonly label: string | null;
  readonly value: string;
};

/**
 * La salida exacta del tramo 5 (§{Las dos salidas}). La mitad σ del split π/σ.
 *
 * PROVISIONAL(#55): `values` es un ARREGLO de pares, no `Record<string,string>` —
 * El `Record` exige claves únicas y no vacías y una planilla real tiene columnas
 * sin encabezado, encabezados repetidos y filas cortas: el tipo del plan es
 * incumplible. Quien quiera el `Record` usa `fieldKey` de `projection.ts`, que
 * lleva la política explícita — Si se decide al revés (`Record` con claves
 * sintéticas en cada consumidor), dos implementaciones dan `DataRecord` distintos.
 *
 * SIGUE ABIERTO (auditoría #55): si la fila de encabezado es ella misma un nodo que
 * emite registro. El «502» de §{Las filas} nunca se desglosa.
 * SIGUE ABIERTO (auditoría #56): los `DataRecord` no tienen destino — ni tabla, ni
 * clave, ni idempotencia en la re-ingesta, ni superficie de consulta. El tramo 7
 * (§{Tramo 7}) no los menciona.
 *
 * PROVISIONAL(#75): parametrizado por `Ref`, igual que `Fragment` y por la misma
 * razón — las DOS salidas del tramo 5 salen del MISMO recorrido, así que las dos
 * referencian nodos que todavía no tienen `ElementId`. Acá NO hay campos que sacar:
 * un registro no lleva identidad propia ni huella, así que `StableDataRecord` es el
 * mismo tipo con el otro `Ref` y nada más.
 */
export type DataRecord<Ref> = {
  readonly coordinate: SourceRange;
  readonly values: readonly FieldValue[];
  readonly node: Ref;
};

/** El registro tal como sale del TRAMO 5, antes del reconciliador. */
export type LocalDataRecord = DataRecord<LocalId>;
/** El registro ya reconciliado: lo que el tramo 7 hace consultable. */
export type StableDataRecord = DataRecord<ElementId>;

// ─────────────────────────────── Anotaciones (R3) ────────────────────────────

/**
 * Lo que un anotador propone. NO lleva el nodo: se lo pone el runner.
 *
 * PROVISIONAL(#17): así «nunca devuelve un nodo» (§{Los anotadores no son}) se hace
 * cumplir POR EL TIPO, y un anotador no puede anotar sobre otro nodo que el que le
 * pasaron.
 */
export type ProposedAnnotation = {
  /**
   * ABIERTA a propósito: es la válvula de escape que §{Por qué `tipo`} le asigna a
   * las anotaciones, en contraste explícito con `Role`, que es cerrado. «El
   * conjunto es extensible sin tocar el pipeline: mañana un anotador de idioma,
   * otro de moneda, otro de fechas» (§{Los anotadores no son}).
   */
  readonly kind: string;
  /** Rango sobre el texto del nodo, o `null` si la anotación es del nodo entero. */
  readonly range: readonly [number, number] | null;
  /**
   * PROVISIONAL(#17): `unknown` DELIBERADO — El plan no define `Anotación` en
   * ninguna parte (`mirar(nodo): Anotación[]`, §{Los anotadores no son}, es toda la
   * especificación) y el conjunto de clases es abierto por diseño, así que el
   * payload de una clase que todavía no existe no es tipable desde el contrato. Es
   * uno de los DOS `unknown` que llevan datos en todo el paquete (el otro es
   * `OpaqueAdapter.recognize`), y está acá porque el plan realmente no lo
   * determina — Cada anotador valida el suyo; `ir` solo garantiza la envoltura.
   */
  readonly value: unknown;
};

/**
 * Una anotación anclada. Vive en Postgres, colgada del `ElementId` (R3, §{R3}).
 *
 * PROVISIONAL(#18): `origin` es OBLIGATORIO y la clave de deduplicación es
 * `AnnotationKey`, abajo — El plan no tiene marca que distinga anotación
 * automática de curación humana, y las dos viven en el mismo almacén. Como la
 * delegación tardía es una re-emisión completa (§{La delegación tardía}), los
 * anotadores vuelven a correr sobre TODOS los nodos: sin clave de deduplicación
 * cada re-emisión duplica, y con borrado-y-reescritura ARRASTRA LA CURACIÓN HUMANA
 * — la falla exacta que R3 existe para impedir (§{R3}) — Si se decide al revés (sin
 * `origin`), un borrado por re-emisión se lleva puesto el trabajo del cliente sin
 * que nada se ponga rojo.
 *
 * AGREGADO(R3): `actor`. La anotación distinguía máquina de humano y no QUÉ humano,
 * así que «esto lo marcó el dueño» no era una pregunta que se pudiera hacer. Es el
 * dato que no se reconstruye a posteriori: quién curó se sabe cuando curó, o no se
 * sabe nunca.
 *
 * SIGUE ABIERTO Y `ir` NO LO PUEDE RESOLVER (auditoría #17), en su NÚCLEO: ningún
 * tramo declara LEER anotaciones. Un tramo no es un tipo, así que `ir` no puede
 * declarar que alguien lea; sin punto de lectura, contenido marcado como excluido
 * llega al índice — y el tramo 6 es donde el texto SALE hacia una API de terceros.
 *
 * PERO LA AFIRMACIÓN SE PARTE EN DOS, y la segunda mitad dejó de ser cierta con
 * `actor`. Decía que «las exclusiones y la sensibilidad (§{R3}) solo significan algo
 * si alguien se niega a indexar», mezclando el punto de lectura con el SUJETO de la
 * regla. La sensibilidad es opt-in del DUEÑO, y hasta ahora ni siquiera se podía
 * preguntar si el que marcó era el dueño, porque la anotación no decía quién era.
 * Ahora sí: el sujeto de la regla es expresable. Lo que sigue faltando —y es lo que
 * `ir` no puede poner— es el punto donde alguien la lea y se niegue.
 */
export type Annotation = ProposedAnnotation & {
  readonly node: ElementId;
  readonly actor: ActorId;
  readonly annotator: string;
  readonly origin: "automatic" | "human";
  readonly createdAt: Instant;
};

/**
 * La clave de deduplicación de §{R3}. Ver PROVISIONAL(#18) arriba.
 *
 * ESCRITA COMO TIPO Y NO COMO PROSA a propósito: la regla vivía en un docstring y
 * nada la imponía donde se escribe. Como tipo es grepeable, es acreditable, y el
 * tramo 7 la puede usar de firma en vez de reconstruirla. Es el mismo argumento por
 * el que `fieldKey` vive en `ir` y no en cada consumidor: es el único paquete que
 * `emision` e `ingesta` alcanzan a la vez.
 *
 * `actor` ENTRA EN LA CLAVE, y esa es la decisión que el campo nuevo obligó a tomar.
 * Las dos opciones fallan, y no de la misma manera:
 *   · SIN `actor`: dos personas que marcan el mismo rango con la misma clase
 *     colapsan en una anotación. La segunda curación se PIERDE, en silencio, y es
 *     irrecuperable — que es exactamente la falla que R3 y este #18 existen para
 *     impedir.
 *   · CON `actor`: un anotador automático que corra bajo un actor de sistema
 *     distinto entre despliegues duplica en cada re-emisión.
 * Gana la segunda porque cuando un contrato solo puede prevenir una de dos fallas,
 * previene la IRRECUPERABLE. La duplicación es ruido: se ve (crecen las filas), se
 * limpia, y solo se dispara si un despliegue movió la identidad del productor sin
 * renombrarlo — caso que además queda visible como filas `origin: "automatic"` con
 * el mismo `(node, annotator, kind, range)` y actores distintos. Perder la curación
 * de una persona no se ve nunca.
 *
 * Y hay una asimetría de información que lo refuerza: para una anotación
 * AUTOMÁTICA el productor ya está en la clave —`annotator` es su nombre—, así que
 * `actor` no agrega casi nada; para una HUMANA es el único campo que distingue a
 * dos curadores. O sea que el campo paga donde hace falta y es casi redundante
 * donde molesta.
 */
export type AnnotationKey = Pick<
  Annotation,
  "node" | "annotator" | "kind" | "range" | "actor"
>;

/**
 * §{Los anotadores no son}.
 *
 * PROVISIONAL(#21): el anotador recibe el esquema de su container — `mirar(nodo)`
 * no da acceso al contexto que el propio tramo declara tener a mano: un anotador
 * sobre un nodo-fila sin etiquetas no puede saber qué columna mira. `null` cuando
 * el nodo no cuelga de un container con esquema — Si se decide al revés (solo el
 * nodo), la mitad de las anotaciones sobre planillas no se pueden escribir.
 *
 * EL MÉTODO SE LLAMA `propose` Y NO `look` (GLOSARIO.md, G4): devuelve
 * `ProposedAnnotation[]`, o sea que PROPONE y no anota, y `look` nombraría un acto
 * de observación sin decir qué sale de él.
 *
 * SIGUE ABIERTO (auditoría #20): los anotadores no tienen registro, orden, política
 * de fallo ni presupuesto — a diferencia de los adaptadores, que tienen registro
 * explícito y determinismo verificado en CI. Y «cuestan cero pasadas extra»
 * (§{Los anotadores viajan}) es una afirmación sobre PASADAS, usada como si fuera
 * sobre COSTO: ocho expresiones regulares sobre 50 000 nodos-fila no son
 * microsegundos. Vale anotar que la mitad es cerrable sin inventar nada: `Budget`
 * y `CancellationSignal` YA existen exportados en `adapter.ts` y este contrato no
 * los recibe, así que el mecanismo está y lo que falta es la decisión de usarlo.
 */
export interface Annotator {
  readonly name: string;
  propose(
    node: EmittedNode,
    containerSchema: readonly string[] | null,
  ): readonly ProposedAnnotation[];
}

// ─────────────────────────────── El envoltorio ───────────────────────────────

/**
 * Lo que es del documento y NO de la IR.
 *
 * PROVISIONAL(#73/#22): tipo NUEVO — Ni `Node`, ni `EmittedNode`, ni `Fragment`,
 * ni `DataRecord` llevan `document` u `organization`, y el tramo 7 necesita
 * `organization` en el payload, «sin la cual la búsqueda vectorial es cross-tenant
 * por defecto», contra el invariante de §{Tramo 1 › El registro} («toda lectura
 * posterior se filtra por acá»). Pero meterlo en la IR envenena el caché de
 * reconocimiento, que se indexa por `hashBytes` y cruza organizaciones POR DISEÑO
 * (§{Caché}). Un envoltorio explícito acompaña a la lista de nodos y el caché
 * almacena `RawNode[]` y nada más — Si se decide al revés (campos en
 * `EmittedNode`), el árbol deja de ser cacheable entre organizaciones y se cae la
 * optimización insignia de §{Caché}; si se deja implícito en la orquestación, así
 * es como se llega a un índice cross-tenant sin que nada lo señale.
 *
 * LA FRASE SIGUE SIENDO CIERTA DESPUÉS DEL BLOQUE 3, y conviene decir por qué:
 * `NodeInVersion` SÍ ganó `organization`, y no la contradice. La regla no es «la
 * organización no se escribe en ningún lado» sino «no viaja adentro del árbol que
 * se cachea por `hashBytes`». `NodeInVersion` es el ÍNDICE de reconciliación, no la
 * IR: no se cachea, no se sirve entre tenants, y existe precisamente para que la
 * consulta `hash → documento` no cruce organizaciones.
 */
export type Ingestion = {
  readonly document: DocumentId;
  readonly version: ByteHash;
  /**
   * AGREGADO(Capa 5 A6): el activo original, por clave de objeto. La cita verbatim
   * que el producto promete se sirve DE LOS BYTES ORIGINALES, y ni la IR ni el
   * índice los contienen: la IR es descartable por R3 y se regenera desde ellos.
   * Sin este campo, «el original» es una convención de nombre de bucket que cada
   * consumidor reconstruye — y una convención de nombre no es una referencia.
   *
   * Es `ObjectKey` y no `DocumentId` a propósito: apunta a un OBJETO en el almacén,
   * no a una fila de Postgres. Con la marca equivocada el campo compila, existe, y
   * direcciona lo que no es.
   */
  readonly original: ObjectKey;
  readonly organization: OrganizationId;
  readonly owner: ActorId;
  readonly channel: Channel;
  readonly sealedAt: Instant;
  readonly achievedLevel: AchievedLevel;
  readonly state: DocumentState;
  /**
   * AGREGADO(canal `folder`, P30): cuándo dejó de estar vigente, o `null` si lo está.
   *
   * ES UN CAMPO Y NO UN NOVENO `DocumentState`, y las tres razones están en
   * GLOSARIO.md, P30. La que más pesa acá: los ocho estados contestan «¿en qué punto
   * del pipeline está este documento?» y el retiro contesta «¿está vigente?». Un
   * documento retirado que estaba `indexed` SIGUE ESTANDO INDEXADO —su IR existe, sus
   * fragmentos existen, su índice de reconciliación existe, y §{Borrar en la carpeta}
   * enumera las seis cosas que sobreviven—, así que escribir `retired` en `state`
   * borraría un hecho verdadero para anotar uno distinto.
   *
   * Y la reversibilidad, que es la decisión del canal, sale GRATIS de esta forma: se
   * pone en `null` y el documento vuelve a ser exactamente lo que era. Como estado
   * pediría recordar de dónde vino —un par `[retired, X]` no lo sabe—, o sea un campo
   * igual, pero habiendo perdido el que ya estaba.
   *
   * `null` NO es «falta el dato»: es el estado normal, y lo es toda la vida de la
   * mayoría de los documentos.
   *
   * LO QUE ESTE CAMPO NO HACE, dicho para que nadie lo suponga: no excluye nada. Que
   * un documento retirado salga de la búsqueda, de la síntesis y del índice son tres
   * filtros de tres consumidores que todavía no existen. El campo dice el hecho; no lo
   * impone.
   *
   * NO LLEVA QUIÉN. Hoy la carpeta es la única fuente de retiros, así que el actor
   * sería constante y un campo constante no informa. Cuando una persona pueda retirar
   * desde la interfaz se vuelve una pregunta real, y ahí se decide.
   */
  readonly retiredAt: Instant | null;
};

/**
 * Los cuatro canales (§{Tramo 1 › El registro}, §{La sonda}).
 *
 * PROVISIONAL(#445): UNA sola grafía — El plan usa `'carpeta'` en `Probe.origin`
 * (§{La sonda}) y `'carpeta local'` en `documento.canal` (§{Tramo 1 › El registro})
 * para lo mismo. Elijo la forma corta, que es la que aparece en un tipo — Si se
 * decide al revés, hay que cambiar la unión de `Probe.origin`.
 */
export const CHANNELS = ["chat", "frontend", "folder", "connector"] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * §{Tramo 1 › El registro}: «estructurado | texto plano».
 *
 * PROVISIONAL(#2): tercer valor `mixed` — El plan declara dos y no da valor para su
 * propio ejemplo estrella: 198 páginas estructuradas + 2 delegadas
 * (§{La delegación es emergente}). Es el campo que «vuelve visible la degradación»
 * (§{Tramo 1 › El registro}) y alimenta la métrica de §{Observabilidad} — Se deriva
 * de la evidencia ganadora del tramo 2 (ver `Selection` en `adapter.ts`), que hoy
 * `seleccionar()` descarta.
 *
 * `plain_text` y no `texto plano` (GLOSARIO.md, G6): el valor del plan lleva
 * ESPACIO y ningún otro vocabulario del paquete lo hace.
 */
export const ACHIEVED_LEVELS = ["structured", "plain_text", "mixed"] as const;
export type AchievedLevel = (typeof ACHIEVED_LEVELS)[number];

/**
 * §{Tramo 1 › El registro}.
 *
 * `on_hold` y no `queued` ni `waiting` (GLOSARIO.md, G5): `queued` afirmaría una cola
 * con orden, y el plan no la tiene.
 *
 * LAS CUATRO PREGUNTAS QUE ESTE DOCSTRING DECLARABA ABIERTAS ESTÁN CONTESTADAS, y sus
 * respuestas viven en `TRANSITIONS`, acá abajo. Se contestaron todas de una porque
 * todas colgaban de un mismo hecho que el plan tiene escrito y no usa. Ver ahí.
 */
export const DOCUMENT_STATES = [
  "received",
  "recognizing",
  "indexing",
  "indexed",
  "partial",
  "failed",
  "rejected",
  "on_hold",
] as const;
export type DocumentState = (typeof DOCUMENT_STATES)[number];

/**
 * LA MÁQUINA DE ESTADOS, y por qué las transiciones sí son una decisión que este
 * contrato puede tomar (§{Tramo 1 › El registro}, §{El orden importa}).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL HECHO QUE LAS DESTRABA, y estaba escrito en el plan sin usarse: LA PUERTA NO
 * PUEDE VALIDAR NADA. El plan decide subida prefirmada —«la API no toca bytes: emite
 * el permiso y después verifica que el objeto llegó» (§{Tramo 1 › Decisiones})— así
 * que cuando nos enteramos de que hay bytes, los bytes YA ESTÁN EN EL BUCKET. La
 * puerta que §{El orden importa} dibuja como preventiva es, con esa decisión,
 * DETECTIVE. La auditoría lo enunció así: «no se puede validar bytes que la API no
 * ve».
 *
 * Y este contrato ya había mudado una mitad de esa puerta sin decirlo: `ByteHash`
 * declara que el hash «lo calcula el WORKER en la primera lectura del objeto, no la
 * puerta». La otra mitad —el escaneo— quedó sin mudar, y de ahí salían las cuatro
 * preguntas.
 *
 * LA PUERTA ES LA PRIMERA LECTURA DEL OBJETO. Una sola pasada hace todo lo que el
 * plan reparte entre los pasos 1 y 3: hash de bytes, escaneo, ¿está cifrado?, sonda
 * fría. Nada de eso puede pasar antes, y todo puede pasar junto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS CUATRO RESPUESTAS
 *
 *   1. «¿Qué estado tiene un documento GUARDADO PERO NO ESCANEADO?» → `received`,
 *      y siempre lo fue. No falta un noveno estado: faltaba dejar de fingir que la
 *      puerta previene. `received` significa «el objeto existe y ningún worker lo
 *      leyó».
 *   2. «¿`rejected` es alcanzable después de `received`?» → Sí, y por el ÚNICO
 *      camino que hay. Las dos causas que el plan nombra —virus y cifrado sin
 *      contraseña— se descubren las dos en la primera lectura, o sea desde
 *      `recognizing`. La tercera, el tamaño, NO ENTRA ACÁ: se impone en el permiso
 *      prefirmado (`content-length-range`), que es la única palanca preventiva que
 *      la subida directa deja en pie. Un archivo demasiado grande nunca llega a ser
 *      un documento.
 *   3. «¿`on_hold` va a `received` o a `recognizing`?» → A `recognizing`. Lo que
 *      cambió cuando un `en_espera` se reactiva es que existe un adaptador nuevo; el
 *      objeto ya está hasheado y escaneado, y volver a `received` lo re-leería
 *      entero para no aprender nada.
 *   4. «¿`partial` es terminal, y qué lo convierte en `indexed`?» → NO es terminal, y
 *      lo que lo mueve ya existe y no está cableado: `Run.deferred`. Un documento
 *      sale a `partial` en vez de a `indexed` cuando quedaron assets sin descomponer
 *      —«no se descarta: queda encolado y el documento se marca `parcial`»
 *      (§{Dónde frena})— y vuelve a `indexing` cuando uno drena. La regla es una
 *      línea: `deferred.length > 0`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAIL-CLOSED, Y ES LA DECISIÓN QUE MÁS CUESTA. Si el escáner no contesta —caído,
 * timeout, saturado— el documento NO AVANZA: se queda en `recognizing`, reintenta, y
 * tras N intentos cae a `failed` con alerta. Reusa la única transición que el plan ya
 * nombraba («tras N reintentos, cola de descarte, estado `fallido` y alerta»,
 * §{Tramo 1 › Decisiones}) y el único parámetro que ya existe para eso
 * (`PARAMETERS.intake.maxRetries`, hoy en `null`).
 *
 * El costo va escrito porque es real: si el escáner se cae una hora, nada se indexa
 * esa hora. Se elige igual, y la razón es que «antivirus obligatorio — requisito
 * enterprise, no opcional» (§{Tramo 1 › Decisiones}) es falso bajo cualquier otra
 * política: fail-open indexa contenido que nadie miró, y retractar un fragmento ya
 * vectorizado no es una operación que este pipeline tenga.
 *
 * Y LA CONTRADICCIÓN DEL PLAN NO SE RESUELVE TIRANDO UNA FRASE. «Se rechaza solo en
 * la puerta» y «el antivirus corre en paralelo al guardado, no antes» están a once
 * líneas y parecen incompatibles. Las dos quedan verdaderas si «el guardado» es LA
 * SUBIDA DEL CLIENTE y «la puerta» es LA PRIMERA LECTURA: el escaneo corre en
 * paralelo a la subida y termina antes de que el worker empiece. El argumento de
 * latencia del plan se sostiene entero — la latencia que alguien percibe termina
 * cuando su subida termina, y el reconocimiento YA es un worker asincrónico.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS COLAS SE REEMPLAZAN, NO SE BORRAN. `partial → indexing` es la transición que
 * drena un pendiente, y la pregunta que destapa es qué pasa con la cola vieja cuando
 * el documento se reingiere. La respuesta sale de R3 —el cuerpo se regenera ENTERO
 * desde los bytes en cada re-ingesta— y vale para los dos casos: si reingerís el mismo
 * contenido con más capacidades, la corrida nueva mira los mismos bytes con más
 * herramientas y su cola es la autoridad; si reingerís porque el documento cambió, la
 * cola vieja apunta a assets que quizá ya no existen, y drenarlos sería descomponer una
 * imagen que el autor borró. En los dos, la corrida nueva REEMPLAZA. La cola es un
 * hecho de la corrida, no del documento — el mismo diagnóstico que la lápida de
 * `Enrichment` en `shapes.ts` y que `Whence` en `provenance.ts`.
 *
 * Y `partial → indexing` NO ES INCONDICIONAL: dispara solo si el pendiente que drenó
 * pertenece a la VERSIÓN VIGENTE. Un drenaje de una versión superada se descarta en
 * silencio, y no es un error — es trabajo que dejó de tener sentido. Sin esa guarda se
 * re-indexa contenido de la versión vieja adentro de un documento que ya se movió.
 *
 * LO QUE NO SE REEMPLAZA es el veredicto del escaneo, y sale gratis: como el sujeto es
 * el objeto y el objeto se direcciona por contenido, reingerir NO RE-ESCANEA. Si el
 * escaneo colgara del documento, cada reingesta lo pagaría de nuevo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO HAY UN NOVENO ESTADO PARA «SUSPENDIDO», ni contexto guardado por borde de
 * tramo. La tentación es tratar cada documento como un proceso y persistir su contexto
 * en cada corte; se analizó y compra menos de lo que parece, porque este pipeline ya
 * hizo que REHACER SEA BARATO Y SEGURO: la identidad se direcciona por contenido, los
 * tramos son funciones puras —`emit`, `reconcile` y `group` van de dato a dato, sin
 * estado oculto que cruce un borde— y lo caro se memoiza por contenido. Un reintento da
 * los mismos ids, los mismos fragmentos y el mismo objeto.
 *
 * De hecho el CACHÉ es mejor que un checkpoint y lo reemplaza: un checkpoint ahorra
 * rehacer lo ya hecho DE ESTE documento; el caché lo ahorra de TODOS.
 *
 * Y HAY UN SEGUNDO CANDIDATO A NOVENO ESTADO QUE TAMPOCO ENTRA, por una razón
 * DISTINTA, y va acá para que quien busque «¿por qué el retiro no es un estado?»
 * caiga en el lugar correcto. El canal `folder` decide que borrar un archivo RETIRA el
 * documento sin destruirlo (§{Borrar en la carpeta}), y la forma que sale sola es un
 * `retired`. No cabe: el retiro es alcanzable desde los ocho, así que ningún estado
 * quedaría con grado de salida cero y `isTerminal` —que se deriva JUSTAMENTE para no
 * poder mentir— devolvería `false` para todos. Vive como `Ingestion.retiredAt`, y el
 * argumento entero está en GLOSARIO.md, P30.
 *
 * QUEDA UN SOLO PASO QUE NO SE PUEDE REHACER, y es el acuñado: H13(a) declara que es
 * reloj + azar, y el invariante de determinismo lo mide exigiendo que otro acuñador
 * mueva los ids Y NADA MÁS. Si una corrida muere después de acuñar y antes de
 * persistir, el reintento acuña ids distintos. Pero eso no pide checkpointing: pide que
 * la salida de una corrida se persista ENTERA O NADA, junto con los ids que acuñó. Una
 * transacción al final, no un guardado en cada borde.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE NO ESTÁ ACÁ, Y NO ES OLVIDO: el asset DELEGADO no tiene estado, porque no es
 * un documento. Se midió qué costaría que lo fuera y no es una lista de costos, es la
 * función borrándose: las migas del subárbol delegado son las del contenedor PORQUE
 * la pila del emisor es una sola por corrida, así que una corrida aparte las deja
 * vacías y «un párrafo que estaba adentro de una imagen que estaba bajo un título»
 * pierde el título. Además `ctx.ancestors` arranca vacío en cada corrida y no se
 * persiste, o sea que la guarda de ciclo desaparece y «A contiene B contiene A» pasa
 * de atajado a bucle infinito ENTRE corridas.
 *
 * Lo que hereda el escaneo no es el asset: es SU OBJETO. La regla que P13 pide —«que
 * la carrera sea la misma decisión que para el archivo de entrada y no dos»— se
 * cumple moviendo el sujeto: **todo objeto de nuestro bucket se escanea una vez,
 * indexado por su hash de contenido**. Como el almacenamiento es direccionado por
 * contenido, el mismo logo en cincuenta documentos se escanea UNA VEZ: el dedupe que
 * ya existe paga el escaneo.
 */
export const TRANSITIONS = [
  ["received", "recognizing"],
  ["recognizing", "rejected"],
  ["recognizing", "on_hold"],
  ["recognizing", "indexing"],
  ["recognizing", "failed"],
  ["on_hold", "recognizing"],
  ["indexing", "indexed"],
  ["indexing", "partial"],
  ["indexing", "failed"],
  ["partial", "indexing"],
] as const satisfies readonly (readonly [DocumentState, DocumentState])[];

/** Un paso legal de la máquina. */
export type DocumentTransition = (typeof TRANSITIONS)[number];

/**
 * Los tres estados de los que no se sale. Se DERIVA de `TRANSITIONS` y no se escribe
 * a mano, por la misma razón que el resumen del guardián de fronteras se deriva del
 * mapa: una lista paralela mantenida a mano es la mentira que el próximo agregado
 * introduce sin que nadie la vea.
 */
export const isTerminal = (state: DocumentState): boolean =>
  !TRANSITIONS.some(([from]) => from === state);

/** Si el paso es legal. Es la función que un worker consulta antes de escribir. */
export const canTransition = (from: DocumentState, to: DocumentState): boolean =>
  TRANSITIONS.some(([a, b]) => a === from && b === to);
