/**
 * Clasificación — `Tipo`, `Certeza`, `Pista`, `Cohesión` y las tres tablas.
 *
 * R2 (§{R2}): `tipo` es un conjunto cerrado de HECHOS DE LECTURA. Viaja como
 * metadato —sirve para mostrar, filtrar y explicar— y **solo las formas admiten
 * `switch`**. Este archivo es el único sitio legítimo del sistema donde se
 * conmuta sobre `Tipo`: las tres tablas de abajo.
 */

import { FORMAS, type Cuerpo, type Forma } from "./formas.js";
import type { Caja } from "./ubicacion.js";
import type { LocalId } from "./identidad.js";

// ─────────────────────────────── Tipo ────────────────────────────────────────

/**
 * Los 15 valores, en el orden y con la grafía literal de §{Por qué `tipo`}.
 *
 * PROVISIONAL(P1): los LITERALES van en español y SIN tilde (`parrafo`, `codigo`,
 * `epigrafe`) mientras los nombres exportados van CON tilde (`cohesiónDe`,
 * `COHESIÓN`, `Cohesión`, `Ubicación`) — Es una asimetría real del plan, no un
 * descuido de transcripción, y la conservo para que cualquiera pueda cotejar cada
 * símbolo contra su línea del borrador. P1 declara pendiente el pasaje a inglés y
 * hay que resolverlo en una pasada dedicada, con bump de versión mayor de `ir`, no
 * de contrabando — Si se decide al revés (traducir ahora), ninguna cita de línea
 * del plan verifica y el rename posterior toca el contrato del que depende todo.
 *
 * NUEVE de los quince no tienen productor en ningún adaptador del registro
 * (`subtitulo`, `cita`, `lista_ordenada`, `formula`, `epigrafe`, `nota_al_pie`,
 * `encabezado`, `pie` — auditoría #57). Entran igual al conjunto, pero DOS
 * mecanismos del plan dependen de tipos que hoy nadie emite: el orden de cola por
 * mobiliario (§{El costo}, que necesita `encabezado`/`pie`) y la mitad de la tabla
 * de cohesión (que necesita `epigrafe`/`nota_al_pie`).
 */
export const TIPOS = [
  "titulo",
  "subtitulo",
  "parrafo",
  "cita",
  "lista",
  "lista_ordenada",
  "tabla",
  "campos",
  "codigo",
  "formula",
  "imagen",
  "epigrafe",
  "nota_al_pie",
  "encabezado",
  "pie",
] as const;

export type Tipo = (typeof TIPOS)[number];

// ─────────────────────────────── Certeza ─────────────────────────────────────

/**
 * Los dos valores literales de §{Tramo 3 › Qué sale}. `'mixto'` fue eliminado
 * (§{Lo que se borró}).
 */
export const CERTEZAS = ["declarado", "inferido"] as const;
export type Certeza = (typeof CERTEZAS)[number];

/**
 * El nivel de la escalera de degradación (§{La escalera}).
 *
 * PROVISIONAL(C18/C19): tipo NUEVO — `Certeza` queda EXACTAMENTE como está escrita
 * (dos valores) y el orden lo da este otro tipo — Sin él pasan tres cosas, todas
 * declaradas por el plan y ninguna implementable: (1) `enCascada` ordena con
 * `rango(a.certeza) - rango(b.certeza)` (§{La única}) y con dos valores posicional
 * y perceptual EMPATAN, así que decide el orden del autor, que es justo lo que el
 * reordenamiento existe para evitar («el invariante se cumple por construcción, no
 * por revisión», §{La única}); (2) el piso físico estampa `'declarado'` con el
 * argumento de que «la forma se leyó del formato» (§{El piso}), pero para una
 * página escaneada la forma la produjo un modelo de layout
 * (§{Tramo 3 › El registro}), o sea que la certeza «que viaja hasta la skill»
 * miente en el único lugar donde el plan admite un modelo (C18); (3) la métrica de
 * atribución, que el plan llama «el indicador de salud de toda la capa de
 * reconocimiento» (§{Observabilidad}), es indistinguible con solo `certeza`, porque
 * prominencia, geometría y modelo son los tres `inferido` — Si se decide al revés
 * (ampliar `Certeza` a tres o cuatro valores), se rompe el literal de
 * §{Tramo 3 › Qué sale} y el invariante «certeza válida» del banco
 * (§{Invariantes}), que nadie revisó.
 */
