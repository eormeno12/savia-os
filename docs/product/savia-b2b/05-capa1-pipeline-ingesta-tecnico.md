# 04 — Capa 1: Pipeline de ingesta (técnico)

> Estado: 🟡 diseño de la ingesta multi-formato ya avanzado (revisión 3, validado) — pendiente de implementar y de conectar con el resto del pipeline (colas, escala, permisos)
> Capa: 1 — Captación multimodal ([company-brain.md](01-vision.md))
> Responde a: ¿cómo funciona técnicamente el pipeline que convierte una fuente
> cruda en memoria indexada?

## Por qué existe este documento

Este era uno de los dos huecos técnicos señalados directamente al crear esta
carpeta: el pipeline de ingesta real (colas, parsers, workers, reintentos) no
estaba documentado en ningún lugar como flujo end-to-end. Ya existe una
respuesta parcial y sólida para la primera mitad del problema (cómo se
traduce un archivo a una representación estructurada) — este documento la
incorpora y deja claro qué queda todavía sin resolver (colas, escala,
permisos, conexión con Capa 2).

## Insumos existentes a revisar

- **[`docs/product/savia-b2b/apx-ingesta-pipeline-adapter-ir.md`](apx-ingesta-pipeline-adapter-ir.md)**
  — diseño completo del patrón Adapter para ingesta multi-formato (revisión 3,
  ya validado con panel adversarial). Fuente de toda la sección siguiente.
- `apps/api/src/modules/ingest/` (`chunk.ts`, y lo que quedó de
  `parsers/index.ts` — aparece eliminado en el `git status` reciente).
- `apps/api/RUNBOOK.md` — `OutboxRelay` y `RetentionWorker`, la parte del
  pipeline aguas abajo de la ingesta (Postgres → Qdrant).

## Diseño validado: patrón Adapter + IR multi-formato

**Estado del diseño:** documento de diseño, sin código escrito todavía. Pasó
por un proceso de validación poco común — 6 diseños ciegos independientes
(agentes sin acceso al documento) más un panel de refutadores y jueces — y se
va a probar aislado en un paquete nuevo (`apps/demo-pipeline`), **sin tocar
`apps/api` hasta que se valide**. Resume así el problema que ataca:

> `apps/api/src/modules/ingest/parsers/index.ts` es hoy un `switch` sobre
> `mimeType` que aplana **todo a un string plano** (`parseFile(buffer,
> mimeType): Promise<string>`), y `chunk.ts` corta ese string a ciegas por
> caracteres. La estructura se pierde antes de que nadie pueda usarla, y sumar
> un formato nuevo significa editar un switch compartido.

### El modelo — tres ejes ortogonales

En vez de un tipo por formato, cada elemento de cualquier documento se
proyecta sobre tres ejes independientes:

- **Forma** (`ContentKind`) — 5 primitivas cerradas y verificadas por el
  compilador: `text_span` (prosa normalizable), `verbatim` (código/preformateado,
  **no** se puede colapsar espacios ni cortar por oración sin producir un
  resultado incorrecto), `asset` (imagen/audio/video), `grid` (tabla/hoja de
  cálculo — **el piso de la traducción**, donde la coordenada fila/columna es
  la verdad), `container` (contención lógica sin coordenada completa).
- **Vocabulario** (`SemanticLabel`) — abierto, advisory (`heading`,
  `paragraph`, `caption`, `list`...). Nunca valida forma — es lo que un
  formato nuevo puede aportar sin tocar el núcleo.
- **Cohesión** (`Cohesion`) — cerrado, obligatorio, y es **la única decisión
  que el chunker realmente toma**: `atomic` (nunca se parte: código, grillas,
  un asset), `splittable` (prosa, se puede cortar por oración), `lead` (abre
  un chunk y nunca lo cierra: un heading), `satellite` (no viaja solo: un
  caption, una nota al pie).

