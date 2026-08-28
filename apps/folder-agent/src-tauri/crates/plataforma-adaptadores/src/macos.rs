//! macOS. Es la unica implementacion real de este tramo, y hay dos cosas que hace bien
//! porque el resto del diseno depende de ellas, y una que hace a medias y esta rotulada.
//!
//! BIEN, Y MEDIDO EN ESTA MAQUINA:
//!
//!  1. **El reloj es `mach_continuous_time`, no `Instant`.** Con 24 h 13 min de uptime,
//!     `Instant::now()` marcaba `tv_sec: 39783` —identico a `mach_absolute_time`—
//!     contra 87733 s reales. Perdio 13 h 19 min: el 55 % del intervalo, porque la
//!     laptop durmio. Con `Instant`, un asentamiento de 30 s no vence NUNCA en una
//!     maquina que se cierra.
//!
//!  2. **La deshidratacion se detecta con `SF_DATALESS` en `st_flags`, y por `lstat`.**
//!     `stat(2)` no materializa; `open(2)` si. Aca esta la unica linea del nucleo que
//!     separa «un agente liviano» de «descargarle al usuario el drive de nube entero»,
//!     y ademas el hilo se protege con `setiopolicy_np(..., OFF)` para que la seguridad
//!     no dependa de que el clasificador acierte.
//!
//! A MEDIAS, Y ROTULADO: la identidad de volumen es `st_dev` y no `ATTR_VOL_UUID`. Lo
//! correcto es `getattrlist` con `#[repr(C, packed)]` leyendo los atributos en ORDEN DE
//! BIT (`ATTR_VOL_CAPABILITIES` = 0x20000 va ANTES que `ATTR_VOL_UUID` = 0x40000, y sin
//! `packed` el UUID sale plausible y falso). `st_dev` se reasigna entre montajes, asi
//! que el degrade tiene un modo de falla conocido: tras un remontaje la raiz puede
//! quedar `Suplantada`. **Falla del lado seguro** —una raiz suplantada no reporta ni
//! una baja— y el sintoma es visible en el panel, que es lo que lo hace aceptable como
//! provisional y no como definitivo.
//!
//! Sigue sin haber un CURSOR de FSEvents para `plan_de_arranque` (el replay de
//! arranque): esa funcion devuelve SIEMPRE `BarridoCompleto`, o sea el mismo brazo que
//! Windows. Es correcto y es caro, no es incorrecto y barato.
//!
//! **LO QUE YA NO ES CIERTO, Y HAY QUE DECIRLO PARA NO CONFLAR LAS DOS COSAS**: FSEvents
//! para SEÑALES EN VIVO —detectar que algo cambio mientras el agente ya esta corriendo,
//! no reconstruir que paso mientras estuvo apagado— ya existe, vive en el modulo
//! hermano `observador.rs`, vía `notify`. Son dos preguntas distintas: "¿que perdi
//! mientras no miraba?" (`plan_de_arranque`, sigue sin cursor, sigue barriendo entero)
//! y "¿que esta pasando ahora?" (`observador.rs`, ya resuelta).

use savia_folder_contrato::dominio::{
    HashAfirmado, IdDeArchivoDelSO, Instante, Mtime, Observacion, RutaRelativa,
};
use savia_folder_contrato::plataforma::{
    Clase, CursorDurable, EntradaEnumerada, ErrorDePlataforma, EvidenciaDeRaiz, FalloDeEnumeracion,
    FalloDeLectura, Ficha, Hidratacion, HuellaDeRaiz, IdDeVolumen, MotivoDeBarrido,
    MotivoIndeterminado, PlanDeArranque, Plataforma, PoliticaDeDeshidratacion, RaizRegistrada,
    ResultadoDeEnumeracion,
};
use std::fs;
use std::io::Read;
// DOS extensiones y no una: `dev`/`ino`/`size`/`mtime` vienen de la de Unix, y
// `st_flags` —el unico camino a `SF_DATALESS` sin abrir el archivo— solo existe en la
// de macOS. No hay ambiguedad porque los nombres no se pisan.
use std::os::macos::fs::MetadataExt as MetadataDeMacos;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// `#define SF_DATALESS 0x40000000` — el bit que marca un archivo cuyo contenido esta
/// desalojado a la nube. Se declara aca porque `libc` no lo exporta.
const SF_DATALESS: u32 = 0x4000_0000;

// Los tres numeros de `setiopolicy_np` vienen del SDK y estan verificados: el kernel
// acepta la llamada y retorna 0 en esta maquina.
const IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES: libc::c_int = 3;
const IOPOL_SCOPE_THREAD: libc::c_int = 1;
const IOPOL_MATERIALIZE_DATALESS_FILES_OFF: libc::c_int = 1;

