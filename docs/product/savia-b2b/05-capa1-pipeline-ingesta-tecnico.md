# 05 — Capa 1: Pipeline de ingesta documental (técnico)

> Cómo se convierte un documento de cualquier formato en memoria utilizable,
> sin que sumar un formato nuevo obligue a tocar el resto del sistema.
> Implementa lo definido en [04](04-capa1-captacion-modelo.md).
>
> **Alcance: documentos** — archivos con estructura interna. Los flujos de
> eventos (mensajes de chat, correos como conversación) son piezas diminutas,
> continuas y ya estructuradas, y tienen su propio camino en
> [05b](05b-capa1-flujos-eventos-tecnico.md).
>
> ⚠️ **Este diseño no se implementa todavía.** Fija el contrato de salida del
> pipeline —qué forma tienen los hechos y los fragmentos que llegan a la
> memoria— sin conocer del todo a su consumidor: la síntesis (Capa 4) aún no
> está diseñada. Conviene diseñar `10`/`11` primero, verificar que lo que sale
> de acá le sirve, y recién entonces construir. Ver §14.
>
> 🔴 **Superado en parte por
> [`borrador-pipeline-tecnico.md`](borrador-pipeline-tecnico.md) (2026-08-06).**
> El borrador rediseñó el tramo que va del archivo crudo a la representación
> intermedia y llegó a un modelo distinto del de §2–§6 de este documento:
> **seis formas** en vez de cinco (agrega `fields`), pipeline explícito de once
> tramos, y `tipo` como **conjunto cerrado** de 17 valores — donde §3 de acá
> todavía lo describe como vocabulario abierto. Para el diseño vigente de
> recepción, selección, reconocimiento y traducción, **la fuente es el
> borrador**. Este documento se reescribe desde él cuando cierren los tramos
> 5–11; hasta entonces, lo de §7 en adelante sigue en pie pero conviene leerlo
> sabiendo que su base cambió.

---

## 1. El problema

La forma obvia de aceptar muchos formatos es una función que reciba un archivo
y devuelva texto —`parse(buffer, mimeType) → string`, con un `switch` sobre el
tipo— y después cortar ese texto por cantidad de caracteres.

Falla en dos frentes a la vez:

- **Se pierde información antes de que nadie pueda usarla.** Una tabla aplanada
  a texto deja de ser una tabla: la relación fila-columna, que es justamente lo
  que la hacía consultable con precisión, desaparece en el primer paso. Lo
  mismo con el código —donde el espaciado es significativo— y con la jerarquía
  de secciones.
- **Sumar un formato obliga a editar código compartido.** Ese `switch` central
  crece con cada tipo nuevo, y cada cambio arriesga los formatos que ya
  funcionaban.

**La tesis que ordena el diseño:** cada formato de documento no es más que una
forma distinta de organizar los mismos tipos de contenido. Si se desgranan en
bloques, se procesa cada tipo de bloque una sola vez, y un formato queda
reducido a *la instrucción de cómo reconocer sus bloques*.

Es la misma arquitectura de los compiladores modernos: N lenguajes × M
arquitecturas es insostenible, y con una representación intermedia en el medio
se vuelve N + M. Acá: N formatos × M tipos de contenido → N + M.

**Y una aclaración de propósito, porque ordena todas las decisiones que
siguen:** el objetivo del pipeline no es representar documentos con fidelidad,
es convertirlos en conocimiento. La estructura del documento importa en la
medida en que (a) le dice al fragmentador dónde puede cortar y (b) provee la
coordenada que hace verificable un hecho. Lo que no sirva a esas dos cosas es
peso muerto.

---

## 2. Anatomía: reconocedor, bloque, traductor

```
fuente → [reconocedor] → bloques tipados → [traductor por tipo] → representación intermedia
          ↑ varía por formato              ↑ compartido entre formatos
```

**Reconocedor** — propio de cada familia de formatos. Es el único lugar del
sistema con conocimiento del formato. Convierte la fuente en bloques tipados.

**Traductor** — uno por tipo de contenido, compartido por todos los formatos.
Recibe el contenido crudo que el reconocedor encontró y lo emite como elementos
de la representación intermedia.

```
traducirTabla(celdas, ubicacion, pistas, ctx)
traducirTexto(texto, pistas, ubicacion, ctx)
traducirCampos(pares, ubicacion, ctx)
traducirAsset(bytes, ubicacion, ctx)
```

**El reconocedor los llama directo.** No hay un tipo `Bloque` formal ni un
despacho intermedio: el reconocedor ya sabe qué encontró, así que invoca al
traductor que corresponde. Se conserva toda la reutilización con una
representación menos.

Los bloques tipados como dato explícito solo ganan su lugar en dos situaciones
puntuales, y ahí se usan sin volverlos la columna vertebral del diseño:

- **Delegación entre niveles** — el reconocedor visual devuelve lo que
  encontró para que se vuelva a despachar (§5), en lugar de traducirlo él mismo.
- **Testeo aislado del reconocedor** — poder aseverar "este PDF produce estos
  bloques" sin ejecutar traductores.

El vocabulario de tipos coincide con las formas de la representación intermedia
(§3). No es casualidad: las formas existen porque son los modos distintos en que
el contenido se comporta, y un reconocedor no puede encontrar nada que no caiga
en alguno.

### El reconocedor produce estructura, no solo bloques

