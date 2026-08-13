/**
 * El contrato de adaptador — sonda, evidencia, los dos casilleros, el contexto.
 *
 * PROVISIONAL(§{Paquetes}): esto vive en `ir` y no en `adaptadores` — El plan de
 * implementación pone `sonda · registro · los 12` en `adaptadores` y enumera `ir`
 * como «las seis formas · Tipo · Pista · Marca · cohesiónDe()». Pero esa
 * enumeración ya es incompleta: tampoco lista `Nodo`, `Cuerpo`, `Autoría` ni
 * `Unidad`, y los cuatro tienen que estar ahí. La línea de corte es DECLARACIÓN vs
 * IMPLEMENTACIÓN, no tramo: el argumento textual de §{Cómo se agrega}
 * («`adaptadores` lo emite y el fragmentador lo lee, y esos dos no se ven entre sí;
 * `ir` es el único lugar que ambos alcanzan») aplica palabra por palabra a
 * `Unidad`, `Contexto` y `Presupuesto`, que `ingesta` necesita para orquestar sin
 * importar `adaptadores`. En `adaptadores` quedan el constructor de sondas, el
 * registro, `seleccionar` y las doce implementaciones — Si se decide al revés, `ir`
 * no contiene el contrato completo y «`ir` se congela y se versiona primero»
 * (§{Paquetes}) deja de significar que el contrato está congelado.
 */

import {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  PARAMETERS as PARAMETROS,
} from "./params.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  AdapterId as AdaptadorId,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  MatterHash as HashMateria,
} from "./identity.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Classification as Clase,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  RecognitionLevel as NivelDeReconocimiento,
} from "./classification.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Body as Cuerpo,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  ObjectRef as RefObjeto,
} from "./shapes.js";
import type {
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  LocalLocation as UbicaciónLocal,
  // PENDING(bloque N): alias temporal, se borra cuando este archivo se traduzca
  Location as Ubicación,
} from "./location.js";
import type { Canal, NivelLogrado, NodoCrudo } from "./salidas.js";

// ─────────────────────────────── Evidencia ───────────────────────────────────

/**
 * La escala ordinal y cerrada del tramo 2 (§{Evidencia}).
 *
 * PROVISIONAL(#429): el ORDEN es el dato y los números se derivan de él — El plan
 * escribe seis constantes con valores (`Firma = 4 … Ninguna = -1`) y dos veces dice
 * «cinco clases nombradas» (§{Evidencia}, §{Tramo 2 › Decisiones}). Derivar los
 * números del orden del arreglo elimina la posibilidad de que la escala y los
 * valores diverjan, deja la escala enumerable en runtime, y da exactamente los
 * mismos números del plan (índice relativo a `Piso`) sin un solo literal numérico —
 * Si se decide al revés (enum con valores a mano), la relación ordinal queda
 * implícita en seis números sueltos.
 *
 * Tiene que ser NUMÉRICA: el selector hace aritmética (`y.e - x.e`) y comparación
 * de orden (`x.e > Evidencia.Ninguna`) sobre ella (§{El selector}).
 */
export const ESCALA_EVIDENCIA = [
  "Ninguna",
  "Piso",
  "Contenido",
  "Extensión",
  "Estructura",
  "Firma",
] as const;

export type NombreDeEvidencia = (typeof ESCALA_EVIDENCIA)[number];

const valorDeEvidencia = (n: NombreDeEvidencia): number =>
  ESCALA_EVIDENCIA.indexOf(n) - ESCALA_EVIDENCIA.indexOf("Piso");

/**
 * Las seis constantes, con los valores literales del plan: `Firma 4 · Estructura 3
 * · Extensión 2 · Contenido 1 · Piso 0 · Ninguna -1`.
 *
 * CRITERIO OPERATIVO, que el plan no da y sin el cual «quién gana un archivo
 * depende de cuál autor fue más modesto al elegir su constante» (auditoría H12).
 * `Estructura = 3` y `Contenido = 1` no tienen NINGÚN productor en todo el
 * documento, y `evidenciaDocx` —que abre el zip y busca `word/document.xml`, o sea
 * literalmente «estructura interna consistente con el formato»— devuelve `Firma`:
 *
 *  - `Firma`      una secuencia de bytes que NO PUEDE aparecer en otro formato.
 *  - `Estructura` un patrón estructural que SÍ PODRÍA aparecer en otro formato.
 *  - `Extensión`  solo el nombre, sin contradicción en los bytes.
 *  - `Contenido`  heurística estadística sobre el texto ya decodificado.
 *  - `Piso`       reservado al adaptador piso de texto. Ver `Selección`.
 *  - `Ninguna`    no aplica.
 */
