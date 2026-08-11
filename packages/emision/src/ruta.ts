/**
 * Pieza 1 del tramo 4 — «Ruta: de dónde cuelga cada nodo» (§{1 · Ruta}).
 *
 * Cada pista se convierte en un CAMINO DESDE LA RAÍZ: la lista de contenedores
 * abiertos por encima del nodo. NO se incluye a sí mismo — dice de dónde cuelga,
 * no quién es (§{1 · Ruta}).
 *
 *     ninguna    []
 *     celda      [hoja, región, fila]   — la planilla ya ES un camino
 *     nivel      la pila de títulos abiertos a esa profundidad
 *     padre      caminar la cadena de padres
 *     espacial   derivar contención geométrica y caminar como `padre`
 *
 * «`espacial` no es una sexta forma de armar árboles: la contención ES una
 * relación de padre, solo que calculada con geometría en vez de leída. Reusa el
 * caminador de `padre` entero» (§{1 · Ruta}). Acá eso es literal: las dos vías
 * terminan en `desdeContenedor`.
 *
 * ANTES eran cinco estrategias que construían CINCO ÁRBOLES por caminos distintos.
 * Acá solo calculan rutas; el árbol lo arma el emisor una sola vez (§{1 · Ruta}).
 *
 * El «caminador» de `padre` no camina: cada nodo ya emitido dejó registrada SU
 * ruta, así que la del hijo es `ruta(padre) ++ [scope(padre)]` — una lectura, no
 * un recorrido. Eso no es una optimización, es lo que vuelve INEXPRESABLE un
 * ciclo: un padre tiene que haber sido emitido antes para poder ser encontrado,
 * y una cadena que solo mira hacia atrás no puede cerrarse sobre sí misma.
 */

import {
  PARAMETROS,
  cajaContiene,
  comoLocalId,
  concatenar,
  esLead,
  renderizar,
  type Caja,
  type LocalId,
  type MigaLocal,
  type Nodo,
  type Pista,
} from "@savia-os/ir";

const { cero: CERO, uno: UNO } = PARAMETROS.aritmética;

// ─────────────────────────────── Scope ───────────────────────────────────────

/**
 * Un contenedor abierto durante el recorrido.
 *
 * LAS DOS CLASES SON LA IMPLEMENTACIÓN DE H5, no una aserción sobre ella. El emisor
 * «asigna un `LocalId` a todo nodo Y a todo scope, incluidos los sintéticos que no
 * son nodo» (PROVISIONAL(#66)/H5 en `ir/src/identidad.ts`), y los hijos de un scope
 * sintético «reciben como padre el primer ancestro que SÍ es nodo emitido». Con la
 * unión, un scope sintético NO TIENE de dónde sacar un `padreLocal` ni una `miga`:
 * los campos no existen en esa variante. La regla no se puede olvidar porque no se
 * puede escribir de otro modo.
 *
 * Por qué el sintético igual lleva `local`: lo pide el contrato —PROVISIONAL(#66)
 * dice «un `LocalId` a todo nodo Y a todo scope, incluidos los sintéticos»— y hoy
 * lo lee `nivelDe`, que consulta el `local` de CUALQUIER scope de la pila. De ahí
 * que los tres espacios de `LocalId` estén separados por prefijo: si un scope
 * sintético pudiera colisionar con el de un título, heredaría su nivel y la escala
 * de la pila se correría sola.
 */
export type Scope =
  | {
      readonly clase: "nodo";
      readonly local: LocalId;
      /** No-null ⟺ el nodo que lo abrió es `lead`. Las migas son solo estos. */
      readonly miga: MigaLocal | null;
    }
  | { readonly clase: "sintetico"; readonly local: LocalId };

/** Un camino desde la raíz. Nunca contiene al nodo que lo tiene. */
export type Ruta = readonly Scope[];

// El espacio de `LocalId` de una corrida se parte en tres para que un id de nodo,
// uno de scope sintético y uno de adaptador no puedan confundirse por accidente.
// `concatenar` (prefijo de longitud) hace que las claves sintéticas sean
// inyectivas: `hoja="a", región="bc"` y `hoja="ab", región="c"` no colisionan.
const PREFIJO_DE_NODO = "n";
const PREFIJO_SINTETICO = "s";

