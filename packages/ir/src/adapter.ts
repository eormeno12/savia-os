/**
 * El contrato de adaptador — sonda, evidencia, los dos casilleros, el contexto.
 *
 * PROVISIONAL(§{Paquetes}): esto vive en `ir` y no en `adaptadores` — El plan de
 * implementación pone `sonda · registro · los 12` en `adaptadores` y enumera `ir`
 * como «las seis formas · Tipo · Pista · Marca · cohesiónDe()». Pero esa
 * enumeración ya es incompleta: tampoco lista `Node`, `Body`, `Authorship` ni
 * `Unit`, y los cuatro tienen que estar ahí. La línea de corte es DECLARACIÓN vs
 * IMPLEMENTACIÓN, no tramo: el argumento textual de §{Cómo se agrega}
 * («`adaptadores` lo emite y el fragmentador lo lee, y esos dos no se ven entre sí;
 * `ir` es el único lugar que ambos alcanzan») aplica palabra por palabra a
 * `Unit`, `Context` y `Budget`, que `ingesta` necesita para orquestar sin
 * importar `adaptadores`. En `adaptadores` quedan el constructor de sondas, el
 * registro, `seleccionar` y las doce implementaciones — Si se decide al revés, `ir`
 * no contiene el contrato completo y «`ir` se congela y se versiona primero»
 * (§{Paquetes}) deja de significar que el contrato está congelado.
 */

import { PARAMETERS } from "./params.js";
import type { AdapterId, MatterHash } from "./identity.js";
import type { Classification, RecognitionLevel } from "./classification.js";
import type { Body, ObjectRef } from "./shapes.js";
import type { LocalLocation, Location } from "./location.js";
import type { AchievedLevel, Channel, RawNode } from "./outputs.js";

// ─────────────────────────────── Evidence ────────────────────────────────────

/**
 * La escala ordinal y cerrada del tramo 2 (§{Evidencia}).
 *
 * PROVISIONAL(#429): el ORDEN es el dato y los números se derivan de él — El plan
 * escribe seis constantes con valores (`Firma = 4 … Ninguna = -1`) y dos veces dice
 * «cinco clases nombradas» (§{Evidencia}, §{Tramo 2 › Decisiones}). Derivar los
 * números del orden del arreglo elimina la posibilidad de que la escala y los
 * valores diverjan, deja la escala enumerable en runtime, y da exactamente los
 * mismos números del plan (índice relativo a `Floor`) sin un solo literal numérico —
 * Si se decide al revés (enum con valores a mano), la relación ordinal queda
 * implícita en seis números sueltos.
 *
 * Tiene que ser NUMÉRICA: el selector hace aritmética (`y.e - x.e`) y comparación
 * de orden (`x.e > Evidence.None`) sobre ella (§{El selector}).
 *
 * Y lo que esa decisión NO compra es que el orden SIGA siendo el del plan: mover una
 * fila cambia los seis valores a la vez, en verde. Eso lo ata el invariante 11 de
 * `invariants.ts` (`EVIDENCE_PROOFS`), acreditado por M42.
 */
export const EVIDENCE_SCALE = [
  "None",
  "Floor",
  "Content",
  "Extension",
  "Structure",
  "Signature",
] as const;

export type EvidenceName = (typeof EVIDENCE_SCALE)[number];

const valueOfEvidence = (n: EvidenceName): number =>
  EVIDENCE_SCALE.indexOf(n) - EVIDENCE_SCALE.indexOf("Floor");

/**
 * Las seis constantes, con los valores literales del plan: `Signature 4 · Structure 3
 * · Extension 2 · Content 1 · Floor 0 · None -1`.
 *
 * CRITERIO OPERATIVO, que el plan no da y sin el cual «quién gana un archivo
 * depende de cuál autor fue más modesto al elegir su constante» (auditoría H12).
 * `Structure = 3` y `Content = 1` no tienen NINGÚN productor en todo el
 * documento, y `evidenciaDocx` —que abre el zip y busca `word/document.xml`, o sea
 * literalmente «estructura interna consistente con el formato»— devuelve `Signature`:
 *
 *  - `Signature` una secuencia de bytes que NO PUEDE aparecer en otro formato.
 *  - `Structure` un patrón estructural que SÍ PODRÍA aparecer en otro formato.
 *  - `Extension` solo el nombre, sin contradicción en los bytes.
 *  - `Content`   heurística estadística sobre el texto ya decodificado.
 *  - `Floor`     reservado al adaptador piso de texto. Ver `Selection`.
 *  - `None`      no aplica.
 */
/*
 * NOTA: `Evidence` se declara dos veces a propósito — una como VALOR (el objeto de
 * constantes) y una como TIPO (`number`), que es el patrón idiomático para emular
 * un `enum` sin usar `enum`. Es UNA definición en dos espacios de declaración, no
 * dos definiciones. Se emula en vez de usar `enum` porque los seis valores se
 * DERIVAN del orden de `EVIDENCE_SCALE` y un `enum` obligaría a repetirlos.
 */
