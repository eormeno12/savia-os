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
| **R4** | `como*` → `as*` | los constructores de marca: `comoElementId→asElementId` |
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
| `Prueba` | `Proof` ⚠ | | `Procedencia` | `Provenance` ⚠ |

> **`Prueba → Proof` entra en el bloque 4** (§8, D8) y no estaba acá: R1 admitía
> `Proof` y `Test`, y `Test` era el falso amigo exacto. Con la raíz puesta, los once
> `*_PROOFS` de `invariants.ts` salen solos por R2+R9.

> **`Procedencia → Provenance` entra en el bloque 3c** (§11, E2). No es una palabra que
> el diseño original tuviera y que la traducción convirtiera: es un nombre **nuevo**,
> para una categoría que el paquete descubrió que tenía. R1 es llana —el cognado es la
> palabra correcta y significa exactamente lo mismo en las dos lenguas—; lo que hacía
> falta decidir es **que la categoría existe y qué la define**, y eso va en §11 con su
> criterio de membresía. La raíz se lista acá porque nombra el módulo `provenance.ts`
> y porque `Autoría → Authorship` pasa a ser un miembro suyo, no un archivo.

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

> **Un rename de inglés a inglés no es de esta lista.** `src/authorship.ts →
> src/provenance.ts` (bloque 3c) no es una traducción: es un cambio de **qué nombra el
> archivo**, de un miembro a la categoría que lo contiene, y por lo tanto una decisión
> de contrato. Va en §11 (E2), con el criterio que decide la membresía. Se anota acá
> para que quien busque nombres de archivo no concluya que el rename no está escrito.

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

> **Cerrado en el bloque 3c: se renombra a `FitsIn<From, To>`, y el orden NO se toca.**
> El criterio es el de D7 aplicado al operador hermano: el nombre tiene que leerse **en
> el orden de los parámetros**, que es exactamente por lo que `NotAssignableTo` le ganó
> a `Separates<A,B>`. Un criterio para los dos operadores, no uno por operador. Se suma
> una razón que en el bloque 4 no estaba escrita: la palabra *covers* **ya tiene dueño
> en el paquete y con la convención contraria** — `windowCovers(exterior, interior)`
> (`shapes.ts`, exportada por el barril) toma primero al que cubre. Invertir el orden
> arreglaba la lectura y dejaba la misma palabra haciendo dos trabajos opuestos;
> renombrar la desocupa.
>
> **Y los sitios de llamada eran 24, no 34.** La cifra de arriba se sostenía a mano
> desde el bloque 4 y era otra que mentía; la de este párrafo sale del AST. Importa
> porque decidió el costo comparado: renombrar toca **solo el nombre del operador**
> —orden de argumentos y mensaje quedan intactos, así que ninguna aserción puede
> cambiar de sentido en silencio y ninguna `espera` del corredor de mutación se
> toca—, mientras que invertir obliga a releer los 24 pares y ahí sí hay un fallo
> **mudo** posible: `_SpacesDeclared` y `_SpacesPresent` son el mismo par en las dos
> direcciones, así que invertir uno y no el otro deja dos copias de la misma aserción,
> las dos en verde, y `M25` o `M45` se queda sin acreditar sin que nada cambie de
> color. Misma lectura arreglada, mucha menos superficie de error.

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

> **Superado por E2 (§11).** El disparador que E1 dejó escrito —«el día que
> `DelegationId` se mude, el rename es el acto visible que corresponde»— se cumplió en
> el bloque 3c. El archivo hoy es `src/provenance.ts`. E1 se conserva entero porque su
> argumento sigue siendo correcto **para su momento**: con un solo miembro, el nombre
> de la categoría prometía de más. Lo que cambió no es el criterio, son los hechos.

---

## 10 · Bloque 5 — `packages/emision → packages/emission`

**Agregado el 2026-08-13**, antes de escribir una línea del paquete, por la misma
regla del cierre que produjo §7 y §8. Es la **primera ampliación que no es sobre
`ir`**: el bloque 5 traduce `packages/emision`, el último paquete en español y el
único dependiente del contrato, y su vocabulario propio —la ruta, el emisor, los
sintéticos— nunca pasó por acá porque no es parte del contrato.

**El paquete pasa a llamarse `@savia-os/emission`, y el directorio con él.** Los
nombres de paquete van en inglés como todo lo demás; no había regla que lo dijera
porque hasta este bloque ningún paquete se había renombrado.

> **Primero, lo que las reglas SÍ determinaban, para que se vea que se consultaron.**
> `Emisor → Emitter`, `Emisión → Emission` y `emitir → emit` salen de R1 con el
> precedente ya escrito en R2 (`NodoEmitido → EmittedNode`), así que **no van en este
> documento**. Tampoco `piso → floor` (§8, D5 ya fijó `Piso → Floor`), `pila → stack`,
> `Estado → State`, `caja → box` ni los cinco `por* → by*` de las estrategias
> (`porNivel → byLevel`, `porCelda → byCell`, `porEspacial → bySpatial`), que son R7
> exacta — «`por → by` si el símbolo es un mapa o un **método**». Los ocho de abajo
> son los que quedaban.

| # | Español | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **B1** | `Ruta` | **`Route`** | R1 admite `Route` **y** `Path`, y ninguna regla elige. Gana `Route` por dos razones concretas. (1) El contrato **ya decidió el verbo**: §4 fija `NodoConRuta → RoutedNode` y descarta ahí mismo `NodeWithPath`, así que la familia `route / routeOf / Routing / RoutedNode` se lee entera y `Path` dejaría a `RoutedNode` hablando de otra cosa. (2) `Path` es la palabra de **rutas de archivo** en este repo —`node:path`, y los propios guardianes tienen un `ruta()` que resuelve rutas de disco—, así que el cognado obvio importaría la ambigüedad justo en el paquete que más la sufre. Arrastra `Ruteo → Routing`, `rutaDe → routeOf` (R11) y el archivo `ruta.ts → route.ts` |
| **B2** | `sinteticos.ts` | **`src/synthetic.ts`** | §6 dice «los archivos siguen la traducción» pero el adjetivo plural no determina nada: había tres candidatos. E1 («el archivo se llama como lo que contiene») apuntaba a **`cases.ts`**, y se descarta porque lo que estos casos tienen de valioso no es que sean casos, es de **dónde salen** —de una mano, sin un adaptador—: `cases.ts` sobreviviría intacto el día que alguien los llenara con la salida de un adaptador real, que es exactamente lo que el archivo existe para no hacer. **`fixtures.ts`** se descarta porque la primera línea del archivo dice «esto **no** es andamio de test». Y singular sobre plural porque `synthetics` en inglés es un sustantivo que nombra telas y compuestos químicos: la salvedad de R1 |
| **B3** | `Contenedor` | **`Ancestor`** | **Es el caso inverso a `Marca → Mark` (§4).** Ahí la colisión era del español y el inglés la deshacía sola; acá el español distinguía `Contenedor` (el nodo ya emitido del que van a colgar los que siguen) del valor `container` de `SHAPES`, y **traducir por el cognado los funde** — en los dos archivos que citan la forma en prosa («el tramo 5 agrupa por container», «`container` no lleva hijos») y en un fixture que se llama `CONTAINER`. No es la trampa de `COHESION`/`COHESIONS` (acá un typo no compila: uno es un tipo y el otro un literal de string), pero sí cuesta un párrafo de desambiguación por lectura. `Ancestor` nombra **para qué se usa el registro** y hace que `desdeContenedor → fromAncestor` se lea solo |
| **B4** | `Falla` | **`Failure`** | R1 admite `Failure` y `Fault`, y no elige. `Fault` nombra la **causa** —el defecto latente— y lo que estos objetos llevan es el **resultado**: son la variante `ok: false` de una unión discriminada. Arrastra `FallaDeRuta → RouteFailure` y `FallaDeEmisión → EmissionFailure` (R2: raíz + modificador, el modificador adelante) |
| **B5** | `Caso.porqué` | **`why`** | R1 admite `why` y `reason`. Gana `why` porque el guardián **imprime el campo detrás de la palabra «porque»** (`importa porque: …`), así que el nombre del campo y la frase que produce son la misma palabra. Es el precedente de G4 (`propose` / `ProposedAnnotation`) aplicado a un campo: el contrato se lee sin ir a buscar el consumidor |
| **B6** | `Marco` (el de delegación) | **`DelegationFrame`** | `Frame` a secas es correcto y **reimporta una homonimia que el español tenía**: `marco` es también el marco de una `Box` (`Box.frame` = `"p3"`, `"slide#7"`), que es otra cosa y vive en el mismo paquete. El nombre largo es el que el propio docstring ya usaba en prosa («un marco de delegación abierto»), así que no agrega una palabra: la escribe |
| **B7** | `Scope` | **`Scope`** — no cambia | Igual que `Nominal` (§4): ya era la palabra inglesa correcta cuando el archivo estaba en español. Se lista para que la ausencia de fila no se lea como un olvido. Su campo `clase` sí pasa a `kind` por §4 (es el discriminante de una unión) |
| **B8** | los valores de `Scope['kind']` y de `*Failure.kind` | **`node · synthetic`** y **`parent-not-emitted`** | Son **datos** y §5 no los listaba, igual que G7 y D6. Los dos primeros son R1 llana. El tercero conserva el **kebab** que ya tenía (`padre-no-emitido`), contra el snake de §5 y por la razón de G9: §5 es snake **porque** sus valores van a filas de Postgres y al payload de Qdrant, y este no va a ninguno de los dos — nace y muere adentro de una unión de TypeScript. La convención que le corresponde es la del archivo que lo produce |

