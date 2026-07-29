# Diseño — Patrón Adapter para ingesta multi-formato (`apps/demo-pipeline`)

**Revisión 3** — incorpora la validación sin sesgo: 6 diseños ciegos (0 contaminados), 5 refutadores informados por pilar, examen independiente de los 5 ajustes, y 2 jueces.

> **Estado: documento de diseño. No hay código escrito.**
> La sección 2 lista lo que el panel **contradijo** y quedó cambiado. La sección 11 lista lo único que sigue bloqueado en una decisión tuya.

---

## Contexto

Savia tiene que aceptar muchos formatos como fuente de conocimiento y va a seguir sumando. Hoy el pipeline real hace lo contrario:

- [`apps/api/src/modules/ingest/parsers/index.ts`](apps/api/src/modules/ingest/parsers/index.ts) es `parseFile(buffer, mimeType): Promise<string>` — un `switch` sobre `mimeType` que aplana **todo a un string plano**.
- [`apps/api/src/modules/ingest/chunk.ts`](apps/api/src/modules/ingest/chunk.ts) corta ese string a ciegas por caracteres, con `OVERLAP_CHARS` como parche.

La estructura se pierde antes de que nadie pueda usarla, y sumar un formato significa editar un `switch` compartido. Este documento diseña el reemplazo y lo prueba aislado en `apps/demo-pipeline`, sin tocar producción.

---

## 1. Qué confirmó el panel ciego, llegando solo

Seis agentes diseñaron desde cero sin ver este documento (los seis declararon no haber accedido a material previo). Lo que sigue **lo reinventaron solos**, y por eso no se vuelve a argumentar acá:

| Pilar | Confirmación |
|---|---|
| `grid` es el piso; la celda **no es un elemento** (sin `id`, sin `parentId`) | **6/6**, con el mismo mecanismo de tipos: la celda no es asignable a la base, así que no puede aparecer en la lista plana. 4/6 generalizan igual: *el árbol se detiene donde la relación deja de ser contención*. |
| Confianza opcional; **ausente = determinístico**, nunca `1.0` decorativo | **6/6**. Y `ConfidenceScope<'explicit'> = {}` es **más fuerte** que lo que propuso cualquiera: 4/6 se quedaron en "depende del autor". |
| **Variante declarada vs. variante resuelta** | **6/6** nombraron la distinción con etiquetas propias y la modelaron igual: unión discriminada sobre un resultado que recién existe, condicional confinado al productor. |
| Forma **cerrada y chica** + vocabulario **abierto** advisory | **6/6**, con el mismo criterio de admisión: *un kind existe si y sólo si algún consumidor ramifica distinto por él*. Los 6 mandan heading/paragraph/listItem/quote/caption al vocabulario. |
| Lista plana; `children` **inexpresable**, no desaconsejado | **6/6**. |
| Posición = orden total obligatorio + localizador de fuente opcional | **6/6**. Los 6 declaran que el orden es *lo único* que el pipeline downstream necesita. |
| Selección de adaptador por `supports()` dentro del adaptador, no switch central | **6/6**; 2/6 llegan además al score numérico. |
| Emisor por scope (el árbol es la pila de llamadas) | **Nadie del panel lo propuso**, y el juez contrarian lo evalúa como **mejor que lo que produjo cualquiera de los seis**. Se conserva. |

> **Descuento metodológico, dicho por el juez contrarian y adoptado acá:** los seis comparten linaje y corpus — citan patience diff, Dice/Jaccard y branded types con las mismas palabras. Converger prueba que *es lo más escrito sobre el problema*, no que sea correcto. Por eso abajo **se privilegia al que rompió el marco por sobre el conteo**, y se descartan como cero-información todos los umbrales numéricos que el panel produjo con precisión retórica (0.55 / 0.60 / 0.68 / 0.72) — cuatro de seis admiten en su propia sección de riesgos que el número es una hipótesis y eligen uno igual.

---

## 2. Qué **contradijo** el panel, y quedó cambiado

| # | Hallazgo | Evidencia | Cambio |
|---|---|---|---|
| **A** | **La identidad no es propiedad del elemento.** El adaptador no puede asignarla; es el resultado de un **alineamiento global entre dos versiones**, calculado por un reconciliador compartido. | **6/6 en contra**, y 5/6 lo listan como objeción explícita al brief. | §5 reescrita. El adaptador emite `LocalKey` + `contentHash`; `ElementId` lo acuña `core/reconcile.ts`. |
| **B** | **"Matchear primero por `contentHash`, después por path" es una bolsa global sin regla de unicidad** — transfiere identidad al elemento equivocado en silencio. | **6/6** llegaron al mismo algoritmo: anclar sólo por hashes **únicos en ambos lados** → alineación monótona (LIS/LCS) → similitud **confinada a los huecos entre anclas**. | §5. Es el único punto donde los seis nombraron **el mismo modo de falla** y el documento no lo respondía en ninguna parte. |
| **C** | **`code`/`verbatim` merece ser forma propia.** El chunker **no puede** normalizar whitespace ni cortar por oración en código: ignorarlo da un resultado **incorrecto**, no peor. | **4/6**, con el mismo argumento — que es literalmente el test con el que este documento justificaba que `grid` sobreviviera al colapso. | 4 → **5 primitivas**. Ver §3 y la contradicción interna que esto resuelve. |
| **D** | **Falta el eje que el consumidor realmente usa: dónde se puede cortar.** No desapareció con el colapso a 4 — se mudó de `Content['kind']` (verificado) a `SemanticLabel` (string abierto). | Refutador del pilar 1 + diseño ciego "IR mínimo". | Nuevo `cohesion` cerrado y obligatorio en `DraftBase`. Ortogonal a `kind` y `label`. |
| **E** | **TEI `<choice>` no sobrevive en el elemento público.** `alternatives` que nadie lee se persiste, se indexa y se paga para siempre. | **0/6** inventaron algo parecido. 3/6 atendieron la necesidad subyacente ("no descartar en silencio") por el **canal diagnóstico**. Refutador: *refutado*. | `alternatives` sale de `PublicDocElement` y va al canal diagnóstico. `emit.choice` y `Choice` sobreviven. |
| **F** | **`ctx.prune({selector: string, charCount})` mete vocabulario CSS en el núcleo.** Un selector CSS en `core/adapter.ts`, en un diseño cuya propiedad 1 se titula "ahora estructural". | Ningún diseño ciego puso jamás un selector CSS en un tipo compartido. | → `ctx.dropped({ reason, hint })`. **La corrección de mayor valor por carácter de todo el material.** |
| **G** | **La poda destruye identidad a través de versiones.** Si `prune.ts` clasifica un bloque como nav en v1 y como contenido en v1.1, ese elemento aparece de la nada en la re-ingesta y pierde identidad sin que nada se ponga rojo. | **4/6**, como objeción explícita al brief. Argumento que P6(c) no consideraba. | La poda **marca**, no descarta. Ver §6. **Cambia tu resolución de P6 — es tu llamada revocarlo.** |
| **H** | **`switch` + `assertNever` es el único mecanismo de TS que sí requiere acordarse** — un switch sin el guard compila y calla, y el `default` es una escotilla. | **3/6** lo rechazan explícitamente. | `toPlainText` pasa a tipo mapeado `Record<ContentKind, handler>`. Convierte `add-content-kind.patch` de medición en garantía. |
| **I** | **El piso está calibrado sobre tablas de HTML.** Para XLSX —donde la grilla *es* el documento— una hoja de 50k celdas es **un elemento no actualizable individualmente**: la negación literal de la propiedad 3 para el 100% del archivo. Y **T10 hoy reporta ese comportamiento como éxito.** | 1/6 (minoría), y el juez contrarian lo eleva por sobre el conteo por la regla de privilegiar a quien rompió el marco. | §10 falla conocida; T10 se re-enuncia. |
| **J** | **`DocumentMeta` se usa en `TranslationResult` y nunca se define.** Es el único tipo del contrato público que aparece en una firma sin especificar. | Punto 1. | §3, definido. |

