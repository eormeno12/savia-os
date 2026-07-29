# 08 — Plan end-to-end: memoria personal + colectiva (federada) y su organización dinámica

> **Documento definitivo y único del diseño** (consolida y reemplaza los borradores de clustering previos). Memoria personal auto-organizada en un árbol de áreas por un motor dinámico **híbrido (embeddings + entidades) sobre mem0**; memoria colectiva como **federación** de fragmentos compartidos; acceso por subárbol; dinamismo **confiable sin autorización** por construcción.
>
> **Estrategia central — apoyarse en mem0, construir solo lo que falta.** mem0 ya provee extracción de hechos, dedup, embeddings, **búsqueda híbrida (dense + BM25 + entidades + rerank)** y un **grafo de entidades** (`{collection}_entities`). Savia **no reimplementa** eso: lo usa (§3). Construimos lo que mem0 **no** tiene: el **modelo de acceso por áreas**, la **federación** colectiva, el **write-kernel** y el **mapa**.
>
> **Reemplaza:** el colectivo-contenedor `Space(scope=collective)` de `05` pasa a **federación**. Los hallazgos de seguridad de `02` (IDOR `DELETE /memory/:id`, `queryDigest`, guard global) son **criterios de aceptación / prerrequisito**.

---

## 0. Tesis en un párrafo

Cada persona tiene **una** memoria personal: sus hechos (extraídos por **mem0**) viven en Qdrant. Se organizan solos en un **árbol de áreas** cuya **columna geométrica son los embeddings** (que dan la jerarquía), **fusionados con la co-ocurrencia de entidades que mem0 ya extrae** (mejora fronteras, naming y estabilidad — como hace la propia búsqueda de mem0); una memoria **pertenece a varias áreas a la vez** (membership), no a un solo hogar, y el **mapa refleja el acceso** (abrir/conceder un área = ver sus miembros); un **motor dinámico** lo mantiene incrementalmente (crea, parte, funde, olvida) — en silencio, reversible, confinado a su scope. La memoria **colectiva no es un almacén**: es una **federación** — un grupo sobre un tema donde cada miembro **comparte un fragmento** de su memoria; la vista colectiva es la **unión viva** de esos fragmentos. La **búsqueda** usa la recuperación híbrida de mem0 con un filtro de acceso; el **acceso** es un predicado determinista (subárbol/lente) en Qdrant, default-deny, con la sensibilidad como compuerta. El dinamismo no pide autorización porque el motor, por construcción, **no puede** cruzar scopes ni borrar, y todo es **reversible**.

## 1. Principios (las leyes del sistema)

1. **Apóyate en mem0** para extracción, embeddings, **búsqueda híbrida** y **grafo de entidades**; construye solo el acceso/federación/kernel. **mem0 = dependencia *sidecar* en el borde (`add`/`search`), NO un fork** (ver §3).
2. **Multi-membership:** una memoria pertenece a un **conjunto de áreas** (`savia_area_ids[]`), no a un solo hogar. El "home" es solo **posición primaria de dibujo**. **El mapa refleja el acceso:** abrir/conceder un área = ver sus miembros.
3. **El dato nunca sale de su autor.** Compartir = exponer, no mover. Borrar ≠ existe (solo soft-archive/supersede).
4. **El acceso es un predicado determinista en Qdrant** (subárbol o lente), nunca el LLM. Default-deny.
5. **La reorg es access-preserving por construcción** (la membership incluye los ancestros): partir/fundir/crear no cambian lo concedido.
6. **El motor está confinado a un scope**: nunca mueve memoria entre personal↔colectivo. Cruzar = acto humano.
7. **Personal = magia silenciosa; colectivo = transparente + sticky.** En ambos: cero diálogos de autorización.
8. **Todo es reversible y enforced por un kernel de escritura** (reference monitor), no por políticas que el usuario configura.

---

## 2. Modelo de datos (Prisma, final)

