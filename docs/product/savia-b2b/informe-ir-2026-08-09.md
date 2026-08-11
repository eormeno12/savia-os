# `packages/ir` — informe de cierre

## Estado

**Compila.** `npx tsc --noEmit` en `/Users/eormeno/Development/savia-os/packages/ir` → exit 0, salida vacía, con `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noUnusedLocals` + `noImplicitReturns` + `verbatimModuleSyntax`. Verificado por mí, no citado: el estado del árbol quedó idéntico al que entregó el autor (borré todas mis sondas).

| | |
|---|---|
| Archivos | 10 en `src/` + `package.json`, `tsconfig.json`, `README.md` |
| Líneas | 3 464 |
| Símbolos exportados | **162** — 97 tipos/interfaces + 65 constantes y funciones |
| Marcas `PROVISIONAL(` | 136 |
| Dependencias de runtime | 0 |
| Quién lo consume hoy | **nadie** (`grep @savia-os/ir` en `apps/` y `packages/` → solo su propio `package.json`) |

**El entregable está**: los 16 tipos que el hueco H1 pedía existen, los literales del plan coinciden uno por uno, y `packages/ir/` es efectivamente la fuente única — ninguna definición se repite entre archivos.

**Pero tres de las garantías que el paquete anuncia por escrito no están vigentes**, y las verifiqué rompiéndolas: la familia de hashes no separa nada (es literalmente `never`), el detector de no-anidamiento tiene cuatro agujeros de unión, y dos de los tres "invariantes de build" del README no verifican. Detalle en la última sección. Como todavía nadie importa el paquete, arreglarlas cuesta horas; después de que `adaptadores` y `emision` se apoyen encima, cuesta un refactor.

---

## Decisiones provisionales

Ordenadas por cuánto cuelga de ellas. Las de nivel 1 conviene revisarlas antes de escribir una línea de `adaptadores`; las de nivel 3 se pueden dar vuelta más tarde sin arrastrar nada.

### Nivel 1 — el resto del pipeline se construye encima

| Tag | Dónde | Qué se eligió | Qué cambia si se decide al revés |
|---|---|---|---|
| **H13** | `identidad.ts:43` | `ElementId` = ULID aleatorio acuñado por la **reconciliación**, nunca por fórmula; unicidad **global** | Si vuelve a ser derivado (contenido, posición, migas): el tramo 4 pierde su razón de existir y la curación del cliente se despega en cada edición. Si la unicidad es por documento: `Fragmento.nodos` y `Registro.nodo` necesitan `DocumentoId` al lado y **todo join cambia** |
| **C2** | `identidad.ts:189,208` · `salidas.ts:275-277` | **Dos** huellas de fragmento: `huellaTexto` (limpio) y `huellaContextual` (con migas) | Con una sola: o 299 de 300 contratos reciben el vector de otra sección, o el titular «300 contratos → 1 vector» es falso. Ver contradicción **#2**: elegir dos ya lo vuelve falso, en menor grado |
| **C1** | `clasificacion.ts:198-272` | Codominio **nuevo** `lead · satellite · solo · normal`; se declara **derogado** L1089-1093 | Con el codominio viejo el tramo 5 queda sin implementación posible y `solo` desaparece. Es la única lectura bajo la cual el switch de L1443-1447 tiene ramas alcanzables. **Costo aceptado**: `tabla`, `campos` y `pie` pasan de "no se mezclan" a "se agrupan libremente" — ver contradicción **#3** |
| **H2/H6** | `proyeccion.ts:208` | **Una sola** proyección (`proyectar`); `huellaDe` y `similitud` derivan de ella; `renderizar` va aparte. Entra en la huella «lo que una persona vería», no «lo que alguien concluyó»: `forma` sí, `tipo` no, `marcas`/`mime`/`pendientes` no | Dos implementaciones producen cachés disjuntos y tasas de anclaje distintas. La propiedad `huella(a)=huella(b) ⟹ similitud(a,b)=1` sale por construcción y se perdería. **Esta decisión fija la tasa de anclaje de todo el corpus** |
| **C9/#8** | `adaptador.ts:509` | `descomponer` recibe una **`Fuente`** (perezosa), no `Uint8Array` — el autor la marca como *la desviación más grande, merece revisión humana* | El tope de tamaño (que no tiene valor) pasa a ser la única protección de memoria contra un archivo hostil |
| **C4** | `formas.ts:151` · `proyeccion.ts:267` | `RefObjeto = {objeto, ventana}`; punto fijo = **cobertura de ventanas** (`ventanaCubre`), no igualdad de hashes ni porcentaje | Con ref opaca, dos regiones de la misma página hashean igual y ninguna ancla. Con umbral de cobertura hay que inventar el número «casi todo su origen» que H3 dejó sin valor |
| **C3** | `formas.ts:238-282` | `grid.encabezados: string[] \| null` con `null ≠ []`; `container.esquema` como **campo nuevo**; nodo-fila = `grid` con `encabezados:null`, 1 fila, `grano:'fila'` | Sin `esquema`, `Registro.valores` no se construye y las etiquetas del container no tienen de dónde salir. Con `[]` en lugar de `null`, el nodo-fila es indistinguible de una región sin encabezado. **Hoy la distinción no llega a la huella** — ver ataques **#4** |
| **C18/C19** | `clasificacion.ts:58-108` · `salidas.ts:114` | `NivelDeReconocimiento` (4) es **nuevo**; `Certeza` queda intacta en 2; `certezaDeNivel()` en vez de una constante; `confianza: number \| null` en el nodo | Ampliar `Certeza` rompe el literal de L1031 y el invariante «certeza válida». Sin `certezaDeNivel`, la certeza miente para páginas escaneadas — el único lugar donde el plan admite un modelo |
| **H1** | `adaptador.ts:339` | `Contexto` como **capability object** (`gastar`, `invocar`, `materializar`, `ancestros`, `señal`); **no** hay `ctx.delegar()` | Sin capability object nadie hace cumplir el presupuesto ni hay dónde colgar la cadena de ancestros. Con `ctx.delegar()`, `adaptadores` pasa a depender de la orquestación y se rompe el grafo de paquetes |
| **#66** | `identidad.ts:68` | `LocalId` restaurado (la `LocalKey` del doc 05) para romper la circularidad emisor↔reconciliador | El emisor tendría que escribir `parentId: ElementId` que todavía no existen, o correr dos veces y decidir qué se conserva entre pasadas |