/*
 * NOTA: `Evidencia` se declara dos veces a propósito — una como VALOR (el objeto de
 * constantes) y una como TIPO (`number`), que es el patrón idiomático para emular
 * un `enum` sin usar `enum`. Es UNA definición en dos espacios de declaración, no
 * dos definiciones. Se emula en vez de usar `enum` porque los seis valores se
 * DERIVAN del orden de `ESCALA_EVIDENCIA` y un `enum` obligaría a repetirlos.
 */
export const Evidencia = {
  Firma: valorDeEvidencia("Firma"),
  Estructura: valorDeEvidencia("Estructura"),
  Extensión: valorDeEvidencia("Extensión"),
  Contenido: valorDeEvidencia("Contenido"),
  Piso: valorDeEvidencia("Piso"),
  Ninguna: valorDeEvidencia("Ninguna"),
} as const;

export type Evidencia = number;

// ─────────────────────────────── Sonda ───────────────────────────────────────

/**
 * De dónde vino lo que se está sondeando.
 *
 * PROVISIONAL(#445): unión DISCRIMINADA en vez de
 * `'chat' | ... | AdaptadorId` (§{La sonda}) —
 * Si `AdaptadorId` es un `string`, la unión entera COLAPSA a `string` y los cuatro
 * literales no aportan nada al chequeo de tipos. Peor: el adaptador de chat tiene
 * `id: 'chat'` (§{Chat}), así que `porOrigen('chat', Evidencia.Firma)` (§{Chat}) no
 * distingue «vino del canal chat» de «lo delegó el adaptador chat» — Si se decide
 * al revés, la ambigüedad queda y `Canal` sigue con dos grafías.
 *
 * NOTA APARTE: `porOrigen` devolviendo `Evidencia.Firma` es un abuso del
 * vocabulario, porque `Firma` está definida como «firma inequívoca EN EL CONTENIDO»
 * (§{Evidencia}) y el origen no es contenido. O se lee `Firma` como «evidencia
 * inequívoca», o el sexto valor de la escala es incoherente. Lo dejo escrito, no lo
 * resuelvo.
 */
export type Origen =
  | { readonly clase: "canal"; readonly canal: Canal }
  | { readonly clase: "delegado"; readonly por: AdaptadorId };

/**
 * Los cinco datos escalares que se persisten en `documento_en_espera`
 * (§{Lo que queda}).
 */
export type SondaFría = {
  /**
   * PROVISIONAL(#430): normalizada — minúsculas, SIN punto, solo el último
   * segmento, `null` si no hay — Es el campo del que dependen todos los
   * evidenciadores de nivel `Extensión`, que es el que decide en ausencia de firma,
   * y hoy hay que decidirlo doce veces (con punto o sin, mayúsculas, compuestas
   * como `.tar.gz`). Las compuestas se resuelven en el evidenciador que las
   * necesite, no en la sonda — Si se decide al revés, doce adaptadores normalizan
   * distinto.
   */
  readonly extensión: string | null;
  /** Normalizado a minúsculas y sin parámetros. */
  readonly mimeDeclarado: string | null;
  /** Bytes del objeto REAL, no del declarado por el cliente (auditoría #38). */
  readonly tamaño: number;
  /**
   * PROVISIONAL(#430): PARAMETROS.recepción.bytesMágicos bytes, o MENOS si el
   * archivo es más corto — nunca rellenado, para que `tamaño` y
   * `bytesMágicos.length` no mientan. `empiezaCon` devuelve `false` sobre un buffer
   * más corto que la firma — Si se decide al revés (rellenar), una firma puede
   * matchear sobre padding.
   */
  readonly bytesMágicos: Uint8Array;
  /**
   * §{Lo que queda}. SIGUE SIN PRODUCTOR (auditoría #32): nada en el diseño
   * identifica formatos por nombre —`evidencia()` devuelve un ordinal y solo la
   * corren los adaptadores que existen, que por definición no existen para lo que
   * queda en espera—. Hace falta un catálogo de firmas paralelo al registro,
   * ausente del diseño y del grafo de paquetes. Sin él es siempre `null`, la rama
   * «Identificado» del mensaje al usuario NUNCA se ejecuta, y el roadmap se agrupa
   * por `null`.
   */
  readonly tipoDetectado: string | null;
};

