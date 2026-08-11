# Lectura cruzada de capas — 2026-08-10

> **Qué es esto.** Cuatro lecturas simultáneas, una por capa (2 a 5), con **una sola
> pregunta**: *¿hay algo que esa capa necesite de la Capa 1 que la Capa 1 no
> produzca?* Es una lectura, no un diseño. **Acá no se decide nada.** Lo que se
> encuentra se registra con `archivo:línea` y se manda al borrador de la capa que le
> toca decidirlo.
>
> **Por qué ahora.** El contrato de Capa 1 (`packages/ir`) tiene hoy **un solo
> dependiente** — `packages/emision` — y mañana va a tener tres paquetes encima.
> Descubrir tarde que a una capa de arriba le falta un dato que la Capa 1 nunca emitió
> es el único error de esta etapa que no se corrige con un parche: se corrige
> reindexando todo.

---

## Cómo leer los hallazgos

Cada capa devolvió cuatro listas: lo que necesita y **no** recibe (A), lo que necesita
y **sí** recibe (B), lo que su documento lista como pendiente pero la Capa 1 **ya
decidió** (C), y lo que sigue **genuinamente abierto** y le toca a ella (D).

Lo que sigue es el cruce. Un hallazgo que aparece en una sola capa es una necesidad;
**uno que aparece en tres o cuatro, leído por lectores que no se hablaron entre sí, es
estructural.**

---

# Parte I — Los hallazgos convergentes

## H1 · La unidad no coincide: la Capa 1 emite fragmentos, todo lo de arriba asume «hechos»

**Lo encontraron la Capa 2 y la Capa 4 por separado, y la Capa 5 llega al mismo lugar
por el lado de los `Registro`. Es el hallazgo más caro del informe.**

El glosario define `Memoria` como **«la unidad atómica de conocimiento: un hecho»**
([`02-glosario-y-entidades.md:70-73`](02-glosario-y-entidades.md)). La visión define
**π** como «la verbalización del contenido en proposiciones»
([`01-vision.md:119-120`](01-vision.md)). El motor de clustering coloca **una memoria =
un punto = un vector**: `placeAtAdd(userId, fact.id, vec1536, areaId)`
(`apx-motor-v2.md:103`), y `MemoryEdge`, `MemoryPersona`, `MemoryArea` y `MemoryIndex`
cuelgan todos de ese `memoryId` (`apps/legacy-api/prisma/schema.prisma:241-352`).

Lo que la Capa 1 entrega es `Fragmento = {id, texto, migas, nodos, huellaContextual,
certezaMínima}` (`packages/ir/src/salidas.ts:346-376`): texto agrupado con contexto.
**No hay ningún tipo `Hecho` en todo `packages/ir`.**

Verificado directamente sobre el borrador, y es contundente:

- `grep -i "extracci"` sobre las 2347 líneas del borrador devuelve **cero
  resultados**.
- El pipeline tiene **siete tramos**
  ([`borrador-pipeline-tecnico.md:38-46`](borrador-pipeline-tecnico.md)) y ninguno
  verbaliza.
- La tabla «Eran once» lista los cuatro tramos eliminados —Traducción, Validación,
  Composición, Diferencia (`:53-57`)— y **la extracción no está entre ellos.**
- Pero el doc anterior de Capa 1 sí la declaraba: tramo `9 EXTRACCIÓN prosa → modelo →
  hechos` y tramo `10 CLASIFICACIÓN sensibilidad automática sobre cada hecho`
  ([`05-capa1-pipeline-ingesta-tecnico.md:467-470`](05-capa1-pipeline-ingesta-tecnico.md)),
  con la cadena `hecho → fragmento → elemento → coordenada → documento` (`:549-553`).

**Y no es un olvido.** El borrador lo consideró y lo rechazó, en una sola frase, en
`borrador-pipeline-tecnico.md:1046-1047`:

> «Recibe la afirmación precisamente porque **extraer hechos de una conversación
> exigiría un modelo de lenguaje en el camino de escritura**.»

Eso choca de frente con la primera de las tres decisiones que gobiernan todo el
pipeline: **«ningún modelo de lenguaje en el camino de escritura»** (`:29-30`).

