# 02 — Glosario y modelo de entidades

> El vocabulario canónico de Savia B2B. Cada término se usa en el resto de la
> carpeta con exactamente el significado que se fija acá. Si un documento
> necesita un término nuevo, se agrega aquí antes de usarlo.

## Mapa de entidades

```
Organization ──< Membership >── User ──< Space (árbol de clústeres)
     │                           │
     │                           └──< Connection ──> Connector
     └──< Team                   │
                                 └──< Memoria
                    Skill  ← sintetizado a partir de la memoria de varios User
```

Toda memoria y toda conexión cuelgan de un `User`. La `Organization` participa
de ese mismo modelo a través de su usuario raíz, en lugar de introducir un
segundo tipo de dueño.

## Personas y organización

**`User`** — una identidad dentro de Savia: dueña de memoria, de sus clústeres
y de sus conexiones. Casi siempre es una persona, pero no necesariamente: el
usuario raíz de una organización es también un `User` (ver abajo). Es la
frontera de propiedad fundamental del sistema — todo lo que se guarda tiene un
`User` dueño, sin excepción.

**`Organization`** — la empresa. La unidad de negocio de más alto nivel:
agrupa personas, memoria compartida, facturación y gobernanza. Una persona
puede pertenecer a **más de una** `Organization` a la vez, como en Slack o
Notion — eso cubre el caso de freelancers y consultores que trabajan con
varios clientes.

Al crearse, toda `Organization` obtiene un **usuario raíz**: un `User` creado
automáticamente junto con ella, que es la identidad dueña de la memoria y las
conexiones de nivel organización. No representa a una persona; es la forma en
que la organización participa del mismo modelo que cualquier otro usuario
—dueña de `Space`, sujeta a las mismas reglas de acceso— sin necesitar una
entidad ni un mecanismo aparte.

Esto resuelve un problema concreto: una conexión de organización (Slack,
Drive) la tiene que autorizar un administrador humano, porque OAuth se lo pide
a una persona. Pero la conexión resultante, y toda la memoria que produce,
quedan a nombre del usuario raíz — **no** del administrador. Si esa persona se
va de la empresa, el conocimiento de la empresa se queda.

**`Membership`** — la relación entre una persona y una `Organization` a la que
pertenece, junto con el rol que tiene en ella. Es lo que permite que alguien
esté en varias organizaciones sin que se mezclen entre sí, con un rol distinto
en cada una.

**Todo `User` tiene al menos una `Membership`**: no existe el usuario sin
organización. Quien se registra sin unirse a una organización existente crea
la suya, aunque sea de una sola persona (ver
[03](03-personas-y-roles.md)).

**`Team`** — un subgrupo de personas dentro de una `Organization`, por ejemplo
"Equipo de Ventas". Es el único mecanismo de agrupación de personas por debajo
de la organización: cuando un grupo comparte memoria de forma organizada, eso
**es** un `Team`, no un concepto distinto.

Un `Team` no es dueño de memoria. Lo que comparte es una vista gobernada sobre
la memoria de sus integrantes y de la organización — el dueño de cada pieza
sigue siendo el `User` que la originó.

## Memoria y síntesis

**`Memoria`** — la unidad atómica de conocimiento: un hecho, extraído de
cualquier modalidad y por cualquier canal, que conserva su **procedencia** (de
dónde salió, cuándo, por qué vía) y su **coordenada** en la fuente original.
Toda memoria pertenece a un `User`.

**`Space`** — un clúster de memoria: un conjunto de memorias semánticamente
relacionadas, producido y mantenido automáticamente por el motor de
clustering. Los `Space` forman un árbol: los nodos hoja son clústeres reales,
donde viven las memorias, y los nodos internos agrupan otros `Space` —
estructura, no contenido.

Un `Space` siempre pertenece a un `User`. La "memoria de la organización" es,
sencillamente, aquella cuyo dueño es el usuario raíz de esa `Organization`: el
mismo mecanismo de siempre, sin un segundo tipo de dueño ni cambios en el
motor.

**`Skill`** — la unidad de síntesis: un proceso canónico y ejecutable —pasos,
reglas de decisión, actores y sistemas, políticas, procedencia y
versión/vigencia— que la Capa 4 produce reconciliando memoria dispersa, y que
la Capa 5 sirve a cualquier IA vía MCP. No hay un concepto intermedio
separado: todo lo que se sintetiza y se publica es un `Skill`.

A diferencia de un `Space`, un `Skill` no pertenece a un solo `User`: nace de
reconciliar memoria de varios, y por eso su gobernanza es propia (quién puede
invocarlo), no heredada de un dueño único.

## Conectividad

**`Connector`** — la definición de un tipo de integración: MCP, Slack, Google
Drive, Notion, carpeta local. No está atado a ninguna persona ni organización;
describe cómo se habla con ese sistema — qué permisos pide, qué endpoints
llama, cómo traduce sus permisos al modelo de acceso de Savia, cómo
sincroniza. Agregar una integración nueva es agregar un `Connector`.

**`Connection`** — una instancia configurada de un `Connector`, propiedad de un
`User`, con sus propias credenciales, su estado (activa o revocada, última
sincronización) y su alcance. Tiene una **dirección**:

- **`inbound`** — una IA externa se conecta a Savia para leer o escribir
  memoria. Ejemplo: la IA de una persona conectada a su memoria personal.
- **`outbound`** — Savia se conecta a un sistema externo para traer contenido
  hacia adentro. Ejemplo: el Slack de una empresa, propiedad de su usuario
  raíz, autorizado por un administrador.

Un mismo par de conceptos cubre las dos direcciones; no hacen falta entidades
separadas para cada sentido.

## Gobernanza

Los términos de acceso —`Grant`, `Role`, `Scope`, `Permission`— todavía no
están definidos. Cómo se relacionan es una decisión de diseño de seguridad,
no de vocabulario, y se resuelve junto con el modelo de gobernanza (Capa 3).
Hasta entonces, este glosario no los usa.
