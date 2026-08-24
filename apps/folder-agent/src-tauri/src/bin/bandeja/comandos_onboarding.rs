//! LOS COMANDOS DE LA VENTANA DE ONBOARDING (Fase 6). **Este módulo se integró en la
//! ronda de Fase 5/6/7**: ver `main.rs` para `mod comandos_onboarding;`, los
//! `.manage(...)` y el `generate_handler!`. Lo que sigue documenta cómo quedó resuelto
//! cada punto que el agente de Fase 6 dejó pendiente para la integración.
//!
//! ## Cómo quedó resuelto cada punto pendiente
//!
//! 0. **`serde` como dependencia DIRECTA de `savia-folder-host`** — agregada en
//!    `Cargo.toml` (`serde = { version = "1", features = ["derive"] }`, junto a
//!    `serde_json`). Los DTOs de este módulo (`VinculacionParaLaPantalla`,
//!    `ReclamoParaLaPantalla`, `ResultadoDeEleccion`) derivan `serde::Serialize` y lo
//!    necesitan resoluble en el propio crate, no solo transitivo.
//! 1. `mod comandos_onboarding;` en `main.rs`, junto a `mod comandos_archivo;`.
//! 2. **Campo `base: String` en `struct Compartido`** — se llena con el mismo `String`
//!    que `main()` calcula para el `Cliente` de fondo.
//! 3. **Dos `.manage(...)`, no tres.** `EstadoDeVinculacion` y `CandidataPendiente`
//!    siguen siendo estado propio de esta ventana. `TokenDeDispositivoObtenido`
//!    **se descartó**: ver el punto 5 — el token pendiente vive en `Compartido`, no acá,
//!    porque quien lo necesita persistir es el hilo de trabajo y no esta ventana.
//! 4. Las siete funciones `#[tauri::command]` de este módulo están en
//!    `tauri::generate_handler![...]`, calificadas. `desvincular`/`abrir_archivo` NO
//!    viven acá — son de `comandos_archivo`, ver el motivo en la sección final de este
//!    archivo.
//! 5. **Persistir el token, resuelto.** `sondear_vinculacion` ya no guarda en un estado
//!    propio de la ventana: escribe el `Secreto` en `Compartido::token_pendiente`
//!    (mismo mecanismo que `por_quitar` — un buzón que el hilo de trabajo vacía en su
//!    punto seguro). `trabajar()` lo revisa en cada vuelta junto con `por_quitar`; si
//!    hay uno, reconstruye el `Cliente` con la credencial nueva y lo persiste en el
//!    `deposito.guardar(...)` que ya corre esa misma vuelta — no hace falta un guardado
//!    aparte.
//!
//! ## Lo que SÍ pasó por las reglas del plan, y dónde
//!
//! - **Ningún comando recibe lo que puede resolver** (plan §3, regla 5): `abrir_archivo`
//!   valida `ruta` contra el inventario antes de construir el path absoluto, igual que
//!   `abrir_carpeta` en `main.rs`. `elegir_carpeta_con_advertencia` no recibe una ruta
//!   del webview en absoluto — la saca del diálogo nativo, mismo patrón que
//!   `agregar_carpeta`.
//! - **Ningún número inventado**: `UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR` es `None` — ver su
//!   comentario. El intervalo de sondeo del código de vinculación (`sondear_vinculacion`
//!   la llama el JS, no este módulo) es una decisión de UX, no del núcleo, y se
//!   documenta en `onboarding.js`, no acá — no aplica la disciplina de
//!   `contrato::parametros`, que es para números que deciden comportamiento del canal.
//! - **R2 — aguas abajo se lee `role`/`clase`, nunca se ramifica sobre el código.**
//!   `sondear_vinculacion` nunca mira un código HTTP: cualquier `Err` de
//!   `FalloDeProtocolo` (transporte, 5xx, lo que sea) se traduce a `SinConexion`, que es
//!   justo la distinción que la pantalla necesita (reintentable) y no una lista de
//!   casos por código.

