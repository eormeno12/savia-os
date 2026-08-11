# Auditoría de completitud — `docs/product/savia-b2b/borrador-pipeline-tecnico.md`

## Resumen

**76 huecos reales** tras deduplicar (los 10 agentes reportaron ~380 entradas; el solapamiento fue alto en los 12 más graves, señal de que son los que importan). Descarté ~40 por ser infraestructura pura (batching, métrica de distancia de Qdrant, pre/post-filtrado k-NN, normalización de vectores), por estar especificados en algún lado que el agente no leyó (p. ej. `Contenido = 1` no contradice "evidencia responde por la forma": la glosa de L473-475 distingue *forma* de *valor*, no *bytes* de *texto*), o por ser nits de redacción.

**La lectura:** el plan es fuerte donde razona y débil donde declara. La arquitectura —la cintura de seis formas, R1/R2/R3, la delegación emergente, la identidad reconciliada en vez de calculada, la pasada de reducción— está pensada con un rigor poco común y sobrevive el escrutinio. Lo que falta es la capa de abajo: **`packages/ir` —el paso 1 del propio plan de construcción, "el contrato" que "se congela y se versiona primero" (L1824)— no está escrito**. Dieciséis tipos se usan en firmas y nunca se definen, y de ellos cuelgan cinco umbrales load-bearing que el documento tampoco fija. El resultado es que ninguno de los once pasos del orden de construcción puede empezar, y que las cifras que el banco de pruebas reporta (anclaje 1.00, "1 invocación + 199 aciertos", 502 anclas) no son reproducibles porque dependen de decisiones no escritas.

Segundo hallazgo estructural: **al menos seis piezas se eliminaron invocando mecanismos de los tramos 6 y 7 como justificación** (`OVERLAP_CHARS`, el tramo de Diferencia entero, el estado `excedido`, los dos vectores, `α`, la frontera semántica). Las eliminaciones son firmes; los mecanismos que las sostienen son una celda de tabla cada uno. Que los tramos 6 y 7 estén "sin diseñar" no los exime: son deuda contraída por tramos cerrados.

---

## Contradicciones

Bugs del plan, no huecos. Cada una tiene dos afirmaciones del documento que no pueden ser ciertas a la vez.

### C1 · `cohesiónDe` tiene dos definiciones vivas e incompatibles
*(reportada desde 5 ángulos)*

- L1092-1093: `cohesiónDe = (tipo, forma) => COHESIÓN[tipo] ?? (forma === 'text_span' ? 'splittable' : 'atomic')`, con `COHESIÓN` de 4 entradas → codominio `atomic·splittable·lead·satellite`.
- L1459-1464: tabla `lead · satellite · solo · normal`, con `solo ← codigo, formula, imagen` y `normal ← todo lo demás`.
- L1767 (invariantes del banco): "**código siempre atómico**" — vocabulario del conjunto viejo.

No es un renombre: un `tipo:'cita', forma:'text_span'` da `splittable` en una y `normal` en la otra; un `grid` da `atomic` en una y `normal` en la otra. El switch del tramo 5 (L1443-1447) ramifica sobre los cuatro valores nuevos: con la función escrita, `codigo` devuelve `atomic` y **ninguna rama matchea nunca**. Y el test declarado "exhaustivo, 15×6 = 90 casos" (L1867) no tiene oráculo mientras haya dos codominios.

### C2 · El hash del fragmento excluye las migas; lo que se embebe las incluye
*(3 ángulos — la más consecuente de todas)*

- L1510-1513: `texto: string // LIMPIO — las migas no van adentro` … `hash: ContentHash // clave del caché de embeddings`.
- L1936: "**La miga se concatena** al texto y se embebe una sola vez" … "`hash(fragmento ‖ versiónEmbedder)`".

Si el hash **no** incluye la miga: 300 contratos con la misma cláusula comparten entrada de caché y 299 reciben un vector que codifica la sección de otro documento — el vector equivocado, sin señal. Si **sí** la incluye: los 300 contratos tienen 300 claves distintas (sus títulos de sección difieren) y el titular "una cláusula estándar en 300 contratos → **1** vector" (L1977) es falso, **y con él se cae la justificación de haber borrado el tramo de Diferencia entero** ("estrictamente más potente, y una pieza menos", L1980).

Corolario que el plan tampoco resuelve: editar un título —el caso emblemático de estabilidad del tramo 4, "0 ids movidos" (L1712)— cambia las migas de todos sus descendientes. Con el hash sobre texto limpio, el caché acierta y sirve vectores calculados con la miga vieja.

### C3 · El nodo-fila no cabe en ninguna de las seis formas
*(4 ángulos)*

- L1533: "cada fila es un nodo"; L1548: "**El esquema vive en el container, no en la fila**" — declarado **requisito medido** (anclaje 1.00 vs 0.00, L1754).
- L1040: `{ forma: 'container'; ordenado: boolean }` — no tiene campo para encabezados.
- L1038-1039: `grid` lleva `encabezados`; `fields` lleva `{etiqueta, valor}[]` — las dos reintroducen el esquema en la fila, que es exactamente el caso medido como anclaje **0.00**.

No hay forma que sea "fila sin esquema", y no hay dónde poner el esquema. La decisión más fuertemente medida del documento es **inexpresable en el tipo `Cuerpo`**. Se arrastra: L1554-1555 dice que "la composición del fragmento toma las etiquetas del container" y no hay de dónde tomarlas; `Registro.valores: Record<string,string>` (L1518) no se puede construir.

### C4 · El punto fijo y la guarda de ciclo necesitan hashes mutuamente excluyentes
*(3 ángulos)*

- L806-807 (precondición de terminación): "una región que cubre casi todo su origen debe **referenciar el original**, nunca materializar un recorte".
- L814: "**Ciclo.** Un hash de contenido que ya está en la cadena de ancestros corta."

Si la región referencia el original, su hash de contenido **es** el del ancestro: la guarda de ciclo corta la primera descomposición legítima de toda página escaneada — incluido el "contrato escaneado (PDF → página → firma)" que el banco reporta como verificado (L1680). Si el hash incorpora la caja, nunca coincide con el ancestro: el punto fijo no dispara jamás y la guarda de ciclo no detecta el caso A→B→A que dice proteger.

Tercera víctima: el caché por página (L318-321, "un contrato al que le cambian una hoja reusa las otras 199") se indexa por `hashBytes`; si todas las páginas referencian el mismo original, **todas colisionan** y la segunda recibe el árbol de la primera.

### C5 · Las migas quedan vacías para 7 de los 12 adaptadores
*(3 ángulos)*

- L1230: "migas ← los scopes abiertos que son **TÍTULOS**".
- L1250-1252: el propio documento admite que "en HTML los scopes son ancestros del DOM —`body / div / section / ul / li`— y eso como miga de pan es basura".

Con `via:'ninguna'` la ruta es `[]` (L1204) → sin scopes → sin migas: `chat`, `.zip/.eml`, piso de texto. Con `via:'padre'` sobre DOM/mdast los títulos son **hermanos, no ancestros** → sin migas: `.md`, `.html`. Con `via:'celda'` los scopes son hoja/región/fila → sin migas: `.xlsx`, `.csv`.

Eso deja sin efecto el mecanismo que reemplaza al solapamiento ("el fragmento nº 12 de una sección larga no queda huérfano: lleva `Contrato › Cláusula primera`", L1478-1480), que es la justificación escrita para haber borrado `OVERLAP_CHARS` (L1608). El plan diagnostica el problema para HTML y no lo resuelve para ninguno de los siete.

### C6 · Tres afirmaciones incompatibles sobre el orden del tramo 1

- L172-173: "**1.** validar en la puerta: tamaño · formato legible · no cifrado · **antivirus** → **2.** guardar el original → **3.** calcular hash de bytes".
- L183-184: "El antivirus corre **en paralelo** al guardado, **no antes**".
- L325-326: "**La API no toca bytes**: emite el permiso y después verifica que el objeto llegó".
- L328-330 + L828: "Se deduplica el blob" / "El almacenamiento **ya es direccionado por contenido**".

Cuatro incompatibilidades encadenadas: no se puede validar bytes que la API no ve; el antivirus no puede estar en el paso 1 y en paralelo al paso 2; no se puede escribir a una clave derivada del contenido si el hash se calcula en el paso 3; y "se rechaza **solo en la puerta**" (L331) es falso si el antivirus marca después de que el objeto ya está guardado, registrado y quizá encolado — caso para el que la máquina de estados no tiene transición.

### C7 · La sonda persistida no puede correr los evidenciadores que el mecanismo necesita
*(4 ángulos)*

- L251-252: "se corre **solo su `evidencia()`** contra las sondas guardadas — se recorre una tabla chica, **no se leen archivos de almacenamiento**".
- L243-247: `documento_en_espera` guarda extensión, mime, tamaño, 4 KB, tipoDetectado. **No guarda `origen` ni los métodos perezosos.**
- L405-410 (`evidenciaDocx`, el único ejemplo completo): `const e = await s.entradasZip()`.

O el barrido lee los objetos completos (y la afirmación de costo es falsa), o los cuatro adaptadores de zip —`.docx`, `.xlsx`, `.pptx`, `.odt`, los de mayor demanda probable— **devuelven `Ninguna` siempre y nunca rescatan nada, en silencio**. Justo el `.pptx` que el propio documento usa como caso testigo del mecanismo (L268, L275).

### C8 · El determinismo verificado en CI no puede pasar
*(2 ángulos)*

- L957-959: "`a.reconocer(f) ≡ a.reconocer(f)` — **árbol byte-idéntico**" … L961-962: "Un adaptador que no lo pasa **no entra al registro**".
- L1043: `Autoría = { … cuándo: Instante … }` — un timestamp en cada nodo.
- L937: `msMáximo` — el conjunto de nodos depende de la velocidad de la máquina.
- L964-965: "El modelo perceptual no rompe esto: … **su versión está en la clave del caché**".

