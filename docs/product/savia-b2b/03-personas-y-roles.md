# 03 — Personas y roles

> Quién usa Savia y qué puede hacer cada quien. Define las personas del
> producto y el modelo de roles; el mecanismo técnico de permisos se diseña en
> la Capa 3 (Gobernanza). Depende de [02](02-glosario-y-entidades.md).

## Principio: nadie opera fuera de una organización

**Toda persona pertenece al menos a una `Organization`.** No existe el estado
"usuario suelto": al registrarse, quien no se une a una organización existente
crea la suya, y esa organización puede tener una sola persona.

Eso da un modelo único en lugar de dos modos paralelos (personal y
corporativo) que habría que mantener en cada capa. Una organización de una
sola persona no es un caso degradado: es el punto de partida natural, y crece
cuando esa persona invita a alguien más.

Lo que emerge de abajo hacia arriba no es la organización como entidad —esa
existe desde el día uno— sino el **cerebro colectivo**: el conocimiento
compartido y los skills que solo aparecen cuando hay varias personas
aportando.

Una persona puede pertenecer a **varias** organizaciones a la vez, y su rol se
define por organización: puede ser administradora de la suya y simple miembro
en la de un cliente.

## Las personas del producto

### Persona que aporta y consume conocimiento

El usuario base, y el más numeroso. Captura memoria mientras trabaja —por
chat, subiendo archivos, o dejando que su carpeta local y sus conectores lo
hagan solos—, consulta lo que la organización sabe, y consume skills desde la
IA que ya usa.

No necesita entender cómo se organiza la memoria: el motor de clustering lo
hace por ella. Su relación con el producto es aportar sin fricción y recibir
respuestas confiables.

### Administradora de la organización

Gestiona la organización: da de alta y baja personas, configura los
conectores de nivel organización, define políticas de gobernanza y ve la
facturación.

Es un rol de configuración, no un rol distinto de usuario: una administradora
también aporta y consume conocimiento como cualquier otra persona. En una
organización de una sola persona, esa persona es su administradora.

### Agente / IA ejecutora

No es una persona, pero es un consumidor de primera clase: es la IA que la
empresa ya usa, conectada a Savia vía MCP para leer memoria e invocar skills.

Necesita **identidad propia** —no opera "como" el humano que la configuró—
porque la gobernanza y la auditoría son por-invocador: hay que poder responder
qué agente accedió a qué, y poder revocarle el acceso a uno sin afectar a los
demás. Esa identidad es su `Connection`.

### Usuario raíz (no es una persona)

Cada organización tiene un usuario raíz que es dueño de la memoria y las
conexiones de nivel organización. Nadie inicia sesión como él y no aparece en
listas de personas: existe para que la organización pueda poseer conocimiento
sin depender de la cuenta de ningún individuo. Ver
[02](02-glosario-y-entidades.md).

## Modelo de roles

Dos roles formales por organización, y nada más:

| Rol | Qué puede hacer |
|---|---|
| **Administradora** | Todo lo de miembro, más: gestionar personas y equipos, configurar conectores de organización, definir políticas de gobernanza, administrar facturación |
| **Miembro** | Aportar y consultar memoria según lo que la gobernanza le permita, conectar sus propias IAs, gestionar sus propios conectores |

Todo lo demás es una **capacidad delegable**, no un rol nuevo: una
administradora puede otorgar a una persona puntual la posibilidad de aprobar
skills, de configurar un conector específico, o de ver la facturación, sin
convertirla en administradora.

La razón de empezar con dos roles: agregar granularidad después es fácil;
quitar un rol que la gente ya usa, no. Si aparece un patrón claro —por
ejemplo, que en toda organización mediana alguien de IT gestiona conectores
sin tocar nada más— ese patrón se convierte en un rol con nombre propio, ya
sabiendo que existe.

## Aprobación de skills

**Ningún `Skill` se vuelve invocable sin que una persona lo apruebe.** La
síntesis propone; un humano decide si eso es, efectivamente, cómo se hace el
trabajo en esta empresa.

Es una capacidad delegable: por defecto la tiene la administradora, y puede
otorgarse a quien tenga el criterio para revisar cada dominio — quien conoce
el proceso de reembolsos no es necesariamente quien administra la
organización.

Este es el punto donde "fidelidad sin alucinación" deja de ser una propiedad
técnica y se vuelve una garantía de producto: lo que una IA ejecuta en nombre
de la empresa pasó por revisión humana explícita. Es también lo que hace
viable la etapa asistida del roadmap, y la base sobre la que después se
construye la confianza para automatizar sin supervisión.

## Matriz de personas por capa

| | Captación (1) | Memoria (2) | Gobernanza (3) | Síntesis (4) | Consumo (5) |
|---|---|---|---|---|---|
| **Persona** | Aporta por los cuatro canales | Consulta lo que puede ver | Decide qué comparte de lo suyo | Aporta materia prima; puede aprobar si se le delega | Conecta su IA |
| **Administradora** | Configura conectores de organización | Ve el alcance completo que la gobernanza le permite | Define políticas y roles | Aprueba skills por defecto | Configura la conexión de organización |
| **Agente / IA** | Escribe memoria nueva | Lee lo que su conexión habilita | Sujeto a gobernanza por-invocador | Consume skills aprobados | Es el consumidor |
| **Usuario raíz** | Dueño de lo que entra por conectores de organización | Dueño de la memoria de organización | Sujeto de las políticas, no actor | Su memoria alimenta la síntesis | No consume |

## Decisiones tomadas

- **2026-07-29** — Toda persona pertenece al menos a una `Organization`; no
  existe el usuario sin organización. Una organización puede tener una sola
  persona.
- **2026-07-29** — Dos roles formales (administradora, miembro) más
  capacidades delegables, en lugar de un catálogo fijo de roles.
- **2026-07-29** — La aprobación de un `Skill` antes de publicarse es siempre
  humana, y es una capacidad delegable.
