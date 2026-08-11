# 04 — Capa 1: Captación (modelo)

> Qué capta Savia, por dónde entra, y qué experiencia tiene quien aporta.
> El diseño del pipeline que procesa todo esto está en
> [05](05-capa1-pipeline-ingesta-tecnico.md). Depende de
> [02](02-glosario-y-entidades.md) y [03](03-personas-y-roles.md).

## El principio: capturar sin pedir trabajo

El conocimiento que Savia necesita ya existe — está en documentos, en
conversaciones, en la cabeza de la gente. Lo que no existe es el tiempo para
sentarse a documentarlo. Cualquier diseño que exija esfuerzo deliberado y
sostenido para alimentar el sistema falla, porque compite con el trabajo real
de la persona.

De ahí la regla que ordena toda esta capa: **captar donde el conocimiento ya
se produce, con la menor intervención posible**. La captación deliberada
existe y es válida, pero es el complemento, no el motor.

## Dos ejes independientes: qué y por dónde

Una pieza de conocimiento tiene una **modalidad** (qué tipo de contenido es) y
llega por un **canal** (por dónde entró). Son independientes: el mismo PDF
puede llegar arrastrado a la web, aparecer en una carpeta sincronizada, o
venir de un Drive conectado.

La modalidad determina **cómo se extrae** el contenido —cada tipo tiene su
forma de volverse hechos (π) y de conservar su coordenada de origen (σ)— y
vive encapsulada en su adapter. El canal determina **la experiencia**: qué
control tiene la persona, qué expectativa de latencia, y qué permisos trae de
origen.

Separarlos evita el problema clásico de estos sistemas: que agregar un formato
nuevo obligue a tocar la mitad del producto. Soportar un tipo nuevo de archivo
es escribir un adapter; abrir un canal nuevo es otra cosa, y no se pisan.

## Los cuatro canales

### Captación activa

La persona decide en el momento qué entra.

**Chat.** Conversar con la IA que ya usa, y que lo relevante quede. Es el
canal de menor fricción para conocimiento tácito —el que no está escrito en
ningún lado— porque aparece naturalmente al explicar algo. No requiere ir a
Savia: sucede donde la persona ya está trabajando.

**Frontend.** Subir archivos o escribir directamente en Savia. Es el canal
deliberado: se usa cuando alguien quiere que algo específico entre, con
control total sobre qué y cuándo.

### Captación pasiva

Una vez configurados, capturan solos.

**Carpeta local.** Una carpeta en la computadora que se sincroniza sola con
Savia. Quien trabaja con archivos —contratos, propuestas, planillas— los deja
donde ya los dejaba, y entran sin pensar en ello.

Es **unidireccional** por diseño: la carpeta es de la persona y es
autoritativa; Savia nunca escribe ahí. Lo que Savia produce a partir de esa
memoria se ofrece aparte, como un espejo de solo lectura. La razón es evitar
de raíz la clase de problema que hace difícil un sincronizador bidireccional:
si dos lados pueden editar lo mismo, hay conflictos que resolver, archivos que
se mueven solos, y riesgo de pisar trabajo de la persona. Savia no necesita
devolver archivos; necesita leerlos.

**Conectores.** Slack, Gmail, Drive, Notion: sincronización continua de las
fuentes donde el conocimiento de la empresa ya circula. Es el canal que
resuelve el límite del bottom-up puro — el conocimiento que nadie recuerda
que existe, enterrado en un canal de hace dos años.

Los conectores **espejan los permisos de la fuente**: si alguien no ve un
canal privado en Slack, tampoco ve en Savia lo que salió de ahí. Un conector
que ignore esto convierte a Savia en una vía de escape de permisos, y eso
cierra la puerta enterprise de entrada.

## Qué pasa cuando algo entra

**Entra directo, sin cola de aprobación.** Lo pasivo tiene que ser invisible o
deja de ser pasivo: si cada archivo espera revisión, se acumula un backlog que
nadie procesa y el canal muere. La corrección es posterior — se puede borrar,
excluir una carpeta o un canal completo, o marcar algo como irrelevante.

Eso impone una obligación del otro lado: **la persona tiene que poder ver qué
entró**. Captación silenciosa sin visibilidad es una caja negra, y una caja
negra sobre el conocimiento de tu empresa no es aceptable. Toda memoria
conserva su procedencia —de dónde salió, cuándo, por qué canal— y es
consultable.

El control disponible:

- **Excluir por origen** — carpetas, canales, remitentes, tipos de archivo que
  nunca deben entrar.
- **Corregir después** — borrar una memoria puntual, o todo lo que vino de una
  fuente.
- **Desconectar** — cortar un canal deja de traer contenido nuevo; lo ya
  captado sigue existiendo salvo que se borre explícitamente.

## Versiones del mismo contenido

Cuando llega una versión nueva de algo ya captado, el comportamiento depende
del canal, porque la certeza sobre la identidad del documento también depende
del canal:

- **Carpeta local y conectores**: hay identidad de archivo clara —misma ruta,
  mismo identificador en la fuente— así que la versión nueva **reemplaza** a
  la anterior. La versión previa queda como historial: no participa de
  búsquedas ni de síntesis, pero permite trazar cómo cambió algo.
- **Subida manual**: no hay forma confiable de saber si un archivo con nombre
  parecido es una versión nueva o un documento distinto, así que **coexisten**
  — salvo que la persona indique explícitamente que está reemplazando algo.