```prisma
enum SpaceExtent     { folder lens set }          // cómo se define la extensión
enum SpaceGovernance { auto manual }              // auto = el ML reorganiza · manual = fijado
enum Sensitivity     { normal sensitive }
enum GroupRole       { viewer contributor admin }
enum GrantScope      { space lens group }         // qué lee una conexión
enum FragmentSource  { space lens }               // qué comparte un miembro
enum OutboxKind      { set_payload delete_payload purge }
enum OutboxStatus    { pending committed failed }
enum EventAction     { create move split merge decay sensitivity supersede }

// ─── Identidad / sesión ───────────────────────────────────────────────
model User {
  id String @id @default(uuid())
  email String @unique
  createdAt DateTime @default(now())
  spaces Space[]  members GroupMember[]  connections Connection[]
  lenses Lens[]   sessions AuthSession[] events MemoryEvent[]
}
model AuthSession {                                // rotación + revocación de refresh
  id String @id @default(uuid())                   // = jti del refresh
  userId String
  familyId String  revokedAt DateTime?  expiresAt DateTime  createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  @@index([userId])  @@index([familyId])
}

// ─── Capa 1: árbol de áreas (personal) ────────────────────────────────
model Space {
  id String @id @default(uuid())
  ownerUserId String
  owner User @relation(fields:[ownerUserId], references:[id], onDelete: Cascade)
  extent SpaceExtent @default(folder)
  // jerarquía
  parentId String?
  parent Space? @relation("Tree", fields:[parentId], references:[id], onDelete: Cascade)
  children Space[] @relation("Tree")
  path String              // "/general/trabajo/proyecto-x" materializado
  depth Int @default(0)    // cap 3
  isDefault Boolean @default(false)   // General = raíz
  governance SpaceGovernance @default(auto)
  // ancla del área (lo que la DEFINE e identifica)
  anchorEntities String[]  // entidades dominantes (de mem0) → naming + estabilidad
  centroid Float[]         // μ = LS/n (256d) — refinamiento geométrico
  cfCount Int @default(0)              // n  ┐ clustering-feature (BIRCH):
  cfLinearSum Float[]                  // LS ┤ radio/centroide O(1) p/ el split geométrico
  cfSqNormSum Float @default(0)        // SS ┘
  newSinceCheck Int @default(0)
  lastReclusterAt DateTime?
  name String  description String @default("")  descriptionEmbedding Float[]
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  memories MemoryIndex[]  grants Grant[]  fragments FragmentShare[]
  @@index([ownerUserId])  @@index([parentId])  @@index([path])
}

// ─── Memoria (espejo Postgres del punto Qdrant) ───────────────────────
model MemoryIndex {
  memoryId String @id                   // = id del punto Qdrant (determinista)
  authorUserId String                   // = user_id de mem0 (provenance/partición; NO la frontera)
  primarySpaceId String                 // posición PRIMARIA (celda del mapa); NO es la frontera
  primarySpace Space @relation(fields:[primarySpaceId], references:[id])
  sensitivity Sensitivity @default(normal)
  supersededBy String?                  // consolidación (soft)
  fileId String?  source String @default("upload")  createdAt DateTime @default(now())
  outbox OutboxEvent[]
  @@index([primarySpaceId, createdAt])  // lectura + cursor estable
  @@index([authorUserId])
}
// MEMBERSHIP multi-área = payload Qdrant `savia_area_ids[]` (acceso + mapa; ver §3/§6).
// Opcional: join table MemoryArea(memoryId, spaceId, isPrimary) si hacen falta queries relacionales.

// ─── Capa 2: lentes (búsqueda guardada / smart-folder / tema colectivo) ─
model Lens {
  id String @id @default(uuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  name String  query String?  anchor Float[]  radius Float
  createdAt DateTime @default(now())
  grants Grant[]  fragments FragmentShare[]
  @@index([userId])
}

// ─── Conexiones IA + grants (frontera de lectura) ─────────────────────
model Connection {
  id String @id @default(uuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  label String  tokenHash String @unique  tokenLookup String @unique
  lastSeenAt DateTime?  revokedAt DateTime?  createdAt DateTime @default(now())
  grants Grant[]
  @@index([userId])
}
// Una conexión puede leer: un subárbol (space), una lente, o un grupo colectivo.
model Grant {
  id String @id @default(uuid())
  connectionId String
  connection Connection @relation(fields:[connectionId], references:[id], onDelete: Cascade)
  scope GrantScope
  spaceId String?  space Space? @relation(fields:[spaceId], references:[id], onDelete: Cascade)
  lensId String?   lens Lens?  @relation(fields:[lensId], references:[id], onDelete: Cascade)
  groupId String?  group CollectiveGroup? @relation(fields:[groupId], references:[id], onDelete: Cascade)
  canWrite Boolean @default(false)
  includeSensitive Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([connectionId])
}

// ─── Colectivo = FEDERACIÓN (grupo + fragmentos compartidos) ──────────
model CollectiveGroup {
  id String @id @default(uuid())
  name String
  topicLensId String?               // el tema (ancla); opcional
  createdAt DateTime @default(now())
  members GroupMember[]  fragments FragmentShare[]  grants Grant[]
}
model GroupMember {
  groupId String  group CollectiveGroup @relation(fields:[groupId], references:[id], onDelete: Cascade)
  userId String   user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  role GroupRole @default(contributor)
  joinedAt DateTime @default(now())
  @@id([groupId, userId])  @@index([userId])
}
// Cada miembro contribuye un fragmento (su subárbol o su lente) al grupo.
model FragmentShare {
  id String @id @default(uuid())
  groupId String  group CollectiveGroup @relation(fields:[groupId], references:[id], onDelete: Cascade)
  userId String   // el dueño del fragmento
  source FragmentSource
  spaceId String?  space Space? @relation(fields:[spaceId], references:[id], onDelete: Cascade)
  lensId String?   lens Lens?  @relation(fields:[lensId], references:[id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@index([groupId])  @@index([userId])
}

// ─── Pulso (eventos reversibles), Outbox, Auditoría ───────────────────
model MemoryEvent {                    // event-sourced → revert + Pulso
  id String @id @default(uuid())
  userId String  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  action EventAction  spaceId String?  memoryId String?
  revertPayload Json?  revertedAt DateTime?  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}
model OutboxEvent {                    // única vía Postgres → Qdrant
  id String @id @default(uuid())
  kind OutboxKind  memoryId String?  payload Json
  status OutboxStatus @default(pending)  attempts Int @default(0)  lastError String?
  createdAt DateTime @default(now())  committedAt DateTime?
  @@index([status, createdAt])
}
model AccessLog {
  id String @id @default(uuid())
  connectionId String  action String  spaceIds String[]
  queryDigest String?                  // SHA-256, NO el texto (cierra P0-3)
  resultCount Int @default(0)  createdAt DateTime @default(now())
  @@index([connectionId, createdAt])
}
```

