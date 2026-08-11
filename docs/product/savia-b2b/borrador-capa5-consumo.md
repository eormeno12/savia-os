# Borrador — Capa 5: Consumo (MCP)

> **Documento de trabajo, 2026-08-10.** Consolida lo que hoy se sabe sobre la
> superficie de consumo para que el equipo itere encima. **Acá no se decide nada:**
> lo que está decidido se cita con `archivo:línea`, lo que no lo está va como punto
> abierto numerado (`C5-P1` … `C5-P20`), y donde hay caminos posibles se listan
> todos sin recomendar ninguno.
>
> Reemplaza a [`12-capa5-consumo-mcp.md`](../savia-b2b-legacy/12-capa5-consumo-mcp.md)
> y absorbe lo pendiente de [`14-superficies-de-producto.md`](../savia-b2b-legacy/14-superficies-de-producto.md)
> y [`13-adopcion-bottom-up.md`](../savia-b2b-legacy/13-adopcion-bottom-up.md) que
> toca a esta capa.
>
> **Esta es la única capa que el cliente ve.** Eso la vuelve el mejor detector de
> huecos del sistema: **lo que no se puede contestar por MCP no existe para el
> cliente**, por más bien diseñado que esté adentro.
>
> **Si solo se lee una sección, es la 2.**

---

## 0. De dónde sale este borrador

Cuatro insumos:

1. **La lectura cruzada de capas**
   ([`lectura-cruzada-capas-2026-08-10.md`](lectura-cruzada-capas-2026-08-10.md)).
   Cuatro de sus ocho hallazgos convergentes caen acá: **H4** (no hay coordenada
   temporal — el más caro de esta capa), **H7** (los `Registro` sin destino, que son
   el `browse`/`fetch` que esta capa pide), **H3** (la organización no viaja con el
   dato) y **H2** (las anotaciones no tienen lector).
2. **La implementación actual** en `apps/legacy-api/src/modules/mcp/` y
   `apps/legacy-api/src/mcp.ts`. Su contrato es **transcribible, no hay que
   diseñarlo** — la sección 1 lo transcribe.
3. **El contrato congelado** `packages/ir`, para verificar qué se puede citar y qué
   no.
4. **La visión** ([`01-vision.md`](01-vision.md)), que es donde esta capa promete
   cosas que después hay que poder cumplir.

No se diseñó nada nuevo. La forma sigue la de
[`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md).

> **Corrección de numeración.** La tabla de puntos abiertos del plan de Capa 1 va de
> **P1 a P12** ([`borrador-pipeline-tecnico.md:1954-1967`](borrador-pipeline-tecnico.md)).
> **`P13`, `P14`, `P15` y `P16` no existen.** El tema de citas es real, pero vive
> como prosa dispersa en el borrador (`:240`, `:1041`, `:1107`, `:2207`), no como
> punto numerado. No propagar esa numeración.

---

## 1. El contrato que ya existe

El documento anterior pedía «documentar el contrato exacto (input/output),
autenticación, rate limit, audit log actual» (`12-...:24`). Está todo en el código.

### 1.1 · Las dos herramientas

```
savia_search(query, areas?)  →  [{ id, text, score, areas }]
```
`apps/legacy-api/src/modules/mcp/mcp.tools.ts:61-95`, con la forma de salida en `:89`.

```
savia_remember(content)  →  { stored, ids }
```
`mcp.tools.ts:97-121`.

**No hay una tercera.** Y esa ausencia es una decisión, no una carencia — ver §1.5.

### 1.2 · Autenticación

Bearer **stateless por request** (`apps/legacy-api/src/mcp.ts:72-75`). El token se
resuelve con `resolveToken` y de ahí sale el plan de acceso:

```
bearer → resolveToken → buildConnectionReadPlan → searchPartitions
```

(`mcp.tools.ts:56-59`, `:71-77`), con el clamp `granted ∩ requested` — el pedido del
caller solo puede **angostar** lo concedido, nunca ensancharlo.

La caché de grants mapea token → `{connectionId, userId}` con TTL de 60 s y **no
cachea el plan de acceso**
(`apps/legacy-api/src/modules/connections/grants.cache.ts:4-8`).

### 1.3 · Rate limit: son dos, no uno

| Límite | Valor | Dónde |
|---|---|---|
| Por IP, **antes** de autenticar | 120 / 60 s | `apps/legacy-api/src/mcp.ts:62-68` |
| Por conexión, **después** de autenticar | 30 / 60 s | `mcp.tools.ts:24-29` |

El primero protege el endpoint de un atacante anónimo; el segundo protege el corpus
de un cliente autenticado. Son independientes y se aplican en cascada.

### 1.4 · Audit log

Se escribe **awaited y fail-loud** —si el audit falla, la operación falla— con
`queryDigest` (SHA-256), **nunca el texto de la consulta** (`mcp.tools.ts:78-87`,
`:112-113`). El detalle del modelo y su cobertura real está en
[`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md) §1.7.

