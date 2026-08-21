# Onboarding del agente de carpeta — los pasos

Expande los cinco renglones de [`borrador-agente-carpeta.md` §El enrolamiento](borrador-agente-carpeta.md)
a pantallas diseñables. **Cada estado de acá existe porque el protocolo o el sistema
operativo lo devuelve** — ninguno está inventado para llenar un flujo. Donde el código ya
distingue dos casos, la interfaz también tiene que distinguirlos: colapsarlos obliga al
diseño a elegir cuál de los dos mentir.

Lo que hoy existe construido: **el paso 2 entero** (las tres llamadas, acreditadas contra
el simulador) y **el paso 5** (la bandeja). Los pasos 1, 3 y 4 no existen.

---

## El mapa

```
0 · instalar          fuera de la app
1 · qué es esto       una pantalla, un botón
2 · vincular          código corto · CUATRO desenlaces
3 · permisos          solo macOS · la app NO puede otorgarlos
4 · elegir carpeta    diálogo nativo · con la advertencia ANTES
5 · primer barrido    con progreso · se puede cerrar
6 · la bandeja        de acá en más vive en la barra
```

Los pasos 3 y 4 **se repiten fuera del onboarding**: agregar una segunda carpeta es el 4
solo, y un permiso revocado devuelve al 3 en cualquier momento. Diseñarlos como pantallas
de onboarding y no como componentes reutilizables es la trampa de este flujo.

---

## 0 · Instalar

Fuera de la app. Un binario firmado y notarizado; sin instalador todavía (ver «Qué falta»
del borrador). En el primer arranque macOS muestra su propio diálogo de Gatekeeper — **no
es nuestro y no se puede diseñar**, pero sí hay que contarlo en la página de descarga, o
la primera impresión de Savia es una alerta del sistema.

**No hay ícono en el Dock ni entrada en Cmd+Tab** (`ActivationPolicy::Accessory`). Eso
significa que después de instalar, **la única pista de que la app existe es el ícono en la
barra**. El onboarding tiene que abrirse solo la primera vez; si no, la persona instala y
no pasa nada visible.

## 1 · Qué es esto

Una pantalla, y su trabajo no es explicar el producto: es que la persona entienda **qué le
va a pasar a sus archivos** antes de que haya un diálogo de carpeta adelante.

Tres frases, no más:

- Savia mira una carpeta tuya y sube lo que hay adentro.
- Tú eliges cuál, y la puedes sacar cuando quieras.
- Lo que sube entra **a tu nombre**, no al de la empresa.

Esa tercera no es marketing: es una propiedad del diseño. El token es **de la persona**, no
de la organización, así que la carpeta es un canal personal por construcción.

Un botón: **Vincular este equipo**.

## 2 · Vincular — el código corto

El agente pide `POST /enroll/begin` y recibe `{enrollmentId, code, expiresIn}`.

**Se muestra `code`, grande, y nada más.** `enrollmentId` no se muestra nunca. El trabajo
del código es que un humano lo compare contra lo que ve en su cuenta de Savia — un código
chico, truncado o copiable-pero-no-legible no ata nada.

Al lado: **cuánto le queda** (`expiresIn`), como cuenta regresiva. Y una instrucción de una
línea de dónde aprobarlo.

El agente sondea `POST /enroll/claim`. **Cuatro desenlaces, y los cuatro necesitan pantalla
propia** — el código los devuelve separados a propósito:

| Desenlace | Qué pasó | Qué muestra | Qué ofrece |
|---|---|---|---|
| `Pendiente` | nadie aprobó todavía | el mismo código, esperando | **nada que apretar** |
| `Aprobado {token, usuario}` | listo | **el nombre de la persona** | seguir |
| `Denegado` | alguien dijo que no | «se rechazó desde la cuenta» | pedir otro código |
| `Vencido` | se pasó el tiempo | «el código venció» | pedir otro código |

Tres cosas que el diseño tiene que respetar:

- **`Pendiente` no es un error y no es un spinner de carga.** Puede durar minutos: la
  persona tiene que ir a otra pantalla, en otro dispositivo, a aprobar. La pantalla es
  *estable*, no *cargando*.
- **`Aprobado` muestra el nombre del usuario.** Es la única confirmación de que se vinculó
  a la cuenta correcta y no a la de otro. Sin eso, el paso termina sin que nadie pueda
  verificar qué pasó.
- **`Denegado` y `Vencido` dicen cosas opuestas** — «alguien dijo que no» vs. «tardaste».
  Son casos distintos en el tipo `Reclamo` justamente para que la interfaz no tenga que
  inventar cuál mostrar.

**Y un quinto estado que no es del protocolo: no hay respuesta.** Red caída, servidor
inalcanzable. Es distinto de los cuatro: no terminó nada, se puede reintentar solo. Si se
dibuja como `Denegado`, la persona pide un código nuevo sin necesidad.

> **El agente no se puede aprobar a sí mismo, y eso es estructural.** No existe
> `Cliente::aprobar()` y no se puede agregar. Si existiera, el código corto no ataría nada.

## 3 · Permisos de disco — solo macOS

macOS exige permiso explícito para Documentos, Escritorio, Descargas, iCloud Drive y
volúmenes externos. **La app no puede otorgárselo**: solo puede abrir el panel de Ajustes
del Sistema correcto y esperar.

La pantalla necesita:

- decir **cuál** carpeta no puede leer (no «Savia necesita permisos»);
- un botón que abra Ajustes del Sistema en el panel exacto;
- **detectar solo que ya se otorgó** — pedirle a la persona que vuelva y apriete
  «Reintentar» es hacerle de portero a algo que el agente puede notar.

