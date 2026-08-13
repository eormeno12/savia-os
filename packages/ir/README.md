# `@savia-os/ir`

**El contrato del pipeline de ingesta documental.** Las seis formas, `Tipo`,
`Pista`, la proyección canónica de la que salen la huella y la similitud, y el
contrato de adaptador.

CERO dependencias de runtime. Es el paso 1 del orden de construcción del plan
([`docs/product/savia-b2b/borrador-pipeline-tecnico.md`](../../docs/product/savia-b2b/borrador-pipeline-tecnico.md),
§{Orden}): *«`ir` se congela y se versiona primero: todo depende de él, él no depende
de nada»* (§{Paquetes}).

```
             ir
            ╱  ╲
  adaptadores    emision       ← estas dos NUNCA se ven entre sí
            ╲  ╱
           ingesta
```

`adaptadores` y `emision` no se conocen, y esa es la regla R1 hecha grafo. Lo único
que las une es `ir`.

---

## La regla

**Nada de lo que se define acá se re-declara afuera.**

Si un tipo de este paquete hace falta en otro lado, se **importa**. No se copia, no
se redefine "por comodidad", no se re-tipa con la misma forma. El problema que este
paquete existe para curar es exactamente ese: los dieciséis tipos del plan vivían
dentro de fragmentos ilustrativos dispersos en la prosa, y el documento terminó
contradiciéndose consigo mismo — `cohesiónDe` estaba definida dos veces, con
codominios distintos, a 370 líneas de distancia.

Si hace falta un tipo nuevo, se agrega **acá**, y eso es un cambio de contrato,
visible como tal en el diff (§{Cómo se agrega}). Si lo que se quiere expresar es una
*conclusión* sobre un documento y no un *hecho de lectura*, la respuesta no es un
tipo nuevo: es una anotación (R3).

---

## Cómo leer las decisiones forzadas

El plan se contradice o calla en muchos puntos, y esta pasada eligió la opción
provisional más defendible en cada uno en vez de inventar en silencio. Todas están
marcadas con el mismo formato y son grepeables:

```bash
grep -rn "PROVISIONAL(" src/
```

Cada marca dice **qué se eligió**, **por qué** y **qué cambia si se decide al
revés**, con la cita de sección del borrador o el identificador de la auditoría
(`C1`…`C25`, `H1`…`H16`, o el número del hueco).

---

## Los números

Todos los valores numéricos del paquete viven en **un solo objeto**, `PARAMETERS`
(`src/params.ts`). Ningún otro archivo tiene un literal numérico **en posición de
valor** — lo verifica `scripts/numbers.mjs` sobre el AST, no es una promesa de
estilo. (Un literal en posición de *tipo*, como el `15` con el que
`invariants.ts` fija la cantidad de roles, no cuenta: no puede decidir
comportamiento en runtime, que es lo que esta regla gobierna.)

Cada parámetro lleva su unidad, qué decide y cómo se mediría el definitivo. Los que
están en `null` son los que el plan declara *load-bearing* y no fija: no se pueden
inventar sin invalidar las cifras que el banco de pruebas reporta, y el tipo
`Pending<T>` obliga a que alguien los provea. Cuántos son y cuántos siguen en `null`
lo publica el docstring de `params.ts` en una línea `CENSO(numbers.mjs)` que el
guardián **deriva del AST y contrasta**: una cifra de cobertura sostenida a mano ya
llegó una vez a certificar el árbol roto y rechazar el sano.

> *«Un número inventado con precisión falsa es peor que uno declarado como
> pendiente.»* — §{5 · Reconciliador}

---

## Los invariantes, y quién los impone

La regla es **hacer la violación irrepresentable, no detectable**: restringir el dato
donde se escribe, en vez de revisarlo después. Una aserción es el último recurso,
porque una aserción rota y una que funciona compilan igual.