Los tres primeros hacen fallar el test para todos los adaptadores. El cuarto es un non sequitur: versionar el modelo hace correcto al *caché*, no determinística a la *función*. Y en dos invocaciones consecutivas la segunda es un acierto de caché por `hashBytes`, así que el test **pasa por construcción aunque el modelo devuelva algo distinto cada vez**. Además `reconocer` no es miembro de `Adaptador` (L493-498) y el tramo 3 no produce árboles ("el árbol nunca existe como estructura", L1262).

### C9 · `descomponer` tiene dos firmas
- L496: `descomponer: (bytes: Uint8Array, ctx: Contexto) => Promise<Unidad<S>[]>`.
- L998: `descomponer: (msg) => msg.párrafos.map(...)` — objeto tipado, síncrono, **sin `ctx`**.

O el parámetro es polimórfico (y `seleccionar()` no puede devolver un `Adaptador` uniforme, y la orquestación no puede llamar a todos igual), o el chat serializa a bytes (y hay que inventar el formato canónico, que entra en `hashBytes`, en la clave del caché y en el dedupe de blobs — y las "diez líneas" dejan de ser diez). El chat es el paso 5 del plan de construcción precisamente porque "es el canal que más tensiona la abstracción" (L1852).

### C10 · El streaming es incompatible con las dos firmas del tramo 3
- L1262-1264: "El árbol nunca existe como estructura… **se puede emitir en streaming sin materializar el documento en memoria**".
- L496: `descomponer` devuelve `Promise<Unidad<S>[]>` — el arreglo completo.
- L558-564: `detectar` es una factory que **recibe el corpus completo por diseño** ("la respuesta es relativa al documento").

`porProminencia` no puede existir sin dos pasadas sobre todo el documento. El streaming es una propiedad del emisor *después* de que el tramo 3 materializó todo — que es justo el caso que `nodosMáximos` intenta acotar (PDF de 800 páginas, hoja de 50.000 filas).

### C11 · "Nada derivable se almacena" borra el orden que el pase 2 necesita
- L1266-1267: "**No se almacena nada derivable:** ni `depth`, ni `siblingIndex`, ni `ordinal`. Se caminan desde `parentId`".
- L1276 (pase 2): "Las anclas parten **ambas listas** en tramos".

El orden entre hermanos **no** es derivable de `parentId`: eso es exactamente lo que daba `siblingIndex`. Sin él, la lista vieja no es una secuencia ordenada y el pase 2 no tiene sobre qué operar. Lo mismo afecta a `container.ordenado`, que el documento dice que "sostiene la tesis del producto" (L1057).

### C12 · R3 declara desechable lo que el reconciliador necesita
- L129: "Lo primero [la IR] **se regenera entero desde los bytes en cada re-ingesta**".
- L1276-1277: los pases 2 y 3 emparejan **por parecido** — necesitan el *contenido* viejo, no solo el hash.

O la lista de `NodoEmitido` anterior se persiste (y la IR no es desechable, y una planilla son 50.000 filas por versión en Postgres), o se re-reconocen los bytes viejos en cada re-ingesta (duplicando el tramo más caro, y con el clasificador de *hoy*, no el de entonces). Agravante: L290-292 declara explícitamente que **el versionado no está resuelto** ("Ninguno resuelve versionado. Eso se decide por canal") y L291-292 dice que la subida manual "crea documento nuevo" — o sea que en el canal más frecuente el reconciliador **no corre nunca**, cosa que el tramo 4 no discute.

### C13 · `SourceRange` exige leer una `Ubicación` declarada opaca
- L1517: `coordenada: SourceRange // hoja · fila · columna — direccionable`.
- L1072-1074: "`Ubicación` es **opaca**: página, hoja y offset no significan nada… **Solo el adaptador que la produjo sabe resolverla**".

El tramo 5 vive del lado limpio del borde. O extrae hoja/fila/columna de la ubicación (violando R1 en sentido inverso), o llama al adaptador (violando el grafo de paquetes de L1811-1817, donde `emision` y `adaptadores` "NUNCA se ven entre sí"). Mismo problema con la citación: L1072-1074 dice que resolver la ubicación "hace falta recién en la citación", y el resolvedor no puede vivir en ningún lado del grafo.

### C14 · La huella de `container` reproduce el modo de falla que la sección existe para prevenir
- L1348-1351: "si una forma queda afuera, **todos sus nodos hashean igual**, no hay hashes únicos, el pase 1 **no ancla ninguno**, y la identidad colapsa en silencio".
- L1358: "`container` → **la forma y si es ordenado**" — dominio de exactamente dos valores.

Todos los containers no-ordenados de un documento hashean idéntico; por la regla de unicidad del pase 1 (L1275), **ninguno ancla jamás**. Es el hallazgo 10 (L1740-1743, "las 500 filas hashearon idénticas") aplicado a otra forma, presentado como cobertura completa. Y como el esquema de la planilla vive en el container (C3), renombrar una columna **no cambia el hash de ningún nodo** — contra la medición reportada de que "toca **un** nodo" (L1552).

### C15 · "Un nodo entra entero en algún fragmento, siempre" es falso para los `lead`
- L1451: "No hay ninguna rama que corte. **Un nodo entra entero en algún fragmento, siempre**".
- L1476 + L1510: "Un `lead` **no arranca un fragmento con su texto**: cierra el anterior y entra a las migas" / "`texto` LIMPIO — las migas no van adentro".

El texto de un título no entra en el `texto` de ningún fragmento. La salvedad de L1484-1486 cubre solo el último título de un documento, no el caso general. Y ningún tramo persiste el texto de un `lead` fuera de `migas`.

### C16 · `satellite` y `solo` se contradicen en el par más común del mundo real
- L1445: `satellite` → "se pega al fragmento vivo, **nunca queda solo**" (`epigrafe`, `nota_al_pie`).
- L1446: `solo` → "fragmento propio, **sin mezclarse con vecinos**" (`codigo`, `formula`, `imagen`).

Un `epigrafe` después de una `imagen` exige las dos a la vez — y es exactamente el par para el que existen los dos valores. Si gana `solo`, la regla de `satellite` es letra muerta; si gana `satellite`, el argumento del "vector turbio" (L1469-1472) se cae.

### C17 · El ventaneo del tramo 6 es lo que el invariante del tramo 3 prohíbe
- L512-515: "**ningún tramo posterior parte nada**. Partir exige conocer el formato… Un fragmentador que parte está **contrabandeando formato** al otro lado del borde".
- L1936: "Si el texto excede el límite del modelo, el fragmento **no se parte**: se vectoriza en **N ventanas**".

Elegir dónde cae la frontera de una ventana dentro de un texto es cortar, y hacerlo bien exige saber el idioma o si es código — el conocimiento que el invariante reserva al tramo 3. La distinción declarada es de *identidad* (las N ventanas apuntan al mismo fragmento), no de *operación textual*, y el documento nunca lo dice. El invariante que el banco declara verificar ("nada se parte") no puede distinguir los dos casos.

### C18 · El piso físico estampa `declarado` sobre lo que produjo un modelo
- L603-605: "**El piso físico produce `certeza: 'declarado'`**… la forma **se leyó del formato**, no se adivinó. `'inferido'` queda reservado para inferencia de verdad — prominencia, geometría, **modelos**."
- L980 + L1003: el adaptador de imagen encuentra bloques con un **modelo de layout** y `detectar` puede abstenerse.

Para una página escaneada, la forma la produjo el modelo. El piso responde `declarado` sobre algo enteramente inferido, y la certeza "que viaja hasta la skill" (L920-923) miente en el único lugar donde el documento admite un modelo.

### C19 · La confianza perceptual no tiene campo
- L915: nivel Perceptual → "`inferido` **+ confianza**"; L921-922: "una skill puede decidir **no citar como autoridad** algo reconocido con **confianza baja**".
- L1031: `certeza: 'declarado' | 'inferido'` — dos valores, ningún número.

Y con solo dos valores, `enCascada` no puede ordenar posicional antes que perceptual (L622): quedan empatados y decide el orden del autor, justo lo que el reordenamiento existe para evitar.

### C20 · La clave del caché no versiona `descomponer`, contra su propio principio
- L308-309: "si el reconocimiento es una función pura, **la clave del caché es su firma completa**".
- L305: `sha256(hashBytes ‖ idAdaptador ‖ versiónDelClasificador ‖ versiónDelModelo?)`.
- L484 + L856-871: "es el tramo donde vive **casi todo el costo y casi toda la complejidad**"… las trampas (encoding, EXIF, celdas combinadas) viven en `descomponer`.

Arreglar un bug de decodificación no cambia ningún componente de la clave: el caché sirve árboles corruptos para siempre — el bug silencioso que la clave existe para prevenir (L300-302), movido un casillero.

### C21 · La delegación "abre un scope propio" sin ningún portador
- L1224-1225: el emisor ramifica sobre "si **BAJÓ** de un subárbol delegado" / "si **SUBIÓ** a un subárbol delegado".
- L1026-1032 y L1337-1342: ni `Nodo` ni `NodoEmitido` tienen campo alguno que lo exprese. `tipo:'delegado'` fue eliminado a propósito (L1616).
- L1735-1739 (hallazgo 9): el propio documento se reprocha haber afirmado esto "**sin mecanismo**, y el emisor no tenía forma de expresarlo".

El arreglo cambió la prosa del emisor y no agregó el dato que el emisor lee. `ubicación.adaptador` no sirve: un zip dentro de un zip, o una imagen dentro de una imagen, dan el mismo adaptador arriba y abajo. Es el mismo defecto un nivel más abajo, y está listado entre los "Resueltos en esta revisión" (L1790-1793).

### C22 · La pareja `tipo⇒forma` se declara verificable estáticamente y es una propiedad de runtime
- L721-722: "No se corrige en runtime: **se verifica**. Un adaptador que la viola **no entra al registro**"; L1868: "Aserción en el registro" — **ningún test**.
- `Adaptador` (L493-498) no expone qué pares emitirá; `detectar` recibe la unidad y devuelve solo `Clase`, sin ligarse a la forma del cuerpo.

