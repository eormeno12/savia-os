//! LOS DOS COMANDOS QUE EL PANEL NUEVO NECESITA, y los dos existen para lo mismo: que la
//! interfaz pueda pedir MENOS de lo que parece.
//!
//! `desvincular` es el `quitar_carpeta` de siempre con el nombre que el rediseño le da
//! (D1/D7): «dejar de mirar esta carpeta». **El cuerpo no cambia ni una linea** — encola
//! el `RaizId` en `por_quitar` y el hilo de trabajo lo saca en su punto seguro. Es un
//! cambio de vocabulario, y decirlo importa: un rename que ademas mueve comportamiento es
//! dos cambios disfrazados de uno.
//!
//! `abrir_archivo` es el que estrena riesgo, y por eso es el que tiene la regla escrita:
//!
//! > **NINGUN COMANDO ACEPTA UNA RUTA.** Acepta un `raiz_id` y una CADENA que tiene que
//! > coincidir con una ruta que el agente ya tiene en su inventario para ESA raiz. La ruta
//! > absoluta se construye del lado de Rust, con la `ruta_absoluta` que el enrolamiento
//! > dejo — nunca con lo que mando el webview.
//!
//! Es la misma regla que `abrir_carpeta` sostiene desde siempre («la ruta sale del
//! inventario, nunca del parametro»), llevada un nivel mas abajo: alli el parametro era
//! una `id` y aca es una ruta, asi que la regla necesita una comprobacion en vez de salir
//! sola de la forma. Sin ella, `abrir_archivo` seria «abri cualquier cosa de este disco»
//! con otro nombre — y el webview es justamente la superficie desde la que un contenido
//! ajeno podria pedirlo.
//!
//! **LA COMPROBACION ES DOBLE, Y LAS DOS MITADES HACEN FALTA:**
//!
//!  1. `RutaRelativa::canonica` rechaza lo absoluto, lo vacio y todo `..` que escape. Es
//!     barata y ataja lo grosero, pero **no alcanza sola**: `otra/cosa.md` es una ruta
//!     relativa perfectamente valida y no tiene por que existir en esta carpeta.
//!  2. La ruta canonica tiene que aparecer en `inventario().entradas(&raiz)` **y estar
//!     `Presente`**. Esta es la que decide. Una lapida (`Ausente`) NO pasa: el archivo se
//!     fue de la carpeta, asi que «exista de verdad en esa raiz» es falso — y abrirla
//!     igual seria lanzar un `open` sobre algo que no esta, que en macOS no hace nada
//!     visible y deja al usuario mirando un clic que no paso.
//!
//! **ESTE ARCHIVO NO SE DECLARA EN `main.rs`.** La integracion final agrega DOS cosas y
//! nada mas: `mod comandos_archivo;` al lado de `mod macos;`, y `comandos_archivo::desvincular`
//! y `comandos_archivo::abrir_archivo` en el `invoke_handler` (donde hoy esta
//! `quitar_carpeta`, que este par reemplaza). **Nada mas hay que abrir**: `Compartido` y
//! sus campos son privados del modulo raiz del binario, y en Rust lo privado de un modulo
//! lo alcanzan sus descendientes — este modulo es uno. Mientras no esten en el
//! `invoke_handler`, las dos funciones compilan con un `dead_code` y nada mas.

use savia_folder_contrato::dominio::{RaizId, RutaRelativa};
use savia_folder_contrato::inventario::{EstadoDeFila, Inventario};
use std::sync::Arc;
use tauri::State;

use crate::Compartido;

/// Encola una raiz para dejar de mirarla. **No la saca aca**: ver `Compartido::por_quitar`
/// y el punto seguro del hilo de trabajo — `Colas::olvidar` no puede correr con un
/// segmento abierto, porque dejaria un `sweepId` colgado del lado de Savia.
///
/// «Dejar de mirar», y nada mas. **No da de baja nada en Savia, y con D1 ya no hace
/// falta**: ocultar los documentos al desvincular salio del alcance a proposito (ver
/// `docs/product/savia-b2b/plan-rediseno-agente.md`, «lo que este plan deja afuera»). Que
/// el comando no lo intente es la razon por la que puede ser instantaneo y no puede
/// fallar a medias.
///
/// Una id que no corresponde a ninguna raiz enrolada no es un error: se encola igual y el
/// hilo de trabajo imprime «no estaba enrolada». Encolar no afirma que exista; sacar es lo
/// que lo comprueba, y ahi ya hay un solo escritor.
#[tauri::command]
pub fn desvincular(estado: State<'_, Arc<Compartido>>, id: String) {
    if let Ok(mut cola) = estado.por_quitar.lock() {
        cola.push(RaizId::nueva(id));
    }
}

/// Abre UN archivo en el Finder (o en el Explorador). Ver el encabezado del modulo para
/// por que la comprobacion es doble y por que la ruta absoluta no puede venir del panel.
///
/// El candado del almacen se suelta ANTES de lanzar el proceso: `spawn` no bloquea, pero
/// tampoco tiene nada que hacer adentro de la seccion critica, y el hilo de trabajo pide
/// ese mismo `Mutex` en cada vuelta.
#[tauri::command]
pub fn abrir_archivo(
    estado: State<'_, Arc<Compartido>>,
    raiz_id: String,
    ruta: String,
) -> Result<(), String> {
    let raiz = RaizId::nueva(raiz_id);
    // La forma canonica del protocolo. Rechaza absolutas, vacias y todo `..` que escape,
    // asi que lo que sigue ya es una ruta relativa bien formada — todavia no una que
    // exista.
    let pedida = RutaRelativa::canonica(&ruta)
        .map_err(|e| format!("esa no es una ruta de adentro de la carpeta: {e:?}"))?;

    let absoluta = {
        let almacen = estado.almacen.lock().expect("el almacen no se envenena");
        // **LA BASE SALE DEL ENROLAMIENTO, NO DEL PARAMETRO.** Es la mitad de la garantia
        // que `abrir_carpeta` ya sostenia: el panel manda una id, y si no corresponde a
        // ninguna raiz enrolada no se abre nada.
        let registrada = almacen
            .inventario()
            .raiz(&raiz)
            .ok_or("esa carpeta no esta enrolada")?;

        // **LA QUE DECIDE.** La ruta tiene que estar en el inventario DE ESTA RAIZ y tiene
        // que estar `Presente`: una lapida es una ruta que el agente conoce y que en el
        // disco ya no esta.
        let esta = almacen
            .inventario()
            .entradas(&raiz)
            .into_iter()
            .any(|e| e.ruta == pedida && matches!(e.estado, EstadoDeFila::Presente { .. }));
        if !esta {
            return Err("ese archivo no esta en esta carpeta".into());
        }

        registrada.ruta_absoluta.join(pedida.como_str())
    };

    #[cfg(target_os = "macos")]
    let programa = "open";
    #[cfg(target_os = "windows")]
    let programa = "explorer";
    std::process::Command::new(programa)
        .arg(&absoluta)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