### Nivel 2 — condicionan un tramo entero

| Tag | Dónde | Qué se eligió | Qué cambia si se decide al revés |
|---|---|---|---|
| **C13/C23** | `ubicacion.ts:56+` | `Coordenada` como unión discriminada; `SourceRange` = su variante `grid`; `Caja` en **enteros de milésimas** con `marco` obligatorio | Sin la unión, `SourceRange` no se puede tipar y el split π/σ pierde la mitad exacta. Con floats hay que declarar tolerancia y el test byte-idéntico deja de ser una igualdad. Sin `marco`, las 40 diapositivas de un `.pptx` conviven en un plano |
| **C8/#22** | `salidas.ts:100-130` | Partir `NodoCrudo` / `Nodo`; `Autoría` fuera de lo cacheado, sellada por documento | Si no se parte: el caché filtra procedencia entre organizaciones, o el property test de determinismo se declara inaplicable |
| **#7** | `adaptador.ts:290` | `ClaseDeGasto` separa `invocación` (no descuenta en acierto de caché) de `expansión` (descuenta siempre) | El único límite que queda es `msMáximo`, que es justo el que la regla dice que no debería contar — y la recursión se queda sin medida decreciente |
| **#429** | `adaptador.ts:42-89` | `Evidencia` derivada del **orden** de `ESCALA_EVIDENCIA` (da 4/3/2/1/0/−1 sin literales); `Piso` no compite en el mismo `sort`; criterio operativo escrito para Firma/Estructura/Extensión/Contenido | Con seis números sueltos la relación ordinal queda implícita. Sin criterio operativo, quién gana un archivo depende de cuál autor de adaptador fue más modesto. **Pero el tipo quedó abierto** — ver ataques **#8** |
| **#62/#63/H16** | `salidas.ts:206-260` | Denominador de `anclaje` = lado **viejo**; `SalidaDeEmisión = {nodos, bajas, métricas}`; `adaptadorAnterior`/`versiónAnterior` en las métricas | Con `max`, borrar 400 de 500 también dispara la alerta. Sin `bajas`, el tramo 7 nunca las recibe y el índice acumula contenido borrado. Sin los dos campos de H16, la única alerta del peor modo de falla no es accionable |
| **C10** | `adaptador.ts:509` | `descomponer` devuelve el **arreglo completo**; se declara el **streaming no soportado en v1** | Cambiarlo arrastra a `detectar`, que recibe el corpus completo por diseño |
| **C21** | `identidad.ts:114` | `DelegacionId` como **cadena** en `Nodo.delegación`; la frontera de delegación **no** viaja en la pista | Sin cadena, el emisor no distingue bajar 1 nivel de bajar 3 y la cita encadenada no se puede armar |
| **R1** | `formas.ts` (`asset.mime`, `verbatim.lenguaje`) | R1 en sentido **débil**: se permite *nombrar* un formato, se prohíbe *llevar su estructura*; `mime` y `lenguaje` en minúsculas, vocabulario abierto | En sentido fuerte hay que sacar `mime` del cuerpo y la delegación se queda sin insumo para la sonda |
| **#37** | `identidad.ts:165` | `hashBytes` lo calcula el **worker** en la primera lectura | Con multipart, el mismo archivo en chunks distintos da hashes distintos. Pero rompe el orden del tramo 1 — ver contradicción **#5** |
| **#43/#44/#46** | `clasificacion.ts:171-193` | `Clase.pista` puede ser `null`, y `null ≠ {via:'ninguna'}`; `nivel: null` = «título de nivel indeterminado»; `Pista.padre` usa `LocalId` marcado | Sin los tres estados, los adaptadores que se abstienen pierden su ruta raíz o cierran la pila. Con `string`, `parentId` y `pista.padre` son confundibles en cada llamada |

