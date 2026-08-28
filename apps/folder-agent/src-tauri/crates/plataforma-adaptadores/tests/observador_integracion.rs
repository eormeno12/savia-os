//! Los ÚNICOS tests que ejercen un `notify::Watcher` real (FSEvents en macOS,
//! `ReadDirectoryChangesW` en Windows). Son más lentos y potencialmente menos
//! deterministas que el resto de la suite — de ahí que vivan en su propio archivo bajo
//! `tests/` y no inline en `src/observador.rs`, donde `Asentador`, `clasificar` y
//! `diferencia` se testean sin ningún I/O de `notify`.
//!
//! Cuatro escenarios, todos contra el mismo `Observador` real: crear un archivo, tocar
//! (modificar) uno existente, borrarlo, y mover una raíz completa a otra ruta. Los
//! primeros tres verifican el canal de salida extremo a extremo; el cuarto es el único
//! punto donde `Observador::sincronizar` se llama DOS VECES sobre el mismo `RaizId` con
//! `ruta_absoluta` distinta y se confirma el `unwatch`/`watch` real — no solo el
//! algoritmo puro `diferencia`, que ya se testea aparte en `src/observador.rs`.
//!
//! Necesita `Plataforma::ahora()` real (que avance con el tiempo de pared, no con un
//! reloj falso e inmóvil como el de `plataforma-falsa`, que solo avanza cuando alguien
//! llama `avanzar()` a mano) porque el debounce de `Observador` corre en SU PROPIO
//! hilo, comparando contra el reloj real mientras este test espera con un
//! `recv_timeout`. Por eso el doble de acá es propio y mínimo, no
//! `plataforma_falsa::Falsa`: el reloj es lo único que importa, y todo lo demás en el
//! trait no se ejercita en este camino.

use savia_folder_contrato::dominio::{
    HashAfirmado, IdDeArchivoDelSO, Instante, Observacion, RaizId, RutaRelativa,
    SensibilidadAMayusculas,
};
use savia_folder_contrato::plataforma::{
    CursorDurable, EvidenciaDeRaiz, FalloDeEnumeracion, FalloDeLectura, Ficha, HuellaDeRaiz,
    IdDeVolumen, MotivoDeBarrido, PlanDeArranque, Plataforma, PoliticaDeDeshidratacion,
    RaizRegistrada,
};
use savia_folder_plataforma_adaptadores::observador::Observador;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

/// Un `Plataforma` sintético cuyo único método real es `ahora()`, con el tiempo de
/// pared del propio proceso de test como origen. Los demás métodos no los llama nadie
/// en este camino — `Observador` solo necesita `ahora()` para el debounce, y
/// `sincronizar` no toca ningún otro método de `Plataforma`.
struct PlataformaDePrueba {
    origen: std::time::Instant,
}

impl PlataformaDePrueba {
    fn nueva() -> Self {
        Self {
            origen: std::time::Instant::now(),
        }
    }
}

impl Plataforma for PlataformaDePrueba {
    fn politica_de_deshidratacion(&self) -> PoliticaDeDeshidratacion {
        PoliticaDeDeshidratacion::LeerMaterializa
    }

    fn plan_de_arranque(
        &self,
        _raiz: &RaizRegistrada,
        _cursor: Option<&CursorDurable>,
    ) -> PlanDeArranque {
        PlanDeArranque::BarridoCompleto {
            porque: MotivoDeBarrido::SinInventario,
        }
    }

    fn huella_de_raiz(&self, _ruta: &Path) -> Result<HuellaDeRaiz, FalloDeEnumeracion> {
        unimplemented!("no se ejerce en este test: solo importa `ahora()`")
    }

    fn evidencia_de_raiz(&self, _raiz: &RaizRegistrada) -> EvidenciaDeRaiz {
        unimplemented!("no se ejerce en este test: solo importa `ahora()`")
    }

    fn ficha(&self, _raiz: &RaizRegistrada, _ruta: &RutaRelativa) -> Ficha {
        unimplemented!("no se ejerce en este test: solo importa `ahora()`")
    }

    fn hashear(
        &self,
        _raiz: &RaizRegistrada,
        _ruta: &RutaRelativa,
    ) -> Result<(HashAfirmado, Observacion), FalloDeLectura> {
        unimplemented!("no se ejerce en este test: solo importa `ahora()`")
    }

    fn leer_para_subir(
        &self,
        _raiz: &RaizRegistrada,
        _ruta: &RutaRelativa,
    ) -> Result<Vec<u8>, FalloDeLectura> {
        unimplemented!("no se ejerce en este test: solo importa `ahora()`")
    }