use savia_folder_contrato::dominio::{RaizId, SensibilidadAMayusculas};
use savia_folder_contrato::plataforma::{HuellaDeRaiz, Plataforma, RaizRegistrada};
use savia_folder_contrato::protocolo::{Credencial, Reclamo, Vinculacion};
use savia_folder_protocolo::{BaseDeApi, Cliente, Tiempos};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

// Traído de `main.rs`. Este módulo vive en el mismo directorio (`src/bin/bandeja/`) y
// no en una crate propia — mismo motivo que `macos.rs`: es parte del BINARIO, no del
// núcleo, así que `crate::Compartido` es la ruta correcta una vez integrado.
use crate::Compartido;

// ═══════════════════════════ Los tiempos de esta ventana ════════════════════════════
//
// **Distinto de `demo::TIEMPO_DE_CONEXION`/`TIEMPO_POR_LLAMADA` en `main.rs`.** Esos son
// de la DEMO explícitamente (el comentario de `main.rs` lo dice). Estos son los que un
// `Cliente` de onboarding necesita para poder construirse — un valor razonable de
// producción, no un artefacto de demo: la vinculación es la primera impresión y no
// tiene sentido que cuelgue más de unos segundos antes de decirle a la persona «sin
// conexión».
const TIEMPO_DE_CONEXION: Duration = Duration::from_secs(5);
const TIEMPO_POR_LLAMADA: Duration = Duration::from_secs(15);

fn cliente_sin_autenticar(base: &str) -> Result<Cliente, String> {
    let base = BaseDeApi::nueva(base).map_err(|e| e.to_string())?;
    let tiempos = Tiempos {
        conexion: TIEMPO_DE_CONEXION,
        por_llamada: TIEMPO_POR_LLAMADA,
        envio_de_cuerpo: None,
    };
    Ok(Cliente::nuevo(base, Credencial::SinAutenticar, tiempos))
}

// ═══════════════════════════════ Pantalla 2 · vincular ══════════════════════════════

/// La `Vinculacion` EN CURSO, del lado del proceso. **No viaja al webview**: lo único
/// que la pantalla necesita mostrar es `codigo` y `vence_en_segundos`, y el `id` con el
/// que se reclama se queda del lado de Rust — regla del plan §3.5, «un comando no
/// recibe lo que puede resolver», aplicada al revés: tampoco le DA al webview algo que
/// no tiene por qué tener.
pub(crate) struct EstadoDeVinculacion(pub Mutex<Option<Vinculacion>>);

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VinculacionParaLaPantalla {
    pub codigo: String,
    pub vence_en_segundos: u64,
}

/// Espejo serializable de `Reclamo`, más el quinto estado que no es una variante de
/// `Reclamo` porque no es una respuesta del servidor — ver el encabezado de
/// `crates/protocolo/src/lib.rs`: es lo que pasa cuando `reclamar()` devuelve `Err`.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "estado", rename_all = "camelCase")]
pub(crate) enum ReclamoParaLaPantalla {
    Pendiente,
    Aprobado { usuario: String },
    Denegado,
    Vencido,
    SinConexion,
}

/// `POST /enroll/begin`, una vez. La pantalla llama esto al entrar y cuando la persona
/// pide un código nuevo (rechazado / vencido).
#[tauri::command]
pub(crate) fn iniciar_vinculacion(
    estado: State<'_, Arc<Compartido>>,
    vinculacion: State<'_, EstadoDeVinculacion>,
) -> Result<VinculacionParaLaPantalla, String> {
    let cliente = cliente_sin_autenticar(&estado.base)?;
    let v = cliente.enrolar().map_err(|e| e.to_string())?;
    let para_pantalla = VinculacionParaLaPantalla {
        codigo: v.codigo.clone(),
        vence_en_segundos: v.expira_en.as_secs(),
    };
    *vinculacion.0.lock().expect("no se envenena") = Some(v);
    Ok(para_pantalla)
}