export const NIVELES_DE_RECONOCIMIENTO = [
  "declarativo",
  "fisico",
  "posicional",
  "perceptual",
] as const;

export type NivelDeReconocimiento = (typeof NIVELES_DE_RECONOCIMIENTO)[number];

/**
 * `rango()` — la función que `enCascada` usa para reordenar (§{La única}).
 * Opera sobre el NIVEL, no sobre la certeza, que es lo que la vuelve un orden
 * total: declarativo < fisico < posicional < perceptual.
 */
export const rango = (nivel: NivelDeReconocimiento): number =>
  NIVELES_DE_RECONOCIMIENTO.indexOf(nivel);

/**
 * La certeza que corresponde a un nivel.
 *
 * PROVISIONAL(C18): `ir` NO exporta una constante `CERTEZA_DEL_PISO = 'declarado'`;
 * exporta esta función — El piso físico produce `declarado` cuando la forma se leyó
 * del formato y `inferido` cuando la produjo un modelo. Es un cambio de una línea
 * de prosa del plan (§{El piso}) y evita que el único mecanismo que el documento
 * promete a las skills («no citar como autoridad lo de confianza baja»,
 * §{La escalera}) quede desactivado precisamente para las páginas escaneadas — Si
 * se decide al revés (constante), la certeza miente donde más importa.
 */
export const certezaDeNivel = (nivel: NivelDeReconocimiento): Certeza =>
  nivel === "declarativo" || nivel === "fisico" ? "declarado" : "inferido";

// ─────────────────────────────── Pista ───────────────────────────────────────

export const VIAS = ["padre", "nivel", "celda", "espacial", "ninguna"] as const;
export type Via = (typeof VIAS)[number];

/**
 * El único dato estructural que produce el tramo 3 (§{La pista}). Lleva jerarquía y
 * nada más: `columna` y `z` se fueron a `Ubicación` (§{La pista}) y no vuelven.
 *
 * PROVISIONAL(C21): la frontera de delegación NO viaja en la pista — El emisor
 * ramifica sobre «si BAJÓ / si SUBIÓ de un subárbol delegado» (§{2 · Emisor}) y la
 * tentación es meterlo acá. Pero el adaptador que produce la pista NO SABE que fue
 * delegado: lo sabe el orquestador. Meterlo contaminaría el tipo con información
 * que su productor no tiene — Va en `Nodo.delegación` (ver `salidas.ts`), puesto
 * por quien injerta.
 */
export type Pista =
  | {
      readonly via: "padre";
      /**
       * PROVISIONAL(#46): `LocalId` marcado, no `string` — Son ids locales acuñados
       * por el adaptador (nodos del DOM, del mdast), en un espacio DISTINTO del
       * `ElementId` que produce la reconciliación (§{Tramo 4 › Qué sale}).
       * Compartir el tipo `string` los hace intercambiables por accidente, y
       * colapsar dos espacios de identidad es la peor confusión posible en este
       * tramo — Si se decide al revés (`string`), `parentId: ElementId` y
       * `pista.padre: string` son confundibles en cada llamada. La política ante
       * referencias colgantes, adelantadas o cíclicas sigue pendiente del tramo 4.
       */
      readonly id: LocalId;
      readonly padre: LocalId | null;
    }
  | {
      readonly via: "nivel";
      /**
       * PROVISIONAL(#44): `null` = «es un título pero no se pudo determinar su
       * nivel», y el emisor lo trata como el nivel abierto más profundo + 1 — Es la
       * única lectura bajo la cual el campo SE LEE y por lo tanto es jerarquía, que
       * es el invariante declarado en §{La pista} («si una estrategia no lee un
       * campo de la pista, ese campo no es jerarquía») — Si se decide al revés
       * (`null` = no aporta nivel), el campo sobra y contradice ese invariante.
       * Rango útil
       * 1..4 por la guarda de `porProminencia` (§{`porProminencia`}); los saltos
       * (h1 → h3, que
       * `porProminencia` produce por construcción al colapsar grupos) son legales
       * y el emisor los normaliza.
       */
      readonly nivel: number | null;
    }
  | {
      readonly via: "celda";
      readonly hoja: string;
      /**
       * Lleva la región porque la jerarquía real es hoja → región → fila
       * (§{La pista}).
       */
      readonly región: string;
      readonly fila: number;
    }
  | { readonly via: "espacial"; readonly caja: Caja }
  | { readonly via: "ninguna" };

