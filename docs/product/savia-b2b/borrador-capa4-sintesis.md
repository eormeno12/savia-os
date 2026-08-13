# Borrador — Capa 4: Síntesis

> **Documento de trabajo, 2026-08-10.** Consolida lo que hoy se sabe sobre el motor
> de síntesis para que el equipo itere encima. **Acá no se decide nada:** lo que
> está decidido se cita con `archivo:línea`, lo que no lo está va como punto
> abierto numerado (`C4-P1` … `C4-P21`), y donde hay caminos posibles se listan
> todos sin recomendar ninguno.
>
> Reemplaza a [`10-capa4-sintesis-modelo.md`](../savia-b2b-legacy/10-capa4-sintesis-modelo.md)
> y [`11-capa4-motor-sintesis-tecnico.md`](../savia-b2b-legacy/11-capa4-motor-sintesis-tecnico.md).
> **No reemplaza** a [`apx-motor-v2.md`](../savia-b2b-legacy/apx-motor-v2.md), que
> son 312 líneas con cero pendientes y sigue siendo el diseño vigente del motor.
>
> **Esta capa es distinta de todas las otras: es una REINTEGRACIÓN, no un diseño
> desde cero.** Sus servicios ya están construidos y corriendo en el código
> congelado. Lo que sigue abierto acá es **de producto** —qué es un skill, qué lo
> hace canónico, quién gana ante vistas contradictorias—, no de arquitectura.
>
> **Si solo se lee una sección, es la 2.** La 3 es la que hay que tener al lado
> cuando se empiece a escribir el tramo 7.

---

## 0. De dónde sale este borrador

Cuatro insumos:

1. **La lectura cruzada de capas**
   ([`lectura-cruzada-capas-2026-08-10.md`](lectura-cruzada-capas-2026-08-10.md)).
   Cinco de sus ocho hallazgos convergentes caen acá: **H1** (la unidad — el más
   caro del informe), **H5** (N vectores por fragmento), **H6** (entidades sin
   productor), **H3** (la organización no viaja con el dato) y **H8** (el tramo 7
   sin diseñar, y el motor no puede vivir de una API top-k).
2. **[`apx-motor-v2.md`](../savia-b2b-legacy/apx-motor-v2.md)** — el diseño validado
   del motor, sin pendientes.
3. **El código congelado de `apps/legacy-api`**, donde ese diseño está implementado.
   Cuando este documento lo cita está describiendo **la implementación actual**, que
   se reintegra como **diseño validado, nunca copy-paste** — la regla del monorepo
   para todo lo congelado el 2026-07-29.
4. **El contrato congelado** `packages/ir`, para contrastar qué emite el pipeline
   nuevo contra qué consume el motor hoy.

