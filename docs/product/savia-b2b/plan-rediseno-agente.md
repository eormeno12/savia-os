# El rediseño del agente de carpeta — plan de implementación

Estado del árbol al escribir esto: rama `b2b/canal-folder`, 31 archivos sin commitear sobre
`f565c97`, `pnpm lint` verde (16 guardianes + 18 hallazgos + 45 máquina + 12 panel + 7
persistencia + 6 contra_el_simulador, más ejercicio, banco, tokens, icono, contraste).

El diseño está en Claude Design, proyecto `4c45b5b8-5219-48a7-b046-d55ee98831fc`, archivo
`Onboarding - Agente de carpeta.dc.html`. Seis pantallas de onboarding (`q1`–`q6`) más la
lista de carpetas (`folders`) con su vista de detalle.

Este plan tiene cuatro partes: **las decisiones que el diseño abre y hay que cerrar antes de
codear** (§1), **el corte de la arquitectura** (§2), **las prácticas de Tauri que lo
justifican, citadas** (§3), y **las fases con su agente y su modelo** (§4).

---

## 0 · Antes de tocar nada: commitear

31 archivos sin commitear y `lint` verde es el mejor punto de partida posible para un
refactor mecánico, y el peor para perderlo. El refactor de §2 mueve casi todos los archivos
del núcleo: si el `git diff` de esa fase arranca sobre trabajo sin commitear, deja de ser
legible y deja de ser reversible.

**Primero el commit, después el refactor.** Es la fase 0 y no la hace un agente.

---

## 1 · Lo que el diseño pide y hoy no existe

El diseño no es un repintado. Cambia el modelo de estados, cambia el fondo del panel, agrega
una ventana y pide dos cosas que **no se pueden construir contra el servidor de hoy**. Estas
seis decisiones se cierran antes de la primera línea de código.

### D1 · «Desvincular» es dejar de mirar, y nada más — **decidido**

El diseño lo planteaba como una acción doble: *«Deja de verla y oculta sus documentos en
Savia»*, con la promesa de que *«puedes deshacerlo después y vuelven completos»*.

**Se envía solo la primera mitad: Savia deja de mirar la carpeta.** Los documentos que ya
guardó siguen en la memoria. No hace falta ocultarlos, y por eso tampoco hace falta el octavo
llamado que este plan iba a pedirle a `apps/api`.

Lo que sostiene la decisión ya está construido y probado:

- `desenrolar` **saca la raíz y deja las filas**. Es explícito, no un efecto secundario.
- `raiz_id` es sha256 sobre volumen + directorio, **nunca sobre la ruta**. La misma carpeta da
  la misma id aunque se la agregue desde otro lado.
- Los dos juntos hacen que volver a agregarla **retome donde quedó** en vez de resubir todo.
  Lo fijan `reelegir_la_misma_carpeta_da_la_misma_id` y
  `quitar_una_carpeta_no_borra_lo_que_ya_subio`.

Y si algún día se quiere de verdad ocultarlos, el retiro de Savia es reversible por diseño
(`Ingestion.retiredAt`): la mitad que falta es de servidor, se agrega sin tocar la pantalla,
y hasta entonces **el copy dice lo que pasa** (§1.7).

> **La arista honesta.** Mientras la carpeta no se mira, Savia no se entera de lo que cambia
> adentro. Al volver a agregarla, la primera revisión reconcilia: lo nuevo sube, lo que
> desapareció se reporta ausente. Si en el medio se borraron *muchos* archivos, esa primera
> revisión puede disparar el corte por volumen y la carpeta queda **«En pausa»** — la
> salvaguarda haciendo exactamente su trabajo, pero la persona ve un estado raro justo después
> de una acción que pidió. **Fase 3 se lleva un test de esto y la pantalla, un texto que lo
> explique.** No se toca la salvaguarda: el corte por volumen no distingue «borrado a
> propósito» de «disco desmontado», y esa es precisamente su razón de existir.

### D2 · «En pausa» ya está ocupado

El diseño renombra los cuatro estados de carpeta:

| Hoy | Diseño | |
|---|---|---|
| `Sincronizado` | **«Al día»** | |
| `Barriendo` | **«Actualizando»** | |
| `CarpetaAusente` | **«No se encuentra»** / «No está» | dos largos, lista y detalle |
| `Congelado` | **«En pausa»** | ← choca |

`Congelado` es el corte por volumen: lo decide Savia, la persona no lo pidió y no lo puede
sacar. Pero el panel de hoy tiene un botón **«Pausar»** que sí es de la persona, y el diseño
**no tiene ese botón en ninguna pantalla**. Dos cosas distintas terminarían diciendo «En
pausa», y la que la persona controla desaparecería de la interfaz.

