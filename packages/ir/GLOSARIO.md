# Glosario — el plan está en español, el código en inglés

**Congelado el 2026-08-12.** Se amplía solo por la regla del cierre —un término que
ninguna regla determina se **agrega acá primero**— y cada ampliación va fechada y con
su razón: §7 es la del bloque 3. Es la autoridad de nombres del pipeline. Se decide una
sola vez, acá, para que la reescritura y los doce adaptadores no tengan ni una
decisión de nombre adentro — que es la parte que se degrada cuando se improvisa
archivo por archivo.

**Son reglas, no un diccionario.** Una versión anterior listaba 150 pares, de los
cuales unos 130 salían solos de aplicar seis reglas. Una regla es estrictamente mejor
que una fila: se puede verificar con un script, una fila hay que ir a consultarla. Y
cubre lo que la tabla no cubría — los **116 nombres de campo**, que son lo que más se
lee (`node.authorship.when` se escribe una vez y se lee siempre).

---

## 1 · Qué idioma va en cada capa

| Capa | Idioma | Por qué |
|---|---|---|
| **Identificadores** — tipos, funciones, campos, constantes | **inglés** | Es código |
| **Valores literales** — los vocabularios cerrados | **inglés** | No son nombres, son **datos**: van a Postgres y al payload de Qdrant |
| **Mensajes de error** — `IR-ERR: …` | **inglés** | Son salida del sistema |
| **Comentarios y docstrings** | **español** | Es el razonamiento, ya escrito y afinado. Cambia el idioma, no el argumento |
| **Anclas de cita** — `§{Tramo 3 › Qué sale}` | **español** | Apuntan a secciones del plan. Se eligió mantenerlas **legibles** en vez de anclar por un id opaco |
| **El plan y los borradores** | **español** | Son documentos de producto |

> **El costo, dicho de frente:** quien no hable español tiene el código pero no el
> porqué. Y en este paquete el porqué es la mitad del valor — los docstrings explican
> por qué la marca no puede ser `never`, por qué la ausencia no puede codificar nada,
> por qué el anidamiento se impone con el grafo y no con tipos. Eso es lo que impide
> que alguien «simplifique» un invariante y lo rompa. Se aceptó porque retraducir esa
> prosa la degrada.

---

## 2 · Las reglas de composición

Aplicadas en orden. Si dos reglas compiten, gana la de más arriba.

| # | Regla | Ejemplos |
|---|---|---|
| **R1** | **Si hay una sola palabra correcta en inglés, esa es** — cognados (`-ción→-tion`, `-dad→-ity`) y traducciones llanas. **Salvedad: el cognado es la primera opción, no la última palabra.** Si el cognado significa otra cosa en inglés, gana el término de dominio | `Ubicación→Location` · `dueño→owner` · `hoja→sheet` · `ancho/alto→width/height` · pero `recepción→intake` (no `reception`, que es un lobby) y `epigrafe→caption` (no `epigraph`) |
| **R2** | **Raíz + modificador**, y en inglés el adjetivo va **adelante** | `Nodo→Node` ⇒ `NodoCrudo→RawNode`, `NodoEmitido→EmittedNode` · `Miga→Breadcrumb` ⇒ `MigaEstable→StableBreadcrumb` |
| **R3** | **Todo predicado lleva `is*`**, empiece o no con `es*` en español | `esNodo→isNode` · `esNodoFila→isRowNode` · `parLegal→isLegalPair` |
| **R4** | `como*` → `as*` | los 16 constructores de marca: `comoElementId→asElementId` |
| **R5** | **`Máximo/…` → `max*` y `Mínimo/…` → `min*`**, como prefijo. Las cuatro formas de género y número colapsan en una | `msMáximo→maxMs` · `nodosMáximos→maxNodes` · `bytesMaterializadosMáximos→maxMaterializedBytes` · `similitudMínima→minSimilarity` · `certezaMínima→minCertainty` |
| **R6** | `Clave*` / `clave*` → `*Key` | `ClaveDeCache→CacheKey` · `ClaveEmbedding→EmbeddingKey` · `claveDeCampo→fieldKey` |
| **R7** | **`por` → `by` si el símbolo es un mapa o un método** (nombra el criterio); **`per` si es un número** (nombra el denominador). Lo decide el tipo del valor, no la intuición | `porHash→byHash` · `TIPO_POR_FORMA→ROLE_BY_SHAPE` · pero `unidadesPorMarco→unitsPerFrame` · `corridasMáximasPorDocumento→maxRunsPerDocument` |
| **R8** | **Marca de tiempo → sufijo `*At`** | `creadaEn→createdAt` · `sellado→sealedAt` |
| **R9** | **Constante = UPPER_SNAKE del tipo ya traducido** | `Role` ⇒ `ROLES`, `ROLE_BY_SHAPE` · `NivelDeReconocimiento→RecognitionLevel` ⇒ `RECOGNITION_LEVELS` |
| **R10** | **Campos: mismas reglas, `camelCase`** | `versiónAnterior→previousVersion` · `mimeDeclarado→declaredMime` · `autoríaPropia→ownAuthorship` |
| **R11** | **Conector de derivación** — dice de dónde sale algo. `De/Desde → Of/From`, `Para → For` | `CuerpoDe→BodyOf` · `cohesiónDe→cohesionOf` · `certezaDeNivel→certaintyOfLevel` · `tipoDesdeCuerpo→roleFromBody` · `TipoPara→RoleFor` |
| **R12** | **Conector de unidad** — dice en qué se mide. `En/Entre` **no se traduce: la unidad pasa a sufijo** | `tamañoObjetivoEnCaracteres→targetSizeChars` · `límiteDelModeloEnTokens→modelLimitTokens` · `solapamientoEntreFragmentos→fragmentOverlapChars` |