export const Evidence = {
  Signature: valueOfEvidence("Signature"),
  Structure: valueOfEvidence("Structure"),
  Extension: valueOfEvidence("Extension"),
  Content: valueOfEvidence("Content"),
  Floor: valueOfEvidence("Floor"),
  None: valueOfEvidence("None"),
} as const;

/*
 * UN ESCALÓN QUE ESTE TIPO PODRÍA SUBIR Y NO SUBE — se presenta, no se decide.
 *
 * `Evidence = number` significa que CUALQUIER número es una evidencia: un
 * `EvidenceFn` puede devolver `42` y el selector lo ordena igual. Es escalón ①
 * (prosa) donde hay un ④ disponible — `Nominal<number, "Evidence">` sigue
 * permitiendo `y.e - x.e` y `x.e > Evidence.None`, porque una marca es una
 * intersección y no un envoltorio, y volvería INEXPRESABLE un ordinal fuera de la
 * escala.
 *
 * El costo es real y por eso no se decide acá: los seis constructores de abajo
 * necesitarían un `as`, y LOS DOCE ADAPTADORES también, cada vez que devuelven una
 * evidencia calculada. Es superficie que se paga doce veces, así que es una decisión
 * del dueño del contrato y conviene tomarla ANTES de que los doce existan. Queda
 * escrita también en `GLOSARIO.md`, sección 8.
 */
export type Evidence = number;

// ─────────────────────────────── Probe ───────────────────────────────────────

/**
 * De dónde vino lo que se está sondeando.
 *
 * PROVISIONAL(#445): unión DISCRIMINADA en vez de
 * `'chat' | ... | AdapterId` (§{La sonda}) —
 * Si `AdapterId` es un `string`, la unión entera COLAPSA a `string` y los cuatro
 * literales no aportan nada al chequeo de tipos. Peor: el adaptador de chat tiene
 * `id: 'chat'` (§{Chat}), así que `porOrigen('chat', Evidence.Signature)` (§{Chat}) no
 * distingue «vino del canal chat» de «lo delegó el adaptador chat» — Si se decide
 * al revés, la ambigüedad queda y `Channel` sigue con dos grafías.
 *
 * NOTA APARTE: `porOrigen` devolviendo `Evidence.Signature` es un abuso del
 * vocabulario, porque `Signature` está definida como «firma inequívoca EN EL CONTENIDO»
 * (§{Evidencia}) y el origen no es contenido. O se lee `Signature` como «evidencia
 * inequívoca», o el sexto valor de la escala es incoherente. Lo dejo escrito, no lo
 * resuelvo.
 */
export type Origin =
  | { readonly kind: "channel"; readonly channel: Channel }
  | { readonly kind: "delegated"; readonly by: AdapterId };

/**
 * Los cinco datos escalares que se persisten en `documento_en_espera`
 * (§{Lo que queda}).
 */
export type ColdProbe = {
  /**
   * PROVISIONAL(#430): normalizada — minúsculas, SIN punto, solo el último
   * segmento, `null` si no hay — Es el campo del que dependen todos los
   * evidenciadores de nivel `Extension`, que es el que decide en ausencia de firma,
   * y hoy hay que decidirlo doce veces (con punto o sin, mayúsculas, compuestas
   * como `.tar.gz`). Las compuestas se resuelven en el evidenciador que las
   * necesite, no en la sonda — Si se decide al revés, doce adaptadores normalizan
   * distinto.
   */
  readonly extension: string | null;
  /** Normalizado a minúsculas y sin parámetros. */
  readonly declaredMime: string | null;
  /** Bytes del objeto REAL, no del declarado por el cliente (auditoría #38). */
  readonly size: number;
  /**
   * PROVISIONAL(#430): PARAMETERS.intake.magicBytes bytes, o MENOS si el
   * archivo es más corto — nunca rellenado, para que `size` y
   * `magicBytes.length` no mientan. `empiezaCon` devuelve `false` sobre un buffer
   * más corto que la firma — Si se decide al revés (rellenar), una firma puede
   * matchear sobre padding.
   */
  readonly magicBytes: Uint8Array;
  /**
   * §{Lo que queda}. SIGUE SIN PRODUCTOR (auditoría #32): nada en el diseño
   * identifica formatos por nombre —`evidence()` devuelve un ordinal y solo la
   * corren los adaptadores que existen, que por definición no existen para lo que
   * queda en espera—. Hace falta un catálogo de firmas paralelo al registro,
   * ausente del diseño y del grafo de paquetes. Sin él es siempre `null`, la rama
   * «Identificado» del mensaje al usuario NUNCA se ejecuta, y el roadmap se agrupa
   * por `null`.
   *
   * Es un FORMATO de archivo, no un `Role` (GLOSARIO.md, D4): traducirlo
   * `detectedRole` habría dicho algo falso.
   */
  readonly detectedFormat: string | null;
};