**Recomendación: quitar el «Pausar» del usuario y quedarse con el nombre del diseño.** El
botón nunca tuvo un caso de uso escrito —se agregó porque era fácil— y su única función real,
«que deje de consumir ahora», ya la cubre salir de la app. Si vuelve algún día, vuelve con
otro nombre. `Compartido.pausado` y su `AtomicBool` se van con él.

### D3 · El motivo del fallo por archivo no viaja en el alambre

El diseño muestra, por archivo: *«No se pudo abrir: tiene contraseña.»* y *«Este tipo de
archivo no es compatible.»*

Hoy hay `EstadoDeArchivo::Fallo`, sin motivo, y no puede haberlo: es Savia quien decide si un
archivo se puede leer, y `presence.decision` contesta `known` o `upload` — no contesta *por
qué no*. Es el mismo hueco que el `en espera` que ya está anotado en el borrador.

**Recomendación: la mitad que sí es del agente, ahora; la otra queda anotada.** «Tipo no
compatible» y «no se pudo abrir» son decisiones **locales** —el agente sabe la extensión y
sabe si el `open()` falló— así que esas dos se pueden dar bien hoy, con un `MotivoDeFallo`
enumerado en el núcleo. Los motivos que solo Savia conoce esperan al mismo trabajo de
servidor que D1. El enum arranca con las variantes locales y una `Desconocido`, y esa última
es la que el diseño pinta sin subtítulo.

### D4 · «Savia mira una sola carpeta a la vez»

Lo dice el diseño, textual. Contradice la decisión 3 del borrador («Las raíces son varias,
desde el principio») y el lazo multi-raíz que ya está construido y probado.

**Recomendación: dejar el núcleo multi-raíz y que la interfaz muestre una.** No es una
contradicción, es una restricción de producto sobre un motor que aguanta más. Cuesta cero
—el lazo ya itera `raices()`— y el día que la interfaz abra la segunda carpeta no hay que
tocar el núcleo. Lo que **no** hay que hacer es aprovechar la frase para volver a la raíz
fija: eso sí sería tirar trabajo probado.

### D5 · El panel pasa de tinta a papel

Pantallas 2–6 y la lista de carpetas están sobre **papel claro**; solo la pantalla 1 es tinta.
El panel de hoy es tinta entero. Se reescribe `panel.css` completo (460 líneas).

Consecuencia menos obvia: **el guardián de contraste mide contra tinta.** Los tonos del
diseño (`#2F7048` éxito, `#8A5A12` aviso, `#B23529` peligro, `#1C4A57` info) son las variantes
oscuras, pensadas para papel — sobre tinta no pasaban, y por eso el `info` medía 2.67 y
fallaba. El guardián se rehace midiendo cada tono contra **la superficie donde el diseño lo
usa**, no contra una superficie fija. Eso lo vuelve más fuerte, no más débil.

### D6 · El onboarding es una segunda ventana

Las pantallas de onboarding tienen barra de título de macOS: es una ventana normal, no el
popover. Hoy hay una sola ventana (`bandeja`, 340 px, reclasada a `NSPanel`). La ventana de
onboarding **no** lleva nada de `macos.rs` — es una ventana común, y esa es toda la gracia.

Segunda ventana en `tauri.conf.json` + **su propia capability**, porque las capabilities se
apuntan por etiqueta de ventana (`security/capabilities.mdx:49`, campo `windows`).

### D7 · El vocabulario de ingeniería llegó hasta la pantalla

Esto no lo abre el diseño: ya está en el producto. `panel.js:15-18` rotula los estados con
**los nombres internos, tal cual**:

```js
sincronizado:   { rotulo: "Sincronizado" },
barriendo:      { rotulo: "Barriendo" },
congelado:      { rotulo: "Congelado" },
carpetaAusente: { rotulo: "Carpeta ausente" },
```

«Barriendo» y «Congelado» son palabras del motor. Nadie fuera de este repositorio sabe qué
significan, y nadie debería tener que aprenderlas.

Lo llamativo es que **el principio ya estaba escrito en el código y se aplicó una sola vez**.
`panel.rs:52`, sobre el enum `Motivo`:

> *«`PorQueAusente` es de `salvaguardas` y habla de evidencia; esto habla de lo que se le
> muestra a una persona. Se traduce en vez de reexportarse porque son dos vocabularios:
> "identidad ilegible" no se le dice a nadie.»*