> **R11 y R12 son dos reglas y no una** porque `De` y `En` nunca fueron el mismo
> conector. Aplicar una sola al pie de la letra produce `roleStartBody`, que no
> significa nada. Y el sufijo de R12 no es invención: R5 y R8 ya producen `maxMs` y
> `maxMaterializedBytes` — es la convención del archivo, y la de cualquier objeto de
> configuración (`timeoutMs`, `maxSizeBytes`). Conserva la unidad, que es lo que
> `params.ts` promete llevar en cada número.

> **Si una regla determina el nombre, no va en este documento.** Solo se lista lo que
> podía ir para otro lado.

---

## 3 · Las raíces

Todo lo demás se deriva de acá por las reglas de §2.

| Español | Inglés | | Español | Inglés |
|---|---|---|---|---|
| `Forma` | `Shape` | | `Ubicación` | `Location` |
| `Cuerpo` | `Body` | | `Coordenada` | `Coordinate` |
| `Nodo` | `Node` | | `Caja` | `Box` |
| **`Tipo`** | **`Role`** ⚠ | | `Celda` | `Cell` |
| `Cohesión` | `Cohesion` | | `Miga` | `Breadcrumb` |
| `Certeza` | `Certainty` | | `Huella` | `Fingerprint` |
| `Pista` | `Hint` | | `Marca` | `Brand` |
| `Grano` | `Grain` | | `Autoría` | `Authorship` |
| `Fragmento` | `Fragment` | | `Adaptador` | `Adapter` |
| **`Registro`** | **`DataRecord`** ⚠ | | `Sonda` | `Probe` |
| `Ingesta` | `Ingestion` | | `Evidencia` | `Evidence` |
| `Ventana` | `Window` | | `Anotación` | `Annotation` |
| `Rebanada` | `Slice` | | `Fuente` | `Source` ⚠ |
| `Unidad` | `Unit` | | `Presupuesto` | `Budget` |
| `Prueba` | `Proof` ⚠ | | | |

> **`Prueba → Proof` entra en el bloque 4** (§8, D8) y no estaba acá: R1 admitía
> `Proof` y `Test`, y `Test` era el falso amigo exacto. Con la raíz puesta, los once
> `*_PROOFS` de `invariants.ts` salen solos por R2+R9.

---

## 4 · Las decisiones

Las únicas que podían ir para otro lado. Cada una con la razón que no se ve leyendo
la palabra.

### Forzadas por el lenguaje

| Español | Inglés | Qué colisionaba |
|---|---|---|
| `Registro` | **`DataRecord`** | `Record<K,V>` **es built-in de TypeScript**. `Record` lo sombrearía en todo el paquete |
| `Clase` (el tipo) | **`Classification`** | `Class` es reservada en JS y arrastra OOP. Es `{role, hint}`: lo que devuelve un clasificador |
| `clase` (el **campo**) | **`kind`** | Es el **discriminante** de una unión (`Marca` lo es: `{clase:"negrita"} \| {clase:"cursiva"} \| …`), y `kind` es *la* convención de TS para el tag. §4 descartó `Kind` para nombrar los 15 roles, donde era relleno; como nombre de discriminante es el idioma del lenguaje. Arrastra `ClaseDeEnriquecimiento → EnrichmentKind` |
| `TipoCelda` | **`CellType`**, campo `type` | Es un **tipo de dato** (`text\|number\|date\|boolean\|empty`), no un rol semántico: `CellRole` diría algo falso. §4 evitó `Type` pelado por ruidoso; en un compuesto no se confunde con la palabra clave |

> **`type` y `kind` conviven a propósito.** `cell.type` describe *qué dato hay adentro*;
> `mark.kind` dice *cuál variante de la unión es*. Usar la misma palabra para los dos
> sería lo confuso.
| `SeñalDeCancelación` | **`CancellationSignal`** | `AbortSignal` colisiona con el built-in del DOM |

### Elegidas

