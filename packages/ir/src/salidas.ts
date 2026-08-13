/**
 * Las salidas del pipeline — qué produce cada tramo y qué consume el siguiente.
 */

import type {
  ActorId,
  Autoría,
  ClaveEmbedding,
  ContentHash,
  DelegacionId,
  DocumentoId,
  ElementId,
  FragmentoId,
  HashBytes,
  HuellaContextual,
  Instante,
  LocalId,
  OrganizacionId,
} from "./identidad.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Body as Cuerpo,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Shape as Forma,
} from "./shapes.js";
import type { Token } from "./proyeccion.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Certainty as Certeza,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  RecognitionLevel as NivelDeReconocimiento,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Hint as Pista,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Role as Tipo,
} from "./classification.js";
import type { SourceRange, Ubicación } from "./ubicacion.js";

// ─────────────────────────────── La marca nodal ──────────────────────────────

/**
 * La marca que hace de ESTE archivo la frontera del no-anidamiento.
 *
 * PROVISIONAL(H1): `Nodo` lleva una marca nominal obligatoria — El plan exhibe
 * `NoAnida<Cuerpo>` como su prueba más fuerte, «no compila si está mal»
 * (§{Estrategia}). Esa versión ya no existe: la auditoría la mostró vacua y el
 * reemplazo recursivo tampoco veía el nodo a través de un campo opcional, de una
 * unión con `null`, de `(Nodo | null)[]`, de `Nodo | string`, ni más allá de seis
 * niveles. Hoy el invariante lo impone el GRAFO DE MÓDULOS: `formas.ts` no puede
 * alcanzar este archivo (`scripts/fronteras.mjs`), y como `MARCA_NODAL` vive solo
 * acá, un `Nodo` dentro de un `Cuerpo` es inexpresable en vez de detectable.
 * La marca sigue siendo necesaria: TypeScript es estructural, así que sin ella
 * cualquier objeto que casualmente se parezca a un `Nodo` lo sería.
 * Con la marca, el detector es EXACTO — COSTO: `Nodo` deja de ser un objeto plano
 * construible por literal suelto y hay que usar `comoNodo`. Son dos sitios en todo
 * el sistema (la composición Unidad+Clase→Nodo y el emisor), no los doce
 * adaptadores, que construyen `Unidad` — Si se decide al revés (sin marca), el
 * invariante siempre pasa y es indistinguible de uno que funciona.
 */
export const MARCA_NODAL: unique symbol = Symbol("savia.ir.nodo");

export interface EsNodo {
  readonly [MARCA_NODAL]: true;
}

// ─────────────────────────────── Tramo 3 ─────────────────────────────────────

/**
 * Lo que produce un adaptador y lo ÚNICO que se cachea por `hashBytes`.
 *
 * PROVISIONAL(#22/C8): `NodoCrudo` no lleva `Autoría` — Ver el razonamiento
 * completo en `Autoría` (`identidad.ts`). En una frase: el caché de reconocimiento
 * cruza organizaciones POR DISEÑO (§{Caché}) y `Autoría` es por documento y por
 * tenant, así que si viajara adentro del árbol cacheado se propagaría la del primer
 * subidor a otro tenant. Partir el tipo mueve el invariante del runtime al
 * compilador, que es el criterio declarado del propio plan (§{Estrategia}). Es
 * además el tipo que los golden files de adaptadores (§{Estrategia}) necesitan,
 * porque un snapshot no puede contener un timestamp.
 */