Exacto. Solo que se tradujo el motivo y no los estados. **El rediseño extiende esa regla a
todo lo que se ve.**

#### Y el diseño también filtra vocabulario

Revisando su copy real aparecen cuatro cosas:

1. **«Vincular» / «Vinculado» / «Desvincular»** es jerga, y el diseño **se contradice a sí
   mismo**: el encabezado dice «Vinculado» y dos líneas abajo el cuerpo dice «Conectado a la
   cuenta de». Dos palabras para una cosa, en la misma tarjeta. Gana «conectar».
2. **«PRIMER BARRIDO»** y **«El barrido sigue solo»** — «barrido» es palabra del motor,
   filtrada a la pantalla más importante del onboarding.
3. **«Abrir en el Buscador de Archivos»** — el Mac de la persona no lo llama así. Lo llama
   **Finder**.
4. **Mezcla voseo y tuteo en el mismo mensaje**: pantalla 3 dice *«Ábrelo en Ajustes del
   Sistema y activa Savia»*, y la variante que vuelve después dice *«Abrí Ajustes del Sistema
   y activá Savia»*. Todo pasa a tuteo.

#### La tabla que rige

Es la autoridad del copy y se decide acá, no durante la implementación.

| interno | hoy en el panel | diseño | **lo que lee la persona** |
|---|---|---|---|
| `Sincronizado` | «Sincronizado» | «Al día» | **Al día** |
| `Barriendo` | «Barriendo» | «Actualizando» | **Actualizando** |
| `CarpetaAusente` | «Carpeta ausente» | «No se encuentra» | **No está** · *«No la encontramos. ¿Se desconectó un disco o se movió la carpeta?»* |
| `Congelado` | «Congelado» | «En pausa» | **En pausa** · *«Desaparecieron muchos archivos de golpe. Savia puso todo en pausa hasta confirmar que está bien.»* |
| `Indexado` | — | saved | **Guardado** |
| `Procesando` | — | pending | **Guardando…** |
| `Fallo` | — | error | **No se pudo guardar** |
| `Retirado` | — | — | **Oculto** |
| barrido | — | «PRIMER BARRIDO» | **La primera revisión** · *«Puedes cerrar esta ventana, Savia sigue sola.»* |
| enrolar la cuenta | — | «VINCULAR TU CUENTA» | **Conectar tu cuenta** |
| vinculado | — | «Vinculado» | **Conectado** |
| desenrolar la carpeta | — | «Desvincular carpeta» | **Dejar de mirar esta carpeta** |
| — | — | «Buscador de Archivos» | **Finder** |
| raíz · padrón · permiso · reclamo · sonda | — | — | **nunca se muestran** |

Las dos frases largas de `CarpetaAusente` y `Congelado` son del diseño y son buenas: dicen qué
pasó y qué hacer, sin nombrar el mecanismo. Son el modelo de todo lo demás.

#### El copy de «dejar de mirar», ya con D1 cerrado

| | diseño | **queda** |
|---|---|---|
| menú | «Desvincular carpeta / Deja de verla y oculta sus documentos en Savia» | «Dejar de mirar esta carpeta / Savia deja de revisarla. Lo que ya guardó sigue en tu memoria.» |
| confirmación | «¿Desvincular «X»? Sale de esta lista y sus 1.204 documentos dejan de aparecer en tu memoria.» | «¿Dejar de mirar «X»? Savia no vuelve a revisarla. Los 1.204 documentos que ya guardó siguen en tu memoria — y si la agregas otra vez, sigue desde donde quedó.» |
| confirmado | «Carpeta desvinculada / … sus documentos están ocultos en tu memoria.» | «Listo, Savia dejó de mirarla / Sus documentos siguen en tu memoria. Puedes agregarla de nuevo cuando quieras.» |

La frase «sigue desde donde quedó» es una promesa que el código **sí** cumple, con dos tests
que la fijan. Vale más decirla que la que el diseño prometía y nadie podía sostener.

#### Dónde viven las palabras

Hoy están repartidas entre `panel.js` y el HTML. Con el onboarding se multiplican por seis y
quedan en cuatro archivos.

**Todo el texto que lee una persona se muda a `panel/textos.js`, y ese es el único archivo con
frases en español.** Se puede leer entero como prosa, de corrido, y revisarlo es un rato de
lectura en vez de una búsqueda por seis archivos. El resto del frontend pide una clave.