| Español | Inglés | Por qué no la obvia |
|---|---|---|
| **`Tipo`** | **`Role`** | No `Type` (ruido en un archivo lleno de `type`) ni `Kind` (palabra de relleno). **`role` es el término del dominio**: PDF etiquetado, PDF/UA y HTML/ARIA lo usan para «qué ES esto semánticamente, con independencia de cómo se ve». Y se contrapone solo con `Shape` — *shape* es cómo se ve, *role* es qué hace |
| `Via` | **`Linkage`** | Valores `parent · level · cell · spatial · none`: es **cómo** se supo el padre. «Via» en inglés es preposición, no sustantivo |
| `Eslabón` | **`CascadeLink`** | `Link` a secas necesitaría un comentario para saber de qué link habla, y un nombre que necesita comentario no es más legible |
| `HashMateria` | **`MatterHash`** | «Materia» es del dominio: la sustancia descomponible. `Material` sugiere otra cosa |
| `Evidenciador` | **`EvidenceFn`** | `Evidencer` no existe en inglés |
| `bajas` / `altas` | **`removals`** / **`additions`** | Ids que dejaron de existir y que aparecieron. `deletions` nombra la acción; `removals` es la baja del padrón, que es el sentido. Van juntas porque son el par |
| `dentroDe` | **`within`** | No `insideOf`. Es la recursión de la cita encadenada — «la imagen **dentro de** la página 3» |
| `anclaje` | **`anchoring`** | Es la **métrica** —fracción de nodos que ancló—, no el acto |
| `NodoConRuta` | **`RoutedNode`** | No `NodeWithPath`: la ruta no es un campo que lleva, es algo que ya se le hizo |
| `Fuente` | **`Source`** | En español significa también *tipografía*. `Source` fija cuál de las dos |
| `Marca` (estilo inline) | **`Mark`** | Hay **dos** `Marca` y no son parientes: la de `formas.ts:80` es una marca de estilo sobre el texto (negrita, enlace), no la técnica de tipado nominal. `Mark` es el término de mdast/ProseMirror. La colisión era del español; en inglés `Brand` y `Mark` son palabras distintas. Arrastra `marcas → marks` |
| `COHESIÓN` (la tabla) | **`COHESION_BY_ROLE`** | Sin la tilde quedaba a **una letra** de `COHESIONS`, y son cosas distintas — un mapa parcial y un arreglo de valores. Un typo intercambiaría `COHESION[role]` por `COHESIONS.includes(x)` y **los dos compilan**. Sigue el precedente `ROLE_BY_SHAPE` (R7+R9) |
| `rango` | **`rank`** / **`range`** | Son dos: `rango(nivel)` es un **rank** ordinal (`indexOf`, lo que reordena la cascada); `Fuente.rango(desde,hasta)` es un **range** de bytes. R1 los colapsaría |
| `pendientes` (campo) | **`deferred`** | Choca con `Pending<T>`, que es otra cosa. Nombra el trabajo postergado en vez de su estado — y `PROVISIONAL(#54)` **ya sospecha que el campo sobra**: `deferred` mantiene visible esa pregunta, `pending` la disfraza de estado normal |
| `recepción` | **`intake`** | El cognado `reception` es un lobby de hotel. Ver la salvedad de R1 |
| `admiteSatelite` | **`acceptsSatellite`** | Y su parámetro `cohesiónDelFragmentoVivo → openFragmentCohesion`: `open` no es metáfora nueva —`lead` ya «marca dónde **abre** un chunk»—, `live` sugiere tiempo real y `current` pierde que el fragmento puede no existir |
| `Marca.destino` | **`href`** | Es el destino de un enlace; `destination` es vago |
| `RefObjeto` | **`ObjectRef`** | El original ya venía abreviado |
| `TipoConFormaObligada` | **`RoleWithRequiredShape`** | El precedente `RoutedNode` era *un nodo al que se le hizo algo*; esto es *un subconjunto definido por una propiedad*, y ahí `With` es correcto |
| `MapaObligado` | **se borra** | `type MapaObligado = typeof FORMA_OBLIGADA`, privado y usado dos veces. Se reemplaza por `typeof REQUIRED_SHAPE` en sus dos usos: cero nombres nuevos y **una pieza menos** |
| `Nominal` | **`Nominal`** | **No cambia.** Es el nombre correcto de la técnica y el docstring lo explica |

> **`Classification` en `classification.ts` se acepta.** Un módulo que exporta un tipo
> homónimo es común (`Error` en `error.ts`) y no causa un bug. Renombrar el archivo
> contradiría §6; `ClassificationResult` agrega una palabra para un problema cosmético.

### Lo que la traducción arregla gratis

Cuatro ambigüedades del español que el inglés separa solo — no hay que hacer nada,
pero conviene saber que se ganan:

