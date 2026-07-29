# Step 17 — Índice jerárquico automático de la memoria (clustering híbrido)

> 🔄 **Actualización (2026-06-29) — capa 1 con solape (multi-membership).**
> **Se mantiene:** el índice de **dos capas** (jerarquía + lentes), la **gobernanza auto/manual**, la **cola de propuestas/consentimiento** y el **motor dinámico**.
> **Cambia (decisión D1):** la **capa 1 deja de ser una partición de un-hogar** — una memoria tiene **multi-membership** (`savia_area_ids`, con ancestros), así que el solape es **omnipresente**, no solo de capa 2; el **mapa refleja el acceso** (solape como *highlight*, no Venn) con `primarySpaceId` solo para el layout; los conteos pasan de sumar a **Venn** (`count distinct`).
> **Motor (D6):** **embeddings = espina geométrica** + **entidades de mem0 (`{collection}_entities`) = señal secundaria** (no entity-first); el grafo de entidades es **co-ocurrencia, no un knowledge graph**.
> Fuente canónica: [`08 §4/§6.5`](../../audit/backend/2026-06-27/08-plan-end-to-end.md); razón en [`0A §A`](../../audit/backend/2026-06-27/0A-analisis-correctitud.md). Lo de abajo queda como **contexto histórico**.

> **Objetivo**: que la memoria se organice **sola** en un **índice navegable de dos
> capas** — una jerarquía automática de 3 niveles ("¿dónde vive cada memoria?") y
> lentes personalizadas por búsqueda vectorial ("muéstrame todo sobre X"). Es la
> columna vertebral del producto: habilita el mapa de memoria, el acceso por región y
> el retrieval acotado de tus IAs.
>
> **Depende de**: [14 (unificación de spaces)](14-spaces-unification.md),
> [15 (frontera limpia)](15-frontier-hardening.md). Hermano del rediseño visual
> ([`docs/plan/savia-redesign`](../savia-redesign/00-overview.md)) — el mapa zoomable
> es su UI.

---

## La idea: un índice de dos capas

> **Son dos preguntas distintas, así que dos capas distintas — no es un hack, es
> principista.**

| Capa | Pregunta | Qué es | Solapamiento |
|------|----------|--------|--------------|
| **1 · Jerarquía auto** | ¿*Dónde vive* esta memoria? | Partición **dura**, árbol de 3 niveles, **un hogar** por memoria. La organiza el ML. | No (un hogar) |
| **2 · Clusters custom** | ¿Todo sobre *X*? | **Smart-folders por búsqueda vectorial** (ancla + radio), una dimensión arriba. Las define el usuario. | **Sí** (se cruzan) |

El **solapamiento** (ej. Savia y Fredd que comparten info) vive en la **capa 2**, sin
ensuciar el árbol limpio de la capa 1. La capa 1 da provenance y el mapa; la capa 2 da
flexibilidad y vistas que se solapan.

**Motor**: **Qdrant directo** — no se introduce ninguna estructura/índice nuevo (ver §1).

---

## 1. Arquitectura — Qdrant directo (sin estructura nueva)

Qdrant ya es un índice vectorial **jerárquico (HNSW), online, con range y filtros**.
Hace de forma **nativa** casi todo lo que necesitamos; lo único que NO hace es *decidir*
la taxonomía — y eso es un **job batch que lee Qdrant y escribe labels**, no una
estructura persistente aparte.

```
  Qdrant = la única fuente de verdad
     ├─ vectores + payload (homeSpaceId, space_ids[] set de membresías, anclas custom)
     ├─ ruteo (kNN / nearest-centroid)     ← online, nativo  → asigna hogar
     ├─ custom cluster (radius/kNN query)  ← online, nativo  → membresía dinámica
     └─ acceso (filtro combinado)          ← online, nativo  → §5

  Worker de clustering (BullMQ, batch)
     └─ lee vectores de Qdrant → agglomerative → escribe homeSpaceId + Space.centroid
        (bootstrap inicial + re-cluster disparado por varianza)

  Postgres = árbol + metadatos (Space.parentSpaceId/path/centroid, CustomCluster, grants)
```

- **Tiempo real = ruteo**; **batch = reestructura**. Una memoria nueva cae en su space
  al instante (ruteo); la estructura *óptima* se asienta con el re-cluster en background.
- **Embeddings: OpenAI** (`text-embedding-3-small`) vía el `EmbeddingsPort` — es **una
  sola vez por memoria**, costo despreciable; no requiere modelo local. (Pluggable por
  si algún día se quiere on-prem total.)
- **Por qué NO una estructura incremental (CF-tree/BIRCH)**: solo valdría si la
  *reestructura* fuese en vivo. Como es **batch** (decisión tomada), Qdrant + worker
  batch + caché de centroides hace todo, con **menos infra y mejor UX** (la reestructura
  con changelog/consentimiento es menos brusca que un árbol que se reorganiza solo).

---

## 2. Modelo de datos

