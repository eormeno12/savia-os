//! LOS NUMEROS DEL CANAL, TODOS SIN MEDIR, Y CADA UNO CON DUENO.
//!
//! Misma disciplina que `packages/ir/src/params.ts`: un numero que decide
//! comportamiento lleva **unidad**, **que decide** y **como se mediria**, y el que
//! nadie midio va en `None`. La decision 6 del borrador saca `maxRetries` de
//! `PARAMETERS` —`ir` tiene cero dependencias de runtime y ningun conocimiento del
//! agente— y manda aplicarle aca la misma regla; esto es eso.
//!
//! **NINGUNO TIENE VALOR POR OMISION Y NINGUNO DEGRADA EN SILENCIO.** `Politica` no
//! implementa `Default` y no tiene constructor sin argumento: quien necesita el
//! asentamiento lo provee, y `None` no se puede convertir en comportamiento por
//! descuido.

use std::time::Duration;

/// Un parametro que hay que medir y que nadie midio. Es el `Pending<T>` de `ir`.
pub type Pendiente<T> = Option<T>;

// ─────────────────── 1 de 5 · del AGENTE, y de la maquina ───────────────────

/// **milisegundos** — cuanto tiene que llevar una ruta con la MISMA tripleta
/// (`tamano`, `mtime`, `idDeArchivoDelSO`) antes de que valga hashearla.
///
/// DECIDE: si un `Cmd+S` en Word manda un par baja/alta al servidor, y cuanta latencia
/// hay entre guardar y ver el archivo indexado.
///
/// COMO SE MEDIRIA: instrumentando N guardados reales por aplicacion (Word, Excel,
/// Keynote, Photoshop, `cp`, rsync) y por clase de volumen (APFS local, NTFS local,
/// SMB, carpeta de sincronizador), registrando la distancia entre la primera y la
/// ultima modificacion de `mtime` del MISMO guardado, y tomando un cuantil alto de esa
/// distribucion. Tiene PISO derivado —tiene que superar la granularidad de `mtime` de
/// la raiz, o dos miradas dentro del mismo tick no distinguen «dejo de escribir» de
/// «volvio a escribir»— y TECHO derivado: el retardo que el usuario percibe entre
/// guardar y ver indexado. Los dos lados estan derivados, asi que hay un rango; lo que
/// falta es recorrerlo.
///
/// EL COSTO ES ASIMETRICO: corto = un hash desperdiciado y un hecho que
/// `upload.completed` corrige; largo = latencia hasta indexar. Cualquier numero aca
/// hoy es precision falsa.
pub const ASENTAMIENTO: Pendiente<Duration> = None;

// ─────────────────── 2 de 5 · del AGENTE, y de la cola ──────────────────────

/// **intentos consecutivos fallidos sobre la misma entrada**.
///
/// DECIDE: cuando la raiz deja de mostrarse «sincronizando» y pasa a DEGRADADA en el
/// panel. **NO decide descartar**, y eso es un hallazgo contra la letra del borrador
/// que hay que decir: un hecho «siempre tiene que llegar», asi que un tope que lo tire
/// contradice la primera linea del diseno de la cola. Lo no reintentable ya no se
/// reintenta (va a cola muerta con alerta) y lo reintentable no se descarta nunca, asi
/// que no queda nada que este numero pueda cortar sin perder un hecho.
///
/// COMO SE MEDIRIA: sobre una flota piloto, contar —entre las entregas que TERMINAN
/// llegando— en que intento acumulado llega el percentil 99. Ese intento es el valor.
/// Por debajo alarma por cortes normales de wifi; por encima esconde una desconexion
/// real.
///
/// `None` = no se marca degradada nunca y el panel muestra la antiguedad del ultimo
/// contacto, que dice lo mismo sin un umbral inventado.
pub const MAX_INTENTOS: Pendiente<u32> = None;

// ────────── 3 y 4 de 5 · de SAVIA. Aca solo se NOMBRAN, no se evaluan ───────

/// **milisegundos** — cuanto espera una ausencia antes de poder volverse retiro.
///
/// **NO ES DEL AGENTE**, y donde vive es parte del contrato: es politica pura
/// («¿esta ausencia es una baja?») y va del lado del servidor porque es lo que la
/// vuelve ajustable sin actualizar cuarenta escritorios. Se nombra aca para que quede
/// escrito que el agente NO la tiene y no la puede tener.
///
/// El agente si aporta la mitad de la evidencia que la ventana consume: el
/// `sweep.close(completo)`, que prueba a la vez que la raiz esta viva y que los
/// archivos siguen sin estar.
pub const VENTANA_DE_CUARENTENA: Pendiente<Duration> = None;