/**
 * La sonda completa: la fría más el origen y los perezosos.
 *
 * PROVISIONAL(C7): UN SOLO tipo de sonda; la persistida se REHIDRATA y sus
 * perezosos SÍ van a almacenamiento — El plan afirma que al registrar un adaptador
 * nuevo «se corre solo su `evidencia()` contra las sondas guardadas — se recorre
 * una tabla chica, NO SE LEEN ARCHIVOS de almacenamiento» (§{Lo que queda}), y el
 * único evidenciador completo del documento hace `await s.entradasZip()`
 * (§{Evidencia}). O el barrido lee los objetos, o los cuatro adaptadores de zip
 * (`.docx`, `.xlsx`, `.pptx`, `.odt`, los de mayor demanda) devuelven `Ninguna`
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
 * resuelto — `Promise.all` (§{El selector}) dispara `entradasZip()` en los cuatro
 * adaptadores de zip SIMULTÁNEAMENTE: con memoización sobre el valor son cuatro
 * aperturas, sobre la promesa es una. La afirmación «el costo real es una sola
 * apertura parcial» (§{Los tres casos}) es verdadera bajo una y falsa bajo la otra
 * — Si se decide al revés, el plan afirma un costo que no tiene.
 *
 * PROVISIONAL(H9): la sonda de un ASSET DELEGADO la construye el adaptador PADRE,
 * junto con el asset — Es información que el padre tiene y nadie más: el asset es
 * `{ref, mime, pendientes}` y no tiene extensión, ni tamaño, ni bytes propios —
 * ESTO NO RESUELVE H9: mientras la región referencie el original sin materializar
 * (§{Dónde frena}), sus primeros 4 KB son los del PDF entero,
 * `esImagen(bytesMágicos)` da `Ninguna`, gana otra vez el adaptador de PDF, y el
 * ejemplo canónico del documento (contrato.pdf → pg3 → adaptador `imagen`,
 * §{La delegación es emergente}) NO FUNCIONA. Lo que falta —qué parte del original
 * es la región, a nivel de bytes— es lo que `RefObjeto.ventana` expresa; que el
 * constructor de sondas la use es decisión de `adaptadores`.
 */
export type Sonda = SondaFría & {
  readonly origen: Origen;
  entradasZip(): Promise<readonly string[]>;
  primerasLíneas(): Promise<readonly string[]>;
};

/**
 * §{Evidencia}, donde el tipo se usa como anotación y nunca se declara.
 *
 * PROVISIONAL(#9): SIEMPRE `Promise`, y quien lo llama CAPTURA — `seleccionar` usa
 * `Promise.all` (§{El selector}), que propaga el rechazo: un evidenciador roto no
 * devuelve `null`, TIRA, y hace fallar la selección de los doce, en un pipeline
 * donde «los archivos rotos son la norma, no la excepción»
 * (§{Los decodificadores}). Un evidenciador que lanza cuenta como `Ninguna` +
 * `Diagnóstico.aviso` — Si se decide al revés, un bug en un adaptador que ni
 * siquiera reclamaba el archivo decide el destino del archivo.
 */
export type Evidenciador = (sonda: Sonda) => Promise<Evidencia>;