Así que el estado real es este: la Capa 1 **se negó deliberadamente** a producir
hechos, resolvió su propio caso (el canal MCP recibe una afirmación ya curada por
quien la manda), y **ninguna capa de arriba se hizo cargo del resto**. Hoy el productor
de hechos es mem0 —`Mem0Service.add()` es literalmente lo único que mem0 hace en el
sistema (`apx-motor-v2.md:264`)— que es exactamente la pieza que este pipeline viene a
reemplazar.

**Por qué es el más caro:** define la **granularidad** de la memoria, y la granularidad
es lo único que no se parchea después. El glosario, el clustering, el dedupe, el conteo
que ve el usuario, las citas y los `Space` ya construidos asumen «una memoria = un
hecho». Si se descubre después de que tres paquetes se apoyen en el contrato, no se
arregla agregando un campo.

**Dónde se decide:** Capa 2 (es su unidad) con voto de Capa 4 (es su entrada).
**No se decide acá.** Las tres salidas visibles son: (a) una memoria **es** un
fragmento y «hecho» sale del glosario; (b) la verbalización ocurre en el camino de
**lectura**, no de escritura, y entonces no viola la decisión fundacional; (c) hay un
tramo 8 con modelo de lenguaje, y la decisión fundacional se revisa explícitamente.

---

## H2 · Nadie lee las anotaciones, así que la sensibilidad y las exclusiones no se aplican

**Las cuatro capas lo encontraron. El contrato lo declara él mismo, y dice que no lo
puede resolver.** `packages/ir/src/salidas.ts:502-505`:

> «SIGUE ABIERTO Y `ir` NO LO PUEDE RESOLVER (auditoría #17): **ningún tramo declara
> LEER anotaciones**. Las exclusiones y la sensibilidad (§R3) solo significan algo si
> alguien se niega a indexar; sin punto de lectura, contenido marcado como excluido
> llega al índice — y **el tramo 6 es donde el texto SALE hacia una API de terceros**.»

Es una **regresión respecto de lo ya construido**: hoy existen `MemoryIndex.sensitivity`
(`apps/legacy-api/prisma/schema.prisma:244`) y la faceta `savia_sensitivity` en el
payload de Qdrant (`apps/legacy-api/src/common/adapters/qdrant.connection.ts:12-19`).
El pipeline nuevo no emite nada que pueda alimentarlos.

Hay además un **desajuste de granularidad que nadie decidió**: la marca es por nodo, la
unidad recuperable es el `Fragmento`, que agrupa N nodos (`salidas.ts:354`). El
precedente de agregación ya existe —`certezaMínima` es «la PEOR certeza de los nodos
agrupados» (`salidas.ts:362-375`)— y **no hay análogo para sensibilidad**: un fragmento
con un nodo sensible y cuatro normales no tiene cómo declararse sensible.

**Por qué la Capa 3 lo puso primero:** todos los demás ítems de su lista son «agregar
una columna y re-ingestar». Este no. Una vez que el texto marcado como sensible se
embebió contra un proveedor externo y quedó indexado, **ningún cambio de schema lo
deshace** — la filtración ya ocurrió, en silencio, y con procedencia perfecta para que
cualquiera la recupere.

**Dónde se decide:** el punto de lectura es tramo 6/7 (Capa 1). La política de qué se
marca y con qué efecto es Capa 3. La agregación a nivel fragmento es un cambio de
contrato en `ir`.

---

## H3 · La organización no viaja con el dato (P12), y hay una consulta que nadie está mirando

**Las cuatro capas.** `OrganizacionId` existe (`packages/ir/src/identidad.ts:140`) pero
vive **solo en el envoltorio** `Ingesta` (`salidas.ts:554-562`), por una decisión
deliberada y bien argumentada: meterlo en la IR «envenena el caché de reconocimiento,
que cruza organizaciones POR DISEÑO» (`salidas.ts:542-552`). `Fragmento`, `Vector` y
`Registro` no lo llevan.

La consecuencia está escrita por el propio contrato
(`packages/ir/src/identidad.ts:90-94`, = **P12**, `borrador:1962`):

> «con unicidad global el id NO lleva su organización adentro, así que la separación
> entre tenants queda enteramente en el filtro de lectura, o sea en **una garantía de
> runtime que hay que acordarse de aplicar en cada consulta**.»

**El aporte nuevo de esta lectura es de la Capa 3, y es la parte incómoda:** el índice
de reconciliación se lee **al revés** (`hash → documento`) para elegir contra qué
versión reconciliar (`salidas.ts:290-294`). La prosa acota esa consulta a la
organización (`borrador:315`) pero **el tipo no lo lleva**: `NodoEnVersión` no tiene
`OrganizacionId` (`salidas.ts:327-338`). Si se implementa sin filtro, un documento de
la org A puede elegirse como «versión anterior» de uno de la org B — y con eso se
**transfieren `ElementId`**, que son el ancla de toda la curación y de todas las
anotaciones, sensibilidad incluida.

Es la consulta más fácil de olvidar, precisamente porque **no parece una lectura de
usuario**.

---

## H4 · No hay coordenada temporal: video y audio no son citables

**Capa 2 y Capa 5.** `Coordenada` tiene exactamente cuatro variantes —`fuente`,
`texto`, `grid`, `visual`— y **ninguna lleva tiempo**
(`packages/ir/src/ubicacion.ts:73-125`). La visión promete σ = `t_inicio, t_fin` para
video/audio ([`01-vision.md:131`](01-vision.md)), y el contrato ya contempla
`ClaseDeEnriquecimiento = "descripcion" | "ocr" | "transcripcion"`
(`packages/ir/src/formas.ts:187`): **una transcripción se puede producir y no se puede
anclar en el tiempo.**

Costo de agregarlo tarde: `SourceRange` está definido como
`Extract<Coordenada, { espacio: "grid" }>` (`ubicacion.ts:133`), así que abrir esa unión
más adelante toca a la vez `Registro.coordenada`, todo consumidor exhaustivo y los doce
adaptadores. Y `packages/ir` es el paquete que «se congela y se versiona primero: todo
depende de él».

Corolario de la Capa 5: **lo que no se puede citar por MCP no existe para el cliente.**

---

## H5 · Un fragmento da N vectores; el motor asume un vector por memoria

**Capa 2 y Capa 4.** `Vector.orden` es «i de N» y el contrato dice explícitamente que
«nada aguas abajo lo interpreta» (`salidas.ts:423-430`). El motor construye
`MemoryEdge.srcId/dstId` sobre ids de punto (`schema.prisma:289-304`): con N > 1, el
kNN devuelve **rebanadas**, y el grafo se llena de aristas entre rebanadas del mismo
fragmento. El dedupe por `fragmentoId` existe solo del lado de la búsqueda
(`borrador:2343`).

**El contrato no define un vector canónico del fragmento.** Con N > 1 la entrada del
clustering es ambigua y no hay decisión escrita.

---

## H6 · Las entidades no tienen productor, y su ausencia degrada en silencio

**Capa 2 y Capa 4.** Cada arista del grafo pesa `weight = simScore + entBoost`, con
`ENTITY_BOOST = 0.15` (`memory-graph.service.ts:48-50`), y el nombre de un área sale de
contar la faceta `entities` (`naming.service.ts:27`). La fuente es la colección
`{collection}_entities` **que puebla mem0** (`apx-motor-v2.md:254`).

Ni el borrador ni `packages/ir` mencionan entidades (cero resultados en ambos). Si el
pipeline nuevo reemplaza a `Mem0Service.add()`, el entity store deja de poblarse y
`entBoost` cae a 0 **en silencio**: nada falla, el grafo pasa a ser coseno puro.

La válvula existe —`AnotaciónPropuesta.clase` es abierta a propósito
(`salidas.ts:468-475`)— pero no hay anotador de entidades declarado, y «los anotadores
no tienen registro, orden, política de fallo ni presupuesto» (`salidas.ts:523-527`).

---

## H7 · Los `Registro` (la mitad σ) no tienen destino

**Las tres capas que consumen datos.** El contrato lo declara con nombre y apellido
(`packages/ir/src/salidas.ts:451-457`):

> «SIGUE ABIERTO (auditoría #56): los `Registro` no tienen destino — ni tabla, ni clave,
> ni idempotencia en la re-ingesta, **ni superficie de consulta**. El tramo 7 no los
> menciona.»

Es exactamente el `browse`/`fetch` que la Capa 5 pide (`12-capa5-consumo-mcp.md:36-40`),
el `lookup(coordenada) → valor` que la Capa 2 pide (`07-...:54`), y el dato duro que las
reglas de decisión de un skill necesitarían citar (`10-capa4-...:30-32`).

Agravante de la Capa 2: `SourceRange` **no es la unión, es solo la variante `grid`**, o
sea que la salida exacta σ solo se produce para hoja·fila·columna. Y su campo `región`
es «un `string` OPACO y su estabilidad NO está garantizada por nadie»
(`ubicacion.ts:114-115`) — una dirección que puede cambiar entre ingestas no es una
dirección.

---

## H8 · Todo lo anterior aterriza en el tramo 7, que está sin diseñar

`# Tramo 7 · Persistencia — sin diseñar` (`borrador-pipeline-tecnico.md:2339`): nueve
líneas y un encargo. Qdrant se nombra dos veces en todo el documento, y el único campo
de payload especificado es la miga (`:2145-2147`).

Es donde tienen que caer: el filtro por organización (H3), el punto de lectura de
anotaciones (H2), el destino de los `Registro` (H7), el payload gobernable (Capa 3 A2),
y el `scroll(limit:100_000, withVectors:true)` que el motor necesita y que es la razón
declarada de que no use mem0 (`engine-bootstrap.service.ts:88-94`, `apx-motor-v2.md:248-252`).

---

# Parte II — Los cambios de contrato que hoy son casi gratis

`packages/ir` tiene **un solo dependiente**: `packages/emision`
(`packages/emision/package.json:21`). Cada uno de estos es hoy una línea; con tres
paquetes encima es una migración.

| Cambio | Por qué no espera | Origen |
|---|---|---|
| `Anotación.actor: ActorId` | La anotación distingue máquina de humano (`origen`) pero **no qué humano** (`salidas.ts:507-512`). «Sensibilidad = opt-in del dueño» es una afirmación sobre un actor. **Quién marcó qué no se reconstruye a posteriori.** | Capa 3 A3 |
| `NodoEnVersión.organización` | Sin él, la consulta `hash → documento` puede cruzar tenants y transferir `ElementId` (H3). | Capa 3 A4 |
| Variante temporal en `Coordenada` | `SourceRange = Extract<Coordenada, grid>`: abrir la unión tarde rompe los doce adaptadores a la vez (H4). | Capa 2 A2 · Capa 5 A1 |
| Sensibilidad agregada en `Fragmento` | La marca es por nodo, la unidad recuperable agrupa N nodos. El precedente (`certezaMínima`) ya existe (H2). | Capa 3 A1 |
| `Ingesta.versión: HashBytes` y `Ingesta.original: ClaveObjeto` | `Ingesta` no lleva la versión —que es *la* versión— ni la clave del activo original, y los dos tipos ya existen sueltos (`salidas.ts:554-562`, `identidad.ts:146`). Sin ellos no hay cita completa. | Capa 5 A6 |
| `Fragmento.confianza` | El número existe en `NodoCrudo` con el consumidor nombrado —«el umbral de citabilidad vive en la capa de skills»— y **muere ahí** (`salidas.ts:109-119`). | Capa 2 A8 · Capa 5 A8 |

**Ninguno de estos se aplicó.** Están listados para que la capa que corresponda los
decida, no para ejecutarlos.

---

# Parte III — Correcciones de premisa

Tres cosas que dábamos por buenas y no lo eran:

1. **`P13`, `P14`, `P15` y `P16` no existen.** La tabla de puntos abiertos del borrador
   va de **P1 a P12** (`borrador-pipeline-tecnico.md:1954-1967`). Los temas que
   veníamos llamando así (citas, cuota de archivo) son reales, pero como prosa
   dispersa, no como puntos numerados. Cualquier referencia previa a P13–P16 usa
   números inexistentes.

2. **El contrato ya tiene un dependiente, no cero.** `packages/emision` declara
   `@savia-os/ir: workspace:*`. La ventana para cambios baratos sigue abierta, pero ya
   empezó a cerrarse.

3. **El doc de Capa 2 describe un diseño anterior al contrato congelado.** Dice que
   `SourceRange` es una «unión cerrada `text`/`fragment`/`grid`» (`07-...:38-46`); en el
   contrato real la unión se llama `Coordenada` y `SourceRange` quedó reducido a una de
   sus variantes. Esa casilla **hay que reescribirla, no marcarla.** Lo mismo con
   `PublicDocElement`, `ContentKind`, `SemanticLabel`, `Cohesion` y `LocalKey`: todo ese
   vocabulario está muerto y tiene reemplazo tipado.

---

# Parte IV — Qué NO encontró esta lectura

Vale registrarlo, porque un informe que solo lista problemas no se puede calibrar.

- **La mayoría de los puentes ya existen.** Cada capa devolvió una lista B larga:
  procedencia (`Fragmento.nodos`), cita encadenada (`Ubicación.dentroDe` recursiva),
  autoría (`Autoría {actor, cuándo, fuente}`), filtro por sección que sobrevive al
  renombre (`MigaEstable`), historial por versión que **acumula** (`NodoEnVersión`),
  borrado efectivo del índice (`SalidaDeEmisión.bajas`), dedupe (`FragmentoId`), caché
  invalidado por versión de modelo (`ClaveEmbedding`), curación humana que sobrevive a
  la re-ingesta (`Anotación` con clave de dedupe). Nada de eso hubo que pedirlo.

- **No falta el concepto de área/espacio en `packages/ir`, y está bien que falte.** El
  `Space` lo produce el motor de clustering, no el pipeline.

- **La Capa 4 no es una página en blanco.** `apx-motor-v2.md` son 312 líneas con cero
  pendientes y sus servicios están implementados y verificados. Es una **reintegración**,
  y su lista D es de producto, no de arquitectura.

- **La Capa 3 tiene mucho más decidido de lo que su documento admite.** Las siete reglas
  de acceso están escritas y ratificadas (`docs/audit/backend/2026-06-27/ACCESS-PRIVACY-RULES.md:16-42`),
  el chokepoint tiene ubicación exacta (`modules/access/read-plan.ts:33`), y el audit log
  **existe** (`AccessLog`, con `queryDigest` SHA-256 y nunca el texto). Su documento
  pregunta por cosas que ya tienen respuesta en el código.

---

# Parte V — Índice de destino

Cada hallazgo va al borrador de la capa que lo decide. Ninguno se decide acá.

| Hallazgo | Decide | Vive en |
|---|---|---|
| H1 · la unidad (fragmento vs. hecho) | Capa 2, con voto de Capa 4 | [`borrador-capa2-memoria.md`](borrador-capa2-memoria.md) |
| H2 · lector de anotaciones + sensibilidad | Capa 3 (política) · Capa 1 (punto de lectura) | [`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md) |
| H3 · organización en el dato (P12) | Capa 3 | [`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md) |
| H4 · coordenada temporal | Capa 1 (contrato) · pedido de Capa 5 | [`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md) |
| H5 · vector canónico del fragmento | Capa 4 | [`borrador-capa4-sintesis.md`](borrador-capa4-sintesis.md) |
| H6 · productor de entidades | Capa 4 | [`borrador-capa4-sintesis.md`](borrador-capa4-sintesis.md) |
| H7 · destino de los `Registro` | Capa 2 (modelo) · Capa 5 (superficie) | [`borrador-capa2-memoria.md`](borrador-capa2-memoria.md) |
| H8 · tramo 7 | Capa 1 | [`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md) |

---

<sub>Método: cuatro lectores independientes, uno por capa, sin contacto entre sí, con la
consigna de leer y citar y la prohibición explícita de diseñar. Las coincidencias entre
informes no están coordinadas — por eso cuentan. Los hallazgos marcados como verificados
directamente (H1) se comprobaron después sobre el archivo, no se tomaron del informe.</sub>