    fn granularidad_de_mtime(&self, _raiz: &RaizRegistrada) -> Duration {
        Duration::ZERO
    }

    fn ahora(&self) -> Instante {
        Instante::desde_nanos(self.origen.elapsed().as_nanos() as u64)
    }
}

/// Una subcarpeta única bajo el temp del sistema — sin la dependencia `tempfile`, mismo
/// criterio que el resto del banco de este crate. Lleva un contador atómico ademas del
/// nanosegundo (mismo motivo que `dir_temporal_unica` en `tests_clasificar`, dentro de
/// `src/observador.rs`): algunos tests de este archivo piden DOS rutas distintas en la
/// misma vuelta, mas rapido de lo que el reloj de pared garantiza que difiera.
fn dir_temporal_unica() -> std::path::PathBuf {
    static CONTADOR: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = CONTADOR.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "savia-observador-integracion-{}-{nanos}-{n}",
        std::process::id()
    ))
}

/// Fabrica una `RaizRegistrada` de prueba sobre `ruta` — factorizado porque varios
/// tests de este archivo arman mas de una (la misma raiz, en rutas distintas, para el
/// escenario de "mover una carpeta").
fn raiz_registrada_en(id: &RaizId, ruta: &Path) -> RaizRegistrada {
    RaizRegistrada {
        id: id.clone(),
        huella: HuellaDeRaiz {
            volumen: IdDeVolumen::NumeroDeDispositivo(1),
            directorio: IdDeArchivoDelSO(1),
        },
        ruta_absoluta: ruta.to_path_buf(),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    }
}

#[test]
fn un_archivo_real_creado_llega_por_el_canal_de_salida() {
    let raiz_abs = dir_temporal_unica();
    std::fs::create_dir_all(&raiz_abs).expect("crear el directorio temporal de prueba");

    let plataforma: Arc<dyn Plataforma> = Arc::new(PlataformaDePrueba::nueva());
    let ventana = Duration::from_millis(50);
    let (observador, receptor) =
        Observador::nuevo(Arc::clone(&plataforma), ventana).expect("el observador arranca");

    let id = RaizId::nueva("raiz-de-integracion");
    observador.sincronizar(&[raiz_registrada_en(&id, &raiz_abs)]);

    // Instalar el watch real (FSEvents/ReadDirectoryChangesW) no es instantáneo — le da
    // tiempo antes de generar la actividad que el test quiere ver reflejada.
    std::thread::sleep(Duration::from_millis(300));

    let archivo = raiz_abs.join("documento.txt");
    std::fs::write(&archivo, b"contenido inicial").expect("crear el archivo de prueba");

    let (raiz_recibida, ruta_recibida) = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("el canal deberia entregar un toque para el archivo creado");
    assert_eq!(raiz_recibida, id);
    assert_eq!(
        ruta_recibida,
        RutaRelativa::canonica("documento.txt").unwrap()
    );

    let _ = std::fs::remove_dir_all(&raiz_abs);
}

#[test]
fn un_archivo_real_tocado_llega_por_el_canal_de_salida() {
    let raiz_abs = dir_temporal_unica();
    std::fs::create_dir_all(&raiz_abs).expect("crear el directorio temporal de prueba");

    let plataforma: Arc<dyn Plataforma> = Arc::new(PlataformaDePrueba::nueva());
    let ventana = Duration::from_millis(50);
    let (observador, receptor) =
        Observador::nuevo(Arc::clone(&plataforma), ventana).expect("el observador arranca");

    let id = RaizId::nueva("raiz-de-integracion-toque");
    observador.sincronizar(&[raiz_registrada_en(&id, &raiz_abs)]);
    std::thread::sleep(Duration::from_millis(300));

    let archivo = raiz_abs.join("documento.txt");
    std::fs::write(&archivo, b"contenido inicial").expect("crear el archivo de prueba");

    // Drena el toque de la creacion — a este test solo le interesa el de la
    // MODIFICACION que sigue.
    let _ = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("el canal deberia entregar un toque para la creacion");

    std::fs::write(&archivo, b"contenido modificado").expect("modificar el archivo de prueba");

    let (raiz_recibida, ruta_recibida) = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("el canal deberia entregar un toque para el archivo modificado");
    assert_eq!(raiz_recibida, id);
    assert_eq!(
        ruta_recibida,
        RutaRelativa::canonica("documento.txt").unwrap()
    );

    let _ = std::fs::remove_dir_all(&raiz_abs);
}

