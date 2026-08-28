//! El observador de filesystem: la señal en vivo que complementa el barrido periódico.
//!
//! **UN EVENTO NUNCA REPORTA, SOLO AGENDA UNA VERIFICACIÓN** — el barrido sigue siendo
//! la única fuente legítima de un conjunto de bajas (ver
//! `docs/product/savia-b2b/borrador-agente-carpeta.md`). Lo que este módulo agrega es
//! una señal más rápida de «algo cambió acá», no un reemplazo del barrido.
//!
//! Tres piezas, en el orden en que aparecen en este archivo — dos puras, una con I/O
//! real:
//!
//!  · **`Asentador`** — el debounce. Sin I/O, sin reloj real: recibe `Instante` por
//!    parámetro en cada llamada (`savia_folder_contrato::dominio::Instante`, **NO**
//!    `std::time::Instant` — la razón está medida, no supuesta, en
//!    `contrato/src/dominio.rs:444-458`: con la laptop dormida, `Instant` pierde el
//!    55 % del intervalo real transcurrido), así que se testea con aritmética pura.
//!  · **`clasificar`** — la función pura que decide, para cada mensaje que entrega
//!    `notify`, si es un toque de debounce, un pedido de barrido urgente o algo para
//!    ignorar. El orden de sus chequeos no es arbitrario: un evento de rescan nunca
//!    trae ningún `path` (`Event::new(EventKind::Other).set_flag(Flag::Rescan)` en
//!    `fsevent.rs` no llama `.add_path` nunca), así que `need_rescan()` se revisa
//!    ANTES de intentar resolver una raíz — revisarlo después lo pierde en silencio
//!    como «no matchea ninguna raíz».
//!  · **`diferencia`** — el algoritmo puro de `Observador::sincronizar`, diffeando por
//!    `(RaizId, ruta_absoluta)` y NO por `RaizId` solo: sacar una raíz de su lugar y
//!    volver a agregarla desde otro lado (el camino de `reemplazar_carpeta`) conserva
//!    el MISMO `RaizId` (decisión 7, `plataforma.rs:174-181`), así que un diff que solo
//!    mire membresía de id deja a `notify` vigilando para siempre una carpeta ya vacía
//!    — sin error, sin log, hasta que alguien reinicie el proceso.
//!  · **`Observador`** — el I/O real: un hilo propio, un `notify::RecommendedWatcher` y
//!    el registro de qué raíz vigila qué ruta.
//!
//! **EL BARRIDO COMPLETO NO SE INANICIONA POR ESTO.** Este módulo solo entrega toques
//! de debounce y pedidos de barrido urgente — no decide él mismo saltarse el barrido
//! periódico; esa decisión (y la corrección del bug de inanición que un diseño ingenuo
//! introduciría) vive del lado de `trabajar()`, en `src/bin/bandeja/main.rs`, que es
//! quien consume `tomar_pedido_de_barrido_urgente` y el canal de toques.

use notify::{RecursiveMode, Watcher as _};
use savia_folder_contrato::dominio::{
    Instante, RaizId, RutaRelativa, ruta_excluida_por_convencion,
};
use savia_folder_contrato::plataforma::{Plataforma, RaizRegistrada};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

// ─────────────────────────── El debounce puro ───────────────────────────────

/// Mismo espíritu que `Contadores` en `plataforma-falsa/src/falsa.rs:34-39`: una
/// struct plana, sin `Mutex`, porque un solo hilo (el de `Observador`) la escribe. Es
/// la vía real para eventualmente sacar `VENTANA_DEL_OBSERVADOR` de `Pendiente` con
/// evidencia — sin esto, el número queda en `None` para siempre porque nada en el
/// diseño produce el dato que lo justificaría.
#[derive(Default, Debug)]
struct Contadores {
    toques: u64,
    asentamientos: u64,
}

/// El debounce puro: guarda la última vez que se vio cada `(RaizId, RutaRelativa)` y
/// decide, dado un `Instante` de ahora, cuáles ya llevan `ventana` quietas.
///
/// **VIVE ENTERAMENTE ADENTRO DEL HILO PROPIO DE `Observador`** — nada más lo toca, así
/// que no necesita `Mutex` propio. `tocar`/`vencidos` reciben `ahora` como parámetro y
/// nunca leen un reloj real, lo que es lo que permite testearlos con aritmética de
/// `Instante::desde_nanos` sin esperar un solo milisegundo de verdad.
#[derive(Default)]
pub struct Asentador {
    pendientes: BTreeMap<(RaizId, RutaRelativa), Instante>,
    contadores: Contadores,
}

