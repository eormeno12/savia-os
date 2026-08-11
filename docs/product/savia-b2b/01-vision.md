# 01 — Visión de producto

> El norte estratégico: qué es Savia, qué problema ataca, y con qué capas lo
> resuelve. El resto de la carpeta concreta esta visión en vocabulario, modelo
> de datos, mecánica de cada capa y arquitectura. Lo que todavía está en
> exploración se marca como tal al final — no debe leerse como comprometido.

**Savia es el cerebro ejecutable, compartido y sincronizado de cada empresa.**
Un cerebro que capta el conocimiento disperso de la organización, lo conecta,
y evoluciona con ella.

---

## El problema

La IA ya es lo bastante buena para automatizar gran parte del trabajo de una
empresa. Lo que la frena **ya no son los modelos** — es el **conocimiento del
dominio**. Cómo se maneja una devolución, cómo se decide un precio
preferencial para un cliente, cómo responde el equipo a una casuística: ese
know-how crítico está **desperdigado**. Vive en las cabezas de la gente, en
chats de Slack, correos viejos, tickets de soporte, bases de datos, y en
archivos de colaboradores que ya se fueron. Las empresas funcionan porque hay
un sistema y porque las personas recuerdan —*vagamente*— ese conocimiento y
cómo aplicarlo.

Esa vaguedad es tolerable mientras el que ejecuta es humano. Deja de serlo en
el momento en que se le pide a una IA que corra el proceso: para automatizar
hace falta una versión precisa, verificable y actualizada de cómo funciona la
empresa. Esa capa hoy no existe.

## Qué quiere ser Savia

> **Savia es la capa que organiza el conocimiento disperso de una empresa y
> lo transforma en memoria confiable para la IA.**

Extrae el know-how repartido en las fuentes que la empresa ya usa, lo
estructura, lo mantiene vigente, y lo convierte en **skills ejecutables** que
cualquier IA puede consumir para hacer el trabajo de forma **rápida, segura y
consistente**.

Lo que Savia **no** es, y es clave: no es búsqueda corporativa, ni un chatbot
sobre documentos. Es un **mapa vivo de cómo funciona la empresa**, que provee
contexto crítico a las IAs que la empresa ya tiene.

## La apuesta distintiva: bottom-up

Casi todos los que persiguen esto lo hacen top-down: apuntan a todo el
Slack/Drive/DBs de la empresa y construyen un índice central. Savia apuesta al
revés, y ahí está su ventaja: **el conocimiento vive primero en las personas.**

Savia arranca desde la memoria de cada persona y, vía lo colaborativo, el
cerebro de la organización **emerge**. Cada quien tiene su memoria; cuando
comparten y colaboran, Savia **sintetiza** lo común en los procesos de la
empresa.

Lo que emerge de abajo hacia arriba no es la organización como estructura
—toda persona trabaja dentro de una desde el primer día, aunque sea de una
sola— sino el cerebro colectivo: el conocimiento compartido y los skills que
solo existen cuando hay varias personas aportando.

Eso da dos cosas que un enfoque top-down no tiene:

- **Fidelidad** a dónde el conocimiento realmente vive — incluido lo tácito,
  que no está escrito en ninguna fuente.
- **Entrada viral** (PLG): una persona adopta Savia por su propio valor,
  invita a su equipo, y la organización crece desde adentro — sin depender de
  una venta enterprise pesada. Es cómo crecieron Slack, Notion y Figma.

**Límite honesto:** un cerebro de empresa no es la simple unión de los
cerebros personales. Parte del conocimiento está enterrado en fuentes que
nadie recuerda (hace falta ingesta directa a nivel organización), el mapa de
procesos es *emergente* (no está completo en ninguna cabeza), y automatizar
exige **una** versión canónica. Por eso el bottom-up es la cuña de entrada y
el motor de captación, pero el producto es la **síntesis** que reconcilia todo
en procesos autoritativos (Capa 4).

---

## El stack de capas

