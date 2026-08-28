//! Fixtures compartidos entre los bancos de `aplicacion/tests/`. `raiz()`, `politica()`,
//! `almacen()`, `r()` y `confirmar_todo()`/`barrer_y_confirmar()` estaban copiados
//! byte-a-byte en `maquina.rs`, `hallazgos.rs` y `progreso.rs` — este ultimo ni siquiera
//! los nombraba funcion, los inlineaba en cada test. `Mini`/`tiempos_del_banco()` se
//! sumaron despues por el mismo motivo, movidos ENTEROS desde `hallazgos.rs`: son el
//! unico camino para que un test construya un `Subido` de verdad (sus campos son
//! privados fuera de `protocolo`), asi que cualquier prueba de `Subir`/`ConfirmarSubida`
//! —incluidas las de `drenar_reportando` en `progreso.rs`— los necesita igual. Un
//! subdirectorio de `tests/` (y no un archivo suelto `tests/comun.rs`) es lo que hace que
//! Cargo NO lo compile como su propio binario de integracion: cada archivo que lo usa
//! declara `mod comun;` y lo consume como submodulo propio.
//!
//! `panel.rs` queda AFUERA a proposito: su `registrada()` usa otra `ruta_absoluta`, y su
//! `drenar_con`/`barrer_y_confirmar` son una forma mas general —reusada por varios tests
//! con respuestas a medida, no solo "confirmar todo"— y no una copia de esto.
//!
//! `#![allow(dead_code)]`: Cargo compila este archivo una vez POR cada `tests/*.rs` que
//! declara `mod comun;` —es un submodulo de tres binarios de integracion distintos, no
//! uno solo— y cada uno importa solo el subconjunto que usa. Que `progreso.rs` no
//! necesite `r()` no es codigo muerto del modulo: es la razon de ser de compartirlo.
#![allow(dead_code)]

use savia_folder_aplicacion::ciclo;
use savia_folder_contrato::colas::{Decision, SweepId, Veredicto};
use savia_folder_contrato::dominio::{
    BarridoId, HashVerificado, RaizId, RutaRelativa, SensibilidadAMayusculas,
};
use savia_folder_contrato::plataforma::RaizRegistrada;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{Desenlace, ParametrosDeCola, Proximo, Recibido, Trabajo};
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas::Politica;
use savia_folder_protocolo::Tiempos;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// El intervalo del BANCO, no del producto. `parametros::ASENTAMIENTO` sigue en `None`.
pub const ASENTAMIENTO_DEL_BANCO: Duration = Duration::from_secs(30);

pub fn raiz() -> RaizId {
    RaizId::nueva("root-1")
}

pub fn registrada() -> RaizRegistrada {
    RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    }
}

pub fn politica() -> Politica {
    Politica::con_asentamiento(ASENTAMIENTO_DEL_BANCO).expect("el banco lo provee")
}

pub fn almacen() -> Almacen {
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(registrada());
    a
}

pub fn r(s: &str) -> RutaRelativa {
    RutaRelativa::canonica(s).expect("ruta del banco")
}