Este tercer eje (cohesión) es el hallazgo más directamente útil para
[`consumers/chunk.ts`]: hoy el chunking corta a ciegas por caracteres; con
cohesión, el corte respeta la estructura real del documento sin que el
chunker tenga que conocer el vocabulario de cada formato.

### Identidad — no la asigna el adapter

El hallazgo más importante del proceso de validación (6/6 de los diseños
ciegos lo objetaron de forma independiente): **la identidad de un elemento no
es una propiedad que el adapter pueda asignar al traducir un documento** —
es el resultado de reconciliar **dos versiones** del mismo documento. El
mecanismo (`core/reconcile.ts`):

1. **Anclaje por hash único** — se ancla solo por `contentHash` que aparece
   exactamente una vez en cada lado (evita el bug de "bolsa global" que
   transfiere identidad al elemento equivocado en silencio).
2. **Similitud confinada a los huecos** entre anclas consecutivas (típicamente
   1-5 elementos por lado) — ahí se resuelve el caso "movido y editado a la
   vez", que el modelo de diff anterior no podía ni siquiera representar.
3. **Movimientos sobre el residuo.**

Precondición dura: la ruta estructural de un elemento debe indexarse **por
padre**, nunca por posición global — si no, insertar un elemento al principio
de una sección corre la identidad de todos los elementos posteriores del
documento entero, no solo de esa sección.

### Coordenadas — texto canónico + tres espacios de rango

No existe un "texto canónico" previo al que referenciar offsets — hay que
fabricarlo, con hash y versión propios (`TextLayer`). Sobre eso, cada
elemento tiene **una sola** coordenada de origen (`SourceRange`), nunca
varias contradictorias:

```
{ space: 'text',     start, end }        — offset sobre el texto canónico
{ space: 'fragment', conformsTo: 'media-frags', value }  — recorte de media
{ space: 'grid',     row, col }           — coordenada de grilla
```

**Esto es, en la práctica, una implementación concreta de la σ (coordenadas)
que [company-brain.md](01-vision.md) deja "en exploración"**
— ver la nota en [07-capa2-memoria-arquitectura-tecnica.md](07-capa2-memoria-arquitectura-tecnica.md).

### La celda de grilla — autocontenida por invariante

Cada celda de una tabla/hoja lleva su propio texto **aplanado y
determinístico** (`GridCell.text`, nunca vacío salvo que la celda esté vacía
de verdad), con la regla rectora: *una grilla completa debe poder
serializarse sin resolver un solo detalle referenciado.* Evita el bug de
tablas con agujeros + contenido duplicado/perdido en un anexo aparte — el
caso de falla concreto que el diseño identificó: una celda vacía en la tabla
con su contenido en otro lado es **peor** que la duplicación, porque el chunk
embebido de la tabla pierde la fila que lo hacía recuperable en una búsqueda.

### Poda → marcado, no descarte

Cambio de diseño relevante: en vez de descartar contenido de baja calidad
(navegación, chrome de página) al ingestar, el adapter lo **marca**
(`label: 'chrome'`, con confianza) y el descarte pasa a ser una **política de
consumo**, no una decisión irreversible tomada en el momento de la ingesta.
Motivo: la poda es la única fuente de ruido que un mecanismo de
reconciliación de identidad no puede distinguir de una edición real entre
versiones.

### Contrato de un adapter nuevo

Un adapter implementa `supports(probe)` (autoselección por score, no un
switch central) y `translate(input, ctx)`, donde `ctx.emit` es la única
forma de producir elementos (`container/text/verbatim/grid/asset/choice/property`).
El adapter **nunca fabrica un elemento directamente** — solo emite *drafts*
estrictamente más pobres que el núcleo enriquece. Este es el contrato que
resuelve el pedido original de la visión: "soportar un tipo nuevo = escribir
un adapter, no tocar las capas 2-5".

### Validación