---

## 3. Los tipos — `src/core/ir.ts`

**Dos ideas de fondo, sin cambios:** el adaptador **no construye elementos**, construye *drafts* estrictamente más pobres; y la **forma** (cerrada, chica, verificada) y el **vocabulario** (abierto, advisory) son capas distintas.

**Idea de fondo nueva (hallazgo D):** hay un **tercer eje** que no es forma ni vocabulario — **cohesión**, la única decisión que el consumidor realmente toma. Es cerrado y obligatorio.

```ts
// ── Identidad ───────────────────────────────────────────────────────
export type DocumentId  = string & { readonly __brand: 'DocumentId' };
export type ElementId   = string & { readonly __brand: 'ElementId' };
export type ContentHash = string & { readonly __brand: 'ContentHash' };
/** Único DENTRO de una corrida. Lo emite el adaptador. NO es identidad persistente. */
export type LocalKey    = string & { readonly __brand: 'LocalKey' };

// ── EJE 1 · FORMA: 5 primitivas cerradas ────────────────────────────
// 'verbatim' se separó de 'text_span' por el mismo test que salvó a 'grid':
// el chunker NO puede colapsar whitespace ni cortar por oración en código.
// Ignorarlo produce un resultado INCORRECTO, no meramente peor.
export type ContentKind = 'text_span' | 'verbatim' | 'asset' | 'grid' | 'container';

// ── EJE 2 · VOCABULARIO: abierto, advisory, NUNCA valida forma ──────
export type SemanticLabel = string;   // 'heading' | 'paragraph' | 'caption' | 'list' | 'dl' | …

// ── EJE 3 · COHESIÓN: cerrado, obligatorio, ortogonal a los otros dos ──
/** La única decisión que `consumers/chunk.ts` toma. Sin esto, el chunker
 *  tiene que hardcodear el vocabulario del htmlAdapter en el núcleo. */
export type Cohesion =
  | 'atomic'      // no se parte nunca: verbatim, grid, un asset
  | 'splittable'  // se puede partir por oración: prosa
  | 'lead'        // abre chunk y nunca lo cierra: heading, título de sección
  | 'satellite';  // no viaja solo: caption, atribución, nota al pie

// ── El elemento público ─────────────────────────────────────────────
export interface PublicDocElement {
  readonly id: ElementId;              // acuñado por el RECONCILIADOR, no por el adaptador
  readonly documentId: DocumentId;
  readonly parentId: ElementId | null; // contenedor POR REFERENCIA. Nunca contención física.
  /** Orden total de lectura. Format-agnóstico. Lo único que el pipeline asume. */
  readonly sequence: number;
  readonly depth: number;
  readonly siblingIndex: number;
  readonly content: Content;
  readonly cohesion: Cohesion;
  readonly contentHash: ContentHash;
  /** AUSENTE = determinístico. NO significa "desconocido" ni 1.0. */
  readonly confidence?: Confidence;
}
// NO están acá, por P1(b) y por el hallazgo E: `provenance`, `range`, `alternatives`.
// Salen por `result.diagnostics`.

// ── Las 5 formas ────────────────────────────────────────────────────
export type Content = TextSpan | Verbatim | AssetContent | GridContent | ContainerContent;

/** Hoja simbólica normalizable. */
export interface TextSpan {
  readonly kind: 'text_span';
  readonly text: string;                    // siempre presente: la degradación es el default
  readonly label: SemanticLabel;
  readonly level?: number;                  // profundidad declarada, sin cota 1..6
  readonly lang?: string;
  readonly links?: readonly { readonly text: string; readonly href: string }[];   // P7(c)
}

/** Hoja simbólica NO normalizable: whitespace significativo, prohibido colapsar o
 *  cortar por oración. Código, preformateado, fórmula, arte ASCII. (hallazgo C) */
export interface Verbatim {
  readonly kind: 'verbatim';
  readonly text: string;
  readonly label: SemanticLabel;            // 'code' | 'pre' | 'formula' | …
  readonly language: string | null;
}

/** Hoja perceptual. LA VARIANTE RESUELTA de la propiedad 6. */
export interface AssetContent {
  readonly kind: 'asset';
  readonly modality: 'image' | 'audio' | 'video';
  readonly label: SemanticLabel;
  readonly asset: MediaAsset;
  readonly extraction: MediaExtraction;     // sólo existe DESPUÉS de intentar extraer
}

/** Compuesto SIN coordenada completa: contención lógica. */
export interface ContainerContent {
  readonly kind: 'container';
  readonly label: SemanticLabel;            // 'section' | 'list' | 'listItem' | 'quote' | 'figure'
  readonly title?: string;
  /** Ordinalidad — estructural y format-neutral, no semántica (§9.1). */
  readonly enumeration?: { readonly ordered: boolean; readonly start?: number; readonly marker?: string; readonly index?: number };
  readonly attribution?: string;
}

/** Compuesto CON coordenada completa: EL PISO DE LA TRADUCCIÓN. */
export interface GridContent {
  readonly kind: 'grid';
  readonly label: SemanticLabel;            // 'table' | 'sheet' | 'form'
  readonly rows: number; readonly cols: number;
  readonly headerRows: number; readonly headerCols: number;
  readonly caption?: string;
  readonly cells: readonly GridCell[];
}

export interface GridCell {
  readonly row: number; readonly col: number;   // POSICIÓN EN GRILLA, no parentesco
  readonly rowSpan: number; readonly colSpan: number;
  readonly role: 'header' | 'data';

  /**
   * RENDERIZADO AUTÓNOMO DE LA CELDA. Obligatorio. NUNCA un resumen, nunca un modelo
   * (un valor no determinístico acá envenena `contentHash` y vuelve flaky a T3 y T8).
   *
   * Contrato: aplanado TOTAL y DETERMINÍSTICO de todo lo que la celda contiene y sea
   * expresable como texto — INCLUIDO el de los elementos en `detailRefs`. Lo produce
   * el adaptador vía `flattenCellParts` (core/grid.ts), en el mismo pase.
   *
   * INVARIANTE RECTORA: `renderGrid` debe poder serializar la grilla ENTERA sin
   * resolver un solo `detailRef`. Los detalles ENRIQUECEN, no CONTIENEN.
   * Motivo mecánico: `renderGrid` no recibe `DocIndex` y no puede resolver ids.
   * Una celda vacía en la tabla con su contenido en el anexo de P3(b) es PEOR que
   * la duplicación: el chunk embebido pierde la fila que lo hacía recuperable.
   *
   * `''` es legal SÓLO si no hay texto alguno. `''` NO significa "está en detailRefs".
   */
  readonly text: string;

  /** P2(b) ACOTADO a `grid | asset` (§9.4). Una lista o un párrafo dentro de una
   *  celda se aplanan en `text` y NO se emiten como hermanos. */
  readonly detailRefs?: readonly ElementId[];

  readonly allowedValues?: readonly string[];   // AcroForm / <select>
  readonly namedRange?: string;                 // XLSX
}

// ── Assets ──────────────────────────────────────────────────────────
export type MediaAsset =
  | { readonly loc: 'external'; readonly uri: string; readonly mimeType?: string }
  | { readonly loc: 'inline';   readonly bytesHash: string; readonly mimeType: string }
  | { readonly loc: 'vector';   readonly markup: string };

export type MediaExtraction =
  | { readonly outcome: 'text';      readonly text: string; readonly method: ExtractionMethod; readonly score?: number }
  | { readonly outcome: 'described'; readonly text: string; readonly method: 'model'; readonly score?: number }
  | { readonly outcome: 'none';      readonly reason: 'no-capability'|'failed'|'empty'|'skipped' };
export type ExtractionMethod = 'alt'|'caption'|'vectorTitle'|'ocr'|'asr'|'transcript'|'other';   // P12

// ── Confianza ───────────────────────────────────────────────────────
export type ConfidenceBasis = 'heuristic' | 'layout' | 'model' | 'ocr' | 'asr';   // CERRADO (P12)
export interface Confidence { readonly score: number; readonly basis: ConfidenceBasis; readonly note?: string }

// ── DocumentMeta — el hueco real del punto 1 (hallazgo J) ────────────
export interface DocumentMeta {
  readonly id: DocumentId;
  readonly sourceMimeType: string;
  readonly title?: string;
  readonly authors?: readonly string[];
  readonly language?: string;
  /** Forma CERRADA, vocabulario ABIERTO — el mismo truco un nivel más arriba.
   *  NO es Record<string, unknown>: lista de pares, sin acceso por clave literal,
   *  así que ramificar por formato aguas abajo es visible en el diff. */
  readonly properties: readonly DocumentProperty[];
}
export interface DocumentProperty {
  /** Namespaceada por ESQUEMA, nunca por formato: 'jsonld:Article.datePublished',
   *  'ooxml:custom.MatterNumber', 'exif:Make', 'dc:creator'. */
  readonly key: string;
  /** SIEMPRE string: el texto fuente LITERAL, sin re-serializar. De acá sale la
   *  determinabilidad del hash — `JsonValue` no la tiene. */
  readonly value: string;
  readonly valueType: 'string'|'number'|'boolean'|'date'|'json';   // advisory
  readonly cert: 'high'|'medium'|'low';
  readonly adapterId: string;
}

// ── Invariante estructural verificada en `tsc --noEmit` ──────────────
type ElementValuedKeys<T> = { [K in keyof T]-?: NonNullable<T[K]> extends PublicDocElement | readonly PublicDocElement[] ? K : never }[keyof T];
type NoNesting<U> = U extends unknown ? (ElementValuedKeys<U> extends never ? never : ['IR-ERR: el payload anida un elemento', U]) : never;
type AssertNever<T extends never> = T;
type _InvarianteContencion = AssertNever<NoNesting<Content>>;
```