```
  Modalidad   texto · documentos · hojas de cálculo · imágenes · video/audio
  Canal       chat · frontend · carpeta local (sync) · conectores (sync continuo)
                                       │
                                       ▼
┌───────────────────────────────────────────────────────────────────┐
│  1. CAPTACIÓN MULTIMODAL                                          │
│     cualquier contenido, por cualquier canal → mismo grafo        │
│     cada pieza = ⟨π hechos, σ coordenadas, activo original⟩        │
├───────────────────────────────────────────────────────────────────┤
│  2. MEMORIA                                                       │
│     substrato unificado, buscable (difuso) y direccionable        │
│     (exacto), sin alucinar, con procedencia                       │
├───────────────────────────────────────────────────────────────────┤
│  3. GOBERNANZA                                                    │
│     quién y qué agente ve qué (punto único de control, roles,     │
│     sensibilidad)                                                 │
├───────────────────────────────────────────────────────────────────┤
│  4. SÍNTESIS                                        ← el producto │
│     memoria → procesos canónicos → skills ejecutables             │
├───────────────────────────────────────────────────────────────────┤
│  5. CONSUMO                                                       │
│     MCP: skills (resources) + retrieval (tools), gobernado        │
│     por-caller, auditado, BYO-LLM                                 │
└───────────────────────────────────────────────────────────────────┘
        ⇅ eje transversal: ESCALA bottom-up (persona → equipo → organización)
```

### Capa 1 — Captación multimodal

Savia ingesta cualquier tipo de contenido, desde cualquier canal, y lo lleva
al mismo grafo. **Qué tipo de contenido es** y **por dónde entró** son dos
preguntas distintas, y el diseño las mantiene separadas a propósito: el mismo
documento puede llegar por cualquier canal, y un canal puede traer cualquier
modalidad.

**Modalidad — qué tipo de contenido es.** Cada pieza se proyecta a tres cosas:

- **π (hechos)** — la verbalización del contenido en proposiciones, para
  encontrarlo por significado.
- **σ (coordenadas nativas)** — la dirección exacta de cada unidad dentro de
  su fuente, para poder apuntar con precisión.
- **activo original** — el verbatim, para verificar y mostrar.

| Modalidad | π (cómo se vuelve hechos) | σ (coordenada) |
|---|---|---|
| Texto | ya es texto / extracción | fuente + tiempo |
| Documentos | chunk → extracción | página, bbox |
| Hojas de cálculo | serializar fila | hoja, fila, columna + valor exacto |
| Imágenes | caption + OCR | bbox |
| Video / audio | transcripción + keyframes | t_inicio, t_fin |

El invariante que evita el Frankenstein: **el tipo vive solo en el adapter de
captación (su π y su σ). Una vez ingestado, un hecho salido de un video y uno
salido de un chat son el mismo objeto.** Soportar un tipo nuevo se reduce a
escribir un adapter — no toca las capas 2 a 5.

El **canal visual** (embedding multimodal, multi-vector) se usa **solo** donde
el layout *es* significado —imágenes, keyframes, páginas densas—, no en todo
el contenido.

**Canal de entrada — por dónde llega.** Dos son de captación **activa**, donde
el usuario decide en el momento:

- **Chat** — conversacional, vía la IA que la persona ya usa. Texto, en tiempo
  real.
- **Frontend** — subida manual y deliberada, cualquier modalidad.

Y dos de captación **pasiva**, que una vez configuradas capturan solas:

- **Carpeta local** — una carpeta en la computadora del usuario que se
  sincroniza automáticamente con Savia: un agente liviano observa los cambios
  y sube lo nuevo. Es **unidireccional** por diseño: la carpeta es del
  usuario y es autoritativa, Savia nunca escribe ahí. Lo que Savia produce a
  partir de esa memoria se ofrece aparte, como un **espejo de solo lectura**
  — nunca se fusiona con los archivos originales.
- **Conectores** (Slack, Gmail, Drive, Notion) — sincronización continua que
  además espeja los permisos del sistema de origen, y por eso toca directo la
  Capa 3.

### Capa 2 — Memoria

Un substrato unificado donde **todo es memoria**, sin importar de qué
modalidad o canal vino. Se recupera de dos formas complementarias:

- **Difusa / semántica** — "qué se sabe sobre X" (búsqueda por parecido).
- **Exacta / direccionable** — "el valor de la celda Y" (lookup por
  coordenada σ).

La memoria no se guarda como una lista plana: se organiza sola en clústeres
semánticos que se reacomodan a medida que entra contenido nuevo, sin que
nadie tenga que mantener carpetas a mano.

Principio irrenunciable: **fidelidad sin alucinación** — toda respuesta puede
volver a su fuente original y verificarse. Ese rigor, que en memoria personal
podría parecer excesivo, en automatización empresarial es *el* requisito: no
se pueden automatizar reembolsos sobre conocimiento inventado.

### Capa 3 — Gobernanza

Un **único punto de control** decide qué ve cada persona, rol o agente:
sensibilidad, fronteras, permisos. Es lo que la mayoría de los "cerebros de
empresa" no tiene, y lo que hunde las ventas enterprise. En B2B se extiende a
roles de organización y a **gobernanza a nivel de skill**: quién puede
invocar qué proceso.