### Capa 1 — jerarquía (sobre el modelo unificado del [step 14](14-spaces-unification.md))

```prisma
enum SpaceGovernance { auto manual }

model Space {
  // ...existente...
  parentSpaceId String?          // adjacency list. General = raíz (null).
  path          String           // materialized "/general/savia/mvp" (breadcrumbs + subtree)
  depth         Int     @default(0)   // cap 3
  governance    SpaceGovernance @default(auto)   // auto = ML lo gestiona; manual = fijo
  centroid      Float[]          // centroide empírico de sus memorias (ruteo en vivo)
}
```

- **Un hogar por memoria** (`MemoryIndex.homeSpaceId`) + **`space_ids[]` (set de
  membresías)** para acceso/solapamiento (ya existe; se eleva a primera clase).
- **Contención**: un ancestro **agrega** a su subárbol (leer/conceder "Savia" = todo lo
  suyo). `path LIKE '/general/savia/%'`.
- **Gobernanza**: editar un nodo `auto` (renombrar/mover/fijar) lo vuelve `manual` →
  el ML deja de reestructurarlo (solo **propone**). Autoría implícita.

### Capa 2 — clusters custom

```prisma
model CustomCluster {
  id        String @id @default(uuid())
  userId    String
  name      String
  anchor    Float[]   // ancla en el espacio de embeddings (de descripción o de semillas)
  radius    Float     // umbral de pertenencia (o top-k); tunable
  createdAt DateTime @default(now())
}
```

- Plano por ahora (sin anidar). Membresía **dinámica**: se evalúa por query en Qdrant,
  no se materializa (ver §4).

### Propuestas (cola de consentimiento)

```prisma
enum ProposalKind { split merge move new_area rename }
enum ProposalStatus { pending accepted dismissed }
model SpaceProposal { id String @id @default(uuid()) userId String kind ProposalKind
  status ProposalStatus @default(pending) payload Json rationale String createdAt DateTime @default(now()) }
```

Savia **propone**; el usuario **acepta/descarta**. Nada destructivo se aplica solo.

---

## 3. Capa 1 — jerarquía automática (3 niveles)

### a) Bootstrap (worker, batch)

Agglomerative clustering sobre los embeddings → dendrograma → cortar en **3 niveles**
→ nombrar cada nodo con el LLM (muestra de sus memorias, **con contexto del padre**:
bajo "Savia", un cluster de lanzamiento → "Go-to-Market"). Reemplaza el k-means plano
de [`cluster.service`](../../../apps/api/src/modules/onboarding/cluster.service.ts)
(`k=√n`). Escala: O(n²) está bien para miles de recuerdos; a gran escala, clusterizar
centroides, no memorias crudas.

### b) Ruteo (tiempo real)

Memoria nueva → embed (OpenAI) → **nearest centroid** (decenas de nodos, O(1) en RAM)
o **kNN en Qdrant** sobre las ya clasificadas → `homeSpaceId`. Reusa
[`classifier.service`](../../../apps/api/src/modules/spaces/classifier.service.ts)
(coseno + umbrales + fallback LLM). Detalles:
- **Hogares intermedios**: si matchea "Savia" pero ningún hijo, vive en el nodo
  intermedio (los no-hoja contienen memorias).
- **Cold start**: con pocas memorias el árbol es plano; los 3 niveles **emergen** al
  crecer. No forzar 3 niveles vacíos.
- Actualiza el `centroid` del nodo (media incremental).

### c) Re-cluster (batch, disparado por varianza) — la métrica precisa

El split **no** es un solo número; son **dos condiciones**:

1. **Tamaño**: el **radio** del cluster, exacto y O(1) desde `(n, Σx, Σx²)`:
   `radio = √(Σx²/n − (Σx/n)²)`. El segundo momento real, no una aproximación.
2. **Separabilidad**: el radio solo **sobre-parte** clusters amplios-pero-unimodales.
   Antes de partir, `k=2` rápido sobre el nodo y medir **silhouette** (o gap statistic).

> **Split = `radio > T` **Y** `silhouette(mejor 2-split) > s`.** Tamaño dice "grande",
> separabilidad dice "son dos cosas".

- A **nivel 3** (cap) los splits crean **hermanos** (re-hogar lateral), no hijos.
- Solo toca nodos `auto`; los `manual` son **anclas fijas** (como mucho se proponen).
- Aditivo (nueva subárea emergente) puede auto-aplicar con changelog+undo; destructivo
  (split/merge/move/rename) → `SpaceProposal`.

---

## 4. Capa 2 — clusters custom (smart-folders por vector)