unsafe extern "C" {
    /// El que AVANZA durante la suspension. `mach_absolute_time` es el que no, y usarlo
    /// es el modo de falla mas caro del reloj.
    fn mach_continuous_time() -> u64;
    fn mach_timebase_info(info: *mut MachTimebase) -> libc::c_int;
    fn setiopolicy_np(iotype: libc::c_int, scope: libc::c_int, policy: libc::c_int) -> libc::c_int;
}

#[repr(C)]
#[derive(Clone, Copy)]
struct MachTimebase {
    numer: u32,
    denom: u32,
}

pub struct Macos {
    /// Los tics de `mach_continuous_time` no son nanosegundos en todas las maquinas: en
    /// Intel la base es 125/3. Convertir aca y no en el llamador es lo que permite que
    /// `Instante` prometa nanosegundos sin que nadie tenga que acordarse.
    numer: u64,
    denom: u64,
}

impl Macos {
    /// Instala el respaldo de kernel contra la materializacion accidental **sobre el
    /// hilo llamador** y devuelve la plataforma.
    ///
    /// Se llama en cada hilo que vaya a barrer, porque el ambito es por hilo. Si el
    /// kernel lo rechaza no se aborta: la comprobacion previa de `SF_DATALESS` sigue
    /// siendo la primera linea y es la que el borrador manda. Esto es el cinturon
    /// ademas del tirante — la seguridad no puede depender de que el clasificador
    /// acierte, pero tampoco de que esta llamada exista.
    pub fn nueva() -> Result<Self, ErrorDePlataforma> {
        let mut base = MachTimebase { numer: 0, denom: 0 };
        let ok = unsafe { mach_timebase_info(&mut base) };
        if ok != 0 || base.denom == 0 {
            return Err(ErrorDePlataforma::RelojSinBase {
                motivo: "mach_timebase_info fallo: sin el, los tics no son nanosegundos",
            });
        }
        Self::proteger_el_hilo();
        Ok(Self {
            numer: base.numer as u64,
            denom: base.denom as u64,
        })
    }

    /// Idempotente y sin efecto observable si falla. Se expone para que cada hilo de
    /// barrido la llame al arrancar.
    pub fn proteger_el_hilo() {
        unsafe {
            setiopolicy_np(
                IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES,
                IOPOL_SCOPE_THREAD,
                IOPOL_MATERIALIZE_DATALESS_FILES_OFF,
            );
        }
    }

    fn absoluta(raiz: &RaizRegistrada, ruta: &RutaRelativa) -> PathBuf {
        raiz.ruta_absoluta.join(ruta.como_str())
    }

    /// De `Metadata` a lo que el nucleo usa. **Nunca abre el archivo**: todo sale de
    /// `lstat`, que es lo que vuelve verdadera la frase «renombrar y mover cuestan cero
    /// I/O».
    fn observar(m: &fs::Metadata) -> (Observacion, Hidratacion) {
        let id = ((m.dev() as u128) << 64) | (m.ino() as u128);
        let obs = Observacion {
            tamano: m.size(),
            mtime: Mtime {
                segundos: m.mtime(),
                nanos: m.mtime_nsec() as u32,
            },
            id_de_archivo: Some(IdDeArchivoDelSO(id)),
        };
        // `st_flags` es un `u32` en Darwin; `MetadataExt::flags()` de std lo expone.
        let hidratacion = if m.st_flags() & SF_DATALESS != 0 {
            Hidratacion::Deshidratado
        } else {
            Hidratacion::Materializado
        };
        (obs, hidratacion)
    }

    fn indeterminado(e: &std::io::Error) -> MotivoIndeterminado {
        match e.kind() {
            std::io::ErrorKind::PermissionDenied => MotivoIndeterminado::PermisoDenegado,
            _ => MotivoIndeterminado::ErrorDeEntradaSalida,
        }
    }