/**
 * La sonda completa: la fría más el origen y los perezosos.
 *
 * PROVISIONAL(C7): UN SOLO tipo de sonda; la persistida se REHIDRATA y sus
 * perezosos SÍ van a almacenamiento — El plan afirma que al registrar un adaptador
 * nuevo «se corre solo su `evidencia()` contra las sondas guardadas — se recorre
 * una tabla chica, NO SE LEEN ARCHIVOS de almacenamiento» (§{Lo que queda}), y el
 * único evidenciador completo del documento hace `await s.zipEntries()`
 * (§{Evidencia}). O el barrido lee los objetos, o los cuatro adaptadores de zip
 * (`.docx`, `.xlsx`, `.pptx`, `.odt`, los de mayor demanda) devuelven `None`
 * siempre y no rescatan nada, EN SILENCIO — justo el `.pptx` que el propio
 * documento usa como caso testigo (§{Lo que queda}). Un solo tipo no toca el
 * contrato ni agrega un tercer casillero a algo que el plan acaba de reducir a dos
 * (§{Dos casilleros}, §{Tramo 3 › Decisiones}) — CONSECUENCIA: la afirmación de
 * costo de §{Lo que queda} es lo que está mal, y el barrido necesita cuota y
 * paginado, que el plan no contempla y que se agrava con O(sondas × adaptadores) en
 * cada arranque de cada réplica (auditoría #30, #452) — Si se decide al revés
 * (`evidenciaFría` como segundo miembro obligatorio), los doce autores escriben la
 * evidencia dos veces y tienen que mantenerlas coherentes.
 *
 * PROVISIONAL(#432): los perezosos memoizan LA PROMESA EN VUELO, no el valor
 * resuelto — `Promise.all` (§{El selector}) dispara `zipEntries()` en los cuatro
 * adaptadores de zip SIMULTÁNEAMENTE: con memoización sobre el valor son cuatro
 * aperturas, sobre la promesa es una. La afirmación «el costo real es una sola
 * apertura parcial» (§{Los tres casos}) es verdadera bajo una y falsa bajo la otra
 * — Si se decide al revés, el plan afirma un costo que no tiene.
 *
 * PROVISIONAL(H9): la sonda de un ASSET DELEGADO la construye el adaptador PADRE,
 * junto con el asset — Es información que el padre tiene y nadie más: el asset es
 * `{ref, mime, deferred}` y no tiene extensión, ni tamaño, ni bytes propios —
 * ESTO NO RESUELVE H9: mientras la región referencie el original sin materializar
 * (§{Dónde frena}), sus primeros 4 KB son los del PDF entero,
 * `esImagen(magicBytes)` da `None`, gana otra vez el adaptador de PDF, y el
 * ejemplo canónico del documento (contrato.pdf → pg3 → adaptador `imagen`,
 * §{La delegación es emergente}) NO FUNCIONA. Lo que falta —qué parte del original
 * es la región, a nivel de bytes— es lo que `ObjectRef.window` expresa; que el
 * constructor de sondas la use es decisión de `adaptadores`.
 */
export type Probe = ColdProbe & {
  readonly origin: Origin;
  zipEntries(): Promise<readonly string[]>;
  firstLines(): Promise<readonly string[]>;
};

/**
 * §{Evidencia}, donde el tipo se usa como anotación y nunca se declara.
 *
 * PROVISIONAL(#9): SIEMPRE `Promise`, y quien lo llama CAPTURA — `seleccionar` usa
 * `Promise.all` (§{El selector}), que propaga el rechazo: un evidenciador roto no
 * devuelve `null`, TIRA, y hace fallar la selección de los doce, en un pipeline
 * donde «los archivos rotos son la norma, no la excepción»
 * (§{Los decodificadores}). Un evidenciador que lanza cuenta como `None` +
 * `Diagnostics.notice` — Si se decide al revés, un bug en un adaptador que ni
 * siquiera reclamaba el archivo decide el destino del archivo.
 */
export type EvidenceFn = (probe: Probe) => Promise<Evidence>;