### Nivel 3 — locales, revisables después

| Tag | Dónde | Qué se eligió | Si se decide al revés |
|---|---|---|---|
| **#27** | `proyeccion.ts:56` | `‖` = longitud prefijada (`len:valor`), inyectivo por construcción | Con separador hay que verificarlo, y la verificación se olvida |
| **H4/#55** | `proyeccion.ts:399,436` | `grid` a **TSV**, no markdown con pipes; `claveDeCampo` con política explícita (`col_N` + sufijo posicional) | Markdown puede duplicar tokens y cambia N ventanas para toda planilla; sin `claveDeCampo`, dos implementaciones dan `Registro` distintos para la misma planilla |
| **#53** | `proyeccion.ts:399` | `renderizar` devuelve `null` para `asset`/`container` | Se embebe cadena vacía, que colisiona en el caché con todos los demás vacíos |
| **#64** | `proyeccion.ts:196` | Huella sobre contenido y nada más: **filas repetidas no anclan** (residuo registrado) | Meter posición está prohibido por L1162-1167 |
| **#74** | `salidas.ts:291` | `Fragmento.certezaMínima`; la autoría **no** se comprime, va por join | La promesa de L920-923 depende de una consulta que nadie declaró |
| **#18/#21** | `salidas.ts:369+` | `origen: 'automática' \| 'humana'` obligatorio + clave de dedup; `mirar(nodo, esquemaDelContainer)` | Un borrado por re-emisión se lleva la curación del cliente; la mitad de las anotaciones sobre planillas no se puede escribir |
| **#2/#445** | `salidas.ts` · `adaptador.ts:99` | `NivelLogrado` gana `'mixto'`; una sola grafía de `Canal` (`'carpeta'`); `Origen` como unión discriminada | Sin `mixto`, el ejemplo estrella del plan (198+2) no tiene valor. Sin unión discriminada, chat-canal ≡ chat-adaptador |
| **#25/C20** | `adaptador.ts:507` | `versión` cubre el **adaptador entero**, no solo el clasificador | C20 queda sin arreglo: el caché sirve árboles corruptos para siempre |
| **P1** | todo el paquete | Español congelado con la asimetría literales-sin-tilde / exportados-con-tilde | Ninguna cita de línea del plan verifica, y se toca el contrato de contrabando |

---

## Contradicciones que el contrato dejó expuestas

Nueve. Ninguna es un bug: son afirmaciones publicadas del plan que dejaron de poder ser ciertas cuando se fijó el tipo. Cada una necesita una decisión tuya, no un arreglo de código.

1. **C3 + C14 rompen la medición estrella.** Poner el esquema en el `container` (requisito medido: anclaje 1.00 vs 0.00) y a la vez meterlo en la huella del container (para que C14 no deje a todos los containers hasheando igual) implica que **agregar una fila mueve el hash del container**. La cifra publicada `anclaje 1.00 · 502 anclas · 1 alta` (L1544) pasa a ser **501 anclas + 1 alta + 1 container movido**. → *Decidir: se acepta 1 id movido, o el esquema sale del cómputo de la huella.*

2. **C2 invalida el titular.** Con `huellaTexto` + `huellaContextual`, 300 contratos comparten `huellaTexto` pero comparten **vector** solo cuando además coincide la miga. «Una cláusula estándar en 300 contratos → **1** vector» (L1977) es falso, y con él hay que rehacer la comparación contra el tramo de Diferencia (L1973-1980) — que es la justificación escrita de haberlo borrado entero. → *Decidir: se corrige el titular, o el vector se indexa por `huellaTexto` y se acepta que la miga no lo distinga.*

3. **C1 mueve comportamiento que el plan nunca discutió.** Bajo el codominio viejo, `tabla`, `campos` y `pie` eran `atomic` (no se mezclan). Bajo el nuevo son `normal` (se agrupan libremente): un pie repetido en 200 páginas entra ahora en el texto de decenas de fragmentos. La tabla de L1461-1464 enumera tres tipos para `solo` y no explica por qué esos dos quedan afuera. → *Decidir: se extiende `solo` a `tabla`/`campos` (contradice L1463), o se acepta el cambio y se escribe.*

4. **C13 degrada la opacidad de `Ubicación`.** Para que `SourceRange` sea tipable, L1072-1074 pasa de «el **tipo** es opaco» a «el **ancla** es opaca». → *Es un cambio de prosa del plan; hay que escribirlo.*

5. **C8 + #37 rompen el orden del tramo 1.** Si `hashBytes` lo calcula el worker (única opción verificable con subida prefirmada), es **nullable** entre la recepción y la primera lectura, así que el dedupe de blobs **no puede ocurrir en la puerta** ni ser la clave de escritura del objeto. Contradice el orden de L172-177 y toca C6. → *Decidir el orden real del tramo 1.*