No se diseñó nada nuevo. La forma sigue la de
[`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md).

---

## 1. Lo que ya está diseñado y corriendo

El documento anterior de esta capa listaba como insumo pendiente *«hay que leer
`apx-motor-v2.md` a fondo para saber qué reutiliza el motor de síntesis»*
(`10-...:20-22`, `11-...:19-23`). Ya está leído, y la respuesta cambia el encuadre:
**el motor v2 es un servicio nuevo, no una evolución**, porque su invariante es **no
cruzar `userId`** (`11-...:94-103`;
[`19-decisiones-abiertas.md:25`](../savia-b2b-legacy/19-decisiones-abiertas.md)), y ese
invariante está verificado en el propio apéndice (`apx-motor-v2.md:288`).

### 1.1 · Los servicios que existen

| Servicio | Qué hace | Dónde |
|---|---|---|
| `MemoryGraphService` | Construye el grafo mutual-kNN sobre los vectores; `insert(memoryId, userId, vec1536)` | `apps/legacy-api/src/modules/organization/memory-graph.service.ts:38-50` |
| `EnginePlacementService` | Coloca cada memoria nueva en el grafo; near-dup por coseno ≥ 0.97 | `apps/legacy-api/src/modules/organization/engine-placement.service.ts:36-45` |
| `EngineBootstrapService` | Carga inicial del corpus completo con `scroll` | `engine-bootstrap.service.ts:88-94` |
| `PersonaService` · `CommunityService` | Detección de comunidades → `Space` | `apps/legacy-api/src/modules/organization/` |
| `StructureExecutorService` | Escribe la membresía a área (`syncMembership`) | `structure-executor.service.ts:52-63` |
| `NamingService` | Nombra un área contando la faceta `entities` | `naming.service.ts:27,36-44` |
| `EngineTasksService` | Orquestación de las tareas del motor | `apps/legacy-api/src/modules/organization/` |

### 1.2 · Los pesos y umbrales, que son datos medidos y no hay que reinventar

| Valor | Qué decide | Dónde |
|---|---|---|
| `weight = simScore + entBoost` | peso de cada arista del grafo | `memory-graph.service.ts:48-50` |
| `ENTITY_BOOST = 0.15` | cuánto suma compartir entidades | `memory-graph.service.ts:48-50`, `apx-motor-v2.md:274` |
| coseno ≥ 0.97 | near-dup, marca `savia_superseded` | `engine-placement.service.ts:42-45`, `apx-motor-v2.md:273` |
| 1536 d, distancia coseno | dimensión del vector | `qdrant.connection.ts:6,66` |
| **Matryoshka: «we cluster in 256d, retrieve in 1536d»** | truncación para clusterizar | `apps/legacy-api/src/common/math/vector.ts:3-4` |

> El requisito **Matryoshka** merece un renglón aparte porque **nada en la Capa 1 lo
> conoce**, y condiciona la elección del embedder (**P7** del plan,
> [`borrador-pipeline-tecnico.md:1957`](borrador-pipeline-tecnico.md)). Un embedder
> que no soporte truncación Matryoshka obliga a rediseñar el clustering o a
> mantener dos embeddings. Es `C4-P4`.

### 1.3 · Lo que se reintegra como diseño, y lo que habría que reescribir

**Se reintegra el diseño:** el grafo mutual-kNN, la detección de comunidades, la
colocación incremental, el near-dup, el naming por entidades y el invariante de no
cruzar `userId`. Todo eso está validado y no hay razón para rediscutirlo.

**Habría que reescribir la superficie de entrada**, porque cambia lo que le llega:
hoy recibe `memoryId` + `vec1536` de mem0, y el pipeline nuevo emite otra cosa. Eso
es la sección 2, y la traducción campo por campo es la sección 3.

### 1.4 · Lo que este documento pedía y ya estaba decidido

| Casilla | Con qué se cierra |
|---|---|
| **«Qué dispara una re-síntesis de un skill publicado — candidato: la reconciliación de identidad»** (`11-...:70-75`) | Cerrado del lado de Capa 1: `SalidaDeEmisión = {nodos, bajas, métricas}` (`packages/ir/src/salidas.ts:256-260`), con `bajas: ElementId[]` justificado porque «el tramo 7 tiene que borrar lo que ya no existe y NADIE LE ENTREGA LA LISTA» (`:243-250`), más `anclaje` con denominador declarado (`:211`). **La señal existe, tiene tipo y tiene métrica.** |
| **«Cómo se preserva procedencia durante la reconciliación»** (`11-...:58-59`) | `Fragmento.nodos` (`salidas.ts:354`) + `NodoEnVersión` (`:323-336`) + `Autoría` (`identidad.ts:382-387`). Falta solo el primer eslabón: el hecho (§2) |
| **«Cuánto contexto necesita reconciliar — si hace falta más que el fragmento y su rastro de migas, cambia el tramo 7»** (`05-capa1-pipeline-ingesta-tecnico.md:823-825`) | **Ya no cambia el tramo 7**: el tramo 5 entrega migas con referencia estable al nodo-título (`salidas.ts:160-168`) y el tramo 6 las manda al payload para filtro exacto por sección (`borrador-pipeline-tecnico.md:2145-2147`) |
| **«Un skill hereda procedencia de Capa 2 — ¿cómo se ve en la práctica?»** (`10-...:52-53`) | La cadena está escrita: `hecho → fragmento → elemento → coordenada → documento` (`05-capa1-...:549-553`), con los tres últimos eslabones tipados |
| **«Hay que leer `apx-motor-v2.md` a fondo»** (`10-...:20-22`) | Hecho; ver arriba |
| **Colisión de nombres `organization` / `Organization`** (`11-...:86-88`) | Resuelta ([`19-decisiones-abiertas.md:23`](../savia-b2b-legacy/19-decisiones-abiertas.md)). **Conviene abrir la segunda**: `Fragmento` (IR) vs. `FragmentShare`/`fragmentScope` (access) — ver §3 |

---

## 2. La unidad: el desajuste que define si esto funciona

**Es el hallazgo más caro de toda la lectura cruzada, y esta capa es una de las dos
que lo decide.**

### 2.1 · Lo que el motor asume

El motor coloca **una memoria = un punto = un vector**:

```
placeAtAdd(userId, fact.id, vec1536, areaId)
```

(`apx-motor-v2.md:103`, `engine-placement.service.ts:36`). Ese `fact.id` viene de
`Mem0Service.add()` (`apps/legacy-api/src/modules/memory/memory.service.ts:53,58`), y
**`MemoryEdge`, `MemoryPersona`, `MemoryArea` y `MemoryIndex` cuelgan todos de ese
`memoryId`** (`apps/legacy-api/prisma/schema.prisma:241-352`).

O sea: la unidad de análisis del motor es **el hecho extraído por un LLM**.

### 2.2 · Lo que el pipeline nuevo emite

`packages/ir` termina en `Fragmento` (`salidas.ts:346`), `Vector` (`:423`) y
`Registro` (`:454`). **No hay ningún tipo `Hecho`, `Memoria` ni `Proposición` en todo
`packages/ir/src`.** Y un `Fragmento` produce **N** `Vector` (`Vector.orden` = «i de
N», `:425`), no uno.

### 2.3 · Lo que se verificó

`grep -i "extracci"` sobre las 2347 líneas de
[`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md) devuelve **cero
resultados**. El pipeline tiene siete tramos (`:38-46`), dice «Eran once» y enumera
los cuatro que se fueron —Traducción, Validación, Composición, Diferencia
(`:53-57`)—: **la extracción no está entre los borrados, simplemente no aparece.** Sí
estaba declarada en el documento anterior de Capa 1: tramo `9 EXTRACCIÓN prosa →
modelo → hechos` (`05-capa1-pipeline-ingesta-tecnico.md:467-468`).