impl Asentador {
    pub fn nuevo() -> Self {
        Self::default()
    }

    /// Registra (o actualiza) la marca de tiempo de una clave. Un segundo toque sobre
    /// la MISMA clave reinicia su reloj — es lo que hace que un chorro de eventos sobre
    /// el mismo archivo no venza hasta que el chorro se detiene.
    pub fn tocar(&mut self, clave: (RaizId, RutaRelativa), ahora: Instante) {
        self.contadores.toques += 1;
        self.pendientes.insert(clave, ahora);
    }

    /// Remueve y devuelve las claves cuya marca lleva `>= ventana` respecto de `ahora`.
    pub fn vencidos(&mut self, ahora: Instante, ventana: Duration) -> Vec<(RaizId, RutaRelativa)> {
        let mut vencidas = Vec::new();
        for (clave, marca) in &self.pendientes {
            if ahora.transcurrido_desde(*marca) >= ventana {
                vencidas.push(clave.clone());
            }
        }
        for clave in &vencidas {
            self.pendientes.remove(clave);
        }
        self.contadores.asentamientos += vencidas.len() as u64;
        vencidas
    }

    /// Cuánto falta para que la entrada MÁS VIEJA (la que primero vence) llegue a
    /// `ventana`. `None` si no hay ninguna pendiente — el llamador usa un timeout más
    /// largo en ese caso, para no recalcular en un bucle apretado sin nada que atender.
    pub fn proximo_vencimiento(&self, ahora: Instante, ventana: Duration) -> Option<Duration> {
        self.pendientes
            .values()
            .map(|marca| ventana.saturating_sub(ahora.transcurrido_desde(*marca)))
            .min()
    }

    pub fn toques(&self) -> u64 {
        self.contadores.toques
    }

    pub fn asentamientos(&self) -> u64 {
        self.contadores.asentamientos
    }
}

#[cfg(test)]
mod tests_asentador {
    use super::*;

    fn clave(n: u8) -> (RaizId, RutaRelativa) {
        (
            RaizId::nueva(format!("raiz-{n}")),
            RutaRelativa::canonica(&format!("archivo-{n}.txt")).expect("ruta de prueba"),
        )
    }

    #[test]
    fn tocar_y_no_cruzar_la_ventana_no_vence_nada() {
        let mut a = Asentador::nuevo();
        let ventana = Duration::from_millis(300);
        a.tocar(clave(1), Instante::desde_nanos(0));
        let vencidos = a.vencidos(Instante::desde_nanos(100_000_000), ventana); // 100ms
        assert!(vencidos.is_empty());
        assert_eq!(a.toques(), 1);
        assert_eq!(a.asentamientos(), 0);
    }

    #[test]
    fn cruzar_la_ventana_vence_exactamente_esa_clave() {
        let mut a = Asentador::nuevo();
        let ventana = Duration::from_millis(300);
        a.tocar(clave(1), Instante::desde_nanos(0));
        let vencidos = a.vencidos(Instante::desde_nanos(300_000_000), ventana); // 300ms
        assert_eq!(vencidos, vec![clave(1)]);
        assert_eq!(a.asentamientos(), 1);
    }

    #[test]
    fn dos_toques_sobre_la_misma_clave_reinician_su_reloj() {
        let mut a = Asentador::nuevo();
        let ventana = Duration::from_millis(300);
        a.tocar(clave(1), Instante::desde_nanos(0));
        // Segundo toque a los 200ms, ANTES de que venza el primero (que vencería a los
        // 300ms si no se reiniciara).
        a.tocar(clave(1), Instante::desde_nanos(200_000_000));
        // A los 300ms desde el PRIMER toque, todavía no vencio: solo pasaron 100ms
        // desde el SEGUNDO, que es el que manda.
        let vencidos = a.vencidos(Instante::desde_nanos(300_000_000), ventana);
        assert!(vencidos.is_empty());
        // Recien a los 500ms (300ms desde el segundo toque) vence.
        let vencidos = a.vencidos(Instante::desde_nanos(500_000_000), ventana);
        assert_eq!(vencidos, vec![clave(1)]);
    }
}