---

## 4. Localización — `src/core/text-layer.ts` (reescrito, punto 4)

**El punto 4 quedó confirmado y es peor de lo que decía el planteo:** la "reconciliación" no existía en ninguna parte salvo como una palabra en el árbol de archivos. `DraftBase.selectors?: readonly Selector[]` no tenía **ninguna restricción de cardinalidad ni de coherencia** — el tipo admitía dos `TextPosition` contradictorios, o un position apuntando al párrafo 17 con el quote del párrafo 3. Nada lo impedía y ninguna prueba lo miraba.

Y la pregunta *"offset sobre qué texto"* estaba mal formulada: presupone un texto canónico preexistente. **No existe — hay que fabricarlo, y entonces es un artefacto con hash y versión, no una convención.**

```ts
export type CanonicalText = string & { readonly __brand: 'CanonicalText' };
export type CanonOffset   = number & { readonly __brand: 'CanonOffset' };

export interface TextLayer {
  readonly text: CanonicalText;
  readonly hash: string;                          // sha256(text) — versión del sistema de coordenadas
  readonly canonicalizer: string;                 // 'html-canon@1' | 'plain-canon@1'
  readonly offsetUnit: 'codepoint' | 'utf16';     // DECLARADO, no asumido
  readonly normalization: 'NFC';
}

/** El adaptador hace el WALK (tiene el DOM); core hace la CANONICALIZACIÓN (tiene la política). */
export interface TextLayerBuilder {
  pushText(raw: string): TextRange;   // decodifica entidades, NFC, NO colapsa espacios
  pushReplaced(): TextRange;          // un U+FFFC — todo asset tiene rango propio de 1 char
  build(): TextLayer;
}
```

Reglas fijadas en core, iguales para todo adaptador:

- entidades decodificadas, NFC;
- **sin** colapso de espacios — el colapso vive en `TextSpan.text`, que es proyección presentacional;
- cada elemento reemplazado (`img`/`svg`/`video`) aporta **un U+FFFC**, práctica estándar en ICU/NSAttributedString, de modo que todo asset tenga rango propio y difeable;
- **se construye ANTES de la poda.** Lo podado ocupa offsets igual — la poda no es parte del sistema de coordenadas. *(Esto encaja con el hallazgo G: si la poda marca en vez de descartar, el canónico ya era estable de todos modos.)*

**Cambio estructural (R1):** `selectors` **se borra de `DraftBase`**. El adaptador deja de poder nombrar un `Selector`. En su lugar `DraftBase.range: SourceRange`, unión cerrada de tres espacios de coordenadas, **uno solo por elemento** — un draft no puede llevar dos coordenadas contradictorias porque no puede llevar dos.

```ts
export type SourceRange =
  | { readonly space: 'text';     readonly start: CanonOffset; readonly end: CanonOffset }
  | { readonly space: 'fragment'; readonly conformsTo: 'media-frags'; readonly value: string }
  | { readonly space: 'grid';     readonly row: number; readonly col: number };
```