El guardián que lo sostiene (fase 8): **ninguna cadena con tres o más palabras en español
fuera de `textos.js`**. El núcleo Rust no cambia — ya emite enums, y lo debe seguir haciendo:
`MotivoDeFallo` de la fase 3 nace **enumerado**, no como `String`.

### Y lo chico que también es nuevo

- **Abrir un archivo suelto** («Toca un archivo guardado para abrirlo» + toast). Comando
  nuevo, con la misma regla que `abrir_carpeta`: **recibe un id, no una ruta**; la ruta sale
  del inventario.
- **Progreso real del primer barrido** («128 de 412»). `panel::vista` hoy no lo expone.
- **Contador de documentos** («1.204 documentos en Savia»).
- **«+ Agregar carpeta»** y un engranaje en el encabezado del panel.
- **Vista de detalle de carpeta** — subvista nueva sobre la lista.

---

## 2 · La arquitectura: de un crate a doce

### Por qué ahora

El `Cargo.toml` ya lo tenía escrito: *«Cuando el núcleo se parta —`contrato` ←
{`inventario`, `protocolo`, `plataforma`} ← `ciclo`— la mitad de esto lo impone el grafo de
dependencias y estos guardianes se pueden borrar.»*

No es una idea mía: es el plan del propio proyecto, esperando el momento. El momento es un
refactor grande con 98 tests verdes de red.

Y hay dos violaciones concretas del principio de inversión de dependencias que el corte
arregla **de oficio**:

1. **El puerto vive adentro del adaptador.** `pub trait Plataforma` está en
   `src/plataforma/mod.rs:370`, en el mismo módulo que `Macos`, `Windows` y `Falsa`. `ciclo`
   ya recibe `&dyn Plataforma` —eso está bien— pero para nombrar el trait tiene que importar
   el módulo que contiene las implementaciones. El grafo no impide que mañana alguien escriba
   `plataforma::Macos` adentro del ciclo.
2. **El protocolo no tiene puerto.** `ciclo::drenar(…, cliente: &Cliente, …)` recibe el
   cliente HTTP **concreto**. El caso de uso depende del transporte — y **se queda así**: ver
   más abajo por qué invertirlo no es fase 1.

### Cómo se llegó a este corte, y por qué eso importa

La primera versión de este corte —seis crates, diseñada agrupando por *nombre* de módulo—
tenía un ciclo real: `Paso` y `Cierre` (que esa versión mandaba a `contrato`) llevan campos
tipados con `Hecho`, `Desaparicion` y `PorQueNoSeReporta`, los tres definidos en
`salvaguardas.rs`, que la misma versión asignaba a una crate que depende de `contrato`. Cargo
lo hubiera rechazado en el primer `cargo check`. La encontró un agente al que se le pidió
específicamente **refutar** el diseño, no aprobarlo — junto con seis problemas más que
hubieran impedido compilar (`redb`/`serde_json`/`serde` faltantes en cuatro crates, el host
sin dos de sus dependencias directas, un test de `persistencia` que en secreto necesitaba
`ciclo::barrer`). Ninguno de los siete lo encontró la primera pasada de diseño.

El arreglo no fue parchear caso por caso: fue notar que la arista que motivaba el ciclo
(`almacen → maquina`) **nunca estuvo invertida**. `maquina` es un servicio de dominio sin
estado (cero campos, cero `&mut self`, medido); `almacen` es el adaptador que lo persiste.
Adaptador-depende-de-caso-de-uso es la dirección correcta en arquitectura limpia. Dejando
`Paso`/`Cierre`/`Nodo` donde ya están —en `maquina`, que ya depende de `politica`— el ciclo
desaparece sin tocar una sola firma, y la única arista nueva es `estado → maquina`, que no
cierra nada porque `maquina` no depende de `estado` ni transitiva ni directamente (verificado
leyendo el archivo completo).

Ese arreglo pasó otra vez por las mismas cuatro lentes de refutación. Sobrevivió la
estructura; lo que quedó fueron omisiones de manifiesto (`serde` faltante en `aplicacion`,
tres plugins de Tauri faltantes en el host) y un problema de diseño más chico, resuelto abajo:
varios guardianes de `tests/guardianes.rs` verifican una propiedad que abarca **más de una
crate a la vez**, y ninguna reasignación por crate alcanza para esos.

### El corte