// ─────────────────────────────── El error ────────────────────────────────────

/// El error terminal de `Observador::nuevo`. Envuelve `notify::Error` pero no lo
/// expone en ninguna firma pública de este archivo: mismo motivo que `ErrorDePlataforma`
/// (`contrato/src/plataforma.rs:295-306`) documenta explícito — *"windows.rs perdio sus
/// `impl Display`/`impl Error` una vez sin que nadie lo notara"* cuando cada adaptador
/// tenía su propio tipo de error sin centralizar. Devolver un tipo de una dependencia
/// externa desde la API pública de este crate es el mismo riesgo por otra puerta.
///
/// A mano y no `thiserror`, mismo estilo que `ErrorDePlataforma`: son pocas líneas.
#[derive(Debug)]
pub struct ErrorDeObservador(notify::Error);

impl std::fmt::Display for ErrorDeObservador {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // El `Display` de `notify::Error` ya es específico por su cuenta (usa
        // `.kind`/`.paths` internamente) — delegar ahí evita repetir esa lógica acá.
        write!(f, "el observador de filesystem no arranco: {}", self.0)
    }
}

impl std::error::Error for ErrorDeObservador {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.0)
    }
}

// ────────────────────────── La clasificación pura ────────────────────────────

/// Lo que un mensaje del canal interno de `notify` significa para el resto del
/// sistema. Puro adrede: separado de `Observador` para poder testearse con eventos y
/// errores SINTÉTICOS, sin ejercer un `notify::Watcher` real.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Clasificacion {
    /// Una ruta, dentro de una raíz vigilada, que hay que empezar a asentar.
    Toque(RaizId, RutaRelativa),
    /// El sistema ya no puede garantizar que se vio todo — un rescan de `notify` o un
    /// error del canal. La respuesta correcta es la misma para los dos: un barrido
    /// completo, no un toque puntual.
    BarridoUrgente,
    /// Ni lo uno ni lo otro: sin paths, fuera de toda raíz vigilada, o excluido por
    /// convención (`.git`, `.DS_Store`, …).
    Ignorado,
}

/// Clasifica UN mensaje del canal interno de `notify` contra el registro de raíces
/// vigiladas. El orden de los chequeos importa y está descrito en el doc del módulo:
/// `need_rescan()` va PRIMERO porque un evento de rescan nunca trae ningún `path`.
pub fn clasificar(
    resultado: notify::Result<notify::Event>,
    raices: &HashMap<RaizId, PathBuf>,
) -> Clasificacion {
    let evento = match resultado {
        // Un error del canal (`PathNotFound`, `WatchNotFound`, `MaxFilesWatch`, un
        // `Generic`/`Io` de SO) significa que `notify` ya no puede garantizar que vio
        // todo. **En Windows esto NO cubre el overflow real de `ReadDirectoryChangesW`**
        // — Microsoft documenta que un overflow vuelve como éxito con
        // `lpBytesReturned == 0`, y `notify` 8.2.0 no lo traduce a `Err` (confirmado
        // contra `windows.rs`: el parámetro que lo lleva nunca se lee). La única
        // defensa real contra ESE caso sigue siendo, exclusivamente, el barrido
        // periódico forzado — no esta rama.
        Err(_) => return Clasificacion::BarridoUrgente,
        Ok(evento) => evento,
    };
    if evento.need_rescan() {
        return Clasificacion::BarridoUrgente;
    }
    let Some(ruta_cruda) = evento.paths.first() else {
        return Clasificacion::Ignorado;
    };
    // Canonicalizar el LADO DEL EVENTO: FSEvents en macOS tiene historial de reportar
    // rutas ya resueltas por symlink. Si el path ya no existe —el caso típico de una
    // BAJA, que ya se fue del disco para cuando este mensaje se procesa— `canonicalize`
    // falla y el evento se ignora acá. No es pérdida de datos: el barrido periódico
    // sigue siendo la única fuente legítima de una baja: este canal solo acelera el
    // reconocimiento de altas y cambios.
    let Ok(ruta_del_evento) = ruta_cruda.canonicalize() else {
        return Clasificacion::Ignorado;
    };
    for (id, raiz_absoluta) in raices {
        // Y el LADO DE LA RAÍZ: una raíz registrada puede vivir detrás de un symlink
        // (`/tmp`, una carpeta de sync en la nube). Comparar crudo contra resuelto
        // nunca matchearía.
        let Ok(raiz_canonica) = raiz_absoluta.canonicalize() else {
            continue;
        };
        let Ok(relativa) = ruta_del_evento.strip_prefix(&raiz_canonica) else {
            continue;
        };
        // A partir de acá esta raíz YA matcheo: lo que sigue es terminal (Ignorado o
        // Toque), no hay que seguir probando otras raíces.
        let Some(bruta) = relativa.to_str() else {
            return Clasificacion::Ignorado;
        };
        let Ok(ruta) = RutaRelativa::canonica(bruta) else {
            return Clasificacion::Ignorado;
        };
        if ruta_excluida_por_convencion(ruta.como_str()) {
            return Clasificacion::Ignorado;
        }
        return Clasificacion::Toque(id.clone(), ruta);
    }
    Clasificacion::Ignorado
}