| Invariante | Quién lo impone | Qué pasa al violarlo |
|---|---|---|
| `Shape` ≡ `Body['shape']` | `Shape` se **deriva** de `Body`; `SHAPES` lleva `satisfies` | no hay dos conjuntos que puedan discrepar; un nombre de más falla en el arreglo |
| A `SHAPES` no le falta ninguna forma | aserción en `invariants.ts` — **irreducible**, un tipo no se enumera en runtime | error nombrando la forma faltante |
| El piso físico nunca da un par `rol⇒forma` ilegal | la **anotación** de `ROLE_BY_SHAPE` | error en la línea de la tabla |
| «Código siempre atómico» (§{Invariantes}) | la **anotación** de `COHESION_BY_ROLE` | error en la línea de la tabla |
| …y esa anotación sigue siendo un **literal**, no `Cohesion` | `COHESION_PROOFS` en `invariants.ts` | error — sin esto, ensanchar el campo y poner `"normal"` apaga la fila de arriba en verde |
| El `satisfies` de `REQUIRED_SHAPE` sigue atando las claves a `Role` | `PAIR_PROOFS` en `invariants.ts` | error — sin esto, sacarlo lleva `ILLEGAL_PAIRS` de 25 pares a 0 sin un solo aviso |
| El barrido del banco recorre 15 × 6 (§{Estrategia}) | `DOMAIN_PROOFS` en `invariants.ts` — fija las dos cifras a nivel de tipo | error — quitar un rol obliga a actualizar plan y barrido en el mismo commit |
| Ningún payload anida un nodo (§{Tramo 3 › Qué sale}) | el **grafo de módulos**: `shapes.ts` no alcanza `outputs.ts` (`scripts/boundaries.mjs`) | `pnpm lint` falla y muestra el camino |
| Las marcas nominales separan | `BRAND_PROOFS` en `invariants.ts` — **irreducible**, es una propiedad de tipos | error nombrando las dos marcas que se confunden |
| La salida del adaptador no lleva `id` | `MINTING_PROOFS` en `invariants.ts` | error — y el acuñado al azar deja de estar justificado |
| `SourceRange` no colapsa, el vocabulario de `Coordinate['space']` es cerrado, `Location.within` es recursiva y `Box.frame` es obligatorio | `COORDINATE_PROOFS` en `invariants.ts` | error — un `Extract` que deja de matchear da `never`, no un error, y `never` es asignable a todo |
| `boxContains` exige el mismo marco · `compareBoxes` ordena por área ascendente, es antisimétrico y **no** es total | `scripts/geometry.mjs` — son de **comportamiento** | `pnpm lint` falla nombrando el caso y qué se pierde |
| **Cuerpos distintos ⟹ huellas distintas** | `scripts/projection.mjs` — es de **comportamiento**, ningún tipo la expresa | `pnpm lint` falla nombrando los cuerpos que colisionan |
| **El vocabulario de `TokenKind` no se mueve en silencio** | `scripts/projection.mjs` — la tabla de **preimágenes canónicas**, una por forma | `pnpm lint` falla mostrando la preimagen esperada y la obtenida |
| Los cuatro campos del envoltorio siguen marcados (versión, original, organización, actor) | `WRAPPER_PROOFS` en `invariants.ts` | error — sin esto, cambiar una marca por otra de la misma familia compila y direcciona lo que no es |
| `Certainty` tiene un orden, y va en el sentido de la escalera | `CERTAINTY_PROOFS` en `invariants.ts` — fija las dos cifras a nivel de tipo | error — invertirla marca como `declared` lo que el pipeline adivinó |
| `Context.ancestors` sigue siendo una cadena de `MatterHash` | `RECURSION_PROOFS` en `invariants.ts` | error — es lo único que corta la recursión de la delegación; cambiarle la marca deja la guarda de ciclo comparando hashes de otra familia, en verde |
| El orden de `EVIDENCE_SCALE` es el del plan | `EVIDENCE_PROOFS` en `invariants.ts` — una tupla de strings, sin un solo número | error — los seis valores de `Evidence` se derivan de ese orden: mover una fila cambia quién gana cada archivo entre los doce adaptadores, sin un aviso |
| Toda cita al plan apunta a una sección que existe | `scripts/citations.mjs` — el plan es un borrador vivo y las citas por número se corren solas, en silencio | `pnpm lint` falla nombrando la cita y la sección que no aparece |
| Ningún número suelto fuera de `params.ts`, y la cifra publicada es la real | `scripts/numbers.mjs` — scanner de AST, no regex | `pnpm lint` falla nombrando archivo, línea y literal, o la discrepancia entre el censo y el AST |

### La huella es de comportamiento, no de tipos

`proyectar` es la única tokenización del sistema: de ella salen la **huella** (identidad
de un nodo) y la **similitud** (pases 2 y 3 del reconciliador). Su propiedad central no
se puede escribir como tipo, y romperla **no se ve**: dos nodos distintos con la misma
huella no fallan — por la regla de unicidad del pase 1 ninguno ancla, los dos reciben
ids nuevos, y la curación del cliente se despega en silencio.