### 1.5 · El límite que el diseño ya respeta por construcción

`12-...:53-57` pide «confirmar el límite: Savia instruye, la empresa ejecuta».
**El MCP actual ya lo respeta, y no por disciplina sino por construcción:** expone
exactamente dos herramientas y **ninguna de ellas es de acción** (`mcp.tools.ts:61`,
`:97`). Una busca, la otra recuerda. Ninguna hace nada en un sistema de terceros.

Mantener esa propiedad cuando aparezcan los skills es `C5-P12`.

---

## 2. La prueba de la cita

**La sección más importante del documento**, porque es la que verifica si la promesa
de fidelidad llega hasta el cliente o se corta antes.

**El caso.** Una IA de la empresa llama `savia_search("¿cuál es el plazo de
preaviso?")`. Vuelve un fragmento del contrato de alquiler, cláusula quinta, en la
versión de marzo. La cita que hay que renderizarle a un humano:

> *«Contrato Alquiler Oficina.pdf › Cláusula Quinta › pág. 3 › versión del 12/03»*

**Eslabón por eslabón:**

| Eslabón | ¿Lo emite la Capa 1? | Con qué tipo |
|---|---|---|
| El texto | ✅ | `Fragmento.texto` (`packages/ir/src/salidas.ts:350`) |
| «Cláusula Quinta» (la sección) | ✅ | `Fragmento.migas: readonly MigaEstable[]` (`salidas.ts:352`), con `Miga<Ref> = {ref, texto}` (`:160-168`) |
| Qué unidad exacta | ✅ | `Fragmento.nodos: readonly ElementId[]` (`salidas.ts:354`) |
| «pág. 3» | ⚠️ **join + irrenderizable** | La `Ubicación` vive en el **nodo** (`salidas.ts:69`), no en el fragmento → hay que joinear por `nodos[i]`. Y al llegar, es `{espacio:"visual", caja:{marco:"p3"}}` con `marco` **opaco** |
| «del contrato X» (qué documento) | ❌ **corta acá** | `Fragmento` **no lleva documento, por decisión explícita** |
| El nombre legible del documento | ❌ **corta acá** | No existe en ningún tipo de `ir` |
| «versión del 12/03» | ❌ **corta acá** | `NodoEnVersión.versión` es un `HashBytes`, no una fecha |
| Link al original para verificar | ❌ | `ClaveObjeto` existe (`identidad.ts:146`) y **no está en `Ingesta`** |
| «Y qué tan seguros estamos» | ⚠️ parcial | `certezaMínima` sí (`salidas.ts:375`); el **número** de `confianza` no (`:119`) |

### 2.1 · Dónde se corta, y por qué el corte es intencional

El corte está **entre el `Fragmento` y el documento**. El fragmento sabe *qué dice* y
*bajo qué título*, y **no sabe de qué archivo salió**.

Y eso es correcto para el contrato, con un argumento explícito
(`packages/ir/src/identidad.ts:68-77`):

> «el documento lo lleva el **CONTENEDOR**, no cada referencia… repetirlo por elemento
> sería almacenar algo derivable.»

El contenedor es `Ingesta.documento` (`salidas.ts:555`) o `NodoEnVersión.documento`
(`:324`).

**La conclusión que importa:**

> **La cita no es un objeto que la Capa 1 emita. Es una consulta que la Capa 5 tiene
> que armar.**

Y las tres piezas que le faltan a esa consulta —**el nombre legible**, **cuál es la
versión viva**, **la clave del activo original**— viven en una fila de Postgres que
**ningún tipo declara** (`packages/ir/src/index.ts:31-67` no exporta ningún
`Documento`) y que escribiría el **tramo 7, que está sin diseñar**
(`borrador-pipeline-tecnico.md:2339`).