6. **C22 no es verificable estáticamente.** `TipoPara<F>` cubre a los adaptadores que construyen nodos literales y a nadie más. «No entra al registro» describe una **compuerta de CI sobre golden files**, no una verificación estática. → *Escribir la compuerta, o dejar de llamarlo verificación estática.*

7. **El determinismo de L957-962 solo vale con `msMáximo = null`.** Con un tope de tiempo de pared el conjunto de nodos depende de la velocidad de la máquina y **ningún adaptador pasa el test**. Quedó escrito en `Presupuesto` y en `AdaptadorOpaco.reconocer`. → *Decidir: el property test corre con topes desactivados, o el determinismo se enuncia módulo presupuesto.*

8. **C14 contamina la métrica de anclaje.** Un container **desnudo** (sin esquema) no puede anclar por construcción — y en `chat`, `.zip/.eml` y el piso de texto **todos** los containers son desnudos. El denominador de `anclaje` mide en parte una imposibilidad, así que un HTML con 300 containers tiene un techo estructural por debajo de 1.00 y `umbralDeAnclaje` va a alertar sobre re-ingestas sanas. → *Decidir: los containers desnudos salen del denominador, o el umbral se calibra por forma.*

9. **La cifra de L1753 depende de una hipótesis no declarada.** 502 anclas / anclaje 1.00 supone 500 filas de contenido **distinto entre sí**. Una planilla real con una columna de estado produce filas repetidas → ninguna ancla → todas al pase 2 en un solo hueco → el escenario cuadrático de L1415-1424. → *Declarar la hipótesis junto a la cifra, o volver a medir con un corpus con repetición.*

---

## Lo que el contrato NO puede resolver

Nada de esto se decide con tipos. Está marcado adentro del paquete salvo donde se indica.

- **H9 · la sonda de un asset delegado.** `RefObjeto.ventana` da la *expresión* de qué región es, pero mientras no se materialice (L806-807) sus primeros 4 KB siguen siendo los del PDF entero, `esImagen` da `Ninguna`, y **el ejemplo canónico del plan (contrato.pdf → pg3 → adaptador `imagen`, L750-756) no funciona.** Quién construye esos 4 KB es decisión de `adaptadores`.
- **H8 · «prominencia» como orden.** No hay forma de decidir si 14 pt negrita gana a 16 pt regular, y ese orden determina el árbol entero de todo documento sin estilos. **No está ni marcado**: `grep PROVISIONAL(H8)` en `src/` → cero. Es el hueco peor reportado del paquete.
- **H7 · `regionesDeGrilla`.** Tres umbrales sin valor (filas vacías que cortan, tipo dominante, cuántas columnas deben diferir) y ningún criterio para `grid` vs `fields`. Decide el conteo de nodos de toda planilla. El esquema de nombres de `región` y su estabilidad tampoco existen.
- **H2, segunda mitad · el emparejamiento.** La métrica está; el emparejamiento no: voraz / por orden / asignación óptima, empates, 1:N, si el pase 3 conserva la restricción de tipo y forma, si el pase 2 es revocable. Y el plan **nunca declara que el reconciliador deba ser determinístico**.
- **H10 · el orden de lectura.** L1223 dice «para cada nodo, en orden de lectura» y todo el algoritmo de pila del emisor depende de que los ancestros abran antes que los descendientes. `descomponer` **no tiene poscondición de orden** (`adaptador.ts:509`) y `compararCajas` (`ubicacion.ts:219`) ordena por **área ascendente** — que pone el hijo antes que el padre. No está marcado.
- **#17 · las anotaciones son de solo escritura.** Ningún tramo declara *leer* anotaciones. Las exclusiones y la sensibilidad solo significan algo si alguien se niega a indexar: hoy, contenido marcado como excluido llega al índice, y el tramo 6 es donde el texto sale hacia una API de terceros.
- **#19 · anotación cuyo nodo es una baja.** ¿Cascada, huérfana, resurrección?
- **#1 · la máquina de estados no tiene transiciones.** Los ocho valores están declarados y nada más. Sin transiciones no se puede escribir ningún worker.
- **#56 · los `Registro` no tienen destino.** Ni tabla, ni clave, ni idempotencia, ni superficie de consulta.
- **Cinco parámetros load-bearing en `null`** (`params.ts`): proporción de imprimibles, tamaño objetivo del fragmento, tope de los pases 2/3, umbral de anclaje, umbral de similitud. Sin ellos las cifras del banco no son reproducibles; por eso están en `null` y no inventados. *(Y `proporciónImprimiblesMínima` no es aplicable ni con número: su denominador declarado son code points sobre una ventana de 4096 **bytes**, y «imprimible» no tiene predicado en ningún archivo.)*
- **C6, C12, C17, C24** son de tramos que este contrato no toca (recepción, versionado/persistencia de la versión anterior, ventaneo del 6, registro vs roadmap).