/**
 * Lo que devuelve el selector.
 *
 * PROVISIONAL(#3): devuelve el PAR, no solo el adaptador — `seleccionar(sonda):
 * Promise<Adaptador | null>` (§{El selector}) descarta la evidencia ganadora, así
 * que el
 * llamador no puede distinguir «ganó un adaptador dedicado» de «cayó al piso de
 * texto» sin comparar `a.id === 'piso'` — ramificar sobre la identidad de un
 * adaptador desde la orquestación. Con el par, `nivelLogrado` («estructurado |
 * texto plano», §{Tramo 1 › El registro}), que es un campo declarado del tramo 1
 * sin productor (auditoría #2), se deriva de `evidencia > Piso` — Si se decide al
 * revés, el campo que «vuelve visible la degradación» no lo produce nadie, y el día
 * que haya dos pisos la comparación por id se rompe.
 *
 * PROVISIONAL(#429): `Piso` NO compite en el mismo `sort` que los dedicados — El
 * filtro literal es `x.e > Evidencia.Ninguna` (§{El selector}), así que `Piso = 0`
 * pasa y empata con un adaptador dedicado que devuelva `Piso`; con el desempate por
 * `id` (§{El selector}), quién gana lo decide el ORDEN ALFABÉTICO del nombre del
 * adaptador. Se elige entre los que superan `Piso`, y solo si no hay ninguno se cae
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
export type Selección = {
  readonly adaptador: AdaptadorOpaco;
  readonly evidencia: Evidencia;
  readonly nivelLogrado: NivelLogrado;
};

// ─────────────────────────────── Contexto ────────────────────────────────────

/** §{Diagnóstico}. El canal va en el contexto, NO en los retornos (§{Diagnóstico}). */
export interface Diagnóstico {
  /**
   * PROVISIONAL(§{Diagnóstico}): `ubicación` es OPCIONAL — El plan la hace
   * obligatoria y los tres productores más citados no la tienen: la discrepancia
   * extensión/contenido del tramo 2 se registra (§{Los tres casos}) antes de que
   * exista una `Ubicación`, el anclaje bajo del tramo 4 (§{Degradación}) es de
   * documento, y el presupuesto agotado (§{Diagnóstico}) es de corrida — Si se
   * decide al revés, hay que fabricar ubicaciones sintéticas o inventar un
   * centinela, que envejece igual de mal que un `null` disfrazado. (La variante
   * `{space:'source'}` de `Coordinate` cubre el caso «toda la fuente», pero no el
   * caso «ninguna fuente en particular».)
   *
   * PROVISIONAL(§{Diagnóstico}): `código` es ABIERTO, con prefijo por tramo — Es el
   * caso OPUESTO a `Tipo`: cerrarlo obliga a tocar el contrato cada vez que un
   * adaptador aprende a avisar de algo, y R3 no aplica porque un aviso no es
   * memoria.
   */
  aviso(código: string, ubicación: Ubicación | null, detalle?: string): void;
  degradado(de: NivelLogrado, a: NivelLogrado, razón: string): void;
}

/**
 * Lo REGISTRADO por `Diagnóstico`, que el plan nunca tipa.
 *
 * PROVISIONAL(§{Diagnóstico}): los dos métodos devuelven `void` y sin embargo el
 * estado `parcial` (§{Diagnóstico}), la métrica de degradación (§{Observabilidad})
 * y el invariante «ninguna información se descarta en silencio» (§{Invariantes})
 * dependen de LEER lo registrado — Sin estos tipos el sumidero no es tipable y el
 * invariante no es verificable.
 */
export type Aviso = {
  readonly código: string;
  readonly ubicación: Ubicación | null;
  readonly detalle: string | null;
};

export type Degradación = {
  readonly de: NivelLogrado;
  readonly a: NivelLogrado;
  readonly razón: string;
};

/** Las cinco dimensiones del presupuesto. Ver `PARAMETROS.presupuesto`. */
export type Presupuesto = {
  readonly msMáximo: number | null;
  readonly nodosMáximos: number | null;
  readonly bytesMaterializadosMáximos: number | null;
  readonly invocacionesMáximas: number | null;
  readonly expansionesMáximas: number | null;
};

/**
 * Qué se está gastando.
 *
 * PROVISIONAL(#7): `expansión` descuenta SIEMPRE, incluso en acierto de caché;
 * `invocación` no — «El presupuesto cuenta trabajo, no intentos: un acierto de
 * caché no descuenta, porque no cuesta» (§{Diagnóstico}, y el hallazgo 6 del banco,
 * §{Segunda}) es correcto para el COSTO y deja a la recursión sin medida
 * decreciente: el límite de profundidad se eliminó a propósito (§{Dónde frena},
 * §{Lo que se borró}) y ni el punto fijo ni la guarda de ciclo disparan sobre
 * assets distintos-pero-cacheados. El invariante «la recursión termina»
 * (§{Invariantes}) no se sigue de las reglas escritas — Separar los dos contadores
 * conserva LITERALMENTE la regla que el plan derivó de una medición y le devuelve a
 * la recursión una medida decreciente, sin reintroducir un contador de profundidad
 * — Si se decide al revés, el único límite que queda es `msMáximo`, que es
 * justamente el que la regla dice que no debería contar y el que rompe el
 * determinismo.
 */
export type ClaseDeGasto =
  | "ms"
  | "nodos"
  | "bytesMaterializados"
  | "invocación"
  | "expansión";

/** Cancelación mínima. `ir` no depende de la lib DOM. */
export interface SeñalDeCancelación {
  readonly abortada: boolean;
}