Notas:
- **`Space.scope` colectivo desaparece** — un Space es siempre personal; lo colectivo es `CollectiveGroup`+`FragmentShare`.
- **Provenance = `user_id` de mem0** (no inventamos otra: `authorUserId` lo espeja; en Qdrant es el `user_id` que mem0 ya escribe).
- **`anchorEntities`** identifica el área por sus entidades dominantes (de mem0) → naming gratis + estabilidad. El grafo entidad↔memoria **no se duplica en Postgres**: vive en la colección `{collection}_entities` de mem0 en Qdrant.
- **Multi-membership:** una memoria está en **varias áreas** a la vez (`savia_area_ids[]` en Qdrant = áreas de sus entidades + lentes + cluster, **con ancestros**); `primarySpaceId` es solo la celda de dibujo. Conteos: el tamaño de un área **solapa** con otras (es un Venn, correcto); "total memorias" = `count distinct memoryId`.
- **`Lens` sirve doble** (smart-folder personal + `topicLensId` del grupo); **`Grant` polimórfico** (space|lens|group).
- Cascadas explícitas resuelven el **borrado de cuenta** (`onDelete` desde User/Space).

---

## 3. Substrato mem0 ↔ Qdrant (qué usamos, qué construimos)

```
 ESCRITURA (mem0)              LECTURA/BÚSQUEDA (mem0)            ORGANIZACIÓN (sidecar)
 ─────────────────            ───────────────────────           ──────────────────────
 memory.add → mem0.add(       mem0.search(query, filters)       scroll(filter:{user_id},
   text, {user_id,             → HÍBRIDO: dense + BM25 +           with_vectors, dims=256)
   metadata:{savia_*}})          entidades + rerank,             leer {collection}_entities
 → hechos atómicos · dedup      ya filtrado por acceso           (links entidad↔memoria)
 → embed 1536d · entidades                                       → áreas + setPayload(savia_*)
 → Qdrant (punto + payload)
```

### mem0 = dependencia *sidecar*, NO un fork (decisión de arquitectura)

El sistema de organización (ruteo, clustering, árbol de áreas, write-kernel, outbox) **se monta aparte**, sobre el **mismo Qdrant** vía `savia_*` + `scroll`/`setPayload`, y sobre **nuestro** Postgres. mem0 se usa **solo en el borde** (`add`/`search`) como **librería in-process** (como ya hace `memory.service.ts` con `new Memory()`); **su código no se toca**.

- **Por qué no forkear:** mem0 se mueve rápido (v2→v3 cambió el algoritmo y removió el graph store) → un fork congela esas mejoras y vuelve su comportamiento no-auditable. El seam (Qdrant compartido + `add/search`) ya es limpio; no hace falta meterse en sus internals — el namespacing `savia_*` existe para eso (mem0 es ADD-only ⇒ no se pisan claves).
- **El hook post-`add`** (disparar el ruteo) se consigue en **el call site** (controlamos cuándo llamamos `add` y qué hacemos después). Cero fork.
- **Escape hatches si algo no alcanza** (en orden): **config/prompts** de mem0 → **pase NER propio** en el sidecar (a `savia_entities`, independiente de la extracción de mem0) → **PR upstream** o `patch-package` temporal. **Fork = último recurso, evitar.**
- **Upgrade de mem0 = bump de versión**; el acoplamiento es un contrato chico y estable (Qdrant + dos métodos).