/**
 * Lo que devuelve el clasificador por unidad (§{`detectar`}).
 *
 * PROVISIONAL(#43): `pista` puede ser `null`, y `null` NO es lo mismo que
 * `{via:'ninguna'}` — `Clase` empaqueta tipo y pista juntos, así que abstenerse es
 * abstenerse de las dos, y el piso físico solo repone el TIPO (§{El piso}). Hacen
 * falta tres estados y el plan solo puede expresar dos: pista explícita / el
 * clasificador se abstuvo (hereda la ruta del nodo anterior) / raíz explícita (ruta
 * `[]`). El ejemplo canónico del tramo 4 (§{1 · Ruta}) muestra párrafos con pista
 * «—» y ruta `[Contrato, Cláusula primera]`, mientras `{via:'ninguna'}` produce
 * `[]` (§{1 · Ruta}): los dos NO pueden ser lo mismo, o el árbol de todo DOCX
 * colapsa — `null` = «no modifica la ruta», `{via:'ninguna'}` = «raíz» — Si se
 * decide al revés (una sola cosa), o los tres adaptadores que se abstienen siempre
 * (`chat`, `.zip/.eml`, piso) pierden su ruta raíz, o todo párrafo abstenido de un
 * DOCX cierra la pila entera. De esto dependen las rutas de la mayoría de los nodos
 * de la mayoría de los documentos.
 *
 * PROVISIONAL(#61): `certeza` NO la produce el clasificador: la estampa la cascada
 * al devolver (§{La única}, `{...r, certeza}`). Por eso el tipo del retorno de un
 * eslabón es `Clase`, y lo que sale de `enCascada` es `Clase & {nivel}` — ver
 * `Eslabón` en `adaptador.ts`.
 */
export type Clase = {
  readonly tipo: Tipo;
  readonly pista: Pista | null;
};

// ─────────────────────────────── Cohesión ────────────────────────────────────

/**
 * Los CUATRO valores, todos de «cómo agrupa» (§{`cohesión`}).
 *
 * PROVISIONAL(C1): adopto el codominio NUEVO `lead·satellite·solo·normal` y declaro
 * DEROGADA la definición de §{Dónde vive} (`atomic·splittable·lead·satellite`) — El
 * plan define `cohesiónDe` dos veces, a 370 líneas de distancia, con codominios
 * incompatibles: `tipo:'cita', forma:'text_span'` da `splittable` en una y `normal`
 * en la otra; un `grid` da `atomic` en una y `normal` en la otra; `codigo` da
 * `atomic` en una y `solo` en la otra. Gana el nuevo porque es posterior, está en
 * «Decisiones tomadas» del tramo 5 (§{Tramo 5 › Decisiones}), es el único sobre el
 * que ramifica el único consumidor declarado (el switch de §{El recorrido}) y el
 * plan da un argumento explícito de por qué el viejo dejó de significar algo («como
 * acá no se parte nada, los cuatro pasan a responder lo mismo», §{`cohesión`}) — Si
 * se decide al revés, el tramo 5 queda sin implementación posible tal como está
 * escrito y `solo` —la pieza que se justifica con el argumento del «vector turbio»
 * (§{`cohesión`})— desaparece.
 *
 * CONSECUENCIA A REFORMULAR: el banco corre el invariante «código siempre ATÓMICO»
 * (§{Invariantes}), vocabulario del codominio viejo. Con este pasa a ser «código
 * siempre `solo`» — lo impone la anotación de `COHESIÓN`, abajo.
 */
export const COHESIONES = ["lead", "satellite", "solo", "normal"] as const;
export type Cohesión = (typeof COHESIONES)[number];

/**
 * La tabla. Conserva textualmente las cuatro entradas de §{Dónde vive} y agrega las
 * tres de §{`cohesión`}.
 *
 * PROVISIONAL(C1/#58): NO extiendo `solo` a `tabla` ni a `campos`, aunque el
 * argumento del «vector turbio» aplica igual o más a una grilla serializada — La
 * tabla de §{`cohesión`} enumera tres tipos para `solo` (`codigo`, `formula`,
 * `imagen`) y dice «todo lo demás → normal», y prefiero fidelidad al literal sobre
 * mi preferencia — COSTO QUE HAY QUE MIRAR: bajo el codominio VIEJO todo lo que no
 * era prosa era `atomic` (no se mezcla), así que una `tabla`, un `campos` y un
 * `pie` PASAN de «no se mezcla» a «se agrupa libremente» sin que el plan lo
 * discuta. Un pie repetido en 200 páginas entra en el texto de decenas de
 * fragmentos, contaminando vectores y hashes (auditoría #58) — Si se decide al
 * revés (extender `solo`), se contradice la enumeración literal de §{`cohesión`}
 * pero se recupera el comportamiento que el codominio viejo tenía.
 */