export type NodoCrudo = {
  readonly tipo: Tipo;
  readonly cuerpo: Cuerpo;
  readonly ubicación: Ubicación;
  readonly certeza: Certeza;
  /**
   * PROVISIONAL(#43): campo NUEVO, no está en §{Tramo 3 › Qué sale} — El tramo 4
   * declara que recibe «la secuencia de nodos del tramo 3, CADA UNO CON SU PISTA»
   * (§{Tramo 4}) y `Nodo` tiene cinco campos, ninguno la pista. La pista nace en
   * `Clase` (§{`detectar`}) y no llega a ningún tipo declarado. Sin ella el emisor
   * —paso 2 del orden de construcción, §{Orden}— no tiene entrada y es
   * inescribible. Es una omisión, no una decisión: el plan dice tres veces que la
   * pista es el producto estructural del tramo 3 y que el tramo 4 la consume —
   * Legal por R1: la pista ya es libre de formato (§{La pista}). `null` = el
   * clasificador se abstuvo, hereda la ruta del nodo anterior; ver PROVISIONAL(#43)
   * en `Clase` — Si se decide al revés (pares `[Nodo, Pista][]`), hay que nombrar
   * un tipo intermedio que el plan no nombra y decidir dónde vive.
   */
  readonly pista: Pista | null;
  /**
   * PROVISIONAL(C21): campo NUEVO — La cadena de marcos de delegación por los que
   * se llegó a este nodo, de afuera hacia adentro. Vacío = documento raíz. Lo
   * escribe el ORQUESTADOR al injertar, nunca el adaptador (que no sabe que fue
   * delegado). El emisor compara la cadena del nodo anterior con la actual para
   * decidir «BAJÓ» / «SUBIÓ» (§{2 · Emisor}) — Ver el razonamiento en
   * `DelegacionId`. NO entra en la huella.
   */
  readonly delegación: readonly DelegacionId[];
  /**
   * PROVISIONAL(#61): campo NUEVO — Qué eslabón de la cascada resolvió este nodo.
   * `null` = lo resolvió el piso físico. La observabilidad lo llama «la importante»
   * y «el indicador de salud de toda la capa de reconocimiento»
   * (§{Observabilidad}), y `enCascada` (§{La única}) DESCARTA cuál eslabón
   * resolvió: el caso que la sección describe (60% resuelto por prominencia en DOCX
   * = mapa de estilos incompleto) es indistinguible con solo `certeza`, porque
   * prominencia, geometría y modelo son los tres `inferido` — NO entra en la huella
   * (si entrara, mejorar un clasificador movería todos los ids) ni en la
   * comparación de similitud de los pases 2 y 3 — Si se decide al revés (por
   * `Diagnóstico`), son 50 000 avisos en una planilla.
   */
  readonly atribución: string | null;
  /** El nivel de la escalera que lo resolvió. Ver PROVISIONAL(C18/C19). */
  readonly nivel: NivelDeReconocimiento;
  /**
   * PROVISIONAL(C19): campo NUEVO, `null` salvo en el nivel perceptual —
   * §{La escalera} declara que el perceptual produce «`inferido` + confianza» y
   * §{La escalera} promete que «una skill puede decidir no citar como autoridad
   * algo reconocido con confianza baja», y `certeza` tiene dos valores y ningún
   * número: la promesa que el plan usa para distinguirse («la diferencia entre un
   * pipeline que adivina y uno que declara cuánto está adivinando», §{La escalera})
   * no tiene implementación — El umbral de citabilidad vive fuera de este pipeline
   * (capa de skills), pero el campo tiene que nacer acá o no existe.
   */
  readonly confianza: number | null;
};

/**
 * Un nodo del tramo 3, ya con autoría. Es `NodoCrudo` + lo que es por documento.
 * §{Tramo 3 › Qué sale} lo declara con cinco campos; los otros cinco están
 * justificados uno por uno arriba.
 */
export type Nodo = NodoCrudo & { readonly autoría: Autoría } & EsNodo;

/** Constructor: la marca nodal no se escribe a mano. */
export const comoNodo = (n: NodoCrudo & { readonly autoría: Autoría }): Nodo => ({
  ...n,
  [MARCA_NODAL]: true,
});

// ─────────────────────────────── Tramo 4 ─────────────────────────────────────

