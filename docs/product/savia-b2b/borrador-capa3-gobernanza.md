# Borrador — Capa 3: Gobernanza

> **Documento de trabajo, 2026-08-10.** Consolida lo que hoy se sabe sobre la
> capa de gobernanza para que el equipo itere encima. **Acá no se decide nada:**
> lo que está decidido se cita con `archivo:línea`, lo que no lo está va como
> punto abierto numerado (`C3-P1` … `C3-P18`), y donde hay caminos posibles se
> listan todos sin recomendar ninguno.
>
> Reemplaza a [`08-capa3-gobernanza-modelo.md`](../savia-b2b-legacy/08-capa3-gobernanza-modelo.md)
> y [`09-capa3-gobernanza-implementacion-tecnica.md`](../savia-b2b-legacy/09-capa3-gobernanza-implementacion-tecnica.md),
> los dos en estado de esqueleto.
>
> **Lo que NO es:** ni un diseño del schema de organización, ni una propuesta de
> política de sensibilidad, ni un plan de implementación. La sección 1 es grande
> a propósito porque esta capa tiene mucho más decidido de lo que su documento
> anterior admitía; la sección 3 es la que hay que leer primero si solo se lee una.

---

## 0. De dónde sale este borrador

Tres insumos, en este orden:

1. **La lectura cruzada de capas** ([`lectura-cruzada-capas-2026-08-10.md`](lectura-cruzada-capas-2026-08-10.md)),
   donde cuatro lectores independientes —uno por capa— buscaron lo que su capa
   necesita de la Capa 1 y la Capa 1 no produce. Dos de sus ocho hallazgos
   convergentes caen acá: **H2** (nadie lee las anotaciones) y **H3** (la
   organización no viaja con el dato).
2. **El código congelado de `apps/legacy-api`**, que es donde la gobernanza a
   nivel personal ya está construida, auditada y ratificada. Cuando este
   documento cita legacy está describiendo **la implementación actual**, que se
   reintegra al B2B nuevo como **diseño validado, nunca copy-paste** — la regla
   del monorepo para todo lo congelado el 2026-07-29.
3. **Las decisiones de producto ya fechadas** de
   [`03-personas-y-roles.md`](03-personas-y-roles.md) y
   [`02-glosario-y-entidades.md`](02-glosario-y-entidades.md), que cierran
   casillas que el documento viejo de esta capa todavía tenía abiertas.