**Y no es un olvido.** `borrador-pipeline-tecnico.md:1046-1047`:

> «Recibe la afirmación precisamente porque **extraer hechos de una conversación
> exigiría un modelo de lenguaje en el camino de escritura**.»

Contra la primera decisión fundacional del pipeline: «ningún modelo de lenguaje en el
camino de escritura» (`:29-30`).

### 2.4 · Por qué es peligroso: NO FALLA

Este es el punto que hay que retener. Si nadie decide nada, el pipeline nuevo puede
llegar hasta el `upsert` a Qdrant y **el motor va a clusterizar rebanadas de texto
como si fueran memorias**, con `entBoost` en cero (§4.1) y sin sensibilidad (§4.2).

Nada tira una excepción. Nada baja un test. **Todo verde**, y la calidad del
clustering se degrada en silencio contra una línea base que nadie midió.

### 2.5 · Las salidas visibles

Se listan sin recomendar ninguna. Es `C4-P1`, y **se decide junto con la Capa 2**:
allá es su unidad, acá es su entrada. La misma tabla vive en
[`borrador-capa2-memoria.md`](borrador-capa2-memoria.md) §3.1.

| | Salida | Qué implica para el motor |
|---|---|---|
| **a** | Una memoria **es** un fragmento | El motor clusteriza fragmentos. Hay que contestar `C4-P2` (¿cuál de los N vectores?) y medir la calidad del clustering sobre texto sin verbalizar contra la línea base actual |
| **b** | La verbalización ocurre en el camino de **lectura** | El motor sigue clusterizando algo parecido a hoy, pero hay que decidir dónde vive esa verbalización y si el «hecho» se persiste o es efímero. Si es efímero, el grafo no puede colgar de él |
| **c** | Hay un **tramo 8** con modelo de lenguaje | Es la única que reproduce el comportamiento actual sin cambiar el motor. Exige reabrir explícitamente la decisión fundacional de Capa 1 |

---

## 3. Desajuste de forma: lo que el motor consume hoy vs. lo que el pipeline emite

La tabla que hay que tener al lado cuando se escriba el tramo 7.

