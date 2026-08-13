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
`invariantes.ts` fija la cantidad de roles, no cuenta: no puede decidir
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
| A `SHAPES` no le falta ninguna forma | aserción en `invariantes.ts` — **irreducible**, un tipo no se enumera en runtime | error nombrando la forma faltante |
| El piso físico nunca da un par `rol⇒forma` ilegal | la **anotación** de `ROLE_BY_SHAPE` | error en la línea de la tabla |
| «Código siempre atómico» (§{Invariantes}) | la **anotación** de `COHESION_BY_ROLE` | error en la línea de la tabla |
| …y esa anotación sigue siendo un **literal**, no `Cohesion` | `PRUEBAS_DE_COHESIÓN` en `invariantes.ts` | error — sin esto, ensanchar el campo y poner `"normal"` apaga la fila de arriba en verde |
| El `satisfies` de `REQUIRED_SHAPE` sigue atando las claves a `Role` | `PRUEBAS_DE_PAREJA` en `invariantes.ts` | error — sin esto, sacarlo lleva `ILLEGAL_PAIRS` de 25 pares a 0 sin un solo aviso |
| El barrido del banco recorre 15 × 6 (§{Estrategia}) | `PRUEBAS_DE_DOMINIO` en `invariantes.ts` — fija las dos cifras a nivel de tipo | error — quitar un rol obliga a actualizar plan y barrido en el mismo commit |
| Ningún payload anida un nodo (§{Tramo 3 › Qué sale}) | el **grafo de módulos**: `shapes.ts` no alcanza `salidas.ts` (`scripts/fronteras.mjs`) | `pnpm lint` falla y muestra el camino |
| Las marcas nominales separan | `PRUEBAS_DE_MARCA` en `invariantes.ts` — **irreducible**, es una propiedad de tipos | error nombrando las dos marcas que se confunden |
| La salida del adaptador no lleva `id` | `PRUEBAS_DE_ACUÑADO` en `invariantes.ts` | error — y el acuñado al azar deja de estar justificado |
| **Cuerpos distintos ⟹ huellas distintas** | `scripts/proyeccion.mjs` — es de **comportamiento**, ningún tipo la expresa | `pnpm lint` falla nombrando los cuerpos que colisionan |
| Toda cita al plan apunta a una sección que existe | `scripts/citas.mjs` — el plan es un borrador vivo y las citas por número se corren solas, en silencio | `pnpm lint` falla nombrando la cita y la sección que no aparece |
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
opcional, de una unión con `null`, de `(Nodo | null)[]`, de `Nodo | string`, ni más
allá de seis niveles — donde además respondía «limpio».

Por eso ninguna entrada de esta tabla se acredita por lectura: **cada una se verificó
rompiéndola a propósito** y comprobando que el build cae. La suite de mutantes está
en el informe de la revisión.

### Por qué el anidamiento se impone con el grafo y no con tipos

Lo que vuelve `Nodo` a un `Nodo` es `MARCA_NODAL`, que vive solo en `salidas.ts`. Si
`shapes.ts` no lo alcanza, un nodo dentro de un `Body` es **inexpresable** — no hay
nada que detectar. Y la dependencia natural ya va al revés (`salidas.ts` importa
`shapes.ts`), así que violar la frontera exige introducir un ciclo.

Es la técnica que la regla **R1** ya usa para la frontera de formato («la impone el
grafo de paquetes»), aplicada a la frontera de nodos. Reemplaza ~50 líneas de tipos
recursivos con contador de profundidad. El costo, dicho de frente: **`tsc` solo no
alcanza** — hace falta `pnpm lint`, que corre las dos cosas.

## Una sola proyección

`proyectar(cuerpo)` es la única tokenización del sistema. De ella salen **la
huella** (`preimagenDeHuella` → `huellaDe`) y **la similitud** de los pases 2 y 3
del reconciliador. Eso da por construcción el invariante que el reconciliador
necesita y que el plan nunca enuncia:

```
huella(a) === huella(b)  ⟹  similitud(a, b) === 1
```

El renderizado a texto (`renderizar`, para `Fragmento.texto` y el embedding) es una
función **aparte** a propósito: la huella persigue ser inyectiva y estable, el texto
que se embebe persigue ser legible. Separarlas es lo que deja al renderizado
evolucionar sin mover un solo id.

---

## Verificación

```bash
pnpm --filter @savia-os/ir lint
```

Son **cinco** comandos encadenados —`tsc --noEmit`, `fronteras`, `proyeccion`,
`citas`, `numbers`— y hacen falta los cinco: `typecheck` solo cubre la mitad de la
tabla de arriba, y las cuatro filas que impone un `.mjs` quedarían en verde sin
haberse mirado.