Plan de pruebas T1-T17 (compilación, aislamiento, identidad, calidad de
frontera de chunk) más una regla explícita de **anti-evidencia** — qué
*no* cuenta como prueba de que el diseño funciona (que compile, que la demo
"se vea bien", que dos adapters produzcan la misma forma, que la cobertura
sea alta). El umbral de similitud para el matching de identidad **no se fija
por decreto** — se mide empíricamente sobre fixtures (T9) y el default sale
de esa medición, no de una justificación elaborada sin dato.

## Lo que este diseño deja explícitamente abierto

- **`DocumentLineageId`** — el sistema no sabe hoy que un archivo subido es
  una nueva versión de otro ya ingestado (en `apps/api/src/modules/ingest/`
  la unidad es `fileId`; un re-upload es un archivo *nuevo* y el processor
  borra la versión anterior antes de poder calcular identidad). Sin esto, la
  reconciliación de identidad es una capacidad diseñada pero no ejercitable
  en producción. Tres caminos evaluados — ver el registro completo en
  [19-decisiones-abiertas.md](19-decisiones-abiertas.md#gaps-de-la-ingesta-multi-formato).
- Un tercer adapter (más allá de HTML y notas de texto) **sin implementarlo
  todavía** — idealmente uno grid-nativo (XLSX, donde la hoja *es* la
  grilla) o temporal (audio con timestamps), porque es lo único que puede
  falsar el diseño real (dos adapters de flujo de texto no lo hacen).
- Fallas conocidas y aceptadas por ahora: grillas completas como "documento
  entero" para formatos donde la grilla *es* el documento (XLSX — ver
  [07](07-capa2-memoria-arquitectura-tecnica.md) para el impacto en
  multimodalidad), ambigüedad grid-vs-container sin pasar por el mecanismo de
  `choice`, deuda de emisor de stream para adapters de audio/video en vivo.

## Temas a cubrir (más allá de lo ya diseñado)

### Conexión con el resto del pipeline
- [ ] Cómo el output de este diseño (`TranslationResult`: elementos +
      diagnostics + report) se conecta con la extracción de hechos (mem0),
      el embedding y la escritura en `MemoryIndex`/Qdrant — hoy el diseño
      llega hasta la representación estructurada, no hasta la memoria
      indexada.
- [ ] Qué pasa con `OutboxRelay`/`RetentionWorker` (ya documentados en
      RUNBOOK.md) en esta nueva forma — ¿siguen igual, cambia el payload que
      viaja?

### Colas, reintentos y fallas (sin diseño propio todavía)
- [ ] Qué cola/worker procesa qué (confirmar módulos BullMQ activos tras el
      redesign).
- [ ] Política de reintentos y backoff para la ingesta (RUNBOOK.md ya
      documenta el patrón del Outbox — ¿aplica igual acá?).

### Escala a nivel organización
- [ ] Volumen: ingestar una organización entera (histórico de Slack, por
      ejemplo) vs un usuario subiendo archivos uno por uno.
- [ ] Rate limits de APIs externas (Slack/Gmail/Drive) sin bloquear la cola
      de otros usuarios/organizaciones.

### Adapters por modalidad restantes
- [ ] Hojas de cálculo (el diseño ya cubre `grid` como primitiva — falta el
      adapter concreto de XLSX).
- [ ] Imágenes (caption + OCR), video/audio (transcripción + keyframes),
      conectores (mensaje → extracción) — cada uno como adapter nuevo sobre
      el contrato ya definido.

### Permisos en el momento de ingesta
- [ ] Cómo se captura y almacena el permiso original de cada elemento (para
      que Capa 3 lo use después).

## Decisiones tomadas

- **2026-07-27** — el diseño se copió de `~/.claude/plans/` (carpeta personal,
  no versionada) a
  [`docs/product/savia-b2b/apx-ingesta-pipeline-adapter-ir.md`](apx-ingesta-pipeline-adapter-ir.md),
  junto a `motor-v2.md` (mismo formato as-built/diseño verificado). Queda
  persistido con el proyecto.

_(vacío — el diseño de arriba está validado pero no implementado; pasa acá
cuando el código exista en `apps/demo-pipeline` y, más adelante, en
`apps/api`)_