/**
 * Un elemento de las migas de pan.
 *
 * PROVISIONAL(C15/#50/#73): `migas` deja de ser `string[]` (§{Tramo 4 › Qué sale},
 * §{Las dos salidas}) y pasa a llevar la REFERENCIA al nodo-título además de su
 * texto — Tres cosas lo obligan. (1) C15: un `lead` «no arranca un fragmento con su
 * texto: cierra el anterior y entra a las migas» (§{Los títulos}) y `texto` es
 * LIMPIO, así que el texto de un título no entra en el `texto` de NINGÚN fragmento
 * y «un nodo entra entero en algún fragmento, siempre» (§{El recorrido}) es falso
 * para todos los `lead`. Con la referencia, el título queda referenciado desde el
 * fragmento. (2) La miga va al payload del tramo 7 «para filtrar por sección de
 * forma exacta» (§{Las cinco}) y el texto de un título es MUTABLE POR DISEÑO: un
 * filtro guardado por «Cláusula primera» deja de matchear cuando alguien la
 * renombra, EN SILENCIO — la misma edición a la que el tramo 4 dedica una sección
 * entera a sobrevivir. Filtrando por la referencia, sobrevive. (3) Con `string[]`
 * no hay forma de saber de qué nodo salió una miga — Si se decide al revés, el
 * filtro por sección es por texto mutable y el texto de los `lead` solo persiste en
 * la tabla de nodos.
 *
 * SIGUE ABIERTO Y HAY QUE DECIDIRLO (auditoría #50): normalización y truncado del
 * texto de la miga (ver `PARAMETROS.agrupación.largoMáximoDeMiga`). Ese string
 * entra en `HuellaContextual`, así que sin regla el mismo título produce migas
 * distintas entre ingestas.
 */
export type Miga<Ref> = {
  readonly ref: Ref;
  readonly texto: string;
};

/** Migas durante el recorrido del emisor: los `ElementId` todavía no existen. */
export type MigaLocal = Miga<LocalId>;
/** Migas ya reconciliadas. */
export type MigaEstable = Miga<ElementId>;

/**
 * La salida del EMISOR, antes del reconciliador.
 *
 * PROVISIONAL(#66): tipo NUEVO — El plan declara un solo tipo entre el tramo 4 y el
 * 5 (`NodoEmitido`, §{Tramo 4 › Qué sale}), y ese tipo no puede ser la salida del
 * emisor: dice que `id` sale «de la reconciliación» y `parentId` «del emisor», y el
 * emisor corre ANTES. La salida intermedia existe, es sobre la que corre el
 * reconciliador, y no era escribible — Ver el razonamiento completo en `LocalId`.
 */
export type NodoConRuta = Nodo & {
  readonly local: LocalId;
  readonly padreLocal: LocalId | null;
  readonly migas: readonly MigaLocal[];
  readonly hash: ContentHash;
};

/** La salida del tramo 4 (§{Tramo 4 › Qué sale}). */
export type NodoEmitido = Nodo & {
  /** De la reconciliación, no de una fórmula. */
  readonly id: ElementId;
  /** Del emisor, remapeado desde `padreLocal`. */
  readonly parentId: ElementId | null;
  /** Del emisor, misma pila. */
  readonly migas: readonly MigaEstable[];
  /** Material para la próxima reconciliación. */
  readonly hash: ContentHash;
};

/**
 * El denominador de la métrica `anclaje`.
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
 */
export const DENOMINADOR_DE_ANCLAJE = "viejo" as const;

/** Las cinco cantidades de «degradación honesta» (§{Degradación}). */
export type MétricasReconciliación = {
  /** Proporción en [0,1] sobre `DENOMINADOR_DE_ANCLAJE`. */
  readonly anclaje: number;
  readonly porHash: number;
  readonly porSimilitud: number;
  /** Si crece, algo reordena mucho. */
  readonly porResiduo: number;
  readonly altas: number;
  readonly bajas: number;
  /** Crudas, para que `anclaje` sea reconstruible con otro denominador. */
  readonly nodosViejos: number;
  readonly nodosNuevos: number;
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
  readonly adaptadorAnterior: string | null;
  readonly versiónAnterior: string | null;
};