/**
 * El contexto de `descomponer` (§{Dos casilleros}), que el plan usa una vez y nunca
 * define.
 *
 * PROVISIONAL(H1): CAPABILITY OBJECT del núcleo, no un contexto flaco — Un contexto
 * de `{diagnóstico, presupuesto}` (que es lo que dice §{Diagnóstico}) deja que el
 * adaptador se autolimite y al núcleo sin poder impedir nada: el zip bomb depende
 * de que los doce autores se acuerden, que es el modo de falla que
 * §{Las tres reglas} declara inadmisible. Y no hay dónde poner la cadena de
 * ancestros de la guarda de ciclo (§{Dónde frena}), ni el diferido, ni la
 * producción del `RefObjeto` de un asset incrustado, que exige escribir bytes. Qué
 * se invente acá decide, textualmente (auditoría H1), «quién hace cumplir el
 * presupuesto y si `descomponer` puede escribir en almacenamiento» — Sí puede, pero
 * SOLO por `materializar`, para que la precondición de terminación de
 * §{Dónde frena} sea expresable como «no llamar a `materializar`, reusar la ref del
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
export interface Contexto {
  readonly diagnóstico: Diagnóstico;
  readonly límites: Presupuesto;
  /**
   * La cadena de hashes de ancestros que corta la recursión (§{Dónde frena}). De
   * solo lectura: la deriva el orquestador en cada nivel, y el `Contexto` de un
   * asset delegado es un HIJO del de su contenedor, no uno nuevo.
   */
  readonly ancestros: readonly HashMateria[];
  readonly profundidad: number;
  /**
   * PROVISIONAL(#6): campo NUEVO — `msMáximo` no es un tope real sin un mecanismo
   * de cancelación, y el plan no menciona ninguno.
   */
  readonly señal: SeñalDeCancelación;
  /**
   * `false` = presupuesto agotado. Difiere, nunca lanza
   * (§{Dónde frena}, §{Diagnóstico}).
   */
  gastar(clase: ClaseDeGasto, cantidad: number): boolean;
  /**
   * El ÚNICO punto donde se consulta el caché. Es lo que vuelve cierto «un acierto
   * de caché no descuenta» (§{Diagnóstico}): si cada adaptador invocara por su
   * cuenta, nadie podría saber si descontó o no.
   */
  invocar<T>(clave: string, trabajo: () => Promise<T>): Promise<T>;
  /**
   * Escribir bytes nuevos en almacenamiento direccionado por contenido. NO llamarla
   * es lo que hace cumplir la precondición de terminación (§{Dónde frena}).
   */
  materializar(bytes: Uint8Array, mime: string): Promise<RefObjeto>;
}

// ─────────────────────────────── Unidad ──────────────────────────────────────

