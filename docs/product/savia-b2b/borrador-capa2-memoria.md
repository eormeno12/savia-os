# Borrador — Capa 2: Memoria

> **Documento de trabajo, 2026-08-10.** Consolida lo que hoy se sabe sobre la capa
> de memoria para que el equipo itere encima. **Acá no se decide nada:** lo que
> está decidido se cita con `archivo:línea`, lo que no lo está va como punto
> abierto numerado (`C2-P1` … `C2-P19`), y donde hay caminos posibles se listan
> todos sin recomendar ninguno.
>
> Reemplaza a [`06-capa2-memoria-modelo.md`](../savia-b2b-legacy/06-capa2-memoria-modelo.md)
> y [`07-capa2-memoria-arquitectura-tecnica.md`](../savia-b2b-legacy/07-capa2-memoria-arquitectura-tecnica.md).
> El segundo describe un diseño **anterior al contrato congelado** y su vocabulario
> está muerto: la sección 1.4 lista los reemplazos.
>
> **Lo que NO es:** ni una elección de embedder, ni un diseño del índice de
> búsqueda exacta, ni una propuesta de modelo multi-tenant. **Si solo se lee una
> sección, es la 3.1** — ahí está la única pregunta de esta capa que no se puede
> parchear después.

---

## 0. De dónde sale este borrador

Tres insumos, en este orden:

1. **La lectura cruzada de capas**
   ([`lectura-cruzada-capas-2026-08-10.md`](lectura-cruzada-capas-2026-08-10.md)),
   donde cuatro lectores independientes —uno por capa— buscaron lo que su capa
   necesita de la Capa 1 y la Capa 1 no produce. Cinco de sus ocho hallazgos
   convergentes caen acá: **H1** (la unidad), **H3** (la organización no viaja con
   el dato), **H5** (N vectores por fragmento), **H6** (entidades sin productor) y
   **H7** (los `Registro` sin destino).
2. **El contrato congelado** `packages/ir`, que es la fuente de verdad de lo que la
   Capa 1 emite. La prosa del plan se cita solo cuando explica una decisión; lo que
   se produce o no se produce se verifica contra el tipo.
3. **El código de `apps/legacy-api`**, donde la memoria a nivel personal ya está
   construida. Cuando este documento lo cita está describiendo **la implementación
   actual**, que se reintegra como **diseño validado, nunca copy-paste**.