#[cfg(test)]
mod tests_clasificar {
    use super::*;

    /// Una subcarpeta única bajo el temp del sistema, sin la dependencia `tempfile` —
    /// mismo criterio que el test de integración de `Observador`. `clasificar` hace
    /// `canonicalize()` real sobre ambos lados (raíz y evento), así que sus pruebas
    /// necesitan rutas que EXISTAN de verdad; eso no ejercita ningún `notify::Watcher`
    /// — sigue siendo la función pura, con eventos/errores sintéticos, que pide la
    /// verificación del plan.
    fn dir_temporal_unica() -> PathBuf {
        static CONTADOR: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "savia-observador-clasificar-{}-{nanos}-{n}",
            std::process::id()
        ))
    }

    #[test]
    fn un_evento_de_rescan_pide_barrido_urgente() {
        let evento =
            notify::Event::new(notify::EventKind::Other).set_flag(notify::event::Flag::Rescan);
        let raices = HashMap::new();
        assert_eq!(
            clasificar(Ok(evento), &raices),
            Clasificacion::BarridoUrgente
        );
    }

    #[test]
    fn un_error_del_canal_pide_barrido_urgente() {
        let error = notify::Error::generic("simulado para la prueba");
        let raices = HashMap::new();
        assert_eq!(
            clasificar(Err(error), &raices),
            Clasificacion::BarridoUrgente
        );
    }

    #[test]
    fn un_evento_normal_sobre_una_raiz_registrada_produce_un_toque() {
        let raiz_abs = dir_temporal_unica();
        std::fs::create_dir_all(&raiz_abs).expect("crear la raiz de prueba");
        let archivo = raiz_abs.join("documento.txt");
        std::fs::write(&archivo, b"contenido").expect("crear el archivo de prueba");

        let id = RaizId::nueva("raiz-de-prueba-normal");
        let mut raices = HashMap::new();
        raices.insert(id.clone(), raiz_abs.clone());

        let evento = notify::Event::new(notify::EventKind::Any).add_path(archivo.clone());
        let resultado = clasificar(Ok(evento), &raices);
        assert_eq!(
            resultado,
            Clasificacion::Toque(id, RutaRelativa::canonica("documento.txt").unwrap())
        );

        let _ = std::fs::remove_dir_all(&raiz_abs);
    }

    #[test]
    fn una_ruta_excluida_por_convencion_se_ignora() {
        let raiz_abs = dir_temporal_unica();
        std::fs::create_dir_all(raiz_abs.join(".git")).expect("crear .git de prueba");
        let archivo = raiz_abs.join(".git").join("HEAD");
        std::fs::write(&archivo, b"ref: refs/heads/main").expect("crear HEAD de prueba");

        let id = RaizId::nueva("raiz-de-prueba-excluida");
        let mut raices = HashMap::new();
        raices.insert(id, raiz_abs.clone());

        let evento = notify::Event::new(notify::EventKind::Any).add_path(archivo.clone());
        assert_eq!(clasificar(Ok(evento), &raices), Clasificacion::Ignorado);

        let _ = std::fs::remove_dir_all(&raiz_abs);
    }

    #[test]
    fn un_evento_fuera_de_toda_raiz_registrada_se_ignora() {
        let raiz_abs = dir_temporal_unica();
        std::fs::create_dir_all(&raiz_abs).expect("crear la raiz de prueba");
        let ajena = dir_temporal_unica();
        std::fs::create_dir_all(&ajena).expect("crear la carpeta ajena de prueba");
        let archivo_ajeno = ajena.join("ajeno.txt");
        std::fs::write(&archivo_ajeno, b"x").expect("crear el archivo ajeno de prueba");

        let id = RaizId::nueva("raiz-de-prueba-sin-match");
        let mut raices = HashMap::new();
        raices.insert(id, raiz_abs.clone());

        let evento = notify::Event::new(notify::EventKind::Any).add_path(archivo_ajeno.clone());
        assert_eq!(clasificar(Ok(evento), &raices), Clasificacion::Ignorado);

        let _ = std::fs::remove_dir_all(&raiz_abs);
        let _ = std::fs::remove_dir_all(&ajena);
    }
}