/**
 * Un pedazo del documento tal como lo entrega `descomponer` (§{`descomponer`}). Dos
 * caras: las señales del formato, que MUEREN acá, y el cuerpo, que CRUZA el borde.
 *
 * PROVISIONAL(C25): las señales se leen SIEMPRE por `u.señales.X`, nunca aplanadas
 * sobre la unidad — El plan tiene los dos accesos a cuatro líneas de distancia, en
 * el punto donde dice que se hace cumplir «la clave de todo el diseño»
 * (§{`descomponer`}): `porProminencia` lee `u.pt` (§{`detectar`}) y `porStyleId`
 * lee `u.señales.styleId` (§{`detectar`}). `u.pt` es una ERRATA, no una alternativa
 * de diseño: contradice el tipo literal de §{`descomponer`}, contradice el párrafo
 * que lo justifica (§{`descomponer`}) y contradice el vocabulario (§{Vocabulario})
 * — Con las señales bajo su campo, «cero fugas de formato en el nodo»
 * (§{Invariantes}) es trivialmente cierto por construcción; con `Unidad<S> = S &
 * {cuerpo, ubicación}` cualquier señal llamada `cuerpo` colisiona y nada impide que
 * un consumidor aguas abajo lea una señal creyendo que es del núcleo — Si se decide
 * al revés, se destruye el invariante que el tipo existe para dar. `porProminencia`
 * pasa a leer `u.señales.pt`.
 *
 * PROVISIONAL(§{Chat}): lleva `UbicaciónLocal`, sin `adaptador` — Ver el
 * razonamiento en `UbicaciónLocal`. Con eso el ejemplo del chat del plan deja de
 * NECESITAR el campo `adaptador`.
 *
 * CORRECCIÓN: la versión anterior de esta línea decía que el ejemplo «vuelve a ser
 * correcto TAL COMO ESTÁ ESCRITO». Era FALSO, y verificable en segundos con el
 * compilador — que es exactamente el defecto que este paquete ya pagó tres veces.
 * Compilado contra `Adaptador`, el ejemplo tiene CUATRO defectos, no uno:
 *
 *   1. `id: 'chat'` no es asignable a `AdaptadorId`, que es un tipo marcado.
 *      Exige `asAdapterId('chat')`.
 *   2. `descomponer` es SÍNCRONO y el contrato pide `Promise<readonly Unidad<S>[]>`.
 *   3. `ubicación: { ancla }` no alcanza: `UbicaciónLocal` exige `coordenada`.
 *      La del chat es `{ espacio: 'fuente' }`.
 *   4. Faltan `nivel` y `versión`, miembros obligatorios de `Adaptador`.
 *
 * Sacarle `adaptador` a `UbicaciónLocal` era NECESARIO y no SUFICIENTE. El ejemplo
 * sigue siendo diez líneas —la tesis del plan se sostiene— pero son otras diez.
 *
 * PROVISIONAL(#C21): NO lleva marcador de delegación — El adaptador delegado no
 * sabe que fue delegado. Va en `NodoCrudo.delegación`, puesto por el orquestador.
 *
 * PROVISIONAL(#22): NO lleva `Autoría`, con UNA excepción opcional — El chat la
 * necesita de verdad (cada mensaje tiene su autor, §{Chat}) y ningún otro
 * adaptador. Ponerla obligatoria mete un timestamp en la salida de `descomponer` de
 * los otros once y rompe el determinismo byte-idéntico y el caché entre
 * organizaciones — Si se decide al revés (obligatoria), C8 y #22 quedan sin
 * arreglo.
 */
export type Unidad<S> = {
  /** Específico del formato — MUERE acá. */
  readonly señales: S;
  /** Una de las seis formas — CRUZA el borde. */
  readonly cuerpo: Cuerpo;
  readonly ubicación: UbicaciónLocal;
  /** Solo donde varía genuinamente dentro de un documento: chat, `.eml`, hilos. */
  readonly autoríaPropia?: { readonly actor: string; readonly cuándo: string };
};

/**
 * De dónde salen los bytes.
 *
 * PROVISIONAL(C9/#8): `descomponer` recibe una `Fuente`, no un `Uint8Array` — El
 * literal de §{Dos casilleros} obliga a cargar el archivo entero en memoria antes
 * de empezar, y choca con tres cosas del propio plan: el tramo 2 se diseñó ENTERO
 * para decidir «sin haber leído el archivo entero» (§{Tramo 2}); `bytesMáximos`
 * sugiere que los bytes se contabilizan MIENTRAS se procesa; y los casos que el
 * plan declara esperables —zip bomb, PDF de 800 páginas, columna de un millón de
 * filas (§{Diagnóstico})— son exactamente aquellos donde materializar ES el
 * problema. Con `rango()` además el `.docx` de 200 MB puede leer el directorio
 * central del zip, que vive al final, con un range-request (auditoría #433) — ES LA
 * DESVIACIÓN MÁS GRANDE DE ESTE ARCHIVO Y MERECE REVISIÓN HUMANA: el plan escribió
 * `Uint8Array` a propósito, para que el borde fuera obvio — Si se decide al revés,
 * el tope de tamaño de archivo (que no tiene valor) pasa a ser la única protección
 * de memoria del sistema.
 */
export interface Fuente {
  readonly tamaño: number;
  bytes(): Promise<Uint8Array>;
  /**
   * `[desde, hasta)` — MEDIA ABIERTA, en BYTES. Misma convención que
   * `Coordinate.text` (`location.ts`), que ya la fija en `[start, end)` para
   * code points. `rango(0, 4)` devuelve 4 bytes: 0, 1, 2 y 3.
   *
   * Esta línea existe porque sin ella la convención se reparte entre doce autores
   * sobre nada. Y el modo de falla es SILENCIOSO: un autor que asuma `[desde,
   * hasta]` y recorra un archivo de 10 bytes de a 4 llama `rango(0,3)`,
   * `rango(4,7)`, `rango(8,9)` esperando 4+4+2; contra esta implementación recibe
   * 3+3+1 = **7 de 10 bytes**, perdiendo el 3, el 7 y el 9. No hay excepción, no
   * hay aviso: el documento entra al pipeline con agujeros.
   */
  rango(desde: number, hasta: number): Promise<Uint8Array>;
  stream(): AsyncIterable<Uint8Array>;
}

