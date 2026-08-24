//! LA APP DE ESCRITORIO: un ícono en la barra y un popover. **`src/bin/bandeja/` es el
//! unico directorio del crate que conoce Tauri**, y eso no es prolijidad: es lo que deja
//! que el nucleo se siga cross-chequeando contra Windows y que las pruebas corran sin
//! levantar una ventana. Lo comprueba `el_nucleo_no_conoce_la_ventana` en
//! `tests/guardianes.rs`, que camina todo `src/` menos este directorio.
//!
//! Uso:
//! ```text
//!   node apps/folder-agent/sim/server.ts        # en otra terminal
//!   cargo run --bin bandeja -- <ruta-de-la-raiz> [http://127.0.0.1:4477]
//! ```
//!
//! **SIN TOKEN ARRANCA IGUAL, Y ESO ES A PROPOSITO.** No hay pantalla de vinculacion
//! todavia; si el deposito no tiene credencial, el cliente sale `SinAutenticar`, el
//! servidor contesta `401`, la cola traduce eso a `Desenlace::Credenciales` y el panel
//! muestra «Sin acceso» — el mismo camino que recorre un token revocado de verdad. O sea
//! que el estado no hay que fabricarlo: el agente lo alcanza solo.

mod comandos_archivo;
mod comandos_onboarding;
#[cfg(target_os = "macos")]
mod macos;

use savia_folder_aplicacion::ciclo;
use savia_folder_aplicacion::panel;
use savia_folder_contrato::dominio::{BarridoId, RaizId, SensibilidadAMayusculas};
use savia_folder_contrato::plataforma::{Plataforma, RaizRegistrada};
use savia_folder_contrato::protocolo::{Credencial, Secreto};
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::ParametrosDeCola;
use savia_folder_persistencia::persistencia::Deposito;
#[cfg(target_os = "macos")]
use savia_folder_plataforma_adaptadores::macos::Macos as PlataformaLocal;
#[cfg(target_os = "windows")]
use savia_folder_plataforma_adaptadores::windows::Windows as PlataformaLocal;
use savia_folder_politica::salvaguardas::Politica;
use savia_folder_protocolo::{BaseDeApi, Cliente, Tiempos};
use std::sync::{Arc, Mutex};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, State, WebviewWindow};

/// Parametros de la DEMO, no del producto. Ver `parametros.rs`: los cuatro del canal
/// siguen en `None` y `Politica` no tiene `Default`, asi que hay que proveerlos acá.
mod demo {
    use std::time::Duration;
    pub const ASENTAMIENTO: Duration = Duration::from_millis(300);
    /// Cada cuanto el hilo de fondo vuelve a barrer. **No es el intervalo del producto**:
    /// el agente de verdad barre por evento del sistema de archivos y solo hace barridos
    /// completos de vez en cuando. Acá es corto para que la demo se vea moverse.
    pub const INTERVALO: Duration = Duration::from_secs(3);
    pub const TIEMPO_DE_CONEXION: Duration = Duration::from_secs(5);
    pub const TIEMPO_POR_LLAMADA: Duration = Duration::from_secs(30);
    /// Cuantas filas por carpeta muestra el popover. `parametros::MAX_FILAS_DEL_PANEL`
    /// sigue en `None`: es un numero derivado de una medicion de layout que nadie hizo.
    pub const MAX_FILAS: usize = 8;
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
    por_quitar: Mutex<Vec<RaizId>>,
    /// El `Secreto` que el onboarding acaba de obtener (`comandos_onboarding::sondear_vinculacion`,
    /// caso `Aprobado`), esperando a que el hilo de trabajo lo recoja. Mismo patrón que
    /// `por_quitar`: un comando no puede persistir el token él mismo —el `Deposito` vive
    /// en `trabajar()`, no en `Compartido`— así que deja el `Secreto` acá y el hilo de
    /// trabajo lo vacía en su punto seguro, junto con `por_quitar`.
    token_pendiente: Mutex<Option<Secreto>>,
}

/// **NINGUN COMANDO APAGA AL AGENTE A MEDIAS.** El panel puede mirar (`vista`), abrir
/// (`abrir_carpeta`, `agregar_carpeta`, `quitar_carpeta`), acomodarse (`ajustar_alto`) y
/// salir — y nada mas. No hay comando para retirar ni para forzar un barrido, y ya no hay
/// uno para pausar: lo que la interfaz no puede pedir no lo puede romper.
/// La otra mitad de sacarle el menu al icono: sin menu nativo, **salir tiene que estar en
/// el panel**.
#[tauri::command]
fn salir(app: tauri::AppHandle) {
    app.exit(0);
}