**WADM sobrevive, pero como tipo de SALIDA:** `core/selectors.ts` deriva el par `TextPositionSelector` + `TextQuoteSelector` **de un único cómputo sobre el `TextLayer`**, nunca de dos cálculos independientes del adaptador. El `Selector[]` de W3C queda como el formato de intercambio hacia `LOCATOR` y la UI de citado — que es su dominio real — y deja de ser algo que un adaptador pueda escribir mal.

> El panel sobre WADM: **1/6 llegó solo al mismo vocabulario y los mismos cuatro selectores** (lo que lo salva de ser una excentricidad), pero **5/6 diseñaron un localizador propio y opaco**, y 3 de esos rechazan explícitamente una unión que el consumidor pueda leer — *"mirar la unidad ES ramificar por formato con otro nombre"*. Esta reestructuración conserva WADM donde su estandarización paga (intercambio, citado) y lo saca de donde no (el contrato que todo adaptador implementa).

---

## 5. Identidad — `src/core/reconcile.ts` (reescrito, hallazgos A/B + punto 5)

**Es el único punto donde el documento estaba solo contra los seis diseños ciegos**, y donde la convergencia sí pesa — no porque sean seis, sino porque **los seis nombraron el mismo modo de falla y el documento no lo respondía en ninguna parte**.

### El defecto era doble

**(i) De ubicación.** La identidad no puede ser función de *una* versión del documento, así que no puede acuñarla el adaptador. Es el resultado de un alineamiento entre **dos**.

**(ii) De tipo, y es verificable por `tsc`.** `ElementDelta` cubría 3 de las 4 celdas del producto (¿se movió el path?) × (¿cambió el contenido?):

| | hash igual | hash distinto |
|---|---|---|
| **path igual** | `unchanged` | `updated {id, from, to}` |
| **path corrido** | `rebound {id, newId}` | **NO EXISTÍA** |

`updated` llevaba **un solo** `id`; `rebound` no llevaba `from`/`to`. **"Movido *y* editado" no era expresable.** Aunque escribieras el mejor matcher del mundo, `diffElements` no tenía tipo con el que devolver el hallazgo y estaba forzado a degradar a `archived + inserted` — que es exactamente el caso que planteaste, pero la causa no era el algoritmo.

### Precondición que el documento nunca fijó

**`structuralPath` DEBE usar índices por padre** (`/body/section[1]/p[3]`), nunca ordinal global. Con índices por padre, insertar en la sección 1 corre a los hermanos *de esa sección* y a nadie más. Con ordinal global, el caso combinado deja de ser un borde y se vuelve catastrófico: `1 inserted + 136 archived + 137 inserted`. Va como invariante en `core/ids.ts` y se verifica en T9 con un control fuera del alcance de la inserción.

### El mecanismo, en tres pases

```ts
export type MatchBasis = 'hash-aligned' | 'hash-moved' | 'similarity';

/** TOTAL sobre (¿se movió?) × (¿cambió?). Reemplaza los 5 constructores anteriores. */
export type ElementDelta =
  | { readonly op: 'matched';
      readonly prevId: ElementId; readonly nextId: ElementId;
      readonly moved: boolean;                    // prevId !== nextId
      readonly from: ContentHash; readonly to: ContentHash;
      readonly basis: MatchBasis;
      readonly similarity?: number }              // sólo si basis === 'similarity'
  | { readonly op: 'inserted'; readonly id: ElementId }
  | { readonly op: 'archived'; readonly id: ElementId };

/** Vista derivada: conserva el vocabulario anterior para reportar, sin que sea
 *  lo que el tipo puede expresar. 'rebound+updated' es la celda que faltaba. */
export type DeltaLabel = 'unchanged'|'rebound'|'updated'|'rebound+updated'|'inserted'|'archived';
export declare function classify(d: ElementDelta): DeltaLabel;
```

1. **Anclaje jerárquico.** Desde la raíz, LCS/Myers sobre **cada lista de hermanos**, con igualdad `= contentHash`. **Sólo se ancla por hashes que aparecen exactamente UNA vez en cada lado** — los duplicados quedan fuera del anclaje *por construcción*, que es precisamente la regla de unicidad que el mecanismo anterior no tenía. Padre casado ⇒ recursión sobre sus hijos.
2. **Similitud confinada a los huecos.** Entre dos anclas consecutivas, `prev[i..j]` vs `next[k..l]` — típicamente 1 a 5 elementos por lado. Ahí se resuelve el caso combinado: los párrafos 15-16 y 18-19 no cambiaron, son anclas, y el hueco contiene `{p_nuevo, p17'}` contra `{p17}`. Se empareja `p17'↔p17` y `p_nuevo` queda sin par. **La inserción dejó de importar porque la posición relevante es relativa a las anclas, no absoluta.**
3. **Movimientos sobre el residuo**, y lo que queda sin par es alta/baja.

**Condiciones obligatorias del pase 2:** mismo `kind`, mismo `cohesion`, *mutual best match* dentro del hueco, y asignación **monótona** (sin cruces). Prefiltro por ratio de longitud.

**Sobre el umbral:** el panel produjo 0.55, 0.60, 0.68 y 0.72 con justificaciones elaboradas, y cuatro de seis admiten en su propia sección de riesgos que el número es una hipótesis. **Acá no se fija un número por decreto:** `DiffOptions.similarityThreshold` es un parámetro, T9 lo barre sobre los fixtures y reporta la curva, y el default sale de esa medición. Un umbral inventado con precisión falsa es peor que uno declarado como pendiente.

**Residuos aceptados, escritos en el README y no descubiertos en un ticket:**
- Dos elementos byte-idénticos con uno borrado: el LCS no puede saber cuál. Es el mismo residuo con el que `git` vive desde 1986.
- Documento reescrito >~30%: no hay anclas, degrada a reemplazo en bloque. **Con instrumentación obligatoria** (`stats.anchorRatio`, `hunksDegraded`) — degradación honesta que nadie mide es indistinguible de un bug.

---

## 6. Poda → marcado (hallazgo G) · **cambia tu resolución de P6**

P6(c) era: podar y descartar, dejando muestra auditable. El panel encontró un argumento que no estaba sobre la mesa, **4 de 6 y como objeción explícita al brief**:

> Filtrar es una decisión **heurística** y **destructiva a través de versiones**. Si `prune.ts` clasifica un bloque como nav en la v1 del adaptador y como contenido en la v1.1, ese elemento **aparece de la nada** en la re-ingesta y pierde identidad, sin que nada se ponga rojo. Y es el único punto del `htmlAdapter` —declarado `certainty: 'explicit'`— donde se toma una decisión por heurística de clase/id (`cookie`, `banner`, `sidebar`).

Con §5 en su lugar, el argumento pesa más: la poda es la única fuente de ruido que el reconciliador no puede distinguir de una edición real.

**Cambio:** el adaptador **emite** el bloque con `label: 'chrome'` y `confidence`, y el descarte pasa a ser **política de consumo** (`ExtractPolicy.keepChrome`, default `false`). El resultado observable por default no cambia; lo que cambia es que la decisión es reversible sin re-ingerir y que el sistema de coordenadas no depende de ella.