/**
 * Lo que devuelve el selector.
 *
 * PROVISIONAL(#3): devuelve el PAR, no solo el adaptador — `seleccionar(sonda):
 * Promise<Adapter | null>` (§{El selector}) descarta la evidencia ganadora, así
 * que el
 * llamador no puede distinguir «ganó un adaptador dedicado» de «cayó al piso de
 * texto» sin comparar `a.id === 'piso'` — ramificar sobre la identidad de un
 * adaptador desde la orquestación. Con el par, `achievedLevel` («estructurado |
 * texto plano», §{Tramo 1 › El registro}), que es un campo declarado del tramo 1
 * sin productor (auditoría #2), se deriva de `evidence > Floor` — Si se decide al
 * revés, el campo que «vuelve visible la degradación» no lo produce nadie, y el día
 * que haya dos pisos la comparación por id se rompe.
 *
 * PROVISIONAL(#429): `Floor` NO compite en el mismo `sort` que los dedicados — El
 * filtro literal es `x.e > Evidence.None` (§{El selector}), así que `Floor = 0`
 * pasa y empata con un adaptador dedicado que devuelva `Floor`; con el desempate por
 * `id` (§{El selector}), quién gana lo decide el ORDEN ALFABÉTICO del nombre del
 * adaptador. Se elige entre los que superan `Floor`, y solo si no hay ninguno se cae
 * al piso — Si se decide al revés, un resultado de selección lo decide cómo alguien
 * llamó a su adaptador.
 *
 * PROVISIONAL(#427): el desempate compara por CODE UNITS (`<` / `>` crudo), no con
 * `localeCompare` — `localeCompare` sin locale depende de ICU y del locale del
 * proceso, así que el desempate que §{El selector} declara «precondición de que el
 * caché sea válido» no está garantizado entre entornos. Es un cambio de una línea
 * sobre código literal del plan que rescata una precondición declarada. Y los `id`
 * del registro tienen que ser ÚNICOS, cosa que el plan nunca declara: con dos
 * iguales el comparador da 0 y la clave de caché colisiona.
 */
export type Selection = {
  readonly adapter: OpaqueAdapter;
  readonly evidence: Evidence;
  readonly achievedLevel: AchievedLevel;
};

// ─────────────────────────────── Context ─────────────────────────────────────

/** §{Diagnóstico}. El canal va en el contexto, NO en los retornos (§{Diagnóstico}). */
export interface Diagnostics {
  /**
   * PROVISIONAL(§{Diagnóstico}): `location` es OPCIONAL — El plan la hace
   * obligatoria y los tres productores más citados no la tienen: la discrepancia
   * extensión/contenido del tramo 2 se registra (§{Los tres casos}) antes de que
   * exista una `Location`, el anclaje bajo del tramo 4 (§{Degradación}) es de
   * documento, y el presupuesto agotado (§{Diagnóstico}) es de corrida — Si se
   * decide al revés, hay que fabricar ubicaciones sintéticas o inventar un
   * centinela, que envejece igual de mal que un `null` disfrazado. (La variante
   * `{space:'source'}` de `Coordinate` cubre el caso «toda la fuente», pero no el
   * caso «ninguna fuente en particular».)
   *
   * PROVISIONAL(§{Diagnóstico}): `code` es ABIERTO, con prefijo por tramo — Es el
   * caso OPUESTO a `Role`: cerrarlo obliga a tocar el contrato cada vez que un
   * adaptador aprende a avisar de algo, y R3 no aplica porque un aviso no es
   * memoria.
   */
  notice(code: string, location: Location | null, detail?: string): void;
  degraded(from: AchievedLevel, to: AchievedLevel, reason: string): void;
}

/**
 * Lo REGISTRADO por `Diagnostics`, que el plan nunca tipa.
 *
 * PROVISIONAL(§{Diagnóstico}): los dos métodos devuelven `void` y sin embargo el
 * estado `partial` (§{Diagnóstico}), la métrica de degradación (§{Observabilidad})
 * y el invariante «ninguna información se descarta en silencio» (§{Invariantes})
 * dependen de LEER lo registrado — Sin estos tipos el sumidero no es tipable y el
 * invariante no es verificable.
 */
export type Notice = {
  readonly code: string;
  readonly location: Location | null;
  readonly detail: string | null;
};

export type Degradation = {
  readonly from: AchievedLevel;
  readonly to: AchievedLevel;
  readonly reason: string;
};

/** Las cinco dimensiones del presupuesto. Ver `PARAMETERS.budget`. */
export type Budget = {
  readonly maxMs: number | null;
  readonly maxNodes: number | null;
  readonly maxMaterializedBytes: number | null;
  readonly maxInvocations: number | null;
  readonly maxExpansions: number | null;
};

/**
 * Qué se está gastando.
 *
 * PROVISIONAL(#7): `expansion` descuenta SIEMPRE, incluso en acierto de caché;
 * `invocation` no — «El presupuesto cuenta trabajo, no intentos: un acierto de
 * caché no descuenta, porque no cuesta» (§{Diagnóstico}, y el hallazgo 6 del banco,
 * §{Segunda}) es correcto para el COSTO y deja a la recursión sin medida
 * decreciente: el límite de profundidad se eliminó a propósito (§{Dónde frena},
 * §{Lo que se borró}) y ni el punto fijo ni la guarda de ciclo disparan sobre
 * assets distintos-pero-cacheados. El invariante «la recursión termina»
 * (§{Invariantes}) no se sigue de las reglas escritas — Separar los dos contadores
 * conserva LITERALMENTE la regla que el plan derivó de una medición y le devuelve a
 * la recursión una medida decreciente, sin reintroducir un contador de profundidad
 * — Si se decide al revés, el único límite que queda es `maxMs`, que es
 * justamente el que la regla dice que no debería contar y el que rompe el
 * determinismo.
 */