| Hoy | Problema | En inglés |
|---|---|---|
| `cita` | significa *blockquote* **y** *citación* (`citas.mjs`, «la cita encadenada») | `quote` vs `citation` |
| `de`/`a` y `desde`/`hasta` | casi-sinónimos para conceptos distintos: una **transición** entre niveles y un **rango** de caracteres | `from`/`to` vs `start`/`end` |
| `codigo` y `código` | conviven, con y sin tilde | `code`, una sola forma |
| `padre`, `padreLocal`, `parentId` | el código ya está a medio traducir | `parent`, `localParent`, `parentId` |

> ⚠ **Una que el inglés NO unifica, y hay que respetar:** `encabezado` es dos cosas
> distintas. Como **rol** es el encabezado de página que se repite → `page_header`.
> Como **campo** de una grilla es la fila de títulos de columna → `headers`. Traducir
> los dos igual perdería la distinción que el español hacía por contexto.

---

## 5 · Los vocabularios cerrados — **son datos, no nombres**

Van a filas de Postgres y al payload de Qdrant. Hoy cambiarlos es gratis porque el
tramo 7 no existe y nada está persistido; después es una migración.

**`SHAPES`** y **`COHESIONS`** — sin cambios, ya estaban en inglés:
```
text_span · verbatim · asset · grid · fields · container
lead · satellite · solo · normal
```

**`ROLES`** — los 15, de español a inglés:

| | | | | | |
|---|---|---|---|---|---|
| `titulo`→`heading` | `subtitulo`→`subheading` | `parrafo`→`paragraph` | `cita`→`quote` | `lista`→`list` |
| `lista_ordenada`→`ordered_list` | `tabla`→`table` | `campos`→**`fields`** | `codigo`→`code` | `formula`→`formula` |
| `imagen`→`image` | `epigrafe`→**`caption`** | `nota_al_pie`→`footnote` | `encabezado`→**`page_header`** | `pie`→**`page_footer`** |

Las cuatro que no son obvias:

- **`epigrafe` → `caption`.** Falso amigo: un *epigraph* en inglés es la cita que abre
  un capítulo; el texto al pie de una figura es un *caption*.
- **`encabezado`/`pie` → `page_header`/`page_footer`.** Único lugar donde alargar
  compra legibilidad: sin el prefijo, `header` y `heading` se confunden, y son cosas
  distintas — uno se repite en cada página, el otro titula una sección.
- **`campos` → `fields`**, aceptando que el piso físico queda `fields: "fields"`. En
  los otros cinco pares la forma y el rol son palabras distintas; acá **coinciden de
  verdad**, y decirlo es honesto. `key_values` agregaría una palabra sin agregar
  significado.

> Seis de los quince (`paragraph`, `code`, `image`, `table`, `fields`, `list`) son la
> respuesta del **piso físico** — derivables de la forma. Los otros nueve la
> contradicen, y son los que hacen que el eje semántico exista. El análisis completo
> de qué nivel de la cascada detecta cada uno vive en el plan, no acá.

**El resto:**

| Vocabulario | Traducción |
|---|---|
| `LINKAGES` | `padre · nivel · celda · espacial · ninguna` → `parent · level · cell · spatial · none` |
| `CHANNELS` | `chat · frontend · carpeta · conector` → `chat · frontend · folder · connector` |
| `CERTAINTIES` | `declarado · inferido` → `declared · inferred` |
| `RECOGNITION_LEVELS` | `declarativo · fisico · posicional · perceptual` → `declarative · physical · positional · perceptual` |
| `DOCUMENT_STATES` | `recibido · reconociendo · indexando · indexado …` → `received · recognizing · indexing · indexed …` |
| `Mark['kind']` | `negrita · cursiva · subrayado · tachado · codigo · super · sub · enlace` → `bold · italic · underline · strikethrough · code · superscript · subscript · link` |
| `CellType` | `texto · numero · fecha · booleano · vacio` → `text · number · date · boolean · empty` |
| `Grain` | `fila · entero` → `row · whole` |
| `Window['scope']` | `entero · region · rango` → `whole · region · range` |
| `Coordinate['space']` | `fuente · texto · grid · visual` → `source · text · grid · visual`, **más `time`** |
| `EnrichmentKind` | `descripcion · ocr · transcripcion` → `description · ocr · transcription` |