```
apps/folder-agent/src-tauri/
├── Cargo.toml              [package] savia-folder-host + [workspace] members=["crates/*"]
├── crates/
│   ├── contrato/            dominio · hash · parámetros · el vocabulario de plataforma,
│   │                        protocolo, colas e inventario · LOS DOS PUERTOS      1233 líneas   0 deps propios (serde, sha2)
│   ├── politica/             salvaguardas (menos Candidato/misma_observacion)     495           → contrato
│   ├── maquina/               maquina.rs completo — Paso/Cierre/Nodo NO bajan     556           → contrato, politica
│   ├── estado/                inventario(impl) · colas(impl) · almacén           1682           → contrato, politica, maquina
│   ├── protocolo/              cliente · alambre · transporte                    1100           → contrato, politica
│   ├── plataforma-adaptadores/  macos · windows (SO real)                         540           → contrato
│   ├── plataforma-falsa/         el doble de prueba                               311           → contrato   [dev-only]
│   ├── persistencia/              redb + serde_json                               205           → contrato, estado
│   ├── aplicacion/                 ciclo · panel — el único que compone           817           → contrato, politica, estado, maquina, protocolo
│   ├── guardianes/                  guardianes de texto que abarcan el workspace    —           → (solo tests, ve las 11 crates hermanas)
│   └── pruebas-integracion/          contra_el_simulador · el resto de persistencia 800          → todo lo de arriba menos guardianes
└── src/ · build.rs · tauri.conf.json · capabilities/ · icons/   (sin mover — el binario)
```

`savia-folder-host` (el paquete que hoy es `src-tauri/`, con `bin/bandeja` y la CLI) depende
de **siete** de las once: `contrato`, `aplicacion`, `persistencia`, `protocolo`,
`plataforma-adaptadores`, `estado` y `politica` — los dos últimos porque los binarios
instancian `Almacen` y `Politica` directo, no solo a través de `aplicacion`.

**Los puertos van en `contrato`, el más adentro.** `Plataforma` e `Inventario` se mudan ahí.
Con eso el grafo dice, y ya no hace falta un guardián de texto que lo diga:

- **`maquina` y `aplicación` no alcanzan `plataforma-adaptadores` ni `plataforma-falsa`.**
  Reciben `&dyn Plataforma` (el puerto) por parámetro, nunca construyen un adaptador.
- **`estado` y `protocolo` no se ven entre sí.** Los seis tipos de alambre que antes forzaban
  `protocolo → colas` bajaron a `contrato`; `estado` no tiene ninguna arista hacia `protocolo`.
- **El código de producción no puede usar `Falsa`**: ninguna crate que no sea `[dev-dependencies]`
  la declara. Hoy eso lo sostiene la disciplina; después lo sostiene Cargo.
- **`contrato` no es cero-deps como `packages/ir`** —a diferencia de TypeScript, Rust necesita
  `serde` para derivar (De)Serialize y `sha2` porque `HuellaDeRaiz::raiz_id` lo llama— pero
  juega el mismo ROL: vocabulario puro, cero lógica de adaptador o de caso de uso.

`src/main.rs` (la CLI de demostración) y `src/bin/bandeja/` siguen detrás de
`required-features`, sin moverse, como los dos `[[bin]]` del paquete host.

### Los tests de `tests/guardianes.rs`, uno por uno

Diecinueve tests llaman a `fuente(archivo)`. Trece tocan un solo archivo que cae entero en
una sola crate — esos se mudan tal cual al `tests/` de esa crate, con la ruta corregida.
Ejemplo: `el_puerto_de_inventario_no_tiene_metodos_de_escritura` lee `inventario.rs` buscando
`trait Inventario` — ese trait vive en `contrato`, así que el test se muda a
`contrato/tests/`, sin tocar su cuerpo.

Dos verifican una propiedad **por archivo**, pero sus archivos caen en crates distintas —
`los_modulos_puros_no_tocan_el_mundo` (`maquina.rs`→`maquina`, `salvaguardas.rs`→`politica`,
`inventario.rs`→`estado`) y `ningun_numero_inventado_en_los_modulos_de_decision`
(`maquina.rs`, `salvaguardas.rs`). Estos se **parten en N copias**, una por crate, cada una
mirando solo su propio archivo — no hay conocimiento cruzado que compartir, así que partir no
pierde nada.

Tres verifican una propiedad **del workspace entero**, y ninguna reasignación por crate
alcanza:

- `el_hash_verificado_solo_se_acuna_en_las_puertas_nombradas` — tiene que confirmar que
  `HashVerificado::acunar` no aparece en OCHO archivos que hoy están en un crate y mañana en
  seis, y que aparece **exactamente dos veces** en el que sí puede llamarlo. Un conteo global
  no se puede partir en copias locales sin perder la palabra «exactamente».
- `sin_emoji_en_los_fuentes` — barre dieciocho archivos que terminan repartidos en nueve
  crates distintas.