### Lo que mem0 nos da y **usamos** (no reimplementamos)

| Capacidad mem0 OSS v3 | Cómo la usa Savia |
|---|---|
| **Extracción de hechos + dedup (ADD-only)** | `mem0.add` es la única vía de escritura de memorias. |
| **Embeddings** (`text-embedding-3-small`, en Qdrant) | Los **reusamos** vía `scroll(with_vectors)`; no re-embebemos. Clustering en 256d (Matryoshka), retrieval/dedup en 1536d. |
| **Búsqueda híbrida** (dense + BM25 sparse + matching de entidades + rerank) | `mem0.search(query, filters)` para la búsqueda **personal**, con el filtro de acceso pasado en `filters`. BM25 es clave para términos/identificadores exactos (código, nombres). |
| **Grafo de entidades** `{collection}_entities` | **Segunda señal** de organización (§4), fusionada con embeddings: memorias que comparten entidades quedan linkeadas → mejora fronteras, naming y estabilidad. *(Verificado en fuente — ver caveats abajo.)* |
| **Filtro por metadata en search** | El filtro de acceso (`savia_area_ids`, `savia_sensitivity`) se compila a `filters` de mem0 (Qdrant soporta los operadores). |
| **Partición `user_id`** | Es nuestra provenance; la federación respeta la partición por usuario. |

### Lo que NO usamos de mem0 (y por qué)
- **`getAll`** (techo `top_k`, sin cursor) → para el batch leemos con **Qdrant `scroll`** (cursor nativo + `with_vectors`).
- **`custom_categories`** (solo Platform; es *labeling*, no clustering) → no aplica.

### Contrato de payload (claves `savia_*`; mem0 no las pisa — es ADD-only; el TS SDK no setea metadata → usamos `setPayload`)

| Clave | Tipo | Uso |
|---|---|---|
| `savia_area_ids` | keyword[] | **membership**: TODAS las áreas de la memoria + sus ancestros → filtro de acceso (`ANY`) y mapa |
| `savia_primary_id` | keyword | área primaria (solo layout del mapa) |
| `savia_entities` | keyword[] | entidades de la memoria (de los links de mem0) → grants/lentes por entidad |
| `savia_sensitivity` | keyword | `normal\|sensitive` |
| `savia_superseded` | bool | consolidación (excluir) |
| `user_id` (de mem0) | keyword | provenance/partición — **no** inventamos `savia_author_id` |

### Caveats verificados del entity store (fuente: `mem0-ts/src/oss/src/memory/index.ts`)
- **Existe en OSS TS** (no Platform, no solo-Python): `{collection}_entities` se crea/puebla en `add()` (`getEntityStore()` L264; Phase 7 L1057) **con `infer:true` (default)**. Con `infer:false` no hay entidades.
- **Dirección del link: entidad → `linkedMemoryIds[]`** (en el payload de la entidad). `scroll` de esa colección reconstruye el grafo bipartito entidad↔memoria; la entidad ya viene deduplicada (match exacto o coseno ≥ 0.95).
- **Extracción SINTÁCTICA, no semántica** (regex + `compromise`, **sin LLM**): proper nouns, comillas, noun phrases, conteos. Fuerte en el dominio de Savia (proyectos, libs, personas, identificadores → **entity-rich**); débil en texto sin nombres propios → **por eso es señal secundaria, no espina.**
- **Poblado best-effort y silencioso** (Phase 7 en `try/catch` → solo `console.warn`): no asumir 100% poblado; **reconciliar**.
- **Es co-ocurrencia, no relaciones tipadas** (no hay `X relación Y`): sirve para community detection bipartita y boost de similitud; **no da jerarquía** → la jerarquía la dan los embeddings.

---

## 4. Memoria personal: el motor de organización (híbrido: embeddings + entidades)

### 4.0 La columna vertebral: embeddings (geometría) + entidades (fusión)

Tras verificar mem0 en fuente, el esqueleto es **clustering de embeddings** (da la **jerarquía**), **fusionado con la co-ocurrencia de entidades** de mem0 como **segunda señal** — exactamente como la propia búsqueda de mem0 fusiona dense + BM25 + entidades. Por qué híbrido y no entity-first puro:

- Las entidades de mem0 son **sintácticas** (regex + `compromise`, sin LLM) y de **poblado best-effort** → frágiles como única espina, pero **valiosas** donde hay nombres propios (Savia es entity-rich: proyectos, libs, personas, identificadores).
- La **jerarquía** (áreas → sub-áreas) **no** sale de las entidades (son co-ocurrencia, no relaciones tipadas): la dan los **embeddings**.
- Las entidades aportan: **boost de similitud** (mejores fronteras), **naming gratis** (entidad dominante = nombre) y **estabilidad** (un área anclada a una entidad churnea menos).

```
 embeddings 256d (Qdrant)        →  GEOMETRÍA: kNN graph / CF → jerarquía de áreas
 {collection}_entities (mem0)    →  FUSIÓN: peso extra a aristas que comparten entidad
                                    + anchorEntities (naming + estabilidad)
 similitud(i,j) = α·cos(i,j) + β·entidades_compartidas(i,j)   (como el ranking de mem0)
```

### 4.0b Home vs Membership (multi-área)
El clustering arma el **árbol de áreas**. Una memoria **pertenece a varias** de esas áreas:
`membership = áreas(entidades de la memoria) ∪ lentes que matchea ∪ cluster de embedding`, **más sus ancestros**. Se denormaliza a `savia_area_ids[]`. La **primaria** (celda del mapa) = el área más específica/fuerte. **El acceso usa la membership completa** (§6); el mapa usa la primaria solo para el layout, pero **abrir un área muestra todos sus miembros** (§6.5).

### 4.1 Estado por nodo
`anchorEntities[]` (lo que define el área) + CF triple `(n, LS, SS)` y `centroid(256d)` para el **refinamiento geométrico** (radio O(1) en el split). Derivados:
```
 μ = LS/n      r² = SS/n − ‖μ‖² = 1 − ‖μ‖² (vectores unitarios)     cohesión = ‖μ‖
 cf_add(v): n+=1; LS+=v; SS+=1     cf_remove(v): n-=1; LS-=v; SS-=1   (O(256))
```

### 4.2 Ruteo online (cada memoria, O(1), sin LLM)
```python
def on_memory_added(memoryId, ents, vec1536):       # ents = entidades que mem0 extrajo (puede ser [])
    v = renorm(truncate(vec1536, 256))
    nbrs = qdrant.search(v, filter={user_id, not superseded}, k=20)
    areas = areas_of(ents)                            # áreas de sus entidades (de mem0)
    areas |= {a for a in nearby_areas(nbrs) if score(a) >= τ}   # + cercanía por embedding
    if not areas: areas = {GENERAL}
    primary    = most_specific(areas)                 # celda del mapa
    membership = closure_with_ancestors(areas)        # + ancestros → savia_area_ids[]
    write_kernel.assign(memoryId, primary, membership, vec1536)  # tx + outbox; cf_add; setPayload
    for a in areas: maybe_trigger_drift(a)
```
Una memoria cae en **varias áreas** (sus entidades + cercanía por embedding); `primary` es solo la celda de dibujo. **Sin LLM** en caliente.

### 4.3 Disparo por drift (event-driven, local)
```python
def maybe_trigger_drift(node):
    if node.newSinceCheck >= Δn and radius(node) > T_split:   # O(1) desde CF
        enqueue("recluster_node", node.id); node.newSinceCheck = 0
```

### 4.4 SPLIT (refinamiento geométrico de un área entity-anclada)
```python
def recluster_node(node):
    pts = qdrant.scroll({savia_area_ids: node.id}, with_vectors, dims=256)  # miembros del área
    if len(pts) < n_min: return maybe_merge(node.parent)
    # ¿el área (una entidad) contiene dos sub-temas geométricos?
    axis = top_pc(pts)
    if dip_test([dot(p,axis) for p in pts]).pvalue > α: return     # unimodal → no partir
    (c1,c2), lab = two_means(pts)
    if silhouette_sampled(pts, lab) < s: return
    A1, A2 = write_kernel.create_children(node)        # node PERSISTE como padre → invisible a grants
    for p in pts: write_kernel.move(p, A1 if lab[p]==0 else A2)
    set_anchor_entities([A1, A2])                       # entidades dominantes de cada hijo
    name_async([A1, A2], parent=node)
```
- **Identidad estable:** `node` no cambia de id (se vuelve padre); un grant sobre `node` sigue viendo `A1∪A2`. Solo cambia `savia_area_ids` de los puntos (outbox).
- **dip de Hartigan / BIC(1 vs 2)** = "¿son dos cosas?"; `silhouette` muestreado (no O(n²)).