No se diseñó nada nuevo. La forma sigue la de
[`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md).

---

## 1. Qué ya está decidido y este documento no lo sabía

El documento anterior abre con preguntas que ya tienen respuesta. Esta sección las
cierra, porque cada una que se cierra achica el trabajo real que queda.

### 1.1 · La identidad de un documento se decide por contenido, nunca por nombre

`02-glosario-y-entidades.md` (legacy) `:78-80` lo listaba como decisión abierta
(«`DocumentLineageId` no existe todavía»). **Está cerrada.** Cuando dos archivos son
el mismo documento se decide por contenido, con el candidato saliendo del índice de
reconciliación leído al revés (`hash → documento`), y votando **solo los hashes que
aparecen en un único documento** — la regla que evita que trescientos contratos
hechos con la misma plantilla se fusionen entre sí
([`borrador-pipeline-tecnico.md:1978-1981`](borrador-pipeline-tecnico.md); mecanismo
en `packages/ir/src/salidas.ts:288-293`).

### 1.2 · El `OutboxRelay` no es una pregunta: está implementado

`07-...:34` lo lista como pendiente. Existe en
`apps/legacy-api/src/modules/outbox/outbox-relay.ts:17-86`, es el **único camino
Postgres→Qdrant** (`:10-15`), tiene backoff (`:70-80`), y
`VectorGarbageCollector` es el único borrador de vectores
(`apps/legacy-api/src/modules/outbox/vector-gc.ts:18-45`).

Lo que sí sigue pendiente, y es más chico de lo que el doc sugería: `delete_payload`
lanza «no implementado (FASE-4)» (`outbox-relay.ts:62`) y **no existe reconciliación
Qdrant→Postgres** (riesgo documentado en `memory.service.ts:88-96`). Van a `C2-P16`
y `C2-P17`.

### 1.3 · El stack actual está documentado en el código, no hace falta relevarlo

`07-...:28-33` pide «documentar el stack actual». Es todo verificable hoy:

| Pieza | Dónde |
|---|---|
| Colección `savia_memories` | `apps/legacy-api/src/common/config/app.config.ts:49-51` |
| 1536 dimensiones, distancia coseno | `apps/legacy-api/src/common/adapters/qdrant.connection.ts:65-67` |
| Payload: `savia_area_ids`, `savia_entities`, `savia_sensitivity`, `savia_superseded`, `user_id` | `qdrant.connection.ts:12-19` |
| Embedder `text-embedding-3-small` | `apps/legacy-api/src/common/adapters/embeddings.openai.adapter.ts:7`, `src/modules/memory/mem0.config.ts:29-32` |
| Partición por payload en colección única; `is_tenant:true` sobre `user_id` es **solo performance, no frontera** | `qdrant.connection.ts:84-91`, `src/common/adapters/qdrant-filter.ts:26-27` |

Esa última fila responde `07-...:58` («¿colección por organización o payload
filtering?»): **la implementación ya eligió payload filtering**. Lo que sigue abierto
es si eso escala a organización, que es `C2-P9`.

### 1.4 · El vocabulario del documento viejo está muerto, y tiene reemplazo tipado

`02-glosario-y-entidades.md` (legacy) `:64-77` nombra tipos que ya no existen. La
tabla de traducción:

| Nombre muerto | Reemplazo | Dónde |
|---|---|---|
| `PublicDocElement` | `NodoEmitido` | `packages/ir/src/salidas.ts:187-196` |
| `ContentKind` | `Forma` (6 valores) | `packages/ir/src/formas.ts:47` |
| `SemanticLabel` | `Tipo` (15 valores) | `packages/ir/src/clasificacion.ts:35-51` |
| `Cohesion` | `Cohesión` (4 valores) | `packages/ir/src/clasificacion.ts` |
| `LocalKey` | `LocalId` | `packages/ir/src/identidad.ts:121` |

Y una corrección que **no es marcar una casilla, es reescribirla**: `07-...:38-46`
dice que `SourceRange` es una «unión cerrada `text`/`fragment`/`grid`». En el
contrato real la unión se llama `Coordenada` y es `fuente | texto | grid | visual`
(`packages/ir/src/ubicacion.ts:73-125`); **`SourceRange` quedó reducido a una sola de
sus variantes**, `Extract<Coordenada, { espacio: "grid" }>` (`:133`). De ahí sale el
hueco 3.3.

> El glosario **nuevo** ([`02-glosario-y-entidades.md`](02-glosario-y-entidades.md))
> no menciona ningún tipo del IR. Reincorporarlo es `C2-P18`.

### 1.5 · Tres unidades distintas y no intercambiables

`06-...:24-26` pregunta «qué es un hecho vs. una memoria vs. un área». La Capa 1 fijó
tres unidades, y la distinción es nítida:

| Unidad | Para qué | Tipo |
|---|---|---|
| **Identidad** | lo que sobrevive a la re-ingesta y ancla la curación | `NodoEmitido` / `ElementId` |
| **Recuperación difusa** | lo que se embebe y se busca por similitud | `Fragmento` / `FragmentoId` |
| **Recuperación exacta** | lo direccionable por coordenada | `Registro` |

Lo que la Capa 1 **no** fijó es cuál de las tres es la `Memoria` del glosario. Eso es
la sección 3.1.

### 1.6 · Cinco huecos de la implementación actual que la Capa 1 ya resolvió en papel

Todos «no encontrado» hoy en `apps/legacy-api`, todos con tipo en el contrato:

| Hueco actual | Lo resuelve |
|---|---|
| No hay puntero al pasaje exacto | `Coordenada` (`ubicacion.ts:73-125`) |
| No se persiste el verbatim original — solo el hecho reescrito por el LLM | `ClaveObjeto` (`identidad.ts:146`) |
| No hay dedupe por hash de fragmento | `HuellaContextual` / `FragmentoId` (`identidad.ts:170-187`) |
| No hay caché de embeddings ni versión del embedder | `ClaveEmbedding` (`identidad.ts:286-299`) |
| No hay handle estable entre re-ingestas: `deleteByFile` + re-add destruye todos los `memoryId` (`src/modules/ingest/ingest.worker.ts:57`, `memory.service.ts:159-165`) | `ElementId`, acuñado por reconciliación (`identidad.ts:78-88`) |

Esta tabla es el argumento más concreto de por qué el pipeline nuevo vale la pena.

---

## 2. El puente con la Capa 1: lo que la memoria SÍ recibe

Nada de esto hubo que pedirlo. Ya está tipado y emitido:

| Lo que la Capa 2 pide | Tipo / campo |
|---|---|
| Handle estable a través de versiones | `ElementId`, acuñado por reconciliación, no por fórmula (`identidad.ts:96`, `:78-88`) |
| Procedencia de un resultado hasta su origen | `Fragmento.nodos` (`salidas.ts:354`) → `NodoEmitido.ubicación` (`:69`) |
| Cita encadenada (contrato.pdf → pg3 → imagen) | `Ubicación.dentroDe: readonly Ubicación[]`, recursiva (`ubicacion.ts:180-184`) |
| Activo original binario | `ClaveObjeto` (`identidad.ts:146`) + `RefObjeto {objeto, ventana}` (`formas.ts:158-161`) |
| Dedupe de resultados de búsqueda | `FragmentoId` de `(DocumentoId, huellaContextual)` (`identidad.ts:170-187`) + `Vector.fragmento` (`salidas.ts:424`) + `PARAMETROS.búsqueda.factorDeSobreFetch` (`params.ts:324`) |
| Borrar del índice lo que dejó de existir | `SalidaDeEmisión.bajas` (`salidas.ts:258`), creado porque «el tramo 7 tiene que borrar filas y puntos… y NADIE LE ENTREGA LA LISTA» (`:243-250`) |
| Filtrar por sección sin romperse al renombrar el título | `MigaEstable = Miga<ElementId>` (`salidas.ts:160-168`, razón en `:144-152`) |
| «Esto lo dijo el CFO en marzo» | `Autoría {actor, cuándo, fuente}` (`identidad.ts:382-387`) |
| Tenant de organización a nivel documento | `Ingesta.organización` + `dueño` (`salidas.ts:554-562`) — hoy inexistente en el modelo real |
| Caché de embeddings invalidado por versión de modelo | `ClaveEmbedding = sha256(miga ‖ rebanada ‖ versiónEmbedder)` (`identidad.ts:286-299`) |
| Canal de entrada y estado del documento | `CANALES` (`salidas.ts:572`), `ESTADOS_DE_DOCUMENTO` (`:598-608`), `NIVELES_LOGRADOS` (`:584`) |
| Curación humana que sobrevive a la re-ingesta | `Anotación.origen` + clave de dedupe `(nodo, anotador, clase, rango)` (`salidas.ts:493-511`) |
| Salud del índice tras re-ingestar | `MétricasReconciliación`: `anclaje`, `porHash`, `porSimilitud`, `altas`, `bajas` (`salidas.ts:214-238`) |

---

## 3. Lo que la Capa 1 no le da

Ordenado por lo que costaría resolverlo tarde.

### 3.1 · El hueco que define todo lo demás: la unidad

**Esta es la pregunta de la Capa 2.** Las demás se parchean; esta no.

**Lo que dicen los documentos.** El glosario define `Memoria` como «la unidad
atómica de conocimiento: **un hecho**»
([`02-glosario-y-entidades.md:70-73`](02-glosario-y-entidades.md)), y la visión
define **π** como «la verbalización del contenido en proposiciones»
([`01-vision.md:119-120`](01-vision.md)).

**Lo que emite el pipeline.** `Fragmento = {id, texto, migas, nodos,
huellaContextual, certezaMínima}` (`packages/ir/src/salidas.ts:346-376`): texto
agrupado con su contexto. **No existe ningún tipo `Hecho`, `Memoria` ni
`Proposición` en todo `packages/ir`.**

**Lo que se verificó, y es contundente.** `grep -i "extracci"` sobre las 2347 líneas
de [`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md) devuelve **cero
resultados**. El pipeline tiene siete tramos (`:38-46`) y ninguno verbaliza. La tabla
«Eran once» enumera los cuatro tramos eliminados —Traducción, Validación,
Composición, Diferencia (`:53-57`)— y **la extracción no está entre ellos**. Pero el
documento anterior de Capa 1 sí la declaraba: tramo `9 EXTRACCIÓN prosa → modelo →
hechos` y tramo `10 CLASIFICACIÓN sensibilidad automática sobre cada hecho`
([`05-capa1-pipeline-ingesta-tecnico.md:467-470`](05-capa1-pipeline-ingesta-tecnico.md)),
con la cadena `hecho → fragmento → elemento → coordenada → documento` (`:549-553`).