Un reconocedor tiene **dos trabajos**: identificar los bloques *y* su
anidamiento y orden. Un epígrafe pertenece a la imagen de arriba; un título
gobierna los párrafos que siguen. Esas relaciones son las que después hacen
recuperable un fragmento — "treinta días de preaviso" sin el rastro
"Contrato > Rescisión" es un hecho casi inútil.

### Por qué el traductor se comparte, y qué gana

Seguí la misma tabla llegando de cuatro orígenes:

| Origen | Qué hace el reconocedor | Qué le pasa al traductor de tabla |
|---|---|---|
| **HTML** | Búsqueda por etiqueta: encuentra `<table>` | celdas |
| **XLSX** | Escanea la hoja: filas en blanco, cambios de esquema → N tablas | celdas |
| **Factura escaneada** | Modelo de layout sobre píxeles, OCR por celda | celdas |
| **PDF con texto** | Agrupa runs por posición, detecta alineación en columnas | celdas |

**El traductor de tabla es el mismo en los cuatro casos.** Toda la maquinaria
de §4 —regiones, grano, composición de filas, ventaneo, identidad por hash— se
escribe una vez. Sin esto, cada reconocedor la reimplementaría, y las
reimplementaciones divergen: una tabla escaneada terminaría con peor
direccionamiento que la misma tabla en un `.xlsx` sin ninguna razón de fondo.

Lo que sí cambia entre los cuatro es la **certeza**: HTML declara, así que el
bloque no lleva confianza; el OCR infiere, así que la lleva. Mismo traductor,
distinta procedencia de la estructura.

### Es un juego de herramientas, no un contrato obligatorio

Un reconocedor puede saltearse los traductores y llamar al emisor directo si le
conviene. La reutilización se gana porque es más cómoda que reimplementar, no
porque esté impuesta — si se vuelve obligatoria aparece la ceremonia vacía y la
tentación de meter en el contrato común cosas que solo le sirven a un formato.

**Las pistas son el punto de fuga a vigilar.** Los traductores necesitan
señales que solo el reconocedor tiene (filas en blanco en XLSX, confianza por
celda en OCR). Eso es legítimo, pero si el canal de pistas se vuelve un
diccionario libre, termina siendo `metadata: cualquier cosa` con otro nombre —
exactamente lo que §3 rechaza. Las pistas son vocabulario **cerrado y chico**,
con la misma regla de admisión que las formas: existe si algún traductor
ramifica por ella.

### El contrato de un formato

Dicho de la forma más simple: **el reconocedor de un formato es el contrato de
cómo ese formato entrega cada tipo de contenido.** Y ese contrato tiene dos
partes, no una — qué tipo es cada cosa, *y* cómo se relacionan entre sí. Un PDF
no trae "texto e imágenes" sueltos: los trae en un orden de lectura, con
secciones que gobiernan párrafos y epígrafes que pertenecen a una figura.

Lo que hace sostenible la promesa de soportar cualquier formato es la
consecuencia inversa: cuando se mejora el traductor de tablas —mejor detección
de regiones, mejor manejo de encabezados jerárquicos— **mejoran todos los
formatos a la vez**, incluidos los escritos antes de esa mejora.

---

## 3. La representación intermedia: tres ejes ortogonales

Un elemento se describe por tres ejes independientes. Mezclarlos es el error
clásico: termina en un vocabulario enorme donde cada formato agrega sus casos y
nadie puede consumirlo exhaustivamente.

### Eje 1 — Forma: cerrado y chico

Cinco primitivas, con regla de admisión estricta: **una forma existe si y solo
si algún consumidor necesita ramificar distinto por ella.**

| Forma | Qué es | Por qué es su propia forma |
|---|---|---|
| `text_span` | Prosa normalizable | El caso general: se puede colapsar espacios y cortar por oración |
| `verbatim` | Código, preformateado, fórmulas | El espaciado **es** contenido: colapsarlo o cortar por oración da un resultado incorrecto, no peor |
| `asset` | Imagen, audio, video | Su contenido textual no existe hasta intentar extraerlo, y esa extracción puede fallar |
| `grid` | Tabla, hoja de cálculo | Coordenada bidimensional propia; se descompone en regiones (§4) |
| `fields` | Pares etiqueta-valor: encabezado de factura, formulario, ficha | Cada par es independiente y la relación etiqueta→valor es lo que lo hace consultable |
| `container` | Sección, lista, cita | Agrupa otros elementos por referencia, sin contenido propio |

Cerrado significa que agregar una forma rompe la compilación en todos los
consumidores. Es deliberado: si aparece una forma nueva, todo el que consuma la
representación tiene que decidir explícitamente qué hace con ella.

**Sobre `fields`.** Es la estructura más común en documentos de negocio —"Número:
12345 · Vencimiento: 30 días · Total: $4.500"— y no encaja en ninguna otra
forma: no es prosa (no se corta por oración) ni es una grilla (los pares son
independientes, no filas de un conjunto homogéneo). Califica bajo la regla de
admisión porque el extractor de hechos ramifica por ella: igual que las filas
tabulares, un par etiqueta-valor **se compone de forma determinística sin pasar
por un modelo** (§8). Forzarla a `text_span` perdería justamente la relación
que la hace consultable; forzarla a `grid` de dos columnas le impondría una
semántica de conjunto homogéneo que no tiene.

### Eje 2 — Vocabulario: abierto y consultivo

`heading`, `paragraph`, `caption`, `list`, `code`… Etiqueta libre que **nunca
determina el comportamiento del núcleo**. Un reconocedor puede inventar
etiquetas sin coordinar con nadie, porque ningún consumidor tiene permitido
ramificar por ellas.