### 4.5 MERGE (con histéresis, no oscila)
```python
def maybe_merge(parent):
    for A1, A2 in sibling_pairs(parent.children):
        # entidades muy solapadas O centroides muy cercanos
        if entity_jaccard(A1, A2) > J or cos(A1.centroid, A2.centroid) > M_merge:
            survivor, gone = larger(A1,A2), smaller(A1,A2)
            write_kernel.merge(gone -> survivor)         # cf suma; migra grants del `gone`
```
`M_merge`/`J` ≫ separación de split ⇒ un par recién partido no se re-funde.

### 4.6 DECAY y CONSOLIDACIÓN (periódico)
- **Decay:** peso `e^{−λΔt}`; nodos sin aportes en ventana larga → archive (soft).
- **Consolidación:** mem0 v3 es ADD-only (no fusiona) → near-dup `cos≥0.97` (1536d) **y** (señal entidad) mismo set → `savia_superseded=true` + `supersededBy`. Reversible, nunca delete automático.

### 4.7 BOOTSTRAP (global, ocasional, gateado)
- **Grafo mutual-kNN (Qdrant HNSW) en 256d**, con aristas **ponderadas por similitud fusionada** `α·cos + β·entidades_compartidas` (las entidades de `{collection}_entities` densifican el grafo donde hay nombres) → **Leiden multi-resolución** → 3 niveles → áreas. Reemplaza el k-means `k=√n` de `cluster.service`.
- `anchorEntities` de cada comunidad = sus entidades dominantes (naming).
- On-demand ("organizar mi memoria") o cuando el drift de un subárbol es grande. **Gateado por el eval** (§8) — no es el régimen, es la excepción.

### 4.8 NAMING
La **entidad dominante es el nombre** (gratis) para la mayoría. LLM (batch, con muestra + breadcrumb del padre + entidades) **solo** cuando un nodo no tiene entidad dominante clara. Nunca en el camino caliente.

---

## 5. Memoria colectiva: federación

### 5.1 Mecánica
```
 CollectiveGroup "Proyecto X"  (topicLensId = ancla del tema, opcional)
   GroupMember(Ana, admin) · (Beto, contributor) · (Carla, viewer)
   FragmentShare(Ana,  space=su "Proyecto X")     ← cada quien comparte SU fragmento
   FragmentShare(Beto, lens=su tema "Proyecto X")

 VISTA = ∪ fragmentos, viva, deduplicada, con su propio mapa efímero
```
- **El contenedor no existe.** El dato vive en cada autor; el grupo es un overlay de `FragmentShare`s.
- **Dinámico:** un recuerdo nuevo de Ana que cae en su fragmento **aparece solo** en la vista (sensible NO — compuerta).
- **Salir:** borrar tus `FragmentShare` → tu fragmento se va con vos; cero extracción, cero huérfanos. (Opción "donar snapshot" = copiar a un Space neutral.)
- **Roles** gobiernan el **grupo** (membresía/invitaciones), no editan contenido ajeno.

### 5.2 Lectura colectiva (la frontera)
```python
def resolve_group_scope(group, viewer):                      # viewer = user o connection
    assert membership(group, viewer)                          # default-deny
    clauses = []
    for f in group.fragments:                                 # cada fragmento compartido
        if f.source == space: clauses.append(area_ids_any([f.spaceId]) & user_is(f.userId))
        else:                 clauses.append(lens_pred(f.lens) & user_is(f.userId))
    return OR(clauses) & sensitivity_normal_or(viewer.includeSensitive)
```
Cruza particiones de varios usuarios **solo** por sus fragmentos compartidos → seguro. **Búsqueda colectiva:** como `mem0.search` es por partición de usuario, se hace **fan-out** (una búsqueda por miembro con su filtro de fragmento) + merge/dedup; o, si el costo importa, Qdrant-directo multi-usuario (dense-only). La IA de un miembro accede vía `Grant(scope=group)`.

### 5.3 Comportamiento esperado (qué ve el usuario)
| Evento | Comportamiento |
|---|---|
| llega memoria nueva | additivo · atribuido en el **Pulso del grupo** · privado nunca auto-entra |
| sale memoria | **sticky**: nada sale solo; salida = explícita + atribuida; el autor conserva su copia |
| reorg interna de un fragmento | invisible (cada quien reorganiza su árbol personal; la unión sigue igual) |
| split/merge | **del lado personal**, silencioso; la vista solo re-unioniza |
| dedup cross-persona | muestra uno ("también registrado por Ana"), respeta autoría |

---

## 6. Acceso, búsqueda, seguridad y el kernel (cero autorización)

### 6.1 Búsqueda
- **Personal:** `mem0.search(query, filters=access_filter(connection))` → híbrido (dense+BM25+entidades) + rerank, **ya filtrado** al scope legible. Aprovecha la recuperación de mem0; no reimplementamos dense-only.
- **Colectiva:** fan-out por miembro + merge (§5.2), o Qdrant-directo si conviene.
- El filtro de acceso (`savia_area_ids`/`savia_sensitivity`) se compila a `filters` de mem0 / filtro Qdrant.