Y la corrección barata que va junto (hallazgo F):

```ts
// ANTES: prune(sample: { selector: string; charCount: number })  ← CSS en el núcleo
// AHORA:
dropped(e: { readonly reason: 'navigation'|'decoration'|'duplicate'|'empty'; readonly hint: string }): void;
```

---

## 7. El contrato de adaptador — `src/core/adapter.ts`

```ts
export type Certainty = 'explicit' | 'inferred';

type DraftBase = {
  readonly label: SemanticLabel;
  readonly cohesion: Cohesion;        // OBLIGATORIO (hallazgo D)
  readonly range: SourceRange;        // UNO. No un array. (punto 4, R1)
  readonly nativeKind?: string;
};

export type ContainerDraft = DraftBase & { readonly title?: string; readonly enumeration?: ContainerContent['enumeration']; readonly attribution?: string };
export type TextDraft      = DraftBase & { readonly text: string; readonly level?: number; readonly lang?: string; readonly links?: TextSpan['links'] };
export type VerbatimDraft  = DraftBase & { readonly text: string; readonly language: string | null };
export type AssetDraft     = DraftBase & { readonly modality: AssetContent['modality']; readonly asset: MediaAsset };
export type GridDraft      = DraftBase & { readonly cells: readonly CellDraft[]; readonly headerRows?: number; readonly headerCols?: number; readonly caption?: string };
/** ACOTADO a grid|asset (§9.4). Ni contenedores ni texto salen de una celda. */
export type CellDetailDraft = GridDraft | AssetDraft;

export interface Emitter {
  /** Abre un contenedor. EL ÁRBOL TRANSITORIO ES ESTE ANIDAMIENTO LÉXICO. */
  container(draft: ContainerDraft, body: (emit: Emitter) => void | Promise<void>): Promise<LocalKey>;
  text(draft: TextDraft): Promise<LocalKey>;
  verbatim(draft: VerbatimDraft): Promise<LocalKey>;
  /** EL PISO: NO existe overload con `body`. */
  grid(draft: GridDraft): Promise<LocalKey>;
  /** VARIANTE RESUELTA: se decide sobre `extraction`, que recién existe en runtime. */
  asset(draft: AssetDraft, extraction: MediaExtraction): Promise<LocalKey>;
  /** >= 2 candidatos, por tupla. El `kind` PUEDE diferir — ver §9.3.
   *  Los descartados van al canal DIAGNÓSTICO, no al elemento público (hallazgo E). */
  choice(candidates: readonly [ChoiceCandidate, ChoiceCandidate, ...ChoiceCandidate[]]): Promise<LocalKey>;
  /** Metadato a nivel DOCUMENTO. No crea elemento, no toca sequence ni contentHash. */
  property(p: Omit<DocumentProperty, 'adapterId'>): void;
}

export type ConfidenceScope<C extends Certainty> =
  C extends 'inferred' ? { withConfidence<T>(c: Confidence, body: () => Promise<T>): Promise<T> } : {};

export type TranslateContext<C extends Certainty> = {
  readonly emit: Emitter;
  readonly layer: TextLayerBuilder;
  readonly capabilities: Capabilities;
  readonly limits: { readonly maxElements: number; readonly maxBytes: number };
  readonly signal: AbortSignal;
  warn(code: string, detail: string): void;
  note(code: string, count?: number): void;
  dropped(e: { reason: 'navigation'|'decoration'|'duplicate'|'empty'; hint: string }): void;
} & ConfidenceScope<C>;

export interface SourceAdapter<C extends Certainty = Certainty> {
  readonly certainty: C;                    // discriminante en primer nivel: narrowea sin cast
  readonly manifest: AdapterManifest;
  supports(probe: SourceProbe): { readonly match: false } | { readonly match: true; readonly score: number };
  translate(input: SourceInput, ctx: TranslateContext<C>): Promise<void>;   // NO devuelve: narra
}

export interface TranslationResult {
  readonly document: DocumentMeta;
  readonly elements: readonly PublicDocElement[];   // LISTA PLANA, asc por sequence
  readonly diagnostics: Diagnostics;                // provenance, ranges, alternatives, dropped
  readonly report: TranslationReport;
}

// ── Consumo ──────────────────────────────────────────────────────────
/** Hallazgo H: tipo mapeado, NO switch + assertNever. Agregar un kind rompe
 *  en compilación TODO call site, no sólo los que se acordaron del guard. */
export type ContentVisitor<T> = { readonly [K in ContentKind]: (c: Extract<Content, {kind: K}>) => T };
export declare function visit<T>(c: Content, v: ContentVisitor<T>): T;
export declare function toPlainText(el: PublicDocElement, opts?: { renderGrid?: GridRenderer }): string;

export declare function buildIndex(els: readonly PublicDocElement[]): DocIndex;   // P8(b)
export declare function childrenOf(ix: DocIndex, parentId: ElementId | null): readonly PublicDocElement[];
export declare function breadcrumbOf(ix: DocIndex, id: ElementId): readonly string[];
export declare function readingOrder(ix: DocIndex, opts?: { includeGridDetails?: boolean }): readonly PublicDocElement[];   // P3(b)
export declare function passesThreshold(el: PublicDocElement, t: number): boolean;
```

---

## 8. Las 6 propiedades — dónde quedó cada mecanismo

| Prop | Qué la fuerza ahora | Cambió |
|---|---|---|
| **1 · Aislamiento** | El `Emitter` sólo acepta drafts: el núcleo **nunca tiene el dato nativo**. `provenance`/`range`/`alternatives` fuera del elemento público. **`ctx.dropped` sin vocabulario CSS** (hallazgo F). | Sí — se cerró la fuga del núcleo. |
| **2 · Contrato común** | 5 formas. El adaptador no puede fabricar un elemento; el único constructor vive en `core/emitter.ts` y no se exporta. Sin `metadata: Record<string, unknown>`; sin `data?: JsonValue` (§9.1). | 4 → 5 formas. |
| **3 · Plano por referencia** | El árbol **es la pila de llamadas** — nunca existe como estructura. `parentId` sale de la pila del runtime: padre inexistente, ciclo o hijo-antes-que-padre son imposibles. `AssertNever<NoNesting<Content>>` en compilación. | Sin cambios. **6/6 confirmaron la salida plana; 2/6 objetan que la transitoriedad del árbol es una restricción de implementación disfrazada de requisito — se conserva porque el emisor por scope es mejor que lo que produjo cualquiera de los seis.** |
| **4 · El piso** | `emit.grid` **sin overload con `body`** (ausencia de API) + `ContainerDraft` no produce `'grid'` (imposibilidad de tipo). La celda no es elemento. | **Falla conocida nueva: grillas desde la raíz** (§10). |
| **5 · Incertidumbre** | `ConfidenceScope<'explicit'> = {}` — en `htmlAdapter` el método **no existe**. El runtime deriva `confidence` de los scores de `Capabilities` (P5c). | Sin cambios. Confirmado 6/6 y **más fuerte que lo que propuso el panel**. |
| **6 · Declarada vs. resuelta** | `as const satisfies Record<KnownTag, {kind, label, cohesion} \| '@resolved'>` exige totalidad; `'@resolved'` es la costura grepeable; segundo mapa total sobre `MediaExtraction['outcome']`. **Consumo por tipo mapeado, no por switch.** | Mecanismo de consumo (hallazgo H). |