| Entrada actual del motor | Equivalente en `packages/ir` | ¿Mecánica o falta información? |
|---|---|---|
| `memoryId: string` = id del punto Qdrant = `fact.id` de mem0 (`memory-graph.service.ts:38`; `memory.service.ts:53,58`; `schema.prisma:242`) | **No existe.** Lo más cercano: `FragmentoId` (`identidad.ts:187`) y `ElementId` (`:96`) | **Falta información.** No es renombrar un id: el motor clusteriza hechos, el IR emite fragmentos. Es un **cambio de unidad de análisis** |
| `vec1536: number[]`, 1536 d, coseno (`qdrant.connection.ts:6,66`) | `Vector.valores: readonly number[]`, **sin dimensión** (`salidas.ts:429`); `L` pendiente (`params.ts:299`, **P7**) | Mecánica **solo si** se elige un embedder de 1536 d compatible con Matryoshka; si no, hay que recrear la colección |
| 1 punto = 1 memoria = 1 vector | 1 `Fragmento` → **N** `Vector` (`salidas.ts:423-425`) | **Falta información del lado del motor.** `MemoryEdge.srcId/dstId` (`schema.prisma:289-304`) son ids de punto: con N > 1 el kNN devuelve **rebanadas** y el grafo se llena de aristas entre rebanadas del mismo fragmento. El dedupe por `fragmentoId` existe solo del lado de la búsqueda (`borrador-pipeline-tecnico.md:2343`) |
| `payload.user_id`, `is_tenant:true` (`qdrant.connection.ts:17,89-90`); partición de toda lectura vía `P.own` (`predicate.ts:64-71`) | `Ingesta.dueño` + `organización` (`salidas.ts:557-558`), **fuera del `Vector` por diseño** (`:542-552`) | Mecánica de escribir, **pero mueve la frontera**: legacy particiona por **usuario**; la Capa 4 necesita **organización** con fan-out por dueño (`read-plan.ts:5-12`) |
| `payload.savia_area_ids` (`qdrant.connection.ts:13`), proyección de `MemoryArea` (`schema.prisma:269-281`) | **No existe** | No es entrada de Capa 1: la escribe el propio motor vía `StructureExecutorService.syncMembership` (`structure-executor.service.ts:52-63`). Lo que falta decidir es **quién la escribe cuando la unidad ya no es una memoria** |
| `payload.savia_entities` + `EntityGraphPort.entitiesForMemory` (`entity-graph.port.ts:35-38`) → `entBoost` | **No existe** (cero resultados en `packages/ir` y en el borrador) | **Falta información, y degrada EN SILENCIO**: `entBoost = 0` en todas las aristas, nada falla |
| `payload.savia_sensitivity` (`qdrant.connection.ts:15`) | **No existe**; hueco declarado (`salidas.ts:502-505`) | **Falta información**, y es la que **gatea el cruce entre personas** (`read-plan.ts:21-23`) |
| `payload.savia_superseded` + near-dup coseno ≥ 0.97 (`engine-placement.service.ts:42-45`) | Dedupe **exacto** por `huellaContextual` / `ClaveEmbedding` (`identidad.ts:255-266,287-299`) | **No traducible**: son dos dedupes distintos —semántico vs. por contenido—. **Conviven, no se sustituyen** |
| `textOf(payload)` = `payload.data ?? memory ?? text` (`facets.ts:19-21`), usado por `NamingService` (`naming.service.ts:36-44`) | `Fragmento.texto`, **limpio, sin migas** (`salidas.ts:350`) | Mecánica, con advertencia: lo que se **embebe** es `miga ‖ texto` (`salidas.ts:391`) y lo que el motor leería como texto es solo `texto` |
| `EntityGraphPort` lee `{collection}_entities`, **colección que genera mem0** (`apx-motor-v2.md:254`) | mem0 no aparece en el borrador (cero resultados) | **Falta información**: si el pipeline nuevo reemplaza `Mem0Service.add()`, la colección **deja de poblarse** |
| `FragmentShare` = compartir un par `(dueño, Space)` dentro de un grupo (`schema.prisma:482-497`), base de `fragmentScope` (`read-plan.ts:50`) | `Fragmento` = unidad de texto embebible (`salidas.ts:346`) | **Colisión de vocabulario pura**, y justo en el chokepoint que esta capa decidió reusar. Es la **segunda** colisión, después de `organization`/`Organization` |