### 6.2 Compilación del filtro (AccessService)
```python
def access_filter(connection, requested=None):
    cl = []
    for g in connection.grants:                               # grants ∩ (membresía si group)
        if g.scope == space: cl.append(area_ids_any([g.spaceId]))   # subárbol vía ancestros en area_ids
        if g.scope == lens:  cl.append(lens_pred(g.lens))
        if g.scope == group: cl.append(resolve_group_scope(g.group, connection))
        if not g.includeSensitive: cl[-1] &= sensitivity_normal
    f = OR(cl)
    if requested: f &= area_ids_any(requested)                # clamp
    return f or DENY_ALL                                       # default-deny
```

### 6.3 El write-kernel (reference monitor) — la garantía "confiable"
Única vía de mutación. Admite una op **solo si**:
```
 ✓ no cruza un scope de propiedad (personal↔grupo)   → el motor no puede filtrar
 ✓ no borra vectores (solo set_payload / supersede)   → reversible
 ✓ registra su inversa (MemoryEvent.revertPayload)    → undo
 ✓ respeta rate-limit por scope                        → no caos
 ✓ sensitive ⇒ no fluye sin includeSensitive           → fail-closed
```
Aplica en `tx` Postgres (`MemoryIndex` + CF + `MemoryEvent` + `OutboxEvent`) y el relay sincroniza Qdrant. **Guardrails automáticos** (tasa de undo, oscilación split↔merge, caída de calidad) → **auto-rollback**, sin humano.

### 6.4 Por qué no se autoriza
La autorización solo protege contra daño irreversible. Aquí el daño es **imposible por construcción** (scope-confined, no-borrado, sensible-gated) y **trivialmente reversible** (event-sourced + digest/undo). El usuario solo realiza actos **creativos** (compartir) o de **feedback** (corregir/pinear → el nodo pasa a `manual`), nunca aprueba un diálogo.

---

### 6.5 Visualización: el mapa refleja el acceso (multi-membership)
**Principio:** abrir/conceder un área = `savia_area_ids ANY [área]` → **el mapa y el acceso son la misma operación**. El solape NO se dibuja como geometría (un Venn con N áreas jerárquicas es ilegible); se **revela como highlight**.

- **Mapa principal (A): circle-packing jerárquico** (`d3-hierarchy.pack()`), cada recuerdo en su celda **primaria** (layout limpio, zoomable, escala).
- **Solape como highlight:** seleccionar un área/entidad/lente **ilumina todos sus miembros** estén en la celda que estén — y ese highlight **es el preview de acceso** ("esto es lo que un grant a X expondría").
- **Detalle de recuerdo:** chips "está en: Proyecto X · Postgres · Trabajo".
- **Modo "explorar" (B, opcional):** paisaje/contornos (proyección 2D tipo UMAP) donde el solape es espacialmente visible; jerarquía más difusa → secundario.

```
 reposo: jerarquía limpia              seleccionás "Postgres": se encienden sus miembros
   Trabajo › Proyecto X  ● ● ●           Proyecto X: ● ●(◉)   ← (◉) vive acá y TAMBIÉN es Postgres
   Bases de datos › Postgres ● ●         Postgres:  [◉ ◉ ◉ ◉] ← "6 recuerdos · esto expondría el grant"
```

---

## 7. Infra, workers y consistencia

```
 RoutingService     inline en memory.add (síncrono, O(1))
 ReclusterWorker    BullMQ "recluster_node" (drift) · jobId determinista · idempotente
 ConsolidateWorker  BullMQ periódico: dedup + decay
 OutboxRelay        aplica setPayload a Qdrant (wait:true) → committed
 OutboxReconciler   reintenta failed · borra vectores sin MemoryIndex (huérfanos)
```
- **Graceful shutdown:** guardar refs de Worker y `await worker.close()` en SIGTERM (cierra INT-1 de `02`).
- **Idempotencia:** `memoryId` determinista + `jobId=ingest:<fileId>` (cierra INT-2). Cuidado: la op de mem0 informa qué hechos **realmente** se agregaron (dedup → NOOP) — solo se rutea lo agregado.
- **Aislamiento:** todo `scroll`/reorg filtra por `user_id`; colectivo solo por `FragmentShare`.
- **Consistencia:** Postgres = verdad del árbol; Qdrant = vectores + payload + entity-store; outbox los reconcilia (cierra P0-2).

---

