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
//! **`mod comandos_archivo;` ya esta declarado en `main.rs`**, junto a `mod macos;`, y las
//! dos funciones ya estan en el `invoke_handler` (reemplazando a `quitar_carpeta`, que se
//! borro). No hizo falta abrir nada de `Compartido`: sus campos son privados del modulo
//! raiz del binario, y en Rust lo privado de un modulo lo alcanzan sus descendientes —
//! este modulo es uno.

use savia_folder_contrato::dominio::{RaizId, RutaRelativa};
use savia_folder_contrato::inventario::{EstadoDeFila, Inventario};
use savia_folder_estado::almacen::Almacen;
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
    estado
        .por_quitar
        .escribir(|cola| cola.push(RaizId::nueva(id)));
}

/// Las dos mitades de la comprobacion, extraidas de `abrir_archivo` para que se puedan
/// probar sin `Tauri`: toma `&Almacen` directo en vez de un `State`, y por lo demas es
/// exactamente el cuerpo que tenia el comando. Ver el encabezado del modulo para por que
/// la comprobacion es doble y por que la ruta absoluta no puede venir del panel.
fn ruta_absoluta_valida(
    almacen: &Almacen,
    raiz: &RaizId,
    ruta: &str,
) -> Result<std::path::PathBuf, String> {
    // La forma canonica del protocolo. Rechaza absolutas, vacias y todo `..` que escape,
    // asi que lo que sigue ya es una ruta relativa bien formada — todavia no una que
    // exista.
    let pedida = RutaRelativa::canonica(ruta)
        .map_err(|e| format!("esa no es una ruta de adentro de la carpeta: {e:?}"))?;

    // **LA BASE SALE DEL ENROLAMIENTO, NO DEL PARAMETRO.** Es la mitad de la garantia
    // que `abrir_carpeta` ya sostenia: el panel manda una id, y si no corresponde a
    // ninguna raiz enrolada no se abre nada.
    let registrada = almacen
        .inventario()
        .raiz(raiz)
        .ok_or("esa carpeta no esta enrolada")?;

    // **LA QUE DECIDE.** La ruta tiene que estar en el inventario DE ESTA RAIZ y tiene
    // que estar `Presente`: una lapida es una ruta que el agente conoce y que en el
    // disco ya no esta.
    let esta = almacen
        .inventario()
        .entradas(raiz)
        .into_iter()
        .any(|e| e.ruta == pedida && matches!(e.estado, EstadoDeFila::Presente { .. }));
    if !esta {
        return Err("ese archivo no esta en esta carpeta".into());
    }

    Ok(registrada.ruta_absoluta.join(pedida.como_str()))
}