### Los guardianes del paquete, y una regla que §6 no cubría

```
invariantes.mjs → invariants.mjs      citas.mjs → citations.mjs
mutants.mjs                            ← NUEVO, nace en inglés (§6)
```

§6 ya decía que un guardián nuevo nace en inglés y que los renombres esperan al
último archivo que el guardián nombra; los tres archivos de `src/` se tradujeron en el
mismo commit, así que la ventana no llegó a abrirse. Lo que §6 **no** cubría es el
**prefijo de los mensajes de error**: `EMISION-ERR` pasa a **`EMISSION-ERR`** por §1
(«mensajes de error → inglés»), y hay que decirlo porque el prefijo está escrito a
mano en nueve sitios y **ningún compilador lo verifica**. El resto de cada guardián
—identificadores y prosa— se queda en español, que es lo que ya hacen los seis
guardianes de `ir`.

> **La corrección de §6 se cierra acá.** La nota de §6 dice que la lista nombraba
> `invariantes.mjs`, «que **no existe en este paquete** — está en `packages/emision`».
> Sigue siendo cierto que no es de `ir`; el archivo hoy se llama
> `packages/emission/scripts/invariants.mjs`.

---

## 11 · Bloque 3c — la categoría que el 3b no podía nombrar

**Agregado el 2026-08-13**, por la regla del cierre. §9 (E1) eligió `authorship.ts`
—«el archivo se llama como lo que contiene»— y descartó los dos nombres de categoría
por la misma razón: con **un** miembro, nombrar la categoría afirma una membresía que
el archivo no tiene. Este bloque le sumó el segundo miembro y con eso la objeción
caduca, así que el rename se decide acá antes de hacerlo.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **E2** | el módulo que aloja `Authorship` **y** `DelegationId` | **`src/provenance.ts`** (era `src/authorship.ts`) | Con dos miembros, el patrón de E1 —«el archivo se llama como lo que contiene»— **deja de determinar el nombre**: `authorship.ts` pasaría a nombrar a uno de los dos y a esconder al otro, que es peor que nombrar la categoría. Y la categoría existe de verdad, con una razón de fondo **compartida**: la huella contesta ***qué es*** un contenido; la autoría y la delegación contestan ***cómo llegó acá***, y el mismo contenido tiene que dar la misma huella lo traiga quien lo traiga y por el camino que sea. Eso es lo que la palabra *procedencia* nombra, y por eso `provenance.ts` le gana a `outside-fingerprint.ts` —el otro candidato de E1—: aquel nombra la **consecuencia** (no entra en la huella), este la **causa**, y la consecuencia se deriva de la causa pero no al revés. `metadata.ts` y `context.ts` no se consideran: no dicen nada que un criterio pueda aplicar |

### El criterio de membresía — sin él el nombre vuelve a prometer de más

E1 tenía razón en que un nombre de categoría con un solo miembro es una promesa vacía.
Lo que la vuelve **no vacía** no es tener dos miembros: es tener una **regla que decide
el tercero**. Va escrita en el encabezado de `provenance.ts` y se repite acá porque es
una decisión de contrato, no una nota de implementación. Un tipo entra si cumple las
**tres**, y ninguna sobra:

1. **Dice cómo llegó, no qué es.** Responde quién lo trajo, cuándo, por qué camino.
2. **La huella tiene que ser ciega a él.** Dos valores suyos distintos sobre el mismo
   contenido tienen que dar la **misma** huella. Si moverlo *tiene* que mover la huella,
   es contenido y se queda donde está.
3. **Viaja pegado al contenido, no al registro.** `OrganizationId` y `DocumentId` pasan
   (1) y (2) y **no entran**: son la identidad de la fila del tramo 1. Sin (3) el módulo
   se ensancha hasta ser «todo lo que no es cuerpo», que es el defecto exacto que E1 le
   señaló a `outside-fingerprint.ts`.

Lo que el criterio **rechaza**, para que se vea que discrimina: `RawNode.attribution`
tampoco entra en la huella y **no** es procedencia —dice cómo se *reconoció*, no cómo
llegó: falla (1)—; `ObjectKey` falla (1) por el otro lado, porque es direccionado por
contenido.

> **La mudanza arrastró `asDelegationId`, y era obligatorio.** Dejar el constructor en
> `identity.ts` obliga a aquel archivo a importar el tipo de este, y entonces
> `projection.ts → identity.ts → provenance.ts` es un camino real y la frontera **nace
> violada** — el mismo modo de falla que la volvía inescribible en el bloque 3b, con los
> papeles cambiados. Verificado, con el camino impreso. No arrastró nada más:
> `ActorId`, `Instant` y `Nominal` se quedan y se importan, que es la dirección legal.

---

## 12 · Paso 3, fase 1 — el discriminante que decide qué es «la ruta vigente»

**Agregado el 2026-08-13**, antes de escribir la línea, por la regla del cierre. El
paso 3 encontró midiendo que `Hint` no sabía decir «declaro mi id y **heredo** mi
ruta», y la decisión que lo desbloquea —`{linkage:'parent', parent:null}` pasa a
significar «heredo» y «raíz» se dice con `{linkage:'none'}`— **no agrega ningún
nombre**: reusa dos valores que ya están en `LINKAGES` (§5). Lo que sí agrega un
nombre es el arreglo que la decisión destapó en el emisor, y es el único de la fase.

> **Lo que las reglas SÍ determinaban**, para que se vea que se consultaron:
> `Contenedor → Ancestor` y `desdeContenedor → fromAncestor` ya están en §10 (B3);
> `Ruteo → Routing` y `pila → stack` también (B1 y la nota de §10); `referencia →
> reference` es R1 llana. Ninguno va en este documento.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **F1** | el discriminante de `Routing`, y sus dos valores | **`from`** = `stack · reference` | **`kind` era lo que salía solo** —§4 lo fija como *el* nombre del discriminante de una unión, y `Scope.kind` y `RouteFailure.kind` ya lo usan en el mismo archivo— y acá dice **nada**: las dos variantes no se distinguen por «qué clase de cosa son» sino por **de dónde salió la ruta**, que es lo que decide si pasa a ser la pila vigente. Para eso hay regla: **R11**, «conector de derivación — dice de dónde sale algo, `De/Desde → Of/From`». `source` queda descartada por la colisión que §5 ya declara (`Coordinate['space'] = "source"` y la raíz `Fuente → Source`, las dos con ⚠). Los **valores** son **datos** —igual que G7, D6 y B8— y no van a Postgres ni a Qdrant: nacen y mueren adentro de una unión de TypeScript, así que conservan la convención del archivo que los produce (precedente G9), o sea minúscula llana y no snake |

> **Por qué son dos variantes y no un campo booleano.** `opens` vive **solo** en la
> variante `stack`, y eso es lo que vuelve INEXPRESABLE «una ruta por referencia que
> además abre un scope» — que no significa nada, porque la pila no se movió y no hay
> dónde apoyar lo que abre. Es el mismo movimiento que `Scope` (§10, B7): «la regla no
> se puede olvidar porque no se puede escribir de otro modo».

> **Lo que la fase 1 NO cerró, dicho de frente.** `ir/src/classification.ts` no
> documenta qué significa `Hint.parent === null`: lo dejaba a quien caminara la pista,
> y el único que la caminaba era `emission/src/route.ts`. La decisión vive hoy en el
> consumidor, así que un segundo consumidor de `Hint` puede volver a leerlo como
> «raíz». Cerrarlo es una línea de docstring en el contrato y va escrito acá como
> pendiente, no hecho de costado.

---

## 13 · Paso 3a — el tramo 5 y las dos salidas

**Agregado el 2026-08-13**, antes de escribir una línea de `grouping.ts`, por la regla
del cierre. Es la segunda ampliación que no es sobre `ir` —el módulo vive en
`packages/emission`— pero dos de las tres filas SÍ tocan el contrato, así que van acá
y no en una nota del paquete.

