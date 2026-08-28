//! LA APP DE ESCRITORIO: un ícono en la barra y un popover. **`src/bin/bandeja/` es el
//! unico directorio del crate que conoce Tauri**, y eso no es prolijidad: es lo que deja
//! que el nucleo se siga cross-chequeando contra Windows y que las pruebas corran sin
//! levantar una ventana. Lo comprueba `el_nucleo_no_conoce_la_ventana` en
//! `tests/guardianes.rs`, que camina todo `src/` menos este directorio.
//!
//! Uso:
//! ```text
//!   node apps/folder-agent/sim/server.ts        # en otra terminal
//!   cargo run --bin bandeja -- [http://127.0.0.1:4477]
//! ```
//! Sin argumentos alcanza: el arranque decide solo entre mostrar el onboarding o la
//! bandeja — ver la rama `ya_vinculado` en `.setup()`.
//!
//! **SIN TOKEN AL ARRANCAR PIDE ONBOARDING; SIN TOKEN A MITAD DE SESION TOLERA IGUAL.**
//! Son dos momentos distintos. Al arrancar, `token.is_some()` es la señal que decide entre
//! mostrar `"onboarding"` (pantalla de vinculación) o `"bandeja"` directo — ver
//! `comandos_onboarding.rs` para las seis pantallas. Pero una vez que la bandeja ya está
//! mostrándose, un token que se revoca del lado del servidor no hace caer nada: el cliente
//! sale `SinAutenticar`, el servidor contesta `401`, la cola traduce eso a
//! `Desenlace::Credenciales` y el panel muestra «Sin acceso» — ese estado no hay que
//! fabricarlo, el agente lo alcanza solo.

mod comandos_archivo;
mod comandos_onboarding;
#[cfg(target_os = "macos")]
mod macos;

use savia_folder_aplicacion::ciclo;
use savia_folder_aplicacion::ciclo::ResultadoDelDrenaje;
use savia_folder_aplicacion::panel;
use savia_folder_contrato::dominio::{BarridoId, Instante, RaizId, RutaRelativa};
use savia_folder_contrato::plataforma::Plataforma;
use savia_folder_contrato::protocolo::{Credencial, Secreto};
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{MotivoDeDetencion, ParametrosDeCola};
use savia_folder_persistencia::persistencia::Deposito;
#[cfg(target_os = "macos")]
use savia_folder_plataforma_adaptadores::macos::Macos as PlataformaLocal;
use savia_folder_plataforma_adaptadores::observador::Observador;
#[cfg(target_os = "windows")]
use savia_folder_plataforma_adaptadores::windows::Windows as PlataformaLocal;
use savia_folder_politica::salvaguardas::Politica;
use savia_folder_protocolo::{BaseDeApi, Cliente, Tiempos};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, State, WebviewWindow};

/// Parametros de la DEMO, no del producto. Ver `parametros.rs`: los cuatro del canal
/// siguen en `None` y `Politica` no tiene `Default`, asi que hay que proveerlos acá.
mod demo {
    use std::time::Duration;
    pub const ASENTAMIENTO: Duration = Duration::from_millis(300);
    /// El MAXIMO entre barridos completos, no el unico disparador: `Observador`
    /// (`plataforma-adaptadores/src/observador.rs`) ya entrega señales por evento del
    /// sistema de archivos, y `trabajar()` fuerza un barrido completo apenas venza este
    /// intervalo desde el ultimo, haya o no señales pendientes — ver `ultimo_barrido_forzado`
    /// mas abajo.
    ///
    /// **DE 3 s A 30 s, Y ESO ES LO QUE HACE QUE EL OBSERVADOR SIRVA PARA ALGO.** Con 3 s
    /// el observador era peso muerto: sus señales son un subconjunto estricto de lo que el
    /// barrido ya encuentra —altas y cambios; las bajas nunca salen de un evento, ver
    /// `clasificar` en `observador.rs`— asi que su UNICO valor posible es dejar de barrer
    /// tan seguido, y con 3 s no dejaba de barrer nunca. La medicion que lo motivo: con
    /// `INTERVALO` en 3 s las vueltas tardaban ~5.3 s, o sea ~2.3 s de cada 5.3 s
    /// recorriendo carpetas y escribiendo el deposito — 43% del tiempo, permanentemente,
    /// revisando carpetas que no cambiaron.
    ///
    /// **EL PRECIO, NOMBRADO:** una aparicion detectada por evento se reconoce LOCAL al
    /// instante (el panel la muestra) pero no llega a Savia hasta el proximo barrido,
    /// porque `Colas::cerrar_segmento_de_eventos` se llama desde UN solo lugar y es
    /// `abrir_barrido` (`colas.rs:372`). O sea que subir este numero cambia latencia de
    /// subida por CPU. Quitarle ese precio —dejar que un segmento de Eventos cierre sin
    /// esperar un barrido— es un cambio al ciclo de vida de `Colas`, que se persiste, y
    /// va aparte.
    ///
    /// Sigue siendo un numero de DEMO y no una medicion: `parametros.rs` no tiene una
    /// constante para esto y no se inventa una. 30 s es «bastante mas que 3, bastante
    /// menos que el minuto», elegido para poder MEDIR el efecto, no para fijarlo.
    pub const INTERVALO: Duration = Duration::from_secs(30);
    pub const TIEMPO_DE_CONEXION: Duration = Duration::from_secs(5);
    pub const TIEMPO_POR_LLAMADA: Duration = Duration::from_secs(30);
    /// Cuantas filas por carpeta muestra el popover. `parametros::MAX_FILAS_DEL_PANEL`
    /// sigue en `None`: es un numero derivado de una medicion de layout que nadie hizo.
    pub const MAX_FILAS: usize = 8;
}

/// Un `Mutex<T>` que un comando escribe y `trabajar()` vacia entero, una vez por
/// vuelta, en su punto seguro. `por_quitar`/`token_pendiente`/`cerrar_sesion_pendiente`
/// eran tres copias a mano de este mismo mecanismo, y ya habian divergido: dos
/// no-opeaban en silencio sobre un lock envenenado, la tercera entraba en panic al
/// leer (`.expect("no se envenena")`) aunque su propio lado de escritura no-opeaba
/// igual que las otras dos. **La politica ahora es una sola, explicita: nunca panic.**
/// Un lock envenenado se trata igual que un buzon vacio — perder un comando encolado
/// por un hilo que ya entro en panic es preferible a que ESTE hilo, el unico que puede
/// persistir y cerrar la app con seguridad, tambien caiga.
struct Buzon<T>(Mutex<T>);

impl<T: Default> Buzon<T> {
    fn nuevo(valor: T) -> Self {
        Self(Mutex::new(valor))
    }

    /// El lado de escritura: un comando muta el contenido sin desarmar el mecanismo de
    /// drenaje.
    fn escribir(&self, f: impl FnOnce(&mut T)) {
        if let Ok(mut guardia) = self.0.lock() {
            f(&mut guardia);
        }
    }

    /// El lado de lectura de `trabajar()`: vacia el buzon y devuelve lo que tenia,
    /// dejando el default en su lugar. El unico llamador legitimo es el hilo de
    /// trabajo, en su punto seguro.
    fn tomar(&self) -> T {
        match self.0.lock() {
            Ok(mut guardia) => std::mem::take(&mut *guardia),
            Err(_) => T::default(),
        }
    }
}

/// El payload del evento `"progreso"` — aparte de `"cambio"` (que sigue siendo `()`, sin
/// payload) porque este SI necesita decir de que raiz y de que fase habla. `fase` es
/// `"leyendo"` o `"actualizando"`, las mismas dos claves que `panel::EstadoDeCarpeta`
/// serializa — el frontend hace `estado === progreso.fase` para saber si el contador que
/// llego todavia corresponde a lo que el badge esta mostrando.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Progreso {
    raiz: String,
    fase: &'static str,
    procesados: usize,
    total: usize,
}

