# 01 — Savia: visión de producto (Company Brain)

> Archivo 01 de [`docs/product/savia-b2b/`](00-overview.md) — el resto de la
> carpeta (02-19 + apéndices técnicos) concreta esta visión en modelo de
> datos, roles, mecánica de cada capa y arquitectura real. Ver
> [18-estado-actual-vs-propuesto.md](18-estado-actual-vs-propuesto.md) para
> qué de todo esto ya existe en código.

> Qué quiere lograr Savia y con qué capas. Este documento es la dirección de
> producto B2B: Savia como el **cerebro ejecutable, compartido y sincronizado de cada empresa**. Es la
> evolución de la memoria tradicional en documentos y archivos dispersos (`docs/plan/savia-mvp/`) hacia el conocimiento
> organizacional estructurado. El *qué* y las *capas* están definidos aquí; el *cómo* profundo
> de indexar/recuperar (la matemática de retrieval multimodal) sigue en
> exploración y se marca como tal al final. Es decir, un cerebro que conecta todo y evoluciona en el tiempo.

---

## El problema

La IA ya es lo bastante buena para automatizar gran parte del trabajo de una
empresa. Lo que la frena **ya no son los modelos** — es el **conocimiento del
dominio**. Cómo se maneja una devolución, cómo se decide un precio preferencial para un cliente,
cómo responde el equipo a una casuística: ese know-how crítico está **desperdigado**
— en las cabezas de la gente, en chats de Slack, correos viejos, tickets de soporte,
bases de datos e incluso antiguos archivos de colaboradores que ya se fueron. Las empresas funcionan porque
tienen un sistema y las personas recuerdan *vagamente* dicho conocimiento y cómo aplicarlo.

Para que una empresa adopte IA eficientemente debe adaptar sus procesos. Para correr automatizaciones,
obtener data en segundos y mantener información crítica hace falta una capa que hoy no existe: **un cerebro de la
empresa.**

## Qué quiere ser Savia

> **Savia es la capa que organiza el conocimiento disperso de una empresa y
> lo transforma en memoria confiable para la IA.**

Extrae el know-how repartido en diversas fuentes, lo estructura, mantiene vigente
y lo convierte en **skills ejecutables** que cualquier IA puede consumir
para hacer el trabajo de la empresa de forma **rápida, segura y consistente**.

Lo que Savia **no** es (y es clave): no es búsqueda corporativa, ni un chatbot
sobre documentos. Es un **mapa vivo de cómo funciona la empresa**, que provee contexto crítico a las
IAs que la empresa ya usa.

## La apuesta distintiva: bottom-up

Casi todos los que persiguen esto lo hacen top-down: apuntan a todo el
Slack/Drive/DBs de la empresa y construyen un índice central. Savia apuesta al
revés, y es su ventaja: **el conocimiento vive primero en las personas.**

Savia arranca desde la **memoria de cada persona** —lo que ya es hoy: la memoria
que conecta todas tus IAs— y vía lo **colaborativo**, el cerebro de la
organización **emerge**. Cada persona tiene su memoria; cuando comparten y
colaboran, Savia **sintetiza** el conocimiento común en los procesos de la empresa.

Esto da dos cosas que un enfoque top-down no tiene:

- **Fidelidad** a dónde el conocimiento realmente vive (en la gente, incluido lo
  tácito).
- **Entrada viral** (PLG): los individuos adoptan, los equipos se conectan, la
  organización aparece — sin la venta top-down brutal. Es cómo ganaron Slack,
  Notion, Figma.

**Límite honesto:** un company brain no es la simple unión de brains personales.
Parte del conocimiento está enterrado en fuentes que nadie recuerda (necesita
ingesta org-level directa), el mapa de procesos es *emergente* (no está completo
en ninguna cabeza), y la automatización exige **una** versión canónica. Por eso el
bottom-up es el **wedge e ingesta**, pero el producto es la **síntesis** que
reconcilia todo en procesos autoritativos (Capa 4).

---

## El stack de capas

