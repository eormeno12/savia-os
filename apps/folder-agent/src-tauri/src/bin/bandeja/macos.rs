//! LO QUE MACOS PIDE PARA UN POPOVER DE BARRA DE ESTADO, Y NO ES OPCIONAL.
//!
//! Este archivo existe porque la version anterior lo intentaba con la API portable de
//! Tauri —`set_position`, `monitor_from_point`, `outer_size`, `Focused(false)`— y **esa
//! API no alcanza en macOS**. No por un defecto de Tauri: por una propiedad del sistema.
//! Las dos razones, que son las dos mitades de este modulo:
//!
//! **1 · No hay un espacio de coordenadas global «fisico».** En macOS lo unico global es
//! el punto de Cocoa: origen abajo a la izquierda de la pantalla principal, Y hacia
//! arriba, y **siempre en puntos, sin importar el `backingScaleFactor` de cada
//! pantalla**. Lo que Tauri llama `PhysicalPosition` es `puntos × la escala de ESE
//! objeto`: la de la ventana para `outer_size()`, la del monitor para
//! `Monitor::position()`, la de la pantalla del icono para el `rect` de la bandeja. Con
//! un Retina (escala 2) y un externo (escala 1) esos espacios **se superponen**: un
//! icono en x=1997 del externo cae adentro del 0..3024 del principal, y una busqueda por
//! contencion elige el monitor equivocado con toda la razon del mundo. No hay orden de
//! operaciones que lo arregle — hay que salir a puntos de Cocoa, que es lo unico que no
//! es ambiguo.
//!
//! **Y la Y del `rect` de la bandeja no se puede usar en absoluto.** `tray-icon 0.24`
//! la calcula asi (`platform_impl/macos/mod.rs`):
//!
//! ```text
//!   fn flip_window_screen_coordinates(y) { CGDisplayPixelsHigh(CGMainDisplayID()) - y }
//! ```
//!
//! `CGDisplayPixelsHigh` devuelve **pixeles** (1964 en este Retina) y `y` viene en
//! **puntos** (982). La resta mezcla las dos unidades, asi que en cualquier maquina con
//! la principal en Retina la Y sale de otra pantalla. Por eso acá la Y **no se lee**: se
//! deriva de `visibleFrame` de la pantalla elegida, que ya trae descontada la barra de
//! menu y es exacta por pantalla.
//!
//! *(Esto tambien es por que `tauri-plugin-positioner` no serviria: su `TrayCenter` hace
//! `y = tray_y - alto` con esa misma Y, y su `move_window_constrained` busca el monitor
//! con `monitor_from_point(tray_x, tray_y)`. Los dos defectos, heredados.)*
//!
//! **2 · Una app `Accessory` no retiene el foco en una ventana comun.** `set_focus()`
//! hace `makeKeyAndOrderFront:`; el sistema le da la llave y se la saca en el mismo
//! frame, porque la APP no esta activa. El sintoma era `foco=true` seguido de
//! `foco=false`, y como el popover se cierra al perder el foco, se cerraba solo. Una
//! espera de gracia tapaba el sintoma y dejaba la causa.
//!
//! La causa se saca con `NSWindowStyleMaskNonActivatingPanel`, que es exactamente «esta
//! ventana recibe teclado sin activar la app». **Esa mascara solo la acepta un
//! `NSPanel`**, y Tauri crea un `NSWindow`, asi que hay que reclasificar la instancia
//! (`object_setClass`) a una subclase de `NSPanel`. Es lo que hace `tauri-nspanel`, y es
//! lo que hace el ejemplo canonico de este tipo de app
//! (`ahkohd/tauri-macos-menubar-app-example`, rama `v2-popover`).
//!
//! **QUE SE PIERDE AL RECLASIFICAR, Y ESTA ACEPTADO.** La clase que Tauri le pone a la
//! ventana es `TaoWindow`, que overridea tres cosas: `canBecomeKeyWindow` y
//! `canBecomeMainWindow` —que leen un ivar `focusable`— y `sendEvent:`, que implementa
//! «arrastrar la ventana por el fondo». Las dos primeras las reponemos acá con el valor
//! que el popover quiere (llave si, principal no), asi que no se pierde nada. La tercera
//! **si se pierde**: el popover deja de poder arrastrarse por su fondo. No se usa —esta
//! clavado bajo el icono y no tiene barra de titulo— y recuperarla costaria heredar el
//! ivar de tao, que es acoplarse a su representacion interna.
//!
//! **SIN DEPENDENCIAS NUEVAS EN EL ARBOL.** `objc2`, `objc2-app-kit` y
//! `objc2-foundation` ya entran por `tao`/`wry`; acá solo se declaran. `tauri-nspanel`
//! —que hace esto mismo— no esta publicado en crates.io: seria una dependencia de git
//! sin version, y ademas su rama `v2` arrastra el stack viejo `cocoa`/`objc`.

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Bool};
use objc2::{ClassType, MainThreadOnly, define_class, msg_send};
use objc2_app_kit::{
    NSEvent, NSEventMask, NSPanel, NSScreen, NSWindow, NSWindowCollectionBehavior,
    NSWindowStyleMask,
};
use objc2_foundation::{MainThreadMarker, NSObjectProtocol, NSPoint, NSRect, NSSize};
use std::ptr::NonNull;
use tauri::WebviewWindow;