/** El `LocalId` del nodo en la posición `i` de la secuencia. Determinístico. */
export const localDeNodo = (i: number): LocalId =>
  comoLocalId(concatenar(PREFIJO_DE_NODO, String(i)));

const sintético = (clave: string): Scope => ({
  clase: "sintetico",
  local: comoLocalId(concatenar(PREFIJO_SINTETICO, clave)),
});

// ─────────────────────────────── Estado ──────────────────────────────────────

/** Un nodo ya emitido, visto como posible contenedor de los que siguen. */
type Contenedor = {
  readonly ruta: Ruta;
  readonly scope: Scope;
};

/**
 * Todo lo que el recorrido lleva en la mano. Es MUTABLE a propósito: el tramo
 * declara UN SOLO recorrido (§{2 · Emisor}), y un estado inmutable obligaría a copiar la
 * pila por nodo, que es el costo que «microsegundos por nodo» (§{Tramo 4 › Costo}) no admite.
 */
export type Estado = {
  /**
   * LA PILA. «El árbol nunca existe como estructura: es la pila durante el
   * recorrido» (§{2 · Emisor}). Después de cada nodo vale la RUTA VIGENTE: lo que
   * hereda el que abstiene.
   */
  pila: Scope[];
  /**
   * Piso impuesto por el marco de delegación vigente. Un subárbol delegado «abre
   * su propio scope y no participa de la escala de niveles del documento padre»
   * (§{2 · Emisor}): nada por debajo de este índice se cierra desde adentro, y la
   * raíz de `ninguna` y de `celda` es este piso, no el 0 absoluto.
   */
  piso: number;
  /** El nivel con el que se abrió cada scope de vía `nivel`. Solo esos. */
  readonly nivelDe: Map<LocalId, number>;
  /** `pista.id` (espacio del ADAPTADOR) → el nodo ya emitido que lo declaró. */
  readonly porIdDeAdaptador: Map<LocalId, Contenedor>;
  /** Nodos ya emitidos con caja, en orden de emisión. Para la vía `espacial`. */
  readonly cajas: (Contenedor & { readonly caja: Caja })[];
};

export const crearEstado = (): Estado => ({
  pila: [],
  piso: CERO,
  nivelDe: new Map(),
  porIdDeAdaptador: new Map(),
  cajas: [],
});

// ─────────────────────────────── Ruteo ───────────────────────────────────────

/**
 * Por qué el fallo es un OBJETO y no un `null` ni una excepción: `Ruta` es
 * `readonly Scope[]` y `[]` es una ruta legítima —la raíz—, así que devolver `[]`
 * ante un padre inexistente haría que «referencia rota» y «cuelga de la raíz»
 * codifiquen a lo mismo. Un objeto de error no es asignable a `Ruta`.
 *
 * PENDIENTE(#46): la política ante referencias COLGANTES, ADELANTADAS o CÍCLICAS.
 * `ir/src/clasificacion.ts:138` la declara «pendiente del tramo 4», o sea de acá, y
 * el plan no la menciona. Elijo lo mínimo: el emisor CORTA. No degrada a raíz
 * porque eso es exactamente la colisión de arriba, y no la ignora porque un padre
 * adelantado rompería el invariante «todo `padreLocal` fue emitido antes», que es
 * lo que hace acíclico al grafo. Lo que falta medir para cerrarlo: con qué
 * frecuencia los adaptadores reales producen la referencia rota — si es nunca,
 * cortar es correcto; si es rutina, hay que elegir entre raíz-con-aviso y
 * descartar el nodo, y las dos exigen un canal de diagnóstico que este paso no
 * tiene.
 */
export type FallaDeRuta = {
  readonly clase: "padre-no-emitido";
  readonly padre: LocalId;
};

export type Ruteo =
  | {
      readonly ok: true;
      readonly ruta: Ruta;
      /**
       * No-null ⟺ el nodo ABRE SU PROPIO SCOPE, y trae el nivel ya resuelto con
       * el que hay que registrarlo. Un solo campo para las dos cosas porque son
       * la misma: lo único que abre scope por sí mismo es un título de vía
       * `nivel`, y lo único que hace falta saber de él después es su nivel.
       */
      readonly abre: { readonly nivel: number } | null;
    }
  | { readonly ok: false; readonly falla: FallaDeRuta };