```
  texto/chat  documentos  hojas cálculo  imágenes  video/audio  conectores
   (memorias) (PDF/DOCX/MD)(Excel/CSV)   (fotos/    (reuniones/  (Slack/Gmail/
      │           │            │          gráficos)   podcasts)    Drive/Notion)
      └───────────┴────────────┴──────┬─────┴──────────┴────────────┘
                                       ▼
┌───────────────────────────────────────────────────────────────────┐
│  1. CAPTACIÓN MULTIMODAL                                          │
│     cualquier fuente → mismo grafo                                │
│     cada tipo = ⟨π hechos, σ coordenadas, activo original⟩         │
├───────────────────────────────────────────────────────────────────┤
│  2. MEMORIA                                                       │
│     substrato unificado, buscable (fuzzy) y direccionable         │
│     (exacto), sin alucinar, con procedencia                       │
├───────────────────────────────────────────────────────────────────┤
│  3. GOBERNANZA                                                    │
│     quién/qué agente ve qué (chokepoint de acceso, roles,         │
│     sensibilidad)                                                 │
├───────────────────────────────────────────────────────────────────┤
│  4. SÍNTESIS                                        ← el producto │
│     memoria → procesos canónicos → skills ejecutables (la 3ª π)   │
├───────────────────────────────────────────────────────────────────┤
│  5. CONSUMO                                                       │
│     MCP: skills (resources) + retrieval (tools), gobernado        │
│     por-caller, audit, BYO-LLM                                    │
└───────────────────────────────────────────────────────────────────┘
        ⇅ eje transversal: ESCALA bottom-up (persona → equipo → organización)
```

### Capa 1 — Captación multimodal

Savia ingesta **cualquier tipo de información** y lo lleva al mismo grafo. Cada
tipo se proyecta a tres cosas:

- **π (hechos)** — la verbalización del contenido en proposiciones, para
  encontrar por significado.
- **σ (coordenadas nativas)** — la dirección exacta de cada unidad dentro de su
  fuente, para direccionar con precisión.
- **activo original** — el verbatim, en S3, para verificar y mostrar.

El invariante que evita el Frankenstein: **el tipo vive solo en el adapter de
captación (su π y su σ). Una vez ingestado, un hecho de un video y un hecho de un
chat son el mismo objeto.** Soportar un tipo nuevo = escribir un adapter, no tocar
las capas 2–5.

| Modalidad | π (cómo se vuelve hechos) | σ (coordenada) | Estado |
|---|---|---|---|
| Texto / chat | ya es texto / extracción | — (fuente + tiempo) | ✅ existe |
| Documentos | chunk → extracción | (página, bbox) | ⚠️ parcial (parse+chunk) |
| Hojas de cálculo | serializar fila | (hoja, fila, col) + valor exacto | ⬜ nuevo |
| Imágenes | caption + OCR | (bbox) | ⬜ nuevo |
| Video / audio | transcripción + keyframes | (t_inicio, t_fin) | ⬜ nuevo |
| Conectores | mensaje → extracción | (canal, thread, ts) | ⬜ nuevo · **sync continuo** |

El **canal visual** (embedding multimodal tipo Embed 4 / multi-vector) se usa
**solo** donde el layout *es* significado (imágenes, keyframes, páginas densas),
no en todo el contenido. Los **conectores** no son "un tipo más": traen sync
continuo + espejar los permisos de la fuente, y tocan directo la Capa 3.

### Capa 2 — Memoria

Un substrato unificado donde **todo es memoria**. Se recupera de dos formas
complementarias:

- **Difusa / semántica** — "qué se sabe sobre X" (búsqueda por parecido).
- **Exacta / direccionable** — "el valor en la celda Y" (lookup por coordenada).

Principio irrenunciable: **fidelidad sin alucinación** — cada respuesta puede
volver a su fuente original y verificarse. Ese rigor, que en memoria personal
parecía de más, en automatización empresarial es *el requisito*: no se puede
automatizar reembolsos sobre conocimiento que inventa.

### Capa 3 — Gobernanza

Un **único punto de control** decide qué ve cada persona, rol o agente:
sensibilidad, fronteras, permisos. Es lo que la mayoría de los "company brain" no
tiene y lo que hunde las ventas enterprise — y Savia **ya lo tiene construido y
auditado**. En B2B se extiende a roles de organización y a **gobernanza a nivel de
skill** (quién puede invocar qué proceso).

### Capa 4 — Síntesis (el producto)

Convierte el montón de memoria (personal + colaborativa + fuentes) en **procesos
canónicos y ejecutables**: no solo *qué es verdad* (hechos), sino **cómo se hacen
las cosas** (procedimientos — la tercera proyección, además de π/σ).

Reconcilia las vistas parciales de mucha gente en **una** versión autoritativa —
porque para automatizar, la empresa necesita una sola respuesta a "cómo se manejan
los reembolsos", no diez contradictorias. Un skill sintetizado lleva: pasos,
reglas de decisión, actores/sistemas, políticas/restricciones, **procedencia** y
**versión/vigencia**.

Es el corazón del producto y **lo que mayormente falta construir**. El motor de
clustering actual es un cimiento parcial de organización, no de síntesis
procedimental.

### Capa 5 — Consumo