Los seis casos del guardián no son hipotéticos. Cinco **fallaban**: `null` y `[]`
colapsaban en la huella de `grid` y de `container` (`?? []` codificaba los dos estados
como *nada*), y la huella de `grid` no llevaba estructura de filas — `[[a,b],[c,d]]`,
`[[a,b,c,d]]` y `[[a],[b],[c],[d]]` daban **una sola preimagen**.

El principio que salió de ahí, aplicable a cualquier codificación futura:

> **La ausencia no puede ser la codificación de nada.** Si dos estados distintos
> codifican a *lo mismo que no codificar*, colisionan. Cada estado emite algo.

Las tres primeras versiones de esta lista **no verificaban nada** y decían que sí. La
familia de hashes era `never` (asignable a todo), el chequeo de `Shape` era un alias
sin restricción, y el detector de anidamiento no veía el nodo a través de un campo
opcional, de una unión con `null`, de `(Node | null)[]`, de `Node | string`, ni más
allá de seis niveles — donde además respondía «limpio».

Por eso ninguna entrada de esta tabla se acredita por lectura: **cada una se verificó
rompiéndola a propósito** y comprobando que el build cae. La suite de mutantes está
en el informe de la revisión.

### Por qué el anidamiento se impone con el grafo y no con tipos

Lo que vuelve `Node` a un `Node` es `NODE_BRAND`, que vive solo en `outputs.ts`. Si
`shapes.ts` no lo alcanza, un nodo dentro de un `Body` es **inexpresable** — no hay
nada que detectar. Y la dependencia natural ya va al revés (`outputs.ts` importa
`shapes.ts`), así que violar la frontera exige introducir un ciclo.

Es la técnica que la regla **R1** ya usa para la frontera de formato («la impone el
grafo de paquetes»), aplicada a la frontera de nodos. Reemplaza ~50 líneas de tipos
recursivos con contador de profundidad. El costo, dicho de frente: **`tsc` solo no
alcanza** — hace falta `pnpm lint`, que corre las dos cosas.

## Una sola proyección

`project(body)` es la única tokenización del sistema. De ella salen **la
huella** (`preimageOfFingerprint` → `fingerprintOf`) y **la similitud** de los pases
2 y 3 del reconciliador. Eso da por construcción el invariante que el reconciliador
necesita y que el plan nunca enuncia:

```
huella(a) === huella(b)  ⟹  similitud(a, b) === 1
```

El renderizado a texto (`render`, para `Fragment.text` y el embedding) es una
función **aparte** a propósito: la huella persigue ser inyectiva y estable, el texto
que se embebe persigue ser legible. Separarlas es lo que deja al renderizado
evolucionar sin mover un solo id.

Y hay una tercera cosa que la huella necesita y que no se ve leyendo el código: **el
vocabulario de clases de token entra en la preimagen**. `encode` serializa
`[kind, text]`, así que renombrar `"word"` reescribe el `ContentHash` de todo el
corpus. Los casos de discriminación no lo agarran —comparan cuerpos entre sí y son
ciegos a lo que los mueve a todos—, y por eso `projection.mjs` fija una **preimagen
canónica por forma**, las seis. Cambiar el vocabulario es legítimo; hacerlo sin que
se vea, no.

---

## Verificación

```bash
pnpm --filter @savia-os/ir lint
```

Son **siete** comandos encadenados —`tsc --noEmit`, `boundaries`, `projection`,
`geometry`, `citations`, `numbers` y `mutants`— y hacen falta los siete: `typecheck`
solo cubre la mitad de la tabla de arriba, y las filas que impone un `.mjs` quedarían
en verde sin haberse mirado.

El séptimo es el que acredita a los otros seis. `mutants.mjs` rompe cada garantía a
propósito y falla si alguna **deja de romperse**: sin él, una fila de esta tabla que
dejó de verificar nada es indistinguible de una que funciona. Hoy son **41 garantías
y 8 controles**; los controles existen porque una suite donde todo falla es
indistinguible de una donde el compilador está roto.

> El README decía «cinco» y `package.json` encadenaba siete desde el bloque 2:
> faltaban `geometry` y `mutantes`. Corregido en el bloque 3. Los nombres de tres de
> los siete cambiaron en el bloque 4 (`fronteras → boundaries`, `citas → citations`,
> `mutantes → mutants`): el paquete quedó entero en inglés, guardianes incluidos.