Si un consumidor necesitara ramificar por vocabulario, eso significa que falta
un eje cerrado — no que haya que cerrar el vocabulario.

### Eje 3 — Cohesión: cerrado y obligatorio

Es la única decisión que el fragmentador realmente toma, y por eso es explícita
en vez de deducirse del vocabulario:

| Cohesión | Regla de corte |
|---|---|
| `atomic` | No se parte nunca — código, una tabla, un asset |
| `splittable` | Se puede partir por oración — prosa |
| `lead` | Abre un fragmento y nunca lo cierra — un título |
| `satellite` | No viaja solo — un epígrafe, una atribución |

Sin este eje, el fragmentador tendría que codificar el vocabulario de cada
reconocedor dentro del núcleo, que es exactamente la fuga que el diseño evita.

### Salida plana, jerarquía por referencia

El resultado es una **lista plana** ordenada por posición de lectura. La
jerarquía existe por referencia (`parentId`), nunca por anidamiento físico: un
consumidor que recorre una lista no puede olvidarse una rama, mientras que con
estructuras anidadas cada consumidor reimplementa su propio recorrido y cada
uno tiene sus bugs.

La jerarquía gana su lugar por una razón concreta: da el rastro de migas
—"Contrato > Cláusulas > Rescisión"— que acompaña a cada fragmento y mejora
sustancialmente la recuperación.

**Y se detiene donde la relación deja de ser contención.** Una celda no es un
elemento: no tiene identidad propia ni padre, porque su relación con la grilla
es de coordenada, no de contención. Eso impide que una tabla de 30×40 genere
1200 elementos que nadie puede consumir.

### Coordenadas: para verificar, no para anotar

Cada memoria tiene que poder volver a su fuente. La coordenada útil para eso es
**la que una persona puede leer y comprobar** — un sistema de offsets exactos
sobre texto canónico versionado paga en una interfaz de resaltado fino, no acá.

Cada elemento lleva **exactamente una** coordenada, de tres espacios:

```
'text'      → página y posición dentro del documento
'fragment'  → intervalo temporal (audio, video) o recuadro (imagen)
'grid'      → hoja, región, fila y columna
```

Una sola, no una lista: un elemento con dos coordenadas puede tenerlas
contradictorias, y ningún tipo lo impediría.

La de grilla es la que más peso carga, porque habilita la recuperación exacta
que promete la Capa 2 —"el valor de la celda Y"—. Incluye la región porque sin
ella "fila 14" es ambiguo en una hoja con tres tablas apiladas.

---

## 4. Grillas: regiones y grano

Las tablas son contenido central en B2B y no todas son la misma cosa:

- **Datos tabulares** — encabezado y filas homogéneas. Cada fila es un registro.
- **Documento maquetado en grilla** — un modelo financiero, un presupuesto con
  celdas fusionadas. La estructura espacial *es* el significado, y partirlo por
  filas lo destruye.

Una grilla se descompone en **regiones**: áreas rectangulares con esquema
coherente. Una tabla simple tiene una; una hoja con tres tablas apiladas tiene
tres; un modelo maquetado tiene una sin esquema.

Cada región declara su **grano**:

| Grano | Cuándo | Unidad resultante |
|---|---|---|
| `row` | Hay encabezado y filas homogéneas | Cada fila es un registro direccionable |
| `whole` | No hay esquema detectable | La región entera, atómica |

### Dos granularidades, dos propósitos

La Capa 2 promete dos formas de recuperar —difusa y exacta— y la tabla es el
caso donde necesitan granularidad **distinta**:

| Propósito | Unidad | Por qué |
|---|---|---|
| Direccionamiento exacto | La fila | "La fecha de renovación del contrato de Acme" apunta a una fila concreta |
| Recuperación semántica | Ventana de N filas + encabezado | Una fila suelta es un vector de baja información; N filas con su esquema responden algo |

**La fila es la unidad de identidad y direccionamiento; la ventana es la unidad
de embedding.** No compiten: la ventana es una agrupación de filas.

### Identidad estable bajo inserción

La identidad de una fila es el hash de su contenido, y la ventana se define por
*qué filas contiene*, nunca por posición ordinal.

Eso vuelve inofensiva la inserción, que es el modo de falla clásico de
cualquier bandeo por conteo: al insertar una fila en el medio, esa fila es
nueva, se une a una ventana, y se reprocesa esa ventana. Las demás conservan su
hash y su conjunto. **No hay renumeración en cascada.**

### Detección de esquema

El reconocedor declara `inferred` y adjunta confianza. Señales: primera fila de
texto sobre columnas de tipo homogéneo, formato de encabezado marcado en el
archivo, cambio de tipo por columna a partir de cierta fila. Las celdas
fusionadas dentro de una supuesta región tabular bajan la confianza — son la
señal más común de que no hay esquema.

**El degradado es seguro:** si la detección falla, la región se trata como
`whole`. Se pierde el direccionamiento fino, no la ingesta. Los dos errores no
son simétricos: no detectar una tabla degrada; inventar una tabla donde no la
hay produce filas sin sentido.

### Lo que hay que aceptar

- **Una planilla de 50.000 filas produce 50.000 registros.** Es correcto: eso
  *es* el conocimiento que contiene. Hay un límite explícito por documento, y
  al superarlo se **rechaza con mensaje claro**, nunca se trunca en silencio —
  un truncado silencioso produce una memoria que se cree completa y no lo está.