Decidirlo exige ejecutar sobre entradas — que es cómo lo atrapó la simulación (L723-724). Y no hay acción definida ante una violación en producción con un documento nuevo.

### C23 · `columna` y `z` "se fueron a `ubicación`", que no las tiene
- L653-656: "Los dos se fueron a `ubicación`, **donde las coordenadas ya viven**".
- L1042: `Ubicación = { adaptador, ancla, caja?, rango? }`.

`Caja` nunca se define, así que ni siquiera se puede saber si `z` cabe ahí. Y `Registro.coordenada` (L1517) necesita la columna, que no llegó a destino.

### C24 · `.pptx` está a la vez en espera y en el registro
- L268 + L275: *"Todavía no leemos PowerPoint"* y la fila de roadmap `pptx 47 archivos · 12 organizaciones`.
- L979: `| .pptx | marcadores de diapositiva | mapeo | espacial |`.

El caso de uso ilustrativo del mecanismo de sondas usa un formato que el registro declara soportado.

### C25 · El ejemplo de `porProminencia` lee un campo que `Unidad` no tiene
- L573: `u.pt > cuerpo` — señales aplanadas sobre la unidad.
- L525-529: `Unidad<S> = { señales: S; cuerpo; ubicación }`; L577: `u.señales.styleId` — la otra forma de acceso.

Los dos ejemplos de clasificador leen las señales de lugares distintos, en el punto donde se hace cumplir "la clave de todo el diseño" (L532).

---

## Huecos que impiden simular

Sin esto no se puede escribir la primera línea, o cualquier número que se elija cambia las conclusiones.

### H1 · Dieciséis tipos se usan y nunca se definen — `packages/ir` no existe
*(reportado desde 6 ángulos; es el paso 1 del plan de construcción)*

`Contexto`, `Caja`, `Marca`, `Celda`, `Grano`, `RefObjeto`, `Enriquecimiento`, `ActorId`, `Instante`, `ElementId`, `ContentHash`, `SourceRange`, `Forma`, `Cohesión`, `AdaptadorId`, `Evidenciador`, `Anotación`, el tipo del eslabón de cascada (`{certeza, detectar}`), y las funciones `rango()`, `ClavesConNodo`, `AssertNever`, `porOrigen`, `modaPonderadaPorCaracteres`, `corto`.

No son azúcar: cada uno decide comportamiento observable.
- **`Contexto`** (L496) es el único canal posible para `Diagnóstico`, `Presupuesto`, la cadena de hashes de ancestros que la guarda de ciclo necesita (L814), y la función que dispara la delegación. Nada de eso está declarado como miembro. **Qué se invente decide quién hace cumplir el presupuesto (núcleo o los doce adaptadores) y si `descomponer` puede escribir en almacenamiento.**
- **`Celda`** decide si la huella de `grid` incluye tipo y formato → decide colisiones de identidad.
- **`Marca`** decide si poner una palabra en negrita conserva el id (L1354 dice "el texto", omitiendo `marcas` sin decir si es deliberado).
- **`Caja`** sin marco de referencia (unidades, origen, por página o por documento) hace inimplementable la vía `espacial` y la contención geométrica del tramo 4.
- **`ClavesConNodo`/`AssertNever`**: sin ellos, `NoAnida<Cuerpo>` (L1066-1069) —la prueba más fuerte que el documento exhibe, "no compila si está mal"— **es vacuamente cierta**: ninguna de las seis formas menciona `Nodo`, y el helper no inspeccionaría `Celda`, `Marca`, `RefObjeto` ni `Enriquecimiento` salvo que sea recursivo, cosa que no se dice.

### H2 · La función de similitud de los pases 2 y 3 no existe
*(4 ángulos — y el plan enmascara el alcance)*

L1276-1277 dice "se empareja **por parecido**" y no define nada. L1292-1294 declara pendiente **el umbral**, no la métrica: *"se barre sobre el corpus"* presupone una función que barrer.

Hay que inventar, por forma: qué se compara en un `grid` (¿celda a celda? ¿fila a fila?), en `fields` (¿por etiqueta? ¿por valor?), en `asset` (que solo tiene una referencia — da 0 o 1, sin gradación), en `container` (que solo tiene forma y `ordenado`), y cómo se tokeniza `text_span`. **Con una tokenización una planilla pierde 500 identidades y con otra ninguna**, y el documento no permite elegir. Es el hueco que decide la única métrica del tramo.

Sin decidir además: si el emparejamiento es voraz, por orden, o asignación óptima (las tres son lecturas válidas de L1276, y L1387 sugiere una cuarta); qué pasa con empates; si se admite 1:N (un párrafo que se parte en dos es la edición más común y el plan asume 1:1 implícitamente); si el pase 3 conserva la restricción "mismo tipo y misma forma" del pase 2; y si un emparejamiento del pase 2 puede revocarse ante un candidato mejor del pase 3. **El plan nunca declara que el reconciliador deba ser determinístico** — a diferencia de `descomponer` (L950-962) y del desempate del selector, declarado "precondición del caché" (L446-447).

### H3 · Cinco umbrales load-bearing sin valor, ninguno en P1–P5

| Umbral | Dónde | Qué decide |
|---|---|---|
| "proporción **razonable** de caracteres imprimibles" | L215 | La frontera entre indexar y `en_espera` para **todo** archivo. El documento le carga la consecuencia máxima ("erosiona la confianza en la memoria, que es el producto entero", L232) y no da número, ni denominador (bytes crudos vs caracteres decodificados), ni definición de "imprimible" (¿`\t`? ¿`\0`? ¿UTF-16LE, que intercala nulos?) |
| El **tamaño objetivo** del fragmento | L1447, L1490-1497 | La granularidad de todo el índice: número de fragmentos, sus hashes, la tasa de acierto del caché de embeddings, el número de vectores. Ni valor ni **unidad** (no puede ser tokens: el tramo declara no conocer el modelo) |
| "una región que cubre **casi todo** su origen" | L806 | **La terminación de la recursión.** Es literalmente el tipo de umbral que el documento declara no querer (L1699-1702) |
| El **tope** de los pases 2 y 3 | L1415-1424 | Alcanzarlo sin política definida significa mover identidades en masa: "el peor modo de falla del pipeline entero" (L1176). Identificado en Costo y latencia y **no llevado ni a decisión ni a punto abierto** |
| El umbral de **anclaje** que dispara el evento | L1378-1379 | La única alerta del peor modo de falla. Sin número no hay alerta; y sin desambiguador tampoco es accionable (ver H16) |

A esto se suman `msMáximo`, `nodosMáximos` y `bytesMáximos` (L936-939), sin valor y sin reconocerse como abiertos: **P2 admite que falta calibrar uno y faltan cuatro**.

### H4 · No hay serialización definida de ninguna forma a texto
*(3 ángulos)*

`Fragmento.texto` es un `string` y los nodos son seis formas heterogéneas. El documento reconoce que la operación existe —"el único costo real es **serializar las grillas**" (L1589)— y nunca la define: `grid` (¿markdown? ¿TSV? ¿se repite el encabezado en cada ventana de filas?), `fields` (¿`etiqueta: valor` por línea? ¿qué separa un par del siguiente? ¿cómo se escapa un `=` dentro de una etiqueta?), `verbatim` (¿con fence? ¿con lenguaje?), `asset` y `container` (sin texto). Tampoco el separador entre nodos de un mismo fragmento, ni normalización Unicode/espacios/CRLF.

Ese string es a la vez lo que se embebe y la base del `hash` que es clave del caché de embeddings. **Una grilla en markdown con pipes puede duplicar los tokens de la misma grilla en TSV** → cambia si se ventanea y en cuántas ventanas. Y sin normalización, dos implementaciones producen cachés disjuntos y el reuso entre documentos (la afirmación insignia) no ocurre.

### H5 · El tipo de un elemento de ruta, y cómo se compara
*(3 ángulos)*

La tabla de L1202-1208 mezcla tres cosas en el mismo tipo: textos de títulos (`[Contrato, Cláusula primera]`), coordenadas (`[hoja, región, fila]`, donde `fila` es un `number`), e ids opacos del DOM (`{via:'padre'; id; padre}`). El emisor calcula "**común** = prefijo compartido" (L1226) sobre una igualdad que nunca se define, y `parentId ← el tope de la pila` (L1229) exige que el tope sea un `ElementId`.

- Si la igualdad es **por texto**: dos secciones hermanas llamadas igual ("Anexo", "Notas", dos hojas "Datos") no cierran scope y todo lo posterior se anida bajo la primera.
- Si es **por identidad de nodo**: la premisa del argumento central del tramo 4 —"la ruta del párrafo cambió, **lleva el texto del título adentro**" (L1304)— deja de ser cierta y el ejemplo que justifica el diseño de identidad no funciona.

Además, en `celda` y `padre` el tope de la pila puede no corresponder a ningún nodo emitido (no hay nodo "hoja" ni "región"; un `<div>` puede no ser unidad), así que la "postcondición de integridad referencial" (L56, L1605) es inalcanzable sin inventar scopes sintéticos.

### H6 · Qué entra exactamente en la huella, y con qué serialización
L1353-1359 enumera el payload por forma en prosa y no da: si `tipo` y `forma` participan (el pase 2 los compara aparte, lo que sugiere que no — y entonces un `titulo` y un `parrafo` con el mismo texto colisionan y **ninguno ancla**); si `marcas`, `lenguaje`, `mime`, `pendientes` y `grano` entran; normalización del texto (trim, NFC/NFKC, comillas tipográficas — guardar el mismo DOCX con otro editor destruiría todas las anclas); separadores y escapes. **Cada elección produce una tasa de anclaje distinta sobre el mismo corpus** — exactamente la clase de detalle que cambió la conclusión del banco (hallazgo 10).

Caso concreto sin respuesta: por la precondición de terminación (C4), dos regiones distintas del mismo original comparten `RefObjeto` y hashean idénticas → ninguna ancla.