// ────────────────────── El algoritmo puro de sincronizar ─────────────────────

/// Lo que `Observador::sincronizar` tiene que hacer, calculado sin tocar `notify` para
/// nada — así se testea el algoritmo del diff sin ejercer syscalls reales.
#[derive(Debug, PartialEq, Eq)]
pub struct DiffDeSincronizacion {
    pub a_vigilar: Vec<(RaizId, PathBuf)>,
    /// `(id, ruta_vieja, ruta_nueva)`. Distinto de `a_vigilar`+`a_dejar` a propósito:
    /// es la MISMA raíz (mismo `RaizId`, decisión 7) que cambió de lugar, no dos raíces
    /// distintas.
    pub a_re_vigilar: Vec<(RaizId, PathBuf, PathBuf)>,
    pub a_dejar: Vec<(RaizId, PathBuf)>,
}

/// El diff es por **`(RaizId, ruta_absoluta)`, no por `RaizId` solo**. Un `RaizId` que
/// ya estaba vigilado pero con una `ruta_absoluta` distinta a la registrada —el caso
/// real de sacar una carpeta y volver a agregarla desde otro lado, que conserva el
/// MISMO `RaizId` por decisión 7 (`plataforma.rs:174-181`)— **no se deja en paz**:
/// dispara `a_re_vigilar`, no queda en la lista de "sin cambios". Diffear solo por
/// membresía de `RaizId` compilaría y pasaría cualquier test que no mueva una raíz, y
/// dejaría el observador mirando para siempre una ruta vaciada — sin error, sin log,
/// sin ningún síntoma hasta que alguien mueva justo esa carpeta.
pub fn diferencia(
    registro_actual: &HashMap<RaizId, PathBuf>,
    actuales: &[RaizRegistrada],
) -> DiffDeSincronizacion {
    let mut a_vigilar = Vec::new();
    let mut a_re_vigilar = Vec::new();
    let mut a_dejar = Vec::new();

    for raiz in actuales {
        match registro_actual.get(&raiz.id) {
            None => a_vigilar.push((raiz.id.clone(), raiz.ruta_absoluta.clone())),
            Some(ruta_vieja) if ruta_vieja != &raiz.ruta_absoluta => a_re_vigilar.push((
                raiz.id.clone(),
                ruta_vieja.clone(),
                raiz.ruta_absoluta.clone(),
            )),
            Some(_) => {} // misma id, misma ruta: sin cambios, se deja en paz.
        }
    }

    let ids_actuales: HashSet<&RaizId> = actuales.iter().map(|r| &r.id).collect();
    for (id, ruta) in registro_actual {
        if !ids_actuales.contains(id) {
            a_dejar.push((id.clone(), ruta.clone()));
        }
    }

    DiffDeSincronizacion {
        a_vigilar,
        a_re_vigilar,
        a_dejar,
    }
}

#[cfg(test)]
mod tests_diferencia {
    use super::*;
    use savia_folder_contrato::dominio::{IdDeArchivoDelSO, SensibilidadAMayusculas};
    use savia_folder_contrato::plataforma::{HuellaDeRaiz, IdDeVolumen};

    fn huella_de_prueba(n: u128) -> HuellaDeRaiz {
        HuellaDeRaiz {
            volumen: IdDeVolumen::NumeroDeDispositivo(1),
            directorio: IdDeArchivoDelSO(n),
        }
    }