- **Fórmulas.** El valor va como contenido —es lo que se consulta— y la fórmula
  como propiedad de la celda, porque a veces la lógica *es* el conocimiento
  buscado.

---

## 5. Assets: envase, no modalidad

`text_span`, `grid` y `verbatim` describen *qué es* el contenido. "Imagen"
describe un **envase**. Un mismo `.png` puede ser una foto de pizarra, el
escaneo de una factura, la captura de un tablero, o una foto de producto.

Por eso una imagen no es un elemento hoja: **es una fuente que se reconoce**,
igual que un PDF.

```
imagen → reconocedor visual
           ├── detecta tabla          → traductor de tabla  → grid
           ├── detecta pares etiqueta-valor → traductor de campos → fields
           ├── detecta bloques texto  → traductor de texto  → text_span
           ├── detecta diagrama       → asset + descripción
           └── no detecta nada        → asset solo
```

La factura escaneada es el caso que ejercita casi todo el diseño de una vez:
sus datos de cabecera salen como `fields`, su detalle como `grid` con grano de
fila, y ambos se componen en hechos sin pasar por un modelo — pese a que la
fuente eran píxeles.

Cada elemento derivado lleva su recuadro como coordenada. **Y la imagen
original siempre se conserva como `asset`**, porque es el activo verificable:
la fidelidad de la Capa 2 exige que un hecho pueda volver a su fuente, y la
fuente acá es el píxel, no el OCR.

Esto desbloquea el PDF escaneado, que es de los casos más comunes en B2B: el
reconocedor de PDF encuentra una página sin capa de texto y **delega en el
visual**, que emite la grilla de la factura. El de PDF no sabe nada de OCR ni
de detección de tablas — la composición sale del modelo, no de código especial.

La ambigüedad tiene mecanismo: una captura de tabla puede ser legítimamente
`asset` o `grid`, y para eso existe `choice` (§6) — se emiten ambos candidatos
en lugar de que el reconocedor elija en silencio.

---

## 6. El contrato de emisión

Un reconocedor —o el traductor que actúa por él— **no construye elementos**:
emite *borradores* estrictamente más pobres. No puede asignar identidad, ni
secuencia, ni hash: esos campos no existen en el tipo del borrador, y el
constructor del elemento completo vive en el núcleo y no se exporta. Es
imposibilidad, no disciplina.

```ts
interface Emitter {
  container(draft, body: (emit) => Promise<void>): Promise<LocalKey>;
  text(draft): Promise<LocalKey>;
  verbatim(draft): Promise<LocalKey>;
  grid(draft): Promise<LocalKey>;        // sin `body`: el piso de la traducción
  asset(draft, extraction): Promise<LocalKey>;
  choice(candidates): Promise<LocalKey>; // ≥2 interpretaciones posibles
  property(p): void;                     // metadato de documento, no crea elemento
}
```

### La pila de scopes

```ts
await emit.container(seccionDraft, async (emit) => {
  await emit.text(tituloDraft);       // padre = la sección
  await emit.text(parrafoDraft);      // padre = la sección
});
await emit.text(siguienteDraft);      // padre = lo que hubiera antes
```

El núcleo apila al entrar al cuerpo y desapila al salir; el `parentId` es el
tope de la pila al momento de emitir. **El árbol nunca existe como estructura
de datos: es el anidamiento léxico de los callbacks.** Eso vuelve imposibles
por construcción tres errores que de otro modo hay que validar: padre
inexistente, ciclo, o hijo emitido antes que su padre.

### Quién pone qué

| Lo pone el emisor (borrador) | Lo pone el núcleo (elemento) |
|---|---|
| `label` — vocabulario libre | `id` — identidad |
| `cohesion` — regla de corte | `parentId` — del tope de la pila |
| `range` — coordenada de origen | `sequence` — contador monótono |
| El contenido según la forma | `depth`, `siblingIndex` — de la pila |
| | `contentHash` — computado del contenido |

`emit` devuelve una `LocalKey`, válida solo dentro de esa corrida, para
referenciar algo ya emitido. No es identidad persistente.

### Dos casos que rompen el patrón simple

- **La grilla no tiene `body`.** No es una convención documentada: el método no
  acepta ese argumento. La estructura interna (regiones, filas, celdas) viaja
  *dentro del borrador* como datos declarados, no como elementos emitidos. Por
  eso la celda nunca puede volverse elemento aunque alguien se lo proponga.
- **El asset necesita el resultado antes de emitir.** `emit.asset(draft,
  extraction)` recibe la extracción ya hecha, porque la forma del elemento
  depende de si funcionó, falló o no se intentó. Casi todo se decide mirando el
  nodo —variante declarada, mapa total verificado en compilación—, pero esta
  rama se resuelve en tiempo de ejecución.

### El hash exige contenido determinístico

El núcleo computa `contentHash` serializando el contenido de forma canónica.
Eso impone una regla hacia atrás: **nada dentro del contenido puede ser no
determinístico**. Un resumen generado por un modelo metido dentro del texto de
una celda haría que dos ingestas del mismo archivo dieran hashes distintos, y
todo el mecanismo de re-ingesta dejaría de funcionar en silencio.

---

## 7. El pipeline completo