Detalle sobre la versión, porque tiene tres problemas encadenados:
`NodoEnVersión.versión: HashBytes` (`salidas.ts:332`) existe, pero **(a)** es un hash,
no una fecha ni un rótulo; **(b)** el índice **acumula todas las versiones**
(`:316-321`) y ningún tipo dice cuál es la viva; **(c)** `Ingesta` —el envoltorio que
acompaña a los nodos— **no lleva `HashBytes`** (`:554-562`).

### 2.2 · El segundo corte: la coordenada no es renderizable

Aun con el join resuelto, `marco: "p3"` **no se convierte en «página 3»**. El campo es
opaco por diseño (`packages/ir/src/ubicacion.ts:44`):

> «`"p3"`, `"slide#7"`, `"img"`. **Solo el adaptador sabe qué nombra.**»

Y no hay función de render de citas en el contrato: `renderizar` existe pero es
`Cuerpo → texto para embeber` (`packages/ir/src/proyeccion.ts:458`, exportada en
`index.ts:144`), no `Ubicación → cita humana`.

Peor: **el resolvedor de convenciones no tiene dónde vivir.** `ir` es el único punto
donde `adaptadores` y `emision` se ven (`index.ts:4`), y la regla R1 prohíbe que
alguien aguas abajo conozca formatos. Es `C5-P2`.

**Y falla en silencio:** la cita se muestra igual, solo que ilegible.

---

## 3. Lo que la Capa 1 no le da

Ordenado por costo de resolverlo tarde.

### 3.1 · No hay coordenada temporal: video y audio no son citables

**El más caro de esta capa.**

La visión promete σ por modalidad, y para video y audio dice literalmente `t_inicio,
t_fin` ([`01-vision.md:131`](01-vision.md)). `Coordenada` tiene exactamente cuatro
variantes —`fuente`, `texto`, `grid`, `visual`— y **ninguna lleva tiempo**
(`packages/ir/src/ubicacion.ts:73-125`). Las seis `FORMAS` tampoco
(`packages/ir/src/formas.ts:47-54`, `Cuerpo` completo en `:204-283`).

**Por qué encabeza la lista:** `SourceRange` está definido como
`Extract<Coordenada, { espacio: "grid" }>` (`ubicacion.ts:133`), así que agregar una
quinta variante más adelante toca **a la vez** la unión de la que dependen
`Registro.coordenada` (`salidas.ts:455`), todo consumidor exhaustivo y **los doce
adaptadores**.

Y mientras tanto, lo que la visión promete citar no se puede citar — que en esta capa
significa que **no existe para el cliente**. Es `C5-P1`, compartido con la Capa 2.

### 3.2 · Los `Registro` no tienen destino, y son justo el `browse`/`fetch` que esta capa pide

Esta capa lo lista abierto (`12-...:36-40`) y la Capa 2 dice que «no existe hoy»
(`06-capa2-memoria-modelo.md:30`). El contrato lo declara con nombre y apellido
(`packages/ir/src/salidas.ts:452-457`):