/// `POST /enroll/claim`, una vez por sondeo. **El intervalo lo decide `onboarding.js`,
/// no este comando** — este solo contesta a UN pedido, ver el comentario del intervalo
/// ahí.
///
/// `Pendiente` deja la vinculación viva para el próximo sondeo. `Aprobado`/`Denegado`/
/// `Vencido` la CONSUMEN (`None` después): sondear de nuevo sin pasar por
/// `iniciar_vinculacion` es un error explícito, no un sondeo mudo. `Err(_)` —cualquier
/// `FalloDeProtocolo`— dejar la vinculación viva Y NO se ramifica sobre el motivo: es
/// la regla R2 del plan, aguas abajo se lee la clase (acá, ambas clases posibles caen
/// al mismo `SinConexion`) y nunca el código crudo.
#[tauri::command]
pub(crate) fn sondear_vinculacion(
    estado: State<'_, Arc<Compartido>>,
    vinculacion: State<'_, EstadoDeVinculacion>,
) -> Result<ReclamoParaLaPantalla, String> {
    let v = {
        let guardia = vinculacion.0.lock().expect("no se envenena");
        guardia
            .clone()
            .ok_or("no hay una vinculacion en curso: llama iniciar_vinculacion primero")?
    };
    let cliente = cliente_sin_autenticar(&estado.base)?;
    Ok(match cliente.reclamar(&v) {
        Ok(Reclamo::Pendiente) => ReclamoParaLaPantalla::Pendiente,
        Ok(Reclamo::Aprobado {
            token: secreto,
            usuario,
        }) => {
            // Buzón para el hilo de trabajo — ver `Compartido::token_pendiente` en
            // `main.rs`. Este comando no persiste nada él mismo: el depósito vive en
            // `trabajar()`, no acá.
            if let Ok(mut buzon) = estado.token_pendiente.lock() {
                *buzon = Some(secreto);
            }
            *vinculacion.0.lock().expect("no se envenena") = None;
            ReclamoParaLaPantalla::Aprobado { usuario }
        }
        Ok(Reclamo::Denegado) => {
            *vinculacion.0.lock().expect("no se envenena") = None;
            ReclamoParaLaPantalla::Denegado
        }
        Ok(Reclamo::Vencido) => {
            *vinculacion.0.lock().expect("no se envenena") = None;
            ReclamoParaLaPantalla::Vencido
        }
        Err(_fallo) => ReclamoParaLaPantalla::SinConexion,
    })
}