```
archivo
  │
  ├─ 1  RECEPCIÓN          original a almacenamiento · hash de archivo · registro del documento
  │
  ├─ 2  SELECCIÓN          cada reconocedor puntúa la entrada; gana el mayor
  │                        ninguno responde → piso universal (texto plano)
  │
  ├─ 3  RECONOCIMIENTO     fuente → bloques tipados + anidamiento + ubicación + pistas + confianza
  │      ↺ puede delegar hacia abajo (página sin capa de texto → perceptual)
  │
  ├─ 4  TRADUCCIÓN         despacho por tipo → traductores compartidos → borradores
  │
  ├─ 5  EMISIÓN            pila de scopes → id · secuencia · padre · hash  ⇒  LISTA PLANA
  │
  ├─ 6  VALIDACIÓN         integridad referencial · orden topológico · unicidad
  │
  ├─ 7  FRAGMENTACIÓN      prosa   → corte por cohesión + rastro de migas
  │                        tabular → filas (registros) + ventanas (fragmentos)
  │
  ├─ 8  DIFERENCIA         hash por fragmento contra la versión previa
  │      └── sin cambios → SALTAR (no se extrae, no se embebe, no se paga)
  │
  ├─ 9  EXTRACCIÓN         prosa   → modelo → hechos
  │                        tabular → composición determinística → hechos
  │
  ├─ 10 CLASIFICACIÓN      sensibilidad automática sobre cada hecho
  │
  ├─ 11 EMBEDDINGS         fragmentos de prosa y ventanas tabulares
  │
  ├─ 12 PERSISTENCIA       una transacción: hechos + membresías + evento de salida
  │
  └─ 13 MOTOR              encola el refinamiento de clustering
```

**Validación (6)** es barata y vale la pena: verifica que cada `parentId`
exista, que el orden sea topológicamente coherente y que no haya identificadores
repetidos. Es la red que atrapa un reconocedor mal escrito antes de que su error
se propague a la memoria.

**Diferencia (8)** es donde está el ahorro: los fragmentos cuyo hash ya existe
se saltan enteros, porque sus hechos y sus vectores siguen siendo válidos. En un
documento donde se editó un párrafo, se procesa un fragmento en lugar de
doscientos.

### Tres cosas que el diagrama hace visibles

**El pipeline se parte en dos mitades.** Los tramos 1-8 son determinísticos y
sin red: mismo archivo, mismo resultado, testeables con archivos de prueba sin
infraestructura. Los tramos 9-11 llaman modelos.

Esa frontera —**entre 8 y 9**— es exactamente donde iría la tokenización si
algún día se adopta la arquitectura de "el dato crudo nunca sale" (ver
[04](04-capa1-captacion-modelo.md)). El diseño cae en ese punto de corte solo.

**Las dos búsquedas de la Capa 2 nacen en tramos distintos.** La difusa sale de
los embeddings del tramo 11; la exacta sale de los registros del tramo 7, que
ni siquiera pasan por un modelo. Son caminos separados desde el origen.

**El costo se concentra en 9-11.** Todo lo anterior es cómputo local barato. Por
eso el tramo 8 es el que más ahorra: cada fragmento que saltea es una llamada a
modelo y un embedding que no se pagan.

---

## 8. De fragmentos a hechos

Es la frontera donde Savia se juega la calidad.

El fragmentador recorre la lista plana y corta **por cohesión**, no por
cantidad de caracteres: nunca parte un elemento atómico, nunca deja un título
cerrando un fragmento, nunca manda un satélite solo. Cada fragmento arrastra su
rastro de migas y su coordenada.

Después, un modelo extrae hechos de cada fragmento. Ese paso impone dos
condiciones hacia atrás:

- **El fragmento tiene que ser autosuficiente.** Un modelo que recibe "…y en ese
  caso son treinta días" sin el rastro de migas produce un hecho inútil o, peor,
  incorrecto. Por eso el contexto jerárquico viaja *con* el fragmento.
- **La extracción no es determinística.** Dos corridas sobre el mismo fragmento
  pueden producir proposiciones distintas.

### Lo estructurado no pasa por el modelo

Dos formas producen hechos **sin ninguna llamada a un modelo**, porque el hecho
ya está formado y solo hay que componerlo:

- **Filas de una región con esquema** — "Cliente: Acme Corp. Contrato: $50.000.
  Renovación: marzo", componiendo encabezado y valores.
- **Pares etiqueta-valor** (`fields`) — "Vencimiento de la factura 12345: 30
  días", componiendo etiqueta y valor con el contexto del documento.

No es solo más barato: es **más fiel**. No hay paso de inferencia, así que no
hay riesgo de que el modelo invente, omita o reinterprete — y en documentos de
negocio el dato que más importa suele ser justamente un número o una fecha,
donde alucinar es catastrófico. Al ser determinístico, además, dos ingestas del
mismo dato producen exactamente el mismo hecho.

Es el camino de extracción exacta por construcción, y conviene protegerlo:
cualquier tentación futura de "mejorar" estas formas pasándolas por un modelo
estaría cambiando fidelidad garantizada por fluidez.

### La cadena de procedencia

Cada hecho conserva la coordenada de su fragmento, y esa es la cadena completa:

```
hecho → fragmento → elemento → coordenada → documento original
```

---

## 9. Re-ingesta

Cuando llega una versión nueva, la pregunta práctica es **qué hace falta volver
a procesar** — extraer y embeber cuesta dinero y tiempo, y la mayor parte de un
documento editado no cambió.

El mecanismo es el hash por fragmento del tramo 8. Los que ya existen se saltan;
los nuevos o modificados se procesan; los que ya no aparecen se archivan.
Funciona igual si el contenido se movió de lugar, porque el hash no depende de
la posición.