> **`entero` → `whole`, en los dos vocabularios donde aparece.** R1 también admitiría
> `integer`, que sería **el sentido exactamente equivocado**: acá `entero` no es un
> número, es «el objeto completo», opuesto a «por fila» o «una región». Que aparezca
> dos veces con el mismo sentido obliga a traducirlo igual las dos.
>
> **`superscript`/`subscript`, no `sup`/`sub`.** Los cortos son los tags de HTML; los
> largos son lo que usan mdast y ProseMirror, y son datos que un humano lee.
>
> **`Coordinate['space']` tiene dos colisiones que conviene mirar de frente.**
> (1) `"source"` es el mismo string que la raíz `Fuente → Source`, que ya lleva ⚠: el
> tipo de adaptador y el espacio de coordenada van a compartir literal en el payload
> de Qdrant. Es benigna —los dos significan «toda la fuente»— pero es una decisión, no
> un accidente. (2) `"grid"` **ya es un valor de `SHAPES`**. Hoy también colisiona en
> español, así que la traducción no lo empeora; se deja porque son dominios distintos
> y el discriminante los separa. Renombrar cualquiera de los dos es un cambio de
> DATOS: hoy gratis, después una migración.
>
> **`time` es una restitución, no un agregado.** El diseño predecesor declaraba un
> espacio de intervalo temporal que el código perdió al degradar `'fragment'` en
> `'visual'`. Entra como quinta variante plana con `start`/`end` en **milisegundos
> enteros** desde el inicio del medio e intervalo **medio abierto `[start, end)`** —
> la misma convención que `Fuente.rango` (bytes) y que la variante `text` (code
> points)—. El caso mixto (un fotograma con una caja dentro de un tramo de video) se
> expresa **encadenando `Location.within`**, no metiendo dos ejes en una variante.
> `SourceRange` **no** se amplía: sigue siendo solo `grid`.

---

## 6 · Nombres de archivo y marcadores

**Los archivos siguen la traducción:**

```
formas.ts       → shapes.ts          proyeccion.ts   → projection.ts
clasificacion.ts→ classification.ts  invariantes.ts  → invariants.ts
identidad.ts    → identity.ts        adaptador.ts    → adapter.ts
ubicacion.ts    → location.ts        salidas.ts      → outputs.ts
```

**Los scripts guardianes también**, junto con su salida — son parte del sistema:

```
fronteras.mjs → boundaries.mjs    citas.mjs    → citations.mjs
mutantes.mjs  → mutants.mjs       proyeccion.mjs → projection.mjs   ✔ hecho
```

> **Esta lista tuvo dos errores hasta el bloque 4.** Nombraba `invariantes.mjs`, que
> **no existe en este paquete** —está en `packages/emision`, y se coló al copiar su
> lista de scripts—, y omitía `mutantes.mjs`, que sí existe: no estaba escrito porque
> el corredor de mutación nació después de esta sección. Un guardián que la lista no
> nombra es un guardián que el rename se olvida, y **un guardián que no corre no avisa
> que no corrió**.

**Un guardián NUEVO nace en inglés.** La lista de arriba son renombres, y no decía
nada del caso nuevo. El precedente ya existía —`numbers.mjs` nació así en el bloque 1—
y `geometry.mjs` lo sigue en el bloque 2. Los renombres, en cambio, esperan a que se
traduzca el último archivo que el guardián nombra, para no abrir dos veces la ventana
en que un docstring cita un archivo que ya no existe.

**Los marcadores grepeables:**

| Hoy | Queda | Por qué |
|---|---|---|
| `PROVISIONAL(...)` | `PROVISIONAL(...)` | Es palabra inglesa: funciona igual |
| `PENDIENTE(...)` | **`PENDING(...)`** | No lo es — y el tipo `Pendiente<T>` sí pasa a `Pending<T>`. Dejarlos en idiomas distintos diciendo lo mismo sería incoherente |

---

## 7 · Bloque 3 — los nueve que ninguna regla determinaba

**Agregado el 2026-08-13**, antes de escribir una línea de `projection.ts` /
`outputs.ts`, por la regla del cierre: «si un término no está acá y ninguna regla de
§2 lo determina, no se inventa: se agrega acá primero». Los nueve estaban en esa
situación. Cada uno con la razón que no se ve leyendo la palabra.