/**
 * La salida completa del tramo 4.
 *
 * PROVISIONAL(#63): un objeto, no un arreglo — El reconciliador produce altas Y
 * BAJAS («lo que sigue sin par: del lado nuevo son altas, del lado viejo, bajas»,
 * §{5 · Reconciliador}) y cinco métricas, y el único tipo de salida declarado es
 * `NodoEmitido`, que es solo el lado nuevo. El tramo 7 tiene que borrar filas y
 * puntos de lo que ya no existe y NADIE LE ENTREGA LA LISTA: sin eso el índice
 * acumula contenido borrado que sigue siendo recuperable con procedencia confiable
 * — Si se decide al revés (bajas por `Diagnóstico`), pierden tipo y el tramo 7 no
 * las puede consumir programáticamente.
 *
 * SIGUE ABIERTO (auditoría #19): qué pasa con una anotación cuyo nodo es una baja.
 * ¿Se borra en cascada? ¿Queda huérfana? ¿Se resucita si el párrafo vuelve? El plan
 * resuelve el caso del nodo que sobrevive con otro id y no el del que desaparece.
 */
export type SalidaDeEmisión = {
  readonly nodos: readonly NodoEmitido[];
  readonly bajas: readonly ElementId[];
  readonly métricas: MétricasReconciliación;
};

// ──────────────────── El índice de reconciliación (C12 · C11) ────────────────
/**
 * Lo que el reconciliador necesita recordar de la versión anterior. Es la ENTRADA
 * del tramo 4, igual que `SalidaDeEmisión` es su salida.
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
 * QUÉ NO GUARDA. No el `Cuerpo` con su ubicación, pistas, autoría y marcas: solo la
 * PROYECCIÓN, porque `similitudDeProyecciones` opera sobre `Token[]` y no sobre
 * cuerpos. La costura ya estaba en `proyeccion.ts`.
 */
export type NodoConocido = {
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
  readonly tipo: Tipo;
  readonly forma: Forma;
  /** Material de los pases 2 y 3. Va a `similitudDeProyecciones`. */
  readonly proyección: readonly Token[];
};

/**
 * En qué versión de qué documento apareció un nodo, y en qué posición.
 *
 * EL ORDEN — C11. «No se almacena nada derivable: ni `depth`, ni `siblingIndex`, ni
 * `ordinal`» (§{2 · Emisor}) es correcto y aplica a la IR: en la versión VIVA todo
 * eso se camina desde `parentId`. Pero el pase 2 «parte AMBAS listas en tramos» y
 * el orden de la lista vieja no se puede caminar desde nada, porque el árbol viejo
 * ya no existe. Por eso `orden` vive acá y no en el nodo: no se está duplicando
 * algo derivable, se está recordando algo irrecuperable.
 *
 * LA VERSIÓN ES `HashBytes`, no un contador — no hace falta secuencia ni
 * coordinación: los bytes que produjeron la versión LA IDENTIFICAN, y ya están en
 * la fila `documento`. Mismos bytes, misma versión; bytes distintos, versión
 * distinta.
 *
 * SE ACUMULA, NO SE REEMPLAZA. La primera versión de este diseño tiraba la anterior
 * para ahorrar espacio. No ahorra: `NodoConocido` está direccionado por contenido,
 * y un nodo que no cambió entre versiones es LA MISMA FILA —mismo id, mismo hash,
 * misma proyección— así que se guarda una vez. Cincuenta versiones con 1 % de
 * cambio cuestan ≈ 1,05 versiones. Es el mecanismo de git, y tirar la anterior
 * cerraba las consultas temporales («¿qué decía este contrato en marzo?») a cambio
 * de nada.
 */
export type NodoEnVersión = {
  readonly documento: DocumentoId;
  /**
   * ATÓMICO CON LOS NODOS — H13(c). Esta fila y el `NodoEmitido` que la origina se
   * persisten en la MISMA transacción. Si una corrida guarda los nodos y no el
   * índice, la próxima re-ingesta no tiene contra qué reconciliar: se mueven todos
   * los ids y se despega toda la curación, en silencio. Es un requisito sobre el
   * tramo 7 que ningún tipo puede imponer.
   */
  readonly versión: HashBytes;
  /** Posición en la lista plana emitida. Ver C11 arriba. */
  readonly orden: number;
  readonly nodo: ElementId;
};

// ─────────────────────────────── Tramo 5 ─────────────────────────────────────

/**
 * La salida difusa del tramo 5 (§{Las dos salidas}).
 *
 * Dos desviaciones del literal, las dos marcadas en su campo: `hash` se parte en
 * dos (C2) y `migas` gana referencia (C15).
 */