**Y no es un olvido.** El borrador lo consideró y lo rechazó, en una frase, en
`borrador-pipeline-tecnico.md:1046-1047`:

> «Recibe la afirmación precisamente porque **extraer hechos de una conversación
> exigiría un modelo de lenguaje en el camino de escritura**.»

Eso choca de frente con la primera de las tres decisiones que gobiernan todo el
pipeline: **«ningún modelo de lenguaje en el camino de escritura»** (`:29-30`). El
tramo 5, además, declara «Solo agrupa, nunca parte» (`:1748`).

**El estado real.** La Capa 1 se negó deliberadamente a producir hechos y resolvió su
propio caso: el canal MCP recibe una afirmación **ya curada por quien la manda**. Eso
funciona para ese canal y no funciona para un PDF, una planilla o un hilo de Slack.
Hoy el productor de hechos es mem0 —`Mem0Service.add()` es literalmente «lo único que
mem0 hace en el sistema» (`apx-motor-v2.md:264`)— que es exactamente la pieza que este
pipeline viene a reemplazar. Y el texto que hoy se recupera de Qdrant (`payload.data`)
es **el hecho reescrito por el LLM, no el fragmento crudo**
(`apps/legacy-api/src/common/adapters/facets.ts:19-21`,
`src/modules/memory/mem0.service.ts:37-48`).