### Capa 4 — Síntesis (el producto)

Convierte el conjunto de memoria —personal, colaborativa y de fuentes— en
**procesos canónicos y ejecutables**. Ya no solo *qué es verdad* (los hechos
de la Capa 1), sino **cómo se hacen las cosas**: conocimiento procedimental,
que no está escrito en ninguna fuente única y hay que reconstruir.

Reconcilia las vistas parciales de mucha gente en **una** versión
autoritativa, porque para automatizar la empresa necesita una sola respuesta
a "cómo se manejan los reembolsos", no diez contradictorias. Un skill
sintetizado lleva: pasos, reglas de decisión, actores y sistemas
involucrados, políticas y restricciones, **procedencia** y
**versión/vigencia**.

Es el corazón del producto, y el problema más difícil del stack: reconciliar
memoria **entre personas** es cualitativamente distinto de organizar la
memoria de un solo individuo.

### Capa 5 — Consumo

El LLM que la empresa ya usa se conecta por **MCP**:

- Los **skills** se sirven como **resources**: un catálogo de metadata liviana
  siempre disponible, y el contenido completo bajo demanda. Nunca una tool por
  skill — no escala.
- El **retrieval** se expone como tools: búsqueda difusa, navegación exacta, y
  escritura de memoria nueva.
- **Progressive disclosure**: el agente carga solo el catálogo y jala el skill
  relevante cuando aparece la tarea que lo necesita.
- Todo **gobernado por-caller** (reusando la Capa 3) y **auditado**.
- **BYO-LLM**: no se le pide a la empresa adoptar una IA nueva; Savia se
  enchufa a la que ya tiene. Una conexión a nivel organización y toda la IA de
  la empresa hereda el cerebro.

Las **acciones** —emitir el reembolso, actualizar el ticket— las ejecuta el
agente llamando a los sistemas de la empresa. Savia **instruye**; la empresa
**ejecuta**.

---

## Por qué Savia puede ganar

- **Rigor como cimiento** — la fidelidad y la procedencia son lo que permite
  *automatizar* sobre Savia, no solo *consultar*. Es el requisito que la
  mayoría subestima.
- **Gobernanza como cimiento** — el activo difícil de replicar, y el que abre
  la puerta enterprise.
- **La síntesis es el producto** — de conocimiento disperso a skill canónico
  ejecutable. Ahí está el foso.
- **Consumo sin fricción** — MCP universal y BYO-LLM: cero costo de adopción
  del lado de la IA.
- **Entrada bottom-up** — captura lo tácito y aterriza por PLG.

## Hacia dónde va

**De memoria personal a cerebro organizacional.** El mismo stack opera a
escala persona, equipo y organización; lo colaborativo hace subir el
conocimiento de un nivel al siguiente.

**De asistido a autónomo**, en dos etapas:

- *Asistido* (copiloto experto): un humano pregunta, Savia responde con el
  procedimiento y sus fuentes, el humano ejecuta. Riesgo bajo — es el punto
  de entrada.
- *Autónomo* (ejecutor): el agente corre el proceso de punta a punta. Es la
  visión completa de automatización confiable, y depende de tres condiciones:
  confianza acumulada en el skill, integración real con los sistemas de la
  empresa, y garantías de seguridad.

---

## En exploración (aún no decidido)

El *cómo* profundo de indexar y recuperar cualquier información con exactitud
sigue abierto. Líneas activas:

- Representación como **fibrado**: base discreta exacta (coordenadas σ) ×
  fibra semántica (embedding); la query como operador sobre ambos factores.
- Separación **π/σ** más el activo original; búsqueda exacta resuelta como
  índice discreto (no como operación vectorial); búsqueda difusa como espacio
  compuesto multi-canal con fusión por rango.
- **Multimodal**: encoder de mercado más un adapter propio, frente a
  soluciones especializadas en localización visual fina. El foso está en la
  **estructura** —procedencia, tiempo, asociación, acceso—, no en el encoder.
- Huecos identificados: **temporalidad** (validez bi-temporal) y **traversal
  por entidades** (multi-hop).

## En una frase

**Savia quiere ser el cerebro ejecutable de cada empresa — captando todo su
conocimiento, venga en el formato que venga; recordándolo con fidelidad y
gobernanza; destilándolo en skills que cualquier IA ejecuta de forma segura; y
construido bottom-up, desde las personas hacia la organización.**