export type Fragmento = {
  /** Ver PROVISIONAL(#69) en `FragmentoId`. */
  readonly id: FragmentoId;
  /** LIMPIO — las migas no van adentro (§{Las dos salidas}). */
  readonly texto: string;
  /** El tramo 6 las concatena al embeber (§{Las dos salidas}). */
  readonly migas: readonly MigaEstable[];
  /** Procedencia; sobrevive a que el fragmento se rearme (§{Las dos salidas}). */
  readonly nodos: readonly ElementId[];
  /**
   * La ÚNICA huella del fragmento: `sha256(miga ‖ texto)`. Identidad, dedupe y base
   * de `FragmentoId`. Ver C2 en `HuellaContextual` — la huella sobre texto limpio
   * se borró. NO es la clave del caché de vectores: esa es por rebanada y lleva
   * además la versión del embedder.
   */
  readonly huellaContextual: HuellaContextual;
  /**
   * PROVISIONAL(#74): campo NUEVO, la PEOR certeza de los nodos agrupados — «La
   * certeza no se queda en este tramo: viaja con el nodo, sobrevive a la
   * fragmentación y LLEGA HASTA LA SKILL QUE CONSUMA ESA MEMORIA» (§{La escalera})
   * es una promesa central del documento y no tiene mecanismo en ningún tramo
   * posterior al 3: `Fragmento` no lleva certeza y un fragmento agrupa N nodos que
   * pueden diferir. `certeza: 'mixto'` se borró porque «se calculaba y NO LO LEÍA
   * NADIE» (§{Lo que se borró}) — el lector que la leería es este, y todavía no
   * existía cuando se borró. Elijo el mínimo, que es monótono y no reintroduce el
   * valor borrado — Si se decide al revés (join por `nodos` en el tramo 7), la
   * promesa depende de una consulta que nadie declaró. La AUTORÍA, en cambio, NO se
   * comprime: es multivaluada por naturaleza y «esto lo dijo el CFO en marzo» exige
   * el actor, no un resumen — va por join.
   */
  readonly certezaMínima: Certeza;
};

/**
 * La salida del tramo 6. Un fragmento produce N ≥ 1 de estos.
 *
 * NO existe el sustantivo «ventana» acá. El tramo 4 ya usa `ventana` para la región
 * de un objeto (`RefObjeto`) y el tramo 5 para el ventaneo de filas de una grilla
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
 * `fragmentoId`. Balancear las rebanadas lo evitaría, pero cambia el tamaño de
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
  readonly fragmento: FragmentoId;
  /** `i` de `N`. Da unicidad de fila; nada aguas abajo lo interpreta. */
  readonly orden: number;
  /** Lo que se cacheó. Ver `ClaveEmbedding`: es por rebanada, no por fragmento. */
  readonly clave: ClaveEmbedding;
  readonly valores: readonly number[];
};

/** Un par de `Registro.valores` que admite etiquetas ausentes y repetidas. */
export type Valor = {
  readonly etiqueta: string | null;
  readonly valor: string;
};

/**
 * La salida exacta del tramo 5 (§{Las dos salidas}). La mitad σ del split π/σ.
 *
 * PROVISIONAL(#55): `valores` es un ARREGLO de pares, no `Record<string,string>` —
 * El `Record` exige claves únicas y no vacías y una planilla real tiene columnas
 * sin encabezado, encabezados repetidos y filas cortas: el tipo del plan es
 * incumplible. Quien quiera el `Record` usa `claveDeCampo` de `proyeccion.ts`, que
 * lleva la política explícita — Si se decide al revés (`Record` con claves
 * sintéticas en cada consumidor), dos implementaciones dan `Registro` distintos.
 *
 * SIGUE ABIERTO (auditoría #55): si la fila de encabezado es ella misma un nodo que
 * emite registro. El «502» de §{Las filas} nunca se desglosa.
 * SIGUE ABIERTO (auditoría #56): los `Registro` no tienen destino — ni tabla, ni
 * clave, ni idempotencia en la re-ingesta, ni superficie de consulta. El tramo 7
 * (§{Tramo 7}) no los menciona.
 */
export type Registro = {
  readonly coordenada: SourceRange;
  readonly valores: readonly Valor[];
  readonly nodo: ElementId;
};