**Por qué es el más caro.** Define la **granularidad** de la memoria, y la
granularidad es lo único que no se parchea después: el glosario, el clustering (un
vector por memoria), el dedupe, el conteo que ve el usuario, las citas y los `Space`
ya construidos asumen «una memoria = un hecho». Si se descubre después de que tres
paquetes se apoyen en el contrato, no se corrige agregando un campo: se corrige
reindexando todo y reescribiendo la Capa 4.

**Y no falla.** El pipeline puede llegar hasta el upsert y el motor va a clusterizar
rebanadas de texto como si fueran memorias, con entity-boost en cero y sin
sensibilidad. Todo verde.

**Las tres salidas visibles.** Se listan sin recomendar ninguna. Es `C2-P1`, y se
decide junto con la Capa 4, que es quien la consume.

| | Salida | Qué implica |
|---|---|---|
| **a** | **Una memoria ES un fragmento.** «Hecho» sale del glosario. | Cero cambios al pipeline. Cambia el glosario, el conteo que ve el usuario y la entrada del motor, que pasa a clusterizar fragmentos. Hay que contestar H5 (¿cuál de los N vectores?) y qué pasa con la calidad del clustering sobre texto sin verbalizar. |
| **b** | **La verbalización ocurre en el camino de LECTURA**, no de escritura. | No viola la decisión fundacional: el LLM no toca el índice. Hay que decidir dónde vive (¿síntesis? ¿consulta?), qué se cachea y si el «hecho» llega a persistirse o es efímero. |
| **c** | **Hay un tramo 8 con modelo de lenguaje**, y la decisión fundacional se revisa explícitamente. | Es la única que reproduce el comportamiento actual. Exige reabrir «ningún modelo de lenguaje en el camino de escritura» de frente, con su costo, su latencia y su no-determinismo, en vez de erosionarla en silencio. |

### 3.2 · Un fragmento da N vectores; el clustering necesita uno por memoria

`Vector` es N por fragmento (`salidas.ts:379`, `:423-430`), y el contrato dice
explícitamente que **«nada aguas abajo lo interpreta»** el campo `orden` (`:425`).

El motor v2 coloca cada memoria con **un** vector: `placeAtAdd(userId, fact.id,
vec1536, areaId)` (`apx-motor-v2.md:103`,
`apps/legacy-api/src/modules/organization/engine-placement.service.ts`). Todo el grafo
mutual-kNN, las personas y las comunidades —que se vuelven `Space`— se construyen
sobre esa premisa.

**El contrato no define un vector canónico del fragmento.** Con N > 1 la entrada del
clustering es ambigua, y no hay decisión escrita. Es `C2-P2`, y comparte dueño con la
Capa 4.