/// Abre UN archivo en el Finder (o en el Explorador). Ver `ruta_absoluta_valida` para la
/// comprobacion; este comando solo la envuelve con el candado y el `spawn`.
///
/// El candado del almacen se suelta ANTES de lanzar el proceso: `spawn` no bloquea, pero
/// tampoco tiene nada que hacer adentro de la seccion critica, y el hilo de trabajo pide
/// ese mismo `Mutex` en cada vuelta.
///
/// `(async)` porque ese `Mutex` es justamente el que el hilo de trabajo sostiene durante
/// todo el barrido: tomarlo desde el hilo principal congela la ventana mientras dura. Ver
/// el bloque sobre `(async)` en `main.rs`.
#[tauri::command(async)]
pub fn abrir_archivo(
    estado: State<'_, Arc<Compartido>>,
    raiz_id: String,
    ruta: String,
) -> Result<(), String> {
    let raiz = RaizId::nueva(raiz_id);
    let absoluta = {
        let almacen = estado.almacen.lock().expect("el almacen no se envenena");
        ruta_absoluta_valida(&almacen, &raiz, &ruta)?
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

/// `ruta_absoluta_valida` sin `Tauri` de por medio, contra un `Almacen` armado con un
/// barrido REAL sobre `Falsa` — mismo patron que `crates/aplicacion/tests/hallazgos.rs`
/// (`almacen()`/`registrada()`, `barrer_y_confirmar` para asentar una fila `Presente`,
/// `p.sacar` + un barrido mas para dejar una lapida `Ausente`).
#[cfg(test)]
mod tests {
    use super::*;
    use savia_folder_aplicacion::ciclo;
    use savia_folder_contrato::colas::{Decision, SweepId, Veredicto};
    use savia_folder_contrato::dominio::{BarridoId, HashVerificado, SensibilidadAMayusculas};
    use savia_folder_contrato::plataforma::RaizRegistrada;
    use savia_folder_estado::colas::{Desenlace, ParametrosDeCola, Proximo, Recibido, Trabajo};
    use savia_folder_plataforma_falsa::falsa::Falsa;
    use savia_folder_politica::salvaguardas::Politica;
    use std::time::Duration;

    // El intervalo y la raiz del BANCO, no del producto — igual que en hallazgos.rs.
    const ASENTAMIENTO_DEL_BANCO: Duration = Duration::from_secs(30);

    fn raiz() -> RaizId {
        RaizId::nueva("root-1")
    }

    fn registrada() -> RaizRegistrada {
        RaizRegistrada {
            id: raiz(),
            huella: Falsa::huella_del_banco(),
            ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
            sensibilidad: SensibilidadAMayusculas::Distingue,
        }
    }

    fn politica() -> Politica {
        Politica::con_asentamiento(ASENTAMIENTO_DEL_BANCO).expect("el banco lo provee")
    }

    fn almacen() -> Almacen {
        let mut a = Almacen::nuevo(ParametrosDeCola {
            max_intentos: None,
            max_entradas_por_lote: None,
        });
        a.enrolar(registrada());
        a
    }

    /// Drena contra un servidor de mentira que contesta `known` a todo, para que la fila
    /// termine `Presente` — copiado de `confirmar_todo` en hallazgos.rs.
    fn confirmar_todo(a: &mut Almacen) {
        loop {
            let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
                return;
            };
            let (id, recibido) = match *t {
                Trabajo::AbrirBarrido { id, .. } => (
                    id,
                    Recibido::Barrido {
                        sweep: SweepId("sweep-1".into()),
                        padron_requerido: false,
                    },
                ),
                Trabajo::EnviarPadron { id, .. } => (id, Recibido::Nada),
                Trabajo::Observar { id, entradas, .. } => {
                    let vs = entradas
                        .into_iter()
                        .map(|(ruta, afirmado)| Veredicto {
                            ruta,
                            afirmado,
                            decision: Decision::Known {
                                verificado: HashVerificado::rehidratar_del_inventario(
                                    *afirmado.bytes(),
                                ),
                            },
                        })
                        .collect();
                    (id, Recibido::Decisiones(vs))
                }
                Trabajo::Desvanecer { id, .. } => (id, Recibido::Nada),
                Trabajo::CerrarBarrido { id, .. } => (
                    id,
                    Recibido::Retirados {
                        rutas: Vec::new(),
                        congelada: false,
                    },
                ),
                Trabajo::Subir { id, .. } => (id, Recibido::Nada),
                Trabajo::ConfirmarSubida { id, .. } => (
                    id,
                    Recibido::Verificado(HashVerificado::rehidratar_del_inventario([9u8; 32])),
                ),
            };
            a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
        }
    }

    fn barrer_y_confirmar(p: &Falsa, a: &mut Almacen, n: u32) {
        ciclo::barrer(
            &raiz(),
            BarridoId::nuevo(format!("b{n}")),
            p,
            a,
            &politica(),
        );
        confirmar_todo(a);
    }

    /// Deja `presente.txt` asentado y `Presente` en el inventario de `raiz()`: dos
    /// barridos separados por el intervalo de asentamiento, cada uno drenado contra el
    /// servidor de mentira — el mismo piso que usa `abrir_archivo` para decidir "si".
    fn con_un_archivo_presente() -> (Falsa, Almacen) {
        let p = Falsa::como_macos();
        p.poner("presente.txt", b"contenido", 100, Some(1));
        let mut a = almacen();
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        barrer_y_confirmar(&p, &mut a, 1);
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        barrer_y_confirmar(&p, &mut a, 2);
        (p, a)
    }

    #[test]
    fn rechaza_ruta_absoluta() {
        let (_p, a) = con_un_archivo_presente();
        let r = ruta_absoluta_valida(&a, &raiz(), "/etc/passwd");
        assert!(r.is_err(), "una ruta absoluta no puede pasar: {r:?}");
    }

    #[test]
    fn rechaza_punto_punto_que_escapa() {
        let (_p, a) = con_un_archivo_presente();
        // `sub/../presente.txt` **RESOLVERIA** a `presente.txt` -que esta Presente de
        // verdad en el fixture- si `canonica` alguna vez resolviera el `..` en vez de
        // rechazarlo. Por eso justo esta ruta, y no una que ya de entrada no existe en
        // ningun lado: es la que distingue "rechaza por no estar en el inventario" de
        // "rechaza por el `..` en si".
        let r = ruta_absoluta_valida(&a, &raiz(), "sub/../presente.txt");
        assert!(r.is_err(), "un `..` que escapa no puede pasar: {r:?}");
    }

    #[test]
    fn rechaza_ruta_vacia() {
        let (_p, a) = con_un_archivo_presente();
        let r = ruta_absoluta_valida(&a, &raiz(), "");
        assert!(r.is_err(), "una ruta vacia no puede pasar: {r:?}");
    }

    #[test]
    fn rechaza_ruta_bien_formada_que_no_esta_en_el_inventario() {
        let (_p, a) = con_un_archivo_presente();
        let r = ruta_absoluta_valida(&a, &raiz(), "nunca-existio.txt");
        assert!(
            r.is_err(),
            "bien formada no alcanza si no esta en el inventario de esta raiz: {r:?}"
        );
    }

    #[test]
    fn rechaza_una_lapida_ausente() {
        let (p, mut a) = con_un_archivo_presente();
        p.sacar("presente.txt");
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        // Un barrido mas, sin drenar: alcanza para que el archivo que se fue quede
        // registrado como lapida, mismo patron que
        // `un_archivo_borrado_de_verdad_no_estrena_una_ruta_distinta` en hallazgos.rs.
        ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
        let lapida = a
            .inventario()
            .entradas(&raiz())
            .into_iter()
            .any(|e| e.ruta.como_str() == "presente.txt");
        assert!(lapida, "la fila tiene que sobrevivir como lapida");

        let r = ruta_absoluta_valida(&a, &raiz(), "presente.txt");
        assert!(r.is_err(), "una lapida Ausente no puede abrirse: {r:?}");
    }

    #[test]
    fn acepta_una_ruta_presente_y_arma_la_absoluta() {
        let (_p, a) = con_un_archivo_presente();
        let r = ruta_absoluta_valida(&a, &raiz(), "presente.txt");
        let absoluta = r.expect("presente.txt esta Presente en el inventario");
        assert_eq!(
            absoluta,
            registrada().ruta_absoluta.join("presente.txt"),
            "la absoluta tiene que salir de `ruta_absoluta` del enrolamiento + la relativa"
        );
    }
}