**La distinción, sin cambios** — y los 6 ciegos la reinventaron con etiquetas propias:

> **Variante declarada** — la forma se sabe mirando **sólo el nodo**, antes de ejecutar nada fallible. Dominio finito y conocido en compilación ⇒ mapa total verificado por el compilador.
> **Variante resuelta** — la forma es función de un **resultado que todavía no existe**, porque depende de una operación efectful y fallible. La imagen. Condicional genuino sobre `MediaExtraction`.
> No es "cerrado vs. abierto": lo que cambia es **cuándo** se resuelve la rama. La exhaustividad **se re-domicilia**, no se pierde.

---

## 9. Los 5 puntos — resolución

### 9.1 · Punto 1 — `data?: JsonValue` · **confirmado, pero la solución era peor**

El diagnóstico está al revés: aplanar un JSON-LD a texto **no pierde nada** (el texto *es* la forma canónica de un JSON, y `JSON.parse` lo devuelve entero); aplanar un `<dl>` **sí** pierde la relación término→definición. `data?: JsonValue` no compra información — compra ahorrarse un `JSON.parse`.

Y su costo es reabrir el canal que P1(b) acababa de cerrar: es `metadata: Record<string, unknown>` con otro nombre, **en el elemento público, visible por el chunker**. A seis meses: `htmlAdapter` mete `{tag:'dl', className:'spec-sheet'}` porque es gratis, y `chunk.ts` gana un `if (el.content.data?.tag === 'dl')`. **T3 quedaría estructuralmente ciega**, porque `scramble` está definido como "destruye todo rastro de origen **sin tocar `content`**".

**Resolución:** no se agrega `data` ni una 6ª primitiva. Tres cosas en su lugar:
1. Regla en el Protocolo de Edición Aditiva: *contenido estructurado desconocido se emite como `text_span` con `label` prefijado por esquema (`'jsonld'`, `'mathml'`, `'ooxml:sdt'`) y `text` = **la fuente literal, sin re-serializar***. La prohibición de re-serializar preserva byte-exactitud y hace `contentHash` determinístico por construcción.
2. **Se define `DocumentMeta`** (§3) — el hueco real, que estaba en una firma pública sin especificar.
3. **`Emitter.property()`**: canal a nivel documento que no crea elemento, no toca `sequence`, no toca `contentHash`, no toca `toPlainText`. Costo comparado: `add-content-kind.patch` rompe 2 archivos del núcleo por diseño; `property` rompe **0 consumidores**.

### 9.2 · Punto 2 — `GridCell.text` · **mejorado**

El menú estaba mal armado: las cuatro opciones asumían que la pregunta era *"qué valor le pongo al campo"* cuando la pregunta es *"qué tiene derecho a salir de la celda como elemento hermano"*. Son **una sola decisión, no dos**.

**Por qué `''` es la peor —y es la que el documento sugería implícitamente—:** `renderGrid` recibe `GridContent`, y `detailRefs` son `ElementId`, no elementos. **`renderGrid` no tiene el `DocIndex`** (la firma `toPlainText(el, opts?)` no lo recibe, y dárselo rompería que `consume.ts` sea el único consumidor total). O sea: con `text: ''` el renderer serializa una tabla con agujeros y **no tiene forma de taparlos**. Combinado con P3(b) el resultado embebido es `| Pro | (vacío) | $29 |` y, cuarenta líneas más abajo, tres bullets sin nada que diga a qué celda pertenecen. La query *"¿qué incluye el plan Pro?"* no matchea.

**Resolución (una sola, en dos mitades):**
- `text` sigue **obligatorio** y se define como el **aplanado total y determinístico** de la celda, producido por el adaptador vía `flattenCellParts` en el núcleo. `''` sólo si no hay texto alguno.
- **Invariante rectora:** `renderGrid` debe poder serializar la grilla entera **sin resolver un solo `detailRef`**. Los detalles enriquecen, no contienen.
- **`detailRefs` se acota a `grid | asset`** (antes: `container | text | asset | grid`). Una lista o un párrafo dentro de una celda se aplanan en `text` y no se emiten como hermanos. Consecuencia inmediata: en el fixture de T3 la lista dentro de la celda **deja de existir como elemento** — cero duplicación, cero agujero, cero anexo.

> **Esto revierte parcialmente tu P2(b).** El mecanismo de recursión sobrevive para grillas anidadas y assets; lo que se saca es texto y contenedores.

### 9.3 · Punto 3 — mismo `kind` entre candidatos · **REFUTADO**

Las dos patas fallan.

**(1) La premisa técnica es falsa.** `Choice.candidates[i].content` es `Content`, la misma unión cerrada sobre la que el visitor ya es total. Un candidato de kind distinto **no rompe ninguna exhaustividad**: cae en una rama que el consumidor está *obligado por compilación* a tener escrita. Lo único que la restricción compraría es el permiso de **saltearse** el visitor — narrowear una vez por el ganador y asumir que los alternativos son iguales. Eso es exactamente la ramificación-por-atajo que la propiedad 2 quiere eliminar: **el punto pide meter en el sistema de tipos una licencia para escribir el consumidor frágil.**

Y ni siquiera entrega la predictibilidad que promete: el caso canónico (heading vs. paragraph enfático) ya es mismo-kind y aun así los candidatos difieren en `label`, en `level` y en el texto.

**(2) Los casos de ambigüedad de forma son reales.** Un bloque ASCII alineado en columnas: ¿`verbatim` o `grid`? Un screenshot de una tabla: ¿`asset` o `grid`? Ahí **el `kind` es la ambigüedad**, y restringir es exactamente lo que rompe el patrón.

*(Nota: el intento ingenuo tampoco funciona — `choice<D extends TextDraft|GridDraft>(c: readonly {draft: D}[])` infiere `D = TextDraft | GridDraft` por unión covariante y compila sin error, que es el colapso al constraint.)*

**Resolución:** no restringir por kind. En su lugar:
- `Choice.ambiguity: 'label' | 'shape'`, **derivado por el runtime**, no escrito por el adaptador. Cambia el problema de *prohibir* la ambigüedad de forma a *nombrarla*.
- Tipar la **aridad**, que es donde sí paga: `choice` con un solo candidato es `emit.text` disfrazado. Se cierra con una tupla `[C, C, ...C[]]` — sin genéricos, con error legible.
- Regla escrita y testeada: *un consumidor debe pasar `alternatives[i].content` por el mismo visitor total; asumir `alternatives[i].content.kind === content.kind` es una violación de la propiedad 2.*
- **Gap nombrado:** `choice` cubre ambigüedad entre hojas y grillas. **`grid` vs `container` (el `isGridLike`) queda fuera y sigue siendo un descarte silencioso** — va a §10 en vez de dejar la promesa universal.