---

## Qué encontraron los ataques

Tres verificadores atacaron el paquete. Yo re-verifiqué lo que sigue ejecutándolo — compilé sondas contra `src/` y corrí las funciones sobre casos construidos. **Ninguno de estos está arreglado**: el árbol quedó como lo entregó el autor.

### Bloqueantes — garantías anunciadas que no están vigentes

**1 · La familia de hashes es literalmente `never`. La separación nominal no existe.** `identidad.ts:15-17,165-244`

```ts
export type Nominal<Base, Etiqueta extends string> = Base & { readonly [nominal]: Etiqueta };
export type Sha256Hex  = Nominal<string, "Sha256Hex">;
export type HuellaNodo = Nominal<Sha256Hex, "HuellaNodo">;   // ← doble marca
```

Marcar dos veces intersecta `{[nominal]:"Sha256Hex"} & {[nominal]:"HuellaNodo"}` sobre la **misma clave símbolo**, y `"Sha256Hex" & "HuellaNodo"` reduce a `never`. Verificado uno por uno: `HashBytes`, `HuellaNodo`, `HuellaFragmento`, `HuellaContextual`, `ClaveEmbedding`, `HashMateria`, `ClaveDeCache` son **siete `never`**; `Sha256Hex` (marca simple) sobrevive, y el control `ElementId` vs `LocalId` **sí** rechaza correctamente (TS2322).

Como `never` es asignable a todo, esto compila sin un solo `as`:

```ts
const h = comoHuellaNodo(comoSha256Hex("abc"));
export const n: number   = h;   // ✅ compila
export const b: boolean  = h;   // ✅ compila
export const e: ElementId = h;  // ✅ compila
```

No es solo que las siete huellas sean intercambiables: **una huella es asignable a un número**. Es exactamente el escenario que el docstring de `identidad.ts:175-178` dice estar impidiendo («nada impide pasar una huella de nodo donde va una clave de caché de embeddings… es la confusión que el documento ya pagó una vez, hallazgo 10»). Alcanza a `NodoCrudo.hash`, `Fragmento.huellaTexto`, `Fragmento.huellaContextual` y `Contexto.ancestros`.
**Arreglo:** aplanar la marca — `type HuellaNodo = Nominal<string, "HuellaNodo">`. Tres líneas por tipo, cero cambios en los consumidores.

**2 · El detector de no-anidamiento tiene cuatro agujeros de unión.** `invariantes.ts:34-56`

Lo bueno primero, porque es real: el caso directo (`hijos: readonly Nodo[]`) y el transitivo (a través de dos niveles de arreglo) **sí disparan**, las dos pruebas negativas funcionan, y el análisis de por qué `T extends true ? never : true` no sirve como prueba negativa (`invariantes.ts:69-80`) es correcto y no obvio.

Lo que probé y **no detecta** — las cuatro dan «payload limpio»:

| Payload | ¿Detectado? |
|---|---|
| `hijos: readonly Nodo[]` (prueba existente) | ✅ |
| `hijos?: readonly Nodo[]` — **opcional** | ❌ |
| `hijos: readonly Nodo[] \| null` — **nullable** | ❌ |
| `hijos: readonly (Nodo \| null)[]` | ❌ |
| `x: Nodo \| string` | ❌ |
| 8 saltos de propiedad / 6 niveles de arreglo | ❌ (5 arreglos y 7 saltos sí) |

Causa raíz: cuando el tipo del campo es una **unión**, la rama `T extends readonly (infer E)[]` distribuye y `ContieneNodo` devuelve `boolean` en vez de `true`; después `ClavesConNodo` (`:55`) hace `ContieneNodo<U[K]> extends true ? K : never`, y **`boolean extends true` es falso**. La clave no se marca.
Agravante de profundidad: agotar el combustible devuelve `false`, o sea **«limpio»** — el modo de falla apunta al lado peligroso.
**Arreglo:** `[Extract<T, EsNodo>] extends [never] ? … : true` para que la marca se chequee antes de distribuir, agotar el combustible en `true`, subir `Combustible` a 12, y agregar los cuatro casos a `PRUEBAS_DE_NO_ANIDAMIENTO`. El comentario de `:28-30` («seis niveles… con margen») hay que corregirlo: `Cuerpo` ya consume 4 de 6.

**3 · Dos de los tres "invariantes de build" del README no verifican nada.** `README.md:76-83`