### H7 · `regionesDeGrilla` no es implementable como está
L897-901 da cuatro pasos y ninguno es operativo:
- "filas y columnas **totalmente vacías**": ¿cadena vacía? ¿espacios? ¿una fórmula que devuelve `''`? ¿una sola fila en blanco corta o hacen falta dos? → **cambia el número de regiones**, y con él pistas, rutas, `parentId` y el conteo de nodos de toda planilla.
- "el **tipo dominante** de cada columna": un sistema de tipos distinto de `Tipo`, nunca definido, con reglas de parseo dependientes de locale (`01/02/2026`, `1.234`).
- "la primera fila cuyo tipo **difiere** del tipo modal de su columna": ¿difiere en alguna columna, en todas, o en la mayoría? Con la primera lectura, una celda vacía en la fila 7 la convierte en encabezado; con la segunda, una tabla de puro texto nunca tiene encabezado y **todo cae a `grano:'entero'`**, perdiendo la identidad por fila.
- **Nunca se dice cuándo una región es `grid` y cuándo `fields`** (la única guía es "una región 2×N de etiqueta/valor son `fields`", L548-549, sin decir si el 2 son filas o columnas). El banco reporta "Región `grid` y región `fields` conviven" (L1661) como caso verificado.

Falta además el orden entre propagar celdas combinadas (L865-868) y barrer filas vacías: una celda combinada que cruza una fila en blanco la deja de ver como vacía.

### H8 · `porProminencia` no define "prominencia" como orden
L879-892: el paso 3 candidatea "los que **superan al cuerpo en prominencia**" y el paso 5 "ordena los grupos por **prominencia descendente**", sobre grupos que son pares `(tamaño, peso)`. No hay forma de decidir si 14 pt negrita es más prominente que 16 pt regular. **El orden inventado determina qué grupo es nivel 1 y qué grupo es nivel 2, o sea el árbol entero de todo documento sin estilos** — que el documento llama "el caso más común del mundo real" (L877).

Sin definir tampoco: `modaPonderadaPorCaracteres` (¿qué unidades entran? ¿empate? ¿distribución bimodal?), `corto(u)` ("~120 caracteres **probablemente**", L891), y a qué nivel colapsan los grupos sobrantes.

### H9 · La sonda de un asset delegado
*(3 ángulos)*

L378-380 declara que "un asset delegado también trae sonda" y L744 que delegar "es literalmente `seleccionar()` aplicado al asset". Un `asset` es `{ ref, mime, pendientes }` (L1037): no tiene `extensión`, ni `mimeDeclarado` fiable, ni `bytesMágicos`, ni `tamaño`, ni implementación de los perezosos. Y por la precondición de terminación (L806-807), una región que cubre casi toda su página **referencia el original** — así que sus primeros 4 KB son los del PDF entero: `evidenciaImagen(esImagen(bytesMágicos))` da `Ninguna`, el adaptador de PDF vuelve a ganar, y **el ejemplo canónico del documento (contrato.pdf → pg3 escaneada → adaptador `imagen`, L750-756) no funciona**.

### H10 · El orden de lectura no está garantizado por nadie
El emisor recorre "para cada nodo, **en orden de lectura**" (L1223) y todo el algoritmo de pila depende de que las rutas compartan prefijos contiguos. El tramo 3 nunca declara emitir en pre-orden y el tramo 4 nunca declara ordenar. Para los adaptadores `espacial` (`.pptx`, `.png/.jpg`, página escaneada) el orden de lectura es precisamente lo que un modelo de layout **no** entrega: hay que ordenar cajas (¿por y luego x? ¿detectando columnas?). Si los nodos llegan intercalados, el emisor abre y cierra scopes en ciclos y **crea silenciosamente dos scopes con el mismo nombre**.

### H11 · La vía `espacial` no tiene predicado
L1208: "derivar **contención geométrica** y caminar como `padre`". Sin definición de contención (¿estricta? ¿por área? ¿con qué tolerancia en píxeles?), sin `Caja`, y sin regla para solapamiento parcial (habitual en PPTX y en salidas de modelos de layout) ni para cajas idénticas — ahora que `z` salió de la pista (L1621) **no queda nada que desempate**. El documento afirma que al sacar `z` "desapareció la ambigüedad" (L656-657); se mudó.

Además `.pptx` recibe `via: 'espacial'` (L979) sin decir de dónde sale el nivel diapositiva, que no es geométrico: o cada diapositiva emite un container (y la vía es mixta), o las cajas de todas conviven en un mismo espacio y se contienen entre sí.

### H12 · Nueve de los doce adaptadores no tienen `evidencia()` especificada
Solo hay código para `.docx`, imagen y `chat` (L405-414, L997). El registro (L969-982) **no tiene columna de evidencia**. Sin eso no se puede resolver el caso que motiva el tramo entero (L354): un `.txt` que en realidad es un CSV. Si `.csv` devuelve `Contenido` (1) gana al piso (0) y produce 500 identidades por fila; si devuelve `Extensión` (2) sobre una extensión `.txt`, ¿devuelve `Ninguna`? La respuesta cambia todo el corpus.

Corolario: `Estructura = 3` y `Contenido = 1` no tienen **ningún productor** en todo el documento, y `evidenciaDocx` —que abre el zip y busca `word/document.xml`, literalmente "estructura interna consistente con el formato"— devuelve `Firma = 4`. Sin criterio operativo para separar los dos niveles, **quién gana un archivo depende de cuál autor fue más modesto al elegir su constante**.

### H13 · Cómo se acuña un `ElementId`
L1271: "La primera vez **se acuñan ids nuevos y listo**". Si son aleatorios, el property test de determinismo (L957-959, "árbol byte-idéntico") falla y los golden files no son estables; si son derivados del contenido o la posición, se vuelve a la fórmula de una sola versión que el tramo entero existe para eliminar. Tampoco está su dominio de unicidad (¿global, por documento, por organización?), lo que decide la clave primaria de la tabla de anotaciones y todo join. Y la idempotencia declarada (L1922) cubre el *reconocimiento*, no el acuñado.

### H14 · La regla de detección de codificación
L861-862 nombra la trampa —"UTF-8, Latin-1 o UTF-16 mal detectados convierten 'Categoría' en 'CategorÃ­a' — y eso llega hasta el embedding"— y no da algoritmo, ni precedencia (BOM / `mimeDeclarado` / heurística sobre los 4 KB / heurística sobre el archivo entero), ni qué hacer ante conflicto. Y el gate del tramo 1 (L215) la necesita **antes**, en un tramo que por diseño no conoce formatos.

Agravante de verificabilidad: la trampa se prueba con **golden files** (L1869), que congelan la primera salida como correcta. Si el adaptador produce mojibake desde el día uno, el test queda verde para siempre.

### H15 · El ventaneo del tramo 6: tamaño, solapamiento, y dónde va la miga
L1936 dice "N ventanas" y no da: el tamaño de ventana (así que **N no es computable**, y `vectores: N` es el número que reemplazó al estado `excedido`, L1611); si se solapan (`OVERLAP_CHARS` se borró con un argumento sobre fronteras **entre** fragmentos, donde hay una miga que compensa — dentro de un fragmento no la hay); si la miga se concatena antes o después de ventanear (si antes, **las ventanas 2..N quedan descontextualizadas**, que es el problema que el tramo 5 declara resuelto en L1478-1482; si se repite, N crece); y en qué unidad se mide "el límite del modelo" (tokens exactos vs caracteres difiere por factores de 2-4 según idioma).

Colisión de vocabulario: "ventana" nombra dos cosas distintas y L868 atribuye el ventaneo **al tramo 5** ("de la rectangularidad dependen la identidad por fila y **el ventaneo del tramo 5**"), mientras L1497 y L1611 lo ponen en el 6.

### H16 · Cómo se distinguen las dos causas de anclaje bajo
L1378-1381 identifica el problema con precisión —"puede ser un documento reescrito, o puede ser que **un adaptador cambió** y ahora produce hashes distintos para el mismo contenido — y esas dos causas se ven idénticas desde afuera"— y se detiene ahí. Las consecuencias no son simétricas: en el primer caso reemplazar en bloque es correcto; en el segundo **destruye la curación de todos los documentos de ese formato a la vez**. El dato que las desambiguaría existe (idAdaptador y versión están en la clave del caché) y no se adjunta al evento. No está en P1–P5.

Y el propio plan de despliegue lo provoca: "**Adaptadores detrás de bandera, uno por uno**" (L1918) significa que cuando se enciende el adaptador de `.rst`, todo lo que entró por el piso se re-ingiere con otro adaptador → cero anclas, todos los ids nuevos, toda la curación despegada.

---

## Huecos que obligan a inventar comportamiento

Se puede escribir código; el comportamiento depende de una decisión no tomada.

**Estado y ciclo de vida del documento**

1. **La máquina de estados no tiene transiciones.** L198-199 lista ocho valores y una secuencia feliz. Sin declarar: si `parcial` es terminal, qué lo convierte en `indexado` cuando drenan los pendientes (L1911-1914 admite el riesgo de "documentos que quedan `parcial` para siempre" y **no da el contador que lo detectaría**), si `en_espera` va a `recibido` o a `reconociendo`, si `rechazado` es alcanzable después de `recibido` (necesario para el antivirus tardío), y qué estado tiene un documento "guardado pero no escaneado". Sin las transiciones no se puede escribir ningún worker ni la consulta del barrido.
2. **`nivelLogrado` no tiene productor ni valor para el caso mixto.** El campo lo declara el tramo 1 (L200) y el hecho que lo determina lo produce el tramo 2. Y no hay valor para el ejemplo estrella del propio documento: 198 páginas estructuradas + 2 delegadas. Es el campo que "vuelve visible la degradación" y alimenta la métrica de L1893.
3. **`seleccionar()` descarta la evidencia ganadora** (`Promise<Adaptador | null>`, L436), así que el llamador no puede distinguir "ganó un adaptador dedicado" de "cayó al piso" sin comparar `a.id === 'piso'` — ramificar sobre la identidad de un adaptador desde la orquestación.
4. **Concurrencia.** Tres caminos pueden pisarse sobre el mismo documento (re-subida, re-emisión por delegación tardía, re-encolado por adaptador nuevo). Los tres leen "la versión anterior" y escriben una nueva. Sin lock, versión optimista ni orden declarado, dos corridas acuñan ids divergentes y el último gana.