export const COHESIÓN: Partial<Record<Tipo, Cohesión>> & {
  // Los tres atómicos de §{`cohesión`} no pueden declararse de otra manera. Esto
  // reemplaza
  // a `INVARIANTE_CODIGO_SOLO`, que era una función cuyo segundo parámetro no se
  // usaba —`cohesiónDe` resuelve `codigo` por esta tabla antes de mirar la forma—
  // y que además nadie llamaba. Lo que sostenía la propiedad eran estas tres
  // entradas; ahora son inescribibles de otro modo.
  readonly codigo: "solo";
  readonly formula: "solo";
  readonly imagen: "solo";
} = {
  titulo: "lead",
  subtitulo: "lead",
  epigrafe: "satellite",
  nota_al_pie: "satellite",
  codigo: "solo",
  formula: "solo",
  imagen: "solo",
};

/**
 * Las formas que fuerzan `solo` sin importar el tipo. Es la red de seguridad que
 * mantiene vivo el segundo parámetro.
 *
 * PROVISIONAL(C1): conservo la firma literal `(tipo, forma)` de §{Dónde vive} y
 * hago que `forma` SÍ discrimine — Bajo el codominio nuevo la tabla de
 * §{`cohesión`} se expresa enteramente en términos de `tipo` («todo lo demás»), así
 * que `forma` quedaría como parámetro muerto y el test «exhaustivo 15×6 = 90 casos»
 * (§{Estrategia}) sería 15 filas repetidas seis veces. Con esta red, un `verbatim`
 * o un `asset` mal tipado —pares que `FORMA_OBLIGADA` NO prohíbe, porque solo cubre
 * 5 de 15 tipos— igual sale `solo`, que es la lectura que hace verdadera la frase
 * «los overrides de forma los hace el adaptador, que ya sabe» (§{Lo que se borró})
 * sin dejar huecos — Si se decide al revés (firma `(tipo)`), se contradice
 * §{`cohesión`} («sigue siendo una función pura de `(tipo, forma)`») y el dominio
 * del test colapsa a 15.
 */
const FORMAS_SOLO: ReadonlySet<Forma> = new Set<Forma>(["verbatim", "asset"]);

/**
 * La única función que el plan declara para `ir` (§{Dónde vive}).
 * TOTAL sobre los 15 × 6 = 90 pares, incluidos los 25 que `FORMA_OBLIGADA` vuelve
 * ilegales: la legalidad del par se verifica aparte, en el registro, y una función
 * de tablas no puede fallar — que es la razón por la que la cohesión es función y
 * no campo (§{Dónde vive}).
 */
export const cohesiónDe = (tipo: Tipo, forma: Forma): Cohesión =>
  COHESIÓN[tipo] ?? (FORMAS_SOLO.has(forma) ? "solo" : "normal");

/**
 * `lead` tiene DOS consumidores, no uno.
 *
 * PROVISIONAL(C1): predicado exportado — El plan afirma dos veces que hay un único
 * consumidor (§{Dónde vive} «la llama su único consumidor»; §{`cohesión`} «este
 * tramo es el único en consultar»), y a la vez dice que `lead` «se gana el sueldo
 * dos veces: marca dónde abre un chunk Y qué títulos están abiertos»
 * (§{2 · Emisor}) — y las migas las produce el EMISOR, en el tramo 4
 * (§{2 · Emisor}). Sin este predicado, el emisor tiene que filtrar por `tipo ∈
 * {titulo, subtitulo}` directamente, lo que viola R2 (ramificar sobre `tipo` fuera
 * de `ir`) y duplica la tabla de cohesión en otro paquete — exactamente la deriva
 * que `ir` existe para impedir — Si se decide al revés, hay que corregir las dos
 * frases del plan o aceptar la duplicación.
 */
export const esLead = (tipo: Tipo, forma: Forma): boolean =>
  cohesiónDe(tipo, forma) === "lead";