export type SpendKind =
  | "ms"
  | "nodes"
  | "materializedBytes"
  | "invocation"
  | "expansion";

/** Cancelación mínima. `ir` no depende de la lib DOM. */
export interface CancellationSignal {
  readonly aborted: boolean;
}

/**
 * El contexto de `decompose` (§{Dos casilleros}), que el plan usa una vez y nunca
 * define.
 *
 * PROVISIONAL(H1): CAPABILITY OBJECT del núcleo, no un contexto flaco — Un contexto
 * de `{diagnostics, limits}` (que es lo que dice §{Diagnóstico}) deja que el
 * adaptador se autolimite y al núcleo sin poder impedir nada: el zip bomb depende
 * de que los doce autores se acuerden, que es el modo de falla que
 * §{Las tres reglas} declara inadmisible. Y no hay dónde poner la cadena de
 * ancestros de la guarda de ciclo (§{Dónde frena}), ni el diferido, ni la
 * producción del `ObjectRef` de un asset incrustado, que exige escribir bytes. Qué
 * se invente acá decide, textualmente (auditoría H1), «quién hace cumplir el
 * presupuesto y si `decompose` puede escribir en almacenamiento» — Sí puede, pero
 * SOLO por `materialize`, para que la precondición de terminación de
 * §{Dónde frena} sea expresable como «no llamar a `materialize`, reusar la ref del
 * origen» — Si se decide al revés (contexto flaco), no hay quién haga cumplir nada.
 *
 * PROVISIONAL(H1): NO hay `delegar()` — Sería la lectura literal de «la recursión
 * ocurre sola» (§{La delegación es emergente}) desde adentro del adaptador, y rompe
 * el grafo de paquetes: `adaptadores` pasaría a depender de `seleccionar()`, que
 * vive con el registro, y la delegación dejaría de ser emergente para ser una
 * llamada. El adaptador emite `asset` y nada más; quien recorre las unidades,
 * detecta los assets, les construye sonda y llama `seleccionar` es la ORQUESTACIÓN
 * (auditoría #11) — Es la única lectura que preserva «adaptadores y emision NUNCA
 * se ven entre sí» (§{Paquetes}) y que deja el punto fijo, la guarda de ciclo y el
 * descuento en un solo lugar.
 */
export interface Context {
  readonly diagnostics: Diagnostics;
  readonly limits: Budget;
  /**
   * La cadena de hashes de ancestros que corta la recursión (§{Dónde frena}). De
   * solo lectura: la deriva el orquestador en cada nivel, y el `Context` de un
   * asset delegado es un HIJO del de su contenedor, no uno nuevo.
   *
   * Que la cadena siga siendo de MATERIA no es decorativo y no lo impone ninguna
   * línea de código: lo ata el invariante 10 de `invariants.ts`
   * (`RECURSION_PROOFS`), acreditado por M41.
   */
  readonly ancestors: readonly MatterHash[];
  readonly depth: number;
  /**
   * PROVISIONAL(#6): campo NUEVO — `maxMs` no es un tope real sin un mecanismo
   * de cancelación, y el plan no menciona ninguno.
   */
  readonly signal: CancellationSignal;
  /**
   * `false` = presupuesto agotado. Difiere, nunca lanza
   * (§{Dónde frena}, §{Diagnóstico}).
   */
  spend(kind: SpendKind, amount: number): boolean;
  /**
   * El ÚNICO punto donde se consulta el caché. Es lo que vuelve cierto «un acierto
   * de caché no descuenta» (§{Diagnóstico}): si cada adaptador invocara por su
   * cuenta, nadie podría saber si descontó o no.
   */
  invoke<T>(key: string, work: () => Promise<T>): Promise<T>;
  /**
   * Escribir bytes nuevos en almacenamiento direccionado por contenido. NO llamarla
   * es lo que hace cumplir la precondición de terminación (§{Dónde frena}).
   */
  materialize(bytes: Uint8Array, mime: string): Promise<ObjectRef>;
}

// ─────────────────────────────── Unit ────────────────────────────────────────

