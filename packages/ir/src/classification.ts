/**
 * Clasificación — `Role`, `Certainty`, `Hint`, `Cohesion` y las tres tablas.
 *
 * R2 (§{R2}): `role` es un conjunto cerrado de HECHOS DE LECTURA. Viaja como
 * metadato —sirve para mostrar, filtrar y explicar— y **solo las formas admiten
 * `switch`**. Este archivo es el único sitio legítimo del sistema donde se
 * conmuta sobre `Role`: las tres tablas de abajo.
 */

import { SHAPES, type Body, type Shape } from "./shapes.js";
import type { Caja } from "./ubicacion.js";
import type { LocalId } from "./identidad.js";

// ─────────────────────────────── Tipo ────────────────────────────────────────

/**
 * Los 15 valores, en el orden de §{Por qué `tipo`} y con la grafía del glosario.
 *
 * P1, EJECUTADO ACÁ (bloque 1). El plan escribe estos literales en español y sin
 * tilde (`parrafo`, `codigo`, `epigrafe`) y sus exports con tilde (`cohesiónDe`,
 * `COHESIÓN`, `Cohesión`) — una asimetría real del borrador, no un descuido de
 * transcripción. Este archivo ya NO la conserva: los quince literales y los nombres
 * exportados están en inglés, según `GLOSARIO.md`, que es la autoridad de nombres.
 * Lo que sostenía el español era poder cotejar cada símbolo contra su LÍNEA del
 * borrador; el cotejo pasó a ser por SECCIÓN —las anclas de `scripts/citas.mjs`— y
 * una sección sobrevive a un rename mientras un número de línea no. P1 sigue
 * pendiente para los archivos que no entraron al bloque 1 — ver PROVISIONAL(P1) en
 * `index.ts`.
 *
 * NUEVE de los quince no tienen productor en ningún adaptador del registro
 * (`subheading`, `quote`, `ordered_list`, `formula`, `caption`, `footnote`,
 * `page_header`, `page_footer` — auditoría #57). Entran igual al conjunto, pero DOS
 * mecanismos del plan dependen de tipos que hoy nadie emite: el orden de cola por
 * mobiliario (§{El costo}, que necesita `page_header`/`page_footer`) y la mitad de
 * la tabla de cohesión (que necesita `caption`/`footnote`).
 */
export const ROLES = [
  "heading",
  "subheading",
  "paragraph",
  "quote",
  "list",
  "ordered_list",
  "table",
  "fields",
  "code",
  "formula",
  "image",
  "caption",
  "footnote",
  "page_header",
  "page_footer",
] as const;

export type Role = (typeof ROLES)[number];

// ─────────────────────────────── Certeza ─────────────────────────────────────

/**
 * Los dos valores literales de §{Tramo 3 › Qué sale}. `'mixto'` fue eliminado
 * (§{Lo que se borró}).
 */
export const CERTAINTIES = ["declared", "inferred"] as const;
export type Certainty = (typeof CERTAINTIES)[number];

/**
 * El nivel de la escalera de degradación (§{La escalera}).
 *
 * PROVISIONAL(C18/C19): tipo NUEVO — `Certainty` queda EXACTAMENTE como está
 * escrita (dos valores) y el orden lo da este otro tipo — Sin él pasan tres cosas,
 * todas declaradas por el plan y ninguna implementable: (1) `enCascada` ordena con
 * `rank(a.certeza) - rank(b.certeza)` (§{La única}) y con dos valores posicional
 * y perceptual EMPATAN, así que decide el orden del autor, que es justo lo que el
 * reordenamiento existe para evitar («el invariante se cumple por construcción, no
 * por revisión», §{La única}); (2) el piso físico estampa `'declared'` con el
 * argumento de que «la forma se leyó del formato» (§{El piso}), pero para una
 * página escaneada la forma la produjo un modelo de layout
 * (§{Tramo 3 › El registro}), o sea que la certeza «que viaja hasta la skill»
 * miente en el único lugar donde el plan admite un modelo (C18); (3) la métrica de
 * atribución, que el plan llama «el indicador de salud de toda la capa de
 * reconocimiento» (§{Observabilidad}), es indistinguible con solo `certeza`, porque
 * prominencia, geometría y modelo son los tres `inferred` — Si se decide al revés
 * (ampliar `Certainty` a tres o cuatro valores), se rompe el literal de
 * §{Tramo 3 › Qué sale} y el invariante «certeza válida» del banco
 * (§{Invariantes}), que nadie revisó.
 */