#[test]
fn un_archivo_real_borrado_no_produce_un_toque_espurio() {
    let raiz_abs = dir_temporal_unica();
    std::fs::create_dir_all(&raiz_abs).expect("crear el directorio temporal de prueba");

    let plataforma: Arc<dyn Plataforma> = Arc::new(PlataformaDePrueba::nueva());
    let ventana = Duration::from_millis(50);
    let (observador, receptor) =
        Observador::nuevo(Arc::clone(&plataforma), ventana).expect("el observador arranca");

    let id = RaizId::nueva("raiz-de-integracion-baja");
    observador.sincronizar(&[raiz_registrada_en(&id, &raiz_abs)]);
    std::thread::sleep(Duration::from_millis(300));

    let archivo = raiz_abs.join("documento.txt");
    std::fs::write(&archivo, b"contenido inicial").expect("crear el archivo de prueba");

    // Drena el toque de la creacion — a este test solo le interesa lo que pasa DESPUES
    // del borrado.
    let _ = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("el canal deberia entregar un toque para la creacion");

    std::fs::remove_file(&archivo).expect("borrar el archivo de prueba");

    // `clasificar` documenta que un path que ya no existe hace fallar `canonicalize` y
    // el evento se ignora — el barrido periodico, no este canal, sigue siendo la unica
    // fuente legitima de una baja. La contraparte de ese diseño es que ACA no tiene que
    // llegar nada: confirmamos la ausencia con un timeout generoso, no instantaneo, para
    // no confundir "todavia no llego" con "nunca iba a llegar".
    let resultado = receptor.recv_timeout(Duration::from_secs(3));
    assert!(
        resultado.is_err(),
        "un archivo borrado no deberia producir un toque, pero llego: {resultado:?}"
    );

    let _ = std::fs::remove_dir_all(&raiz_abs);
}

#[test]
fn mover_una_raiz_deja_de_vigilar_la_ruta_vieja_y_vigila_la_nueva() {
    let raiz_vieja = dir_temporal_unica();
    let raiz_nueva = dir_temporal_unica();
    std::fs::create_dir_all(&raiz_vieja).expect("crear el directorio vieja de prueba");
    std::fs::create_dir_all(&raiz_nueva).expect("crear el directorio nueva de prueba");

    let plataforma: Arc<dyn Plataforma> = Arc::new(PlataformaDePrueba::nueva());
    let ventana = Duration::from_millis(50);
    let (observador, receptor) =
        Observador::nuevo(Arc::clone(&plataforma), ventana).expect("el observador arranca");

    // El mismo `RaizId` en las dos llamadas — decision 7 (`plataforma.rs:174-181`): mover
    // una carpeta conserva el id, y es justo eso lo que `sincronizar` tiene que notar.
    let id = RaizId::nueva("raiz-de-integracion-movida");

    observador.sincronizar(&[raiz_registrada_en(&id, &raiz_vieja)]);
    std::thread::sleep(Duration::from_millis(300));

    // Confirma que la ruta VIEJA esta realmente vigilada antes de moverla — si esto
    // fallara, el resto del test no probaria nada.
    std::fs::write(raiz_vieja.join("antes.txt"), b"x").expect("crear archivo en la ruta vieja");
    let (raiz_recibida, _) = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("la ruta vieja deberia estar vigilada antes del re-sincronizar");
    assert_eq!(raiz_recibida, id);

    // SEGUNDA llamada a `sincronizar`, mismo id, `ruta_absoluta` distinta: esto es lo
    // que tiene que disparar `unwatch(vieja)` + `watch(nueva)` reales del lado de
    // `notify` — no solo el algoritmo puro `diferencia`, que ya se testea aparte.
    observador.sincronizar(&[raiz_registrada_en(&id, &raiz_nueva)]);
    std::thread::sleep(Duration::from_millis(300));

    std::fs::write(raiz_nueva.join("nuevo.txt"), b"x").expect("crear archivo en la ruta nueva");

    let (raiz_recibida, ruta_recibida) = receptor
        .recv_timeout(Duration::from_secs(15))
        .expect("la ruta nueva deberia estar vigilada tras el re-sincronizar");
    assert_eq!(raiz_recibida, id);
    assert_eq!(ruta_recibida, RutaRelativa::canonica("nuevo.txt").unwrap());

    // Y la ruta VIEJA ya no tiene que entregar nada: si el `unwatch` no hubiera
    // ocurrido de verdad, escribir ahí seguiria generando un toque.
    std::fs::write(raiz_vieja.join("despues.txt"), b"x").expect("crear archivo en la ruta vieja");
    let resultado = receptor.recv_timeout(Duration::from_secs(3));
    assert!(
        resultado.is_err(),
        "la ruta vieja ya no deberia estar vigilada, pero llego: {resultado:?}"
    );

    let _ = std::fs::remove_dir_all(&raiz_vieja);
    let _ = std::fs::remove_dir_all(&raiz_nueva);
}