// ─────────────────────────────── Anotaciones (R3) ────────────────────────────

/**
 * Lo que un anotador propone. NO lleva el nodo: se lo pone el runner.
 *
 * PROVISIONAL(#17): así «nunca devuelve un nodo» (§{Los anotadores no son}) se hace
 * cumplir POR EL TIPO, y un anotador no puede anotar sobre otro nodo que el que le
 * pasaron.
 */
export type AnotaciónPropuesta = {
  /**
   * ABIERTA a propósito: es la válvula de escape que §{Por qué `tipo`} le asigna a
   * las anotaciones, en contraste explícito con `Tipo`, que es cerrado. «El
   * conjunto es extensible sin tocar el pipeline: mañana un anotador de idioma,
   * otro de moneda, otro de fechas» (§{Los anotadores no son}).
   */
  readonly clase: string;
  /** Rango sobre el texto del nodo, o `null` si la anotación es del nodo entero. */
  readonly rango: readonly [number, number] | null;
  /**
   * PROVISIONAL(#17): `unknown` DELIBERADO — El plan no define `Anotación` en
   * ninguna parte (`mirar(nodo): Anotación[]`, §{Los anotadores no son}, es toda la
   * especificación) y el conjunto de clases es abierto por diseño, así que el
   * payload de una clase que todavía no existe no es tipable desde el contrato. Es
   * uno de los DOS `unknown` que llevan datos en todo el paquete (el otro es
   * `AdaptadorOpaco.reconocer`), y está acá porque el plan realmente no lo
   * determina — Cada anotador valida el suyo; `ir` solo garantiza la envoltura.
   */
  readonly valor: unknown;
};

/**
 * Una anotación anclada. Vive en Postgres, colgada del `ElementId` (R3, §{R3}).
 *
 * PROVISIONAL(#18): `origen` es OBLIGATORIO y `(nodo, anotador, clase, rango)` es
 * la clave de deduplicación — El plan no tiene marca que distinga anotación
 * automática de curación humana, y las dos viven en el mismo almacén. Como la
 * delegación tardía es una re-emisión completa (§{La delegación tardía}), los
 * anotadores vuelven a correr sobre TODOS los nodos: sin clave de deduplicación
 * cada re-emisión duplica, y con borrado-y-reescritura ARRASTRA LA CURACIÓN HUMANA
 * — la falla exacta que R3 existe para impedir (§{R3}) — Si se decide al revés (sin
 * `origen`), un borrado por re-emisión se lleva puesto el trabajo del cliente sin
 * que nada se ponga rojo.
 *
 * SIGUE ABIERTO Y `ir` NO LO PUEDE RESOLVER (auditoría #17): ningún tramo declara
 * LEER anotaciones. Las exclusiones y la sensibilidad (§{R3}) solo significan algo
 * si alguien se niega a indexar; sin punto de lectura, contenido marcado como
 * excluido llega al índice — y el tramo 6 es donde el texto SALE hacia una API de
 * terceros.
 */
export type Anotación = AnotaciónPropuesta & {
  readonly nodo: ElementId;
  readonly anotador: string;
  readonly origen: "automática" | "humana";
  readonly creadaEn: Instante;
};

/**
 * §{Los anotadores no son}.
 *
 * PROVISIONAL(#21): el anotador recibe el esquema de su container — `mirar(nodo)`
 * no da acceso al contexto que el propio tramo declara tener a mano: un anotador
 * sobre un nodo-fila sin etiquetas no puede saber qué columna mira. `null` cuando
 * el nodo no cuelga de un container con esquema — Si se decide al revés (solo el
 * nodo), la mitad de las anotaciones sobre planillas no se pueden escribir.
 *
 * SIGUE ABIERTO (auditoría #20): los anotadores no tienen registro, orden, política
 * de fallo ni presupuesto — a diferencia de los adaptadores, que tienen registro
 * explícito y determinismo verificado en CI. Y «cuestan cero pasadas extra»
 * (§{Los anotadores viajan}) es una afirmación sobre PASADAS, usada como si fuera
 * sobre COSTO: ocho expresiones regulares sobre 50 000 nodos-fila no son
 * microsegundos.
 */