/**
 * Un pedazo del documento tal como lo entrega `decompose` (§{`descomponer`}). Dos
 * caras: las señales del formato, que MUEREN acá, y el cuerpo, que CRUZA el borde.
 *
 * PROVISIONAL(C25): las señales se leen SIEMPRE por `u.signals.X`, nunca aplanadas
 * sobre la unidad — El plan tiene los dos accesos a cuatro líneas de distancia, en
 * el punto donde dice que se hace cumplir «la clave de todo el diseño»
 * (§{`descomponer`}): `porProminencia` lee `u.pt` (§{`detectar`}) y `porStyleId`
 * lee `u.señales.styleId` (§{`detectar`}). `u.pt` es una ERRATA, no una alternativa
 * de diseño: contradice el tipo literal de §{`descomponer`}, contradice el párrafo
 * que lo justifica (§{`descomponer`}) y contradice el vocabulario (§{Vocabulario})
 * — Con las señales bajo su campo, «cero fugas de formato en el nodo»
 * (§{Invariantes}) es trivialmente cierto por construcción; con `Unit<S> = S &
 * {body, location}` cualquier señal llamada `body` colisiona y nada impide que
 * un consumidor aguas abajo lea una señal creyendo que es del núcleo — Si se decide
 * al revés, se destruye el invariante que el tipo existe para dar. `porProminencia`
 * pasa a leer `u.signals.pt`.
 *
 * Y que la unidad NO lleve `id` es H13(a): lo ata `MINTING_PROOFS` en
 * `invariants.ts`, acreditado por M40 con su control MC8.
 *
 * PROVISIONAL(§{Chat}): lleva `LocalLocation`, sin `adapter` — Ver el
 * razonamiento en `LocalLocation`. Con eso el ejemplo del chat del plan deja de
 * NECESITAR el campo `adapter`.
 *
 * CORRECCIÓN: la versión anterior de esta línea decía que el ejemplo «vuelve a ser
 * correcto TAL COMO ESTÁ ESCRITO». Era FALSO, y verificable en segundos con el
 * compilador — que es exactamente el defecto que este paquete ya pagó tres veces.
 * Compilado contra `Adapter`, el ejemplo tiene CUATRO defectos, no uno:
 *
 *   1. `id: 'chat'` no es asignable a `AdapterId`, que es un tipo marcado.
 *      Exige `asAdapterId('chat')`.
 *   2. `descomponer` es SÍNCRONO y el contrato pide `Promise<readonly Unit<S>[]>`.
 *   3. `ubicación: { ancla }` no alcanza: `LocalLocation` exige `coordinate`.
 *      La del chat es `{ space: 'source' }`.
 *   4. Faltan `level` y `version`, miembros obligatorios de `Adapter`.
 *
 * Sacarle `adaptador` a `LocalLocation` era NECESARIO y no SUFICIENTE. El ejemplo
 * sigue siendo diez líneas —la tesis del plan se sostiene— pero son otras diez.
 *
 * PROVISIONAL(#C21): NO lleva marcador de delegación — El adaptador delegado no
 * sabe que fue delegado. Va en `RawNode.delegation` (`outputs.ts`), puesto por el
 * orquestador.
 *
 * PROVISIONAL(#22): NO lleva `Authorship`, con UNA excepción opcional — El chat la
 * necesita de verdad (cada mensaje tiene su autor, §{Chat}) y ningún otro
 * adaptador. Ponerla obligatoria mete un timestamp en la salida de `decompose` de
 * los otros once y rompe el determinismo byte-idéntico y el caché entre
 * organizaciones — Si se decide al revés (obligatoria), C8 y #22 quedan sin
 * arreglo.
 */
export type Unit<S> = {
  /** Específico del formato — MUERE acá. */
  readonly signals: S;
  /** Una de las seis formas — CRUZA el borde. */
  readonly body: Body;
  readonly location: LocalLocation;
  /** Solo donde varía genuinamente dentro de un documento: chat, `.eml`, hilos. */
  readonly ownAuthorship?: { readonly actor: string; readonly when: string };
};

/**
 * De dónde salen los bytes.
 *
 * PROVISIONAL(C9/#8): `decompose` recibe una `Source`, no un `Uint8Array` — El
 * literal de §{Dos casilleros} obliga a cargar el archivo entero en memoria antes
 * de empezar, y choca con tres cosas del propio plan: el tramo 2 se diseñó ENTERO
 * para decidir «sin haber leído el archivo entero» (§{Tramo 2}); `bytesMáximos`
 * sugiere que los bytes se contabilizan MIENTRAS se procesa; y los casos que el
 * plan declara esperables —zip bomb, PDF de 800 páginas, columna de un millón de
 * filas (§{Diagnóstico})— son exactamente aquellos donde materializar ES el
 * problema. Con `range()` además el `.docx` de 200 MB puede leer el directorio
 * central del zip, que vive al final, con un range-request (auditoría #433) — ES LA
 * DESVIACIÓN MÁS GRANDE DE ESTE ARCHIVO Y MERECE REVISIÓN HUMANA: el plan escribió
 * `Uint8Array` a propósito, para que el borde fuera obvio — Si se decide al revés,
 * el tope de tamaño de archivo (que no tiene valor) pasa a ser la única protección
 * de memoria del sistema.
 */