| # | Español | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **G1** | `concatenar` | **`encodeParts`** | R1 daría `concatenate` y la **salvedad de R1 se dispara**: el cognado nombra justamente lo que la función **no** es — su propio docstring dice «ni separador improbable ni **concatenación desnuda**». Es una codificación con longitud prefijada, inyectiva por construcción. `encodeParts` la pone en la familia que el archivo ya tiene —`encode`, `encodeWindow`—, que son las otras dos serializaciones inyectivas del paquete **y las dos la llaman a ella** |
| **G2** | `MARCA_NODAL` / `EsNodo` | **`NODE_BRAND`** / **`BrandedAsNode`** | La constante sale de R2+R9. Para la interfaz, R3 (`es*→is*`) daría `IsNode`, que queda **a una mayúscula** de `esNodo→isNode` —el type guard de `invariantes.ts`, ya listado en R3— y son cosas distintas: un tipo y un predicado. `NodeBrand` nombraría el **símbolo**, no la interfaz. `BrandedAsNode` dice qué le pasa a quien la extienda (`Node = RawNode & {authorship} & BrandedAsNode`), y sigue el precedente `Eslabón→CascadeLink`: gana el nombre que no necesita comentario |
| **G3** | `Valor` | **`FieldValue`** | R1 da `Value`, correcto y vacío: queda a un carácter de `Vector.values` y de `DataRecord.values`, que son otra cosa. `RecordValue` reimporta la confusión con `Record<K,V>` que obligó a `Registro→DataRecord`. `FieldValue` nombra el dominio y ata con **`claveDeCampo→fieldKey`**, que es exactamente la política de claves de estos pares. Campos: `etiqueta→label`, `valor→value` (R10) |
| **G4** | `Anotador.mirar` | **`propose`** | R1 da `look`, que en inglés nombra un acto de observación y no dice qué devuelve. El método devuelve **`ProposedAnnotation[]`** y el docstring del tipo abre con «lo que un anotador **propone**». Con `propose`, el método y su tipo de retorno son la misma palabra y el contrato se lee solo |
| **G5** | `parcial · fallido · rechazado · en_espera` | **`partial · failed · rejected · on_hold`** | Los tres primeros son R1. El cuarto no: `queued` afirma una cola con orden, que el contrato no declara (y §{Tramo 1 › El registro} dice explícitamente que las transiciones no están); `waiting` no dice esperando qué. `on_hold` dice «retenido por algo de afuera», que es el caso que el docstring nombra — «un documento guardado pero no escaneado». **Snake**, como el resto de los vocabularios (`page_header`, `text_span`, `ordered_list`) |
| **G6** | `NIVELES_LOGRADOS` | **`ACHIEVED_LEVELS`** = `structured · plain_text · mixed` | R9+R1 para el nombre. El valor `texto plano` lleva **espacio** y ninguno de los otros vocabularios lo hace: pasa a `plain_text` por la misma convención snake de §5 |
| **G7** | `Anotación.origen` | **`origin`** = `automatic · human` | El campo sale de R1. Los dos valores no estaban en §5 y son R1 llana. Se listan acá porque son **datos** (§5) y hoy cambiarlos es gratis |
| **G8** | `DENOMINADOR_DE_ANCLAJE = "viejo"` | **`ANCHORING_DENOMINATOR = "old"`** | Nombre por R9 + `anclaje→anchoring` (§4). El **valor** es un vocabulario cerrado de un elemento y tampoco estaba en §5 |
| **G9** | los 12 de `ClaseDeToken` + los 3 marcadores de esquema | ver abajo | No estaban en §5 **y no van a Postgres ni a Qdrant**: van a la **preimagen de la huella** |

### G9 · el único vocabulario cuya traducción mueve identidades

```
forma→shape        ordenado→ordered   esquemaEstado→schemaState   esquema→schema
palabra→word       linea→line         celda→cell                  fila→row
etiqueta→label     valor→value        objeto→object               ventana→window

heredado→inherited   ninguno→none   propio→own
```

Los quince son R1 llana; lo que necesitaba decidirse es **que se traduzcan**.
`encode` serializa `[t.kind, t.text]`, así que **el string de la clase es parte de la
preimagen** y traducirlo cambia el `ContentHash` de todo nodo del corpus — el mismo
evento que `END_OF_ROW` ya documenta como «OJO AL DESPLEGAR». §5 dice que hoy es
gratis «porque el tramo 7 no existe y nada está persistido»; **es el último bloque en
que lo es**.

**Se quedan en `camelCase`** (`schemaState`), contra la convención snake de §5, y a
propósito: los vocabularios de §5 son snake **porque van a filas de Postgres y al
payload de Qdrant**, y estos son los únicos que no van a ninguno de los dos. La
convención que les corresponde es la del archivo que los produce.

Lo que ata este vocabulario a algo es la **tabla de preimágenes canónicas** de
`scripts/projection.mjs` — una preimagen fijada por forma, las seis. Es el mismo
compromiso deliberado que `ROLES.length === 15`: no es un umbral inventado, es un
hecho del contrato atado para que cambiarlo sea un **acto visible**. Sin ella, mover
el vocabulario entero pasa **en verde**: los casos de discriminación comparan cuerpos
*entre sí* y son ciegos a lo que los mueve a *todos*.

### Un rename de guardián que el bloque 3 DIFIERE, dicho de frente

§6 renombra `proyeccion.mjs → projection.mjs` y `fronteras.mjs → boundaries.mjs`, y
aclara que los renombres «esperan a que se traduzca el último archivo que el guardián
nombra».

- `proyeccion.mjs` nombra solo `proyeccion.ts` → **se renombró en este bloque**.
- `fronteras.mjs` nombra `shapes.ts` y `salidas.ts`, y al cerrar el bloque 3 los dos
  están en inglés, así que **por la regla ya calificaría**. Se difiere igual, al
  bloque que traduzca `invariantes.ts`, y la razón es concreta: `invariantes.ts` cita
  `scripts/fronteras.mjs` en prosa, así que renombrarlo ahora abriría exactamente la
  ventana que la regla existe para cerrar — un docstring citando un archivo que ya no
  existe. Va escrito acá como decisión, no escondido como olvido.