    fn raiz(id: &str, ruta: &str) -> RaizRegistrada {
        RaizRegistrada {
            id: RaizId::nueva(id),
            huella: huella_de_prueba(1),
            ruta_absoluta: PathBuf::from(ruta),
            sensibilidad: SensibilidadAMayusculas::Distingue,
        }
    }

    #[test]
    fn una_raiz_nueva_va_a_vigilar() {
        let registro = HashMap::new();
        let actuales = vec![raiz("r1", "/tmp/r1")];
        let diff = diferencia(&registro, &actuales);
        assert_eq!(
            diff.a_vigilar,
            vec![(RaizId::nueva("r1"), PathBuf::from("/tmp/r1"))]
        );
        assert!(diff.a_re_vigilar.is_empty());
        assert!(diff.a_dejar.is_empty());
    }

    #[test]
    fn una_raiz_removida_va_a_dejar() {
        let mut registro = HashMap::new();
        registro.insert(RaizId::nueva("r1"), PathBuf::from("/tmp/r1"));
        let actuales: Vec<RaizRegistrada> = Vec::new();
        let diff = diferencia(&registro, &actuales);
        assert_eq!(
            diff.a_dejar,
            vec![(RaizId::nueva("r1"), PathBuf::from("/tmp/r1"))]
        );
        assert!(diff.a_vigilar.is_empty());
        assert!(diff.a_re_vigilar.is_empty());
    }

    #[test]
    fn una_raiz_sin_cambios_no_aparece_en_ningun_lado() {
        let mut registro = HashMap::new();
        registro.insert(RaizId::nueva("r1"), PathBuf::from("/tmp/r1"));
        let actuales = vec![raiz("r1", "/tmp/r1")];
        let diff = diferencia(&registro, &actuales);
        assert!(diff.a_vigilar.is_empty());
        assert!(diff.a_re_vigilar.is_empty());
        assert!(diff.a_dejar.is_empty());
    }

    /// EL TEST DEDICADO AL BUG DE MOVER UNA CARPETA: mismo `RaizId`, `ruta_absoluta`
    /// distinta entre "antes" y "actuales" tiene que aparecer en `a_re_vigilar`, y NO
    /// quedar afuera como si fuera "sin cambios" por estar el id presente en los dos
    /// lados.
    #[test]
    fn una_raiz_con_ruta_distinta_va_a_re_vigilar_no_se_deja_en_paz() {
        let id = RaizId::nueva("raiz-movida");
        let vieja_ruta = PathBuf::from("/tmp/viejo-lugar");
        let nueva_ruta = PathBuf::from("/tmp/nuevo-lugar");

        let mut registro = HashMap::new();
        registro.insert(id.clone(), vieja_ruta.clone());

        let actuales = vec![RaizRegistrada {
            id: id.clone(),
            huella: huella_de_prueba(2),
            ruta_absoluta: nueva_ruta.clone(),
            sensibilidad: SensibilidadAMayusculas::Distingue,
        }];

        let diff = diferencia(&registro, &actuales);

        assert_eq!(diff.a_re_vigilar, vec![(id, vieja_ruta, nueva_ruta)]);
        assert!(diff.a_vigilar.is_empty());
        assert!(diff.a_dejar.is_empty());
    }
}

// ─────────────────────────────── El I/O real ─────────────────────────────────

/// El observador de filesystem con estado real: un hilo propio, un
/// `notify::RecommendedWatcher` (FSEvents en macOS, `ReadDirectoryChangesW` en Windows
/// — `notify` resuelve el backend por dentro) y el registro de qué raíz vigila qué
/// ruta.
pub struct Observador {
    /// `Mutex` y no acceso directo: `notify::Watcher::watch`/`unwatch` piden `&mut
    /// self`, y `sincronizar` recibe `&self` (para poder llamarse sin bloquear otra
    /// cosa del lado del llamador). Es un candado DISTINTO del de `registro` — se
    /// mantiene tomado solo durante las syscalls reales, nunca junto con el otro.
    watcher: Mutex<notify::RecommendedWatcher>,
    /// Compartido con el hilo de fondo (`bucle_de_observacion`), que lo LEE para
    /// resolver cada evento a una raíz — de ahí el `Arc`. Sigue la misma política de
    /// poison que `Buzon<T>` en `main.rs:67-76`: **nunca panic**. Un candado envenenado
    /// se trata como registro vacío, y se reconstruye entero en el próximo
    /// `sincronizar`, porque su contenido es enteramente re-derivable del inventario.
    registro: Arc<Mutex<HashMap<RaizId, PathBuf>>>,
    /// Señal GLOBAL, no por raíz — mismo nivel de grano que el timer periódico que ya
    /// fuerza un barrido de TODAS las raíces. Un `AtomicBool` no tiene concepto de
    /// envenenamiento, así que no suma una segunda decisión de poison-safety.
    pedido_de_barrido_urgente: Arc<AtomicBool>,
}