### 9.4 · Punto 4 — reconciliación de selectores · **confirmado** → §4

### 9.5 · Punto 5 — edición + inserción · **mejorado** → §5

El hueco existe pero el defecto estaba en el **ADT**, no en el algoritmo. Ver §5. El fixture nuevo:

**`A-edit-and-insert.html`** = `A.html` (137 elementos) + dos mutaciones simultáneas + **dos controles que ninguna otra prueba cubre**:

| Mutación | Qué prueba |
|---|---|
| `<p>` nuevo como **primer hijo de la sección 1** | la inserción |
| palabra cambiada en el **párrafo 17, en la sección 1 y después del punto de inserción** | **movido *y* editado** — la celda que no existía |
| **control A** (`p20`, sección 1, después de la inserción, sin tocar) | movido no editado: el anclaje por hash sigue vivo |
| **control B** (`p42`, sección 3, editado, sin inserción arriba) | que `structuralPath` sea **por padre** y el daño no se propague entre secciones |

**Assert:** `1 inserted`, **`0 archived`**, `p17 → matched {moved: true, from ≠ to, basis: 'similarity'}`. Si el resultado es `archived + inserted`, el mecanismo no funcionó — y **hoy T9 no podía ni expresar la diferencia**.

---

## 10. Plan de validación

**T1–T13 se conservan.** Cambios y agregados:

| # | Cambio |
|---|---|
| **T3** | Tercer modo: `scramble` hoy está definido como "sin tocar `content`" — se agrega un modo que también scramblea todo campo advisory dentro de `content` (`label`), para que la prueba no quede ciega al canal por donde el formato puede volver a filtrarse. |
| **T9** | Reescrita: corre `diffElements` sobre `A-edit-and-insert.html` con los dos controles (§9.5), y **barre `similarityThreshold`** reportando la curva en vez de asumir un número. |
| **T10** | Re-enunciada: **"el piso no cede *para grillas embebidas en flujo de texto*"**. Hoy celebra que `tabla-30x40` produzca 1 elemento — correcto para HTML, y la negación de la propiedad 3 para una hoja de cálculo. |
| **T12** | Tres parches nuevos: `add-cohesion.patch` → esperado `{consumers/chunk.ts}`; `add-document-property.patch` → esperado `{}`; `add-json-value-to-textspan.patch` (**parche negativo**) → esperado que rompa `core/ids.ts`, documentando por qué se rechazó §9.1 en vez de dejarlo como opinión. |
| **T14** *(nueva)* | **`renderGrid` ciego.** Correr `toPlainText` sobre todos los fixtures de grilla con un resolvedor de `detailRefs` **que lanza al ser invocado**. Evidencia: 0 excepciones + ninguna celda con `data-expect-text` serializada vacía. Con `text: ''` esta prueba es **imposible de pasar** — ese es el punto. |
| **T15** *(nueva)* | **No-duplicación en el índice.** Shingling de 8 palabras sobre todos los chunks de `tabla-con-lista.html` y `tabla-anidada.html`; assert de que el conjunto de shingles en ≥2 chunks es vacío. |
| **T16** *(nueva)* | **Consistencia quote↔position.** Para todo registro con `space: 'text'`, aseverar `layer.text.slice(start, end) === quote.exact`. Es **tautológica si R1–R3 están implementados** — y ese es el punto: documenta que el par no se *puede* construir mal. Si alguien reintroduce `selectors` en `DraftBase`, deja de ser tautológica y empieza a fallar. |
| **T17** *(nueva)* | **Calidad de frontera de chunk.** T1–T13 mide aislamiento, estructura, identidad y compilación — **nada mide el problema que abrió el documento**. Assert: ningún chunk parte un `cohesion: 'atomic'`; ningún `'lead'` cierra un chunk; ningún `'satellite'` viaja solo. *(T5 no cubre esto: compara dos fixtures escritos por la misma persona con el mismo vocabulario.)* |

### La prueba estrella — T3, permutación de procedencia

Se traduce un fixture rico, se destruye todo rastro de origen sin tocar contenido ni topología, se corre el pipeline completo aguas abajo sobre ambas entradas, y **la evidencia son dos sha256 iguales de `JSON.stringify(chunks)`**. Segunda corrida con `delete` en vez de reemplazo, para probar que nadie los lee ni siquiera defensivamente con `?.`.

### Anti-evidencia

- **«`tsc --noEmit` pasa»** — prueba que existe *un* camino válido, no que los inválidos estén cerrados. Sin T1, "el compilador lo impide" es fe.
- **«El demo corre y el output se ve bien»** — los fixtures los eligió quien escribió el adaptador.
- **«Los dos adaptadores producen la misma forma»** — tautología impuesta por la firma. Hay que medir que **el consumidor no cambió**.
- **«El tercero se sumó sin tocar nada», sin `git diff --exit-code`.** Y aun con diff verde: **si el tercero es otro documento de texto, la prueba es circular.** *(Ver §12: el documento identificaba correctamente el caso que lo falsaría y después construía dos adaptadores de flujo de texto. Por su propio estándar, la evidencia era circular. Corregido en el orden de implementación.)*
- **«No hay `import` de `parse5` en `src/core/`»** — el conocimiento de formato no viaja por los imports: un umbral de 1800 caracteres calibrado sobre artículos HTML no importa nada.
- **«`report.status === 'ok'`»** — el reporte no viaja aguas abajo. Un `'partial'` que nadie lee es un log.
- **«Cobertura 90%»** — mide líneas ejecutadas, no ramas prohibidas.
- **«La regla de ESLint está configurada»** — un paquete sin script `lint` se saltea **en silencio** desde la raíz; turbo no falla por una task ausente.
- **«`add-semantic-label.patch → {}`»** — **era un punto ciego disfrazado de evidencia** mientras el chunker necesitaba ramificar por `label`. Sólo vale acompañado de `cohesion` y de T17.
- **«Los umbrales del panel»** — 0.55 / 0.60 / 0.68 / 0.72, todos con justificación elaborada y ninguno con dato. Cero información hasta que T9 los mida.

---

## 11. Lo único bloqueado en una decisión tuya

**`DocumentLineageId` — el sistema no sabe que el upload B es una versión nueva del documento A.**

Es el hallazgo que ninguna de las dos patas del ejercicio había pedido y que **invalida una prueba, no una decisión de diseño**. En `apps/api/src/modules/ingest/` la unidad es `fileId`, un re-upload es un `File` **nuevo**, y el processor hace `deleteByFile(fileId)` **antes** de parsear — la versión anterior se destruye antes de que la identidad pueda calcularse. `translateSource` recibe `documentId` del llamador y nadie define quién lo asigna.

Sin esto, **T9 pasa porque el arnés de test fabrica la precondición**, y toda la maquinaria de §5 es inejecutable en producción.

Tres caminos, y es decisión de producto:

| | Qué implica |
|---|---|
| **(a) El usuario declara el reemplazo** — "esto reemplaza a aquel archivo" en la UI | Explícito y correcto. Requiere UI y un campo en `File`. |
| **(b) Se infiere** por `nombre + areaId + uploaderUserId` | Cero UI. Falso positivo cuando dos archivos distintos comparten nombre en un área. |
| **(c) Se difiere** — `diffElements` sale del alcance con la misma claridad que P11, y T9 baja de "la validación del mecanismo" a **diagnóstica** | Honesto. Deja la identidad como capacidad diseñada y no ejercitada. |

**Recomendación: (c) para esta prueba, (a) para producción.** Dejar `diffElements` dentro dependiendo de una precondición no asignada es peor que sacarlo — es exactamente el tipo de verde falso que el resto del documento persigue.

---

## 12. Estructura, dependencias y orden de implementación

```
apps/demo-pipeline/src/
├── core/                    ══ NÚCLEO — nadie lo toca al sumar un adaptador ══
│   ├── ir.ts                5 primitivas, SemanticLabel, Cohesion, DocumentMeta, Confidence
│   ├── invariants.ts        AssertNever<NoNesting<Content>>
│   ├── adapter.ts           SourceAdapter<C>, Emitter, TranslateContext<C>, drafts
│   ├── text-layer.ts        TextLayer + TextLayerBuilder — el sistema de coordenadas  (§4)
│   ├── selectors.ts         deriva el par WADM de UN cómputo. Selector es SALIDA, no entrada
│   ├── ids.ts               structuralPath POR PADRE (invariante), contentHash
│   ├── emitter.ts           pila de scopes, array plano, sequence, resolución de Choice,
│   │                        derivación de confidence desde Capabilities (P5c)
│   ├── registry.ts          createRegistry, select por score con traza
│   ├── translate.ts         → elements + diagnostics + report
│   ├── grid.ts              flattenCellParts, normalización de spans           (§9.2)
│   ├── consume.ts           visitor por TIPO MAPEADO, no switch                (hallazgo H)
│   ├── index.ts             DocIndex, childrenOf, breadcrumbOf, readingOrder   (P8b)
│   ├── reconcile.ts         3 pases: anclas únicas → alineación → similitud    (§5)
│   └── validate.ts          integridad referencial, orden topológico, unicidad
├── adapters/
│   ├── index.ts             createRegistry([...]) — el tercero entra ACÁ y en ningún lado más
│   ├── html/                parse · mark (ex-prune) · shape · recognize · table · image
│   └── notes/               segment · classify
├── consumers/chunk.ts       corta por `cohesion`, serializa grillas enteras, breadcrumb
├── demo/run.ts + fixtures/
└── ../typetests/            T1 (no-compilación) + T12 (patches)
```

**Dependencias.** No hay parser de HTML en el monorepo (ni `cheerio`, ni `parse5`, ni `linkedom`, ni `jsdom`). Se propone **`parse5`** — spec-compliant, es lo que usa `jsdom` por debajo, sin API de jQuery que invite a filtrar selectores. Cuál se elige es indiferente: vive detrás de `adapters/html/parse.ts` y T2 verifica que no se importe desde el núcleo.

**Runner.** `node --test` + `tsx` — built-in en Node 25, cero dependencias nuevas. Con script `test` en `package.json` y task en `turbo.json`, porque un paquete sin script se saltea en silencio.

```bash
pnpm --filter @savia-os/demo-pipeline test
```

### Orden

1. **Andamio** — `package.json`, `tsconfig.json` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `turbo.json`, `parse5`, `node --test`.
2. **`core/ir.ts` + `invariants.ts` + `typetests/`** — los tipos y **la suite de no-compilación primero**. T1 tiene que estar roja antes de que exista una línea de adaptador; si no, "el compilador lo impide" nunca se verifica.
3. **`core/text-layer.ts` + `selectors.ts` + T16** — el sistema de coordenadas antes que nada que lo use.
4. **`core/emitter.ts` + `translate.ts` + `validate.ts`** con T6/T7/T8 sobre documentos generados. Sin adaptadores reales: un adaptador de test que narra árboles sintéticos es **mejor** evidencia.
5. **`core/consume.ts` + `index.ts` + `consumers/chunk.ts` + T17**.
6. **`adapters/html/`** — `parse` → `mark` (T13) → `shape` (T12) → `recognize` → `table` (T10, T14, T15) → `image`.
7. **`adapters/notes/`** — habilita T5 y T11.
8. **⚠️ La firma del TERCER adaptador, sin implementarlo** — un adaptador **grid-nativo** (XLSX: hojas que *son* grillas) o **temporal** (audio con timestamps), sólo el manifiesto, el mapeo a IR y que **typechequee**. Es lo único que puede falsar el diseño; dos adaptadores de flujo de texto no. Va **antes** que el diff, porque si el IR se rompe acá, `reconcile.ts` se escribe sobre una base equivocada.
9. **`core/reconcile.ts` + T9** — al final. **Depende de la decisión de §11.**
10. **`demo/run.ts`** — el CLI, último. Es la demo, no la evidencia.
11. **T3 y T4** — al cierre. T4 exige el tag `baseline` antes de empezar el tercer adaptador.

---

## 13. Fallas conocidas, nombradas

- **Grillas desde la raíz.** Para formatos donde la grilla *es* el documento (XLSX), el piso hace que una hoja entera sea **un elemento no actualizable individualmente** — la negación de la propiedad 3 para el 100% del archivo. Mitigación cuando llegue: bandeo con `window {rowStart, rowCount}` cortado por **anclas estables** (repetición de encabezado, filas en blanco, cambio de esquema por columna), **nunca por conteo fijo** — con conteo fijo, insertar una fila arriba renumera todas las bandas y destruye la identidad de todas.
- **`isGridLike` es un descarte silencioso.** `choice` cubre ambigüedad entre hojas y grillas, pero la decisión grid-vs-container del adaptador HTML no pasa por ahí.
- **P11 — emisor de stream (`open`/`close`).** Deuda aceptada y diferida: sin un adaptador de streaming real construido, resolverlo sería diseño especulativo.
- **Duplicación en celdas ricas.** La regla *"un elemento alcanzado por `detailRefs` no produce chunk propio"* **no es expresable en tipos**. Cualquier consumidor que no sea el chunker la reintroduce.
- **Ambigüedad irreducible con contenido duplicado.** Dos elementos byte-idénticos, uno borrado: el LCS no puede saber cuál. Mismo residuo que `git`.
- **Gaps de preservación nombrados, no modelados:** z-order de shapes PPTX, orden de build/reveal de animación, `w:ins` pendiente de DOCX, roles ARIA positivos como señal de importancia.
- **`DocumentProperty.key` es un string abierto y `DocumentMeta` sí viaja al consumidor.** Nada impide `key: 'html:og:title'` y que un producto ramifique por eso a propósito. Mitigación: convención de namespace por **esquema**, no por formato, más lint de prefijos. Es más débil que el enforcement estructural sobre elementos, y hay que decirlo.