// ═══════════════════════════ Pantalla 3 · permiso de disco ══════════════════════════
//
// **SOLO EL CONTEXTO DE ONBOARDING.** El mockup tiene un segundo contexto («vuelve
// después», disparado desde el panel real cuando el permiso se revoca en uso) que este
// módulo NO cubre — necesitaría saber CUÁL carpeta dejó de leerse, y eso lo sabe el
// hilo de trabajo (`ciclo::barrer` contra `MotivoIndeterminado::PermisoDenegado`), no
// esta ventana. Queda anotado para quien lo dispare desde el panel.
//
// **LA PRUEBA ES UNA HEURÍSTICA, Y HAY QUE DECIRLO DE FRENTE.** macOS no publica una
// API para preguntar «¿tengo el permiso de Archivos y Carpetas?» — la técnica estándar
// es intentar leer algo y mirar si sale `PermissionDenied`. Acá el candidato es
// `~/Documents`: en la pantalla de onboarding TODAVÍA no hay ninguna carpeta elegida
// (Q3 corre antes que Q4), así que no hay una carpeta real contra la cual probar. Sirve
// como señal de «Savia ya tiene acceso a carpetas personales en general» — la prueba
// PRECISA, contra la carpeta que la persona realmente eligió, es la que ya hace
// `elegir_carpeta_con_advertencia` al construir la huella: si esa falla, la pantalla 4
// muestra `no_puede_leer` y manda de vuelta acá. Este comando solo adelanta el caso
// común para no hacerle abrir el diálogo nativo a alguien que todavía no tiene el
// permiso general.
#[tauri::command]
pub(crate) fn permiso_de_disco_concedido() -> bool {
    #[cfg(target_os = "macos")]
    {
        let Some(home) = std::env::var_os("HOME") else {
            return false;
        };
        std::fs::read_dir(PathBuf::from(home).join("Documents")).is_ok()
    }
    // Windows no tiene el equivalente de TCC para «Archivos y Carpetas»: un proceso sin
    // privilegios especiales ya puede leer las carpetas del usuario. No es un atajo —
    // es que la pregunta no aplica del otro lado, la misma forma que
    // `PoliticaDeDeshidratacion`/`PlanDeArranque` resuelven las diferencias de
    // plataforma como VALOR y no como método ausente.
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Abre el panel de Privacidad de Ajustes del Sistema. **La ancla exacta queda sin
/// verificar contra una instalación real de macOS** — `x-apple.systempreferences:
/// com.apple.preference.security?Privacy` abre la pestaña de Privacidad en general;
/// Apple movió y renombró la sub-sección «Archivos y Carpetas» entre versiones de
/// macOS y no hay una URL de esquema documentada y estable para saltar directo a ella
/// por app. Quien integre esto debería confirmarlo contra la versión mínima que declara
/// `tauri.conf.json` (`macOS.minimumSystemVersion: "10.15"`) y, si hace falta, ajustar
/// el ancla — es una cadena, no una decisión de arquitectura.
#[cfg(target_os = "macos")]
#[tauri::command]
pub(crate) fn abrir_ajustes_de_privacidad() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy")
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ═══════════════════════════ Pantalla 4 · elegir la carpeta ═════════════════════════

/// Ver `elegir_carpeta_con_advertencia`. Va a `CandidataPendiente` mientras espera la
/// confirmación de «Reemplazar»; en cualquier otro resultado no se guarda nada.
pub(crate) struct CandidataPendiente(pub Mutex<Option<RaizRegistrada>>);

/// **Umbral de archivos vivos sobre el que la advertencia `muyGrande` dispara. `None` a
/// propósito** — misma disciplina que `contrato::parametros::Pendiente<T>`: nadie lo
/// midió. Contarlos hoy exigiría recorrer la carpeta candidata ANTES de enrolarla (vía
/// `Plataforma::evidencia_de_raiz`, sobre una `RaizRegistrada` construida a mano solo
/// para contar) — un costo real que no vale pagar contra un umbral inventado. Con
/// `None`, `clasificar_candidata` no puede producir `MuyGrande` nunca: el día que
/// alguien mida el techo, este valor pasa a `Some(n)` y ese camino se activa solo, sin
/// tocar el resto de la función.
const UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR: Option<u64> = None;

#[derive(Clone, serde::Serialize)]
#[serde(tag = "resultado", rename_all = "camelCase")]
pub(crate) enum ResultadoDeEleccion {
    Aceptada,
    NoPuedeLeer,
    YaMirando,
    ContieneOtra {
        id: String,
        ruta: String,
    },
    /// Ver `UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR`: declarada, no construida hoy — mismo
    /// patrón que `MotivoDeFallo::Desconocido` en `contrato::inventario`. El `allow`
    /// hace falta porque este enum es `pub(crate)` de un binario, no de una librería:
    /// no hay codigo externo que pudiera construirla y salvar la variante del lint.
    #[allow(dead_code)]
    MuyGrande,
}

/// Nombre del evento que `onboarding.js` escucha para saber en qué terminó el diálogo.
/// Aparte de `"cambio"` (que ya usa el panel de hoy) para que la pantalla 4 no tenga
/// que filtrar payloads de dos formas distintas en el mismo canal.
pub(crate) const EVENTO_RESULTADO_DE_ELECCION: &str = "resultado-carpeta";

/// Abre el diálogo NATIVO de directorio y clasifica lo elegido — **nunca enrola a
/// ciegas**. Mismo patrón que `agregar_carpeta` en `main.rs`: devuelve en el acto,
/// resuelve en la devolución de llamada, y el resultado viaja por evento porque
/// `pick_folder` puede tardar lo que tarde la persona en elegir.
#[tauri::command]
pub(crate) fn elegir_carpeta_con_advertencia(app: AppHandle, estado: State<'_, Arc<Compartido>>) {
    use tauri_plugin_dialog::DialogExt;
    let c = Arc::clone(&estado);
    let app2 = app.clone();
    app.dialog().file().pick_folder(move |elegida| {
        let Some(ruta) = elegida.and_then(|r| r.into_path().ok()) else {
            // La persona cerró el diálogo sin elegir. No es un resultado — no hay nada
            // que la pantalla tenga que mostrar distinto de lo que ya estaba mostrando.
            return;
        };
        let resultado = clasificar_y_actuar(&c, &app2, ruta);
        let _ = app2.emit(EVENTO_RESULTADO_DE_ELECCION, &resultado);
    });
}

/// Confirma el «Reemplazar» de la pantalla `contieneOtra`: encola la vieja para
/// sacarla —mismo mecanismo que `desvincular`, el punto seguro es el hilo de trabajo—
/// y enrola la que estaba esperando en `CandidataPendiente`.
#[tauri::command]
pub(crate) fn reemplazar_carpeta(
    app: AppHandle,
    estado: State<'_, Arc<Compartido>>,
    candidata: State<'_, CandidataPendiente>,
    id_a_reemplazar: String,
) -> Result<(), String> {
    let pendiente = candidata
        .0
        .lock()
        .expect("no se envenena")
        .take()
        .ok_or("no hay una carpeta candidata esperando confirmacion")?;
    if let Ok(mut cola) = estado.por_quitar.lock() {
        cola.push(RaizId::nueva(id_a_reemplazar));
    }
    {
        let mut almacen = estado.almacen.lock().expect("no se envenena");
        almacen.enrolar(pendiente);
    }
    let _ = app.emit("cambio", ());
    Ok(())
}

fn clasificar_y_actuar(c: &Arc<Compartido>, app: &AppHandle, ruta: PathBuf) -> ResultadoDeEleccion {
    let huella: HuellaDeRaiz = match c.plataforma.huella_de_raiz(&ruta) {
        Ok(h) => h,
        Err(_) => return ResultadoDeEleccion::NoPuedeLeer,
    };
    let candidata_id = huella.raiz_id();

    let existentes = {
        let almacen = c.almacen.lock().expect("no se envenena");
        almacen.inventario().raices()
    };

    // **`YaMirando` cubre DOS casos, no uno**: la misma raíz (misma huella, aunque la
    // ruta visible haya cambiado — decisión 7) y una raíz que YA sigo y que contiene a
    // la candidata (elegir una subcarpeta de lo que ya miro no agrega nada). El texto
    // de `textos.js` («la misma carpeta... o una que la contiene») es exactamente esta
    // unión.
    let ya_mirando = existentes
        .iter()
        .any(|r| r.id == candidata_id || ruta.starts_with(&r.ruta_absoluta));
    if ya_mirando {
        return ResultadoDeEleccion::YaMirando;
    }

    // La INVERSA: una raíz que ya sigo queda ADENTRO de la candidata. No se resuelve
    // sola — hace falta que la persona decida «Reemplazar», así que no se enrola acá.
    if let Some(contenida) = existentes
        .iter()
        .find(|r| r.ruta_absoluta.starts_with(&ruta))
    {
        let candidata_registrada = RaizRegistrada {
            id: candidata_id,
            huella,
            ruta_absoluta: ruta,
            sensibilidad: SensibilidadAMayusculas::NoDistingue,
        };
        // Ver `CandidataPendiente`: espera a `reemplazar_carpeta`.
        *app.state::<CandidataPendiente>()
            .0
            .lock()
            .expect("no se envenena") = Some(candidata_registrada);
        return ResultadoDeEleccion::ContieneOtra {
            id: contenida.id.como_str().to_string(),
            ruta: contenida.ruta_absoluta.display().to_string(),
        };
    }

    // `MuyGrande`: ver `UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR`. Con `None`, este camino no
    // se alcanza — queda escrito para cuando alguien mida el umbral y agregue el
    // conteo, no para que el guardián de mutación lo encuentre muerto sin explicación.
    let _ = UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR;

    {
        let mut almacen = c.almacen.lock().expect("no se envenena");
        almacen.enrolar(RaizRegistrada {
            id: candidata_id,
            huella,
            ruta_absoluta: ruta,
            sensibilidad: SensibilidadAMayusculas::NoDistingue,
        });
    }
    let _ = app.emit("cambio", ());
    ResultadoDeEleccion::Aceptada
}

// ═══════════════════════════ Pantalla 5 · primer barrido ════════════════════════════
//
// **NO HAY COMANDO ACÁ A PROPÓSITO.** La pantalla 5 lee el mismo `vista()` que ya está
// registrado para la bandeja (los comandos propios no son por-ventana, ver
// `capabilities/bandeja.json`) y escucha el mismo evento `"cambio"` — exactamente el
// patrón de `bandeja.js`. `Carpeta::progreso` (`aplicacion::panel`) es `Option<Progreso>`
// y hoy siempre `None`; `onboarding.js` lo consulta y, mientras sea `None`, muestra la
// lista de `filas` sin el «128 de 412» — no inventa el número. El día que el canal de
// progreso de la Fase 7 llene ese campo, la pantalla lo toma solo.

// ═══════════════════════════════ Pantalla 6 · listo ══════════════════════════════════

/// Cierra la ventana de onboarding y muestra el popover real. Dos límites que quedan
/// anotados y no resueltos acá:
///
/// 1. **El posicionamiento bajo el ícono vive en `macos::ubicar_bajo_el_icono`**, que
///    toma el `rect` del clic en la bandeja — esta llamada no tiene ese rect, así que el
///    popover aparece donde haya quedado la última vez (o en el origen, la primera).
///    Se reposiciona solo la próxima vez que la persona hace clic en el ícono
///    (`alternar` en `main.rs` siempre ubica antes de mostrar). Cosmético, no funcional.
/// 2. **Sin `set_focus()` en macOS**, deliberado: es la misma regla que `alternar`
///    documenta para el panel `Accessory` — activarlo ahí es lo único que un panel no
///    activador no se puede permitir.
///
/// La activación de inicio automático vive acá porque el comentario de `main.rs` sobre
/// `tauri_plugin_autostart::init` dice exactamente dónde va la decisión: «encenderlo es
/// una decisión de la persona, y va en la última pantalla del onboarding». Es
/// mejor-esfuerzo: si falla, el onboarding igual termina.
#[tauri::command]
pub(crate) fn terminar_onboarding(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    if let Err(e) = app.autolaunch().enable() {
        eprintln!("no se pudo activar el inicio automatico: {e}");
    }
    if let Some(w) = app.get_webview_window("onboarding") {
        let _ = w.close();
    }
    if let Some(b) = app.get_webview_window("bandeja") {
        let _ = b.show();
        #[cfg(not(target_os = "macos"))]
        let _ = b.set_focus();
    }
    Ok(())
}

// ═════════════ `desvincular` y `abrir_archivo` NO viven acá ═════════════
//
// Están FIJADOS por el encargo (mismo nombre y firma en las tres partes de esta ronda,
// para que las llamadas de este módulo y del panel coincidieran sin coordinarse) y esta
// ventana los necesita igual que el panel real. Pero la Fase 7 los implementó primero
// en `comandos_archivo.rs`, ya verificado contra `cargo check`/`clippy` — dos
// implementaciones del mismo nombre de comando habrían competido por el mismo string en
// `generate_handler!` (`unreachable_patterns` bajo `-D warnings`), así que la
// integración se quedó con esa. No hace falta importarlas acá: `generate_handler!` las
// registra por nombre de comando y —como cualquier comando propio, ver el comentario de
// `capabilities/bandeja.json`— cualquier ventana puede invocarlas sin un permiso de ACL
// adicional; las capabilities solo gobiernan las APIs `core:`/de plugin.