**Esta pantalla vuelve después.** Un permiso revocado, un disco externo desmontado o una
carpeta en iCloud deshidratada la traen de vuelta con la app ya configurada. Diseñarla como
paso 3 de 6 y no como un estado del panel es lo que hace que después no encaje.

## 4 · Elegir la carpeta

**La advertencia va ANTES del diálogo nativo, no después.** Una vez que el selector de
macOS está adelante, la persona ya está eligiendo; explicarle las consecuencias cuando
volvió es tarde. Antes del botón:

- **todo lo que haya adentro, y en las subcarpetas, va a subir a Savia**;
- **empezá por una carpeta chica** — no es una recomendación de rendimiento, es que la
  primera vez conviene poder verificar qué subió;
- se puede sacar después, y sacar no es perder (ver la decisión abierta al final).

Después: diálogo nativo de directorio. Y **cuatro rechazos que la pantalla tiene que poder
decir**, cada uno con su frase, porque son problemas distintos:

| Rechazo | Por qué | Qué decir |
|---|---|---|
| no se puede leer | permisos | vuelve al paso 3, no es un error de la elección |
| ya está enrolada | es la misma carpeta o una de sus padres | «ya la estás mirando» |
| contiene a otra ya enrolada | se solaparían los barridos | ofrecer reemplazar la de adentro |
| es una raíz de volumen / el home entero | volumen | pedir algo más chico, con la razón |

## 5 · Primer barrido, con progreso

Es la primera vez que Savia hace algo visible, y es lo que convierte «configuré una app» en
«esto funciona».

- **Progreso real: N de T archivos**, con el nombre del que está subiendo. El total se
  conoce al abrir el barrido (`sweep.open` lo manda como `total`).
- **Se puede cerrar la ventana.** El barrido sigue; el estado está en la bandeja. Decirlo en
  la pantalla, o cerrarla se siente como cancelar.
- **Un archivo que falla no detiene el barrido** y no es una alerta modal: es una fila con
  su estado, igual que en la bandeja. El panel ya sabe contar fallos sin topear.

## 6 · La bandeja

La última pantalla del onboarding tiene un solo trabajo: **decir dónde vive Savia de ahora
en más**. Señalar el ícono en la barra, y que ahí está todo.

Es literalmente el mismo componente que la bandeja de siempre — no una pantalla de
felicitación. Que el onboarding termine mostrando la cosa real, y no una versión de fiesta
de la cosa real, es lo que hace que la segunda vez que lo abra ya sepa leerlo.

---

## Fuera del onboarding: la pantalla de carpetas

Agregar y quitar carpetas es **el paso 4 sin los otros**, más una lista. Debería alcanzarse
desde la bandeja y verse igual que en el onboarding.

Cada fila: la ruta, su estado (los cuatro que el panel ya deriva: Sincronizado, Barriendo,
Congelado, Carpeta ausente), cuántos archivos, y quitar.

### Quitar pregunta cuál de las dos — decidido el 2026-08-20

**Las dos son reversibles, y esa es la corrección que hace decidible esto.** Retirar en
Savia no borra: es `Ingestion.retiredAt`, un instante nulable. El borrador lo cierra como
decisión —«el retiro es reversible por diseño: si el archivo vuelve, el documento vuelve
entero, con sus anotaciones, sus `ElementId` y su `selladoEn`»— y el diagrama lo confirma
del otro lado (`CONGELADO --> retiro reversible`). Un archivo retirado está **oculto de la
memoria**, no destruido.

Así que la pregunta al quitar no es «¿reversible o no?». Es **«¿sus documentos siguen
apareciendo en la memoria de Savia?»**, y las dos respuestas son seguras:

| | **Dejar de mirar** | **Ocultar de la memoria** |
|---|---|---|
| la carpeta | sale de la lista | sale de la lista |
| sus documentos en Savia | **siguen apareciendo** | dejan de aparecer |
| se puede deshacer | sí | sí — vuelven enteros |
| resube al volver a agregarla | no | no |
| para quién | «ya no la uso», «la moví» | «esto no tenía que estar en la memoria» |

**Que ninguna de las dos resuba es una propiedad, no una promesa.** Dos cosas sobreviven:
la **lápida** del lado del agente —que existe justamente para que un barrido no re-reporte
cada borrado histórico— y el documento del lado de Savia. Y reelegir la carpeta movida da
el **mismo `RaizId`** (decisión 7), así que el inventario de esa raíz se vuelve a encontrar
entero y lo que ya subió no vuelve a subir.

> **Lo que falta para el segundo botón, y no es lo que parecía.** Ocultar los documentos de
> una carpeta se hace reportando sus ausencias — pero **las salvaguardas están construidas
> para impedir exactamente eso**: reportar todas las rutas de una raíz de golpe es
> indistinguible de un disco que montó mal, que es el accidente contra el que existen. El
> corte por volumen no lo bloquea (`CONGELADO` exige un barrido completo más y después
> retira), pero sí lo **demora**, y mientras tanto el panel dice «Congelado» — que la
> persona lee como un error, no como «estoy haciendo lo que pediste».
>
> Falta que la intención viaje. Ninguna de las siete llamadas la lleva: hace falta una
> octava del lado de Savia —una ocultación pedida por el dueño, autenticada con su token,
> que se salte el corte porque tiene una autoridad que un barrido no tiene—. Va a «Qué
> falta del lado de Savia» del borrador.
>
> Mientras no exista, el segundo botón se diseña deshabilitado con la razón a la vista. Y
> si se decidiera soltarlo igual, **el panel tiene que decir «Ocultando…» y no
> «Congelado»**: es el mismo estado del protocolo con dos causas distintas, y solo una de
> las dos es un problema.