> **Cerrado en el bloque 4.** `invariants.ts` se tradujo, y el `git mv` de
> `fronteras.mjs → boundaries.mjs` fue en el **mismo commit** que la línea de prosa
> que lo citaba (hoy `invariants.ts:22-25`). La ventana nunca llegó a abrirse.
> `citas.mjs → citations.mjs` y `mutantes.mjs → mutants.mjs` fueron con él.

### Y tres que el bloque 3 agregó al contrato

No son renombres, así que **nacen en inglés** y ninguna regla de §2 los cubría.

| Símbolo | Por qué así |
|---|---|
| `Fragment.minLevel: RecognitionLevel` | R5 da el prefijo `min*` y §3 la raíz. **Reemplaza a `certezaMínima→minCertainty`**, que prometía «la peor certeza» sobre un tipo del que el paquete **no exporta orden** — y peor: la peor sería el *máximo* mientras el campo se llama `min`. Sobre `RecognitionLevel` el orden ya existe (`rank`, `indexOf`) y es el correcto, y la certeza **se deriva** con `certaintyOfLevel` en vez de almacenarse |
| `Fragment.confidence: { min; hasNull } \| null` | `min` es R5. **`hasNull`** es nombre nuevo: dice si alguno de los nodos agrupados no reportaba confianza. No hay palabra en español que traducir — el campo no existía |
| `CERTAINTY_RANK` / `worstCertainty` | R9 para la tabla; `worst` es la palabra del docstring que el campo prometía y nadie podía computar («la PEOR certeza de los nodos agrupados») |

---

## 8 · Bloque 4 — los ocho que ninguna regla determinaba

**Agregado el 2026-08-13**, antes de escribir una línea de `adapter.ts` /
`invariants.ts`, por la misma regla del cierre que produjo §7. Los ocho estaban en esa
situación: o el cognado de R1 significaba otra cosa en inglés, o R1 admitía dos
palabras correctas y ninguna regla elegía, o el símbolo es un **dato** que §5 no
listaba.

| # | Español | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **D1** | `Diagnóstico` | **`Diagnostics`** | R1 da `Diagnostic`, que en inglés nombra **un hallazgo** (`ts.Diagnostic`), no el canal por el que se reporta — y acá los hallazgos ya tienen nombre propio (`Notice`, `Degradation`), así que el singular se los robaría. El plural es *la* palabra para la facilidad de reporte. Arrastra el campo `Contexto.diagnóstico → Context.diagnostics` |
| **D2** | `Aviso` / `aviso()` | **`Notice`** / **`notice()`** | Tres palabras inglesas correctas y distintas (`Notice`, `Warning`, `Advisory`) y ninguna regla elige. `Warning` **afirma una severidad que el contrato no declara**: el `código` es ABIERTO a propósito (`PROVISIONAL(§{Diagnóstico})`), así que un aviso puede ser una nota informativa. `Notice` es el registro neutro que el sumidero acumula, que es lo que vuelve verificable «ninguna información se descarta en silencio» (§{Invariantes}) |
| **D3** | `ClaseDeGasto` + sus 5 valores | **`SpendKind`** = `ms · nodes · materializedBytes · invocation · expansion` | `clase→kind` da el sufijo (§4, precedente `EnrichmentKind`), pero `gasto` no está en §3 y los cinco valores no están en §5. Gana `SpendKind` sobre `ExpenseKind`/`CostKind` porque el método es `gastar→spend` y **el tipo y el método tienen que ser la misma palabra** — el precedente exacto es G4 (`propose` / `ProposedAnnotation`). Valores en **camelCase**, no snake: no van a Postgres ni a Qdrant (precedente G9) |
| **D4** | `SondaFría.tipoDetectado` | **`detectedFormat`** ⚠ | **`Tipo→Role` daría `detectedRole`, y sería FALSO.** Acá `tipo` no es el rol semántico del nodo: es el **formato del archivo** que la sonda cree haber identificado. Es el caso `TipoCelda→CellType` calcado (§4: «es un tipo de dato, no un rol semántico: `CellRole` diría algo falso»), y por eso **no lo resuelve la raíz `Tipo`**. Entre los dos candidatos honestos gana `detectedFormat` sobre `detectedType` porque el propio docstring del campo dice «nada en el diseño identifica **formatos** por nombre» y porque lo que falta para producirlo es «un catálogo de **firmas**» |
| **D5** | los 6 de `ESCALA_EVIDENCIA` | **`None·Floor·Content·Extension·Structure·Signature`** | No estaban en §5 y **son datos**: los seis nombres son también las claves del objeto `Evidence`. `Piso→Floor` conserva la metáfora que el paquete ya usa en prosa («el piso físico», «el adaptador piso de texto»); `Ninguna→None` empata con `Linkage.none` de §5. Se conserva la **mayúscula inicial**, contra el snake de §5, porque no van a Postgres ni a Qdrant y son claves de un objeto TS (precedente G9) |
| **D6** | `Origen['clase']` | **`channel · delegated`** | R1 llana, pero **son datos** y §5 no los listaba. Se escriben acá porque hoy cambiarlos es gratis y después es una migración — el mismo motivo que G7 |
| **D7** | `NoVaDonde<De,A,M>` | **`NotAssignableTo<From,To,Message>`** | Ninguna regla de §2 lo cubre: es un idiom, no una palabra. Es la semántica exacta de TypeScript y **conserva la dirección**. `Separates<A,B>` se lee simétrico y el operador **no lo es** (`[De] extends [A]` es direccional): sería reimportar el defecto que `Cubre` ya tiene (ver la nota de abajo). `DoesNotFitIn` dice lo mismo con tres palabras |
| **D8** | `Prueba` (raíz, faltaba en §3) | **`Proof`** | R1 admite `Proof` **y** `Test`, y **`Test` es el falso amigo exacto**: el archivo abre diciendo «los invariantes que se verifican en el BUILD y **no llevan test**». Nombrarlos `*_TESTS` diría lo contrario de su tesis. Va a **§3 como raíz** para que los once `*_PROOFS` salgan solos por R2+R9 |