/// **EL NIVEL DE LA BARRA DE MENU, MAS UNO.** `NSMainMenuWindowLevel` es 24. Uno mas
/// deja el popover por encima de la barra misma, que es lo que hace que el borde de
/// arriba no quede tapado cuando la barra es opaca. Es una constante de AppKit, no un
/// numero de producto: no va a `parametros.rs`.
const NIVEL_SOBRE_LA_BARRA: isize = 25;

/// Cuanto se separa el popover del borde de la pantalla cuando el icono esta en una
/// esquina. **No decide comportamiento, decide estetica**: con 0 el panel queda pegado
/// al canto y se ve como un error de calculo.
const MARGEN: f64 = 8.0;

define_class!(
    // Subclase de `NSPanel` sin ivars: su tamaño de instancia es el de `NSWindow`, o sea
    // <= el de `TaoWindow` (que le agrega un `Bool`). Por eso `object_setClass` sobre la
    // instancia viva no toca memoria que no exista.
    #[unsafe(super(NSPanel, NSWindow))]
    #[name = "SaviaPanelDeBandeja"]
    #[thread_kind = MainThreadOnly]
    struct PanelDeBandeja;

    unsafe impl NSObjectProtocol for PanelDeBandeja {}

    impl PanelDeBandeja {
        /// **SIN ESTO EL PANEL NO RECIBE NI UN CLIC.** Una ventana sin marco
        /// (`decorations: false`) devuelve `NO` por omision, y una ventana que no puede
        /// ser llave no le pasa eventos a su vista: los botones del popover quedan
        /// dibujados y muertos. `TaoWindow` lo resolvia leyendo un ivar suyo; acá se
        /// responde que si, que es lo que un popover siempre quiere.
        #[unsafe(method(canBecomeKeyWindow))]
        fn puede_ser_llave(&self) -> Bool {
            Bool::YES
        }

        /// **Y `NO` acá, que no es simetria.** La ventana principal es la que el sistema
        /// considera «el documento de la app»: le pone el nombre en la barra y la trae
        /// al frente al activar. Un agente de bandeja no tiene documento.
        #[unsafe(method(canBecomeMainWindow))]
        fn puede_ser_principal(&self) -> Bool {
            Bool::NO
        }
    }
);

unsafe extern "C" {
    fn object_setClass(obj: *mut AnyObject, cls: *const AnyClass) -> *const AnyClass;
}