- `_FormaEsCuerpoForma` (`formas.ts:285-288`) es un **alias sin restricción**. Un alias que evalúa a `never` compila. Repliqué el patrón con conjuntos desalineados a propósito → **build verde**. La propiedad *sí* se sostiene, pero **por accidente**, vía `TIPO_POR_FORMA: Record<Forma,Tipo>` (`clasificacion.ts:330`) y los dos `switch` exhaustivos de `proyeccion.ts:208,402`; ningún mensaje de error menciona a `Forma`. El día que alguien meta un `default:` en esos switch o afloje la tabla a `Partial<>`, la protección desaparece en silencio.
- `PISO_FISICO_ES_COHERENTE` (`clasificacion.ts:418`) es un `boolean` de runtime que **nadie assertea**. Si diera `false` el build sigue verde. Y verifica el piso equivocado: comprueba `TIPO_POR_FORMA`, pero el paquete declara que el piso físico es `tipoDesdeCuerpo()` (`:340-355`), cuyo caso nuevo (`container` ordenado → `lista_ordenada`) la propiedad no toca.
- `INVARIANTE_CODIGO_SOLO` (`:319`) es tautológica: `cohesiónDe('codigo', f)` resuelve por `FORMAS_SOLO` antes de mirar la forma, así que devuelve `true` para las seis y el parámetro no se usa.

**Arreglo:** `type _OK = Verdadero<_FormaEsCuerpoForma>` — el patrón ya existe en `invariantes.ts:67` y `formas.ts` no lo copió — y `PISO_FISICO_ES_COHERENTE: true` en la anotación. Dos líneas. Y corregir el README, que hoy acredita tres invariantes de los cuales uno no verifica y otro no es de build.

### Serios — decisiones escritas en el tipo que la proyección deshace

**4 · La distinción `null` ≠ `[]` de C3 se borra en la huella.** `proyeccion.ts:234,253`

`formas.ts:238-250` dedica diez líneas a argumentar que las dos cosas no pueden colapsar *porque `encabezados` entra en la huella*. `proyectar` hace `(cuerpo.encabezados ?? [])`. Ejecutado:

```
encabezados:null, 1 fila 'x'  → "5:forma4:grid5:celda1:x"
encabezados:[]  , 1 fila 'x'  → "5:forma4:grid5:celda1:x"   ← IDÉNTICA
esNodoFila(null)=true         esNodoFila([])=false
```

Un **nodo-fila** y una **región sin encabezado** hashean igual, y por la regla de unicidad del pase 1 **ninguno ancla**. Idéntico para `container` (`esquema: null` vs `[]` → misma huella y similitud 1), que anula justo el campo que C3 agregó para arreglar C14.
Y en `renderizar` el mismo `??` hace daño distinto: `encabezados: []` **tapa** el `esquemaDelContainer`. Verificado: con esquema `["A","B"]`, `null` renderiza `"A\tB\nx\ty"` y `[]` renderiza `"\nx\ty"` — primera línea vacía, que es el mecanismo que `:396-397` dice que hace posible renderizar una fila sola.

**5 · La huella de `grid` no lleva estructura de filas.** `proyeccion.ts:237-239` aplana con `flatMap` sin token de frontera. Verificado, tres cuerpos distintos, **una sola preimagen**:

```
2×2 [[a,b],[c,d]]     → 5:forma4:grid5:celda1:a5:celda1:b5:celda1:c5:celda1:d
1×4 [[a,b,c,d]]       → idéntica
4×1 [[a],[b],[c],[d]] → idéntica
```

Transponer o re-segmentar una tabla **conserva la identidad**. La huella se documenta como «INYECTIVA» (`proyeccion.ts:18`) y no lo es para `grid`. Ojo: agregar el token de fila arregla esto pero mueve la medición «renombrar una columna toca UN nodo» — **es una decisión de identidad, y hoy está tomada por omisión.**

**6 · `renderizar` colisiona y no normaliza.** `proyeccion.ts:399-421`. Verificado:

```
grid [["a\tb","c"]]  → "a\tb\tc"   ┐ mismo Fragmento.texto
grid [["a","b\tc"]]  → "a\tb\tc"   ┘ (huellas de nodo distintas)
grid [["hola\r\nmundo"]] → render "hola\r\nmundo"  ·  huella "…hola\nmundo"
text_span "hola\r\nmundo" → render "hola\nmundo"
```

Cadena de consecuencias, toda dentro de tipos que el paquete declara: `Fragmento.texto` → `huellaTexto` → `FragmentoId` → `huellaContextual` → `ClaveEmbedding`. Dos grillas distintas comparten **entrada del caché de embeddings** y **id de deduplicación del tramo 7**. Y como `grid`/`fields` no pasan por `normalizar` mientras `text_span`/`verbatim` sí, guardar el mismo XLSX con otro editor **no** mueve el `ElementId` (bien) pero **sí** mueve `huellaTexto` e invalida todos los vectores cacheados — lo contrario de lo que promete L1500.
**Arreglo:** `renderizar` aplica `normalizar` y escapa el separador (o emite con comillas tipo CSV). ~10 líneas.

**7 · `z` entra en la huella del asset, contra la afirmación del propio archivo.** `proyeccion.ts:281` incluye `String(v.caja.z)` en `codificarVentana`, que es el token `"ventana"` de todo `asset` y la base de `HashMateria`. `ubicacion.ts:38,52-53` dice dos veces: *«Es dato INERTE: nada lo lee, nada ordena por él»*. Verificado: `z:null` y `z:3` dan preimágenes distintas. En un `.pptx`, **reordenar dos formas superpuestas sin tocar su contenido mueve el `ElementId`** y despega su curación — el peor modo de falla del pipeline disparado por una operación que el plan declara semánticamente vacía. `compararCajas` (`ubicacion.ts:219`) sí lo ignora: dos tratamientos opuestos del mismo campo.