export const RECOGNITION_LEVELS = [
  "declarative",
  "physical",
  "positional",
  "perceptual",
] as const;

export type RecognitionLevel = (typeof RECOGNITION_LEVELS)[number];

/**
 * `rank()` — la función que `enCascada` usa para reordenar (§{La única}).
 * Opera sobre el NIVEL, no sobre la certeza, que es lo que la vuelve un orden
 * total: declarative < physical < positional < perceptual.
 */
export const rank = (level: RecognitionLevel): number =>
  RECOGNITION_LEVELS.indexOf(level);

/**
 * La certeza que corresponde a un nivel.
 *
 * PROVISIONAL(C18): `ir` NO exporta una constante `CERTEZA_DEL_PISO = 'declarado'`;
 * exporta esta función — El piso físico produce `declared` cuando la forma se leyó
 * del formato y `inferred` cuando la produjo un modelo. Es un cambio de una línea
 * de prosa del plan (§{El piso}) y evita que el único mecanismo que el documento
 * promete a las skills («no citar como autoridad lo de confianza baja»,
 * §{La escalera}) quede desactivado precisamente para las páginas escaneadas — Si
 * se decide al revés (constante), la certeza miente donde más importa.
 */
export const certaintyOfLevel = (level: RecognitionLevel): Certainty =>
  level === "declarative" || level === "physical" ? "declared" : "inferred";

// ─────────────────────────────── Pista ───────────────────────────────────────

export const LINKAGES = ["parent", "level", "cell", "spatial", "none"] as const;
export type Linkage = (typeof LINKAGES)[number];

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
export type Hint =
  | {
      readonly linkage: "parent";
      /**
       * PROVISIONAL(#46): `LocalId` marcado, no `string` — Son ids locales acuñados
       * por el adaptador (nodos del DOM, del mdast), en un espacio DISTINTO del
       * `ElementId` que produce la reconciliación (§{Tramo 4 › Qué sale}).
       * Compartir el tipo `string` los hace intercambiables por accidente, y
       * colapsar dos espacios de identidad es la peor confusión posible en este
       * tramo — Si se decide al revés (`string`), `parentId: ElementId` y
       * `hint.parent: string` son confundibles en cada llamada. La política ante
       * referencias colgantes, adelantadas o cíclicas sigue pendiente del tramo 4.
       */
      readonly id: LocalId;
      readonly parent: LocalId | null;
    }
  | {
      readonly linkage: "level";
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
      readonly level: number | null;
    }
  | {
      readonly linkage: "cell";
      readonly sheet: string;
      /**
       * Lleva la región porque la jerarquía real es hoja → región → fila
       * (§{La pista}).
       */
      readonly region: string;
      readonly row: number;
    }
  | { readonly linkage: "spatial"; readonly box: Caja }
  | { readonly linkage: "none" };

/**
 * Lo que devuelve el clasificador por unidad (§{`detectar`}).
 *
 * PROVISIONAL(#43): `hint` puede ser `null`, y `null` NO es lo mismo que
 * `{linkage:'none'}` — `Classification` empaqueta tipo y pista juntos, así que
 * abstenerse es abstenerse de las dos, y el piso físico solo repone el TIPO
 * (§{El piso}). Hacen falta tres estados y el plan solo puede expresar dos: pista
 * explícita / el clasificador se abstuvo (hereda la ruta del nodo anterior) / raíz
 * explícita (ruta `[]`). El ejemplo canónico del tramo 4 (§{1 · Ruta}) muestra
 * párrafos con pista «—» y ruta `[Contrato, Cláusula primera]`, mientras
 * `{linkage:'none'}` produce `[]` (§{1 · Ruta}): los dos NO pueden ser lo mismo, o
 * el árbol de todo DOCX colapsa — `null` = «no modifica la ruta»,
 * `{linkage:'none'}` = «raíz» — Si se decide al revés (una sola cosa), o los tres
 * adaptadores que se abstienen siempre (`chat`, `.zip/.eml`, piso) pierden su ruta
 * raíz, o todo párrafo abstenido de un DOCX cierra la pila entera. De esto dependen
 * las rutas de la mayoría de los nodos de la mayoría de los documentos.
 *
 * PROVISIONAL(#61): `certeza` NO la produce el clasificador: la estampa la cascada
 * al devolver (§{La única}, `{...r, certeza}`). Por eso el tipo del retorno de un
 * eslabón es `Classification`, y lo que sale de `enCascada` es
 * `Classification & {nivel}` — ver `Eslabón` en `adaptador.ts`.
 */
