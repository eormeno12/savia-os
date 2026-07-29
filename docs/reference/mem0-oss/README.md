# Grafo de referencia — mem0 OSS

> Grafo de conocimiento (graphify) del fuente de **mem0 OSS**, para entender qué
> implementa la librería sobre la que Savia construye. Es material de referencia
> derivado de una dependencia; no es código de Savia.

## Qué hay aquí

- `graphify-out/graph.html` — grafo visual interactivo. **Ábrelo en el navegador o el IDE.**
- `graphify-out/graph.json` — grafo para `graphify query/explain/path`.
- `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, gaps (texto).
- `graphify-out/manifest.json` — metadatos de extracción.

## Procedencia

- Paquete: **`mem0ai@3.1.0`**, entrada `mem0ai/oss` (la versión que corre `apps/api`).
- Fuente: **extraído del sourcemap** `dist/oss/index.mjs.map` (`sourcesContent`), que
  embebe los 77 `.ts` originales. NO se clonó el repo → **match exacto de versión**
  con lo instalado, en vez de HEAD.
- Grafo: `1156 nodos · 2887 edges · 53 comunidades` (AST puro, 0 costo LLM).

## Cómo verlo

```bash
open docs/reference/mem0-oss/graphify-out/graph.html
# o abre ese archivo en el IDE
```

Consultas sobre el grafo (desde la raíz del repo):

```bash
graphify explain "addToVectorStore"  --graph docs/reference/mem0-oss/graphify-out/graph.json
graphify query   "how add decides ADD/UPDATE/DELETE" --graph docs/reference/mem0-oss/graphify-out/graph.json
graphify path "Memory" "Qdrant" --graph docs/reference/mem0-oss/graphify-out/graph.json
```

## Cómo regenerarlo (reproducible, sin red)

El fuente NO se versiona (es third-party, Apache-2.0). Se re-extrae del paquete
instalado y se reconstruye el grafo:

```bash
# 1. localizar el sourcemap del paquete instalado
MAP=$(find node_modules/.pnpm -path "*mem0ai/dist/oss/index.mjs.map" | head -1)

# 2. extraer los .ts originales a un dir temporal
python3 - "$MAP" /tmp/mem0-oss-src <<'PY'
import json, os, sys, re
d = json.load(open(sys.argv[1])); out = sys.argv[2]
for s, c in zip(d.get("sources", []), d.get("sourcesContent") or []):
    if c is None: continue
    p = os.path.join(out, re.sub(r'^(\.\./)+', '', s).lstrip('/'))
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(c)
PY

# 3. construir el grafo (AST puro, sin LLM)
cd /tmp/mem0-oss-src && graphify update .

# 4. copiar artefactos de vuelta
cp graphify-out/{graph.html,graph.json,GRAPH_REPORT.md,manifest.json} \
   <repo>/docs/reference/mem0-oss/graphify-out/
```

Para actualizar cuando suba la versión de `mem0ai`: repetir con el nuevo paquete
instalado.

## Hallazgos clave (verificados contra el fuente)

- `add()` → `parse_vision_messages()` → `get_image_description()`: **mem0 v3 ingesta
  imágenes** (las describe con VLM antes de extraer). No es text-only.
- `add()` → `addToVectorStore()`: extracción (`generateAdditiveExtractionPrompt` +
  `FactRetrievalSchema`) → `.search()` similares → decisión → `createMemory`/`update`.
- **Sobre Qdrant NO hay BM25**: `Qdrant.keywordSearch()` devuelve `null` (solo
  `MemoryVectorStore`/`PGVector`/`AzureAISearch` lo implementan). En Savia (Qdrant),
  la búsqueda de mem0 es **densa + entidades**, no híbrida.
- Entity store = **NLP local** (`extractProper`/`extractQuoted`/`extractCompounds*` +
  lemmatización), no un LLM-KG. Cimiento crudo para `follow`.
- `timestamp` / `referenceDate` / `updateProject({decay})` **lanzan error** en OSS —
  son features Platform-only, no ganchos usables.
- **Nuevo en 3.1.0 — rerankers**: subsistema opt-in (`cohere`/`zero_entropy`/
  cross-encoder local/`llm_reranker`), invocado como Step 10 de `search` con
  `rerank: true`. Llena el hueco de "search sin reranker".
- **Nuevo en 3.1.0 — expiración**: `expiration_date` (YYYY-MM-DD) oculta memorias de
  `search`/`getAll` salvo `showExpired`. TTL real (a diferencia de `timestamp`).

Detalle completo y verificado en [`mem0-oss-end-to-end.md`](./mem0-oss-end-to-end.md).

Ver `docs/product/savia-b2b-legacy/01-vision.md` (en reescritura limpia en `docs/product/savia-b2b/`) para cómo esto afecta el diseño de Savia.