> **Primero, lo que las reglas SÍ determinaban.** `Agrupación → Grouping` y
> `agrupar → group` salen de R1 con la raíz `Fragmento → Fragment` de §3.
> `sellar → seal` está implícita en R8 (`sellado → sealedAt`) y da `sealOf` por R11,
> igual que `confidenceOf`, `recordOf` y `worstLevel` (R11 + R5 + el precedente
> `worstCertainty` de §7). **`Open` para el fragmento vivo ya está decidido**: §4 lo
> fija al nombrar `cohesiónDelFragmentoVivo → openFragmentCohesion`, con el argumento
> de que «`open` no es metáfora nueva — `lead` ya marca dónde ABRE un chunk», así que
> `reopen` es R1 sobre esa raíz. `targetSizeChars` es R12 literal. `GroupingCase` es
> R2 sobre el `Case` que el paquete ya tiene, y el guardián nuevo
> `emission/scripts/boundaries.mjs` nace en inglés por §6. **Ninguno de estos va en
> este documento.**

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **F2** | el módulo del tramo 5 | **`src/grouping.ts`** | El patrón de §9 (E1) —«el archivo se llama como **lo que contiene**»— **no determina**, y por una razón concreta: este archivo contiene **dos** salidas, `Fragment` **y** `DataRecord`, así que `fragments.ts` nombraría a una y escondería a la otra. Es el caso de E2 (§11) con los papeles cambiados: allá el archivo pasó de nombrar un miembro a nombrar la categoría; acá **no hay categoría que los contenga** —un fragmento difuso y un registro exacto no son parientes, son el split π/σ—. Lo único que los dos comparten es **el acto**, que es lo que el plan llama «un recorrido, dos salidas», y por eso el nombre es el acto y no el contenido. `grouper.ts` se descarta por el precedente de `Evidenciador → EvidenceFn` (§4): nombrar al agente cuando lo que hay es una función libre |
| **F3** | el fragmento y el registro **antes** de la reconciliación | **`Fragment<Ref>` + `LocalFragment` / `StableFragment`**, ídem `DataRecord<Ref>` | R2 daría `RoutedFragment` por analogía con `NodoConRuta → RoutedNode`, y **el argumento de §4 dice justamente lo contrario**: allí `Routed` se eligió porque «la ruta no es un campo que lleva, es algo que ya se le hizo», y a un fragmento del tramo 5 **no se le hizo** nada — le **falta** algo. El precedente que sí aplica es `Breadcrumb<Ref>` / `LocalBreadcrumb` / `StableBreadcrumb`, que este mismo archivo (`outputs.ts`) ya tiene para el MISMO desajuste, y **eso era un hecho, no una regla**: nadie lo había escrito como tal. Se escribe ahora ⇒ **`Local*` es lo que existe antes de acuñar identidad y `Stable*` lo que existe después; el genérico se llama como el concepto y no lleva sufijo.** Con la regla puesta, las seis salen solas |
| **F4** | dónde viven los nodos-fila sintéticos | **`src/synthetic.ts`**, con `GroupingCase` al lado de `Case` | El plan del paso 3 presupuestaba un archivo aparte (`synthetic-rows.ts`) y **no se hace**. El criterio es el de §10 (B2): lo que estos casos tienen de valioso **no es de qué tramo son, es de dónde salen** —de una mano, sin un adaptador—, y eso es exactamente lo que nombra `synthetic`. Partirlos por tramo parte el archivo por la única dimensión que no los distingue, y agrega una pieza y un nombre con guión que ningún otro módulo del repo tiene. El día que el criterio de `synthetic` deje de aplicarles —por ejemplo si se llenaran con la salida de un adaptador real— el rename es el acto visible que corresponde, igual que E1 lo dejó escrito para `authorship.ts` |

> **La regla de F3, dicha aparte porque vale para todo lo que venga.** El pipeline
> acuña identidad en el paso 11 y **todo lo que se produce antes** tiene el mismo
> problema: referencia nodos que todavía no tienen `ElementId`. Ya pasó tres veces
> —las migas, los nodos (`RoutedNode`/`EmittedNode`) y ahora las dos salidas del
> tramo 5— y las tres veces se resolvió distinto porque la regla no estaba escrita.
> Queda escrita: **el tipo se parametriza por `Ref` y los dos extremos se nombran
> `Local*` y `Stable*`.** `RoutedNode`/`EmittedNode` **no se renombran** —son un caso
> distinto: además del `Ref` cambia la forma— y se anota acá para que la excepción
> sea una decisión y no una inconsistencia.

---

## 14 · Paso 3b — dos paquetes nuevos, y las dos reglas que faltaban

**Agregado el 2026-08-16**, antes de escribir una línea de `packages/adapters` y
`packages/orchestration`, por la regla del cierre. El paso 3b crea **dos paquetes**, y
el documento tenía dos huecos que hasta hoy nadie había pisado: **no había regla para
nombrar un paquete nuevo** (§10 solo renombró uno) y **no había política para los
vocabularios de señales**, que van a ser doce escritos por gente distinta.

> **Primero, lo que las reglas SÍ determinaban**, para que se vea que se consultaron.
> `Sonda → Probe`, `Evidencia → Evidence`, `Adaptador → Adapter`, `Unidad → Unit`,
> `Contexto → Context` y `Fuente → Source` ya están en §3, y los cinco tipos ya viven
> en `adapter.ts`. `seleccionar → select`, `Selección → Selection`, `descomponer →
> decompose`, `detectar → detect` y `enCascada → cascade` son R1 llana (y `CascadeLink`
> ya está en §4). `sondaDe → probeOf`, `sondaFríaDe → coldProbeOf`, `extensiónDe →
> extensionOf`, `registroDe → registryOf`, `fuenteDeBytes → sourceOfBytes`,
> `bloquesDe → blocksOf` e `inlineDe → inlineOf` son R11 exacta. `Marca → Mark` y
> `Marca.destino → href` están en §4; `epigrafe → caption` en §5. **Ninguno de estos va
> en este documento.**

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P1** | cómo nace un **paquete** nuevo | **inglés, y se llama como lo que contiene** — el directorio es el nombre sin el scope | §6 tiene la regla para un guardián nuevo («nace en inglés») y §9 (E1) para un módulo de `src/` («el archivo se llama como lo que contiene»); para un **paquete** solo existía el rename de §10, que dijo «los nombres de paquete van en inglés» y nada más. Un rename no es una regla: no dice qué hacer la primera vez. La regla se compone de las dos que ya existen y no inventa un criterio tercero — y **P2 es su primer caso difícil**, que es la prueba de que hacía falta escribirla y no dejarla implícita |
| **P2** | el paquete de la orquestación | **`@savia-os/orchestration`** (`packages/orchestration/`) | **`Ingestion` está tomado dos veces y ninguna es esta.** Es raíz de §3 (`Ingesta → Ingestion`) y es un **tipo exportado** —`outputs.ts`, «lo que es del documento y NO de la IR»: `document`, `organization`, `owner`, `channel`, `state`—. Un paquete `@savia-os/ingestion` que exporta `ingest()` conviviría con un tipo homónimo que nombra el **envoltorio del documento**, y un `import { Ingestion } from "@savia-os/ir"` adentro de `@savia-os/ingestion` es exactamente la homonimia que este documento existe para evitar (el mismo criterio que forzó `Registro → DataRecord` en §4 y `Contenedor → Ancestor` en §10, B3). Por P1 el paquete se llama como **lo que contiene**, y lo que contiene lo nombra el propio plan: «`ingesta/` — **orquestación de los tramos**» (§{Paquetes}). `pipeline` se descarta por vago —todo el repo es el pipeline— y `spine` porque «la espina dorsal» es una metáfora del plan, no un término del dominio. **El archivo sigue siendo `src/ingest.ts` y la función `ingest`**, por E1: el archivo se llama como lo que contiene, y contiene `ingest` |
| **P3** | los valores de `MdSignals['block']` y **la política para los doce** | **la convención del archivo que los produce**, minúscula llana, y **el formato NO se repite adentro de los valores** | Son **datos** y §5 no los cubre: §5 es snake **porque** sus valores van a filas de Postgres y al payload de Qdrant, y estos **mueren en la unidad** (`Unit.signals`, PROVISIONAL(C25)) — no salen del adaptador. Les corresponde el precedente **G9** («la convención del archivo que los produce»), o sea minúscula llana como `from`/`stack`/`reference` (§12, F1) y no snake. Lo que **faltaba** es la política, y es esta: **cada adaptador es dueño de su vocabulario y ninguno se coordina con los otros once.** Esa independencia es la contracara exacta de que `role` sea cerrado — `role` es cerrado porque **cruza** el borde y va al índice; las señales son abiertas porque **no lo cruzan**, y pedirles coordinación sería pagar el costo de un vocabulario cerrado sin comprar ninguna de sus garantías. El tipo se llama **`<Formato>Signals`** (R2: raíz + modificador adelante) — `MdSignals`, `DocxSignals`, `XlsxSignals` — y por eso los valores **no** repiten el formato: `heading`, no `mdHeading`; el tipo ya lo dice |
| **P4** | el registro de adaptadores | **`Registry`** | §3 traduce `Registro → DataRecord` y la fila parece colisionar: **no colisiona, y conviene decir por qué.** El español `registro` es dos palabras distintas —el *asiento* de una planilla y el *padrón* de algo— y el inglés las separa solo: `Record` y `Registry`. Es el quinto caso de §4 («lo que la traducción arregla gratis»), y es el primero que aparece **después** de que una de las dos mitades ya se hubiera renombrado, así que sin esta fila la lectura natural es que `Registry` contradice a `DataRecord` |
| **P5** | lo que **acumula** `Diagnostics` | **`Sink`** | §8 (D1/D2) nombró `Diagnostics` y `Notice` y dejó sin nombre **lo que las junta**, que es de lo que dependen el estado `partial`, la métrica de degradación y el invariante «nada se descarta en silencio». Los dos métodos de `Diagnostics` devuelven `void`: **lo único que los vuelve verificables es que el destino esté tipado**. `Report` promete un renderizado y `DiagnosticsLog` un flujo ordenado de append; el tipo es dos arreglos y no es ninguna de las dos. `sumidero → sink` es R1, es el término de dominio para el destino de un canal de diagnóstico, y **el par se lee entero**: `Diagnostics` es el lado que escribe, `Sink` el que acumula |
| **P6** | la fábrica del adaptador opaco | **`opaqueOf`** | R11 admite `Of` y `From`, y `roleFromBody` parece el precedente. **No lo es:** `From` es para derivaciones que **cruzan de concepto** —un rol no es un cuerpo—, y acá lo que sale **es** un adaptador, el mismo, con `S` y `E` borrados. `Of` es el conector que dice «el opaco DE este adaptador». `sealAdapter` se descarta porque **`seal` ya está tomado** —`sealOf` en `grouping.ts` sella un fragmento— y un segundo `seal` importaría a mano la homonimia que §4 celebró que el inglés deshiciera. `erase` nombra la operación sobre los **parámetros de tipo**, que es justo lo que a quien la llama no le importa: le importa que lo que sale sea un `OpaqueAdapter`, que es el tipo que `ir` ya declara |
| **P7** | lo que devuelve un eslabón resuelto de la cascada | **`Resolution`** | `Classification & {level, attribution, confidence}` — lo que la cascada sabe y `Adapter.detect` tira (H3). `Resolved` es un **participio**, y los tipos de este repo son sustantivos: `Routing`, `Emission`, `Grouping`, `Classification`. `CascadeResult` nombra al **productor** en vez de a la cosa, que es el defecto que §4 le señaló a `Evidenciador → EvidenceFn`. `Resolución → Resolution` es R1 llana sobre el sustantivo correcto |
| **P8** | lo que devuelve `ingest` | **`Run`** | R1 sobre `Corrida`. `IngestResult` agrega una palabra para no agregar significado (el precedente de §4 con `ClassificationResult`, descartado ahí por lo mismo), y `Ingestion` es P2 otra vez. Gana `Run` porque nombra **una corrida** y no un valor de retorno cualquiera: lo que el objeto lleva —el árbol, las dos salidas, el sumidero, el adaptador que ganó y el nivel alcanzado— es el registro de **qué pasó esta vez**, y es lo que el golden congela |

