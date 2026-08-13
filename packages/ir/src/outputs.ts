/**
 * Las salidas del pipeline — qué produce cada tramo y qué consume el siguiente.
 */

import type {
  ActorId,
  ByteHash,
  ContentHash,
  ContextualFingerprint,
  DelegationId,
  DocumentId,
  ElementId,
  EmbeddingKey,
  FragmentId,
  Instant,
  LocalId,
  ObjectKey,
  OrganizationId,
} from "./identity.js";
// La autoría vive en su propio módulo desde el bloque 3b, y no por tamaño: es lo
// que vuelve escribible `projection.ts ↛ authorship.ts`. Ver su encabezado.
import type { Authorship } from "./authorship.js";
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
 */
export type Fragment = {
  /** Ver PROVISIONAL(#69) en `FragmentId`. */
  readonly id: FragmentId;
  /** LIMPIO — las migas no van adentro (§{Las dos salidas}). */
  readonly text: string;
  /** El tramo 6 las concatena al embeber (§{Las dos salidas}). */
  readonly breadcrumbs: readonly StableBreadcrumb[];
  /** Procedencia; sobrevive a que el fragmento se rearme (§{Las dos salidas}). */
  readonly nodes: readonly ElementId[];
  /**
   * La ÚNICA huella del fragmento: `sha256(miga ‖ texto)`. Identidad, dedupe y base
   * de `FragmentId`. Ver C2 en `ContextualFingerprint` — la huella sobre texto
   * limpio se borró. NO es la clave del caché de vectores: esa es por rebanada y
   * lleva además la versión del embedder.
   */
  readonly contextualFingerprint: ContextualFingerprint;
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
 */
export type DataRecord = {
  readonly coordinate: SourceRange;
  readonly values: readonly FieldValue[];
  readonly node: ElementId;
};

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
 * `ir` declara los OCHO valores y NADA MÁS. Las transiciones no están en el plan
 * (auditoría #1: «la máquina de estados no tiene transiciones») y no son una
 * decisión que un contrato de tipos pueda tomar: si `partial` es terminal, qué lo
 * convierte en `indexed` cuando drenan los pendientes, si `on_hold` va a
 * `received` o a `recognizing`, si `rejected` es alcanzable después de `received`
 * (necesario para el antivirus tardío), y qué estado tiene un documento «guardado
 * pero no escaneado». Sin las transiciones no se puede escribir ningún worker.
 *
 * `on_hold` y no `queued` ni `waiting` (GLOSARIO.md, G5): `queued` afirmaría una
 * cola con orden, que es justamente lo que este docstring dice que el plan no tiene.
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