export interface Source {
  readonly size: number;
  bytes(): Promise<Uint8Array>;
  /**
   * `[start, end)` — MEDIA ABIERTA, en BYTES. Misma convención que
   * `Coordinate.text` (`location.ts`), que ya la fija en `[start, end)` para
   * code points. `range(0, 4)` devuelve 4 bytes: 0, 1, 2 y 3.
   *
   * Esta línea existe porque sin ella la convención se reparte entre doce autores
   * sobre nada. Y el modo de falla es SILENCIOSO: un autor que asuma `[start,
   * end]` y recorra un archivo de 10 bytes de a 4 llama `range(0,3)`,
   * `range(4,7)`, `range(8,9)` esperando 4+4+2; contra esta implementación recibe
   * 3+3+1 = **7 de 10 bytes**, perdiendo el 3, el 7 y el 9. No hay excepción, no
   * hay aviso: el documento entra al pipeline con agujeros.
   */
  range(start: number, end: number): Promise<Uint8Array>;
  stream(): AsyncIterable<Uint8Array>;
}

// ─────────────────────────────── Adapter ─────────────────────────────────────

/**
 * Un eslabón de una cascada de clasificación (§{La única}), que el plan usa como el
 * parámetro sin tipo `cs` de una arrow function.
 *
 * PROVISIONAL(#61/C19): lleva `name` y `level`, no `certainty` — `level` porque con
 * dos valores de certeza `rank()` no puede ordenar posicional antes que perceptual
 * y quedan empatados, decidiendo el orden del autor, que es justo lo que el
 * reordenamiento existe para evitar (§{La única}). `name` porque `enCascada`
 * (§{La única}) DESCARTA cuál eslabón resolvió y sin eso la métrica que el plan
 * llama «la importante» (§{Observabilidad}) es inconstruible — Si se decide al
 * revés, «el invariante se cumple por construcción, no por revisión» es falso y la
 * observabilidad no tiene dato.
 *
 * NOTA PARA QUIEN IMPLEMENTE `enCascada`: la ESTABILIDAD de `Array.prototype.sort`
 * es load-bearing — §{La única} dice «el orden del autor solo desempata dentro de
 * la misma clase», y eso solo es cierto porque el sort de ES2019 es estable.
 * Conviene que esté escrito.
 */
export type CascadeLink<S> = {
  readonly name: string;
  readonly level: RecognitionLevel;
  readonly confidence?: number;
  detect(units: readonly Unit<S>[]): (u: Unit<S>) => Classification | null;
};

/**
 * Los DOS casilleros (§{Dos casilleros}). Un adaptador no tiene lógica propia: es
 * una declaración de qué implementación va en cada uno.
 *
 * PROVISIONAL(C9): la ENTRADA es un parámetro de tipo — El contrato declara
 * `descomponer(bytes, ctx)` (§{Dos casilleros}) y el único adaptador escrito
 * entero, `chat`, declara `descomponer(msg)` (§{Chat}): objeto tipado, síncrono y
 * sin `ctx`. Los tres desajustes son de tipo, no de estilo: tal como está escrito
 * el ejemplo de §{Chat} NO ES ASIGNABLE a `Adapter<S>` en ninguna lectura.
 * Parametrizar la entrada es lo único que no le cuesta nada al resto del pipeline y
 * lo único compatible con «la cintura no tiene forma de documento» (paso 5 del
 * orden de construcción, §{Orden}) — Si se decide al revés (serializar el chat a
 * bytes canónicos), hay que inventar ese formato canónico, que entra en
 * `hashBytes`, en la clave del caché y en el dedupe de blobs, y las «diez líneas»
 * de §{Chat} dejan de ser diez.
 *
 * PROVISIONAL(C10): el retorno sigue siendo `Promise<readonly Unit<S>[]>`, el
 * arreglo completo — Contradice «se puede emitir en streaming sin materializar el
 * documento en memoria» (§{2 · Emisor}), pero cambiarlo a `AsyncIterable` arrastra
 * a `detect`, que es una factory que RECIBE EL CORPUS COMPLETO por diseño
 * (§{`detectar`}, «la respuesta es relativa al documento»), y no hay decisión
 * escrita que lo respalde. El streaming es una propiedad del EMISOR, después de que
 * el tramo 3 materializó todo — Lo declaro NO SOPORTADO por el contrato v1, en vez
 * de fingir que funciona.
 *
 * PROVISIONAL(#448): el corpus que recibe `detect` sobre un subárbol delegado es
 * la salida de `decompose` DE ESA INVOCACIÓN, o sea la página, no el documento
 * contenedor — Es la única que tipa (`Unit<S>[]` con un solo `S`) y la única
 * consistente con que el subárbol «abre un scope propio» y «no participa de la
 * escala de niveles del documento padre» (§{2 · Emisor}) — HUECO DE CALIDAD
 * CONOCIDO: con la página, la moda de `porProminencia` se calcula sobre pocas
 * regiones y cualquier bloque parece título.
 *
 * PROVISIONAL(#25/C20): `version` cubre el ADAPTADOR ENTERO, `decompose`
 * incluido, y no solo el clasificador — El plan la llama `versiónDelClasificador` y
 * la mete en la clave del caché (§{Caché}) sin que sea miembro de `Adapter`. Con
 * ese nombre, arreglar un bug de decodificación no cambia ningún componente de la
 * clave y el caché sirve árboles CORRUPTOS PARA SIEMPRE (C20) — el bug silencioso
 * que la clave existe para prevenir, movido un casillero. Es una desviación
 * deliberada del literal de §{Caché} — Si se decide al revés, C20 queda sin
 * arreglo. La granularidad por eslabón (un `.docx` usa `porStyleId` y
 * `porProminencia`, que evolucionan por separado) se compone desde las versiones de
 * los eslabones más la propia.
 */
