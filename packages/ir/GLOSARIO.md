# Glosario — el plan está en español, el código en inglés

**Congelado el 2026-08-12.** Es la autoridad de nombres del pipeline. Se decide una
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
fronteras.mjs → boundaries.mjs    proyeccion.mjs  → projection.mjs
citas.mjs     → citations.mjs     invariantes.mjs → invariants.mjs
```

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

## La regla que gobierna a este documento

**Si un término no está acá y ninguna regla de §2 lo determina, no se inventa: se
agrega acá primero.** Es la misma regla que `README.md` impone para los tipos — un
nombre nuevo es un cambio de contrato y tiene que verse como tal en el diff.
