# 06 — Capa 2: Memoria (arquitectura técnica)

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 2 — Memoria ([company-brain.md](01-vision.md))
> Responde a: ¿cómo se implementa técnicamente el almacenamiento y la recuperación de memoria?

## Por qué existe este documento

La visión deja explícitamente "en exploración" el cómo profundo de indexar y
recuperar (sección final de `company-brain.md`: fibrado, split π/σ, encoder
multimodal). Este doc es donde esa exploración se va aterrizando a medida que
se decide, y donde se documenta lo que **ya existe** en producción.

## Insumos existentes a revisar

- `.claude/llms/mem0.txt` — Mem0 OSS/Platform, memory types, vector store
  config.
- `apps/api/src/common/clients/` (`redis.service.ts`; existía
  `qdrant.service.ts`, verificar si sigue vivo tras el redesign).
- `apps/api/prisma/schema.prisma` — modelo Postgres real (`MemoryIndex` y
  relacionados).
- Sección "En exploración" de `company-brain.md` (fibrado, π/σ, ColPali/
  RegionRAG, huecos de temporalidad y `follow`/multi-hop).

## Temas a cubrir

### Stack actual (documentar tal cual existe)
- [ ] Qué guarda Postgres vs qué guarda Qdrant vs qué guarda S3 — mapa de
      responsabilidades.
- [ ] Esquema de la colección Qdrant (`savia_memories`, payload `savia_*`
      mencionado en RUNBOOK.md) — campos reales.
- [ ] Modelo de embeddings usado hoy (proveedor, dimensiones).
- [ ] `OutboxRelay` — cómo Postgres (verdad del árbol) se reconcilia con
      Qdrant, qué pasa en un restore desfasado (ya documentado en RUNBOOK.md,
      referenciar en vez de duplicar).

### Split π / σ / activo original
- [x] **σ (coordenadas) tiene ya un candidato de diseño concreto** — ver
      [05-capa1-pipeline-ingesta-tecnico.md](05-capa1-pipeline-ingesta-tecnico.md):
      el diseño de pipeline multi-formato define `SourceRange` (unión cerrada
      `text` con offsets sobre un texto canónico versionado / `fragment` para
      media / `grid` para fila-columna) como la coordenada exacta de origen
      de cada elemento, más `ElementId` como handle estable de identidad a
      través de versiones del documento (vía reconciliación, no asignado por
      el adapter). Falta: conectar esto con el índice discreto de búsqueda
      exacta (todavía no existe un `lookup(SourceRange) → valor` real).
- [ ] Cómo se implementa π (hechos/embeddings) sobre la salida de ese pipeline
      — el diseño de 04 llega hasta `PublicDocElement[]` estructurado; falta
      definir el paso que extrae hechos verbalizados (π) a partir de eso.
- [ ] El activo original en S3 — cómo se referencia desde un `PublicDocElement`
      (¿el `MediaAsset` del diseño de 04 ya cubre esto para assets binarios?
      ¿y para el documento completo?).
- [ ] Búsqueda exacta como índice discreto (no vectorial) — diseño a definir
      sobre las coordenadas de `SourceRange`, hoy no existe.

### Multi-tenencia técnica (a nivel organización, no confundir con el
`is_tenant` de sharding actual)
- [ ] ¿Una colección Qdrant por organización, o payload filtering compartido?
- [ ] Aislamiento de datos entre organizaciones — requisito de seguridad duro
      para venta enterprise.
- [ ] Impacto en latencia/costo de escalar de "memoria de un usuario" a
      "memoria de una organización de 500 personas".

### Multimodal (futuro)
- [ ] Encoder commodity (Embed 4 / abierto) + adapter propietario, vs.
      soluciones tipo ColPali/RegionRAG para localización visual fina — la
      visión ya marca que el moat es la estructura, no el encoder; documentar
      la decisión cuando se tome.

### Huecos identificados en la visión
- [ ] Temporalidad (validez bi-temporal) — diseño a definir.
- [ ] `follow` (traversal por entidades / multi-hop) — diseño a definir.

## Preguntas abiertas

- ¿Este doc reemplaza o convive con `apx-motor-v2.md`? (motor-v2
  parece cubrir el motor de clustering, que es insumo de Capa 4, no de Capa 2 —
  confirmar el límite).

## Decisiones tomadas

_(vacío)_