**8 · `Evidencia = number` reabre la escala que el plan cierra.** `adaptador.ts:89`. `ESCALA_EVIDENCIA` se construye como tupla cerrada y el tipo la tira: `const e: Evidencia = 3.5` compila, un `Evidenciador` puede devolver `-999`. El plan dedica una sección a esto (L384, L397-399, L470: *«cinco clases con nombre, cero números mágicos»*). El docstring justifica el `number` con «el selector hace aritmética», pero `-1|0|1|2|3|4` también resta y compara. Es el único conjunto que el plan cierra explícitamente y que el paquete dejó abierto — `Cohesión`, `Tipo`, `Forma`, `Marca`, `ClaseDeGasto` están todos cerrados. **Sin marcar.**

### Menores, todos verificados

| # | Sitio | Qué |
|---|---|---|
| a | `proyeccion.ts:343-345` | El docstring dice que `asset` y `container` «degeneran a 0/1». Falso para `asset`: dos ventanas de la **misma página** dan `similitud = 0.333`, justo el par que H6 diseñó para que no se confundiera |
| b | `proyeccion.ts:316` | `text_span` vacío y solo-espacios son **el mismo nodo** (`huella("")===huella("   ")`, `similitud=1`) → ninguno ancla, todos caen al pase 2 indistinguibles. Y `n = min(2, tokens.length)` se calcula por operando: `similitud("", "hola mundo") = 0` por aridad de n-gramas, no por contenido |
| c | `identidad.ts:192-244` | Cuatro de las cinco preimágenes quedaron en prosa: `ClaveDeCache`, `ClaveEmbedding`, `HashMateria`, `HuellaContextual`. `concatenar` existe y no se usa para ninguna. Dos citan campos que **ningún tipo declara** (`versiónDelModelo`, `versiónEmbedder`); `HashBytes` no aparece en ninguna firma; y `ctx.invocar(clave: string)` (`adaptador.ts:361`) tira el marcado nominal en la llamada que importa |
| d | `proyeccion.ts:387` | Recomienda emitir `vectores: 0` sobre un campo que `Fragmento` **no tiene** (`grep vectores src/` → solo comentarios) |
| e | `salidas.ts:291` | `certezaMínima` = «la PEOR certeza», pero el paquete no exporta orden sobre `Certeza` y `CERTEZAS[0]` es `declarado`, la **mejor**. `rango()` existe solo para `NivelDeReconocimiento` |
| f | `clasificacion.ts:312` | `admiteSatelite` es **constante `true`** en su dominio alcanzable: devuelve `false` solo para `lead`, y un `lead` nunca es la cohesión de un fragmento vivo. La pregunta que C16 discute — ¿un `normal` se pega a un fragmento abierto por un `solo`? — no tiene predicado. Falta `admiteVecino(vivo, entrante)` |
| g | `adaptador.ts:99-103` | `porOrigen` se menciona dos veces y no se escribe; la llamada literal del plan `porOrigen('chat', Evidencia.Firma)` (L997) **ya no tipa** contra el `Origen` nuevo y nada la reemplaza |
| h | `params.ts:242` | `tamañoDeNGrama: 2` viola la regla de gobierno del propio archivo: su docstring dice que decide «si una planilla pierde 500 identidades o ninguna» y que «se mide» junto a `umbralDeSimilitud`, que quedó en `null`. Único parámetro que dice a la vez «decide identidades», «se mide» y trae valor |
| i | `params.ts:150,166,202` | Sin consumidor en el paquete: `unidadesPorMarco: 1000` (describe un invariante que `Caja: number` no lleva), `umbralDeSimilitud`, y `corridasMáximasPorDocumento` — que además no tiene campo en `Presupuesto`, cuyo docstring dice «las cinco dimensiones… ver `PARAMETROS.presupuesto`», donde hay **seis** |
| j | `adaptador.ts:255,279,506` | Tres desviaciones **sin marca**: `degradado(de: NivelLogrado, …)` estrecha la firma literal de L934 y deja de poder registrar «la página 3 salió sin capa de texto»; `Presupuesto` pasa sus topes a `number \| null` (todos en `null` = zip bomb sin tope); `Adaptador.nivel` es **por adaptador** cuando la escalera del plan es por nodo (L917) — con lo cual C18 tampoco cierra para el PDF de 198+2 páginas |
| k | `salidas.ts:114` · `adaptador.ts:457` | `confianza` existe en el nodo pero no tiene productor por unidad: `Clase` no la lleva y `Eslabón.confianza` es **una constante por eslabón**. Un modelo 0.95-seguro de un título y 0.40 de otro no tiene por dónde decirlo |
| l | `proyeccion.ts:436` · `salidas.ts:231` · `adaptador.ts:408` | `claveDeCampo` colisiona consigo misma y no registra lo que devuelve; `adaptadorAnterior: string` donde existe `AdaptadorId`; `autoríaPropia?: {actor: string; cuándo: string}` con `string` crudo donde existen `ActorId` e `Instante` — único sitio del paquete que ignora sus propias marcas |
| m | `salidas.ts:41` + `index.ts:157` | `MARCA_NODAL` se exporta por el barrel, así que `{...crudo, [MARCA_NODAL]: true}` construye un `Nodo` sin `comoNodo`; el docstring promete que son «dos sitios en todo el sistema» y el tipo no lo sostiene |
| n | `formas.ts:72-111` | `Marca` y `Celda.tipo` no los lee ninguna función del paquete y no entran en la huella; `enlace.destino` no llega a ningún texto ni salida. Legítimo para un contrato, pero conviene decirlo |