**Presupuesto y terminación**

5. **Solo `invocacionesMáximas` tiene comportamiento al agotarse.** L947-948 especifica diferir *assets*. Para `nodosMáximos`, `bytesMáximos` y `msMáximo` solo hay "degrada y lo registra" (L941). Un `.csv` de un millón de filas agota `nodosMáximos` a mitad de `descomponer`, y lo que queda **no es un asset reclamable por `seleccionar()`**: no hay nada que encolar, y no existe la noción de reanudar. O se trunca (violando "ninguna información se descarta en silencio", L1768-1769) o no termina.
6. **Quién hace cumplir el presupuesto** (núcleo o los doce adaptadores) y **qué presupuesto recibe un asset re-encolado** (nuevo → el techo por documento no acota nada; el saldo → hay que inventar dónde vive entre corridas separadas por horas, y la cola nunca drena). `msMáximo` no es interrumpible sin un mecanismo de cancelación que no se menciona.
7. **El presupuesto pierde su medida decreciente.** "Un acierto de caché no descuenta, porque no cuesta" (L946) sumado a que el punto fijo y la guarda de ciclo no disparan sobre assets distintos-pero-cacheados: el único límite queda siendo el tiempo, que la regla dice que no debería contar. La invariante "la recursión termina" no se sigue de las reglas escritas.
8. **El tramo 2 no tiene presupuesto.** `entradasZip()` sobre un zip bomb corre **antes** de que exista `Presupuesto`, y `Promise.all` (L437) lo dispara en los cuatro adaptadores de zip a la vez. El documento declara el zip bomb "una entrada esperable, no un incidente" (L942-944) y el único mecanismo que lo acota está en el tramo siguiente.
9. **Un evidenciador que lanza hace fallar toda la selección.** `Promise.all` propaga el rechazo: no devuelve `null`, tira. Sin decidir si eso es `Ninguna`, `fallido` o `en_espera` — en un pipeline donde "los archivos rotos son la norma, no la excepción" (L869).
10. **Dónde termina la tolerancia a archivos rotos.** No hay criterio que separe `parcial` de `fallido`, ni camino de vuelta cuando `descomponer` lanza: `seleccionar()` devuelve un solo adaptador y no hay reselección, pero el tramo 1 promete `nivelLogrado: texto plano` como degradación visible, que requiere exactamente ese camino.

**Delegación**

11. **Quién ejecuta la delegación.** "La recursión ocurre sola" (L762), pero alguien tiene que recorrer las unidades, detectar los `asset`, construirles sonda, llamar `seleccionar`, invocar `descomponer` e injertar. Ese orquestador no es ninguno de los dos casilleros y no está en ninguna interfaz. **Su ubicación decide si `adaptadores` depende de la orquestación**, rompiendo el grafo de L1811-1817, y dónde se aplican el punto fijo, la guarda de ciclo y el descuento del presupuesto (y en qué orden — el resultado "presupuesto de 1 → exactamente 1 invocación", L1682, depende de si la guarda corre antes o después de invocar).
12. **Dos modelos de ejecución incompatibles.** El diagrama de L750-756 muestra el subárbol injertado inline; L772-775 y L1329-1332 dicen que el asset se agenda en la cola lenta y el documento se indexa `parcial` de inmediato. Uno espera y emite un árbol completo; el otro emite dos veces. Cambia si el tramo 4 recibe una lista o dos y en qué posición del orden de lectura entran los nodos nuevos.
13. **Composición de rutas y migas a través de la frontera de delegación.** El adaptador delegado produce pistas relativas a su propio documento y no sabe nada del padre. Sin regla de concatenación no se puede calcular `parentId` ni migas para **todo** PDF escaneado, imagen incrustada, miembro de zip y adjunto de correo. Y "hereda el contexto jerárquico de su contenedor" (L746-747) no se puede verificar. Colisiona además con `via:'ninguna'` para `.zip/.eml` (ruta `[]` → prefijo común 0 → el emisor cierra todos los scopes en cada miembro).
14. **La `Autoría` de un subárbol tardío**: ¿se hereda la del contenedor o se sella el instante real? Con la segunda, dos re-ingestas producen nodos con `cuándo` distinto.
15. **Encadenamiento de `Ubicación`** para citar un nodo que nació dentro de una imagen que estaba dentro de una página de un PDF: el adaptador que la produjo es el de imagen, que no sabe nada del PDF ni de la página 3.
16. **Si un miembro de contenedor es un `documento` o un `asset`.** L461-463 dice que cada miembro "vuelve a entrar por este mismo tramo con su propia sonda"; `documento_en_espera` tiene `documentoId` (L244), lo que implica que un miembro que nadie sabe leer necesita ser documento. Pero un miembro no se sube por ninguno de los cuatro canales y `Sonda.origen` no tiene valor para él. **Los dos caminos dan identidades, cuotas, dedupe, estados y árboles distintos para el mismo `.zip`.** Y nada dice qué hacer con `multipart/alternative` en un `.eml` (HTML + texto plano del mismo contenido → dos identidades del mismo texto, que el tramo 4 reconciliaría como altas duplicadas).

**Anotaciones (R3)**

17. **`Anotación` no está definido y el flujo es de solo escritura.** `mirar(nodo): Anotación[]` (L151) es toda la especificación. Ningún tramo declara **leer** anotaciones — pero las exclusiones y la sensibilidad (L126) solo significan algo si alguien se niega a indexar. Sin punto de lectura, contenido marcado como excluido llega al índice. Y el tramo 6 es donde el texto **sale hacia una API de terceros**: no se dice si un nodo sensible se embebe igual.
18. **No hay marca que distinga anotación automática de curación humana**, y las dos viven en el mismo almacén. La delegación tardía es una re-emisión completa (L1320), así que los anotadores vuelven a correr sobre todos los nodos: sin clave de deduplicación, cada re-emisión duplica; con borrado-y-reescritura, **arrastra la curación humana** — la falla exacta que R3 existe para impedir.
19. **Qué pasa con una anotación cuyo nodo es una baja** (L1279). ¿Se borra en cascada? ¿Queda huérfana? ¿Se resucita si el párrafo vuelve? El plan resuelve el caso del nodo que sobrevive con otro id y no el del nodo que desaparece.
20. **Los anotadores no tienen registro, orden, política de fallo ni presupuesto** — a diferencia de los adaptadores, que tienen registro explícito y determinismo verificado en CI. Y "cuestan cero pasadas extra" (L1565) es una afirmación sobre *pasadas*, usada como si fuera sobre *costo*: ocho expresiones regulares sobre 50.000 nodos-fila no son microsegundos.
21. **El contrato `mirar(nodo)` no da acceso al contexto** que el propio tramo declara tener a mano: un anotador sobre un nodo-fila sin etiquetas no puede saber qué columna mira.

**Caché**

22. **Qué se guarda en el caché de reconocimiento.** Se habla de "el árbol", pero los nodos llevan `Autoría` (actor, cuándo, fuente) y `RefObjeto`, que son por documento y por tenant. El caché se indexa por `hashBytes`, así que el acierto **cruza organizaciones por diseño** (es el caso que L297 celebra). Reusar propaga la autoría del primer subidor —"esto lo dijo el CFO en marzo", que el documento llama "la mitad del valor de la memoria" (L1077)— y referencias al espacio de claves de otro tenant. El argumento "el caché no filtra información" (L314) cubre la decisión de reusar, no el contenido de lo reusado.
23. **"La invalidación es perezosa: se re-reconoce al **próximo acceso**" (L311-312)** usa una noción de acceso que no existe: el caché se consulta al **ingerir**, no al consultar. Subir la versión del clasificador **no alcanza nunca al corpus existente** y "el costo sigue al uso" describe un costo que es cero porque el trabajo no ocurre.
24. **"Configurable por organización" (L315)** no dice si el opt-out aplica a lectura, escritura o ambas, ni cuál es el alcance por defecto (intra-tenant o entre tenants). Una organización que no lee pero sí puebla subsidia a las demás; una que no puebla pero sí lee obtiene el beneficio sin el riesgo que objetaba. Es una decisión de seguridad, no de rendimiento. Y no se dice si el mismo interruptor cubre el caché de embeddings, cuya clave es un hash de **texto derivado**, no de bytes originales — así que el argumento "hay que poseer bytes idénticos" no se transfiere.
25. **`versiónDelClasificador` no es miembro de `Adaptador`** (L305 vs L493-498): ni dónde vive, ni quién la incrementa, ni si es una por adaptador o una por eslabón de cascada. Un `.docx` usa `porStyleId` y `porProminencia`, que evolucionan por separado: con una sola versión, tocar prominencia invalida todo lo que resolvió el estilo. Y la métrica "tasa de acierto **por versión de clasificador**" (L1894) asume que existe una sola y que es recuperable — de un sha256 no se recuperan sus componentes.
26. **`versiónDelModelo?` es opcional** pero saber si el modelo se invoca exige ejecutar, y la clave hace falta antes para consultar. Ciclo sin salida escrita.
27. **El operador `‖`** no está definido: sin longitud prefijada ni delimitador, un `idAdaptador` terminado en dígitos seguido de una versión numérica colisiona con otra terna — el caché sirviendo árboles equivocados en silencio, el modo de falla que la sección dice evitar.
28. **`versiónEmbedder` no está desglosada** (a diferencia de la clave del tramo 1, que sí lo está): ¿nombre del modelo? ¿dimensión? ¿parámetros de truncado? ¿el formato de concatenación de la miga, que también es parte de la función? Un proveedor que actualiza el modelo detrás del mismo nombre sirve vectores de otro espacio con la misma clave.
29. **No hay política de invalidación de vectores.** Si se hereda la invalidación perezosa del tramo 1, vectores de dos modelos conviven en la misma colección y **las distancias dejan de tener significado** — no un resultado peor, uno arbitrario. Si no se hereda, hace falta un backfill masivo que el documento rechaza explícitamente para el clasificador.