/// **EL UNICO throttle, compartido por las dos fases.** La regla —emitir solo cuando el
/// porcentaje ENTERO cambia respecto del ultimo emitido— es aritmetica sobre
/// `(procesados, total)` y no depende de que este progresando, asi que vive una vez sola
/// en vez de una copia por fase. Acota los eventos a como mucho ~101 por raiz y por fase
/// —hay 101 porcentajes posibles, 0 a 100— sin importar el tamaño de la carpeta ni cuanto
/// crezca `total` sobre la marcha (`drenar_reportando` lo hace crecer cuando `Observar`
/// recien descubre bytes por subir — ver su doc en `ciclo.rs`). `anterior` es de quien
/// llama y no de esta funcion: cada raiz y cada fase necesitan la suya, para que
/// `Leyendo` y `Actualizando` no compartan el ultimo porcentaje visto.
fn cambio_de_porcentaje(anterior: &mut Option<u8>, procesados: usize, total: usize) -> bool {
    if total == 0 {
        return false;
    }
    let pct = ((procesados * 100) / total) as u8;
    if *anterior == Some(pct) {
        false
    } else {
        *anterior = Some(pct);
        true
    }
}

/// Lo que el popover consulta. **Un `Mutex` y no un canal**: la vista es una FOTO, y
/// quien la pide quiere la de ahora, no la secuencia de las que hubo.
struct Compartido {
    almacen: Mutex<Almacen>,
    plataforma: Arc<PlataformaLocal>,
    /// La base de la API. Los comandos de `comandos_onboarding` la necesitan para armar
    /// su propio `Cliente` de vinculación (sin token) — el mismo `String` que `main()`
    /// ya calcula para el `Cliente` del hilo de fondo.
    base: String,
    /// **LAS RAICES YA NO ESTAN ACA.** Estan en el inventario, que es el unico que las
    /// sabe y el unico que las persiste. Cuando eran una sola, tenerla al lado alcanzaba;
    /// con varias, dos listas es una que se desincroniza.
    ///
    /// Lo que si vive acá es la cola de las que hay que SACAR, porque sacar no se puede
    /// hacer en el momento en que se pide: ver `Colas::olvidar`, que necesita que no haya
    /// un barrido abierto. El comando encola y el hilo de trabajo lo hace en su punto
    /// seguro.
    por_quitar: Buzon<Vec<RaizId>>,
    /// El `Secreto` que el onboarding acaba de obtener (`comandos_onboarding::sondear_vinculacion`,
    /// caso `Aprobado`), esperando a que el hilo de trabajo lo recoja. Mismo patrón que
    /// `por_quitar`: un comando no puede persistir el token él mismo —el `Deposito` vive
    /// en `trabajar()`, no en `Compartido`— así que deja el `Secreto` acá y el hilo de
    /// trabajo lo vacía en su punto seguro, junto con `por_quitar`.
    token_pendiente: Buzon<Option<Secreto>>,
    /// En `true` mientras `elegir_carpeta_con_advertencia` tiene el diálogo nativo de
    /// carpeta abierto (`comandos_onboarding.rs`). Existe SOLO para que
    /// `macos::cerrar_al_clic_afuera` la consulte: ese diálogo es una ventana propia,
    /// afuera del marco del popover, así que cada clic adentro de él —elegir una
    /// carpeta, navegar, tocar "Abrir"— contaba como "clic afuera" y escondía la
    /// bandeja a mitad de la elección. El resultado visible era que "elegir una
    /// carpeta" parecía no hacer nada: la carpeta sí se agregaba, pero el popover que
    /// iba a mostrarlo ya estaba oculto.
    dialogo_de_carpeta_abierto: Mutex<bool>,
    /// En `true` cuando `cerrar_sesion` pidió terminar la sesión: desenrolar TODAS las
    /// raíces (ya encoladas en `por_quitar` por el propio comando) y borrar el token
    /// guardado. Mismo patrón que `token_pendiente`/`por_quitar` — un comando no puede
    /// hacer ninguna de las dos cosas él mismo — así que deja la bandera y el hilo de
    /// trabajo la resuelve en su punto seguro: la MISMA vuelta que vacía `por_quitar`
    /// también vacía el token, y el `deposito.guardar(...)` que ya corre cada vuelta
    /// persiste las dos mitades juntas, atómicas. Recién con eso guardado el hilo cierra
    /// la app — cerrarla antes dejaría el token viejo en disco y "cerrar sesión" no
    /// cerraría nada.
    cerrar_sesion_pendiente: Buzon<bool>,
}

impl Compartido {
    /// Saca `id` de `por_quitar` si estaba — un enrolamiento fresco (agregar de nuevo la
    /// misma raíz, o una candidata que resultó ser la misma huella) tiene que ganarle a un
    /// retiro que quedó pendiente de una acción anterior. Sin esto: desvincular encola el
    /// retiro, la persona se arrepiente y vuelve a elegir la misma carpeta en la ventana
    /// de hasta `demo::INTERVALO` antes de que el hilo de trabajo procese la cola, y ese
    /// retiro viejo la vuelve a sacar en la vuelta siguiente — la re-alta desaparece sola,
    /// sin ningún error que lo explique.
    fn cancelar_baja_pendiente(&self, id: &RaizId) {
        self.por_quitar.escribir(|cola| cola.retain(|r| r != id));
    }
}

/// **NINGUN COMANDO APAGA AL AGENTE A MEDIAS.** El panel puede mirar (`vista`), abrir
/// (`abrir_carpeta`), agregar (`elegir_carpeta_con_advertencia`, ver `comandos_onboarding.rs`),
/// dejar de mirar una carpeta (`comandos_archivo::desvincular`) o todas de una
/// (`cerrar_sesion`), reconectar (`iniciar_vinculacion`/`sondear_vinculacion`, ver
/// `comandos_onboarding.rs`), acomodarse (`ajustar_alto`) y salir — y nada mas. No hay
/// comando para forzar un barrido, y ya no hay uno para pausar: lo que la interfaz no
/// puede pedir no lo puede romper.
/// La otra mitad de sacarle el menu al icono: sin menu nativo, **salir tiene que estar en
/// el panel**.
#[tauri::command]
fn salir(app: tauri::AppHandle) {
    app.exit(0);
}

// ── POR QUE HAY COMANDOS CON `(async)` Y OTROS SIN ────────────────────────────────
//
// **UN COMANDO SIN `async` CORRE EN EL HILO PRINCIPAL** — el mismo que dibuja la ventana
// y atiende los clics. Lo dice la documentacion de Tauri de frente (`develop/calling-rust`,
// «Commands without the async keyword are executed on the main thread», y arriba de eso
// «Asynchronous commands are preferred... in a manner that doesn't result in UI freezes»).
// Asi que cualquier comando que pueda ESPERAR —un candado, la red— congela la interfaz
// mientras espera: no se repinta, no acepta clics, y el popover no se puede ni cerrar.
//
// **EL SINTOMA FUE REAL Y COSTO UNA SESION.** Tocar «Volver a vincular» dejaba la ventana
// colgada «pensando». El camino: `renderizar()` en `bandeja.js` termina en
// `invoke("ajustar_alto")` —o sea que hasta el repintado «local, sin pedirle nada a Rust»
// salta al hilo principal— y ahi hacia cola detras de un `vista` que estaba esperando
// `almacen.lock()`, que el hilo de trabajo sostiene durante TODO el barrido. Con las
// vueltas de entonces (3 s de intervalo, ~2.3 s de barrido) el hilo principal estaba
// bloqueado el 43% del tiempo.
//
// **LA REGLA, ENTONCES:** lleva `(async)` todo comando que pueda esperar un candado o la
// red. NO lo lleva `ajustar_alto`, y esa excepcion es obligatoria, no una omision:
// manipula la `NSWindow` de Cocoa, y macOS EXIGE que eso ocurra en el hilo principal —
// sacarlo de ahi es comportamiento indefinido, no una mejora.
//
// **`(async)` SOBRE UNA `fn` SINCRONICA, Y NO `async fn`.** Son cosas distintas: `async fn`
// no admite argumentos prestados como `State<'_, T>` (la propia doc lo marca con un
// `caution` y un issue abierto). `#[tauri::command(async)]` deja la funcion sincronica tal
// cual —misma firma, mismo `State<'_, …>`— y solo cambia DONDE corre. Es la forma que este
// codebase necesita.
//
// **LO QUE ESTO NO ARREGLA:** el candado sigue tomado durante todo el barrido, asi que el
// panel puede mostrar datos de hace un momento. La diferencia es que la ventana sigue
// viva mientras tanto. Que la espera casi desaparezca es otro cambio —no sostener el
// candado durante el I/O de red de `drenar`— y va aparte.