**Por qué no algo más sofisticado.** Existe una familia de técnicas
—alineamiento por anclas, similitud confinada, umbrales calibrados— que además
resuelven "este elemento se movió *y* se editó", preservando identidad a través
de la edición. Es lo que hace una herramienta de diff, y es correcto para ese
problema.

Acá no paga: **entre el elemento y la memoria hay una extracción por modelo que
no es determinística.** Aunque identificaras perfectamente que el elemento 17 es
el mismo pero editado, volver a extraer puede producir proposiciones distintas —
la identidad del elemento no se propaga a la de la memoria. Y en el único caso
donde el alineamiento fino supera al hash (movido *y* editado), igual hay que
reprocesar porque cambió.

Queda documentado como extensión si aparece un caso que la pida — por ejemplo,
una interfaz que muestre la evolución de un documento en el tiempo.

### La poda marca, no descarta

Todo reconocedor de formatos con presentación necesita descartar ruido:
navegación, banners, decoración. Pero filtrar es **heurístico y destructivo a
través de versiones**: si la heurística clasifica un bloque como navegación en
una versión del reconocedor y como contenido en la siguiente, ese fragmento
aparece de la nada en la re-ingesta y se reprocesa sin que nada lo explique.

Entonces el reconocedor **marca** el bloque, y el descarte pasa a ser política
de consumo. El resultado por defecto no cambia; lo que cambia es que la decisión
es reversible sin re-ingerir.

---

## 10. Estrategia de formatos

### Lo propio es la representación; el reconocimiento es commodity

El reconocimiento —parsear formatos, detectar layout, encontrar tablas— es un
problema resuelto por el mercado: hay servicios que entregan elementos
normalizados para decenas de formatos, con equipos dedicados a mejorar sus
modelos a tiempo completo.

Entonces la postura por defecto es **comprar el reconocimiento y construir la
excepción**, no al revés. Se construye un reconocedor propio cuando el
proveedor es flojo para un formato que importa, cuando el volumen hace que el
costo por documento deje de cerrar, o cuando el formato es tan específico del
cliente que nadie lo cubre.

Lo que **no** se compra nunca es lo que viene después: la representación
intermedia y los traductores. Ahí vive el criterio propio de Savia sobre qué es
conocimiento —qué merece ser un hecho, qué es direccionable, qué se compone sin
modelo— y es exactamente lo que ningún proveedor entrega, porque su salida es
con forma de documento, no con forma de conocimiento.

La arquitectura hace esto barato: el reconocedor es un límite reemplazable,
porque lo que cruza esa frontera son tipos de contenido, no formatos. Se puede
empezar con un proveedor y traerlo adentro después sin tocar un solo traductor.

Lo que sigue —niveles, cobertura, orden— aplica igual se construya o se compre:
describe **qué capacidad de reconocimiento hace falta**, no quién la escribe.

### Tres niveles, que son una escalera de degradación

No hay N formatos: hay **tres formas de averiguar la estructura**.

| Nivel | Cómo se obtiene la estructura | Costo |
|---|---|---|
| **Declarativo** | El formato la dice | Tabla de búsqueda |
| **Posicional** | Hay geometría, no semántica | Agrupamiento por posición |
| **Perceptual** | Solo píxeles o señal | Modelo |

No son categorías estancas: un PDF usa el posicional y cae al perceptual en las
páginas sin capa de texto; un XLSX es declarativo para la grilla y posicional
para detectar regiones. Cada reconocedor es **un eslabón con un plan B**.

### Cuántos reconocedores, y por qué son pocos

Se organizan por **cómo se descubre la estructura, no por extensión**. Muchas
extensiones caen en el mismo reconocedor porque, una vez decodificadas, el
problema es idéntico.

| Reconocedor | Cubre | Nivel |
|---|---|---|
| Marcado declarativo | HTML, Markdown, texto estructurado | Declarativo |
| Documento ofimático | DOCX, ODT, RTF | Declarativo |
| Tabular | XLSX, CSV, TSV, ODS | Declarativo |
| Presentación | PPTX | Declarativo |
| PDF | PDF con capa de texto | Posicional |
| Visual | PNG, JPG, TIFF, HEIC, WebP, páginas escaneadas | Perceptual |
| Temporal | MP3, WAV, MP4, MOV | Perceptual |
| Contenedor | Email (.eml, .msg), ZIP | Delegante |

Cinco extensiones de imagen son **un solo reconocedor**: decodificar a píxeles
es un paso trivial previo, y a partir de ahí el problema es el mismo. La
extensión habla de codificación; el reconocedor, de descubrimiento de
estructura.

**Los contenedores delegan.** El reconocedor de correo no entiende nada del
contenido: identifica los miembros y **vuelve a entrar por el tramo 2** para
cada uno. Un correo con un PDF adjunto termina procesado por el reconocedor de
PDF, sin que el de correo sepa qué es un PDF.

**Regla de admisión:** un reconocedor nuevo existe si y solo si descubre la
estructura de una forma que ninguno de los existentes sabe hacer. Sumar `.odt`
al ofimático es agregar un caso, no un reconocedor.

### La cobertura se mide en niveles, no en formatos

Con un reconocedor por nivel, agregar formatos *dentro* de un nivel es
incremental. Pero si falta un nivel, **toda una clase de contenido es
inalcanzable** — y en B2B la clase perceptual incluye los escaneos, que son
buena parte de los contratos y facturas que circulan.

Es mejor tener los tres niveles a calidad media que uno solo perfecto.

### Qué significa "soportado": el gradiente honesto