/**
 * Precedencia entre cohesiones cuando dos reglas aplican a la vez.
 *
 * PROVISIONAL(C16): un `satellite` SÍ se pega a un fragmento cuyo único nodo es
 * `solo`; un `normal` NO — `satellite` dice «se pega al fragmento vivo, nunca queda
 * solo» y `solo` dice «fragmento propio, sin mezclarse con vecinos»
 * (§{El recorrido}). Un `epigrafe` inmediatamente después de una `imagen` exige las
 * dos a la vez, y es EXACTAMENTE el par para el que existen los dos valores. El
 * plan no declara precedencia. Redefinir `solo` como «no se mezcla con vecinos
 * NORMALES, pero admite a sus satélites» es la única lectura que deja vivos los dos
 * valores y el argumento que los justifica, y coincide con la intuición del
 * producto: una imagen y su epígrafe son una unidad semántica; una imagen y el
 * párrafo anterior no — Si gana `solo`, la regla de `satellite` es letra muerta
 * justo en su caso canónico y un epígrafe termina siendo un fragmento de una línea
 * sin su imagen; si gana `satellite`, el argumento del «vector turbio»
 * (§{`cohesión`}) se cae.
 *
 * PROVISIONAL(#52): un `satellite` SIN fragmento vivo (primer nodo del documento, o
 * justo después de un `lead` que cerró) ABRE uno propio — Es la única opción que no
 * pierde el nodo, y perder en silencio es lo que §{Estrategia} llama el peor modo
 * de falla.
 */
export const admiteSatelite = (cohesiónDelFragmentoVivo: Cohesión): boolean =>
  cohesiónDelFragmentoVivo !== "lead";

// «Código siempre atómico» (§{Invariantes}) ya no se comprueba con una función: lo
// impone
// la anotación de `COHESIÓN`. La que estaba acá era tautológica —`cohesiónDe`
// resuelve `codigo` por tabla antes de mirar la forma, así que el parámetro no
// participaba— y encima nadie la llamaba.

// ─────────────────────────────── Las dos tablas ──────────────────────────────

/**
 * El piso físico (§{El piso}). Mapa TOTAL sobre las seis formas: reemplaza a la
 * regla C2 («el último clasificador de una cascada es total»), que fue eliminada
 * (§{Lo que se borró}), y por eso tiene que ser total — no hay ninguna otra
 * respuesta de último recurso en todo el sistema.
 */
export const TIPO_POR_FORMA: { [F in Forma]: TipoPara<F> } = {
  text_span: "parrafo",
  verbatim: "codigo",
  asset: "imagen",
  grid: "tabla",
  fields: "campos",
  container: "lista",
};

/**
 * El piso físico como función del CUERPO, no solo de la forma.
 *
 * PROVISIONAL(#435): `container` mira `ordenado` — `TIPO_POR_FORMA` mapea
 * `container → 'lista'` sin mirarlo (§{El piso}), así que `lista_ordenada` es
 * INALCANZABLE desde el piso — y el piso es la respuesta de `chat`, `.zip/.eml` y
 * el piso de texto, que se abstienen SIEMPRE (§{Tramo 3 › El registro},
 * §{Tramo 3 › El registro}). O sea que un procedimiento numerado en un `.txt` nunca
 * se distingue de una lista, contra §{Tramo 3 › Qué sale}, que dice que
 * precisamente esa distinción «sostiene la tesis del producto» y que sin ella
 * «skills ejecutables no se puede construir» — El mapa literal se conserva
 * exportado (otros lo citan) y esta función lo envuelve — Si se decide al revés, un
 * valor del que depende una tesis de producto declarada no lo produce nadie.
 */
export const tipoDesdeCuerpo = (cuerpo: Cuerpo): Tipo =>
  cuerpo.forma === "container" && cuerpo.ordenado
    ? "lista_ordenada"
    : TIPO_POR_FORMA[cuerpo.forma];

/** La pareja obligatoria (§{La pareja}). Mapa PARCIAL: 5 de 15 tipos. */
export const FORMA_OBLIGADA = {
  codigo: "verbatim",
  formula: "verbatim",
  tabla: "grid",
  campos: "fields",
  imagen: "asset",
} as const satisfies Partial<Record<Tipo, Forma>>;

/** Los cinco tipos que exigen forma, a nivel de tipo. */
type MapaObligado = typeof FORMA_OBLIGADA;
export type TipoConFormaObligada = keyof MapaObligado;