### 3.3 · La coordenada σ solo existe para planillas, y no tiene eje temporal

`06-...:30-31` y `07-...:54` piden «lookup por coordenada σ». Dos problemas
independientes:

**Primero, la cobertura.** `Registro.coordenada` es de tipo `SourceRange`
(`salidas.ts:455`), y `SourceRange` **no es la unión: es solo la variante `grid`**
(`ubicacion.ts:133`). O sea que la salida exacta σ **solo se produce para
hoja·fila·columna**. Un valor exacto dentro de un PDF (bbox) o de un texto (offsets)
no tiene productor de `Registro`.

**Segundo, el tiempo.** `Coordenada` tiene cuatro variantes y **ninguna lleva tiempo**
(`ubicacion.ts:73-125`). La visión promete σ = `t_inicio, t_fin` para video y audio
([`01-vision.md:131`](01-vision.md)), y el contrato ya contempla
`ClaseDeEnriquecimiento = "descripcion" | "ocr" | "transcripcion"` (`formas.ts:187`):
**una transcripción se puede producir y no se puede anclar en el tiempo.**
(`Ventana.rango` en `formas.ts:151` no sirve: es qué parte de un objeto se
descompone, no la coordenada del nodo.)

Y la variante `grid` que sí existe tiene un campo cuya estabilidad nadie garantiza:
`región` es «un `string` OPACO y su estabilidad NO está garantizada por nadie: es un
hueco abierto» (`ubicacion.ts:114-115`). **Una dirección que puede cambiar entre
ingestas no es una dirección.**

Costo de resolverlo tarde: `packages/ir` es el paquete que «se congela y se versiona
primero: todo depende de él». Es `C2-P3` (cobertura), `C2-P4` (tiempo, compartido con
Capa 5) y `C2-P5` (estabilidad de `región`).

### 3.4 · Los `Registro` no tienen destino

El contrato lo declara con nombre y apellido (`salidas.ts:451-453`):