| Escalón | Qué funciona |
|---|---|
| **1 · Ingestado** | El contenido entra y es buscable |
| **2 · Estructurado** | Las tablas son tablas, los títulos son títulos |
| **3 · Direccionable** | Las coordenadas exactas funcionan |
| **4 · Incremental** | Re-ingestar solo reprocesa lo que cambió |

Un reconocedor mínimo da el escalón 1 desde el día uno; los siguientes salen de
mejorarlo, sin tocar nada más del sistema. Permite lanzar temprano y subir, y
decirle al usuario con precisión qué funciona.

### El piso universal: nunca rechazar

Siempre hay camino para el formato desconocido: extraer el texto que se pueda,
emitirlo como bloques de texto, escalón 1. Alguien va a subir un formato
propietario de su industria y eso no puede terminar en un error.

Con una condición: **la degradación tiene que ser visible.** "Ingestado como
texto plano, sin estructura" es aceptable; "ingestado" a secas, ocultando que se
perdió una tabla, no lo es.

### Orden de habilitación

1. **Tabulares (CSV, XLSX)** — reconocimiento barato, extracción exacta por
   construcción, y ejercita el pipeline de punta a punta incluyendo regiones,
   grano y ventaneo. Es la validación más completa por el menor esfuerzo.
2. **Declarativos de texto (DOCX, HTML, Markdown)** — barato, y es donde vive
   el conocimiento procedimental que alimenta la síntesis.
3. **PDF con capa de texto** — costo medio, inevitable en B2B.
4. **Perceptual (escaneos, imágenes)** — caro, pero desbloquea una clase entera.
5. **Audio y video** — densidad baja por minuto procesado y costo alto; último.

Dos aclaraciones sobre este orden, porque el criterio se malinterpreta fácil:

**Tabulares va primero por costo y cobertura de prueba, no por valor de
producto.** Un export de CRM es dato de referencia; no se sintetiza en un
skill. El conocimiento procedimental —cómo se maneja una devolución— vive en
prosa, en documentos y en conversaciones. Lo tabular gana el primer puesto
porque es lo más barato que ejercita todo el pipeline, y porque hace real la
promesa de recuperación exacta.

**PDF no va primero aunque sea el formato más pedido.** Es de los más difíciles
de reconocer bien, y arrancar ahí gasta el presupuesto en el caso duro antes de
que el resto esté probado.

### Dónde encaja el enfoque multimodal directo

Existe una alternativa evidente: darle la página a un modelo multimodal y que
devuelva el contenido estructurado, sin pipeline de reconocimiento. Conviene
ubicarla en lugar de ignorarla.

Es **mejor** para documentos desordenados, donde no hay estructura declarada
que aprovechar. Y es **peor** justo donde este diseño más cuida: no es
determinístico —así que rompe la re-ingesta por hash—, no da coordenadas
confiables para direccionamiento exacto, y alucina en números y fechas, que es
donde más caro sale equivocarse en documentos de negocio.

La conclusión no es rechazarlo: **es la implementación natural del nivel
perceptual.** Un modelo multimodal es un excelente reconocedor visual. Lo que no
puede es reemplazar la representación intermedia ni la extracción determinística
de lo estructurado — que son, precisamente, las partes que le dan a Savia
fidelidad verificable.

---

## 11. Fallas conocidas

- **Detección de esquema imperfecta.** Una región tabular no detectada degrada a
  atómica. Al revés es peor: tratar como tabla algo maquetado produce "filas"
  sin sentido. Las señales ambiguas empujan hacia `whole`, el degradado seguro.
- **Relaciones que no son contención.** El modelo de bloques anidados expresa
  contención, pero hay vínculos que no lo son: una fórmula que referencia celdas
  de otra hoja, el orden de superposición de formas en una diapositiva, control
  de revisiones en Word. Quedan como residuo nombrado; la de fórmulas
  probablemente merezca mecanismo propio, porque en B2B la lógica de una
  planilla a veces *es* el conocimiento buscado.
- **Ambigüedad grilla contra contenedor.** `choice` cubre la ambigüedad entre
  hojas y grillas, pero decidir si un bloque HTML es tabla real o contenedor
  maquetado sigue siendo un descarte silencioso del reconocedor.
- **Duplicación en celdas ricas.** La regla "un elemento referenciado desde una
  celda no produce fragmento propio" no es expresable en el sistema de tipos.
- **Calidad perceptual variable.** Una tabla escaneada torcida produce una
  grilla imperfecta. El degradado seguro es el mismo: ante baja confianza,
  tratar como bloque de texto en vez de fabricar celdas inventadas.

---

## 12. Manejo de fallos

Ningún tramo falla en silencio:

- **Reconocimiento fallido** → cae al piso universal y **queda registrado qué se
  perdió**. Degradado visible, no error.
- **Extracción fallida** en un fragmento → ese fragmento se marca y reintenta;
  los demás siguen. Un fragmento no debe abortar el documento entero.
- **Modelo caído** → el documento queda en estado explícito de pendiente,
  reintentable, no perdido.
- **Límite de filas superado** → rechazo con mensaje claro, nunca truncado
  silencioso.

El reproceso es idempotente por el mismo mecanismo del tramo 8: reintentar no
duplica nada, porque los fragmentos ya procesados tienen el mismo hash y se
saltan.

---

## 13. Qué validar