export interface Anotador {
  readonly nombre: string;
  mirar(
    nodo: NodoEmitido,
    esquemaDelContainer: readonly string[] | null,
  ): readonly AnotaciónPropuesta[];
}

// ─────────────────────────────── El envoltorio ───────────────────────────────

/**
 * Lo que es del documento y NO de la IR.
 *
 * PROVISIONAL(#73/#22): tipo NUEVO — Ni `Nodo`, ni `NodoEmitido`, ni `Fragmento`,
 * ni `Registro` llevan `documentoId` u `organización`, y el tramo 7 necesita
 * `organización` en el payload, «sin la cual la búsqueda vectorial es cross-tenant
 * por defecto», contra el invariante de §{Tramo 1 › El registro} («toda lectura
 * posterior se filtra por acá»). Pero meterlo en la IR envenena el caché de
 * reconocimiento, que se indexa por `hashBytes` y cruza organizaciones POR DISEÑO
 * (§{Caché}). Un envoltorio explícito acompaña a la lista de nodos y el caché
 * almacena `NodoCrudo[]` y nada más — Si se decide al revés (campos en
 * `NodoEmitido`), el árbol deja de ser cacheable entre organizaciones y se cae la
 * optimización insignia de §{Caché}; si se deja implícito en la orquestación, así
 * es como se llega a un índice cross-tenant sin que nada lo señale.
 */
export type Ingesta = {
  readonly documento: DocumentoId;
  readonly organización: OrganizacionId;
  readonly dueño: ActorId;
  readonly canal: Canal;
  readonly sellado: Instante;
  readonly nivelLogrado: NivelLogrado;
  readonly estado: EstadoDeDocumento;
};

/**
 * Los cuatro canales (§{Tramo 1 › El registro}, §{La sonda}).
 *
 * PROVISIONAL(#445): UNA sola grafía — El plan usa `'carpeta'` en `Sonda.origen`
 * (§{La sonda}) y `'carpeta local'` en `documento.canal` (§{Tramo 1 › El registro})
 * para lo mismo. Elijo la forma corta, que es la que aparece en un tipo — Si se
 * decide al revés, hay que cambiar la unión de `Sonda.origen`.
 */
export const CANALES = ["chat", "frontend", "carpeta", "conector"] as const;
export type Canal = (typeof CANALES)[number];

/**
 * §{Tramo 1 › El registro}: «estructurado | texto plano».
 *
 * PROVISIONAL(#2): tercer valor `mixto` — El plan declara dos y no da valor para su
 * propio ejemplo estrella: 198 páginas estructuradas + 2 delegadas
 * (§{La delegación es emergente}). Es el campo que «vuelve visible la degradación»
 * (§{Tramo 1 › El registro}) y alimenta la métrica de §{Observabilidad} — Se deriva
 * de la evidencia ganadora del tramo 2 (ver `Selección` en `adaptador.ts`), que hoy
 * `seleccionar()` descarta.
 */
export const NIVELES_LOGRADOS = ["estructurado", "texto plano", "mixto"] as const;
export type NivelLogrado = (typeof NIVELES_LOGRADOS)[number];

/**
 * §{Tramo 1 › El registro}.
 *
 * `ir` declara los OCHO valores y NADA MÁS. Las transiciones no están en el plan
 * (auditoría #1: «la máquina de estados no tiene transiciones») y no son una
 * decisión que un contrato de tipos pueda tomar: si `parcial` es terminal, qué lo
 * convierte en `indexado` cuando drenan los pendientes, si `en_espera` va a
 * `recibido` o a `reconociendo`, si `rechazado` es alcanzable después de `recibido`
 * (necesario para el antivirus tardío), y qué estado tiene un documento «guardado
 * pero no escaneado». Sin las transiciones no se puede escribir ningún worker.
 */
export const ESTADOS_DE_DOCUMENTO = [
  "recibido",
  "reconociendo",
  "indexando",
  "indexado",
  "parcial",
  "fallido",
  "rechazado",
  "en_espera",
] as const;
export type EstadoDeDocumento = (typeof ESTADOS_DE_DOCUMENTO)[number];