### Lo que este bloque BORRA, y por qué es una decisión y no una omisión

`MarkdownOptions` **no existe**. El prototipo del paso 3 llevaba las dos decisiones
abiertas —`frontmatterAsFields` y `captionByPosition`— como parámetros de la fábrica,
y eso era correcto **mientras estaban abiertas**: era lo único que hacía las dos ramas
ejecutables y por lo tanto medibles. Las dos se decidieron, así que el parámetro se
borra. **Una opción que sobrevive a su decisión es una configuración, y una
configuración es una decisión que nadie tomó.**

`OpaqueEntry` **tampoco existe**, y era una re-declaración: el prototipo lo escribió
como un registro con los cinco miembros de `OpaqueAdapter`, que `ir` ya exporta y que
`Selection.adapter` ya usa. `README.md` de `ir` lo prohíbe con todas las letras —«si
un tipo de acá hace falta en otro lado, se importa»— y la copia además habría dejado
`Selection.adapter` y `Registry[number]` como dos tipos estructuralmente iguales que
pueden divergir en silencio.

### El precio de P2, dicho de frente

El plan escribe `ingesta/` en su diagrama de paquetes (§{Paquetes}) y este documento
lo renombra. **Es una divergencia con el plan, no con una regla**, y va anotada acá
para que quien lea el diagrama no concluya que el paquete falta. Lo que el plan nombra
es el **tramo** —la ingesta—, y el tramo sigue llamándose así en toda la prosa; lo que
cambia es el nombre del **artefacto de código**, que es lo que este documento gobierna.

---

## 15 · Paso 4 — el piso de texto, y los cuatro que ninguna regla determinaba

**Agregado el 2026-08-16**, antes de escribir una línea de `packages/adapters/src/floor.ts`,
por la regla del cierre. El paso 4 escribe **el piso de texto**, agrega **un guardián** a
`ir` y **un campo** a la salida de la orquestación.

> **Primero, lo que las reglas SÍ determinaban.** `Piso → Floor` es R1 llana (el
> cognado no existe y `floor` es el término de dominio que el propio plan usa en
> §{El piso}); `Cohesión → Cohesion` ya está en §3. El guardián nuevo se llama
> **`cohesion.mjs`** y **no va como fila**: §6 lo determina entero —«un guardián NUEVO
> nace en inglés» y se llama como lo que verifica, igual que `numbers.mjs` y
> `geometry.mjs`—. `Proporción → Proportion` e `Imprimible → Printable` son R1.
> **Ninguno de estos va en la tabla.**

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P9** | el adaptador que responde cuando **nadie** reclamó | **`textFloorAdapter`**, en **`src/floor.ts`**, con id **`"text-floor"`** | R2 pone el modificador adelante (`text` + `floor`), y `markdownAdapter` fija el sufijo. Lo que había que decidir es **cuál es la raíz**: el plan lo llama «el piso **de texto**», así que la raíz es `floor` y `text` la califica — al revés (`floorText`) diría «el texto del piso», que no es una cosa. `fallbackAdapter` se descarta porque **`fallback` promete universalidad** y este adaptador **puede abstenerse**: es de TEXTO, y lo que no lo es queda `on_hold`. `plainTextAdapter` se descarta porque nombra un FORMATO, y `.txt` no es lo que este adaptador reclama: reclama por contenido, y el caso por el que existe es el `.conf`. El **archivo** se llama `floor.ts` y no `text-floor.ts` por E1 —se llama como lo que contiene— y porque el par con `markdown.ts` se lee solo: uno conoce un formato, el otro ninguno |
| **P10** | la medición del gate de imprimibles | **`printableProportionOf`** | R11 exacta (`De → Of`) sobre el nombre que **`params.ts` ya usa**: `minPrintableProportion`. No es una elección — es la única forma de que el parámetro y su medidor no tengan dos vocabularios. `isText` se descarta y es la tentación real: colapsa la MEDICIÓN con la DECISIÓN, y son dos cosas distintas —la medición es del contenido, la decisión es del umbral, que es `Pending`—. Con `isText` el umbral no tendría dónde entrar y el número se escribiría adentro de la función |
| **P11** | lo que la corrida deja para reintentar | **`Run.onHold`**, de tipo **`ColdProbe \| null`** | Se llama como **el estado** que registra, que ya es una decisión tomada (`on_hold`, §8/G5, en `DOCUMENT_STATES`), en `camelCase` por R10. `pending` se descarta porque **`Pending<T>` ya está tomado** en `params.ts` y significa otra cosa (un parámetro sin medir); `deferred` está tomado por `Body.asset.deferred`; `rejected` es exactamente lo contrario de lo que el campo significa —`on_hold` es «todavía no lo soportamos», no «no lo queremos»—. Y el TIPO no es nuevo: son «los cinco datos escalares que se persisten en `documento_en_espera`» (§{Lo que queda}), o sea `ColdProbe`. Inventar un tipo paralelo con los mismos cinco campos sería la re-declaración que el `README.md` de `ir` prohíbe |
| **P12** | la cara de señales de un adaptador que no lee ningún formato | **`FloorSignals = Record<string, never>`** | El tipo sale de P3 (`<Formato>Signals`) y lo que había que decidir es **el cuerpo**. `{}` es la escritura obvia y es **falsa**: en TypeScript `{}` admite cualquier objeto, así que el tipo no diría «no hay señales» sino «no me importa». `Record<string, never>` no admite ninguna propiedad, que es lo que se quiere afirmar. `void` y `null` no son asignables a `Unit<S>['signals']` sin ensanchar el contrato |

### El precio de P9, dicho de frente

El plan escribe **«piso de texto `.txt`»** en su orden de construcción, y este paso
**no crea ningún adaptador de `.txt`**: el corpus lleva un `.conf` y **deliberadamente
no lleva un `.txt`**. Es una divergencia con el plan y no con una regla, y va anotada
para que quien lea el orden de construcción no concluya que el paso quedó a medias. Lo
que el plan nombra con `.txt` es **el caso más fácil de imaginar**, no el conjunto que
el adaptador cubre; el conjunto lo fija `minPrintableProportion`, que mide **contenido**
y del que la extensión no participa. Con un `.txt` en el corpus, una implementación que
decidiera por extensión pasaría en verde — el atajo lo invita el fixture, no el plan.

---

## 16 · Paso 11 — el reconciliador, y los diez que ninguna regla determinaba

**Agregado el 2026-08-17**, antes de escribir una línea de
`packages/emission/src/reconcile.ts`, por la regla del cierre. El paso 11 escribe **el
reconciliador de tres pases**, agrega **un tipo** y **tres campos** al contrato de `ir`,
y **corrige un docstring de `params.ts` que afirma algo imposible**.