/// Drena contra un servidor de mentira que contesta `known` a todo — inclusive el
/// upload por bytes: `Subir`/`ConfirmarSubida` responden con el hash verificado, no con
/// `Recibido::Nada`. Es lo unico que despues puede viajar en una baja.
pub fn confirmar_todo(a: &mut Almacen) {
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

/// Barre y ademas CONFIRMA todo contra un servidor de mentira, para que las filas queden
/// con hash verificado — que es lo unico que despues puede viajar en una baja.
pub fn barrer_y_confirmar(p: &Falsa, a: &mut Almacen, n: u32) {
    let barrido = BarridoId::nuevo(format!("b{n}"));
    ciclo::barrer(&raiz(), barrido, p, a, &politica());
    confirmar_todo(a);
}

pub fn tiempos_del_banco() -> Tiempos {
    Tiempos {
        conexion: Duration::from_secs(2),
        por_llamada: Duration::from_secs(2),
        envio_de_cuerpo: None,
    }
}

/// Un servidor de una linea: acepta conexiones hasta que lo paran, anota
/// `METODO ruta` de cada pedido y contesta lo que diga `responder`.
///
/// **Extraido de `hallazgos.rs` para que `progreso.rs` pueda ejercer `Subir`/
/// `ConfirmarSubida` de verdad**: el testigo `Subido` que `CanalDeSavia::subir` devuelve
/// tiene los campos privados —solo el `Cliente` real (en el crate `protocolo`) lo puede
/// construir—, asi que probar el tramo de bytes de `ciclo::drenar_reportando` exige un
/// `Cliente` real hablandole a ALGO, y `Mini` es ese algo sin levantar un servidor de
/// mentira completo.
pub struct Mini {
    pub puerto: u16,
    vistos: Arc<Mutex<Vec<String>>>,
    parar: Arc<AtomicBool>,
    hilo: Option<std::thread::JoinHandle<()>>,
}

impl Mini {
    pub fn nuevo(responder: impl Fn(&str) -> (u16, String) + Send + 'static) -> Self {
        let l = TcpListener::bind("127.0.0.1:0").expect("puerto efimero");
        let puerto = l.local_addr().unwrap().port();
        l.set_nonblocking(true).unwrap();
        let vistos = Arc::new(Mutex::new(Vec::new()));
        let parar = Arc::new(AtomicBool::new(false));
        let (v, s) = (vistos.clone(), parar.clone());
        let hilo = std::thread::spawn(move || {
            while !s.load(Ordering::Relaxed) {
                match l.accept() {
                    Ok((mut c, _)) => {
                        // EL ACEPTADO HEREDA `O_NONBLOCK` DEL LISTENER en macOS, y sin
                        // sacarselo el primer `read` devuelve `WouldBlock`, el lazo de
                        // abajo termina con el pedido vacio, y el servidor cierra mientras
                        // el cliente todavia escribe el cuerpo: `Broken pipe` intermitente
                        // que no tiene nada que ver con lo que la prueba afirma.
                        c.set_nonblocking(false).ok();
                        c.set_read_timeout(Some(Duration::from_secs(2))).ok();
                        let mut crudo = Vec::new();
                        let mut buf = [0u8; 4096];
                        while let Ok(n) = c.read(&mut buf) {
                            if n == 0 {
                                break;
                            }
                            crudo.extend_from_slice(&buf[..n]);
                            let texto = String::from_utf8_lossy(&crudo).to_string();
                            let Some((cab, cuerpo)) = texto.split_once("\r\n\r\n") else {
                                continue;
                            };
                            let largo = cab
                                .lines()
                                .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                                .and_then(|l| l.split(':').nth(1))
                                .and_then(|l| l.trim().parse::<usize>().ok())
                                .unwrap_or(0);
                            if cuerpo.len() >= largo {
                                break;
                            }
                        }
                        let texto = String::from_utf8_lossy(&crudo).to_string();
                        let linea = texto.lines().next().unwrap_or("").to_string();
                        let mut partes = linea.split_whitespace();
                        let clave = format!(
                            "{} {}",
                            partes.next().unwrap_or(""),
                            partes.next().unwrap_or("")
                        );
                        v.lock().unwrap().push(clave.clone());
                        let (codigo, cuerpo) = responder(&clave);
                        let _ = c.write_all(
                            format!(
                                "HTTP/1.1 {codigo} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}",
                                cuerpo.len()
                            )
                            .as_bytes(),
                        );
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
                }
            }
        });
        Self {
            puerto,
            vistos,
            parar,
            hilo: Some(hilo),
        }
    }
    pub fn vistos(&self) -> Vec<String> {
        self.vistos.lock().unwrap().clone()
    }
}

impl Drop for Mini {
    fn drop(&mut self) {
        self.parar.store(true, Ordering::Relaxed);
        if let Some(h) = self.hilo.take() {
            let _ = h.join();
        }
    }
}