- La mitad viva de `el_nucleo_no_conoce_la_ventana` — la prohibición de `tauri`/`objc2`/
  `block2` como *dependencia* la impone ahora el propio Cargo (si una crate no las declara, no
  puede usarlas: compila o no compila) y esa mitad **se borra**, es exactamente el antipatrón
  que el propio archivo señala en otra parte — pero la prohibición de la *palabra* `webview` en
  comentarios y el chequeo de que el recorrido bajó a cada subcarpeta no son propiedades que
  Cargo imponga solo, y siguen necesitando ver todo el árbol.

Esos tres van a una **crate nueva y chica, `savia-folder-guardianes`**: sin `[lib]`, solo
`[[test]]`, cero dependencias propias. Camina las carpetas hermanas por ruta relativa desde su
propio `CARGO_MANIFEST_DIR` — la misma técnica que `fuentes_fuera_del_binario_de_ventana` ya
usa hoy, con un nivel más de indirección. No es simetría: es la única forma de no fragmentar
una garantía que es, por naturaleza, sobre el todo y no sobre una parte.

### Lo que el corte NO hace

No cambia comportamiento. **El criterio de aceptación de esta fase es que el diff sea
movimientos de archivo, arreglos de ruta y declaraciones de dependencia en `Cargo.toml` — y
que los 98 tests pasen sin que se toque un solo `assert`.** Un test que haya que editar para
que pase es un hallazgo, no un ajuste; una relajación de visibilidad (`pub(crate)` → `pub`)
cuenta como cambio de comportamiento, no como movimiento, y por eso no está en este corte.

**Dos aristas se quedan tal como están, documentadas, porque romperlas no es un movimiento:**

- `aplicacion → protocolo` con `Cliente` **concreto**, no un trait. `protocolo/mod.rs`
  documenta que evitar un puerto ahí fue deliberado —un doble no atrapa problemas de
  transporte, y `contra_el_simulador.rs` existe justo para eso—. Invertirla exige un puerto de
  canal nuevo que el banco también pueda implementar: fase 2.
- `protocolo → contrato` para llamar `HashVerificado::acunar`, que hoy es `pub(crate)`. En
  crates separadas eso tiene que relajarse a `pub`, y el guardián que hoy verifica «las
  puertas son exactamente dos» con un `grep` de un solo archivo pasa a necesitar el `grep`
  multi-crate que ya vive en `savia-folder-guardianes`. Preservar la restricción con un
  tipo-testigo es un cambio de firma: fase 2.

### La alternativa más barata, y por qué no

Se puede quedar en un solo crate y mover los puertos a un módulo `contrato::puertos`. Eso da
el 80 % del beneficio SOLID por el 20 % del costo — pero deja el grafo sin poder imponer
nada, y los guardianes de texto siguen ahí. Dado que el proyecto entero está construido sobre
«que la estructura lo imponga, no la disciplina», la versión barata está peleada con su propia
identidad. **Recomiendo el corte completo.**

---

## 3 · Las prácticas de Tauri, con la cita

Todo esto sale de `~/.local/share/savia-fuentes/tauri-docs/src/content/docs/`.

**1 · La lógica vive en el Core.** `concept/process-model.md`. El WebView está enlazado
dinámicamente —WKWebView acá, WebView2 en Windows— así que lo que se le delegue cambia de
comportamiento según la máquina. El panel de hoy ya cumple: JS solo pinta. **El rediseño lo
tiene que seguir cumpliendo**, y ahí está la tentación: el diseño tiene precedencia de estados
(«no está» gana sobre «en pausa», que gana sobre «actualizando»). Esa precedencia **ya está en
`panel.rs` y se queda ahí**. El JS nuevo no la puede reimplementar aunque sea más cómodo.

**2 · Capabilities por ventana, y separadas por categoría.**
`security/capabilities.mdx:49` (campo `windows`) y
`learn/Security/capabilities-for-windows-and-platforms.mdx`: *«se recomienda separar los
archivos de capability por categoría de acciones que habilitan.»* La ventana de onboarding
necesita el diálogo de archivos; la bandeja no. Dos archivos, no uno con la unión.

**3 · El progreso va por canal, no por evento.** `develop/calling-frontend.mdx:149`: el
sistema de eventos *«evalúa JavaScript directamente, así que puede no ser adecuado para mandar
gran cantidad de datos»*; los canales *«están diseñados para ser rápidos y entregar datos
ordenados… se usan internamente para operaciones de streaming como el progreso de descarga.»*
El «128 de 412» de un barrido de miles de archivos es exactamente ese caso. Los eventos se
quedan para lo que ya hacen: avisar que la vista cambió.