export type Classification = {
  readonly role: Role;
  readonly hint: Hint | null;
};

// ─────────────────────────────── Cohesión ────────────────────────────────────

/**
 * Los CUATRO valores, todos de «cómo agrupa» (§{`cohesión`}).
 *
 * PROVISIONAL(C1): adopto el codominio NUEVO `lead·satellite·solo·normal` y declaro
 * DEROGADA la definición de §{Dónde vive} (`atomic·splittable·lead·satellite`) — El
 * plan define `cohesionOf` dos veces, a 370 líneas de distancia, con codominios
 * incompatibles: `role:'quote', shape:'text_span'` da `splittable` en una y
 * `normal` en la otra; un `grid` da `atomic` en una y `normal` en la otra; `code`
 * da `atomic` en una y `solo` en la otra. Gana el nuevo porque es posterior, está
 * en «Decisiones tomadas» del tramo 5 (§{Tramo 5 › Decisiones}), es el único sobre
 * el que ramifica el único consumidor declarado (el switch de §{El recorrido}) y el
 * plan da un argumento explícito de por qué el viejo dejó de significar algo («como
 * acá no se parte nada, los cuatro pasan a responder lo mismo», §{`cohesión`}) — Si
 * se decide al revés, el tramo 5 queda sin implementación posible tal como está
 * escrito y `solo` —la pieza que se justifica con el argumento del «vector turbio»
 * (§{`cohesión`})— desaparece.
 *
 * CONSECUENCIA A REFORMULAR: el banco corre el invariante «código siempre ATÓMICO»
 * (§{Invariantes}), vocabulario del codominio viejo. Con este pasa a ser «código
 * siempre `solo`» — lo impone la anotación de `COHESION_BY_ROLE`, abajo.
 */
export const COHESIONS = ["lead", "satellite", "solo", "normal"] as const;
export type Cohesion = (typeof COHESIONS)[number];

/**
 * La tabla. Conserva textualmente las cuatro entradas de §{Dónde vive} y agrega las
 * tres de §{`cohesión`}.
 *
 * PROVISIONAL(C1/#58): NO extiendo `solo` a `table` ni a `fields`, aunque el
 * argumento del «vector turbio» aplica igual o más a una grilla serializada — La
 * tabla de §{`cohesión`} enumera tres tipos para `solo` (`code`, `formula`,
 * `image`) y dice «todo lo demás → normal», y prefiero fidelidad al literal sobre
 * mi preferencia — COSTO QUE HAY QUE MIRAR: bajo el codominio VIEJO todo lo que no
 * era prosa era `atomic` (no se mezcla), así que una `table`, un `fields` y un
 * `page_footer` PASAN de «no se mezcla» a «se agrupa libremente» sin que el plan lo
 * discuta. Un pie repetido en 200 páginas entra en el texto de decenas de
 * fragmentos, contaminando vectores y hashes (auditoría #58) — Si se decide al
 * revés (extender `solo`), se contradice la enumeración literal de §{`cohesión`}
 * pero se recupera el comportamiento que el codominio viejo tenía.
 */