    fn recorrer(
        base: &Path,
        prefijo: &str,
        dev_de_la_raiz: u64,
        salida: &mut Vec<EntradaEnumerada>,
        errores: &mut Vec<savia_folder_contrato::plataforma::ErrorDeEntrada>,
    ) {
        let dir = match fs::read_dir(base) {
            Ok(d) => d,
            Err(e) => {
                errores.push(savia_folder_contrato::plataforma::ErrorDeEntrada {
                    ruta: RutaRelativa::canonica(prefijo).ok(),
                    errno: e.raw_os_error().unwrap_or(0),
                });
                return;
            }
        };
        for entrada in dir {
            let entrada = match entrada {
                Ok(x) => x,
                Err(e) => {
                    // Un error de UNA entrada no aborta: si abortara, todas las
                    // posteriores parecerian ausentes y eso es un borrado masivo
                    // inventado.
                    errores.push(savia_folder_contrato::plataforma::ErrorDeEntrada {
                        ruta: None,
                        errno: e.raw_os_error().unwrap_or(0),
                    });
                    continue;
                }
            };
            let nombre = entrada.file_name();
            let nombre = nombre.to_string_lossy().to_string();
            // `.git`, `.DS_Store`, `.env`, cachés de editor: ni se enumeran ni se
            // recuerdan (ver `nombre_excluido_por_convencion`). Corta ACA, antes del
            // `lstat` de mas abajo y antes de descender si es carpeta — un `.git`
            // adentro de la raiz vigilada puede tener miles de objetos sueltos, y
            // recorrerlos para descartarlos despues es I/O que nadie pidio.
            if savia_folder_contrato::dominio::nombre_excluido_por_convencion(&nombre) {
                continue;
            }
            let relativa = if prefijo.is_empty() {
                nombre.clone()
            } else {
                format!("{prefijo}/{nombre}")
            };
            // `symlink_metadata` es `lstat`: NO sigue el enlace. Seguirlo cuelga el
            // barrido ante un ciclo, y un barrido que no termina nunca cierra
            // `completo`, con lo que la cuarentena no vence jamas.
            let meta = match fs::symlink_metadata(entrada.path()) {
                Ok(m) => m,
                Err(e) => {
                    errores.push(savia_folder_contrato::plataforma::ErrorDeEntrada {
                        ruta: RutaRelativa::canonica(&relativa).ok(),
                        errno: e.raw_os_error().unwrap_or(0),
                    });
                    continue;
                }
            };
            let (obs, hid) = Self::observar(&meta);
            let tipo = meta.file_type();
            if tipo.is_symlink() {
                continue;
            }
            if meta.dev() != dev_de_la_raiz {
                // Un punto de montaje adentro de la raiz. No se desciende: montar un
                // NAS en `~/Savia` no puede convertir el NAS en corpus, y el desmontaje
                // siguiente produciria el borrado masivo aparente de todo eso.
                continue;
            }
            if tipo.is_dir() {
                Self::recorrer(&entrada.path(), &relativa, dev_de_la_raiz, salida, errores);
                continue;
            }
            if !tipo.is_file() {
                continue;
            }
            match RutaRelativa::canonica(&relativa) {
                Ok(r) => salida.push(EntradaEnumerada {
                    ruta: r,
                    clase: Clase::Archivo,
                    observacion: obs,
                    hidratacion: hid,
                }),
                Err(_) => errores.push(savia_folder_contrato::plataforma::ErrorDeEntrada {
                    ruta: None,
                    errno: 0,
                }),
            }
        }
        let _ = Clase::Directorio;
        let _ = Clase::Enlace;
        let _ = Clase::OtroVolumen;
        let _ = Clase::Otro;
    }
}

impl Plataforma for Macos {
    fn politica_de_deshidratacion(&self) -> PoliticaDeDeshidratacion {
        PoliticaDeDeshidratacion::LeerMaterializa
    }

    fn plan_de_arranque(
        &self,
        _raiz: &RaizRegistrada,
        _cursor: Option<&CursorDurable>,
    ) -> PlanDeArranque {
        // Sin cursor de FSEvents para el arranque todavia, macOS toma el MISMO brazo
        // que Windows (ver el encabezado del modulo: esto es distinto de las señales en
        // vivo, que si existen desde `observador.rs`). Es una de las situaciones que el
        // propio enum contempla, no una excepcion: el llamador es un `match` total y no
        // se entera.
        PlanDeArranque::BarridoCompleto {
            porque: MotivoDeBarrido::SinInventario,
        }
    }

    fn huella_de_raiz(&self, ruta: &Path) -> Result<HuellaDeRaiz, FalloDeEnumeracion> {
        let m = fs::metadata(ruta).map_err(|e| mapear_enumeracion(&e))?;
        if !m.is_dir() {
            return Err(FalloDeEnumeracion::NoEsDirectorio);
        }
        Ok(HuellaDeRaiz {
            volumen: IdDeVolumen::NumeroDeDispositivo(m.dev()),
            directorio: IdDeArchivoDelSO(m.ino() as u128),
        })
    }

    fn evidencia_de_raiz(&self, raiz: &RaizRegistrada) -> EvidenciaDeRaiz {
        let m = match fs::metadata(&raiz.ruta_absoluta) {
            Ok(m) => m,
            Err(e) => {
                return EvidenciaDeRaiz {
                    enumeracion: ResultadoDeEnumeracion::Fallo(mapear_enumeracion(&e)),
                    volumen: None,
                    directorio: None,
                };
            }
        };
        if !m.is_dir() {
            return EvidenciaDeRaiz {
                enumeracion: ResultadoDeEnumeracion::Fallo(FalloDeEnumeracion::NoEsDirectorio),
                volumen: None,
                directorio: None,
            };
        }
        let mut entradas = Vec::new();
        let mut errores = Vec::new();
        Self::recorrer(
            &raiz.ruta_absoluta,
            "",
            m.dev(),
            &mut entradas,
            &mut errores,
        );
        EvidenciaDeRaiz {
            enumeracion: ResultadoDeEnumeracion::Listada { entradas, errores },
            volumen: Some(IdDeVolumen::NumeroDeDispositivo(m.dev())),
            directorio: Some(IdDeArchivoDelSO(m.ino() as u128)),
        }
    }