/// Reclasifica la ventana de Tauri a `NSPanel` y le pone lo que un popover de barra
/// necesita. **Se llama una sola vez, en `setup`.**
///
/// Devuelve `Err` con el motivo si algo no esta —no entra en panico— porque un popover
/// que no se pudo convertir sigue siendo usable (se comporta como la version anterior);
/// lo que no es aceptable es que el agente no arranque por esto.
pub fn convertir_en_panel(w: &WebviewWindow) -> Result<(), String> {
    let mtm =
        MainThreadMarker::new().ok_or("la conversion tiene que correr en el hilo principal")?;
    let _ = mtm;
    let ns = w.ns_window().map_err(|e| format!("sin NSWindow: {e}"))?;

    unsafe {
        object_setClass(ns as *mut AnyObject, PanelDeBandeja::class());
        let panel: &NSPanel = &*(ns as *const NSPanel);

        // El orden importa: la mascara primero, porque `NSWindowStyleMaskNonActivatingPanel`
        // es lo que cambia como el sistema entrega el foco, y todo lo de abajo se apoya en
        // eso. `Borderless` se conserva —la ventana ya venia sin marco por
        // `decorations: false`— porque agregarle uno acá le devolveria la barra de titulo.
        panel.setStyleMask(NSWindowStyleMask::NonactivatingPanel | NSWindowStyleMask::Borderless);
        panel.setLevel(NIVEL_SOBRE_LA_BARRA);

        // **LAS TRES SON PARA QUE EL POPOVER NO DESAPAREZCA AL CAMBIAR DE CONTEXTO.**
        // `CanJoinAllSpaces`: sigue visible al cambiar de escritorio, en vez de quedarse en
        // el que estaba. `Stationary`: no se arrastra con la animacion de Mission Control.
        // `FullScreenAuxiliary`: puede aparecer ENCIMA de una app en pantalla completa, que
        // es el caso en el que mas se necesita un agente de bandeja y el unico en que una
        // ventana normal simplemente no sale.
        panel.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::Stationary
                | NSWindowCollectionBehavior::FullScreenAuxiliary,
        );

        // Sin esto, macOS esconde el panel cuando la app deja de estar activa — que es
        // SIEMPRE, porque una `Accessory` no se activa. Con la mascara no-activadora puesta
        // esto seria redundante en teoria; se deja explicito porque el costo es cero y el
        // sintoma de que falte es el que estuvimos persiguiendo.
        panel.setHidesOnDeactivate(false);
    }
    Ok(())
}

/// Deja el popover pegado bajo el icono, en la pantalla donde esta el puntero.
///
/// `icono_x` e `icono_ancho` vienen del `rect` del evento de bandeja, **en el espacio
/// escalado de Tauri**; acá se dividen por la escala de la pantalla elegida para volver a
/// puntos de Cocoa. La Y del `rect` no se usa: ver el encabezado del modulo.
///
/// **LA PANTALLA SE ELIGE POR DONDE ESTA EL PUNTERO, NO POR CONTENCION DEL RECT.**
/// `NSEvent::mouseLocation()` devuelve puntos de Cocoa globales — el mismo espacio que
/// `NSScreen::frame()`, asi que la comparacion es entre iguales y no hay escala de por
/// medio. Y en el instante de un clic en la barra, el puntero **esta sobre el icono**:
/// no es una aproximacion, es la misma cosa medida por el lado que no miente.
pub fn ubicar_bajo_el_icono(
    w: &WebviewWindow,
    icono_x: f64,
    icono_ancho: f64,
) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("ubicar tiene que correr en el hilo principal")?;
    let ns = w.ns_window().map_err(|e| format!("sin NSWindow: {e}"))?;

    unsafe {
        let ventana: &NSWindow = &*(ns as *const NSWindow);
        let puntero = NSEvent::mouseLocation();
        let pantalla = pantalla_del_punto(mtm, puntero)
            .ok_or("el puntero no cae en ninguna pantalla conocida")?;

        let escala = pantalla.backingScaleFactor();
        let visible = pantalla.visibleFrame();
        let marco = ventana.frame();

        // El icono, de vuelta en puntos.
        let ix = icono_x / escala;
        let iw = icono_ancho / escala;

        // **Y: el borde de ARRIBA del panel apoyado en `visibleFrame`.** `visibleFrame` ya
        // trae descontada la barra de menu de ESA pantalla —y da 0 de descuento en las que
        // no tienen barra—, asi que no hace falta ninguna constante de alto de barra.
        // Cocoa mide desde abajo, de ahi el `- alto`.
        let y = visible.origin.y + visible.size.height - marco.size.height;

        // X: centrado bajo el icono, recortado contra la pantalla elegida. `min` antes que
        // `max`: si la pantalla fuera mas angosta que el panel el rango se invierte, y sin
        // este orden el recorte lo manda afuera.
        let izq = visible.origin.x + MARGEN;
        let der = visible.origin.x + visible.size.width - marco.size.width - MARGEN;
        let x = (ix + iw / 2.0 - marco.size.width / 2.0).min(der).max(izq);

        // **`setFrame:display:` Y NO `set_position` DE TAURI.** Esta es la llamada de AppKit
        // y aplica este mismo instante, con la ventana visible o no. La version anterior
        // usaba el envoltorio de Tauri, que sobre una ventana oculta no aplicaba nada — el
        // sintoma era que el clic movia la ventana para el clic SIGUIENTE.
        let nuevo = NSRect::new(
            NSPoint::new(x, y),
            NSSize::new(marco.size.width, marco.size.height),
        );
        let _: () = msg_send![ventana, setFrame: nuevo, display: true];
    }
    Ok(())
}