**4 · El estado global va por `app.manage`, no por una struct propia.**
`develop/state-management.mdx`. Hoy `Compartido` se pasa a mano. `manage(Mutex<Estado>)` es lo
que la documentación indica, y trae la nota que importa: *«no necesitas `Arc` para lo que
guardes en `State`, Tauri lo hace por ti»* (línea 89). El `Mutex` de la biblioteca estándar
alcanza —la misma página lo dice citando a Tokio— **salvo que haya que sostener el guard
cruzando un `await`**, que en este lazo no pasa.

**5 · Un comando no recibe lo que puede resolver.** No es una cita, es la consecuencia de
`security/scope.mdx`: todo lo que el comando acepta es superficie que el WebView controla.
`abrir_archivo(id)` es defendible; `abrir_archivo(ruta)` le da al WebView un `open()`
arbitrario. Regla ya aplicada en `abrir_carpeta`; los tres comandos nuevos la heredan.

**6 · El patrón de aislamiento se sigue salteando, a propósito.**
`concept/Inter-Process Communication/isolation.md` lo recomienda cuando hay dependencias de
frontend. El panel tiene **cero**: no hay `node_modules`, no hay bundler, el JS es a mano. El
día que entre la primera dependencia, esta línea deja de ser válida y hay que releerla.

---

## 4 · Las fases, con agente y modelo

Criterio para elegir modelo: **Sonnet cuando el trabajo es mecánico y el criterio de
aceptación es verificable por una máquina** (mover archivos, traducir HTML a plantilla,
reescribir CSS contra un diseño que ya existe). **Opus cuando la tarea define o rompe un
invariante** —el protocolo, la precedencia de estados, las mutaciones de acreditación—, que
es donde equivocarse sale caro y no lo detecta un test que todavía no existe.

| # | Fase | Agente | Modelo | Depende de |
|---|---|---|---|---|
| 0 | Commitear lo que hay | — (yo) | — | — |
| 1 | El corte en crates (arquitectura ya cerrada en §2) | `general-purpose` | **Sonnet** | 0 |
| 2 | Las dos aristas que fase 1 dejó documentadas | `general-purpose` | **Opus** | 1 |
| 3 | Los huecos de protocolo (D1, D3) | `general-purpose` | **Opus** | 2 |
| 4 | La vista crece (nombres, progreso, conteo, motivo) | `general-purpose` | **Sonnet** | 3 |
| 5 | El panel nuevo (tinta → papel) | `general-purpose` | **Sonnet** | 4 |
| 6 | La ventana de onboarding | `general-purpose` | **Sonnet** | 4 |
| 7 | Los comandos nuevos y el canal de progreso | `general-purpose` | **Opus** | 4 |
| 8 | Guardianes y acreditación | `general-purpose` | **Opus** | 5, 6, 7 |

**5, 6 y 7 corren en paralelo** — tocan archivos distintos (`panel/panel.*`,
`panel/onboarding.*`, `bin/bandeja/`). 1→2→3→4 es cadena y no hay forma de acortarla: cada una
cambia las firmas que la siguiente usa.

Después de **cada** fase corre `verificador-savia` contra el criterio de aceptación de esa
fase, en contexto limpio. Es para lo que está.

### El detalle de cada fase

**Fase 1 · El corte.** Sonnet. La arquitectura de §2 ya pasó por dos rondas de diseño y cuatro
lentes de refutación adversarial cada una — no queda por decidir, queda por ejecutar: crear
las once crates (`contrato`, `politica`, `maquina`, `estado`, `protocolo`,
`plataforma-adaptadores`, `plataforma-falsa`, `persistencia`, `aplicacion`, `guardianes`,
`pruebas-integracion`) más el paquete host, partir los cinco archivos que cruzan una frontera
(`inventario.rs`, `colas.rs`, `salvaguardas.rs`, `plataforma/mod.rs`, `protocolo/mod.rs`),
repartir los 19 tests de `tests/guardianes.rs` según la tabla de §2 (13 copiados tal cual, 2
partidos por crate, 3 movidos a `guardianes/`), y declarar cada `Cargo.toml` con las
dependencias externas que §2 ya nombra. Aceptación: `pnpm lint` verde y el diff no contiene ni
un `assert` cambiado. Es la fase con el criterio más nítido de todo el plan, y por eso es la
que menos necesita Opus — pero es también la más grande en volumen de archivos, así que el
agente debe verificar la aciclicidad del grafo real (`cargo tree` por crate) antes de dar la
fase por cerrada, no solo confiar en la tabla del documento.