    fn ficha(&self, raiz: &RaizRegistrada, ruta: &RutaRelativa) -> Ficha {
        match fs::symlink_metadata(Self::absoluta(raiz, ruta)) {
            Ok(m) => {
                if !m.file_type().is_file() {
                    // Un directorio o un enlace donde el inventario esperaba un archivo
                    // no es «no existe»: es que lo que hay no es lo que era.
                    return Ficha::Indeterminada(MotivoIndeterminado::ErrorDeEntradaSalida);
                }
                let (observacion, hidratacion) = Self::observar(&m);
                Ficha::Presente {
                    observacion,
                    hidratacion,
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ficha::NoExiste,
            Err(e) => Ficha::Indeterminada(Self::indeterminado(&e)),
        }
    }

    fn hashear(
        &self,
        raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<(HashAfirmado, Observacion), FalloDeLectura> {
        let p = Self::absoluta(raiz, ruta);
        // LA COMPROBACION PREVIA. Va antes del `open` y no despues, y no es una
        // optimizacion: en macOS el `open` de un `SF_DATALESS` BLOQUEA Y MATERIALIZA.
        let antes = fs::symlink_metadata(&p).map_err(mapear_lectura)?;
        let (obs_antes, hid) = Self::observar(&antes);
        if hid != Hidratacion::Materializado {
            return Err(FalloDeLectura::HidratacionRequerida);
        }
        let mut f = fs::File::open(&p).map_err(mapear_lectura)?;
        let mut buf = [0u8; 64 * 1024];
        let mut estado = savia_folder_contrato::hash::Sha256Incremental::nuevo();
        loop {
            let n = f.read(&mut buf).map_err(mapear_lectura)?;
            if n == 0 {
                break;
            }
            estado.agregar(&buf[..n]);
        }
        // CIERRE VERIFICANDO. Un hash de un archivo a medio escribir es una afirmacion
        // falsa que despues viaja como `presence.observed` y hace subir bytes que no son
        // de ninguna version. El asentamiento baja la probabilidad; esto lo DETECTA.
        let despues = fs::symlink_metadata(&p).map_err(mapear_lectura)?;
        let (obs_despues, _) = Self::observar(&despues);
        if obs_antes != obs_despues {
            return Err(FalloDeLectura::CambioMientrasSeLeia);
        }
        Ok((estado.terminar(), obs_despues))
    }

    fn leer_para_subir(
        &self,
        raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<Vec<u8>, FalloDeLectura> {
        let p = Self::absoluta(raiz, ruta);
        let m = fs::symlink_metadata(&p).map_err(mapear_lectura)?;
        let (_, hid) = Self::observar(&m);
        if hid != Hidratacion::Materializado {
            return Err(FalloDeLectura::HidratacionRequerida);
        }
        fs::read(&p).map_err(mapear_lectura)
    }

    fn granularidad_de_mtime(&self, _raiz: &RaizRegistrada) -> Duration {
        // APFS y HFS+ guardan nanosegundos. **CERO NO ES UN NUMERO INVENTADO**: es la
        // ausencia de tolerancia, o sea comparar exacto, que es el lado seguro —cuesta
        // un rehash de mas, nunca una edicion perdida—. Una raiz sobre SMB o FAT
        // necesita medirla escribiendo un archivo con un timestamp conocido, releyendolo
        // y observando el truncamiento; esa sonda todavia no existe.
        Duration::ZERO
    }

    fn ahora(&self) -> Instante {
        let tics = unsafe { mach_continuous_time() };
        Instante::desde_nanos((tics as u128 * self.numer as u128 / self.denom as u128) as u64)
    }
}

fn mapear_lectura(e: std::io::Error) -> FalloDeLectura {
    match e.kind() {
        std::io::ErrorKind::NotFound => FalloDeLectura::YaNoEsta,
        std::io::ErrorKind::PermissionDenied => FalloDeLectura::PermisoDenegado,
        _ => FalloDeLectura::ErrorDeEntradaSalida,
    }
}

fn mapear_enumeracion(e: &std::io::Error) -> FalloDeEnumeracion {
    match e.kind() {
        std::io::ErrorKind::NotFound => FalloDeEnumeracion::NoMontado,
        std::io::ErrorKind::PermissionDenied => FalloDeEnumeracion::PermisoDenegado,
        _ => FalloDeEnumeracion::ErrorDeEs,
    }
}