> **Primero, lo que las reglas SÍ determinaban**, para que se vea que se consultaron.
> `reconciliar → reconcile` es R1 llana, y **`Reconciliador → Reconciler` NO se escribe
> como símbolo**: precedente triple de §4 (`Evidenciador → EvidenceFn`), F2
> (`grouper.ts` descartado) y P7 (`CascadeResult` nombra al productor en vez de a la
> cosa) — no se nombra al agente cuando lo que hay es una función libre. `Reconciliación
> → Reconciliation` es R1+R2 y la mitad ya está escrita (`ReconciliationMetrics`).
> `residuo → residue`, `altas → additions` y `bajas → removals` ya están **congeladas en
> el contrato** (`ReconciliationMetrics.byResidue`, `EmissionOutput.removals`):
> proponerles otro nombre sería un cambio de contrato, no una elección. `umbral de
> similitud → similarityThreshold`, `tope de comparaciones → maxComparisons` y
> `multiplicidad máxima → maxMultiplicityForAnchoring` ya viven en `PARAMETERS.identity`,
> y los dos primeros **entran por parámetro** porque son `Pending<number>` en `null`.
> `similitud entre proyecciones → similarityOfProjections` ya existe. El archivo se llama
> **`reconcile.ts`** por §6 + E1. **Ninguno de estos va en la tabla.**

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P13** | el **hueco** entre dos anclas | **`Gap`** (local, no exportado) | `Hole` en inglés nombra una AUSENCIA, y este objeto es **donde vive todo lo que no ancló** — es lo más lleno del reconciliador, y decirle «agujero» invita a leer el pase 2 como limpieza en vez de como el pase que resuelve «lo que se editó en su lugar». La palabra del plan, **«tramo», está tomada**: así nombra el plan sus siete etapas, y los docstrings citan `§{Tramo 4 › …}`. Y las cuatro alternativas obvias tienen dueño en `ir`: `Window` (§3, con `Window['scope']` en §5), `Slice` (§3), `Range` (§4 lo partió en `rank`/`range`, y `SourceRange` es el rango de bytes de la grilla) y `Span`, que queda a un guion bajo de `text_span`, valor de `SHAPES` |
| **P14** | el **ancla** y quién ancla | **`Anchor`** · **`anchorsOf`** | §4 **ya reservó `anclaje → anchoring` explícitamente para LA MÉTRICA** («es la métrica —fracción de nodos que ancló—, no el acto»), así que el acto quedó libre y las dos palabras no se pisan. `Anchor` es `{ node: number; known: number }` — **las DOS posiciones**, porque el problema que el plan no resuelve vive exactamente en que las dos pueden no crecer juntas. Nada de `old`/`new`: `new` es palabra del lenguaje, y el par no diría de qué espacio es cada lado |
| **P15** | el ancla que **además parte las listas** | **`Fence`** en la prosa · **`fencesOf(anchors): readonly Anchor[]`** en el código | **El nombre más importante del paso.** Nace porque el plan escribió como una sola cosa **dos usos distintos de la misma ancla** — conservar identidad (todas) y partir en tramos (solo las monótonas) —, y la frase que resuelve el hueco es literalmente **«un ancla que no es cerco conserva su id»**. Sin dos palabras esa frase no es escribible y la tentación de descartar el ancla junto con el cerco no tiene dónde hacerse visible. `monotoneAnchorsOf` nombra **el cómo** (la monotonía) en vez de **el rol** (partir las listas), que es el error exacto que §4 evitó al reservar `anchoring`. `Boundary` ya es de `boundaries.mjs` y de las fronteras entre paquetes. **NO nace un tipo `Fence`**: un cerco ES un `Anchor` seleccionado, y la firma lo dice mejor que un alias |
| **P16** | el **emparejamiento** viejo ↔ nuevo | **`Match`**, con campos **`local` · `id` · `by`** | **`Pair` está tomado tres veces en `ir`**: `shapes.ts:126` exporta `type Pair = { label, value }` (el par de la forma `fields`), el barril lo reexporta, y la palabra ya trabaja en `isLegalPair` y `ROLE_SHAPE_PAIRS` para la pareja `role⇒shape`. Es `Registro → DataRecord` (§4) y `Contenedor → Ancestor` (B3) calcado: **cuando R1 no elige, elige la colisión**. `Mapping` nombra el CONTENEDOR y el que tiene que llevar el criterio es el ELEMENTO; `Link` ya lo descartó §4 a secas. Los campos son `local` e `id` porque son **las dos palabras que el contrato ya usa para esos dos lados** (`RoutedNode.local`, `EmittedNode.id`) |
| **P17** | **con qué criterio** se emparejó | **`MatchBasis`** · **`MATCH_BASES = ["hash","similarity","residue"] as const`** | **`attribution` está tomado Y EN EL MISMO OBJETO**: `RawNode.attribution` es «qué eslabón de la cascada resolvió este nodo» y `EmittedNode` lo hereda vía `Node`; dos campos que dicen «qué paso decidió esto» con el mismo nombre en el mismo tipo es la homonimia que este documento existe para evitar. `origin` está tomado (`Origin['kind']`, D6), `source` lleva ⚠ DOBLE en §3 y §5, y `provenance` es un módulo con criterio de membresía que esto no cumple (dice cómo se CONCLUYÓ la identidad, no cómo LLEGÓ el contenido). `kind` es el caso F1 otra vez: las tres variantes no se distinguen por qué CLASE son sino por con qué CRITERIO se hicieron, y para eso hay regla — **R7, `por → by`**. Los tres valores son **los tres campos de `ReconciliationMetrics` sin el prefijo**, y no los tres títulos del plan: el pase 2 empareja POR SIMILITUD, el hueco es DÓNDE y no CÓMO, y un `"gap"` contradiría el campo agregado que vive tres líneas más arriba. **Tampoco se numeran**: el ordinal miente el día que se reordene un pase |
| **P18** | **el pase** | **NINGÚN NOMBRE EN INGLÉS** — fila de ausencia | «Pase» se queda en los docstrings, que son español por §1. En DATOS los tres se nombran por su criterio (P17); en CÓDIGO son `anchorsOf` y **dos llamadas a la misma función**. R1 daría `pass` y **se dispara su salvedad**: en cualquier base de código «pass» es pasar un parámetro o que un chequeo pase, y nombrar así el objeto central del único tramo cuyo guardián imprime verde y rojo es comprar la confusión. Pero antes de elegir entre `Pass`, `Phase` y `Round` hay que preguntar **si el nombre hace falta, y no hace**: un tipo para «el pase» solo serviría para poner el ordinal en algún lado, y **el ordinal es justo lo que el contrato ya decidió no guardar**. Se lista para que la ausencia no se lea como olvido (precedente B7 con `Scope`, y §14 «Lo que este bloque BORRA») |
| **P19** | lo que entra al reconciliador: **la memoria de la versión anterior** | **`KnownVersion`** = `Nominal<readonly KnownNode[], "KnownVersion">` · **`knownVersionOf`** | El nombre que sale solo es el del plan —«el índice de reconciliación» → `ReconciliationIndex`— y es el que más caro sale, por dos razones. **(1) Sería una RE-DECLARACIÓN**: tendría exactamente los miembros de dos tipos que `ir` ya exporta, y el `README.md` de `ir` lo prohíbe con todas las letras; es el caso `OpaqueEntry` de §14, borrado por eso mismo. **(2) «índice» es la palabra del PRODUCTO** para el índice buscable —`DOCUMENT_STATES` tiene `indexing`/`indexed`—, así que el nombre pondría la memoria privada del reconciliador y el destino de la ingesta bajo la misma palabra. `PreviousVersion` **está tomado con otro significado**: `ReconciliationMetrics.previousVersion` es la versión del ADAPTADOR (H16). La marca nominal existe para que **«lista desordenada» sea IRREPRESENTABLE** y no una precondición en un comentario: un arreglo mal ordenado no explota — produce cercos cortos, huecos mal armados y un desempate «menor `order` viejo» que es falso, y el resultado sigue siendo un `EmissionOutput` perfectamente formado |
| **P20** | **acuñar** un `ElementId` | **`MintFn = () => ElementId`**, en `identity.ts` | El verbo ya está fijado por el contrato (`MINTING_PROOFS`, `invariants.ts:258`); lo que esta fila registra es **el TIPO**, por R2 sobre el precedente doble `HashFn` (`projection.ts:416`) y `EvidenceFn` (§4). Existe porque **acuñar es IMPURO** —H13(a): ULID/UUIDv7 = reloj + azar— y `boundaries.mjs` de `emission` rechaza cualquier import que no sea `@savia-os/ir`, **incluidos los `node:*`**. Es la misma jugada que hizo `sha256` entrar por parámetro, y por la misma razón: sin ella el determinismo no es verificable |
| **P21** | los **tres campos nuevos** de `ReconciliationMetrics` | **`comparisons`** · **`uncompared`** · **`ambiguous`** | Los dos primeros son R1 llana y entran por completitud. **`ambiguous` sí necesita fila**: nombra un ESTADO del nodo —«su hash no es único de su lado, así que no puede ni intentar anclar»— y no un conteo obvio. `collisions` sugiere que el hash falló, **y no falló**: el contenido es idéntico. `nonUnique` describe el hash, no el nodo. `unanchorable` promete de más — un nodo ambiguo **se empareja perfectamente bien** por los pases 2 y 3 |
| **P22** | el caso del banco | **`ReconciliationCase`** | Sigue a `Case` y `GroupingCase` de `synthetic.ts` por R1 + §9. La fila existe para dejar escrito **por qué el golden va TIPADO en `src/` y no en un archivo de snapshot**: un snapshot se regenera con una tecla, y ese es exactamente el modo de falla que M18 existe para impedir |

### El precio de P19, dicho de frente

El plan le dedica una sección entera a **«3 · El índice de reconciliación»** y describe
sus dos tablas (`nodo_conocido`, `version_nodo`). Este documento **no le da ese nombre a
ningún símbolo**, y hay que decir por qué para que quien lea el plan no concluya que la
pieza falta: lo que el plan nombra es **el artefacto de persistencia del tramo 7**, que
sigue llamándose así en toda la prosa y que este paso **no construye**. Lo que nace acá
es **la vista en memoria de una versión ya elegida**, que es un recorte de aquel — sin
`document`, sin `organization` y sin `version`, porque para cuando llega ya se eligió
contra qué reconciliar. Nombrarlos igual haría creer que `reconcile` toca Postgres.

### Lo que este bloque CORRIGE, y por qué no es una errata

El docstring de `PARAMETERS.identity.maxComparisons` afirma que al superar el tope «se
emite el evento de anclaje bajo — nunca se trunca en silencio». **La segunda mitad es el
requisito y la primera es imposible**: agotar el presupuesto no mueve `byHash` ni
`oldNodes`, así que **no mueve `anchoring`**, así que el evento no se dispara. Las dos
condiciones coinciden en el caso que las motivó —renombrar una columna deja cero anclas
*y* revienta el presupuesto— y por eso la contradicción pasó desapercibida; pero un
documento sano con **un solo hueco enorme** trunca con `anchoring` alto y **en silencio**,
que es exactamente lo que la frase prometía impedir. Se corrige el docstring, no el
comportamiento —bajar `anchoring` sería mentir sobre una métrica que mide otra cosa— y
`uncompared` (P21) es el canal que vuelve verdadera la promesa.

---