impl Observador {
    /// Arma el watcher real, un canal interno para lo que `notify` entrega
    /// (`notify::Result<notify::Event>`, NO un `Event` crudo — hay que atender las dos
    /// ramas) y un canal externo de salida con los toques ya clasificados y debounced.
    /// Lanza un hilo propio que drena el canal interno, clasifica cada mensaje,
    /// alimenta el `Asentador` y reenvía lo que vence.
    pub fn nuevo(
        plataforma: Arc<dyn Plataforma>,
        ventana: Duration,
    ) -> Result<(Self, mpsc::Receiver<(RaizId, RutaRelativa)>), ErrorDeObservador> {
        let (tx_interna, rx_interna) = mpsc::channel::<notify::Result<notify::Event>>();
        let watcher = notify::recommended_watcher(tx_interna).map_err(ErrorDeObservador)?;

        let (tx_externa, rx_externa) = mpsc::channel::<(RaizId, RutaRelativa)>();
        let pedido_de_barrido_urgente = Arc::new(AtomicBool::new(false));
        let registro: Arc<Mutex<HashMap<RaizId, PathBuf>>> = Arc::new(Mutex::new(HashMap::new()));

        let pedido_del_hilo = Arc::clone(&pedido_de_barrido_urgente);
        let registro_del_hilo = Arc::clone(&registro);
        std::thread::spawn(move || {
            bucle_de_observacion(
                rx_interna,
                tx_externa,
                registro_del_hilo,
                pedido_del_hilo,
                plataforma,
                ventana,
            );
        });

        Ok((
            Self {
                watcher: Mutex::new(watcher),
                registro,
                pedido_de_barrido_urgente,
            },
            rx_externa,
        ))
    }

    /// Diffea el registro actual contra `actuales` (algoritmo puro: `diferencia`) y
    /// aplica los `watch`/`unwatch` reales. **El candado del registro se suelta ANTES
    /// de las syscalls** — son de latencia no acotada (red lenta, permisos), y
    /// mantenerlas bajo candado colgaría a cualquier otro consumidor del registro
    /// mientras duran. Ante un root que no se puede vigilar (permiso denegado, ruta
    /// rara): `log::warn!` y seguir con las demás — misma política que `Buzon<T>`
    /// declara explícita en `main.rs`: *"nunca panic"*.
    pub fn sincronizar(&self, actuales: &[RaizRegistrada]) {
        let diff = {
            let registro_actual = match self.registro.lock() {
                Ok(g) => g.clone(),
                Err(_) => HashMap::new(),
            };
            diferencia(&registro_actual, actuales)
        }; // candado del registro suelto acá — lo que sigue son syscalls.

        let mut watcher = match self.watcher.lock() {
            Ok(w) => w,
            Err(_) => {
                log::error!(
                    "observador: el candado del watcher esta envenenado, se salta esta sincronizacion"
                );
                return;
            }
        };

        for (id, ruta) in &diff.a_vigilar {
            if let Err(e) = watcher.watch(ruta, RecursiveMode::Recursive) {
                log::warn!(
                    "observador: no se pudo vigilar {} ({}): {e}",
                    id.como_str(),
                    ruta.display()
                );
            }
        }
        for (id, vieja, nueva) in &diff.a_re_vigilar {
            if let Err(e) = watcher.unwatch(vieja) {
                log::warn!(
                    "observador: no se pudo dejar de vigilar la ruta vieja de {} ({}): {e}",
                    id.como_str(),
                    vieja.display()
                );
            }
            if let Err(e) = watcher.watch(nueva, RecursiveMode::Recursive) {
                log::warn!(
                    "observador: no se pudo re-vigilar {} ({}): {e}",
                    id.como_str(),
                    nueva.display()
                );
            }
        }
        for (id, ruta) in &diff.a_dejar {
            if let Err(e) = watcher.unwatch(ruta) {
                log::warn!(
                    "observador: no se pudo dejar de vigilar {} ({}): {e}",
                    id.como_str(),
                    ruta.display()
                );
            }
        }
        drop(watcher); // syscalls terminadas: soltar antes de tocar el otro candado.

        // El registro se actualiza para reflejar lo que `actuales` pide, aunque alguna
        // syscall individual haya fallado arriba (ya logueada): un root persistentemente
        // roto (permiso denegado que no se va a resolver solo) no tiene sentido
        // reintentarlo en CADA vuelta — el inventario sigue siendo la fuente de verdad,
        // y el próximo `sincronizar` vuelve a comparar contra él.
        if let Ok(mut registro) = self.registro.lock() {
            for (id, ruta) in &diff.a_vigilar {
                registro.insert(id.clone(), ruta.clone());
            }
            for (id, _, nueva) in &diff.a_re_vigilar {
                registro.insert(id.clone(), nueva.clone());
            }
            for (id, _) in &diff.a_dejar {
                registro.remove(id);
            }
        }
        // Si el candado esta envenenado acá: no hay nada que hacer. El próximo
        // `sincronizar` reconstruye el registro entero desde `actuales`, que es la
        // fuente de verdad real — mismo espiritu que el resto de esta política.
    }