/// **fraccion (0..1)** — desde que proporcion de bajas de golpe se congela la raiz.
///
/// **NO ES DEL AGENTE.** Corre del lado de Savia, sobre el denominador que el agente
/// manda en `sweep.open`. Lo unico que este lado tiene que garantizar es que ese
/// denominador exista y signifique siempre lo mismo.
pub const FRACCION_DEL_CORTE: Pendiente<f64> = None;

// ─────────────────── 5 de 5 · del AGENTE, y del observador ──────────────────

/// **milisegundos** — cuanto tiene que pasar sin que lleguen mas eventos crudos del
/// sistema de archivos sobre la MISMA `(RaizId, RutaRelativa)` antes de que el
/// observador (`plataforma-adaptadores/src/observador.rs::Asentador`) la de por quieta
/// y agende una verificacion.
///
/// DECIDE: cuando un CHORRO de eventos crudos del SO —FSEvents en macOS,
/// `ReadDirectoryChangesW` en Windows— se considera terminado, ANTES incluso de llegar
/// a `decidir()`. **No es lo mismo que `ASENTAMIENTO`**, y hay que nombrarlo para no
/// confundirlos: `ASENTAMIENTO` decide cuando `decidir()` confia en que una tripleta
/// (`tamano`, `mtime`, `idDeArchivoDelSO`) dejo de cambiar; este numero decide cuando
/// el `Asentador` deja de esperar mas eventos crudos del SO sobre la misma ruta y la
/// manda a verificar. Son dos preguntas distintas, en dos capas distintas, aunque las
/// dos midan «¿ya se quedo quieto?».
///
/// COMO SE MEDIRIA: instrumentando el `Contadores` de `Asentador` en produccion y
/// midiendo la distribucion real de toques-por-asentamiento — cuantos eventos crudos
/// llega a acumular una ruta, en promedio, antes de que el debounce la de por quieta.
/// Un numero sostenido alto indica que la ventana es corta para el patron real de
/// escritura del SO; uno cercano a 1 indica que hay margen para acortarla y bajar la
/// latencia hasta la primera verificacion.
pub const VENTANA_DEL_OBSERVADOR: Pendiente<Duration> = None;

// ─────────────────────────── El quinto, y no lo es ──────────────────────────

/// LA TOLERANCIA DE `mtime` NO ENTRA A ESTA LISTA, Y ES UNA RESOLUCION ENTRE DISENOS.
///
/// El diseno del inventario la proponia como «un QUINTO numero sin medir». El de la
/// maquina decia que no es un parametro calibrable sino **la granularidad del volumen**
/// —2 s en FAT/exFAT, truncado en SMB— o sea un HECHO MEDIDO del sistema de archivos.
/// Gana el segundo, y por una razon concreta: un parametro se elige y se puede elegir
/// mal, y elegirlo grande esconde ediciones para siempre. Una granularidad se mide y no
/// se elige. Entra por el puerto, en `Plataforma::granularidad_de_mtime`, y no vive
/// aca.
pub const _TOLERANCIA_DE_MTIME_NO_VIVE_ACA: () = ();

// ────────────────────────── de la BANDEJA, aparte ────────────────────────────

/// **filas** — cuantos archivos muestra el panel por carpeta antes de resumir el resto
/// en «y N mas».
///
/// DECIDE: si el usuario ve el archivo que le importa sin desplegar nada. Un tope corto
/// esconde el que fallo detras de un «y 12 mas»; uno largo convierte la bandeja en una
/// lista que hay que recorrer, que es justo lo que una bandeja no es.
///
/// COMO SE MEDIRIA: con el alto util real del popover en las dos plataformas —que no es
/// un numero libre: en macOS lo acota la pantalla menos la barra, y en Windows el area
/// de notificacion—, dividido por el alto de fila del sistema de diseno, menos el
/// encabezado y las acciones. O sea: es un numero DERIVADO de una medicion de layout, no
/// una preferencia. Lo que falta es hacer esa medicion sobre el panel construido.
///
/// EL COSTO ES ASIMETRICO, y por eso el orden de `EstadoDeArchivo::prioridad` importa
/// mas que el tope: corto con el orden bien = se esconden archivos indexados, que es lo
/// que nadie mira; corto con el orden mal = se esconde el que fallo.
pub const MAX_FILAS_DEL_PANEL: Pendiente<usize> = None;