/**
 * Predicado PERMISIVO: solo rechaza lo que `FORMA_OBLIGADA` declara.
 *
 * PROVISIONAL(#57/P5): lo NO listado es LEGAL — El mapa cubre 5 de 15 tipos,
 * dejando 60 combinaciones sin declarar legales ni ilegales, y el propio P5
 * (§{Puntos}) admite una que hoy es expresable y no debería serlo: `tipo:'parrafo'`
 * + `forma:'grid'`. Inventar una matriz total de legalidad 15×6 significa decidir
 * 60 celdas que el plan no discute, y cada una es una decisión de producto
 * disfrazada de tipo — exactamente «un umbral y una regla ad-hoc escritos como si
 * fueran diseño» (§{Segunda}) — Si se decide al revés (matriz total), hay que
 * justificar 60 celdas y el hueco de P5 se cierra a mano.
 */
export const parLegal = (tipo: Tipo, forma: Forma): boolean => {
  if (!(tipo in FORMA_OBLIGADA)) return true;
  return FORMA_OBLIGADA[tipo as TipoConFormaObligada] === forma;
};

/**
 * La ligadura en el TIPO: los tipos que una forma admite.
 *
 * PROVISIONAL(C22): parte estática PARCIAL + aserción de runtime, y hay que decirlo
 * — §{La pareja} dice «no se corrige en runtime: SE VERIFICA. Un adaptador que la
 * viola no entra al registro» y §{Estrategia} la lista como «aserción en el
 * registro, ningún test». Pero `Adaptador` no expone qué pares emitirá: `detectar`
 * recibe la unidad y devuelve `Clase` sin ligarse al `cuerpo.forma` de esa unidad,
 * así que decidirlo exige EJECUTAR sobre entradas — que es cómo lo atrapó la
 * simulación (§{La pareja}). Es una propiedad de runtime presentada como estática.
 * Este helper la cubre para los adaptadores que construyen nodos literales; no
 * cubre a los que los construyen dinámicamente — Y «no entra al registro» describe
 * una compuerta de CI sobre el corpus de golden files, no una verificación
 * estática, porque como está escrita no existe.
 *
 * PENDIENTE QUE `ir` NO PUEDE DECIDIR: qué se hace con una violación en producción
 * con un documento nuevo (¿degradar a la forma obligada? ¿marcar `parcial`?
 * ¿rechazar el nodo?). Lanzar contradice «nunca se pierde un archivo» (§{Resumen}).
 */
export type TipoPara<F extends Forma> = {
  [T in Tipo]: T extends TipoConFormaObligada
    ? MapaObligado[T] extends F
      ? T
      : never
    : T;
}[Tipo];

// La coherencia entre las dos tablas —el piso físico nunca produce un par ilegal—
// ya NO se verifica acá. Estaba escrita como un `boolean` de runtime que nadie
// leía: si daba `false`, el build seguía verde. Ahora la impone la ANOTACIÓN de
// `TIPO_POR_FORMA` (`{ [F in Forma]: TipoPara<F> }`), que rechaza el par ilegal en
// la línea donde se escribe. La propiedad no se comprueba: no se puede escribir.

/**
 * El dominio del test exhaustivo: 15 × 6 = 90 pares (§{Estrategia}).
 * Se deriva de las dos listas para que agregar un tipo o una forma no deje el
 * conteo obsoleto.
 */
export const PARES_TIPO_FORMA: readonly (readonly [Tipo, Forma])[] = TIPOS.flatMap(
  (t) => FORMAS.map((f) => [t, f] as const),
);

/**
 * Los 25 pares que `FORMA_OBLIGADA` vuelve ilegales, derivados y no escritos a
 * mano (auditoría: «90 casos vs 65»). `cohesiónDe` sigue siendo total sobre los 90.
 */
export const PARES_ILEGALES: readonly (readonly [Tipo, Forma])[] =
  PARES_TIPO_FORMA.filter(([t, f]) => !parLegal(t, f));

/** Conteos que otros paquetes citan, derivados y no escritos. */
export const CARDINALIDADES = {
  tipos: TIPOS.length,
  formas: FORMAS.length,
  cohesiones: COHESIONES.length,
  vias: VIAS.length,
  certezas: CERTEZAS.length,
  niveles: NIVELES_DE_RECONOCIMIENTO.length,
  paresTotales: PARES_TIPO_FORMA.length,
  paresIlegales: PARES_ILEGALES.length,
  paresLegales: PARES_TIPO_FORMA.length - PARES_ILEGALES.length,
  formaObligadaCubre: Object.keys(FORMA_OBLIGADA).length,
} as const;