| Vale | No vale |
|---|---|
| Que el resultado aguas abajo sea **idéntico** tras destruir todo rastro de origen sin tocar contenido | Que compile: prueba que existe un camino válido, no que los inválidos estén cerrados |
| Que agregar un reconocedor **no produzca diff** fuera de su carpeta y el registro | Que dos reconocedores produzcan la misma forma: es tautológico, lo impone la firma |
| Que re-ingestar con un párrafo editado reprocese **un** fragmento | Que la re-ingesta "funcione": sin medir cuánto se reprocesó, no dice nada |
| Que insertar una fila al principio de una planilla de 10.000 reprocese **una** ventana | Que la planilla "se ingeste": el problema nunca fue ingestarla, fue actualizarla |
| Que una fila tabular produzca el mismo hecho en dos corridas, byte a byte | Que el hecho "se vea bien": si pasó por un modelo, no es determinístico |
| Que ningún fragmento parta un átomo ni deje un satélite solo | Cobertura de líneas: mide ejecución, no ramas prohibidas |

**La prueba que falsa el diseño.** Construir tres reconocedores parecidos y
creer que la arquitectura está validada es el riesgo real: HTML + Markdown +
DOCX son todos flujo de texto declarativo, y que los tres funcionen no prueba
nada porque ninguno ejercita las partes difíciles.

La validación honesta exige, temprano, **un reconocedor de naturaleza
distinta**: uno tabular nativo (donde la grilla *es* el documento) o uno
temporal (donde la coordenada es tiempo). Si la representación intermedia se
rompe, se rompe ahí — y conviene descubrirlo con dos reconocedores escritos, no
con ocho.

---

## 14. Por qué esto no se implementa todavía

Este documento fija el **contrato de salida** del pipeline: qué forma tienen los
fragmentos y los hechos que llegan a la memoria. Pero su consumidor real no es
la memoria — es la síntesis (Capa 4), que es donde el producto se juega su
diferencia y que **todavía no está diseñada**.

Hay preguntas de la Capa 4 cuya respuesta cambia decisiones de acá:

- **Qué forma tiene un hecho.** Si la síntesis necesita hechos con estructura
  —actor, acción, condición— y no proposiciones libres, eso cambia el tramo 9.
- **Cuánto contexto necesita reconciliar.** Si para decidir que dos personas
  describen el mismo proceso hace falta más que el fragmento y su rastro de
  migas, cambia el tramo 7.
- **Si el fragmento es la unidad correcta.** La síntesis podría necesitar una
  unidad distinta —un procedimiento completo, que abarca varios fragmentos— y
  eso agregaría un nivel de agrupación que hoy no existe.

Construir este pipeline antes de responder eso es perfeccionar la entrada
mientras el corazón del producto sigue sin diseñar: el modo de falla clásico de
un sistema de conocimiento.

**El orden correcto es diseñar `10` y `11`, verificar contra ellos el contrato
de salida de acá, y recién entonces construir.** Es probable que la revisión
cambie algo, y es mucho más barato cambiarlo en un documento que en código.

---

## Decisiones tomadas

- **2026-07-29** — El pipeline se construye sobre reconocedor + traductores
  compartidos + representación intermedia, reemplazando el parseo plano a
  string. Un formato queda reducido a la instrucción de cómo reconocer sus
  bloques.
- **2026-07-29** — Los traductores por tipo de contenido son compartidos entre
  formatos: la lógica de tablas se escribe una vez y sirve venga la tabla de un
  XLSX, un HTML o un OCR. El reconocedor los invoca directo, sin un tipo
  `Bloque` formal ni despacho intermedio — los bloques tipados como dato solo
  se usan en delegación entre niveles y en testeo aislado.
- **2026-07-29** — Se agrega la forma `fields` (pares etiqueta-valor) por ser la
  estructura dominante en documentos de negocio —facturas, formularios, fichas—
  y porque el extractor ramifica por ella: se compone sin modelo, igual que las
  filas tabulares.
- **2026-07-29** — Las grillas se descomponen en regiones con grano declarado
  (`row` / `whole`). La fila es la unidad de identidad; la ventana de filas, la
  de embedding.
- **2026-07-29** — Lo estructurado —filas de regiones con esquema y pares
  etiqueta-valor— se convierte en hechos de forma determinística, sin pasar por
  un modelo. Es el camino de extracción exacta por construcción y se protege
  como tal.
- **2026-07-29** — La re-ingesta se resuelve por hash de contenido por
  fragmento, no por alineamiento fino entre versiones.
- **2026-07-29** — Las coordenadas se diseñan para verificación humana y
  recuperación exacta, no para anotación con precisión de carácter.
- **2026-07-29** — Los assets son envase, no modalidad: una imagen se reconoce
  como fuente y puede producir grillas o texto, conservando el original como
  ancla de procedencia.
- **2026-07-29** — Los reconocedores se organizan en tres niveles (declarativo,
  posicional, perceptual) que funcionan como escalera de degradación. La postura
  por defecto es **comprar el reconocimiento y construir la excepción**: es
  commodity de mercado. Lo propio e intransferible son la representación
  intermedia y los traductores.
- **2026-07-29** — El enfoque multimodal directo (un modelo lee la página y
  devuelve estructura) se adopta como **implementación del nivel perceptual**,
  no como alternativa a la arquitectura: no es determinístico, no da
  coordenadas confiables y alucina en números, así que no puede reemplazar la
  extracción determinística de lo estructurado.
- **2026-07-29** — Este diseño **no se implementa hasta diseñar la Capa 4**. Fija
  el contrato de salida sin conocer del todo a su consumidor; varias decisiones
  (forma del hecho, contexto para reconciliar, unidad de fragmentación) dependen
  de cómo funcione la síntesis. Ver §14.