/// Muestra el popover **sin activar la app**, que es la mitad que faltaba.
///
/// `WebviewWindow::show()` + `set_focus()` no sirven acá, y esta vez esta medido en la
/// fuente: `tao::platform_impl::macos::util::set_focus` (v0.35.3, `util/async.rs:236`)
/// hace
///
/// ```text
///   ns_window.makeKeyAndOrderFront(None);
///   let () = msg_send![app, activateIgnoringOtherApps: YES];
/// ```
///
/// Ese `activateIgnoringOtherApps` **activa la aplicacion**, que es exactamente lo que
/// `NSWindowStyleMaskNonActivatingPanel` existe para no hacer. Y va despachado al hilo
/// principal, asi que llega despues del clic: el sistema activa la app, el clic en el
/// item de estado le devuelve el frente a la app anterior, y el panel pierde la llave. El
/// rastro era `[foco] true frente=true` seguido de `[foco] false frente=false`, con la
/// ventana visible en las dos lineas.
///
/// Las tres llamadas de abajo son las de `tauri-nspanel::show_and_make_key`:
///
///  · `orderFrontRegardless` — y no `orderFront:`, que el sistema **ignora** cuando la
///    app no esta activa. Una `Accessory` nunca lo esta.
///  · `makeKeyWindow` — la llave sin activar a nadie. Es lo que la mascara habilita.
///
/// **LO QUE NO SE HACE: `makeFirstResponder:` sobre la vista.** `tauri-nspanel` lo trae
/// en `show_and_make_key`, y para un lanzador tipo Spotlight es lo correcto: manda el
/// cursor al campo de texto. Acá no hay campo de texto, asi que lo unico que producia era
/// el anillo de foco encendido sobre el primer boton del pie — que nadie pidio. Un panel
/// que se abre con un boton pre-seleccionado le esta sugiriendo a la persona que lo
/// apriete.
pub fn mostrar(w: &WebviewWindow) -> Result<(), String> {
    let ns = w.ns_window().map_err(|e| format!("sin NSWindow: {e}"))?;
    unsafe {
        let ventana: &NSWindow = &*(ns as *const NSWindow);
        let _: () = msg_send![ventana, orderFrontRegardless];
        let _: () = msg_send![ventana, makeKeyWindow];
    }
    Ok(())
}

/// Cambia el alto **dejando el borde de ARRIBA donde estaba**, y refresca la sombra.
///
/// Las dos cosas juntas y en Rust porque las dos son consecuencia de lo mismo y
/// separarlas es un error de orden esperando a pasar:
///
///  · **El borde de arriba.** Cocoa mide desde abajo: cambiar solo `size.height` deja el
///    origen quieto y **sube la tapa**, que en un popover pegado a la barra significa
///    meterse encima del menu. Lo que tiene que quedar fijo es el borde que toca el
///    icono.
///  · **La sombra.** macOS la deriva del alfa de la ventana transparente y la **cachea**.
///    Sin invalidarla, al crecer el panel la sombra sigue con la silueta del alto
///    anterior — una franja de sombra cruzando la mitad del panel.
pub fn ajustar_alto(w: &WebviewWindow, alto: f64) -> Result<(), String> {
    let ns = w.ns_window().map_err(|e| format!("sin NSWindow: {e}"))?;
    unsafe {
        let ventana: &NSWindow = &*(ns as *const NSWindow);
        let marco = ventana.frame();
        let tapa = marco.origin.y + marco.size.height;
        let nuevo = NSRect::new(
            NSPoint::new(marco.origin.x, tapa - alto),
            NSSize::new(marco.size.width, alto),
        );
        let _: () = msg_send![ventana, setFrame: nuevo, display: true];
        let _: () = msg_send![ventana, invalidateShadow];
    }
    Ok(())
}