> **Estado de implementación, para calibrar:** `packages/ir` no tiene todavía ningún
> consumidor que produzca estos tipos — solo `packages/emission`, que implementa el
> tramo 4. **No existe implementación de los tramos 5, 6 ni 7.** La tabla de arriba
> contrasta **código corriendo** (legacy) contra **contrato declarado** (IR).

---

## 4. Lo que la Capa 1 no le da

Ordenado por costo de resolverlo tarde. **Los dos primeros degradan en silencio**, que
es lo que los vuelve peores que un error.

### 4.1 · Las entidades se quedan sin productor — degrada en silencio

Cada arista pesa `weight = simScore + entBoost` con `ENTITY_BOOST = 0.15`
(`memory-graph.service.ts:48-50`), y el nombre de un área sale de contar la faceta
`entities` (`naming.service.ts:27`). La fuente es la colección `{collection}_entities`
**que puebla mem0** (`entity-graph.port.ts:1-9`, `apx-motor-v2.md:254`).

Ni el borrador ni `packages/ir` mencionan entidades. La válvula existe
—`AnotaciónPropuesta.clase` es abierta a propósito (`salidas.ts:468-475`)— pero no hay
anotador de entidades declarado, y el contrato admite que «los anotadores no tienen
registro, orden, política de fallo ni presupuesto» (`salidas.ts:523-527`).

**Si el pipeline reemplaza a mem0, `entBoost` cae a 0 en todas las aristas y el grafo
pasa a ser coseno puro.** Nada falla. Es `C4-P3`, compartido con la Capa 2.

### 4.2 · La sensibilidad por elemento no tiene tipo — y es la llave del cruce entre personas

La decisión del 2026-07-29 es que **la síntesis es cross-boundary y reusa
`compileReadPlan`** (`11-...:94-103`;
[`19-decisiones-abiertas.md:25`](../savia-b2b-legacy/19-decisiones-abiertas.md)). Ese
chokepoint gatea por la sensibilidad **del dueño del fragmento, no del lector**: *«A
reader's grant NEVER lifts another person's sensitive»*
(`apps/legacy-api/src/modules/access/read-plan.ts:21-23`, `access.service.ts:44-45`).

La faceta existe en legacy (`qdrant.connection.ts:15`, `facets.ts:13`,
`predicate.ts:21`, `schema.prisma:244`). El IR no la produce y lo dice él mismo
(`salidas.ts:502-505`). El tramo `10 CLASIFICACIÓN sensibilidad automática sobre cada
hecho` del documento anterior de Capa 1 (`05-capa1-...:470`) **no tiene contraparte**
en el borrador ni en el contrato.