> «SIGUE ABIERTO (auditoría #56): los `Registro` no tienen destino — ni tabla, ni
> clave, ni idempotencia en la re-ingesta, **ni superficie de consulta**. El tramo 7
> no los menciona.»

Es exactamente el `lookup(coordenada) → valor` que esta capa pide (`07-...:54`) y el
`browse`/`fetch` que pide la Capa 5. Es `C2-P6`.

### 3.5 · La sensibilidad y las exclusiones no viajan, y nadie lee anotaciones

`packages/ir/src/salidas.ts:502-505` lo declara: **ningún tramo declara leer
anotaciones**, y «el tramo 6 es donde el texto SALE hacia una API de terceros».

Ningún campo tipado de sensibilidad existe en ninguna salida: `Fragmento`
(`:346-376`), `Vector` (`:423-430`), `Registro` (`:454-458`), `NodoEmitido`
(`:187-196`). El único enganche es `Anotación.clase: string`, abierta (`:475`).

**Es una regresión respecto de lo ya construido**: hoy existen
`MemoryIndex.sensitivity` (`apps/legacy-api/prisma/schema.prisma:244`) y la faceta
`savia_sensitivity` (`src/common/adapters/qdrant.connection.ts:12-19`, escrita en
`src/modules/kernel/memory-mutation.service.ts:54-60`).

El detalle completo, con el desajuste de granularidad y por qué es el hueco más
peligroso del sistema, vive en
[`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md) §3. Acá se registra
porque afecta qué se puede indexar.

### 3.6 · Ningún artefacto indexable lleva la organización

`07-...:56-62` lo marca como «requisito de seguridad duro para venta enterprise».

`OrganizacionId` existe (`identidad.ts:140`) pero vive **solo en el envoltorio**
`Ingesta` (`salidas.ts:554-562`), por una decisión deliberada y bien argumentada:
meterlo en la IR «envenena el caché de reconocimiento, que cruza organizaciones POR
DISEÑO» (`:542-552`). La consecuencia la escribe el propio contrato
(`identidad.ts:90-94`, = **P12** del plan, `borrador-pipeline-tecnico.md:1962`):

> «con unicidad global el id NO lleva su organización adentro, así que la separación
> entre tenants queda enteramente en el filtro de lectura, o sea en **una garantía de
> runtime que hay que acordarse de aplicar en cada consulta**.»

Hoy la única partición es `authorUserId` / `user_id` (`qdrant-filter.ts:26-27`); **no
existe tenant de organización**. El puente Capa 1 → Capa 2 depende enteramente del
tramo 7, que está **sin diseñar** (`borrador-pipeline-tecnico.md:2339`). Es `C2-P9`.

### 3.7 · No hay validez temporal, y el historial por versión no es consultable por fecha

`07-...:71` y [`01-vision.md:271`](01-vision.md) listan bi-temporalidad; `06-...:44-47`
lista ciclo de vida y vigencia.

La Capa 1 produce **un solo instante**: `Autoría.cuándo` (`identidad.ts:384`), sellado
una vez por documento en el tramo 1 y heredado por las delegaciones tardías
(`:360-377`). No hay `válidoDesde` / `válidoHasta`, ni separación entre el tiempo del
hecho y el tiempo de ingesta.

Y hay algo peor, porque es una promesa incumplida del propio contrato:
`NodoEnVersión` dice explícitamente que habilita «las consultas temporales
(“¿qué decía este contrato en marzo?”)» (`salidas.ts:320-321`), pero su versión es
`HashBytes` — **un hash, no un contador ni una fecha** (`:312-314`, `:332`). E
`Ingesta` lleva `sellado: Instante` pero **no lleva `hashBytes`** (`:554-562`).
**Ningún tipo del contrato ata versión ↔ instante**, así que la consulta que el
contrato vende no es respondible desde sus salidas. Es `C2-P10` y `C2-P11`.

### 3.8 · La Capa 1 no produce entidades; hoy las produce mem0

El `follow` / multi-hop es hueco declarado (`07-...:72`,
[`01-vision.md:272`](01-vision.md)).

Hoy el grafo de entidades funciona porque **mem0 mantiene la colección
`{collection}_entities`** y Savia la lee por un puerto propio (`apx-motor-v2.md:254`;
`apps/legacy-api/src/common/adapters/entity-graph.mem0.adapter.ts:14-86`, binding en
`src/common/infra/infra.module.ts:32`). Se usa para poblar `savia_entities`
(`memory.service.ts:60`) y para el `entBoost = 0.15` de las aristas del grafo
(`memory-graph.service.ts:42,144-145`).

El contrato nuevo no tiene tipo `Entidad` ni la produce en ningún tramo. Si el
pipeline reemplaza a mem0 en el camino de escritura (3.1), **el entity store se queda
sin productor y el motor degrada en silencio** — no falla, solo empeora. Es `C2-P12`,
compartido con la Capa 4.

### 3.9 · La confianza numérica y el estado «parcial» no llegan al fragmento

El contrato promete que la certeza «viaja con el nodo, sobrevive a la fragmentación y
LLEGA HASTA LA SKILL», y por eso agrega `Fragmento.certezaMínima`
(`salidas.ts:363-375`). Pero eso es el enum de dos valores (`declarado | inferido`,
`clasificacion.ts:58`).

El número —`confianza: number | null`, agregado justamente para que «una skill pueda
decidir no citar como autoridad algo reconocido con confianza baja»— **muere en
`NodoCrudo`** (`salidas.ts:109-119`) y no tiene campo en `Fragmento`.

Igual con `nivelLogrado` y `estado` (`Ingesta`, `:560-561`): un documento `parcial`
—dos páginas sin procesar— **se recupera igual que uno completo**
([`auditoria-completitud-2026-08-09.md:417`](auditoria-completitud-2026-08-09.md)).
Choca con «fidelidad sin alucinación» (`06-...:51-52`). Es `C2-P13`.

### 3.10 · `Fragmento` no tiene coordenada propia

`Memoria` se define como un hecho que conserva «su coordenada en la fuente original»
([`02-glosario-y-entidades.md:70-73`](02-glosario-y-entidades.md)). `Fragmento` no
lleva coordenada: lleva `nodos: readonly ElementId[]` (`salidas.ts:354`), y un
fragmento agrupa N nodos, o sea **N coordenadas**. Cuál es «la» coordenada de una
memoria no está decidido. Es `C2-P14`, y depende de 3.1.

### 3.11 · No hay forma tipada de volver al documento original completo

`07-...:50-52` pregunta exactamente esto. `ClaveObjeto` existe (`identidad.ts:146`) y
`RefObjeto` cubre los assets binarios (`formas.ts:158-161`), pero **`Ingesta` no lleva
`ClaveObjeto`** (`salidas.ts:554-562`): el camino al verbatim del documento entero
pasa por la fila `documento` de Postgres, que no está tipada en `ir`. Es `C2-P15`.

---

## 4. Puntos abiertos

Agrupados por **qué los destraba**, que es la distinción que decide el orden de
trabajo: una medición no se puede apurar decidiendo, y una decisión no se puede
apurar midiendo.

### 4.1 · Esperan una decisión de producto

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C2-P1** | **Qué es una memoria: fragmento o hecho** (§3.1). Las tres salidas están enumeradas, ninguna elegida. | Decisión conjunta Capa 2 + Capa 4. Es la que bloquea a las demás. | Glosario · motor · conteo al usuario · citas |
| **C2-P7** | Quién elige entre recuperación difusa y exacta: ¿el agente, o un dispatcher? (`06-...:32`) | Decisión de producto, con voto de Capa 5 | Superficie MCP |
| **C2-P8** | Memoria personal vs. compartida vs. de organización: ¿vista sobre memorias personales o entidad propia? (`06-...:39-42`) | Decisión de producto, con voto de Capa 3 | Modelo de datos · gobernanza |
| **C2-P10** | Ciclo de vida de un hecho: ¿se sobreescribe o se versiona? (`06-...:44-47`). Hoy hay soft-delete reversible con gracia de 24 h y `restore()` (`memory-mutation.service.ts:12`, `:98-124`, `:178-197`), **y la Capa 1 emite bajas duras** de `ElementId` (`salidas.ts:258`): la interacción entre ambos no está decidida. | Decisión de producto | Borrado · retención |
| **C2-P13** | Si un documento `parcial` debe recuperarse igual que uno completo (§3.9) | Decisión de producto | Calidad de resultados |
| **C2-P19** | Si «sin alucinación» es un mecanismo de verificación o una propiedad emergente de citar siempre procedencia (`06-...:51-52`) | Decisión de producto | Toda la promesa |

### 4.2 · Esperan una medición sobre corpus real

Ninguno se puede resolver por decreto. Son los que el plan de Capa 1 ya declaraba
como *«se mide sobre el corpus real»*.

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C2-P20** | Elección del embedder, y con ella `L` y las dimensiones (**P7** del plan, `borrador-pipeline-tecnico.md:1957`; `PARAMETROS.embeddings.límiteDelModeloEnTokens = null`, `params.ts:290`) | Benchmark de recuperación sobre documentos reales. **Condicionado además por el requisito Matryoshka de la Capa 4** | Tramo 6 · motor |
| **C2-P21** | Si la miga concatenada mejora la recuperación (**P6**, `:1956`) | Comparar recuperación con y sin miga | Tramo 6 · clave del caché |
| **C2-P22** | `factorDeSobreFetch` para que el dedupe no vacíe un top-10 (`params.ts:316-324`) | Medir el colapso real de N vectores → 1 fragmento. Ojo: **la Capa 3 encontró que hay un segundo encogimiento independiente** (la poda del filtro de acceso) y que se multiplican | Búsqueda |
| **C2-P23** | Presupuesto y degradación del embebido (**P8**, `:1958`) | Costo medido sobre corpus real | Tramo 6 |
| **C2-P24** | Multimodal: encoder commodity + adapter propio vs. ColPali/RegionRAG (`07-...:64-68`) | Prueba comparativa | Recuperación visual |

### 4.3 · Esperan una decisión técnica

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C2-P2** | Cuál es el vector canónico de un fragmento cuando N > 1 (§3.2) | Decisión técnica conjunta con Capa 4 | Clustering |
| **C2-P3** | Cobertura de σ más allá de `grid` (§3.3) | Cambio de contrato en `ir` | `Registro` · Capa 5 |
| **C2-P4** | Variante temporal en `Coordenada` (§3.3) — **compartido con Capa 5** | Cambio de contrato en `ir`, hoy barato | Los doce adaptadores |
| **C2-P5** | Estabilidad de `región` en la variante `grid` (`ubicacion.ts:114-115`) | Decisión de contrato | Direccionamiento exacto |
| **C2-P6** | Destino de los `Registro`: tabla, clave, idempotencia y superficie de consulta (§3.4) | Diseño del tramo 7 | Capa 5 (`browse`/`fetch`) |
| **C2-P9** | Multi-tenencia técnica a nivel organización: colección por org vs. payload filtering, aislamiento duro, latencia y costo a 500 personas (`07-...:56-62`) + el filtro de lectura de **P12** | Decisión técnica con voto de Capa 3 | Todo el almacenamiento |
| **C2-P11** | Atar versión ↔ instante, y declarar cuál versión es la viva (§3.7) | Cambio de contrato en `ir` | Consultas temporales |
| **C2-P12** | Quién produce las entidades si el pipeline reemplaza a mem0 (§3.8) — **compartido con Capa 4** | Decisión técnica | Grafo · nombres de área |
| **C2-P14** | Cuál es «la» coordenada de una memoria que agrupa N nodos (§3.10) | Depende de `C2-P1` | Citas |
| **C2-P15** | `ClaveObjeto` en `Ingesta`, para volver al documento completo (§3.11) | Cambio de contrato en `ir`, hoy barato | Verificación · Capa 5 |
| **C2-P16** | `delete_payload` lanza «no implementado (FASE-4)» (`outbox-relay.ts:62`) | Implementación | Borrado |
| **C2-P17** | No existe reconciliación Qdrant→Postgres (`memory.service.ts:88-96`) | Diseño + implementación | Integridad del índice |
| **C2-P18** | El glosario nuevo no menciona ningún tipo del IR (§1.4) | Escritura | Vocabulario común |
| **C2-P25** | **Incoherencia interna del contrato**: `params.ts:300` conserva `embeddings.solapamientoEntreVentanas` y el sustantivo «ventana» (`:283-311`), que `salidas.ts:381-385` y `borrador-pipeline-tecnico.md:2168` declaran **borrados**. Si alguien lo lee como vigente, cambia el conteo de vectores y con eso el sobre-fetch del dedupe. | Limpieza en `packages/ir` — barata y mecánica | Tramo 6 |
| **C2-P26** | Filtro de relevancia previo para Slack/Teams — la Capa 1 lo asigna explícitamente a Capa 2/4 (**P4**, `borrador-pipeline-tecnico.md:1966`) | Diseño | Ingesta de canales conversacionales |
| **C2-P27** | Qué pasa con una anotación cuyo nodo es una **baja**: ¿cascada, huérfana, resurrección? (`salidas.ts:252-254`) — **compartido con Capa 3** | Decisión técnica | Curación |
| **C2-P28** | Si el motor v2 (clustering) pertenece a la Capa 2 o a la Capa 4 (`07-...:76-78`) | Decisión de alcance documental | Dónde vive el diseño |

---

## 5. Qué no hace falta decidir todavía

Honestidad sobre el alcance, para que la lista de arriba no parezca un muro:

- **Nada de la sección 4.2 bloquea construir.** Son mediciones sobre corpus real, y
  el corpus real aparece construyendo. Es el mismo diagnóstico que sacó a la Capa 1
  del bucle de diseño.
- **`C2-P16`, `C2-P17`, `C2-P18` y `C2-P25` son trabajo mecánico**, no decisiones.
  Se pueden hacer en cualquier momento sin consultar a nadie.
- **Toda la sección 4.1 salvo `C2-P1` puede esperar** a que haya memorias reales
  fluyendo: son preguntas sobre comportamiento observable, y hoy no hay qué observar.

**Lo único que conviene no dejar pasar** son los cambios de contrato baratos —
`C2-P4`, `C2-P11`, `C2-P15` — porque `packages/ir` ya tiene un dependiente
(`packages/emission`) y cada paquete nuevo encima los encarece.

Y `C2-P1`, que no es urgente por costo de implementación sino porque **condiciona la
respuesta de todos los demás**.

---

## Decisiones tomadas

**Vacío. No se tomó ninguna decisión al escribir este borrador, y es a propósito:**
su función es consolidar lo que ya se sabe y numerar lo que falta, para que el equipo
decida después. Todo lo que aparece en la sección 1 son decisiones tomadas **en otro
lado y en otra fecha**, y siguen perteneciendo a esos documentos.

| Fecha | Decisión | Punto que cierra |
|---|---|---|
| — | — | — |