### Lo que los ataques buscaron y NO está mal

Lo verifiqué también, porque un informe que solo lista defectos miente por omisión:

- **El bug de `verbatim` está realmente arreglado.** `huella(vb("a    b")) ≠ huella(vb("a b"))`, y reindentar mueve el id. Es el hallazgo 10 reproducido en otra forma, y lo encontró una prueba de humo del autor, no el razonamiento.
- **`concatenar` con longitud prefijada** es inyectivo por construcción y resuelve el `‖` indefinido de tres sitios con una función.
- **La proyección única** da `huella(a)=huella(b) ⟹ similitud=1` por construcción — el plan nunca lo enunció y el reconciliador lo necesita.
- **C1 resuelto de una sola vez**: una definición de `cohesiónDe`, `PARES_TIPO_FORMA.length === 90` y `PARES_ILEGALES.length === 25` **derivados y no escritos a mano**.
- **`ventanaCubre` en vez de un umbral** para el punto fijo: elimina el «cubre casi todo» de H3 en vez de inventarle un número. La mejor decisión del paquete.
- **`Pista | null ≠ {via:'ninguna'}`**, `LocalId`, el criterio operativo Firma/Estructura/Extensión/Contenido, `Coordenada` como unión discriminada: los cuatro llenan huecos que el plan dejaba a criterio de cada autor.
- **Higiene**: cero `any`, dos `unknown` justificados, cero `@ts-ignore`, 19 `as` (18 son los constructores nominales), cero literales numéricos fuera de `params.ts`, `index.ts` sin huérfanos ni exports fantasma, imports acíclicos, ninguna definición duplicada.
- **Las marcas `PROVISIONAL(` son honestas y contra-argumentadas**: todas dicen qué se rompe si se decide al revés, y varias reportan costos **contra el propio autor** (`formas.ts:276-279` admite que su decisión convierte «anclaje 1.00 · 502 anclas» en «501 anclas + 1 container movido»; `identidad.ts:200-206` admite que el reuso entre documentos queda por debajo del anunciado). Eso es exactamente el entregable que se pedía.

---

## Orden sugerido de arreglo

Antes de que `adaptadores` o `emision` importen el paquete:

| | Qué | Dónde | Costo |
|---|---|---|---|
| 1 | Aplanar `Nominal` en la familia de hashes | `identidad.ts:165-244` | 7 líneas |
| 2 | `[Extract<T, EsNodo>] extends [never]`, combustible a 12, agotamiento en `true`, 4 pruebas negativas nuevas | `invariantes.ts:34-56` | ~15 líneas |
| 3 | `Verdadero<_FormaEsCuerpoForma>` y `PISO_FISICO_ES_COHERENTE: true`; corregir `README.md:76-83` | `formas.ts:288`, `clasificacion.ts:418` | 2 líneas |
| 4 | `type Evidencia = -1\|0\|1\|2\|3\|4` | `adaptador.ts:89` | 1 línea |
| 5 | `renderizar` normaliza y escapa | `proyeccion.ts:399-421` | ~10 líneas |
| 6 | Sacar `z` de `codificarVentana`, **o** retirar la afirmación «dato inerte» | `proyeccion.ts:281` | 1 línea + **decisión** |
| 7 | Token discriminante `null` vs `[]` y token de frontera de fila en `grid` | `proyeccion.ts:231-253` | ~5 líneas + **decisión de identidad** |
| 8 | `admiteVecino(vivo, entrante)`; orden sobre `Certeza`; escribir las 4 preimágenes con `concatenar` | `clasificacion.ts`, `identidad.ts` | ~30 líneas |
| 9 | Marcar o revertir las tres desviaciones sin marca (`degradado`, `Presupuesto`, `Adaptador.nivel`); marcar H8 y H10 como huecos | `adaptador.ts:255,279,506` | comentarios |

Las de la banda 6-7 no las decide el plan: cada una fija una tasa de anclaje distinta sobre el mismo corpus, que es la clase de detalle que ya cambió la conclusión del banco una vez.