Sin esto, **el cruce entre personas —que es la promesa central del producto— no tiene
con qué gatearse.** El detalle completo vive en
[`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md) §3. Es `C4-P5`.

### 4.3 · `OrganizacionId` no llega al vector

`Ingesta` lleva `organización` y `dueño` (`salidas.ts:554-562`) pero es un envoltorio
deliberadamente fuera del árbol (`:542-552`); `Vector` tiene cuatro campos y ninguno
es la organización (`:423-430`). Es **P12** del plan (`identidad.ts:90-94`,
`borrador-pipeline-tecnico.md:1962`).

En legacy el análogo está resuelto y es infraestructura: `user_id` indexado con
`is_tenant: true` (`qdrant.connection.ts:89-90`), todo predicado por `P.own`
(`predicate.ts:64-71`). **Agravante:** legacy particiona por **usuario**, no por
organización — `MemoryIndex` no tiene `organizationId` (`schema.prisma:241-267`). Y
esta capa lee **entre personas de una misma organización**. Es `C4-P6`.

### 4.4 · Dimensión y modelo del embedder sin decidir, con el motor cableado

Las firmas del motor son literalmente `vec1536: number[]`
(`memory-graph.service.ts:38`, `engine-placement.service.ts:36`). El IR tiene
`Vector.valores: readonly number[]` **sin dimensión** (`salidas.ts:429`) y
`PARAMETROS.embeddings.límiteDelModeloEnTokens: null` (`params.ts:299`).

Además, `ClaveEmbedding` compone `versiónEmbedder` (`identidad.ts:289`) pero **ningún
tipo declara ese campo**. Es `C4-P4` y `C4-P7`.

### 4.5 · Los `Registro` no tienen destino

`salidas.ts:451-452`. Es exactamente el dato duro —una fila de planilla con su
esquema— que las «reglas de decisión» y las «políticas / restricciones» de un skill
(`10-...:30-32`) necesitarían citar. Es `C4-P8`, compartido con las Capas 2 y 5.

### 4.6 · El tramo 7 está sin diseñar, y el motor no puede vivir de una API top-k

`# Tramo 7 · Persistencia — sin diseñar` (`borrador-pipeline-tecnico.md:2339`): nueve
líneas y un encargo. Qdrant se nombra dos veces en todo el documento (`:46`, `:2343`)
y el único campo de payload especificado es la miga (`:2145-2147`).

**El requisito duro que el tramo 7 tiene que satisfacer:** el motor necesita
`scroll(limit:100_000, withVectors:true)` (`engine-bootstrap.service.ts:88-94`) y
`knn` (`memory-graph.service.ts:40`) sobre el corpus completo. **Es la razón declarada
de que el motor no use mem0** (`apx-motor-v2.md:248-252`). Un tramo 7 que solo exponga
búsqueda top-k deja al motor sin bootstrap. Es `C4-P9`.

---

## 5. El puente con la Capa 1: lo que sí recibe

| Lo que pide la Capa 4 | Tipo / campo | Caveat |
|---|---|---|
| «Cada regla del skill debe señalar de qué memoria(s) salió» (`11-...:58-59`) | `Fragmento.nodos` (`salidas.ts:354`) + `Autoría` (`identidad.ts:382-387`) + `NodoEnVersión` (`salidas.ts:323-336`) | Falta el primer eslabón: el hecho (§2) |
| «Qué dispara una re-síntesis… señal de que esta fuente cambió» (`11-...:70-75`) | `SalidaDeEmisión.bajas` (`salidas.ts:258`) + `MétricasReconciliación` con `anclaje`, `altas`, `bajas`, `adaptadorAnterior`, `versiónAnterior` (`:214-238`) | — |
| «Versionado y vigencia… qué decía esto en marzo» (`10-...:45-49`) | `NodoEnVersión.versión: HashBytes`, **acumulativo por diseño** (`salidas.ts:316-321`) | La versión es un hash, no una fecha: ningún tipo ata versión ↔ instante (ver Capa 2 §3.7) |
| «Cuánto contexto necesita reconciliar» | `MigaEstable = Miga<ElementId>` (`salidas.ts:160-168`), que va al payload para filtro exacto por sección (`borrador-pipeline-tecnico.md:2145-2147`) | — |
| «Una skill puede decidir no citar como autoridad algo de confianza baja» | `NodoCrudo.confianza` (`salidas.ts:119`), `nivel` (`:108`), `atribución` (`:106`), `Fragmento.certezaMínima` (`:375`) | **El paquete no exporta orden sobre `Certeza`**, así que «la peor» no es computable con lo que hay hoy ([`informe-ir-2026-08-09.md:218`](informe-ir-2026-08-09.md)). Y el **número** de `confianza` muere en `NodoCrudo` |
| «Rol del humano en el loop / qué pasa si rechaza» (`10-...:42-43`, `11-...:61-64`) | `Anotación.origen: 'automática'\|'humana'` obligatorio + clave de dedupe `(nodo, anotador, clase, rango)` para que la re-emisión no arrase la curación (`salidas.ts:493-512`) | **Nadie declara leerlas** (`:502-505`). Y la anotación no dice **qué** humano (ver Capa 3) |

---

## 6. Puntos abiertos

Separados por naturaleza. **La mayoría de esta capa es producto, no arquitectura** —
que es la diferencia con las otras tres.

### 6.1 · De producto

Son las preguntas que definen qué es un skill. Ninguna se destraba con código.

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C4-P10** | **Qué es un skill como forma de dato**: pasos, reglas de decisión, actores, políticas, procedencia, versión y vigencia (`10-...:30-33`). Y con eso, qué forma tiene un hecho (`05-capa1-...:821-822`) | Decisión de producto. Bloquea a casi todas las de abajo | Toda la capa |
| **C4-P11** | Qué hace a un skill **canónico** y no solo «plausible» frente a un resumen de LLM (`10-...:34-35`) | Decisión de producto | La promesa central |
| **C4-P12** | Reconciliación de vistas contradictorias: quién gana o si se fusiona; prioridad por antigüedad, rol o frecuencia (`10-...:40-41`, `11-...:55-57`) | Decisión de producto | Calidad · confianza |
| **C4-P13** | Punto exacto de validación humana, y qué pasa con el rechazo (`11-...:61-64`) | Decisión de producto | Loop humano |
| **C4-P14** | Coexistencia de skills contradictorios vs. unicidad forzada (`10-...:61-62`) | Decisión de producto | Modelo de datos |
| **C4-P15** | Qué dispara un intento de síntesis: cron / umbral de actividad / pedido de admin / detección de conflicto (`11-...:108-111`, `19-decisiones-abiertas.md:24`) | Decisión de producto | Orquestación · costo |
| **C4-P16** | Cómo se deprecia un skill sin romper automatizaciones que ya lo usan (`10-...:48-49`) | Decisión de producto | Capa 5 |
| **C4-P17** | Si el fragmento es la unidad correcta o hace falta un nivel de agrupación **por procedimiento** (`05-capa1-...:826-828`) | Decisión de producto. Depende de `C4-P1` | Clustering |
| **C4-P18** | Métricas de calidad de un skill sintetizado (`11-...:77-79`) | Decisión de producto + medición | Todo |
| **C4-P19** | Cuánto del motor es genérico vs. tuning por organización o industria (`11-...:89-90`) | Decisión de producto | Escalabilidad comercial |
| **C4-P20** | Formato exacto que se le entrega al LLM consumidor por Capa 5, y dónde se almacena (`10-...:54-55`, `11-...:67-69`) | Decisión conjunta con Capa 5 | Superficie MCP |

### 6.2 · Técnicos

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C4-P1** | **Cuál es la unidad que se clusteriza** (§2). Tres salidas enumeradas, ninguna elegida | Decisión conjunta Capa 2 + Capa 4. **Bloquea a las demás** | Todo el motor |
| **C4-P2** | Cuál es el **vector canónico** de un fragmento cuando N > 1 (§3) | Decisión técnica conjunta con Capa 2 | Grafo · kNN |
| **C4-P3** | **Quién produce las entidades** si el pipeline reemplaza a mem0 (§4.1) | Decisión técnica | `entBoost` · naming de áreas |
| **C4-P4** | Si el embedder elegido soporta **truncación Matryoshka** a 256 d (§1.2) | Dato del modelo que se elija (**P7** del plan) | Clustering |
| **C4-P5** | Cómo llega la **sensibilidad** hasta el punto donde se gatea el cruce entre personas (§4.2) | Cambio de contrato + punto de lectura en tramo 6/7 | Cross-boundary |
| **C4-P6** | **Organización** en el payload, con fan-out por dueño (§4.3) | Diseño del tramo 7 | Multi-tenencia |
| **C4-P7** | `versiónEmbedder` no está declarado en ningún tipo, aunque `ClaveEmbedding` lo compone (§4.4) | Cambio de contrato en `ir`, hoy barato | Invalidación de caché |
| **C4-P8** | Destino de los `Registro` (§4.5) | Diseño del tramo 7 | Citas de datos duros |
| **C4-P9** | Que el tramo 7 garantice **`scroll` sobre el corpus completo**, no solo top-k (§4.6) | Diseño del tramo 7 | Bootstrap del motor |
| **C4-P21** | **Colisión de vocabulario**: `Fragmento` (IR) vs. `FragmentShare` / `fragmentScope` (access), justo en el chokepoint que esta capa decidió reusar (§3) | Decisión de nomenclatura | Legibilidad · bugs |

---

## Decisiones tomadas

**Vacío. No se tomó ninguna decisión al escribir este borrador, y es a propósito:**
su función es consolidar lo que ya se sabe y numerar lo que falta, para que el equipo
decida después.

Todo lo que aparece en la sección 1 son decisiones tomadas **en otro lado y en otra
fecha** —el diseño del motor v2 en
[`apx-motor-v2.md`](../savia-b2b-legacy/apx-motor-v2.md), y la decisión del 2026-07-29
sobre síntesis cross-boundary en
[`19-decisiones-abiertas.md:25`](../savia-b2b-legacy/19-decisiones-abiertas.md)— y
siguen perteneciendo a esos documentos.

| Fecha | Decisión | Punto que cierra |
|---|---|---|
| — | — | — |
