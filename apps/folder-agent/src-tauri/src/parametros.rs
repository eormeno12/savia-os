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

// ─────────────────── 1 de 4 · del AGENTE, y de la maquina ───────────────────

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

// ─────────────────── 2 de 4 · del AGENTE, y de la cola ──────────────────────

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

// ────────── 3 y 4 de 4 · de SAVIA. Aca solo se NOMBRAN, no se evaluan ───────

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