export const COHESION_BY_ROLE: Partial<Record<Role, Cohesion>> & {
  // Los tres atómicos de §{`cohesión`} no pueden declararse de otra manera. Esto
  // reemplaza
  // a `INVARIANTE_CODIGO_SOLO`, que era una función cuyo segundo parámetro no se
  // usaba —`cohesionOf` resuelve `code` por esta tabla antes de mirar la forma—
  // y que además nadie llamaba. Lo que sostenía la propiedad eran estas tres
  // entradas; ahora son inescribibles de otro modo. Los tres tipos son LITERALES a
  // propósito: ensancharlos a `Cohesion` dejaba pasar `"normal"` —y lo dejaba pasar
  // EN VERDE, porque nada verificaba que siguieran siendo literales—. Eso ya no:
  // `PRUEBAS_DE_COHESIÓN` (`invariantes.ts`) asevera los tres campos contra `"solo"`
  // exacto, así que ensanchar cualquiera de ellos rompe el build.
  readonly code: "solo";
  readonly formula: "solo";
  readonly image: "solo";
} = {
  heading: "lead",
  subheading: "lead",
  caption: "satellite",
  footnote: "satellite",
  code: "solo",
  formula: "solo",
  image: "solo",
};

/**
 * Las formas que fuerzan `solo` sin importar el tipo. Es la red de seguridad que
 * mantiene vivo el segundo parámetro.
 *
 * PROVISIONAL(C1): conservo la firma literal `(role, shape)` de §{Dónde vive} y
 * hago que `shape` SÍ discrimine — Bajo el codominio nuevo la tabla de
 * §{`cohesión`} se expresa enteramente en términos de `role` («todo lo demás»), así
 * que `shape` quedaría como parámetro muerto y el test «exhaustivo 15×6 = 90 casos»
 * (§{Estrategia}) sería 15 filas repetidas seis veces. Con esta red, un `verbatim`
 * o un `asset` mal tipado —pares que `REQUIRED_SHAPE` NO prohíbe, porque solo cubre
 * 5 de 15 tipos— igual sale `solo`, que es la lectura que hace verdadera la frase
 * «los overrides de forma los hace el adaptador, que ya sabe» (§{Lo que se borró})
 * sin dejar huecos — Si se decide al revés (firma `(role)`), se contradice
 * §{`cohesión`} («sigue siendo una función pura de `(tipo, forma)`») y el dominio
 * del test colapsa a 15.
 */
const SOLO_SHAPES: ReadonlySet<Shape> = new Set<Shape>(["verbatim", "asset"]);

/**
 * La única función que el plan declara para `ir` (§{Dónde vive}).
 * TOTAL sobre los 15 × 6 = 90 pares, incluidos los 25 que `REQUIRED_SHAPE` vuelve
 * ilegales: la legalidad del par se verifica aparte, en el registro, y una función
 * de tablas no puede fallar — que es la razón por la que la cohesión es función y
 * no campo (§{Dónde vive}).
 */
export const cohesionOf = (role: Role, shape: Shape): Cohesion =>
  COHESION_BY_ROLE[role] ?? (SOLO_SHAPES.has(shape) ? "solo" : "normal");

/**
 * `lead` tiene DOS consumidores, no uno.
 *
 * PROVISIONAL(C1): predicado exportado — El plan afirma dos veces que hay un único
 * consumidor (§{Dónde vive} «la llama su único consumidor»; §{`cohesión`} «este
 * tramo es el único en consultar»), y a la vez dice que `lead` «se gana el sueldo
 * dos veces: marca dónde abre un chunk Y qué títulos están abiertos»
 * (§{2 · Emisor}) — y las migas las produce el EMISOR, en el tramo 4
 * (§{2 · Emisor}). Sin este predicado, el emisor tiene que filtrar por `role ∈
 * {heading, subheading}` directamente, lo que viola R2 (ramificar sobre `role`
 * fuera de `ir`) y duplica la tabla de cohesión en otro paquete — exactamente la
 * deriva que `ir` existe para impedir — Si se decide al revés, hay que corregir las
 * dos frases del plan o aceptar la duplicación.
 */
export const isLead = (role: Role, shape: Shape): boolean =>
  cohesionOf(role, shape) === "lead";