> «SIGUE ABIERTO (auditoría #56): los `Registro` no tienen destino — ni tabla, ni
> clave, ni idempotencia en la re-ingesta, **ni superficie de consulta**. El tramo 7
> no los menciona.»

La recuperación exacta y direccionable que promete
[`01-vision.md:167-168`](01-vision.md) **no tiene productor**. Es `C5-P3`.

### 3.3 · La organización no viaja con el dato: viaja al lado

`Fragmento` (`salidas.ts:346-376`), `Vector` (`:423-430`) y `Registro` (`:454-458`) no
llevan `OrganizacionId`. Solo lo lleva el envoltorio `Ingesta` (`:557`), y eso es
deliberado: meterlo adentro envenenaría el caché de reconocimiento, que cruza
organizaciones por diseño (`:544-552`).

La consecuencia está escrita (`packages/ir/src/identidad.ts:90-94`, = **P12**):

> «con unicidad global el id NO lleva su organización adentro, así que la separación
> entre tenants queda enteramente en el filtro de lectura, o sea en **una garantía de
> runtime que hay que acordarse de aplicar en cada consulta**.»

**Y quien tiene que acordarse es esta capa**, en cada llamada MCP. El tramo que
escribiría ese payload está sin diseñar (`borrador-pipeline-tecnico.md:2339`). Es
`C5-P4`.

### 3.4 · Las anotaciones de exclusión y sensibilidad no tienen lector

Esta capa promete acceso «gobernado por-caller» ([`01-vision.md:216`](01-vision.md),
`12-...:42-46`). El contrato declara que **ningún tramo lee anotaciones**
(`salidas.ts:502-505`), así que una exclusión marcada por el dueño **no impide que el
contenido llegue al índice** — y por lo tanto no impide que esta capa lo devuelva.

Detalle completo en [`borrador-capa3-gobernanza.md`](borrador-capa3-gobernanza.md)
§3. Es `C5-P5`.

### 3.5 · `Ingesta` no lleva la versión ni el activo original

`Ingesta = {documento, organización, dueño, canal, sellado, nivelLogrado, estado}`
(`salidas.ts:554-562`).

**No tiene `HashBytes`** — que es *la* versión (`:312-315`), y que `NodoEnVersión`
exige persistir en la misma transacción que los nodos (`:326-332`). **No tiene
`ClaveObjeto`** — el «activo original / verbatim, para verificar y mostrar» que
promete [`01-vision.md:123`](01-vision.md), y cuyo tipo existe suelto en
`identidad.ts:146`.

Los dos tipos ya existen. Agregarlos hoy es una línea. Es `C5-P6`.

### 3.6 · El nombre humano del documento no está en ningún tipo

La fila `documento` de Postgres sí lo tiene («nombre original y tipo declarado»,
`borrador-pipeline-tecnico.md:203`), pero **`ir` no modela esa fila**:
`packages/ir/src/index.ts:31-67` no exporta ningún `Documento`, e `Ingesta` solo trae
un `DocumentoId` opaco.

**Sin esto no hay cita legible**, por más que todos los demás eslabones funcionen. Es
`C5-P7`.

### 3.7 · El ancla no es estable entre versiones — y falla en silencio

`packages/ir/src/ubicacion.ts:152-159`:

> «`ancla` es opaca, NO es identidad, **NO tiene garantía de estabilidad entre
> versiones**, y tiene que ser única dentro de (documento, adaptador) — es el único
> campo universal, **el único que hace posible la citación**.»

Un deep-link que un agente externo guarde **se pudre en la próxima re-ingesta**, sin
error: apunta a otro lado o a nada. Es `C5-P8`.

### 3.8 · La confianza numérica no llega al fragmento

`NodoCrudo.confianza: number | null` existe, y su comentario nombra al consumidor
(`salidas.ts:109-119`):

> «El umbral de citabilidad vive fuera de este pipeline (**capa de skills**), pero el
> campo tiene que nacer acá o no existe.»

`Fragmento` comprime `certeza` en `certezaMínima` (`:375`) pero **no** comprime
`confianza`. La promesa de `borrador-pipeline-tecnico.md:953-956` —que una skill pueda
decidir no citar como autoridad algo reconocido con confianza baja— **llega a esta capa
sin el número**. Es `C5-P9`.

---

## 4. El puente con la Capa 1: lo que sí recibe

| Necesidad de la Capa 5 | Lo que la cubre |
|---|---|
| «Sección Y» y filtro exacto por sección | `Fragmento.migas: readonly MigaEstable[]` (`salidas.ts:352`), con `Miga<Ref> = {ref, texto}` (`:160-168`). Lleva `ElementId` **además** del texto justamente para que un filtro guardado no deje de matchear cuando alguien renombra el título (`:144-152`) |
| Procedencia a nivel unidad | `Fragmento.nodos` — «sobrevive a que el fragmento se rearme» (`salidas.ts:354`) |
| «Esto lo dijo el CFO en marzo» | `Autoría = {actor, cuándo, fuente}` (`identidad.ts:382-387`), obligatoria en todo `Nodo` (`salidas.ts:127`) |
| Certeza que llega hasta la skill | `Fragmento.certezaMínima` (`salidas.ts:375`), + `NodoCrudo.nivel` y `atribución` (`:106-108`) |
| Cita encadenada (`contrato.pdf → pg3 → imagen`) | `Ubicación.dentroDe: readonly Ubicación[]` recursivo (`ubicacion.ts:180-184`) + `Nodo.delegación` (`salidas.ts:93`); `DelegacionId` nombra explícitamente «la cita encadenada» (`identidad.ts:148-167`) |
| Dedupe de resultados, que el tramo 7 exige (`borrador-pipeline-tecnico.md:2343`) | `FragmentoId` derivado de `(DocumentoId, huellaContextual)` (`identidad.ts:170-187`) |
| «¿Qué decía este contrato en marzo?» | `NodoEnVersión = {documento, versión, orden, nodo}`, que **se acumula, no se reemplaza** (`salidas.ts:323-336`, razón en `:316-321`) |
| No devolver contenido borrado con procedencia confiable | `SalidaDeEmisión.bajas` (`salidas.ts:258`, motivo en `:246-249`) |
| Tenant | `OrganizacionId` (`identidad.ts:140`) y `Ingesta.organización` (`salidas.ts:557`) — **existen**; el problema es de transporte, no de vocabulario (§3.3) |

---

## 5. Lo que este documento pedía y ya estaba decidido

**La distinción que importa acá: «decidido por contrato» no es «implementado».** Se
marcan por separado.

| Casilla del documento viejo | Estado |
|---|---|
| **«¿El MCP actual soporta múltiples organizaciones, o asume un solo tenant?»** (`12-...:61-62`) | **Decidido por contrato**: es multi-tenant, `organización` es campo obligatorio del envoltorio (`salidas.ts:557`) y «toda lectura posterior se filtra por acá» (`identidad.ts:139`). También está decidido **por qué no va adentro del nodo** (caché cross-org, `salidas.ts:544-552`). **Falta implementar**: el MCP legacy resuelve el bearer a `{connectionId, userId, label}` y **nunca a una organización** (`apps/legacy-api/src/modules/connections/connections.service.ts:118`); todo el fan-out es por usuario (`mcp.tools.ts:76-77`) |
| **«Contrato exacto, autenticación, rate limit, audit log»** (`12-...:24`) | **Implementado y transcribible.** Ver §1 |
| **«`browse`/`fetch` — qué resuelven que `savia_search` no resuelve»** (`12-...:36-40`) | **Decidido conceptualmente**: es la mitad **σ** del split π/σ, con vocabulario tipado (`Coordenada`/`SourceRange`, `ubicacion.ts:73-133`) y salida tipada (`Registro`, `salidas.ts:454-458`). **Falta**: su destino (§3.2) |
| **«Cómo se propaga la identidad de una IA/agente externo hasta el chokepoint»** (`12-...:42-44`) | **Implementado end-to-end**: `bearer → resolveToken → buildConnectionReadPlan → searchPartitions`, con clamp `granted ∩ requested` (`mcp.tools.ts:56-59`, `:71-77`). **Falta**: agregarle la dimensión organización |
| **«Confirmar el límite: Savia instruye, la empresa ejecuta»** (`12-...:53-57`) | **Respetado por construcción.** Ver §1.5 |
| **Filtrar por sección de forma exacta** | **Decidido**: la miga lleva `ref: ElementId` además del texto, para que el filtro guardado no deje de matchear «EN SILENCIO» cuando alguien renombra el título (`salidas.ts:144-152`). *Ojo:* la regla de normalización y truncado de ese texto **sigue abierta** (`salidas.ts:154-158`, `params.ts:280-289`, `largoMáximoDeMiga: null`) → `C5-P13` |
| **Adopción bottom-up** | [`13-adopcion-bottom-up.md:3`](../savia-b2b-legacy/13-adopcion-bottom-up.md) sigue **rotulado** «esqueleto pendiente» aunque ya tiene una decisión tomada y fechada **en el mismo archivo** (`:63-71`, los tres caminos de formalización habilitados). Es un rótulo desactualizado, no un hueco → `C5-P14` |

---

## 6. Puntos abiertos

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C5-P1** | **Variante temporal en `Coordenada`** (§3.1) — compartido con Capa 2 | Cambio de contrato en `ir`, hoy barato y después caro | Los doce adaptadores · video y audio |
| **C5-P2** | Dónde vive el **resolvedor de convenciones** que convierte `marco:"p3"` en «página 3», si el grafo de paquetes prohíbe consultarlo desde aguas abajo (§2.2) | Decisión de arquitectura | Legibilidad de toda cita |
| **C5-P3** | **Destino de los `Registro`**: tabla, clave, idempotencia y superficie de consulta (§3.2) — compartido con Capas 2 y 4 | Diseño del tramo 7 | `browse` / `fetch` |
| **C5-P4** | Filtro por **organización** en cada lectura, y dónde se garantiza que nadie se lo olvide (§3.3) | Diseño del tramo 7 + decisión de Capa 3 | Aislamiento entre tenants |
| **C5-P5** | Punto de lectura de anotaciones, para que exclusión y sensibilidad se apliquen (§3.4) | Diseño del tramo 6/7 + política de Capa 3 | Qué se puede devolver |
| **C5-P6** | `HashBytes` y `ClaveObjeto` en `Ingesta` (§3.5) | Cambio de contrato en `ir`, hoy barato | Cita completa · verificación |
| **C5-P7** | Un tipo que modele la **fila `documento`** con su nombre legible (§3.6) | Diseño del tramo 7 | Cita legible |
| **C5-P8** | Estabilidad del `ancla` entre versiones, o una alternativa para deep-links guardados (§3.7) | Decisión de contrato | Enlaces externos |
| **C5-P9** | `confianza` numérica en `Fragmento` (§3.8) | Cambio de contrato en `ir` | Umbral de citabilidad |
| **C5-P10** | **Catálogo de skills** como `resources/list` + `resources/read`, y su diseño concreto (`12-...:28-30`) | Decisión de producto; depende de que Capa 4 defina qué es un skill | Superficie MCP |
| **C5-P11** | **Progressive disclosure**: cómo el agente consumidor decide cuándo pedir el contenido completo (`12-...:31-32`) | Decisión de producto | Costo de contexto |
| **C5-P12** | **Meta-tool dispatcher** `savia_find_skill`: ¿día 1, o cuando el catálogo crezca? (`12-...:33-34`) | Decisión de producto | Superficie MCP |
| **C5-P13** | Regla de **normalización y truncado** del texto de la miga; `largoMáximoDeMiga` está en `null` (`params.ts:280-289`) | Medición sobre corpus real | Filtro por sección |
| **C5-P14** | Rótulo desactualizado de [`13-adopcion-bottom-up.md`](../savia-b2b-legacy/13-adopcion-bottom-up.md) (§5) | Escritura | Claridad documental |
| **C5-P15** | **BYO-LLM**: qué es técnicamente «una conexión org-level» — ¿API key por organización, config MCP compartido, otra cosa? (`12-...:48-51`) | Decisión de producto + técnica | Modelo de conexión |
| **C5-P16** | **Gobernanza a nivel de skill**: quién puede invocar qué proceso ([`01-vision.md:184-185`](01-vision.md)) | Decisión de Capa 3 | Permisos |
| **C5-P17** | **Audit de acciones derivadas** de un skill (`12-...:45-46`) | Diseño; hoy el audit cubre solo MCP y purgas | Compliance |
| **C5-P18** | Dónde vive la **política de umbral de citabilidad** por confianza — el contrato la tira explícitamente a «capa de skills», y ahí no hay nadie todavía (`salidas.ts:115-117`) | Decisión de producto | Calidad de citas |
| **C5-P19** | Si el catálogo de skills es **pantalla nueva** o una vista dentro de «Memoria» (`14-superficies-de-producto.md:51-52`) | Decisión de producto | Frontend |
| **C5-P20** | Qué devuelve la búsqueda cuando **conviven dos versiones** del mismo documento con anclaje bajo: hoy quedan las dos indexadas y salen duplicados. El plan lo clasifica «Tramo 1» pero escribe «es producto, no pipeline» (**P9**, `borrador-pipeline-tecnico.md:1959`) | Decisión de producto | Calidad de resultados |
| **C5-P21** | **Offboarding**: qué memoria retiene la organización cuando alguien se va (`13-adopcion-bottom-up.md:48-53`) | Decisión de producto + Capa 3 | Retención · confianza |

---

## Decisiones tomadas

**Vacío. No se tomó ninguna decisión al escribir este borrador, y es a propósito:**
su función es consolidar lo que ya se sabe y numerar lo que falta, para que el equipo
decida después.

Lo que aparece en las secciones 1 y 5 son decisiones tomadas **en otro lado** —en el
contrato `packages/ir`, o en la implementación del MCP en `apps/legacy-api`— y siguen
perteneciendo a esos lugares.

| Fecha | Decisión | Punto que cierra |
|---|---|---|
| — | — | — |