/** La raíz VIGENTE: el fondo del marco de delegación, no el fondo absoluto. */
const raíz = (estado: Estado): Ruta => estado.pila.slice(CERO, estado.piso);

/** `ruta(padre) ++ [scope(padre)]`. El caminador que `espacial` reusa entero. */
const desdeContenedor = (c: Contenedor): Ruta => [...c.ruta, c.scope];

/** El nivel del título abierto MÁS PROFUNDO dentro del marco vigente. */
const nivelDelTope = (estado: Estado, pila: Ruta): number => {
  for (let i = pila.length - UNO; i >= estado.piso; i -= UNO) {
    const s = pila[i];
    if (s === undefined) continue;
    const n = estado.nivelDe.get(s.local);
    if (n !== undefined) return n;
  }
  return CERO;
};

/**
 * «La pila de títulos abiertos a esa profundidad» (§{1 · Ruta}).
 *
 * PROVISIONAL(#44) de `ir`: `nivel: null` = «es un título pero no se pudo determinar
 * su nivel», y acá se lee como el nivel abierto más profundo + 1, que es lo que
 * ese PROVISIONAL declara.
 *
 * Los SALTOS (h1 → h3, que `porProminencia` produce por construcción) «son legales
 * y el emisor los normaliza»: normalizar es no inventar niveles intermedios — se
 * cierra lo que está a este nivel o más profundo y se cuelga de lo que quedó. Un
 * h3 después de un h1 cuelga del h1, sin un h2 fantasma en el medio.
 */
const porNivel = (estado: Estado, declarado: number | null): { ruta: Ruta; nivel: number } => {
  const abierta = [...estado.pila];
  const nivel = declarado ?? nivelDelTope(estado, abierta) + UNO;
  while (abierta.length > estado.piso) {
    const tope = abierta[abierta.length - UNO];
    if (tope === undefined) break;
    const suyo = estado.nivelDe.get(tope.local);
    // Un scope que no es de vía `nivel` no participa de esta escala y la frena.
    if (suyo === undefined || suyo < nivel) break;
    abierta.pop();
  }
  return { ruta: abierta, nivel };
};

/**
 * Ninguno de los tres scopes es un nodo: es el caso canónico de H5.
 *
 * HALLAZGO DEL BANCO DE MUTACIÓN, ANOTADO Y NO TAPADO: si se borra el componente
 * `fila` —dos filas distintas colapsando en el mismo scope— NINGÚN invariante de
 * este paso se entera, y no por falta de invariantes. Cuando los tres scopes son
 * sintéticos, H5 hace que el padre sea el primer ancestro que SÍ es nodo, así que
 * la profundidad de la parte sintética no llega a la salida: ni a `padreLocal`, ni
 * a `migas`, ni a `hash`. La ruta de `celda` es, en el paso 2, INOBSERVABLE.
 *
 * NO se borra por eso. Lo que borré cuando el banco lo declaró muerto fue código
 * mío que era un no-op ARITMÉTICO (ver el comentario del recorrido en `emisor.ts`);
 * esto es un dato que el plan especifica (§{1 · Ruta}) y que tiene consumidores
 * declarados aguas abajo — el tramo 5 agrupa por container y el reconciliador
 * necesita saber qué celdas eran la misma fila. Borrarlo sería decidir por ellos
 * desde el único tramo que no lo mira.
 */
const porCelda = (estado: Estado, p: Extract<Pista, { via: "celda" }>): Ruta => [
  ...raíz(estado),
  sintético(concatenar("hoja", p.hoja)),
  sintético(concatenar("region", p.hoja, p.región)),
  sintético(concatenar("fila", p.hoja, p.región, String(p.fila))),
];

const área = (c: Caja): number => c.ancho * c.alto;

/**
 * El contenedor geométrico MÁS INTERNO, con desempate total: primero el de ruta
 * más larga (el más profundo del árbol que ya se armó), después el de área menor,
 * y por último el emitido más tarde. Sin la tercera regla, dos cajas idénticas
 * superpuestas harían depender la salida del orden de iteración de un `Set`, y el
 * recorrido dejaría de ser determinístico sin que nada se pusiera rojo.
 */
