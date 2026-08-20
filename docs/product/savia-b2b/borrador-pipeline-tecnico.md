# Borrador — pipeline técnico de ingesta

> **Documento de trabajo.** Los tramos 1–6 están diseñados; 1–5 además simulados y
> con plan de implementación. Quedan ocho puntos abiertos, listados al final. El
> tramo 7 sigue sin diseñar. Al cerrarse, este material se reparte entre `05`
> (captación) y `06`/`07` (memoria).
>
> Revisión 2026-08-06: pasada de reducción — **13 piezas eliminadas**, verificada
> con una simulación ejecutable. Ver [Lo que se borró](#lo-que-se-borró) y
> [Qué verificó la simulación](#qué-verificó-la-simulación).

---

## Resumen

Savia recibe documentos de cuatro canales, en decenas de formatos, y tiene que
convertirlos en memoria consultable sin que el costo ni la latencia se disparen
cuando alguien sube mil archivos de una vez.

El problema de fondo es combinatorio: **N formatos × M tipos de contenido**. Si
cada formato tiene que saber tratar cada tipo de contenido, agregar un formato
obliga a tocar todo el sistema.

La solución es una **cintura angosta**: seis formas cerradas a las que todo
converge. Cada formato solo sabe traducirse a esas seis; nada aguas abajo conoce
formatos. El conteo pasa de N×M a N+M — es la misma razón por la que LLVM tiene
una representación intermedia y Pandoc un AST.

Tres decisiones gobiernan todo lo demás: **ningún modelo de lenguaje en el camino
de escritura** (salvo el perceptual para lo que solo existe como píxeles),
**nunca se pierde un archivo y nunca se indexa basura**, y **la certeza con que se
reconoció cada cosa viaja con el dato** hasta quien lo consuma.

---

## El pipeline completo

```
 1  RECEPCIÓN         original a objetos · hash de bytes · registro
 2  SELECCIÓN         cada adaptador declara evidencia · piso de texto · o en_espera
 3  RECONOCIMIENTO    fuente → nodos tipados · TODO lo que sabe de formatos
────────────────────  ▲ el borde: la salida de `descomponer` ▲  ──────────────────
 4  EMISIÓN E IDENTIDAD   ruta → lista plana · migas · reconciliación contra la versión previa
 5  AGRUPACIÓN        un recorrido, dos salidas: fragmentos (difuso) + registros (exacto)
 6  EMBEDDINGS        miga concatenada · N vectores si excede · caché por contenido
 7  PERSISTENCIA      transacción Postgres + upsert Qdrant + evento de salida
```

**Eran once.** Un tramo se gana el lugar si cambia la forma del dato, puede fallar
por su cuenta y podría sustituirse por otra cosa. Los cuatro que se fueron no
cumplían las tres — ver [Lo que se borró](#lo-que-se-borró) para el detalle:

| Tramo original | Dónde quedó |
|---|---|
| **Traducción** | En `ir`, como función pura. El adaptador ya emite la forma final. |
| **Validación** | Partido: *integridad referencial* es una **postcondición del 4**; *detectar identificadores* es un [anotador](#los-anotadores-no-son-un-tramo). |
| **Composición** | Dentro de la fragmentación: es la segunda salida del mismo recorrido. |
| **Diferencia** | Disuelto en el **caché de embeddings por contenido**, que hace lo mismo y además entre documentos distintos. |

Y los siete que quedan no se pueden fusionar más:

- El **2** no entra en el 3 porque es donde **reentra la delegación**; separarlo es
  lo que la vuelve emergente en vez de un mecanismo.
- El **4** no entra en el 5 porque su salida —nodos con identidad— es el artefacto
  del que cuelgan las anotaciones de R3. Tiene que existir como cosa propia.
- El **6** no entra en el 7 porque fallan distinto: una API de modelo y una base de
  datos no se caen juntas ni se reintentan igual.

---

## Vocabulario

| Término | Qué es |
|---|---|
| **Unidad** | Un pedazo del documento tal como lo entrega `descomponer`: lleva **dos caras** — las señales del formato y el cuerpo ya normalizado. |
| **Señales** | La cara específica del formato (`styleId`, tamaño de fuente, tag). **Muere en el tramo 3.** |
| **Cuerpo** | La cara libre de formato: una de las seis formas con su payload. **Cruza el borde.** |
| **Nodo** | Una unidad ya clasificada: cuerpo + tipo + procedencia + certeza. |
| **Casillero** | Cada hueco que un adaptador rellena. Quedan dos. |
| **Pista** | La señal que deja el clasificador para armar el árbol. Solo jerarquía. |
| **Forma** | Una de las seis representaciones cerradas. |
| **Cintura** | El punto angosto del sistema: exactamente esas seis formas. |

```
bytes  →  unidad { señales, cuerpo }  →  nodo
             ▲ formato  ▲ libre        ▲ libre de formato
```

---

## Las tres reglas

Se hacen cumplir mecánicamente, nunca por disciplina. Un invariante que depende
de que nadie se distraiga no es un invariante.

### R1 · El borde de formato es la salida de `descomponer`

Nada específico de un formato lo cruza. No es una convención documentada: el tipo
`Cuerpo` no tiene ningún miembro capaz de expresarlo.

**Cómo se hace cumplir:** regla de dependencia en el build. `ir` no depende de
nadie; `adaptadores` depende de `ir`; nada depende de `adaptadores` salvo la
orquestación. Si alguien intenta importar un adaptador desde el núcleo, no
compila.

### R2 · Aguas abajo se lee `tipo`, nunca se ramifica sobre él

`tipo` es un **conjunto cerrado** de hechos de lectura (`titulo`, `codigo`,
`tabla`…): lo que el formato **declaró**, no lo que alguien concluyó. Viaja como
metadato —sirve para mostrar, filtrar y explicar— y **solo las formas admiten
`switch`.**

El día que un consumidor escriba `if (tipo === 'codigo')`, la cintura se rompió y
cada formato nuevo vuelve a exigir cambios en cinco lugares.

Lo que Savia *concluye* sobre un documento —que es una factura, una receta, una
cláusula— **no es `tipo`**: es una anotación, y vive donde la manda R3. Ver
[Por qué `tipo` es cerrado](#por-qué-tipo-es-cerrado).

**Cómo se hace cumplir:** el enum vive en `ir`, así que un tipo inventado no
compila; la prohibición de ramificar, regla de lint sobre el núcleo.

### R3 · La representación intermedia es desechable; las anotaciones no

La representación intermedia es **lo que el documento dijo**. Las anotaciones
—sensibilidad, exclusiones, curación humana, conclusiones de Savia— son **lo que
Savia concluyó o una persona decidió**.

Lo primero se regenera entero desde los bytes en cada re-ingesta. Lo segundo vive
en Postgres, anclado al identificador estable del tramo 4.

Conflacionarlos es cómodo, y es exactamente cómo se pierde el trabajo de curación
de un cliente sin que nadie se entere.

**De qué lado cae el `ElementId`.** Del segundo, y conviene decirlo explícito porque
al principio esta regla estaba escrita como si el id viniera solo. El `ElementId` no
está en el documento: no se lee de los bytes, **lo concluye el reconciliador**. Es
una conclusión de Savia, igual que una etiqueta de sensibilidad.

Y con él cae del mismo lado la **evidencia que lo sostiene** — el índice de
reconciliación del tramo 4. Guardar la IR sería conflacionar; guardar *por qué Savia
le dio ese id a ese nodo* es la otra mitad de esta misma regla.

---

## Los anotadores no son un tramo

Detectar correos, documentos, tarjetas o claves de API **no transforma nada**:
entra una lista de nodos y sale la misma lista. Por eso no es un tramo — es un
**anotador**, un observador sobre el flujo de nodos que mira, concluye y escribe
en el almacén de anotaciones anclado al `id` del nodo.

Y por R3 le corresponde estar ahí: que una cadena *sea* un correo es una
conclusión de Savia, no algo que el documento declaró. Deterministica, pero
conclusión — la decidió una expresión regular, no el formato.

```ts
interface Anotador {
  nombre: string
  mirar(nodo: NodoEmitido): Anotación[]     // nunca devuelve un nodo
}
```

Corren durante el recorrido que la fragmentación ya hace, así que **cuestan cero
pasadas extra**. Y el conjunto es extensible sin tocar el pipeline: mañana un
anotador de idioma, otro de moneda, otro de fechas. Ninguno agrega un tramo.

Es el mismo patrón que el canal de `Diagnóstico` del tramo 3: información que
acompaña al dato sin contaminar las firmas de nadie.

---

# Tramo 1 — Recepción

**Entra:** un archivo subido por cualquiera de los cuatro canales.
**Sale:** el original a salvo en almacenamiento de objetos y una fila en Postgres.

## El orden importa

```
1. validar en la puerta      tamaño · formato legible · no cifrado · antivirus
2. guardar el original       a almacenamiento de objetos, cifrado en reposo
3. calcular hash de bytes    identidad exacta del contenido
4. registrar el documento    fila en Postgres, con dueño y estado
5. encolar                   con prioridad según canal
```

**El original se guarda antes que nada.** Si un tramo posterior falla, no se
perdió nada: se reintenta desde el archivo, que ya está a salvo. Registrar
primero y guardar después deja filas apuntando a bytes que no existen.

El antivirus corre **en paralelo** al guardado, no antes, para no sumar su
latencia a la ruta crítica.

## El registro

```
documento
├── id
├── dueño            un User — para conectores de organización, el usuario raíz
├── organización     tenant. Toda lectura posterior se filtra por acá
├── canal            chat · frontend · carpeta local · conector
├── nombre original  y tipo declarado
├── hashBytes        sha256 del archivo crudo
├── claveObjeto      dónde quedó el original
├── tamaño
├── estado           recibido → reconociendo → indexando → indexado
│                    · parcial · fallido · rechazado · en_espera
└── nivelLogrado     estructurado | texto plano
```

`nivelLogrado` es lo que vuelve visible la degradación: un formato desconocido
pero legible entra como texto plano y el usuario **sabe** que entró así.

`en_espera` es el estado de los binarios que todavía no sabemos leer. No es un
rechazo — el archivo está guardado y se procesa solo cuando exista el adaptador.

## Qué se acepta

La pregunta no es *"¿soportamos este formato?"* sino **"¿va a salir algo útil de
acá?"** — y eso se responde mirando los bytes, no una lista de extensiones.

```
¿decodifica como texto, con proporción razonable de caracteres imprimibles?
   sí  → el piso de texto produce texto de verdad   → aceptar
   no  → produciría basura binaria                  → en_espera
```

El test corre sobre los 4 KB que la sonda ya tiene en memoria: microsegundos,
determinístico, sin leer el archivo entero.

| Resultado | Cuándo | Qué obtiene el usuario |
|---|---|---|
| **Adaptador dedicado** | Hay uno para ese formato | Estructura completa |
| **Piso de texto** | Decodifica como texto | Texto plano, con `nivelLogrado` visible |
| **En espera** | Binario que no sabemos leer | El archivo guardado, sin indexar |

**Aceptar todo indiscriminadamente sería peor que rechazar.** Si un `.dwg` de
AutoCAD entrara por el piso, se extraería basura binaria como si fuera texto, se
embebería, y una consulta devolvería ruido **con procedencia confiable**. Eso
erosiona la confianza en la memoria, que es el producto entero.

Pero rechazar por formato también sería un error, porque la mayoría de los
formatos "no soportados" que se suben en B2B **son texto**: `.log`, `.rst`,
`.adoc`, `.tex`, `.srt`, configuraciones, código en lenguajes no listados.

## Lo que queda en espera se procesa solo

Cuando un documento queda `en_espera`, se guarda **la sonda**, no solo el archivo:

```
documento_en_espera
├── documentoId
├── extensión · mimeDeclarado · tamaño
├── bytesMágicos        los primeros 4 KB
└── tipoDetectado       'pptx' | 'dwg' | null   ← si la firma lo identificó
```

Unos 4 KB por documento. **El disparador es el registro de adaptadores.** Al
sumar uno nuevo se corre **solo su `evidencia()`** contra las sondas guardadas —
se recorre una tabla chica, no se leen archivos de almacenamiento:

```
al registrar adaptador nuevo A:
    para cada sonda en espera:
        si A.evidencia(sonda) > Ninguna  →  encolar para reconocimiento
```

Entra por la cola de prioridad como trabajo de fondo. Para el cliente que subió
su Drive hace meses, aparece contenido nuevo sin que haga nada.

**El mensaje depende de si lo identificamos**, porque no se puede prometer lo que
quizá nunca se cumpla:

| Caso | Mensaje |
|---|---|
| **Identificado** por firma | *"Todavía no leemos PowerPoint. Ya tenemos tu archivo y se procesará solo cuando lo soportemos."* |
| **No identificado** | *"Guardamos tu archivo pero todavía no sabemos leerlo. Avisanos si lo necesitás y lo priorizamos."* |

El segundo es honesto **y convierte el caso en señal**. Y esa tabla es, gratis,
**el roadmap de formatos ordenado por demanda real**:

```
pptx   47 archivos · 12 organizaciones
dwg     8 archivos ·  1 organización
```

Eso no existe si se acepta todo en silencio: los archivos entran degradados,
nadie se queja, y nunca se sabe qué falta.

## Los dos hashes

| | `hashBytes` (tramo 1) | `hashFragmento` (tramo 5) |
|---|---|---|
| Sobre qué | El archivo crudo | El texto de cada fragmento |
| Para qué | Deduplicar subidas · idempotencia de reintento | Saltar lo que no cambió |
| Alcance | Documento completo | Pieza por pieza |

Ninguno resuelve **versionado**. La regla anterior —«crea documento nuevo salvo que
el usuario diga lo contrario»— no era una política: era la ausencia de una, con la
garantía más importante del sistema colgando de una casilla que nadie tilda.

> **Dos documentos son el mismo por su CONTENIDO, no por su nombre.**
> El nombre es el dato más inestable que tenemos: versionar renombrando
> —`informe.docx`, `informe-v2.docx`, `informe-FINAL.docx`— es la forma más común de
> versionar a mano, y es exactamente la que un match por nombre no ve.

| Señal | Cuándo | Por qué |
|---|---|---|
| **Id estable de la fuente** | `conector` (id de archivo de Drive y equivalentes) | Es autoritativo y sobrevive al renombre. Si existe, gana |
| **Contenido** | `frontend` · `chat` · `carpeta` | La ruta de una carpeta cambia al mover o renombrar: es tan inestable como el nombre |

**Cómo se busca el candidato por contenido** — el mecanismo está en el tramo 4, sobre
el índice de reconciliación que ya guarda el hash de cada nodo. En una línea: se
consulta qué documento de la organización comparte más **nodos distintivos** con el
que está entrando, y el `anclaje` confirma o descarta.

El momento encaja sin mover nada: el emisor ya produce los hashes **antes** de que la
reconciliación asigne los `ElementId` —esa separación existe en el diseño por otra
razón— y el candidato se busca justo en ese hueco.

Sin esto, el reconciliador —los tres pases, el anclaje 1.00 del banco, el tercer pase
que peleó su lugar— **no corría en dos de los cuatro canales**, y en un tercero se
rompía en cuanto alguien renombraba o movía el archivo. El tramo 4 no lo discutía en
ningún lado.

## La carpeta local

El canal `carpeta local` es captación **pasiva**: una carpeta en la máquina del
usuario que un agente liviano observa y sincroniza sola. Esta sección fija su
mecánica, que la auditoría marcó ausente (#36: *«no hay campo en el registro que
guarde esa identidad, así que carpeta y conectores crean documento nuevo en cada
sincronización y la reconciliación nunca corre»*).

### El agente observa, Savia decide

**El agente no toma una sola decisión.** Hashea y reporta; todo lo demás pasa del
lado del servidor. Es lo que lo mantiene liviano —un sha256 y una llamada, cero
parseo, cero adaptadores— y lo que permite que agregar un adaptador nuevo despierte
el histórico de todos los clientes sin actualizar una sola máquina.

```
el agente reporta          apareció      ruta P, contenido H
                           desapareció   ruta P, que tenía contenido H
                           barrido       completo · interrumpido

Savia decide               ¿H ya lo tenemos?        → no pedir bytes, solo registrar
                           ¿H es versión de algo?   → reconciliador, por nodos distintivos
                           ¿la ausencia es baja?    → política de retiro, más abajo
```

**El hash se calcula en el cliente, y no es una concesión al agente.** Hashear no es
decidir: es una función determinística sin política adentro, del mismo orden que leer
el tamaño. Y moverlo al servidor lo empeora todo, porque **Savia solo puede hashear
lo que ya se subió**: se pierde el dedupe previo a la transferencia —cuarenta
máquinas con la misma presentación la suben cuarenta veces— y, para saber qué
desapareció, el servidor tendría que llevar un mapa `ruta → documento`. Es decir:
mover el hash al servidor vuelve al sistema **más** dependiente de la ruta, que es
justo lo que §{Los dos hashes} descartó.

Para no rehashear el corpus entero en cada barrido, el agente cachea por
`(ruta, tamaño, mtime)` y solo recalcula cuando eso cambia.

### El hash del cliente es una afirmación, no la autoridad

**Se hashea en los dos lados, y hay que decir por qué eso no es redundancia** — porque
leído sin esta distinción, el contrato dice que este canal es ilegal.

`ByteHash` fija que el hash de los bytes **lo calcula el worker en la primera lectura
del objeto**: con subida prefirmada la API no ve bytes, así que nadie puede computarlo
en la puerta. Y saca de ahí una consecuencia dura: *«el dedupe de blobs no puede ocurrir
en la puerta ni ser la clave de escritura del objeto»*. Pero el camino `known` de este
canal **es** dedupe en la puerta, hecho con un hash que mandó el cliente.

Las dos afirmaciones son verdaderas. Lo que las separa son dos usos del mismo valor:

| Uso del hash que manda el cliente | Veredicto |
|---|---|
| **Preguntar «¿ya lo tenés?»** para saltarse una transferencia | **Legal.** Una coincidencia solo puede direccionar un objeto que este lado ya escribió y ya verificó, así que el cliente no hace aparecer contenido que nunca subió |
| **Escribir un objeto nuevo bajo esa clave** | **Prohibido.** Un cliente que afirma `H` y sube otros bytes envenena el almacén: la dirección `H` pasaría a contener algo que no hashea a `H`, y **todos** los documentos que la comparten —que son, por diseño de la deduplicación, los de toda la organización— quedarían apuntando a contenido ajeno |

O sea: **el hash del cliente es una afirmación; el del servidor es la autoridad.** Un
objeto nuevo se escribe siempre bajo el que computó el worker, nunca bajo el afirmado.

**La fuga que esto sí tiene, dicha de frente:** contestar `known` le confirma al cliente
que ese contenido exacto ya existe. Como para preguntar hay que tener el archivo —el
hash es de sus bytes— no se filtra contenido, se filtra **existencia**. Es chica y es
real, y es de Capa 3: queda anotada, no resuelta acá.

**Y la divergencia se cierra, no se guarda.** Entre que el agente hashea y que termina
el PUT, el archivo puede cambiar: el servidor computa `H'` y el agente sigue creyendo
`H`. Un `desapareció(P, H)` posterior no matchea con nada. Guardar el hash del cliente
del lado del servidor **no arregla eso** —solo deja registrada la discrepancia—. Lo que
la cierra es que **`upload.completed` devuelva el hash verificado** y el agente corrija
su inventario con él. Es una llamada que ya existe para confirmar que el objeto llegó;
devolver lo que el worker computó al leerlo no agrega un viaje.

**Consecuencia para el registro, y decide una columna:** con el lazo cerrado, «el último
hash que vio el agente» y `Ingestion.version` son el mismo valor, así que no hacen falta
las dos. Sin el lazo cerrado, la segunda no sería redundancia sino el registro de una
desincronización que nadie repara — que es peor que no tenerla.

### La ruta es procedencia, nunca identidad

La ruta viaja en el reporte y **se guarda**, para poder mostrarle al usuario de dónde
salió cada cosa. Lo que no hace es decidir quién es qué: eso lo decide el contenido,
por la razón que esta misma sección ya fijó —una ruta cambia al mover o renombrar—.
Es la misma distinción que el tramo 3 aplica a los bytes incrustados.

Con eso, los tres casos que rompen a un sincronizador ingenuo se resuelven solos:

| En la carpeta | Qué ve el agente | Qué concluye Savia |
|---|---|---|
| **Mover a otra subcarpeta** | el contenido sigue presente | nada cambió |
| **Renombrar** | el contenido sigue presente | nada cambió |
| **Editar y guardar** | un contenido se fue, otro llegó | el reconciliador decide si es versión nueva |

El tercero es el importante: el agente **no sabe** que hubo una edición. Reporta los
dos hechos y el servidor concluye, con el mecanismo de §{Los dos hashes} —qué
documento comparte más nodos distintivos— y el `anclaje` confirmando o descartando.

### La identidad de la fuente

Es el hallazgo #36 y hay que cerrarlo aunque la política de borrado fuera otra. Se pidió
como una columna de cuatro partes —`raízVigilada · rutaRelativa · idDeArchivoDelSO ·
últimoHashVisto`— y **entran dos**:

```
documento.watched       WatchedPath = { root: RootId, path: string }
```

**Los otros dos no son un recorte de alcance.** `últimoHashVisto` ya existe con otro
nombre: es `Ingestion.version`, el `ByteHash` de los bytes recibidos, y la consulta
`hash → documento` se hace por ahí. Y `idDeArchivoDelSO` **no es del contrato**: sirve
para que renombrar cueste cero I/O en la máquina del usuario, este lado no puede
verificarlo, y la ficha que el borrador del agente le escribe dice lo que es —«una pista
que se verifica, nunca una identidad»—. Un dato que declara no ser identidad no puede ser
la identidad de una fila.

**Y la justificación de arriba estaba mal apuntada**, que es lo que se ve al escribirla:
quien resuelve una baja es **el hash**, no la ruta. El propio agente trata dos copias del
mismo contenido como un documento —si el hash reaparece en el árbol no reporta baja— así
que no hay ambigüedad que una ruta tenga que desempatar. `path` sobrevive por lo que dice
la sección de al lado: se guarda **para mostrarle al usuario de dónde salió cada cosa**.
Y `root` sobrevive por una tercera razón que no es ninguna de las dos: **las salvaguardas
son por raíz**, y la cuarentena y el corte por volumen corren de este lado.

Las dos mitades son marca y ruta relativa a propósito, y compran lo mismo: **mover la
raíz entera es un solo hecho**. Con rutas absolutas, todos los archivos parecen
desaparecer a la vez.

El detalle de los nombres descartados está en
[`packages/ir/GLOSARIO.md`](../../../packages/ir/GLOSARIO.md), P31 y P32.

### Borrar en la carpeta RETIRA, no destruye

**Es la decisión, y la razón es R3.** La regla parte el mundo en dos: la IR es *lo que
el documento dijo* y se regenera desde los bytes; las anotaciones son *lo que Savia
concluyó o una persona decidió* y viven en Postgres. **La carpeta es autoritativa
sobre la primera mitad y nunca tuvo la segunda.** Un borrado que arrastre las dos le
da a un `rm` en el Finder el poder de destruir trabajo que la carpeta no puede
mostrar y no puede devolver.

Un archivo que desaparece de la carpeta **se marca como retirado**: sale de la
búsqueda, de la síntesis y del índice. Para el usuario desaparece de Savia, que es
exactamente lo que pidió. Lo que NO pasa es que se borre la otra mitad.

**No es un noveno estado: es un campo.** `Ingestion.retiredAt`, un instante nulable, y
el argumento entero está en [`packages/ir/GLOSARIO.md`](../../../packages/ir/GLOSARIO.md),
P30. En corto: los ocho estados contestan «¿en qué punto del pipeline está este
documento?» y el retiro contesta «¿está vigente?». Un documento retirado que estaba
`indexado` **sigue estando indexado** —la tabla de acá abajo dice que sobrevive todo—,
así que escribirlo en `estado` borraría un hecho verdadero para anotar otro distinto. Y
la reversibilidad sale gratis de esta forma: se pone el campo en `null` y el documento
vuelve a ser exactamente lo que era, sin nada que restaurar. Como estado habría que
recordar de dónde vino, que es un campo igual —pero habiendo perdido el que ya estaba—.

**Qué sobrevive a un retiro, y por qué cada uno:**

| Sobrevive | Por qué |
|---|---|
| Las anotaciones con `origen: humano` | Es curación **atribuible a una persona**. `actor` «se sabe cuando se curó, o no se sabe nunca» |
| Las marcas de sensibilidad | Son anotaciones. Sin ellas, el archivo re-agregado vuelve **sin marcar** y se indexa limpio: no es pérdida, es una regresión de privacidad **en silencio** |
| Los `ElementId` y el índice de reconciliación | Se acuñan al azar y solo se conservan reconciliando. Sin índice, re-agregar el archivo **no es una edición: es una primera ingesta**, y toda la curación se despega |
| El historial de versiones | El índice acumula como git. La carpeta tiene UNA versión; las anteriores son de Savia y solo de Savia |
| `selladoEn` | «Esto lo dijo el CFO en marzo» es la mitad del valor de la memoria. Re-ingerir sella hoy: marzo se convierte en agosto |
| El objeto original | Está direccionado por CONTENIDO y deduplicado a propósito. Purgarlo rompe la cita verbatim de todos los otros documentos que lo comparten — que esta carpeta ni siquiera puede ver |

Y por eso el retiro es **reversible**: si el archivo vuelve, vuelve entero.

**Es consistente con una decisión ya tomada.** Desconectar un conector no borra lo
captado. Que borrar un archivo sí destruyera sería la política opuesta para el mismo
hecho —dejar de tener acceso a una fuente— en los dos canales pasivos.

### Una desaparición es una hipótesis, no un hecho

El agente no puede distinguir «lo borré» de «no lo veo». Producen el mismo evento el
disco desmontado, la carpeta movida entera, un permiso denegado, el guardado atómico
de Office —que borra y recrea— y los *placeholders* de los sincronizadores de
terceros, que dejan el archivo en 0 bytes. Por eso una desaparición **propone** un
retiro y no lo ejecuta:

1. **Cuarentena.** El retiro espera una ventana antes de aplicarse. Absorbe el
   guardado atómico y el mover-y-recrear.
2. **La raíz tiene que estar viva.** Antes de procesar cualquier baja se confirma que
   la carpeta vigilada existe y es legible. Si la raíz no está, es **desconexión**.
3. **Corte por volumen.** Si desaparece de golpe una fracción alta del corpus, se
   congela todo y no se retira nada. Cubre disco desconectado y carpeta renombrada.
4. **Correlación por contenido.** Un hash que reaparece en cualquier punto del árbol
   dentro de la ventana es un **movimiento**, no una baja.
5. **Deshidratado no es ausente.** Un archivo marcado como *solo en línea* por otro
   sincronizador no cuenta como desaparecido.

Las tres primeras llevan números —cuánto dura la cuarentena, qué fracción dispara el
corte, cuánto tiempo un retirado sigue siendo recuperable— y **ninguno se inventa
acá**: van a `PARAMETERS` con su unidad, qué deciden y cómo se medirían.

### Y el error de enfrente: lo que no se ve faltar nunca

Las cinco de arriba protegen contra **retirar de más**. Falta la mitad simétrica, que es
más silenciosa: **un barrido incremental no reporta lo que sigue igual.** Es lo que lo
hace barato, y tiene una consecuencia que ninguna salvaguarda cubre — si Savia tiene
documentos de una raíz que el agente no sabe que existen, esos documentos **no se van a
ver faltar jamás**. No aparecen en ningún reporte, ni de alta ni de baja. Pasa cuando el
agente pierde su inventario, cuando se lo restauran de un backup viejo, o cuando dos
agentes miran la misma raíz.

**Se detecta con un número que ya viajaba.** El agente abre cada barrido declarando
cuántas filas vivas tiene para esa raíz; Savia tiene su propia cuenta de documentos
vivos. Si difieren hay desfase, y Savia contesta pidiendo **el padrón**: la lista de todo
lo que ese barrido enumeró, sin bytes. Al cerrar, lo que Savia tiene vivo y el padrón no
nombra es lo que se fue.

Tres cosas que esto **no** relaja:

- **La diferencia pasa igual por el corte por volumen.** Retirar por padrón no es una vía
  rápida: si lo que falta supera la fracción, la raíz se congela y se exige un barrido
  completo más, como cualquier otra baja.
- **Solo cuenta si el barrido cerró completo.** Un padrón parcial afirma «esto es todo lo
  que veo» sobre un recorrido que no terminó.
- **«Presente pero ilegible» es presente.** Un deshidratado entra al padrón sin hash. Si
  se lo omitiera por no tener hash, quedaría ausente y se retiraría un archivo que está
  perfectamente ahí.

Lo pide Savia y no lo declara el agente, y eso es deliberado: un agente solo puede
declarar los desfases que conoce, y los que importan son exactamente los que no —un
inventario corrupto que él cree bueno—. El mecanismo y sus reglas están en
[borrador-agente-carpeta.md § El padrón](borrador-agente-carpeta.md).

### Qué falta decidir del canal

- **DECIDIDO — el retiro es siempre silencioso.** El agente no pregunta nunca, ni
  siquiera cuando salta el corte por volumen; ese corte deja de ser una consulta y pasa a
  ser una **exigencia de más evidencia** —confirmar que la raíz está viva y esperar otro
  barrido completo—. Lo que lo vuelve tolerable es que el retiro **ya es reversible**: un
  falso positivo cuesta devolver el archivo a la carpeta, no una pérdida. Preguntar
  compraba seguridad contra algo recuperable, a cambio de romper lo único que este canal
  promete, que es no tener que hacer nada.
- **DECIDIDO — la carpeta es fuente de verdad de la PERSONA.** El agente lo vincula el
  usuario **desde su propia cuenta**, así que el canal es personal por construcción y
  encaja con lo que el registro ya dice (`dueño — un User`) y con la regla de
  deduplicación, que le da a dos personas con el mismo archivo **registros separados con
  dueños distintos**. Lo que sigue abierto no es de quién es, sino qué pasa cuando un
  documento captado de la carpeta de alguien alimenta skills de los que depende otro
  equipo: que una persona ordenando su escritorio degrade el skill de otro es gobernanza
  de Capa 3, no sincronización.
- **DECIDIDO — a los retirados los filtra UN punto, no tres.** `retiredAt` dice el hecho
  y no lo impone, y la salida obvia —que la búsqueda, la síntesis y el índice filtren cada
  uno— son tres sitios y tres oportunidades de olvidarse; el que se olvide sirve contenido
  que el usuario cree haber sacado. La regla se impone en la consulta que los tres
  comparten. Se decide ahora justamente porque **ninguno de los tres existe**: después son
  tres refactors.
- **Y lo que sigue abierto es la gobernanza, que no la cierra ninguna de las de arriba.**
  Un documento captado de la carpeta de alguien puede alimentar un skill del que depende
  otro equipo. Se decidió que la organización **no** puede revocar el dispositivo de una
  persona —el enrolamiento es personal y la revocación también— pero eso solo dice que la
  palanca no es esa. La tensión queda entera y es de Capa 3.

## Caché de reconocimiento

Como el reconocimiento es determinístico, su resultado es cacheable. En una
empresa el mismo contrato circula por varias casillas: reconocerlo una vez y
reusar el árbol ahorra el tramo más caro.

**La clave no puede ser solo `hashBytes`.** Cachear solo por contenido es un bug
silencioso: el día que un clasificador mejore, el caché seguirá sirviendo árboles
viejos para siempre.

```
claveDeCaché = sha256( hashBytes ‖ idAdaptador ‖ versiónDelClasificador ‖ versiónDelModelo? )
```

Es la contrapartida obligatoria del determinismo: si el reconocimiento es una
función pura, la clave del caché es su firma completa.

Cuando sube la versión, **la invalidación es perezosa**: se re-reconoce al próximo
acceso, sin backfill masivo. El costo sigue al uso.

El caché no filtra información —para beneficiarse hay que poseer bytes idénticos,
o sea que ya se tiene el documento— pero es **configurable por organización**,
porque habrá clientes que lo objeten por principio.

> **Optimización que habilita la delegación** (nueva): como una página escaneada
> se delega como asset independiente, su reconocimiento se cachea **por página**.
> Un contrato al que le cambian una hoja y se vuelve a subir reusa las otras 199.
> Antes el caché era todo-o-nada por documento.

## Decisiones tomadas

- **Subida directa con URL prefirmada.** La API no toca bytes: emite el permiso y
  después verifica que el objeto llegó. Con mil archivos, hacerlos pasar por la
  API la convierte en el cuello de botella.
- **Se deduplica el blob, no el documento.** Dos personas que suben el mismo
  archivo comparten un objeto almacenado, pero tienen registros separados con
  dueños distintos. La gobernanza queda limpia y se ahorra almacenamiento.
- **Se rechaza solo en la puerta:** cifrado sin contraseña, tamaño excedido, y lo
  que marque el antivirus. Siempre con mensaje claro. Lo no soportado no se
  rechaza: queda `en_espera`.
- **Se acepta por contenido, no por extensión.**
- **Antivirus obligatorio** — requisito enterprise, no opcional.
- **Cola con prioridad.** Una subida interactiva se adelanta a una importación
  masiva. Sin esto, el primer cliente que importe su Drive deja a todos esperando.
- **Mensajes venenosos:** tras N reintentos, cola de descarte, estado `fallido` y
  alerta.

> ⚠️ **Pendiente menor.** Guardar archivos que quizá nunca se procesen cuesta
> almacenamiento indefinidamente. Falta decidir si cuentan contra la cuota de la
> organización y si son visibles como tales.

---

# Tramo 2 — Selección

**Entra:** un objeto en almacenamiento.
**Sale:** un adaptador elegido, sin haber leído el archivo entero.

## El problema

La extensión miente. Un `.txt` que en realidad es un CSV, un `.docx` renombrado,
un adjunto sin extensión, un `.pdf` que solo contiene imágenes. Un pipeline que
despacha por extensión falla en todos esos casos, y falla **en silencio**.

Tampoco se puede leer el archivo completo para decidir: con mil archivos
entrando, decidir costaría lo mismo que procesar.

## La sonda

Se construye una vez por documento y se le pasa a todos los candidatos.

```ts
interface Sonda {
  origen:        'chat' | 'frontend' | 'carpeta' | 'conector' | AdaptadorId
  extensión:     string | null
  mimeDeclarado: string | null
  bytesMágicos:  Uint8Array           // los primeros 4 KB, nada más
  tamaño:        number

  // perezosos y memoizados — solo pagan los adaptadores que los piden
  entradasZip():    Promise<string[]>
  primerasLíneas(): Promise<string[]>
}
```

`origen` acepta un `AdaptadorId` porque **un asset delegado también trae sonda**
(ver [Delegación](#la-delegación-es-emergente)).

## Evidencia, no puntaje

La escala es **ordinal y cerrada**, no un número flotante.

```ts
enum Evidencia {
  Firma      = 4,   // firma inequívoca en el contenido
  Estructura = 3,   // estructura interna consistente con el formato
  Extensión  = 2,   // extensión declarada, sin contradicción en bytes
  Contenido  = 1,   // heurística sobre el texto
  Piso       = 0,   // el piso de texto
  Ninguna    = -1,  // no aplica
}
```

Un puntaje continuo envejece mal: a los seis meses hay veinte números mágicos y
nadie sabe si `0.7` le gana a `0.65` por una razón o por accidente. Con cinco
clases nombradas, quien escribe un adaptador elige entre opciones con significado.

`Ninguna` además elimina el `{ match, score }` de dos campos: un solo valor de
retorno, sin estados imposibles como `{ match: false, score: 0.9 }`.

```ts
// .docx — firma inequívoca dentro del zip
const evidenciaDocx: Evidenciador = async (s) => {
  if (!empiezaCon(s.bytesMágicos, ZIP_MAGIC)) return Evidencia.Ninguna
  const e = await s.entradasZip()
  return e.includes('word/document.xml') ? Evidencia.Firma : Evidencia.Ninguna
}

// imagen — sin filtros de contenido: si es una imagen, se puede descomponer
const evidenciaImagen: Evidenciador = async (s) =>
  esImagen(s.bytesMágicos) ? Evidencia.Firma : Evidencia.Ninguna
```

**No hay prefiltro por tamaño, y sacarlo fue una corrección de fondo.** Una
versión anterior descartaba las imágenes por debajo de cierto ancho, para no
gastar el modelo en logos. Pero el tamaño es un *proxy* de "es decorativo", y un
proxy falla justo en el caso que importa: **un certificado de calidad de 32 px es
pequeño y es exactamente lo que un cliente va a querer consultar** —*"¿este
proveedor tiene la ISO?"*.

El error de fondo era intentar **adivinar qué es un asset antes de mirarlo**. No
hay forma: un logo y un certificado se distinguen por lo que significan, no por
sus píxeles. **La descomposición es la identificación** — un logo descompuesto da
una región pictórica y nada más; un certificado da texto, fechas y un sello.

El costo, que era el problema real que el filtro intentaba resolver, se ataca sin
adivinar nada. Ver [El costo se acota sin
adivinar](#el-costo-se-acota-sin-adivinar).

## El selector

```ts
async function seleccionar(sonda: Sonda): Promise<Adaptador | null> {
  const evaluados = await Promise.all(
    registro.map(async (a) => ({ a, e: await a.evidencia(sonda) }))
  )
  return evaluados
    .filter((x) => x.e > Evidencia.Ninguna)
    .sort((x, y) => y.e - x.e || x.a.id.localeCompare(y.a.id))[0]?.a ?? null
}
```

El desempate por `id` no es cosmético: **garantiza que el mismo archivo elija
siempre el mismo adaptador**, precondición de que el caché sea válido.

`null` es un resultado legítimo: ningún adaptador —ni el piso— puede leer estos
bytes. El documento pasa a `en_espera`.

## Los tres casos difíciles

**Extensión mentirosa.** Gana el contenido: los adaptadores que declaran `Firma`
lo hacen por bytes. La discrepancia se **registra** pero no interrumpe.

**Zip ambiguo.** `.docx`, `.xlsx`, `.pptx` y `.odt` comparten bytes mágicos. Por
eso los cuatro consultan `entradasZip()`, y la memoización hace que el costo real
sea una sola apertura parcial.

**Contenedores.** Un `.zip` o un `.eml` no se reconocen: se **abren**. Cada
miembro vuelve a entrar por este mismo tramo con su propia sonda. Es el mismo
mecanismo que la delegación, y por eso este tramo está separado del 3.

## Decisiones tomadas

- **La selección puede no encontrar candidato, y está bien.**
- **Contenido sobre extensión**, con la discrepancia registrada.
- **Sonda perezosa y memoizada** — el caso barato no paga por el caro.
- **Escala ordinal, no continua** — cinco clases con nombre, cero números mágicos.
- **Registro por import explícito** — nunca por escaneo del sistema de archivos.
- **Desempate determinístico** — precondición del caché.
- **`evidencia()` responde por la forma, nunca por el valor del contenido.** Si es
  una imagen, se puede descomponer; cuánto vale lo que hay adentro no se adivina
  acá — se descubre descomponiendo.

---

# Tramo 3 — Reconocimiento

**Entra:** un archivo y su adaptador.
**Sale:** nodos tipados, ya sin formato.

Es el tramo donde vive casi todo el costo y casi toda la complejidad. Es también
**el único que conoce formatos**.

## Dos casilleros

Un adaptador no tiene lógica propia: es una declaración de qué implementación va
en cada casillero. Después de la reducción quedan **dos**.

```ts
interface Adaptador<S> {
  id:          string
  evidencia:   (sonda: Sonda) => Promise<Evidencia>          // tramo 2
  descomponer: (bytes: Uint8Array, ctx: Contexto) => Promise<Unidad<S>[]>
  detectar:    (unidades: Unidad<S>[]) => (u: Unidad<S>) => Clase | null
}
```

Eran cinco (`decodificar`, `unidades`, `perfilar`, `clasificador`, `contenido`).
Los dos que quedan son exactamente los dos pasos que hace cualquier lector de
documentos: **encontrar los bloques, y decir qué es cada uno.**

> ### El invariante que gobierna este tramo
>
> **`descomponer` divide hasta la unidad natural del formato — no hasta un tamaño.**
>
> Un párrafo, una celda, una función, una diapositiva. Nunca "hasta que entre en el
> presupuesto de embedding": este tramo no sabe qué modelo usamos ni tiene por qué.
>
> De acá sale que **ningún tramo posterior parte nada**. Partir exige conocer el
> formato —cortar código en funciones exige saber que es Python, cortar prosa por
> oración exige saber el idioma— y el formato solo vive acá. Un fragmentador que
> parte está contrabandeando formato al otro lado del borde.
>
> Corolario práctico: si la unidad natural resulta más grande que lo que aguanta
> el modelo, **eso es un dato sobre el documento, no un problema a resolver
> partiendo**. Se declara y se mide; y si el adaptador podía descomponer mejor, la
> métrica dice cuál.

### `descomponer` — encontrar los bloques

```ts
type Unidad<S> = {
  señales:   S            // específico del formato — MUERE acá
  cuerpo:    Cuerpo       // una de las seis formas — CRUZA el borde
  ubicación: Ubicación
}
```

La unidad tiene **dos caras**, y esa es la clave de todo el diseño: el
clasificador necesita las señales del formato (`styleId`, tamaño de fuente, tag)
para poder clasificar, pero nada de eso puede sobrevivir al tramo. Separarlas en
un mismo objeto deja que las dos cosas convivan sin que la de la izquierda se
escape.

El mecanismo de "encontrar bloques" cambia por formato, el paso no:

| Formato | Cómo encuentra los bloques |
|---|---|
| HTML, Markdown, DOCX, ODT | El formato los declara |
| XLSX, CSV | Filas y columnas vacías cortan regiones |
| PDF con capa de texto | Geometría: posiciones, fuentes, espaciados |
| Imagen, página escaneada | Un modelo de layout los segmenta |

**El adaptador emite la forma final, no una representación intermedia.** Sabe que
`<pre>` es preformateado, que una región 2×N de etiqueta/valor son `fields`, que
una imagen es un `asset`. No hace falta que un tramo posterior lo adivine.

### `detectar` — decir qué es cada bloque

```ts
detectar: (unidades: Unidad<S>[]) => (u: Unidad<S>) => Clase | null
type Clase = { tipo: Tipo; pista: Pista }
```

Es una **factory**: recibe el corpus completo y devuelve el clasificador por
unidad. Eso resuelve un problema real sin agregar una pieza.

Hay preguntas que no se pueden responder mirando una unidad aislada. *"¿Este
párrafo es un título?"* no tiene respuesta en el párrafo mismo: 16 pt es título en
un documento cuyo cuerpo es de 11 pt, y es cuerpo en uno cuyo cuerpo es de 16 pt.
**La respuesta es relativa al documento.**

Antes eso era un casillero aparte (`perfilar`). Como clausura, el que necesita
dos pasadas las hace por dentro y los demás ignoran el argumento:

```ts
// necesita el corpus: lo recorre y captura la moda
const porProminencia = (unidades) => {
  const cuerpo = modaPonderadaPorCaracteres(unidades)
  return (u) => u.pt > cuerpo && corto(u) ? { tipo:'titulo', pista:{via:'nivel',nivel:1} } : null
}

// no lo necesita: lo ignora
const porStyleId = () => (u) => MAPA[u.señales.styleId] ?? null
```

La doble pasada pasa a ser asunto privado del que la necesita, invisible para los
otros doce adaptadores.

## El piso físico reemplaza a la regla de totalidad

`detectar` puede devolver `null` **siempre**. Cuando lo hace, el tipo se deriva de
la forma, que el adaptador ya leyó del formato:

```ts
const TIPO_POR_FORMA = {
  text_span:'parrafo', verbatim:'codigo', asset:'imagen',
  grid:'tabla', fields:'campos', container:'lista',
}
```

Antes había una regla —*"el último clasificador de una cascada es total"*— que el
autor de cada adaptador tenía que recordar. Con el piso físico **la regla sobra**:
siempre hay respuesta sin que nadie tenga que acordarse de nada.

Y elimina un error que la simulación encontró: un clasificador total forzado a
resolver devolvía `parrafo` para una imagen incrustada, porque no tenía texto que
mirar. Ahora se abstiene y la forma responde `imagen`.

**El piso físico produce `certeza: 'declarado'`**, no `'inferido'`: la forma se
leyó del formato, no se adivinó. `'inferido'` queda reservado para inferencia de
verdad — prominencia, geometría, modelos.

## La única regla de la cascada

> **C1 · Un clasificador declarativo resuelve solo cuando la declaración informa.**
> `styleId: 'Normal'`, `<div>` y `<span>` no son declaraciones de "esto es
> cuerpo": son la **ausencia** de declaración. Devuelven `null`.

Sin C1, un mapeo por estilo resuelve absolutamente todo y los eslabones
siguientes nunca corren. El título que alguien escribió en negrita a 14 pt —el
caso para el que se inventó la cascada— quedaría como párrafo cualquiera.

La cascada **reordena por clase de certeza antes de correr**, así que escribirla
al revés no degrada nada:

```ts
const enCascada = (cs) => (unidades) => {
  const fns = [...cs].sort((a,b) => rango(a.certeza) - rango(b.certeza))
                     .map(c => ({ certeza: c.certeza, f: c.detectar(unidades) }))
  return (u) => {
    for (const { certeza, f } of fns) { const r = f(u); if (r) return { ...r, certeza } }
    return null                       // sin regla de totalidad: responde el piso
  }
}
```

`declarado` siempre antes que `inferido`; el orden del autor solo desempata dentro
de la misma clase. El invariante se cumple por construcción, no por revisión.

## La pista — el único dato estructural que produce este tramo

Cada clasificación deja una **pista**: lo mínimo para que el tramo 4 pueda armar
el árbol. Este tramo no lo arma — solo declara de qué manera se arma.

```ts
type Pista =
  | { via: 'padre';    id: string; padre: string | null }
  | { via: 'nivel';    nivel: number | null }
  | { via: 'celda';    hoja: string; región: string; fila: number }
  | { via: 'espacial'; caja: Caja }
  | { via: 'ninguna' }
```

La pista es **libre de formato** —un nivel es un nivel venga de un `styleId` o de
medir tipografía—, y por eso las estrategias que la consumen viven del lado limpio
del borde, en el tramo 4. Acá solo se produce.

> **La pista lleva jerarquía y nada más.** Antes `celda` llevaba `columna` y
> `espacial` llevaba `z`, y ninguno de los dos es anidamiento: la columna es una
> coordenada dentro de la grilla, y `z` es apilamiento visual. Los dos se fueron a
> `ubicación`, donde las coordenadas ya viven. De paso desapareció la ambigüedad
> de dos cajas con el mismo `z`: si nada ordena por `z`, no hay empate que
> desempatar.
>
> El invariante que lo mantiene limpio es verificable sin ejecutar nada: **si una
> estrategia no lee un campo de la pista, ese campo no es jerarquía.**

`celda` lleva la región porque la jerarquía real de una planilla es *hoja →
región → fila*. Sin ella, `porRegiones` tendría que volver a segmentar la hoja —
y dos segmentaciones independientes pueden discrepar.

## Por qué `tipo` es cerrado

```ts
// packages/ir — 15 valores, entran en una pantalla
type Tipo =
  | 'titulo' | 'subtitulo' | 'parrafo' | 'cita'
  | 'lista'  | 'lista_ordenada'
  | 'tabla'  | 'campos'
  | 'codigo' | 'formula'
  | 'imagen' | 'epigrafe' | 'nota_al_pie'
  | 'encabezado' | 'pie'
```

**Lo decide R3, no una preferencia de estilo.** R3 separa *lo que el documento
dijo* de *lo que Savia concluyó*:

| Candidato | ¿De dónde sale? | ¿Va en la IR? |
|---|---|---|
| `titulo` | El documento lo declaró: `styleId`, `<h1>`, prominencia medible | Sí — hecho de lectura |
| `codigo` | El documento lo declaró: `<pre>`, fence, marcador | Sí — hecho de lectura |
| `factura` | **Nada en los bytes lo dice** | No — es una conclusión |
| `receta`, `clausula`, `poliza` | Ídem | No — son conclusiones |

**Lo que un formato puede declarar es finito**, y por eso el conjunto se cierra
sin perder nada: hay solo tantas cosas que un `styleId`, un tag o un modelo de
layout saben decir. Lo ilimitado es el otro conjunto —las conclusiones— y ese ya
tiene casa: anotaciones en Postgres, ancladas al identificador estable del tramo 4.

**La válvula de escape de la apertura son las anotaciones, no un enum más ancho.**

### Qué compraba la apertura, y qué costaba

Casi nada, y bastante. Si un clasificador no sabe nombrar algo, se abstiene y el
piso físico responde. Con vocabulario abierto habría emitido `'poliza'` y **habría
caído al mismo `text_span`**. La apertura no compraba comportamiento — compraba
una etiqueta más específica.

Y costaba deriva: nada impedía que un clasificador emitiera `titulo`, otro
`heading` y otro `title`. Los tres compilan. R2 prohíbe ramificar, así que nada se
rompe — pero R2 **sí permite leer** para mostrar y filtrar, y ahí la deriva es
visible para el usuario. Con trece adaptadores escritos por gente distinta a lo
largo de años, es cuestión de tiempo.

### La pareja obligatoria

Que el adaptador elija la forma es más simple, pero abre la puerta a que un
adaptador distraído emita `text_span` para código y el fragmentador lo reflowee.
Por eso ciertos tipos **exigen** su forma:

```ts
const FORMA_OBLIGADA = {
  codigo: 'verbatim', formula: 'verbatim',
  tabla: 'grid', campos: 'fields', imagen: 'asset',
}
```

No se corrige en runtime: **se verifica**. Un adaptador que la viola no entra al
registro. La simulación la incluyó y atrapó de inmediato un `tipo:'tabla'` con
forma `fields` — exactamente la clase de error para la que existe.

### Cómo se agrega un valor

Con un cambio deliberado en `ir`, que es un cambio de contrato y se ve como tal en
el diff. Si lo que se quiere expresar es una **conclusión**, la respuesta no es un
`tipo` nuevo: es una anotación.

El enum vive en `ir` y no en el núcleo de traducción porque el grafo de paquetes
lo obliga: `adaptadores` lo emite y el fragmentador lo lee, y esos dos no se ven
entre sí. `ir` es el único lugar que ambos alcanzan.

## La delegación es emergente

Un `.docx` con un `.xlsx` incrustado, un `.eml` con adjuntos, una página escaneada
dentro de un PDF, la foto de una diapositiva. Son todos el mismo caso, y **ninguno
necesita que el adaptador haga nada especial**:

> **Un asset delega si algún adaptador reclama sus bytes.**

Eso es literalmente `seleccionar()`, el tramo 2, aplicado al asset. Los bytes
vuelven a entrar, se elige adaptador, y el resultado se injerta donde estaba la
pieza — de modo que el contenido incrustado hereda el contexto jerárquico de su
contenedor.

```
contrato.pdf
├── pg1  runs → geometría → titulo, parrafo
├── pg2  runs → geometría → parrafo
└── pg3  sin capa de texto → asset(raster)
              │  seleccionar() → adaptador `imagen`
              └─→ titulo · parrafo · tabla · imagen      ← se injertan acá
```

Antes esto era `tipo: 'delegado'` más un clasificador `miembros` para
contenedores. **Los dos desaparecen**: el tipo era declarar algo que el sistema ya
puede deducir, y el clasificador de contenedores no hacía otra cosa que emitir
assets. El registro tampoco necesita una fila para "contenedores": un `.zip` es un
adaptador que emite un asset por miembro, y la recursión ocurre sola.

Y hay tres consecuencias que no costaron nada:

**1. Un solo adaptador de PDF.** Antes había dos —uno para PDF con texto, otro
para escaneados— y como la selección elige **un adaptador por documento**, un
contrato firmado (198 páginas de texto + 2 escaneadas) entraba entero por uno de
los dos y la mitad se procesaba mal. Ahora el adaptador de PDF emite runs donde
los hay y un asset donde no, y la página escaneada se resuelve sola.

**2. La cola perceptual deja de ser un problema.** Un asset delegado **ya es una
unidad de trabajo independiente**: se agenda solo en la cola lenta mientras las
198 páginas de texto siguen por la rápida. No hizo falta inventar agendamiento
por página — la delegación lo da.

**3. La descripción de imágenes y el reconocimiento de escaneados son lo mismo.**
Antes eran dos mecanismos: `modeloLayout` para páginas escaneadas, y un
enriquecimiento `descripción` para imágenes. Ahora hay uno: toda imagen se
descompone en bloques, y **la descripción es el caso degenerado** — cuando el
layout encuentra una sola región y es pictórica.

| Entrada | Resultado |
|---|---|
| Página escaneada | bloques: título, párrafos, tabla |
| Foto de un PPT | bloques: título, viñetas |
| Captura de una tabla | un `grid` |
| Foto de un gato | un bloque: asset con descripción pendiente |

### Dónde frena: cuando deja de aportar

La recursión **no para por una regla sobre imágenes ni por un contador**. Para
cuando la descomposición deja de agregar información:

> **Punto fijo.** Si descomponer un asset devuelve un solo bloque cuyo contenido
> es el mismo que entró, se tocó fondo.

Un logo descompuesto devuelve una región pictórica que **es el logo**. Una foto de
un gato, lo mismo. Un certificado devuelve título, fecha y sello — aportó, y sigue.

No es una regla sobre imágenes: vale para cualquier cosa que no se abra más, y por
eso también cubre el `.zip` que se contiene a sí mismo. Es la definición más
honesta de "no se puede descomponer más" que existe — se descubre haciéndolo, no
declarándolo.

> **Precondición de terminación:** una región que cubre casi todo su origen debe
> **referenciar el original**, nunca materializar un recorte. Si cada nivel
> generara bytes nuevos, el hash cambiaría siempre y el punto fijo no dispararía
> jamás: se recursaría sobre recortes infinitesimalmente distintos hasta agotar el
> presupuesto. El recorte solo se materializa cuando es genuinamente una parte.

Dos guardas más, y ninguna es semántica:

- **Ciclo.** Un hash de contenido que ya está en la cadena de ancestros corta.
  Protege de archivos armados a propósito (A contiene B contiene A), donde el
  punto fijo por sí solo no alcanza porque cada paso *sí* devuelve algo distinto.
- **Presupuesto.** Techo de recursos por documento. Lo que no alcanzó a
  descomponerse **no se descarta: queda encolado y el documento se marca
  `parcial`.** Agotar el presupuesto difiere trabajo, nunca pierde información.

### El costo se acota sin adivinar

El filtro por tamaño intentaba resolver un problema real —un DOCX corporativo trae
el mismo logo en 200 encabezados— con la herramienta equivocada. Dos mecanismos lo
resuelven sin descartar nada:

**1 · Contenido direccionable: se descompone una vez por contenido, no por
aparición.** El almacenamiento ya es direccionado por contenido y el caché de
reconocimiento ya se indexa por `hashBytes`; un asset incrustado entra por el mismo
camino. Las 200 apariciones del logo son **el mismo objeto**, así que la primera se
descompone y las otras 199 son aciertos de caché.

```
200 encabezados con el mismo logo → 1 invocación al modelo + 199 aciertos
```

El caso patológico —un documento con 50 imágenes decorativas **distintas**— es raro,
porque la decoración se repite por naturaleza y lo que no se repite suele ser
contenido: figuras, gráficos, capturas. Y aun ahí se paga una vez y nunca más.

**2 · El mobiliario de página se descompone último, no nunca.** Cuando el formato
**declara** que algo está en un encabezado o un pie (`<w:hdr>`, `<header>`), eso es
un hecho de lectura, no una heurística — y sirve para **ordenar la cola**, no para
excluir. Los assets del cuerpo se descomponen primero; si el presupuesto se agota,
lo que queda pendiente es lo de menor valor esperado **por construcción**, y sigue
encolado.

La diferencia con el filtro es exactamente esta: **ordenar nunca pierde
información; excluir sí.** Si ese logo resulta ser un certificado, se descubre —
más tarde, pero se descubre.

> **El presupuesto cuenta trabajo, no intentos.** Un acierto de caché no descuenta.
> La simulación encontró lo contrario: las 200 apariciones del logo agotaban el
> presupuesto del documento con operaciones que costaban cero.

## Los decodificadores y sus trampas

Las trampas reales viven en `descomponer`, y si se resuelven mal se corrompe todo
aguas abajo sin que ningún tramo posterior pueda notarlo:

- **Codificación de caracteres.** UTF-8, Latin-1 o UTF-16 mal detectados
  convierten "Categoría" en "CategorÃ­a" — y eso llega hasta el embedding.
- **Orientación EXIF.** Si no se normaliza, el modelo de layout ve la página de
  costado.
- **Celdas combinadas.** Se resuelven **acá**, propagando el valor: una celda
  combinada sobre tres filas se vuelve el mismo valor en las tres. Es lo que
  mantiene rectangular a `grid`, y de la rectangularidad dependen la identidad por
  fila y el ventaneo del tramo 5.
- **Archivos rotos.** Son la norma, no la excepción. Es tolerante **y avisa**.

Condición no negociable: **es determinístico.** Mismos bytes, misma estructura.

## Dos clasificadores en detalle

### `porProminencia` — títulos sin estilo

El caso más común del mundo real: títulos en negrita y 16 pt, sin usar estilos.

```
1. medir       para cada párrafo: (tamaño, peso, mayúsculas, longitud, espacio antes)
2. el cuerpo   la moda de tamaño PONDERADA POR CARACTERES
3. candidatos  los que superan al cuerpo en prominencia y son cortos
4. agrupar     por (tamaño, peso) exactos
5. ordenar     los grupos por prominencia descendente → nivel 1, 2, 3…
```

La ponderación por caracteres es lo que lo hace funcionar: un documento con 30
títulos y 20 párrafos elegiría el tamaño equivocado como "cuerpo" si se ponderara
por cantidad.

Guardas: máximo 4 niveles; un candidato de más de ~120 caracteres probablemente
sea cuerpo enfatizado; si aparecen más grupos que niveles, los últimos colapsan.

### `regionesDeGrilla` — planillas

```
1. barrer filas y columnas totalmente vacías → cortes candidatos
2. por cada bloque: perfilar el tipo dominante de cada columna
3. encabezado: la primera fila cuyo tipo difiere del tipo modal de su columna
4. grano: hay encabezado y ≥2 filas de datos → 'fila'
          si no                             → 'entero'
```

El grano separa **unidad de identidad** (la fila, que se hashea y se versiona) de
**unidad de embedding** (la ventana de filas, que se vectoriza). Una hoja de
50 000 filas produce 50 000 identidades y muchos menos vectores.

## La escalera de degradación

| Nivel | De dónde saca el tipo | Certeza | Costo |
|---|---|---|---|
| **Declarativo** | El formato lo dice (`styleId`, tag, marcador) | `declarado` | Nulo |
| **Físico** | La forma que ya se leyó | `declarado` | Nulo |
| **Posicional** | Geometría y estadística del documento | `inferido` | Bajo |
| **Perceptual** | Un modelo mira píxeles | `inferido` + confianza | Alto |

Se baja un escalón solo cuando el anterior se abstuvo. Un PDF nativo nunca llega
al modelo; uno escaneado empieza ahí.

**La certeza no se queda en este tramo**: viaja con el nodo, sobrevive a la
fragmentación y llega hasta la skill que consuma esa memoria. Una skill puede
decidir no citar como autoridad algo reconocido con confianza baja. Es la
diferencia entre un pipeline que adivina y uno que declara cuánto está adivinando.

## Diagnóstico y presupuesto

El tramo 1 define un estado `parcial`, pero sin canal para llenarlo es una
etiqueta vacía. El canal va en el contexto, **no en los retornos** — meterlo ahí
contaminaría la firma de los dos casilleros.

```ts
interface Diagnóstico {
  aviso(código: string, ubicación: Ubicación, detalle?: string): void
  degradado(de: string, a: string, razón: string): void
}
type Presupuesto = {
  msMáximo: number; nodosMáximos: number; bytesMáximos: number
  invocacionesMáximas: number     // el techo del costo perceptual
}
```

Excederlo **degrada y lo registra** — nunca mata al worker. Un zip bomb, un PDF de
800 páginas o una columna de un millón de filas son entradas esperables, no
incidentes.

**El presupuesto cuenta trabajo, no intentos:** un acierto de caché no descuenta,
porque no cuesta. Y agotarlo **difiere, no descarta** — los assets sin descomponer
quedan encolados y el documento se marca `parcial`.

## El determinismo se verifica

Toda la validez del caché descansa en que el reconocimiento sea puro. Ese
invariante atraviesa trece adaptadores escritos por gente distinta, así que
afirmarlo no alcanza:

```
property test — para cada adaptador a, para cada archivo f del corpus:
    a.reconocer(f)  ≡  a.reconocer(f)        árbol byte-idéntico
```

Corre en CI sobre un corpus real versionado con el repo. **Un adaptador que no lo
pasa no entra al registro.**

El modelo perceptual no rompe esto: corre dentro de `descomponer` del adaptador de
imagen, y su versión está en la clave del caché.

## El registro

| Adaptador | Encuentra bloques | Los tipa | `via` |
|---|---|---|---|
| `chat` | los párrafos del mensaje | se abstiene → piso | `ninguna` |
| `.md` | mdast | mapeo | `padre` |
| `.html` | DOM | mapeo | `padre` |
| `.docx` | párrafos OOXML | cascada: estilo → prominencia | `nivel` |
| `.odt` | párrafos ODF | cascada: estilo → prominencia | `nivel` |
| `.xlsx` | regiones de grilla | por región | `celda` |
| `.csv` | regiones de grilla | por región | `celda` |
| `.pdf` | runs, o asset si no hay capa de texto | geometría | `nivel` |
| `.pptx` | marcadores de diapositiva | mapeo | `espacial` |
| `.png/.jpg` | **modelo de layout** | el mismo modelo | `espacial` |
| `.zip/.eml` | un asset por miembro | se abstiene → piso | `ninguna` |
| _piso de texto_ | líneas | se abstiene → piso | `ninguna` |

Doce filas, una por formato. **PDF nativo comparte jerarquía con DOCX**: la
geometría trabaja en la clasificación y solo entrega un nivel; de ahí en adelante
es la misma pila.

## Chat, y por qué no es Slack

Savia tiene cuatro canales y uno es conversación. Si el chat necesitara un camino
paralelo, esto no sería la arquitectura de Savia: sería la de un procesador de
archivos con un chat pegado al costado.

```ts
export const chat = {
  id: 'chat',
  evidencia: porOrigen('chat', Evidencia.Firma),
  descomponer: (msg) => msg.párrafos.map((p, i) => ({
    señales: {},
    cuerpo: { forma: 'text_span', texto: p.texto, marcas: p.marcas },
    ubicación: { ancla: `msg#${i}` },
  })),
  detectar: () => () => null,        // se abstiene: el piso responde 'parrafo'
}
```

Diez líneas, y hereda fragmentación, embeddings, diferencia, procedencia y
citación. Que el canal más distinto entre por la misma puerta es la evidencia más
fuerte de que la descomposición es correcta.

Este adaptador cubre la **herramienta invocada por MCP**: un agente decide que algo
vale la pena y lo manda. Lo que llega ya viene curado — una afirmación, no una
transcripción. Recibe la afirmación precisamente porque extraer hechos de una
conversación exigiría un modelo de lenguaje en el camino de escritura.

> ⚠️ **Punto abierto P5.** Este adaptador **no cubre Slack ni Teams**. Esas son
> integraciones, y se parecen mucho más a un documento: un hilo es un contenedor y
> cada mensaje una unidad con su propia autoría. Pero tienen algo que ningún
> documento tiene: **nadie eligió subirlo**. Hace falta un filtro de relevancia
> previo que no existe en ninguna otra entrada — y ese filtro es Capa 2/4, no este
> pipeline. **No bloquea el cierre de este tramo.**

## Qué sale del tramo

```ts
type Nodo = {
  tipo:      Tipo            // conjunto cerrado — metadato, nunca condición
  cuerpo:    Cuerpo          // una de las seis formas — SIN formato
  ubicación: Ubicación
  autoría:   Autoría
  certeza:   'declarado' | 'inferido'
}

type Cuerpo =
  | { forma: 'text_span'; texto: string; marcas: Marca[] }
  | { forma: 'verbatim';  texto: string; lenguaje?: string }
  | { forma: 'asset';     ref: RefObjeto; mime: string; pendientes: Enriquecimiento[] }
  | { forma: 'grid';      encabezados: string[]; filas: Celda[][]; grano: Grano }
  | { forma: 'fields';    pares: { etiqueta: string; valor: string }[] }
  | { forma: 'container'; ordenado: boolean }

type Ubicación = { adaptador: string; ancla: string; caja?: Caja; rango?: [number, number] }
type Autoría   = { actor: ActorId; cuándo: Instante; fuente: string }
```

Cada forma existe porque **algún consumidor aguas abajo se comporta distinto**.
Ese es el criterio — no una taxonomía de contenido:

| Distinción | Quién la necesita | Para qué |
|---|---|---|
| `text_span` vs `verbatim` | fragmentador | ¿reflowear, o los espacios son significativos? |
| `grid` vs `fields` | compositor | ¿muchos registros o uno solo? |
| `asset` | embebedor | no hay texto → diferir enriquecimiento |
| `container` | fragmentador | alcance para las migas de pan |
| `container.ordenado` | síntesis | ¿siete pasos en orden, o siete cosas ciertas? |

**`ordenado` sostiene la tesis del producto.** Sin ella un procedimiento es
indistinguible de una lista, y "skills ejecutables" no se puede construir sobre eso.

> **`container` no lleva hijos.** La jerarquía se expresa **solo** con `parentId`
> en la lista plana que emite el tramo 4. Un payload que anida nodos rompe la
> lista plana y vuelve inexpresable la identidad estable por elemento. Se verifica
> en compilación:
>
> ```ts
> type NoAnida<U> = U extends unknown
>   ? (ClavesConNodo<U> extends never ? never : ['IR-ERR: el payload anida un nodo', U])
>   : never
> type _Invariante = AssertNever<NoAnida<Cuerpo>>
> ```

`Ubicación` es **opaca**: página, hoja y offset no significan nada para un mensaje
ni para un evento. Solo el adaptador que la produjo sabe resolverla a una vista
del original, y eso hace falta recién en la citación.

`Autoría` es obligatoria en todos los nodos. Savia es multi-parte por diseño:
*"esto lo dijo el CFO en marzo"* es la mitad del valor de la memoria.

**Todavía no hay identificador.** Uno útil necesita las migas de pan, y esas las
produce el recorrido del tramo 4.

## Dónde vive la cohesión

La cohesión —`atomic`, `splittable`, `lead`, `satellite`— **no es un campo**. Es
una función pura de dos campos que ya existen, y la llama su único consumidor:

```ts
// packages/ir
const COHESIÓN = { titulo:'lead', subtitulo:'lead',
                   epigrafe:'satellite', nota_al_pie:'satellite' }

export const cohesiónDe = (tipo: Tipo, forma: Forma): Cohesión =>
  COHESIÓN[tipo] ?? (forma === 'text_span' ? 'splittable' : 'atomic')
```

Cuatro entradas. Todo lo demás se deriva: la prosa se parte, el resto no.

Un campo derivado y almacenado puede quedar en desacuerdo con lo que lo derivó;
una función no. Y como el único que la consulta es el fragmentador, guardarla no
compraba nada.

## Decisiones tomadas

- **Dos casilleros de formato**, `descomponer` y `detectar`. Eran cinco.
- **La unidad tiene dos caras**: señales que mueren, cuerpo que cruza.
- **El adaptador emite la forma final.** El núcleo no transforma payloads.
- **La pareja `tipo⇒forma` se verifica, no se corrige.**
- **`detectar` es una factory** — la doble pasada es privada del que la necesita.
- **El piso físico reemplaza a la regla de totalidad**, y produce `declarado`.
- **La jerarquía se deriva de la pista**, y la pista lleva solo jerarquía.
- **`tipo` es un conjunto cerrado de 15 hechos de lectura.** Lo que Savia concluye
  va a anotaciones, por R3.
- **La delegación es emergente**: un asset delega si algún adaptador lo reclama.
- **Nada se descarta por adivinar qué es.** No hay prefiltro: la descomposición
  *es* la identificación. Un certificado de 32 px entra igual que uno de 3000.
- **La recursión termina por punto fijo**, no por una regla sobre imágenes ni por
  un contador: para cuando deja de aportar información.
- **El costo se acota por contenido direccionable y por prioridad**, nunca por
  exclusión. Ordenar difiere trabajo; excluir pierde información.
- **El presupuesto cuenta trabajo, no intentos**, y agotarlo encola en vez de
  descartar.
- **Ningún modelo de lenguaje**, salvo el perceptual sobre lo que solo existe como
  píxeles. Lo declarativo y lo posicional son código determinístico, y son el 95%
  del volumen.
- **La certeza es parte del dato**, no un log.
- **Presupuesto por corrida** — degradar, nunca caer.
- **`container` no lleva hijos** — la jerarquía es `parentId`, verificado en
  compilación.

## Costo y latencia

Todo el costo se concentra en `descomponer`. Los decodificadores son librerías, y
el clasificador es lo único que hay que pensar de nuevo para cada formato
genuinamente distinto.

| Ruta | Orden de magnitud |
|---|---|
| Declarativo (DOCX, HTML, MD, XLSX) | decenas de milisegundos |
| Posicional (PDF nativo) | cientos de milisegundos por documento |
| Perceptual (imagen, página escaneada) | segundos por imagen, **en cola aparte** |

Como el perceptual entra por delegación, un documento mixto no espera: sus partes
de texto se indexan y las imágenes llegan después.

---

# Tramo 4 — Emisión e identidad

**Entra:** la secuencia de nodos del tramo 3, cada uno con su pista.
**Sale:** una lista plana, en orden de lectura, donde cada nodo sabe **de quién
cuelga**, **en qué contexto vive** y **quién era antes**.

Es el primer tramo que no conoce formatos, y el que produce aquello de lo que
cuelga todo lo demás: el identificador al que R3 ancla las anotaciones.

## Por qué la identidad no se puede calcular

El encargo original de este tramo era producir un identificador estable con
`hash(migas ‖ contenido ‖ ordinal)`. Esa fórmula no sobrevive el uso real, y el
problema no es la fórmula: **ninguna función de una sola versión puede.**

| Si el identificador incluye… | Se rompe cuando… |
|---|---|
| el **ordinal** entre hermanos | se inserta un párrafo arriba → se mueven los ids de todos los que siguen |
| las **migas** (títulos de ancestros) | alguien corrige un título → se despegan todos sus descendientes |
| **posiciones estructurales** en lugar de títulos | se inserta una sección → cambia todo lo que cuelga de las siguientes |
| **solo el contenido** | dos párrafos idénticos colisionan |

No hay combinación que sobreviva las cuatro, porque el problema es de fondo: **un
elemento "es el mismo" respecto de otra versión, no en abstracto.** La identidad es
un juicio comparativo, y comparar exige dos documentos.

Esto importa más que en cualquier otro tramo. Por R3, la curación del cliente
—sensibilidad, exclusiones, correcciones— cuelga de estos identificadores. Un id
que se mueve solo **despega ese trabajo sin que nada se ponga rojo**: es el peor
modo de falla del pipeline entero, porque no falla, empeora.

Por eso el tramo se llama **emisión e identidad** y no solo emisión: asignar
identidad requiere la lista plana y la versión anterior, que es exactamente lo que
este tramo tiene en la mano. Separarlos obligaría a pasear ese estado.

## Tres piezas

### 1 · Ruta — de dónde cuelga cada nodo

Cada pista se convierte en un **camino desde la raíz**: la lista de contenedores
abiertos por encima del nodo. No se incluye a sí mismo — dice de dónde cuelga, no
quién es.

```
#  texto                        pista       ruta
0  Contrato de servicios        nivel 1     [ ]
1  Cláusula primera             nivel 2     [Contrato]
2  El proveedor entregará…      —           [Contrato, Cláusula primera]
3  El pago se realizará…        —           [Contrato, Cláusula primera]
4  Cláusula segunda             nivel 2     [Contrato]
5  La confidencialidad…         —           [Contrato, Cláusula segunda]
```

Cinco pistas, cinco funciones, y **dos son de una línea**:

| Pista | Cómo se calcula la ruta |
|---|---|
| `ninguna` | `[]` |
| `celda` | `[hoja, región, fila]` — la planilla ya *es* un camino |
| `nivel` | la pila de títulos abiertos a esa profundidad |
| `padre` | caminar la cadena de padres |
| `espacial` | derivar contención geométrica y caminar como `padre` |

`espacial` no es una sexta forma de armar árboles: la contención **es** una
relación de padre, solo que calculada con geometría en vez de leída. Reusa el
caminador de `padre` entero.

Antes esto eran cinco estrategias que construían **cinco árboles** por caminos
distintos. Ahora solo calculan rutas, y el árbol se arma una vez.

### 2 · Emisor — un solo recorrido

Se recorre la lista **una vez**, con una pila. En cada nodo se compara su ruta con
la del anterior:

```
para cada nodo, en orden de lectura:
    si BAJÓ de un subárbol delegado  → cerrar sus scopes
    si SUBIÓ a un subárbol delegado  → el nodo que delegó abre un scope propio
    común = prefijo compartido entre la ruta anterior y la actual
    cerrar los scopes por encima de común
    abrir los scopes nuevos
    parentId ← el tope de la pila
    migas    ← los scopes abiertos que son TÍTULOS
```

Traza sobre el ejemplo:

```
#0  [ ]              común 0   la pila queda vacía            parent —
#1  [Contrato]       común 0   abre Contrato                  parent Contrato
#2  [C, Cláu.1ª]     común 1   abre Cláusula primera          parent Cláusula primera
#3  [C, Cláu.1ª]     común 2   no cambia nada                 parent Cláusula primera
#4  [Contrato]       común 1   CIERRA Cláusula primera        parent Contrato
#5  [C, Cláu.2ª]     común 1   abre Cláusula segunda          parent Cláusula segunda
```

De la misma pila salen **las dos cosas** que el tramo debe producir — pero no son
lo mismo, y confundirlas fue un error que estuvo escrito acá:

> **`parentId` es el tope de la pila. Las migas son solo los scopes que son
> títulos.**

La distinción importa porque la pila no siempre son títulos. En un DOCX sí. Pero
en HTML los scopes son ancestros del DOM —`body / div / section / ul / li`— y eso
como miga de pan es basura. **La ruta es estructural; las migas son legibles.**

Y el subárbol delegado **abre su propio scope**: sus nodos cuelgan del punto de
injerto y numeran relativo a él, sin participar de la escala de niveles del
documento padre. Sin eso, un título que un modelo de layout encuentra dentro de
una página escaneada se mezcla con los niveles del contrato que lo contiene.

Ahí la cohesión `lead` se gana el sueldo dos veces: marca dónde abre un chunk **y**
qué títulos están abiertos. No hay una segunda estructura para las migas.

> **El árbol nunca existe como estructura.** Es la pila durante el recorrido. Por
> eso se puede emitir en streaming sin materializar el documento en memoria, y por
> eso `container` no necesita llevar hijos.

**No se almacena nada derivable:** ni `depth`, ni `siblingIndex`, ni `ordinal`. Se
caminan desde `parentId` cuando hagan falta.

> Ojo con el alcance de esa regla: vale para la versión **viva**, donde el árbol
> existe. El orden de la versión **anterior** no se camina desde nada, porque ese
> árbol ya no existe — y el pase 2 lo necesita. Va en el índice de reconciliación,
> abajo. No es duplicar algo derivable: es recordar algo irrecuperable.

### 3 · El índice de reconciliación

El reconciliador compara contra la versión anterior. **¿De dónde sale esa versión?**

Los pases 2 y 3 emparejan **por parecido**, así que necesitan el contenido viejo, no
solo su hash. Y R3 declara la IR descartable: *"se regenera entera desde los bytes en
cada re-ingesta"*. Parece una contradicción de frente.

**No lo es, y la clave está en de qué lado de R3 cae el `ElementId`.** R3 parte el
mundo entre *lo que el documento dijo* y *lo que Savia concluyó*. El `ElementId` no
está en el documento: no se lee de los bytes, **lo concluye este tramo**. Por eso
ancla la curación y por eso ya vive en Postgres.

El índice de reconciliación es la **evidencia que sostiene esa conclusión**. No es la
IR persistida — es la memoria del reconciliador, y su único consumidor es la próxima
reconciliación. R3 estaba escrita como si el id viniera solo.

```
nodo_conocido    (elementId, hash, tipo, forma, proyección)
version_nodo     (documentoId, versión, orden, elementId)
```

**Qué NO guarda.** Ni el cuerpo, ni la ubicación, ni las pistas, ni la autoría, ni las
marcas. Solo la **proyección**, porque la similitud de los pases 2 y 3 opera sobre
tokens y no sobre cuerpos — la costura ya estaba en la única proyección del sistema.

**Re-reconocer los bytes viejos no es alternativa.** Devuelve nodos; no devuelve sus
identidades, que son justamente lo que se está preservando.

**La versión se identifica por `hashBytes`**, no por un contador: los bytes que
produjeron una versión la identifican, y ya están en la fila `documento`. Sin
secuencia que coordinar.

**Se acumula, no se reemplaza.** La primera versión de este diseño tiraba la anterior
para ahorrar espacio, y no ahorra: `nodo_conocido` está direccionado por contenido, y
un nodo que no cambió entre versiones es **la misma fila** —mismo id, mismo hash,
misma proyección— así que se guarda una vez. Cincuenta versiones con 1 % de cambio
cuestan ≈ 1,05 versiones.

Es exactamente el mecanismo de git, que tampoco guarda diferencias: guarda copias
completas direccionadas por contenido y calcula los diffs cuando se los piden.
Tirar la versión anterior no ahorraba casi nada y cerraba las consultas temporales
—*"¿qué decía este contrato en marzo?"*— que son la mitad del valor de la memoria.

> **Optimización conocida, con gatillo:** guardar un **bosquejo** de la proyección
> (minhash, ~128 bytes por nodo) en vez de la proyección completa. Cambia similitud
> exacta por aproximada. Gatillo: si el índice pesa — una planilla de 50 000 filas
> produce 50 000 identidades, así que el caso existe.

**Contra qué versión anterior se reconcilia.** Cuando el canal trae un id estable de
la fuente, contra ese documento. Cuando no —frontend, chat, carpeta— el candidato
sale del mismo índice, leído al revés: `hash → documento`.

Y acá hay una trampa que hay que esquivar. **Contar hashes compartidos a secas no
sirve.** Trescientos contratos hechos con la misma plantilla comparten la mayoría de
sus nodos; subir el de Beta lo emparejaría con el de Acme por el articulado común, y
**reemplazaría un documento con otro**. El caso está en todo este documento y la
detección ingenua se lo come entero.

La salida no es un mecanismo nuevo: es **la regla del pase 1, aplicada un nivel más
arriba**. El pase 1 solo ancla con hashes que aparecen una única vez de cada lado,
porque *«emparejarlo sería transferirle la identidad al elemento equivocado sin que
nada lo detecte»*. Lo mismo vale para elegir candidato:

> **Solo votan los hashes que aparecen en exactamente UN documento del corpus.**
> Un nodo que está en trescientos documentos no dice nada sobre identidad.

Con eso, cada caso cae donde debe:

| Entra | Sus nodos distintivos | Resultado |
|---|---|---|
| `contrato-acme-v2.pdf`, renombrado | «Acme Corp», montos, fechas → en **1** documento | candidato fuerte → **versión nueva** |
| `contrato-beta.pdf`, misma plantilla | articulado → en **300**, excluido · «Beta Corp» → en **0** | sin votos → **documento nuevo** |
| Un documento reescrito entero | casi nada sobrevive | sin votos → **documento nuevo**, y el anclaje diría lo mismo |

**Cero parámetros nuevos.** No hay umbral de rareza que barrer: «aparece en exactamente
un documento» es la misma regla binaria del pase 1.

Y funciona porque el índice **acumula**: v1 y v2 de un mismo documento comparten
`DocumentoId`, así que un hash presente en las dos sigue contando como *un* documento.
La frecuencia se mide por documento, no por versión.

> **Costo, con gatillo:** una planilla de 50 000 filas son 50 000 hashes a consultar.
> Si pesa, se consulta con una **muestra determinística** en vez de con todos —
> estimar solapamiento desde una muestra es estadísticamente sólido. Primero la
> versión simple.

### 4 · Cómo nace un `ElementId`

**Se acuña al azar.** ULID o UUIDv7 — marca de tiempo más azar, 128 bits, ordenable
por instante de acuñado, sin coordinación. El orden monótono no es cosmético: reduce
la fragmentación del índice en Postgres frente a ids puramente aleatorios.

Esto se planteó como una disyuntiva sin salida: *si son aleatorios falla el property
test de determinismo; si se derivan del contenido, vuelve la fórmula de una sola
versión.* **Una de las dos mitades no es cierta.**

El test dice *"para cada adaptador `a`: `a.reconocer(f) ≡ a.reconocer(f)`, árbol
byte-idéntico"*. Compara **la salida de un adaptador**, y esa salida **no tiene ids**:

```
bytes ──▶ ADAPTADOR ──▶ Unidad { señales, cuerpo, ubicación }    sin id
                    ──▶ NodoCrudo { tipo, cuerpo, ubicación, … } sin id
          ╰─────────── esto es lo que compara el test ──────────╯

          TRAMO 4  ──▶ NodoEmitido { id, parentId, migas, hash }  ◀── acá nace
```

Un test que compara artefactos sin ids no se puede romper por cómo se acuñan los ids.
Y el tramo 4 tiene **su propio** invariante, que es otro: no *"byte-idéntico"* sino
**"ids movidos = 0"**. Dos garantías, dos artefactos, dos tramos.

La otra mitad sí es cierta: derivarlos reintroduce `hash(migas ‖ contenido ‖ ordinal)`,
y editar un título despegaría la curación de toda su sección. Queda descartada.

**Unicidad global, y el documento lo lleva el contenedor.** Con 128 bits de azar la
unicidad global es gratis: no se elige, se obtiene. Lo que sí se decide es si cada
referencia arrastra su documento, y la respuesta es no — un fragmento pertenece a
**un** documento, un registro también, una anotación también, así que el contenedor ya
lo sabe y repetirlo por elemento sería **almacenar algo derivable**, lo mismo que se
prohíbe con `depth`, `siblingIndex` y `ordinal`. La tabla de nodos sí lleva su columna
`documento` —borrado en cascada, filtro por tenant, particionado—; las referencias no.

**Un id es estable desde que se persiste.** La idempotencia del emisor no la da el
acuñado: la da el reconciliador. Volver a emitir no acuña ids frescos — reconcilia
contra el índice, y lo que no cambió ancla por hash y conserva su id. Por eso una
re-emisión por delegación tardía no mueve nada.

> **Requisito sobre el tramo 7, y no estaba escrito:** el índice de reconciliación y
> los nodos se persisten **en la misma transacción**. Si una corrida guarda los nodos
> y no el índice, la próxima re-ingesta no tiene contra qué reconciliar: se mueven
> todos los ids y se despega toda la curación, en silencio.

### 5 · Reconciliador — tres pases

Corre siempre que el documento tenga una versión anterior en el índice. La primera
vez se acuñan ids nuevos y listo.

| Pase | Qué hace | Qué caso resuelve |
|---|---|---|
| **1 · Anclas** | Empareja por hash de contenido, **solo los hashes que aparecen una única vez de cada lado** | Lo que no cambió — sin importar dónde quedó |
| **2 · Huecos** | Las anclas parten ambas listas en tramos; dentro de cada tramo se empareja por parecido, con mismo tipo y misma forma | Lo que se **editó** en su lugar |
| **3 · Residuo** | Lo que quedó suelto de los dos lados, comparado **sin restricción de posición** | Lo que se movió **y** se editó |

Lo que sigue sin par: del lado nuevo son **altas**, del lado viejo, **bajas**.

**La regla de unicidad del pase 1 es lo que evita el bug silencioso**: si un hash
aparece dos veces, no sirve de ancla, porque emparejarlo sería transferirle la
identidad al elemento equivocado sin que nada lo detecte.

**El pase 3 parece redundante y no lo es.** Se intentó borrarlo con el argumento de
que el pase 1 ya empareja lo movido —cierto, pero solo lo movido *sin editar*.
Cuando un nodo se mueve **y** se edita, su posición vieja y la nueva caen en huecos
distintos, y el pase 2 confina la similitud a un hueco: nunca llegan a compararse.
Es la celda que falta en la matriz *(¿se movió?) × (¿cambió?)*, y la simulación la
encontró en cuanto se quitó.

**El umbral de similitud no se fija por decreto.** Es un parámetro; se barre sobre
el corpus y el valor por defecto sale de esa medición. Un número inventado con
precisión falsa es peor que uno declarado como pendiente.

## Por qué esto funciona: el caso del título editado

```
                     v1                              v2
#1  título     "Cláusula primera"              "Cláusula 1ª"        ← editado
#2  párrafo    ruta [Contrato, Cláusula primera]  ruta [Contrato, Cláusula 1ª]
```

**La ruta del párrafo cambió** — lleva el texto del título adentro. Con la fórmula
original ese párrafo habría recibido un id nuevo, y toda la curación del cliente en
esa sección se habría despegado en silencio.

Pero el id no sale de la ruta. El **contenido** del párrafo no cambió, su hash es
el mismo, el pase 1 lo ancla → **mismo id**. Solo el título, que sí cambió, recibe
uno nuevo.

Ese es el reparto que sostiene el tramo:

> **La ruta sirve para estructura y migas. La identidad sale de comparar dos
> versiones.** Mezclarlas es lo que rompía.

## La delegación tardía no necesita mecanismo

Una página escaneada que se descompone media hora después —o un asset que quedó
encolado por presupuesto— no requiere ningún injerto especial. Es una **re-emisión**
del documento contra su versión anterior:

```
todo lo que ya estaba     → hash idéntico       → pase 1 → MISMO id
el asset que ganó hijos   → su contenido no cambió       → MISMO id
los nodos del subárbol    → sin par             → altas
```

Cero identificadores movidos. Y de ahí sale la respuesta a *"¿el documento espera a
sus delegaciones o se indexa con lo que tiene?"*: **se indexa de inmediato**,
marcado `parcial`, y lo que llega después no mueve nada. No es una decisión de
producto — es una consecuencia del reconciliador.

## Qué sale del tramo

```ts
type NodoEmitido = Nodo & {
  id:       ElementId          // ← de la reconciliación, no de una fórmula
  parentId: ElementId | null   // ← del emisor
  migas:    string[]           // ← del emisor, misma pila
  hash:     ContentHash        // ← material para la próxima reconciliación
}
```

`hash` viaja porque la reconciliación de mañana lo necesita: es lo único que
permite anclar sin mirar posición.

> **La huella tiene que cubrir las seis formas.** No es un detalle de
> implementación: si una forma queda afuera, todos sus nodos hashean igual, no hay
> hashes únicos, el pase 1 no ancla **ninguno**, y la identidad colapsa **en
> silencio** — el peor modo de falla del tramo.
>
> ```
> text_span · verbatim  → el texto
> asset                 → la referencia al objeto
> fields                → etiqueta=valor de cada par, en orden
> grid                  → encabezados + celdas, en orden
> container             → la forma y si es ordenado
> ```
>
> Lo encontró el banco de pruebas: la huella usaba `texto ?? ref ?? filas`, y una
> fila no tiene ninguno de los tres. Las 500 filas de una planilla hashearon
> idénticas y una inserción movió 500 identificadores.

## Degradación honesta

Cuando un documento se reescribe casi entero no hay anclas, y la reconciliación
degrada a reemplazo en bloque. Eso es correcto —no hay identidad que preservar— pero
**tiene que medirse**:

```
anclaje         proporción de nodos emparejados por el pase 1
por-similitud   cuántos resolvió el pase 2
por-residuo     cuántos resolvió el pase 3   ← si crece, algo reordena mucho
altas · bajas
```

Una degradación honesta que nadie mide es indistinguible de un bug. Si `anclaje`
cae por debajo de un umbral, el evento se registra: puede ser un documento
reescrito, o puede ser que un adaptador cambió y ahora produce hashes distintos
para el mismo contenido — y esas dos causas se ven idénticas desde afuera.

## Residuos aceptados

- **Contenido duplicado.** Cincuenta párrafos idénticos en la misma sección no
  pueden anclar (sus hashes no son únicos) y se emparejan en orden dentro de su
  hueco. Insertar uno al principio corre esos emparejamientos. **La ambigüedad es
  irreducible** —es la misma con la que `git` vive desde 1986— pero queda
  **contenida en el grupo duplicado**, sin cascada al resto del documento.
- **Un nodo borrado entre dos idénticos.** Cuál de los dos se fue es
  indecidible. Se elige el orden y se documenta.

## Decisiones tomadas

- **La identidad se reconcilia, no se calcula.** Ninguna fórmula de una sola
  versión sobrevive edición e inserción a la vez.
- **La ruta es para estructura y migas; nunca para identidad.**
- **Un emisor, no cinco.** Las cinco estrategias de jerarquía pasan a calcular
  rutas; el árbol se arma una sola vez, con una semántica única.
- **Las estrategias viven acá, no en el tramo 3.** Las pistas ya son libres de
  formato, así que consumirlas es trabajo del lado limpio del borde.
- **Las migas salen de la pila del emisor**, sin estructura adicional.
- **Tres pases en el reconciliador**, y el tercero no es opcional.
- **El umbral de similitud se mide, no se elige.**
- **Nada derivable se almacena:** `depth`, `siblingIndex` y `ordinal` se caminan.
- **La delegación tardía es una re-emisión**, no un mecanismo de injerto.

## Costo y latencia

El emisor es un recorrido lineal sobre estructuras en memoria: microsegundos por
nodo. El reconciliador es lo único con costo real: el pase 1 es un hash join, y los
pases 2 y 3 trabajan sobre residuos que en un documento sano son una fracción
mínima.

**Los dos pases de similitud necesitan un tope, no solo el tercero.** El pase 2
parece acotado porque trabaja "dentro de un hueco" — pero si no hay anclas, **hay
un solo hueco y contiene el documento entero**. El banco de pruebas lo midió
renombrando una columna de una planilla de 500 filas: cero anclas, las 500 filas
resueltas por similitud en un único hueco, 4× el tiempo. A 50 000 filas eso no
termina.

El caso no es exótico: cualquier cambio que toque a todos los nodos a la vez
—renombrar una columna, cambiar un separador, normalizar mayúsculas— borra todas
las anclas de golpe.

---

# Tramo 5 — Agrupación

**Entra:** la lista plana del tramo 4, con identidad y migas.
**Sale:** **dos** cosas — fragmentos para recuperación difusa y registros para
recuperación exacta — más las anotaciones, del mismo recorrido.

> Se llamaba *Fragmentación*, y el nombre describía un trabajo que ya no hace. La
> división la hizo `descomponer` en el tramo 3, hasta la unidad natural del
> formato. **Acá solo se agrupa.**

## El recorrido entero

```
para cada nodo:
    los anotadores lo miran                 correos · documentos · tarjetas · claves
    según su cohesión:
        lead       → cierra el fragmento en curso; entra a las migas
        satellite  → se pega al fragmento vivo, nunca queda solo
        solo       → fragmento propio, sin mezclarse con vecinos
        normal     → si entra en el objetivo, se suma; si no, cierra y abre otro
    si es una fila de planilla              → emite además un registro
```

No hay ninguna rama que corte. Un nodo entra entero en algún fragmento, siempre.

## `cohesión`, reencuadrada

Antes sus cuatro valores respondían **dos** preguntas: `atomic`/`splittable`
hablaban de partir, `lead`/`satellite` de agrupar. Como acá no se parte nada, los
cuatro pasan a responder lo mismo:

| | Cómo agrupa | De dónde sale |
|---|---|---|
| `lead` | cierra el fragmento y entra a las migas | `titulo`, `subtitulo` |
| `satellite` | nunca queda solo | `epigrafe`, `nota_al_pie` |
| `solo` | no se mezcla con vecinos | `codigo`, `formula`, `imagen` |
| `normal` | se agrupa libremente | todo lo demás |

Sigue siendo una función pura de `(tipo, forma)` que vive en `ir` y que este tramo
es el único en consultar.

`solo` merece una nota: mezclar un bloque de código con el párrafo que lo precede
produce un vector turbio que no representa bien a ninguno de los dos. Que algo no
se pueda partir y que no convenga mezclarlo son cosas distintas, y antes estaban
en la misma palabra.

## Los títulos no se duplican

Un `lead` **no arranca un fragmento con su texto**: cierra el anterior y entra a
las migas. Así el título no aparece dos veces —una en el cuerpo del primer
fragmento y otra en el contexto de todos— y, sobre todo, **el fragmento nº 12 de
una sección larga no queda huérfano**: lleva `Contrato › Cláusula primera` igual
que el primero.

Eso es lo que vuelve innecesario el solapamiento entre fragmentos.

> **Salvedad:** un título que no llegó a contextualizar nada —el último de un
> documento, sin contenido debajo— **no puede evaporarse**. Emite su propio
> fragmento. Es un caso raro y la alternativa es perder información en silencio.

## Este tramo no conoce el modelo de embeddings

El tamaño objetivo de un fragmento responde a *"¿cuánto texto es útil como
resultado de búsqueda?"* — una decisión de producto. **No** al límite del modelo,
que es una restricción técnica y vive en el tramo 6.

| | Qué presupuesto | Si te equivocás |
|---|---|---|
| **5 · Agrupación** | cuánto texto es útil como resultado | los resultados salen algo largos o algo cortos |
| **6 · Embeddings** | el límite del modelo | nada: el rebanado se ajusta solo |

El día que se cambie el modelo por uno de 8 000 tokens, este tramo no se toca:
cambian los vectores, no los fragmentos, ni sus identidades, ni sus hashes.

Y por eso **un nodo más grande que el objetivo no es un problema**: se emite como
su propio fragmento y el tramo 6 lo vectoriza en N vectores. No hay `excedido`, no
hay truncado, y **nadie lo parte en fragmentos** — que es lo que este invariante
protege. El tramo 6 sí rebana su texto en pedazos de tamaño fijo, y ese corte sí es
arbitrario a propósito; los dos no son lo mismo y la diferencia está en *«partir y
rebanar no son lo mismo»*, en el tramo 6.

## Las dos salidas

```ts
type Fragmento = {
  texto:  string          // LIMPIO — las migas no van adentro
  migas:  string[]        // el tramo 6 las concatena al embeber
  nodos:  ElementId[]     // procedencia; sobrevive a que el fragmento se rearme
  hash:   ContentHash     // clave del caché de embeddings
}

type Registro = {
  coordenada: SourceRange              // hoja · fila · columna — direccionable
  valores:    Record<string,string>
  nodo:       ElementId
}
```

Una planilla produce **las dos del mismo recorrido**: ventanas de filas que se
vectorizan, y una fila por registro consultable. Es el split π/σ de la visión
aterrizado en un solo paso.

`nodos` es lo que enlaza el fragmento con la identidad reconciliada del tramo 4:
por eso una anotación sobrevive aunque el fragmento se re-arme distinto en la
próxima ingesta.

## Las filas son nodos

Cuando el tramo 3 marca `grano: 'fila'`, **cada fila es un nodo** — no una celda
dentro de un nodo-grilla. Es aplicar a las planillas el invariante del tramo 3, y
la unidad natural de una tabla de datos es la fila.

Sin eso, la promesa de *"la fila se hashea y se versiona"* que el tramo 3 ya hacía
era falsa: una planilla de 50 000 filas tenía **una** identidad.

Lo que cambia, medido sobre una lista de proveedores que se actualiza semanalmente:

| | Grilla = un nodo | Fila = un nodo |
|---|---|---|
| Se agrega un proveedor | cambia el hash de todo | **anclaje 1.00** · 502 anclas · 1 alta |
| Anotación en una fila | se despega | sobrevive |
| Re-embebido | el documento entero | una ventana |

> **El esquema vive en el container, no en la fila.** Si cada fila cargara sus
> etiquetas, renombrar una columna cambiaría el hash de las 50 000 y **destruiría
> todas las anclas**. El banco lo midió: anclaje **0.00** y 4× el tiempo, resuelto
> por similitud en un solo hueco. Con el esquema arriba, renombrar una columna
> toca **un** nodo.
>
> La contrapartida es que una fila no se renderiza sola: la composición del
> fragmento toma las etiquetas del container, que las tiene a mano en el recorrido.

**La tabla chica** (`grano: 'entero'`, donde la fila no es una unidad interesante)
sigue siendo un nodo `grid`. Así que `grid` **no desaparece** — la ganancia del
cambio fue la identidad por fila, no bajar de seis formas a cinco.

## Los anotadores viajan en este recorrido

Detectar correos, documentos, tarjetas o claves **no transforma nada**, así que no
es un tramo: es un observador que mira cada nodo al pasar y escribe en el almacén
de anotaciones. Como el recorrido ya existe, **cuestan cero pasadas extra**.

Y anotan sobre el **nodo**, no sobre el fragmento. Eso importa: el nodo es la
unidad semántica y la que tiene identidad estable, así que la anotación sobrevive
a que la agrupación cambie.

## Decisiones tomadas

- **Solo agrupa, nunca parte.** Partir exige conocer el formato y el formato vive
  en el tramo 3.
- **`cohesión` reencuadrada** a `lead · satellite · solo · normal`: los cuatro
  hablan de agrupar.
- **Los títulos entran a las migas**, no al cuerpo. Sin duplicación y sin
  solapamiento.
- **Un título que no contextualizó nada emite su propio fragmento.**
- **Este tramo no conoce el modelo de embeddings.** Agrupa por utilidad; el límite
  técnico es del 6.
- **Dos salidas del mismo recorrido**: fragmentos y registros.
- **Las filas son nodos** con `grano: 'fila'`; **el esquema vive en el container**.
- **`grid` sobrevive** para la tabla chica.
- **Los anotadores anotan sobre el nodo**, en el mismo recorrido.

## Costo y latencia

Un recorrido lineal sobre la lista, con acumulación en memoria. El único costo
real es serializar las grillas. Microsegundos por nodo.

---

# Lo que se borró

La pasada de reducción del 2026-08-06. Cada línea es una pieza que ya no existe.

| Pieza eliminada | Por qué sobraba |
|---|---|
| `Contenido` (4 clases) | Era isomorfa a 4 de las 6 formas. El adaptador emite la forma directo. |
| `POR_DEFECTO` (mapa) | Existía para mapear `Contenido` → forma. Sin `Contenido`, no hay qué mapear. |
| `decodificar`, `unidades`, `contenido` | Tres casilleros para un solo trabajo: entregar unidades normalizadas. |
| `perfilar` | La doble pasada es una clausura, no un hueco del adaptador. |
| **El viejo tramo 4 (traducción) entero** | Solo aplicaba una tabla y derivaba cohesión. La tabla se fue con `Contenido`; la cohesión es función pura. El número 4 quedó libre y hoy lo ocupa Emisión. |
| **El tramo de validación entero** | Dos trabajos, ninguno un tramo: la integridad referencial es postcondición del 4, y detectar identificadores es un anotador. |
| **El tramo de composición entero** | Camina los mismos nodos que la fragmentación, y obligaba a estimar el tamaño de lo que él iba a renderizar. Es la segunda salida del mismo recorrido. |
| **El tramo de diferencia entero** | Lo absorbe el caché de embeddings por contenido, que además saltea entre documentos distintos y no solo entre versiones. |
| `OVERLAP_CHARS` | Existía para que un corte no perdiera contexto. Las migas lo dan sin duplicar, y ya hay un invariante de no-duplicación en el índice. **Deuda saldada, con el argumento corregido:** el original hablaba de fronteras *entre* fragmentos, donde la miga compensa, y no cubría el rebanado *dentro* de un fragmento, donde no hay miga. Lo que sí lo cubre es que la unidad de recuperación es el fragmento — ver tramo 6. |
| Frontera semántica en la fragmentación | Haría que las fronteras dependan de la versión de un modelo, y con eso el caché de embeddings se invalidaría entero en cada actualización. **Deuda saldada, con una distinción nueva:** vale para las fronteras de *fragmento*; las de *vector* sí pueden depender del embedder, porque ya viven adentro de su versión. |
| **Todas las ramas de corte del tramo 5** | Partir exige conocer el formato. `descomponer` divide hasta la unidad natural y nadie más parte nada. |
| El estado `excedido` de un fragmento | Un nodo grande ya no es una degradación: el tramo 6 lo vectoriza en N vectores. Pasó de estado de falla a un número. **Deuda saldada** — el tramo 6 ya define cómo se calcula `N`. |
| **Dos vectores por fragmento + fusión** | El peso no desaparecía, se escondía en el tamaño de las secciones. Concatenar deja que el modelo pondere por consulta. |
| `α` y la fusión por rango | Sin dos vectores, no hay nada que fusionar. |
| `TABLA` de ~15 entradas | Quedó `COHESIÓN` de 4. Los overrides de forma los hace el adaptador, que ya sabe. |
| Regla **C2** (último clasificador total) | El piso físico responde siempre. Nadie tiene que acordarse de nada. |
| `tipo: 'delegado'` | La delegación se deduce: un asset que algún adaptador reclama. |
| Clasificador `miembros` | Un contenedor emite assets; la recursión ocurre sola. |
| `tipo: 'desconocido'` | Redundante con `certeza: 'inferido'`. |
| `certeza: 'mixto'` | Se calculaba y no lo leía nadie. |
| `columna` en la pista `celda` | No es jerarquía. Se fue a `ubicación`. |
| `z` en la pista `espacial` | No es jerarquía. Se fue a `ubicación`, y con él la ambigüedad de empate. |
| Segundo adaptador de PDF | Un solo adaptador; la página escaneada delega. |
| `hijos` en `container` | Rompía la lista plana. La jerarquía es `parentId`. |
| **Prefiltro por tamaño de imagen** | Era un proxy de "es decorativo" y descartaba certificados chicos. El costo se acota con contenido direccionable y prioridad. |
| **`hash(migas ‖ contenido ‖ ordinal)`** | Ninguna fórmula de una sola versión sobrevive edición e inserción a la vez. La identidad se reconcilia. |
| Cinco constructores de árbol | Cinco funciones de ruta + **un** emisor, con una sola semántica de anidamiento. |
| `depth`, `siblingIndex`, `ordinal` | Derivables de `parentId`. Se caminan. |
| `JERARQUÍA` en el tramo 3 | Se muda al 4: las pistas ya son libres de formato. |
| Mecanismo de injerto para delegaciones tardías | Es una re-emisión; el reconciliador ya sabe hacerlo. |
| Regla *"las regiones de una imagen son terminales"* | El punto fijo la subsume, y sin decidir nada sobre imágenes. |
| Límite de profundidad semántico | Queda solo el presupuesto, que es de recursos y difiere en vez de descartar. |
| `dimensiones` en la Sonda | Existía únicamente para alimentar el prefiltro. |

**Balance:** **tramos 11 → 7** · casilleros de formato 5 → 2 · tipos 17 → 15 ·
constructores de árbol 5 → 1 · tablas en el núcleo 2 → 1 · reglas de cascada 2 → 1
· adaptadores 13 → 12 · pases del reconciliador 3 (se intentó 2 y no alcanzaba).

Y ninguna capacidad se perdió — en dos casos se ganó: el caché de embeddings por
contenido saltea **entre documentos**, cosa que el diff por documento no podía; y
sacar el prefiltro de imágenes recuperó los certificados chicos que descartaba.

La única pieza que resistió la reducción es el tercer pase del reconciliador, y
resistió porque la simulación lo demostró necesario, no porque pareciera prudente.

---

# Qué verificó la simulación

Antes de escribir esta revisión se implementó el pipeline y se corrieron
documentos representativos. No fue una prueba de concepto: **encontró siete
defectos que estaban en el diseño escrito, y en una segunda ronda invalidó uno de
sus propios arreglos.**

## Primera ronda — la forma del pipeline

| Caso | Nodos | Modelo | Qué prueba |
|---|---|---|---|
| `chat` | 1 | 0 | El canal más distinto entra por la misma puerta |
| `md` | 3 | 0 | Código llega a `verbatim`/`atomic` |
| `docx` con foto de un PPT | 6 | 1 | La foto se descompone en título + párrafo |
| `xlsx` | 2 | 0 | Región `grid` y región `fields` conviven |
| PDF mixto (2 texto + 1 escaneada) | 8 | **1** | Paga por 1 página, no por 3 |

1. **El clasificador total tipaba una imagen como `parrafo`.** Al no tener texto
   que mirar, la regla C2 lo forzaba a inventar. → piso físico, C2 eliminada.
2. **`container` llevaba `hijos` en el payload**, contradiciendo la lista plana.
   → se quitó, con invariante verificado en compilación.
3. **`tipo:'tabla'` con forma `fields`** — lo atrapó la pareja obligatoria, que es
   exactamente para lo que existe.

## Segunda ronda — el costo, y por qué el primer arreglo estaba mal

La primera ronda había resuelto el costo del modelo con un **prefiltro por
tamaño**. La segunda lo puso a prueba con un caso que el filtro no sobrevive:

| Caso | Modelo | Caché | Qué prueba |
|---|---|---|---|
| Documento con **certificado de 32 px** | 2 | 0 | Extrae `CERTIFICADO ISO 9001` — el filtro lo habría tirado |
| Informe con el **mismo logo en 200 encabezados** | **1** | **199** | El costo lo acota el contenido, no un umbral |
| Contrato escaneado (PDF → página → firma) | 2 | 0 | Recursión profunda que **termina sola** por punto fijo |
| `.zip` que se contiene a sí mismo | 1 | 0 | El punto fijo también corta ciclos triviales |
| Lote hostil con presupuesto de 1 | 1 | 0 | Marca `parcial` y **encola 2 pendientes**, no los pierde |

4. **El prefiltro por tamaño descartaba información valiosa.** Un certificado de
   calidad de 32 px es chico *y* es justo lo que un cliente quiere consultar. El
   tamaño es un proxy de "es decorativo", y los proxies fallan en el caso que
   importa. → **prefiltro eliminado**; el costo se acota con contenido
   direccionable y prioridad.
5. **La terminación dependía de una regla arbitraria.** *"Las regiones de una
   imagen son terminales"* no dice por qué, y se rompe con el primer caso raro. →
   **punto fijo**: para cuando devuelve lo mismo que recibió.
6. **El presupuesto cobraba los aciertos de caché.** Las 200 apariciones del logo
   agotaban el presupuesto del documento con operaciones que costaban cero. →
   cuenta trabajo, no intentos.
7. **Agotar el presupuesto perdía información en silencio.** Los assets sin
   descomponer simplemente no se descomponían, y nadie se enteraba. → quedan
   encolados y el documento se marca `parcial`.

**La lección de método:** los defectos 4 y 5 no eran bugs de implementación — eran
**parches** que la primera ronda había escrito como si fueran diseño. Un umbral y
una regla ad-hoc, las dos cosas que este documento dice no querer. Hizo falta un
caso adversarial (*el certificado chico*) para que la diferencia se viera.

## Tercera ronda — la identidad

Siete casos adversariales sobre un contrato de ocho nodos. La métrica es una sola:
**cuántos identificadores se movieron sin que su contenido lo justificara.**

| Caso | Ids movidos | Cómo se resolvió |
|---|---|---|
| Insertar un párrafo al inicio de una sección | **0** | 8 anclas por hash |
| **Editar el título de una sección** | **0** | los descendientes anclan por su propio hash |
| Mover un párrafo entre secciones, sin editar | **0** | el hash no mira posición |
| **Editar *y* mover el mismo nodo** | **0** | pase 3, residuo global |
| 50 párrafos idénticos + inserción al inicio | sin cascada | ambigüedad irreducible, contenida |
| **Delegación tardía injerta un subárbol** | **0** | re-emisión: lo viejo ancla, lo nuevo son altas |
| Reescritura del 60% | anclaje 0.38 | degrada, **y se mide** |

8. **El tercer pase del reconciliador se había borrado de más.** El argumento era
   que el pase de anclas ya empareja lo movido — cierto solo para lo movido *sin
   editar*. Un nodo movido **y** editado cae en huecos distintos en cada versión, y
   el pase 2 confina la similitud a un hueco: nunca se comparan. → pase 3
   restaurado.

**La lección de método, otra vez:** la reducción tiene un piso, y no se descubre
razonando sobre el diseño. La única forma de saber que una pieza sobra es sacarla y
ver qué se rompe.

## Cuarta ronda — el banco de pruebas ejecutable

Las tres primeras rondas fueron scripts de una corrida. La cuarta es un **banco
ejecutable**: 18 casos, los 7 tramos, 9 invariantes, y detección automática de
hallazgos. Encontró tres cosas, y dos estaban **escritas en este documento**.

9. **El subárbol delegado usaba la escala de niveles del padre.** Este documento
   afirmaba que la delegación resolvía la colisión de niveles porque *"el subárbol
   se cuelga entero del punto de delegación"* — pero eso estaba **afirmado sin
   mecanismo**, y el emisor no tenía forma de expresarlo. Dos casos crashearon. →
   la delegación **abre un scope propio** en el emisor.
10. **La huella no cubría las seis formas.** Usaba `texto ?? ref ?? filas`, y una
    fila no tiene ninguno de los tres: **las 500 filas de una planilla hashearon
    idénticas** y una inserción movió 500 identificadores. La identidad puede
    colapsar en silencio si una forma queda afuera.
11. **El pase 2 también es cuadrático.** El documento decía que el pase 3 era *"el
    único lugar que necesita un tope"*. Renombrar una columna deja **cero anclas**,
    y entonces el pase 2 hace todo el trabajo en **un solo hueco** que contiene el
    documento entero.

**Y midió la decisión que estaba en duda.** Con las filas como nodos:

| | Anclaje | Por hash | Por similitud | Tiempo |
|---|---|---|---|---|
| Insertar una fila | **1.00** | 502 | 0 | 3.8 ms |
| Renombrar una columna, esquema **en la fila** | **0.00** | 2 | 500 | 15.3 ms |

Eso convirtió *"el esquema debería vivir en el container"* de preferencia estética
a **requisito medido**.

**Lo que el banco NO confirmó:** que `grid` sobrara. La tabla chica lo sigue
necesitando, así que seguimos en seis formas — la ganancia del cambio fue la
identidad por fila, no el conteo.

## Invariantes que corren en cada caso

Formas dentro del conjunto cerrado · tipos dentro del conjunto cerrado · cohesión
válida · certeza válida · **pareja `tipo⇒forma`** · cero fugas de formato en el
nodo · **una unidad → un nodo** · ningún payload anida nodos · código siempre
atómico · **la recursión termina** · **ninguna información se descarta en
silencio**.

---

# Puntos abiertos

Trece. Ninguno bloquea empezar a construir: cuatro son mediciones sobre corpus real,
tres son huecos de diseño declarados, dos son producto, uno es mecánico, dos están
fuera de alcance y uno es un refinamiento opcional.

**Salió de esta lista, implementada, la regla «¿LOS BYTES YA EXISTEN?»**: todo asset
cuyos bytes ya existan se materializa, y la ventana por referencia queda para los que
todavía no existen —el rectángulo de un PDF—. El razonamiento entero está en el docstring
de cabecera de `packages/adapters/src/docx.ts`, y lo acreditan I21/I22 de `adapters`
—que verificaban lo contrario— más las filas S103, S105 y SC23 de ese paquete y S107 de
la orquestación, las cuatro reancladas.

**Y EL NÚMERO NO SE VUELVE A USAR.** Esa regla se anotó como «P14», que ya había nombrado
otro punto —«la entrada del registro es `unknown`»—, cerrado y sacado de la tabla antes.
O sea que hay cinco docstrings de `packages/ir` y `packages/adapters` que dicen «cierra
P14» hablando del primero, y hablaban de un punto que esta tabla ya no tiene. Un número
reciclado no se nota al escribirlo y vuelve ambiguo, hacia atrás, todo lo que lo citaba.
La regla es la misma que el corredor de mutación de `ir` impone sobre sus ids desde la
deuda del paso 7: **un id nombra UN punto**. Los cerrados se sacan de la tabla y su
número queda quemado; lo nuevo toma el siguiente libre, que hoy es P15.

| # | Punto | Dónde impacta |
|---|---|---|
| **P6** | **Si la miga concatenada mejora la recuperación.** Es una hipótesis sin medir: ~5 tokens sobre ~300 es el 2 % del texto. Toda la contradicción de la clave del caché existe por ella. Si midiéramos que no aporta, el reuso entre documentos vuelve completo y el titular «300 contratos → 1 vector» sería cierto otra vez. Se compara recuperación con y sin miga sobre documentos reales. | Tramo 6 |
| **P7** | **El tamaño de vector** (`L`). No se fija por decreto: sale del límite del embedder que se elija. Es un dato, no una decisión — pero hasta que el embedder esté elegido, `N` no es computable para ningún ejemplo. | Tramo 6 |
| **P8** | **El embebido no tiene presupuesto.** El tramo 3 tiene uno y embeber cuesta plata; el documento no dice nada de topes, degradación ni cola cuando el gasto se agota. **Hueco nuevo, declarado como tal** en vez de inventado al escribir el tramo 6. | Tramo 6 |
| **P9** | **Qué pasa con la versión vieja cuando el anclaje es bajo.** Hoy quedan las dos indexadas y la búsqueda devuelve duplicados. ¿Se archiva, se avisa, se deja? Es producto, no pipeline. | Tramo 1 |
| **P10** | **Un documento reescrito bajo el mismo id de conector.** El id estable gana sobre el contenido, así que se toma como versión nueva aunque el anclaje sea 0 — correcto para lo que cuelga del documento (permisos, etiquetas), discutible para la curación a nivel de nodo, que ahí no tiene a qué engancharse. | Tramo 1 |
| **P11** | **El umbral de anclaje que separa «versión nueva» de «documento distinto».** Se barre sobre el corpus, igual que `umbralDeSimilitud`. | Tramo 4 |
| **P12** | **Un `ElementId` global no lleva su organización adentro.** La separación entre tenants queda entera en el filtro de lectura, o sea en una garantía de runtime que hay que acordarse de aplicar en cada consulta — la forma de garantía que este documento desconfía en todos los demás lugares. Es de la capa de control de acceso, no del pipeline, pero elegir unicidad global es lo que lo vuelve necesario. | Fuera del tramo |
| **P1** | El código de ejemplo está en español. Debe pasar a inglés. **`packages/ir` cerró la traducción el 2026-08-13 (bloques 1–4): los diez archivos de `src/`, los vocabularios cerrados y los nombres de archivo y de guardián están en inglés, con `packages/ir/GLOSARIO.md` como autoridad. El bloque 5 cerró `packages/emision → packages/emission` el 2026-08-13: el paquete está entero en inglés, con su propia suite de mutación. Quedan los doce adaptadores, que todavía no existen. El PLAN sigue en español a propósito — es documento de producto (GLOSARIO, sección 1), así que los bloques de código de ejemplo de este documento NO se traducen.** | Todo el documento |
| **P2** | `invocacionesMáximas` por documento: cuántas descomposiciones perceptuales antes de diferir el resto. Se mide sobre documentos corporativos reales — cuánto tarda en converger la cola de pendientes — no se elige. | Tramo 3 |
| **P3** | El almacenamiento de los `en_espera` no tiene política de cuota ni visibilidad. | Tramo 1 |
| **P4** | Slack y Teams no están cubiertos, y necesitan un filtro de relevancia previo que vive en Capa 2/4. | Fuera del tramo |
| **P13** | **Un asset delegado re-entra por el TRAMO 2, no por la puerta — y por eso saltea el gate.** «Un asset delega si algún adaptador reclama sus bytes» está implementado como `sourceOfAsset` → `sondaFría` → `seleccionar()`, o sea que la pieza incrustada entra donde se decide *quién sabe leerla*. Pero la puerta —tamaño, formato legible, no cifrado y **antivirus obligatorio**— es el tramo 1. Mientras ningún formato traía bytes propios eso era inocuo: el `.md` referencia sus imágenes por URL y nunca las baja, así que la profundidad de delegación era cero y no había nada que entrara por el costado. **Deja de serlo cuando el pipeline empieza a materializar**: un `.docx` limpio en la puerta puede llevar adentro un payload que el escaneo del contenedor no miró, y lo mismo vale para lo que se baje de una URL. LA SALIDA NO ES ESCANEAR EN DOS LUGARES NUEVOS, es mover un borde: **que el asset delegado re-entre por la puerta, como cualquier archivo**. Con eso hereda el gate, el antivirus y —al tener fila propia— el ESTADO, que es justo lo que le falta al caso «el antivirus marca después de que el objeto ya está guardado», para el que la máquina de estados no tiene transición. Queda por decidir si esa fila es un documento propio o un artefacto que referencia al padre, y que la carrera «escaneo en paralelo al guardado» sea la misma decisión que para el archivo de entrada y no dos. | Tramo 1 · Tramo 3 |
| **P5** | `tipo` podría existir **solo** donde contradice al piso físico, derivando la etiqueta de display desde `forma`. Volvería inexpresable la contradicción `tipo:'parrafo'` + `forma:'grid'`. Se resiste porque perdería tipos que no overridean nada (`cita`, `lista`) y que sí sirven para filtrar. | Tramo 3 |

**Resueltos al decidir la identidad (H13):** cómo se acuña un id nuevo (al azar; el
property test de determinismo es sobre la salida del adaptador, que no tiene ids) ·
el dominio de unicidad (global, y el documento lo lleva el contenedor) · la
idempotencia del emisor (la da el reconciliador, no el acuñado) · y el requisito de
atomicidad índice + nodos que eso destapa.

**Resueltos al diseñar la memoria del reconciliador:** de dónde sale la versión
anterior (índice de reconciliación, del lado de las anotaciones en R3, no de la IR) ·
el orden que el pase 2 necesita (va en el índice, no en el nodo) · cuándo dos
archivos son el mismo documento (**por contenido, nunca por nombre**; el candidato
sale del índice leído al revés y solo votan los hashes que aparecen en un único
documento) · si el índice acumula o reemplaza (acumula: direccionado por contenido,
sale casi gratis).

**Resueltos al diseñar el tramo 6:** la clave del caché de embeddings (se deriva, no
se elige) · una sola huella de fragmento, la contextual · el titular «300 contratos →
1 vector» (corregido a «bajo la misma sección») · la miga antes o después de rebanar
(en todos los vectores) · solapamiento (no) · la unidad del límite (tokens) · el
sustantivo «ventana» del tramo 6 (borrado) · rebanar no es partir.

**Resueltos en revisiones anteriores:** qué se acepta (por contenido, no por formato) ·
`tipo` abierto o cerrado (cerrado, 15) · dos adaptadores de PDF (uno, con
delegación) · la pista `celda` sin región (la lleva) · desempate de `z` (`z` no
está en la pista) · `contenido` como casillero (colapsado en `descomponer`) ·
reconciliación de niveles entre clasificadores (**el subárbol delegado abre su
propio scope en el emisor** — estaba afirmado sin mecanismo, y el banco lo destapó
con un crash) · **umbral del prefiltro de imágenes** (no hay prefiltro) ·
**`parcial` vs esperar delegaciones** (se indexa de inmediato; la re-emisión no
mueve ids).

---

# Plan de implementación

## Paquetes y regla de dependencia

```
packages/
  ir/            las seis formas · Tipo · Pista · Marca · cohesiónDe()
                 CERO dependencias. Es el contrato.
  adaptadores/   sonda · registro · los 12          → depende de: ir
  emision/       ruta · emisor · reconciliador       → depende de: ir
  ingesta/       orquestación de los tramos          → depende de: todos
```

```
             ir
            ╱  ╲
  adaptadores    emision       ← estas dos NUNCA se ven entre sí
            ╲  ╱
           ingesta
```

**`adaptadores` y `emision` no se conocen, y esa es la regla R1 hecha grafo.** Lo
único que las une es `ir`: los adaptadores producen nodos y pistas, la emisión los
consume sin saber de dónde vinieron. Si alguna vez `emision` necesitara importar un
adaptador, el borde de formato se habría roto y el build lo diría.

`ir` se congela y se versiona primero: todo depende de él, él no depende de nada. Y
la traducción que antes era un paquete propio vive ahí como función pura
(`cohesiónDe`), porque al desaparecer el viejo tramo 4 no le quedó lógica.

## Orden de construcción — por riesgo, no por demanda

Cada paso valida una **afirmación estructural distinta**. Si alguna es falsa, se
descubre barato y temprano.

| # | Qué | Qué afirmación prueba |
|---|---|---|
| 1 | `packages/ir` | — el contrato, sin lógica |
| 2 | **Emisor** (ruta + pila), con nodos sintéticos | El árbol es la pila y las migas salen gratis — **sin que exista un solo adaptador** |
| 3 | Adaptador `.md` + orquestación mínima | La espina dorsal entera funciona |
| 4 | Piso de texto `.txt` | La degradación es real y visible |
| 5 | Adaptador `chat` | **La cintura no tiene forma de documento** |
| 6 | Adaptador `imagen` + delegación | **Una imagen es un documento como cualquier otro** |
| 7 | Adaptador `.docx` con imagen incrustada | La cascada y la delegación se componen |
| 8 | Adaptador `.xlsx` | Regiones, grano e identidad por fila |
| 9 | `.html`, `.csv`, `.pdf` | Ya es rellenar una tabla |
| 10 | Contenedores, presupuestos | Recursión con límites |
| 11 | **Reconciliador**, los tres pases | **Ninguna anotación se despega** — el invariante más caro de recuperar si se rompe tarde |

Que el **emisor se construya en el paso 2, antes que cualquier adaptador**, es la
prueba más dura de que el borde R1 es real: se alimenta con nodos sintéticos y
pistas escritas a mano. Si hiciera falta un adaptador para escribirlo, el diseño
estaría mal.

El paso 5 antes que el 7 es deliberado: el chat es el canal que más tensiona la
abstracción. Descubrirlo roto en el paso 5 cuesta un día; en el 10, la arquitectura.

El paso 6 **antes** que el 7 es la lección de la simulación: la delegación es el
mecanismo del que dependen PDF mixto, imágenes incrustadas, contenedores y
escaneados. Si está mal, cuatro casos se rompen a la vez.

El **reconciliador va último** porque es el único que necesita dos versiones del
mismo documento — hasta que el resto funcione, no hay segunda versión que
reconciliar.

## Estrategia de prueba

| Qué | Cómo | Por qué así |
|---|---|---|
| `cohesiónDe()` | **Exhaustiva** — 15 tipos × 6 formas = 90 casos | El dominio es finito **porque `tipo` es cerrado** |
| Pareja `tipo⇒forma` | Aserción en el registro | Un adaptador que la viola no entra |
| Adaptadores | Golden files: bytes → árbol, snapshot | Corpus real versionado en el repo |
| Determinismo | Property test, dos corridas, byte-idéntico | Precondición del caché |
| Delegación | Casos con profundidad 0, 1 y ciclo | Es el mecanismo de mayor alcance |
| **Terminación** | Punto fijo, ciclo A→B→A, y un adversario que devuelve recortes casi idénticos | Sin esto la recursión es una promesa |
| **Costo** | Documento con el mismo asset N veces: **exactamente 1 invocación** | Es un costo, y los costos se prueban |
| **No-pérdida** | Presupuesto de 1 sobre 3 assets: los 2 restantes **encolados**, no ausentes | Descartar en silencio es el peor modo de falla |
| **Identidad** | Los 7 casos adversariales del tramo 4, midiendo ids movidos | Una anotación despegada no falla: empeora en silencio |
| Umbral de similitud | Barrido sobre el corpus, se reporta la curva | No se elige un número, se mide |
| Composición de casilleros | **Ningún test** | No compila si está mal |
| Reglas R1 y no-anidamiento | Build | No compila si se violan |
| Regla R2 | Lint sobre el núcleo | Detectable estáticamente |

Lo que no necesita test porque no compila importa tanto como lo que sí: cada
invariante que se mueve del runtime al compilador es un test menos que mantener y
un bug menos que puede llegar a producción.

La enumeración exhaustiva de `cohesiónDe()` **depende de que `tipo` sea cerrado**:
con vocabulario abierto el producto cartesiano no existe y no se puede recorrer el
dominio de un conjunto infinito.

## Observabilidad

```
latencia        p50/p99 por tramo × adaptador
degradación     % de documentos que caen al piso de texto
caché           tasa de acierto por versión de clasificador
delegación      profundidad media · % que llega a punto fijo · pendientes en cola
costo           invocaciones por documento · tasa de reuso por contenido
atribución      qué eslabón de la cascada resolvió cada nodo   ← la importante
```

**La distribución de atribución es el indicador de salud de toda la capa de
reconocimiento.** Si en DOCX el 60% de los nodos los resuelve `porProminencia` en
vez de `porStyleId`, no hay un bug: hay un mapa de estilos incompleto. Ninguna
otra métrica lo muestra, y sin ella la degradación es invisible porque el sistema
*sigue funcionando*, solo que peor.

**La tasa de reuso por contenido** es la que gobierna el costo perceptual. Si cae,
o los documentos que entran cambiaron de naturaleza, o el caché se está
invalidando de más — y en los dos casos la factura del modelo sube sin que ninguna
otra métrica lo muestre.

**Los pendientes en cola** son el otro indicador crítico: si crecen sin drenar, el
presupuesto está mal calibrado (P2) y hay documentos que quedan `parcial` para
siempre. Diferir es aceptable; diferir indefinidamente es perder información con
otro nombre.

## Despliegue

- **Adaptadores detrás de bandera**, uno por uno.
- **Modo sombra** para los nuevos: corren, se compara su árbol contra el anterior,
  no se sirve nada hasta que la comparación sea buena.
- **Invalidación perezosa** al subir la versión del clasificador.
- **Idempotencia** por clave de caché más identificador de documento.

## Lo que deliberadamente no se construye todavía

Los conectores, el espejo bidireccional y los flujos de eventos. Los tres entran
por la misma puerta cuando llegue el momento, y ninguno cambia nada de lo
anterior — que es precisamente por qué se pueden dejar para después.

---

# Tramo 6 · Embeddings

Recibe los `Fragmento` del tramo 5 y entrega `Vector`. Es el primer tramo que conoce
el modelo de embeddings, y el único que lo conoce.

## Las cinco reglas

1. **La miga se concatena** al texto, no se fusiona con pesos: el modelo pondera el
   contexto **por consulta**, cosa que ningún peso fijo puede. Va en **todos** los
   vectores del fragmento, no solo en el primero.
2. **La miga va además al payload**, para filtrar por sección de forma exacta. Pesar
   el contexto es semántico y lo resuelve el modelo; restringir a una sección es un
   filtro y lo resuelve el payload.
3. Si el texto excede el límite del modelo, el fragmento **no se parte**: da **N
   vectores** que apuntan al mismo fragmento. El caso normal es `N = 1`, sin rama.
4. **Caché por contenido**, con la clave derivada (abajo). Absorbió al viejo tramo de
   Diferencia.
5. Las fronteras de **fragmento** no dependen de ningún modelo. Las de **vector** sí
   pueden — no es la misma regla, y confundirlas costaba caro.

## Cómo se rebana

```
L = tokens máximos del embedder      dato del modelo, no decisión
m = tokens de la miga
B = L − m                            presupuesto de texto por vector
T = tokens del texto limpio
N = ceil(T / B)

vector i  =  embeber( miga ‖ texto[(i−1)·B : i·B] )
clave  i  =  sha256( miga ‖ texto[(i−1)·B : i·B] ‖ versiónEmbedder )
```

Rebanadas consecutivas de exactamente `B` tokens, la última con el resto, **sin
solapamiento**. Determinístico dado `(texto, miga, embedder)` — es aritmética sobre
conteos de tokens, y tiene que serlo porque la clave del caché depende del contenido
de cada rebanada.

**No existe el sustantivo «ventana» acá.** El tramo 4 ya lo usa para la región de un
objeto (`RefObjeto`) y el tramo 5 para el ventaneo de filas de una grilla; un tercer
sentido era colisión pura. Un fragmento da N vectores, y el vector ya es el
sustantivo.

**La miga nunca se come más de la mitad de `L`.** Si una miga larguísima no entra en
la otra mitad, se trunca cayendo los niveles **del medio**: la raíz distingue el
documento, la hoja da el contexto local, y el medio es lo menos informativo. Lo que
se decide es «el contenido gana sobre el contexto»; el número sale de ahí.

**Repetir la miga en cada vector cuesta ~1 %** —unos 5 tokens sobre ~500—. Ponerla
solo en el primero dejaría a los vectores 2..N descontextualizados, que es
exactamente lo que este tramo existe para no tener.

**Por qué sin solapamiento.** El argumento que justificó borrar `OVERLAP_CHARS` no
cubría este caso: hablaba de fronteras **entre** fragmentos, donde la miga compensa,
y adentro de un fragmento no hay miga que compense. El que sí cubre: **la unidad de
recuperación es el fragmento, no el vector**. Los N dedupican a un resultado en el
tramo 7, así que una frase partida al medio sigue trayendo el fragmento por el vector
vecino.

**La última rebanada puede quedar diminuta** —la miga más tres tokens— y se acepta:
si matchea, devuelve el fragmento **correcto**, por el mismo dedupe. Balancear las
rebanadas lo evitaría, pero cambia el tamaño de todas ante cualquier edición, y con
eso se pierde el reuso del caché, que es lo que este tramo vino a comprar.

## Partir y rebanar no son lo mismo

El invariante del tramo 3 dice que **ningún tramo posterior parte nada**, porque
«partir exige conocer el formato». Rebanar un texto parece exactamente eso. La
distinción que faltaba:

| | Qué es | Dónde puede pasar |
|---|---|---|
| **Partir** | producir unidades que el sistema después trata por separado: identidad, cita, recuperación | solo el tramo 3 |
| **Rebanar** | cortar una secuencia de tokens en pedazos de tamaño fijo que nadie mira por separado y que dedupican a la misma unidad | aritmética, sin formato |

Por eso **el corte cae donde cae**, a mitad de palabra si toca. Cortar *bien*
—respetando oraciones, sin romper un bloque de código— exigiría saber el idioma o si
es código, y **eso sí sería contrabando de formato**. La arbitrariedad del corte es
lo que lo vuelve legal.

La prueba para distinguirlos, aplicable a cualquier tramo futuro: **¿algo aguas abajo
distingue los pedazos?** Si sí, es partir.

## La clave del caché no se elige, se deriva

Estaba escrita como `hash(fragmento ‖ versiónEmbedder)` sin decir qué es «fragmento»,
y en otro lado el hash del fragmento se definía sobre el texto **limpio**. Las dos
lecturas rompían algo grande, y era la contradicción más consecuente del documento.

> **La clave de un caché tiene que ser exactamente la entrada de la función que se
> cachea.** Cualquier otra cosa no es un caché: es servir un resultado calculado con
> otra entrada.

La función es «embeber este texto con este modelo». La entrada lleva la miga, porque
decidimos concatenarla. Entonces la clave la lleva. No había nada que elegir.

Con la clave sobre texto limpio, 300 contratos con la misma cláusula compartían
entrada y **299 recibían un vector que codifica la sección de otro documento** — sin
error, sin log, para siempre.

Y es **por rebanada, no por fragmento**: con `N > 1` la huella del fragmento cubre el
texto entero y cada rebanada tiene su propia clave. Eso es lo que hace que el reuso
funcione al nivel donde ocurre.

## Lo que esto corrige de lo que estaba escrito

| Decía | Queda |
|---|---|
| «una cláusula estándar en 300 contratos → **1 vector**» | «…**bajo la misma sección** → 1 vector». Sigue siendo grande: las plantillas de contrato usan títulos estandarizados |
| Dos huellas de fragmento (`huellaTexto` y `huellaContextual`) | **Una**: la contextual. La otra existía para «identidad y diferencia»; la diferencia ya no existe, y la identidad tiene que llevar la miga, o dos fragmentos del mismo documento con el mismo texto en secciones distintas colisionan |
| Editar un título acertaba el caché de los descendientes | **Falla y los re-embebe.** Es lo correcto: sus vectores efectivamente cambiaron. Antes servía vectores calculados con la miga vieja |

## Frontera de fragmento y frontera de vector

Parecen la misma regla y no lo son:

- **Frontera de fragmento** — estructural, jamás dependiente de un modelo. Determina
  identidad y la comparte todo el sistema. Si dependiera de un modelo, actualizarlo
  invalidaría el caché entero de golpe.
- **Frontera de vector** — puede depender del embedder, porque **ya vive adentro de
  su versión**: la clave lleva `versiónEmbedder`, así que cambiar el modelo ya
  invalida esos vectores igual.

Distinguirlas es lo que permite medir en **tokens**, con el tokenizador del modelo,
en vez de estimar por caracteres — que yerra por factor 2-4 según el idioma.

## La debilidad conocida, y su gatillo

Una edición **en el medio** de un fragmento grande corre todas las fronteras
siguientes, así que esas rebanadas fallan el caché aunque su texto no cambió. Solo
las ediciones al final conservan el reuso.

La solución conocida es **rebanado por contenido** (rolling hash, tipo FastCDC):
corta donde un hash móvil da un patrón, así que una inserción solo afecta a la
rebanada que la contiene y las fronteras se re-sincronizan solas. Es igual de
agnóstico al formato: aritmética sobre tokens, no idioma.

No se adopta ahora por dos razones — solo se ejerce en fragmentos que exceden `L`
(minoría: con un embedder de 8 000 tokens son unas 6 000 palabras), y trae dos
números nuevos que justificar. **Gatillo, escrito de antemano:** si al medir los
fragmentos rebanados no resultan minoría, o si el costo de re-embebido tras editar
documentos grandes pesa.

## Por qué la miga se concatena en vez de fusionarse

Se evaluó tener **dos vectores** —uno de contenido, uno de contexto— y combinarlos
al buscar. Se descartó, y el motivo vale escribirlo porque no es obvio.

Con un peso fijo, sea `α` o el rango de una fusión tipo RRF, **la importancia del
contexto queda decidida en el índice, igual para todas las consultas**.
Concatenando, la decide la atención del modelo **en el momento del match**: si la
consulta menciona la sección, los tokens de la miga pesan; si no, quedan casi
inertes. Eso es exactamente lo que se buscaba, y ningún esquema de fusión lo logra.

La fusión además tenía un defecto oculto: como el vector de contexto se comparte
entre los fragmentos de una sección, **una sección que matchea una vez cobra N
veces**, y cualquier fragmento suyo le gana a un mejor match de afuera. El peso no
desaparecía — se escondía en el tamaño de las secciones, donde no se puede medir.

La preocupación original que motivó los dos vectores —que 20 fragmentos con el
mismo prefijo se parezcan de más— resultó chica: una miga de ~5 tokens sobre un
fragmento de ~300 es el 2 % del texto. Queda como **verificación a medir**, no
como diseño: comparar recuperación con y sin la miga sobre documentos reales.

Y la división limpia que faltaba: **"pesar" el contexto es semántico y lo resuelve
el modelo; "restringir" a una sección es un filtro y lo resuelve el payload.**
Estábamos haciendo lo segundo con la maquinaria del primero.

## Por qué la diferencia desapareció en vez de encogerse

El encargo del viejo tramo 8 era: dentro del historial de un documento, saltear el
re-embebido de los fragmentos cuyo hash no cambió.

El tramo 1 **ya estableció caché direccionado por contenido** para el
reconocimiento. Aplicar el mismo patrón a los embeddings hace ese trabajo sin
ninguna pieza nueva — y hace más:

| | Diff por documento | Caché por contenido |
|---|---|---|
| Saltea entre versiones del mismo documento | ✅ | ✅ |
| Saltea entre **documentos distintos** | ❌ | ✅ **si coincide la sección** |
| Una cláusula estándar en 300 contratos, **misma sección** | 300 vectores | **1** |
| Una cláusula estándar en 300 contratos, **secciones distintas** | 300 vectores | 300 — y así debe ser |

**La versión anterior de esta tabla decía «1» en la última fila y era falsa.** Si 300
fragmentos comparten un vector, ese vector no puede distinguirlos: el reuso y la
desambiguación son el mismo eje apuntando al revés. Como la miga entra en lo que se
embebe, entra en la clave — ver *«la clave del caché no se elige, se deriva»* arriba.

El borrado del tramo de Diferencia **se sostiene igual**, con el argumento corregido:
el trabajo del viejo tramo 8 era saltear el re-embebido dentro del historial de un
documento, y eso se conserva **entero** (mismo documento + fragmento intacto +
títulos intactos → misma clave → acierto). Encima suma el reuso entre documentos
donde el contexto coincide, que en plantillas de contrato es la mayoría. **Hace todo
lo que hacía el diff, más algo, con una pieza menos.**

También es lo que vuelve innegociable la decisión de que las **fronteras de
fragmento** sean estructurales: si dependieran de un modelo, actualizarlo cambiaría
todos los hashes de fragmento y **el caché quedaría inservible de golpe.** Las
fronteras de **vector** son otra cosa y sí pueden depender del embedder — ya viven
adentro de su versión.

---

# Tramo 7 · Persistencia — sin diseñar

| Tramo | Encargo |
|---|---|
| **7 · Persistencia** | Transacción Postgres + upsert Qdrant + evento de salida. Dedupe por `fragmentoId` al buscar, porque dos vectores del mismo fragmento pueden matchear |

El dedupe no es un detalle de búsqueda: es lo que sostiene tres decisiones del tramo
6 —sin solapamiento, rebanada final diminuta, corte arbitrario—. Si el tramo 7 no
dedupica, las tres se caen.