/// Encola TODAS las raíces para sacarlas y pide el borrado del token — ninguna de las
/// dos cosas la hace este comando: ver `Compartido::cerrar_sesion_pendiente`. Al volver
/// a arrancar sin token, `debe_mostrar_onboarding` manda de nuevo a la pantalla de
/// vinculación — no hace falta ningún mecanismo para cambiar de ventana en caliente, el
/// arranque ya sabe hacerlo.
///
/// `(async)` porque toma `almacen.lock()` — ver el bloque de arriba.
#[tauri::command(async)]
fn cerrar_sesion(estado: State<'_, Arc<Compartido>>) {
    let raices: Vec<RaizId> = {
        let almacen = estado.almacen.lock().expect("el almacen no se envenena");
        almacen
            .inventario()
            .raices()
            .into_iter()
            .map(|r| r.id)
            .collect()
    };
    estado.por_quitar.escribir(|cola| cola.extend(raices));
    estado
        .cerrar_sesion_pendiente
        .escribir(|bandera| *bandera = true);
}

/// Abre la raiz en el Finder. **Es la unica accion del panel que sale de la app**, y va
/// por `open` con la ruta que el agente ya tiene enrolada — nunca una que venga de la
/// interfaz: el popover no puede pedir que se abra una ruta arbitraria.
///
/// `(async)` porque toma `almacen.lock()` — ver el bloque sobre `(async)` mas arriba.
#[tauri::command(async)]
fn abrir_carpeta(estado: State<'_, Arc<Compartido>>, id: Option<String>) -> Result<(), String> {
    // **LA RUTA SALE DEL INVENTARIO, NUNCA DEL PARAMETRO.** Lo que la interfaz manda es
    // un `id`, y si no corresponde a ninguna raiz enrolada no se abre nada. Un comando
    // que aceptara la ruta seria «abri cualquier cosa de este disco» con otro nombre.
    let almacen = estado.almacen.lock().expect("el almacen no se envenena");
    let raices = almacen.inventario().raices();
    let elegida = match &id {
        Some(i) => raices.iter().find(|r| r.id.como_str() == i),
        None => raices.first(),
    }
    .ok_or("esa carpeta no esta enrolada")?;

    #[cfg(target_os = "macos")]
    let programa = "open";
    #[cfg(target_os = "windows")]
    let programa = "explorer";
    std::process::Command::new(programa)
        .arg(&elegida.ruta_absoluta)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// **EL ALTO LO PIDE EL PANEL Y LO APLICA RUST**, y no `setSize` desde JavaScript. Ver
/// `macos::ajustar_alto`: en macOS hay que fijar el borde de ARRIBA y invalidar la
/// sombra, y las dos cosas van con el cambio de tamaño o no van. Ademas asi el popover no
/// necesita el permiso `core:window:allow-set-size`: puede pedir un alto, no mover la
/// ventana.
///
/// **EL UNICO COMANDO QUE SE QUEDA SIN `(async)` A PROPOSITO, Y NO ES UN OLVIDO.**
/// Manipula la `NSWindow` de Cocoa, y macOS exige que eso corra en el hilo principal.
/// Puede permitirselo porque no espera nada: no toma ningun candado y no toca la red.
/// Ver el bloque sobre `(async)` mas arriba.
#[tauri::command]
fn ajustar_alto(ventana: WebviewWindow, alto: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::ajustar_alto(&ventana, alto);
    #[cfg(not(target_os = "macos"))]
    {
        ventana
            .set_size(tauri::LogicalSize::new(340.0, alto))
            .map_err(|e| e.to_string())
    }
}

//
// **`State<Arc<Compartido>>` Y NO `State<Compartido>`.** Tauri resuelve el estado por
// tipo EXACTO contra lo que se paso a `.manage()`, y acá se pasa un `Arc` porque el hilo
// de trabajo tiene la otra punta. Pedir `State<Compartido>` compila igual —el desajuste
// no es de tipos, es de una tabla que se llena en runtime— y explota recien al invocar
// el comando: «state not managed for field `estado`».
//
// **`(async)`, Y ES EL MAS IMPORTANTE DE LOS OCHO.** Toma `almacen.lock()`, y es el que
// corre en CADA repintado: el panel lo llama al abrirse y en cada `"cambio"` que emite el
// hilo de trabajo. Era la pieza concreta que bloqueaba el hilo principal mientras el
// barrido tenia el candado. Ver el bloque sobre `(async)` mas arriba.
#[tauri::command(async)]
fn vista(estado: State<'_, Arc<Compartido>>) -> panel::Vista {
    let almacen = estado.almacen.lock().expect("el almacen no se envenena");
    panel::vista(&almacen, estado.plataforma.as_ref(), demo::MAX_FILAS)
}

/// La condicion de arranque, aislada para que quede blindada por una prueba: es facil
/// que alguien la "simplifique" a "¿el almacen tiene alguna raiz?" mas adelante sin ver
/// por que eso esta mal — ver el comentario donde se llama, en `.setup()`.
fn debe_mostrar_onboarding(token: &Option<Secreto>) -> bool {
    token.is_none()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // **UN SOLO OVERRIDE, Y ES DE DESARROLLO.** La ruta ya no entra por acá — el arranque
    // la resuelve solo, ver `.setup()`. `base` sigue siendo posicional para poder apuntar
    // rapido al servidor simulado sin tocar codigo; el default de produccion no cambia.
    let base = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "http://127.0.0.1:4477".into());

    let plataforma = Arc::new(PlataformaLocal::nueva()?);

    tauri::Builder::default()
        // **PRIMERO, ANTES DE CUALQUIER OTRO PLUGIN.** Todo lo que corre despues —
        // incluido el resto de `.setup()`, donde arrancan el deposito, el observador y el
        // hilo de trabajo— ya tiene que poder loggear. `Stdout` es lo que ya se leia hoy
        // en la terminal; `LogDir` es nuevo y persiste a
        // `~/Library/Logs/uno.savia.agente/` en macOS — la falta de esto fue real: un 401
        // del simulador dejaba el drenaje detenido sin ningun rastro, y para cuando se
        // pensaba en mirar la terminal ya se habia perdido. `Debug` como maximo (no
        // `Info`) es deliberado mientras el observador de filesystem sigue en
        // verificacion manual — cuesta mas ruido por vuelta, pero es la unica manera de
        // ver la traza de `[barrido completo]`/`[evento del observador]`.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        // **ARRANCAR AL INICIAR SESION SE REGISTRA ACA Y NO SE ENCIENDE ACA.** El plugin
        // deja el `LaunchAgent` disponible; **encenderlo es una decision de la persona**,
        // y va en la ultima pantalla del onboarding. Un agente que se auto-instala en el
        // arranque la primera vez que lo abris esta cambiando la configuracion de la
        // maquina sin preguntar — y ademas es lo primero que alguien busca cuando quiere
        // sacarlo, asi que esconderlo lo hace parecer lo que no es.
        //
        // `LaunchAgent` y no `AppleScript`: es el mecanismo que aparece en Ajustes del
        // Sistema → Elementos de inicio, o sea el lugar donde la persona lo va a buscar.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // El actualizador. La clave publica y el endpoint viven en `tauri.conf.json`; lo
        // que firma los artefactos es la PRIVADA, que no esta en el repo y entra por
        // variable de entorno al empaquetar. Ver `docs/.../distribucion-agente.md`.
        //
        // **`macos-universal` COMO OBJETIVO, Y NO EL `{{target}}-{{arch}}` POR OMISION.**
        // Se empaqueta un binario universal —`--target universal-apple-darwin`, un solo
        // `.dmg` que corre en Intel y en Apple Silicon—, asi que el par objetivo/arquitectura
        // por omision partiria en dos (`darwin-x86_64` y `darwin-aarch64`) algo que es un
        // archivo solo, y habria que publicar el MISMO paquete bajo dos claves. Es lo que
        // la documentacion nombra «custom target»: el valor que se pone acá es la clave que
        // se busca en el `latest.json`.
        .plugin({
            let b = tauri_plugin_updater::Builder::new();
            #[cfg(target_os = "macos")]
            let b = b.target("macos-universal");
            b.build()
        })
        .manage(comandos_onboarding::EstadoDeVinculacion(Mutex::new(None)))
        .manage(comandos_onboarding::CandidataPendiente(Mutex::new(None)))
        .manage(comandos_onboarding::OnboardingTerminado(Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            vista,
            salir,
            cerrar_sesion,
            abrir_carpeta,
            ajustar_alto,
            comandos_archivo::desvincular,
            comandos_archivo::abrir_archivo,
            comandos_onboarding::iniciar_vinculacion,
            comandos_onboarding::sondear_vinculacion,
            comandos_onboarding::permiso_de_disco_concedido,
            #[cfg(target_os = "macos")]
            comandos_onboarding::abrir_ajustes_de_privacidad,
            comandos_onboarding::elegir_carpeta_con_advertencia,
            comandos_onboarding::reemplazar_carpeta,
            comandos_onboarding::terminar_onboarding
        ])
        .setup(move |app| {
            // **UN AGENTE DE BANDEJA NO VA AL DOCK NI AL CONMUTADOR DE APPS.** Sin esto
            // macOS lo trata como una app normal: icono en el Dock, entrada en Cmd+Tab y
            // un menu «Savia» en la barra que no tiene nada adentro. `Accessory` es la
            // politica que el SO reserva para lo que vive en la barra de estado — el
            // equivalente de `LSUIElement`, pero puesto acá para que valga tambien
            // corriendo el binario sin empaquetar.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // ── EL DEPOSITO, RECIEN ACA ──────────────────────────────────────
            //
            // Antes vivia antes de `tauri::Builder`, en `std::env::temp_dir()` — un
            // directorio que macOS puede purgar y que ademas exigia una `ruta` por CLI
            // para chequear que el deposito no cayera adentro de la raiz vigilada. Las
            // dos cosas se resuelven juntas ahora: `app.path().app_data_dir()` solo esta
            // disponible con un `App`/`AppHandle` de verdad, y ese directorio es fijo y
            // separado de cualquier carpeta que la persona pueda elegir — la colision que
            // el chequeo viejo prevenia ya no puede pasar por construccion.
            let carpeta_de_datos = app.path().app_data_dir()?;
            std::fs::create_dir_all(&carpeta_de_datos)?;
            let deposito_ruta = carpeta_de_datos.join("savia-folder-agent.redb");
            // **RECONSTRUIR ANTES DE ABRIR, Y EN CADA ARRANQUE.** Ver
            // `Deposito::reconstruir` para las mediciones: el archivo de `redb` nunca baja
            // de su marca de agua historica, asi que sin esto un deposito que alguna vez
            // fue grande se queda grande para siempre — 1216 MB para 684 KB de estado
            // vivo, en el caso que lo destapo.
            //
            // **EN CADA ARRANQUE Y SIN UMBRAL, A PROPOSITO.** Un umbral («reconstruir si
            // el archivo supera N veces su contenido») seria un numero que decide
            // comportamiento y que nadie midio — justo lo que `parametros.rs` prohibe
            // inventar. Y no hace falta: reconstruir cuesta UN `guardar()` de mas, que en
            // release son milisegundos, contra un arranque que ya tarda segundos. Se paga
            // siempre, es barato siempre, y no hay ningun caso en que el archivo se pueda
            // ir de proporcion sin que el proximo arranque lo enderece.
            //
            // Un fallo NO es fatal: un deposito grande que funciona es mejor que una app
            // que no arranca. Se avisa y se sigue con el que hay.
            match Deposito::reconstruir(&deposito_ruta) {
                Ok((antes, despues)) if despues < antes => log::info!(
                    "deposito reconstruido: {} KB -> {} KB",
                    antes / 1024,
                    despues / 1024
                ),
                Ok(_) => {}
                Err(e) => log::warn!("no se pudo reconstruir el deposito, se sigue con el que hay: {e}"),
            }
            let deposito = Deposito::abrir(&deposito_ruta).map_err(|e| e.to_string())?;

            // Un deposito ilegible detiene el arranque. Absorberlo como «empiezo de
            // cero» pierde todas las lapidas, y lo borrado mientras el agente estuvo
            // apagado no lo ve faltar ningun barrido posterior.
            let (almacen, token) = match deposito.cargar().map_err(|e| e.to_string())? {
                Some(r) => {
                    log::info!("deposito  {} (recuperado)", deposito_ruta.display());
                    (r.almacen, r.credencial)
                }
                None => {
                    log::info!("deposito  {} (nuevo)", deposito_ruta.display());
                    (
                        Almacen::nuevo(ParametrosDeCola {
                            max_intentos: None,
                            max_entradas_por_lote: None,
                        }),
                        None,
                    )
                }
            };
            // **LA SEÑAL DE ARRANQUE ES EL TOKEN, NO LAS RAICES ENROLADAS.** El paso caro
            // que el onboarding provee es vincular el dispositivo; elegir carpeta ya esta
            // disponible desde siempre en el panel (`comandos_onboarding::elegir_carpeta_con_advertencia`,
            // el mismo comando que usa la pantalla 4). Alguien que se vincula y despues
            // desvincula todas sus carpetas por el panel sigue siendo un dispositivo
            // conocido — no vuelve a pasar por la pantalla de vinculacion. Ver
            // `debe_mostrar_onboarding` y sus pruebas.
            let ya_vinculado = !debe_mostrar_onboarding(&token);
            match &token {
                Some(_) => log::info!("token     recuperado del deposito"),
                None => log::info!("token     NO HAY — arranca el onboarding"),
            }
            log::info!("api       {base}");

            let compartido = Arc::new(Compartido {
                almacen: Mutex::new(almacen),
                plataforma: plataforma.clone(),
                base: base.clone(),
                por_quitar: Buzon::nuevo(Vec::new()),
                token_pendiente: Buzon::nuevo(None),
                dialogo_de_carpeta_abierto: Mutex::new(false),
                cerrar_sesion_pendiente: Buzon::nuevo(false),
            });
            app.manage(Arc::clone(&compartido));

            let ventana = app
                .get_webview_window("bandeja")
                .expect("la ventana esta declarada en tauri.conf.json");

            // **ACA LA VENTANA DEJA DE SER UNA VENTANA.** Ver `macos.rs`: sin esto una
            // app `Accessory` no retiene el foco y el popover se cierra en el mismo
            // frame en que se abre. Si falla, se avisa y se sigue — un popover sin
            // convertir es peor, no inservible.
            #[cfg(target_os = "macos")]
            if let Err(e) = macos::convertir_en_panel(&ventana) {
                log::warn!("el popover no se pudo convertir en panel: {e}");
            }

            // EL POPOVER SE CIERRA AL HACER CLIC AFUERA. Es lo que lo hace un popover
            // y no una ventana: si se queda abierto, el agente pasa de estar disponible
            // a estar encima.
            //
            // **Y se cierra por el CLIC, no por la perdida del foco.** La version
            // anterior escuchaba `Focused(false)` y se cerraba sola dos de cada tres
            // veces; ver `macos::cerrar_al_clic_afuera` para por que ninguna guarda
            // arregla eso y el clic si.
            #[cfg(target_os = "macos")]
            {
                let w = ventana.clone();
                let c = Arc::clone(&compartido);
                if let Err(e) = macos::cerrar_al_clic_afuera(&ventana, move || {
                    // Con el diálogo nativo de carpeta abierto, todo clic cae afuera
                    // del marco del popover por definición — ver el comentario de
                    // `Compartido::dialogo_de_carpeta_abierto`. Ignorar el cierre acá,
                    // no en el monitor: es este callback el que sabe qué significa
                    // "afuera" para el popover, no el monitor genérico de macos.rs.
                    if *c.dialogo_de_carpeta_abierto.lock().expect("no se envenena") {
                        return;
                    }
                    let _ = w.hide();
                }) {
                    log::warn!("el popover no va a cerrarse al clic afuera: {e}");
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let w = ventana.clone();
                ventana.on_window_event(move |e| {
                    if let tauri::WindowEvent::Focused(false) = e {
                        let _ = w.hide();
                    }
                });
            }

            // ── LA RAMA DE ARRANQUE ───────────────────────────────────────────
            //
            // Sin token: mostrar el onboarding, no la bandeja. `"onboarding"` nunca pasa
            // por `macos::convertir_en_panel` — es una `NSWindow` comun, con
            // decoraciones — asi que a diferencia de `alternar()` (mas abajo) SI le toca
            // `set_focus()`: `Accessory` solo esconde el icono del Dock y la entrada en
            // Cmd+Tab, no le impide a una ventana normal tomar foco y activar la app.
            if !ya_vinculado {
                let onboarding = app
                    .get_webview_window("onboarding")
                    .expect("la ventana esta declarada en tauri.conf.json");

                // **LA BANDERA, NO LA VISIBILIDAD DE `"bandeja"`.** `.close()` dispara el
                // mismo `WindowEvent::CloseRequested` que la cruz nativa o Cmd+W — Tauri
                // lo documenta asi — asi que `terminar_onboarding` cerrando esta ventana
                // en su camino de EXITO tambien pasaria por acá. Sin la bandera, terminar
                // bien se confundiria con abandonar a mitad de camino. Comparar contra la
                // visibilidad de `"bandeja"` no sirve: `terminar_onboarding` cierra el
                // onboarding ANTES de mostrar la bandeja, en el mismo llamado — el evento
                // siempre llega con la bandeja todavia oculta, incluso cuando todo salio
                // bien.
                let salir_si_se_abandona = app.handle().clone();
                onboarding.on_window_event(move |e| {
                    if let tauri::WindowEvent::CloseRequested { .. } = e {
                        let terminado = salir_si_se_abandona
                            .state::<comandos_onboarding::OnboardingTerminado>();
                        let ya_termino = *terminado.0.lock().expect("no se envenena");
                        if !ya_termino {
                            // Sin esto el proceso queda vivo sin ninguna ventana
                            // alcanzable: `Accessory` lo esconde del Dock/Cmd+Tab y la
                            // bandeja nunca se mostro, asi que tampoco hay tray-click que
                            // lo traiga de vuelta.
                            //
                            // Limite conocido: si esto pasa justo despues de que
                            // `sondear_vinculacion` aprobó un código pero antes de que
                            // `trabajar()` drene `token_pendiente` (hasta demo::INTERVALO
                            // de ventana hoy), ese token recien conseguido se pierde y
                            // hay que volver a escanear. Mismo riesgo que ya tiene
                            // `salir()` — el deposito solo hace checkpoint donde un
                            // barrido termina, no por mutacion — no es nuevo de esta
                            // rama.
                            salir_si_se_abandona.exit(0);
                        }
                    }
                });
                let _ = onboarding.show();
                let _ = onboarding.set_focus();
            }

            // **EL ICONO NO LLEVA MENU NATIVO, Y NO ES UN RECORTE.** Un menu ahi
            // duplicaria lo que el panel ya dice —«Ajustes», «Salir»— en un vocabulario
            // que no es el del sistema de diseno: tipografia del SO, sin estados, sin el
            // punto. Dos lugares para lo mismo, y el que el usuario descubre primero es
            // el que no diseñamos.
            //
            // Ademas quita una fuente de fallas: con un menu adjunto, macOS atiende el
            // clic para desplegarlo y `on_tray_icon_event` puede no llegar nunca.
            let w = ventana.clone();
            TrayIconBuilder::new()
                // **LOS BYTES EXACTOS, NO `default_window_icon()`.** Ese devuelve el
                // icono de la APP, que Tauri arma escalando `icon.png` hacia el `.icns`;
                // la bandeja despues lo bajaba a 22 pt, o sea DOS remuestreos encima del
                // otro. El sintoma era «se ve ultra borroso». `iconTemplate.png` mide
                // 44x44 —22 pt @2x— asi que en un Retina cae pixel a pixel.
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../../../icons/iconTemplate.png"
                ))?)
                // **`icon_as_template` es lo que hace que se vea.** Sin esto, macOS pinta
                // el PNG tal cual: negro sobre una barra oscura. Con esto, el SO usa el
                // alfa como forma y lo tine segun el modo.
                .icon_as_template(true)
                .on_tray_icon_event(move |_, e| {
                    // **`Up` Y NO `Down`.** macOS resalta el icono en el `Down` y suelta
                    // el resaltado en el `Up`; abrir en el `Down` deja el icono resaltado
                    // encima de un popover ya abierto.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = e
                    {
                        alternar(&w, rect);
                    }
                })
                .build(app)?;

            // ── EL HILO QUE TRABAJA ──────────────────────────────────────────
            //
            // Va aparte del de la interfaz porque un barrido de 40.000 rutas bloquearia
            // el popover mientras corre, y un panel congelado es peor que uno vacio: no
            // se distingue de la app colgada.
            let c = Arc::clone(&compartido);
            let base = base.clone();
            let app = app.handle().clone();

            // **EL OBSERVADOR SE ARMA ACA, NO ADENTRO DE `trabajar()`.** `demo::ASENTAMIENTO`
            // (300ms) esta PRESTADO como ventana de debounce del observador — no es una
            // medicion propia de `VENTANA_DEL_OBSERVADOR` (`parametros.rs`), que sigue
            // `Pendiente` a proposito: nada en este diseño todavia junta la evidencia que
            // la justificaria. Ver el `Contadores` de `Asentador` para la via real de
            // eventualmente medirla.
            //
            // **UN ERROR ACA NO ES FATAL.** Si `Observador::nuevo` falla (el SO no deja
            // levantar un watcher, un limite de descriptores, etc.) se loggea y
            // `trabajar()` recibe `None` en su lugar: el comportamiento con el observador
            // ausente tiene que ser IDENTICO al de hoy, barrido cada `demo::INTERVALO` sin
            // excepcion — nunca la app entera.
            // `Arc::clone(&c.plataforma)` a secas no infiere: la forma asociada empuja el
            // tipo esperado (`Arc<dyn Plataforma>`) hacia ADENTRO del generico de
            // `Arc::clone`, y ahi exige un `&Arc<dyn Plataforma>` que `c.plataforma`
            // (`Arc<PlataformaLocal>`, `Macos`/`Windows`) no es. La forma metodo
            // (`.clone()`) resuelve sobre el tipo concreto del receptor primero, y recien
            // despues la anotacion de la variable dispara la coercion a trait object —
            // por eso esta, y no `Arc::clone`, es la que compila.
            let plataforma_del_observador: Arc<dyn Plataforma> = c.plataforma.clone();
            let (observador, receptor_de_senales) =
                match Observador::nuevo(plataforma_del_observador, demo::ASENTAMIENTO) {
                    Ok((obs, rx)) => (Some(obs), Some(rx)),
                    Err(e) => {
                        log::warn!(
                            "el observador de filesystem no arranco, se sigue solo con barrido periodico: {e}"
                        );
                        (None, None)
                    }
                };

            std::thread::spawn(move || {
                if let Err(e) = trabajar(c, deposito, token, &base, &app, observador, receptor_de_senales)
                {
                    log::error!("el hilo de trabajo murio: {e}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

/// Muestra u oculta el popover, pegado al icono.
///
/// **TODA LA MATEMATICA DE PANTALLAS SE FUE A `macos.rs`, Y NO POR PROLIJIDAD.** Las
/// cuatro versiones anteriores de esta funcion la hacian acá con la API portable de
/// Tauri —buscar el monitor con `monitor_from_point`, centrar con `outer_size()`,
/// recortar contra `Monitor::size()`— y las cuatro fallaron por la misma causa: en macOS
/// **eso no es un espacio de coordenadas**. Ver el encabezado de `macos.rs`.
///
/// Lo que queda acá es lo unico que es de esta funcion: la alternancia.
fn alternar(w: &WebviewWindow, icono: tauri::Rect) {
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
        return;
    }

    // **UBICAR ANTES DE MOSTRAR.** `setFrame:` de AppKit aplica con la ventana oculta,
    // asi que este orden evita que el popover se vea saltar desde donde estaba.
    #[cfg(target_os = "macos")]
    {
        let pos = icono.position.to_physical::<f64>(1.0);
        let tam = icono.size.to_physical::<f64>(1.0);
        if let Err(e) = macos::ubicar_bajo_el_icono(w, pos.x, tam.width) {
            log::warn!("el popover no se pudo ubicar: {e}");
        }
    }
    // En Windows la API portable ALCANZA: hay un solo espacio de coordenadas fisicas y
    // el `rect` de la bandeja viene entero. Ver el encabezado de `macos.rs` para por que
    // en macOS no.
    #[cfg(target_os = "windows")]
    {
        let pos = icono.position.to_physical::<f64>(1.0);
        let tam = icono.size.to_physical::<f64>(1.0);
        if let Ok(ventana) = w.outer_size() {
            let x = pos.x + tam.width / 2.0 - ventana.width as f64 / 2.0;
            let _ = w.set_position(tauri::PhysicalPosition::new(
                x,
                pos.y - ventana.height as f64,
            ));
        }
    }

    // **NI `show()` NI `set_focus()` EN MACOS.** Ver `macos::mostrar`: el `set_focus` de
    // Tauri activa la aplicacion, y eso es lo unico que un panel no-activador no puede
    // permitirse.
    #[cfg(target_os = "macos")]
    if let Err(e) = macos::mostrar(w) {
        log::warn!("el popover no se pudo mostrar: {e}");
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Arma un `Cliente` con la credencial que `token` implica. Se llama cada vez que
/// `trabajar()` adopta un token nuevo o lo pierde (`token_pendiente` drenado, sesion
/// cerrada) — antes era el mismo `match` de tres lineas mas `Cliente::nuevo(...)`
/// copiado en los tres sitios, uno de ellos ya simplificado a mano y por eso distinto
/// del resto.
fn cliente_desde(token: &Option<Secreto>, base: &BaseDeApi, tiempos: Tiempos) -> Cliente {
    let credencial = match token {
        Some(s) => Credencial::TokenDeDispositivo(s.clone()),
        None => Credencial::SinAutenticar,
    };
    Cliente::nuevo(base.clone(), credencial, tiempos)
}

/// Barre, drena y guarda, para siempre. **YA NO SOLO REACCIONA AL RELOJ**: si `observador`
/// esta presente, cada vuelta primero espera hasta `demo::INTERVALO` a que
/// `receptor_de_senales` entregue algo — un toque de debounce del observador de
/// filesystem, ya asentado — y solo si nada llega a tiempo (o si ya paso `demo::INTERVALO`
/// desde el ultimo barrido completo, o si el observador pidio un barrido urgente) esta
/// vuelta hace el barrido completo de siempre. Con `observador` en `None` (arranco mal, o
/// nunca se pidio) el comportamiento es BYTE A BYTE el de antes de este modulo: barrido
/// completo cada `demo::INTERVALO`, sin excepcion — ver `Observador::nuevo` en `.setup()`.
fn trabajar(
    c: Arc<Compartido>,
    deposito: Deposito,
    token: Option<Secreto>,
    base: &str,
    app: &tauri::AppHandle,
    observador: Option<Observador>,
    receptor_de_senales: Option<mpsc::Receiver<(RaizId, RutaRelativa)>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let politica = Politica::con_asentamiento(demo::ASENTAMIENTO)
        .expect("la demo provee un intervalo no nulo a proposito");
    let tiempos = Tiempos {
        conexion: demo::TIEMPO_DE_CONEXION,
        por_llamada: demo::TIEMPO_POR_LLAMADA,
        envio_de_cuerpo: None,
    };
    let base_de_api = BaseDeApi::nueva(base)?;
    // `token` y `cliente` dejan de ser fijos por toda la vida del hilo: el onboarding
    // puede dejar un `Secreto` nuevo en `Compartido::token_pendiente` en cualquier
    // momento, y hay que reconstruir el `Cliente` con la credencial que trae.
    let mut token = token;
    let mut cliente = cliente_desde(&token, &base_de_api, tiempos);

    let mut n: u64 = 0;
    // `Instante` (`savia_folder_contrato::dominio::Instante`) y NO `std::time::Instant`:
    // con la laptop dormida, `Instant` pierde tiempo real transcurrido (medido,
    // `dominio.rs:444-458`) y la garantia de "como mucho `demo::INTERVALO` sin barrido
    // completo" se rompe por un mecanismo distinto al que esta vuelve a cerrar.
    let mut ultimo_barrido_forzado: Instante = c.plataforma.ahora();
    // Toques ya asentados por el observador, todavia sin atender. Se llenan al final de
    // la vuelta (si `receptor_de_senales` entrega algo antes de que venza el timeout) y
    // se consumen al principio de la siguiente.
    let mut senales_pendientes: Vec<(RaizId, RutaRelativa)> = Vec::new();
    // **LA DETENCION ERA COMPLETAMENTE MUDA, Y ESE ES EL BUG QUE ESTO CIERRA.** Cuando
    // la cola esta detenida, `drenar` sale por `Proximo::Detenida` (`ciclo.rs`) SIN
    // empujar nada a la traza, y acá el valor de retorno se tiraba. Resultado: un
    // dispositivo con el token revocado barre para siempre, no sube nada, y el log se ve
    // IDENTICO a uno que no tiene nada que subir. Costo dos sesiones de diagnostico.
    //
    // Se avisa SOLO EN LA TRANSICION y no en cada vuelta: es un estado permanente (no se
    // limpia con el tiempo, solo con un token nuevo — ver `Colas::reanudar`), asi que
    // repetirlo cada vuelta por cada raiz ahogaria todo lo demas.
    let mut detencion_avisada: Option<MotivoDeDetencion> = None;
    loop {
        n += 1;
        // **PRIMER BLOQUE: SOLO EL DRENAJE DE COLAS Y LEER EL INVENTARIO.** El candado se
        // suelta apenas termina — `sincronizar` hace syscalls reales (`watch`/`unwatch`,
        // latencia no acotada) y sostenerlas con el candado tomado colgaria "Agregar
        // carpeta" en la UI cada vuelta, no solo en las de barrido.
        let (raices_registradas, cerrando_sesion, token_cambio) = {
            let mut almacen = c.almacen.lock().expect("el almacen no se envenena");
            // Un token nuevo O una sesion cerrada TIENEN que llegar al disco esta misma
            // vuelta, corra o no un barrido — ver la condicion de `guardar` mas abajo.
            let mut token_cambio = false;

            // **EL PUNTO SEGURO PARA SACAR RAICES: ACA, ANTES DE ABRIR NINGUN BARRIDO.**
            // `Colas::olvidar` no puede correr con un segmento abierto —dejaria un
            // `sweepId` colgado del lado de Savia— y este es el unico instante del
            // proceso en el que se sabe con certeza que no hay ninguno. Por eso el
            // comando encola en vez de hacerlo, y por eso sacar una carpeta tarda como
            // mucho una vuelta.
            for raiz in c.por_quitar.tomar() {
                match almacen.desenrolar(&raiz) {
                    Some(soltados) => {
                        log::info!("quitada {} ({soltados} trabajos soltados)", raiz.como_str())
                    }
                    None => log::info!("quitar {}: no estaba enrolada", raiz.como_str()),
                }
            }

            // Mismo punto seguro que arriba, mismo motivo de fondo: es donde el hilo de
            // trabajo sabe con certeza que no hay nada a medio actualizar. Ver
            // `Compartido::token_pendiente` y el punto 5 de la integración documentado
            // en `comandos_onboarding.rs`.
            if let Some(nuevo) = c.token_pendiente.tomar() {
                token = Some(nuevo);
                cliente = cliente_desde(&token, &base_de_api, tiempos);
                // Un token nuevo es la unica razon legitima para volver a intentar
                // despues de `Desenlace::Credenciales` — ver `Colas::reanudar`. Sin
                // esto, aprobar "Volver a vincular" deja `detenido` pegado para
                // siempre y el panel sigue pidiendo vincular aunque el token ya sea
                // valido.
                almacen.reanudar();
                token_cambio = true;
                log::info!("token recibido del onboarding");
            }

            // `cerrar_sesion` DESPUES de `token_pendiente`, a proposito: si las dos
            // llegaran juntas —alguien reconectando justo cuando otra pestaña pide
            // cerrar sesion, un caso de borde real aunque infrecuente— cerrar sesion
            // tiene que ganar. `por_quitar` ya vacio el almacen unas lineas arriba.
            let cerrando_sesion = c.cerrar_sesion_pendiente.tomar();
            if cerrando_sesion {
                token = None;
                cliente = cliente_desde(&token, &base_de_api, tiempos);
                log::info!("sesion cerrada — token borrado, todas las carpetas desenroladas");
            }

            (almacen.inventario().raices(), cerrando_sesion, token_cambio)
        }; // candado del almacen suelto aca — lo que sigue son syscalls (`sincronizar`).

        if let Some(obs) = &observador {
            obs.sincronizar(&raices_registradas);
        }
        // **UNA VUELTA POR RAIZ, Y EL ORDEN NO IMPORTA.** El inventario y las
        // salvaguardas siempre estuvieron modelados por raiz (decision 3), asi que esto
        // no es un cambio de diseño: es que el bucle deje de tener UNA clavada. Cada raiz
        // abre y cierra su propio barrido; que dos raices esten en estados distintos es
        // lo normal, y el panel ya sabe agregarlo por el peor.
        let raices: Vec<RaizId> = raices_registradas.iter().map(|r| r.id.clone()).collect();

        // **LAS TRES RAZONES PARA FORZAR UN BARRIDO COMPLETO ESTA VUELTA, NINGUNA
        // OPCIONAL.** `n == 1`: `Instante` no sabe sumar una `Duration` a proposito (ver
        // su doc), asi que la primera vuelta no tiene forma de comparar contra un
        // "todavia no paso nada" — necesita su propia condicion explicita en vez del
        // truco de "un instante recien creado ya es `>=` a si mismo". El tiempo
        // transcurrido: la garantia de siempre, como mucho `demo::INTERVALO` sin un
        // barrido completo — es lo que evita la inanicion de un chorro de señales que no
        // para nunca. Y `tomar_pedido_de_barrido_urgente`: un rescan o un error del canal
        // de `notify` significa que el observador ya no puede garantizar que vio todo.
        // `urgente` se evalua siempre, sin cortocircuito: es un swap que CONSUME la
        // bandera (`tomar_pedido_de_barrido_urgente`), y dejarla adentro de la cadena
        // `||` la saltearia en cualquier vuelta donde ya sea cierto `n == 1` o el
        // intervalo — quedaria sin consumir, no perdida (la proxima vuelta que si la
        // evalue la ve en `true`), pero es una vuelta menos fiel al diseño: la bandera
        // tiene que vaciarse en CADA vuelta, la fuerce o no a forzar el barrido.
        let urgente = observador
            .as_ref()
            .is_some_and(|o| o.tomar_pedido_de_barrido_urgente());
        let forzar_barrido = n == 1
            || c.plataforma
                .ahora()
                .transcurrido_desde(ultimo_barrido_forzado)
                >= demo::INTERVALO
            || urgente;

        {
            let mut almacen = c.almacen.lock().expect("el almacen no se envenena");
            // **CUANTO TIEMPO ESTE BLOQUE RETIENE EL CANDADO ES, LITERALMENTE, CUANTO
            // ESPERA UN BOTON DEL PANEL.** Es el mismo `Mutex` que toman `vista`,
            // `abrir_carpeta`, `abrir_archivo` y compañia; mientras el hilo de trabajo lo
            // tiene, cualquier accion de la interfaz que lo necesite hace cola. Medirlo
            // acá —y no a ojo— es lo unico que vuelve discutible con numeros si hace falta
            // sacar el I/O de red de `drenar` fuera de la seccion critica.
            let candado_tomado_en = c.plataforma.ahora();
            let mut traza = Vec::new();
            // A NIVEL `debug`: distingue las dos ramas de abajo (barrido completo vs. solo
            // atender señales del observador) — es lo que permitio confirmar, contra la
            // app real, que el camino rapido de `atender_evento` efectivamente se toma.
            let senales_descartadas_por_forzar = forzar_barrido && !senales_pendientes.is_empty();
            // Lo que las llamadas a `drenar` de esta vuelta hayan reportado. `detenido` es
            // una bandera del almacen y no de cada raiz, asi que alcanza con quedarse con
            // el ultimo motivo visto: todas las raices dicen lo mismo.
            let mut detenida_esta_vuelta: Option<MotivoDeDetencion> = None;
            // La condicion de la rama, nombrada: la necesita tambien el `guardar` de mas
            // abajo, y tenerla en una variable evita que las dos se separen.
            let hubo_barrido = forzar_barrido || senales_pendientes.is_empty();
            if hubo_barrido {
                // Un barrido completo ya cubre cualquier ruta que estas señales iban a
                // atender — dejarlas colgadas solo duplicaria trabajo la proxima vuelta
                // que NO fuerce un barrido.
                senales_pendientes.clear();
                log::debug!(
                    "[barrido completo] n={n} urgente={urgente} señales_descartadas={senales_descartadas_por_forzar}"
                );
                // **`barrer_reportando`/`drenar_reportando`, con el throttle por
                // porcentaje de `cambio_de_porcentaje`.** El canal de progreso que la
                // Fase 7 construyo (`ciclo::barrer_reportando`, `tests/progreso.rs`)
                // quedaba sin conectar porque enchufarlo a un evento real necesitaba
                // decidir CADA cuanto emitir — miles de archivos no pueden ser miles de
                // `app.emit` — y ese numero nadie lo habia medido. `cambio_de_porcentaje`
                // resuelve eso sin inventar ningun numero: acota a ~101 eventos por raiz y
                // por fase, una propiedad estructural (101 porcentajes posibles), no un
                // umbral calibrado. Ver su doc, y el de `drenar_reportando` en `ciclo.rs`
                // para por que el total de `Actualizando` no es una constante.
                for raiz in &raices {
                    let mut ultimo_leyendo: Option<u8> = None;
                    ciclo::barrer_reportando(
                        raiz,
                        // El id lleva la raiz adentro: dos barridos de la misma vuelta
                        // sobre raices distintas no pueden compartir `BarridoId`.
                        BarridoId::nuevo(format!("barrido-{n}-{}", raiz.como_str())),
                        c.plataforma.as_ref(),
                        &mut almacen,
                        &politica,
                        &mut |procesados, total| {
                            if cambio_de_porcentaje(&mut ultimo_leyendo, procesados, total) {
                                let _ = app.emit(
                                    "progreso",
                                    Progreso {
                                        raiz: raiz.como_str().to_string(),
                                        fase: "leyendo",
                                        procesados,
                                        total,
                                    },
                                );
                            }
                        },
                    );
                    let mut ultimo_actualizando: Option<u8> = None;
                    if let ResultadoDelDrenaje::Detenida(m) = ciclo::drenar_reportando(
                        raiz,
                        c.plataforma.as_ref(),
                        &mut almacen,
                        &cliente,
                        &mut traza,
                        &mut |procesados, total| {
                            if cambio_de_porcentaje(&mut ultimo_actualizando, procesados, total) {
                                let _ = app.emit(
                                    "progreso",
                                    Progreso {
                                        raiz: raiz.como_str().to_string(),
                                        fase: "actualizando",
                                        procesados,
                                        total,
                                    },
                                );
                            }
                        },
                    ) {
                        detenida_esta_vuelta = Some(m);
                    }
                }
                ultimo_barrido_forzado = c.plataforma.ahora();
            } else {
                // Sin barrido esta vuelta: solo atender las señales que el observador ya
                // asento, y drenar lo que ya estaba en cola. Una señal nunca reporta una
                // baja por si sola — `atender_evento` solo agenda una verificacion; el
                // barrido completo sigue siendo la unica fuente legitima de una baja.
                log::debug!(
                    "[evento del observador] n={n} señales={}",
                    senales_pendientes.len()
                );
                for (raiz, ruta) in senales_pendientes.drain(..) {
                    ciclo::atender_evento(
                        &raiz,
                        ruta,
                        c.plataforma.as_ref(),
                        &mut almacen,
                        &politica,
                    );
                }
                for raiz in &raices {
                    let mut ultimo_actualizando: Option<u8> = None;
                    if let ResultadoDelDrenaje::Detenida(m) = ciclo::drenar_reportando(
                        raiz,
                        c.plataforma.as_ref(),
                        &mut almacen,
                        &cliente,
                        &mut traza,
                        &mut |procesados, total| {
                            if cambio_de_porcentaje(&mut ultimo_actualizando, procesados, total) {
                                let _ = app.emit(
                                    "progreso",
                                    Progreso {
                                        raiz: raiz.como_str().to_string(),
                                        fase: "actualizando",
                                        procesados,
                                        total,
                                    },
                                );
                            }
                        },
                    ) {
                        detenida_esta_vuelta = Some(m);
                    }
                }
            }
            for t in &traza {
                log::info!("{t}");
            }
            // **SOLO EN LA TRANSICION** — ver `detencion_avisada` arriba. Sin esto, un
            // dispositivo detenido es indistinguible en el log de uno que no tiene nada
            // que subir; con esto lo dice una vez, fuerte, y se calla.
            if detenida_esta_vuelta != detencion_avisada {
                match detenida_esta_vuelta {
                    Some(m) => log::warn!(
                        "DETENIDO ({m:?}): ningun barrido va a subir nada hasta que entre un token nuevo — hay que volver a vincular"
                    ),
                    None => log::info!("ya no esta detenido: el drenaje se reanuda"),
                }
                detencion_avisada = detenida_esta_vuelta;
            }
            // El punto de control va donde un barrido TERMINO algo. Escribe las dos
            // mitades juntas, asi que un corte las rebobina al mismo punto.
            //
            // **Y `hubo_barrido` NO ES UNA OPTIMIZACION NUEVA: ES LA CONDICION QUE ESTA
            // MISMA FRASE YA AFIRMABA Y EL CODIGO NO CUMPLIA.** Se guardaba en CADA
            // vuelta, tambien en las de solo-señal, contradiciendo tanto a este
            // comentario como al de `salir()` mas arriba («el deposito solo hace
            // checkpoint donde un barrido termina, no por mutacion»).
            //
            // **Lo que costaba, medido con `sample` sobre una rafaga real** (150 archivos
            // escritos de golpe en una raiz vigilada): la vuelta tardaba 6 s con el
            // candado del almacen tomado, y el perfil daba **86% serializando el deposito
            // entero a JSON** contra 9.5% de sha256, que es el unico trabajo de verdad.
            // Con `vista` ya en `(async)` la ventana no se congelaba, pero los botones no
            // respondian: esperaban ese mismo candado. Guardar el almacen COMPLETO por
            // cada rafaga de señales es trabajo tirado — lo que `atender_evento` produce
            // no es un hecho autoritativo, solo agenda una verificacion, y el proximo
            // barrido lo vuelve a descubrir.
            //
            // Las dos excepciones son obligatorias: un token nuevo y una sesion cerrada
            // TIENEN que llegar al disco en su misma vuelta —si no, «cerrar sesion» deja
            // el token viejo guardado y no cierra nada— y ninguna de las dos espera a un
            // barrido.
            if hubo_barrido || token_cambio || cerrando_sesion {
                deposito
                    .guardar(&almacen, token.as_ref())
                    .map_err(|e| e.to_string())?;
            }

            // **RECIEN ACA, CON EL TOKEN VACIO YA GUARDADO.** Cerrar antes dejaria el
            // token viejo en disco y "cerrar sesion" no cerraria nada — ver el doc de
            // `Compartido::cerrar_sesion_pendiente`. `app.exit(0)` despacha el cierre
            // pero no lo garantiza en el acto; el `return` evita que este hilo se
            // duerma otros `demo::INTERVALO` segundos antes de que el proceso termine.
            if cerrando_sesion {
                app.exit(0);
                return Ok(());
            }
            // Ultima linea con el candado todavia tomado — ver `candado_tomado_en`.
            log::debug!(
                "  candado retenido {} ms ({})",
                c.plataforma
                    .ahora()
                    .transcurrido_desde(candado_tomado_en)
                    .as_millis(),
                if hubo_barrido { "barrido" } else { "señales" }
            );
        }
        // **EL AVISO VA CON EL CANDADO SOLTADO.** Emitirlo adentro haria que el
        // `invoke("vista")` que dispara el evento se quede esperando el mismo `Mutex` que
        // lo emitio.
        let _ = app.emit("cambio", ());

        // Lo que falta para que se cumpla `demo::INTERVALO` desde el ultimo barrido
        // forzado — puede dar `Duration::ZERO` si `forzar_barrido` ya era cierto esta
        // vuelta, y `recv_timeout(ZERO)` simplemente no bloquea.
        let restante = demo::INTERVALO.saturating_sub(
            c.plataforma
                .ahora()
                .transcurrido_desde(ultimo_barrido_forzado),
        );
        match &receptor_de_senales {
            Some(rx) => match rx.recv_timeout(restante) {
                Ok(primera) => {
                    senales_pendientes = vec![primera];
                    while let Ok(m) = rx.try_recv() {
                        senales_pendientes.push(m);
                    }
                }
                // La proxima vuelta barre completo de todos modos por `forzar_barrido`.
                Err(RecvTimeoutError::Timeout) => {}
                // El hilo del observador murio: no hay mas señales que esperar nunca.
                // Degradar para siempre al mismo ritmo que sin observador.
                Err(RecvTimeoutError::Disconnected) => std::thread::sleep(restante),
            },
            // `Observador::nuevo()` fallo en `.setup()`: identico a hoy.
            None => std::thread::sleep(restante),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sin_token_pide_onboarding() {
        assert!(debe_mostrar_onboarding(&None));
    }

    #[test]
    fn con_token_no_pide_onboarding() {
        assert!(!debe_mostrar_onboarding(&Some(Secreto("x".into()))));
    }

    // ═══════════════════ `cambio_de_porcentaje`: el throttle compartido ═══════════════════

    #[test]
    fn como_mucho_101_cambios_de_porcentaje_sobre_miles_de_archivos() {
        // IMPORTA PORQUE: es la propiedad estructural que reemplaza al numero
        // inventado — «cada N archivos» o «cada N ms», que nadie midio. Con 101
        // porcentajes posibles (0 a 100), NINGUN total puede producir mas de 101
        // cambios, sin importar cuantos archivos tenga la carpeta.
        let mut anterior = None;
        let total = 5_000usize;
        let emitidos = (1..=total)
            .filter(|&procesados| cambio_de_porcentaje(&mut anterior, procesados, total))
            .count();
        assert!(
            emitidos <= 101,
            "se emitieron {emitidos} cambios de porcentaje sobre {total} archivos: alguien \
             le agrego un `cada N` que ya no es una propiedad estructural"
        );
    }

    #[test]
    fn una_carpeta_chica_no_pierde_progreso_por_el_bucketing() {
        // IMPORTA PORQUE: con `total` chico, cada archivo cruza su propio punto de
        // porcentaje (con 3 archivos: 33%, 66%, 100%), y el bucketing NO puede
        // coalescer eso en menos avisos — si lo hiciera, una carpeta chica (el caso
        // mas comun: la mayoria de las carpetas de un usuario no tienen miles de
        // archivos) se veria con un contador que salta o se congela.
        let mut anterior = None;
        let total = 3usize;
        let emitidos = (1..=total)
            .filter(|&procesados| cambio_de_porcentaje(&mut anterior, procesados, total))
            .count();
        assert_eq!(
            emitidos, total,
            "una carpeta de {total} archivos perdio progreso: cada archivo tiene que cruzar \
             un punto de porcentaje distinto"
        );
    }

    #[test]
    fn el_total_creciendo_a_mitad_de_camino_no_deja_mudo_al_throttle() {
        // IMPORTA PORQUE: es el caso de `Actualizando` (ver doc de `drenar_reportando`
        // en `ciclo.rs`) — 5 de 5 (100%) y de golpe pasa a ser 5 de 12 (41%) porque
        // `Observar` recien descubrio bytes por subir. El porcentaje BAJA, y el
        // throttle tiene que poder re-emitir: compara solo contra el ULTIMO valor
        // visto, no contra un historial de porcentajes ya emitidos.
        let mut anterior = None;
        assert!(
            cambio_de_porcentaje(&mut anterior, 5, 5),
            "5 de 5 tiene que emitir: es la primera llamada"
        );
        assert_eq!(anterior, Some(100));
        assert!(
            cambio_de_porcentaje(&mut anterior, 5, 12),
            "el total subio de 5 a 12 y el porcentaje bajo de 100% a 41%: tiene que volver a \
             emitir, no quedarse mudo por «ya emiti un 100% antes»"
        );
        assert_eq!(anterior, Some(41));
    }

    #[test]
    fn el_mismo_porcentaje_no_se_emite_dos_veces_seguidas() {
        let mut anterior = None;
        assert!(cambio_de_porcentaje(&mut anterior, 1, 4));
        assert!(
            !cambio_de_porcentaje(&mut anterior, 1, 4),
            "el mismo par (procesados, total) no puede volver a cruzar un punto de porcentaje"
        );
    }
}