export interface Adapter<S, E = Source> {
  readonly id: AdapterId;
  /** El escalón de la escalera en el que trabaja. Alimenta `certaintyOfLevel`. */
  readonly level: RecognitionLevel;
  readonly version: string;
  evidence(probe: Probe): Promise<Evidence>;
  decompose(input: E, ctx: Context): Promise<readonly Unit<S>[]>;
  detect(units: readonly Unit<S>[]): (u: Unit<S>) => Classification | null;
}

/**
 * El adaptador con `S` y `E` BORRADOS, que es lo que guarda el registro y lo que
 * devuelve `seleccionar`.
 *
 * PROVISIONAL(§{El selector}): dos tipos, no uno — `Adapter` se declara genérico
 * en `S` (§{Dos casilleros}) y se usa SIN argumento en la firma del selector
 * (§{El selector}), y el registro es una colección heterogénea: el `S` de `.docx`
 * (con `styleId`) y el del chat (`{}`, §{Chat}) son distintos. Peor: `S` aparece a
 * la vez en posición de retorno (`decompose`) y de parámetro (`detect`), así
 * que `Adapter<S>` es INVARIANTE en `S` y no existe supertipo común no trivial.
 * Con `Adapter<unknown>` el registro no compila; con `Adapter<any>` compila y
 * se pierde toda la seguridad que la cara de señales existe para dar — Si se decide
 * al revés, el borde de señales queda sostenido por convención, que es el modo de
 * falla que R1 elimina.
 *
 * PROVISIONAL(C8): `recognize` es la COMPOSICIÓN de los dos casilleros, no un
 * tercer casillero — §{El determinismo} lo usa (`a.reconocer(f) ≡ a.reconocer(f)`)
 * y no es miembro de nada. Es exactamente: aplicar `decompose`, aplicar
 * `detect`, y donde `detect` se abstuvo aplicar `roleFromBody` con la
 * certeza del nivel (§{El piso}). Los casilleros siguen siendo DOS
 * (§{Tramo 3 › Decisiones}) — El determinismo de §{El determinismo} se verifica
 * sobre esta composición, y CON `maxMs` EN `null`: con un tope de tiempo de
 * pared el conjunto de nodos depende de la velocidad de la máquina y ningún
 * adaptador pasa el test.
 */
export interface OpaqueAdapter {
  readonly id: AdapterId;
  readonly level: RecognitionLevel;
  readonly version: string;
  evidence(probe: Probe): Promise<Evidence>;
  /**
   * PROVISIONAL(C9): `unknown` DELIBERADO, Y NO ESTÁ CONFINADO — Es el `E` borrado.
   * El registro es heterogéneo por construcción (un `.docx` recibe una `Source`, el
   * chat recibe un mensaje) y no hay tipo común.
   *
   * CORRECCIÓN: la versión anterior decía «el cast queda confinado a UN solo punto
   * del sistema: la fábrica que construye el adaptador opaco». Las dos mitades son
   * falsas. Esa fábrica NO EXISTE. Y el agujero no estaría en ella aunque
   * existiera: `unknown` en posición de PARÁMETRO no chequea nada. Verificado con
   * el compilador — `recognize(42, ctx)`, `recognize(null, ctx)`, una función, o el
   * mensaje de chat pasado al adaptador de `.docx`: las cuatro compilan sin un
   * error. El agujero está en CADA SITIO DE LLAMADA.
   *
   * POR QUÉ SIGUE ACÁ, y no es pereza. Ligar la entrada en `Selection` lo cierra y
   * ROMPE EL GATE DE CI: «un adaptador que no pasa el property test no entra al
   * registro», y a una `Selection` solo se llega desde `seleccionar`, que itera el
   * registro. El test pasaría a ejercitar un sosías construido por el arnés en vez
   * del artefacto que el registro guarda — y sobre ese gate descansa toda la
   * validez del caché. Queda declarado como hueco (P14), no disfrazado de garantía.
   */
  recognize(input: unknown, ctx: Context): Promise<readonly RawNode[]>;
}

/** El tamaño de la ventana de la sonda, para quien la construya. */
export const MAGIC_BYTES = PARAMETERS.intake.magicBytes;