El LLM que la empresa ya usa se conecta por **MCP**:

- Los **skills** se sirven como **resources** (catálogo de metadata liviana
  siempre disponible vía `resources/list`; contenido completo on-demand vía
  `resources/read`) — nunca como una tool por skill (no escala). Opcional: una
  meta-tool dispatcher (`savia_find_skill`).
- El **retrieval** se expone como tools (`savia_search` hoy; `browse`/`fetch` a
  futuro) + `savia_remember` para escribir.
- **Progressive disclosure**: el agente carga solo metadata y jala el skill
  relevante automáticamente cuando aparece la tarea.
- Todo **gobernado por-caller** (reusando la Capa 3) y con **audit**.
- **BYO-LLM**: no se le pide a la empresa adoptar una IA nueva; Savia se enchufa a
  la que ya tiene. Una conexión org-level y toda la IA de la empresa hereda el
  cerebro.

Las **acciones** (emitir el refund en Stripe, actualizar el ticket) las ejecuta el
agente llamando los MCP tools **de la empresa**. Savia **instruye**; los sistemas
de la empresa **ejecutan**.

---

## Por qué Savia puede ganar

- **Rigor como cimiento** — la fidelidad y la procedencia permiten *automatizar*
  sobre Savia, no solo *consultar*. El requisito que la mayoría subestima.
- **Gobernanza ya construida** — el activo difícil de replicar que abre la puerta
  enterprise.
- **La síntesis es el producto** — de conocimiento disperso a skill canónico
  ejecutable. Ahí está el foso, y es lo que YC pide.
- **Consumo sin fricción** — MCP universal + BYO-LLM.
- **Entrada bottom-up** — capturás lo tácito y aterrizás por PLG.

## Hacia dónde va

- **De memoria personal → cerebro organizacional** — el mismo stack opera a escala
  persona, equipo y organización; lo colaborativo hace subir el conocimiento.
- **De asistido → autónomo**:
  - *Asistido* (copiloto experto): un humano pregunta, Savia da la procedura con
    fuentes, el humano ejecuta. **Viable hoy, riesgo bajo** — el beachhead.
  - *Autónomo* (ejecutor): el agente corre el proceso end-to-end. La visión
    completa de "automatización confiable", gated por confianza + integración +
    seguridad.

---

## Estado actual (honesto)

| Capa | Estado |
|---|---|
| 1. Captación | ✅ texto/PDF/DOCX · ⬜ multimodal (hojas, imágenes, video/audio) + conectores |
| 2. Memoria | ✅ mem0/Qdrant/motor/`savia_search` · ⬜ exacto/`browse`, canales, direccionamiento σ |
| 3. Gobernanza | ✅ **construido y auditado** · ⬜ roles org + gobernanza de skills |
| 4. Síntesis | 🔶 **núcleo del producto — mayormente por construir** |
| 5. Consumo | ✅ MCP server + `search`/`remember` + audit · ⬜ catálogo de skills + gobernanza de skills |
| Eje bottom-up | ✅ federación/grupos/fragmentos (compartir) · ⬜ síntesis entre personas + tenant org-first |

**Lectura:** el *cuerpo* (capas 1-3, 5) está construido o es incremental; la
*mente* (Capa 4, síntesis de skills) es el build central que convierte a Savia de
"memoria" en "cerebro de la empresa".

---

## En exploración (aún no decidido)

El *cómo* profundo de indexar y recuperar cualquier información con exactitud y
elegancia sigue abierto y **no debe leerse como comprometido**. Líneas activas:

- Representación como **fibrado**: base discreta exacta (coordenadas σ) × fibra
  semántica (embedding); la query como operador sobre factores.
- Split **π/σ** + activo; búsqueda exacta como **índice discreto** (no operación
  vectorial); búsqueda difusa como espacio compuesto multi-canal + fusión por
  rango.
- **Multimodal**: encoder commodity (Embed 4 / abierto) + adapter propietario, vs.
  soluciones tipo ColPali/RegionRAG para localización visual fina. El moat es la
  **estructura** (procedencia, tiempo, asociación, acceso), no el encoder.
- Huecos identificados: **temporalidad** (validez bi-temporal) y **`follow`**
  (traversal por entidades / multi-hop).

Ver la conversación de diseño y los prompts de exploración para el detalle.

---

## En una frase

**Savia quiere ser el cerebro ejecutable de cada empresa — captando todo su
conocimiento, venga en el formato que venga; recordándolo con fidelidad y
gobernanza; destilándolo en skills que cualquier IA ejecuta de forma segura; y
construido bottom-up, desde las personas hacia la organización.**