**Fase 2 · Las dos aristas pendientes.** Opus. Las dos que §2 deja documentadas y no rompe en
fase 1: (a) un puerto de canal (`CanalDeSavia` o similar) que `Cliente` implemente, para que
`aplicacion` deje de recibir `&Cliente` concreto — sin perder la cobertura de fallas de
transporte que `contra_el_simulador.rs` existe para probar, así que el banco también tiene que
poder implementar el puerto; (b) un tipo-testigo o trait sellado que reemplace la privacidad
de módulo que sostenía «`HashVerificado::acunar` tiene exactamente dos puertas», ahora que
`acunar` es `pub` entre crates. Aceptación: `aplicacion/Cargo.toml` sigue dependiendo de
`protocolo` (esa arista no desaparece, cambia de forma), pero el guardián en
`guardianes/tests/` verifica la restricción por tipos y no por conteo de texto.

**Fase 3 · El protocolo.** Opus. `MotivoDeFallo` en el núcleo con las variantes locales;
«Dejar de mirar» con el copy de §1.7; el octavo llamado **documentado, no construido**,
en `borrador-agente-carpeta.md` junto a los otros huecos. Dos tests de aceptación: que
desvincular **no** mande el padrón vacío —o sea que no congele la raíz, el camino corto que
alguien va a querer tomar—, y que volver a agregar una carpeta a la que le borraron mucho
adentro **sí** dispare el corte por volumen, porque esa es la arista de D1 y tiene que estar
fijada, no descubierta en producción.

**Fase 4 · La vista.** Sonnet, con la especificación escrita por mí. `panel::vista` gana
progreso, conteo y motivo; los estados se renombran. La precedencia **no se toca** — ya está
probada por los 12 tests de `panel.rs`. Aceptación: esos 12 siguen verdes sin editarse.

**Fase 5 · El panel.** Sonnet. Reescribir `panel.css`, `panel.js`, `bandeja.html` contra el
HTML del diseño, que ya está en disco y sirve de referencia literal, y **crear `textos.js`
aplicando la tabla de §1.7** — la tabla ya decide cada palabra, así que acá no se redacta, se
aplica, y por eso alcanza Sonnet. Aceptación: el panel
pinta los cuatro estados de carpeta y los tres de archivo, y `panel:contraste` pasa con el
guardián nuevo de la fase 8. Mientras tanto, pasa con el viejo relajado — y eso queda anotado
como deuda de una fase, no como excepción permanente.

**Fase 6 · El onboarding.** Sonnet. Segunda ventana en `tauri.conf.json`, capability propia
(`capabilities/onboarding.json`, con el diálogo), las seis pantallas. Todo su texto sale de `textos.js`. Aceptación: el flujo
completo corre contra el simulador, incluidos los cinco rechazos de la pantalla 4, y no queda
ni un «vincular», ni un «barrido», ni una forma voseada.

**Fase 7 · Los comandos.** Opus. `abrir_archivo(id)`, `desvincular(id)`, el canal de progreso.
Aceptación: ningún comando nuevo acepta una ruta, y el canal se prueba con un barrido de
miles sin que el panel se trabe.

**Fase 8 · La acreditación.** Opus. El guardián de contraste se rehace midiendo cada tono
contra la superficie donde el diseño lo usa. Cada garantía nueva —el padrón que no se vacía,
la ruta que no entra por comando, la precedencia que el JS no reimplementa, las palabras que
no viven fuera de `textos.js`— consigue su mutación en el corredor, y **la mutación tiene que ponerse roja**. Es la fase que no se puede
delegar a un modelo más chico: acá se decide qué queda protegido para siempre y qué queda
librado a que nadie lo rompa.

---

## Lo que este plan deja afuera, a propósito

- Ocultar los documentos al dejar de mirar una carpeta — **ya no hace falta** (D1); si algún
  día se quiere, es servidor y no toca la pantalla.
- Los motivos de fallo que solo Savia conoce (D3) — mismo bloqueo.
- Eventos de sistema de archivos (FSEvents / `ReadDirectoryChangesW`).
- Los nueve `unimplemented!()` de `plataforma/windows.rs`.
- Los cuatro números del canal sin medir, el `en espera`, la sonda de sensibilidad a
  mayúsculas, la marca de tiempo del último cierre de barrido.
- Firma, notarización y CI de empaquetado — está en `distribucion-agente.md`.