// ─────────────────────────────── Adaptador ───────────────────────────────────

/**
 * Un eslabón de una cascada de clasificación (§{La única}), que el plan usa como el
 * parámetro sin tipo `cs` de una arrow function.
 *
 * PROVISIONAL(#61/C19): lleva `nombre` y `nivel`, no `certeza` — `nivel` porque con
 * dos valores de certeza `rango()` no puede ordenar posicional antes que perceptual
 * y quedan empatados, decidiendo el orden del autor, que es justo lo que el
 * reordenamiento existe para evitar (§{La única}). `nombre` porque `enCascada`
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
export type Eslabón<S> = {
  readonly nombre: string;
  readonly nivel: NivelDeReconocimiento;
  readonly confianza?: number;
  detectar(unidades: readonly Unidad<S>[]): (u: Unidad<S>) => Clase | null;
};

/**
 * Los DOS casilleros (§{Dos casilleros}). Un adaptador no tiene lógica propia: es
 * una declaración de qué implementación va en cada uno.
 *
 * PROVISIONAL(C9): la ENTRADA es un parámetro de tipo — El contrato declara
 * `descomponer(bytes, ctx)` (§{Dos casilleros}) y el único adaptador escrito
 * entero, `chat`, declara `descomponer(msg)` (§{Chat}): objeto tipado, síncrono y
 * sin `ctx`. Los tres desajustes son de tipo, no de estilo: tal como está escrito
 * el ejemplo de §{Chat} NO ES ASIGNABLE a `Adaptador<S>` en ninguna lectura.
 * Parametrizar la entrada es lo único que no le cuesta nada al resto del pipeline y
 * lo único compatible con «la cintura no tiene forma de documento» (paso 5 del
 * orden de construcción, §{Orden}) — Si se decide al revés (serializar el chat a
 * bytes canónicos), hay que inventar ese formato canónico, que entra en
 * `hashBytes`, en la clave del caché y en el dedupe de blobs, y las «diez líneas»
 * de §{Chat} dejan de ser diez.
 *
 * PROVISIONAL(C10): el retorno sigue siendo `Promise<readonly Unidad<S>[]>`, el
 * arreglo completo — Contradice «se puede emitir en streaming sin materializar el
 * documento en memoria» (§{2 · Emisor}), pero cambiarlo a `AsyncIterable` arrastra
 * a `detectar`, que es una factory que RECIBE EL CORPUS COMPLETO por diseño
 * (§{`detectar`}, «la respuesta es relativa al documento»), y no hay decisión
 * escrita que lo respalde. El streaming es una propiedad del EMISOR, después de que
 * el tramo 3 materializó todo — Lo declaro NO SOPORTADO por el contrato v1, en vez
 * de fingir que funciona.
 *
 * PROVISIONAL(#448): el corpus que recibe `detectar` sobre un subárbol delegado es
 * la salida de `descomponer` DE ESA INVOCACIÓN, o sea la página, no el documento
 * contenedor — Es la única que tipa (`Unidad<S>[]` con un solo `S`) y la única
 * consistente con que el subárbol «abre un scope propio» y «no participa de la
 * escala de niveles del documento padre» (§{2 · Emisor}) — HUECO DE CALIDAD
 * CONOCIDO: con la página, la moda de `porProminencia` se calcula sobre pocas
 * regiones y cualquier bloque parece título.
 *
 * PROVISIONAL(#25/C20): `versión` cubre el ADAPTADOR ENTERO, `descomponer`
 * incluido, y no solo el clasificador — El plan la llama `versiónDelClasificador` y
 * la mete en la clave del caché (§{Caché}) sin que sea miembro de `Adaptador`. Con
 * ese nombre, arreglar un bug de decodificación no cambia ningún componente de la
 * clave y el caché sirve árboles CORRUPTOS PARA SIEMPRE (C20) — el bug silencioso
 * que la clave existe para prevenir, movido un casillero. Es una desviación
 * deliberada del literal de §{Caché} — Si se decide al revés, C20 queda sin
 * arreglo. La granularidad por eslabón (un `.docx` usa `porStyleId` y
 * `porProminencia`, que evolucionan por separado) se compone desde las versiones de
 * los eslabones más la propia.
 */