## 17 · Paso 12 — el cableado, y la palabra «Stable» devuelta a su significado

**Agregado el 2026-08-18**, antes de escribir una línea del cableado de `reconcile`
dentro de `ingest`, por la regla del cierre. El paso 12 hace que la orquestación
**llame** al reconciliador: hasta hoy la pieza existía, estaba acreditada y no la
invocaba nadie del producto.

> **Primero, lo que las reglas SÍ determinaban.** El orden `emit → reconcile → group`
> no es una decisión de nombres sino de plan, y el plan lo dice literal («**Entra:** la
> lista plana del tramo 4, **con identidad** y migas», §{Tramo 5}); la afirmación
> contraria de `outputs.ts` —«el tramo 5 corre ANTES del reconciliador»— se escribió
> cuando el reconciliador no existía y describía el orden de implementación de entonces
> como si fuera una regla del diseño. `Fragmento → Fragment`, `Registro → DataRecord` y
> `Miga → Breadcrumb` ya están en §3 y §4. Los cuatro parámetros nuevos de la
> orquestación ya tienen nombre: `mint`/`MintFn` es P20, `similarityThreshold` y
> `maxComparisons` viven en `PARAMETERS.identity` desde el paso 1, y
> `previousAdapter`/`previousVersion` son campos ya escritos de
> `ReconciliationMetrics`. **Ninguno de estos va en la tabla.**

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P23** | el fragmento cuyas **referencias** ya son definitivas | **`StableFragment = Fragment<ElementId>`** — el tipo EXISTENTE pierde sus dos campos de más | **No nace un nombre: se le devuelve a uno el significado que la familia ya le había dado.** `Stable*` significa **una sola cosa** en las otras dos familias —`StableBreadcrumb = Breadcrumb<ElementId>`, `StableDataRecord = DataRecord<ElementId>`, o sea *el espacio de referencias es el definitivo*— y la de fragmentos se quedó con el nombre de la familia y le colgó `id` y `contextualFingerprint`. La salida que este paso necesita es exactamente `Fragment<ElementId>`, así que la alternativa era **un tercer calificativo solo para fragmentos**, con «Stable» significando una cosa en dos familias y otra en la tercera. Y hay una prueba de que el concepto ya trabajaba sin nombre: `invariants.ts` assertea sobre `Fragment<ElementId>` escrito a mano y explica por qué **no** sobre `StableFragment` — «la diferencia es la que separa **acreditar de aparentar**: `StableFragment` tiene DOS CAMPOS DE MÁS», o sea que la aserción pasaría por los campos que faltan y no por el espacio de referencias. Con esta fila, esa aserción puede nombrar el tipo en vez de reconstruirlo |
| **P24** | el fragmento que además tiene **identidad propia** | **`IdentifiedFragment = StableFragment & { id: FragmentId; contextualFingerprint: ContextualFingerprint }`** | Es el tipo que hasta hoy se llamaba `StableFragment`, con el nombre que dice **qué es** y no qué le hacen. **`IndexedFragment` se descarta y es la que salía sola**: nombra lo que un tramo POSTERIOR le hace, que es el defecto exacto que §14 le señaló a `CascadeResult` («nombra al productor en vez de a la cosa») y §15 a `plainTextAdapter` («nombra un FORMATO»). Y es peor que esos dos, porque el tipo se llamaría «indexado» durante todo el rato en que **todavía no está indexado** — se construye en el tramo 5 y se indexa en el 7. Tampoco alcanza con mirar a un solo consumidor: el docstring dice «lo que el tramo 6 **embebe** y el tramo 7 **indexa**», así que `EmbeddableFragment` erraría igual y por la otra mitad. Lo que los dos campos compran es **identidad**: `contextualFingerprint` es la identidad de contenido —«Identidad, dedupe y base de `FragmentId`»— y `id` es la dirección que se deriva de ella. `AddressableFragment` nombra solo la segunda mitad. **El contraste con P23 es el que hace legible al par:** `Stable*` dice que *sus referencias* son definitivas, `Identified*` dice que *él mismo* tiene identidad — y por eso el cuarto nombre existe solo para fragmentos y no desbalancea nada: el fragmento es la única de las tres salidas que adquiere identidad propia (`DataRecord` «no lleva identidad propia ni huella», y una miga tampoco) |

### El precio de P23, dicho de frente

**Un tipo exportado cambia de significado**, y eso es más caro que agregar uno: quien
lea un commit viejo o el `README` de otro paso va a encontrar `StableFragment` con dos
campos que ya no tiene. Va anotado acá porque el diff no lo va a explicar solo.

Lo que lo hace pagable —y hay que decir las tres cosas juntas, o la decisión parece más
barata de lo que es— es que **`StableFragment` no tiene un solo consumidor de runtime**
(solo el barril y menciones en prosa), que **el compilador encuentra todos los usos** y
que **la aserción `_S7` mejora con el cambio** en vez de sobrevivirlo. Si alguna de las
tres no valiera, la opción correcta sería el tercer nombre.

### Lo que este bloque NO borra, y por qué no es una omisión

`LocalFragment` y `LocalDataRecord` **se quedan sin productor** cuando `group` pasa a
consumir `EmittedNode`, y **no se borran**. Es la tentación exacta de «menos piezas» y
acá es un error medido: `LocalFragment` es el sujeto de tres garantías que **no tienen
nada que ver con quién lo produce** —`_LocalFragmentHasNoId` (el tramo 5 no puede llevar
un `FragmentId`), `_S7` (los dos espacios de `Ref` de `Fragment` no colapsan) y la fila
de mutante que muta su declaración—. Borrar el alias las apaga **las tres de un saque, y
en verde**. Un tipo sin productor no es un tipo sin trabajo.

---

## 18 · Deuda del paso 7 — de dónde salieron los bytes

El paso 7 dejó escrito que faltaba guardar **las dos rutas**: la interna, que ya
existe y es la `ObjectKey`, y la original, que no tenía dónde vivir. Un solo símbolo
nuevo, y la fila existe porque **todos los nombres obvios tienen dueño**.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P25** | de dónde salieron los bytes de un asset | **`Whence`** = `{ container: ObjectKey; path: string }`, en `provenance.ts` · campo **`whence`** en `Unit` y en `RawNode` | **`Provenance` es la CATEGORÍA y no puede ser un miembro.** E2 (§11) fundó `provenance.ts` justamente porque con dos miembros «el archivo pasaría a nombrar a uno de los dos y a esconder al otro»; darle el nombre de la categoría al tercero es ese mismo error servido al revés, y encima el peor de los dos: esconde a `Authorship` y a `DelegationId` a la vez. **`Origin` está tomado** (`Origin['kind']`, D6) y **`Source` lleva ⚠ doble** (§3 y §5) y ADEMÁS ya es un campo de `Authorship` con otro significado — las tres colisiones que P17 ya había recorrido para otro símbolo. `Location` es de `RawNode.location` («dónde está en el documento», no «de dónde vino») y `Route` es del tramo 4. **`Locator` se descarta por casi-colisión**: queda a una letra de `Location` en un tipo que lleva los dos campos, que es la clase de vecindad que P13 evitó entre `Span` y `text_span`. `Whence` es literalmente «de dónde», que es la pregunta que el campo contesta, y **no tiene un solo homónimo en los cuatro paquetes** |

### Por qué CABE en `provenance.ts`, con el criterio del módulo aplicado

El criterio de membresía pide las tres y `Whence` las cumple sin forzar ninguna:

1. **Dice CÓMO LLEGÓ, no QUÉ ES.** `word/media/sello.png` no dice nada del contenido:
   el mismo PNG con otro nombre adentro del mismo `.docx` es el mismo PNG.
2. **La huella tiene que ser CIEGA a él**, y acá la ceguera es ESTRUCTURAL y no una
   promesa: `fingerprintOf` recibe `Body`, y `whence` es hermano de `body`, no un campo
   suyo. No hay forma de escribir el código que lo cuele. Es el mismo lugar y la misma
   razón que `delegation` y `attribution`, que ya llevan «NO entra en la huella» escrito
   en su docstring.
3. **Viaja pegado al contenido, no al registro.** Sale del adaptador junto con la
   unidad y llega al nodo; no es la identidad de una fila del tramo 1.

### La forma, y por qué UNA sola sirve para los dos casos

`{ container, path }` — el objeto donde se encontró la referencia, y la referencia
**tal como estaba escrita ahí**. Un `.docx` da `(el .docx, "word/media/sello.png")`;
un `.md` con una imagen por enlace dará `(el .md, "https://cdn.acme.com/fig.png")`.
No hace falta una unión: en los dos casos hay un contenedor y una dirección relativa
a él, y el `path` es opaco a propósito — interpretarlo es trabajo de quien lo escribió.

`container` es `ObjectKey` y no un `Source` ni un nombre de archivo porque tiene que
seguir siendo cierto después de que el documento se renombre: es la única dirección
del contenedor que no se mueve.

### El precio, dicho de frente

`whence` es un campo **requerido de valor nulable** en `Unit`, no opcional. Los siete
literales de unidad de los cinco adaptadores tienen que escribirlo, y seis escriben
`null`. Con `?` el adaptador que materializa compila sin él y **la procedencia se
pierde en silencio** — que es exactamente el argumento con el que `AuthoredUnit` hizo
`ownAuthorship` obligatoria («con `?` el adaptador de canal compila sin ella y la
corrida entera atribuye los mensajes a quien los mandó por MCP»). El precio es
mecánico y lo cobra `tsc` de una vez; el modo de falla del `?` no lo cobra nadie.

---