/// **EL CIERRE SE DISPARA CON UN CLIC AFUERA, Y NO CON LA PERDIDA DEL FOCO.**
///
/// Perder el foco parece la señal obvia y no lo es: el rastro de arriba mostro que el
/// panel pierde la llave por si solo, de forma intermitente, en los milisegundos que
/// siguen a mostrarse — el item de estado le devuelve la llave a la ventana que la tenia
/// antes, y quien gana esa carrera cambia de clic en clic. Dos de tres clics cerraban
/// solos. **Ninguna guarda sobre «quien es el frente» separa eso de un clic real**,
/// porque una app `Accessory` nunca es el frente: la respuesta es `false` en los dos
/// casos.
///
/// Un `NSEvent` global de boton apretado no tiene carrera: **es la persona apretando el
/// mouse en otro lado**, que es literalmente la condicion que queremos. No necesita
/// permiso de Accesibilidad —eso solo aplica a los monitores de TECLADO— y no ve el
/// contenido del clic, solo que ocurrio y donde.
///
/// **DOS EXCLUSIONES, Y LAS DOS SON GEOMETRICAS, NO TEMPORALES:**
///
///  · adentro del marco del panel — el monitor global igual no recibe esos clics, pero
///    la comprobacion cuesta nada y documenta la intencion;
///  · **adentro de la barra de menu de esa pantalla** — sin esto, cerrar con el icono no
///    funcionaria nunca: el `mouseDown` sobre el icono esconderia el panel, y el
///    `mouseUp` —que es donde corre `alternar`— lo encontraria escondido y lo volveria a
///    abrir. La alternancia se veria como «no cierra». Se excluye por posicion y no por
///    una ventana de tiempo, que es lo que la hace determinista.
pub fn cerrar_al_clic_afuera(
    w: &WebviewWindow,
    al_cerrar: impl Fn() + 'static,
) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("el monitor tiene que armarse en el hilo principal")?;
    let ns = w.ns_window().map_err(|e| format!("sin NSWindow: {e}"))? as usize;

    let bloque = RcBlock::new(move |_evento: NonNull<NSEvent>| {
        let ventana: &NSWindow = unsafe { &*(ns as *const NSWindow) };
        if !ventana.isVisible() {
            return;
        }
        let p = NSEvent::mouseLocation();
        let marco = ventana.frame();
        let adentro = p.x >= marco.origin.x
            && p.x < marco.origin.x + marco.size.width
            && p.y >= marco.origin.y
            && p.y < marco.origin.y + marco.size.height;
        let en_la_barra = pantalla_del_punto(mtm, p)
            .is_some_and(|s| p.y >= s.visibleFrame().origin.y + s.visibleFrame().size.height);
        if !adentro && !en_la_barra {
            al_cerrar();
        }
    });

    // El monitor se queda vivo mientras viva el proceso: el popover existe todo lo que dura
    // la app, asi que no hay a quien devolverle el `removeMonitor:`. Se suelta a proposito.
    let vivo = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
        NSEventMask::LeftMouseDown | NSEventMask::RightMouseDown | NSEventMask::OtherMouseDown,
        &bloque,
    );
    std::mem::forget(vivo);
    Ok(())
}

/// La pantalla cuyo marco contiene el punto, en puntos de Cocoa.
fn pantalla_del_punto(mtm: MainThreadMarker, p: NSPoint) -> Option<Retained<NSScreen>> {
    NSScreen::screens(mtm).iter().find(|s| {
        let f = s.frame();
        p.x >= f.origin.x
            && p.x < f.origin.x + f.size.width
            && p.y >= f.origin.y
            && p.y < f.origin.y + f.size.height
    })
}

// **`somos_el_frente()` SE FUE, Y VALE DEJAR ESCRITO POR QUE.** Era la guarda del cierre
// —«no te escondas si la app de adelante seguimos siendo nosotros»—, copiada de
// `check_menubar_frontmost` del ejemplo canonico. **Acá no puede funcionar, y no es un
// detalle de implementacion**: una app `Accessory` con un panel no-activador NUNCA es la
// de adelante. Esa es la definicion de no-activador. La funcion contestaba `false` con el
// panel abierto y en uso, exactamente igual que con el panel abandonado, asi que no
// separaba nada. El rastro lo dijo en una linea:
//
//     [foco] true  visible=Ok(true) frente=false
//     [foco] false visible=Ok(true) frente=false
//
// La señal que si separa los dos casos es el clic, y esta arriba.