/// Abre la raiz en el Finder. **Es la unica accion del panel que sale de la app**, y va
/// por `open` con la ruta que el agente ya tiene enrolada — nunca una que venga de la
/// interfaz: el popover no puede pedir que se abra una ruta arbitraria.
#[tauri::command]
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

/// Abre el selector NATIVO de directorio y enrola lo que se elija.
///
/// **El dialogo es del sistema y no de la app, y eso es una decision de seguridad además
/// de una de estilo**: la ventana que concede el acceso tiene que ser una que la persona
/// reconozca como del SO. En macOS, además, es lo que le da a la app el permiso sobre esa
/// carpeta.
///
/// Devuelve en el acto y enrola en la devolucion de llamada: `pick_folder` bloquea hasta
/// que la persona elija, que puede ser un rato largo, y un comando que tarda eso deja el
/// panel colgado.
#[tauri::command]
fn agregar_carpeta(app: tauri::AppHandle, estado: State<'_, Arc<Compartido>>) {
    use tauri_plugin_dialog::DialogExt;
    let c = Arc::clone(&estado);
    app.dialog().file().pick_folder(move |elegida| {
        let Some(ruta) = elegida.and_then(|r| r.into_path().ok()) else {
            return;
        };
        // La huella es lo que IDENTIFICA la raiz; la ruta es procedencia. Si el disco no
        // la puede dar, no se enrola: una raiz sin huella no puede distinguir «se movio»
        // de «es otra», que es sobre lo que se apoya la salvaguarda 2.
        let Ok(huella) = c.plataforma.huella_de_raiz(&ruta) else {
            eprintln!(
                "no se puede enrolar {}: el disco no da huella",
                ruta.display()
            );
            return;
        };
        {
            let mut almacen = c.almacen.lock().expect("el almacen no se envenena");
            // **`enrolar` YA ES IDEMPOTENTE POR HUELLA**, asi que reelegir una carpeta que
            // ya esta —o la misma movida de lugar— pisa el registro con la misma id en vez
            // de estrenar una raiz. Es la decision 7, y ahora es codigo: ver
            // `HuellaDeRaiz::raiz_id`.
            almacen.enrolar(RaizRegistrada {
                id: huella.raiz_id(),
                huella,
                ruta_absoluta: ruta,
                // Suposicion ROTULADA, no medicion — igual que en el arranque.
                sensibilidad: SensibilidadAMayusculas::NoDistingue,
            });
        }
        let _ = app.emit("cambio", ());
    });
}