/**
 * Precedencia entre cohesiones cuando dos reglas aplican a la vez.
 *
 * PROVISIONAL(C16): un `satellite` SÍ se pega a un fragmento cuyo único nodo es
 * `solo`; un `normal` NO — `satellite` dice «se pega al fragmento vivo, nunca queda
 * solo» y `solo` dice «fragmento propio, sin mezclarse con vecinos»
 * (§{El recorrido}). Un `caption` inmediatamente después de una `image` exige las
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
export const acceptsSatellite = (openFragmentCohesion: Cohesion): boolean =>
  openFragmentCohesion !== "lead";

// «Código siempre atómico» (§{Invariantes}) ya no se comprueba con una función: lo
// impone
// la anotación de `COHESION_BY_ROLE`. La que estaba acá era tautológica
// —`cohesionOf` resuelve `code` por tabla antes de mirar la forma, así que el
// parámetro no participaba— y encima nadie la llamaba.

// ─────────────────────────────── Las dos tablas ──────────────────────────────

/**
 * El piso físico (§{El piso}). Mapa TOTAL sobre las seis formas: reemplaza a la
 * regla C2 («el último clasificador de una cascada es total»), que fue eliminada
 * (§{Lo que se borró}), y por eso tiene que ser total — no hay ninguna otra
 * respuesta de último recurso en todo el sistema.
 */
export const ROLE_BY_SHAPE: { [F in Shape]: RoleFor<F> } = {
  text_span: "paragraph",
  verbatim: "code",
  asset: "image",
  grid: "table",
  fields: "fields",
  container: "list",
};

/**
 * El piso físico como función del CUERPO, no solo de la forma.
 *
 * PROVISIONAL(#435): `container` mira `ordered` — `ROLE_BY_SHAPE` mapea
 * `container → 'list'` sin mirarlo (§{El piso}), así que `ordered_list` es
 * INALCANZABLE desde el piso — y el piso es la respuesta de `chat`, `.zip/.eml` y
 * el piso de texto, que se abstienen SIEMPRE (§{Tramo 3 › El registro},
 * §{Tramo 3 › El registro}). O sea que un procedimiento numerado en un `.txt` nunca
 * se distingue de una lista, contra §{Tramo 3 › Qué sale}, que dice que
 * precisamente esa distinción «sostiene la tesis del producto» y que sin ella
 * «skills ejecutables no se puede construir» — El mapa literal se conserva
 * exportado (otros lo citan) y esta función lo envuelve — Si se decide al revés, un
 * valor del que depende una tesis de producto declarada no lo produce nadie.
 */
export const roleFromBody = (body: Body): Role =>
  body.shape === "container" && body.ordered
    ? "ordered_list"
    : ROLE_BY_SHAPE[body.shape];

/**
 * La pareja obligatoria (§{La pareja}). Mapa PARCIAL: 5 de 15 tipos.
 *
 * EL `satisfies` DE ABAJO ES LOAD-BEARING, NO COSMÉTICO: es lo único que ata las
 * claves de este mapa al conjunto `Role`. Sin él, `RoleWithRequiredShape` queda
 * DISJUNTO de `Role`, la rama `T extends RoleWithRequiredShape` de `RoleFor<F>` es
 * falsa para los 15 roles, `RoleFor<F>` pasa a ser LOS 15 para toda forma, y
 * entonces la anotación de `ROLE_BY_SHAPE` DEJA DE RESTRINGIR — el par ilegal
 * `text_span ⇒ code` compila en verde. Y `isLegalPair`, que pregunta
 * `role in REQUIRED_SHAPE` (un chequeo de runtime sobre claves string), devuelve
 * `true` para todo: `ILLEGAL_PAIRS` pasa de 25 pares a 0 sin un solo error.
 * Sacarlo no rompía nada: apagaba tres garantías en silencio. Ahora lo ataja
 * `PRUEBAS_DE_PAREJA` (`invariantes.ts`), que asevera por separado que las claves de
 * este mapa siguen siendo `Role` y que la pareja obligada sigue restringiendo.
 */
export const REQUIRED_SHAPE = {
  code: "verbatim",
  formula: "verbatim",
  table: "grid",
  fields: "fields",
  image: "asset",
} as const satisfies Partial<Record<Role, Shape>>;

/** Los cinco tipos que exigen forma, a nivel de tipo. */
export type RoleWithRequiredShape = keyof typeof REQUIRED_SHAPE;

/**
 * Predicado PERMISIVO: solo rechaza lo que `REQUIRED_SHAPE` declara.
 *
 * PROVISIONAL(#57/P5): lo NO listado es LEGAL — El mapa cubre 5 de 15 tipos,
 * dejando 60 combinaciones sin declarar legales ni ilegales, y el propio P5
 * (§{Puntos}) admite una que hoy es expresable y no debería serlo:
 * `role:'paragraph'` + `shape:'grid'`. Inventar una matriz total de legalidad 15×6
 * significa decidir 60 celdas que el plan no discute, y cada una es una decisión de
 * producto disfrazada de tipo — exactamente «un umbral y una regla ad-hoc escritos
 * como si fueran diseño» (§{Segunda}) — Si se decide al revés (matriz total), hay
 * que justificar 60 celdas y el hueco de P5 se cierra a mano.
 */