export interface Adaptador<S, E = Fuente> {
  readonly id: AdaptadorId;
  /** El escalón de la escalera en el que trabaja. Alimenta `certezaDeNivel`. */
  readonly nivel: NivelDeReconocimiento;
  readonly versión: string;
  evidencia(sonda: Sonda): Promise<Evidencia>;
  descomponer(entrada: E, ctx: Contexto): Promise<readonly Unidad<S>[]>;
  detectar(unidades: readonly Unidad<S>[]): (u: Unidad<S>) => Clase | null;
}

/**
 * El adaptador con `S` y `E` BORRADOS, que es lo que guarda el registro y lo que
 * devuelve `seleccionar`.
 *
 * PROVISIONAL(§{El selector}): dos tipos, no uno — `Adaptador` se declara genérico
 * en `S` (§{Dos casilleros}) y se usa SIN argumento en la firma del selector
 * (§{El selector}), y el registro es una colección heterogénea: el `S` de `.docx`
 * (con `styleId`) y el del chat (`{}`, §{Chat}) son distintos. Peor: `S` aparece a
 * la vez en posición de retorno (`descomponer`) y de parámetro (`detectar`), así
 * que `Adaptador<S>` es INVARIANTE en `S` y no existe supertipo común no trivial.
 * Con `Adaptador<unknown>` el registro no compila; con `Adaptador<any>` compila y
 * se pierde toda la seguridad que la cara de señales existe para dar — Si se decide
 * al revés, el borde de señales queda sostenido por convención, que es el modo de
 * falla que R1 elimina.
 *
 * PROVISIONAL(C8): `reconocer` es la COMPOSICIÓN de los dos casilleros, no un
 * tercer casillero — §{El determinismo} lo usa (`a.reconocer(f) ≡ a.reconocer(f)`)
 * y no es miembro de nada. Es exactamente: aplicar `descomponer`, aplicar
 * `detectar`, y donde `detectar` se abstuvo aplicar `tipoDesdeCuerpo` con la
 * certeza del nivel (§{El piso}). Los casilleros siguen siendo DOS
 * (§{Tramo 3 › Decisiones}) — El determinismo de §{El determinismo} se verifica
 * sobre esta composición, y CON `msMáximo` EN `null`: con un tope de tiempo de
 * pared el conjunto de nodos depende de la velocidad de la máquina y ningún
 * adaptador pasa el test.
 */
export interface AdaptadorOpaco {
  readonly id: AdaptadorId;
  readonly nivel: NivelDeReconocimiento;
  readonly versión: string;
  evidencia(sonda: Sonda): Promise<Evidencia>;
  /**
   * PROVISIONAL(C9): `unknown` DELIBERADO, Y NO ESTÁ CONFINADO — Es el `E` borrado.
   * El registro es heterogéneo por construcción (un `.docx` recibe una `Fuente`, el
   * chat recibe un mensaje) y no hay tipo común.
   *
   * CORRECCIÓN: la versión anterior decía «el cast queda confinado a UN solo punto
   * del sistema: la fábrica que construye el adaptador opaco». Las dos mitades son
   * falsas. Esa fábrica NO EXISTE. Y el agujero no estaría en ella aunque
   * existiera: `unknown` en posición de PARÁMETRO no chequea nada. Verificado con
   * el compilador — `reconocer(42, ctx)`, `reconocer(null, ctx)`, una función, o el
   * mensaje de chat pasado al adaptador de `.docx`: las cuatro compilan sin un
   * error. El agujero está en CADA SITIO DE LLAMADA.
   *
   * POR QUÉ SIGUE ACÁ, y no es pereza. Ligar la entrada en `Selección` lo cierra y
   * ROMPE EL GATE DE CI: «un adaptador que no pasa el property test no entra al
   * registro», y a una `Selección` solo se llega desde `seleccionar`, que itera el
   * registro. El test pasaría a ejercitar un sosías construido por el arnés en vez
   * del artefacto que el registro guarda — y sobre ese gate descansa toda la
   * validez del caché. Queda declarado como hueco (P14), no disfrazado de garantía.
   */
  reconocer(entrada: unknown, ctx: Contexto): Promise<readonly NodoCrudo[]>;
}

/** El tamaño de la ventana de la sonda, para quien la construya. */
export const BYTES_MAGICOS = PARAMETROS.intake.magicBytes;