**Barrido de `en_espera` y roadmap**

30. **"Al registrar adaptador nuevo A" describe un evento que no existe.** El registro es por import explícito (L471), o sea que ocurre en cada arranque de cada réplica. Hace falta estado persistido de qué adaptadores ya barrieron, y una clave de versión del **evidenciador** (la clave del caché versiona el clasificador, no `evidencia()`). Sin eso, o el barrido corre en cada deploy para los doce adaptadores en todas las réplicas, o no corre nunca. Tampoco hay bloqueo ni clave de idempotencia del re-encolado.
31. **Los documentos degradados por el piso nunca se re-procesan.** El barrido recorre solo `documento_en_espera` (L251). Un `.rst` indexado hoy como texto plano —el ejemplo con el que L235-236 justifica el piso— no vuelve nunca cuando exista su adaptador. La promesa "aparece contenido nuevo sin que haga nada" (L260-261) cubre la mitad de los casos degradados y el plan no dice si la otra mitad es un no-objetivo. Y el roadmap por demanda (L271-277) cuenta solo los `en_espera`, así que la demanda de esos formatos es **invisible**.
32. **`tipoDetectado` no tiene productor.** L247: `'pptx' | 'dwg' | null ← si la firma lo identificó`. Nada en el diseño identifica formatos por nombre: `evidencia()` devuelve un ordinal y solo la corren los adaptadores que existen, que por definición no existen para lo que queda en espera. Hace falta un catálogo de firmas paralelo al registro, ausente del diseño y del grafo de paquetes. Sin él, `tipoDetectado` es siempre `null`, la rama "Identificado" del mensaje al usuario **nunca se ejecuta**, y el roadmap se agrupa por `null`.
33. **"Avisanos si lo necesitás y lo priorizamos" (L269)** describe una captura de señal sin campo, endpoint ni tabla — para el subconjunto que, además, no tiene clave de agrupación.
34. **Al reactivar una sonda**: ¿se re-corre el gate? ¿se usa el adaptador A que la reclamó o se vuelve a correr `seleccionar()` completo? ¿se reutiliza el veredicto del antivirus de hace meses? ¿se re-aplica el límite de tamaño vigente?

**Canales y recepción**

35. **El canal `chat` no encaja en el contrato del tramo 1.** La salida declarada es "el original a salvo en almacenamiento de objetos" (L167) y un mensaje no tiene original. Sin decir qué van en `claveObjeto`, `hashBytes` y `tamaño` (¿nullables? entonces dedupe e idempotencia no aplican a un canal entero), ni cuáles son sus `bytesMágicos`. El documento declara al chat "la evidencia más fuerte de que la descomposición es correcta" (L1008-1009).
36. **El canal `carpeta local` no tiene mecánica** y **no está** en "Lo que deliberadamente no se construye todavía" (L1924-1928, que excluye conectores, espejo y eventos). Falta: quién calcula el hash del lado del cliente, cómo se detecta un cambio, qué pasa al renombrar o borrar, y si esos eventos crean versiones. Es uno de los dos canales que "traen identidad de la fuente" (L290-291) — **y no hay campo en el registro que guarde esa identidad**, así que carpeta y conectores crean documento nuevo en cada sincronización y la reconciliación nunca corre.
37. **`hashBytes` no tiene calculador**, dado que la API no toca bytes: descargar el objeto contradice la decisión; confiar en el cliente lo vuelve no verificable (y gobierna dedupe, idempotencia y clave de caché); usar el checksum del almacenamiento con multipart da un hash de hashes dependiente del tamaño de parte — **el mismo archivo subido con chunks distintos da `hashBytes` distintos**.
38. **Con subida prefirmada, nombre/mime/tamaño declarados nunca se contrastan** contra el objeto real. Un cliente puede declarar 1 KB y subir 5 GB: el límite de tamaño (que además no tiene valor, ni alcance, ni se dice si es global/por plan) es decorativo.
39. **Quién detecta el cifrado.** Reconocer que un PDF, un OOXML o un 7z están protegidos exige conocimiento de formato, que por R1 vive en el tramo 3 y corre después. Un contenedor cifrado parece binario aleatorio → cae en `en_espera` en vez de `rechazado`, y el usuario recibe el mensaje equivocado. Y "cifrado **sin contraseña**" sugiere que con contraseña funcionaría; no hay mecanismo para aportarla.
40. **Antivirus:** política de fallo (bloquear, rechazar por precaución contra "se rechaza solo por tres causas", o dejar pasar), qué se hace con un positivo tardío sobre un blob **compartido por dedupe con otra organización**, y si se re-escanea al reactivar un `en_espera` meses después con firmas nuevas.
41. **Dedupe de blob:** alcance (mismo usuario / organización / global), si cruza tenants, conteo de referencias, y qué hace el borrado en cascada cuando el objeto tiene otros referentes. "Toda lectura posterior se filtra por organización" (L192) es un invariante declarado que la dedupe y el caché cruzan deliberadamente sin reconciliarse.
42. **Cola de prioridad:** no hay niveles, ni mapeo canal→prioridad, ni reconciliación con "cola lenta" / "cola rápida" / "cola aparte" del tramo 3 (L773-774, L1140) — no se sabe cuántas colas instanciar. Sin envejecimiento ni cuota por tenant, la prioridad estricta reproduce el problema que dice resolver ("deja a todos esperando", L337) con otro eje. Y "tras **N** reintentos" (L338) no da N, ni política de espera, ni taxonomía que separe daño tolerable de falla transitoria de falla permanente. Ni cómo se re-encola algo desde la cola de descarte —sin lo cual "el archivo está a salvo" pero nunca se procesa.

**Tramo 4 y 5**

43. **Qué pista lleva una unidad cuyo clasificador se abstuvo.** `Clase` empaqueta tipo y pista juntos (L555), así que abstenerse es abstenerse de las dos, y el piso físico solo repone el tipo (L589-593). El ejemplo canónico (L1194-1197) muestra párrafos con pista "—" y ruta `[Contrato, Cláusula primera]`, mientras la vía `ninguna` produce `[]`. **De esto dependen las rutas de la mayoría de los nodos de la mayoría de los documentos.**
44. **`nivel: null` no tiene semántica** (L642), ni hay regla para saltos de nivel (h1 → h3, que `porProminencia` produce por construcción), ni para documentos que empiezan en un nivel distinto de 1.
45. **La `región` de la pista `celda`** no tiene esquema de nombres ni garantía de estabilidad: si se numeran por orden de barrido, insertar una fila en blanco renumera todas y cambia el `parentId` de 50.000 nodos. Y no se dice si `fila` es índice de hoja o de región.
46. **Quién acuña los `id` de la pista `padre`**, en qué ámbito son únicos, y qué hace el emisor con una referencia colgante, adelantada o cíclica.
47. **Cómo se combinan vías distintas en un mismo documento.** El registro asigna una `via` por adaptador, pero el caso mixto es el caso normal: un PDF (`nivel`) con una página escaneada delegada al adaptador de imagen (`espacial`). Comparar `[Contrato, Cláusula 1ª]` con `[caja#3, caja#7]` da prefijo 0 y cierra el documento entero.
48. **`container` no tiene comportamiento en el tramo 5.** El tramo 3 justifica su existencia diciendo que "el fragmentador la necesita: **alcance para las migas de pan**" (L1054), y el recorrido de L1440-1449 no lo menciona: no tiene texto, no está en la tabla de cohesión, y nada abre ni cierra alcance por container. La justificación de la forma no tiene mecanismo. Tampoco viaja `ordenado` a la salida, pese a que "sostiene la tesis del producto" (L1057).
49. **Qué migas lleva un fragmento que agrupa nodos con migas distintas** (`Fragmento.migas` es un solo `string[]`), y si un cambio de sección sin `lead` de por medio cierra el fragmento. En HTML nada es `lead`, así que nada corta por frontera estructural.
50. **Qué string exacto entra en cada miga** (título con marcas, `verbatim`, 400 caracteres, un scope que no es nodo de texto), si se normaliza, si se trunca, y quién pone el separador `›`. Ese string se concatena al texto antes de embeber y va al payload: sin regla, el mismo título produce migas distintas entre ingestas y el filtro exacto por sección deja de matchear.
51. **Predicado del título huérfano** (L1484-1486): "un título que no llegó a contextualizar nada" admite "no hubo ningún nodo entre este lead y el siguiente" o "ningún fragmento se cerró llevando este título en sus migas". Con la primera, un `H1` seguido de `H2` es huérfano y emite un fragmento cuyo texto es solo el título. Y no se dice si su propio texto va a la vez en `texto` y en `migas` (duplicación que la sección existe para evitar).
52. **Un `satellite` sin fragmento vivo** (primer nodo del documento, o justo después de un `lead` que cerró) no tiene referente; y no se dice si respeta el tamaño objetivo. Ni si un nodo `solo` cierra el fragmento en curso ni qué pasa después de él (párrafo–código–párrafo: ¿2 fragmentos o 3?).
53. **Qué produce un fragmento sin texto** (`asset` es `solo` → fragmento propio; `container` no tiene texto). ¿Se embebe cadena vacía (que la mayoría de las APIs rechaza, y que colisiona en el caché con todos los demás)? ¿Se omite (y el nodo no entra en ningún fragmento, contra L1451)? ¿Se espera al enriquecimiento (contra "se indexa de inmediato", L1330)?
54. **`asset.pendientes: Enriquecimiento[]` no tiene productor, consumidor ni tramo.** Es cómo una imagen se vuelve texto consultable —el caso central de la cola perceptual, "un bloque: asset con **descripción pendiente**" (L788)— y ninguno de los siete tramos lo procesa. Sin decidir si el resultado es IR (y se pierde en cada re-ingesta, por R3) o anotación (y entonces no está en el cuerpo, donde el tipo lo pone).
55. **`Registro.valores: Record<string,string>`** exige claves únicas y no vacías; una planilla real tiene columnas sin encabezado, encabezados repetidos y filas cortas. Sin política (rellenar `col_3`, descartar, colisionar), y sin decir si la fila de encabezado es ella misma un nodo que emite registro (el "502" nunca se desglosa).
56. **Los `Registro` no tienen destino.** La mitad exacta del split π/σ no tiene tabla, ni clave, ni idempotencia en la re-ingesta, ni superficie de consulta. El tramo 7 (L1937) no los menciona.
57. **Nueve de los quince tipos no tienen productor**: `subtitulo`, `cita`, `lista_ordenada`, `formula`, `epigrafe`, `nota_al_pie`, `encabezado`, `pie`. Y `encabezado`/`pie` son el insumo del mecanismo de orden de cola (L841-846) y `epigrafe`/`nota_al_pie` la mitad de `COHESIÓN`: **dos mecanismos del documento no se disparan nunca**. `FORMA_OBLIGADA` cubre 5 de 15, dejando 60 combinaciones sin declarar legales ni ilegales — P5 admite una (`parrafo`+`grid`).
58. **`encabezado` y `pie` caen en `normal`** por la tabla de cohesión, así que un pie repetido en 200 páginas entra en el texto de decenas de fragmentos, contaminando vectores y hashes.
59. **La prioridad de mobiliario no tiene portador.** L841-846 la hace depender de que un asset esté "en un encabezado o un pie", pero el `tipo` se asigna después de `descomponer`, el nodo del logo sería `imagen`, y `container` no lleva hijos. El segundo de los dos mecanismos que reemplazan al prefiltro por tamaño no se puede implementar.
60. **C1 no tiene criterio operativo ni enforcement.** L609-611 da tres ejemplos de no-declaración (`Normal`, `<div>`, `<span>`) y ninguno de la frontera (`<p>`, `<b>`, `styleId:'Body Text'`). A diferencia de R1 (build) y R2 (lint), **nada la verifica**: queda como disciplina del autor de cada adaptador, el modo de falla por el que se eliminó C2 y que L93-94 declara inadmisible.
61. **La métrica de atribución no tiene portador.** L1897-1904 la llama "la importante" y "el indicador de salud de toda la capa de reconocimiento". `enCascada` devuelve `{...r, certeza}` y **descarta cuál eslabón resolvió**; ni `Clase` ni `Nodo` lo llevan. El caso que describe (60% resuelto por prominencia en DOCX) es indistinguible con solo `certeza`, porque prominencia, geometría y modelo son los tres `inferido`.
62. **El denominador de `anclaje`** (L1372) no está: con 500 nodos viejos y 5 nuevos el número cambia radicalmente según se use el conteo nuevo, el viejo, el máximo o el mínimo. Los valores reportados (0.38, 1.00, 0.00) no son reproducibles.
63. **Las bajas no tienen portador hacia adelante.** `NodoEmitido` es solo el lado nuevo y el tramo 5 recibe "la lista plana". El tramo 7 tiene que borrar filas y puntos de lo que ya no existe y **nadie le entrega la lista**. Sin eso el índice acumula contenido borrado que sigue siendo recuperable con procedencia confiable.
64. **Multiplicidad asimétrica en el pase 1:** un hash que aparece 1 vez en la versión nueva y 3 en la vieja. La lectura literal dice que no ancla, así que **limpiar duplicados hace que el superviviente pierda el anclaje**. Y "Residuos aceptados" (L1385-1391) discute duplicados simétricos, no este caso. Peor: la medición estrella (502 anclas, anclaje 1.00) supone 500 filas de contenido distinto entre sí; una planilla real con columnas de estado o categoría produce filas enteras repetidas → ninguna ancla → todas al pase 2 en un solo hueco → el escenario cuadrático. **El alcance de los duplicados es mayor de lo que "Residuos aceptados" admite: no es "cincuenta párrafos idénticos", es el caso normal de una planilla.**
65. **Contra qué versión reconciliar si la anterior quedó `parcial` o `fallido`**, y si la re-emisión ocurre después de que subió la versión del clasificador (el caché se invalida perezosamente → los hashes pueden cambiar → la promesa "cero ids movidos" de la delegación tardía no se sostiene).
66. **Dependencia circular emisor/reconciliador:** `parentId ← el tope de la pila` es un `ElementId`, pero los `ElementId` "salen de la reconciliación" (L1338), que es posterior. O el emisor usa ids provisionales que el reconciliador remapea (y hay que decir cómo se remapean los `parentId`, y qué pasa si un padre resulta ser una baja), o corre dos veces.