    /// Swap atómico a `false`, devuelve el valor anterior — mismo espíritu "tomar" que
    /// `Buzon::tomar` en `main.rs`.
    pub fn tomar_pedido_de_barrido_urgente(&self) -> bool {
        self.pedido_de_barrido_urgente.swap(false, Ordering::SeqCst)
    }
}

/// El cuerpo del hilo de fondo de `Observador`. Drena el canal interno de `notify`,
/// clasifica cada mensaje y en cada despertar —con o sin mensaje nuevo— revisa qué
/// venció en el `Asentador` y lo reenvía por el canal externo.
///
/// El `recv_timeout` de cada vuelta se dimensiona a lo que falte para que venza la
/// entrada más vieja pendiente — así el hilo no duerme más de lo que puede permitirse
/// sin perder precisión en el debounce, y tampoco gasta CPU en un bucle apretado
/// cuando no hay nada pendiente.
fn bucle_de_observacion(
    rx_interna: mpsc::Receiver<notify::Result<notify::Event>>,
    tx_externa: mpsc::Sender<(RaizId, RutaRelativa)>,
    registro: Arc<Mutex<HashMap<RaizId, PathBuf>>>,
    pedido_de_barrido_urgente: Arc<AtomicBool>,
    plataforma: Arc<dyn Plataforma>,
    ventana: Duration,
) {
    let mut asentador = Asentador::nuevo();
    loop {
        let timeout = asentador
            .proximo_vencimiento(plataforma.ahora(), ventana)
            .unwrap_or(ventana);
        match rx_interna.recv_timeout(timeout) {
            Ok(resultado) => {
                let raices = match registro.lock() {
                    Ok(g) => g.clone(),
                    Err(_) => HashMap::new(),
                };
                match clasificar(resultado, &raices) {
                    Clasificacion::Toque(id, ruta) => {
                        asentador.tocar((id, ruta), plataforma.ahora());
                    }
                    Clasificacion::BarridoUrgente => {
                        pedido_de_barrido_urgente.store(true, Ordering::SeqCst);
                    }
                    Clasificacion::Ignorado => {}
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                // El watcher de `notify` murio (el `Observador` entero se solto) — no
                // hay mas eventos que esperar nunca. Salir del bucle: seguir corriendo
                // aca adentro seria un hilo zombie gastando CPU en un `recv_timeout`
                // que siempre vuelve al toque.
                break;
            }
        }
        for (id, ruta) in asentador.vencidos(plataforma.ahora(), ventana) {
            if tx_externa.send((id, ruta)).is_err() {
                // El receptor externo (`trabajar()`) ya no existe — mismo motivo que
                // arriba: no hay para quien seguir trabajando.
                return;
            }
        }
    }
}