export const isLegalPair = (role: Role, shape: Shape): boolean => {
  if (!(role in REQUIRED_SHAPE)) return true;
  return REQUIRED_SHAPE[role as RoleWithRequiredShape] === shape;
};

/**
 * La ligadura en el TIPO: los tipos que una forma admite.
 *
 * PROVISIONAL(C22): parte estática PARCIAL + aserción de runtime, y hay que decirlo
 * — §{La pareja} dice «no se corrige en runtime: SE VERIFICA. Un adaptador que la
 * viola no entra al registro» y §{Estrategia} la lista como «aserción en el
 * registro, ningún test». Pero `Adaptador` no expone qué pares emitirá: `detectar`
 * recibe la unidad y devuelve `Classification` sin ligarse al `cuerpo.shape` de esa
 * unidad, así que decidirlo exige EJECUTAR sobre entradas — que es cómo lo atrapó
 * la simulación (§{La pareja}). Es una propiedad de runtime presentada como
 * estática. Este helper la cubre para los adaptadores que construyen nodos
 * literales; no cubre a los que los construyen dinámicamente — Y «no entra al
 * registro» describe una compuerta de CI sobre el corpus de golden files, no una
 * verificación estática, porque como está escrita no existe.
 *
 * PENDING QUE `ir` NO PUEDE DECIDIR: qué se hace con una violación en producción
 * con un documento nuevo (¿degradar a la forma obligada? ¿marcar `parcial`?
 * ¿rechazar el nodo?). Lanzar contradice «nunca se pierde un archivo» (§{Resumen}).
 */
export type RoleFor<F extends Shape> = {
  [T in Role]: T extends RoleWithRequiredShape
    ? (typeof REQUIRED_SHAPE)[T] extends F
      ? T
      : never
    : T;
}[Role];

// La coherencia entre las dos tablas —el piso físico nunca produce un par ilegal—
// ya NO se verifica acá. Estaba escrita como un `boolean` de runtime que nadie
// leía: si daba `false`, el build seguía verde. Ahora la impone la ANOTACIÓN de
// `ROLE_BY_SHAPE` (`{ [F in Shape]: RoleFor<F> }`), que rechaza el par ilegal en
// la línea donde se escribe. La propiedad no se comprueba: no se puede escribir.

/**
 * El dominio del test exhaustivo: 15 × 6 = 90 pares (§{Estrategia}).
 * Se deriva de las dos listas para que agregar un tipo o una forma no deje el
 * conteo obsoleto.
 */
export const ROLE_SHAPE_PAIRS: readonly (readonly [Role, Shape])[] = ROLES.flatMap(
  (r) => SHAPES.map((s) => [r, s] as const),
);

/**
 * Los 25 pares que `REQUIRED_SHAPE` vuelve ilegales, derivados y no escritos a
 * mano (auditoría: «90 casos vs 65»). `cohesionOf` sigue siendo total sobre los 90.
 */
export const ILLEGAL_PAIRS: readonly (readonly [Role, Shape])[] =
  ROLE_SHAPE_PAIRS.filter(([r, s]) => !isLegalPair(r, s));

// Acá vivía `CARDINALITIES`, un objeto de conteos derivados («conteos que otros
// paquetes citan»). No lo citaba nadie: su única mención fuera de este archivo era
// el re-export de `index.ts`. Y como cifra de runtime no cubría nada — borrar un rol
// bajaba `totalPairs` de 90 a 84 y los cuatro comandos seguían en verde, porque un
// valor derivado que nadie compara contra nada no es una garantía, es un espejo.
// Lo que sí es garantía está ahora en `PRUEBAS_DE_DOMINIO` (`invariantes.ts`), que
// fija 15 y 6 A NIVEL DE TIPO: quitar un rol rompe el build en vez de mover
// calladamente un número que nadie lee.