El motivo de reemplazar en lugar de acumular: si dos versiones de un mismo
proceso siguen activas, la síntesis las ve como dos vistas contradictorias del
mismo tema y tiene que resolver un conflicto que en realidad no existe — solo
una está vigente.

## Sensibilidad

**Savia clasifica automáticamente** el contenido sensible al momento de
captarlo —credenciales, datos personales, información de salud, remuneraciones
— y aplica la marca sin esperar confirmación. La alternativa, exigir que
alguien marque cada cosa, garantiza que lo sensible se filtre por olvido: nadie
va a etiquetar a mano el contenido que entra por canales pasivos.

Las consecuencias de equivocarse no son simétricas, y el diseño tiene que
tratarlas distinto:

- Un **falso negativo** —contenido sensible que no se detectó— expone
  información. Es el modo de falla grave, y por eso la clasificación debe
  correr sobre todo lo que entra, sin excepción de canal.
- Un **falso positivo** —contenido inocuo marcado como sensible— esconde algo
  útil. Es recuperable, pero solo si la persona puede darse cuenta: por eso
  toda marca automática es **visible y reversible por el dueño**, con el
  motivo de la clasificación a la vista.

Marcar algo como sensible no lo oculta de su dueño: limita que se comparta y
que alimente skills. El efecto exacto sobre acceso y síntesis se define en la
Capa 3.

## Procesamiento con modelos externos

Captar no es solo guardar: cada pieza de contenido pasa por modelos que la
convierten en memoria utilizable. Son cinco usos, y conviene tenerlos
explícitos porque definen la superficie de exposición del sistema:

| Uso | Sobre qué corre |
|---|---|
| Embeddings | 100% del contenido — es lo que hace posible la búsqueda semántica |
| Extracción de hechos (π) | 100% del contenido |
| Clasificación de sensibilidad | 100% del contenido |
| Nombrado de clústeres | Esporádico, al crearse un `Space` |
| Síntesis de skills (Capa 4) | Bajo volumen, alto razonamiento |

Más los especializados de multimodal: transcripción para audio y video, OCR y
descripción para imágenes.

**Hoy esos modelos son de proveedores externos**, lo que significa que el
contenido —incluido el sensible— sale hacia un tercero durante el
procesamiento. Es una decisión consciente de etapa, no un descuido: montar
inferencia propia antes de tener la síntesis funcionando retrasaría el
producto central.

Lo que sí se sostiene desde el arranque, y no depende de dónde corran los
modelos:

- **Los skills no contienen datos concretos.** Un proceso sintetizado describe
  cómo se hace algo —"se reembolsa al cliente el monto de la compra"—, nunca
  el caso particular del que se dedujo. No es una pasada de censura posterior:
  es cómo se construye un skill, y antes que una cuestión de privacidad es una
  cuestión de corrección, porque un proceso que arrastra el dato de un caso
  está mal generalizado.
- **La gobernanza filtra al leer**, no transformando lo almacenado. Que
  alguien no pueda ver un dato no requiere destruirlo ni reemplazarlo: se
  resuelve en el momento de la consulta.

**Dirección futura, ya diseñada pero no implementada:** que el dato crudo
nunca salga de la infraestructura de Savia. Solo dos pasos necesitan el
contenido sin transformar —los embeddings, porque definen el espacio
vectorial, y la clasificación de sensibilidad, porque es circular: es el paso
que decide qué es sensible—. Si esos dos corren en infraestructura propia,
todo lo demás (extracción, nombrado, síntesis) puede enviarse tokenizado a un
proveedor externo. El pipeline se diseña con esa frontera en su lugar para no
tener que reescribirlo cuando se implemente.

## Qué no capta Savia

Un límite explícito, porque define el producto tanto como lo que sí hace:

- **No es un backup ni un archivo.** Savia guarda el activo original para
  poder verificar y mostrar procedencia, no para ser el lugar donde vive el
  archivo. La fuente sigue siendo autoritativa.
- **No captura lo que la persona no puede ver.** Un conector nunca trae más de
  lo que su autorización permite en la fuente.
- **No infiere conocimiento que nadie expresó.** La síntesis (Capa 4)
  reconcilia lo que existe; no inventa procesos que nunca fueron dichos ni
  escritos.

## Decisiones tomadas

- **2026-07-29** — La captación pasiva entra directo, sin cola de aprobación;
  la corrección es posterior (borrar, excluir origen, desconectar). A cambio,
  todo lo captado es visible y trazable.
- **2026-07-29** — Versiones: por carpeta local y conectores, la nueva
  reemplaza y la anterior queda como historial; por subida manual, coexisten
  salvo indicación explícita de reemplazo.
- **2026-07-29** — La sensibilidad se clasifica automáticamente al captar, sin
  confirmación previa; toda marca es visible y reversible por el dueño.
- **2026-07-29** — El procesamiento usa proveedores de modelos externos. La
  protección de datos se apoya en dos garantías que no dependen de dónde
  corran los modelos: los skills se generalizan por construcción (nunca
  contienen datos concretos) y la gobernanza filtra al leer en vez de
  transformar lo almacenado.
- **2026-07-29** — Diferida: la arquitectura de "el dato crudo nunca sale"
  (embeddings y clasificación en infraestructura propia, tokenización hacia el
  proveedor externo). Queda como dirección futura; el pipeline se diseña con
  esa frontera prevista.