## 19 · Paso 13 — el tramo 1, y los cuatro que ninguna regla determinaba

El paquete se llama **`intake`** y eso ya estaba decidido: §4 lo fija desde el bloque
inicial («el cognado `reception` es un lobby de hotel»). Lo que hay que decidir es lo
de adentro, y son cuatro. La mitad de aceptación del tramo 1 **ya existe y no se
renombra** —`select` devuelve `null`, el piso se abstiene y sale `Run.onHold`—; lo que
entra acá es la mitad de RECHAZO, que es la que ningún adaptador puede tomar.

> **El paquete alcanza `ir` y NADA MÁS**, que no era el plan: se scaffoldeó declarando
> también `adapters` —«la mitad de aceptación vive allá»— y su guardián de fronteras lo
> desmintió en la primera corrida, porque nada lo importaba. `claimedBy` recibe un
> `OpaqueAdapter`, que es un tipo de `ir`: este paquete habla del **contrato** de
> adaptador y nunca de un adaptador. El efecto es que «`admit` no calcula `encrypted`»
> dejó de ser una convención de firma y pasó a ser el grafo de módulos.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P26** | la puerta del tramo 1, y su resultado | **`admit`** · **`Admission`**, unión discriminada de **tres** brazos: `admitted` · `rejected` · `retry` | R1 da `admitir→admit` llana, y la fila existe por el TERCER BRAZO y por dos colisiones. **`accept` está tomado con otro significado**: §4 ya fijó `admiteSatelite → acceptsSatellite`, y ese «admite» es «tolera un satélite adentro», no «deja pasar por la puerta». **`Gate` se descarta aunque sea la palabra del plan**: la prosa de este repo ya la usa para otra cosa —P10 dice «la medición del **gate** de imprimibles», que es el umbral del tramo 2— así que un tipo `Gate` haría que la misma palabra nombre las dos puertas. El tercer brazo NO es un detalle: sin él, «el escáner no contestó» solo se puede codificar como uno de los otros dos, y las dos formas están mal —`admitted` es fail-open e indexa lo que nadie miró, `rejected` le miente al que subió un archivo sano—. `retry` se llama así y no `deferred` ni `pending` porque **ata con el parámetro que ya existe**, `PARAMETERS.intake.maxRetries`, que es el que decide cuándo ese brazo se vuelve `failed`. Es el argumento de P10 (`printableProportionOf` ↔ `minPrintableProportion`) aplicado de nuevo: el contrato y su parámetro no pueden tener dos vocabularios. Y `deferred` **está tomado** por `Run.deferred`, que es otra cosa |
| **P27** | el veredicto del antivirus, y su capacidad | **`ScanVerdict`** = `clean · infected · unavailable` (§5, datos) · **`ScanFn = (object: ObjectKey, bytes: Uint8Array) => Promise<ScanVerdict>`** | `ScanVerdict` sale solo de R2 sobre dos raíces llanas de R1 (`escaneo→scan`, `veredicto→verdict`); lo que no sale solo es **el vocabulario** —§5 pide que los cerrados se escriban acá, «hoy cambiarlos es gratis y después es una migración» (D6)— ni **la firma**. `clean`/`infected` son los términos del dominio antivirus y no cognados inventados. El tercero es el que importa: `unavailable` dice **que el escáner no contestó**, y se descarta `unknown` porque describiría al archivo —«no sabemos qué es»— cuando lo que no se sabe es del escáner; se descarta `error` porque un timeout no es un error del archivo ni de nosotros. **La firma toma `ObjectKey` y ese parámetro es la garantía entera**: «todo objeto de nuestro bucket se escanea una vez, indexado por su hash de contenido» (`outputs.ts`, la máquina de estados) solo es expresable si el sujeto del escaneo es el OBJETO. Con una firma de solo bytes, memoizar sería una convención que nadie puede imponer; con la clave adentro, el peldaño es el 1 — el tipo lo pide |
| **P28** | el motivo del rechazo | **`RejectionReason`** = `encrypted · infected` (§5, datos) · campo **`reason`** | R1+R2 llanas, y la fila existe porque **B5 parece decidir lo contrario y no lo decide**: aquel bloque eligió `Caso.porqué → why` sobre `reason`, pero con un argumento que era del consumidor —«el guardián imprime el campo detrás de la palabra *porque*»— y acá no hay tal frase: el consumidor es el mensaje al usuario. Los dos valores son exactamente los dos que el plan nombra («se rechaza solo en la puerta: cifrado sin contraseña, tamaño excedido, y lo que marque el antivirus»), **menos el tamaño**, que no entra y va dicho: con subida prefirmada se impone como `content-length-range` del permiso, o sea que un archivo demasiado grande **nunca llega a ser un documento**. `oversize` sería un valor que no puede ocurrir |
| **P29** | qué sondas en espera despierta un adaptador nuevo | **`claimedBy(adapter, probes)`** · y su segundo brazo, **`undecidable`** | **`claimedBy` porque «reclamar» ya ES el verbo del repo para esta relación** —«el selector la reclama», «nadie lo reclama», «el adaptador de imagen no lo reclama»— así que no se elige una palabra: se usa la que los docstrings vienen usando. R7 fija `by` («nombra el criterio»). Se descartan `revive` y `awaken`, que suenan a que la sonda hace algo, cuando la sonda es el objeto de la frase. **El segundo brazo NO es defensivo, cierra media PROVISIONAL(C7)**: el plan promete que al registrar un adaptador «se recorre una tabla chica, **no se leen archivos** de almacenamiento», y el único evidenciador completo del documento hace `await s.zipEntries()`, que sí los lee. O sea que la promesa y el diseño se contradicen hoy. La salida honesta es la que este repo ya usa para `materialize` sin almacenamiento: los perezosos RECHAZAN, y el adaptador que los necesitaba sale en `undecidable` en vez de leer el objeto en silencio. Un adaptador que no puede decidir en frío es un hecho declarado, no un archivo leído de más |

### Por qué `admit` NO recibe los bytes, y sí el veredicto

La tentación es que la puerta escanee. No lo hace, y la razón es la misma por la que
`fingerprintOf` recibe `Body` y no el nodo entero: **lo que la firma no admite, no se
puede colar**. `admit` recibe `{ scan, encrypted }` —dos hechos ya establecidos— y
devuelve la decisión. Con eso:

1. La decisión es **pura y sincrónica**, así que se puede barrer entera: son tres
   veredictos × dos valores de `encrypted` = seis casos, y el guardián los recorre
   todos. Una función que escanea adentro no se puede barrer sin un doble.
2. **`encrypted` es evidencia, y la evidencia es del tramo 2.** Detectar «cifrado sin
   contraseña» es saber de formatos —el bit 0 del *general purpose bit flag* de un zip,
   el `/Encrypt` del tráiler de un PDF— y ese conocimiento vive en `adapters` por
   diseño. Que `intake` lo calculara sería la re-declaración que el README de `ir`
   prohíbe, y encima duplicaría el lector de zip.
3. El **fail-closed queda escrito en la tabla** y no en un `catch`. Un `try/catch`
   alrededor de un escaneo que no responde es la forma en que fail-open entra sin que
   nadie lo decida.

---

## 20 · El canal `folder` — el retiro, y por qué NO es un estado

El canal decide que borrar un archivo de la carpeta **retira el documento y no lo
destruye**, y que el retiro es **reversible**. Un solo símbolo nuevo, y la fila existe
porque la forma que el plan escribió —«pasa a estado `retirado`»— **no es la que queda**.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P30** | que un documento dejó de estar vigente porque su archivo desapareció de la carpeta | campo **`retiredAt: Instant \| null`** en `Ingestion`, y **NO** un noveno valor de `DocumentState` | La forma que sale sola es la del plan —«un archivo que desaparece de la carpeta pasa a estado `retirado`»— y no entra por tres razones que se acumulan. **(1) DESTRUIRÍA `isTerminal`.** Un archivo se borra cuando se borra, así que el retiro es alcanzable desde los ocho estados; con los ocho ganando una arista, ninguno queda con grado de salida cero y la función devuelve `false` para todos. Se derivó de `TRANSITIONS` **justamente** para que «una lista paralela mantenida a mano» no pudiera mentir, y como noveno estado se vuelve uniformemente inútil. Que E5 de `states.mjs` ya se ponga rojo ante ese cambio es la confirmación, no la objeción: el guardián que se escribió sin pensar en el retiro ya sabía que esto no cabía ahí. **(2) LA REVERSIBILIDAD NO SE ESCRIBE COMO ARISTA.** «Si el archivo vuelve, vuelve entero» significa que vuelve AL ESTADO QUE TENÍA, y un par `[retired, X]` no recuerda de dónde vino: expresarlo pide guardar el estado previo, que es un campo. O sea que la forma de estado **filtra un campo igual**, y encima perdió el que ya estaba escrito. **(3) Y LO DECIDE LA TABLA DEL PROPIO PLAN.** «Qué sobrevive a un retiro» enumera seis cosas y sobreviven las seis: las anotaciones, las marcas de sensibilidad, los `ElementId`, el índice de reconciliación, el historial, `selladoEn` y el objeto original. Un documento retirado que estaba `indexed` **sigue estando indexado** —su IR existe, sus fragmentos existen, su índice existe—, así que escribir `retired` en `state` **borra un hecho verdadero para anotar uno distinto**. Los ocho estados contestan «¿en qué punto del pipeline está?»; el retiro contesta «¿está vigente?». Son dos preguntas, y la forma del plan las mete en un campo |

### Por qué `retiredAt` y no los cinco nombres vecinos