const másInterno = (a: Contenedor & { caja: Caja }, b: Contenedor & { caja: Caja }): boolean =>
  a.ruta.length !== b.ruta.length ? a.ruta.length > b.ruta.length : área(a.caja) <= área(b.caja);

const porEspacial = (estado: Estado, caja: Caja): Ruta => {
  let mejor: (Contenedor & { caja: Caja }) | null = null;
  for (const cand of estado.cajas) {
    if (!cajaContiene(cand.caja, caja)) continue;
    if (mejor === null || másInterno(cand, mejor)) mejor = cand;
  }
  return mejor === null ? raíz(estado) : desdeContenedor(mejor);
};

/**
 * Las cinco pistas, más la abstención. TOTAL: no hay pista sin ruta.
 *
 * La abstención (`pista === null`) NO es `{via:'ninguna'}` — ver PROVISIONAL(#43) en
 * `ir/src/clasificacion.ts`. `null` = «no modifica la ruta»: hereda la pila
 * vigente, que es la que muestra el ejemplo canónico (§{1 · Ruta}: un párrafo con
 * pista «—» y ruta `[Contrato, Cláusula primera]`). `{via:'ninguna'}` = «raíz», y
 * con ambos significando lo mismo el árbol de todo DOCX colapsa.
 */
export const rutaDe = (estado: Estado, pista: Pista | null): Ruteo => {
  if (pista === null) return { ok: true, ruta: [...estado.pila], abre: null };
  switch (pista.via) {
    case "ninguna":
      return { ok: true, ruta: raíz(estado), abre: null };
    case "nivel": {
      const { ruta, nivel } = porNivel(estado, pista.nivel);
      return { ok: true, ruta, abre: { nivel } };
    }
    case "celda":
      return { ok: true, ruta: porCelda(estado, pista), abre: null };
    case "padre": {
      if (pista.padre === null) return { ok: true, ruta: raíz(estado), abre: null };
      const padre = estado.porIdDeAdaptador.get(pista.padre);
      if (padre === undefined) {
        return { ok: false, falla: { clase: "padre-no-emitido", padre: pista.padre } };
      }
      return { ok: true, ruta: desdeContenedor(padre), abre: null };
    }
    case "espacial":
      return { ok: true, ruta: porEspacial(estado, pista.caja), abre: null };
  }
};

// ─────────────────────────────── Miga ────────────────────────────────────────

/**
 * «Ahí la cohesión `lead` se gana el sueldo dos veces: marca dónde abre un chunk Y
 * qué títulos están abiertos. No hay una segunda estructura para las migas»
 * (§{2 · Emisor}). Esta función es todo lo que el emisor sabe sobre migas: el resto
 * lo hace la misma pila.
 *
 * `esLead` viene de `ir` y no se replica: ramificar sobre `tipo` fuera de `ir`
 * violaría R2 — ver PROVISIONAL(C1) en `ir/src/clasificacion.ts`.
 *
 * PENDIENTE(#50): la normalización del texto de la miga sigue abierta en `ir`
 * (`Miga`, `salidas.ts`). Acá se aplica lo único que `ir` ya declara —el truncado
 * por `PARAMETROS.agrupación.largoMáximoDeMiga`, que hoy es `null`, o sea sin
 * truncar— y no se inventa ninguna regla más: ese string entra en
 * `HuellaContextual`, así que una normalización inventada acá movería huellas de
 * fragmento en cuanto se decida la de verdad.
 */
export const migaDe = (nodo: Nodo, local: LocalId): MigaLocal | null => {
  if (!esLead(nodo.tipo, nodo.cuerpo.forma)) return null;
  // `null` heredaría el esquema de un container; un título no tiene esquema.
  const texto = renderizar(nodo.cuerpo, null);
  // Un `lead` sin texto legible (un `asset`) no puede ser miga de nada.
  if (texto === null) return null;
  const tope = PARAMETROS.agrupación.largoMáximoDeMiga;
  return { ref: local, texto: tope === null ? texto : texto.slice(CERO, tope) };
};