- Un custom cluster = **ancla** (de una descripción → embedding, o "agrupa estas N y trae
  similares") + **radio**. "Crear un grupo nuevo" = definir una nueva ancla.
- **Membresía dinámica / online**: es una **query kNN/radius en Qdrant**; no se guarda
  membresía, se re-evalúa en cada lectura. Memoria nueva entra al índice → la próxima
  query del cluster ya la incluye. **Online por construcción, costo cero al insertar.**
- **Se solapan libremente**: una memoria cae dentro del radio de varias anclas a la vez
  (resuelve Savia∩Fredd sin tocar el árbol).
- **Conceden acceso** (decisión tomada) — ver §5.
- Planos por ahora; el umbral/`radius` se tunea (top-k, cutoff, o auto-tune desde
  semillas) — UX: posible slider "más amplio / más preciso".

---

## 5. Frontera de seguridad (lo más delicado)

La capa 2 **concede acceso de forma dinámica** — el filo a limar. Sobre el principio del
[step 15](15-frontier-hardening.md) (default-deny, clamp `granted ∩ requested`, filtro
duro de metadata, *el lenguaje natural es UX, nunca la frontera*):

- **Un custom cluster es un predicado determinista** (ancla + radio) que se **compila a
  un filtro de Qdrant**. No es el LLM decidiendo → **respeta** el principio: es como
  conceder acceso a una *vista SQL*, no a un set fijo.
- **Acceso = filtro combinado**, clamped a *tus* memorias + default-deny:
  ```
  (space_ids ∩ subárbol-concedido ≠ ∅)        // por jerarquía (capa 1)
  OR (cosine(vec, ancla-concedida) ≥ 1 − radio) // por lente custom (capa 2)
  ```
  El solapamiento es **natural** aquí: es la intersección de conjuntos / radio que
  Qdrant ya hace.
- **Mitigar lo dinámico** (el set concedido crece al crecer la memoria):
  predicado **inspectable**, **"preview de qué expone ahora mismo"** antes de conceder,
  **audit log** de cada exposición, y default-deny siempre. El usuario concede una
  *capability sobre un predicado*, con consciencia de que es dinámico.
- **Tests obligatorios**: el subárbol no hereda de más (mover un nodo recalcula `path`);
  el radio no filtra fuera de lo tuyo; includes/expansiones son no-transitivos.

---

## 6. Qué obtienes: un índice automático y jerárquico

- **Índice de búsqueda** (Qdrant/HNSW): geométrico, para retrieval.
- **Índice de organización** (el árbol + las lentes): **automático y jerárquico**, con
  nombres, navegable. Ambos sobre **un solo espacio de embeddings**.

Es la **columna vertebral** del producto:
- **Mapa de memoria** = la *visualización* del índice.
- **Acceso por space/lente** = conceder a una IA = conceder una *región del índice*.
- **Retrieval de tus IAs** = buscar **acotado** a una región, no en una bolsa plana.

Honestidad: el índice es **emergente** (buen borrador del ML + curación), **eventually-
consistent** (ruteo instantáneo, estructura óptima en batch) y **plano en cold start**
(la profundidad emerge al crecer).

---

## 7. UX (la provee el rediseño)

- **Mapa zoomable** (`d3-hierarchy.pack()`, circle-packing es nativamente jerárquico):
  zoom a "Savia" → MVP/Marketing/GTM; breadcrumbs. Ver
  [`04-memory-map`](../savia-redesign/04-memory-map.md).
- **Smart-folders custom** = lentes guardadas que cruzan el árbol (búsqueda → guardar
  como grupo). Distinguir visualmente *estructura* (nodos del árbol) de *lente* (selección).
- **Inbox de propuestas** ("Savia sugiere…", con preview, aceptar/descartar).
- **Permisos**: conceder por space (subárbol) o por custom cluster (predicado), con
  preview de qué expone.

---

## 8. Fases

1. **Modelo capa 1 + jerarquía + ruteo + enforcement de subárbol/sets con tests** (lo
   primero y más delicado). Comportamiento de cara al usuario: spaces planos siguen
   igual, ahora anidables.
2. **Worker de clustering**: agglomerative bootstrap + re-cluster por `radio + silhouette`;
   reemplaza k-means; propuestas.
3. **Capa 2**: custom clusters (ancla + radio), dinámicos, **conceden acceso** + filtro
   combinado + preview/audit.
4. **UX**: mapa zoomable, smart-folders, inbox de propuestas, permisos por región.

---

## 9. Decisiones

**Tomadas** (en exploración con el usuario):
- Embeddings **OpenAI** (una vez por memoria) — no modelo local.
- Custom clusters **conceden acceso**, **dinámicos/online**, **planos** por ahora.
- Split = **radio (de CF) + silhouette del mejor 2-split**.
- **Qdrant directo**, sin CF-tree/BIRCH; clustering = worker batch que lee/etiqueta Qdrant.
- Solapamiento en **capa 2** (lentes), el árbol de capa 1 queda con **un hogar**.

**Abiertas** (a tunear en implementación):
- Cap de profundidad: **3** (confirmado), pero los umbrales `T` (radio) y `s` (silhouette).
- Ruteo: nearest-centroid vs kNN puro (o híbrido con tiebreak).
- `radius` del custom: top-k vs cutoff de similitud vs auto-tune desde semillas.
- Frecuencia/disparo del worker de re-cluster (umbral por nodo vs periódico).