/// **EL ALTO LO PIDE EL PANEL Y LO APLICA RUST**, y no `setSize` desde JavaScript. Ver
/// `macos::ajustar_alto`: en macOS hay que fijar el borde de ARRIBA y invalidar la
/// sombra, y las dos cosas van con el cambio de tamaño o no van. Ademas asi el popover no
/// necesita el permiso `core:window:allow-set-size`: puede pedir un alto, no mover la
/// ventana.
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
#[tauri::command]
fn vista(estado: State<'_, Arc<Compartido>>) -> panel::Vista {
    let almacen = estado.almacen.lock().expect("el almacen no se envenena");
    panel::vista(&almacen, estado.plataforma.as_ref(), demo::MAX_FILAS)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let Some(ruta) = args.next() else {
        eprintln!("uso: bandeja <ruta-de-la-raiz> [base-de-api]");
        eprintln!("     (levanta antes: node apps/folder-agent/sim/server.ts)");
        std::process::exit(2);
    };
    let base = args
        .next()
        .unwrap_or_else(|| "http://127.0.0.1:4477".into());

    let plataforma = Arc::new(PlataformaLocal::nueva()?);
    let ruta_absoluta = std::fs::canonicalize(&ruta)?;

    // **EL DEPOSITO NUNCA ADENTRO DE LA RAIZ VIGILADA**, y quien lo verifica es este
    // archivo porque es el unico que conoce las dos rutas: un deposito adentro se observa
    // a si mismo — cada escritura produce un evento, que produce un barrido, que produce
    // una escritura.
    let deposito_ruta = std::env::temp_dir().join("savia-folder-agent.redb");
    if deposito_ruta.starts_with(&ruta_absoluta) {
        return Err(format!(
            "el deposito ({}) no puede vivir adentro de la raiz vigilada ({})",
            deposito_ruta.display(),
            ruta_absoluta.display()
        )
        .into());
    }
    let deposito = Deposito::abrir(&deposito_ruta).map_err(|e| e.to_string())?;

    // Un deposito ilegible detiene el arranque. Absorberlo como «empiezo de cero» pierde
    // todas las lapidas, y lo borrado mientras el agente estuvo apagado no lo ve faltar
    // ningun barrido posterior.
    let (almacen, token) = match deposito.cargar().map_err(|e| e.to_string())? {
        Some(r) => {
            println!("deposito  {} (recuperado)", deposito_ruta.display());
            (r.almacen, r.credencial)
        }
        None => {
            println!("deposito  {} (nuevo)", deposito_ruta.display());
            let huella = plataforma
                .huella_de_raiz(&ruta_absoluta)
                .map_err(|e| format!("no se puede enrolar {ruta}: {e:?}"))?;
            let mut a = Almacen::nuevo(ParametrosDeCola {
                max_intentos: None,
                max_entradas_por_lote: None,
            });
            a.enrolar(RaizRegistrada {
                // **DERIVADA, NO `"root-1"`.** Ver `HuellaDeRaiz::raiz_id`: la id acunada a
                // mano alcanzaba con una carpeta sola y volvia falsa la decision 7 en
                // cuanto habia dos.
                id: huella.raiz_id(),
                huella,
                ruta_absoluta: ruta_absoluta.clone(),
                // Suposicion ROTULADA, no medicion: la sonda que mide la sensibilidad
                // del volumen al enrolar todavia no existe. APFS por omision no
                // distingue mayusculas.
                sensibilidad: SensibilidadAMayusculas::NoDistingue,
            });
            (a, None)
        }
    };
    match &token {
        Some(_) => println!("token     recuperado del deposito"),
        None => println!("token     NO HAY — el panel va a decir «Sin acceso», que es la verdad"),
    }
    println!("raiz      {}", ruta_absoluta.display());
    println!("api       {base}\n");

    let compartido = Arc::new(Compartido {
        almacen: Mutex::new(almacen),
        plataforma: plataforma.clone(),
        base: base.clone(),
        por_quitar: Mutex::new(Vec::new()),
        token_pendiente: Mutex::new(None),
    });

    tauri::Builder::default()
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
        .manage(Arc::clone(&compartido))
        .manage(comandos_onboarding::EstadoDeVinculacion(Mutex::new(None)))
        .manage(comandos_onboarding::CandidataPendiente(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            vista,
            salir,
            abrir_carpeta,
            agregar_carpeta,
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

            let ventana = app
                .get_webview_window("bandeja")
                .expect("la ventana esta declarada en tauri.conf.json");

            // **ACA LA VENTANA DEJA DE SER UNA VENTANA.** Ver `macos.rs`: sin esto una
            // app `Accessory` no retiene el foco y el popover se cierra en el mismo
            // frame en que se abre. Si falla, se avisa y se sigue — un popover sin
            // convertir es peor, no inservible.
            #[cfg(target_os = "macos")]
            if let Err(e) = macos::convertir_en_panel(&ventana) {
                eprintln!("el popover no se pudo convertir en panel: {e}");
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
                if let Err(e) = macos::cerrar_al_clic_afuera(&ventana, move || {
                    let _ = w.hide();
                }) {
                    eprintln!("el popover no va a cerrarse al clic afuera: {e}");
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
            std::thread::spawn(move || {
                if let Err(e) = trabajar(c, deposito, token, &base, &app) {
                    eprintln!("el hilo de trabajo murio: {e}");
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
            eprintln!("el popover no se pudo ubicar: {e}");
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
        eprintln!("el popover no se pudo mostrar: {e}");
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Barre, drena y guarda, para siempre.
fn trabajar(
    c: Arc<Compartido>,
    deposito: Deposito,
    token: Option<Secreto>,
    base: &str,
    app: &tauri::AppHandle,
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
    let credencial = match &token {
        Some(s) => Credencial::TokenDeDispositivo(s.clone()),
        None => Credencial::SinAutenticar,
    };
    let mut cliente = Cliente::nuevo(base_de_api.clone(), credencial, tiempos);

    let mut n: u64 = 0;
    loop {
        n += 1;
        {
            let mut almacen = c.almacen.lock().expect("el almacen no se envenena");

            // **EL PUNTO SEGURO PARA SACAR RAICES: ACA, ANTES DE ABRIR NINGUN BARRIDO.**
            // `Colas::olvidar` no puede correr con un segmento abierto —dejaria un
            // `sweepId` colgado del lado de Savia— y este es el unico instante del
            // proceso en el que se sabe con certeza que no hay ninguno. Por eso el
            // comando encola en vez de hacerlo, y por eso sacar una carpeta tarda como
            // mucho una vuelta.
            if let Ok(mut cola) = c.por_quitar.lock() {
                for raiz in cola.drain(..) {
                    match almacen.desenrolar(&raiz) {
                        Some(soltados) => {
                            println!(
                                "  quitada {} ({soltados} trabajos soltados)",
                                raiz.como_str()
                            )
                        }
                        None => println!("  quitar {}: no estaba enrolada", raiz.como_str()),
                    }
                }
            }

            // Mismo punto seguro que arriba, mismo motivo de fondo: es donde el hilo de
            // trabajo sabe con certeza que no hay nada a medio actualizar. Ver
            // `Compartido::token_pendiente` y el punto 5 de la integración documentado
            // en `comandos_onboarding.rs`.
            if let Ok(mut buzon) = c.token_pendiente.lock()
                && let Some(nuevo) = buzon.take()
            {
                token = Some(nuevo);
                let credencial = match &token {
                    Some(s) => Credencial::TokenDeDispositivo(s.clone()),
                    None => Credencial::SinAutenticar,
                };
                cliente = Cliente::nuevo(base_de_api.clone(), credencial, tiempos);
                println!("  token     recibido del onboarding");
            }

            // **UNA VUELTA POR RAIZ, Y EL ORDEN NO IMPORTA.** El inventario y las
            // salvaguardas siempre estuvieron modelados por raiz (decision 3), asi que
            // esto no es un cambio de diseño: es que el bucle deje de tener UNA clavada.
            // Cada raiz abre y cierra su propio barrido; que dos raices esten en estados
            // distintos es lo normal, y el panel ya sabe agregarlo por el peor.
            let raices: Vec<_> = almacen
                .inventario()
                .raices()
                .into_iter()
                .map(|r| r.id)
                .collect();
            let mut traza = Vec::new();
            // **`barrer`, no `barrer_reportando`, todavia.** El canal de progreso que la
            // Fase 7 construyo esta probado y listo (`ciclo::barrer_reportando`,
            // `tests/progreso.rs`), pero conectarlo a un evento real necesita decidir CADA
            // cuanto emitir — miles de archivos no pueden ser miles de `app.emit` — y ese
            // numero nadie lo midio todavia. Inventarlo violaria la misma disciplina que
            // ya dejo `Carpeta::progreso` en `None` (Fase 4) y `UMBRAL_DE_ARCHIVOS_PARA_ADVERTIR`
            // en `None` (Fase 6): mejor un canal que existe y no se usa que uno que se usa
            // con un umbral que nadie respalda.
            for raiz in &raices {
                ciclo::barrer(
                    raiz,
                    // El id lleva la raiz adentro: dos barridos de la misma vuelta sobre
                    // raices distintas no pueden compartir `BarridoId`.
                    BarridoId::nuevo(format!("barrido-{n}-{}", raiz.como_str())),
                    c.plataforma.as_ref(),
                    &mut almacen,
                    &politica,
                );
                ciclo::drenar(
                    raiz,
                    c.plataforma.as_ref(),
                    &mut almacen,
                    &cliente,
                    &mut traza,
                );
            }
            for t in &traza {
                println!("  {t}");
            }
            // El punto de control va donde un barrido TERMINO algo. Escribe las dos
            // mitades juntas, asi que un corte las rebobina al mismo punto.
            deposito
                .guardar(&almacen, token.as_ref())
                .map_err(|e| e.to_string())?;
        }
        // **EL AVISO VA CON EL CANDADO SOLTADO.** Emitirlo adentro haria que el
        // `invoke("vista")` que dispara el evento se quede esperando el mismo `Mutex` que
        // lo emitio.
        let _ = app.emit("cambio", ());
        std::thread::sleep(demo::INTERVALO);
    }
}