### Los dos vocabularios de runtime que se quedan como están escritos

`EVIDENCE_SCALE` (D5), `Origin['kind']` (D6) y `SpendKind` (D3) son los tres
vocabularios cerrados de `adapter.ts`, y **ninguno de los tres va a Postgres ni a
Qdrant, ni entra en la preimagen de la huella**. Por el precedente G9 —«la convención
que les corresponde es la del archivo que los produce»— conservan su forma actual:
`EVIDENCE_SCALE` en `PascalCase` porque sus valores son las claves del objeto
`Evidence`, `SpendKind` en `camelCase` (`materializedBytes`). **No** snake. Es la
diferencia con §5, y es deliberada: §5 es snake **porque** sus valores son filas.

### Un problema de nombre que la traducción HEREDA, dicho de frente

`Cubre<De, A>` significa «`A` cubre a `De`», pero los parámetros van en el orden
`(De, A)`: el nombre y la lectura van **al revés**. En español pasaba desapercibido;
en inglés `Covers<From, To>` invita a leer «From covers To», que es lo contrario.
Arreglarlo es `FitsIn<Sub, Super>` o invertir el orden de los parámetros — un cambio
de 34 sitios de llamada que **no es traducción**. El bloque 4 **no lo hace**, y lo deja
escrito acá para que sea una decisión pendiente y no un olvido. `NotAssignableTo`
(D7) se eligió justamente para no repetirlo.

### Un escalón que `Evidence` podría subir y NO sube en el bloque 4

`export type Evidence = number` (`adapter.ts`). O sea: **cualquier número es una
`Evidence`**; un `EvidenceFn` puede devolver `42` y el selector lo ordena.
`Nominal<number, "Evidence">` volvería inexpresable un ordinal fuera de la escala y
seguiría permitiendo la aritmética del selector (una marca es una intersección, no un
envoltorio). **No se decide acá** y no es un hueco de nombre: el costo son los seis
constructores del objeto `Evidence` **más los doce adaptadores**, cada vez que
devuelven una evidencia calculada. Es una decisión del dueño del contrato, y va
escrita para que se tome antes de que existan los doce.

---

## 9 · Bloque 3b — un archivo nuevo

**Agregado el 2026-08-13**, antes de moverlo, por la regla del cierre. §6 dice cómo se
llaman los archivos **renombrados** («los archivos siguen la traducción») y cómo nace
un **guardián** nuevo, pero el paquete nunca había agregado un **módulo de `src/`**:
los nueve venían del diseño original y §6 solo los tradujo. La regla no determinaba
el nombre, así que se decide acá.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **E1** | el módulo que aloja `Authorship` | **`src/authorship.ts`** | El archivo se llama como **lo que contiene**, que es el patrón que los nueve ya siguen (`shapes.ts` ⇒ `Shape`, `location.ts` ⇒ `Location`), y §3 ya fija la raíz `Autoría → Authorship`. Los otros dos candidatos nombraban el **motivo** en vez del contenido y los dos prometían de más: `provenance.ts` («la procedencia») y `outside-fingerprint.ts` («lo que no entra en la huella») describen una categoría de la que hoy hay **un solo** miembro —`DelegationId` declara el mismo invariante y **no se movió**—, así que el nombre afirmaría una membresía que el archivo no tiene. El día que `DelegationId` se mude, el rename es el acto visible que corresponde |

> **El archivo no existe por tamaño.** Existe porque una frontera —`projection.ts ↛
> authorship.ts`— es inescribible mientras el tipo viva en `identity.ts`. Está dicho en
> su encabezado y verificado por `scripts/boundaries.mjs`, con su mutante (`M46`).

---

## La regla que gobierna a este documento

**Si un término no está acá y ninguna regla de §2 lo determina, no se inventa: se
agrega acá primero.** Es la misma regla que `README.md` impone para los tipos — un
nombre nuevo es un cambio de contrato y tiene que verse como tal en el diff.