La forma sigue la de [`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md).

---

## 1. Lo que ya está decidido y funcionando

El documento anterior abría esta capa preguntando cosas que ya tienen respuesta
escrita, ratificada y localizable en el código. Esta sección es el inventario.

### 1.1 · Las siete reglas de acceso

Están escritas y **ratificadas el 2026-07-07** en
`docs/audit/backend/2026-06-27/ACCESS-PRIVACY-RULES.md:16-42`, que se declara a sí
mismo fuente única y reemplaza a la prosa dispersa anterior (`:5-6`).

| Regla | Qué dice | Dónde vive |
|---|---|---|
| **R1 · Default-deny** | Sin grants, no-miembro o fragmentos vacíos → no se lee nada | `ACCESS-PRIVACY-RULES.md:18-19`; `compileReadPlan([], …)` colapsa a "nada" (`apps/legacy-api/src/modules/access/read-plan.ts:20`) |
| **R2 · Mutación author-only** | Solo el autor muta su memoria o su área | `:20-21`; `AccessService.assertCanMutateMemory` / `assertCanManageSpace` / `assertOwnsConnection` |
| **R3 · El clamp solo angosta** | Las áreas pedidas por el lector intersectan, nunca ensanchan | `:22-24`; `predicate = P.and(predicate, P.areaIdsAny(requested))` en `read-plan.ts:59` |
| **R4 · Sensibilidad = opt-in del DUEÑO** | Marca privada global. En áreas propias decide el grant del lector; en fragmentos de grupo decide **el dueño del fragmento**, y el lector nunca la levanta | `:25-31`; `fragmentScope` en `apps/legacy-api/src/modules/access/scope-predicate.provider.ts:27-30`; el corte fino en `:59-63` |
| **R5 · Subárbol por ancestros, no hermanos** | La membresía carga sus ancestros al escribir, así un grant a un área ve descendientes pero no hermanos | `:32-34`; faceta `savia_area_ids` (`apps/legacy-api/src/common/adapters/qdrant.connection.ts:13`) |
| **R6 · Grupo = unión viva** | La membresía se re-chequea **al leer**; un `FragmentShare` huérfano nunca alimenta la vista | `:35-37`; `resolveFragments` cruza `FragmentShare` con `GroupMember` en `apps/legacy-api/src/modules/access/group-scope.resolver.ts:28-32` |
| **R7 · Un chokepoint + una autoridad** | Toda lectura pasa por `VectorStorePort`; toda lectura cross-boundary compila en `compileReadPlan`. Cero predicados a mano | `:38-42` |

La matriz completa lector × dato → regla está en `ACCESS-PRIVACY-RULES.md:44-54`, y
el inventario de construcción de predicados —incluidos los dos writes match-all
auditados como seguros— en `:94-114`.

### 1.2 · El chokepoint, con ubicación exacta

`09-...:27-28` preguntaba dónde vive el chokepoint. La respuesta es una cadena de
cuatro eslabones, cada uno con una única casa:

| Eslabón | Archivo | Qué es |
|---|---|---|
| **Vocabulario puro** | `apps/legacy-api/src/common/ports/predicate.ts:16-24` | `AccessPredicate`, un AST de **ocho** nodos: `areaIdsAny`, `author`, `entitiesAny`, `sensitivityNormal`, `notSuperseded`, `and`, `or`, `denyAll` |
| **Compilación (las reglas)** | `apps/legacy-api/src/modules/access/read-plan.ts:33` (`compileReadPlan`) | «La única casa de toda frontera de lectura cross-boundary»; R1–R5 aplicadas una sola vez (`:16-31`). Grants → `ReadPartition[]`, una partición `{ownerUserId, predicate}` por dueño |
| **Autoridad (orquesta DB → reglas)** | `apps/legacy-api/src/modules/access/access.service.ts:15` | `buildConnectionReadPlan` (`:31`) y `buildGroupReadPlan`; una conexión revocada devuelve `[]` — default-deny explícito (`:35`) |
| **Ejecución (fan-out único)** | `apps/legacy-api/src/modules/memory/cross-boundary-read.service.ts:29` | `searchPartitions`: busca cada partición en la partición de SU dueño, mergea y deduplica |
| **Aplicación (único punto)** | `apps/legacy-api/src/common/adapters/vector-store.qdrant.adapter.ts:11` | Único importador de `compilePredicate` |
| **Dialecto** | `apps/legacy-api/src/common/adapters/qdrant-filter.ts:21` | «El ÚNICO lugar que conoce el dialecto de filtros de Qdrant» (`:19`) |

Las dos fronteras de entrada están inventariadas (`ACCESS-PRIVACY-RULES.md:87-92`):
conexión/MCP y vista de grupo. Ambas por `compileReadPlan` + `searchPartitions`.

### 1.3 · El modelo de `Grant` / `Scope`

`09-...:29-30` preguntaba por campos, creación y revocación. Está en
`apps/legacy-api/prisma/schema.prisma:437-450`:

- `scope` polimórfico `space | group`, con `spaceId` / `groupId` y un CHECK de
  exactly-one más un UNIQUE parcial por target (`:435-436`).
- `includeSensitive: Boolean @default(false)` (`:446`).
- Revocación por `Connection.revokedAt` (`:423`), leída en `access.service.ts:31-35`.
- **No hay `canWrite`**, y es una decisión de producto documentada en el propio
  schema: la escritura (`savia_remember`) nunca se restringe por conexión, solo la
  lectura está scoped por grant (`:431-434`). Tampoco hay `expiresAt`.

El opt-in del dueño para fragmentos de grupo vive en una columna aparte,
`FragmentShare.includeSensitive` (`:490`), con su razón escrita en `:478-480`.

### 1.4 · Propagación de identidad del caller

`09-...:31-32`. Dos caminos, según la frontera:

- **Sesión humana**: guard global default-deny, `apps/legacy-api/src/modules/auth/guards/jwt-auth.guard.ts:15` —
  «toda ruta requiere una cookie de acceso válida salvo que esté marcada
  `@Public()`» (`:10-14`), y el payload del JWT es `{sub, email, jti}`
  (`apps/legacy-api/src/modules/auth/decorators/current-user.decorator.ts:3-7`).
- **Agente / MCP**: `apps/legacy-api/src/modules/connections/grants.cache.ts:4-13`
  mapea token → `{connectionId, userId, label}` con TTL de 60 segundos, y
  **cachea solo esa resolución**: «el filtro de acceso se reconstruye fresco en
  cada llamada» (`:5-8`). El plan de acceso nunca se cachea.

Esto es exactamente lo que [`03-personas-y-roles.md:50-58`](03-personas-y-roles.md)
pide para el agente: identidad propia, no operar "como" el humano que lo
configuró, gobernanza y auditoría **por-invocador**.

### 1.5 · La sensibilidad: cómo se marca hoy

`08-...:30`. Marcado: `setSensitivity()` en
`apps/legacy-api/src/modules/kernel/memory-mutation.service.ts:126`, que dentro de
una sola transacción actualiza `MemoryIndex.sensitivity`, encola un `set_payload`
al outbox y escribe un `MemoryEvent action:'sensitivity'` **reversible con el valor
previo** (`:145-151`). Efecto: `scope-predicate.provider.ts:29` y `:62`.

Modelo del dato en legacy: **binario y por memoria entera** — `enum Sensitivity
{normal, sensitive}` (`schema.prisma:30-33`) y `MemoryIndex.sensitivity`
(`schema.prisma:244`), proyectado a la faceta `savia_sensitivity`
(`qdrant.connection.ts:15`).

### 1.6 · Lo que las decisiones de producto ya cerraron

Tres casillas del documento viejo las cierra
[`03-personas-y-roles.md`](03-personas-y-roles.md) y
[`02-glosario-y-entidades.md`](02-glosario-y-entidades.md), no el código:

| Casilla del doc viejo | Con qué se cierra |
|---|---|
| `08-...:33-34` — catálogo de roles de organización | **Dos roles formales** (Administradora, Miembro) más **capacidades delegables**, decidido el 2026-07-29 ([`03-personas-y-roles.md:70-86`](03-personas-y-roles.md), decisión en `:119-120`). La razón está escrita: agregar granularidad después es fácil, quitar un rol que la gente ya usa no (`:82-86`) |
| `08-...:35-38` — ¿la memoria personal se hereda a la organización? | **No hay herencia por default.** Toda memoria cuelga de un `User` sin excepción ([`02-glosario-y-entidades.md:18`](02-glosario-y-entidades.md), `:24-28`); la organización posee memoria **vía su usuario raíz** (`:81-84`); un `Team` no es dueño de nada, comparte «una vista gobernada» (`:64-66`). Del lado del código, R1 default-deny ya lo implementa |
| `08-...:39-40` — fronteras entre equipos | El `Team` es «el único mecanismo de agrupación de personas por debajo de la organización» (`02-glosario-y-entidades.md:59-62`); la implementación validada es `CollectiveGroup` + `GroupMember` + `FragmentShare` con re-chequeo de membresía viva al leer (R6, `group-scope.resolver.ts:28`) |

Vale registrar también que la aprobación humana de un `Skill` antes de publicarse
ya está decidida y es una capacidad delegable
([`03-personas-y-roles.md:88-103`](03-personas-y-roles.md), decisión en `:121-122`) —
es una pieza de gobernanza aunque su mecanismo lo defina la Capa 4.

### 1.7 · El audit log existe, y su cobertura real es acotada

`09-...:42-43` preguntaba «qué se registra hoy, si ya existe». **Existe.**
`AccessLog` en `apps/legacy-api/prisma/schema.prisma:540-548`:

- `connectionId`, `action`, `spaceIds: String[]`, `queryDigest`, `resultCount`,
  `createdAt`.
- `queryDigest` es **SHA-256, nunca el texto** — comentado como tal en el schema
  (`:545`).
- Decoupled a propósito (sin FK): «el log sobrevive al borrado de la conexión»
  (`:539`).

Se escribe en dos lugares, y en los dos **fail-loud**:

- Frontera MCP: `apps/legacy-api/src/modules/mcp/mcp.tools.ts:79-87` para
  `savia_search` («la auditoría es parte de la operación: awaited, fail-loud, sin
  catch silencioso», `:78`) y `:112-113` para `savia_remember`.
- Purgas: `apps/legacy-api/src/modules/outbox/vector-gc.ts:71-73`, dentro de la
  misma transacción que el borrado, porque «cada purga se loguea» es una garantía
  de la clase, no best-effort (`:65-69`).

Retención: 90 días, `apps/legacy-api/src/modules/retention/retention.worker.ts:32`.

**El límite honesto:** la cobertura real es **solo MCP y purgas**. Lo que
`09-...:44-45` pide para auditoría enterprise —quién vio qué memoria por cualquier
camino, quién ejecutó qué skill— **no está cubierto**: las lecturas humanas (la
vista de grupo, la búsqueda propia) no dejan fila, y `Skill` todavía no existe
como entidad. Eso es → **C3-P18**.

### 1.8 · Lo que verifiqué que NO es un hueco

**No hay concepto de área / espacio / `Space` en `packages/ir/src/`, y está bien que
no lo haya.** El `Space` lo produce el motor de clustering, no el pipeline de
ingesta ([`02-glosario-y-entidades.md:75-79`](02-glosario-y-entidades.md)). Queda
registrado en positivo para que nadie lo "arregle" agregándolo al contrato.

Con una consecuencia que sí importa para esta capa: en la implementación actual el
`Grant` se ancla al `spaceId` (`schema.prisma:441-442`), o sea que **la unidad de
compartición es el área** — algo que la Capa 1 no toca y que quien diseñe el
modelo nuevo tiene que decidir de nuevo (→ **C3-P9**).

Corrección de premisa, además: el contrato `packages/ir` **ya tiene un
dependiente**, no cero — `packages/emision/package.json:21`. La ventana para
cambios baratos sigue abierta pero empezó a cerrarse.

---

## 2. El puente con la Capa 1: lo que la gobernanza SÍ recibe

Antes de los huecos, el inventario de lo que el contrato de ingesta ya entrega y
esta capa no tuvo que pedir.

| Necesidad de gobernanza | Qué la cubre en `packages/ir` | Nota |
|---|---|---|
| Tenant por documento | `Ingesta.organización: OrganizacionId` (`packages/ir/src/salidas.ts:566`) **y** `Ingesta.dueño: ActorId` | Los dos juntos cubren a la persona que está en varias organizaciones ([`03-personas-y-roles.md:23-25`](03-personas-y-roles.md)). Legacy no tiene nada equivalente: cero `orgId`/`tenantId` en `schema.prisma`, y el JWT solo lleva `{sub, email, jti}` |
| Usuario raíz como dueño de la memoria de organización | `ActorId` es «SIEMPRE un usuario de Savia… para conectores de organización, el usuario raíz» (`packages/ir/src/identidad.ts:130-131`) | Calcado del glosario (`02-glosario-y-entidades.md:81-84`) |
| Procedencia para decidir acceso | `Ingesta.documento: DocumentoId` (`salidas.ts:565`); `Fragmento.nodos`, que «sobrevive a que el fragmento se rearme» (`salidas.ts:356-357`); `Ubicación` con `dentroDe` recursivo (`packages/ir/src/ubicacion.ts:180-184`) | Permite la cita encadenada tipo «imagen dentro de la página 3» |
| Política por canal | `Ingesta.canal` ∈ `chat \| frontend \| carpeta \| conector` (`salidas.ts:572`) | Una política distinta por canal es expresable sin tipos nuevos |
| «Esto lo dijo el CFO en marzo» | `Autoría {actor, cuándo, fuente}`, obligatoria en todo nodo (`identidad.ts:382-387`) | **Caveat:** para material importado el `actor` es el subidor, y la atribución real del documento viaja como string libre en `fuente` (`identidad.ts:126-137`) |
| Borrado / revocación efectiva | `SalidaDeEmisión.bajas: readonly ElementId[]` (`salidas.ts:259`) | Existe porque «sin eso el índice acumula contenido borrado que sigue siendo recuperable con procedencia confiable» (`salidas.ts:247-250`) |
| Que el caché multi-tenant no filtre autoría | `NodoCrudo` sin `Autoría` (`salidas.ts:57-64`) + el envoltorio `Ingesta` separado (`salidas.ts:542-552`) | Resuelto explícitamente: si la autoría viajara dentro del árbol cacheado se propagaría la del primer subidor a otro tenant (`identidad.ts:378-383`) |
| No citar como autoridad algo de confianza baja | `NodoCrudo.confianza` (`salidas.ts:109-119`) y `Fragmento.certezaMínima` (`salidas.ts:375`) | La certeza «viaja con el nodo… y LLEGA HASTA LA SKILL» (`salidas.ts:362-375`) |
| Curación humana que sobrevive a la re-ingesta | `Anotación` con `origen` obligatorio y clave de dedupe `(nodo, anotador, clase, rango)` (`salidas.ts:493-521`) | **Caveat grande:** nadie declara leerlas → sección 3 |

---

## 3. El hueco que puede filtrar datos

**Este es el primero de la lista y va solo en su sección.** Es el hallazgo **H2**
de la lectura cruzada, el único que encontraron **las cuatro capas por separado**,
y el único de esta lista que no se arregla después.

### 3.1 · El contrato declara el agujero y dice que no lo puede cerrar

En el pipeline nuevo la sensibilidad no es una columna: es una **`Anotación`
colgada de un `ElementId`**. Así lo fija R3 en
[`borrador-pipeline-tecnico.md:123-130`](borrador-pipeline-tecnico.md) —
«las anotaciones —sensibilidad, exclusiones, curación humana, conclusiones de
Savia— son lo que Savia concluyó o una persona decidió», y viven en Postgres
ancladas al identificador estable del tramo 4. El tipo está en
`packages/ir/src/salidas.ts:516-521`.

El problema lo escribe el propio contrato, textualmente, en
`packages/ir/src/salidas.ts:509-513`:

> «SIGUE ABIERTO Y `ir` **NO LO PUEDE RESOLVER** (auditoría #17): **ningún tramo
> declara LEER anotaciones**. Las exclusiones y la sensibilidad (§R3) solo
> significan algo si alguien se niega a indexar; sin punto de lectura, contenido
> marcado como excluido llega al índice — y **el tramo 6 es donde el texto SALE
> hacia una API de terceros**.»

Y no hay ningún campo tipado alternativo: ni `Fragmento` (`salidas.ts:350-376`), ni
`Vector` (`:429-...`), ni `Registro` (`:460-464`), ni `NodoEmitido` llevan
sensibilidad. El único enganche posible es `AnotaciónPropuesta.clase: string`
(`salidas.ts:475`), que es abierta a propósito.

### 3.2 · Es una regresión respecto de lo ya construido

No es una capacidad que falte por ser nueva: **hoy funciona y el pipeline nuevo la
pierde**. Existen `MemoryIndex.sensitivity` (`apps/legacy-api/prisma/schema.prisma:244`),
la faceta indexada `savia_sensitivity` (`apps/legacy-api/src/common/adapters/qdrant.connection.ts:15`),
el nodo `sensitivityNormal` del AST (`apps/legacy-api/src/common/ports/predicate.ts:20`)
y su traducción a Qdrant (`apps/legacy-api/src/common/adapters/qdrant-filter.ts:30-31`).

El pipeline nuevo **no emite nada que pueda alimentarlos**. Si se implementa tal
como está el contrato, la R4 —la regla más delicada de las siete, la que se
reescribió entera en la estandarización del 2026-07-07
(`ACCESS-PRIVACY-RULES.md:118-122`)— queda sin dato de entrada.

### 3.3 · El desajuste de granularidad que nadie decidió

Hay un segundo problema, independiente del primero y que sobrevive aunque se
resuelva el punto de lectura: **la marca es por nodo y la unidad recuperable es el
`Fragmento`, que agrupa N nodos** (`packages/ir/src/salidas.ts:356-357`).

Un fragmento con un nodo sensible y cuatro normales **no tiene cómo declararse
sensible**. Y el precedente exacto de cómo se resuelve una agregación así ya
existe en el mismo tipo: `certezaMínima` es «la PEOR certeza de los nodos
agrupados», elegida porque «el mínimo es monótono» (`salidas.ts:361-375`). Para
sensibilidad **no hay análogo**.

En legacy el problema no se presenta porque la sensibilidad es por memoria entera y
binaria (`schema.prisma:30-33`, `:244`). El modelo nuevo tiene una unidad más que
legacy no tenía.

### 3.4 · Por qué es el más caro de toda la lista

Todos los demás ítems de esta capa son, en el peor caso, «agregar una columna y
re-ingestar». Este no.

Una vez que el texto marcado como sensible **se embebió contra un proveedor externo
y quedó indexado**, ningún cambio de schema deshace la filtración: ya salió, en
silencio, y quedó guardada con procedencia perfecta para que cualquiera la
recupere después. El tramo 6 es una llamada a una API de terceros
(`salidas.ts:512-513`), y el tramo 7 —donde caería el filtro— **está sin diseñar**
([`borrador-pipeline-tecnico.md:2339`](borrador-pipeline-tecnico.md), nueve líneas).

Esto se parte en tres decisiones distintas, con dueños distintos:

- **C3-P1** — la agregación a nivel `Fragmento` (cambio de contrato en `packages/ir`).
- **C3-P2** — el punto de lectura de anotaciones (lo decide la Capa 1, tramo 6/7;
  esta capa es quien lo necesita).
- **C3-P3** — la política: qué se marca, con qué efecto, y si sigue siendo binaria.

---

## 4. Lo demás que la Capa 1 no le da

Ordenado por **costo de resolverlo tarde**, de mayor a menor. La columna que
decide qué urge es la última: un cambio de contrato en `packages/ir` es hoy una
línea, y con tres paquetes encima es una migración.

### 4.1 · El índice de reconciliación no lleva organización — **cambia el contrato**

`NodoConocido` (`packages/ir/src/salidas.ts:285-302`) y `NodoEnVersión`
(`salidas.ts:327-340`) no tienen `OrganizacionId`. El índice se lee **al revés**
(`hash → documento`) para elegir contra qué versión reconciliar cuando el canal no
trae un id estable (`salidas.ts:289-294`). La prosa acota esa consulta a la
organización —«se consulta qué documento **de la organización** comparte más nodos
distintivos» ([`borrador-pipeline-tecnico.md:315`](borrador-pipeline-tecnico.md))—
pero **el tipo no lo lleva**.

Sin filtro, un documento de la org A puede elegirse como «versión anterior» de uno
de la org B, y con eso se **transfieren `ElementId`**, que son el ancla de toda la
curación y de todas las anotaciones — sensibilidad incluida.

Es la manifestación concreta de **P12**
([`borrador-pipeline-tecnico.md:1962`](borrador-pipeline-tecnico.md);
`packages/ir/src/identidad.ts:91-95`): «con unicidad global el id NO lleva su
organización adentro, así que la separación entre tenants queda **enteramente en el
filtro de lectura**, o sea en una garantía de runtime que hay que acordarse de
aplicar en cada consulta».

**Es la consulta más fácil de olvidar precisamente porque no parece una lectura de
usuario.** → **C3-P5**.

### 4.2 · La anotación no dice qué humano la hizo — **cambia el contrato**

`Anotación` lleva `clase`, `rango`, `valor`, `nodo`, `anotador: string`,
`origen: "automática" | "humana"` y `creadaEn`
(`packages/ir/src/salidas.ts:516-521`). **No hay `ActorId`.** Distingue máquina de
humano; no distingue **qué** humano.

Choca de frente con dos cosas ya escritas: R4 dice que la sensibilidad es «opt-in
del **DUEÑO**» (`ACCESS-PRIVACY-RULES.md:25`), que es una afirmación sobre un actor
concreto; y `09-...:44-45` pide audit de «quién vio qué memoria, quién ejecutó qué
skill, con qué identidad de caller MCP». Legacy sí lo registra —el `MemoryEvent
action:'sensitivity'` guarda usuario y valor previo, y es reversible
(`memory-mutation.service.ts:145-151`).

**Quién marcó qué no se reconstruye a posteriori.** → **C3-P4**.

### 4.3 · El payload del vector, única superficie donde hoy se aplica el acceso, no tiene tipo

`09-...:27-28` preguntaba si el chokepoint es query-time filtering sobre
Postgres/Qdrant. En legacy **sí**: el filtro se traduce a cinco claves de payload
—`savia_area_ids`, `user_id`, `savia_sensitivity`, `savia_superseded`,
`savia_entities`— en `apps/legacy-api/src/common/adapters/qdrant-filter.ts:21-40`,
sobre el vocabulario de `qdrant.connection.ts:12-19`.

En el contrato nuevo, `Vector` tiene cuatro campos y **ninguna faceta**
(`packages/ir/src/salidas.ts:429-...`). El payload aparece solo en prosa —el único
campo especificado es la miga
([`borrador-pipeline-tecnico.md:2145-2146`](borrador-pipeline-tecnico.md))— y el
tramo que lo produciría está sin diseñar (`:2339`). El propio contrato dice que el
tramo 7 necesita `organización` en el payload, «sin la cual la búsqueda vectorial es
cross-tenant por defecto» (`salidas.ts:553-556`), y **nada tipa esa proyección**.

**¿Cambia el contrato?** Depende de dónde se decida que vive el payload. La regla
del paquete es explícita: «si hace falta un tipo nuevo, se agrega ACÁ y es un
cambio de contrato, visible como tal en el diff»
(`packages/ir/src/index.ts:8-10`). Dejarlo afuera significa que **cada consumidor
fija por su cuenta el conjunto de facetas gobernables**. → **C3-P6**.

### 4.4 · El caché de reconocimiento cruza organizaciones por diseño, y el interruptor per-org no existe — **no cambia el contrato**

`ClaveDeCache = sha256(hashBytes ‖ idAdaptador ‖ versiónDelAdaptador ‖
versiónDelModelo?)`, **sin organización** (`packages/ir/src/identidad.ts:326-329`).
Es deliberado y está defendido tres veces en el paquete
(`identidad.ts:378-383`, `salidas.ts:57-64`, `salidas.ts:546-552`): meter la
organización adentro «envenena el caché de reconocimiento, que cruza organizaciones
POR DISEÑO» y tira abajo la optimización insignia.

El borrador promete que «es **configurable por organización**, porque habrá
clientes que lo objeten por principio»
([`borrador-pipeline-tecnico.md:348`](borrador-pipeline-tecnico.md)). **Ese
interruptor no existe** en ningún tipo ni en `PARAMETROS`
(`packages/ir/src/params.ts`).

No obliga a cambio de contrato: `Contexto.invocar(clave: string, …)` acepta
cualquier clave. El riesgo es distinto — que la decisión quede **enterrada en la
orquestación**, sin dueño ni superficie donde configurarla. → **C3-P7**.

### 4.5 · `factorDeSobreFetch` está dimensionado para el dedupe, no para la poda del acceso — **no cambia el contrato**

`packages/ir/src/params.ts:324-332` justifica el sobre-fetch **solo** por el colapso
de las N ventanas de un mismo fragmento: «que un top-10 no quede en 3 resultados
después del dedupe».

En legacy el sobre-fetch existe por **la otra razón**: `const OVERFETCH = 5; //
pull more candidates than limit since access filtering prunes`
(`apps/legacy-api/src/modules/memory/memory.service.ts:15`, aplicado en `:129`).

Son **dos encogimientos independientes que se multiplican** y hoy solo uno está
contemplado en el parámetro. El costo es de calidad de resultados, no de
corrección. → **C3-P8**.

---

## 5. Puntos abiertos

Numerados `C3-Pn` para que se puedan citar desde otros documentos. Los ocho
primeros salen de la lectura cruzada; del noveno en adelante son los que el
documento anterior de esta capa ya tenía abiertos y siguen sin decidir.

| # | Punto | Qué lo destraba | Dónde impacta |
|---|---|---|---|
| **C3-P1** | **Cómo se agrega la sensibilidad al `Fragmento`.** La marca es por nodo (`salidas.ts:516-521`), la unidad recuperable agrupa N nodos (`:356-357`). Opciones visibles: (a) «el máximo», calcado de `certezaMínima` (`:361-375`) — un nodo sensible vuelve sensible al fragmento; (b) el fragmentador no agrupa nodos de sensibilidad distinta; (c) join por `nodos` en el tramo 7, sin campo nuevo | Una decisión de contrato en `packages/ir`, con la contra de (c) escrita ya en el propio tipo: «la promesa depende de una consulta que nadie declaró» (`:369-372`) | Contrato `ir` · tramos 5, 6 y 7 |
| **C3-P2** | **Quién lee las anotaciones y se niega a indexar.** Ningún tramo lo declara; `ir` dice que no lo puede resolver (`salidas.ts:509-513`) | Lo decide la Capa 1 al diseñar el tramo 7 ([`borrador-pipeline-tecnico.md:2339`](borrador-pipeline-tecnico.md)); esta capa es quien lo necesita y quien define el efecto | Tramos 6 y 7 · toda la R4 |
| **C3-P3** | **La política de sensibilidad en el modelo nuevo:** qué se marca, con qué efecto, y si sigue siendo binaria (`normal \| sensitive`, como `schema.prisma:30-33`) o gana niveles/etiquetas. Hoy `AnotaciónPropuesta.clase` es abierta (`salidas.ts:475`) y admite cualquiera de las dos | Definir el catálogo de clases de anotación de gobernanza y su semántica en el filtro | Contrato `ir` · chokepoint |
| **C3-P4** | **`Anotación.actor: ActorId`.** El tipo distingue máquina de humano pero no qué humano (`salidas.ts:516-521`); R4 es una afirmación sobre el dueño (`ACCESS-PRIVACY-RULES.md:25`) | Un campo. Hoy `packages/ir` tiene un solo dependiente (`packages/emision/package.json:21`) | Contrato `ir` · audit · R4 |
| **C3-P5** | **`NodoEnVersión.organización`.** La consulta `hash → documento` puede cruzar tenants y transferir `ElementId` (`salidas.ts:289-294`, `:327-340`) | Un campo, más la decisión de si la consulta se acota por tipo o por convención de la orquestación | Contrato `ir` · tramo 4 · **P12** |
| **C3-P6** | **Dónde vive el payload gobernable del vector y quién lo tipa.** `Vector` no tiene facetas (`salidas.ts:429-...`); legacy filtra sobre cinco claves (`qdrant-filter.ts:21-40`). Opciones visibles: (a) tipo nuevo en `ir` (cambio de contrato, `index.ts:8-10`); (b) tipo en el paquete de persistencia; (c) que cada consumidor lo fije | Diseñar el tramo 7, que es donde el payload se escribe | Contrato `ir` o tramo 7 · chokepoint |
| **C3-P7** | **El interruptor per-organización del caché de reconocimiento.** Prometido en prosa (`borrador:348`), inexistente en tipos y en `PARAMETROS` (`params.ts`) | Decidir si es un parámetro del pipeline, una columna de `Organization`, o una política de la capa de gobernanza | Orquestación · `PARAMETROS` |
| **C3-P8** | **`factorDeSobreFetch` contempla solo el dedupe, no la poda del filtro de acceso.** (`params.ts:324-332` vs. `memory.service.ts:15`) | Medir las dos distribuciones: ventanas por fragmento **y** tasa de poda del predicado | `PARAMETROS` · calidad de búsqueda |
| **C3-P9** | **Cuál es el sujeto del permiso en el modelo nuevo.** Hoy la unidad de acceso es la memoria entera y el `Grant` se ancla al `spaceId` (`schema.prisma:441-442`); el pipeline produce nodo → fragmento → vector | Depende de H1 (la unidad de memoria), que decide la Capa 2 con voto de Capa 4 ([`lectura-cruzada-capas-2026-08-10.md`](lectura-cruzada-capas-2026-08-10.md)) | Modelo de `Grant` · chokepoint |
| **C3-P10** | **Qué cambia en el schema para roles de organización sin romper el modelo personal, y cómo se implementa la no-herencia a nivel de query** (`09-...:35-40`). Hoy **no existe** `Organization` ni `orgId` ni en el schema ni en el JWT (`current-user.decorator.ts:3-7`); el contrato nuevo sí lleva `Ingesta.organización` (`salidas.ts:566`). Opciones que el propio doc viejo enumera: joins adicionales, columna de organización en cada tabla relevante, row-level security de Postgres | Los roles ya están decididos ([`03-personas-y-roles.md:119-120`](03-personas-y-roles.md)); falta el mecanismo. Conviene resolverlo junto con la multi-tenencia técnica que la Capa 2 tiene abierta (`07-...:56-62`: ¿colección por org o payload filtering?; hoy `is_tenant:true` sobre `user_id` es **solo performance**, no frontera — `qdrant.connection.ts:84-91`) | `schema.prisma` · JWT · chokepoint |
| **C3-P11** | **¿La gobernanza es el mismo mecanismo para «ver una memoria» y para «ejecutar un skill», o dos sistemas de permisos?** (`08-...:51-52`) | Decisión de producto; depende de qué forma tenga un `Skill` como dato (Capa 4) | Modelo de permisos completo |
| **C3-P12** | **Gobernanza del skill: ¿hereda los permisos de sus fuentes, o tiene gobernanza propia definida al publicarse?** (`08-...:43-44`). El glosario empuja hacia «propia» —«su gobernanza es propia (quién puede invocarlo), no heredada de un dueño único» ([`02-glosario-y-entidades.md:92-94`](02-glosario-y-entidades.md))— pero no está decidido | Escribirlo como decisión fechada en el doc de Capa 4 o acá | Capa 4 · Capa 5 |
| **C3-P13** | **Caso borde: alguien sin permiso sobre la fuente original con permiso para ejecutar el skill derivado** (`08-...:45-47`) | Depende de C3-P12 | Capa 4 · Capa 5 |
| **C3-P14** | **¿El enforcement es 100 % backend, o el frontend también necesita lógica de visibilidad?** (`09-...:50-51`). Hoy el backend es default-deny en las dos fronteras (`jwt-auth.guard.ts:15`, R1) | Decisión de producto sobre UX, no de seguridad: el backend ya bloquea | `apps/app` · superficies |
| **C3-P15** | **Retención y exportación para compliance** (`09-...:46`). Hoy hay una ventana de 90 días sobre `AccessLog` (`retention.worker.ts:32`) y ninguna superficie de exportación | Requisitos concretos de los primeros clientes enterprise | `retention/` · producto |
| **C3-P16** | **Qué pasa con una anotación cuyo nodo es una baja: ¿cascada, huérfana, resurrección?** El contrato lo declara abierto (`salidas.ts:253-255`): «el plan resuelve el caso del nodo que sobrevive con otro id y no el del que desaparece». Es de gobernanza porque las anotaciones incluyen sensibilidad y exclusiones | Decidirlo junto con C3-P1/C3-P2, que es cuando las anotaciones ganan lector | Contrato `ir` · tramo 7 |
| **C3-P17** | **`Grant` no tiene `expiresAt`.** La ausencia de `canWrite` sí está justificada como decisión de producto en el schema (`schema.prisma:431-434`); la de `expiresAt` no está justificada en ningún lado. La revocación existe y es manual (`Connection.revokedAt`, `:423`) | Definir si el acceso de una conexión caduca solo, y con qué default | `schema.prisma` · conexiones |
| **C3-P18** | **Qué falta en el audit log para auditoría enterprise** (`09-...:44-45`). Cobertura real hoy: **solo MCP y purgas** (`mcp.tools.ts:79-87`, `:112-113`; `vector-gc.ts:71-73`). Las lecturas humanas —vista de grupo, búsqueda propia— no dejan fila, y no existe registro de ejecución de skills | Enumerar los eventos auditables del producto nuevo y decidir cuáles son fail-loud como los actuales | `AccessLog` · todas las fronteras |

---

## 6. Deuda de proceso

**Ninguna** de las preguntas abiertas de la Capa 3 figura en el tracker de
decisiones abiertas. Las diez filas de
[`19-decisiones-abiertas.md:21-32`](../savia-b2b-legacy/19-decisiones-abiertas.md)
vienen de los documentos 02, 03, 05, 11, 13 y 16 — ninguna de 08 ni de 09.

Eso contradice la regla que el propio archivo se fija en `:8-10`: «cada documento
de esta carpeta tiene su propia sección "Preguntas abiertas". Este archivo es el
**índice único** de todas ellas — para no tener que revisar 18 archivos buscando
qué falta».

El efecto práctico es que la única pregunta que el documento viejo de esta capa sí
tenía escrita (`08-...:51-52`, hoy **C3-P11**) nunca fue visible desde el índice, y
por lo tanto nunca entró en ninguna revisión de bloqueantes. Los dieciocho puntos
de la sección 5 tienen que aparecer ahí —o en el tracker que lo reemplace— para
que la regla vuelva a ser cierta.

Se registra como deuda, no se resuelve acá: crear las filas es una edición del
tracker, y este documento no edita otros documentos.

---

## Decisiones tomadas

**Vacío. No se tomó ninguna decisión al escribir este borrador, y es a propósito:**
su función es consolidar lo que ya se sabe y numerar lo que falta, para que el
equipo decida después. Todo lo que aparece en la sección 1 son decisiones tomadas
**en otro lado y en otra fecha** —la ratificación del 2026-07-07 de
`ACCESS-PRIVACY-RULES.md`, y las decisiones de producto del 2026-07-29 de
[`03-personas-y-roles.md:114-122`](03-personas-y-roles.md)— y siguen perteneciendo
a esos documentos.

| Fecha | Decisión | Punto que cierra |
|---|---|---|
| — | — | — |