## 8. Evaluación (cómo se calibra y se mantiene confiable)
- **Offline (por corrida):** modularidad del grafo (entidades y kNN), silhouette muestreada, Davies-Bouldin, distribución de tamaños, % sin entidad/ruido.
- **Online (guardrails):** **accept-rate** de propuestas, **tasa de oscilación** split↔merge, **override manual** (usuarios moviendo memorias), caída de calidad de búsqueda.
- Estas señales **calibran** `τ, T_split, M_merge, J, s, α, λ, Δn` y **estrangulan/revierten** el motor automáticamente. `ClusterRun` registra cada corrida. **El bootstrap pesado (§4.7) se mantiene gateado por estas métricas.**

---

## 9. Fases (roadmap end-to-end)

| Fase | Entrega (técnico) | Cierra | Esf. |
|---|---|---|---|
| **P0 Substrato** | `EmbeddingsPort(dims)` · `VectorStorePort(scroll+setPayload)` · payload `savia_*` (usa `user_id` de mem0) · drop `submemories/spaceIds/version/manualOverride` · **write-kernel + outbox** | 02-P0-2, INT-1/2 | **M** |
| **P1 Árbol+acceso (multi-membership)** | `Space` recursivo (parentId/path/depth/CF/anchorEntities/governance) · General · **ruteo kNN+entidades → membership** · payload `savia_area_ids[]` (acceso por `ANY`, subárbol vía ancestros) · `primarySpaceId` (layout) | jerarquía, 03-D1/D3 | **L** |
| **P2 Búsqueda mem0** | **`mem0.search(query, filters)`** híbrida con filtro de acceso (reemplaza dense-only) · personal ahora; fan-out colectivo en P4 | calidad de retrieval | **M** |
| **P3 Áreas (híbrido) + mapa** | clustering de **embeddings** (kNN graph/CF) **+ boost de entidades** de mem0 · `anchorEntities` p/ naming · drift-trigger · **split (dip)** · **merge (histéresis/Jaccard)** · `MemoryEvent` (revert) · digest+undo · **mapa A** (circle-packing + solape-como-highlight = preview de acceso) | dinamismo personal estable | **L** |
| **P4 Lentes + Federación** | `Lens` · grant por predicado · `CollectiveGroup`+`GroupMember`+`FragmentShare` · `Grant(scope=group)` · vista=unión viva · fan-out de búsqueda · Pulso del grupo | M4, capa 2, colectivo | **L** |
| **P5 Evolución** | consolidación cross-persona · **decay** · clasificador de sensibilidad (auto, fail-closed) | calidad, privacidad | **M** |
| **P-billing Pagos** | módulo Mercado Pago ([`09`](09-modulo-pagos.md)): `Plan/Subscription/Payment/WebhookEvent` + `User.plan` · 5 endpoints + webhook **firmado/idempotente/transaccional** (usa el outbox/`$transaction` de P0) · **`RequirePlan('pro')`** server-side en conectar-IA / MCP / Pulso | freemium (gap SB1) | **L** |
| **P6 Profundidad (gateada)** | bootstrap Leiden para el remanente sin entidad · harness de eval · **auto-rollback** | auto-organización profunda | **L** |
| **transversal** (criterios de aceptación de `02`) | helmet · `@nestjs/throttler` (OTP/login) · MCP rate-limit por IP + `json({limit})` · env `validationSchema` (Joi) · OpenAI/Qdrant timeout+retry/backoff · healthchecks reales (worker/MCP) · errores de dominio → HTTP exceptions · cookie helper único (SameSite/Secure) · CI: chequeo de drift de migraciones · cron limpieza `OtpCode` · eval continuo | seguridad/robustez | **M** |

**Prerrequisito:** los hallazgos de seguridad de `02` (IDOR delete, queryDigest, guard global) como criterios de aceptación, resueltos **en** P0–P1 del rebuild.

**Dependencias:** P0 → P1; P2 ∥ P1; P3 depende de P1 (+ entity store de mem0); P4 depende de P1+P3; P5 depende de P4; P6 gateado por P3/eval. **P0–P2 ya entregan memoria personal con buen retrieval; P3 la auto-organización híbrida (embeddings + entidades); P4 lo colectivo; P6 es profundidad por evidencia.** **Pagos (`09`)** depende de P0 (auth + outbox/`$transaction`) y va en paralelo a la capa de producto de `05`.

---

## 10. Relación con la auditoría
- **04** triage de seguridad (**prerrequisito**). **05** modelo de datos/rutas + matriz de cobertura (vigente; su colectivo-contenedor lo **reemplaza** este doc por federación).
- **Este `08` es el único plan de organización/memoria a ejecutar** (absorbe y reemplaza los borradores de clustering previos).