**Postcondiciones nombradas y nunca enunciadas**

67. **"La integridad referencial es una postcondición del 4"** (L56, L1605) justificó eliminar un tramo entero y **nunca se enuncia**: qué se verifica (¿todo `parentId` existe? ¿el grafo es acíclico? ¿el padre aparece antes?), cuándo, y qué se hace al fallar (abortar el documento contradice "nunca se pierde un archivo"; degradar exige inventar a qué se reasigna el huérfano).
68. **"Ya hay un invariante de no-duplicación en el índice"** (L1608) justificó eliminar `OVERLAP_CHARS` y **no está enunciado en ninguna parte**, ni en la lista de invariantes del banco. Admite lecturas incompatibles: no hay dos puntos con el mismo texto / con el mismo `fragmentoId` / un mismo nodo no pertenece a dos fragmentos.

**Tramo 7**

69. **`fragmentoId` no existe.** `Fragmento` es `{texto, migas, nodos, hash}` (L1509-1514) y L1937 dedupica por `fragmentoId`. Si es el `hash`, dos fragmentos idénticos de documentos distintos son el mismo id y el dedupe **colapsa dos documentos en un resultado** — y a la vez el caché por contenido exige que compartan hash. Si es propio, hay que decir cómo se acuña y si sobrevive al re-agrupamiento (`nodos` está declarado como lo que "sobrevive a que el fragmento se rearme", lo que sugiere que el id no).
70. **El dedupe reintroduce el sesgo por el que se descartó la fusión.** No dice qué ventana sobrevive ni con qué score, ni cómo se compensa que un fragmento de 8 ventanas tenga 8 oportunidades de entrar en el top-k y uno de 1 ventana tenga una. Es el mismo defecto que el documento imputa a la fusión —"una sección que matchea una vez cobra N veces… el peso se escondía donde no se puede medir" (L1950-1953)— y el plan no lo reconoce. Ni el factor de sobre-fetch para que el dedupe no deje el top-10 en 3.
71. **Postgres y Qdrant no comparten transacción.** "Transacción Postgres + upsert Qdrant" (L1937) se escribe como un solo acto. Sin orden, outbox ni compensación, un documento queda `indexado` sin vectores (nadie lo encuentra y nada lo reporta) o con vectores sin fila. Y sin ventana de swap atómico, las búsquedas ven un documento a medias con procedencia confiable — el invariante "nunca se indexa basura" (L31) sin mecanismo.
72. **El "upsert" no borra nada.** Los fragmentos de v2 no son un superconjunto de los de v1 y N cambia entre ingestas. Sin operación de borrado de huérfanos, quedan vectores apuntando a texto que ya no existe.
73. **Qué va al payload además de la miga.** Faltan declarados: **`organización`** —sin la cual la búsqueda vectorial es cross-tenant por defecto, contra el invariante de L192—, `documentoId`, `nodos`, `certeza`, `autoría`, `tipo`. Y la miga como payload usa **texto de títulos**, que es mutable por diseño: un filtro guardado por "Cláusula primera" deja de matchear cuando alguien la renombra, en silencio — la misma edición que el tramo 4 dedica una sección a sobrevivir.
74. **`Fragmento` no lleva `certeza` ni `autoría`**, y agrupa N nodos que pueden diferir en ambas. `certeza: 'mixto'` se borró porque "se calculaba y **no lo leía nadie**" (L1619) — el lector que la leería es este, y todavía no existía cuando se borró. La promesa central del documento ("la certeza… llega hasta la skill que consuma esa memoria", L920-923) **no tiene mecanismo en ningún tramo posterior al 3**. Lo mismo con `parcial`: es de documento y nada lo lleva al fragmento, así que un documento con 2 páginas sin procesar se recupera igual que uno completo.
75. **El evento de salida** no tiene nombre, payload, consumidor ni semántica de entrega, ni distingue "documento nuevo" de "re-emisión por delegación tardía", ni dice si se emite antes o después de que los vectores sean consultables.
76. **El tramo 6 no tiene política de fallo ni presupuesto**, siendo la única justificación escrita de separarlo del 7 que "fallan distinto: una API de modelo y una base de datos no se caen juntas ni se reintentan igual" (L66-67). El documento afirma la diferencia y no caracteriza ninguna de las dos. Y "nada: el ventaneo se ajusta solo" (L1497) es una afirmación de costo sin techo: un `.log` de 200 MB por el piso, o un JS minificado como `verbatim`, producen N ilimitado. **P2 reconoce el problema para la mitad perceptual y la otra mitad no figura como punto abierto.**

---

## Ambigüedades decidibles

Más de una lectura, pero cualquiera funciona. Vale escribirlas para que no las decida cada implementador por su cuenta.