`retire` es el cognado llano de «retirar» (R1) y es la palabra que el plan ya usa, así
que no se elige un término: se traduce el que hay. Lo que sí hay que decidir es contra
qué se lo elige, y los cinco candidatos fallan cada uno por su lado:

- **`archived`** promete de más, y en la dirección peor. «Archivar» en almacenamiento
  significa **mover a almacenamiento frío**, y el objeto no se mueve: la tabla del plan
  dice que sobrevive intacto y deduplicado, porque purgarlo «rompe la cita verbatim de
  todos los otros documentos que lo comparten».
- **`deleted`** y **`removed`** afirman exactamente lo contrario de la decisión.
- **`withdrawn`** pone el sujeto en la persona —«alguien lo retiró»— y el que retira es
  el canal, después de una cuarentena que decide el servidor.
- **`inactive`** y **`disabled`** describen una capacidad, no un hecho fechado, y este
  campo tiene que llevar el instante.

El sufijo **`At`** no se inventa: `createdAt` y `sealedAt` ya están en el paquete, y
`sealedAt` está tres líneas más arriba **en este mismo tipo**. Un `Instant` que marca
cuándo pasó algo se escribe así acá.

### Por qué `Instant | null` y no un booleano

Porque la cuarentena necesita **cuándo**. Un `retired: boolean` pediría un timestamp al
lado, y dos campos que tienen que concordar son la clase de dato que se desincroniza —el
mismo argumento con el que `isTerminal` se deriva en vez de escribirse.

Y `null` no es «falta el dato»: **es el estado normal**. Un documento vigente tiene
`retiredAt` en `null` toda su vida, que es lo que vuelve la reversibilidad gratis —se
pone en `null` y el documento es exactamente lo que era, sin nada que restaurar—.

### Lo que este bloque CORRIGE, y por qué no es una errata

El plan y el borrador del agente dicen los dos «estado `retirado`», y los dos se
corrigen. No es una errata de redacción: era la forma correcta **antes de que
`TRANSITIONS` existiera**. Cuando se escribió esa frase la máquina de estados era una
lista de ocho literales sin consumidor, y agregar un noveno no costaba nada porque no
había nada que romper. El commit que le puso aristas es el que volvió incompatible la
frase — y decidir esto antes de escribir el término es exactamente lo que la regla que
gobierna a este documento existe para provocar.

### El precio, dicho de frente

**El campo NO alcanza para escribir el worker de bajas, y conviene no fingir que sí.**
`retiredAt` dice que el documento no está vigente; no dice que la búsqueda, la síntesis
y el índice lo excluyan. Eso son tres consumidores que todavía no existen, y cada uno
tiene que filtrar por su lado. La forma de estado tampoco lo daba —`canTransition` no
filtra una búsqueda— pero la ilusión era más fácil de tener, porque un estado *parece*
que apaga el documento. Un campo nulable no lo parece, y esa honestidad es la mitad de
por qué se elige.

---

## 21 · El canal `folder` — dónde vive el archivo, y los dos campos que no entran

El plan pide una columna de cuatro partes —`raízVigilada · rutaRelativa ·
idDeArchivoDelSO · últimoHashVisto`— para «resolver una baja». **Entran dos.** Los otros
dos no son recortes de alcance: uno ya existe con otro nombre y el otro no es del
contrato, y las dos cosas se ven al preguntarse qué necesita el SERVIDOR, que es quien
lleva esta fila.

| # | Símbolo | **Queda** | Por qué no la que salía sola |
|---|---|---|---|
| **P31** | dónde vive, en la carpeta vigilada, el archivo del que salió este documento | **`WatchedPath`** = `{ root: RootId; path: string }`, en `outputs.ts` · campo **`watched`** en `Ingestion` | **Los cuatro nombres obvios tienen dueño, otra vez.** `Source` lleva ⚠ doble (§3 y §5) y además ya es un campo de `Authorship`; `Origin` está tomado (`Origin['kind']`, D6); `Provenance` es la CATEGORÍA y E2 prohíbe darle su nombre a un miembro; `Location` es de `RawNode.location` y `Route` del tramo 4, y `Locator` ya se descartó en §18 por casi-colisión con `Location`. **Y `Whence` NO sirve, que es el caso interesante**: existe, dice exactamente «de dónde», y el criterio de membresía que §18 le escribió lo EXPULSA — sus miembros «viajan pegados al contenido, no al registro» y «no son la identidad de una fila del tramo 1», que es literalmente lo que esto es. Es la primera vez que ese criterio se usa para RECHAZAR algo, que es para lo que se escribió. **`WatchedPath` porque «vigilada» es la propiedad operativa** —lo que distingue a esa carpeta de las otras cuarenta del disco es que el agente la mira— y porque ninguna de las dos palabras nombra un tipo del repo. Se descarta `FolderPath`: `folder` es un literal de `Channel`, y un tipo a un pelo del valor invita a confundir «el canal» con «la carpeta» |
| **P32** | la raíz vigilada | **`RootId`**, marca nominal en `identity.ts` | R1 llana sobre «raíz», y la fila existe por lo que el tipo IMPIDE. **No es una ruta y tiene que no poder serlo**: se acuña al enrolar, y si fuera el path absoluto, mover la raíz cambiaría la identidad de todo lo que hay adentro — que es exactamente el desastre que `rutaRelativa` existe para evitar, reintroducido un nivel más arriba. Con `string` pelado eso compila; con la marca, no. Se descarta `FolderId` porque nombra lo que la cosa ES y adentro de una raíz hay muchas carpetas: la que importa es LA vigilada, y «root» ya es la palabra que el borrador del agente usa. `WatchRootId` repite en el nombre lo que el tipo que lo contiene ya dice |

### Los dos campos que el plan pedía y NO entran

**`últimoHashVisto` ya existe: es `Ingestion.version`.** El invariante `_IngestionVersionIsBytes` lo sostiene —es el `ByteHash` de los bytes recibidos— y la consulta
`hash → documento` que el plan pide para resolver una baja se hace por ahí. Dos columnas
con el mismo valor son la clase de dato que se desincroniza.

Eso **solo vale con el lazo cerrado**, y por eso la sección «El hash del cliente es una
afirmación, no la autoridad» va antes que este bloque: el hash del agente y el del worker
pueden diferir si el archivo cambia entre el hasheo y el PUT, y lo que los vuelve el
mismo valor es que `upload.completed` devuelva el verificado. Sin ese retorno la columna
no sería redundante — sería el registro de una desincronización que nadie repara, que es
peor que no tenerla.

**`idDeArchivoDelSO` es del agente, no del contrato.** Sirve para que renombrar y mover
cuesten cero I/O, y eso pasa en la máquina del usuario. El servidor no puede verificarlo,
nunca se lo devuelve —cuando el inventario se pierde, el agente hace barrido completo y
Savia contesta `known` a todo— y el propio borrador del agente dice lo que es: «una pista
que se verifica, nunca una identidad: NTFS recicla ids y un restore los cambia todos». Un
dato cuya ficha declara que no es identidad no puede ser la identidad de una fila.

### Por qué `rutaRelativa` sobrevive, y no por la razón que el plan escribió

El plan justifica la columna entera diciendo que sin ella «desapareció tal contenido» no
se puede mapear a un documento. **Eso lo resuelve el hash**, y hay algo más fuerte: el
propio flujograma del agente trata dos copias del mismo contenido como UN documento —la
rama que pregunta «¿el hash reaparece en el árbol?» no reporta baja si reaparece, así que
borrar una de dos copias se lee como movimiento—. No queda ambigüedad que una ruta tenga
que desempatar.

Sobrevive por la razón que la sección de al lado sí escribe: «la ruta viaja en el reporte
y **se guarda**, para poder mostrarle al usuario de dónde salió cada cosa». Es procedencia
para MOSTRAR, no identidad para RESOLVER — que es lo que el título de esa sección dice y
lo que la justificación de esta se había olvidado.

Y `root` sobrevive por una tercera razón, que no es ninguna de las dos: **las salvaguardas
son por raíz**. La cuarentena y el corte por volumen corren del lado del servidor sobre un
denominador por raíz, así que la fila tiene que saber a cuál pertenece — un disco externo
desmontado no puede congelar la raíz del disco interno.

### Por qué NO es una unión discriminada por canal

`watched` es `null` para tres de los cuatro canales: `chat` y `frontend` no tienen fuente
externa, y `connector` la va a tener pero **no existe**. Modelarlo hoy como
`{ kind: "folder", … } | { kind: "connector", … }` es inventar la forma de un consumidor
que nadie escribió, y esa clase de generalidad después no se puede borrar: el día que el
conector exista va a querer campos que hoy no podemos adivinar, y la unión ya va a tener
consumidores ramificando sobre ella.

Un campo nulable dice lo mismo que hace falta hoy y no compromete el de mañana.

### El precio, dicho de frente

**`path` es un `string` opaco y su forma canónica NO está en el tipo.** El borrador del
agente es explícito en que eso es contrato y no implementación —mayúsculas, separadores,
normalización Unicode, longitud máxima, nombres reservados— porque macOS y Windows
difieren en las cinco. Hoy dos agentes pueden mandar dos grafías de la misma ruta y el
registro las va a guardar como distintas. Queda como `PROVISIONAL` en el tipo, no
resuelto: fijar la forma canónica es una decisión con medición adentro y no se inventa
acá.

---

## La regla que gobierna a este documento

**Si un término no está acá y ninguna regla de §2 lo determina, no se inventa: se
agrega acá primero.** Es la misma regla que `README.md` impone para los tipos — un
nombre nuevo es un cambio de contrato y tiene que verse como tal en el diff.