- **`localeCompare` sin locale** (L442) depende de ICU y del locale del proceso: el desempate declarado "precondición del caché" no está garantizado entre entornos. Tampoco se declara que los `id` del registro sean únicos (con dos iguales el comparador da 0 y la clave de caché colisiona).
- **12 vs 13 adaptadores**: L984 "Doce filas", L1636 "13 → 12", contra L581 "los otros doce" (implica 13), L706 y L953 "trece adaptadores". Texto obsoleto; importa solo para saber si falta una fila.
- **5 vs 6 clases de `Evidencia`**: L398 y L470 dicen "cinco clases" y el enum tiene seis (L386-394). Decide si `Piso = 0` es elegible por un adaptador dedicado o está reservado.
- **`bytesMágicos`**: si puede ser más corto que 4 KB, si 4 KB son 4000 o 4096, y qué hace `empiezaCon` sobre un buffer más corto que la firma. Hoy hay que decidirlo doce veces.
- **Normalización de `extensión`**: con punto o sin, mayúsculas, compuestas (`.tar.gz`), archivo sin extensión. Es el campo del que dependen todos los evidenciadores de nivel 2, que es el que decide en ausencia de firma.
- **Memoización de los perezosos**: ¿sobre valor resuelto o sobre promesa en vuelo? `Promise.all` dispara `entradasZip()` en los cuatro adaptadores de zip simultáneamente: con la primera lectura son cuatro aperturas, con la segunda una. La afirmación de costo de L458-459 es verdadera bajo una y falsa bajo la otra.
- **`entradasZip()` sobre el directorio central**, que vive al **final** del archivo: ¿range-request al tail, o descarga completa? De eso depende si "sin haber leído el archivo entero" (L350) es cierto para un `.docx` de 200 MB.
- **Corte temprano en `seleccionar`**: `Promise.all` evalúa los doce siempre, incluso para un PNG cuyo adaptador ya declaró `Firma`. Si es intencional no se dice; si no, "el caso barato no paga por el caro" (L469) es falso.
- **`TIPO_POR_FORMA` mapea `container → 'lista'` sin mirar `ordenado`** (L589-592), así que `lista_ordenada` es inalcanzable desde el piso — y el piso es la respuesta de `chat`, `.zip/.eml` y el piso de texto, que "se abstienen" siempre. Un procedimiento numerado de un `.txt` nunca se distingue de una lista, contra L1057.
- **Fragmento vacío al cerrar** (dos `lead` consecutivos) y nodos de texto vacío o solo-espacios: se emite, se ignora, o se descarta —y descartar en silencio es lo que L1874 llama el peor modo de falla.
- **Si un `lead` o un `satellite` más grande que el objetivo** siguen su regla de cohesión o caen en la de tamaño: la regla está escrita dentro de la rama `normal` (L1447) y enunciada como general en L1502-1504.
- **Si el residuo del pase 3 cruza la frontera de un subárbol delegado**: "sin restricción de posición" es claro sobre el orden y no sobre el aislamiento de scopes que el emisor construye.
- **"Numeran relativo a él"** (L1254-1255): no queda ninguna numeración en el modelo (`ordinal` y `siblingIndex` se eliminaron), así que la frase es un residuo de la fórmula vieja o se refiere a una renumeración de niveles no descrita.
- **Si `marcas` entra en la huella**: probablemente no (poner una palabra en negrita debería conservar el id) pero la decisión no está tomada.
- **El límite de tamaño de archivo** no tiene valor ni alcance (global, por canal, por organización, por plan).
- **El test exhaustivo de `cohesiónDe`**: 90 casos vs 65, porque `FORMA_OBLIGADA` vuelve ilegales 25 pares. Y el oráculo se deriva de la misma tabla que implementa la función, así que solo puede detectar una errata de transcripción — el "dominio finito porque `tipo` es cerrado" (L1867) no aporta poder de detección por sí solo.
- **"Modo sombra… hasta que la comparación sea buena"** (L1919-1920): sin criterio, y sin "anterior" contra qué comparar para un formato que antes quedaba en `en_espera`.
- **"Idempotencia por clave de caché más identificador de documento"** (L1922): ¿cuál de las dos claves de caché? Son de granularidad distinta (documento vs fragmento) y producen sistemas distintos.
- **`Sonda.origen`** mezcla canales y `AdaptadorId` en una unión que **colapsa a `string`** (L367), y el adaptador de chat tiene `id: 'chat'` (L995): `porOrigen('chat', Evidencia.Firma)` no distingue "vino del canal chat" de "lo delegó el adaptador chat". Además `Firma` está definida como "firma inequívoca **en el contenido**" y `origen` no es contenido. Los valores tampoco coinciden con `documento.canal` (`'carpeta'` vs `'carpeta local'`).
- **Qué es una unidad para el piso de texto**: L982 dice "líneas". Si cada línea es un nodo, un `.log` corriente agota `nodosMáximos`; si las líneas en blanco agrupan párrafos, un `.rst` o un `.tex` (el caso típico del piso) sale bien. Órdenes de magnitud distintos de nodos, identidades y vectores.
- **Qué elementos de un formato con árbol se vuelven unidad**: si cada `<div>`/`<section>`/`<ul>` de un HTML emite un `container`, un sitio real produce cientos de containers vacíos (que además hashean todos igual, ver C14); si solo algunos, los ids de la pista `padre` pueden apuntar a algo que no existe.
- **Qué corpus recibe la factory `detectar` sobre un subárbol delegado**: la página o el documento contenedor. Con la página, la moda se calcula sobre pocas regiones y cualquier bloque parece título.
- **Reconciliación de niveles dentro de una misma cascada**: L1790-1791 la declara resuelta, pero el mecanismo dado (el subárbol abre scope propio) resuelve la colisión padre/subárbol, no la de `porStyleId` diciendo nivel 2 y `porProminencia` nivel 1 sobre el mismo documento con dos escalas independientes que el emisor apila como si fueran una — el caso que la propia observabilidad describe como frecuente (L1901-1902).
- **Un nodo que ancla por hash pero cuyo `parentId` cambió**: conserva el id (correcto), pero una anotación de sensibilidad hecha bajo "Confidencialidad" puede terminar bajo "Anexo comercial" sin señal. El plan mide ids movidos y no mide reparentings.
- **Estabilidad del adaptador entre versiones del mismo documento**: si el adaptador elegido no se persiste, cada reintento re-selecciona y puede cambiar si entre medio se registró otro o se movió una bandera.
- **Retención**: la tabla `documento_en_espera` crece sin límite y se recorre entera por cada adaptador nuevo (O(sondas × adaptadores)); el caché guarda árboles completos sin TTL ni desalojo; los blobs deduplicados no tienen dueño único. **P3 (L1782) enuncia solo "el almacenamiento de los `en_espera`": faltan tres políticas de retención, dos con efecto sobre el comportamiento** (un caché sin desalojo nunca sirve entradas invalidadas; una tabla de sondas sin poda hace que cada deploy sea O(corpus)).

---

## Lo que el plan sí especifica bien

Vale saber qué **no** tocar. Estas partes están cerradas y el escrutinio no las movió.

- **La cintura de seis formas y el criterio para que una forma exista** (L1046-1058). "Cada forma existe porque **algún consumidor aguas abajo se comporta distinto**" es un criterio operativo, no una taxonomía, y la tabla nombra al consumidor de cada una. El único caso que se debilita es `text_span` vs `verbatim`, cuyo consumidor declarado ("¿reflowear?") ya no parte nada.
- **R1 hecha grafo de paquetes** (L1800-1826). `ir ← adaptadores`, `ir ← emision`, "estas dos NUNCA se ven entre sí", `ingesta` arriba. Es enforcement real del build, no convención. El argumento de por qué el enum vive en `ir` (L732-734) cierra.
- **`tipo` cerrado y su justificación por R3** (L666-707). La tabla candidato/origen/¿va en la IR? es el mejor razonamiento del documento: `titulo` sí porque el formato lo declaró, `factura` no porque nada en los bytes lo dice. Y "la válvula de escape de la apertura son las anotaciones, no un enum más ancho" (L694) es la conclusión correcta.
- **El piso físico reemplazando a la regla de totalidad** (L583-605). Elimina una obligación que dependía de que cada autor se acordara, y el ejemplo que lo motiva (un clasificador total tipando una imagen como `parrafo` porque no tenía texto que mirar) es concreto y verificado.
- **`enCascada` reordenando por certeza antes de correr** (L617-632). "El invariante se cumple por construcción, no por revisión" — y efectivamente lo hace: escribir la cascada al revés no degrada nada.
- **La identidad se reconcilia, no se calcula** (L1156-1180). La tabla de las cuatro fórmulas y por qué ninguna sobrevive, más el diagnóstico de fondo ("un elemento *es el mismo* respecto de otra versión, no en abstracto"), es la pieza más sólida del documento. Y **por qué el pase 3 no es opcional** (L1285-1290) está demostrado, no argumentado: "es la celda que falta en la matriz *(¿se movió?) × (¿cambió?)*".
- **La distinción `parentId` / migas** (L1244-1252). "La ruta es estructural; las migas son legibles" identifica un error que estaba escrito y lo corrige con precisión — aunque el mecanismo de las migas después no cubra 7 de 12 adaptadores (C5).
- **La delegación como `seleccionar()` aplicado al asset** (L736-762) y sus tres consecuencias (un solo adaptador de PDF, la cola perceptual resuelta gratis, descripción de imágenes = reconocimiento de escaneados). Es la idea más económica del documento: elimina `tipo:'delegado'`, el clasificador `miembros` y el segundo adaptador de PDF de un golpe.
- **La eliminación del prefiltro por tamaño** (L417-431) y su lección de método (L1699-1702). El caso adversarial —el certificado ISO de 32 px— es exactamente cómo se descubre que un parche se escribió como si fuera diseño.
- **Por qué la miga se concatena en vez de fusionarse** (L1939-1962). El defecto oculto de la fusión ("una sección que matchea una vez cobra N veces… el peso se escondía en el tamaño de las secciones, donde no se puede medir") es un argumento que no es obvio y está bien construido. También **por qué la diferencia desapareció** (L1964-1980), con su tabla de tres filas.
- **El orden de construcción por riesgo** (L1828-1861). Cada paso valida una afirmación estructural distinta, y las tres justificaciones (emisor en el paso 2 sin que exista un adaptador; chat antes de docx; imagen antes de docx) están razonadas una por una. No hay nada que agregar acá.
- **Las tres métricas de observabilidad con su modo de falla** (L1900-1914): atribución, tasa de reuso por contenido, pendientes en cola. Los tres párrafos explican qué falla se vuelve invisible sin cada una. El problema es que ninguna de las tres tiene hoy el dato que necesita — pero la elección de qué medir es correcta.
- **La honestidad sobre los propios errores** (L1647-1761). Las cuatro rondas, los once hallazgos, "la reducción tiene un piso y no se descubre razonando sobre el diseño", y "lo que el banco NO confirmó". Un documento que registra que uno de sus arreglos estaba mal es más confiable que uno que no.